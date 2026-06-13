-- =============================================================================
-- Travel Editor — normalize the document into a relational schema.
--
-- Until now the entire travel document lived as a single JSONB blob in
-- `travel_records.data`. This migration introduces a branched relational model
-- (documents → countries → cities → years, plus country timeline entries) while
-- keeping the client contract unchanged: the editor still reads and writes a
-- whole `TravelData` JSON. Reads/writes go through SECURITY DEFINER functions
-- that assemble/disassemble the JSON atomically, so offline-first sync and the
-- public share contract (`get_shared_travel` -> TravelData jsonb) are preserved.
--
-- `travel_records` is intentionally left in place as a read-only archive; a
-- later migration can drop it once the relational model is confirmed in prod.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "unaccent";

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

-- Parent: one document per user. Mirrors the metadata previously on
-- travel_records (is_public / share_slug / version) plus the scalar birthplace.
create table if not exists public.travel_documents (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null unique references auth.users (id) on delete cascade,
  birthplace_country text not null default '',
  is_public          boolean not null default false,
  share_slug         text unique,
  version            integer not null default 1,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.travel_documents is
  'One travel document per user (unique user_id). Relational root; RLS-isolated.';

create index if not exists travel_documents_share_slug_idx
  on public.travel_documents (share_slug)
  where share_slug is not null;

create table if not exists public.visited_countries (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references public.travel_documents (id) on delete cascade,
  name            text not null default '',
  canonical_name  text not null default '',
  position        integer not null default 0,
  visited         boolean not null default false,
  lived           boolean not null default false,
  birthplace      boolean not null default false,
  capital_visited boolean not null default false
);

-- Non-unique on purpose: the editor allows blank/duplicate country names while
-- editing, so a unique(document_id, canonical_name) would reject valid saves.
create index if not exists visited_countries_document_idx
  on public.visited_countries (document_id);
create index if not exists visited_countries_canonical_idx
  on public.visited_countries (canonical_name);

create table if not exists public.country_timeline_entries (
  id         uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.visited_countries (id) on delete cascade,
  kind       text not null check (kind in ('visited', 'lived')),
  value      text not null
);

create index if not exists country_timeline_entries_country_idx
  on public.country_timeline_entries (country_id);

create table if not exists public.cities (
  id         uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.visited_countries (id) on delete cascade,
  name       text not null default '',
  position   integer not null default 0
);

create index if not exists cities_country_idx on public.cities (country_id);

create table if not exists public.city_visit_years (
  id      uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id) on delete cascade,
  year    integer not null check (year between 1900 and 2100),
  unique (city_id, year)
);

create index if not exists city_visit_years_city_idx on public.city_visit_years (city_id);

-- -----------------------------------------------------------------------------
-- Triggers on the parent: bump updated_at + version on update; mint a share
-- slug the first time the document is published. (Same behavior as 0001.)
-- -----------------------------------------------------------------------------
drop trigger if exists trg_touch_travel_document on public.travel_documents;
create trigger trg_touch_travel_document
  before update on public.travel_documents
  for each row execute function public.tg_touch_travel_record();

drop trigger if exists trg_manage_document_slug on public.travel_documents;
create trigger trg_manage_document_slug
  before insert or update on public.travel_documents
  for each row execute function public.tg_manage_share_slug();

-- -----------------------------------------------------------------------------
-- Row Level Security: owners only. Child rows are owned transitively through
-- their document. Clients never touch these tables directly (all access is via
-- the SECURITY DEFINER functions below) — these policies are defense in depth.
-- -----------------------------------------------------------------------------
alter table public.travel_documents enable row level security;
drop policy if exists document_owner_all on public.travel_documents;
create policy document_owner_all on public.travel_documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.visited_countries enable row level security;
drop policy if exists country_owner_all on public.visited_countries;
create policy country_owner_all on public.visited_countries
  for all
  using (exists (select 1 from public.travel_documents d
                 where d.id = document_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.travel_documents d
                      where d.id = document_id and d.user_id = auth.uid()));

alter table public.country_timeline_entries enable row level security;
drop policy if exists timeline_owner_all on public.country_timeline_entries;
create policy timeline_owner_all on public.country_timeline_entries
  for all
  using (exists (select 1 from public.visited_countries c
                 join public.travel_documents d on d.id = c.document_id
                 where c.id = country_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.visited_countries c
                      join public.travel_documents d on d.id = c.document_id
                      where c.id = country_id and d.user_id = auth.uid()));

alter table public.cities enable row level security;
drop policy if exists city_owner_all on public.cities;
create policy city_owner_all on public.cities
  for all
  using (exists (select 1 from public.visited_countries c
                 join public.travel_documents d on d.id = c.document_id
                 where c.id = country_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.visited_countries c
                      join public.travel_documents d on d.id = c.document_id
                      where c.id = country_id and d.user_id = auth.uid()));

alter table public.city_visit_years enable row level security;
drop policy if exists city_year_owner_all on public.city_visit_years;
create policy city_year_owner_all on public.city_visit_years
  for all
  using (exists (select 1 from public.cities ci
                 join public.visited_countries c on c.id = ci.country_id
                 join public.travel_documents d on d.id = c.document_id
                 where ci.id = city_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.cities ci
                      join public.visited_countries c on c.id = ci.country_id
                      join public.travel_documents d on d.id = c.document_id
                      where ci.id = city_id and d.user_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- Helper: canonical comparison key for a country name. Mirrors the client-side
-- canonicalCountryName() (strip accents, lowercase, collapse non-alphanumerics).
-- -----------------------------------------------------------------------------
create or replace function public.canonical_country_name(p_name text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(lower(unaccent(coalesce(p_name, ''))), '[^a-z0-9]+', ' ', 'g'));
$$;

-- -----------------------------------------------------------------------------
-- Helper: assemble a TravelData JSON document from the relational rows. This is
-- the single place that defines the JSON shape on the read path; both the owner
-- read and the public share read go through it.
-- -----------------------------------------------------------------------------
create or replace function public.build_travel_json(p_doc_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'person', jsonb_build_object(
      'birthplace', jsonb_build_object('country', d.birthplace_country)
    ),
    'travel', jsonb_build_object(
      'countries', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'name', vc.name,
            'status', jsonb_build_object(
              'visited', vc.visited,
              'lived', vc.lived,
              'birthplace', vc.birthplace
            ),
            'capitalVisit', jsonb_build_object('visited', vc.capital_visited),
            'timeline', jsonb_build_object(
              'visited', coalesce((
                select jsonb_agg(e.value order by e.value)
                from public.country_timeline_entries e
                where e.country_id = vc.id and e.kind = 'visited'
              ), '[]'::jsonb),
              'lived', coalesce((
                select jsonb_agg(e.value order by e.value)
                from public.country_timeline_entries e
                where e.country_id = vc.id and e.kind = 'lived'
              ), '[]'::jsonb)
            ),
            'cities', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'name', ci.name,
                  'timeline', jsonb_build_object(
                    'visited', coalesce((
                      select jsonb_agg(y.year order by y.year)
                      from public.city_visit_years y
                      where y.city_id = ci.id
                    ), '[]'::jsonb)
                  )
                ) order by ci.position
              )
              from public.cities ci
              where ci.country_id = vc.id
            ), '[]'::jsonb)
          ) order by vc.position
        )
        from public.visited_countries vc
        where vc.document_id = p_doc_id
      ), '[]'::jsonb)
    )
  )
  from public.travel_documents d
  where d.id = p_doc_id;
$$;

-- -----------------------------------------------------------------------------
-- Helper: wrap a document's data plus its sharing metadata into the envelope
-- the client's data layer expects.
-- -----------------------------------------------------------------------------
create or replace function public.build_document_envelope(p_doc_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'data', public.build_travel_json(d.id),
    'is_public', d.is_public,
    'share_slug', d.share_slug,
    'version', d.version
  )
  from public.travel_documents d
  where d.id = p_doc_id;
$$;

-- -----------------------------------------------------------------------------
-- Helper: replace all child rows of a document from a TravelData JSON payload.
-- Delete + reinsert in one statement-set keeps the write atomic and simple; the
-- function is reused by both save_travel_document() and the backfill below.
-- -----------------------------------------------------------------------------
create or replace function public.replace_document_children(p_doc_id uuid, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_country    jsonb;
  v_country_id uuid;
  v_city       jsonb;
  v_city_id    uuid;
  v_pos        integer := 0;
  v_city_pos   integer;
begin
  delete from public.visited_countries where document_id = p_doc_id;

  for v_country in
    select value from jsonb_array_elements(coalesce(p_data #> '{travel,countries}', '[]'::jsonb))
  loop
    insert into public.visited_countries (
      document_id, name, canonical_name, position,
      visited, lived, birthplace, capital_visited
    ) values (
      p_doc_id,
      coalesce(v_country->>'name', ''),
      public.canonical_country_name(coalesce(v_country->>'name', '')),
      v_pos,
      coalesce((v_country #>> '{status,visited}')::boolean, false),
      coalesce((v_country #>> '{status,lived}')::boolean, false),
      coalesce((v_country #>> '{status,birthplace}')::boolean, false),
      coalesce((v_country #>> '{capitalVisit,visited}')::boolean, false)
    )
    returning id into v_country_id;

    insert into public.country_timeline_entries (country_id, kind, value)
    select v_country_id, 'visited', e
    from jsonb_array_elements_text(coalesce(v_country #> '{timeline,visited}', '[]'::jsonb)) as e
    where length(trim(e)) > 0;

    insert into public.country_timeline_entries (country_id, kind, value)
    select v_country_id, 'lived', e
    from jsonb_array_elements_text(coalesce(v_country #> '{timeline,lived}', '[]'::jsonb)) as e
    where length(trim(e)) > 0;

    v_city_pos := 0;
    for v_city in
      select value from jsonb_array_elements(coalesce(v_country->'cities', '[]'::jsonb))
    loop
      insert into public.cities (country_id, name, position)
      values (v_country_id, coalesce(v_city->>'name', ''), v_city_pos)
      returning id into v_city_id;

      insert into public.city_visit_years (city_id, year)
      select v_city_id, y::int
      from jsonb_array_elements_text(coalesce(v_city #> '{timeline,visited}', '[]'::jsonb)) as y
      where y ~ '^\d+$' and y::int between 1900 and 2100
      on conflict (city_id, year) do nothing;

      v_city_pos := v_city_pos + 1;
    end loop;

    v_pos := v_pos + 1;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Client API: read the signed-in user's document as a TravelData envelope.
-- Returns null when the user has no document yet (first run).
-- -----------------------------------------------------------------------------
create or replace function public.get_my_travel_document()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.build_document_envelope(d.id)
  from public.travel_documents d
  where d.user_id = auth.uid()
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- Client API: persist the whole document. Upserts the parent (the update path
-- bumps version via the trigger), then replaces all child rows atomically.
-- -----------------------------------------------------------------------------
create or replace function public.save_travel_document(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_doc_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated.';
  end if;

  insert into public.travel_documents (user_id, birthplace_country)
  values (v_uid, coalesce(p_data #>> '{person,birthplace,country}', ''))
  on conflict (user_id) do update
    set birthplace_country = excluded.birthplace_country
  returning id into v_doc_id;

  perform public.replace_document_children(v_doc_id, p_data);

  return public.build_document_envelope(v_doc_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Client API: toggle public sharing and return the refreshed envelope. The
-- trigger mints a share slug on first publish.
-- -----------------------------------------------------------------------------
create or replace function public.set_travel_sharing(p_is_public boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_doc_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated.';
  end if;

  update public.travel_documents
    set is_public = p_is_public
  where user_id = v_uid
  returning id into v_doc_id;

  if v_doc_id is null then
    raise exception 'No travel document.';
  end if;

  return public.build_document_envelope(v_doc_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Public sharing: assemble the same TravelData JSON from the relational rows
-- for a published slug. Contract unchanged from 0001 — returns ONLY the payload.
-- -----------------------------------------------------------------------------
create or replace function public.get_shared_travel(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.build_travel_json(d.id)
  from public.travel_documents d
  where d.share_slug = p_slug
    and d.is_public = true
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- Grants. Internal helpers are reachable only inside the SECURITY DEFINER chain
-- (the owner context), never directly by clients.
-- -----------------------------------------------------------------------------
revoke all on function public.canonical_country_name(text) from public;
revoke all on function public.build_travel_json(uuid) from public;
revoke all on function public.build_document_envelope(uuid) from public;
revoke all on function public.replace_document_children(uuid, jsonb) from public;

revoke all on function public.get_my_travel_document() from public;
grant execute on function public.get_my_travel_document() to authenticated;

revoke all on function public.save_travel_document(jsonb) from public;
grant execute on function public.save_travel_document(jsonb) to authenticated;

revoke all on function public.set_travel_sharing(boolean) from public;
grant execute on function public.set_travel_sharing(boolean) to authenticated;

revoke all on function public.get_shared_travel(text) from public;
grant execute on function public.get_shared_travel(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Backfill: migrate existing JSONB documents into the relational tables.
-- Parent rows first (preserving slug/version/timestamps), then children.
-- -----------------------------------------------------------------------------
insert into public.travel_documents
  (user_id, birthplace_country, is_public, share_slug, version, created_at, updated_at)
select
  tr.user_id,
  coalesce(tr.data #>> '{person,birthplace,country}', ''),
  tr.is_public,
  tr.share_slug,
  tr.version,
  tr.created_at,
  tr.updated_at
from public.travel_records tr
on conflict (user_id) do nothing;

do $$
declare
  r record;
begin
  for r in
    select d.id as doc_id, tr.data
    from public.travel_documents d
    join public.travel_records tr on tr.user_id = d.user_id
  loop
    perform public.replace_document_children(r.doc_id, r.data);
  end loop;
end;
$$;

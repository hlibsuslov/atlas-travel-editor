-- =============================================================================
-- Travel Editor — initial schema
-- One travel document per user, with opt-in public sharing by slug.
-- Security model: Row Level Security isolates every user's row; public sharing
-- is exposed through a narrow SECURITY DEFINER function that returns only the
-- document payload, never ownership metadata.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Table
-- -----------------------------------------------------------------------------
create table if not exists public.travel_records (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users (id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  is_public   boolean not null default false,
  share_slug  text unique,
  version     integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.travel_records is 'One travel document per user (unique user_id). RLS-isolated.';

create index if not exists travel_records_share_slug_idx
  on public.travel_records (share_slug)
  where share_slug is not null;

-- -----------------------------------------------------------------------------
-- Triggers: bump updated_at + version on every update; mint a share slug the
-- first time a record is published.
-- -----------------------------------------------------------------------------
create or replace function public.tg_touch_travel_record()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

create or replace function public.tg_manage_share_slug()
returns trigger
language plpgsql
as $$
begin
  -- Mint a URL-safe slug once, the first time the record becomes public.
  if new.is_public and new.share_slug is null then
    new.share_slug := translate(encode(gen_random_bytes(12), 'base64'), '+/=', '');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_touch_travel_record on public.travel_records;
create trigger trg_touch_travel_record
  before update on public.travel_records
  for each row execute function public.tg_touch_travel_record();

drop trigger if exists trg_manage_share_slug on public.travel_records;
create trigger trg_manage_share_slug
  before insert or update on public.travel_records
  for each row execute function public.tg_manage_share_slug();

-- -----------------------------------------------------------------------------
-- Row Level Security: owners only. There is intentionally NO public SELECT
-- policy — anonymous sharing goes through get_shared_travel() below so that
-- only the document payload is ever exposed.
-- -----------------------------------------------------------------------------
alter table public.travel_records enable row level security;

drop policy if exists owner_select on public.travel_records;
create policy owner_select on public.travel_records
  for select using (auth.uid() = user_id);

drop policy if exists owner_insert on public.travel_records;
create policy owner_insert on public.travel_records
  for insert with check (auth.uid() = user_id);

drop policy if exists owner_update on public.travel_records;
create policy owner_update on public.travel_records
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists owner_delete on public.travel_records;
create policy owner_delete on public.travel_records
  for delete using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Public sharing: returns ONLY the data payload for a published slug.
-- SECURITY DEFINER bypasses RLS but the query is constrained to is_public rows
-- and selects a single column, so no ownership data can leak.
-- -----------------------------------------------------------------------------
create or replace function public.get_shared_travel(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select data
  from public.travel_records
  where share_slug = p_slug
    and is_public = true
  limit 1;
$$;

revoke all on function public.get_shared_travel(text) from public;
grant execute on function public.get_shared_travel(text) to anon, authenticated;

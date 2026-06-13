-- =============================================================================
-- Profiles — a public identity (display name + avatar accent color) so friends
-- see real names instead of opaque share codes.
--
-- A profile is owned by its user (RLS). The slice that is visible to others is
-- exposed ONLY through get_shared_profile(slug): given a *public* document's
-- share slug, it returns that owner's display name and color — never the
-- user_id or anything else. This mirrors the get_shared_travel() pattern.
--
-- We intentionally avoid avatar image URLs: the app's CSP restricts img-src to
-- 'self' data:, so external avatars wouldn't render. A chosen accent color + the
-- name's initials gives a personal look without weakening the CSP.
-- =============================================================================

create table if not exists public.profiles (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null default '',
  accent_color  text not null default '',
  public_handle text unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is 'Per-user public identity (display name + avatar color).';

alter table public.profiles enable row level security;

drop policy if exists profile_owner_all on public.profiles;
create policy profile_owner_all on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Owner read/write of their own profile.
-- -----------------------------------------------------------------------------
create or replace function public.get_my_profile()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'display_name', p.display_name,
    'accent_color', p.accent_color,
    'public_handle', p.public_handle
  )
  from public.profiles p
  where p.user_id = auth.uid();
$$;

create or replace function public.save_my_profile(p_display_name text, p_accent_color text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated.';
  end if;

  insert into public.profiles (user_id, display_name, accent_color)
  values (v_uid, coalesce(p_display_name, ''), coalesce(p_accent_color, ''))
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        accent_color = excluded.accent_color,
        updated_at = now();

  return public.get_my_profile();
end;
$$;

-- -----------------------------------------------------------------------------
-- Public read: resolve a *published* document's slug to its owner's identity.
-- Returns null when the slug is unknown, not public, or the owner has no
-- profile. Never exposes user_id.
-- -----------------------------------------------------------------------------
create or replace function public.get_shared_profile(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'display_name', p.display_name,
    'accent_color', p.accent_color
  )
  from public.travel_documents d
  join public.profiles p on p.user_id = d.user_id
  where d.share_slug = p_slug
    and d.is_public = true
  limit 1;
$$;

revoke all on function public.get_my_profile() from public;
grant execute on function public.get_my_profile() to authenticated;

revoke all on function public.save_my_profile(text, text) from public;
grant execute on function public.save_my_profile(text, text) to authenticated;

revoke all on function public.get_shared_profile(text) from public;
grant execute on function public.get_shared_profile(text) to anon, authenticated;

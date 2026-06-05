-- =============================================================================
-- Friends — follow other users by their public share code (slug) and browse
-- their shared travel maps. RLS keeps each user's follow list private to them;
-- the friend's map data is read through the existing get_shared_travel() path,
-- so following someone only ever exposes what they chose to make public.
-- =============================================================================

create table if not exists public.friend_links (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  slug        text not null,
  label       text,
  created_at  timestamptz not null default now(),
  unique (user_id, slug)
);

comment on table public.friend_links is 'Per-user list of followed public share slugs.';

create index if not exists friend_links_user_idx on public.friend_links (user_id);

alter table public.friend_links enable row level security;

drop policy if exists friend_links_owner_all on public.friend_links;
create policy friend_links_owner_all on public.friend_links
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

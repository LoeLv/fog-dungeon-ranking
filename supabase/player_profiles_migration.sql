-- Player profile and leaderboard storage.
-- Safe to run on the existing Supabase project.

create table if not exists public.player_profiles (
  invite_code_hash text primary key check (char_length(invite_code_hash) = 64),
  display_name text not null check (char_length(trim(display_name)) between 1 and 40),
  role text not null check (role in ('player', 'author', 'reviewer', 'admin')),
  faith_god text not null check (char_length(trim(faith_god)) between 1 and 20),
  faith_path text not null check (char_length(trim(faith_path)) between 1 and 20),
  profession text not null check (char_length(trim(profession)) between 1 and 40),
  ascension_score numeric(8, 1) not null default 1000 check (ascension_score >= 0 and ascension_score <= 999999),
  audience_score numeric(8, 1) not null default 0 check (audience_score >= 0 and audience_score <= 999999),
  items text not null default '',
  talents text not null default '',
  scores_locked_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists player_profiles_ascension_idx
on public.player_profiles (ascension_score desc, audience_score desc, updated_at desc);

create index if not exists player_profiles_audience_idx
on public.player_profiles (audience_score desc, ascension_score desc, updated_at desc);

create index if not exists player_profiles_path_idx
on public.player_profiles (faith_path, ascension_score desc, audience_score desc);

alter table public.player_profiles enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.player_profiles to service_role;

alter table public.player_profiles alter column ascension_score set default 1000;
alter table public.player_profiles alter column audience_score set default 0;

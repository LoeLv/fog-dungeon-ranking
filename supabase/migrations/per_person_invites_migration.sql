-- Adds per-person invite codes and one-rating-per-invite enforcement.
-- Safe to run on the existing Supabase project.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (char_length(code_hash) = 64),
  display_name text not null check (char_length(trim(display_name)) between 1 and 40),
  role text not null check (role in ('player', 'author', 'reviewer', 'admin')),
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.dungeons add column if not exists invite_code_hash text;
alter table public.dungeons add column if not exists invite_name text;
alter table public.dungeons add column if not exists participant_count integer;
alter table public.dungeons add column if not exists run_count integer;
alter table public.dungeons add column if not exists clear_count integer;
alter table public.dungeons add column if not exists clear_rate numeric(5, 2);
alter table public.ratings add column if not exists invite_code_hash text;
alter table public.ratings add column if not exists invite_name text;
alter table public.comments add column if not exists invite_code_hash text;
alter table public.comments add column if not exists invite_name text;

update public.dungeons
set participant_count = coalesce(participant_count, 1)
where participant_count is null;

update public.dungeons
set run_count = coalesce(run_count, 1)
where run_count is null;

update public.dungeons
set clear_count = coalesce(clear_count, 0)
where clear_count is null;

update public.dungeons
set clear_rate = coalesce(clear_rate, 0)
where clear_rate is null;

alter table public.dungeons alter column participant_count set default 1;
alter table public.dungeons alter column participant_count set not null;
alter table public.dungeons alter column run_count set default 1;
alter table public.dungeons alter column run_count set not null;
alter table public.dungeons alter column clear_count set default 0;
alter table public.dungeons alter column clear_count set not null;
alter table public.dungeons alter column clear_rate set default 0;
alter table public.dungeons alter column clear_rate set not null;

alter table public.dungeons drop constraint if exists dungeons_participant_count_check;
alter table public.dungeons add constraint dungeons_participant_count_check
  check (participant_count >= 1);

alter table public.dungeons drop constraint if exists dungeons_run_count_check;
alter table public.dungeons add constraint dungeons_run_count_check
  check (run_count >= 1);

alter table public.dungeons drop constraint if exists dungeons_clear_count_check;
alter table public.dungeons add constraint dungeons_clear_count_check
  check (clear_count >= 0);

alter table public.dungeons drop constraint if exists dungeons_clear_rate_check;
alter table public.dungeons add constraint dungeons_clear_rate_check
  check (clear_rate >= 0 and clear_rate <= 100);

create table if not exists public.clear_records (
  id uuid primary key default gen_random_uuid(),
  dungeon_id uuid not null references public.dungeons(id) on delete cascade,
  run_number integer not null check (run_number >= 1),
  invite_code_hash text not null,
  invite_name text,
  created_at timestamptz not null default now()
);

create unique index if not exists ratings_one_per_invite_code_idx
  on public.ratings(dungeon_id, invite_code_hash)
  where invite_code_hash is not null;

create index if not exists invite_codes_role_idx on public.invite_codes(role, is_active);
create index if not exists clear_records_dungeon_id_idx on public.clear_records(dungeon_id, run_number);
create unique index if not exists clear_records_one_per_invite_run_idx
  on public.clear_records(dungeon_id, run_number, invite_code_hash);

alter table public.invite_codes enable row level security;
alter table public.clear_records enable row level security;

revoke all on public.invite_codes from anon, authenticated;
revoke all on public.clear_records from anon, authenticated;
grant select, insert, update, delete on public.invite_codes to service_role;
grant select, insert, update, delete on public.clear_records to service_role;

grant select, insert, update, delete on public.dungeons to service_role;
grant select, insert, update, delete on public.ratings to service_role;
grant select, insert, update, delete on public.comments to service_role;

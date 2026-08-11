-- Star account support for the website memorial system.
-- Run after god_accounts_migration_20260712.sql and player_profiles_migration.sql.

begin;

alter table public.invite_codes
  drop constraint if exists invite_codes_role_check;
alter table public.invite_codes
  add constraint invite_codes_role_check
  check (role in ('player', 'author', 'reviewer', 'admin', 'god', 'star'));

alter table public.player_profiles
  drop constraint if exists player_profiles_role_check;
alter table public.player_profiles
  add constraint player_profiles_role_check
  check (role in ('player', 'author', 'reviewer', 'admin', 'god', 'star'));

commit;

-- God account support for the personal invite system.
-- Run after score_system_migration.sql / player_profiles_migration.sql.

begin;

alter table public.invite_codes
  drop constraint if exists invite_codes_role_check;
alter table public.invite_codes
  add constraint invite_codes_role_check
  check (role in ('player', 'author', 'reviewer', 'admin', 'god'));

alter table public.player_profiles
  drop constraint if exists player_profiles_role_check;
alter table public.player_profiles
  add constraint player_profiles_role_check
  check (role in ('player', 'author', 'reviewer', 'admin'));

create unique index if not exists invite_codes_active_god_name_unique
  on public.invite_codes (display_name)
  where role = 'god' and is_active;

commit;

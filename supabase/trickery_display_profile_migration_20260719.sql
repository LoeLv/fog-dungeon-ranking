-- Persist the visual faith and profession disguise for trickery-origin profiles.
-- The real faith/profession fields remain the original trickery binding and continue to drive talents.

begin;

alter table public.player_profiles
  add column if not exists trickery_display_faith_god text,
  add column if not exists trickery_display_faith_path text,
  add column if not exists trickery_display_profession text;

alter table public.player_profiles
  drop constraint if exists player_profiles_trickery_display_faith_god_check;
alter table public.player_profiles
  add constraint player_profiles_trickery_display_faith_god_check
  check (trickery_display_faith_god is null or char_length(trim(trickery_display_faith_god)) between 1 and 20);

alter table public.player_profiles
  drop constraint if exists player_profiles_trickery_display_faith_path_check;
alter table public.player_profiles
  add constraint player_profiles_trickery_display_faith_path_check
  check (trickery_display_faith_path is null or char_length(trim(trickery_display_faith_path)) between 1 and 20);

alter table public.player_profiles
  drop constraint if exists player_profiles_trickery_display_profession_check;
alter table public.player_profiles
  add constraint player_profiles_trickery_display_profession_check
  check (trickery_display_profession is null or char_length(trim(trickery_display_profession)) between 1 and 40);

commit;

-- Verification: the following query should return three rows.
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'player_profiles'
  and column_name in ('trickery_display_faith_god', 'trickery_display_faith_path', 'trickery_display_profession')
order by column_name;

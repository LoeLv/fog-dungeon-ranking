-- Allow one player to keep multiple active titles and curses.
-- Run after profile_titles_migration.sql and profile_curses_migration.sql.

begin;

drop index if exists public.profile_titles_one_active_idx;
drop index if exists public.profile_curses_one_active_idx;

create index if not exists profile_titles_active_player_idx
  on public.profile_titles(invite_code_hash, is_active, granted_at desc);

create index if not exists profile_curses_active_player_idx
  on public.profile_curses(invite_code_hash, is_active, granted_at desc);

commit;

-- Personal title visibility. Curses are stored separately and are never affected.
-- Existing profiles retain their current title display by default.

begin;

alter table public.player_profiles
  add column if not exists show_titles boolean not null default true;

update public.player_profiles
set show_titles = true
where show_titles is null;

commit;

-- Verification
select column_name, column_default, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'player_profiles'
  and column_name = 'show_titles';

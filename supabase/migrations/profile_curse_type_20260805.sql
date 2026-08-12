-- Add curse type support for betrayal curses and ordinary curses.
-- Existing rows default to betrayal so old behavior remains intact.

begin;

alter table public.profile_curses
  add column if not exists curse_type text not null default 'betrayal'
  check (curse_type in ('betrayal', 'ordinary'));

update public.profile_curses
set curse_type = 'betrayal'
where curse_type is null or curse_type not in ('betrayal', 'ordinary');

commit;

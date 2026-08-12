-- Dungeon review workflow.
-- Authors submit into pending review; reviewers/admins/gods can approve before public release.

begin;

alter table public.dungeons
  add column if not exists review_status text not null default 'approved',
  add column if not exists reviewed_by_hash text,
  add column if not exists reviewed_by_name text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text not null default '';

alter table public.dungeons
  drop constraint if exists dungeons_review_status_check;
alter table public.dungeons
  add constraint dungeons_review_status_check
  check (review_status in ('pending', 'approved', 'rejected'));

create index if not exists dungeons_review_status_created_idx
  on public.dungeons(review_status, created_at desc);

update public.invite_codes
set role = 'reviewer'
where display_name in ('羔羊', '槐柏')
  and role <> 'reviewer';

update public.player_profiles
set role = 'reviewer',
    updated_at = now()
where display_name in ('羔羊', '槐柏')
  and role <> 'reviewer';

drop policy if exists "Public dungeon read" on public.dungeons;
create policy "Public dungeon read"
on public.dungeons
for select
to anon, authenticated
using (review_status = 'approved');

commit;

select display_name, role
from public.invite_codes
where display_name in ('羔羊', '槐柏')
order by display_name;

select display_name, role
from public.player_profiles
where display_name in ('羔羊', '槐柏')
order by display_name;

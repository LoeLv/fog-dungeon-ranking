-- Remove dungeon review gate: uploaded dungeons are published immediately.
-- All existing rows are normalized to 'approved' and the public read policy no
-- longer filters by review_status. Columns are kept (unused) for backward
-- compatibility and to avoid breaking historical patches.

begin;

-- 1) Normalize legacy pending / rejected rows so nothing stays hidden.
update public.dungeons
set review_status = 'approved',
    reviewed_by_hash = null,
    reviewed_by_name = null,
    reviewed_at = null,
    review_note = ''
where review_status <> 'approved';

-- 2) New rows default to approved (no reviewer step).
alter table public.dungeons
  alter column review_status set default 'approved';

-- 3) Public read no longer depends on review_status.
drop policy if exists "Public dungeon read" on public.dungeons;
create policy "Public dungeon read"
on public.dungeons
for select
to anon, authenticated
using (true);

commit;

select review_status, count(*)
from public.dungeons
group by review_status
order by review_status;

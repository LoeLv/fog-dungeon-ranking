-- Upgrade existing exclusive talents/templates to EX and provide safe deletion.
-- Run after exclusive_talent_slot_migration_20260914.sql.

begin;

alter table public.exclusive_talents
  drop constraint if exists exclusive_talents_rank_check;
update public.exclusive_talents
set rank = 'EX'
where rank <> 'EX';
alter table public.exclusive_talents
  add constraint exclusive_talents_rank_ex_check check (rank = 'EX');

alter table public.exclusive_talent_templates
  drop constraint if exists exclusive_talent_templates_rank_check;
update public.exclusive_talent_templates
set rank = 'EX'
where rank <> 'EX';
alter table public.exclusive_talent_templates
  add constraint exclusive_talent_templates_rank_ex_check check (rank = 'EX');

commit;

select 'exclusive_talents' as item, count(*) as rows_found
from public.exclusive_talents
union all
select 'exclusive_talent_templates', count(*)
from public.exclusive_talent_templates;

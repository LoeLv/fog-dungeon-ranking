-- Add cooldown metadata for talent-pool admin maintenance.
-- Safe to run after admin_member_talent_pool_migration_20260809.sql.

begin;

alter table public.talent_pool_items
  add column if not exists cooldown text not null default '';

update public.talent_pool_items
set cooldown = ''
where cooldown is null;

commit;

select
  count(*) as talent_pool_items,
  count(*) filter (where cooldown is not null) as rows_with_cooldown
from public.talent_pool_items;

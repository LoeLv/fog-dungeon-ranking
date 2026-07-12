-- Support separate S-rank pity counters for 1500+ talent draw rules.
-- Safe to run after talent_pool_migration.sql.

alter table public.talent_pool_counters
  add column if not exists s_continue_draw integer not null default 0 check (s_continue_draw >= 0);

grant select, insert, update, delete on public.talent_pool_counters to service_role;

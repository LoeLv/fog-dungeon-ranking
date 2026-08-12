-- Talent rule support migration.
-- Run this before deploying the updated fog-dungeon-action Edge Function.

begin;

alter table public.talent_pool_items
  add column if not exists effect text not null default '';

grant select on public.talent_pool_items to anon, authenticated;
grant select, insert, update, delete on public.talent_pool_items to service_role;
grant select, insert, update, delete on public.talent_draw_state to service_role;
grant select, insert, update, delete on public.talent_pool_counters to service_role;
grant select, insert, update, delete on public.owned_talents to service_role;
grant select, insert, update, delete on public.user_fragments to service_role;
grant select, insert, update, delete on public.talent_draw_logs to service_role;
grant select, insert, update, delete on public.talent_exchange_logs to service_role;
grant select, insert, update, delete on public.talent_overflow_choices to service_role;

commit;

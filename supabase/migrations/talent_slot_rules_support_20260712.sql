-- Support score-gated 4-slot talent equipment and future A/S talent ranks.
-- Safe to run after talent_pool_migration.sql and talent_inventory_migration.sql.

begin;

alter table public.owned_talents
  drop constraint if exists owned_talents_equipped_slot_check;
alter table public.owned_talents
  add constraint owned_talents_equipped_slot_check
  check (equipped_slot is null or (equipped_slot between 1 and 4));

alter table public.talent_pool_items
  drop constraint if exists talent_pool_items_rank_check;
alter table public.talent_pool_items
  add constraint talent_pool_items_rank_check
  check (rank in ('S', 'A', 'B', 'C'));

alter table public.owned_talents
  drop constraint if exists owned_talents_rank_check;
alter table public.owned_talents
  add constraint owned_talents_rank_check
  check (rank in ('S', 'A', 'B', 'C'));

alter table public.talent_draw_logs
  drop constraint if exists talent_draw_logs_rank_check;
alter table public.talent_draw_logs
  add constraint talent_draw_logs_rank_check
  check (rank in ('S', 'A', 'B', 'C'));

alter table public.talent_overflow_choices
  drop constraint if exists talent_overflow_choices_rank_check;
alter table public.talent_overflow_choices
  add constraint talent_overflow_choices_rank_check
  check (rank in ('S', 'A', 'B', 'C'));

commit;

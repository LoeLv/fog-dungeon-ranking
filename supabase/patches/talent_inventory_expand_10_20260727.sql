-- Run once in Supabase SQL Editor before deploying the matching Edge Function.
-- Expands the personal talent warehouse from 8 to 10 storage slots.

begin;

alter table public.owned_talents
  drop constraint if exists owned_talents_storage_slot_check;

alter table public.owned_talents
  add constraint owned_talents_storage_slot_check
  check (storage_slot is null or (storage_slot between 1 and 10));

commit;

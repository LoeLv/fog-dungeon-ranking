-- Allow S-rank talents to be equipped into normal talent slots.
-- Run this before or together with the updated fog-dungeon-action Edge Function.

begin;

alter table public.owned_talents
  drop constraint if exists owned_talents_storage_equipment_split_check;
alter table public.owned_talents
  add constraint owned_talents_storage_equipment_split_check
  check (
    (
      s_slot is null
      and (case when storage_slot is null then 0 else 1 end) + (case when equipped_slot is null then 0 else 1 end) <= 1
    )
    or (
      s_slot is not null
      and storage_slot is null
    )
  );

commit;

-- Verification: should return no row with both storage_slot and equipped_slot set.
select id, invite_code_hash, talent_name, storage_slot, equipped_slot, s_slot
from public.owned_talents
where storage_slot is not null
  and equipped_slot is not null;

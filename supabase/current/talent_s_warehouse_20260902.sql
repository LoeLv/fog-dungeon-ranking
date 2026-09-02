-- Expand S talent storage to 5 dedicated warehouse slots and remove the old single-slot S switch flow.
-- Run together with the updated fog-dungeon-action Edge Function.

begin;

alter table public.owned_talents
  drop constraint if exists owned_talents_s_slot_check;
alter table public.owned_talents
  add constraint owned_talents_s_slot_check
  check (s_slot is null or (s_slot between 1 and 5));

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
      and equipped_slot is null
    )
  );

commit;

-- Verification: should return no row with both storage and equip set, and no S row outside slots 1..5.
select id, invite_code_hash, talent_name, storage_slot, equipped_slot, s_slot
from public.owned_talents
where (storage_slot is not null and equipped_slot is not null)
   or (s_slot is not null and (s_slot < 1 or s_slot > 5));

-- Split equipped talents from warehouse storage.
-- Run once before deploying the updated fog-dungeon-action Edge Function.

begin;

-- New rule: a talent is either in the 8-slot warehouse or in an equipped slot.
-- Equipped talents no longer occupy warehouse storage slots.
update public.owned_talents
set storage_slot = null
where equipped_slot is not null
  and storage_slot is not null;

alter table public.owned_talents
  drop constraint if exists owned_talents_storage_equipment_split_check;
alter table public.owned_talents
  add constraint owned_talents_storage_equipment_split_check
  check (not (storage_slot is not null and equipped_slot is not null));

commit;

-- Verification: should return 0 rows.
select id, invite_code_hash, talent_name, storage_slot, equipped_slot
from public.owned_talents
where equipped_slot is not null
  and storage_slot is not null;

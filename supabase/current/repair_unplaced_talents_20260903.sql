-- Recover talents that were left without storage/equipment placement.
-- Normal talents return to open normal warehouse slots; S talents return to open S warehouse slots.

begin;

with unplaced_normal as (
  select
    id,
    invite_code_hash,
    row_number() over (partition by invite_code_hash order by acquired_at asc, id asc) as rn
  from public.owned_talents
  where coalesce(rank, '') <> 'S'
    and storage_slot is null
    and equipped_slot is null
    and s_slot is null
),
open_normal_slots as (
  select
    profiles.invite_code_hash,
    slots.slot,
    row_number() over (partition by profiles.invite_code_hash order by slots.slot asc) as rn
  from (
    select distinct invite_code_hash
    from public.owned_talents
    where coalesce(rank, '') <> 'S'
      and storage_slot is null
      and equipped_slot is null
      and s_slot is null
  ) profiles
  cross join generate_series(1, 10) as slots(slot)
  where not exists (
    select 1
    from public.owned_talents occupied
    where occupied.invite_code_hash = profiles.invite_code_hash
      and occupied.storage_slot = slots.slot
  )
),
assignments as (
  select unplaced_normal.id, open_normal_slots.slot
  from unplaced_normal
  join open_normal_slots
    on open_normal_slots.invite_code_hash = unplaced_normal.invite_code_hash
   and open_normal_slots.rn = unplaced_normal.rn
)
update public.owned_talents owned
set storage_slot = assignments.slot,
    equipped_slot = null,
    s_slot = null
from assignments
where owned.id = assignments.id;

with unplaced_s as (
  select
    id,
    invite_code_hash,
    row_number() over (partition by invite_code_hash order by acquired_at asc, id asc) as rn
  from public.owned_talents
  where rank = 'S'
    and storage_slot is null
    and equipped_slot is null
    and s_slot is null
),
open_s_slots as (
  select
    profiles.invite_code_hash,
    slots.slot,
    row_number() over (partition by profiles.invite_code_hash order by slots.slot asc) as rn
  from (
    select distinct invite_code_hash
    from public.owned_talents
    where rank = 'S'
      and storage_slot is null
      and equipped_slot is null
      and s_slot is null
  ) profiles
  cross join generate_series(1, 5) as slots(slot)
  where not exists (
    select 1
    from public.owned_talents occupied
    where occupied.invite_code_hash = profiles.invite_code_hash
      and occupied.s_slot = slots.slot
  )
),
assignments as (
  select unplaced_s.id, open_s_slots.slot
  from unplaced_s
  join open_s_slots
    on open_s_slots.invite_code_hash = unplaced_s.invite_code_hash
   and open_s_slots.rn = unplaced_s.rn
)
update public.owned_talents owned
set storage_slot = null,
    equipped_slot = null,
    s_slot = assignments.slot
from assignments
where owned.id = assignments.id;

commit;

-- Verification: any returned rows still need manual handling because their warehouse is full.
select id, invite_code_hash, talent_name, rank, storage_slot, equipped_slot, s_slot, acquired_at
from public.owned_talents
where storage_slot is null
  and equipped_slot is null
  and s_slot is null
order by invite_code_hash, acquired_at asc, id asc;

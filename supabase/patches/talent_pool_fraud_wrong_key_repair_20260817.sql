-- Repair the full fraud talent pool after a bad refresh wrote rows to Pool??.
-- Run this whole script from the top in Supabase SQL Editor.
--
-- Scope:
-- - Copies every talent definition currently under the wrong pool key Pool??
--   into the real Pool欺诈 pool.
-- - Updates existing Pool欺诈 rows with the copied definition when ids match.
-- - Deletes the stray Pool?? rows after the copy.
-- - Does not touch owned_talents, draw logs, fragments, counters, or player state.

-- Preview: rows waiting in the wrong pool.
select
  pool_key,
  rank,
  count(*) as item_count,
  min(talent_id) as min_id,
  max(talent_id) as max_id
from public.talent_pool_items
where pool_key = 'Pool??'
group by pool_key, rank
order by case rank when 'S' then 1 when 'A' then 2 when 'B' then 3 when 'C' then 4 else 9 end;

begin;

alter table public.talent_pool_items
  add column if not exists effect text,
  add column if not exists cooldown text not null default '',
  add column if not exists action_cost integer not null default 0,
  add column if not exists is_enabled boolean not null default true,
  add column if not exists admin_note text not null default '',
  add column if not exists updated_at timestamptz not null default now();

with wrong_rows as (
  select
    talent_id,
    talent_name,
    rank,
    coalesce(effect, '') as effect,
    coalesce(cooldown, '') as cooldown,
    coalesce(action_cost, 0) as action_cost,
    coalesce(is_enabled, true) as is_enabled,
    coalesce(admin_note, '') as admin_note
  from public.talent_pool_items
  where pool_key = 'Pool??'
),
copied as (
  insert into public.talent_pool_items (
    pool_key,
    talent_id,
    talent_name,
    rank,
    effect,
    cooldown,
    action_cost,
    is_enabled,
    admin_note,
    updated_at
  )
  select
    'Pool欺诈',
    talent_id,
    talent_name,
    rank,
    effect,
    cooldown,
    action_cost,
    is_enabled,
    admin_note,
    now()
  from wrong_rows
  on conflict (pool_key, talent_id) do update
  set talent_name = excluded.talent_name,
      rank = excluded.rank,
      effect = excluded.effect,
      cooldown = excluded.cooldown,
      action_cost = excluded.action_cost,
      is_enabled = excluded.is_enabled,
      admin_note = excluded.admin_note,
      updated_at = now()
  returning talent_id
),
deleted as (
  delete from public.talent_pool_items
  where pool_key = 'Pool??'
  returning talent_id
)
select
  (select count(*) from wrong_rows) as wrong_rows_found,
  (select count(*) from copied) as rows_copied_to_fraud_pool,
  (select count(*) from deleted) as wrong_rows_deleted;

commit;

-- Verification 1: no stray wrong-pool rows should remain.
select
  pool_key,
  count(*) as item_count
from public.talent_pool_items
where pool_key in ('Pool??', 'Pool欺诈')
group by pool_key
order by pool_key;

-- Verification 2: fraud pool distribution after repair.
select
  rank,
  count(*) as item_count,
  min(talent_id) as min_id,
  max(talent_id) as max_id
from public.talent_pool_items
where pool_key = 'Pool欺诈'
group by rank
order by case rank when 'S' then 1 when 'A' then 2 when 'B' then 3 when 'C' then 4 else 9 end;

-- Verification 3: spot check the example item.
select
  pool_key,
  talent_id,
  talent_name,
  rank,
  effect,
  cooldown,
  action_cost,
  is_enabled
from public.talent_pool_items
where pool_key = 'Pool欺诈'
  and talent_id = 62;

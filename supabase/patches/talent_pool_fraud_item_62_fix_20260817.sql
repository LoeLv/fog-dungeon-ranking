-- Repair fraud-pool talent #62.
-- The 2026-08-15 refresh artifact used the literal pool key Pool??.
-- This restores the item under the real Pool欺诈 key without touching
-- owned talents, draw logs, fragments, or counters.
--
-- Run this whole script from the top in Supabase SQL Editor.

begin;

alter table public.talent_pool_items
  add column if not exists effect text,
  add column if not exists cooldown text not null default '',
  add column if not exists action_cost integer not null default 0;

insert into public.talent_pool_items (
  pool_key,
  talent_id,
  talent_name,
  rank,
  effect,
  cooldown,
  action_cost,
  is_enabled
)
values (
  'Pool欺诈',
  62,
  '抉择决战抉择',
  'C',
  '召唤1个20攻1血的替身。目标若攻击该替身，必须先进行一次特性判定；失败则攻击无效。',
  '3',
  0,
  true
)
on conflict (pool_key, talent_id) do update
set talent_name = excluded.talent_name,
    rank = excluded.rank,
    effect = excluded.effect,
    cooldown = excluded.cooldown,
    action_cost = excluded.action_cost,
    is_enabled = excluded.is_enabled,
    updated_at = now();

commit;

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

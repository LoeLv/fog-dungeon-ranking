-- Override unresolved same-pool/same-id talent conflicts from ?????2.0(1)(4).xlsx.
-- User confirmed conflict rows should replace current pool definitions.
-- Policy: when the same pool/id appears twice in Excel, use the later row as the final edited version.
-- Does NOT delete any talent rows and does NOT touch owned_talents/player inventory data.
--   Pool刺客 #303: chose Excel row 19 over rows 18, 19
--   Pool刺客 #309: chose Excel row 23 over rows 22, 23
--   Pool战争 #320: chose Excel row 18 over rows 17, 18
--   Pool时间 #165: chose Excel row 28 over rows 25, 28
--   Pool欺诈 #109: chose Excel row 23 over rows 14, 23
--   Pool污堕 #320: chose Excel row 18 over rows 17, 18
--   Pool混乱 #320: chose Excel row 18 over rows 17, 18
--   Pool腐朽 #320: chose Excel row 18 over rows 17, 18

begin;

alter table public.talent_pool_items
  add column if not exists effect text;

alter table public.talent_pool_items
  add column if not exists action_cost integer not null default 0;

alter table public.talent_pool_items
  drop constraint if exists talent_pool_items_rank_check;
alter table public.talent_pool_items
  add constraint talent_pool_items_rank_check
  check (rank in ('S', 'A', 'B', 'C'));

alter table public.talent_pool_items
  drop constraint if exists talent_pool_items_action_cost_check;
alter table public.talent_pool_items
  add constraint talent_pool_items_action_cost_check
  check (action_cost between 0 and 20);

with conflict_overrides(pool_key, talent_id, talent_name, rank, effect, action_cost) as (
  values
    ('Pool刺客', 303, '刀扇', 'C', '对所有敌人造成10伤害，冷却5回合', 4),
    ('Pool刺客', 309, '袭击', 'C', '造成20伤害，冷却6回合', 4),
    ('Pool战争', 320, '战斗经验', 'C', '特性追加:获得18生命上限', 0),
    ('Pool时间', 165, '探查', 'B', '一局一次，询问一个和封闭环境未来走向的问题。dm回答是或否', 0),
    ('Pool欺诈', 109, '自己的分身也要骗', 'B', '选择献祭替身，每献祭1个，任意友方回复16血量。冷却5回合', 0),
    ('Pool污堕', 320, '持续增长', 'C', '蓄力两回合，蓄力结束后获得攻击+12，持续两轮，冷却6轮', 0),
    ('Pool混乱', 320, '失控', 'C', '使自己永久混乱，然后伤害+5', 0),
    ('Pool腐朽', 320, '自我的腐朽', 'C', '使自己之后每回合扣6血，但是获得永久的5攻击加成，一局一次', 0)
)
insert into public.talent_pool_items (pool_key, talent_id, talent_name, rank, effect, action_cost)
select pool_key, talent_id, talent_name, rank, effect, action_cost
from conflict_overrides
on conflict (pool_key, talent_id) do update
set talent_name = excluded.talent_name,
    rank = excluded.rank,
    effect = excluded.effect,
    action_cost = excluded.action_cost;

commit;

with conflict_keys(pool_key, talent_id) as (
  values
    ('Pool刺客', 303),
    ('Pool刺客', 309),
    ('Pool战争', 320),
    ('Pool时间', 165),
    ('Pool欺诈', 109),
    ('Pool污堕', 320),
    ('Pool混乱', 320),
    ('Pool腐朽', 320)
)
select t.pool_key, t.talent_id, t.rank, t.talent_name, t.effect, t.action_cost
from public.talent_pool_items t
join conflict_keys k on k.pool_key = t.pool_key and k.talent_id = t.talent_id
order by t.pool_key, t.talent_id;

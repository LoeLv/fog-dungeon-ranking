begin;

insert into public.talent_pool_items (pool_key, talent_id, talent_name, rank, effect, action_cost)
values
  (
    'Pool欺诈',
    111,
    '你们真被强化了',
    'B',
    '尝试对所有友军进行+6攻，持续三次的强化，判定同特性，由敌方判定。冷却5回合',
    0
  ),
  (
    'Pool欺诈',
    112,
    '也许这样能强化?',
    'B',
    '尝试对指定目标进行+15攻，持续三次的强化，判定同特性，由敌方判定。冷却5回合',
    0
  )
on conflict (pool_key, talent_id) do update
set talent_name = excluded.talent_name,
    rank = excluded.rank,
    effect = excluded.effect,
    action_cost = excluded.action_cost;

commit;

select pool_key, talent_id, talent_name, rank, effect, action_cost
from public.talent_pool_items
where pool_key = 'Pool欺诈'
  and talent_id in (111, 112)
order by talent_id;

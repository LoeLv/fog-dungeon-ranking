-- Run once in Supabase SQL Editor before deploying the matching Edge Function.
-- Adds submitted talents to Pool战争 and Pool时间 without deleting existing items.

begin;

alter table public.talent_pool_items
  add column if not exists action_cost integer not null default 0;

alter table public.talent_pool_items
  drop constraint if exists talent_pool_items_action_cost_check;

alter table public.talent_pool_items
  add constraint talent_pool_items_action_cost_check
  check (action_cost between 0 and 20);

insert into public.talent_pool_items (pool_key, talent_id, talent_name, rank, effect, action_cost)
values
  ('Pool战争', 103, '以战止戈', 'B', '当你连续四回合向同一对象发动攻击，对方下一回合无法行动', 0),
  ('Pool战争', 104, '绝命一搏', 'B', '本局第一次血量低于20时，下一回合的第一次伤害翻倍', 0),
  ('Pool战争', 107, '饮伤筑盾', 'B', '如果本回合受到攻击，下一回合获得35护盾，冷却6回合', 5),
  ('Pool战争', 125, '战争兵团', 'B', '召唤两个血量5，攻击5的小兵，冷却6回合', 3),
  ('Pool战争', 126, '战鼓擂', 'B', '己方队友攻击+3，持续两回合，冷却两回合', 4),
  ('Pool战争', 198, '活到最后才算赢家', 'B', '若只剩你和另一名玩家，你每回合回复5血', 0),
  ('Pool战争', 301, '越战越勇', 'C', '每扣除30生命，获得攻击+1', 0),
  ('Pool战争', 311, '军旗所指', 'C', '选择一个角色，此后所有人对他造成伤害+2（一局一次）', 5),
  ('Pool战争', 349, '死战到底', 'C', '血量低于15时，立即回血20点，被斩杀不生效（一局一次）', 0),
  ('Pool战争', 350, '战场斥候', 'C', '作为斥候的你，可以获得一条有效信息，一局一次', 0),
  ('Pool战争', 352, '战争无罪', 'C', '对于敌方的首领，攻击时获得增伤2，持续三回合，冷却3回合', 4),
  ('Pool时间', 165, '远方见闻', 'B', '可再现本局内一个玩家使用过的一个天赋（最高A级），一局一次', 4),
  ('Pool时间', 109, '时间驻足之刻', 'B', '本回合内其他玩家无法行动。冷却7回合', 5),
  ('Pool时间', 103, '搏命之刻', 'B', '本局第一次血量低于20时，下回合获得额外回合', 0),
  ('Pool时间', 166, '时令是关键', 'B', '询问一个和副本内时间有关的线索（如果真的有关）', 0),
  ('Pool时间', 308, '迫切时刻', 'C', '加快自己一个天赋的冷却1回合，冷却6回合', 4),
  ('Pool时间', 310, '虚影', 'C', '仅在本回合内，获得减伤4，冷却6回合', 4)
on conflict (pool_key, talent_id) do update
set talent_name = excluded.talent_name,
    rank = excluded.rank,
    effect = excluded.effect,
    action_cost = excluded.action_cost;

commit;

-- Verification: should return 11 rows for Pool战争 and 6 rows for Pool时间.
select pool_key, rank, talent_id, talent_name, action_cost
from public.talent_pool_items
where (pool_key = 'Pool战争' and talent_id in (103, 104, 107, 125, 126, 198, 301, 311, 349, 350, 352))
   or (pool_key = 'Pool时间' and talent_id in (165, 109, 103, 166, 308, 310))
order by pool_key, rank desc, talent_id;

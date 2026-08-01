-- Refresh 秩序 / 时间 / 记忆 talent pools from user-submitted workbooks on 2026-08-02.
-- Sources:
--   秩序: full pool rewrite for future draws/exchanges.
--   时间: additive/upsert expansion.
--   记忆: description fixes.
-- Safety boundary: this script does NOT delete or update owned_talents, talent_draw_logs,
-- talent_overflow_choices, or any player inventory/history rows.
-- It only upserts talent_pool_items, and for Pool秩序 removes old pool rows that are absent
-- from the new 秩序 workbook so future 秩序 draws use the rewritten pool.

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

with incoming_talent_pool_items(pool_key, talent_id, talent_name, rank, effect, action_cost) as (
  values
    ('Pool时间', 103, '搏命之刻', 'B', '本局第一次血量低于20时，下回合获得额外回合', 0),
    ('Pool时间', 109, '时间驻足之刻', 'B', '本回合内其他玩家无法行动。冷却7回合', 5),
    ('Pool时间', 165, '远方见闻', 'B', '可再现本局内一个玩家使用过的一个天赋（最高A级），一局一次', 4),
    ('Pool时间', 166, '时令是关键', 'B', '询问一个和副本内时间有关的线索（如果真的有关）', 0),
    ('Pool时间', 308, '迫切时刻', 'C', '加快自己一个天赋的冷却1回合，冷却6回合', 4),
    ('Pool时间', 310, '虚影', 'C', '仅在本回合内，获得减伤4，冷却6回合', 4),
    ('Pool秩序', 101, '止战协议', 'B', '被动：只要你仍在守序，任何敌方单位都无法优先选中你作为目标（对群攻，混乱无效）', 0),
    ('Pool秩序', 102, '审判歌谣', 'B', '对三个敌方目标颁布一条持续一回合的律令：无法主动使用天赋技能。冷却7回合', 0),
    ('Pool秩序', 103, '秩序的余晖', 'B', '你违规后也保留减伤，但无法重新叠加守序', 0),
    ('Pool秩序', 104, '攻伐的秩序', 'B', '特性变更:每回合都主动攻击叠加守序，守序上限+2且第一次被打断不会被破序', 0),
    ('Pool秩序', 109, '秩序之牢', 'B', '对单个目标颁布2回合律令:无法使用主动天赋，冷却5回合', 0),
    ('Pool秩序', 116, '秩序的微光', 'B', '选择1名单位，颁布持续3回合的律令:守序。冷却5回合', 0),
    ('Pool秩序', 125, '契约枷锁', 'B', '对单一目标颁布律令:无法攻击1回合。此惩罚额外追加25伤害，冷却6回合', 0),
    ('Pool秩序', 134, '律令·禁', 'B', '指定目标1回合内无法使用职业类技能，惩罚额外追加15伤害，冷却5回合', 0),
    ('Pool秩序', 135, '铁律降临', 'B', '全体友方获得10点护盾，同时本回合内所有敌方普攻伤害-2，冷却6回合', 0),
    ('Pool秩序', 156, '公正审判', 'B', '对目标造成25点伤害，冷却5回合', 0),
    ('Pool秩序', 157, '守法公民', 'B', '开局时额外获得3层守序，守序层数上限+3', 0),
    ('Pool秩序', 189, '断言', 'B', '你可以获悉某一句话或者规则是否真实，一局2次', 0),
    ('Pool秩序', 301, '守序光环', 'C', '被动：守序的减伤效果+1', 0),
    ('Pool秩序', 302, '攻伐指令', 'C', '特性变更:每回合都主动攻击叠加守序', 0),
    ('Pool秩序', 305, '黄牌警告', 'C', '给目标标记预警，目标下一次使用天赋时，冷却额外+2回合，冷却5回合', 0),
    ('Pool秩序', 307, '小宣告', 'C', '对单一目标颁布律令:无法释放职业技能。冷却5回合', 0),
    ('Pool秩序', 309, '铁壁护盾', 'C', '获得15点护盾。冷却5回合', 0),
    ('Pool秩序', 314, '缴械一下', 'C', '目标下一次普攻无效，无法造成伤害，冷却5回合', 0),
    ('Pool秩序', 318, '小惩罚', 'C', '对目标造成12点伤害。冷却4回合', 0),
    ('Pool秩序', 327, '反伤印记', 'C', '给目标打上秩序印记，3回合内目标每次攻击都会受到5点反伤，冷却5回合', 0),
    ('Pool秩序', 332, '绑定契约', 'C', '与一名友方签订契约：双方其中一人回血时，另一人也能回复3点血量，持续3回合，冷却5回合（多段也只计入1次）', 0),
    ('Pool秩序', 341, '减速警告', 'C', '使目标获得先手-1，持续2回合，冷却3回合', 0),
    ('Pool秩序', 345, '全队小盾', 'C', '全体友方获得5点护盾，冷却5回合', 0),
    ('Pool秩序', 350, '小审判', 'C', '对目标造成10点伤害，若目标带有负面效果，伤害+5，冷却3回合', 0),
    ('Pool秩序', 363, '帮你挡一下', 'C', '为一名友方附加8点护盾，同时免疫下一次控制效果，冷却5回合', 0),
    ('Pool秩序', 368, '抓违规的', 'C', '标记一个违规目标，全队攻击该目标伤害+3，持续2回合，冷却4回合', 0),
    ('Pool秩序', 372, '守序奖励', 'C', '被动：连续3回合遵守秩序后，自动获得10点护盾', 0),
    ('Pool秩序', 546, '我是好人', 'C', '你更容易接近Npc', 0),
    ('Pool秩序', 576, '律法一点就通', 'C', '你读完律法后可以轻松记住', 0),
    ('Pool记忆', 115, '武忆裁决', 'B', '使用过特性后解锁，造成25伤害，冷却3回合', 0),
    ('Pool记忆', 135, '回响', 'B', '标记一个友方，记录下一次他受到的伤害（仅一次），仅有下一轮你可以打出，冷却3回合', 0),
    ('Pool记忆', 146, '回忆安抚', 'B', '使用过特性后解锁，对单体目标回复25生命，冷却3回合', 0),
    ('Pool记忆', 320, '裁决', 'C', '使用过特性后解锁，造成15伤害，冷却3回合', 0),
    ('Pool记忆', 325, '安抚', 'C', '使用过特性后解锁，对单体目标回复15生命，冷却3回合', 0)
)
insert into public.talent_pool_items (pool_key, talent_id, talent_name, rank, effect, action_cost)
select pool_key, talent_id, talent_name, rank, effect, action_cost
from incoming_talent_pool_items
on conflict (pool_key, talent_id) do update
set talent_name = excluded.talent_name,
    rank = excluded.rank,
    effect = excluded.effect,
    action_cost = excluded.action_cost;

with incoming_order_pool(pool_key, talent_id) as (
  values
    ('Pool秩序', 101),
    ('Pool秩序', 102),
    ('Pool秩序', 103),
    ('Pool秩序', 104),
    ('Pool秩序', 109),
    ('Pool秩序', 116),
    ('Pool秩序', 125),
    ('Pool秩序', 134),
    ('Pool秩序', 135),
    ('Pool秩序', 156),
    ('Pool秩序', 157),
    ('Pool秩序', 189),
    ('Pool秩序', 301),
    ('Pool秩序', 302),
    ('Pool秩序', 305),
    ('Pool秩序', 307),
    ('Pool秩序', 309),
    ('Pool秩序', 314),
    ('Pool秩序', 318),
    ('Pool秩序', 327),
    ('Pool秩序', 332),
    ('Pool秩序', 341),
    ('Pool秩序', 345),
    ('Pool秩序', 350),
    ('Pool秩序', 363),
    ('Pool秩序', 368),
    ('Pool秩序', 372),
    ('Pool秩序', 546),
    ('Pool秩序', 576)
)
delete from public.talent_pool_items old
where old.pool_key = 'Pool秩序'
  and not exists (
    select 1
    from incoming_order_pool incoming
    where incoming.pool_key = old.pool_key
      and incoming.talent_id = old.talent_id
  );

commit;

-- Verification 1: should return upserted_rows = 40.
with expected(pool_key, talent_id) as (
  values
    ('Pool时间', 103),
    ('Pool时间', 109),
    ('Pool时间', 165),
    ('Pool时间', 166),
    ('Pool时间', 308),
    ('Pool时间', 310),
    ('Pool秩序', 101),
    ('Pool秩序', 102),
    ('Pool秩序', 103),
    ('Pool秩序', 104),
    ('Pool秩序', 109),
    ('Pool秩序', 116),
    ('Pool秩序', 125),
    ('Pool秩序', 134),
    ('Pool秩序', 135),
    ('Pool秩序', 156),
    ('Pool秩序', 157),
    ('Pool秩序', 189),
    ('Pool秩序', 301),
    ('Pool秩序', 302),
    ('Pool秩序', 305),
    ('Pool秩序', 307),
    ('Pool秩序', 309),
    ('Pool秩序', 314),
    ('Pool秩序', 318),
    ('Pool秩序', 327),
    ('Pool秩序', 332),
    ('Pool秩序', 341),
    ('Pool秩序', 345),
    ('Pool秩序', 350),
    ('Pool秩序', 363),
    ('Pool秩序', 368),
    ('Pool秩序', 372),
    ('Pool秩序', 546),
    ('Pool秩序', 576),
    ('Pool记忆', 115),
    ('Pool记忆', 135),
    ('Pool记忆', 146),
    ('Pool记忆', 320),
    ('Pool记忆', 325)
)
select count(*) as upserted_rows
from public.talent_pool_items t
join expected e on e.pool_key = t.pool_key and e.talent_id = t.talent_id;

-- Verification 2: Pool秩序 should now contain exactly 29 rows.
select pool_key, rank, count(*) as item_count
from public.talent_pool_items
where pool_key in ('Pool秩序', 'Pool时间', 'Pool记忆')
group by pool_key, rank
order by pool_key, rank;

-- Verification 3: should return 0 rows; if it returns rows, old 秩序 items remain in the future draw pool.
with incoming_order_pool(pool_key, talent_id) as (
  values
    ('Pool秩序', 101),
    ('Pool秩序', 102),
    ('Pool秩序', 103),
    ('Pool秩序', 104),
    ('Pool秩序', 109),
    ('Pool秩序', 116),
    ('Pool秩序', 125),
    ('Pool秩序', 134),
    ('Pool秩序', 135),
    ('Pool秩序', 156),
    ('Pool秩序', 157),
    ('Pool秩序', 189),
    ('Pool秩序', 301),
    ('Pool秩序', 302),
    ('Pool秩序', 305),
    ('Pool秩序', 307),
    ('Pool秩序', 309),
    ('Pool秩序', 314),
    ('Pool秩序', 318),
    ('Pool秩序', 327),
    ('Pool秩序', 332),
    ('Pool秩序', 341),
    ('Pool秩序', 345),
    ('Pool秩序', 350),
    ('Pool秩序', 363),
    ('Pool秩序', 368),
    ('Pool秩序', 372),
    ('Pool秩序', 546),
    ('Pool秩序', 576)
)
select old.pool_key, old.talent_id, old.rank, old.talent_name
from public.talent_pool_items old
where old.pool_key = 'Pool秩序'
  and not exists (
    select 1
    from incoming_order_pool incoming
    where incoming.pool_key = old.pool_key
      and incoming.talent_id = old.talent_id
  )
order by old.talent_id;

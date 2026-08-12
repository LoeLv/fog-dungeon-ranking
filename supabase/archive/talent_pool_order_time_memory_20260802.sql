-- Refresh talent pools from user-submitted workbooks on 2026-08-08.
-- Sources:
--   Order: full pool rewrite for future draws/exchanges.
--   Priest: add cooldown on talent 373.
--   Memory: workbook-based description refresh; the 13-*** weapon reference rows are excluded because talent_id is integer in the current schema.
-- Safety boundary: this script does NOT delete or update owned_talents, talent_draw_logs, talent_overflow_choices, or any player inventory/history rows.
-- It upserts talent_pool_items, rewrites the Order pool membership to match the workbook, and leaves existing Memory reference/weapon rows untouched unless directly upserted below.

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
    ('Pool时间', 109, '时间驻足之刻', 'B', '本回合内其他玩家无法行动。冷即7回合', 5),
    ('Pool时间', 165, '远方见闻', 'B', '可再现本局内一个玩家使用过的一个天赋（最高A级），一局一次', 4),
    ('Pool时间', 166, '时令是关键', 'B', '询问一个和副本内时间有关的线索（如果真的有关）', 0),
    ('Pool时间', 308, '迫切时刻', 'C', '加快自己一个天赋的冷即1回合，冷即6回合', 4),
    ('Pool时间', 310, '虚影', 'C', '仅在本回合内，获得减伤4，冷即6回合', 4),
    ('Pool秩序', 7, '未照耀的荣光', 'S', '消耗掉所有守序层数，普攻变为一次打3，伤害＝消耗层数*9的斩击，无视闪避，持续3回合，冷却3回合', 0),
    ('Pool秩序', 8, '吾心长城', 'S', '开局选择一个队友成为主君代替承伤，主君在场时你每回合恢复40生命，且每次最多受到50伤害。', 0),
    ('Pool秩序', 9, '自我的加冕', 'S', '消耗掉所有守序层数，获得消耗层数*10的生命值，消耗层数*2的减伤，冷却3回合', 0),
    ('Pool秩序', 10, '永恒的律法', 'S', '被动:每回合结算，如果存在玩家遵守律令，你的所有律令冷却-3', 0),
    ('Pool秩序', 25, '未终止的哀鸣', 'A', '特性变更:每回合都主动攻击叠加守序，被打断也不会导致破序但是无法叠加守序，守序上限+2', 0),
    ('Pool秩序', 27, '未声张的怒火', 'A', '消耗掉所有守序层数，普攻变为一次打2，伤害＝消耗层数*4的斩击，无视闪避持续3回合，冷却4回合', 0),
    ('Pool秩序', 28, '被宽恕的悲哀', 'A', '在你失去所有守序层数后，你立即获得3层守序且可以重新叠加', 0),
    ('Pool秩序', 29, '沉默的砥柱', 'A', '被动:守序的减伤效果+2', 0),
    ('Pool秩序', 30, '你我的慈悲', 'A', '使一名队友获得当前守序层数*8的护盾，冷却3回合', 0),
    ('Pool秩序', 31, '结束斗争', 'A', '被动：只要你仍在守序，任何敌方单位都无法优先选中你作为目标（对群攻，混乱无效），守序上限+2', 0),
    ('Pool秩序', 37, '严苛的织法者', 'A', '被动:所有律令的惩罚额外追加5易伤，再追加30伤害', 0),
    ('Pool秩序', 38, '律令:禁', 'A', '对最多两个目标颁布持续2回合的律令:禁止攻击，此惩罚追加25伤害，冷却5回合。', 0),
    ('Pool秩序', 39, '律令:缴械', 'A', '对最多两个目标颁布持续2回合的律令:禁止使用治疗和状态类主动天赋，此惩罚追加25伤害，冷却5回合。', 0),
    ('Pool秩序', 41, '爱国者', 'A', '开局时额外获得1层守序，守序层数上限+3', 0),
    ('Pool秩序', 101, '止战协议', 'B', '被动：只要你仍在守序，任何敌方单位都无法优先选中你作为目标（对群攻，混乱无效）', 0),
    ('Pool秩序', 102, '审判歌谣', 'B', '对三个敌方目标颁布一条持续一回合的律令：无法主动使用天赋技能。冷却7回合', 0),
    ('Pool秩序', 103, '秩序的余晖', 'B', '你违规后也保留减伤，但无法重新叠加守序', 0),
    ('Pool秩序', 104, '攻伐的秩序', 'B', '特性变更:每回合都主动攻击叠加守序，第一次被打断不会被破序，你的守序上限+1', 0),
    ('Pool秩序', 116, '秩序的微光', 'B', '选择1名单位，颁布持续3回合的律令:守序。冷却5回合', 0),
    ('Pool秩序', 125, '契约枷锁', 'B', '对单一目标颁布律令:无法攻击1回合。此惩罚额外追加25伤害，冷却6回合', 0),
    ('Pool秩序', 134, '律令·禁', 'B', '指定目标1回合内无法使用职业类技能，惩罚额外追加15伤害，冷却5回合', 0),
    ('Pool秩序', 156, '公正审判', 'B', '对目标造成25点伤害，冷却5回合', 0),
    ('Pool秩序', 135, '铁律降临', 'B', '全体友方获得10点护盾，同时本回合内所有敌方普攻伤害-2，冷却6回合', 0),
    ('Pool秩序', 157, '守法公民', 'B', '开局时额外获得2层守序，守序层数上限+2', 0),
    ('Pool秩序', 109, '秩序之牢', 'B', '对单个目标颁布2回合律令:无法使用主动天赋，冷却5回合', 0),
    ('Pool秩序', 189, '断言', 'B', '你可以获悉某一句话或者规则是否真实，一局2次', 0),
    ('Pool秩序', 301, '守序光环', 'C', '被动：守序的减伤效果+1', 0),
    ('Pool秩序', 302, '攻伐指令', 'C', '特性变更:每回合都主动攻击叠加守序但你的守序上限-1', 0),
    ('Pool秩序', 305, '黄牌警告', 'C', '给目标标记预警，目标下一次使用天赋时，冷却额外+2回合，冷却5回合', 0),
    ('Pool秩序', 307, '小宣告', 'C', '对单一目标颁布一回合律令:无法释放普攻和职业技能。冷却7回合', 0),
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
    ('Pool牧师', 373, '光之束缚', 'C', '标记一个目标，两回合后使目标无法行动一回合，冷即5回合', 4),
    ('Pool记忆', 7, '【记忆】神临', 'S', '召唤一个100血【记忆】的虚影，祂每回合都可以发动特性，祂无法被湮灭，驱散等。冷却6回合', 0),
    ('Pool记忆', 9, '吾之圣器', 'S', '投影一件记忆宝库中的武器，上限s级，冷却2回合', 0),
    ('Pool记忆', 10, '叠影', 'S', '被动:开局时选择，你将在奇数/偶数回合被放逐', 0),
    ('Pool记忆', 25, '思维限制', 'A', '制造梦境，划定敌我双方接下来的可选中目标3回合（必须一敌一友对应），6回合冷却', 0),
    ('Pool记忆', 27, '记忆之宝库', 'A', '特性变更:投影一件记忆宝库中的武器，上限a级，冷却3回合', 0),
    ('Pool记忆', 28, '记忆的注视', 'A', '特性变更：将记录的天赋上限提高为A级，可以记录队友的天赋', 0),
    ('Pool记忆', 29, '踏忆流铭', 'A', '被动:你被放逐后，可以立即进行一次行动（非回合给的5行动点）', 0),
    ('Pool记忆', 30, '归尘', 'A', '特性变更:变为放逐任意目标一回合，冷却3回合', 0),
    ('Pool记忆', 31, '记忆冲击', 'A', '释放特性后解锁此技能，造成48伤害，冷却4回合', 0),
    ('Pool记忆', 37, '回忆', 'A', '释放特性后解锁此技能，恢复48生命，冷却4回合', 0),
    ('Pool记忆', 38, '予以挽歌', 'A', '秘密记录一人状态，2回合后或者他死时回到原来的血量，冷却6回合', 0),
    ('Pool记忆', 39, '记忆显现', 'A', '你自己特性可以使用的次数+3', 0),
    ('Pool记忆', 41, '幻想崩坏', 'A', '引爆武器，造成武器品级的伤害（s级40，a级25），并立即换一把。冷却5回合。', 0),
    ('Pool记忆', 101, '隐秘的见证', 'B', '秘密记录一人状态，1回合后回到原来的血量，一局一次', 0),
    ('Pool记忆', 102, '记忆的眷顾', 'B', '将记录的天赋上限提高为A级', 0),
    ('Pool记忆', 106, '过往挽歌', 'B', '秘密标记一个玩家，如果该玩家下回合死亡，保留1血', 0),
    ('Pool记忆', 108, '归放', 'B', '秘密放逐一个目标一回合，冷却6轮', 0),
    ('Pool记忆', 135, '回响', 'B', '标记一个友方，记录下一次他受到的伤害（仅一次），仅有下一轮你可以打出，冷却4回合', 0),
    ('Pool记忆', 140, '梦魇', 'B', '特性变更为和对方进入梦境决斗5回合，其他人无法干涉，一局一次', 0),
    ('Pool记忆', 115, '武忆裁决', 'B', '使用过特性后解锁，造成25伤害，冷却4回合', 0),
    ('Pool记忆', 146, '回忆安抚', 'B', '使用过特性后解锁，对单体目标回复25生命，冷却4回合', 0),
    ('Pool记忆', 124, '记忆解放', 'B', '特性可以使用的次数+2', 0),
    ('Pool记忆', 148, '记忆一直公平', 'B', '特性作用的目标改为任意目标，并使其本回合发动', 0),
    ('Pool记忆', 189, '很好的记性', 'B', '可以过目不忘', 0),
    ('Pool记忆', 301, '记忆的礼物', 'C', '将记录的天赋上限提高为B级', 0),
    ('Pool记忆', 506, '好记性', 'C', '记性变得更好', 0),
    ('Pool记忆', 566, '健忘症', 'C', '可以选择性失忆', 0),
    ('Pool记忆', 309, '入梦', 'C', '特性变更为和对方进入梦境决斗3回合，其他人无法干涉，一局一次', 0),
    ('Pool记忆', 373, '记忆泄露', 'C', '特性可以使用的次数+1', 0),
    ('Pool记忆', 302, '这是个秘密', 'C', '秘密放逐自己一回合，冷却10轮（不能和嘲讽同时用）', 0),
    ('Pool记忆', 356, '记忆偶尔公平', 'C', '特性作用的目标改为任意目标', 0),
    ('Pool记忆', 325, '安抚', 'C', '使用过特性后解锁，对单体目标回复15生命，冷却4回合', 0),
    ('Pool记忆', 462, '解放', 'C', '特性取消一局一次的限制，变为5回合冷却', 0),
    ('Pool记忆', 320, '裁决', 'C', '使用过特性后解锁，造成15伤害，冷却4回合', 0)
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
    ('Pool秩序', 7),
    ('Pool秩序', 8),
    ('Pool秩序', 9),
    ('Pool秩序', 10),
    ('Pool秩序', 25),
    ('Pool秩序', 27),
    ('Pool秩序', 28),
    ('Pool秩序', 29),
    ('Pool秩序', 30),
    ('Pool秩序', 31),
    ('Pool秩序', 37),
    ('Pool秩序', 38),
    ('Pool秩序', 39),
    ('Pool秩序', 41),
    ('Pool秩序', 101),
    ('Pool秩序', 102),
    ('Pool秩序', 103),
    ('Pool秩序', 104),
    ('Pool秩序', 116),
    ('Pool秩序', 125),
    ('Pool秩序', 134),
    ('Pool秩序', 156),
    ('Pool秩序', 135),
    ('Pool秩序', 157),
    ('Pool秩序', 109),
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

-- Verification 1: the workbook rows plus the priest cooldown patch should all be present.
with expected(pool_key, talent_id) as (
  values
    ('Pool时间', 103),
    ('Pool时间', 109),
    ('Pool时间', 165),
    ('Pool时间', 166),
    ('Pool时间', 308),
    ('Pool时间', 310),
    ('Pool秩序', 7),
    ('Pool秩序', 8),
    ('Pool秩序', 9),
    ('Pool秩序', 10),
    ('Pool秩序', 25),
    ('Pool秩序', 27),
    ('Pool秩序', 28),
    ('Pool秩序', 29),
    ('Pool秩序', 30),
    ('Pool秩序', 31),
    ('Pool秩序', 37),
    ('Pool秩序', 38),
    ('Pool秩序', 39),
    ('Pool秩序', 41),
    ('Pool秩序', 101),
    ('Pool秩序', 102),
    ('Pool秩序', 103),
    ('Pool秩序', 104),
    ('Pool秩序', 116),
    ('Pool秩序', 125),
    ('Pool秩序', 134),
    ('Pool秩序', 156),
    ('Pool秩序', 135),
    ('Pool秩序', 157),
    ('Pool秩序', 109),
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
    ('Pool牧师', 373),
    ('Pool记忆', 7),
    ('Pool记忆', 9),
    ('Pool记忆', 10),
    ('Pool记忆', 25),
    ('Pool记忆', 27),
    ('Pool记忆', 28),
    ('Pool记忆', 29),
    ('Pool记忆', 30),
    ('Pool记忆', 31),
    ('Pool记忆', 37),
    ('Pool记忆', 38),
    ('Pool记忆', 39),
    ('Pool记忆', 41),
    ('Pool记忆', 101),
    ('Pool记忆', 102),
    ('Pool记忆', 106),
    ('Pool记忆', 108),
    ('Pool记忆', 135),
    ('Pool记忆', 140),
    ('Pool记忆', 115),
    ('Pool记忆', 146),
    ('Pool记忆', 124),
    ('Pool记忆', 148),
    ('Pool记忆', 189),
    ('Pool记忆', 301),
    ('Pool记忆', 506),
    ('Pool记忆', 566),
    ('Pool记忆', 309),
    ('Pool记忆', 373),
    ('Pool记忆', 302),
    ('Pool记忆', 356),
    ('Pool记忆', 325),
    ('Pool记忆', 462),
    ('Pool记忆', 320)
)
select count(*) as upserted_rows
from public.talent_pool_items t
join expected e on e.pool_key = t.pool_key and e.talent_id = t.talent_id;

-- Verification 2: the Order pool should now contain exactly 43 rows.
select pool_key, count(*) as item_count
from public.talent_pool_items
where pool_key = 'Pool秩序'
group by pool_key;

-- Verification 3: the priest cooldown patch should be visible on talent 373.
select pool_key, talent_id, talent_name, rank, effect, action_cost
from public.talent_pool_items
where pool_key = 'Pool牧师' and talent_id = 373;

-- Verification 4: the workbook-based Memory rows should all be present.
with expected_memory(pool_key, talent_id) as (
  values
    ('Pool记忆', 7),
    ('Pool记忆', 9),
    ('Pool记忆', 10),
    ('Pool记忆', 25),
    ('Pool记忆', 27),
    ('Pool记忆', 28),
    ('Pool记忆', 29),
    ('Pool记忆', 30),
    ('Pool记忆', 31),
    ('Pool记忆', 37),
    ('Pool记忆', 38),
    ('Pool记忆', 39),
    ('Pool记忆', 41),
    ('Pool记忆', 101),
    ('Pool记忆', 102),
    ('Pool记忆', 106),
    ('Pool记忆', 108),
    ('Pool记忆', 135),
    ('Pool记忆', 140),
    ('Pool记忆', 115),
    ('Pool记忆', 146),
    ('Pool记忆', 124),
    ('Pool记忆', 148),
    ('Pool记忆', 189),
    ('Pool记忆', 301),
    ('Pool记忆', 506),
    ('Pool记忆', 566),
    ('Pool记忆', 309),
    ('Pool记忆', 373),
    ('Pool记忆', 302),
    ('Pool记忆', 356),
    ('Pool记忆', 325),
    ('Pool记忆', 462),
    ('Pool记忆', 320)
)
select count(*) as memory_rows_present
from public.talent_pool_items t
join expected_memory e on e.pool_key = t.pool_key and e.talent_id = t.talent_id;

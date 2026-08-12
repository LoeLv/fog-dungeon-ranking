-- Faith trait management table.
-- Run once before deploying the Edge Function changes that edit faith traits.

begin;

create table if not exists public.faith_traits (
  god_name text primary key,
  path_name text not null,
  trait_text text not null,
  is_enabled boolean not null default true,
  admin_note text not null default '',
  sort_order integer not null default 999,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by_hash text
);

alter table public.faith_traits
  add column if not exists path_name text not null default '',
  add column if not exists trait_text text not null default '',
  add column if not exists is_enabled boolean not null default true,
  add column if not exists admin_note text not null default '',
  add column if not exists sort_order integer not null default 999,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by_hash text;

insert into public.faith_traits (god_name, path_name, trait_text, sort_order)
values
  ('诞育', '生命', '攻击或治疗会使目标怀孕，同时最多存在两个婴儿。【怀孕】：2 轮后分娩，受到 10 伤害，然后诞下一个 0 攻 1 血的婴儿。', 1),
  ('繁荣', '生命', '生命值提高：战士 +24，牧师 +20，歌者 +18，刺客/猎人/法师 +16。', 2),
  ('死亡', '生命', '每局一次，积攒 7 具尸体后可以复活，复活后为 1 血，先手 +1，无法行动一轮；尸体可积攒 15 具，但无法带入下轮试炼。', 3),
  ('记忆', '存在', '可以记录一个自己的 C 级天赋，使其在下回合再次发动，一局一次。', 4),
  ('时间', '存在', '每经过四回合后，获得一个额外行动回合；第 5、10、15 回合获得。', 5),
  ('秩序', '文明', '开局时自己获得律令:守序，每回合不主动攻击+1层守序，每层提升2点减伤（初始有2层），守序上限为4层，违规后移除减伤并获得惩罚。', 6),
  ('真理', '文明', '解析：每次进行攻击或治疗获得 1 层，每层提升 2 点攻击或 2 点治疗加成，最多 3 层。', 7),
  ('战争', '文明', '每局一次，击败一个玩家后获得永久攻击 +12。', 8),
  ('欺诈', '虚无', '对指定目标宣告一个是否事件，秘密给出答案，对方回答后若不同则造成30伤害，冷却4回合。', 9),
  ('命运', '虚无', '可以在自己丢出骰子时，再丢一个骰子，并选择是否替换它，一局 2 次。', 10),
  ('混乱', '混沌', '使一个目标进入混乱一回合，CD 6 回合。混乱后所有行动随机取目标。', 11),
  ('沉默', '混沌', '指定一个目标获得一回合沉默，CD 5 回合。', 12),
  ('痴愚', '混沌', '每次攻击会对一个目标附带一次愚昧效果，使其攻击 -2，最多 4 层。', 13),
  ('污堕', '沉沦', '可以与其他人共赴沉沦，强制自己与一个目标无法行动一回合，CD 5 回合。', 14),
  ('腐朽', '沉沦', '可以燃烧自己 15 血，对指定目标造成 25 伤害，CD 5 回合。', 15),
  ('湮灭', '沉沦', '开局获得一次湮灭，湮灭人或物后获得加成，仅一次。战士：+15 血；法/刺/猎/歌：首次单体攻击 +15 伤；牧师：治疗最终 +5。', 16)
on conflict (god_name) do update
set path_name = excluded.path_name,
    sort_order = excluded.sort_order;

select god_name, path_name, left(trait_text, 40) as trait_preview, is_enabled, sort_order
from public.faith_traits
order by sort_order;

commit;

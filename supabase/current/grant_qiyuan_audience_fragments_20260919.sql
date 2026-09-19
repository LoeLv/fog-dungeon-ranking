-- ============================================================
-- 给玩家「祈鸳」发放：
--   1) 觐见之梯  +233 分   （player_profiles.audience_score）
--   2) 天赋碎片  +2000     （user_fragments.fragment_total）
-- 日期：2026-09-19
-- 修订：去掉 CTE，改用自包含子查询，避免编辑器把语句拆开执行时报
--       `relation "target" does not exist`。
-- 特性：追加式、只影响「祈鸳」一人；请只执行一次（重复执行会再累加）。
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) 觐见之梯 +233
-- ------------------------------------------------------------
update public.player_profiles p
set audience_score = coalesce(p.audience_score, 0) + 233
where p.display_name = '祈鸳'
   or p.invite_code_hash in (
        select code_hash from public.invite_codes where display_name = '祈鸳'
      );

-- ------------------------------------------------------------
-- 2) 天赋碎片 +2000（无记录则新建）
-- ------------------------------------------------------------
insert into public.user_fragments (invite_code_hash, fragment_total, updated_at)
select h, 2000, now()
from (
  select distinct invite_code_hash as h
  from public.player_profiles
  where display_name = '祈鸳'
     or invite_code_hash in (
          select code_hash from public.invite_codes where display_name = '祈鸳'
        )
) s
on conflict (invite_code_hash) do update
  set fragment_total = public.user_fragments.fragment_total + 2000,
      updated_at     = now();

-- ------------------------------------------------------------
-- 3) 审计：写入一条补分记录（如不需要可整段删除）
-- ------------------------------------------------------------
insert into public.score_change_logs
  (player_code_hash, player_name, change_deng, change_jin, source_type, operator_name, revoke_remark)
select invite_code_hash, '祈鸳', 0, 233, 'single', '馆主', '手动补发：觐见之梯 +233'
from public.player_profiles
where display_name = '祈鸳'
   or invite_code_hash in (
        select code_hash from public.invite_codes where display_name = '祈鸳'
      );

commit;

-- ------------------------------------------------------------
-- 4) 核验：应返回「祈鸳」一行，audience_score 已 +233、fragment_total 已 +2000
-- ------------------------------------------------------------
select
  p.display_name,
  p.ascension_score,
  p.audience_score,
  f.fragment_total
from public.player_profiles p
left join public.user_fragments f on f.invite_code_hash = p.invite_code_hash
where p.display_name = '祈鸳';

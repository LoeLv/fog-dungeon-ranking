-- ============================================================
-- 授予「六伞」结算打分权限（delegated permission: settle_scores）
-- 日期：2026-09-19
-- 效果：六伞 可进入「分数结算工作台」，为任意玩家录入 登神/觐见 分数。
-- 安全性：幂等、追加式。只向「六伞」的 permissions 数组追加 settle_scores，
--         不改动其他账号、也不改动该账号的其他已有权限。
-- ============================================================

begin;

-- 1) 确保 permissions 列与白名单约束存在（幂等，已存在则跳过）。
alter table public.invite_codes
  add column if not exists permissions text[] not null default '{}';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.invite_codes'::regclass
      and conname = 'invite_codes_permissions_check'
  ) then
    alter table public.invite_codes
      add constraint invite_codes_permissions_check
      check (permissions <@ array[
        'talent_pool_manage',
        'settle_scores',
        'account_role_manage',
        'review_dungeons'
      ]::text[]);
  end if;
end $$;

-- 2) 解析「六伞」的邀请码行（优先 invite_codes.display_name，回退 player_profiles）。
with target as (
  select distinct code_hash
  from (
    select code_hash, display_name from public.invite_codes
    union
    select invite_code_hash as code_hash, display_name from public.player_profiles
  ) t
  where display_name = '六伞'
)
-- 3) 追加 settle_scores，保留原有权限，自动去重。
update public.invite_codes i
set permissions = (
  select array(
    select distinct e
    from unnest(coalesce(i.permissions, '{}'::text[]) || array['settle_scores']::text[]) as e
  )
)
from target t
where i.code_hash = t.code_hash;

commit;

-- 4) 核验：应看到「六伞」一行，且 permissions 含 settle_scores。
select display_name, role, permissions
from public.invite_codes
where display_name = '六伞';

-- 个人账户登录（账号名 + 密码）绑定到现有邀请码身份
-- 运行位置：Supabase SQL Editor（project trosjcbvfhnfkelflijc）
--
-- 设计说明：
--   * 不引入 Supabase Auth；在 invite_codes 上挂 username / password 凭据。
--   * 登录成功后仍签发既有邀请码会话（invite_sessions + session_generation），
--     前端保存的会话形状不变，其余 100+ 接口与数据模型零改动。
--   * 邀请码保留为注册门槛：首次绑定必须提供有效邀请码，此刻把明文邀请码
--     加密存入 code_enc，账号登录时解密回传，前端照旧使用。
--   * invite_codes 已 REVOKE 全部 anon / authenticated 权限，仅 service_role 可访问，
--     因此凭据列对浏览器端不可见。
--
-- 幂等：可重复运行。

begin;

alter table public.invite_codes
  add column if not exists username text,
  add column if not exists username_key text,
  add column if not exists password_hash text,
  add column if not exists password_salt text,
  add column if not exists code_enc text,
  add column if not exists account_linked_at timestamptz;

-- 账号名大小写不敏感唯一（username_key = 账号名小写，登录按此查询，避免 LIKE 通配符问题）
create unique index if not exists invite_codes_username_key_uidx
  on public.invite_codes (username_key)
  where username_key is not null;

-- 账号名格式约束：2-16 位，中文 / 字母 / 数字 / 下划线
alter table public.invite_codes drop constraint if exists invite_codes_username_format_check;
alter table public.invite_codes add constraint invite_codes_username_format_check
  check (username is null or username ~ '^[A-Za-z0-9_\u4e00-\u9fa5]{2,16}$');

commit;

-- 校验：已绑定账号数量 / 邀请码总数
select
  count(*) filter (where username is not null) as bound_accounts,
  count(*) as total_invites
from public.invite_codes;

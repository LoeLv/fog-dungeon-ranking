-- supabase/migrations/realtime_dungeons_comments_20260928.sql
-- 目标：开启 Supabase Realtime，让前端无需“手动刷新”即可自动更新。
--
-- 范围：仅发布具备公开 SELECT 策略的表（dungeons / comments / ratings）。
--       这三张表在 dungeon_setup.sql 中已 `enable row level security`
--       且带有 `to anon, authenticated using (true)` 的 SELECT 策略，
--       因此匿名前端可通过 postgres_changes 收到变更。
--
-- 说明：match_musters / battle_rooms 等表当前没有面向 anon 的 SELECT 策略，
--       加入发布也不会向匿名端投递（RLS 会拦截），故本次不纳入。
--       如需实时化对战/匹配，请先为其添加合适的 SELECT 策略再单独发布。
--
-- 幂等：可重复执行，不会因对象已存在而报错。

-- 1) 确保 publication 存在（Supabase 默认已存在 supabase_realtime）
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- 2) 逐表加入发布（已存在则跳过）
do $$
declare
  t text;
begin
  foreach t in array array['dungeons', 'comments', 'ratings'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- 3) Replica identity
--    默认(主键)已足够：INSERT/UPDATE/DELETE 事件均携带主键 id。
--    仅当需要对“旧记录”做字段级过滤时才需要 full（体积更大）：
-- alter table public.dungeons replica identity full;
-- alter table public.comments replica identity full;
-- alter table public.ratings  replica identity full;

-- 校验（可手动执行）：
--   select * from pg_publication_tables where pubname = 'supabase_realtime';

# 邀请码权限和 Supabase 部署设置

这个站点的公开页面只负责展示和输入。真正的权限判断在 Supabase Edge Function 里完成，邀请码不要写进 `index.html`。

当前主流程使用 `invite_codes` 表里的每人独立邀请码；旧的 `DUNGEON_PLAYER_CODE`、`DUNGEON_AUTHOR_CODE`、`DUNGEON_ADMIN_CODE` 共享码流程不再作为主流程使用。

## 1. 准备数据库

第一次部署或重建环境时，在 Supabase `SQL Editor` 按顺序执行：

```text
supabase/dungeon_setup.sql
supabase/per_person_invites_migration.sql
supabase/forum_features_migration.sql
supabase/nickname_binding_migration.sql
supabase/player_profiles_migration.sql
supabase/score_system_migration.sql
supabase/talent_pool_migration.sql
supabase/talent_inventory_migration.sql
supabase/talent_rules_support_20260711.sql
supabase/talent_slot_rules_support_20260712.sql
supabase/talent_pool_refresh_20260712.sql
supabase/match_system_migration.sql
supabase/match_muster_migration.sql
```

说明：

- `forum_features_migration.sql`：最新评论流、楼中楼回复、评论删除、作者置顶说明、通关反馈标签。
- `nickname_binding_migration.sql`：每个邀请码绑定唯一昵称。
- `player_profiles_migration.sql`：个人档案、神格榜单、登神之路、觐见之梯。
- `score_system_migration.sql`：审核员、分数结算、补分、撤销、结算信封。
- `talent_pool_migration.sql`：天赋池、抽取记录、碎片兑换。
- `talent_inventory_migration.sql`：8 格天赋仓库、按分数开放最多 4 个携带槽、溢出取舍。
- `talent_rules_support_20260711.sql`：新版天赋规则所需字段和权限。
- `talent_slot_rules_support_20260712.sql`：4 个携带槽和 S/A/B/C 品级约束支持。
- `talent_pool_refresh_20260712.sql`：按新版天赋池表刷新 22 个天赋池内容。
- `match_system_migration.sql`：试炼匹配排队、自动成房、房间成员记录，供网站和微信小程序共用。

不要在正式数据上执行 `second_beta_reset.sql`，除非你明确要重置第二轮测试数据。

## 2. 创建 Edge Function

在 Supabase 后台打开 `Edge Functions`，新建函数：

```text
fog-dungeon-action
```

把 `supabase/functions/fog-dungeon-action/index.ts` 的内容部署到这个函数。

确认函数 Secrets 中有：

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

函数会用 service role 访问 `invite_codes`、副本表、档案表、结算表和天赋表。

## 3. 生成每人独立邀请码

在本地生成邀请：

```text
node scripts/generate_invites.js --players 80 --authors 10 --reviewers 2 --admins 1
```

生成结果会放在 `private_invites/`：

```text
invite_codes_时间.csv  发给群友的明文邀请码
invite_codes_时间.sql  粘贴进 Supabase SQL Editor 的哈希导入脚本
```

把生成的 `.sql` 文件内容放进 Supabase `SQL Editor` 执行。

不要把 `private_invites/` 里的文件上传到 GitHub。

权限含义：

```text
玩家：评分、评论、登记通关、保存个人档案、使用天赋池
作者：玩家权限 + 上传副本、开启下一周目、维护作者置顶说明
审核员：玩家权限 + 批量结算、单人补分、撤销结算
馆主：全部权限 + 删除副本和管理内容
```

## 4. 锁住公开写入

确认函数部署成功、邀请码导入成功后，在 `SQL Editor` 执行：

```text
supabase/dungeon_invite_lockdown.sql
```

执行后，任何人仍然可以浏览副本，但没有邀请码就不能投稿、评分、评论或登记通关。

## 5. 上线后检查

建议至少检查这几件事：

1. 无邀请码访问：只能浏览。
2. 玩家码：能评分、评论、登记通关、保存个人档案。
3. 作者码：能看到并使用「构筑愚戏」。
4. 审核员码：能看到并使用「分数结算」。
5. 馆主码：能管理副本，并能进入分数结算。
6. 个人档案保存信仰神明和职业后，天赋池会显示可选池子。
7. 审核员结算后，玩家档案能收到结算信封。

如果页面提示「请先运行 score_system_migration.sql」或「请先运行 talent_pool_migration.sql」，说明对应 SQL 还没有在当前 Supabase 项目里执行。

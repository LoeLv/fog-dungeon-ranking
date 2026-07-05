# 邀请码权限设置

这个站点的公开页面只负责展示和输入。真正的权限判断在 Supabase Edge Function 里完成，邀请码不要写进 `index.html`。

## 1. 创建 Edge Function

在 Supabase 后台打开 `Edge Functions`，新建函数：

```text
fog-dungeon-action
```

把 `supabase/functions/fog-dungeon-action/index.ts` 的内容粘贴进去并部署。

## 2. 设置 Secrets

在 `Edge Functions` 的 `Secrets` 页面新增三条：

```text
DUNGEON_PLAYER_CODE=你的玩家邀请码
DUNGEON_AUTHOR_CODE=你的作者邀请码
DUNGEON_ADMIN_CODE=你的馆主邀请码
```

权限含义：

```text
玩家：评分、评论
作者：投稿、评分、评论
馆主：投稿、评分、评论、删除副本
```

这三条共享码可以作为应急码。正式发给群友时，推荐使用 `invite_codes` 表里的每人独立邀请码。

## 3. 启用每人一个邀请码

先在 `SQL Editor` 执行：

```text
supabase/per_person_invites_migration.sql
```

再在本地生成邀请：

```text
node scripts/generate_invites.js --players 80 --authors 10
```

生成结果会放在 `private_invites/`：

```text
invite_codes_时间.csv  发给群友的明文邀请码
invite_codes_时间.sql  粘贴进 Supabase SQL Editor 的哈希导入脚本
```

不要把 `private_invites/` 里的文件上传到 GitHub。

通关率不是作者手填。副本保存固定人数和当前周目，玩家点击“我已通过本周目”后生成通过记录：

```text
通关率 = 已通过人次 / (固定人数 × 当前周目) × 100%
```

例如 6 人副本，第 2 周目时有 6 人登记通过，通关率就是 `6 / (6 × 2) = 50%`。

## 4. 锁住公开写入

确认函数部署成功后，在 `SQL Editor` 执行：

```text
supabase/dungeon_invite_lockdown.sql
```

执行后，任何人仍然可以浏览排行榜，但没有邀请码就不能投稿、评分或评论。

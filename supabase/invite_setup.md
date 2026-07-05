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

## 3. 锁住公开写入

确认函数部署成功后，在 `SQL Editor` 执行：

```text
supabase/dungeon_invite_lockdown.sql
```

执行后，任何人仍然可以浏览排行榜，但没有邀请码就不能投稿、评分或评论。

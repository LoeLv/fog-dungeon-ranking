# 诸神愚戏试炼召集小程序

这是网站匹配系统的微信小程序接入骨架，复用同一个 Supabase Edge Function：

`https://trosjcbvfhnfkelflijc.supabase.co/functions/v1/fog-dungeon-action`

## 导入方式

1. 打开微信开发者工具。
2. 选择「导入项目」。
3. 项目目录选择本文件夹：`wechat-miniprogram`。
4. 没有正式 AppID 时可先使用测试号或游客模式。

## 微信后台配置

小程序正式请求前，需要在微信公众平台的小程序后台配置 request 合法域名：

`https://trosjcbvfhnfkelflijc.supabase.co`

开发阶段如果使用开发者工具，可以临时勾选「不校验合法域名、web-view、TLS 版本以及 HTTPS 证书」，但真机和上线必须配置合法域名。

## 当前页面

- `pages/login/login`：输入个人邀请码并验证身份。
- `pages/match/match`：发起 1 分钟试炼召集、分享到微信群、参与报名、到点随机抽选。

## 召集逻辑

1. 发起者在小程序里选择一个副本。
2. 点击「发起 1 分钟召集」。
3. 小程序创建一场独立召集；发起者只主持召集，不进入报名池，也不占抽选名额。
4. 发起者点击「分享到群」。
5. 群友点开分享卡片，输入自己的邀请码后参与报名。
6. 倒计时结束后，后端从报名池里随机抽出副本固定人数；如果报名人数少于固定人数，则从现有报名者中抽出全部可选玩家。
7. 发起者留在召集结果页查看「成功参与试炼」名单。
8. 被抽中的玩家会写入 `match_room_players`，后续可作为绝响试炼的参与校验记录。

绝响试炼限制：

- 副本归档为「绝响试炼」后，后台会写入 `is_one_shot = true`；被抽中过的玩家不能再次发起或报名该副本。
- 限制在 Supabase RPC 里校验，不只依赖小程序界面。

## 安全边界

- 小程序只保存用户输入的明文邀请码到本机 storage，用于调用 Edge Function。
- 代码中只包含公开 publishable anon key，不包含 Supabase service role key。
- 所有写操作仍由 `fog-dungeon-action` 在服务端校验邀请码和角色。

## 可继续扩展

- 副本详情页。
- 已成房后的房间聊天或确认完成。
- 个人档案、神格榜单、结算信封。

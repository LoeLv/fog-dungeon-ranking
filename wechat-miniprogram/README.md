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
- `pages/match/match`：查看可召集副本、队列、运行房间，支持加入排队和取消排队。

## 安全边界

- 小程序只保存用户输入的明文邀请码到本机 storage，用于调用 Edge Function。
- 代码中只包含公开 publishable anon key，不包含 Supabase service role key。
- 所有写操作仍由 `fog-dungeon-action` 在服务端校验邀请码和角色。

## 可继续扩展

- 副本详情页。
- 已成房后的房间聊天或确认完成。
- 个人档案、神格榜单、结算信封。

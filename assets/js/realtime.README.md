# 实时更新（Realtime）接入说明

本次改动目标：**用 Supabase Realtime 替代手动刷新**，同时把几乎为 0 的 Realtime 用量利用起来。

## 改动清单

| 文件 | 说明 |
| --- | --- |
| `supabase/migrations/realtime_dungeons_comments_20260928.sql` | 新增：把 `dungeons` / `comments` / `ratings` 加入 `supabase_realtime` 发布 |
| `assets/js/realtime.js` | 新增：订阅表变更 → 去抖动 → 缓存失效 + 局部重渲染 |
| `index.html` | 引入 `assets/js/realtime.js`（在 `startup.js` 之后） |
| `assets/js/api.js` | 放宽读取缓存 TTL（列表 3→10 分钟、短读 90 秒→5 分钟），配合实时失效 |

## 生效步骤

1. 在 Supabase SQL Editor（或 `supabase db push`）执行迁移：
   `supabase/migrations/realtime_dungeons_comments_20260928.sql`
2. 部署前端（包含新的 `assets/js/realtime.js` 与 `index.html`）。
3. 打开站点后，浏览器控制台应出现 `[realtime] 已连接，实时更新已开启。`

## 行为说明

- 订阅范围：仅 `dungeons` / `comments` / `ratings`（具备公开 SELECT 策略，匿名端可收到）。
- 收到变更后：**只失效缓存并重渲染当前视图**，不做整页刷新。
- 去抖动 500ms：短时间内多次变更只刷新一次。
- 后台标签自动退订，回到前台自动重连并补一次刷新，避免无意义连接。
- 本地回退模式（未配置 Supabase）下自动跳过，不影响原有逻辑。

## 页面自定义

其他模块可通过注册回调获得通知，避免各自轮询：

```js
const off = window.FogRealtime.on('dungeons', () => {
  // 自定义刷新逻辑
});
// off(); // 取消订阅
```

也可监听全局事件：

```js
document.addEventListener('fog:realtime-refresh', (e) => {
  console.log('实时刷新的表：', e.detail.tables);
});
```

## 未纳入范围（需先补策略）

`match_musters` / `battle_rooms` 等表目前**没有面向 anon 的 SELECT 策略**，
加入发布也不会向匿名端投递（RLS 会拦截）。如需实时化对战/匹配，
请先为其添加合适的 SELECT 策略，再单独 `alter publication ... add table ...`。

## 验证

```sql
select * from pg_publication_tables where pubname = 'supabase_realtime';
-- 应看到 public.dungeons / public.comments / public.ratings
```

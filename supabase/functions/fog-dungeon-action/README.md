# fog-dungeon-action（Edge Function · 模块化版本）

> 由单文件 8304 行 `index.ts` 重构为多文件模块化结构（路径 A：Supabase CLI 部署）。
> 所有 action 的处理逻辑与重构前**逐字节一致**，仅做「搬家 + 路由化」。

## 目录结构

```
fog-dungeon-action/
├── index.ts              # 薄路由：CORS → 来源/方法校验 → 解析 body → 建 client → 分发 → 错误兜底
├── _shared/
│   └── core.ts           # 共享层：全部类型、常量、工具函数、DB/身份/权限辅助（原 index.ts 头部 4570 行）
└── handlers/             # 按业务域拆分的处理器（每个 action 一个 handleXxx 函数）
    ├── open.ts           # 公开读（无需身份）：listDungeons / listDungeonArchivePage / getDungeonDetail / listProfiles / listFaithTraits
    ├── content.ts        # 副本与论坛：listMyDungeons / submitDungeon / reviewDungeon / addRating / addComment ...
    ├── profile.ts        # 档案与身份：verifyInvite / getMyProfile / updateDisplayName / 称号与诅咒 ...
    ├── god.ts            # 神祇与信徒：listGodBelievers / godChangeBelieverProfession / godConvertBeliever
    ├── talent.ts         # 天赋：getTalentState / drawTalent / exchangeTalent / setEquippedTalent ...
    ├── score.ts          # 分数结算：checkScorePreview / submitScoreBatch / listScoreSettlements ...
    ├── battle.ts         # 匹配与战局：joinMatchQueue / createBattleRoom / applyBattlePlayerAction ...
    └── admin.ts          # 管理后台：admin* 系列（成员/角色/天赋池/信仰特性/操作日志）
```

## 路由模型

`index.ts` 的 `Deno.serve` 依次：
1. 应答 CORS 预检（OPTIONS）
2. 校验来源 `allowedBrowserOrigins`
3. 校验方法为 POST、环境变量存在
4. 解析请求体 → `action` / `payload`
5. 建 Supabase service-role client
6. **公开 action** 直接以 `Ctx` 分发
7. **身份网关**：`getInviteIdentity` → 会话校验 → `touchInviteActivity`，产出 `AuthCtx`
8. **鉴权 action** 以 `AuthCtx` 分发
9. 未知 action 兜底 + 全局 try/catch

## 开发规范（后续新增功能）

- 新增 action：在对应域文件新增 `export async function handleXxx(ctx: ...)`，并在 `index.ts` 分发链注册。
- 共享逻辑只放 `_shared/core.ts`；handler 之间禁止互相 import。
- 需要身份的 action 用 `AuthCtx`，公开读用 `Ctx`。

## 部署

```bash
supabase login                 # 交互式登录（本机执行）
supabase link --project-ref trosjcbvfhnfkelflijc
supabase functions deploy fog-dungeon-action
```

> 旧的「Dashboard 网页编辑器粘贴单文件」方式已不适用于多文件结构，必须改用 CLI 部署。

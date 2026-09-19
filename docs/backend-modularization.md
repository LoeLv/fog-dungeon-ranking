# 后端模块化重构蓝图（fog-dungeon-action）

> 状态：待决策（部署方式二选一后执行）
> 现状：`supabase/functions/fog-dungeon-action/index.ts` = 8304 行 / 约 390KB
> 结构：94 个 action 全部内联在 `Deno.serve`（第 4571 行起）的 `if` 链中；176 个顶层函数；唯一依赖 `jsr:@supabase/supabase-js@2`

---

## 0. 决定性前提（已核实）

**当前部署方式 = Supabase Dashboard 网页编辑器「粘贴 index.ts 单文件」→ Deploy function。**

证据：
1. `supabase/invite_setup.md`：「在 Supabase 后台打开 `Edge Functions`，新建函数 `fog-dungeon-action`，把 `supabase/functions/fog-dungeon-action/index.ts` 的内容部署到这个函数。」
2. 仓库内 **无** `supabase/config.toml`、**无** CLI 部署脚本、`.github/workflows` 为空。
3. Supabase 官方文档：Dashboard 的 Edge Function 编辑器是**单一代码编辑器**，且官方明确 "The Dashboard's Edge Function editor currently does not support version control, versioning, or rollbacks. We recommend using it only for quick testing and prototypes."；**多文件（`_shared/`、`handlers/`）必须通过 Supabase CLI 部署。**

**结论：在当前「后台粘贴单文件」方式下，无法拆成多文件；拆了就部署不了。真·模块化必须先迁移到 Supabase CLI。**

---

## 1. 两条路径（二选一）

### 路径 A（推荐）：迁移到 Supabase CLI + 真·多文件模块化
- 收益：真正解耦、可维护、可 code review、可版本控制、可本地 `supabase functions serve` 调试、未来可加 CDN/缓存头。
- 成本：需一次性在你本机安装 Node.js + Supabase CLI，执行一次 `supabase login` / `supabase link`，之后用 `supabase functions deploy` 发布。
- 风险点：发布流程从「网页粘贴」变为「命令行部署」，需要你接受这个流程变更。
- 交付物：`supabase/config.toml` + `_shared/` + `handlers/` 分域文件 + 薄路由 `index.ts`。

### 路径 B：保持「单文件粘贴」部署，仅做文件内结构化
- 收益：发布流程完全不变，零新增工具；把 8304 行整理成「分区横幅 + 命名 handler + 显式路由表」，可读性/可维护性显著提升。
- 成本：仍是单文件；无法按域分文件。
- 交付物：结构化的单文件 `index.ts`（分区注释 + `handleXxx()` 命名函数 + `const routes = {...}` 路由表）。

> 两条路径都会产出**同一套业务域划分**（见下），因此域映射表对二者通用。

---

## 2. 业务域划分（94 action）

| 域 | 文件（路径A）/分区（路径B） | action 数 | action |
|---|---|---|---|
| 副本与论坛内容 | `handlers/content.ts` | 14 | listDungeons, listDungeonArchivePage, getDungeonDetail, listMyDungeons, submitDungeon, reviewDungeon, markCleared, advanceRun, addRating, addComment, deleteComment, getCommentHonors, updatePinnedNote, deleteDungeon |
| 档案与身份 | `handlers/profile.ts` | 16 | verifyInvite, getMyProfile, listProfiles, listFaithTraits, updateDisplayName, saveProfile, setProfileTitleVisibility, updateTrickeryFaith, redeemPromoCode, getPublicProfile, grantProfileTitle, revokeProfileTitle, restoreProfileTitle, grantBetrayalCurse, revokeProfileCurse, restoreProfileCurse |
| 神祇与信徒 | `handlers/god.ts` | 3 | listGodBelievers, godChangeBelieverProfession, godConvertBeliever |
| 天赋 | `handlers/talent.ts` | 7 | getTalentState, drawTalent, exchangeTalent, resolveTalentOverflow, setEquippedTalent, discardOwnedTalent, discardOwnedTalents |
| 分数结算 | `handlers/score.ts` | 8 | checkScorePreview, submitScoreBatch, submitScoreSingle, listScoreSettlements, getScoreSettlementDetail, revokeScoreSettlement, listMyScoreMessages, markScoreMessageRead |
| 匹配与战局 | `handlers/battle.ts` | 26 | listMatchDungeons, getMatchState, joinMatchQueue, cancelMatchQueue, createBattleRoomFromMatchQueue, createBattleRoom, joinBattleRoom, getBattleRoom, updateBattleRoomRound, applyBattlePlayerAction, submitBattleRoomAction, resolveBattleRoomAction, updateBattlePlayerTeam, updateBattleAbilityCooldown, addBattlePlayerStatus, updateBattlePlayerStatus, deleteBattlePlayerStatus, extendBattleRoom, finishBattleRoom, getBattleOverview, startMatchMuster, getMatchMuster, searchMusterPlayers, joinMatchMuster, cancelMatchMuster, drawMatchMuster |
| 管理后台 | `handlers/admin.ts` | 20 | adminLookupPlayer, adminListOperationLogs, adminListMembers, adminSetAccountRole, adminRenameAccount, adminChangeMemberIdentity, adminResetAccount, adminDeleteAccount, adminListTalentPoolItems, adminListExclusiveTalentWorkbench, adminUpsertExclusiveTalent, adminDeleteExclusiveTalent, adminUpsertTalentPoolItem, adminBatchUpsertTalentPoolItems, adminBatchDeleteTalentPoolItems, adminSetTalentPoolItemEnabled, adminUpsertFaithTrait, listHonorOperationLogs, adminScanTalentState, adminRepairTalentState |

共享层：
- `_shared/cors.ts`：`corsHeaders`、`json()`
- `_shared/types.ts`：`InviteRole`、`RequestBody`、`InviteIdentity`、`LooseError`、`SupabaseClientAny`
- `_shared/identity.ts`：`getInviteIdentity()`、`isAdmin()`、权限判定
- `_shared/validate.ts`：`cleanText()`、`cleanTalentId()`、`isRecord()` 等校验工具
- `_shared/db.ts`：`createClient()` 封装、通用查询辅助

> 路径 A 的目标是 `index.ts` 只保留：CORS 预检 → 来源校验 → 解析 body → 建 client → `const routes: Record<string, Handler>` 分发。每个 handler 接收 `(ctx)` 上下文（`supabase`、`body`、`payload`、`identity`），返回 `json(...)`。

---

## 3. 后续开发维护规范（本文件即规范）

1. **新增一个 action**：只在对应域文件里加一个 `export async function handleXxx(ctx)`，并在路由表注册；不新增顶层文件除非是新域。
2. **共享逻辑**：只放 `_shared/`，禁止跨 handler 相互 import。
3. **每个 handler 单一职责**：只读/只写清晰标注；写操作必须返回明确成功/失败结构。
4. **命名**：`handle<Action>`；域文件小写单词（`talent.ts` / `battle.ts`）。
5. **版本控制**：路径 A 下全部走 git；路径 B 下单文件也建议每次改动附一段「变更横幅」注释。

---

## 4. 迁移步骤（路径 A）

1. 本机安装 Supabase CLI，`supabase login`、`supabase link --project-ref <ref>`。
2. `supabase functions download fog-dungeon-action` 校对与仓库一致。
3. 建 `supabase/config.toml`，建 `_shared/` 与 `handlers/`，按域迁移函数（纯搬迁，不改逻辑）。
4. 本地 `supabase functions serve fog-dungeon-action` 冒烟调试。
5. `supabase functions deploy fog-dungeon-action` 灰度发布，线上回归 94 个 action。
6. 回归通过后删除旧单文件粘贴流程，更新 `invite_setup.md`。

## 5. 风险与回退
- 无法在本地跑集成测试：靠 `deno check` 语法级校验 + 线上灰度。
- 回退：保留当前线上版本；如新部署异常，Dashboard 重新粘贴旧 `index.ts` 即恢复。

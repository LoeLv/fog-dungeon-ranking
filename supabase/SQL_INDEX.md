# Supabase SQL Index

这个目录只保留 `functions/` 和入口文档。SQL 脚本已经按用途归档，方便以后查找和避免误跑。

## 目录说明

- `current/`：近期仍可能需要查看或重复确认的脚本。
- `migrations/`：正式结构迁移和长期功能表结构。新功能建表脚本默认放这里。
- `patches/`：一次性修复、补丁、数据修正。通常跑过后不再重复执行。
- `dangerous/`：重置、删除、清号、回滚结算等高风险脚本。运行前必须确认目标和预览结果。
- `archive/`：旧版本大包、历史刷新脚本和大型旧数据导入。

## 最近常用

- `current/delegated_permissions_20260809.sql`：管理员名单和委托权限。
- `current/talent_pool_cooldown_batch_20260810.sql`：天赋池冷却字段补齐检查。
- `current/talent_pool_update_20260810.sql`：2026-08-10 天赋池内容更新。
- `migrations/faith_traits_management_20260812.sql`：信仰特性维护表和默认 16 神种子。
- `migrations/promo_code_redemption_20260811.sql`：兑换码功能表。
- `migrations/battle_room_system_20260810.sql`：战斗房间功能表。

## 安全习惯

1. SQL Editor 里尽量整段从头运行，不要只选中中间几行。
2. `dangerous/` 里的脚本不要临时改名复制后直接跑，先看目标昵称、哈希和验证查询。
3. 一次性补丁跑完后不要删除，保留用于追溯线上状态。
4. Edge Function 代码在 `functions/fog-dungeon-action/index.ts`，不在这些 SQL 分类目录里。

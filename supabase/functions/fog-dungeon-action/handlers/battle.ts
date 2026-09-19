import {
  InviteRole, addBattlePlayerStatus, applyBattlePlayerAction, cleanBigIntId, cleanScore, cleanText, createBattleRoomFromDungeon, 
  createBattleRoomFromMatchRoom, deleteBattlePlayerStatus, extendBattleRoom, finishBattleRoom, getBattleRoomByMatchRoom, 
  getBattleRoomState, getDungeonEstimatedDuration, getMatchMusterState, getMatchState, getMyBattleOverview, 
  hasRole, isMissingBattleSystem, isMissingCoCreatorsColumn, isMissingEstimatedDurationColumn, isMissingMatchMusterSystem, 
  isMissingMatchSystem, isUuid, joinBattleRoom, json, resolveBattleRoomAction, specialAccountRoles, submitBattleRoomAction, 
  updateBattleAbilityCooldown, updateBattlePlayerStatus, updateBattlePlayerTeam, updateBattleRoomRound, 
} from "../_shared/core.ts";
import type { Ctx, AuthCtx } from "../_shared/core.ts";

// action: listMatchDungeons
export async function handleListMatchDungeons(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
        if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

        const keyword = cleanText(payload.keyword, 120);
        const limit = Math.max(1, Math.min(Number(payload.limit) || (keyword ? 30 : 80), 200));
        let dungeonQuery = supabase
          .from("dungeons")
          .select("id, name, creator, co_creators, difficulty, type, participant_count, estimated_duration, run_count, clear_rate, avg_rating, rating_count, comment_count, created_at, is_one_shot");
        if (keyword) dungeonQuery = dungeonQuery.ilike("name", `%${keyword}%`);
        let { data: dungeons, error: dungeonError } = await dungeonQuery
          .order("created_at", { ascending: false })
          .limit(limit);
        if (isMissingCoCreatorsColumn(dungeonError) || isMissingEstimatedDurationColumn(dungeonError)) {
          let fallbackQuery = supabase
            .from("dungeons")
            .select("id, name, creator, difficulty, type, participant_count, run_count, clear_rate, avg_rating, rating_count, comment_count, created_at, is_one_shot");
          if (keyword) fallbackQuery = fallbackQuery.ilike("name", `%${keyword}%`);
          const fallback = await fallbackQuery
            .order("created_at", { ascending: false })
            .limit(limit);
          dungeons = (fallback.data || []) as typeof dungeons;
          dungeonError = fallback.error;
        }
      if (isMissingMatchMusterSystem(dungeonError)) return json({ error: "请先运行 match_muster_migration.sql" }, 400);
      if (dungeonError) return json({ error: dungeonError.message }, 400);

      const dungeonIds = (dungeons || []).map((dungeon) => String(dungeon.id)).filter(Boolean);
      const queueCountByDungeon = new Map<string, number>();
      const roomCountByDungeon = new Map<string, number>();

      if (dungeonIds.length) {
        const { data: queueRows, error: queueError } = await supabase
          .from("match_queue")
          .select("dungeon_id")
          .in("dungeon_id", dungeonIds)
          .eq("status", "queued");
        if (isMissingMatchSystem(queueError)) return json({ error: "请先运行 match_system_migration.sql" }, 400);
        if (queueError) return json({ error: queueError.message }, 400);

        for (const row of queueRows || []) {
          const dungeonId = String(row.dungeon_id);
          queueCountByDungeon.set(dungeonId, (queueCountByDungeon.get(dungeonId) || 0) + 1);
        }

        const { data: roomRows, error: roomError } = await supabase
          .from("match_rooms")
          .select("dungeon_id")
          .in("dungeon_id", dungeonIds)
          .eq("room_status", "running");
        if (isMissingMatchSystem(roomError)) return json({ error: "请先运行 match_system_migration.sql" }, 400);
        if (roomError) return json({ error: roomError.message }, 400);

        for (const row of roomRows || []) {
          const dungeonId = String(row.dungeon_id);
          roomCountByDungeon.set(dungeonId, (roomCountByDungeon.get(dungeonId) || 0) + 1);
        }
      }

      return json({
        role,
        name: identity.displayName,
        data: (dungeons || []).map((dungeon) => {
          const dungeonId = String(dungeon.id);
          return {
            ...dungeon,
            estimatedDuration: getDungeonEstimatedDuration(dungeon as Record<string, unknown>),
            queuedCount: queueCountByDungeon.get(dungeonId) || 0,
            runningRoomCount: roomCountByDungeon.get(dungeonId) || 0,
          };
        }),
      });
}

// action: getMatchState
export async function handleGetMatchState(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      if (!isUuid(dungeonId)) return json({ error: "副本 ID 不正确" }, 400);

      const state = await getMatchState(supabase, dungeonId);
      if (isMissingMatchSystem(state.error)) return json({ error: "请先运行 match_system_migration.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
}

// action: joinMatchQueue
export async function handleJoinMatchQueue(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      if (!isUuid(dungeonId)) return json({ error: "副本 ID 不正确" }, 400);

      const { data: result, error } = await supabase.rpc("join_match_queue", {
        p_dungeon_id: dungeonId,
        p_player_code_hash: identity.codeHash,
        p_player_name: identity.displayName,
      });
      if (isMissingMatchSystem(error)) return json({ error: "请先运行 match_system_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);

      const state = await getMatchState(supabase, dungeonId);
      if (isMissingMatchSystem(state.error)) return json({ error: "请先运行 match_system_migration.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: { result, state: state.data } });
}

// action: cancelMatchQueue
export async function handleCancelMatchQueue(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      if (!isUuid(dungeonId)) return json({ error: "副本 ID 不正确" }, 400);

      const { data: result, error } = await supabase.rpc("cancel_match_queue", {
        p_dungeon_id: dungeonId,
        p_player_code_hash: identity.codeHash,
      });
      if (isMissingMatchSystem(error)) return json({ error: "请先运行 match_system_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);

      const state = await getMatchState(supabase, dungeonId);
      if (isMissingMatchSystem(state.error)) return json({ error: "请先运行 match_system_migration.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: { result, state: state.data } });
}

// action: createBattleRoomFromMatchRoom
export async function handleCreateBattleRoomFromMatchRoom(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const matchRoomId = cleanText(payload.matchRoomId, 80);
      if (!isUuid(matchRoomId)) return json({ error: "组队房间 ID 不正确" }, 400);

      const state = await createBattleRoomFromMatchRoom(supabase, matchRoomId, identity);
      if (isMissingBattleSystem(state.error)) return json({ error: "请先运行 battle_room_system_20260810.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
}

// action: createBattleRoom
export async function handleCreateBattleRoom(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      if (!isUuid(dungeonId)) return json({ error: "副本 ID 不正确" }, 400);

      const state = await createBattleRoomFromDungeon(supabase, dungeonId, identity);
      if (isMissingBattleSystem(state.error)) return json({ error: "请先运行 battle_room_system_20260810.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
}

// action: joinBattleRoom
export async function handleJoinBattleRoom(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const battleRoomId = cleanText(payload.battleRoomId, 80);
      if (!isUuid(battleRoomId)) return json({ error: "战斗房间 ID 不正确" }, 400);

      const state = await joinBattleRoom(supabase, battleRoomId, identity);
      if (isMissingBattleSystem(state.error)) return json({ error: "请先运行 battle_room_system_20260810.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
}

// action: getBattleRoom
export async function handleGetBattleRoom(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const battleRoomId = cleanText(payload.battleRoomId, 80);
      const matchRoomId = cleanText(payload.matchRoomId, 80);
      const dungeonId = cleanText(payload.dungeonId, 80);
      if (battleRoomId && !isUuid(battleRoomId)) return json({ error: "战斗房间 ID 不正确" }, 400);
      if (matchRoomId && !isUuid(matchRoomId)) return json({ error: "组队房间 ID 不正确" }, 400);
      if (dungeonId && !isUuid(dungeonId)) return json({ error: "副本 ID 不正确" }, 400);
      if (!battleRoomId && !matchRoomId && !dungeonId) return json({ error: "缺少战斗房间 ID" }, 400);

      let state = battleRoomId
        ? await getBattleRoomState(supabase, battleRoomId, identity)
        : matchRoomId
          ? await getBattleRoomByMatchRoom(supabase, matchRoomId, identity)
          : { data: null };
      if (!battleRoomId && !matchRoomId && dungeonId) {
        const { data: room, error: roomError } = await supabase
          .from("battle_rooms")
          .select("id")
          .eq("dungeon_id", dungeonId)
          .eq("host_code_hash", identity.codeHash)
          .eq("room_status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (roomError) state = { error: roomError };
        else state = room?.id ? await getBattleRoomState(supabase, String(room.id), identity) : { data: null };
      }
      if (isMissingBattleSystem(state.error)) return json({ error: "请先运行 battle_room_system_20260810.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
}

// action: updateBattleRoomRound
export async function handleUpdateBattleRoomRound(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const battleRoomId = cleanText(payload.battleRoomId, 80);
      if (!isUuid(battleRoomId)) return json({ error: "战斗房间 ID 不正确" }, 400);

      const state = await updateBattleRoomRound(supabase, battleRoomId, identity, payload.currentRound, payload.note);
      if (isMissingBattleSystem(state.error)) return json({ error: "请先运行 battle_room_system_20260810.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
}

// action: applyBattlePlayerAction
export async function handleApplyBattlePlayerAction(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const battleRoomId = cleanText(payload.battleRoomId, 80);
      const playerId = cleanBigIntId(payload.playerId);
      const battleActionType = cleanText(payload.actionType, 20);
      if (!isUuid(battleRoomId)) return json({ error: "战斗房间 ID 不正确" }, 400);
      if (!playerId) return json({ error: "战斗成员 ID 不正确" }, 400);

      const state = await applyBattlePlayerAction(supabase, battleRoomId, playerId, identity, battleActionType, payload.amount, payload.note);
      if (isMissingBattleSystem(state.error)) return json({ error: "请先运行 battle_room_system_20260810.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
}

// action: submitBattleRoomAction
export async function handleSubmitBattleRoomAction(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);
      const battleRoomId = cleanText(payload.battleRoomId, 80);
      const playerId = cleanBigIntId(payload.playerId);
      if (!isUuid(battleRoomId)) return json({ error: "战斗房间 ID 不正确" }, 400);
      if (!playerId) return json({ error: "战斗成员 ID 不正确" }, 400);
      const state = await submitBattleRoomAction(
        supabase,
        battleRoomId,
        playerId,
        identity,
        payload.actionText,
        payload.abilityKey,
      );
      if (isMissingBattleSystem(state.error)) return json({ error: "请先运行 battle_room_turn_actions_20260819.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
}

// action: resolveBattleRoomAction
export async function handleResolveBattleRoomAction(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);
      const battleRoomId = cleanText(payload.battleRoomId, 80);
      const actionId = cleanBigIntId(payload.actionId);
      if (!isUuid(battleRoomId)) return json({ error: "战斗房间 ID 不正确" }, 400);
      if (!actionId) return json({ error: "行动 ID 不正确" }, 400);
      const state = await resolveBattleRoomAction(
        supabase,
        battleRoomId,
        actionId,
        identity,
        payload.decision,
        payload.dmNote,
      );
      if (isMissingBattleSystem(state.error)) return json({ error: "请先运行 battle_room_turn_actions_20260819.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
}

// action: updateBattlePlayerTeam
export async function handleUpdateBattlePlayerTeam(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);
      const battleRoomId = cleanText(payload.battleRoomId, 80);
      const playerId = cleanBigIntId(payload.playerId);
      if (!isUuid(battleRoomId)) return json({ error: "战斗房间 ID 不正确" }, 400);
      if (!playerId) return json({ error: "战斗成员 ID 不正确" }, 400);
      const state = await updateBattlePlayerTeam(supabase, battleRoomId, playerId, identity, payload.teamName);
      if (isMissingBattleSystem(state.error)) return json({ error: "请先运行 battle_room_system_20260810.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
}

// action: updateBattleAbilityCooldown
export async function handleUpdateBattleAbilityCooldown(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);
      const battleRoomId = cleanText(payload.battleRoomId, 80);
      const playerId = cleanBigIntId(payload.playerId);
      if (!isUuid(battleRoomId)) return json({ error: "战斗房间 ID 不正确" }, 400);
      if (!playerId) return json({ error: "战斗成员 ID 不正确" }, 400);
      const state = await updateBattleAbilityCooldown(supabase, battleRoomId, playerId, identity, payload.abilityKey);
      if (isMissingBattleSystem(state.error)) return json({ error: "请先运行 battle_room_system_20260810.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
}

// action: addBattlePlayerStatus
export async function handleAddBattlePlayerStatus(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);
      const battleRoomId = cleanText(payload.battleRoomId, 80);
      const playerId = cleanBigIntId(payload.playerId);
      if (!isUuid(battleRoomId)) return json({ error: "战斗房间 ID 不正确" }, 400);
      if (!playerId) return json({ error: "战斗成员 ID 不正确" }, 400);
      const state = await addBattlePlayerStatus(supabase, battleRoomId, playerId, identity, payload.statusName, payload.stackCount, payload.isPublic);
      if (isMissingBattleSystem(state.error)) return json({ error: "请先运行 battle_room_status_hotfix_20260825.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
}

// action: updateBattlePlayerStatus
export async function handleUpdateBattlePlayerStatus(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);
      const battleRoomId = cleanText(payload.battleRoomId, 80);
      const statusId = cleanBigIntId(payload.statusId);
      if (!isUuid(battleRoomId)) return json({ error: "战斗房间 ID 不正确" }, 400);
      if (!statusId) return json({ error: "状态 ID 不正确" }, 400);
      const state = await updateBattlePlayerStatus(supabase, battleRoomId, statusId, identity, payload.stackCount, payload.isPublic);
      if (isMissingBattleSystem(state.error)) return json({ error: "请先运行 battle_room_status_hotfix_20260825.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
}

// action: deleteBattlePlayerStatus
export async function handleDeleteBattlePlayerStatus(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);
      const battleRoomId = cleanText(payload.battleRoomId, 80);
      const statusId = cleanBigIntId(payload.statusId);
      if (!isUuid(battleRoomId)) return json({ error: "战斗房间 ID 不正确" }, 400);
      if (!statusId) return json({ error: "状态 ID 不正确" }, 400);
      const state = await deleteBattlePlayerStatus(supabase, battleRoomId, statusId, identity);
      if (isMissingBattleSystem(state.error)) return json({ error: "请先运行 battle_room_status_hotfix_20260825.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
}

// action: extendBattleRoom
export async function handleExtendBattleRoom(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);
      const battleRoomId = cleanText(payload.battleRoomId, 80);
      if (!isUuid(battleRoomId)) return json({ error: "战斗房间 ID 不正确" }, 400);
      const state = await extendBattleRoom(supabase, battleRoomId, identity);
      if (isMissingBattleSystem(state.error)) return json({ error: "请先运行 battle_room_system_20260810.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
}

// action: finishBattleRoom
export async function handleFinishBattleRoom(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const battleRoomId = cleanText(payload.battleRoomId, 80);
      if (!isUuid(battleRoomId)) return json({ error: "战斗房间 ID 不正确" }, 400);

      const state = await finishBattleRoom(supabase, battleRoomId, identity, payload.status, payload.note);
      if (isMissingBattleSystem(state.error)) return json({ error: "请先运行 battle_room_system_20260810.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
}

// action: getBattleOverview
export async function handleGetBattleOverview(ctx: AuthCtx) {
  const { identity, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);
      const state = await getMyBattleOverview(supabase, identity);
      if (isMissingBattleSystem(state.error)) return json({ error: "请先运行 battle_room_system_20260810.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
}

// action: startMatchMuster
export async function handleStartMatchMuster(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      if (!isUuid(dungeonId)) return json({ error: "副本 ID 不正确" }, 400);

      const durationSeconds = Math.max(10, Math.min(Number(payload.durationSeconds) || 60, 3600));
      const targetPlayerCountInput = Number(payload.targetPlayerCount ?? payload.target_player_count);
      const targetPlayerCount = Number.isFinite(targetPlayerCountInput)
        ? Math.max(1, Math.min(Math.floor(targetPlayerCountInput), 99))
        : null;
      const requiredPlayerNames = Array.isArray(payload.requiredPlayerNames)
        ? [...new Set(payload.requiredPlayerNames.map((item) => cleanText(item, 40)).filter(Boolean))].slice(0, 99)
        : [];
      const estimatedDuration = cleanText(payload.estimatedDuration ?? payload.estimated_duration, 40);
      const { data: result, error } = await supabase.rpc("start_match_muster", {
        p_dungeon_id: dungeonId,
        p_creator_code_hash: identity.codeHash,
        p_creator_name: identity.displayName,
        p_duration_seconds: durationSeconds,
        p_target_player_count: targetPlayerCount,
        p_required_player_names: requiredPlayerNames,
      });
      if (isMissingMatchMusterSystem(error)) return json({ error: "请先运行 match_muster_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);

      const musterId = cleanText((result as Record<string, unknown> | null)?.musterId, 80);
      if (!isUuid(musterId)) return json({ error: "召集创建失败" }, 400);
      if (estimatedDuration) {
        const durationUpdate = await supabase
          .from("match_musters")
          .update({ estimated_duration: estimatedDuration })
          .eq("id", musterId);
        if (isMissingEstimatedDurationColumn(durationUpdate.error)) return json({ error: "请先运行 match_muster_estimated_duration_hotfix_20260825.sql" }, 400);
        if (durationUpdate.error) return json({ error: durationUpdate.error.message }, 400);
      }
      const state = await getMatchMusterState(supabase, musterId, identity);
      if (isMissingMatchMusterSystem(state.error)) return json({ error: "请先运行 match_muster_migration.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: { result, state: state.data } });
}

// action: getMatchMuster
export async function handleGetMatchMuster(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const musterId = cleanText(payload.musterId, 80);
      if (!isUuid(musterId)) return json({ error: "召集 ID 不正确" }, 400);

      const state = await getMatchMusterState(supabase, musterId, identity);
      if (isMissingMatchMusterSystem(state.error)) return json({ error: "请先运行 match_muster_migration.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
}

// action: searchMusterPlayers
export async function handleSearchMusterPlayers(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const keyword = cleanText(payload.keyword, 40);
      const limit = Math.max(1, Math.min(Number(payload.limit) || 20, 40));
      if (!keyword) return json({ role, name: identity.displayName, data: [] });

      const profileResult = await supabase
        .from("player_profiles")
        .select("display_name, role, faith_god, faith_path, profession, ascension_score, audience_score, updated_at")
        .ilike("display_name", `%${keyword}%`)
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (profileResult.error?.code === "42P01") return json({ error: "请先运行 player_profiles_migration.sql" }, 400);
      if (profileResult.error) return json({ error: profileResult.error.message }, 400);

      const rows = new Map<string, Record<string, unknown>>();
      for (const profile of profileResult.data || []) {
        const displayName = cleanText((profile as Record<string, unknown>).display_name, 40);
        const profileRole = cleanText((profile as Record<string, unknown>).role, 20) || "player";
        if (specialAccountRoles.has(profileRole as InviteRole)) continue;
        if (!displayName) continue;
        rows.set(displayName, {
          display_name: displayName,
          role: profileRole,
          faith_god: cleanText((profile as Record<string, unknown>).faith_god, 20),
          faith_path: cleanText((profile as Record<string, unknown>).faith_path, 20),
          profession: cleanText((profile as Record<string, unknown>).profession, 40),
          ascension_score: cleanScore((profile as Record<string, unknown>).ascension_score),
          audience_score: cleanScore((profile as Record<string, unknown>).audience_score),
          source: "profile",
        });
      }

      if (rows.size < limit) {
        const inviteResult = await supabase
          .from("invite_codes")
          .select("display_name, role")
          .ilike("display_name", `%${keyword}%`)
          .eq("is_active", true)
          .in("role", ["player", "author", "reviewer", "admin"])
          .limit(limit);
        if (inviteResult.error) return json({ error: inviteResult.error.message }, 400);
        for (const invite of inviteResult.data || []) {
          if (rows.size >= limit) break;
          const displayName = cleanText((invite as Record<string, unknown>).display_name, 40);
          if (!displayName || rows.has(displayName)) continue;
          rows.set(displayName, {
            display_name: displayName,
            role: cleanText((invite as Record<string, unknown>).role, 20) || "player",
            faith_god: "",
            faith_path: "",
            profession: "",
            ascension_score: 0,
            audience_score: 0,
            source: "invite",
          });
        }
      }

      return json({ role, name: identity.displayName, data: [...rows.values()] });
}

// action: joinMatchMuster
export async function handleJoinMatchMuster(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const musterId = cleanText(payload.musterId, 80);
      if (!isUuid(musterId)) return json({ error: "召集 ID 不正确" }, 400);

      const { data: result, error } = await supabase.rpc("join_match_muster", {
        p_muster_id: musterId,
        p_player_code_hash: identity.codeHash,
        p_player_name: identity.displayName,
      });
      if (isMissingMatchMusterSystem(error)) return json({ error: "请先运行 match_muster_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);

      const state = await getMatchMusterState(supabase, musterId, identity);
      if (isMissingMatchMusterSystem(state.error)) return json({ error: "请先运行 match_muster_migration.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: { result, state: state.data } });
}

// action: cancelMatchMuster
export async function handleCancelMatchMuster(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const musterId = cleanText(payload.musterId, 80);
      if (!isUuid(musterId)) return json({ error: "召集 ID 不正确" }, 400);

      const { data: result, error } = await supabase.rpc("cancel_match_muster_join", {
        p_muster_id: musterId,
        p_player_code_hash: identity.codeHash,
      });
      if (isMissingMatchMusterSystem(error)) return json({ error: "请先运行 match_muster_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);

      const state = await getMatchMusterState(supabase, musterId, identity);
      if (isMissingMatchMusterSystem(state.error)) return json({ error: "请先运行 match_muster_migration.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: { result, state: state.data } });
}

// action: drawMatchMuster
export async function handleDrawMatchMuster(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const musterId = cleanText(payload.musterId, 80);
      if (!isUuid(musterId)) return json({ error: "召集 ID 不正确" }, 400);

      const { data: result, error } = await supabase.rpc("draw_match_muster", {
        p_muster_id: musterId,
      });
      if (isMissingMatchMusterSystem(error)) return json({ error: "请先运行 match_muster_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);

      const state = await getMatchMusterState(supabase, musterId, identity);
      if (isMissingMatchMusterSystem(state.error)) return json({ error: "请先运行 match_muster_migration.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: { result, state: state.data } });
}

import {
  buildScorePreview, canSettleScores, checkSettlementScoreRange, cleanBigIntId, cleanScore, cleanSettlementScore, 
  cleanText, commitScoreSettlement, hasRole, isUuid, json, parseScoreSettlementText, writeAdminOperationLog, 
} from "../_shared/core.ts";
import type { Ctx, AuthCtx } from "../_shared/core.ts";

// action: checkScorePreview
export async function handleCheckScorePreview(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!canSettleScores(identity)) return json({ error: "需要审核员权限" }, 403);
      const { entries, invalidLines } = parseScoreSettlementText(payload.textContent);
      const preview = await buildScorePreview(supabase, entries, invalidLines);
      if (preview.error?.code === "42P01") return json({ error: "请先运行 score_system_migration.sql" }, 400);
      if (preview.error) return json({ error: preview.error.message }, 400);
      return json({ role, name: identity.displayName, data: preview.data });
}

// action: submitScoreBatch
export async function handleSubmitScoreBatch(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!canSettleScores(identity)) return json({ error: "需要审核员权限" }, 403);
      const { entries, invalidLines } = parseScoreSettlementText(payload.textContent);
      if (invalidLines.length) return json({ error: "结算文本格式有误", data: { invalidLines } }, 400);
      const result = await commitScoreSettlement(
        supabase,
        identity,
        "batch",
        payload.dungeonName,
        entries,
        {
          rawText: cleanText(payload.textContent, 20000),
          remark: cleanText(payload.remark, 500),
          confirmClear: payload.confirmClear === true,
          clearStatuses: payload.clearStatuses,
          dungeonId: payload.dungeonId,
          settlementRequestId: payload.settlementRequestId,
        },
      );
      if (result.error?.code === "42P01") return json({ error: "请先运行 score_system_migration.sql" }, 400);
      if (result.error) return json({ error: result.error.message || "结算失败", data: result.error.preview || null }, 400);
      return json({ role, name: identity.displayName, data: (result as any).data });
}

// action: submitScoreSingle
export async function handleSubmitScoreSingle(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!canSettleScores(identity)) return json({ error: "需要审核员权限" }, 403);
      const nick = cleanText(payload.playerName, 40);
      const deng = cleanSettlementScore(payload.dengScore);
      const jin = cleanSettlementScore(payload.jinScore);
      const rangeMessage = checkSettlementScoreRange(deng, jin);
      if (!nick || rangeMessage) return json({ error: rangeMessage || "请填写玩家昵称" }, 400);
      const result = await commitScoreSettlement(
        supabase,
        identity,
        "single",
        payload.dungeonName,
        [{ nick, deng, jin, total: Math.round((deng + jin) * 10) / 10, line: 1, raw: `${nick}:${deng}+${jin}` }],
        {
          remark: cleanText(payload.remark, 500),
          confirmClear: payload.confirmClear === true,
          clearStatuses: payload.clearStatuses,
          dungeonId: payload.dungeonId,
          settlementRequestId: payload.settlementRequestId,
        },
      );
      if (result.error?.code === "42P01") return json({ error: "请先运行 score_system_migration.sql" }, 400);
      if (result.error) return json({ error: result.error.message || "补分失败", data: result.error.preview || null }, 400);
      return json({ role, name: identity.displayName, data: (result as any).data });
}

// action: listScoreSettlements
export async function handleListScoreSettlements(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!canSettleScores(identity)) return json({ error: "需要审核员权限" }, 403);
      const limit = Math.max(1, Math.min(100, Number(payload.limit || 30)));
      const dungeonQuery = cleanText(payload.dungeonQuery, 80);
      const recentCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      let query = supabase
        .from("score_settlements")
        .select("id, dungeon_name, source_type, operator_name, total_players, total_ascension, total_audience, total_score, is_revoked, revoke_remark, created_at")
        .gte("created_at", recentCutoff)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (dungeonQuery) query = query.ilike("dungeon_name", `%${dungeonQuery}%`);
      const { data, error } = await query;
      if (error?.code === "42P01") return json({ error: "请先运行 score_system_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);
      return json({ role, name: identity.displayName, data: data || [] });
}

// action: getScoreSettlementDetail
export async function handleGetScoreSettlementDetail(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!canSettleScores(identity)) return json({ error: "需要审核员权限" }, 403);
      const settlementId = cleanText(payload.settlementId, 80);
      if (!isUuid(settlementId)) return json({ error: "结算 ID 不正确" }, 400);
      const { data: settlement, error: settlementError } = await supabase
        .from("score_settlements")
        .select("*")
        .eq("id", settlementId)
        .single();
      if (settlementError) return json({ error: settlementError.message }, 400);
      const { data: entries, error: entriesError } = await supabase
        .from("score_settlement_entries")
        .select("player_name, score_deng, score_jin, total_add")
        .eq("settlement_id", settlementId)
        .order("id", { ascending: true });
      if (entriesError) return json({ error: entriesError.message }, 400);
      return json({ role, name: identity.displayName, data: { settlement, entries: entries || [] } });
}

// action: revokeScoreSettlement
export async function handleRevokeScoreSettlement(ctx: AuthCtx) {
  const { action, identity, payload, role, supabase } = ctx;
      if (!canSettleScores(identity)) return json({ error: "需要审核员权限" }, 403);
      const settlementId = cleanText(payload.settlementId, 80);
      const revokeRemark = cleanText(payload.revokeRemark, 500);
      if (!isUuid(settlementId)) return json({ error: "结算 ID 不正确" }, 400);
      if (!revokeRemark) return json({ error: "请填写撤销备注" }, 400);

      const { data: settlement, error: settlementError } = await supabase
        .from("score_settlements")
        .select("id, dungeon_name, source_type, operator_code_hash, operator_name, is_revoked")
        .eq("id", settlementId)
        .single();
      if (settlementError) return json({ error: settlementError.message }, 400);
      if (settlement.is_revoked) return json({ error: "这场结算已经撤销过" }, 409);
      if (role !== "admin" && settlement.operator_code_hash !== identity.codeHash) {
        return json({ error: "审核员只能撤销自己提交的结算" }, 403);
      }

      const { data: entries, error: entriesError } = await supabase
        .from("score_settlement_entries")
        .select("player_code_hash, player_name, score_deng, score_jin, total_add")
        .eq("settlement_id", settlementId);
      if (entriesError) return json({ error: entriesError.message }, 400);

      for (const entry of entries || []) {
        const { data: profile, error: profileError } = await supabase
          .from("player_profiles")
          .select("ascension_score, audience_score")
          .eq("invite_code_hash", entry.player_code_hash)
          .single();
        if (profileError) return json({ error: profileError.message }, 400);
        const nextAscension = Math.max(0, Math.round((cleanScore(profile.ascension_score) - Number(entry.score_deng || 0)) * 10) / 10);
        const nextAudience = Math.max(0, Math.round((cleanScore(profile.audience_score) - Number(entry.score_jin || 0)) * 10) / 10);
        const { error: updateError } = await supabase
          .from("player_profiles")
          .update({
            ascension_score: nextAscension,
            audience_score: nextAudience,
            updated_at: new Date().toISOString(),
          })
          .eq("invite_code_hash", entry.player_code_hash);
        if (updateError) return json({ error: updateError.message }, 400);
      }

      const { error: revokeError } = await supabase
        .from("score_settlements")
        .update({
          is_revoked: true,
          revoke_remark: revokeRemark,
          revoked_by_hash: identity.codeHash,
          revoked_by_name: identity.displayName,
          revoked_at: new Date().toISOString(),
        })
        .eq("id", settlementId);
      if (revokeError) return json({ error: revokeError.message }, 400);

      const revokeLogs = (entries || []).map((entry) => ({
        player_code_hash: entry.player_code_hash,
        player_name: entry.player_name,
        change_deng: -Number(entry.score_deng || 0),
        change_jin: -Number(entry.score_jin || 0),
        source_type: "revoke",
        settlement_id: settlementId,
        operator_code_hash: identity.codeHash,
        operator_name: identity.displayName,
        revoke_remark: revokeRemark,
      }));
      if (revokeLogs.length) {
        const { error: logError } = await supabase.from("score_change_logs").insert(revokeLogs);
        if (logError) return json({ error: logError.message }, 400);
        const revokeMessages = (entries || []).map((entry) => ({
          player_code_hash: entry.player_code_hash,
          player_name: entry.player_name,
          settlement_id: settlementId,
          msg_type: "revoke",
          content: `【结算撤销｜副本：${settlement.dungeon_name}】\n撤销人：${identity.displayName}\n登神回滚：${-Number(entry.score_deng || 0)}\n觐见回滚：${-Number(entry.score_jin || 0)}\n备注：${revokeRemark}`,
        }));
        const { error: messageError } = await supabase.from("score_messages").insert(revokeMessages);
        if (messageError) return json({ error: messageError.message }, 400);
      }
      await writeAdminOperationLog(supabase, identity, {
        action: "score_settlement.revoke", objectType: "score_settlement", objectId: settlementId,
        summary: `撤销副本「${cleanText(settlement.dungeon_name, 80)}」的结算，影响 ${revokeLogs.length} 位玩家`,
        beforeState: { isRevoked: false, playerCount: revokeLogs.length }, afterState: { isRevoked: true, revokeRemark },
      });

      return json({ role, name: identity.displayName, data: { id: settlementId } });
}

// action: listMyScoreMessages
export async function handleListMyScoreMessages(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);
      const limit = Math.max(1, Math.min(100, Number(payload.limit || 30)));
      const { data, error } = await supabase
        .from("score_messages")
        .select("id, settlement_id, msg_type, content, is_read, created_at")
        .eq("player_code_hash", identity.codeHash)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error?.code === "42P01") return json({ error: "请先运行 score_system_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);
      return json({ role, name: identity.displayName, data: data || [] });
}

// action: markScoreMessageRead
export async function handleMarkScoreMessageRead(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);
      const messageId = cleanBigIntId(payload.messageId);
      if (!messageId) return json({ error: "信封 ID 不正确" }, 400);
      const { error } = await supabase
        .from("score_messages")
        .update({ is_read: true })
        .eq("id", messageId)
        .eq("player_code_hash", identity.codeHash);
      if (error) return json({ error: error.message }, 400);
      return json({ role, name: identity.displayName, data: { id: messageId } });
}

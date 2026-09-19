import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleGetDungeonDetail, handleListDungeonArchivePage, handleListDungeons, handleListFaithTraits, handleListProfiles } from "./handlers/open.ts";
import { handleAddComment, handleAddRating, handleAdvanceRun, handleDeleteComment, handleDeleteDungeon, handleGetCommentHonors, handleListMyDungeons, handleMarkCleared, handleReviewDungeon, handleSubmitDungeon, handleUpdatePinnedNote } from "./handlers/content.ts";
import { handleGetMyProfile, handleGetPublicProfile, handleGrantBetrayalCurse, handleGrantProfileTitle, handleRedeemPromoCode, handleRestoreProfileCurse, handleRestoreProfileTitle, handleRevokeProfileCurse, handleRevokeProfileTitle, handleSaveProfile, handleSetProfileTitleVisibility, handleUpdateDisplayName, handleUpdateTrickeryFaith, handleVerifyInvite } from "./handlers/profile.ts";
import { handleGodChangeBelieverProfession, handleGodConvertBeliever, handleListGodBelievers } from "./handlers/god.ts";
import { handleDiscardOwnedTalent, handleDiscardOwnedTalents, handleDrawTalent, handleExchangeTalent, handleGetTalentState, handleResolveTalentOverflow, handleSetEquippedTalent } from "./handlers/talent.ts";
import { handleCheckScorePreview, handleGetScoreSettlementDetail, handleListMyScoreMessages, handleListScoreSettlements, handleMarkScoreMessageRead, handleRevokeScoreSettlement, handleSubmitScoreBatch, handleSubmitScoreSingle } from "./handlers/score.ts";
import { handleAddBattlePlayerStatus, handleApplyBattlePlayerAction, handleCancelMatchMuster, handleCancelMatchQueue, handleCreateBattleRoom, handleCreateBattleRoomFromMatchRoom, handleDeleteBattlePlayerStatus, handleDrawMatchMuster, handleExtendBattleRoom, handleFinishBattleRoom, handleGetBattleOverview, handleGetBattleRoom, handleGetMatchMuster, handleGetMatchState, handleJoinBattleRoom, handleJoinMatchMuster, handleJoinMatchQueue, handleListMatchDungeons, handleResolveBattleRoomAction, handleSearchMusterPlayers, handleStartMatchMuster, handleSubmitBattleRoomAction, handleUpdateBattleAbilityCooldown, handleUpdateBattlePlayerStatus, handleUpdateBattlePlayerTeam, handleUpdateBattleRoomRound } from "./handlers/battle.ts";
import { handleAdminBatchDeleteTalentPoolItems, handleAdminBatchUpsertTalentPoolItems, handleAdminChangeMemberIdentity, handleAdminDeleteExclusiveTalent, handleAdminListExclusiveTalentWorkbench, handleAdminListMembers, handleAdminListOperationLogs, handleAdminListTalentPoolItems, handleAdminLookupPlayer, handleAdminRenameAccount, handleAdminRepairTalentState, handleAdminResetAccount, handleAdminScanTalentState, handleAdminSetAccountRole, handleAdminSetTalentPoolItemEnabled, handleAdminUpsertExclusiveTalent, handleAdminUpsertFaithTrait, handleAdminUpsertTalentPoolItem, handleListHonorOperationLogs } from "./handlers/admin.ts";
import {
  allowedBrowserOrigins, corsHeaders, cleanText, json, readRequestBody, isRecord,
  isPublicReadRateLimited, getInviteIdentity, inviteDeviceSessionEnforcement,
  validateInviteSession, touchInviteActivity,
} from "./_shared/core.ts";
import type { Ctx, AuthCtx } from "./_shared/core.ts";

Deno.serve(async (req) => {
  // CORS preflight must be answered before origin authorization. Browsers send
  // OPTIONS without the final request body, and rejecting it blocks every call.
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const requestOrigin = cleanText(req.headers.get("origin"), 240);
  if (requestOrigin && !allowedBrowserOrigins.has(requestOrigin)) {
    return json({ error: "未授权的网站来源" }, 403);
  }
  if (req.method !== "POST") return json({ error: "只接受 POST 请求" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "后端环境变量缺失" }, 500);

  const requestResult = await readRequestBody(req);
  if (!requestResult.body) return json({ error: requestResult.error || "请求格式不正确" }, 400);
  const body = requestResult.body;

  const action = cleanText(body.action, 40);
  if (!action) return json({ error: "缺少操作类型" }, 400);
  if (body.payload !== undefined && !isRecord(body.payload)) return json({ error: "请求参数格式不正确" }, 400);
  if (isPublicReadRateLimited(req, action)) {
    return json({ error: "请求过于频繁，请稍后再试" }, 429);
  }
  const payload = body.payload ?? {};
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const ctx: Ctx = { supabase, body, payload, action, req };

  // ================= open actions (no identity required) =================
  if (action === "listDungeons") return await handleListDungeons(ctx);
  if (action === "listDungeonArchivePage") return await handleListDungeonArchivePage(ctx);
  if (action === "getDungeonDetail") return await handleGetDungeonDetail(ctx);
  if (action === "listProfiles") return await handleListProfiles(ctx);
  if (action === "listFaithTraits") return await handleListFaithTraits(ctx);

  // ================= identity gateway =================
  const identity = await getInviteIdentity(supabase, body.inviteCode);
  if (!identity) return json({ error: "邀请码无效或已过期" }, 401);
  const role = identity.role;
  if (inviteDeviceSessionEnforcement && action !== "verifyInvite") {
    const sessionResult = await validateInviteSession(supabase, identity, body.sessionId, body.deviceKind);
    if (sessionResult.error) return json({ error: sessionResult.error.message || "请重新登录", code: sessionResult.error.code || "session_invalid" }, 401);
  }
  await touchInviteActivity(supabase, identity, action);

  const authCtx: AuthCtx = { ...ctx, identity, role };

  try {
    // ================= authenticated actions =================
    if (action === "verifyInvite") return await handleVerifyInvite(authCtx);
    if (action === "getMyProfile") return await handleGetMyProfile(authCtx);
    if (action === "adminLookupPlayer") return await handleAdminLookupPlayer(authCtx);
    if (action === "adminListOperationLogs") return await handleAdminListOperationLogs(authCtx);
    if (action === "adminListMembers") return await handleAdminListMembers(authCtx);
    if (action === "adminSetAccountRole") return await handleAdminSetAccountRole(authCtx);
    if (action === "adminRenameAccount") return await handleAdminRenameAccount(authCtx);
    if (action === "adminChangeMemberIdentity") return await handleAdminChangeMemberIdentity(authCtx);
    if (action === "adminResetAccount") return await handleAdminResetAccount(authCtx);
    if (action === "adminDeleteAccount") return await handleAdminResetAccount(authCtx);
    if (action === "adminListTalentPoolItems") return await handleAdminListTalentPoolItems(authCtx);
    if (action === "adminListExclusiveTalentWorkbench") return await handleAdminListExclusiveTalentWorkbench(authCtx);
    if (action === "adminUpsertExclusiveTalent") return await handleAdminUpsertExclusiveTalent(authCtx);
    if (action === "adminDeleteExclusiveTalent") return await handleAdminDeleteExclusiveTalent(authCtx);
    if (action === "adminUpsertTalentPoolItem") return await handleAdminUpsertTalentPoolItem(authCtx);
    if (action === "adminBatchUpsertTalentPoolItems") return await handleAdminBatchUpsertTalentPoolItems(authCtx);
    if (action === "adminBatchDeleteTalentPoolItems") return await handleAdminBatchDeleteTalentPoolItems(authCtx);
    if (action === "adminSetTalentPoolItemEnabled") return await handleAdminSetTalentPoolItemEnabled(authCtx);
    if (action === "adminUpsertFaithTrait") return await handleAdminUpsertFaithTrait(authCtx);
    if (action === "listHonorOperationLogs") return await handleListHonorOperationLogs(authCtx);
    if (action === "listGodBelievers") return await handleListGodBelievers(authCtx);
    if (action === "godChangeBelieverProfession") return await handleGodChangeBelieverProfession(authCtx);
    if (action === "godConvertBeliever") return await handleGodConvertBeliever(authCtx);
    if (action === "adminScanTalentState") return await handleAdminScanTalentState(authCtx);
    if (action === "adminRepairTalentState") return await handleAdminRepairTalentState(authCtx);
    if (action === "updateDisplayName") return await handleUpdateDisplayName(authCtx);
    if (action === "saveProfile") return await handleSaveProfile(authCtx);
    if (action === "setProfileTitleVisibility") return await handleSetProfileTitleVisibility(authCtx);
    if (action === "updateTrickeryFaith") return await handleUpdateTrickeryFaith(authCtx);
    if (action === "redeemPromoCode") return await handleRedeemPromoCode(authCtx);
    if (action === "getPublicProfile") return await handleGetPublicProfile(authCtx);
    if (action === "grantProfileTitle") return await handleGrantProfileTitle(authCtx);
    if (action === "grantBetrayalCurse") return await handleGrantBetrayalCurse(authCtx);
    if (action === "revokeProfileTitle") return await handleRevokeProfileTitle(authCtx);
    if (action === "restoreProfileTitle") return await handleRestoreProfileTitle(authCtx);
    if (action === "restoreProfileCurse") return await handleRestoreProfileCurse(authCtx);
    if (action === "revokeProfileCurse") return await handleRevokeProfileCurse(authCtx);
    if (action === "checkScorePreview") return await handleCheckScorePreview(authCtx);
    if (action === "submitScoreBatch") return await handleSubmitScoreBatch(authCtx);
    if (action === "submitScoreSingle") return await handleSubmitScoreSingle(authCtx);
    if (action === "listScoreSettlements") return await handleListScoreSettlements(authCtx);
    if (action === "getScoreSettlementDetail") return await handleGetScoreSettlementDetail(authCtx);
    if (action === "revokeScoreSettlement") return await handleRevokeScoreSettlement(authCtx);
    if (action === "listMyScoreMessages") return await handleListMyScoreMessages(authCtx);
    if (action === "markScoreMessageRead") return await handleMarkScoreMessageRead(authCtx);
    if (action === "getTalentState") return await handleGetTalentState(authCtx);
    if (action === "drawTalent") return await handleDrawTalent(authCtx);
    if (action === "exchangeTalent") return await handleExchangeTalent(authCtx);
    if (action === "resolveTalentOverflow") return await handleResolveTalentOverflow(authCtx);
    if (action === "setEquippedTalent") return await handleSetEquippedTalent(authCtx);
    if (action === "discardOwnedTalent") return await handleDiscardOwnedTalent(authCtx);
    if (action === "discardOwnedTalents") return await handleDiscardOwnedTalents(authCtx);
    if (action === "listMatchDungeons") return await handleListMatchDungeons(authCtx);
    if (action === "getMatchState") return await handleGetMatchState(authCtx);
    if (action === "joinMatchQueue") return await handleJoinMatchQueue(authCtx);
    if (action === "cancelMatchQueue") return await handleCancelMatchQueue(authCtx);
    if (action === "createBattleRoomFromMatchRoom") return await handleCreateBattleRoomFromMatchRoom(authCtx);
    if (action === "createBattleRoom") return await handleCreateBattleRoom(authCtx);
    if (action === "joinBattleRoom") return await handleJoinBattleRoom(authCtx);
    if (action === "getBattleRoom") return await handleGetBattleRoom(authCtx);
    if (action === "updateBattleRoomRound") return await handleUpdateBattleRoomRound(authCtx);
    if (action === "applyBattlePlayerAction") return await handleApplyBattlePlayerAction(authCtx);
    if (action === "submitBattleRoomAction") return await handleSubmitBattleRoomAction(authCtx);
    if (action === "resolveBattleRoomAction") return await handleResolveBattleRoomAction(authCtx);
    if (action === "updateBattlePlayerTeam") return await handleUpdateBattlePlayerTeam(authCtx);
    if (action === "updateBattleAbilityCooldown") return await handleUpdateBattleAbilityCooldown(authCtx);
    if (action === "addBattlePlayerStatus") return await handleAddBattlePlayerStatus(authCtx);
    if (action === "updateBattlePlayerStatus") return await handleUpdateBattlePlayerStatus(authCtx);
    if (action === "deleteBattlePlayerStatus") return await handleDeleteBattlePlayerStatus(authCtx);
    if (action === "extendBattleRoom") return await handleExtendBattleRoom(authCtx);
    if (action === "finishBattleRoom") return await handleFinishBattleRoom(authCtx);
    if (action === "getBattleOverview") return await handleGetBattleOverview(authCtx);
    if (action === "startMatchMuster") return await handleStartMatchMuster(authCtx);
    if (action === "getMatchMuster") return await handleGetMatchMuster(authCtx);
    if (action === "searchMusterPlayers") return await handleSearchMusterPlayers(authCtx);
    if (action === "joinMatchMuster") return await handleJoinMatchMuster(authCtx);
    if (action === "cancelMatchMuster") return await handleCancelMatchMuster(authCtx);
    if (action === "drawMatchMuster") return await handleDrawMatchMuster(authCtx);
    if (action === "listMyDungeons") return await handleListMyDungeons(authCtx);
    if (action === "submitDungeon") return await handleSubmitDungeon(authCtx);
    if (action === "reviewDungeon") return await handleReviewDungeon(authCtx);
    if (action === "markCleared") return await handleMarkCleared(authCtx);
    if (action === "advanceRun") return await handleAdvanceRun(authCtx);
    if (action === "addRating") return await handleAddRating(authCtx);
    if (action === "addComment") return await handleAddComment(authCtx);
    if (action === "deleteComment") return await handleDeleteComment(authCtx);
    if (action === "getCommentHonors") return await handleGetCommentHonors(authCtx);
    if (action === "updatePinnedNote") return await handleUpdatePinnedNote(authCtx);
    if (action === "deleteDungeon") return await handleDeleteDungeon(authCtx);

    return json({ error: "未知操作" }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "后端处理失败" }, 500);
  }
});

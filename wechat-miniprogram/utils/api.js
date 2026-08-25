const config = require("./config");
const sessionStore = require("./session");

function normalizeError(error) {
  if (!error) return "请求失败";
  if (typeof error === "string") return error;
  if (error.message) return error.message;
  if (error.errMsg) return error.errMsg;
  return "请求失败";
}

function createResponseError(body, statusCode) {
  const error = new Error(body.error || body.message || ("请求失败：" + statusCode));
  error.code = body.code || "";
  error.statusCode = statusCode;
  return error;
}

function invokeDungeonAction(action, inviteCode, payload) {
  return new Promise(function(resolve, reject) {
    if (!inviteCode) {
      reject(new Error("请先输入入局邀请码"));
      return;
    }

    const currentSession = sessionStore.getSession();
    const requestBody = {
      action: action,
      inviteCode: inviteCode,
      payload: payload || {},
      deviceKind: sessionStore.DEVICE_KIND
    };
    if (currentSession && currentSession.sessionId) {
      requestBody.sessionId = currentSession.sessionId;
    }

    wx.request({
      url: config.DUNGEON_ACTION_URL,
      method: "POST",
      header: {
        "content-type": "application/json",
        "apikey": config.SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + config.SUPABASE_ANON_KEY
      },
      data: requestBody,
      success: function(response) {
        const body = response.data || {};
        const statusCode = Number(response.statusCode || 0);
        if (statusCode >= 200 && statusCode < 300 && !body.error) {
          resolve(body);
          return;
        }
        const error = createResponseError(body, statusCode);
        if (error.code === "session_invalid") {
          sessionStore.clearSession();
        }
        reject(error);
      },
      fail: function(error) {
        reject(new Error(normalizeError(error)));
      }
    });
  });
}

function verifyInvite(inviteCode) {
  return invokeDungeonAction("verifyInvite", inviteCode, {});
}

function getMyProfile(inviteCode) {
  return invokeDungeonAction("getMyProfile", inviteCode, {});
}

function listMatchDungeons(inviteCode, limit, keyword) {
  return invokeDungeonAction("listMatchDungeons", inviteCode, {
    limit: limit || 80,
    keyword: keyword || ""
  });
}

function getMatchState(inviteCode, dungeonId) {
  return invokeDungeonAction("getMatchState", inviteCode, { dungeonId: dungeonId });
}

function joinMatchQueue(inviteCode, dungeonId) {
  return invokeDungeonAction("joinMatchQueue", inviteCode, { dungeonId: dungeonId });
}

function cancelMatchQueue(inviteCode, dungeonId) {
  return invokeDungeonAction("cancelMatchQueue", inviteCode, { dungeonId: dungeonId });
}

function startMatchMuster(inviteCode, dungeonId, durationSeconds, options) {
  const config = options || {};
  return invokeDungeonAction("startMatchMuster", inviteCode, {
    dungeonId: dungeonId,
    durationSeconds: durationSeconds || 60,
    targetPlayerCount: config.targetPlayerCount || null,
    requiredPlayerNames: config.requiredPlayerNames || []
  });
}

function searchMusterPlayers(inviteCode, keyword, limit) {
  return invokeDungeonAction("searchMusterPlayers", inviteCode, {
    keyword: keyword || "",
    limit: limit || 20
  });
}

function getMatchMuster(inviteCode, musterId) {
  return invokeDungeonAction("getMatchMuster", inviteCode, { musterId: musterId });
}

function joinMatchMuster(inviteCode, musterId) {
  return invokeDungeonAction("joinMatchMuster", inviteCode, { musterId: musterId });
}

function cancelMatchMuster(inviteCode, musterId) {
  return invokeDungeonAction("cancelMatchMuster", inviteCode, { musterId: musterId });
}

function drawMatchMuster(inviteCode, musterId) {
  return invokeDungeonAction("drawMatchMuster", inviteCode, { musterId: musterId });
}

function createBattleRoom(inviteCode, dungeonId) {
  return invokeDungeonAction("createBattleRoom", inviteCode, { dungeonId: dungeonId });
}

function createBattleRoomFromMatchRoom(inviteCode, matchRoomId) {
  return invokeDungeonAction("createBattleRoomFromMatchRoom", inviteCode, { matchRoomId: matchRoomId });
}

function getBattleRoom(inviteCode, options) {
  const config = options || {};
  return invokeDungeonAction("getBattleRoom", inviteCode, {
    battleRoomId: config.battleRoomId || "",
    matchRoomId: config.matchRoomId || "",
    dungeonId: config.dungeonId || ""
  });
}

function joinBattleRoom(inviteCode, battleRoomId) {
  return invokeDungeonAction("joinBattleRoom", inviteCode, { battleRoomId: battleRoomId });
}

function updateBattleRoomRound(inviteCode, battleRoomId, currentRound, note) {
  return invokeDungeonAction("updateBattleRoomRound", inviteCode, {
    battleRoomId: battleRoomId,
    currentRound: currentRound,
    note: note || ""
  });
}

function submitBattleRoomAction(inviteCode, battleRoomId, playerId, actionText, abilityKey) {
  return invokeDungeonAction("submitBattleRoomAction", inviteCode, {
    battleRoomId: battleRoomId,
    playerId: playerId,
    actionText: actionText,
    abilityKey: abilityKey || ""
  });
}

function resolveBattleRoomAction(inviteCode, battleRoomId, actionId, decision, dmNote) {
  return invokeDungeonAction("resolveBattleRoomAction", inviteCode, {
    battleRoomId: battleRoomId,
    actionId: actionId,
    decision: decision || "resolved",
    dmNote: dmNote || ""
  });
}

function applyBattlePlayerAction(inviteCode, battleRoomId, playerId, actionType, amount, note) {
  return invokeDungeonAction("applyBattlePlayerAction", inviteCode, {
    battleRoomId: battleRoomId,
    playerId: playerId,
    actionType: actionType,
    amount: amount,
    note: note || ""
  });
}

function updateBattlePlayerTeam(inviteCode, battleRoomId, playerId, teamName) {
  return invokeDungeonAction("updateBattlePlayerTeam", inviteCode, {
    battleRoomId: battleRoomId,
    playerId: playerId,
    teamName: teamName
  });
}

function updateBattleAbilityCooldown(inviteCode, battleRoomId, playerId, abilityKey) {
  return invokeDungeonAction("updateBattleAbilityCooldown", inviteCode, {
    battleRoomId: battleRoomId,
    playerId: playerId,
    abilityKey: abilityKey
  });
}

function finishBattleRoom(inviteCode, battleRoomId, status, note) {
  return invokeDungeonAction("finishBattleRoom", inviteCode, {
    battleRoomId: battleRoomId,
    status: status || "finished",
    note: note || ""
  });
}

function extendBattleRoom(inviteCode, battleRoomId) {
  return invokeDungeonAction("extendBattleRoom", inviteCode, { battleRoomId: battleRoomId });
}

function getBattleOverview(inviteCode) {
  return invokeDungeonAction("getBattleOverview", inviteCode, {});
}

module.exports = {
  invokeDungeonAction: invokeDungeonAction,
  verifyInvite: verifyInvite,
  getMyProfile: getMyProfile,
  listMatchDungeons: listMatchDungeons,
  getMatchState: getMatchState,
  joinMatchQueue: joinMatchQueue,
  cancelMatchQueue: cancelMatchQueue,
  startMatchMuster: startMatchMuster,
  searchMusterPlayers: searchMusterPlayers,
  getMatchMuster: getMatchMuster,
  joinMatchMuster: joinMatchMuster,
  cancelMatchMuster: cancelMatchMuster,
  drawMatchMuster: drawMatchMuster,
  createBattleRoom: createBattleRoom,
  createBattleRoomFromMatchRoom: createBattleRoomFromMatchRoom,
  getBattleRoom: getBattleRoom,
  joinBattleRoom: joinBattleRoom,
  updateBattleRoomRound: updateBattleRoomRound,
  submitBattleRoomAction: submitBattleRoomAction,
  resolveBattleRoomAction: resolveBattleRoomAction,
  applyBattlePlayerAction: applyBattlePlayerAction,
  updateBattlePlayerTeam: updateBattlePlayerTeam,
  updateBattleAbilityCooldown: updateBattleAbilityCooldown,
  finishBattleRoom: finishBattleRoom,
  extendBattleRoom: extendBattleRoom,
  getBattleOverview: getBattleOverview
};

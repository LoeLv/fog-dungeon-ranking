const config = require("./config");

function normalizeError(error) {
  if (!error) return "请求失败";
  if (typeof error === "string") return error;
  if (error.message) return error.message;
  if (error.errMsg) return error.errMsg;
  return "请求失败";
}

function invokeDungeonAction(action, inviteCode, payload) {
  return new Promise(function(resolve, reject) {
    if (!inviteCode) {
      reject(new Error("请先输入入局邀请码"));
      return;
    }

    wx.request({
      url: config.DUNGEON_ACTION_URL,
      method: "POST",
      header: {
        "content-type": "application/json",
        "apikey": config.SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + config.SUPABASE_ANON_KEY
      },
      data: {
        action: action,
        inviteCode: inviteCode,
        payload: payload || {}
      },
      success: function(response) {
        const body = response.data || {};
        const statusCode = Number(response.statusCode || 0);
        if (statusCode >= 200 && statusCode < 300 && !body.error) {
          resolve(body);
          return;
        }
        reject(new Error(body.error || body.message || ("请求失败：" + statusCode)));
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

function listMatchDungeons(inviteCode, limit) {
  return invokeDungeonAction("listMatchDungeons", inviteCode, { limit: limit || 80 });
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

module.exports = {
  invokeDungeonAction: invokeDungeonAction,
  verifyInvite: verifyInvite,
  listMatchDungeons: listMatchDungeons,
  getMatchState: getMatchState,
  joinMatchQueue: joinMatchQueue,
  cancelMatchQueue: cancelMatchQueue
};

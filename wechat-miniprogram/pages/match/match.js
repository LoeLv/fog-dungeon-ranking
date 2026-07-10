const api = require("../../utils/api");
const sessionStore = require("../../utils/session");

const ROLE_LABELS = {
  player: "入局信徒",
  author: "试炼构筑者",
  reviewer: "结算审核员",
  admin: "神谕馆主"
};

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatDifficulty(value) {
  if (!value) return "未定难度";
  const map = {
    low: "低",
    medium: "中",
    high: "高",
    "低": "低",
    "中": "中",
    "高": "高"
  };
  return map[value] || String(value);
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return month + "-" + day + " " + hour + ":" + minute;
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeDungeon(dungeon) {
  const participantCount = toNumber(dungeon.participant_count || dungeon.participantCount, 1);
  return Object.assign({}, dungeon, {
    queuedCount: toNumber(dungeon.queuedCount, 0),
    runningRoomCount: toNumber(dungeon.runningRoomCount, 0),
    targetCount: Math.max(1, participantCount),
    typeLabel: dungeon.type || "未定神系",
    difficultyLabel: formatDifficulty(dungeon.difficulty)
  });
}

function normalizeState(rawState, currentName) {
  if (!rawState || !rawState.dungeon) return null;
  const myName = normalizeName(currentName);
  const dungeon = normalizeDungeon(rawState.dungeon);
  const queue = (rawState.queue || []).map(function(player) {
    const name = player.player_name || "未命名信徒";
    return Object.assign({}, player, {
      player_name: name,
      timeLabel: formatTime(player.created_at),
      isMe: normalizeName(name) === myName
    });
  });
  const rooms = (rawState.rooms || []).map(function(room) {
    const players = room.match_room_players || room.players || [];
    return Object.assign({}, room, {
      target_player_count: toNumber(room.target_player_count, players.length),
      players: players.map(function(player) {
        const name = player.player_name || "未命名信徒";
        return Object.assign({}, player, {
          player_name: name,
          isMe: normalizeName(name) === myName
        });
      })
    });
  });

  return {
    dungeon: dungeon,
    queue: queue,
    queuedCount: toNumber(rawState.queuedCount, queue.length),
    rooms: rooms
  };
}

Page({
  data: {
    sessionName: "",
    sessionRoleLabel: "",
    dungeons: [],
    selectedDungeonId: "",
    selectedState: null,
    currentQueued: false,
    currentInRoom: false,
    myStatus: "未加入",
    loading: true,
    refreshing: false,
    stateLoading: false,
    actionLoading: false,
    errorMessage: ""
  },

  onLoad: function() {
    const current = sessionStore.getSession();
    if (!current || !current.code) {
      wx.redirectTo({ url: "/pages/login/login" });
      return;
    }

    this.currentSession = current;
    this.setData({
      sessionName: current.name || "入局信徒",
      sessionRoleLabel: ROLE_LABELS[current.role] || current.role || "入局信徒"
    });
    this.loadDungeons();
  },

  onPullDownRefresh: function() {
    this.loadDungeons().finally(function() {
      wx.stopPullDownRefresh();
    });
  },

  loadDungeons: function() {
    if (!this.currentSession || !this.currentSession.code) {
      wx.redirectTo({ url: "/pages/login/login" });
      return Promise.resolve();
    }

    this.setData({ loading: !this.data.dungeons.length, refreshing: true, errorMessage: "" });
    return api.listMatchDungeons(this.currentSession.code, 80)
      .then(function(result) {
        const dungeons = (result.data || []).map(normalizeDungeon);
        const selectedDungeonId = this.data.selectedDungeonId && dungeons.some(function(item) {
          return item.id === this.data.selectedDungeonId;
        }.bind(this)) ? this.data.selectedDungeonId : (dungeons[0] ? dungeons[0].id : "");

        this.setData({
          dungeons: dungeons,
          selectedDungeonId: selectedDungeonId
        });

        if (selectedDungeonId) {
          return this.refreshState();
        }
        this.setData({ selectedState: null });
        return null;
      }.bind(this))
      .catch(function(error) {
        this.setData({ errorMessage: error.message || "试炼召集读取失败" });
      }.bind(this))
      .finally(function() {
        this.setData({ loading: false, refreshing: false });
      }.bind(this));
  },

  selectDungeon: function(event) {
    const dungeonId = event.currentTarget.dataset.id;
    if (!dungeonId || dungeonId === this.data.selectedDungeonId) return;
    this.setData({ selectedDungeonId: dungeonId });
    this.refreshState();
  },

  refreshState: function() {
    const dungeonId = this.data.selectedDungeonId;
    if (!dungeonId) return Promise.resolve();

    this.setData({ stateLoading: true });
    return api.getMatchState(this.currentSession.code, dungeonId)
      .then(function(result) {
        const state = normalizeState(result.data, this.currentSession.name);
        this.applyState(state);
      }.bind(this))
      .catch(function(error) {
        wx.showToast({ title: error.message || "状态刷新失败", icon: "none" });
      })
      .finally(function() {
        this.setData({ stateLoading: false });
      }.bind(this));
  },

  applyState: function(state) {
    const queued = !!(state && state.queue && state.queue.some(function(player) {
      return player.isMe;
    }));
    const inRoom = !!(state && state.rooms && state.rooms.some(function(room) {
      return room.players.some(function(player) {
        return player.isMe;
      });
    }));

    this.setData({
      selectedState: state,
      currentQueued: queued,
      currentInRoom: inRoom,
      myStatus: inRoom ? "已成房" : (queued ? "排队中" : "未加入")
    });
  },

  joinQueue: function() {
    const dungeonId = this.data.selectedDungeonId;
    if (!dungeonId || this.data.actionLoading) return;

    this.setData({ actionLoading: true });
    api.joinMatchQueue(this.currentSession.code, dungeonId)
      .then(function(result) {
        const state = normalizeState(result.data && result.data.state, this.currentSession.name);
        this.applyState(state);
        const status = result.data && result.data.result && result.data.result.status;
        wx.showToast({
          title: status === "matched" || status === "already_matched" ? "试炼已成房" : "已加入队列",
          icon: "none"
        });
        return this.loadDungeons();
      }.bind(this))
      .catch(function(error) {
        wx.showToast({ title: error.message || "加入失败", icon: "none" });
      })
      .finally(function() {
        this.setData({ actionLoading: false });
      }.bind(this));
  },

  cancelQueue: function() {
    const dungeonId = this.data.selectedDungeonId;
    if (!dungeonId || this.data.actionLoading) return;

    this.setData({ actionLoading: true });
    api.cancelMatchQueue(this.currentSession.code, dungeonId)
      .then(function(result) {
        const state = normalizeState(result.data && result.data.state, this.currentSession.name);
        this.applyState(state);
        wx.showToast({ title: "已取消排队", icon: "none" });
        return this.loadDungeons();
      }.bind(this))
      .catch(function(error) {
        wx.showToast({ title: error.message || "取消失败", icon: "none" });
      })
      .finally(function() {
        this.setData({ actionLoading: false });
      }.bind(this));
  },

  logout: function() {
    sessionStore.clearSession();
    wx.redirectTo({ url: "/pages/login/login" });
  }
});

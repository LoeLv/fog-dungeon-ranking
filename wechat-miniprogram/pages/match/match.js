const api = require("../../utils/api");
const sessionStore = require("../../utils/session");

const ROLE_LABELS = {
  player: "入局信徒",
  author: "试炼构筑者",
  reviewer: "结算审核员",
  admin: "神谕馆主"
};

const MUSTER_DURATION_SECONDS = 60;

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

function formatCountdown(seconds) {
  const value = Math.max(0, toNumber(seconds, 0));
  const minute = Math.floor(value / 60);
  const second = String(value % 60).padStart(2, "0");
  return minute + ":" + second;
}

function normalizeDungeon(dungeon) {
  const participantCount = toNumber(dungeon.participant_count || dungeon.participantCount, 1);
  return Object.assign({}, dungeon, {
    targetCount: Math.max(1, participantCount),
    typeLabel: dungeon.type || "未定神系",
    difficultyLabel: formatDifficulty(dungeon.difficulty),
    isOneShot: !!(dungeon.is_one_shot || dungeon.isOneShot)
  });
}

function normalizeParticipant(player) {
  return Object.assign({}, player, {
    player_name: player.player_name || "未命名信徒",
    timeLabel: formatTime(player.joined_at || player.selected_at),
    statusLabel: player.status === "selected"
      ? "入选"
      : player.status === "not_selected"
        ? "未入选"
        : player.status === "cancelled"
          ? "已取消"
          : "报名中"
  });
}

function normalizeMusterState(rawState) {
  if (!rawState || !rawState.muster || !rawState.dungeon) return null;
  const participants = (rawState.participants || []).map(normalizeParticipant);
  const joinedParticipants = participants.filter(function(player) {
    return player.status === "joined";
  });
  const selectedPlayers = participants.filter(function(player) {
    return player.status === "selected";
  });
  const notSelectedPlayers = participants.filter(function(player) {
    return player.status === "not_selected";
  });
  const roomPlayers = rawState.room && rawState.room.players ? rawState.room.players.map(normalizeParticipant) : [];
  const dungeon = normalizeDungeon(rawState.dungeon);
  const secondsRemaining = Math.max(0, toNumber(rawState.secondsRemaining, 0));

  return {
    muster: rawState.muster,
    dungeon: dungeon,
    participants: participants,
    joinedParticipants: joinedParticipants,
    selectedPlayers: selectedPlayers,
    notSelectedPlayers: notSelectedPlayers,
    room: rawState.room || null,
    roomPlayers: roomPlayers,
    joinedCount: toNumber(rawState.joinedCount, joinedParticipants.length),
    selectedCount: toNumber(rawState.selectedCount, selectedPlayers.length),
    myStatus: rawState.myStatus || "none",
    isCreator: !!rawState.isCreator,
    secondsRemaining: secondsRemaining,
    countdownText: formatCountdown(secondsRemaining)
  };
}

Page({
  data: {
    sessionName: "",
    sessionRoleLabel: "",
    dungeons: [],
    selectedDungeonId: "",
    selectedDungeon: null,
    activeMusterId: "",
    activeMuster: null,
    activeDungeon: null,
    participants: [],
    joinedParticipants: [],
    selectedPlayers: [],
    notSelectedPlayers: [],
    roomPlayers: [],
    joinedCount: 0,
    selectedCount: 0,
    secondsRemaining: 0,
    countdownText: "1:00",
    myStatus: "none",
    isCreator: false,
    myStatusLabel: "未报名",
    musterStatusLabel: "未发起",
    canJoin: false,
    canCancel: false,
    canShare: false,
    canDraw: false,
    loading: true,
    refreshing: false,
    stateLoading: false,
    actionLoading: false,
    errorMessage: ""
  },

  onLoad: function(options) {
    const current = sessionStore.getSession();
    const sharedMusterId = options && options.musterId ? String(options.musterId) : "";
    if (!current || !current.code) {
      wx.redirectTo({ url: sharedMusterId ? "/pages/login/login?musterId=" + sharedMusterId : "/pages/login/login" });
      return;
    }

    this.currentSession = current;
    this.drawInFlight = false;
    this.setData({
      sessionName: current.name || "入局信徒",
      sessionRoleLabel: ROLE_LABELS[current.role] || current.role || "入局信徒",
      activeMusterId: sharedMusterId
    });

    if (wx.showShareMenu) {
      wx.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage"] });
    }

    if (sharedMusterId) {
      this.loadMuster(sharedMusterId);
    } else {
      this.loadDungeons();
    }
  },

  onUnload: function() {
    this.stopTimer();
  },

  onPullDownRefresh: function() {
    this.refreshCurrent().finally(function() {
      wx.stopPullDownRefresh();
    });
  },

  onShareAppMessage: function() {
    if (!this.data.activeMusterId || !this.data.activeDungeon) {
      return {
        title: "来发起一场诸神愚戏试炼召集",
        path: "/pages/match/match"
      };
    }
    return {
      title: "来报名：" + this.data.activeDungeon.name,
      path: "/pages/match/match?musterId=" + this.data.activeMusterId
    };
  },

  refreshCurrent: function() {
    if (this.data.activeMusterId) return this.loadMuster(this.data.activeMusterId);
    return this.loadDungeons();
  },

  loadDungeons: function() {
    if (!this.currentSession || !this.currentSession.code) {
      wx.redirectTo({ url: "/pages/login/login" });
      return Promise.resolve();
    }

    this.stopTimer();
    this.setData({ loading: !this.data.dungeons.length, refreshing: true, errorMessage: "" });
    return api.listMatchDungeons(this.currentSession.code, 80)
      .then(function(result) {
        const dungeons = (result.data || []).map(normalizeDungeon);
        const selectedDungeonId = this.data.selectedDungeonId && dungeons.some(function(item) {
          return item.id === this.data.selectedDungeonId;
        }.bind(this)) ? this.data.selectedDungeonId : (dungeons[0] ? dungeons[0].id : "");
        const selectedDungeon = dungeons.find(function(item) {
          return item.id === selectedDungeonId;
        }) || null;

        this.setData({
          dungeons: dungeons,
          selectedDungeonId: selectedDungeonId,
          selectedDungeon: selectedDungeon,
          activeMusterId: "",
          activeMuster: null,
          activeDungeon: null,
          participants: [],
          joinedParticipants: [],
          selectedPlayers: [],
          notSelectedPlayers: [],
          roomPlayers: [],
          joinedCount: 0,
          selectedCount: 0,
          myStatus: "none",
          isCreator: false,
          myStatusLabel: "未报名",
          musterStatusLabel: "未发起",
          canJoin: false,
          canCancel: false,
          canShare: false,
          canDraw: false
        });
      }.bind(this))
      .catch(function(error) {
        this.setData({ errorMessage: error.message || "试炼列表读取失败" });
      }.bind(this))
      .finally(function() {
        this.setData({ loading: false, refreshing: false });
      }.bind(this));
  },

  loadMuster: function(musterId) {
    if (!musterId) return Promise.resolve();
    this.setData({ loading: !this.data.activeMuster, stateLoading: true, errorMessage: "" });
    return api.getMatchMuster(this.currentSession.code, musterId)
      .then(function(result) {
        this.applyMusterState(normalizeMusterState(result.data));
      }.bind(this))
      .catch(function(error) {
        this.setData({ errorMessage: error.message || "召集读取失败" });
      }.bind(this))
      .finally(function() {
        this.setData({ loading: false, stateLoading: false });
      }.bind(this));
  },

  applyMusterState: function(state) {
    if (!state) return;
    const status = state.muster.status || "open";
    const myStatus = state.myStatus || "none";
    const isCreator = !!state.isCreator;
    const isOpen = status === "open" && state.secondsRemaining > 0;
    const myStatusLabel = isCreator
      ? "发起者"
      : myStatus === "joined"
      ? "已报名"
      : myStatus === "selected"
        ? "已入选"
        : myStatus === "not_selected"
          ? "未入选"
          : myStatus === "cancelled"
            ? "已取消"
            : "未报名";
    const musterStatusLabel = status === "drawn"
      ? "已抽选"
      : status === "cancelled"
        ? "已取消"
        : isOpen
          ? "报名中"
          : "待抽选";

    this.setData({
      activeMusterId: state.muster.id,
      activeMuster: state.muster,
      activeDungeon: state.dungeon,
      participants: state.participants,
      joinedParticipants: state.joinedParticipants,
      selectedPlayers: state.selectedPlayers,
      notSelectedPlayers: state.notSelectedPlayers,
      roomPlayers: state.roomPlayers,
      joinedCount: state.joinedCount,
      selectedCount: state.selectedCount,
      secondsRemaining: state.secondsRemaining,
      countdownText: state.countdownText,
      myStatus: myStatus,
      isCreator: isCreator,
      myStatusLabel: myStatusLabel,
      musterStatusLabel: musterStatusLabel,
      canJoin: isOpen && !isCreator && myStatus !== "joined",
      canCancel: isOpen && myStatus === "joined",
      canShare: status === "open",
      canDraw: status === "open" && state.secondsRemaining <= 0,
      errorMessage: ""
    });

    this.startTimer();
  },

  selectDungeon: function(event) {
    const dungeonId = event.currentTarget.dataset.id;
    if (!dungeonId) return;
    const selectedDungeon = this.data.dungeons.find(function(item) {
      return item.id === dungeonId;
    }) || null;
    this.setData({ selectedDungeonId: dungeonId, selectedDungeon: selectedDungeon });
  },

  startMuster: function() {
    const dungeonId = this.data.selectedDungeonId;
    if (!dungeonId || this.data.actionLoading) return;

    this.setData({ actionLoading: true });
    api.startMatchMuster(this.currentSession.code, dungeonId, MUSTER_DURATION_SECONDS)
      .then(function(result) {
        const state = normalizeMusterState(result.data && result.data.state);
        this.applyMusterState(state);
        wx.showToast({ title: "召集已发起，点分享发到群", icon: "none" });
      }.bind(this))
      .catch(function(error) {
        wx.showToast({ title: error.message || "发起失败", icon: "none" });
      })
      .finally(function() {
        this.setData({ actionLoading: false });
      }.bind(this));
  },

  joinMuster: function() {
    const musterId = this.data.activeMusterId;
    if (!musterId || this.data.actionLoading) return;

    this.setData({ actionLoading: true });
    api.joinMatchMuster(this.currentSession.code, musterId)
      .then(function(result) {
        this.applyMusterState(normalizeMusterState(result.data && result.data.state));
        wx.showToast({ title: "已参与本场召集", icon: "none" });
      }.bind(this))
      .catch(function(error) {
        wx.showToast({ title: error.message || "报名失败", icon: "none" });
      })
      .finally(function() {
        this.setData({ actionLoading: false });
      }.bind(this));
  },

  cancelMuster: function() {
    const musterId = this.data.activeMusterId;
    if (!musterId || this.data.actionLoading) return;

    this.setData({ actionLoading: true });
    api.cancelMatchMuster(this.currentSession.code, musterId)
      .then(function(result) {
        this.applyMusterState(normalizeMusterState(result.data && result.data.state));
        wx.showToast({ title: "已取消本场报名", icon: "none" });
      }.bind(this))
      .catch(function(error) {
        wx.showToast({ title: error.message || "取消失败", icon: "none" });
      })
      .finally(function() {
        this.setData({ actionLoading: false });
      }.bind(this));
  },

  drawMuster: function() {
    const musterId = this.data.activeMusterId;
    if (!musterId || this.drawInFlight || !this.data.activeMuster || this.data.activeMuster.status !== "open") return Promise.resolve();

    this.drawInFlight = true;
    this.setData({ actionLoading: true });
    return api.drawMatchMuster(this.currentSession.code, musterId)
      .then(function(result) {
        this.applyMusterState(normalizeMusterState(result.data && result.data.state));
        wx.showToast({ title: "抽选完成", icon: "none" });
      }.bind(this))
      .catch(function(error) {
        if (String(error.message || "").indexOf("尚未截止") === -1) {
          wx.showToast({ title: error.message || "抽选失败", icon: "none" });
        }
      })
      .finally(function() {
        this.drawInFlight = false;
        this.setData({ actionLoading: false });
      }.bind(this));
  },

  startTimer: function() {
    this.stopTimer();
    if (!this.data.activeMuster || this.data.activeMuster.status !== "open") return;
    this.timer = setInterval(function() {
      const closesAt = new Date(String(this.data.activeMuster.closes_at || "")).getTime();
      const seconds = Math.max(0, Math.ceil((closesAt - Date.now()) / 1000));
      this.setData({
        secondsRemaining: seconds,
        countdownText: formatCountdown(seconds),
        canDraw: this.data.activeMuster.status === "open" && seconds <= 0
      });
      if (seconds <= 0) {
        this.stopTimer();
        this.drawMuster();
      }
    }.bind(this), 1000);
  },

  stopTimer: function() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  backToCreate: function() {
    this.stopTimer();
    this.loadDungeons();
  },

  logout: function() {
    this.stopTimer();
    sessionStore.clearSession();
    wx.redirectTo({ url: "/pages/login/login" });
  }
});

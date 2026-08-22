const api = require("../../utils/api");
const sessionStore = require("../../utils/session");

const ACTION_STATUS_LABELS = {
  submitted: "待 DM 结算",
  resolved: "已结算",
  dismissed: "已驳回"
};

const ACTION_TYPE_LABELS = {
  damage: "伤害",
  heal: "治疗",
  shield: "护盾",
  set_hp: "设定生命",
  revive: "复苏",
  defeat: "击倒",
  note: "备注",
  round: "回合",
  finish: "结束",
  cancel: "取消",
  create: "创建"
};

function cleanText(value) {
  return String(value || "").trim();
}

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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

function normalizeRoomStatus(value) {
  if (value === "finished") return "已结束";
  if (value === "cancelled") return "已取消";
  return "进行中";
}

function normalizePlayer(player, currentRound) {
  const maxHp = Math.max(1, toNumber(player.max_hp, 1));
  const currentHp = Math.max(0, toNumber(player.current_hp, 0));
  const percent = Math.max(0, Math.min(100, Math.round((currentHp / maxHp) * 100)));
  const abilities = Array.isArray(player.abilities) ? player.abilities.map(function(ability) {
    const availableRound = Math.max(1, toNumber(ability.availableRound, 1));
    const ready = availableRound <= currentRound;
    const rank = cleanText(ability.rank);
    return Object.assign({}, ability, {
      displayName: (rank ? rank + " · " : "") + (cleanText(ability.name) || "未命名能力"),
      detail: cleanText(ability.effect) || "由 DM 判断具体效果",
      cooldownLabel: ready ? "可用" : "第 " + availableRound + " 回合可用",
      ready: ready
    });
  }) : [];

  return Object.assign({}, player, {
    hpText: currentHp + "/" + maxHp,
    hpPercent: percent,
    shieldText: Math.max(0, toNumber(player.shield, 0)),
    teamLabel: cleanText(player.team_name) || "未分队",
    teamInputValue: cleanText(player.team_name),
    classLabel: cleanText(player.class_name) || cleanText(player.profession) || "未定职业",
    faithLabel: cleanText(player.faith_god) || "未定信仰",
    statusLabel: player.is_defeated ? "倒地" : "行动中",
    publicNote: cleanText(player.note),
    abilities: abilities
  });
}

function normalizeAction(action) {
  return Object.assign({}, action, {
    statusLabel: ACTION_STATUS_LABELS[action.action_status] || "未知",
    timeLabel: formatTime(action.created_at),
    resolvedLabel: action.resolved_at ? formatTime(action.resolved_at) : "",
    roundLabel: "第 " + (action.round_no || "?") + " 回合",
    hasDmNote: !!cleanText(action.dm_note),
    cooldownLabel: action.cooldown_until_round ? "冷却至第 " + action.cooldown_until_round + " 回合" : ""
  });
}

function normalizeLog(log) {
  const amount = log.amount === null || log.amount === undefined ? "" : String(log.amount);
  const target = cleanText(log.target_player_name);
  return Object.assign({}, log, {
    typeLabel: ACTION_TYPE_LABELS[log.action_type] || log.action_type || "记录",
    timeLabel: formatTime(log.created_at),
    amountLabel: amount ? " · " + amount : "",
    targetLabel: target ? " · " + target : "",
    roundLabel: "R" + (log.round_no || "?")
  });
}

function normalizeBattleState(raw) {
  if (!raw || !raw.room) return null;
  const room = raw.room || {};
  const currentRound = Math.max(1, toNumber(room.current_round, 1));
  const players = (raw.players || []).map(function(player) {
    return normalizePlayer(player, currentRound);
  });
  const selfPlayer = players.find(function(player) {
    return !!player.is_self;
  }) || null;
  const actions = (raw.actions || []).map(normalizeAction);
  const selfActions = selfPlayer
    ? actions.filter(function(action) {
      return String(action.battle_room_player_id) === String(selfPlayer.id);
    })
    : [];
  const pendingActions = actions.filter(function(action) {
    return action.action_status === "submitted";
  });
  const canOperate = !!raw.canOperate;
  const visibleActions = canOperate ? pendingActions : selfActions;

  return {
    room: Object.assign({}, room, {
      statusLabel: normalizeRoomStatus(room.room_status),
      roundLabel: "第 " + currentRound + " 回合"
    }),
    dungeon: raw.dungeon || {},
    players: players,
    logs: (raw.logs || []).map(normalizeLog),
    actions: actions,
    selfActions: selfActions,
    pendingActions: pendingActions,
    visibleActions: visibleActions,
    visibleActionCountText: canOperate ? pendingActions.length + " 待处理" : selfActions.length + " 条",
    actionListLabel: canOperate ? "行动结算" : "我的行动记录",
    selfPlayer: selfPlayer,
    isHost: !!raw.isHost,
    isParticipant: !!raw.isParticipant,
    canOperate: canOperate,
    canSubmitAction: !!raw.canSubmitAction,
    canJoin: !raw.isParticipant && room.room_status === "active"
  };
}

Page({
  data: {
    battleRoomId: "",
    matchRoomId: "",
    room: null,
    dungeon: null,
    players: [],
    logs: [],
    actions: [],
    selfActions: [],
    pendingActions: [],
    visibleActions: [],
    visibleActionCountText: "0 条",
    actionListLabel: "我的行动记录",
    selfPlayer: null,
    canOperate: false,
    canSubmitAction: false,
    canJoin: false,
    dmActionTypeLabels: ["伤害", "治疗", "护盾", "设定生命", "复苏", "击倒", "备注"],
    dmActionTypes: ["damage", "heal", "shield", "set_hp", "revive", "defeat", "note"],
    dmActionTypeLabel: "伤害",
    selectedAbilityKey: "",
    selectedAbilityName: "普通行动",
    actionText: "",
    dmTargetPlayerId: "",
    dmActionType: "damage",
    dmAmount: "",
    dmNote: "",
    roundInput: "",
    roundNote: "",
    teamInputs: {},
    loading: true,
    refreshing: false,
    actionLoading: false,
    errorMessage: ""
  },

  onLoad: function(options) {
    const current = sessionStore.getSession();
    if (!current || !current.code) {
      wx.redirectTo({ url: "/pages/login/login" });
      return;
    }

    const battleRoomId = cleanText(options && options.battleRoomId);
    const matchRoomId = cleanText(options && options.matchRoomId);
    if (!battleRoomId && !matchRoomId) {
      wx.showToast({ title: "缺少战斗房间", icon: "none" });
      wx.navigateBack();
      return;
    }

    this.currentSession = current;
    this.setData({ battleRoomId: battleRoomId, matchRoomId: matchRoomId });
    this.loadBattle();
  },

  onPullDownRefresh: function() {
    this.loadBattle().finally(function() {
      wx.stopPullDownRefresh();
    });
  },

  handleRequestError: function(error, fallbackMessage) {
    if (error && error.code === "session_invalid") {
      wx.showToast({ title: "登录已失效，请重新验证", icon: "none" });
      wx.redirectTo({ url: "/pages/login/login" });
      return true;
    }
    this.setData({ errorMessage: (error && error.message) || fallbackMessage });
    return false;
  },

  applyBattleState: function(state) {
    if (!state) {
      this.setData({ loading: false, errorMessage: "暂无战斗房间" });
      return;
    }
    const teamInputs = {};
    state.players.forEach(function(player) {
      teamInputs[player.id] = player.teamLabel === "未分队" ? "" : player.teamLabel;
    });
    this.setData({
      battleRoomId: state.room.id,
      room: state.room,
      dungeon: state.dungeon,
      players: state.players,
      logs: state.logs,
      actions: state.actions,
      selfActions: state.selfActions,
      pendingActions: state.pendingActions,
      visibleActions: state.visibleActions,
      visibleActionCountText: state.visibleActionCountText,
      actionListLabel: state.actionListLabel,
      selfPlayer: state.selfPlayer,
      canOperate: state.canOperate,
      canSubmitAction: state.canSubmitAction,
      canJoin: state.canJoin,
      dmTargetPlayerId: this.data.dmTargetPlayerId || (state.players[0] && String(state.players[0].id)) || "",
      roundInput: String(state.room.current_round || 1),
      teamInputs: teamInputs,
      loading: false,
      refreshing: false,
      errorMessage: ""
    });
  },

  loadBattle: function() {
    if (!this.currentSession || (!this.data.battleRoomId && !this.data.matchRoomId)) return Promise.resolve();
    this.setData({ refreshing: true, errorMessage: "" });
    return api.getBattleRoom(this.currentSession.code, {
      battleRoomId: this.data.battleRoomId,
      matchRoomId: this.data.matchRoomId
    })
      .then(function(result) {
        this.applyBattleState(normalizeBattleState(result.data));
      }.bind(this))
      .catch(function(error) {
        this.handleRequestError(error, "战斗房间读取失败");
        this.setData({ loading: false, refreshing: false });
      }.bind(this));
  },

  joinBattle: function() {
    if (!this.data.battleRoomId || this.data.actionLoading) return;
    this.setData({ actionLoading: true, errorMessage: "" });
    api.joinBattleRoom(this.currentSession.code, this.data.battleRoomId)
      .then(function(result) {
        this.applyBattleState(normalizeBattleState(result.data));
        wx.showToast({ title: "已进入战场", icon: "none" });
      }.bind(this))
      .catch(function(error) {
        if (this.handleRequestError(error, "加入战场失败")) return;
        wx.showToast({ title: error.message || "加入战场失败", icon: "none" });
      }.bind(this))
      .finally(function() {
        this.setData({ actionLoading: false });
      }.bind(this));
  },

  selectAbility: function(event) {
    const key = cleanText(event.currentTarget.dataset.key);
    const name = cleanText(event.currentTarget.dataset.name) || "普通行动";
    if (event.currentTarget.dataset.ready === "0") {
      wx.showToast({ title: "这个能力还在冷却", icon: "none" });
      return;
    }
    this.setData({ selectedAbilityKey: key, selectedAbilityName: name });
  },

  clearAbility: function() {
    this.setData({ selectedAbilityKey: "", selectedAbilityName: "普通行动" });
  },

  onActionTextInput: function(event) {
    this.setData({ actionText: event.detail.value || "" });
  },

  submitAction: function() {
    if (!this.data.selfPlayer || !this.data.canSubmitAction || this.data.actionLoading) return;
    const actionText = cleanText(this.data.actionText);
    if (!actionText) {
      wx.showToast({ title: "请先填写本回合行动", icon: "none" });
      return;
    }

    this.setData({ actionLoading: true, errorMessage: "" });
    api.submitBattleRoomAction(
      this.currentSession.code,
      this.data.battleRoomId,
      this.data.selfPlayer.id,
      actionText,
      this.data.selectedAbilityKey
    )
      .then(function(result) {
        this.setData({ actionText: "", selectedAbilityKey: "", selectedAbilityName: "普通行动" });
        this.applyBattleState(normalizeBattleState(result.data));
        wx.showToast({ title: "行动已提交", icon: "none" });
      }.bind(this))
      .catch(function(error) {
        if (this.handleRequestError(error, "行动提交失败")) return;
        wx.showToast({ title: error.message || "行动提交失败", icon: "none" });
      }.bind(this))
      .finally(function() {
        this.setData({ actionLoading: false });
      }.bind(this));
  },

  onDmTargetChange: function(event) {
    const player = this.data.players[Number(event.detail.value || 0)] || null;
    this.setData({ dmTargetPlayerId: player ? String(player.id) : "" });
  },

  onDmActionTypeChange: function(event) {
    const index = Number(event.detail.value || 0);
    const types = this.data.dmActionTypes;
    const labels = this.data.dmActionTypeLabels;
    this.setData({
      dmActionType: types[index] || "damage",
      dmActionTypeLabel: labels[index] || "伤害"
    });
  },

  onDmAmountInput: function(event) {
    this.setData({ dmAmount: event.detail.value || "" });
  },

  onDmNoteInput: function(event) {
    this.setData({ dmNote: event.detail.value || "" });
  },

  applyDmAction: function() {
    if (!this.data.canOperate || !this.data.dmTargetPlayerId || this.data.actionLoading) return;
    this.setData({ actionLoading: true, errorMessage: "" });
    api.applyBattlePlayerAction(
      this.currentSession.code,
      this.data.battleRoomId,
      this.data.dmTargetPlayerId,
      this.data.dmActionType,
      this.data.dmAmount || 0,
      this.data.dmNote
    )
      .then(function(result) {
        this.setData({ dmAmount: "", dmNote: "" });
        this.applyBattleState(normalizeBattleState(result.data));
      }.bind(this))
      .catch(function(error) {
        if (this.handleRequestError(error, "DM 操作失败")) return;
        wx.showToast({ title: error.message || "DM 操作失败", icon: "none" });
      }.bind(this))
      .finally(function() {
        this.setData({ actionLoading: false });
      }.bind(this));
  },

  resolveAction: function(event) {
    const actionId = event.currentTarget.dataset.id;
    const decision = event.currentTarget.dataset.decision || "resolved";
    if (!actionId || !this.data.canOperate || this.data.actionLoading) return;

    this.setData({ actionLoading: true, errorMessage: "" });
    api.resolveBattleRoomAction(this.currentSession.code, this.data.battleRoomId, actionId, decision, "")
      .then(function(result) {
        this.applyBattleState(normalizeBattleState(result.data));
      }.bind(this))
      .catch(function(error) {
        if (this.handleRequestError(error, "行动处理失败")) return;
        wx.showToast({ title: error.message || "行动处理失败", icon: "none" });
      }.bind(this))
      .finally(function() {
        this.setData({ actionLoading: false });
      }.bind(this));
  },

  onRoundInput: function(event) {
    this.setData({ roundInput: event.detail.value || "" });
  },

  onRoundNoteInput: function(event) {
    this.setData({ roundNote: event.detail.value || "" });
  },

  updateRound: function() {
    if (!this.data.canOperate || this.data.actionLoading) return;
    this.setData({ actionLoading: true, errorMessage: "" });
    api.updateBattleRoomRound(this.currentSession.code, this.data.battleRoomId, this.data.roundInput, this.data.roundNote)
      .then(function(result) {
        this.setData({ roundNote: "" });
        this.applyBattleState(normalizeBattleState(result.data));
      }.bind(this))
      .catch(function(error) {
        if (this.handleRequestError(error, "回合推进失败")) return;
        wx.showToast({ title: error.message || "回合推进失败", icon: "none" });
      }.bind(this))
      .finally(function() {
        this.setData({ actionLoading: false });
      }.bind(this));
  },

  onTeamInput: function(event) {
    const playerId = event.currentTarget.dataset.id;
    const teamInputs = Object.assign({}, this.data.teamInputs);
    teamInputs[playerId] = event.detail.value || "";
    this.setData({ teamInputs: teamInputs });
  },

  updateTeam: function(event) {
    const playerId = event.currentTarget.dataset.id;
    if (!this.data.canOperate || !playerId || this.data.actionLoading) return;
    const teamName = cleanText(this.data.teamInputs[playerId]) || "A";
    this.setData({ actionLoading: true, errorMessage: "" });
    api.updateBattlePlayerTeam(this.currentSession.code, this.data.battleRoomId, playerId, teamName)
      .then(function(result) {
        this.applyBattleState(normalizeBattleState(result.data));
      }.bind(this))
      .catch(function(error) {
        if (this.handleRequestError(error, "分队失败")) return;
        wx.showToast({ title: error.message || "分队失败", icon: "none" });
      }.bind(this))
      .finally(function() {
        this.setData({ actionLoading: false });
      }.bind(this));
  },

  putAbilityOnCooldown: function(event) {
    const playerId = event.currentTarget.dataset.playerId;
    const abilityKey = event.currentTarget.dataset.key;
    if (!this.data.canOperate || !playerId || !abilityKey || this.data.actionLoading) return;
    this.setData({ actionLoading: true, errorMessage: "" });
    api.updateBattleAbilityCooldown(this.currentSession.code, this.data.battleRoomId, playerId, abilityKey)
      .then(function(result) {
        this.applyBattleState(normalizeBattleState(result.data));
      }.bind(this))
      .catch(function(error) {
        if (this.handleRequestError(error, "冷却调整失败")) return;
        wx.showToast({ title: error.message || "冷却调整失败", icon: "none" });
      }.bind(this))
      .finally(function() {
        this.setData({ actionLoading: false });
      }.bind(this));
  },

  finishBattle: function(event) {
    const status = event.currentTarget.dataset.status || "finished";
    if (!this.data.canOperate || this.data.actionLoading) return;
    this.setData({ actionLoading: true, errorMessage: "" });
    api.finishBattleRoom(this.currentSession.code, this.data.battleRoomId, status, this.data.roundNote)
      .then(function(result) {
        this.applyBattleState(normalizeBattleState(result.data));
      }.bind(this))
      .catch(function(error) {
        if (this.handleRequestError(error, "结束战斗失败")) return;
        wx.showToast({ title: error.message || "结束战斗失败", icon: "none" });
      }.bind(this))
      .finally(function() {
        this.setData({ actionLoading: false });
      }.bind(this));
  }
});

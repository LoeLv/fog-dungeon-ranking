const api = require("../../utils/api");
const sessionStore = require("../../utils/session");

const MUSTER_DURATION_SECONDS = 120;

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanText(value) {
  return String(value || "").trim();
}

function cleanRouteText(value) {
  let text = cleanText(value);
  for (let i = 0; i < 2 && /%[0-9a-fA-F]{2}/.test(text); i += 1) {
    try {
      text = decodeURIComponent(text);
    } catch (error) {
      break;
    }
  }
  return cleanText(text);
}

Page({
  data: {
    dungeon: null,
    targetPlayerCountInput: "",
    playerKeyword: "",
    playerResults: [],
    requiredPlayers: [],
    searchingPlayers: false,
    actionLoading: false,
    errorMessage: ""
  },

  onLoad: function(options) {
    const current = sessionStore.getSession();
    if (!current || !current.code) {
      wx.redirectTo({ url: "/pages/login/login" });
      return;
    }

    const dungeonId = cleanText(options && options.dungeonId);
    if (!dungeonId) {
      wx.showToast({ title: "副本信息缺失", icon: "none" });
      wx.navigateBack();
      return;
    }

    this.currentSession = current;
    this.setData({
      dungeon: {
        id: dungeonId,
        name: cleanRouteText(options.name) || "未命名试炼",
        creator: cleanRouteText(options.creator),
        typeLabel: cleanRouteText(options.type) || "未定神系",
        difficultyLabel: cleanRouteText(options.difficulty) || "未定难度",
        targetCount: Math.max(1, toNumber(options.targetCount, 1)),
        isOneShot: cleanText(options.isOneShot) === "1"
      }
    });
  },

  onTargetInput: function(event) {
    this.setData({ targetPlayerCountInput: event.detail.value || "" });
  },

  onPlayerKeywordInput: function(event) {
    this.setData({ playerKeyword: event.detail.value || "" });
  },

  searchPlayers: function() {
    const keyword = cleanText(this.data.playerKeyword);
    if (!keyword) {
      wx.showToast({ title: "请输入信徒昵称", icon: "none" });
      return Promise.resolve();
    }

    this.setData({ searchingPlayers: true, errorMessage: "" });
    return api.searchMusterPlayers(this.currentSession.code, keyword, 20)
      .then(function(result) {
        const players = (result.data || []).map(function(player) {
          return Object.assign({}, player, {
            faithLabel: player.faith_god || "未保存信仰",
            professionLabel: player.profession || "未保存职业"
          });
        });
        this.setData({ playerResults: players });
      }.bind(this))
      .catch(function(error) {
        this.setData({ errorMessage: error.message || "信徒搜索失败" });
      }.bind(this))
      .finally(function() {
        this.setData({ searchingPlayers: false });
      }.bind(this));
  },

  addRequiredPlayer: function(event) {
    const name = cleanText(event.currentTarget.dataset.name);
    if (!name) return;
    const exists = this.data.requiredPlayers.some(function(player) {
      return player.display_name === name;
    });
    if (exists) {
      wx.showToast({ title: "已经标记过了", icon: "none" });
      return;
    }
    const player = this.data.playerResults.find(function(item) {
      return item.display_name === name;
    }) || { display_name: name };
    this.setData({
      requiredPlayers: this.data.requiredPlayers.concat([player])
    });
  },

  removeRequiredPlayer: function(event) {
    const name = cleanText(event.currentTarget.dataset.name);
    this.setData({
      requiredPlayers: this.data.requiredPlayers.filter(function(player) {
        return player.display_name !== name;
      })
    });
  },

  startMuster: function() {
    if (!this.data.dungeon || this.data.actionLoading) return;

    const defaultCount = Math.max(1, toNumber(this.data.dungeon.targetCount, 1));
    const input = cleanText(this.data.targetPlayerCountInput);
    const targetPlayerCount = input ? Math.max(1, Math.min(Math.floor(Number(input) || defaultCount), 99)) : defaultCount;
    const requiredPlayerNames = this.data.requiredPlayers.map(function(player) {
      return player.display_name;
    }).filter(Boolean);

    if (requiredPlayerNames.length > targetPlayerCount) {
      wx.showToast({ title: "指定人数不能超过房间人数", icon: "none" });
      return;
    }

    this.setData({ actionLoading: true, errorMessage: "" });
    api.startMatchMuster(this.currentSession.code, this.data.dungeon.id, MUSTER_DURATION_SECONDS, {
      targetPlayerCount: targetPlayerCount,
      requiredPlayerNames: requiredPlayerNames
    })
      .then(function(result) {
        const state = result.data && result.data.state;
        const musterId = state && state.muster && state.muster.id;
        if (!musterId) throw new Error("房间创建失败");
        wx.redirectTo({ url: "/pages/match/match?musterId=" + musterId });
      })
      .catch(function(error) {
        this.setData({ errorMessage: error.message || "开始匹配失败" });
      }.bind(this))
      .finally(function() {
        this.setData({ actionLoading: false });
      }.bind(this));
  }
});

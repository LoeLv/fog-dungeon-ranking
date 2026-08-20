const api = require("../../utils/api");
const sessionStore = require("../../utils/session");

const ROLE_LABELS = {
  player: "入局信徒",
  author: "试炼构筑者",
  reviewer: "结算审核员",
  admin: "神谕馆主"
};

function text(value, fallback) {
  const result = String(value || "").trim();
  return result || fallback || "";
}

function formatHonor(item) {
  if (!item) return "";
  if (typeof item === "string") return item;
  return text(item.title_text || item.curse_text || item.title || item.curse || item.name, "");
}

function normalizeProfile(profile, session) {
  const raw = profile || {};
  const titles = (raw.active_titles || []).map(formatHonor).filter(Boolean);
  const curses = (raw.active_curses || []).map(formatHonor).filter(Boolean);
  return {
    displayName: text(raw.display_name, session.name || "入局信徒"),
    roleLabel: ROLE_LABELS[raw.role] || ROLE_LABELS[session.role] || "入局信徒",
    faithGod: text(raw.faith_god, "未记录"),
    faithPath: text(raw.faith_path, "未记录"),
    profession: text(raw.profession, "未记录"),
    ascensionScore: Number(raw.ascension_score || 0),
    audienceScore: Number(raw.audience_score || 0),
    items: text(raw.items, "暂无记录"),
    talents: text(raw.talents, "暂无记录"),
    titles: titles,
    curses: curses,
    updatedAt: text(raw.updated_at, ""),
    hasProfile: !!profile
  };
}

Page({
  data: {
    loading: true,
    refreshing: false,
    errorMessage: "",
    profile: null
  },

  onLoad: function() {
    const current = sessionStore.getSession();
    if (!current || !current.code) {
      wx.redirectTo({ url: "/pages/login/login" });
      return;
    }
    this.currentSession = current;
    this.loadProfile();
  },

  onPullDownRefresh: function() {
    this.loadProfile().finally(function() {
      wx.stopPullDownRefresh();
    });
  },

  loadProfile: function() {
    if (!this.currentSession || !this.currentSession.code) return Promise.resolve();
    this.setData({
      loading: !this.data.profile,
      refreshing: true,
      errorMessage: ""
    });
    return api.getMyProfile(this.currentSession.code)
      .then(function(result) {
        this.setData({
          profile: normalizeProfile(result.data, this.currentSession)
        });
      }.bind(this))
      .catch(function(error) {
        if (error && error.code === "session_invalid") {
          sessionStore.clearSession();
          wx.showToast({ title: "登录已失效，请重新验证", icon: "none" });
          wx.redirectTo({ url: "/pages/login/login" });
          return;
        }
        this.setData({ errorMessage: error.message || "个人档案读取失败" });
      }.bind(this))
      .finally(function() {
        this.setData({ loading: false, refreshing: false });
      }.bind(this));
  },

  backToMatch: function() {
    wx.navigateBack({
      fail: function() {
        wx.redirectTo({ url: "/pages/match/match" });
      }
    });
  },

  logout: function() {
    sessionStore.clearSession();
    wx.redirectTo({ url: "/pages/login/login" });
  }
});

const api = require("../../utils/api");
const session = require("../../utils/session");

Page({
  data: {
    inviteCode: "",
    loading: false
  },

  onLoad: function(options) {
    this.pendingMusterId = options && options.musterId ? String(options.musterId) : "";
    const current = session.getSession();
    if (current && current.code && current.role) {
      wx.redirectTo({ url: this.pendingMusterId ? "/pages/match/match?musterId=" + this.pendingMusterId : "/pages/match/match" });
    }
  },

  onCodeInput: function(event) {
    this.setData({ inviteCode: event.detail.value || "" });
  },

  submitInvite: function() {
    const code = String(this.data.inviteCode || "").trim();
    if (!code) {
      wx.showToast({ title: "请输入邀请码", icon: "none" });
      return;
    }

    this.setData({ loading: true });
    api.verifyInvite(code)
      .then(function(result) {
        const nextSession = {
          code: code,
          role: result.role,
          name: result.name || "入局信徒",
          savedAt: Date.now()
        };
        session.setSession(nextSession);
        wx.redirectTo({ url: this.pendingMusterId ? "/pages/match/match?musterId=" + this.pendingMusterId : "/pages/match/match" });
      }.bind(this))
      .catch(function(error) {
        wx.showToast({ title: error.message || "验证失败", icon: "none" });
      })
      .finally(function() {
        this.setData({ loading: false });
      }.bind(this));
  }
});

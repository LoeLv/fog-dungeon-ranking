const SESSION_KEY = "fog_dungeon_invite_session_v1";

function getSession() {
  try {
    return wx.getStorageSync(SESSION_KEY) || null;
  } catch (error) {
    return null;
  }
}

function setSession(session) {
  wx.setStorageSync(SESSION_KEY, session);
}

function clearSession() {
  wx.removeStorageSync(SESSION_KEY);
}

function hasSession() {
  const session = getSession();
  return !!(session && session.code && session.role);
}

module.exports = {
  getSession: getSession,
  setSession: setSession,
  clearSession: clearSession,
  hasSession: hasSession
};

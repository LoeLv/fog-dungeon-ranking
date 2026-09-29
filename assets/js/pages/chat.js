/* 社群聊天 · Phase 1 前端 MVP
   复用全局 supabaseClient / invokeDungeonAction / inviteSession；纯叠加、默认隐藏，不影响既有功能。 */
(function () {
  'use strict';

  var KIND_LABEL = { global: '大群', path: '命途', god: '神明', devotee: '信徒', dm: '私聊', party: '小队' };
  var state = {
    channels: [],
    active: null,
    messages: [],
    unread: {},
    realtime: null,
    needLogin: false
  };

  function client() {
    try { if (typeof supabaseClient !== 'undefined' && supabaseClient) return supabaseClient; } catch (e) {}
    return window.supabaseClient || null;
  }
  function esc(s) {
    if (typeof escapeHtml === 'function') return escapeHtml(String(s == null ? '' : s));
    var d = document.createElement('div');
    d.textContent = String(s == null ? '' : s);
    return d.innerHTML;
  }
  function toast(m) {
    if (typeof showToast === 'function') showToast(m);
    else console.log('[chat]', m);
  }
  function hasSession() {
    try {
      return !!(typeof inviteSession !== 'undefined' && inviteSession && (inviteSession.code || inviteSession.name));
    } catch (e) { return false; }
  }
  function isMe(name) {
    try {
      return !!(typeof inviteSession !== 'undefined' && inviteSession && inviteSession.name && name && inviteSession.name === name);
    } catch (e) { return false; }
  }
  function fmtTime(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      var p = function (n) { return (n < 10 ? '0' : '') + n; };
      return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    } catch (e) { return ''; }
  }

  async function loadChannels() {
    state.needLogin = false;
    var res = await invokeDungeonAction('listChatChannels', {});
    if (res && res.error) {
      var msg = String((res.error && res.error.message) || '');
      if (/谕令|邀请码|登录/.test(msg)) { state.needLogin = true; state.channels = []; return; }
      var c = client();
      if (c) {
        var r = await c.from('chat_channels')
          .select('id,slug,name,kind,path_key,god_key,description,sort_order')
          .eq('is_active', true).order('sort_order', { ascending: true });
        state.channels = (r && r.data) || [];
        return;
      }
      throw new Error(msg || '加载频道失败');
    }
    state.channels = (res && res.data) || [];
  }

  async function loadMessages(channelId) {
    var res = await invokeDungeonAction('getChatMessages', { channelId: channelId, limit: 60 });
    if (res && res.error) {
      var c = client();
      if (c) {
        var r = await c.from('chat_messages')
          .select('id,channel_id,invite_name,body,kind,meta,created_at')
          .eq('channel_id', channelId).order('created_at', { ascending: true }).limit(60);
        return ((r && r.data) || []).map(function (m) {
          return { id: m.id, channelId: m.channel_id, inviteName: m.invite_name, body: m.body, kind: m.kind, meta: m.meta, createdAt: m.created_at };
        });
      }
      throw new Error(String((res.error && res.error.message) || '加载消息失败'));
    }
    return (res && res.data) || [];
  }

  function renderChannels() {
    var box = document.getElementById('chatChannels');
    if (!box) return;
    if (state.needLogin) { box.innerHTML = '<div class="chat-empty">请先验入局谕令，再来聚议。</div>'; return; }
    if (!state.channels.length) { box.innerHTML = '<div class="chat-empty">暂无群组</div>'; return; }
    box.innerHTML = state.channels.map(function (ch) {
      var n = state.unread[ch.id] || 0;
      var badge = n > 0 ? '<span class="chat-badge">' + (n > 99 ? '99+' : n) + '</span>' : '';
      var kind = KIND_LABEL[ch.kind] || ch.kind || '';
      return '<div class="chat-chan' + (state.active === ch.id ? ' active' : '') + '" data-cid="' + esc(ch.id) + '" onclick="openChatChannel(\'' + esc(ch.id) + '\')">' +
        '<span class="cn-name">' + esc(ch.name || ch.slug) + '</span>' + badge +
        '<span class="cn-kind">' + esc(kind) + '</span></div>';
    }).join('');
  }

  function renderHead() {
    var nameEl = document.getElementById('chatCurName');
    var descEl = document.getElementById('chatCurDesc');
    if (!nameEl) return;
    var ch = state.channels.filter(function (x) { return x.id === state.active; })[0];
    nameEl.textContent = ch ? (ch.name || ch.slug) : '请选择群组';
    if (descEl) descEl.textContent = ch ? (ch.description || '') : '';
  }

  function renderMessages() {
    var box = document.getElementById('chatMessages');
    if (!box) return;
    if (!state.active) { box.innerHTML = '<div class="chat-empty">选择左侧一个群组开始交流</div>'; return; }
    if (!state.messages.length) { box.innerHTML = '<div class="chat-empty">还没有消息，说第一句吧</div>'; return; }
    box.innerHTML = state.messages.map(function (m) {
      var name = m.inviteName || m.invite_name || '匿名信徒';
      var me = isMe(name);
      return '<div class="chat-msg' + (me ? ' me' : '') + '">' +
        '<span class="who">' + esc(name) + ' · ' + fmtTime(m.createdAt || m.created_at) + '</span>' +
        '<span class="bubble">' + esc(m.body) + '</span></div>';
    }).join('');
    box.scrollTop = box.scrollHeight;
  }

  function render() { renderChannels(); renderHead(); renderMessages(); }

  function subscribe() {
    var c = client();
    if (!c || !c.channel) return;
    unsubscribe();
    state.realtime = c.channel('fog-chat-' + Date.now())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, function (payload) {
        onIncoming(payload && payload.new);
      })
      .subscribe();
  }
  function unsubscribe() {
    var c = client();
    if (state.realtime && c && c.removeChannel) { try { c.removeChannel(state.realtime); } catch (e) {} }
    state.realtime = null;
  }
  function onIncoming(row) {
    if (!row) return;
    var cid = row.channel_id;
    if (cid === state.active) {
      var dup = state.messages.some(function (m) { return m.id === row.id; });
      if (!dup) {
        state.messages.push({ id: row.id, channelId: cid, inviteName: row.invite_name, body: row.body, kind: row.kind, meta: row.meta, createdAt: row.created_at });
        renderMessages();
      }
      invokeDungeonAction('markChatRead', { channelId: cid }).catch(function () {});
    } else {
      state.unread[cid] = (state.unread[cid] || 0) + 1;
      renderChannels();
    }
  }

  window.openChatPage = async function () {
    var page = document.getElementById('chatPage');
    if (page) page.style.display = 'flex';
    if (!hasSession()) { state.needLogin = true; render(); return; }
    try {
      await loadChannels();
      render();
      subscribe();
      if (state.channels.length && !state.active) window.openChatChannel(state.channels[0].id);
    } catch (e) { toast(e.message || '打开聚议失败'); }
  };

  window.closeChatPage = function () {
    var page = document.getElementById('chatPage');
    if (page) page.style.display = 'none';
    unsubscribe();
  };

  window.openChatChannel = async function (channelId) {
    state.active = channelId;
    state.unread[channelId] = 0;
    renderChannels(); renderHead();
    var box = document.getElementById('chatMessages');
    if (box) box.innerHTML = '<div class="chat-empty">加载中…</div>';
    try {
      state.messages = await loadMessages(channelId);
      renderMessages();
      invokeDungeonAction('markChatRead', { channelId: channelId }).catch(function () {});
    } catch (e) { toast(e.message || '加载消息失败'); }
  };

  window.chatOnInputKey = function (ev) {
    if (ev && ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); window.chatSend(); }
  };

  window.chatSend = async function () {
    var input = document.getElementById('chatInput');
    var body = input ? String(input.value || '').trim() : '';
    if (!body) return;
    if (!state.active) { toast('请先选择群组'); return; }
    if (!hasSession()) { toast('请先验入局谕令'); return; }
    var res = await invokeDungeonAction('sendChatMessage', { channelId: state.active, body: body });
    if (res && res.error) { toast(String(res.error.message || '发送失败')); return; }
    if (input) input.value = '';
    if (res && res.data) {
      var dup = state.messages.some(function (m) { return m.id === res.data.id; });
      if (!dup) { state.messages.push(res.data); renderMessages(); }
    }
  };

  document.addEventListener('click', function (e) {
    var page = document.getElementById('chatPage');
    if (page && page.style.display !== 'none' && e.target === page) window.closeChatPage();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var page = document.getElementById('chatPage');
      if (page && page.style.display !== 'none') window.closeChatPage();
    }
  });
})();

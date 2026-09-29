/* 社群聊天 · Phase 1.5（独立整页 + 导航栏 + 每房间专属场景特效）
   复用全局 supabaseClient / invokeDungeonAction / inviteSession；纯叠加，不影响既有功能。 */
(function () {
  'use strict';

  var KIND_LABEL = { global: '大群', path: '命途', god: '信仰', profession: '职业', devotee: '信徒', dm: '私聊', party: '小队' };
  var NAV_ORDER = [
    { key: 'global', label: '总大群', icon: '❖' },
    { key: 'path', label: '命途', icon: '✦' },
    { key: 'god', label: '信仰', icon: '✧' },
    { key: 'profession', label: '职业', icon: '⚒' }
  ];
  var ICONS = {
    global: '❖',
    path: { '生命': '✦', '存在': '◇', '文明': '▣', '虚无': '◈', '混沌': '✺', '沉沦': '◒' },
    god: { '诞育': '芽', '繁荣': '穗', '死亡': '眠', '记忆': '页', '时间': '沙', '秩序': '衡', '真理': '典', '战争': '矛', '欺诈': '面', '命运': '骰', '混乱': '涡', '沉默': '默', '痴愚': '眸', '污堕': '溻', '腐朽': '朽', '湮灭': '烬' },
    profession: { '战士': '刃', '法师': '杖', '牧师': '愈', '刺客': '影', '猎人': '矢', '歌者': '谣' }
  };
  var PATH_COLOR = {
    生命: '#7cd67c', 存在: '#7fd0e6', 文明: '#e7cf8a',
    虚无: '#b98fe8', 混沌: '#e07a8f', 沉沦: '#c0557a'
  };
  var DEFAULT_COLOR = '#d6b260';

  // 职业真图标（SVG 线纹 · 24 viewBox · currentColor）
  var PROF_SIGILS = {
    '战士': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 4.5L10 12.5"/><path d="M19.4 3.1l1.5 1.5-1 3.5-4 .7-1.7-1.7.7-4 3.5-1z"/><path d="M7.5 12.5l4 4"/><path d="M9 13.5L4 18.5"/><path d="M6.5 16L5 17.5a1.42 1.42 0 0 0 0 2l.5.5a1.42 1.42 0 0 0 2 0L9 18.5"/></svg>',
    '法师': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 21L15 8"/><circle cx="16.5" cy="6" r="2.6"/><path d="M16.5 1.6v1.3M16.5 9.1v1.3M12.1 6h1.3M20.9 6h-1.3M13.4 2.9l.9.9M19.6 9.1l-.9-.9M19.6 2.9l-.9.9M13.4 9.1l.9-.9"/></svg>',
    '牧师': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8.5v12M8 13h8"/><ellipse cx="12" cy="5" rx="4.6" ry="2"/></svg>',
    '刺客': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5l3 6.5 6.5 3-6.5 3-3 6.5-3-6.5L2.5 12l6.5-3z"/><circle cx="12" cy="12" r="1.8"/></svg>',
    '猎人': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.6 20.4L20.4 3.6"/><path d="M20.4 3.6h-5.8M20.4 3.6v5.8"/><path d="M5 5a13 13 0 0 1 14 14"/></svg>',
    '歌者': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="18" r="2.6"/><circle cx="17" cy="16" r="2.6"/><path d="M10.6 18V7.5M19.6 16V5.5M10.6 7.5l9-2"/></svg>'
  };

  // 命途真图标（SVG 线纹）
  var PATH_SIGILS = {
    '生命': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21C7 17 5 12.5 6.5 7 11 6 16 8 18 12.5 19.3 15.7 17.5 19 12 21z"/><path d="M12 21c0-5 1.5-8.7 4.6-11.2"/></svg>',
    '存在': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12M6 21h12"/><path d="M7 3c0 4 5 6 5 9s-5 5-5 9"/><path d="M17 3c0 4-5 6-5 9s5 5 5 9"/></svg>',
    '文明': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-5 9 5"/><path d="M4.5 9v9M9.5 9v9M14.5 9v9M19.5 9v9"/><path d="M2.5 21h19"/></svg>',
    '虚无': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 12.4a2.3 2.3 0 1 1 2.3-2.3c0 3.1-2.5 5.2-5.4 5.2A6.7 6.7 0 0 1 2.4 8.7C2.4 3.8 6.4.6 11.3.6"/></svg>',
    '混沌': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12c3-6.2 15-6.2 18 0-3 6.2-15 6.2-18 0z"/><path d="M12 12a2 2 0 1 1 2 2"/></svg>',
    '沉沦': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h10l-1 5a4 4 0 0 1-8 0z"/><path d="M12 12v6"/><path d="M8.5 21h7"/></svg>'
  };

  // 每房间专属场景：主色 + 场景 key（scene = 独立的特效机制，不是换皮的粒子）
  var THEME = {
    global: { global: { color: '#d6b260', scene: 'pantheon' } },
    profession: {
      '战士': { color: '#ff6a3d', scene: 'warlord' },
      '法师': { color: '#5ec8ff', scene: 'arcanist' },
      '牧师': { color: '#ffe8a3', scene: 'cleric' },
      '刺客': { color: '#8f6bd6', scene: 'assassin' },
      '猎人': { color: '#7dd67c', scene: 'ranger' },
      '歌者': { color: '#ff8fd0', scene: 'bard' }
    },
    path: {
      '生命': { color: '#7cd67c', scene: 'life' },
      '存在': { color: '#7fd0e6', scene: 'existence' },
      '文明': { color: '#e7cf8a', scene: 'civilization' },
      '虚无': { color: '#b98fe8', scene: 'nihility' },
      '混沌': { color: '#e07a8f', scene: 'turbulence' },
      '沉沦': { color: '#c0557a', scene: 'downfall' }
    },
    god: {
      '诞育': { color: '#7cd67c', scene: 'birth' },
      '繁荣': { color: '#a8e06a', scene: 'bloom' },
      '死亡': { color: '#6b7f8a', scene: 'death' },
      '记忆': { color: '#8aa0ff', scene: 'vanGogh' },
      '时间': { color: '#d9c89a', scene: 'time' },
      '秩序': { color: '#e7cf8a', scene: 'order' },
      '真理': { color: '#ffe9a8', scene: 'truth' },
      '战争': { color: '#ff7a4d', scene: 'war' },
      '欺诈': { color: '#a879ff', scene: 'deceit' },
      '命运': { color: '#b98fe8', scene: 'fate' },
      '混乱': { color: '#ff8fc0', scene: 'chaosGod' },
      '沉默': { color: '#9aa6c9', scene: 'silence' },
      '痴愚': { color: '#ffd76a', scene: 'folly' },
      '污堕': { color: '#c86bd0', scene: 'corruption' },
      '腐朽': { color: '#8a9a5b', scene: 'decay' },
      '湮灭': { color: '#ff5a6a', scene: 'annihilate' }
    }
  };

  var state = {
    channels: [],
    active: null,
    navKey: 'global',
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
  function gnameFor(ch) {
    return String((ch && ch.name) || '').split('之神')[0].trim();
  }
  function themeKey(ch) {
    if (!ch) return 'global';
    if (ch.kind === 'profession') return ch.profKey || ch.prof_key || '';
    if (ch.kind === 'path') return ch.pathKey || ch.path_key || '';
    if (ch.kind === 'god') return ch.godKey || ch.god_key || gnameFor(ch) || '';
    return 'global';
  }
  function themeFor(ch) {
    var byKind = THEME[ch && ch.kind];
    var t = byKind && byKind[themeKey(ch)];
    return t || { color: DEFAULT_COLOR, scene: 'flow' };
  }
  function colorFor(ch) { return themeFor(ch).color; }

  function iconFor(ch) {
    if (!ch) return ICONS.global;
    var g = ICONS[ch.kind];
    if (typeof g === 'string') return g;
    if (g) {
      var k = ch.godKey || ch.god_key || ch.profKey || ch.prof_key || ch.pathKey || ch.path_key;
      if (k && g[k]) return g[k];
    }
    return '•';
  }
  function godSigilMap() {
    try { if (typeof GOD_SIGILS !== 'undefined' && GOD_SIGILS) return GOD_SIGILS; } catch (e) {}
    try { if (window.GOD_SIGILS) return window.GOD_SIGILS; } catch (e) {}
    return null;
  }
  function sigilFor(ch) {
    if (!ch) return '';
    try {
      if (ch.kind === 'god') {
        var map = godSigilMap();
        if (map) {
          var gk = ch.godKey || ch.god_key;
          if (gk && map[gk] && map[gk].svg) return map[gk].svg;
          var nm = gnameFor(ch);
          if (nm && map[nm] && map[nm].svg) return map[nm].svg;
        }
      } else if (ch.kind === 'profession') {
        var pk = ch.profKey || ch.prof_key;
        if (pk && PROF_SIGILS[pk]) return PROF_SIGILS[pk];
      } else if (ch.kind === 'path') {
        var pth = ch.pathKey || ch.path_key;
        if (pth && PATH_SIGILS[pth]) return PATH_SIGILS[pth];
      }
    } catch (e) {}
    return '';
  }
  function emblemFor(ch) {
    var svg = sigilFor(ch);
    var inner = svg ? svg : '<span class="emb-glyph">' + esc(iconFor(ch)) + '</span>';
    return '<span class="cn-emblem">' + inner + '</span>';
  }
  function sceneForChannel(ch) { return themeFor(ch).scene; }

  async function loadChannels() {
    state.needLogin = false;
    var res = await invokeDungeonAction('listChatChannels', {});
    if (res && res.error) {
      var msg = String((res.error && res.error.message) || '');
      if (/谕令|邀请码|登录/.test(msg)) { state.needLogin = true; state.channels = []; return; }
      var c = client();
      if (c) {
        var r = await c.from('chat_channels')
          .select('id,slug,name,kind,path_key,god_key,prof_key,description,sort_order')
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

  // ---------- 导航栏 ----------
  function availableNavKeys() {
    var keys = {};
    state.channels.forEach(function (ch) { keys[ch.kind] = true; });
    return NAV_ORDER.filter(function (item) { return keys[item.key]; });
  }
  function renderNav() {
    var box = document.getElementById('chatNav');
    if (!box) return;
    var navs = availableNavKeys();
    if (!navs.length) { box.innerHTML = ''; return; }
    if (!navs.some(function (n) { return n.key === state.navKey; })) state.navKey = navs[0].key;
    box.innerHTML = navs.map(function (n) {
      var count = state.channels.filter(function (c) { return c.kind === n.key; }).length;
      return '<button type="button" class="chat-tab' + (state.navKey === n.key ? ' active' : '') + '" onclick="chatNav(\'' + n.key + '\')">' +
        '<span class="tab-ico">' + esc(n.icon || '•') + '</span>' + esc(n.label) + '<span class="tab-count">' + count + '</span></button>';
    }).join('');
  }
  window.chatNav = function (key) {
    state.navKey = key;
    renderNav(); renderChannels();
  };

  // ---------- 频道列表 ----------
  function renderChannels() {
    var box = document.getElementById('chatChannels');
    if (!box) return;
    if (state.needLogin) { box.innerHTML = '<div class="chat-empty">请先验入局谕令，再来聚议。</div>'; return; }
    var list = state.channels.filter(function (ch) { return ch.kind === state.navKey; });
    if (!list.length) { box.innerHTML = '<div class="chat-empty">该分区暂无群组</div>'; return; }
    var activeColor = colorFor(state.channels.filter(function (x) { return x.id === state.active; })[0]);
    box.style.setProperty('--tab-accent', activeColor);
    box.innerHTML = list.map(function (ch) {
      var n = state.unread[ch.id] || 0;
      var badge = n > 0 ? '<span class="chat-badge">' + (n > 99 ? '99+' : n) + '</span>' : '';
      var col = colorFor(ch);
      return '<div class="chat-chan' + (state.active === ch.id ? ' active' : '') + '" data-cid="' + esc(ch.id) + '" style="--chan-accent:' + col + '" onclick="openChatChannel(\'' + esc(ch.id) + '\')">' +
        emblemFor(ch) +
        '<span class="cn-name">' + esc(ch.name || ch.slug) + '</span>' + badge +
        '<span class="cn-kind">' + esc(KIND_LABEL[ch.kind] || ch.kind || '') + '</span></div>';
    }).join('');
  }

  function renderHead(animate) {
    var nameEl = document.getElementById('chatCurName');
    var descEl = document.getElementById('chatCurDesc');
    var embEl = document.getElementById('chatCurEmblem');
    var page = document.getElementById('chatPage');
    if (!nameEl) return;
    var ch = state.channels.filter(function (x) { return x.id === state.active; })[0];
    nameEl.textContent = ch ? (ch.name || ch.slug) : '请选择群组';
    if (descEl) descEl.textContent = ch ? (ch.description || '') : '';
    if (embEl) embEl.innerHTML = ch ? emblemFor(ch) : '';
    var col = colorFor(ch);
    if (page) page.style.setProperty('--chat-accent', col);
    var scene = sceneForChannel(ch);
    if (window.chatFxSetScene) window.chatFxSetScene(col, scene);
    if (animate) {
      nameEl.classList.remove('swap');
      void nameEl.offsetWidth;
      nameEl.classList.add('swap');
    }
  }

  function renderMessages() {
    var box = document.getElementById('chatMessages');
    if (!box) return;
    if (!state.active) { box.innerHTML = '<div class="chat-empty">选择一个群组开始交流</div>'; return; }
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

  function appendMessage(row) {
    var box = document.getElementById('chatMessages');
    if (!box) return;
    var emptyEl = box.querySelector('.chat-empty');
    if (emptyEl) box.innerHTML = '';
    var name = row.inviteName || row.invite_name || '匿名信徒';
    var me = isMe(name);
    var div = document.createElement('div');
    div.className = 'chat-msg' + (me ? ' me' : '') + ' arrive';
    div.innerHTML = '<span class="who">' + esc(name) + ' · ' + fmtTime(row.createdAt || row.created_at) + '</span>' +
      '<span class="bubble">' + esc(row.body) + '</span>';
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  function render() { renderNav(); renderChannels(); renderHead(false); renderMessages(); }

  // ---------- Realtime ----------
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
        var msg = { id: row.id, channelId: cid, inviteName: row.invite_name, body: row.body, kind: row.kind, meta: row.meta, createdAt: row.created_at };
        state.messages.push(msg);
        appendMessage(msg);
      }
      invokeDungeonAction('markChatRead', { channelId: cid }).catch(function () {});
    } else {
      state.unread[cid] = (state.unread[cid] || 0) + 1;
      renderNav(); renderChannels();
    }
  }

  // ---------- 生命周期 ----------
  window.openChatPage = async function () {
    var page = document.getElementById('chatPage');
    if (page) page.classList.add('open');
    document.body.classList.add('chat-locked');
    if (window.chatFxStart) window.chatFxStart();
    if (!hasSession()) { state.needLogin = true; render(); return; }
    try {
      await loadChannels();
      render();
      subscribe();
      var firstOfNav = state.channels.filter(function (c) { return c.kind === state.navKey; })[0] || state.channels[0];
      if (firstOfNav && !state.active) window.openChatChannel(firstOfNav.id);
    } catch (e) { toast(e.message || '打开聚议失败'); }
  };

  window.closeChatPage = function () {
    var page = document.getElementById('chatPage');
    if (page) page.classList.remove('open');
    document.body.classList.remove('chat-locked');
    if (window.chatFxStop) window.chatFxStop();
    unsubscribe();
  };

  window.openChatChannel = async function (channelId) {
    state.active = channelId;
    state.unread[channelId] = 0;
    var ch = state.channels.filter(function (x) { return x.id === channelId; })[0];
    if (ch) state.navKey = ch.kind;
    renderNav(); renderChannels(); renderHead(true);
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
      if (!dup) { state.messages.push(res.data); appendMessage(res.data); }
    }
  };

  document.addEventListener('click', function (e) {
    var page = document.getElementById('chatPage');
    if (page && page.classList.contains('open') && e.target === page) window.closeChatPage();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var page = document.getElementById('chatPage');
      if (page && page.classList.contains('open')) window.closeChatPage();
    }
  });

  // ============================================================
  //  背景专属场景引擎 —— 每个房间一套独立渲染机制（非粒子换皮）
  // ============================================================
  var fx = { raf: 0, ctx: null, canvas: null, w: 0, h: 0, running: false, scene: 'flow', color: [214, 178, 96], s: null, needClear: false };

  function hexToRgb(h) {
    var m = /^#?([0-9a-f]{6})$/i.exec(h || '');
    if (!m) return [214, 178, 96];
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function reduceMotion() {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function rr(a, b) { return a + Math.random() * (b - a); }
  function cls(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function cc(a) { return cls(fx.color, a); }
  function fxResize() {
    if (!fx.canvas) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    fx.w = fx.canvas.clientWidth; fx.h = fx.canvas.clientHeight;
    fx.canvas.width = fx.w * dpr; fx.canvas.height = fx.h * dpr;
    fx.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  var SCENES = {
    // —— 通用兜底 ——
    flow: {
      init: function (s) { s.p = []; for (var i = 0; i < 130; i++) s.p.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vx: rr(-0.8, 0.8), vy: rr(-0.8, 0.8), r: rr(0.8, 2.4) }); },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(10,8,18,0.14)'; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < s.p.length; i++) {
          var p = s.p[i];
          var a1 = Math.sin(p.x * 0.002 + t * 0.0003), a2 = Math.cos(p.y * 0.002 - t * 0.0003);
          p.vx = p.vx * 0.96 + a1 * 0.2; p.vy = p.vy * 0.96 + a2 * 0.2;
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0) p.x = w; if (p.x > w) p.x = 0; if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
          ctx.fillStyle = cc(0.4); ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    // —— 总大群 · 万神殿堂：神明星座 + 众色星流归向圣核 ——
    pantheon: {
      init: function (s) {
        s.stars = []; for (var i = 0; i < 90; i++) s.stars.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, r: rr(0.6, 2), ph: rr(0, 6.283) });
        s.constel = []; for (var j = 0; j < 26; j++) s.constel.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, ph: rr(0, 6.283) });
        s.motes = [];
        var pal = [[255,106,61],[94,200,255],[255,232,163],[160,107,255],[125,214,124],[255,143,208],[124,214,124],[127,208,230],[231,207,138],[185,143,232],[224,122,143],[192,85,122],[138,160,255],[217,200,154],[255,122,77],[255,90,106],[168,224,106],[255,215,106],[200,107,208],[138,154,91]];
        for (var k = 0; k < 150; k++) s.motes.push({ a: Math.random() * 6.283, r: rr(fx.w * 0.1, fx.w * 0.6), sp: rr(0.0004, 0.0016), col: pal[Math.floor(Math.random() * pal.length)], sz: rr(1, 2.8) });
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(8,7,16,0.14)'; ctx.fillRect(0, 0, w, h);
        var cx = w / 2, cy = h / 2;
        ctx.globalCompositeOperation = 'lighter';
        for (var j = 0; j < s.constel.length; j++) {
          var c1 = s.constel[j];
          ctx.fillStyle = 'rgba(255,240,200,' + (0.3 + 0.3 * Math.sin(t * 0.003 + c1.ph)) + ')';
          ctx.beginPath(); ctx.arc(c1.x, c1.y, 1.6, 0, 6.2832); ctx.fill();
          for (var k = 0; k < s.constel.length; k++) {
            if (k === j) continue;
            var c2 = s.constel[k], dd = Math.hypot(c1.x - c2.x, c1.y - c2.y);
            if (dd < 150) { ctx.strokeStyle = 'rgba(214,178,96,' + (0.13 * (1 - dd / 150)) + ')'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y); ctx.stroke(); }
          }
        }
        for (var i = 0; i < s.stars.length; i++) {
          var st = s.stars[i], a = 0.2 + 0.5 * Math.abs(Math.sin(t * 0.002 + st.ph));
          ctx.fillStyle = 'rgba(255,250,235,' + a + ')'; ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, 6.2832); ctx.fill();
        }
        for (var m = 0; m < s.motes.length; m++) {
          var mo = s.motes[m]; mo.a += mo.sp * (1 + (1 - mo.r / (w * 0.6)) * 2.6); mo.r -= 0.25;
          if (mo.r < 20) mo.r = w * 0.6 * Math.random() + w * 0.1;
          var mx = cx + Math.cos(mo.a) * mo.r, my = cy + Math.sin(mo.a) * mo.r * 0.6;
          ctx.fillStyle = 'rgba(' + mo.col[0] + ',' + mo.col[1] + ',' + mo.col[2] + ',0.6)';
          ctx.beginPath(); ctx.arc(mx, my, mo.sz, 0, 6.2832); ctx.fill();
        }
        var gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.42);
        gg.addColorStop(0, 'rgba(255,240,200,0.42)'); gg.addColorStop(0.3, 'rgba(230,200,120,0.16)'); gg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gg; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(255,248,225,' + (0.5 + 0.2 * Math.sin(t * 0.003)) + ')';
        ctx.beginPath(); ctx.arc(cx, cy, 10, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = 'rgba(214,178,96,0.35)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(cx, cy, 42 + Math.sin(t * 0.002) * 4, 0, 6.2832); ctx.stroke();
        for (var q = 0; q < 16; q++) {
          var qa = q / 16 * 6.2832 + t * 0.0003;
          ctx.strokeStyle = 'rgba(230,200,120,0.3)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(qa) * 42, cy + Math.sin(qa) * 42); ctx.lineTo(cx + Math.cos(qa) * 52, cy + Math.sin(qa) * 52); ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    // —— 战士 · 铁血前线：熔炉里插着发光兵刃 + 火星上窜 ——
    warlord: {
      init: function (s) {
        s.blades = [];
        for (var i = 0; i < 6; i++) s.blades.push({ x: fx.w * (0.12 + 0.152 * i), ang: rr(-0.28, 0.28), len: rr(fx.h * 0.34, fx.h * 0.58), fl: rr(0, 6.283) });
        s.embers = [];
        for (var j = 0; j < 90; j++) s.embers.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vy: rr(0.6, 1.8), r: rr(0.6, 2.2), ph: rr(0, 6.283) });
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(10,6,8,0.16)'; ctx.fillRect(0, 0, w, h);
        var g = ctx.createLinearGradient(0, h, 0, h * 0.3);
        g.addColorStop(0, cc(0.24)); g.addColorStop(1, cc(0));
        ctx.fillStyle = g; ctx.fillRect(0, h * 0.3, w, h * 0.7);
        for (var i = 0; i < s.blades.length; i++) {
          var b = s.blades[i], flick = 0.65 + 0.35 * Math.sin(t * 0.006 + b.fl);
          ctx.save(); ctx.translate(b.x, h); ctx.rotate(b.ang);
          ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-2.6, -b.len); ctx.lineTo(0, -b.len - 13); ctx.lineTo(2.6, -b.len); ctx.lineTo(4, 0); ctx.closePath();
          ctx.fillStyle = 'rgba(26,18,22,0.92)'; ctx.fill();
          ctx.strokeStyle = 'rgba(120,60,40,0.5)'; ctx.lineWidth = 1; ctx.stroke();
          ctx.shadowColor = cc(0.9); ctx.shadowBlur = 16 * flick;
          ctx.strokeStyle = cc(0.85 * flick); ctx.lineWidth = 1.8;
          ctx.beginPath(); ctx.moveTo(-2, -b.len * 0.12); ctx.lineTo(0, -b.len - 11); ctx.stroke();
          ctx.shadowBlur = 0; ctx.restore();
        }
        ctx.globalCompositeOperation = 'lighter';
        for (var k = 0; k < s.embers.length; k++) {
          var e = s.embers[k]; e.y -= e.vy; e.x += Math.sin(t * 0.002 + e.ph) * 0.5;
          if (e.y < -10) { e.y = h + Math.random() * 40; e.x = Math.random() * w; }
          var a = 0.5 + 0.5 * Math.sin(t * 0.01 + e.ph);
          ctx.fillStyle = cc(0.7 * a); ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 6.2832); ctx.fill();
          ctx.fillStyle = 'rgba(255,232,180,' + (0.55 * a) + ')'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.5, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    // —— 法师 · 秘术高塔：旋转奥术法阵 + 环绕光点 ——
    arcanist: {
      init: function (s) {
        s.motes = [];
        for (var i = 0; i < 90; i++) s.motes.push({ a: Math.random() * 6.283, rad: rr(30, Math.max(fx.w, fx.h) * 0.55), sp: rr(0.0006, 0.0022) * (Math.random() < 0.5 ? 1 : -1), r: rr(0.8, 2.2) });
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(6,10,18,0.18)'; ctx.fillRect(0, 0, w, h);
        var cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.34, rot = t * 0.0002;
        ctx.globalCompositeOperation = 'lighter';
        for (var r = 0; r < 3; r++) {
          var rad = R * (0.55 + r * 0.28);
          ctx.strokeStyle = cc(0.22 - r * 0.03); ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 6.2832); ctx.stroke();
          var dir = (r % 2 === 0) ? 1 : -1, rr2 = rot * dir * (1 + r * 0.5);
          for (var m = 0; m < 24; m++) {
            var a2 = rr2 + m / 24 * 6.2832;
            ctx.strokeStyle = cc(0.35); ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(cx + Math.cos(a2) * (rad - 5), cy + Math.sin(a2) * (rad - 5)); ctx.lineTo(cx + Math.cos(a2) * (rad + 5), cy + Math.sin(a2) * (rad + 5)); ctx.stroke();
          }
        }
        ctx.strokeStyle = cc(0.5); ctx.lineWidth = 1.4;
        for (var tri = 0; tri < 2; tri++) {
          var baseRot = (tri === 0 ? 1 : -1) * rot * 1.6;
          ctx.beginPath();
          for (var v = 0; v < 3; v++) { var av = baseRot + v / 3 * 6.2832; var px = cx + Math.cos(av) * R * 0.62, py = cy + Math.sin(av) * R * 0.62; if (v === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
          ctx.closePath(); ctx.stroke();
        }
        var gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.5);
        gg.addColorStop(0, cc(0.35)); gg.addColorStop(1, cc(0));
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(cx, cy, R * 0.5, 0, 6.2832); ctx.fill();
        for (var i = 0; i < s.motes.length; i++) {
          var mo = s.motes[i]; mo.a += mo.sp;
          var mx = cx + Math.cos(mo.a) * mo.rad, my = cy + Math.sin(mo.a) * mo.rad * 0.7;
          ctx.fillStyle = cc(0.5); ctx.beginPath(); ctx.arc(mx, my, mo.r, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    // —— 牧师 · 祈愈圣所：圣光柱 + 生命圣印 + 上浮光点 ——
    cleric: {
      init: function (s) {
        s.motes = [];
        for (var i = 0; i < 60; i++) s.motes.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vy: rr(0.15, 0.5), r: rr(0.8, 2), ph: rr(0, 6.283) });
        s.imprints = [];
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(14,12,6,0.16)'; ctx.fillRect(0, 0, w, h);
        var cx = w / 2;
        ctx.globalCompositeOperation = 'lighter';
        for (var b = 0; b < 5; b++) {
          var bx = cx + (b - 2) * w * 0.09;
          var bg = ctx.createLinearGradient(bx, 0, bx, h);
          bg.addColorStop(0, cc(0.10)); bg.addColorStop(1, cc(0));
          ctx.fillStyle = bg; ctx.beginPath();
          ctx.moveTo(bx - 8, 0); ctx.lineTo(bx + 8, 0); ctx.lineTo(bx + 46, h); ctx.lineTo(bx - 46, h); ctx.closePath(); ctx.fill();
        }
        var cy = h * 0.42, pr = Math.min(w, h) * 0.16 * (1 + 0.06 * Math.sin(t * 0.002));
        var gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, pr * 2.4);
        gg.addColorStop(0, cc(0.30)); gg.addColorStop(1, cc(0));
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(cx, cy, pr * 2.4, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = cc(0.7); ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.arc(cx, cy, pr, 0, 6.2832); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy - pr * 0.62); ctx.lineTo(cx, cy + pr * 0.62); ctx.moveTo(cx - pr * 0.4, cy - pr * 0.1); ctx.lineTo(cx + pr * 0.4, cy - pr * 0.1); ctx.stroke();
        // 偶发生命印记绽放
        if (Math.random() < 0.01) s.imprints.push({ x: rr(w * 0.15, w * 0.85), y: rr(h * 0.2, h * 0.8), r: 6, a: 0.9, rot: rr(0, 6.283) });
        for (var im = s.imprints.length - 1; im >= 0; im--) {
          var ip = s.imprints[im]; ip.r += 0.5; ip.a -= 0.012;
          if (ip.a <= 0) { s.imprints.splice(im, 1); continue; }
          ctx.save(); ctx.translate(ip.x, ip.y); ctx.rotate(ip.rot); ctx.strokeStyle = cc(ip.a); ctx.lineWidth = 1.4;
          for (var pet = 0; pet < 6; pet++) { var pa = pet / 6 * 6.2832; ctx.beginPath(); ctx.ellipse(Math.cos(pa) * ip.r, Math.sin(pa) * ip.r, ip.r * 0.5, ip.r * 0.22, pa, 0, 6.2832); ctx.stroke(); }
          ctx.restore();
        }
        for (var i = 0; i < s.motes.length; i++) {
          var mo = s.motes[i]; mo.y -= mo.vy; mo.x += Math.sin(t * 0.001 + mo.ph) * 0.2;
          if (mo.y < -8) { mo.y = h + 8; mo.x = Math.random() * w; }
          var a = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.004 + mo.ph));
          ctx.fillStyle = cc(0.6 * a); ctx.beginPath(); ctx.arc(mo.x, mo.y, mo.r, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    // —— 刺客 · 暗影行会：幽暗静谧，缓慢暗雾 + 稀有刀锋一闪 ——
    assassin: {
      init: function (s) {
        s.wisps = [];
        for (var i = 0; i < 10; i++) s.wisps.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, r: rr(fx.w * 0.12, fx.w * 0.3), vx: rr(-0.15, 0.15), vy: rr(-0.08, 0.08), a: rr(0.02, 0.05) });
        s.dust = [];
        for (var j = 0; j < 26; j++) s.dust.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, r: rr(0.4, 1.4), ph: rr(0, 6.283), vx: rr(-0.06, 0.06), vy: rr(-0.05, 0.05) });
        s.glint = { x: 0, y: 0, life: 0 };
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(9,8,14,0.14)'; ctx.fillRect(0, 0, w, h);
        for (var i = 0; i < s.wisps.length; i++) {
          var wp = s.wisps[i]; wp.x += wp.vx; wp.y += wp.vy;
          if (wp.x < -wp.r) wp.x = w + wp.r; if (wp.x > w + wp.r) wp.x = -wp.r;
          if (wp.y < -wp.r) wp.y = h + wp.r; if (wp.y > h + wp.r) wp.y = -wp.r;
          var g = ctx.createRadialGradient(wp.x, wp.y, 0, wp.x, wp.y, wp.r);
          g.addColorStop(0, cc(wp.a)); g.addColorStop(1, cc(0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(wp.x, wp.y, wp.r, 0, 6.2832); ctx.fill();
        }
        for (var j = 0; j < s.dust.length; j++) {
          var d = s.dust[j]; d.x += d.vx; d.y += d.vy;
          if (d.x < 0) d.x = w; if (d.x > w) d.x = 0; if (d.y < 0) d.y = h; if (d.y > h) d.y = 0;
          ctx.fillStyle = cc(0.06 + 0.05 * Math.abs(Math.sin(t * 0.001 + d.ph)));
          ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'lighter';
        if (s.glint.life > 0) {
          s.glint.life -= 0.02; ctx.strokeStyle = cc(s.glint.life * 0.9); ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(s.glint.x, s.glint.y); ctx.lineTo(s.glint.x + 34, s.glint.y - 10); ctx.stroke();
        } else if (Math.random() < 0.004) { s.glint.x = rr(w * 0.1, w * 0.9); s.glint.y = rr(h * 0.1, h * 0.9); s.glint.life = 1; }
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    // —— 猎人 · 荒野营地：摇曳芦苇 + 萤火 ——
    ranger: {
      init: function (s) {
        s.reeds = [];
        for (var i = 0; i < 80; i++) s.reeds.push({ x: Math.random() * fx.w, hh: rr(fx.h * 0.09, fx.h * 0.26), ph: rr(0, 6.283), sway: rr(0.02, 0.06), w: rr(0.6, 1.6) });
        s.flies = [];
        for (var j = 0; j < 34; j++) s.flies.push({ x: Math.random() * fx.w, y: rr(fx.h * 0.25, fx.h), ph: rr(0, 6.283), r: rr(0.8, 2), sp: rr(0.0008, 0.002) });
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(8,14,9,0.16)'; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        for (var j = 0; j < s.flies.length; j++) {
          var f = s.flies[j]; f.x += Math.sin(t * f.sp + f.ph) * 0.4; f.y += Math.cos(t * f.sp * 1.3 + f.ph) * 0.3;
          var a = Math.max(0, Math.sin(t * 0.003 + f.ph));
          var gg = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 6);
          gg.addColorStop(0, cc(0.6 * a)); gg.addColorStop(1, cc(0));
          ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 6, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        for (var i = 0; i < s.reeds.length; i++) {
          var rd = s.reeds[i], sw = Math.sin(t * 0.001 + rd.ph) * rd.sway * 40;
          ctx.strokeStyle = 'rgba(40,80,42,0.5)'; ctx.lineWidth = rd.w;
          ctx.beginPath(); ctx.moveTo(rd.x, h); ctx.quadraticCurveTo(rd.x + sw * 0.5, h - rd.hh * 0.6, rd.x + sw, h - rd.hh); ctx.stroke();
        }
      }
    },

    // —— 歌者 · 回响剧场：扩散声波环 + 漂浮音符 + 均衡器 ——
    bard: {
      init: function (s) {
        s.rings = []; s.notes = []; s.eq = [];
        for (var i = 0; i < 28; i++) s.eq.push(rr(0.1, 0.6));
        s.rt = 0;
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(16,8,14,0.16)'; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        var cx = w / 2, cy = h * 0.46;
        s.rt++; if (s.rt % 45 === 0) s.rings.push({ r: 10, a: 1 });
        for (var i = s.rings.length - 1; i >= 0; i--) {
          var g = s.rings[i]; g.r += 3.2; g.a -= 0.006;
          if (g.a <= 0) { s.rings.splice(i, 1); continue; }
          ctx.strokeStyle = cc(g.a * 0.5); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, g.r, 0, 6.2832); ctx.stroke();
          for (var q = 0; q < 4; q++) { var ang = q * Math.PI / 2 + g.r * 0.01; ctx.beginPath(); ctx.arc(cx, cy, g.r + 8, ang - 0.15, ang + 0.15); ctx.lineWidth = g.a * 2; ctx.stroke(); }
        }
        if (Math.random() < 0.05 && s.notes.length < 14) s.notes.push({ x: rr(w * 0.15, w * 0.85), y: h + 10, vy: rr(0.5, 1.2), ph: rr(0, 6.283) });
        for (var n = s.notes.length - 1; n >= 0; n--) {
          var no = s.notes[n]; no.y -= no.vy; no.x += Math.sin(t * 0.002 + no.ph) * 0.6;
          if (no.y < -20) { s.notes.splice(n, 1); continue; }
          ctx.strokeStyle = cc(0.75); ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.ellipse(no.x - 4, no.y, 4, 3, -0.4, 0, 6.2832); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(no.x, no.y - 1); ctx.lineTo(no.x, no.y - 16); ctx.lineTo(no.x + 8, no.y - 12); ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
        for (var e = 0; e < s.eq.length; e++) {
          s.eq[e] = rr(0.08, 0.6) * (0.6 + 0.4 * Math.abs(Math.sin(t * 0.003 + e)));
          var bw = w / s.eq.length;
          ctx.fillStyle = cc(0.4); ctx.fillRect(e * bw + 1, h - s.eq[e] * h * 0.3, bw - 2, s.eq[e] * h * 0.3);
        }
      }
    },

    // —— 生命命途：藤蔓生长 + 飘叶 ——
    life: {
      init: function (s) {
        s.vines = [];
        for (var i = 0; i < 8; i++) {
          var pts = [], x0 = fx.w * (0.06 + 0.12 * i), curl = rr(-0.6, 0.6), maxs = Math.floor(rr(fx.h * 0.3, fx.h * 0.72) / 9);
          for (var k = 0; k <= maxs; k++) pts.push({ x: x0 + Math.sin(k * 0.42 + curl) * (9 + k * 0.9), y: fx.h - k * 9 });
          s.vines.push({ pts: pts, grow: 0, spd: rr(0.4, 0.9), bloom: rr(0, 6.283) });
        }
        s.leaves = [];
        for (var j = 0; j < 26; j++) s.leaves.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vy: rr(0.2, 0.5), ph: rr(0, 6.283), rot: rr(0, 6.283) });
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(7,14,8,0.15)'; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < s.vines.length; i++) {
          var v = s.vines[i]; if (v.grow < v.pts.length) v.grow += v.spd;
          var lim = Math.min(v.pts.length, Math.floor(v.grow));
          ctx.strokeStyle = 'rgba(110,200,110,0.5)'; ctx.lineWidth = 2.2;
          ctx.beginPath();
          for (var k = 0; k < lim; k++) { if (k === 0) ctx.moveTo(v.pts[k].x, v.pts[k].y); else ctx.lineTo(v.pts[k].x, v.pts[k].y); }
          ctx.stroke();
          if (lim >= v.pts.length) {
            var tip = v.pts[v.pts.length - 1], pr2 = 4 + Math.sin(t * 0.003 + v.bloom) * 1.6;
            var gg = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, pr2 * 4);
            gg.addColorStop(0, cc(0.6)); gg.addColorStop(1, cc(0));
            ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(tip.x, tip.y, pr2 * 4, 0, 6.2832); ctx.fill();
          }
        }
        for (var j = 0; j < s.leaves.length; j++) {
          var lf = s.leaves[j]; lf.y += lf.vy; lf.x += Math.sin(t * 0.001 + lf.ph) * 0.5;
          if (lf.y > h + 10) { lf.y = -10; lf.x = Math.random() * w; }
          ctx.fillStyle = cc(0.3); ctx.save(); ctx.translate(lf.x, lf.y); ctx.rotate(lf.rot + t * 0.0008);
          ctx.beginPath(); ctx.ellipse(0, 0, 5, 2.4, 0, 0, 6.2832); ctx.fill(); ctx.restore();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    // —— 存在命途：漂浮时光碎晶 + 星点 ——
    existence: {
      init: function (s) {
        s.shards = [];
        for (var i = 0; i < 22; i++) s.shards.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, sz: rr(10, 34), rot: rr(0, 6.283), spin: rr(-0.02, 0.02), vx: rr(-0.3, 0.3), vy: rr(-0.25, 0.25), ph: rr(0, 6.283) });
        s.tw = [];
        for (var j = 0; j < 40; j++) s.tw.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, ph: rr(0, 6.283), r: rr(0.5, 1.6) });
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(8,14,20,0.15)'; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < s.shards.length; i++) {
          var sh = s.shards[i]; sh.x += sh.vx; sh.y += sh.vy; sh.rot += sh.spin;
          if (sh.x < -40) sh.x = w + 40; if (sh.x > w + 40) sh.x = -40;
          if (sh.y < -40) sh.y = h + 40; if (sh.y > h + 40) sh.y = -40;
          ctx.save(); ctx.translate(sh.x, sh.y); ctx.rotate(sh.rot);
          var a = 0.12 + 0.12 * Math.abs(Math.sin(t * 0.001 + sh.ph));
          ctx.fillStyle = cc(a); ctx.strokeStyle = cc(0.4); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(0, -sh.sz); ctx.lineTo(sh.sz * 0.6, 0); ctx.lineTo(0, sh.sz); ctx.lineTo(-sh.sz * 0.6, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.restore();
        }
        for (var j = 0; j < s.tw.length; j++) {
          var tw = s.tw[j], a2 = Math.max(0, Math.sin(t * 0.004 + tw.ph));
          ctx.fillStyle = cc(0.7 * a2); ctx.beginPath(); ctx.arc(tw.x, tw.y, tw.r, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    // —— 文明命途：圣光殿堂 + 旋转曼陀罗 + 列柱 ——
    civilization: {
      init: function () {},
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(16,14,8,0.16)'; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        var cx = w / 2, rot = t * 0.00012;
        for (var b = 0; b < 7; b++) {
          var ang = (b - 3) * 0.11;
          var bg = ctx.createLinearGradient(cx, 0, cx, h);
          bg.addColorStop(0, cc(0.12)); bg.addColorStop(1, cc(0));
          ctx.fillStyle = bg;
          ctx.beginPath(); ctx.moveTo(cx, 0); var fxr = cx + Math.tan(ang) * h; ctx.lineTo(fxr - 20, h); ctx.lineTo(fxr + 20, h); ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = cc(0.22); ctx.lineWidth = 1.2;
        for (var r = 1; r <= 4; r++) { ctx.beginPath(); ctx.arc(cx, h * 0.5, r * Math.min(w, h) * 0.09, 0, 6.2832); ctx.stroke(); }
        for (var sp = 0; sp < 12; sp++) {
          var a3 = rot + sp / 12 * 6.2832;
          ctx.beginPath(); ctx.moveTo(cx, h * 0.5); ctx.lineTo(cx + Math.cos(a3) * Math.min(w, h) * 0.36, h * 0.5 + Math.sin(a3) * Math.min(w, h) * 0.36); ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
        for (var i = 0; i < 8; i++) {
          var xcol = w * (0.08 + i * 0.11), ch = h * 0.24;
          ctx.fillStyle = 'rgba(60,50,30,0.55)'; ctx.fillRect(xcol - 7, h - ch, 14, ch);
          ctx.fillStyle = 'rgba(90,74,42,0.7)'; ctx.fillRect(xcol - 11, h - ch, 22, 6); ctx.fillRect(xcol - 11, h - 8, 22, 8);
        }
      }
    },

    // —— 虚无命途：黑洞吸积 + 引力透镜环 ——
    nihility: {
      init: function (s) {
        s.ps = [];
        for (var i = 0; i < 230; i++) { var a = Math.random() * 6.283, r = rr(fx.w * 0.1, fx.w * 0.6); s.ps.push({ a: a, sp: 0.002 + Math.random() * 0.002, r: r }); }
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(4,3,8,0.18)'; ctx.fillRect(0, 0, w, h);
        var cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.28;
        ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < s.ps.length; i++) {
          var p = s.ps[i]; p.a += p.sp * (1 + (1 - p.r / (w * 0.6)) * 3); p.r -= 0.35 + (1 - p.r / (w * 0.6)) * 0.8;
          if (p.r < R * 0.35) p.r = w * 0.6 * Math.random() + w * 0.1;
          var x = cx + Math.cos(p.a) * p.r, y = cy + Math.sin(p.a) * p.r * 0.5;
          var a = Math.min(0.7, (1 - p.r / (w * 0.6)) * 0.7 + 0.15);
          ctx.fillStyle = cc(a); ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 6.2832); ctx.fill();
        }
        for (var k = 0; k < 3; k++) { ctx.strokeStyle = cc(0.18 - k * 0.05); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy, R * (1.3 + k * 0.25), R * (0.7 + k * 0.14), 0, 0, 6.2832); ctx.stroke(); }
        ctx.globalCompositeOperation = 'source-over';
        var bg = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.2);
        bg.addColorStop(0, '#000'); bg.addColorStop(0.7, 'rgba(0,0,0,0.9)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(cx, cy, R * 1.2, 0, 6.2832); ctx.fill();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx, cy, R * 0.5, 0, 6.2832); ctx.fill();
      }
    },

    // —— 混沌命途：乱涌流带 + 随机噪点 ——
    turbulence: {
      init: function (s) {
        s.streams = [];
        for (var i = 0; i < 7; i++) s.streams.push({ y: fx.h * (0.15 + 0.12 * i), amp: rr(20, 60), ph: rr(0, 6.283), sp: rr(0.0006, 0.0016), w: rr(1, 3) });
        s.specks = [];
        for (var j = 0; j < 80; j++) s.specks.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vx: rr(-1, 1), vy: rr(-1, 1) });
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(14,8,12,0.16)'; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < s.streams.length; i++) {
          var st = s.streams[i]; ctx.strokeStyle = cc(0.3); ctx.lineWidth = st.w; ctx.beginPath();
          for (var x = 0; x <= w; x += 14) {
            var y = st.y + Math.sin(x * 0.006 + t * st.sp * 6 + st.ph) * st.amp + Math.sin(x * 0.02 + t * 0.0009 + st.ph) * st.amp * 0.4;
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        for (var j = 0; j < s.specks.length; j++) {
          var sp = s.specks[j]; sp.vx += rr(-0.1, 0.1); sp.vy += rr(-0.1, 0.1);
          sp.vx = Math.max(-2, Math.min(2, sp.vx)); sp.vy = Math.max(-2, Math.min(2, sp.vy));
          sp.x += sp.vx; sp.y += sp.vy;
          if (sp.x < 0) sp.x = w; if (sp.x > w) sp.x = 0; if (sp.y < 0) sp.y = h; if (sp.y > h) sp.y = 0;
          ctx.fillStyle = cc(0.4); ctx.beginPath(); ctx.arc(sp.x, sp.y, 1.1, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    // —— 沉沦命途：下坠光痕 + 上浮气泡 ——
    downfall: {
      init: function (s) {
        s.ps = [];
        for (var i = 0; i < 130; i++) s.ps.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vy: rr(0.6, 2), len: rr(6, 22), a: rr(0.15, 0.5) });
        s.bubs = [];
        for (var j = 0; j < 16; j++) s.bubs.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vy: rr(-0.4, -1), r: rr(1, 3) });
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(12,6,10,0.16)'; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < s.ps.length; i++) {
          var p = s.ps[i]; p.y += p.vy;
          if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w; }
          ctx.strokeStyle = cc(p.a); ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - p.len); ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
        for (var j = 0; j < s.bubs.length; j++) {
          var b = s.bubs[j]; b.y += b.vy;
          if (b.y < -10) { b.y = h + 10; b.x = Math.random() * w; }
          ctx.strokeStyle = cc(0.25); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.2832); ctx.stroke();
        }
      }
    },

    // —— 诞育信仰：孢子萌发 ——
    birth: {
      init: function (s) {
        s.spores = [];
        for (var i = 0; i < 60; i++) s.spores.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vx: rr(-0.2, 0.2), vy: rr(-0.35, -0.05), r: rr(1.5, 4), ph: rr(0, 6.283) });
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(6,14,8,0.15)'; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < s.spores.length; i++) {
          var p = s.spores[i]; p.x += p.vx + Math.sin(t * 0.001 + p.ph) * 0.2; p.y += p.vy;
          if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
          if (p.x < -10) p.x = w + 10; if (p.x > w + 10) p.x = -10;
          var pr = p.r * (1 + 0.2 * Math.sin(t * 0.002 + p.ph));
          var gg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, pr * 4);
          gg.addColorStop(0, cc(0.5)); gg.addColorStop(1, cc(0));
          ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(p.x, p.y, pr * 4, 0, 6.2832); ctx.fill();
          ctx.fillStyle = cc(0.6); ctx.beginPath(); ctx.arc(p.x, p.y, pr, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    // —— 繁荣信仰：繁花飘落 ——
    bloom: {
      init: function (s) {
        s.petals = [];
        for (var i = 0; i < 80; i++) s.petals.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vy: rr(0.4, 1), ph: rr(0, 6.283), rot: rr(0, 6.283), spin: rr(-0.03, 0.03), sz: rr(3, 7) });
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(8,16,8,0.15)'; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < s.petals.length; i++) {
          var p = s.petals[i]; p.y += p.vy; p.x += Math.sin(t * 0.0012 + p.ph) * 0.8; p.rot += p.spin;
          if (p.y > h + 12) { p.y = -12; p.x = Math.random() * w; }
          ctx.fillStyle = cc(0.4); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.beginPath(); ctx.ellipse(0, 0, p.sz, p.sz * 0.5, 0, 0, 6.2832); ctx.fill(); ctx.restore();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    // —— 死亡信仰：安眠灰烬 ——
    death: {
      init: function (s) {
        s.motes = [];
        for (var i = 0; i < 50; i++) s.motes.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vy: rr(0.15, 0.4), ph: rr(0, 6.283), r: rr(0.6, 1.8) });
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(10,11,14,0.14)'; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        var gg = ctx.createRadialGradient(w / 2, h * 0.5, 0, w / 2, h * 0.5, Math.max(w, h) * 0.5);
        gg.addColorStop(0, cc(0.10)); gg.addColorStop(1, cc(0));
        ctx.fillStyle = gg; ctx.fillRect(0, 0, w, h);
        for (var i = 0; i < s.motes.length; i++) {
          var m = s.motes[i]; m.y += m.vy; m.x += Math.sin(t * 0.0006 + m.ph) * 0.15;
          if (m.y > h + 8) { m.y = -8; m.x = Math.random() * w; }
          ctx.fillStyle = cc(0.3 + 0.2 * Math.sin(t * 0.002 + m.ph));
          ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    // —— 记忆信仰：梵高《星夜》笔触流场 + 星芒 ——
    vanGogh: {
      init: function (s) {
        s.strokes = [];
        var n = Math.min(760, Math.round(fx.w * fx.h / 2200));
        for (var i = 0; i < n; i++) s.strokes.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, life: rr(40, 200), len: rr(6, 16), w: rr(1.4, 3.4) });
        s.stars = [];
        for (var j = 0; j < 9; j++) s.stars.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, r: rr(6, 16), ph: rr(0, 6.283) });
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(6,10,30,0.10)'; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        var sc = 0.0035, tsc = t * 0.00022;
        for (var i = 0; i < s.strokes.length; i++) {
          var st = s.strokes[i];
          var a1 = Math.sin(st.x * sc + tsc) + Math.cos(st.y * sc * 1.3 - tsc * 0.8);
          var a2 = Math.cos(st.x * sc * 1.2 - tsc * 0.9) + Math.sin(st.y * sc - tsc * 1.1);
          st.x += a1 * 0.95; st.y += a2 * 0.95; st.life--;
          if (st.life < 0 || st.x < -20 || st.x > w + 20 || st.y < -20 || st.y > h + 20) { st.x = Math.random() * w; st.y = Math.random() * h; st.life = rr(40, 200); }
          var ang = Math.atan2(a2, a1), hue = (a1 + a2) * 0.5;
          ctx.strokeStyle = 'rgba(' + Math.round(120 + hue * 40) + ',' + Math.round(150 + hue * 55) + ',255,' + (0.10 + 0.12 * Math.abs(hue)) + ')';
          ctx.lineWidth = st.w;
          ctx.beginPath(); ctx.moveTo(st.x, st.y); ctx.lineTo(st.x + Math.cos(ang) * st.len, st.y + Math.sin(ang) * st.len); ctx.stroke();
        }
        for (var j = 0; j < s.stars.length; j++) {
          var sr = s.stars[j], a = 0.5 + 0.5 * Math.sin(t * 0.004 + sr.ph);
          var gg = ctx.createRadialGradient(sr.x, sr.y, 0, sr.x, sr.y, sr.r * 3);
          gg.addColorStop(0, 'rgba(255,245,210,' + (0.5 * a) + ')');
          gg.addColorStop(0.4, 'rgba(200,210,255,' + (0.25 * a) + ')');
          gg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(sr.x, sr.y, sr.r * 3, 0, 6.2832); ctx.fill();
          ctx.strokeStyle = 'rgba(255,240,200,' + (0.3 * a) + ')'; ctx.lineWidth = 1.4;
          for (var q = 0; q < 4; q++) {
            var qa = q * Math.PI / 2 + sr.ph;
            ctx.beginPath(); ctx.moveTo(sr.x + Math.cos(qa) * sr.r * 0.6, sr.y + Math.sin(qa) * sr.r * 0.6); ctx.lineTo(sr.x + Math.cos(qa) * sr.r * 1.5, sr.y + Math.sin(qa) * sr.r * 1.5); ctx.stroke();
          }
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    // —— 时间信仰：沙漏 + 摆锤 ——
    time: {
      init: function (s) {
        s.grains = [];
        for (var i = 0; i < 120; i++) s.grains.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vy: rr(0.4, 1.2), r: rr(0.6, 1.6) });
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(16,14,8,0.15)'; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        var cx = w / 2, cy = h / 2;
        ctx.strokeStyle = cc(0.2); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(cx - 90, cy - 120); ctx.lineTo(cx + 90, cy - 120); ctx.lineTo(cx + 12, cy); ctx.lineTo(cx + 90, cy + 120); ctx.lineTo(cx - 90, cy + 120); ctx.lineTo(cx - 12, cy); ctx.closePath(); ctx.stroke();
        for (var i = 0; i < s.grains.length; i++) {
          var g = s.grains[i]; g.y += g.vy;
          if (Math.abs(g.x - cx) < 90 && g.y > cy && g.y < cy + 120) g.x += (cx - g.x) * 0.02;
          if (g.y > h) { g.y = cy - 120 + Math.random() * 20; g.x = cx - 80 + Math.random() * 160; }
          ctx.fillStyle = cc(0.6); ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, 6.2832); ctx.fill();
        }
        var pend = Math.sin(t * 0.001) * 0.5;
        var px = w - 60 + Math.sin(pend) * 100, py = h * 0.2 + Math.cos(pend) * 140;
        ctx.strokeStyle = cc(0.35); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(w - 60, h * 0.2); ctx.lineTo(px, py); ctx.stroke();
        ctx.fillStyle = cc(0.6); ctx.beginPath(); ctx.arc(px, py, 8, 0, 6.2832); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    // —— 秩序信仰：罗盘 + 刻度 + 对称轴 ——
    order: {
      init: function () {},
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(16,14,8,0.16)'; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        var cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.3, rot = t * 0.0001;
        ctx.strokeStyle = cc(0.3); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.stroke();
        for (var i = 0; i < 60; i++) {
          var a = i / 60 * 6.2832, big = i % 5 === 0;
          ctx.strokeStyle = cc(big ? 0.4 : 0.18); ctx.lineWidth = big ? 1.6 : 1;
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (R - (big ? 12 : 6)), cy + Math.sin(a) * (R - (big ? 12 : 6))); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke();
        }
        var na = rot * 2;
        ctx.strokeStyle = cc(0.6); ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(cx - Math.cos(na) * R * 0.7, cy - Math.sin(na) * R * 0.7); ctx.lineTo(cx + Math.cos(na) * R * 0.7, cy + Math.sin(na) * R * 0.7); ctx.stroke();
        ctx.strokeStyle = cc(0.14); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    // —— 真理信仰：真知书页 + 放射光 ——
    truth: {
      init: function (s) {
        s.pages = [];
        for (var i = 0; i < 12; i++) s.pages.push({ x: rr(fx.w * 0.1, fx.w * 0.9), y: rr(fx.h * 0.1, fx.h * 0.9), rot: rr(-0.5, 0.5), sp: rr(-0.01, 0.01), vx: rr(-0.2, 0.2), vy: rr(-0.15, 0.15) });
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(18,16,8,0.15)'; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        var cx = w / 2, cy = h * 0.5;
        var gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.4);
        gg.addColorStop(0, cc(0.25)); gg.addColorStop(1, cc(0));
        ctx.fillStyle = gg; ctx.fillRect(0, 0, w, h);
        for (var r = 0; r < 12; r++) {
          var a = r / 12 * 6.2832 + t * 0.0002;
          ctx.strokeStyle = cc(0.2); ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 20, cy + Math.sin(a) * 20); ctx.lineTo(cx + Math.cos(a) * Math.min(w, h) * 0.45, cy + Math.sin(a) * Math.min(w, h) * 0.45); ctx.stroke();
        }
        for (var i = 0; i < s.pages.length; i++) {
          var p = s.pages[i]; p.x += p.vx; p.y += p.vy; p.rot += p.sp;
          if (p.x < 0) p.x = w; if (p.x > w) p.x = 0; if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = cc(0.15); ctx.strokeStyle = cc(0.4); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.rect(-12, -15, 24, 30); ctx.fill(); ctx.stroke();
          for (var ln = -8; ln <= 8; ln += 6) { ctx.beginPath(); ctx.moveTo(-8, ln); ctx.lineTo(8, ln); ctx.strokeStyle = cc(0.3); ctx.stroke(); }
          ctx.restore();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    // —— 战争信仰：战场烈焰 + 狼烟 ——
    war: {
      init: function (s) {
        s.flames = [];
        for (var i = 0; i < 40; i++) s.flames.push({ x: Math.random() * fx.w, y: fx.h + Math.random() * fx.h * 0.5, vy: rr(0.6, 1.6), r: rr(6, 20), ph: rr(0, 6.283) });
        s.smoke = [];
        for (var j = 0; j < 14; j++) s.smoke.push({ x: Math.random() * fx.w, y: fx.h, r: rr(24, 70), vy: rr(0.2, 0.6), a: rr(0.03, 0.08) });
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(12,6,4,0.16)'; ctx.fillRect(0, 0, w, h);
        var g = ctx.createLinearGradient(0, h, 0, h * 0.3);
        g.addColorStop(0, cc(0.25)); g.addColorStop(1, cc(0));
        ctx.fillStyle = g; ctx.fillRect(0, h * 0.3, w, h * 0.7);
        for (var j = 0; j < s.smoke.length; j++) {
          var sm = s.smoke[j]; sm.y -= sm.vy; sm.x += Math.sin(t * 0.0008 + sm.r) * 0.4;
          if (sm.y < -sm.r) { sm.y = h + sm.r; sm.x = Math.random() * w; }
          var sg = ctx.createRadialGradient(sm.x, sm.y, 0, sm.x, sm.y, sm.r);
          sg.addColorStop(0, 'rgba(60,50,50,' + sm.a + ')'); sg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sm.x, sm.y, sm.r, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < s.flames.length; i++) {
          var fl = s.flames[i]; fl.y -= fl.vy; fl.x += Math.sin(t * 0.003 + fl.ph) * 1.2;
          if (fl.y < -fl.r) { fl.y = h + fl.r; fl.x = Math.random() * w; }
          var fg = ctx.createRadialGradient(fl.x, fl.y, 0, fl.x, fl.y, fl.r);
          fg.addColorStop(0, 'rgba(255,180,80,0.5)'); fg.addColorStop(0.5, cc(0.28)); fg.addColorStop(1, cc(0));
          ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(fl.x, fl.y, fl.r, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    // —— 欺诈信仰：漂浮假面 ——
    deceit: {
      init: function (s) {
        s.masks = [];
        for (var i = 0; i < 9; i++) s.masks.push({ x: rr(fx.w * 0.1, fx.w * 0.9), y: rr(fx.h * 0.15, fx.h * 0.85), sc: rr(0.7, 1.5), vx: rr(-0.25, 0.25), vy: rr(-0.2, 0.2), ph: rr(0, 6.283) });
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(12,8,18,0.15)'; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < s.masks.length; i++) {
          var m = s.masks[i]; m.x += m.vx; m.y += m.vy;
          if (m.x < 0) m.x = w; if (m.x > w) m.x = 0; if (m.y < 0) m.y = h; if (m.y > h) m.y = 0;
          var flick = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.004 + m.ph));
          ctx.save(); ctx.translate(m.x, m.y); ctx.scale(m.sc, m.sc);
          ctx.strokeStyle = cc(0.5 * flick); ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(-16, -14); ctx.quadraticCurveTo(0, -26, 16, -14); ctx.quadraticCurveTo(16, 6, 0, 18); ctx.quadraticCurveTo(-16, 6, -16, -14); ctx.stroke();
          ctx.beginPath(); ctx.arc(-6, -6, 2, 0, 6.2832); ctx.arc(6, -6, 2, 0, 6.2832); ctx.stroke();
          ctx.restore();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    // —— 命运信仰：星轨 + 翻滚骰子 ——
    fate: {
      init: function (s) {
        s.dice = [];
        for (var i = 0; i < 6; i++) s.dice.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, sz: rr(14, 26), rot: rr(0, 6.283), spin: rr(-0.03, 0.03), vx: rr(-0.5, 0.5), vy: rr(-0.4, 0.4) });
        s.arcs = [];
        for (var j = 0; j < 6; j++) s.arcs.push({ ph: rr(0, 6.283), sp: rr(0.0008, 0.0016), r: rr(60, 160) });
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(10,8,18,0.15)'; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        var cx = w / 2, cy = h / 2;
        for (var j = 0; j < s.arcs.length; j++) {
          var ar = s.arcs[j];
          ctx.strokeStyle = cc(0.2); ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.arc(cx, cy, ar.r, t * ar.sp + ar.ph, t * ar.sp + ar.ph + 1.2); ctx.stroke();
          var aa = t * ar.sp + ar.ph + 1.2;
          ctx.fillStyle = cc(0.6); ctx.beginPath(); ctx.arc(cx + Math.cos(aa) * ar.r, cy + Math.sin(aa) * ar.r, 2.4, 0, 6.2832); ctx.fill();
        }
        for (var i = 0; i < s.dice.length; i++) {
          var d = s.dice[i]; d.x += d.vx; d.y += d.vy; d.rot += d.spin;
          if (d.x < 0) d.x = w; if (d.x > w) d.x = 0; if (d.y < 0) d.y = h; if (d.y > h) d.y = 0;
          ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot);
          ctx.strokeStyle = cc(0.5); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.rect(-d.sz / 2, -d.sz / 2, d.sz, d.sz); ctx.stroke();
          var pp = [[0, 0], [-1, -1], [1, 1], [1, -1], [-1, 1]];
          for (var k = 0; k < pp.length; k++) { ctx.beginPath(); ctx.arc(pp[k][0] * d.sz * 0.25, pp[k][1] * d.sz * 0.25, 1.6, 0, 6.2832); ctx.fillStyle = cc(0.5); ctx.fill(); }
          ctx.restore();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    // —— 混乱信仰：狂乱飞散 + 数字故障 ——
    chaosGod: {
      init: function (s) {
        s.specks = [];
        for (var i = 0; i < 170; i++) s.specks.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vx: rr(-2, 2), vy: rr(-2, 2), ph: rr(0, 6.283) });
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(16,6,12,0.16)'; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < s.specks.length; i++) {
          var p = s.specks[i]; p.vx += rr(-0.15, 0.15); p.vy += rr(-0.15, 0.15);
          p.vx = Math.max(-3, Math.min(3, p.vx)); p.vy = Math.max(-3, Math.min(3, p.vy));
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0) p.x = w; if (p.x > w) p.x = 0; if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
          ctx.fillStyle = cc(0.45); ctx.beginPath(); ctx.arc(p.x, p.y, 1.2 + Math.abs(Math.sin(t * 0.01 + p.ph)), 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        if (Math.random() < 0.06) { var gy = Math.random() * h, gh = rr(2, 10); ctx.fillStyle = cc(0.06); ctx.fillRect(0, gy, w, gh); }
      }
    },

    // —— 沉默信仰：极静，偶发一圈极慢涟漪 ——
    silence: {
      init: function (s) {
        s.ripple = { r: 0, a: 0 };
        s.dust = [];
        for (var i = 0; i < 14; i++) s.dust.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, r: rr(0.4, 1) });
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(9,10,14,0.12)'; ctx.fillRect(0, 0, w, h);
        var cx = w / 2, cy = h / 2;
        ctx.globalCompositeOperation = 'lighter';
        if (s.ripple.a <= 0 && Math.random() < 0.002) { s.ripple.r = 10; s.ripple.a = 0.5; }
        if (s.ripple.a > 0) { s.ripple.r += 0.5; s.ripple.a -= 0.0012; ctx.strokeStyle = cc(s.ripple.a); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, s.ripple.r, 0, 6.2832); ctx.stroke(); }
        for (var i = 0; i < s.dust.length; i++) { var d = s.dust[i]; d.y += 0.05; if (d.y > h) d.y = 0; ctx.fillStyle = cc(0.12); ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.2832); ctx.fill(); }
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    // —— 痴愚信仰：醉步乱飘的痴念 ——
    folly: {
      init: function (s) {
        s.motes = [];
        for (var i = 0; i < 60; i++) s.motes.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vx: rr(-0.4, 0.4), vy: rr(-0.5, -0.1), ph: rr(0, 6.283), wob: rr(0.5, 2), r: rr(1, 3) });
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(16,12,4,0.15)'; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < s.motes.length; i++) {
          var m = s.motes[i];
          m.x += m.vx + Math.sin(t * 0.004 + m.ph) * m.wob; m.y += m.vy + Math.cos(t * 0.005 + m.ph) * m.wob * 0.7;
          if (m.y < -10 || m.x < -10 || m.x > w + 10) { m.y = h + 10; m.x = Math.random() * w; }
          var a = 0.4 + 0.5 * Math.abs(Math.sin(t * 0.006 + m.ph));
          ctx.fillStyle = cc(0.7 * a); ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    // —— 污堕信仰：黏稠滴落 + 瘴气 ——
    corruption: {
      init: function (s) {
        s.drips = [];
        for (var i = 0; i < 44; i++) s.drips.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vy: rr(0.5, 1.4), len: rr(4, 16), r: rr(1.5, 3.5) });
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(12,6,14,0.15)'; ctx.fillRect(0, 0, w, h);
        var mg = ctx.createLinearGradient(0, h, 0, 0);
        mg.addColorStop(0, cc(0.14)); mg.addColorStop(1, cc(0));
        ctx.fillStyle = mg; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < s.drips.length; i++) {
          var d = s.drips[i]; d.y += d.vy;
          if (d.y > h + d.r) { d.y = -d.r - Math.random() * 40; d.x = Math.random() * w; }
          ctx.fillStyle = cc(0.55);
          ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r + d.len, 0, 0, 6.2832); ctx.fill();
          ctx.beginPath(); ctx.arc(d.x, d.y + d.r + d.len, d.r * 1.2, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    // —— 腐朽信仰：锈蚀碎屑簌簌坠落 ——
    decay: {
      init: function (s) {
        s.flakes = [];
        for (var i = 0; i < 60; i++) s.flakes.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vy: rr(0.3, 0.9), ph: rr(0, 6.283), rot: rr(0, 6.283), sz: rr(2, 5), crumble: rr(0, 6.283) });
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(10,12,6,0.15)'; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < s.flakes.length; i++) {
          var f = s.flakes[i]; f.y += f.vy; f.x += Math.sin(t * 0.001 + f.ph) * 0.4; f.rot += 0.01;
          if (f.y > h + 10) { f.y = -10; f.x = Math.random() * w; }
          var a = 0.4 + 0.3 * Math.sin(t * 0.004 + f.crumble);
          ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.fillStyle = cc(a); ctx.fillRect(-f.sz / 2, -f.sz / 2, f.sz, f.sz * 0.6); ctx.restore();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    // —— 湮灭信仰：坍缩→爆散→归零 循环 ——
    annihilate: {
      init: function (s) { s.phase = 0; s.timer = 0; s.dust = []; s.ring = 0; },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(10,4,6,0.16)'; ctx.fillRect(0, 0, w, h);
        var cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.34;
        s.timer++;
        if (s.phase === 0) { s.ring = Math.max(0, s.ring - 0.02); if (s.timer > 90) { s.phase = 1; s.timer = 0; } }
        else if (s.phase === 1) { s.ring += 0.03; if (s.ring >= 1) { s.phase = 2; s.timer = 0; s.ring = 1; } }
        else { s.ring = Math.max(0, s.ring - 0.03); if (s.timer > 40 && s.ring <= 0) { s.phase = 0; s.timer = 0; s.ring = 0; } }
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = cc(0.5); ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.arc(cx, cy, R * (0.2 + s.ring * 0.8), 0, 6.2832); ctx.stroke();
        if (s.phase === 2 && s.ring < 0.4) s.dust.push({ x: cx, y: cy, vx: rr(-3, 3), vy: rr(-3, 3), life: 1 });
        for (var i = s.dust.length - 1; i >= 0; i--) {
          var d = s.dust[i]; d.x += d.vx; d.y += d.vy; d.life -= 0.01;
          if (d.life <= 0) { s.dust.splice(i, 1); continue; }
          ctx.fillStyle = cc(d.life * 0.6); ctx.beginPath(); ctx.arc(d.x, d.y, d.life * 2, 0, 6.2832); ctx.fill();
        }
        var gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * (0.3 + s.ring));
        gg.addColorStop(0, cc(0.05 + s.ring * 0.15)); gg.addColorStop(1, cc(0));
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(cx, cy, R * (0.3 + s.ring), 0, 6.2832); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  };

  function sceneInit() {
    var name = SCENES[fx.scene] ? fx.scene : 'flow';
    fx.scene = name;
    fx.s = {};
    SCENES[name].init(fx.s);
    fx.needClear = true;
  }
  function fxFrame(t) {
    if (!fx.running) return;
    var ctx = fx.ctx, w = fx.w, h = fx.h;
    if (fx.needClear) { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(8,7,16,1)'; ctx.fillRect(0, 0, w, h); fx.needClear = false; }
    else { ctx.globalCompositeOperation = 'source-over'; }
    var sc = SCENES[fx.scene] || SCENES.flow;
    sc.draw(ctx, w, h, t, fx.s, fx.color);
    ctx.globalCompositeOperation = 'source-over';
    fx.raf = requestAnimationFrame(fxFrame);
  }
  function onFxResize() {
    if (!fx.running) return;
    fxResize(); sceneInit();
  }
  window.chatFxStart = function () {
    if (reduceMotion()) return;
    fx.canvas = document.getElementById('chatFx');
    if (!fx.canvas) return;
    fx.ctx = fx.canvas.getContext('2d');
    if (!fx.ctx) return;
    fxResize(); sceneInit();
    fx.running = true;
    cancelAnimationFrame(fx.raf);
    fx.raf = requestAnimationFrame(fxFrame);
    window.addEventListener('resize', onFxResize);
  };
  window.chatFxStop = function () {
    fx.running = false;
    if (fx.raf) cancelAnimationFrame(fx.raf);
    fx.raf = 0;
  };
  window.chatFxSetScene = function (hex, scene) {
    fx.color = hexToRgb(hex);
    var changed = scene && scene !== fx.scene;
    if (scene) fx.scene = scene;
    if (fx.running && changed) sceneInit();
  };
  // 兼容旧接口
  window.chatFxSetColor = window.chatFxSetScene;
  window.chatFxBurst = window.chatFxSetScene;
})();

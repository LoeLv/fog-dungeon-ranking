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

    // —— 生命命途：藤蔓生长 + 繁花绽放 + 花粉光尘 ——
    life: {
      init: function (s) {
        s.vines = [];
        for (var i = 0; i < 9; i++) {
          var pts = [], x0 = fx.w * (0.05 + 0.11 * i), curl = rr(-0.7, 0.7), maxs = Math.floor(rr(fx.h * 0.35, fx.h * 0.8) / 8);
          for (var k = 0; k <= maxs; k++) pts.push({ x: x0 + Math.sin(k * 0.42 + curl) * (10 + k * 1.1), y: fx.h - k * 8 });
          var fls = [], nf = Math.floor(rr(2, 4));
          for (var f = 0; f < nf; f++) fls.push({ at: Math.random(), sz: rr(3, 6.5), ph: rr(0, 6.283) });
          s.vines.push({ pts: pts, grow: 0, spd: rr(0.5, 1.1), flowers: fls });
        }
        s.pollen = [];
        for (var j = 0; j < 70; j++) s.pollen.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vy: rr(-1.1, -0.2), vx: rr(-0.3, 0.3), r: rr(1, 2.6), ph: rr(0, 6.283) });
        s.leaves = [];
        for (var l = 0; l < 30; l++) s.leaves.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vy: rr(0.3, 0.7), ph: rr(0, 6.283), rot: rr(0, 6.283) });
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(6,16,9,0.14)'; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < s.vines.length; i++) {
          var v = s.vines[i]; if (v.grow < v.pts.length) v.grow += v.spd;
          var lim = Math.min(v.pts.length, Math.floor(v.grow));
          ctx.strokeStyle = 'rgba(96,205,110,0.55)'; ctx.lineWidth = 2.6;
          ctx.beginPath();
          for (var k = 0; k < lim; k++) { if (k === 0) ctx.moveTo(v.pts[k].x, v.pts[k].y); else ctx.lineTo(v.pts[k].x, v.pts[k].y); }
          ctx.stroke();
          for (var k2 = 1; k2 < lim; k2 += 3) {
            var pt = v.pts[k2];
            ctx.save(); ctx.translate(pt.x, pt.y); ctx.rotate(k2 * 0.7);
            ctx.fillStyle = 'rgba(70,180,90,0.42)';
            ctx.beginPath(); ctx.ellipse(7, 0, 6, 2.6, 0, 0, 6.2832); ctx.fill();
            ctx.beginPath(); ctx.ellipse(-7, 0, 6, 2.6, 0, 0, 6.2832); ctx.fill();
            ctx.restore();
          }
          if (lim >= v.pts.length) {
            var tip = v.pts[v.pts.length - 1], pr = 5 + Math.sin(t * 0.003 + i) * 1.8;
            var gg = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, pr * 5);
            gg.addColorStop(0, cc(0.7)); gg.addColorStop(1, cc(0));
            ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(tip.x, tip.y, pr * 5, 0, 6.2832); ctx.fill();
          }
          for (var f = 0; f < v.flowers.length; f++) {
            var fl = v.flowers[f]; if (fl.at > v.grow / v.pts.length) continue;
            var fi = Math.min(lim - 1, Math.floor(fl.at * v.pts.length)); if (fi < 0) continue;
            var flp = v.pts[fi];
            var bloom = 0.6 + 0.4 * Math.sin(t * 0.004 + fl.ph);
            var fg = ctx.createRadialGradient(flp.x, flp.y, 0, flp.x, flp.y, fl.sz * 3.2);
            fg.addColorStop(0, cc(0.85 * bloom)); fg.addColorStop(0.4, cc(0.4 * bloom)); fg.addColorStop(1, cc(0));
            ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(flp.x, flp.y, fl.sz * 3.2, 0, 6.2832); ctx.fill();
            for (var pt2 = 0; pt2 < 5; pt2++) {
              var pa = pt2 / 5 * 6.2832 + t * 0.0006;
              ctx.fillStyle = cc(0.7 * bloom);
              ctx.beginPath(); ctx.ellipse(flp.x + Math.cos(pa) * fl.sz, flp.y + Math.sin(pa) * fl.sz, fl.sz * 0.7, fl.sz * 0.4, pa, 0, 6.2832); ctx.fill();
            }
            ctx.fillStyle = cc(0.9); ctx.beginPath(); ctx.arc(flp.x, flp.y, fl.sz * 0.5, 0, 6.2832); ctx.fill();
          }
        }
        for (var j = 0; j < s.pollen.length; j++) {
          var po = s.pollen[j]; po.x += po.vx + Math.sin(t * 0.002 + po.ph) * 0.4; po.y += po.vy;
          if (po.y < -8) { po.y = h + 8; po.x = Math.random() * w; }
          var a2 = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.004 + po.ph));
          var pg = ctx.createRadialGradient(po.x, po.y, 0, po.x, po.y, po.r * 4);
          pg.addColorStop(0, cc(0.7 * a2)); pg.addColorStop(1, cc(0));
          ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(po.x, po.y, po.r * 4, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        for (var l = 0; l < s.leaves.length; l++) {
          var lf = s.leaves[l]; lf.y += lf.vy; lf.x += Math.sin(t * 0.001 + lf.ph) * 0.6;
          if (lf.y > h + 10) { lf.y = -10; lf.x = Math.random() * w; }
          ctx.fillStyle = cc(0.32); ctx.save(); ctx.translate(lf.x, lf.y); ctx.rotate(lf.rot + t * 0.0009);
          ctx.beginPath(); ctx.ellipse(0, 0, 6, 2.8, 0, 0, 6.2832); ctx.fill(); ctx.restore();
        }
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

    // —— 文明命途：辉光圣殿 + 列柱神像 + 旋转曼陀罗 ——
    civilization: {
      init: function (s) {
        s.motes = [];
        for (var i = 0; i < 60; i++) s.motes.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vy: rr(-0.5, -0.1), r: rr(0.8, 2.2), ph: rr(0, 6.283) });
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(18,15,8,0.15)'; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        var cx = w / 2, rot = t * 0.00012;
        var dome = ctx.createRadialGradient(cx, h * 0.42, 0, cx, h * 0.42, Math.min(w, h) * 0.7);
        dome.addColorStop(0, cc(0.28)); dome.addColorStop(0.4, cc(0.1)); dome.addColorStop(1, cc(0));
        ctx.fillStyle = dome; ctx.fillRect(0, 0, w, h);
        for (var b = 0; b < 9; b++) {
          var ang = (b - 4) * 0.1;
          var bg = ctx.createLinearGradient(cx, 0, cx, h);
          bg.addColorStop(0, cc(0.2)); bg.addColorStop(1, cc(0));
          ctx.fillStyle = bg;
          ctx.beginPath(); ctx.moveTo(cx, 0); var fxr = cx + Math.tan(ang) * h; ctx.lineTo(fxr - 24, h); ctx.lineTo(fxr + 24, h); ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = cc(0.3); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, h * 0.42, Math.min(w, h) * 0.34, Math.PI, 0); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, h * 0.42, Math.min(w, h) * 0.4, Math.PI + 0.3, -0.3); ctx.stroke();
        for (var r = 1; r <= 4; r++) { ctx.beginPath(); ctx.arc(cx, h * 0.46, r * Math.min(w, h) * 0.08, 0, 6.2832); ctx.stroke(); }
        for (var sp = 0; sp < 16; sp++) {
          var a3 = rot + sp / 16 * 6.2832;
          ctx.beginPath(); ctx.moveTo(cx, h * 0.46); ctx.lineTo(cx + Math.cos(a3) * Math.min(w, h) * 0.34, h * 0.46 + Math.sin(a3) * Math.min(w, h) * 0.34); ctx.stroke();
        }
        var core = ctx.createRadialGradient(cx, h * 0.46, 0, cx, h * 0.46, Math.min(w, h) * 0.14);
        core.addColorStop(0, cc(0.6)); core.addColorStop(1, cc(0));
        ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, h * 0.46, Math.min(w, h) * 0.14, 0, 6.2832); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        var ncol = 9;
        for (var i = 0; i < ncol; i++) {
          var xcol = w * (0.05 + i * 0.11), ch = h * 0.34;
          var cg = ctx.createLinearGradient(xcol - 12, 0, xcol + 12, 0);
          cg.addColorStop(0, 'rgba(40,33,20,0.85)'); cg.addColorStop(0.5, 'rgba(120,100,60,0.9)'); cg.addColorStop(1, 'rgba(40,33,20,0.85)');
          ctx.fillStyle = cg; ctx.fillRect(xcol - 10, h - ch, 20, ch);
          ctx.fillStyle = 'rgba(150,128,80,0.85)';
          ctx.fillRect(xcol - 15, h - ch - 8, 30, 8); ctx.fillRect(xcol - 15, h - 14, 30, 14);
          ctx.fillRect(xcol - 13, h - ch + 6, 26, 5);
          ctx.globalCompositeOperation = 'lighter';
          var pg = ctx.createRadialGradient(xcol, h - ch - 4, 0, xcol, h - ch - 4, 22);
          pg.addColorStop(0, cc(0.5)); pg.addColorStop(1, cc(0));
          ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(xcol, h - ch - 4, 22, 0, 6.2832); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        }
        var scx = cx, sby = h;
        ctx.fillStyle = 'rgba(180,158,100,0.92)';
        ctx.fillRect(scx - 30, sby - 26, 60, 26);
        ctx.fillStyle = 'rgba(150,130,80,0.95)';
        ctx.beginPath(); ctx.moveTo(scx, sby - 130); ctx.lineTo(scx - 22, sby - 26); ctx.lineTo(scx + 22, sby - 26); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(scx, sby - 140, 15, 0, 6.2832); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        var sg = ctx.createRadialGradient(scx, sby - 100, 0, scx, sby - 100, 120);
        sg.addColorStop(0, cc(0.5)); sg.addColorStop(1, cc(0));
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(scx, sby - 100, 120, 0, 6.2832); ctx.fill();
        for (var m = 0; m < s.motes.length; m++) {
          var mo = s.motes[m]; mo.y += mo.vy; mo.x += Math.sin(t * 0.002 + mo.ph) * 0.3;
          if (mo.y < -8) { mo.y = h + 8; mo.x = Math.random() * w; }
          ctx.fillStyle = cc(0.3 + 0.4 * Math.abs(Math.sin(t * 0.003 + mo.ph)));
          ctx.beginPath(); ctx.arc(mo.x, mo.y, mo.r, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    // —— 虚无命途：黑洞深渊 + 虚空裂隙（华丽版）——
    nihility: {
      init: function (s) {
        // 被吸入的星尘（沿椭圆轨道螺旋坠向奇点）
        s.dust = [];
        for (var i = 0; i < 360; i++) s.dust.push({ a: Math.random() * 6.2832, r: rr(0.5, 1.9), sp: rr(0.0028, 0.0105), sz: rr(0.6, 2.3), lum: Math.random(), trail: rr(0.05, 0.2) });
        // 背景星野
        s.stars = [];
        for (var si = 0; si < 110; si++) s.stars.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, sz: rr(0.4, 1.4), ph: rr(0, 6.283), sp: rr(0.0006, 0.0022) });
        // 暗物质涟漪
        s.ripples = [];
        for (var j = 0; j < 6; j++) s.ripples.push({ r: 0.18 + j * 0.27 });
        // 暗蓝星云团
        s.nebula = [];
        for (var k = 0; k < 8; k++) s.nebula.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, r: rr(fx.w * 0.2, fx.w * 0.52), vx: rr(-0.15, 0.15), vy: rr(-0.09, 0.09), hue: Math.random() < 0.5 });
        // 虚空裂隙
        s.rift = null; s.riftTimer = Math.floor(rr(150, 280));
        s.verses = ['吞尽万象，归寂空冥', '黑涡吞星，万籁归无', '消弭一切，本自空无'];
        // 边缘折射微光
        s.lens = [];
        for (var m = 0; m < 84; m++) s.lens.push({ a: Math.random() * 6.2832, sz: rr(0.5, 1.6), ph: rr(0, 6.283) });
      },
      draw: function (ctx, w, h, t, s) {
        // 深黑紫宇宙背景（低频拖尾）
        ctx.fillStyle = 'rgba(6,4,14,0.18)'; ctx.fillRect(0, 0, w, h);
        var cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.15;
        var rot = t * 0.00014;

        // —— 背景星野（细碎闪烁）——
        for (var si = 0; si < s.stars.length; si++) {
          var st = s.stars[si]; var sa = 0.22 + 0.5 * Math.abs(Math.sin(st.ph + t * st.sp));
          ctx.fillStyle = 'rgba(205,205,255,' + sa + ')';
          ctx.beginPath(); ctx.arc(st.x, st.y, st.sz, 0, 6.2832); ctx.fill();
        }

        // —— 暗蓝星云 + 稀薄暗物质带 ——
        for (var k = 0; k < s.nebula.length; k++) {
          var nb = s.nebula[k]; nb.x += nb.vx; nb.y += nb.vy;
          if (nb.x < -nb.r) nb.x = w + nb.r; if (nb.x > w + nb.r) nb.x = -nb.r;
          if (nb.y < -nb.r) nb.y = h + nb.r; if (nb.y > h + nb.r) nb.y = -nb.r;
          var ng = ctx.createRadialGradient(nb.x, nb.y, 0, nb.x, nb.y, nb.r);
          if (nb.hue) { ng.addColorStop(0, 'rgba(52,42,128,0.15)'); ng.addColorStop(1, 'rgba(22,14,56,0)'); }
          else { ng.addColorStop(0, 'rgba(30,58,140,0.14)'); ng.addColorStop(1, 'rgba(12,20,58,0)'); }
          ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(nb.x, nb.y, nb.r, 0, 6.2832); ctx.fill();
        }

        // —— 暗物质涟漪：一圈圈扩散 ——
        for (var j = 0; j < s.ripples.length; j++) {
          var rp = s.ripples[j]; rp.r += 0.001; if (rp.r > 1.9) rp.r = 0.18;
          var pra = Math.max(0, 1 - (rp.r - 0.18) / 1.72) * 0.16;
          ctx.strokeStyle = 'rgba(132,120,216,' + pra + ')'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.ellipse(cx, cy, R * rp.r * 2.7, R * rp.r * 1.05, 0, 0, 6.2832); ctx.stroke();
        }

        ctx.globalCompositeOperation = 'lighter';

        // —— 引力透镜晕环（黑洞前后弯卷的光）——
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot * 0.6);
        for (var g = 0; g < 3; g++) {
          var gr = R * (1.15 + g * 0.22);
          var gg = ctx.createLinearGradient(0, -gr, 0, gr);
          gg.addColorStop(0, 'rgba(180,150,255,0)');
          gg.addColorStop(0.5, 'rgba(214,186,255,' + (0.3 - g * 0.07) + ')');
          gg.addColorStop(1, 'rgba(180,150,255,0)');
          ctx.strokeStyle = gg; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.ellipse(0, 0, gr * 0.55, gr, 0, 0, 6.2832); ctx.stroke();
        }
        ctx.restore();

        // —— 吸积盘主体：多层旋转椭圆带（内热白紫 → 外深紫）——
        var bands = 30;
        for (var b = 0; b < bands; b++) {
          var fr = b / bands;
          var br = 0.9 + fr * 1.25;
          var cr = Math.round(236 - fr * 116), cg = Math.round(228 - fr * 138), cb = Math.round(255 - fr * 35);
          var bright = (1 - fr) * 0.5 + 0.07;
          ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot * (1 - fr * 0.45));
          var grad = ctx.createLinearGradient(-R * br * 2.7, 0, R * br * 2.7, 0);
          grad.addColorStop(0, 'rgba(' + cr + ',' + cg + ',' + cb + ',0)');
          grad.addColorStop(0.5, 'rgba(' + cr + ',' + cg + ',' + cb + ',' + bright + ')');
          grad.addColorStop(1, 'rgba(' + cr + ',' + cg + ',' + cb + ',0)');
          ctx.strokeStyle = grad; ctx.lineWidth = 2.6 - fr * 1.1;
          ctx.beginPath(); ctx.ellipse(0, 0, R * br * 2.7, R * br * 1.05, 0, 0, 6.2832); ctx.stroke();
          ctx.restore();
        }

        // —— 星尘被拉成弧线吸入中心 ——
        for (var i = 0; i < s.dust.length; i++) {
          var p = s.dust[i];
          p.a += p.sp * (1 + (1.9 - p.r) * 1.9);
          p.r -= 0.0011 + (1.9 - p.r) * 0.0021;
          if (p.r < 0.3) { p.r = 1.9; p.a = Math.random() * 6.2832; p.lum = Math.random(); }
          var x = cx + Math.cos(p.a) * R * p.r * 2.7;
          var y = cy + Math.sin(p.a) * R * p.r * 1.05;
          var aa = Math.min(0.96, (1.9 - p.r) * 0.5 + 0.16);
          var col = p.lum < 0.5 ? 'rgba(168,140,255,' + aa + ')' : 'rgba(130,188,255,' + aa + ')';
          var px = cx + Math.cos(p.a - p.trail) * R * (p.r + 0.055) * 2.7;
          var py = cy + Math.sin(p.a - p.trail) * R * (p.r + 0.055) * 1.05;
          ctx.strokeStyle = col; ctx.lineWidth = p.sz * 0.8;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
          ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, p.sz, 0, 6.2832); ctx.fill();
        }

        // —— 光子环（明亮细环 + 外发光）——
        ctx.strokeStyle = 'rgba(232,212,255,0.9)'; ctx.lineWidth = 3.0;
        ctx.beginPath(); ctx.arc(cx, cy, R * 1.0, 0, 6.2832); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,246,222,1)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(cx, cy, R * 1.0, 0, 6.2832); ctx.stroke();

        ctx.globalCompositeOperation = 'source-over';

        // —— 事件视界：纯黑奇点 + 引力暗晕 ——
        var bh = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.05);
        bh.addColorStop(0, 'rgba(0,0,0,1)');
        bh.addColorStop(0.6, 'rgba(0,0,0,0.99)');
        bh.addColorStop(0.82, 'rgba(14,8,30,0.5)');
        bh.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bh; ctx.beginPath(); ctx.arc(cx, cy, R * 1.05, 0, 6.2832); ctx.fill();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx, cy, R * 0.66, 0, 6.2832); ctx.fill();

        // —— 边缘空间折射 ——
        ctx.globalCompositeOperation = 'lighter';
        for (var L = 0; L < 2; L++) {
          var lr = R * (1.7 + L * 0.6);
          var lg = ctx.createLinearGradient(cx - lr, cy - lr, cx + lr, cy + lr);
          lg.addColorStop(0, 'rgba(120,110,220,0)');
          lg.addColorStop(0.5, 'rgba(158,146,244,' + (0.13 - L * 0.05) + ')');
          lg.addColorStop(1, 'rgba(120,110,220,0)');
          ctx.strokeStyle = lg; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(cx, cy, lr, 0, 6.2832); ctx.stroke();
        }
        for (var m2 = 0; m2 < s.lens.length; m2++) {
          var ln = s.lens[m2];
          var lr2 = R * (1.5 + Math.abs(Math.sin(ln.ph + t * 0.0006)) * 0.9);
          var lx = cx + Math.cos(ln.a) * lr2, ly = cy + Math.sin(ln.a) * lr2 * 0.62;
          var la = 0.16 + 0.18 * Math.abs(Math.sin(t * 0.002 + ln.ph));
          ctx.fillStyle = 'rgba(178,158,255,' + la + ')';
          ctx.beginPath(); ctx.arc(lx, ly, ln.sz, 0, 6.2832); ctx.fill();
        }

        // —— 虚空裂隙：偶发撕裂，露出内部紫白光芒 ——
        if (!s.rift) {
          s.riftTimer -= 1;
          if (s.riftTimer <= 0) s.rift = { x: cx + rr(-R * 2.5, R * 2.5), y: cy + rr(-R * 1.6, R * 1.6), rot: rr(-0.5, 0.5), len: rr(R * 1.5, R * 2.8), life: 48, max: 48 };
        } else {
          s.rift.life -= 1;
          if (s.rift.life <= 0) { s.rift = null; s.riftTimer = Math.floor(rr(170, 340)); }
          else {
            var rf = s.rift, open = Math.sin((1 - rf.life / rf.max) * Math.PI);
            ctx.save(); ctx.translate(rf.x, rf.y); ctx.rotate(rf.rot);
            var rl = rf.len * open, half = rl / 2;
            var rg2 = ctx.createLinearGradient(-half, 0, half, 0);
            rg2.addColorStop(0, 'rgba(180,150,255,0)');
            rg2.addColorStop(0.5, 'rgba(244,236,255,' + (0.92 * open) + ')');
            rg2.addColorStop(1, 'rgba(180,150,255,0)');
            ctx.strokeStyle = rg2; ctx.lineWidth = 2.4;
            ctx.beginPath();
            for (var q = -half; q <= half; q += 5) { var yy = Math.sin(q * 0.13 + t * 0.01) * 3.6 + Math.sin(q * 0.5) * 1.2; if (q === -half) ctx.moveTo(q, yy); else ctx.lineTo(q, yy); }
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = 'rgba(0,0,0,' + (0.9 * open) + ')'; ctx.lineWidth = 3.0;
            ctx.beginPath();
            for (var q2 = -half; q2 <= half; q2 += 5) { var yy2 = Math.sin(q2 * 0.13 + t * 0.01) * 3.6 + Math.sin(q2 * 0.5) * 1.2 - 2.6; if (q2 === -half) ctx.moveTo(q2, yy2); else ctx.lineTo(q2, yy2); }
            ctx.stroke(); ctx.restore();
          }
        }
        // 虚无箴言：循环艺术字（三组诗句轮播）
        (function () {
          var verses = s.verses || ['吞尽万象，归寂空冥', '黑涡吞星，万籁归无', '消弭一切，本自空无'];
          var DUR = 5200, total = verses.length;
          var cp = (t % (DUR * total)) / DUR;
          var fi = Math.floor(cp) % total;
          var lt = cp - Math.floor(cp);
          var a;
          if (lt < 0.16) a = lt / 0.16;
          else if (lt > 0.84) a = (1 - lt) / 0.16;
          else a = 1;
          a = a < 0 ? 0 : (a > 1 ? 1 : a);
          if (a > 0.01) {
            var txt = verses[fi];
            var fs = Math.max(22, Math.min(w * 0.06, h * 0.075, 50));
            var tx = cx, ty = h * 0.80;
            var breathe = 0.5 + 0.5 * Math.sin(t * 0.0016 + fi);
            var rise = (1 - a) * 12;
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            try { ctx.letterSpacing = (fs * 0.30) + 'px'; } catch (e) {}
            ctx.font = '600 ' + fs + 'px "STKaiti","KaiTi","Kaiti SC","Songti SC","Noto Serif SC","SimSun",Georgia,serif';
            ctx.globalAlpha = 0.15 * a;
            ctx.save(); ctx.scale(1, -1);
            var rg = ctx.createLinearGradient(tx - fs * 5, 0, tx + fs * 5, 0);
            rg.addColorStop(0, 'rgba(146,124,236,0.4)');
            rg.addColorStop(0.5, 'rgba(230,224,255,0.9)');
            rg.addColorStop(1, 'rgba(146,124,236,0.4)');
            ctx.fillStyle = rg;
            ctx.fillText(txt, tx, -(ty + rise) - fs * 1.35);
            ctx.restore();
            ctx.globalAlpha = 1;
            ctx.shadowColor = 'rgba(176,146,255,' + (0.85 * a) + ')';
            ctx.shadowBlur = 16 + 12 * breathe;
            var tg = ctx.createLinearGradient(tx - fs * 5, ty, tx + fs * 5, ty);
            tg.addColorStop(0, 'rgba(150,126,240,' + (0.34 * a) + ')');
            tg.addColorStop(0.5, 'rgba(246,242,255,' + (0.99 * a) + ')');
            tg.addColorStop(1, 'rgba(150,126,240,' + (0.34 * a) + ')');
            ctx.fillStyle = tg;
            ctx.fillText(txt, tx, ty + rise);
            ctx.shadowBlur = 0;
            try { ctx.letterSpacing = '0px'; } catch (e) {}
            ctx.restore();
          }
        })();
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    // —— 混沌命途：破碎神殿 + 火山裂谷 + 岩浆河 + 翻涌灰雾 ——
    turbulence: {
      init: function (s) {
        // 地面裂隙（沿裂缝流淌岩浆）
        s.cracks = [];
        var nc = 7;
        for (var i = 0; i < nc; i++) {
          var x0 = (i + 0.5) / nc * fx.w + rr(-fx.w * 0.05, fx.w * 0.05);
          var pts = [], y = fx.h + 12, x = x0, segs = 9;
          pts.push({ x: x, y: y });
          for (var k = 0; k < segs; k++) {
            y -= fx.h / segs * rr(0.7, 1.25);
            x += rr(-fx.w * 0.06, fx.w * 0.06);
            pts.push({ x: x, y: y });
          }
          s.cracks.push({ pts: pts, ph: rr(0, 6.283), sp: rr(0.0012, 0.0026), w: rr(2.6, 6) });
        }
        // 远处破碎柱体 / 断拱（神话残骸剪影）
        s.columns = [];
        for (var c = 0; c < 9; c++) {
          s.columns.push({
            x: rr(fx.w * 0.05, fx.w * 0.95),
            y: rr(fx.h * 0.44, fx.h * 0.68),
            w: rr(fx.w * 0.012, fx.w * 0.03),
            h: rr(fx.h * 0.10, fx.h * 0.30),
            lean: rr(-0.12, 0.12),
            ph: rr(0, 6.283),
            arch: Math.random() < 0.35
          });
        }
        // 悬浮碎石
        s.rocks = [];
        for (var r = 0; r < 16; r++) {
          var rp = [], n = 5 + (r % 3);
          for (var q = 0; q < n; q++) { var a = q / n * 6.2832; var rad = rr(5, 14); rp.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad }); }
          s.rocks.push({ x: Math.random() * fx.w, y: rr(fx.h * 0.12, fx.h * 0.7), pts: rp, rot: rr(0, 6.283), spin: rr(-0.012, 0.012), vx: rr(-0.25, 0.25), vy: rr(-0.16, -0.02), ph: rr(0, 6.283), sz: rr(0.7, 1.5) });
        }
        // 翻涌火山灰雾
        s.fog = [];
        for (var f = 0; f < 9; f++) {
          s.fog.push({ x: Math.random() * fx.w, y: rr(fx.h * 0.35, fx.h * 0.9), r: rr(fx.w * 0.24, fx.w * 0.5), vx: rr(0.2, 0.6) * (Math.random() < 0.5 ? 1 : -1), vy: rr(-0.05, 0.05), a: rr(0.05, 0.12) });
        }
        // 上升余烬
        s.embers = [];
        for (var e = 0; e < 110; e++) {
          s.embers.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vy: rr(-1.4, -0.3), vx: rr(-0.5, 0.5), r: rr(0.7, 2.3), ph: rr(0, 6.283) });
        }
        // 火焰冲击
        s.burst = { life: 0, max: 0, cx: 0, cy: 0, next: rr(220, 460) };
        s.verses = ['裂碎纲常，乱起洪荒', '熔岩崩宇，雾荡狂澜', '毁弃定则，无有常形'];
      },
      draw: function (ctx, w, h, t, s) {
        // 暗红色天幕（低频拖尾）
        ctx.fillStyle = 'rgba(16,7,11,0.22)'; ctx.fillRect(0, 0, w, h);
        // —— 火山灰天空 / 地平线炽光 ——
        var sky = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, 'rgba(40,10,16,0.55)');
        sky.addColorStop(0.55, 'rgba(60,16,18,0.30)');
        sky.addColorStop(1, 'rgba(120,40,20,0.28)');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
        // —— 远处破碎柱体 / 断裂拱桥 ——
        for (var c = 0; c < s.columns.length; c++) {
          var col = s.columns[c];
          var rim = 0.25 + 0.2 * Math.abs(Math.sin(col.ph + t * 0.0015));
          ctx.save(); ctx.translate(col.x, col.y); ctx.rotate(col.lean);
          ctx.fillStyle = 'rgba(20,9,10,0.92)';
          ctx.fillRect(-col.w / 2, -col.h, col.w, col.h + 6);
          ctx.beginPath(); ctx.moveTo(-col.w / 2, -col.h);
          ctx.lineTo(-col.w * 0.1, -col.h - col.w * 0.9);
          ctx.lineTo(col.w * 0.2, -col.h - col.w * 0.3);
          ctx.lineTo(col.w / 2, -col.h - col.w * 0.7);
          ctx.lineTo(col.w / 2, -col.h); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(200,70,40,' + rim + ')'; ctx.lineWidth = 1.1;
          ctx.strokeRect(-col.w / 2, -col.h, col.w, col.h);
          if (col.arch) {
            ctx.strokeStyle = 'rgba(180,60,40,' + (rim * 0.8) + ')'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(-col.w * 1.1, -col.h * 0.55, col.w * 1.1, Math.PI, Math.PI * 1.6); ctx.stroke();
          }
          ctx.restore();
        }
        ctx.globalCompositeOperation = 'lighter';
        // —— 地面裂隙：呼吸式明灭 + 岩浆河流 ——
        for (var i = 0; i < s.cracks.length; i++) {
          var ck = s.cracks[i];
          var breath = 0.45 + 0.55 * Math.abs(Math.sin(t * ck.sp + ck.ph));
          ctx.strokeStyle = 'rgba(10,4,5,0.9)'; ctx.lineWidth = ck.w * 1.7; ctx.lineJoin = 'round';
          ctx.beginPath();
          for (var k = 0; k < ck.pts.length; k++) { if (k === 0) ctx.moveTo(ck.pts[k].x, ck.pts[k].y); else ctx.lineTo(ck.pts[k].x, ck.pts[k].y); }
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255,' + Math.floor(110 + 90 * breath) + ',40,' + (0.55 + 0.4 * breath) + ')';
          ctx.lineWidth = ck.w * (0.5 + 0.3 * breath);
          ctx.shadowColor = 'rgba(255,140,40,' + (0.5 * breath) + ')';
          ctx.shadowBlur = 14;
          ctx.beginPath();
          for (var k2 = 0; k2 < ck.pts.length; k2++) { if (k2 === 0) ctx.moveTo(ck.pts[k2].x, ck.pts[k2].y); else ctx.lineTo(ck.pts[k2].x, ck.pts[k2].y); }
          ctx.stroke();
          ctx.shadowBlur = 0;
          var pulsePos = (t * 0.0006 + i * 0.13) % 1;
          var pi = Math.min(ck.pts.length - 1, Math.floor(pulsePos * ck.pts.length));
          var pp = ck.pts[pi];
          var pg = ctx.createRadialGradient(pp.x, pp.y, 0, pp.x, pp.y, 26);
          pg.addColorStop(0, 'rgba(255,' + Math.floor(180 + 60 * breath) + ',90,' + (0.7 * breath) + ')');
          pg.addColorStop(1, 'rgba(255,140,40,0)');
          ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(pp.x, pp.y, 26, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        // —— 中层：横向翻卷的火山灰雾 ——
        for (var f2 = 0; f2 < s.fog.length; f2++) {
          var fg2 = s.fog[f2]; fg2.x += fg2.vx; fg2.y += fg2.vy;
          if (fg2.x < -fg2.r) fg2.x = w + fg2.r; if (fg2.x > w + fg2.r) fg2.x = -fg2.r;
          if (fg2.y < -fg2.r) fg2.y = h + fg2.r; if (fg2.y > h + fg2.r) fg2.y = -fg2.r;
          var flick = 0.75 + 0.25 * Math.sin(t * 0.0016 + f2 * 1.3);
          var g2 = ctx.createRadialGradient(fg2.x, fg2.y, 0, fg2.x, fg2.y, fg2.r);
          g2.addColorStop(0, 'rgba(78,30,26,' + (fg2.a * flick) + ')');
          g2.addColorStop(1, 'rgba(40,16,16,0)');
          ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(fg2.x, fg2.y, fg2.r, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'lighter';
        // —— 上层：悬浮碎石缓慢翻转 + 炽热边缘 ——
        for (var r2 = 0; r2 < s.rocks.length; r2++) {
          var rk = s.rocks[r2]; rk.x += rk.vx; rk.y += rk.vy; rk.rot += rk.spin;
          if (rk.y < -40) { rk.y = h + 30; rk.x = Math.random() * w; }
          if (rk.x < -40) rk.x = w + 40; if (rk.x > w + 40) rk.x = -40;
          var glow = 0.5 + 0.5 * Math.sin(t * 0.004 + rk.ph);
          ctx.save(); ctx.translate(rk.x, rk.y); ctx.rotate(rk.rot); ctx.scale(rk.sz, rk.sz);
          ctx.fillStyle = 'rgba(26,10,9,0.92)';
          ctx.beginPath();
          for (var k3 = 0; k3 < rk.pts.length; k3++) { if (k3 === 0) ctx.moveTo(rk.pts[k3].x, rk.pts[k3].y); else ctx.lineTo(rk.pts[k3].x, rk.pts[k3].y); }
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(255,' + Math.floor(90 + glow * 90) + ',45,' + (0.7 * glow) + ')';
          ctx.lineWidth = 1.4; ctx.stroke();
          ctx.restore();
        }
        // —— 上升余烬 ——
        for (var e2 = 0; e2 < s.embers.length; e2++) {
          var em = s.embers[e2]; em.x += em.vx + Math.sin(t * 0.003 + em.ph) * 0.3; em.y += em.vy;
          if (em.y < -10) { em.y = h + 10; em.x = Math.random() * w; }
          var a2 = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.005 + em.ph));
          var eg = ctx.createRadialGradient(em.x, em.y, 0, em.x, em.y, em.r * 4);
          eg.addColorStop(0, 'rgba(255,' + Math.floor(140 + 80 * a2) + ',60,' + a2 + ')');
          eg.addColorStop(1, 'rgba(255,140,60,0)');
          ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(em.x, em.y, em.r * 4, 0, 6.2832); ctx.fill();
        }
        // —— 火焰冲击：偶发爆发，照亮整个背景 ——
        var bu = s.burst;
        bu.next -= 1;
        if (bu.next <= 0 && bu.life <= 0) {
          bu.life = bu.max = 60;
          bu.cx = rr(w * 0.2, w * 0.8);
          bu.cy = rr(h * 0.45, h * 0.8);
          bu.next = rr(260, 520);
        }
        if (bu.life > 0) {
          bu.life -= 1;
          var bp = bu.life / bu.max;
          var radius = (1 - bp) * Math.max(w, h) * 0.7 + 40;
          var bg = ctx.createRadialGradient(bu.cx, bu.cy, 0, bu.cx, bu.cy, radius);
          bg.addColorStop(0, 'rgba(255,' + Math.floor(220 * bp + 90) + ',120,' + (0.5 * bp) + ')');
          bg.addColorStop(0.4, 'rgba(255,120,40,' + (0.28 * bp) + ')');
          bg.addColorStop(1, 'rgba(255,80,20,0)');
          ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(bu.cx, bu.cy, radius, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        // 混沌箴言：循环艺术字（三组诗句轮播）
        (function () {
          var verses = s.verses || ['裂碎纲常，乱起洪荒', '熔岩崩宇，雾荡狂澜', '毁弃定则，无有常形'];
          var DUR = 5200, total = verses.length;
          var cp = (t % (DUR * total)) / DUR;
          var fi = Math.floor(cp) % total;
          var lt = cp - Math.floor(cp);
          var a;
          if (lt < 0.16) a = lt / 0.16;
          else if (lt > 0.84) a = (1 - lt) / 0.16;
          else a = 1;
          a = a < 0 ? 0 : (a > 1 ? 1 : a);
          if (a > 0.01) {
            var txt = verses[fi];
            var fs = Math.max(22, Math.min(w * 0.06, h * 0.075, 50));
            var tx = w / 2, ty = h * 0.80;
            var breathe = 0.5 + 0.5 * Math.sin(t * 0.0016 + fi);
            var rise = (1 - a) * 12;
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            try { ctx.letterSpacing = (fs * 0.30) + 'px'; } catch (e) {}
            ctx.font = '600 ' + fs + 'px "STKaiti","KaiTi","Kaiti SC","Songti SC","Noto Serif SC","SimSun",Georgia,serif';
            ctx.globalAlpha = 0.15 * a;
            ctx.save(); ctx.scale(1, -1);
            var rg = ctx.createLinearGradient(tx - fs * 5, 0, tx + fs * 5, 0);
            rg.addColorStop(0, 'rgba(255,150,90,0.4)');
            rg.addColorStop(0.5, 'rgba(255,236,214,0.9)');
            rg.addColorStop(1, 'rgba(255,150,90,0.4)');
            ctx.fillStyle = rg;
            ctx.fillText(txt, tx, -(ty + rise) - fs * 1.35);
            ctx.restore();
            ctx.globalAlpha = 1;
            ctx.shadowColor = 'rgba(255,170,80,' + (0.85 * a) + ')';
            ctx.shadowBlur = 16 + 12 * breathe;
            var tg = ctx.createLinearGradient(tx - fs * 5, ty, tx + fs * 5, ty);
            tg.addColorStop(0, 'rgba(255,140,70,' + (0.4 * a) + ')');
            tg.addColorStop(0.5, 'rgba(255,246,232,' + (0.99 * a) + ')');
            tg.addColorStop(1, 'rgba(255,140,70,' + (0.4 * a) + ')');
            ctx.fillStyle = tg;
            ctx.fillText(txt, tx, ty + rise);
            ctx.shadowBlur = 0;
            try { ctx.letterSpacing = '0px'; } catch (e) {}
            ctx.restore();
          }
        })();
      }
    },

    // —— 沉沦命途：坍塌残骸 + 飘落絮状物 + 下沉尘光 ——
    downfall: {
      init: function (s) {
        s.debris = [];
        for (var i = 0; i < 34; i++) s.debris.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vy: rr(0.4, 1.3), vx: rr(-0.25, 0.25), sz: rr(3, 10), rot: rr(0, 6.283), spin: rr(-0.02, 0.02) });
        s.wisps = [];
        for (var j = 0; j < 26; j++) s.wisps.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vy: rr(0.25, 0.8), vx: rr(-0.2, 0.2), r: rr(4, 12), ph: rr(0, 6.283) });
        s.dust = [];
        for (var d = 0; d < 50; d++) s.dust.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vy: rr(0.6, 1.6), r: rr(0.6, 1.8) });
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(12,6,12,0.16)'; ctx.fillRect(0, 0, w, h);
        for (var j = 0; j < s.wisps.length; j++) {
          var wp = s.wisps[j]; wp.x += wp.vx + Math.sin(t * 0.001 + wp.ph) * 0.5; wp.y += wp.vy;
          if (wp.y > h + wp.r) { wp.y = -wp.r; wp.x = Math.random() * w; }
          var a = 0.09 + 0.07 * Math.abs(Math.sin(t * 0.002 + wp.ph));
          var g = ctx.createRadialGradient(wp.x, wp.y, 0, wp.x, wp.y, wp.r);
          g.addColorStop(0, cc(a)); g.addColorStop(1, cc(0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(wp.x, wp.y, wp.r, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < s.debris.length; i++) {
          var db = s.debris[i]; db.x += db.vx; db.y += db.vy; db.rot += db.spin;
          if (db.y > h + 16) { db.y = -16; db.x = Math.random() * w; }
          if (db.x < -16) db.x = w + 16; if (db.x > w + 16) db.x = -16;
          ctx.save(); ctx.translate(db.x, db.y); ctx.rotate(db.rot);
          ctx.fillStyle = 'rgba(40,22,34,0.85)'; ctx.fillRect(-db.sz / 2, -db.sz / 2, db.sz, db.sz);
          ctx.strokeStyle = cc(0.5); ctx.lineWidth = 1;
          ctx.strokeRect(-db.sz / 2, -db.sz / 2, db.sz, db.sz);
          ctx.restore();
        }
        for (var d = 0; d < s.dust.length; d++) {
          var du = s.dust[d]; du.y += du.vy;
          if (du.y > h + 6) { du.y = -6; du.x = Math.random() * w; }
          ctx.fillStyle = cc(0.15 + 0.2 * Math.abs(Math.sin(t * 0.004 + du.x)));
          ctx.beginPath(); ctx.arc(du.x, du.y, du.r, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
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

    // —— 生命命途：藤蔓生长 + 繁花绽放 + 花粉光尘 ——
    life: {
      init: function (s) {
        s.vines = [];
        for (var i = 0; i < 9; i++) {
          var pts = [], x0 = fx.w * (0.05 + 0.11 * i), curl = rr(-0.7, 0.7), maxs = Math.floor(rr(fx.h * 0.35, fx.h * 0.8) / 8);
          for (var k = 0; k <= maxs; k++) pts.push({ x: x0 + Math.sin(k * 0.42 + curl) * (10 + k * 1.1), y: fx.h - k * 8 });
          var fls = [], nf = Math.floor(rr(2, 4));
          for (var f = 0; f < nf; f++) fls.push({ at: Math.random(), sz: rr(3, 6.5), ph: rr(0, 6.283) });
          s.vines.push({ pts: pts, grow: 0, spd: rr(0.5, 1.1), flowers: fls });
        }
        s.pollen = [];
        for (var j = 0; j < 70; j++) s.pollen.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vy: rr(-1.1, -0.2), vx: rr(-0.3, 0.3), r: rr(1, 2.6), ph: rr(0, 6.283) });
        s.leaves = [];
        for (var l = 0; l < 30; l++) s.leaves.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vy: rr(0.3, 0.7), ph: rr(0, 6.283), rot: rr(0, 6.283) });
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(6,16,9,0.14)'; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < s.vines.length; i++) {
          var v = s.vines[i]; if (v.grow < v.pts.length) v.grow += v.spd;
          var lim = Math.min(v.pts.length, Math.floor(v.grow));
          ctx.strokeStyle = 'rgba(96,205,110,0.55)'; ctx.lineWidth = 2.6;
          ctx.beginPath();
          for (var k = 0; k < lim; k++) { if (k === 0) ctx.moveTo(v.pts[k].x, v.pts[k].y); else ctx.lineTo(v.pts[k].x, v.pts[k].y); }
          ctx.stroke();
          for (var k2 = 1; k2 < lim; k2 += 3) {
            var pt = v.pts[k2];
            ctx.save(); ctx.translate(pt.x, pt.y); ctx.rotate(k2 * 0.7);
            ctx.fillStyle = 'rgba(70,180,90,0.42)';
            ctx.beginPath(); ctx.ellipse(7, 0, 6, 2.6, 0, 0, 6.2832); ctx.fill();
            ctx.beginPath(); ctx.ellipse(-7, 0, 6, 2.6, 0, 0, 6.2832); ctx.fill();
            ctx.restore();
          }
          if (lim >= v.pts.length) {
            var tip = v.pts[v.pts.length - 1], pr = 5 + Math.sin(t * 0.003 + i) * 1.8;
            var gg = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, pr * 5);
            gg.addColorStop(0, cc(0.7)); gg.addColorStop(1, cc(0));
            ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(tip.x, tip.y, pr * 5, 0, 6.2832); ctx.fill();
          }
          for (var f = 0; f < v.flowers.length; f++) {
            var fl = v.flowers[f]; if (fl.at > v.grow / v.pts.length) continue;
            var fi = Math.min(lim - 1, Math.floor(fl.at * v.pts.length)); if (fi < 0) continue;
            var flp = v.pts[fi];
            var bloom = 0.6 + 0.4 * Math.sin(t * 0.004 + fl.ph);
            var fg = ctx.createRadialGradient(flp.x, flp.y, 0, flp.x, flp.y, fl.sz * 3.2);
            fg.addColorStop(0, cc(0.85 * bloom)); fg.addColorStop(0.4, cc(0.4 * bloom)); fg.addColorStop(1, cc(0));
            ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(flp.x, flp.y, fl.sz * 3.2, 0, 6.2832); ctx.fill();
            for (var pt2 = 0; pt2 < 5; pt2++) {
              var pa = pt2 / 5 * 6.2832 + t * 0.0006;
              ctx.fillStyle = cc(0.7 * bloom);
              ctx.beginPath(); ctx.ellipse(flp.x + Math.cos(pa) * fl.sz, flp.y + Math.sin(pa) * fl.sz, fl.sz * 0.7, fl.sz * 0.4, pa, 0, 6.2832); ctx.fill();
            }
            ctx.fillStyle = cc(0.9); ctx.beginPath(); ctx.arc(flp.x, flp.y, fl.sz * 0.5, 0, 6.2832); ctx.fill();
          }
        }
        for (var j = 0; j < s.pollen.length; j++) {
          var po = s.pollen[j]; po.x += po.vx + Math.sin(t * 0.002 + po.ph) * 0.4; po.y += po.vy;
          if (po.y < -8) { po.y = h + 8; po.x = Math.random() * w; }
          var a2 = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.004 + po.ph));
          var pg = ctx.createRadialGradient(po.x, po.y, 0, po.x, po.y, po.r * 4);
          pg.addColorStop(0, cc(0.7 * a2)); pg.addColorStop(1, cc(0));
          ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(po.x, po.y, po.r * 4, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        for (var l = 0; l < s.leaves.length; l++) {
          var lf = s.leaves[l]; lf.y += lf.vy; lf.x += Math.sin(t * 0.001 + lf.ph) * 0.6;
          if (lf.y > h + 10) { lf.y = -10; lf.x = Math.random() * w; }
          ctx.fillStyle = cc(0.32); ctx.save(); ctx.translate(lf.x, lf.y); ctx.rotate(lf.rot + t * 0.0009);
          ctx.beginPath(); ctx.ellipse(0, 0, 6, 2.8, 0, 0, 6.2832); ctx.fill(); ctx.restore();
        }
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

    // —— 文明命途：辉光圣殿 + 列柱神像 + 旋转曼陀罗 ——
    civilization: {
      init: function (s) {
        s.motes = [];
        for (var i = 0; i < 60; i++) s.motes.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vy: rr(-0.5, -0.1), r: rr(0.8, 2.2), ph: rr(0, 6.283) });
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(18,15,8,0.15)'; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        var cx = w / 2, rot = t * 0.00012;
        var dome = ctx.createRadialGradient(cx, h * 0.42, 0, cx, h * 0.42, Math.min(w, h) * 0.7);
        dome.addColorStop(0, cc(0.28)); dome.addColorStop(0.4, cc(0.1)); dome.addColorStop(1, cc(0));
        ctx.fillStyle = dome; ctx.fillRect(0, 0, w, h);
        for (var b = 0; b < 9; b++) {
          var ang = (b - 4) * 0.1;
          var bg = ctx.createLinearGradient(cx, 0, cx, h);
          bg.addColorStop(0, cc(0.2)); bg.addColorStop(1, cc(0));
          ctx.fillStyle = bg;
          ctx.beginPath(); ctx.moveTo(cx, 0); var fxr = cx + Math.tan(ang) * h; ctx.lineTo(fxr - 24, h); ctx.lineTo(fxr + 24, h); ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = cc(0.3); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, h * 0.42, Math.min(w, h) * 0.34, Math.PI, 0); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, h * 0.42, Math.min(w, h) * 0.4, Math.PI + 0.3, -0.3); ctx.stroke();
        for (var r = 1; r <= 4; r++) { ctx.beginPath(); ctx.arc(cx, h * 0.46, r * Math.min(w, h) * 0.08, 0, 6.2832); ctx.stroke(); }
        for (var sp = 0; sp < 16; sp++) {
          var a3 = rot + sp / 16 * 6.2832;
          ctx.beginPath(); ctx.moveTo(cx, h * 0.46); ctx.lineTo(cx + Math.cos(a3) * Math.min(w, h) * 0.34, h * 0.46 + Math.sin(a3) * Math.min(w, h) * 0.34); ctx.stroke();
        }
        var core = ctx.createRadialGradient(cx, h * 0.46, 0, cx, h * 0.46, Math.min(w, h) * 0.14);
        core.addColorStop(0, cc(0.6)); core.addColorStop(1, cc(0));
        ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, h * 0.46, Math.min(w, h) * 0.14, 0, 6.2832); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        var ncol = 9;
        for (var i = 0; i < ncol; i++) {
          var xcol = w * (0.05 + i * 0.11), ch = h * 0.34;
          var cg = ctx.createLinearGradient(xcol - 12, 0, xcol + 12, 0);
          cg.addColorStop(0, 'rgba(40,33,20,0.85)'); cg.addColorStop(0.5, 'rgba(120,100,60,0.9)'); cg.addColorStop(1, 'rgba(40,33,20,0.85)');
          ctx.fillStyle = cg; ctx.fillRect(xcol - 10, h - ch, 20, ch);
          ctx.fillStyle = 'rgba(150,128,80,0.85)';
          ctx.fillRect(xcol - 15, h - ch - 8, 30, 8); ctx.fillRect(xcol - 15, h - 14, 30, 14);
          ctx.fillRect(xcol - 13, h - ch + 6, 26, 5);
          ctx.globalCompositeOperation = 'lighter';
          var pg = ctx.createRadialGradient(xcol, h - ch - 4, 0, xcol, h - ch - 4, 22);
          pg.addColorStop(0, cc(0.5)); pg.addColorStop(1, cc(0));
          ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(xcol, h - ch - 4, 22, 0, 6.2832); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        }
        var scx = cx, sby = h;
        ctx.fillStyle = 'rgba(180,158,100,0.92)';
        ctx.fillRect(scx - 30, sby - 26, 60, 26);
        ctx.fillStyle = 'rgba(150,130,80,0.95)';
        ctx.beginPath(); ctx.moveTo(scx, sby - 130); ctx.lineTo(scx - 22, sby - 26); ctx.lineTo(scx + 22, sby - 26); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(scx, sby - 140, 15, 0, 6.2832); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        var sg = ctx.createRadialGradient(scx, sby - 100, 0, scx, sby - 100, 120);
        sg.addColorStop(0, cc(0.5)); sg.addColorStop(1, cc(0));
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(scx, sby - 100, 120, 0, 6.2832); ctx.fill();
        for (var m = 0; m < s.motes.length; m++) {
          var mo = s.motes[m]; mo.y += mo.vy; mo.x += Math.sin(t * 0.002 + mo.ph) * 0.3;
          if (mo.y < -8) { mo.y = h + 8; mo.x = Math.random() * w; }
          ctx.fillStyle = cc(0.3 + 0.4 * Math.abs(Math.sin(t * 0.003 + mo.ph)));
          ctx.beginPath(); ctx.arc(mo.x, mo.y, mo.r, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    // —— 虚无命途：黑洞深渊 + 虚空裂隙（华丽版）——
    nihility: {
      init: function (s) {
        // 被吸入的星尘（沿椭圆轨道螺旋坠向奇点）
        s.dust = [];
        for (var i = 0; i < 360; i++) s.dust.push({ a: Math.random() * 6.2832, r: rr(0.5, 1.9), sp: rr(0.0028, 0.0105), sz: rr(0.6, 2.3), lum: Math.random(), trail: rr(0.05, 0.2) });
        // 背景星野
        s.stars = [];
        for (var si = 0; si < 110; si++) s.stars.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, sz: rr(0.4, 1.4), ph: rr(0, 6.283), sp: rr(0.0006, 0.0022) });
        // 暗物质涟漪
        s.ripples = [];
        for (var j = 0; j < 6; j++) s.ripples.push({ r: 0.18 + j * 0.27 });
        // 暗蓝星云团
        s.nebula = [];
        for (var k = 0; k < 8; k++) s.nebula.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, r: rr(fx.w * 0.2, fx.w * 0.52), vx: rr(-0.15, 0.15), vy: rr(-0.09, 0.09), hue: Math.random() < 0.5 });
        // 虚空裂隙
        s.rift = null; s.riftTimer = Math.floor(rr(150, 280));
        s.verses = ['吞尽万象，归寂空冥', '黑涡吞星，万籁归无', '消弭一切，本自空无'];
        // 边缘折射微光
        s.lens = [];
        for (var m = 0; m < 84; m++) s.lens.push({ a: Math.random() * 6.2832, sz: rr(0.5, 1.6), ph: rr(0, 6.283) });
      },
      draw: function (ctx, w, h, t, s) {
        // 深黑紫宇宙背景（低频拖尾）
        ctx.fillStyle = 'rgba(6,4,14,0.18)'; ctx.fillRect(0, 0, w, h);
        var cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.15;
        var rot = t * 0.00014;

        // —— 背景星野（细碎闪烁）——
        for (var si = 0; si < s.stars.length; si++) {
          var st = s.stars[si]; var sa = 0.22 + 0.5 * Math.abs(Math.sin(st.ph + t * st.sp));
          ctx.fillStyle = 'rgba(205,205,255,' + sa + ')';
          ctx.beginPath(); ctx.arc(st.x, st.y, st.sz, 0, 6.2832); ctx.fill();
        }

        // —— 暗蓝星云 + 稀薄暗物质带 ——
        for (var k = 0; k < s.nebula.length; k++) {
          var nb = s.nebula[k]; nb.x += nb.vx; nb.y += nb.vy;
          if (nb.x < -nb.r) nb.x = w + nb.r; if (nb.x > w + nb.r) nb.x = -nb.r;
          if (nb.y < -nb.r) nb.y = h + nb.r; if (nb.y > h + nb.r) nb.y = -nb.r;
          var ng = ctx.createRadialGradient(nb.x, nb.y, 0, nb.x, nb.y, nb.r);
          if (nb.hue) { ng.addColorStop(0, 'rgba(52,42,128,0.15)'); ng.addColorStop(1, 'rgba(22,14,56,0)'); }
          else { ng.addColorStop(0, 'rgba(30,58,140,0.14)'); ng.addColorStop(1, 'rgba(12,20,58,0)'); }
          ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(nb.x, nb.y, nb.r, 0, 6.2832); ctx.fill();
        }

        // —— 暗物质涟漪：一圈圈扩散 ——
        for (var j = 0; j < s.ripples.length; j++) {
          var rp = s.ripples[j]; rp.r += 0.001; if (rp.r > 1.9) rp.r = 0.18;
          var pra = Math.max(0, 1 - (rp.r - 0.18) / 1.72) * 0.16;
          ctx.strokeStyle = 'rgba(132,120,216,' + pra + ')'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.ellipse(cx, cy, R * rp.r * 2.7, R * rp.r * 1.05, 0, 0, 6.2832); ctx.stroke();
        }

        ctx.globalCompositeOperation = 'lighter';

        // —— 引力透镜晕环（黑洞前后弯卷的光）——
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot * 0.6);
        for (var g = 0; g < 3; g++) {
          var gr = R * (1.15 + g * 0.22);
          var gg = ctx.createLinearGradient(0, -gr, 0, gr);
          gg.addColorStop(0, 'rgba(180,150,255,0)');
          gg.addColorStop(0.5, 'rgba(214,186,255,' + (0.3 - g * 0.07) + ')');
          gg.addColorStop(1, 'rgba(180,150,255,0)');
          ctx.strokeStyle = gg; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.ellipse(0, 0, gr * 0.55, gr, 0, 0, 6.2832); ctx.stroke();
        }
        ctx.restore();

        // —— 吸积盘主体：多层旋转椭圆带（内热白紫 → 外深紫）——
        var bands = 30;
        for (var b = 0; b < bands; b++) {
          var fr = b / bands;
          var br = 0.9 + fr * 1.25;
          var cr = Math.round(236 - fr * 116), cg = Math.round(228 - fr * 138), cb = Math.round(255 - fr * 35);
          var bright = (1 - fr) * 0.5 + 0.07;
          ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot * (1 - fr * 0.45));
          var grad = ctx.createLinearGradient(-R * br * 2.7, 0, R * br * 2.7, 0);
          grad.addColorStop(0, 'rgba(' + cr + ',' + cg + ',' + cb + ',0)');
          grad.addColorStop(0.5, 'rgba(' + cr + ',' + cg + ',' + cb + ',' + bright + ')');
          grad.addColorStop(1, 'rgba(' + cr + ',' + cg + ',' + cb + ',0)');
          ctx.strokeStyle = grad; ctx.lineWidth = 2.6 - fr * 1.1;
          ctx.beginPath(); ctx.ellipse(0, 0, R * br * 2.7, R * br * 1.05, 0, 0, 6.2832); ctx.stroke();
          ctx.restore();
        }

        // —— 星尘被拉成弧线吸入中心 ——
        for (var i = 0; i < s.dust.length; i++) {
          var p = s.dust[i];
          p.a += p.sp * (1 + (1.9 - p.r) * 1.9);
          p.r -= 0.0011 + (1.9 - p.r) * 0.0021;
          if (p.r < 0.3) { p.r = 1.9; p.a = Math.random() * 6.2832; p.lum = Math.random(); }
          var x = cx + Math.cos(p.a) * R * p.r * 2.7;
          var y = cy + Math.sin(p.a) * R * p.r * 1.05;
          var aa = Math.min(0.96, (1.9 - p.r) * 0.5 + 0.16);
          var col = p.lum < 0.5 ? 'rgba(168,140,255,' + aa + ')' : 'rgba(130,188,255,' + aa + ')';
          var px = cx + Math.cos(p.a - p.trail) * R * (p.r + 0.055) * 2.7;
          var py = cy + Math.sin(p.a - p.trail) * R * (p.r + 0.055) * 1.05;
          ctx.strokeStyle = col; ctx.lineWidth = p.sz * 0.8;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
          ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, p.sz, 0, 6.2832); ctx.fill();
        }

        // —— 光子环（明亮细环 + 外发光）——
        ctx.strokeStyle = 'rgba(232,212,255,0.9)'; ctx.lineWidth = 3.0;
        ctx.beginPath(); ctx.arc(cx, cy, R * 1.0, 0, 6.2832); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,246,222,1)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(cx, cy, R * 1.0, 0, 6.2832); ctx.stroke();

        ctx.globalCompositeOperation = 'source-over';

        // —— 事件视界：纯黑奇点 + 引力暗晕 ——
        var bh = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.05);
        bh.addColorStop(0, 'rgba(0,0,0,1)');
        bh.addColorStop(0.6, 'rgba(0,0,0,0.99)');
        bh.addColorStop(0.82, 'rgba(14,8,30,0.5)');
        bh.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bh; ctx.beginPath(); ctx.arc(cx, cy, R * 1.05, 0, 6.2832); ctx.fill();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx, cy, R * 0.66, 0, 6.2832); ctx.fill();

        // —— 边缘空间折射 ——
        ctx.globalCompositeOperation = 'lighter';
        for (var L = 0; L < 2; L++) {
          var lr = R * (1.7 + L * 0.6);
          var lg = ctx.createLinearGradient(cx - lr, cy - lr, cx + lr, cy + lr);
          lg.addColorStop(0, 'rgba(120,110,220,0)');
          lg.addColorStop(0.5, 'rgba(158,146,244,' + (0.13 - L * 0.05) + ')');
          lg.addColorStop(1, 'rgba(120,110,220,0)');
          ctx.strokeStyle = lg; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(cx, cy, lr, 0, 6.2832); ctx.stroke();
        }
        for (var m2 = 0; m2 < s.lens.length; m2++) {
          var ln = s.lens[m2];
          var lr2 = R * (1.5 + Math.abs(Math.sin(ln.ph + t * 0.0006)) * 0.9);
          var lx = cx + Math.cos(ln.a) * lr2, ly = cy + Math.sin(ln.a) * lr2 * 0.62;
          var la = 0.16 + 0.18 * Math.abs(Math.sin(t * 0.002 + ln.ph));
          ctx.fillStyle = 'rgba(178,158,255,' + la + ')';
          ctx.beginPath(); ctx.arc(lx, ly, ln.sz, 0, 6.2832); ctx.fill();
        }

        // —— 虚空裂隙：偶发撕裂，露出内部紫白光芒 ——
        if (!s.rift) {
          s.riftTimer -= 1;
          if (s.riftTimer <= 0) s.rift = { x: cx + rr(-R * 2.5, R * 2.5), y: cy + rr(-R * 1.6, R * 1.6), rot: rr(-0.5, 0.5), len: rr(R * 1.5, R * 2.8), life: 48, max: 48 };
        } else {
          s.rift.life -= 1;
          if (s.rift.life <= 0) { s.rift = null; s.riftTimer = Math.floor(rr(170, 340)); }
          else {
            var rf = s.rift, open = Math.sin((1 - rf.life / rf.max) * Math.PI);
            ctx.save(); ctx.translate(rf.x, rf.y); ctx.rotate(rf.rot);
            var rl = rf.len * open, half = rl / 2;
            var rg2 = ctx.createLinearGradient(-half, 0, half, 0);
            rg2.addColorStop(0, 'rgba(180,150,255,0)');
            rg2.addColorStop(0.5, 'rgba(244,236,255,' + (0.92 * open) + ')');
            rg2.addColorStop(1, 'rgba(180,150,255,0)');
            ctx.strokeStyle = rg2; ctx.lineWidth = 2.4;
            ctx.beginPath();
            for (var q = -half; q <= half; q += 5) { var yy = Math.sin(q * 0.13 + t * 0.01) * 3.6 + Math.sin(q * 0.5) * 1.2; if (q === -half) ctx.moveTo(q, yy); else ctx.lineTo(q, yy); }
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = 'rgba(0,0,0,' + (0.9 * open) + ')'; ctx.lineWidth = 3.0;
            ctx.beginPath();
            for (var q2 = -half; q2 <= half; q2 += 5) { var yy2 = Math.sin(q2 * 0.13 + t * 0.01) * 3.6 + Math.sin(q2 * 0.5) * 1.2 - 2.6; if (q2 === -half) ctx.moveTo(q2, yy2); else ctx.lineTo(q2, yy2); }
            ctx.stroke(); ctx.restore();
          }
        }
        // 虚无箴言：循环艺术字（三组诗句轮播）
        (function () {
          var verses = s.verses || ['吞尽万象，归寂空冥', '黑涡吞星，万籁归无', '消弭一切，本自空无'];
          var DUR = 5200, total = verses.length;
          var cp = (t % (DUR * total)) / DUR;
          var fi = Math.floor(cp) % total;
          var lt = cp - Math.floor(cp);
          var a;
          if (lt < 0.16) a = lt / 0.16;
          else if (lt > 0.84) a = (1 - lt) / 0.16;
          else a = 1;
          a = a < 0 ? 0 : (a > 1 ? 1 : a);
          if (a > 0.01) {
            var txt = verses[fi];
            var fs = Math.max(22, Math.min(w * 0.06, h * 0.075, 50));
            var tx = cx, ty = h * 0.80;
            var breathe = 0.5 + 0.5 * Math.sin(t * 0.0016 + fi);
            var rise = (1 - a) * 12;
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            try { ctx.letterSpacing = (fs * 0.30) + 'px'; } catch (e) {}
            ctx.font = '600 ' + fs + 'px "STKaiti","KaiTi","Kaiti SC","Songti SC","Noto Serif SC","SimSun",Georgia,serif';
            ctx.globalAlpha = 0.15 * a;
            ctx.save(); ctx.scale(1, -1);
            var rg = ctx.createLinearGradient(tx - fs * 5, 0, tx + fs * 5, 0);
            rg.addColorStop(0, 'rgba(146,124,236,0.4)');
            rg.addColorStop(0.5, 'rgba(230,224,255,0.9)');
            rg.addColorStop(1, 'rgba(146,124,236,0.4)');
            ctx.fillStyle = rg;
            ctx.fillText(txt, tx, -(ty + rise) - fs * 1.35);
            ctx.restore();
            ctx.globalAlpha = 1;
            ctx.shadowColor = 'rgba(176,146,255,' + (0.85 * a) + ')';
            ctx.shadowBlur = 16 + 12 * breathe;
            var tg = ctx.createLinearGradient(tx - fs * 5, ty, tx + fs * 5, ty);
            tg.addColorStop(0, 'rgba(150,126,240,' + (0.34 * a) + ')');
            tg.addColorStop(0.5, 'rgba(246,242,255,' + (0.99 * a) + ')');
            tg.addColorStop(1, 'rgba(150,126,240,' + (0.34 * a) + ')');
            ctx.fillStyle = tg;
            ctx.fillText(txt, tx, ty + rise);
            ctx.shadowBlur = 0;
            try { ctx.letterSpacing = '0px'; } catch (e) {}
            ctx.restore();
          }
        })();
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    // —— 混沌命途：破碎神殿 + 火山裂谷 + 岩浆河 + 翻涌灰雾 ——
    turbulence: {
      init: function (s) {
        // 地面裂隙（沿裂缝流淌岩浆）
        s.cracks = [];
        var nc = 7;
        for (var i = 0; i < nc; i++) {
          var x0 = (i + 0.5) / nc * fx.w + rr(-fx.w * 0.05, fx.w * 0.05);
          var pts = [], y = fx.h + 12, x = x0, segs = 9;
          pts.push({ x: x, y: y });
          for (var k = 0; k < segs; k++) {
            y -= fx.h / segs * rr(0.7, 1.25);
            x += rr(-fx.w * 0.06, fx.w * 0.06);
            pts.push({ x: x, y: y });
          }
          s.cracks.push({ pts: pts, ph: rr(0, 6.283), sp: rr(0.0012, 0.0026), w: rr(2.6, 6) });
        }
        // 远处破碎柱体 / 断拱（神话残骸剪影）
        s.columns = [];
        for (var c = 0; c < 9; c++) {
          s.columns.push({
            x: rr(fx.w * 0.05, fx.w * 0.95),
            y: rr(fx.h * 0.44, fx.h * 0.68),
            w: rr(fx.w * 0.012, fx.w * 0.03),
            h: rr(fx.h * 0.10, fx.h * 0.30),
            lean: rr(-0.12, 0.12),
            ph: rr(0, 6.283),
            arch: Math.random() < 0.35
          });
        }
        // 悬浮碎石
        s.rocks = [];
        for (var r = 0; r < 16; r++) {
          var rp = [], n = 5 + (r % 3);
          for (var q = 0; q < n; q++) { var a = q / n * 6.2832; var rad = rr(5, 14); rp.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad }); }
          s.rocks.push({ x: Math.random() * fx.w, y: rr(fx.h * 0.12, fx.h * 0.7), pts: rp, rot: rr(0, 6.283), spin: rr(-0.012, 0.012), vx: rr(-0.25, 0.25), vy: rr(-0.16, -0.02), ph: rr(0, 6.283), sz: rr(0.7, 1.5) });
        }
        // 翻涌火山灰雾
        s.fog = [];
        for (var f = 0; f < 9; f++) {
          s.fog.push({ x: Math.random() * fx.w, y: rr(fx.h * 0.35, fx.h * 0.9), r: rr(fx.w * 0.24, fx.w * 0.5), vx: rr(0.2, 0.6) * (Math.random() < 0.5 ? 1 : -1), vy: rr(-0.05, 0.05), a: rr(0.05, 0.12) });
        }
        // 上升余烬
        s.embers = [];
        for (var e = 0; e < 110; e++) {
          s.embers.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vy: rr(-1.4, -0.3), vx: rr(-0.5, 0.5), r: rr(0.7, 2.3), ph: rr(0, 6.283) });
        }
        // 火焰冲击
        s.burst = { life: 0, max: 0, cx: 0, cy: 0, next: rr(220, 460) };
        s.verses = ['裂碎纲常，乱起洪荒', '熔岩崩宇，雾荡狂澜', '毁弃定则，无有常形'];
      },
      draw: function (ctx, w, h, t, s) {
        // 暗红色天幕（低频拖尾）
        ctx.fillStyle = 'rgba(16,7,11,0.22)'; ctx.fillRect(0, 0, w, h);
        // —— 火山灰天空 / 地平线炽光 ——
        var sky = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, 'rgba(40,10,16,0.55)');
        sky.addColorStop(0.55, 'rgba(60,16,18,0.30)');
        sky.addColorStop(1, 'rgba(120,40,20,0.28)');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
        // —— 远处破碎柱体 / 断裂拱桥 ——
        for (var c = 0; c < s.columns.length; c++) {
          var col = s.columns[c];
          var rim = 0.25 + 0.2 * Math.abs(Math.sin(col.ph + t * 0.0015));
          ctx.save(); ctx.translate(col.x, col.y); ctx.rotate(col.lean);
          ctx.fillStyle = 'rgba(20,9,10,0.92)';
          ctx.fillRect(-col.w / 2, -col.h, col.w, col.h + 6);
          ctx.beginPath(); ctx.moveTo(-col.w / 2, -col.h);
          ctx.lineTo(-col.w * 0.1, -col.h - col.w * 0.9);
          ctx.lineTo(col.w * 0.2, -col.h - col.w * 0.3);
          ctx.lineTo(col.w / 2, -col.h - col.w * 0.7);
          ctx.lineTo(col.w / 2, -col.h); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(200,70,40,' + rim + ')'; ctx.lineWidth = 1.1;
          ctx.strokeRect(-col.w / 2, -col.h, col.w, col.h);
          if (col.arch) {
            ctx.strokeStyle = 'rgba(180,60,40,' + (rim * 0.8) + ')'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(-col.w * 1.1, -col.h * 0.55, col.w * 1.1, Math.PI, Math.PI * 1.6); ctx.stroke();
          }
          ctx.restore();
        }
        ctx.globalCompositeOperation = 'lighter';
        // —— 地面裂隙：呼吸式明灭 + 岩浆河流 ——
        for (var i = 0; i < s.cracks.length; i++) {
          var ck = s.cracks[i];
          var breath = 0.45 + 0.55 * Math.abs(Math.sin(t * ck.sp + ck.ph));
          ctx.strokeStyle = 'rgba(10,4,5,0.9)'; ctx.lineWidth = ck.w * 1.7; ctx.lineJoin = 'round';
          ctx.beginPath();
          for (var k = 0; k < ck.pts.length; k++) { if (k === 0) ctx.moveTo(ck.pts[k].x, ck.pts[k].y); else ctx.lineTo(ck.pts[k].x, ck.pts[k].y); }
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255,' + Math.floor(110 + 90 * breath) + ',40,' + (0.55 + 0.4 * breath) + ')';
          ctx.lineWidth = ck.w * (0.5 + 0.3 * breath);
          ctx.shadowColor = 'rgba(255,140,40,' + (0.5 * breath) + ')';
          ctx.shadowBlur = 14;
          ctx.beginPath();
          for (var k2 = 0; k2 < ck.pts.length; k2++) { if (k2 === 0) ctx.moveTo(ck.pts[k2].x, ck.pts[k2].y); else ctx.lineTo(ck.pts[k2].x, ck.pts[k2].y); }
          ctx.stroke();
          ctx.shadowBlur = 0;
          var pulsePos = (t * 0.0006 + i * 0.13) % 1;
          var pi = Math.min(ck.pts.length - 1, Math.floor(pulsePos * ck.pts.length));
          var pp = ck.pts[pi];
          var pg = ctx.createRadialGradient(pp.x, pp.y, 0, pp.x, pp.y, 26);
          pg.addColorStop(0, 'rgba(255,' + Math.floor(180 + 60 * breath) + ',90,' + (0.7 * breath) + ')');
          pg.addColorStop(1, 'rgba(255,140,40,0)');
          ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(pp.x, pp.y, 26, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        // —— 中层：横向翻卷的火山灰雾 ——
        for (var f2 = 0; f2 < s.fog.length; f2++) {
          var fg2 = s.fog[f2]; fg2.x += fg2.vx; fg2.y += fg2.vy;
          if (fg2.x < -fg2.r) fg2.x = w + fg2.r; if (fg2.x > w + fg2.r) fg2.x = -fg2.r;
          if (fg2.y < -fg2.r) fg2.y = h + fg2.r; if (fg2.y > h + fg2.r) fg2.y = -fg2.r;
          var flick = 0.75 + 0.25 * Math.sin(t * 0.0016 + f2 * 1.3);
          var g2 = ctx.createRadialGradient(fg2.x, fg2.y, 0, fg2.x, fg2.y, fg2.r);
          g2.addColorStop(0, 'rgba(78,30,26,' + (fg2.a * flick) + ')');
          g2.addColorStop(1, 'rgba(40,16,16,0)');
          ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(fg2.x, fg2.y, fg2.r, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'lighter';
        // —— 上层：悬浮碎石缓慢翻转 + 炽热边缘 ——
        for (var r2 = 0; r2 < s.rocks.length; r2++) {
          var rk = s.rocks[r2]; rk.x += rk.vx; rk.y += rk.vy; rk.rot += rk.spin;
          if (rk.y < -40) { rk.y = h + 30; rk.x = Math.random() * w; }
          if (rk.x < -40) rk.x = w + 40; if (rk.x > w + 40) rk.x = -40;
          var glow = 0.5 + 0.5 * Math.sin(t * 0.004 + rk.ph);
          ctx.save(); ctx.translate(rk.x, rk.y); ctx.rotate(rk.rot); ctx.scale(rk.sz, rk.sz);
          ctx.fillStyle = 'rgba(26,10,9,0.92)';
          ctx.beginPath();
          for (var k3 = 0; k3 < rk.pts.length; k3++) { if (k3 === 0) ctx.moveTo(rk.pts[k3].x, rk.pts[k3].y); else ctx.lineTo(rk.pts[k3].x, rk.pts[k3].y); }
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(255,' + Math.floor(90 + glow * 90) + ',45,' + (0.7 * glow) + ')';
          ctx.lineWidth = 1.4; ctx.stroke();
          ctx.restore();
        }
        // —— 上升余烬 ——
        for (var e2 = 0; e2 < s.embers.length; e2++) {
          var em = s.embers[e2]; em.x += em.vx + Math.sin(t * 0.003 + em.ph) * 0.3; em.y += em.vy;
          if (em.y < -10) { em.y = h + 10; em.x = Math.random() * w; }
          var a2 = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.005 + em.ph));
          var eg = ctx.createRadialGradient(em.x, em.y, 0, em.x, em.y, em.r * 4);
          eg.addColorStop(0, 'rgba(255,' + Math.floor(140 + 80 * a2) + ',60,' + a2 + ')');
          eg.addColorStop(1, 'rgba(255,140,60,0)');
          ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(em.x, em.y, em.r * 4, 0, 6.2832); ctx.fill();
        }
        // —— 火焰冲击：偶发爆发，照亮整个背景 ——
        var bu = s.burst;
        bu.next -= 1;
        if (bu.next <= 0 && bu.life <= 0) {
          bu.life = bu.max = 60;
          bu.cx = rr(w * 0.2, w * 0.8);
          bu.cy = rr(h * 0.45, h * 0.8);
          bu.next = rr(260, 520);
        }
        if (bu.life > 0) {
          bu.life -= 1;
          var bp = bu.life / bu.max;
          var radius = (1 - bp) * Math.max(w, h) * 0.7 + 40;
          var bg = ctx.createRadialGradient(bu.cx, bu.cy, 0, bu.cx, bu.cy, radius);
          bg.addColorStop(0, 'rgba(255,' + Math.floor(220 * bp + 90) + ',120,' + (0.5 * bp) + ')');
          bg.addColorStop(0.4, 'rgba(255,120,40,' + (0.28 * bp) + ')');
          bg.addColorStop(1, 'rgba(255,80,20,0)');
          ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(bu.cx, bu.cy, radius, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        // 混沌箴言：循环艺术字（三组诗句轮播）
        (function () {
          var verses = s.verses || ['裂碎纲常，乱起洪荒', '熔岩崩宇，雾荡狂澜', '毁弃定则，无有常形'];
          var DUR = 5200, total = verses.length;
          var cp = (t % (DUR * total)) / DUR;
          var fi = Math.floor(cp) % total;
          var lt = cp - Math.floor(cp);
          var a;
          if (lt < 0.16) a = lt / 0.16;
          else if (lt > 0.84) a = (1 - lt) / 0.16;
          else a = 1;
          a = a < 0 ? 0 : (a > 1 ? 1 : a);
          if (a > 0.01) {
            var txt = verses[fi];
            var fs = Math.max(22, Math.min(w * 0.06, h * 0.075, 50));
            var tx = w / 2, ty = h * 0.80;
            var breathe = 0.5 + 0.5 * Math.sin(t * 0.0016 + fi);
            var rise = (1 - a) * 12;
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            try { ctx.letterSpacing = (fs * 0.30) + 'px'; } catch (e) {}
            ctx.font = '600 ' + fs + 'px "STKaiti","KaiTi","Kaiti SC","Songti SC","Noto Serif SC","SimSun",Georgia,serif';
            ctx.globalAlpha = 0.15 * a;
            ctx.save(); ctx.scale(1, -1);
            var rg = ctx.createLinearGradient(tx - fs * 5, 0, tx + fs * 5, 0);
            rg.addColorStop(0, 'rgba(255,150,90,0.4)');
            rg.addColorStop(0.5, 'rgba(255,236,214,0.9)');
            rg.addColorStop(1, 'rgba(255,150,90,0.4)');
            ctx.fillStyle = rg;
            ctx.fillText(txt, tx, -(ty + rise) - fs * 1.35);
            ctx.restore();
            ctx.globalAlpha = 1;
            ctx.shadowColor = 'rgba(255,170,80,' + (0.85 * a) + ')';
            ctx.shadowBlur = 16 + 12 * breathe;
            var tg = ctx.createLinearGradient(tx - fs * 5, ty, tx + fs * 5, ty);
            tg.addColorStop(0, 'rgba(255,140,70,' + (0.4 * a) + ')');
            tg.addColorStop(0.5, 'rgba(255,246,232,' + (0.99 * a) + ')');
            tg.addColorStop(1, 'rgba(255,140,70,' + (0.4 * a) + ')');
            ctx.fillStyle = tg;
            ctx.fillText(txt, tx, ty + rise);
            ctx.shadowBlur = 0;
            try { ctx.letterSpacing = '0px'; } catch (e) {}
            ctx.restore();
          }
        })();
      }
    },

    // —— 沉沦命途：坍塌残骸 + 飘落絮状物 + 下沉尘光 ——
    downfall: {
      init: function (s) {
        s.debris = [];
        for (var i = 0; i < 34; i++) s.debris.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vy: rr(0.4, 1.3), vx: rr(-0.25, 0.25), sz: rr(3, 10), rot: rr(0, 6.283), spin: rr(-0.02, 0.02) });
        s.wisps = [];
        for (var j = 0; j < 26; j++) s.wisps.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vy: rr(0.25, 0.8), vx: rr(-0.2, 0.2), r: rr(4, 12), ph: rr(0, 6.283) });
        s.dust = [];
        for (var d = 0; d < 50; d++) s.dust.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vy: rr(0.6, 1.6), r: rr(0.6, 1.8) });
      },
      draw: function (ctx, w, h, t, s) {
        ctx.fillStyle = 'rgba(12,6,12,0.16)'; ctx.fillRect(0, 0, w, h);
        for (var j = 0; j < s.wisps.length; j++) {
          var wp = s.wisps[j]; wp.x += wp.vx + Math.sin(t * 0.001 + wp.ph) * 0.5; wp.y += wp.vy;
          if (wp.y > h + wp.r) { wp.y = -wp.r; wp.x = Math.random() * w; }
          var a = 0.09 + 0.07 * Math.abs(Math.sin(t * 0.002 + wp.ph));
          var g = ctx.createRadialGradient(wp.x, wp.y, 0, wp.x, wp.y, wp.r);
          g.addColorStop(0, cc(a)); g.addColorStop(1, cc(0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(wp.x, wp.y, wp.r, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < s.debris.length; i++) {
          var db = s.debris[i]; db.x += db.vx; db.y += db.vy; db.rot += db.spin;
          if (db.y > h + 16) { db.y = -16; db.x = Math.random() * w; }
          if (db.x < -16) db.x = w + 16; if (db.x > w + 16) db.x = -16;
          ctx.save(); ctx.translate(db.x, db.y); ctx.rotate(db.rot);
          ctx.fillStyle = 'rgba(40,22,34,0.85)'; ctx.fillRect(-db.sz / 2, -db.sz / 2, db.sz, db.sz);
          ctx.strokeStyle = cc(0.5); ctx.lineWidth = 1;
          ctx.strokeRect(-db.sz / 2, -db.sz / 2, db.sz, db.sz);
          ctx.restore();
        }
        for (var d = 0; d < s.dust.length; d++) {
          var du = s.dust[d]; du.y += du.vy;
          if (du.y > h + 6) { du.y = -6; du.x = Math.random() * w; }
          ctx.fillStyle = cc(0.15 + 0.2 * Math.abs(Math.sin(t * 0.004 + du.x)));
          ctx.beginPath(); ctx.arc(du.x, du.y, du.r, 0, 6.2832); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
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

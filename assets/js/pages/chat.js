/* 社群聊天 · Phase 1.5（独立整页 + 导航栏 + 特效 + 神明/职业室）
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
  function colorFor(ch) {
    if (!ch) return DEFAULT_COLOR;
    var key = ch.pathKey || ch.path_key;
    if (key && PATH_COLOR[key]) return PATH_COLOR[key];
    return DEFAULT_COLOR;
  }

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
    try {
      var map = godSigilMap();
      if (ch && ch.kind === 'god' && map) {
        var gk = ch.godKey || ch.god_key;
        if (gk && map[gk] && map[gk].svg) return map[gk].svg;
        var nm = String(ch.name || '').replace(/\u4e4b\u795e.*$/, '').trim();
        if (nm && map[nm] && map[nm].svg) return map[nm].svg;
      }
    } catch (e) {}
    return '';
  }
  function emblemFor(ch) {
    var svg = sigilFor(ch);
    var inner = svg ? svg : '<span class="emb-glyph">' + esc(iconFor(ch)) + '</span>';
    return '<span class="cn-emblem">' + inner + '</span>';
  }
  function modeForChannel(ch) {
    if (!ch) return 'flow';
    if (ch.kind === 'god') return 'pulse';
    if (ch.kind === 'path') return 'wave';
    if (ch.kind === 'profession') return 'spark';
    return 'flow';
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
    var fxMode = modeForChannel(ch);
    if (window.chatFxBurst) window.chatFxBurst(col, fxMode);
    else if (window.chatFxSetColor) window.chatFxSetColor(col, fxMode);
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

  // ---------- 背景特效（流场粒子 · 梵高星轨）----------
  var fx = { raf: 0, ctx: null, canvas: null, w: 0, h: 0, parts: [], rings: [], color: [214, 178, 96], running: false, mode: 'flow', flash: 0 };
  function hexToRgb(h) {
    var m = /^#?([0-9a-f]{6})$/i.exec(h || '');
    if (!m) return [214, 178, 96];
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function reduceMotion() {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function fxResize() {
    if (!fx.canvas) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    fx.w = fx.canvas.clientWidth; fx.h = fx.canvas.clientHeight;
    fx.canvas.width = fx.w * dpr; fx.canvas.height = fx.h * dpr;
    fx.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function fxSeed() {
    var count = Math.max(120, Math.min(440, Math.round((fx.w * fx.h) / 9000)));
    fx.parts = [];
    for (var i = 0; i < count; i++) {
      fx.parts.push({ x: Math.random() * fx.w, y: Math.random() * fx.h, vx: (Math.random() - 0.5) * 1.2, vy: (Math.random() - 0.5) * 1.2, life: Math.random() * 260, r: 0.7 + Math.random() * 2.2 });
    }
  }
  function fxBurst() {
    var cx = fx.w / 2, cy = fx.h / 2;
    fx.rings.push({ x: cx, y: cy, r: Math.max(fx.w, fx.h) * 0.04, max: Math.max(fx.w, fx.h) * 0.62, life: 1, w: 3 });
    fx.flash = 1;
    for (var i = 0; i < fx.parts.length; i++) {
      var p = fx.parts[i]; var dx = p.x - cx, dy = p.y - cy; var d = Math.hypot(dx, dy) || 1;
      p.vx += (dx / d) * 3.2; p.vy += (dy / d) * 3.2;
    }
  }
  function fxField(x, y, t) {
    var s = 0.0018;
    var a = Math.sin(x * s + t * 0.00024) + Math.cos(y * s * 1.3 - t * 0.00019);
    var b = Math.cos(x * s * 1.1 - t * 0.00021) + Math.sin(y * s - t * 0.00026);
    return { a: a, b: b };
  }
  function fxStep(p, t, cx, cy) {
    var mode = fx.mode;
    if (mode === 'pulse') {
      var dx = p.x - cx, dy = p.y - cy; var d = Math.hypot(dx, dy) || 1;
      var ang = Math.atan2(dy, dx);
      var pulse = 0.5 + 0.5 * Math.sin(t * 0.0016 - d * 0.02);
      p.vx += (dx / d) * 0.06 * pulse - (dy / d) * 0.07;
      p.vy += (dy / d) * 0.06 * pulse + (dx / d) * 0.07;
      if (d > Math.min(fx.w, fx.h) * 0.44) { p.x = cx + Math.cos(ang) * 6; p.y = cy + Math.sin(ang) * 6; p.vx = p.vy = 0; }
    } else if (mode === 'wave') {
      var dx2 = p.x - cx, dy2 = p.y - cy; var d2 = Math.hypot(dx2, dy2) || 1;
      var wv = Math.sin(t * 0.0012 + d2 * 0.018);
      p.vx += (dx2 / d2) * wv * 0.26;
      p.vy += (dy2 / d2) * wv * 0.26;
    } else if (mode === 'spark') {
      p.vy -= 0.11 + Math.random() * 0.06;
      p.vx += (Math.random() - 0.5) * 0.12;
    } else {
      var f = fxField(p.x, p.y, t);
      p.vx = p.vx * 0.94 + f.a * 0.5;
      p.vy = p.vy * 0.94 + f.b * 0.5;
    }
    p.vx *= 0.97; p.vy *= 0.97;
    p.x += p.vx; p.y += p.vy;
    if (p.x < -20 || p.x > fx.w + 20 || p.y < -20 || p.y > fx.h + 20 || --p.life < 0) {
      p.x = Math.random() * fx.w; p.y = Math.random() * fx.h; p.vx = (Math.random() - 0.5) * 1.2; p.vy = (Math.random() - 0.5) * 1.2; p.life = 200 + Math.random() * 260;
    }
  }
  function fxFrame(t) {
    if (!fx.running) return;
    var ctx = fx.ctx, w = fx.w, h = fx.h, c = fx.color, cx = w / 2, cy = h / 2;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(10,8,18,0.16)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    var grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.6);
    grd.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.10)');
    grd.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < fx.parts.length; i++) {
      var p = fx.parts[i];
      fxStep(p, t, cx, cy);
      var spd = Math.min(1, Math.hypot(p.vx, p.vy) / 3.4);
      ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (0.26 + spd * 0.62) + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r + spd * 2.4, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (0.10 + spd * 0.34) + ')';
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 7, p.y - p.vy * 7); ctx.stroke();
    }
    if (fx.rings.length) {
      for (var r = fx.rings.length - 1; r >= 0; r--) {
        var g = fx.rings[r];
        g.r += (g.max - g.r) * 0.045 + 1.2; g.life -= 0.014;
        if (g.life <= 0) { fx.rings.splice(r, 1); continue; }
        ctx.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (g.life * 0.55) + ')';
        ctx.lineWidth = g.w * g.life;
        ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, 6.2832); ctx.stroke();
      }
    }
    if (fx.flash > 0.01) {
      ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (fx.flash * 0.16) + ')';
      ctx.fillRect(0, 0, w, h); fx.flash *= 0.9;
    }
    fx.raf = requestAnimationFrame(fxFrame);
  }
  window.chatFxStart = function () {
    if (reduceMotion()) return;
    fx.canvas = document.getElementById('chatFx');
    if (!fx.canvas) return;
    fx.ctx = fx.canvas.getContext('2d');
    if (!fx.ctx) return;
    fxResize(); fxSeed();
    fx.running = true;
    cancelAnimationFrame(fx.raf);
    fx.raf = requestAnimationFrame(fxFrame);
    window.addEventListener('resize', function () { if (fx.running) { fxResize(); fxSeed(); } });
  };
  window.chatFxStop = function () {
    fx.running = false;
    if (fx.raf) cancelAnimationFrame(fx.raf);
    fx.raf = 0;
  };
  window.chatFxSetColor = function (hex, mode) {
    fx.color = hexToRgb(hex);
    if (mode) fx.mode = mode;
  };
  window.chatFxBurst = function (hex, mode) {
    fx.color = hexToRgb(hex);
    if (mode) fx.mode = mode;
    fxBurst();
  };
})();

/*! 诸神愚戏 · 十六信仰开卷仪式 (Opening Rite) v1
 *  每日首次打开网站时播放一次的开场动画；16 天一轮回，一天一个信仰。
 *  文案/神徽/主题色取自 assets/js/world-data.js（GOD_PRAYERS / GOD_ICONS / GOD_SKINS）。
 *  音效缺省时静默降级；用户可在遮罩右上角开关音效（localStorage 记忆）。
 *  接入：在 index.html 的 </body> 前引入 <script src="assets/js/opening-rite.js" defer></script>
 */
(function () {
  'use strict';
  var NS = '__fogOpenRite';
  try { if (window[NS] && typeof window[NS].destroy === 'function') window[NS].destroy(); } catch (e) {}

  // ===== CONFIG =====
  var EPOCH = '2026-09-30';          // 轮回起点：该日 = 第 1 日 诞育（可按需修改）
  var LS_SHOWN = 'fog.openRite.lastShown';
  var LS_SOUND = 'fog.openRite.sound';

  // ===== 16 信仰真值表（与 world-data.js 一致） =====
  var G = [
    ['诞育', '生命', '芽', '#81c487', '#d8ad64', 'rgba(129,196,135,0.20)', 'rgba(24,53,37,0.78)', '感孕生命，行育自然'],
    ['繁荣', '生命', '穗', '#9ccd65', '#e1c36d', 'rgba(156,205,101,0.18)', 'rgba(38,56,28,0.78)', '万物滋生，亦繁亦荣'],
    ['死亡', '生命', '眠', '#d76565', '#9ea1ad', 'rgba(215,101,101,0.18)', 'rgba(42,31,35,0.82)', '灵魂安眠，生命终焉'],
    ['记忆', '存在', '页', '#9ec9dc', '#d8dde7', 'rgba(158,201,220,0.20)', 'rgba(22,38,52,0.78)', '昔我长铭，流光拓影'],
    ['时间', '存在', '沙', '#9bc9ef', '#cfd8e8', 'rgba(155,201,239,0.18)', 'rgba(18,38,58,0.78)', '时光如隙，我亦如风'],
    ['秩序', '文明', '衡', '#c07855', '#8a5c3a', 'rgba(192,120,85,0.18)', 'rgba(55,31,27,0.78)', '文明火起，秩序长存'],
    ['真理', '文明', '典', '#dce5e8', '#b48d63', 'rgba(220,229,232,0.14)', 'rgba(35,39,43,0.78)', '洞窥本质，行见真理'],
    ['战争', '文明', '矛', '#e0644e', '#5e4c45', 'rgba(224,100,78,0.20)', 'rgba(57,26,23,0.82)', '何以求存，唯血与火'],
    ['欺诈', '虚无', '面', '#d7a95f', '#7b4fc8', 'rgba(215,169,95,0.22)', 'rgba(39,25,61,0.78)', '不辨真伪，勿论虚实'],
    ['命运', '虚无', '骰', '#91a7ff', '#8a5cff', 'rgba(138,92,255,0.22)', 'rgba(28,24,68,0.78)', '命若繁星，望而不及'],
    ['混乱', '混沌', '涡', '#c9b967', '#d48b55', 'rgba(201,185,103,0.18)', 'rgba(55,49,31,0.78)', '虚构规律，寰宇笑谈'],
    ['痴愚', '混沌', '眸', '#d2c785', '#9e9aa4', 'rgba(210,199,133,0.16)', 'rgba(46,45,38,0.78)', '生命皆痴，文明皆愚'],
    ['污堕', '沉沦', '溺', '#c65a88', '#4a2d3a', 'rgba(198,90,136,0.20)', 'rgba(49,22,38,0.82)', '解开枷锁，直面心欲'],
    ['腐朽', '沉沦', '朽', '#a58a57', '#707268', 'rgba(165,138,87,0.17)', 'rgba(47,42,31,0.82)', '众生应腐，万物将朽'],
    ['湮灭', '沉沦', '烬', '#b8bcc8', '#555b65', 'rgba(184,188,200,0.14)', 'rgba(9,10,13,0.90)', '于无中生，于寂中灭'],
    ['沉默', '混沌', '默', '#aebbc8', '#758897', 'rgba(174,187,200,0.14)', 'rgba(25,34,42,0.80)', '万物归寂，寰宇无音']
  ].map(function (a) {
    return { god: a[0], path: a[1], icon: a[2], primary: a[3], secondary: a[4], glow: a[5], dark: a[6], prayer: a[7] };
  });
  var CYCLE = G.length;

  function toUTC(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function dayKey(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function boot() {
    var now = new Date();
    var today = dayKey(now);
    try { if (localStorage.getItem(LS_SHOWN) === today) return; } catch (e) {}
    if (document.querySelector('.fog-openrite')) return;

    var epochMs = toUTC(EPOCH), todayMs = toUTC(today);
    var totalDays = (epochMs != null && todayMs != null) ? Math.round((todayMs - epochMs) / 86400000) : 0;
    var idx = ((totalDays % CYCLE) + CYCLE) % CYCLE;
    var cycleNum = totalDays < 0 ? 0 : Math.floor(totalDays / CYCLE);
    var faith = G[idx];
    var dayNumber = idx + 1;
    var boost = Math.min(cycleNum * 12, 96);

    // ---- 样式 ----
    if (!document.getElementById('fogOpenRiteStyles')) {
      var st = document.createElement('style');
      st.id = 'fogOpenRiteStyles';
      st.textContent = [
        '.fog-openrite{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483000;display:block;',
        'font-family:"Songti SC","STSong",Georgia,"Noto Serif SC",serif;cursor:pointer;overflow:hidden;opacity:0;',
        'transition:opacity .55s ease;--fr-p:' + faith.primary + ';--fr-s:' + faith.secondary + ';--fr-g:' + faith.glow + ';--fr-d:' + faith.dark + ';}',
        '.fog-openrite.fr-in{opacity:1;}',
        '.fog-openrite.fr-closing{opacity:0;transition:opacity .6s ease;}',
        '.fog-openrite .fr-veil{position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 30%, color-mix(in srgb,var(--fr-p) 20%, transparent), transparent 62%),linear-gradient(180deg,#05060a 0%,var(--fr-d) 55%,#030407 100%);}',
        '.fog-openrite .fr-canvas{position:absolute;inset:0;width:100%;height:100%;}',
        '.fog-openrite .fr-core{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;text-align:center;padding:0 24px;width:max-content;max-width:92vw;}',
        '.fog-openrite .fr-ring{position:absolute;top:50%;left:50%;width:220px;height:220px;margin:-110px 0 0 -110px;border-radius:50%;border:1px solid color-mix(in srgb,var(--fr-p) 60%, transparent);opacity:0;transform:scale(.4);box-shadow:0 0 60px var(--fr-g), inset 0 0 40px var(--fr-g);}',
        '.fog-openrite .fr-ring.b{width:330px;height:330px;margin:-165px 0 0 -165px;border-color:color-mix(in srgb,var(--fr-s) 45%, transparent);}',
        '.fog-openrite .fr-emblem{font-size:clamp(72px,14vw,132px);line-height:1;color:var(--fr-p);text-shadow:0 0 34px var(--fr-g),0 0 90px var(--fr-g);opacity:0;transform:scale(.55);letter-spacing:.04em;font-weight:600;}',
        '.fog-openrite .fr-kicker{margin-top:22px;font-size:clamp(11px,1.5vw,13px);letter-spacing:.5em;text-indent:.5em;color:color-mix(in srgb,var(--fr-p) 78%, #cfd8e8);opacity:0;transform:translateY(10px);}',
        '.fog-openrite .fr-god{margin-top:8px;font-size:clamp(30px,6vw,56px);font-weight:700;color:#f4f1e8;letter-spacing:.16em;text-shadow:0 0 26px var(--fr-g);opacity:0;transform:translateY(12px);}',
        '.fog-openrite .fr-path{margin-top:10px;font-size:clamp(12px,1.8vw,15px);letter-spacing:.34em;color:var(--fr-s);opacity:0;transform:translateY(10px);}',
        '.fog-openrite .fr-prayer{margin-top:20px;font-size:clamp(14px,2.4vw,20px);color:color-mix(in srgb,var(--fr-p) 82%, #eef3f8);letter-spacing:.22em;opacity:0;transform:translateY(10px);}',
        '.fog-openrite .fr-day{position:absolute;top:26px;left:0;right:0;text-align:center;font-size:11px;letter-spacing:.42em;color:color-mix(in srgb,var(--fr-p) 65%, #8fa3b8);opacity:0;transition:opacity .6s ease;}',
        '.fog-openrite .fr-hint{position:absolute;bottom:34px;left:0;right:0;text-align:center;font-size:12px;letter-spacing:.3em;color:color-mix(in srgb,var(--fr-p) 60%, #93a5b8);opacity:0;transition:opacity .6s ease;}',
        '.fog-openrite .fr-hint.on{opacity:.85;animation:frpulse 2.2s ease-in-out infinite;}',
        '.fog-openrite .fr-sound{position:absolute;top:20px;right:20px;z-index:3;width:40px;height:40px;border-radius:12px;border:1px solid color-mix(in srgb,var(--fr-p) 40%, transparent);background:rgba(6,8,12,.5);color:var(--fr-p);font-size:17px;cursor:pointer;line-height:1;opacity:0;transition:opacity .6s ease,background .2s ease;}',
        '.fog-openrite .fr-sound:hover{background:color-mix(in srgb,var(--fr-p) 16%, transparent);}',
        '.fog-openrite .fr-sound.on{opacity:.9;} .fog-openrite .fr-day.on{opacity:.9;}',
        '.fog-openrite.fr-p2 .fr-emblem{opacity:1;transform:scale(1);transition:opacity .8s ease,transform 1s cubic-bezier(.16,.9,.3,1);}',
        '.fog-openrite.fr-p2 .fr-ring{opacity:.85;transform:scale(1);transition:opacity .8s ease,transform 1.1s cubic-bezier(.16,.9,.3,1);}',
        '.fog-openrite.fr-p3 .fr-kicker,.fog-openrite.fr-p3 .fr-god,.fog-openrite.fr-p3 .fr-path,.fog-openrite.fr-p3 .fr-prayer{opacity:1;transform:translateY(0);transition:opacity .7s ease,transform .8s cubic-bezier(.16,.9,.3,1);}',
        '.fog-openrite.fr-p3 .fr-god{transition-delay:.05s;} .fog-openrite.fr-p3 .fr-path{transition-delay:.12s;} .fog-openrite.fr-p3 .fr-prayer{transition-delay:.2s;}',
        '@keyframes frpulse{0%,100%{opacity:.45;}50%{opacity:.95;}}',
        '@media (prefers-reduced-motion: reduce){.fog-openrite *{transition-duration:.12s !important;animation:none !important;}}'
      ].join('');
      document.head.appendChild(st);
    }

    // ---- 结构 ----
    var overlay = document.createElement('div');
    overlay.className = 'fog-openrite';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', faith.god + '之神 · 开卷仪式');
    overlay.innerHTML =
      '<canvas class="fr-canvas" aria-hidden="true"></canvas>' +
      '<div class="fr-veil" aria-hidden="true"></div>' +
      '<button class="fr-sound" type="button" aria-label="切换音效">🔇</button>' +
      '<div class="fr-day">开卷轮回 · 第 ' + dayNumber + ' 日 · ' + faith.path + '命途</div>' +
      '<div class="fr-core">' +
        '<div class="fr-ring" aria-hidden="true"></div><div class="fr-ring b" aria-hidden="true"></div>' +
        '<div class="fr-emblem">' + faith.icon + '</div>' +
        '<div class="fr-kicker">FOLLY OF THE GODS · 诸神愚戏</div>' +
        '<div class="fr-god">' + faith.god + '之神</div>' +
        '<div class="fr-path">' + faith.path + '命途</div>' +
        '<div class="fr-prayer">' + faith.prayer + '</div>' +
      '</div>' +
      '<div class="fr-hint">点击启封 · 进入神谕</div>';
    document.documentElement.appendChild(overlay);

    var q = function (s) { return overlay.querySelector(s); };
    var canvas = q('.fr-canvas'), soundBtn = q('.fr-sound'), hint = q('.fr-hint');

    // ---- 音效 ----
    var audio = document.createElement('audio');
    audio.preload = 'auto';
    audio.src = 'assets/audio/rite-' + ('0' + dayNumber).slice(-2) + '.mp3';
    audio.volume = 0.85;
    var soundOn = true, audioOk = true;
    try { soundOn = (localStorage.getItem(LS_SOUND) || '1') === '1'; } catch (e) {}
    audio.addEventListener('error', function () { audioOk = false; });
    function paint() { soundBtn.textContent = soundOn ? '🔊' : '🔇'; try { localStorage.setItem(LS_SOUND, soundOn ? '1' : '0'); } catch (e) {} }
    function tryPlay() { if (!soundOn || !audioOk) return; try { var p = audio.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
    soundBtn.addEventListener('click', function (ev) {
      ev.stopPropagation(); soundOn = !soundOn; paint();
      if (soundOn) tryPlay(); else { try { audio.pause(); } catch (e) {} }
    });
    paint(); soundBtn.classList.add('on'); tryPlay();

    // ---- 粒子 ----
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2), ps = [], N = 64 + boost;
    function resize() {
      W = overlay.clientWidth || window.innerWidth; H = overlay.clientHeight || window.innerHeight;
      canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    function hexA(hex, a) {
      var h = String(hex).replace('#', ''); if (h.length === 3) h = h.replace(/./g, function (c) { return c + c; });
      var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
      return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    }
    function spawn(p) {
      p.x = Math.random() * W; p.y = H + Math.random() * H * 0.5; p.r = 0.6 + Math.random() * 2.2;
      p.vy = -(0.25 + Math.random() * 0.9); p.vx = (Math.random() - 0.5) * 0.35;
      p.a = 0.15 + Math.random() * 0.55; p.ph = Math.random() * Math.PI * 2; p.tint = Math.random() < 0.5 ? 0 : 1; return p;
    }
    for (var i = 0; i < N; i++) ps.push(spawn({ x: Math.random() * W, y: Math.random() * H }));
    resize();
    window.addEventListener('resize', resize);
    var raf = 0, t0 = 0;
    function frame(ts) {
      if (!t0) t0 = ts; var el = (ts - t0) / 1000; ctx.clearRect(0, 0, W, H);
      for (var k = 0; k < ps.length; k++) {
        var p = ps[k]; p.y += p.vy; p.x += p.vx + Math.sin(el * 0.8 + p.ph) * 0.25; if (p.y < -12) spawn(p);
        ctx.beginPath(); ctx.fillStyle = p.tint ? hexA(faith.primary, p.a) : hexA(faith.secondary, p.a * 0.9);
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      raf = window.requestAnimationFrame(frame);
    }
    raf = window.requestAnimationFrame(frame);

    // ---- 交互与生命周期 ----
    var done = false, timers = [];
    function clr() { for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]); timers.length = 0; }
    function finish() {
      if (done) return; done = true; clr(); overlay.classList.add('fr-closing');
      try { audio.pause(); } catch (e) {}
      timers.push(setTimeout(function () {
        window.cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('keydown', onKey, true);
        overlay.removeEventListener('click', onClick);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        try { localStorage.setItem(LS_SHOWN, today); } catch (e) {}
      }, 620));
    }
    function onClick(e) { if (e.target === soundBtn || soundBtn.contains(e.target)) return; finish(); }
    function onKey() { finish(); }
    overlay.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey, true);

    window.requestAnimationFrame(function () { overlay.classList.add('fr-in'); });
    timers.push(setTimeout(function () { q('.fr-day').classList.add('on'); }, 250));
    timers.push(setTimeout(function () { overlay.classList.add('fr-p2'); }, 700));
    timers.push(setTimeout(function () { overlay.classList.add('fr-p3'); }, 1650));
    timers.push(setTimeout(function () { hint.classList.add('on'); }, 2350));
    timers.push(setTimeout(function () { finish(); }, 3600));

    window[NS] = { destroy: function () { if (!done) finish(); }, finishNow: finish, god: faith.god, day: dayNumber };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

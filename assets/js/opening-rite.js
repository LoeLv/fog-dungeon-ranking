/*! 诸神愚戏 · 十六信仰开卷仪式 (Opening Rite) v3
 *  进入站点：不透明深黑帷幕 + 淡小字「点击启封信仰之地」（首页后台静默加载）。
 *  点击后播放四段式入场动画（严格按提示词，画布采用加色混合 lighter，粒子真正发光）：
 *    0–1s    全屏深黑，中心悬浮半透明发光「生命胚种」，微光缓慢搏动；
 *    1–2.2s  胚种炸开，金色生命光核喷涌；种子粒子球形外喷并萌发发光胚芽；卵囊光纹由中心向四角蔓延，
 *            光脉持续生成微型发光花苞，花瓣碎片飘散（多层粒子叠加，华丽有层次）；
 *    2.2–3s  光核收敛；居中大字「欢迎来到信仰之地」带淡金呼吸光晕浮现；底部八字祷词淡入；
 *    3–3.5s  花苞光点消融、光脉褪去，平稳切入首页。
 *  16 天一轮回，一天一个信仰；文案/神徽/主题色取自 assets/js/world-data.js。
 *  音效缺省时静默降级；右上角可开关音效（localStorage 记忆）。
 *  接入：在 index.html 的 </body> 前引入 <script defer src="assets/js/opening-rite.js"></script>
 */
(function () {
  'use strict';
  var NS = '__fogOpenRite';
  try { if (window[NS] && typeof window[NS].destroy === 'function') window[NS].destroy(); } catch (e) {}

  // ===== CONFIG =====
  var EPOCH = '2026-09-30';          // 轮回起点：该日 = 第 1 个信仰「诞育」（可按需修改）
  var LS_SHOWN = 'fog.openRite.lastShown';
  var LS_SOUND = 'fog.openRite.sound';

  // ===== 16 信仰真值表（与 world-data.js 对齐）=====
  var G = [
    ['诞育', '生命', '芽', '#81c487', '#d8ad64', 'rgba(129,196,135,0.22)', 'rgba(20,44,31,0.9)', '感孕生命，行育自然'],
    ['繁荣', '生命', '穗', '#9ccd65', '#e1c36d', 'rgba(156,205,101,0.22)', 'rgba(32,50,24,0.9)', '万物滋生，亦繁亦荣'],
    ['死亡', '生命', '眠', '#d76565', '#9ea1ad', 'rgba(215,101,101,0.2)', 'rgba(36,26,30,0.92)', '灵魂安眠，生命终焉'],
    ['记忆', '存在', '页', '#9ec9dc', '#d8dde7', 'rgba(158,201,220,0.22)', 'rgba(18,32,46,0.9)', '昔我长铭，流光拓影'],
    ['时间', '存在', '沙', '#9bc9ef', '#cfd8e8', 'rgba(155,201,239,0.2)', 'rgba(14,32,52,0.9)', '时光如隙，我亦如风'],
    ['秩序', '文明', '衡', '#c07855', '#8a5c3a', 'rgba(192,120,85,0.2)', 'rgba(48,27,23,0.9)', '文明火起，秩序长存'],
    ['真理', '文明', '典', '#dce5e8', '#b48d63', 'rgba(220,229,232,0.16)', 'rgba(30,34,38,0.9)', '洞窥本质，行见真理'],
    ['战争', '文明', '矛', '#e0644e', '#5e4c45', 'rgba(224,100,78,0.22)', 'rgba(50,22,19,0.92)', '何以求存，唯血与火'],
    ['欺诈', '虚无', '面', '#d7a95f', '#7b4fc8', 'rgba(215,169,95,0.24)', 'rgba(34,22,54,0.9)', '不辨真伪，勿论虚实'],
    ['命运', '虚无', '骰', '#91a7ff', '#8a5cff', 'rgba(138,92,255,0.24)', 'rgba(24,20,60,0.9)', '命若繁星，望而不及'],
    ['混乱', '混沌', '涡', '#c9b967', '#d48b55', 'rgba(201,185,103,0.2)', 'rgba(48,43,27,0.9)', '虚构规律，寰宇笑谈'],
    ['痴愚', '混沌', '眸', '#d2c785', '#9e9aa4', 'rgba(210,199,133,0.18)', 'rgba(40,39,33,0.9)', '生命皆痴，文明皆愚'],
    ['污堕', '沉沦', '溺', '#c65a88', '#4a2d3a', 'rgba(198,90,136,0.22)', 'rgba(43,19,33,0.92)', '解开枷锁，直面心欲'],
    ['腐朽', '沉沦', '朽', '#a58a57', '#707268', 'rgba(165,138,87,0.2)', 'rgba(41,36,27,0.92)', '众生应腐，万物将朽'],
    ['湮灭', '沉沦', '烬', '#b8bcc8', '#555b65', 'rgba(184,188,200,0.16)', 'rgba(8,9,12,0.95)', '于无中生，于寂中灭'],
    ['沉默', '混沌', '默', '#aebbc8', '#758897', 'rgba(174,187,200,0.16)', 'rgba(21,29,36,0.9)', '万物归寂，寰宇无音']
  ].map(function (a) {
    return { god: a[0], path: a[1], icon: a[2], primary: a[3], secondary: a[4], glow: a[5], dark: a[6], prayer: a[7] };
  });
  var CYCLE = G.length;

  // 信仰的意象化称谓（不出现「第 N 日」等编号）
  var TITLES = {
    诞育: '生命的起点', 繁荣: '万物的滋长', 死亡: '灵魂的安眠',
    记忆: '流光的拓影', 时间: '流逝的长河', 秩序: '长存的法则',
    真理: '本质的窥见', 战争: '存续的烈火', 欺诈: '真伪的迷局',
    命运: '难及的繁星', 混乱: '寰宇的笑谈', 痴愚: '痴妄的明悟',
    污堕: '枷锁的解脱', 腐朽: '万物的凋朽', 湮灭: '寂灭的终焉',
    沉默: '无声的归寂'
  };

  function toUTC(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function dayKey(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function hex2rgb(hex) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h.replace(/./g, function (c) { return c + c; });
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
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
    var title = TITLES[faith.god] || faith.god;
    var boost = Math.min(cycleNum * 12, 96);         // 第 17 天起粒子小幅增加
    var priRgb = hex2rgb(faith.primary).join(',');
    var secRgb = hex2rgb(faith.secondary).join(',');

    // ---- 样式 ----
    if (!document.getElementById('fogOpenRiteStyles')) {
      var st = document.createElement('style');
      st.id = 'fogOpenRiteStyles';
      st.textContent = [
        '.fog-openrite{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483000;background:#04050a;',
        'cursor:pointer;overflow:hidden;opacity:1;font-family:"Songti SC","STSong",Georgia,"Noto Serif SC",serif;}',
        '.fog-openrite.fr-out{opacity:0;transition:opacity .5s ease;}',
        '.fog-openrite .fr-veil{position:absolute;inset:0;z-index:0;background:radial-gradient(130% 110% at 50% 46%,#0b1017 0%,#070a10 40%,#020306 100%);}',
        '.fog-openrite .fr-canvas{position:absolute;inset:0;z-index:1;width:100%;height:100%;}',
        '.fog-openrite .fr-gate{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;',
        'color:rgba(206,214,226,.7);font-size:clamp(13px,1.7vw,17px);letter-spacing:.52em;text-indent:.52em;opacity:1;',
        'transition:opacity .5s ease;animation:frgate 2.6s ease-in-out infinite;}',
        '.fog-openrite .fr-gate.off{opacity:0;animation:none;}',
        '@keyframes frgate{0%,100%{opacity:.32;}50%{opacity:.92;}}',
        '.fog-openrite .fr-stage{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;pointer-events:none;z-index:2;}',
        '.fog-openrite .fr-welcome{font-size:clamp(30px,5.8vw,62px);font-weight:700;color:#f7f0dd;letter-spacing:.2em;text-indent:.2em;',
        'opacity:0;transform:translateY(16px) scale(.94);}',
        '.fog-openrite .fr-welcome.on{opacity:1;transform:none;transition:opacity .9s ease,transform 1s cubic-bezier(.16,.9,.3,1);',
        'animation:frbreath 3s ease-in-out infinite;}',
        '@keyframes frbreath{0%,100%{text-shadow:0 0 22px rgba(216,173,100,.5),0 0 64px rgba(216,173,100,.3);}50%{text-shadow:0 0 40px rgba(216,173,100,.95),0 0 110px rgba(216,173,100,.6);}}',
        '.fog-openrite .fr-prayer{margin-top:24px;font-size:clamp(15px,2.4vw,22px);letter-spacing:.42em;text-indent:.42em;color:#d6dfce;opacity:0;transform:translateY(10px);}',
        '.fog-openrite .fr-prayer.on{opacity:.95;transform:none;transition:opacity 1s ease .18s,transform 1s ease .18s;}',
        '.fog-openrite .fr-day{position:absolute;top:26px;left:0;right:0;text-align:center;font-size:11px;letter-spacing:.42em;color:rgba(180,195,210,.62);opacity:0;transition:opacity .8s ease;z-index:2;}',
        '.fog-openrite .fr-day.on{opacity:.85;}',
        '.fog-openrite .fr-sound{position:absolute;top:20px;right:20px;z-index:3;width:40px;height:40px;border-radius:12px;border:1px solid rgba(150,170,190,.32);background:rgba(8,10,15,.55);color:#cfd8e2;font-size:17px;line-height:1;cursor:pointer;opacity:.9;}',
        '@media (prefers-reduced-motion: reduce){.fog-openrite .fr-welcome{animation:none !important;}.fog-openrite *{transition-duration:.15s !important;}}'
      ].join('');
      document.head.appendChild(st);
    }

    // ---- 结构（顺序：veil 背景 → canvas 粒子 → 文字/开关）----
    var overlay = document.createElement('div');
    overlay.className = 'fog-openrite';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', faith.god + '之神 · 开卷仪式');
    overlay.innerHTML =
      '<div class="fr-veil" aria-hidden="true"></div>' +
      '<canvas class="fr-canvas" aria-hidden="true"></canvas>' +
      '<button class="fr-sound" type="button" aria-label="切换音效">🔇</button>' +
      '<div class="fr-day" aria-hidden="true">' + faith.god + ' · ' + title + '</div>' +
      '<div class="fr-gate" aria-hidden="true"><span>点击启封信仰之地</span></div>' +
      '<div class="fr-stage">' +
        '<div class="fr-welcome">欢迎来到信仰之地</div>' +
        '<div class="fr-prayer">' + faith.prayer + '</div>' +
      '</div>';
    document.documentElement.appendChild(overlay);

    var q = function (s) { return overlay.querySelector(s); };
    var gate = q('.fr-gate'), welcome = q('.fr-welcome'), prayer = q('.fr-prayer'),
        dayEl = q('.fr-day'), soundBtn = q('.fr-sound'), cvs = q('.fr-canvas');

    // ---- 音效 ----
    var audio = document.createElement('audio');
    audio.preload = 'auto';
    audio.src = 'assets/audio/rite-' + ('0' + (idx + 1)).slice(-2) + '.mp3';
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
    paint();

    // ---- 画布 ----
    var ctx = cvs.getContext('2d');
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, cx = 0, cy = 0, MAXR = 0, UNIT = 0;
    function resize() {
      W = overlay.clientWidth || window.innerWidth; H = overlay.clientHeight || window.innerHeight;
      cvs.width = Math.floor(W * DPR); cvs.height = Math.floor(H * DPR);
      cvs.style.width = W + 'px'; cvs.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      cx = W / 2; cy = H / 2; MAXR = Math.sqrt(cx * cx + cy * cy); UNIT = Math.min(W, H);
    }
    function rgba(rgb, a) { return 'rgba(' + rgb + ',' + a + ')'; }
    function glow(x, y, r, rgb, a) {
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(rgb, a));
      g.addColorStop(0.5, rgba(rgb, a * 0.35));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
    }

    var seeds = [], petals = [], veins = [], burst = false;
    var T = { A: 1000, B: 2200, C: 3000, D: 3500 };

    function burstNow() {
      burst = true;
      var N = 130 + boost;
      for (var i = 0; i < N; i++) {
        seeds.push({
          a: Math.random() * Math.PI * 2, d: UNIT * 0.02,
          sp: (2.0 + Math.random() * 3.4) * (UNIT / 1000),
          size: 1.8 + Math.random() * 3.6, bud: 0, golden: Math.random() < 0.55
        });
      }
      var P = 70 + Math.round(boost * 0.6);
      for (var j = 0; j < P; j++) {
        var pa = Math.random() * Math.PI * 2, pv = (0.9 + Math.random() * 2.4) * (UNIT / 1200);
        petals.push({
          x: cx, y: cy, vx: Math.cos(pa) * pv, vy: Math.sin(pa) * pv - 0.05,
          rot: Math.random() * 6.283, vr: (Math.random() - 0.5) * 0.012,
          len: 7 + Math.random() * 12, w: 2.4 + Math.random() * 3.2, golden: Math.random() < 0.45
        });
      }
      var dirs = [-Math.PI / 4, -3 * Math.PI / 4, Math.PI / 4, 3 * Math.PI / 4, 0, Math.PI, -Math.PI / 2, Math.PI / 2,
                  -Math.PI / 8, -7 * Math.PI / 8, Math.PI / 8, 7 * Math.PI / 8];
      for (var k = 0; k < dirs.length; k++) {
        var v = { a: dirs[k], buds: [] };
        var n = 5 + Math.floor(Math.random() * 5);
        for (var b = 0; b < n; b++) v.buds.push({ at: 0.22 + Math.random() * 0.74, born: 0, r: 1.4 + Math.random() * 2.6 });
        veins.push(v);
      }
    }

    function drawSeed(t) {
      var pulse = 0.5 + 0.5 * Math.sin(t / 300);
      var r = UNIT * (0.05 + 0.018 * pulse);
      // 外层柔光
      glow(cx, cy, r * 5.2, priRgb, 0.5 + 0.28 * pulse);
      glow(cx, cy, r * 2.6, secRgb, 0.5 + 0.3 * pulse);
      // 光晕环
      ctx.beginPath(); ctx.arc(cx, cy, r * 1.5, 0, 6.283);
      ctx.strokeStyle = rgba(secRgb, 0.5 + 0.3 * pulse); ctx.lineWidth = 1.4; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, r * 2.1, 0, 6.283);
      ctx.strokeStyle = rgba(priRgb, 0.28 + 0.18 * pulse); ctx.lineWidth = 1; ctx.stroke();
      // 胚种核心
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.72, 0, 6.283);
      ctx.fillStyle = rgba('255,253,244', 0.6 + 0.4 * pulse); ctx.fill();
      // 微光搏动的呼吸射线
      var rays = 8;
      for (var i = 0; i < rays; i++) {
        var ang = i / rays * 6.283 + t / 1400;
        var r0 = r * 1.35, r1 = r * (1.7 + 0.45 * pulse);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
        ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
        ctx.strokeStyle = rgba(secRgb, 0.5 * pulse); ctx.lineWidth = 1.6; ctx.stroke();
      }
    }

    function drawFlash(t) {
      var p = Math.min(1, (t - T.A) / 820);
      if (p <= 0) return;
      var e = 1 - Math.pow(1 - p, 3);
      var r = MAXR * (0.16 + 1.05 * e);
      var a = (1 - e) * 1.0;
      glow(cx, cy, r, secRgb, a);
      glow(cx, cy, r * 0.45, '255,246,220', a);
    }

    function drawVeins(t) {
      var p = Math.max(0, Math.min(1, (t - T.A) / 1150));
      var fade = t < T.C ? 1 : Math.max(0, 1 - (t - T.C) / 520);
      for (var i = 0; i < veins.length; i++) {
        var v = veins[i];
        var len = MAXR * 1.0 * p;
        var ex = cx + Math.cos(v.a) * len, ey = cy + Math.sin(v.a) * len;
        var lg = ctx.createLinearGradient(cx, cy, ex, ey);
        lg.addColorStop(0, rgba(secRgb, 0.85 * fade));
        lg.addColorStop(0.5, rgba(priRgb, 0.45 * fade));
        lg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.strokeStyle = lg; ctx.lineWidth = 2.4; ctx.beginPath();
        ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
        for (var b = 0; b < v.buds.length; b++) {
          var bd = v.buds[b];
          if (p >= bd.at) {
            bd.born = Math.min(1, bd.born + 0.05);
            var bx = cx + Math.cos(v.a) * len * bd.at, by = cy + Math.sin(v.a) * len * bd.at;
            var pr = bd.r * bd.born * (1 + 0.7 * Math.abs(Math.sin(t / 240 + b)));
            glow(bx, by, pr * 4.5, priRgb, 0.5 * fade * bd.born);
            ctx.beginPath(); ctx.arc(bx, by, pr, 0, 6.283);
            ctx.fillStyle = rgba(secRgb, 0.85 * fade * bd.born); ctx.fill();
          }
        }
      }
    }

    function drawSeeds(dt, t) {
      var fade = t < T.C ? 1 : Math.max(0, 1 - (t - T.C) / 620);
      for (var i = 0; i < seeds.length; i++) {
        var s = seeds[i];
        if (t >= T.C) s.sp *= 0.94;
        s.d += s.sp * dt * 0.06;
        s.bud = Math.min(1, s.bud + dt * 0.002);
        var x = cx + Math.cos(s.a) * s.d, y = cy + Math.sin(s.a) * s.d;
        var col = s.golden ? secRgb : priRgb;
        // 飞行拖尾
        if (s.d > 1) {
          var tx = cx + Math.cos(s.a) * (s.d - s.size * 5), ty = cy + Math.sin(s.a) * (s.d - s.size * 5);
          var tg = ctx.createLinearGradient(tx, ty, x, y);
          tg.addColorStop(0, 'rgba(0,0,0,0)'); tg.addColorStop(1, rgba(col, 0.5 * fade));
          ctx.strokeStyle = tg; ctx.lineWidth = s.size * 0.7; ctx.beginPath();
          ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
        }
        // 发光胚芽
        var bl = s.bud * 12;
        if (bl > 0.5) {
          ctx.beginPath();
          ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(s.a) * bl, y + Math.sin(s.a) * bl);
          ctx.strokeStyle = rgba(priRgb, 0.7 * fade); ctx.lineWidth = 1.4; ctx.stroke();
          glow(x + Math.cos(s.a) * bl, y + Math.sin(s.a) * bl, 4, secRgb, 0.6 * fade);
        }
        glow(x, y, s.size * 4.2, col, 0.85 * fade);
        ctx.beginPath(); ctx.arc(x, y, s.size, 0, 6.283);
        ctx.fillStyle = rgba('255,250,236', 0.9 * fade); ctx.fill();
      }
    }

    function drawPetals(dt, t) {
      var fade = t < T.C ? 1 : Math.max(0, 1 - (t - T.C) / 620);
      for (var i = 0; i < petals.length; i++) {
        var p = petals[i];
        p.x += p.vx * dt * 0.06; p.y += p.vy * dt * 0.06; p.rot += p.vr * dt * 0.06;
        if (t >= T.C) { p.vx *= 0.95; p.vy *= 0.95; }
        var col = p.golden ? secRgb : priRgb;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = rgba(col, 0.7 * fade);
        ctx.beginPath(); ctx.ellipse(0, 0, p.w, p.len, 0, 0, 6.283); ctx.fill();
        ctx.restore();
      }
    }

    function drawConverge(t) {
      if (t < T.C) return;
      var p = Math.min(1, (t - T.C) / 780);
      // 向内收敛的光环
      var r = MAXR * 0.7 * (1 - p) + UNIT * 0.05;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283);
      ctx.strokeStyle = rgba(secRgb, (1 - p) * 0.7); ctx.lineWidth = 2.4; ctx.stroke();
      // 收敛后的淡金光核（托住文字）
      glow(cx, cy, UNIT * 0.42, secRgb, 0.42 * p);
      glow(cx, cy, UNIT * 0.22, '255,246,220', 0.28 * p);
    }

    var raf = 0, lastT = 0, startT = 0, started = false;
    function frame(ts) {
      if (!lastT) lastT = ts;
      var dt = Math.min(64, ts - lastT); lastT = ts;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (started) {
        var t = ts - startT;
        if (!burst && t >= T.A) burstNow();
        ctx.globalCompositeOperation = 'lighter';
        if (t < T.A) drawSeed(t);
        else { drawFlash(t); drawVeins(t); drawSeeds(dt, t); drawPetals(dt, t); drawConverge(t); }
        ctx.globalCompositeOperation = 'source-over';
      }
      raf = window.requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);
    raf = window.requestAnimationFrame(frame);

    // ---- 生命周期 ----
    var done = false, timers = [];
    function clr() { for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]); timers.length = 0; }
    function finish() {
      if (done) return; done = true; clr();
      overlay.classList.add('fr-out');
      try { audio.pause(); } catch (e) {}
      timers.push(setTimeout(function () {
        window.cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
        window.removeEventListener('keydown', onKey, true);
        overlay.removeEventListener('click', onClick);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        try { localStorage.setItem(LS_SHOWN, today); } catch (e) {}
      }, 520));
    }
    function start() {
      if (started) { finish(); return; }
      started = true; startT = performance.now();
      gate.classList.add('off');
      tryPlay();
      timers.push(setTimeout(function () { dayEl.classList.add('on'); }, 200));
      timers.push(setTimeout(function () { welcome.classList.add('on'); }, T.B));
      timers.push(setTimeout(function () { prayer.classList.add('on'); }, T.B + 320));
      timers.push(setTimeout(function () { overlay.classList.add('fr-out'); }, T.C));
      timers.push(setTimeout(function () { finish(); }, T.D));
    }
    function onClick(e) { if (e.target === soundBtn || soundBtn.contains(e.target)) return; start(); }
    function onKey() { start(); }
    overlay.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey, true);

    window[NS] = {
      destroy: function () { finish(); },
      finishNow: finish, start: start,
      probe: function () {
        try {
          var d = ctx.getImageData(0, 0, cvs.width, cvs.height).data, n = 0, b = 0, m = 0, i;
          for (i = 3; i < d.length; i += 4) { var a = d[i]; if (a > 12) n++; if (a > 120) b++; if (a > m) m = a; }
          return { painted: n, bright: b, maxA: m };
        } catch (e) { return { err: String(e) }; }
      },
      god: faith.god, day: idx + 1
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

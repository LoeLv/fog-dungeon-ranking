/* 诸神愚戏 · 开卷仪式（开启动画）— v7「沉静」视觉重构
 *  进入站点：不透明深黑帷幕 + 淡小字「点击启封信仰之地」（首页后台静默加载）。
 *  点击后播放四段式入场动画，采用更克制、更有质感的电影化视觉语言：
 *    0–1s    全屏深黑；中心悬浮柔和光核缓速搏动，极细同心环微光，无刺目光芒；
 *    1–2.2s  光核温和绽开、柔光外溢；中心生出数缕「有机曲线光须」缓缓舒展（非线性、低饱和、
 *            末梢渐隐）；光须沿途浮起柔焦光尘；大量景深光点（近处大而朦胧、远处小而清晰）
 *            向外缓缓漂移；整体叠加胶片颗粒与暗角，沉静而有层次；
 *    2.2–3s  光须与光尘缓慢消隐；一圈极淡光环外扩褪去；居中大字「欢迎来到信仰之地」柔和浮现；
 *            底部八字祷词淡入；
 *    3–4.5s  一切缓缓溶解，平稳切入首页。
 *  音效：Web Audio API 程序化合成（无需外部文件），与时间轴同步，见 createRiteAudio()。
 *  16 天一轮回，一天一个信仰；文案/神徽/主题色取自 assets/js/world-data.js。
 *  右上角可开关音效（localStorage 记忆）。
 *  接入：在 index.html 的 </body> 前引入 <script defer src="assets/js/opening-rite.js?v=7"></script>
 */
(function () {
  'use strict';
  var NS = '__fogOpenRite';
  try { if (window[NS] && typeof window[NS].destroy === 'function') window[NS].destroy(); } catch (e) {}

  // ===== CONFIG =====
  var EPOCH = '2026-09-30';          // 轮回起点：该日 = 第 1 个信仰「诞育」（可修改）
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

  // ================= 音效：Web Audio API 程序化合成 =================
  function createRiteAudio() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    var ac;
    try { ac = new AC(); } catch (e) { return null; }
    var master = ac.createGain();
    master.gain.value = 0.0;
    master.connect(ac.destination);
    var vol = 0.9, stopped = false, started = false;
    var killList = [];

    function noise(dur) {
      var len = Math.max(1, Math.floor(ac.sampleRate * dur));
      var buf = ac.createBuffer(1, len, ac.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      var src = ac.createBufferSource(); src.buffer = buf; return src;
    }
    function keep(n) { killList.push(n); return n; }

    // 0–1s：地底微弱心跳式低频嗡鸣
    function subHum(t, dur) {
      var o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = 40;
      var g = ac.createGain();
      var lfo = ac.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.9;
      var lg = ac.createGain(); lg.gain.value = 0.016;
      lfo.connect(lg); lg.connect(g.gain);
      o.connect(g); g.connect(master);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.25);
      g.gain.setValueAtTime(0.05, t + dur - 0.3);
      g.gain.linearRampToValueAtTime(0, t + dur);
      o.start(t); o.stop(t + dur + 0.05);
      lfo.start(t); lfo.stop(t + dur + 0.05);
      keep(o); keep(lfo);
    }
    // 心跳（lub-dub）
    function heartbeat(at, amp) {
      [0, 0.16].forEach(function (off, i) {
        var o = ac.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(64, at + off);
        o.frequency.exponentialRampToValueAtTime(38, at + off + 0.13);
        var g = ac.createGain();
        g.gain.setValueAtTime(0, at + off);
        g.gain.linearRampToValueAtTime(amp * (i ? 0.68 : 1), at + off + 0.014);
        g.gain.exponentialRampToValueAtTime(0.0001, at + off + 0.17);
        o.connect(g); g.connect(master);
        o.start(at + off); o.stop(at + off + 0.22); keep(o);
      });
    }
    // 1–2.2s 爆发：空灵水晶碎裂声
    function crystal(at) {
      var n = noise(0.55);
      var hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2400;
      var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 6200; bp.Q.value = 0.8;
      var g = ac.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.15, at + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.55);
      n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(master);
      n.start(at); keep(n);
      for (var i = 0; i < 8; i++) {           // 空灵水晶泛音
        var f = 1700 + Math.random() * 4400;
        var o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        var pg = ac.createGain();
        var to = at + i * 0.028;
        pg.gain.setValueAtTime(0, to);
        pg.gain.linearRampToValueAtTime(0.045, to + 0.004);
        pg.gain.exponentialRampToValueAtTime(0.0001, to + 0.4);
        o.connect(pg); pg.connect(master);
        o.start(to); o.stop(to + 0.42); keep(o);
      }
    }
    // 1–2.2s 舒展竖琴琶音（上行五声音阶，带泛音余韵）
    function harp(at, dur) {
      var scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
      var base = 392, step = dur / scale.length;
      for (var i = 0; i < scale.length; i++) {
        var f = base * Math.pow(2, scale[i] / 12);
        var to = at + i * step;
        for (var h = 1; h <= 3; h++) {
          var o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = f * h;
          var g = ac.createGain(); var a = 0.055 / h;
          g.gain.setValueAtTime(0, to);
          g.gain.linearRampToValueAtTime(a, to + 0.008);
          g.gain.exponentialRampToValueAtTime(0.0001, to + 0.95);
          o.connect(g); g.connect(master);
          o.start(to); o.stop(to + 1.0); keep(o);
        }
      }
    }
    // 1–2.2s 种子萌发沙沙声
    function rustle(at, dur) {
      var n = noise(dur);
      var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3600; bp.Q.value = 0.6;
      var g = ac.createGain();
      var lfo = ac.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 8.5;
      var lg = ac.createGain(); lg.gain.value = 0.018;
      lfo.connect(lg); lg.connect(g.gain);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.03, at + dur * 0.4);
      g.gain.linearRampToValueAtTime(0, at + dur);
      n.connect(bp); bp.connect(g); g.connect(master);
      n.start(at); lfo.start(at); lfo.stop(at + dur + 0.05);
      keep(n); keep(lfo);
    }
    // 2.2–3s 柔和长音共鸣
    function pad(at, dur) {
      var freqs = [196, 261.6, 392];
      for (var i = 0; i < freqs.length; i++) {
        var o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = freqs[i];
        var g = ac.createGain();
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(0.038 / (i + 1), at + 0.45);
        g.gain.linearRampToValueAtTime(0, at + dur);
        o.connect(g); g.connect(master);
        o.start(at); o.stop(at + dur + 0.05); keep(o);
      }
    }

    return {
      start: function () {
        if (stopped || started) return;
        started = true;
        try { if (ac.state === 'suspended') ac.resume(); } catch (e) {}
        var T = ac.currentTime;
        master.gain.cancelScheduledValues(T);
        master.gain.setValueAtTime(vol, T);
        subHum(T, 1.0);
        heartbeat(T + 0.12, 0.16); heartbeat(T + 0.55, 0.12);
        crystal(T + 1.0);
        rustle(T + 1.05, 1.15);
        harp(T + 1.05, 1.15);
        heartbeat(T + 1.5, 0.09);
        pad(T + 2.2, 2.3);
        master.gain.setValueAtTime(vol, T + 3.0);
        master.gain.linearRampToValueAtTime(0, T + 4.5);
      },
      mute: function (on) {                 // on=true 静音
        try { master.gain.cancelScheduledValues(ac.currentTime);
              master.gain.setValueAtTime(on ? 0 : vol, ac.currentTime); } catch (e) {}
      },
      state: function () { return ac.state; },
      close: function () {
        stopped = true;
        try { for (var i = 0; i < killList.length; i++) { try { killList[i].stop(); } catch (e) {} } } catch (e) {}
        try { ac.close(); } catch (e) {}
      }
    };
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
    var boost = Math.min(cycleNum * 10, 80);         // 第 17 天起光点略微增加
    var priRgb = hex2rgb(faith.primary);
    var secRgb = hex2rgb(faith.secondary);

    // ---- 样式 ----
    if (!document.getElementById('fogOpenRiteStyles')) {
      var st = document.createElement('style');
      st.id = 'fogOpenRiteStyles';
      st.textContent = [
        '.fog-openrite{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483000;background:#030407;',
        'cursor:pointer;overflow:hidden;opacity:1;font-family:"Songti SC","STSong",Georgia,"Noto Serif SC",serif;}',
        '.fog-openrite.fr-out{opacity:0;transition:opacity .6s ease;}',
        '.fog-openrite .fr-veil{position:absolute;inset:0;z-index:0;background:radial-gradient(125% 100% at 50% 47%,#0a0c11 0%,#060709 44%,#020304 100%);}',
        '.fog-openrite .fr-canvas{position:absolute;inset:0;z-index:1;width:100%;height:100%;}',
        '.fog-openrite .fr-gate{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;',
        'color:rgba(200,208,220,.66);font-size:clamp(12px,1.5vw,15px);font-weight:300;letter-spacing:.62em;text-indent:.62em;opacity:1;',
        'transition:opacity .6s ease;animation:frgate 3.2s ease-in-out infinite;z-index:2;}',
        '.fog-openrite .fr-gate.off{opacity:0;animation:none;}',
        '@keyframes frgate{0%,100%{opacity:.26;}50%{opacity:.78;}}',
        '.fog-openrite .fr-stage{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;pointer-events:none;z-index:2;}',
        '.fog-openrite .fr-welcome{font-size:clamp(26px,5vw,54px);font-weight:400;color:#e9e3d5;letter-spacing:.42em;text-indent:.42em;',
        'opacity:0;transform:translateY(14px);text-shadow:0 0 22px rgba(210,196,168,.22),0 0 60px rgba(210,196,168,.14);}',
        '.fog-openrite .fr-welcome.on{opacity:1;transform:none;transition:opacity 1.1s ease,transform 1.2s cubic-bezier(.16,.9,.3,1);',
        'animation:frbreath 4.4s ease-in-out infinite;}',
        '@keyframes frbreath{0%,100%{text-shadow:0 0 20px rgba(210,196,168,.20),0 0 54px rgba(210,196,168,.12);}50%{text-shadow:0 0 30px rgba(214,200,172,.36),0 0 80px rgba(214,200,172,.2);}}',
        '.fog-openrite .fr-prayer{margin-top:26px;font-size:clamp(13px,2vw,19px);font-weight:300;letter-spacing:.5em;text-indent:.5em;color:#c9d0c4;opacity:0;transform:translateY(8px);}',
        '.fog-openrite .fr-prayer.on{opacity:.9;transform:none;transition:opacity 1.2s ease .2s,transform 1.2s ease .2s;}',
        '.fog-openrite .fr-day{position:absolute;top:30px;left:0;right:0;text-align:center;font-size:11px;font-weight:300;letter-spacing:.5em;color:rgba(176,188,200,.5);opacity:0;transition:opacity 1.1s ease;z-index:2;}',
        '.fog-openrite .fr-day.on{opacity:.8;}',
        '.fog-openrite .fr-sound{position:absolute;top:20px;right:20px;z-index:3;width:38px;height:38px;border-radius:10px;border:1px solid rgba(150,170,190,.26);background:rgba(8,10,15,.4);color:#c6cfd8;font-size:16px;line-height:1;cursor:pointer;opacity:.72;transition:opacity .3s ease;}',
        '.fog-openrite .fr-sound:hover{opacity:1;}',
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

    // ---- 音效（合成引擎）----
    var soundOn = true;
    try { soundOn = (localStorage.getItem(LS_SOUND) || '1') === '1'; } catch (e) {}
    var riteAudio = null;
    function paint() { soundBtn.textContent = soundOn ? '🔊' : '🔇'; try { localStorage.setItem(LS_SOUND, soundOn ? '1' : '0'); } catch (e) {} }
    soundBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      soundOn = !soundOn; paint();
      if (riteAudio) {
        if (!soundOn) riteAudio.mute(true);
        else { if (started) riteAudio.mute(false); }
      }
    });
    paint();

    // ---- 画布 ----
    var ctx = cvs.getContext('2d');
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, cx = 0, cy = 0, MAXR = 0, UNIT = 0;

    // 调色工具：低饱和、去艳、柔和
    function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')'; }
    function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
    function desat(c, amt) { var g = (c[0] + c[1] + c[2]) / 3; return mix(c, [g, g, g], amt); }
    function shade(c, f) { return [c[0] * f, c[1] * f, c[2] * f]; }

    var HILITE = [234, 230, 219];                       // 柔和暖白（非纯白）
    var pri = desat(priRgb, 0.16);                      // 主色去艳处理
    var sec = desat(secRgb, 0.10);
    var priSoft = mix(pri, HILITE, 0.35);
    var secSoft = mix(sec, HILITE, 0.30);
    var deep = mix(shade(pri, 0.55), [4, 5, 8], 0.4);   // 光须根部近黑

    // 胶片颗粒瓦片（一次生成）
    var grainTile = (function () {
      var c = document.createElement('canvas'); c.width = c.height = 150;
      var g = c.getContext('2d');
      var id = g.createImageData(150, 150);
      for (var i = 0; i < 150 * 150; i++) {
        var v = 90 + Math.random() * 165;
        id.data[i * 4] = v; id.data[i * 4 + 1] = v; id.data[i * 4 + 2] = v;
        id.data[i * 4 + 3] = Math.random() * 20;         // 最高约 0.08 透明度
      }
      g.putImageData(id, 0, 0);
      return c;
    })();
    var grainPat = null;

    function resize() {
      W = overlay.clientWidth || window.innerWidth; H = overlay.clientHeight || window.innerHeight;
      cvs.width = Math.floor(W * DPR); cvs.height = Math.floor(H * DPR);
      cvs.style.width = W + 'px'; cvs.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      cx = W / 2; cy = H / 2; MAXR = Math.sqrt(cx * cx + cy * cy); UNIT = Math.min(W, H);
      grainPat = ctx.createPattern(grainTile, 'repeat');
      buildField();
    }

    function glow(x, y, r, c, a) {
      if (a <= 0 || r <= 0) return;
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(c, a));
      g.addColorStop(0.45, rgba(c, a * 0.34));
      g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
    }
    function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
    function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

    var filaments = [], nodes = [], motes = [], dust = [], burst = false;
    var T = { A: 1000, B: 2200, C: 3000, D: 4500 };      // 四段式时间轴

    // 场景「光尘/景深」基底：与尺寸相关，resize 时重建
    function buildField() {
      motes.length = 0; dust.length = 0;
      var MN = 120 + boost;
      for (var i = 0; i < MN; i++) {
        var z = Math.random();                            // 0 远(小而清晰) → 1 近(大而朦胧)
        motes.push({
          a: Math.random() * 6.283,
          sp: (0.35 + Math.random() * 1.15) * (UNIT / 1000),
          size: (0.9 + z * 3.4) * (UNIT / 720),
          blur: (2.5 + z * 7) * (UNIT / 720),
          z: z, gold: Math.random() < 0.4, tw: Math.random() * 6.283
        });
      }
      var DN = 90;
      for (var j = 0; j < DN; j++) {
        dust.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.04, vy: -0.012 - Math.random() * 0.05,
          r: 0.6 + Math.random() * 1.1, a: 0.05 + Math.random() * 0.16
        });
      }
    }

    function burstNow() {
      burst = true;
      filaments.length = 0; nodes.length = 0;
      var FN = 6;
      for (var i = 0; i < FN; i++) {
        var base = (i / FN) * 6.283 + (Math.random() - 0.5) * 0.9;
        filaments.push({
          a: base, amp: 0.75 + Math.random() * 0.85,
          freq: 0.85 + Math.random() * 1.15, phase: Math.random() * 6.283,
          sway: 0.00028 + Math.random() * 0.00032, width: 0.9 + Math.random() * 0.9,
          col: Math.random() < 0.5 ? priSoft : secSoft
        });
      }
      for (var k = 0; k < 26; k++) {
        nodes.push({
          f: (Math.random() * filaments.length) | 0,
          at: 0.16 + Math.random() * 0.8,
          r: (1.0 + Math.random() * 2.4) * (UNIT / 720),
          born: 0, col: Math.random() < 0.5 ? priSoft : HILITE,
          ph: Math.random() * 6.283
        });
      }
    }

    // ---- 段一：光核（0–1s）----
    function drawSeed(t) {
      var pulse = 0.5 + 0.5 * Math.sin(t / 420);
      var r = UNIT * (0.036 + 0.011 * pulse);
      glow(cx, cy, r * 8.5, pri, 0.06 + 0.035 * pulse);       // 极淡外晕
      glow(cx, cy, r * 4.2, sec, 0.11 + 0.06 * pulse);
      glow(cx, cy, r * 1.7, priSoft, 0.30 + 0.16 * pulse);
      glow(cx, cy, r * 0.7, HILITE, 0.5 + 0.22 * pulse);
      // 极细同心环（缓慢反向旋转，几乎不可察）
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = rgba(priSoft, 0.14 + 0.08 * pulse);
      ctx.beginPath(); ctx.arc(cx, cy, r * (2.6 + 0.15 * pulse), 0, 6.283); ctx.stroke();
      ctx.strokeStyle = rgba(secSoft, 0.10 + 0.05 * pulse);
      ctx.beginPath(); ctx.arc(cx, cy, r * (4.0 + 0.2 * pulse), t / 9000, t / 9000 + 5.6); ctx.stroke();
    }

    // ---- 段二：柔光外溢 ----
    function drawFlash(t) {
      var p = clamp01((t - T.A) / 950);
      if (p <= 0) return;
      var e = easeOutCubic(p);
      var r = MAXR * (0.12 + 0.92 * e);
      glow(cx, cy, r, sec, (1 - e) * 0.34);
      glow(cx, cy, r * 0.42, HILITE, (1 - e) * 0.30);
    }

    // ---- 段二：有机曲线光须（非线性、低饱和、末梢渐隐）----
    function drawFilaments(t) {
      var p = clamp01((t - T.A) / 1500);
      if (p <= 0) return;
      var fade = t < T.C ? 1 : Math.max(0, 1 - (t - T.C) / 1300);
      var reachEase = easeOutCubic(p);
      ctx.lineCap = 'round';
      for (var i = 0; i < filaments.length; i++) {
        var f = filaments[i];
        var reach = MAXR * 1.02 * reachEase;
        var ca = Math.cos(f.a), sa = Math.sin(f.a);
        var px = cx, py = cy;
        var steps = 34;
        for (var s = 1; s <= steps; s++) {
          var u = s / steps;
          if (u > reachEase) break;
          var along = reach * u;
          var lateral = f.amp * Math.sin(u * f.freq * 2.7 + f.phase + t * f.sway) * along * 0.20;
          var x = cx + ca * along + (-sa) * lateral;
          var y = cy + sa * along + (ca) * lateral;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(x, y);
          ctx.lineWidth = Math.max(0.3, f.width * (1 - u) * (UNIT / 720));
          ctx.strokeStyle = rgba(f.col, 0.15 * fade * (1 - u * 0.8));
          ctx.stroke();
          px = x; py = y;
        }
        // 根部柔和暖光
        glow(cx, cy, UNIT * 0.10, mix(f.col, HILITE, 0.3), 0.10 * fade);
      }
    }

    // ---- 段二：光须沿途柔焦节点 ----
    function drawNodes(t) {
      var p = clamp01((t - T.A) / 1500);
      var fade = t < T.C ? 1 : Math.max(0, 1 - (t - T.C) / 1300);
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i], f = filaments[n.f];
        if (!f || p < n.at) continue;
        n.born = Math.min(1, n.born + 0.045);
        var u = n.at, along = MAXR * 1.02 * easeOutCubic(p) * u;
        var lateral = f.amp * Math.sin(u * f.freq * 2.7 + f.phase + t * f.sway) * along * 0.20;
        var ca = Math.cos(f.a), sa = Math.sin(f.a);
        var x = cx + ca * along + (-sa) * lateral;
        var y = cy + sa * along + (ca) * lateral;
        var tw = 0.7 + 0.3 * Math.sin(t / 300 + n.ph);
        glow(x, y, n.r * 6, n.col, 0.20 * fade * n.born * tw);
        glow(x, y, n.r * 1.6, mix(n.col, HILITE, 0.4), 0.34 * fade * n.born);
      }
    }

    // ---- 景深光点（近处大而朦胧、远处小而清晰）----
    function drawMotes(dt, t) {
      var appear = t < T.A ? 0 : clamp01((t - T.A) / 600);
      var fade = t < T.C ? 1 : Math.max(0, 1 - (t - T.C) / 1500);
      for (var i = 0; i < motes.length; i++) {
        var m = motes[i];
        m.a += (m.sp * dt * 0.00012);
        var d = UNIT * 0.06 + m.sp * dt * 0.0018 + (t - T.A) * m.sp * 0.00012;
        var x = cx + Math.cos(m.a) * d, y = cy + Math.sin(m.a) * d;
        var col = m.gold ? sec : pri;
        var tw = 0.65 + 0.35 * Math.sin(t / 420 + m.tw);
        var aCore = (0.5 - m.z * 0.3) * fade * appear * tw;
        glow(x, y, m.size + m.blur, col, Math.max(0, aCore * 0.4));
        glow(x, y, m.size, mix(col, HILITE, 0.35), Math.max(0, aCore));
      }
    }

    // ---- 常驻浮尘（与场景同为暗场质感）----
    function drawDust(dt) {
      for (var i = 0; i < dust.length; i++) {
        var d = dust[i];
        d.x += d.vx * dt * 0.06; d.y += d.vy * dt * 0.06;
        if (d.y < -4) { d.y = H + 4; d.x = Math.random() * W; }
        if (d.x < -4) d.x = W + 4; if (d.x > W + 4) d.x = -4;
        ctx.fillStyle = rgba(HILITE, d.a);
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.283); ctx.fill();
      }
    }

    // ---- 段三：极淡外扩光环 ----
    function drawConverge(t) {
      if (t < T.C) return;
      var p = clamp01((t - T.C) / 1300);
      var r = MAXR * 0.72 * (1 - p) + UNIT * 0.04;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283);
      ctx.strokeStyle = rgba(secSoft, (1 - p) * 0.28); ctx.lineWidth = 1.2; ctx.stroke();
      glow(cx, cy, UNIT * 0.4, sec, 0.16 * (1 - p));
      glow(cx, cy, UNIT * 0.2, HILITE, 0.12 * (1 - p));
    }

    // ---- 暗角 + 胶片颗粒（source-over，收束画面、增添质感）----
    function drawFilm() {
      var vg = ctx.createRadialGradient(cx, cy, UNIT * 0.18, cx, cy, MAXR * 1.03);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(0.7, 'rgba(0,0,0,0.10)');
      vg.addColorStop(1, 'rgba(0,0,0,0.52)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      if (grainPat) {
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.translate(-((Math.random() * 150) | 0), -((Math.random() * 150) | 0));
        ctx.fillStyle = grainPat; ctx.fillRect(0, 0, W + 150, H + 150);
        ctx.restore();
      }
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
        else { drawFlash(t); drawFilaments(t); drawNodes(t); drawConverge(t); }
        drawMotes(dt, t);
        ctx.globalCompositeOperation = 'source-over';
        drawDust(dt);
        drawFilm();
      } else {
        // 帷幕阶段：极淡浮尘，静中有微动
        drawDust(dt);
        drawFilm();
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
      if (riteAudio) { try { riteAudio.close(); } catch (e) {} }
      overlay.classList.add('fr-out');
      timers.push(setTimeout(function () {
        window.cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
        window.removeEventListener('keydown', onKey, true);
        overlay.removeEventListener('click', onClick);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        try { localStorage.setItem(LS_SHOWN, today); } catch (e) {}
      }, 620));
    }
    function start() {
      if (started) { finish(); return; }
      started = true; startT = performance.now();
      if (soundOn) {
        riteAudio = createRiteAudio();
        if (riteAudio) riteAudio.start();
      }
      gate.classList.add('off');
      timers.push(setTimeout(function () { dayEl.classList.add('on'); }, 240));
      timers.push(setTimeout(function () { welcome.classList.add('on'); }, T.B));
      timers.push(setTimeout(function () { prayer.classList.add('on'); }, T.B + 360));
      timers.push(setTimeout(function () { overlay.classList.add('fr-out'); }, T.D - 600));
      timers.push(setTimeout(function () { finish(); }, T.D));
    }
    function onClick(e) { if (e.target === soundBtn || soundBtn.contains(e.target)) return; start(); }
    function onKey() { start(); }
    overlay.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey, true);

    window[NS] = {
      destroy: function () { finish(); },
      finishNow: finish, start: start,
      audioState: function () { return riteAudio ? riteAudio.state() : 'none'; },
      god: faith.god, day: idx + 1
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

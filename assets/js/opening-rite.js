/*! 诸神愚戏 · 十六信仰开卷仪式 (Opening Rite) v6 · 多信仰（诞育 / 繁荣）
 *  进入站点：不透明深黑帷幕 + 淡小字「点击启封信仰之地」（首页后台静默加载）。
 *  点击后播放四段式入场动画（严格按提示词，画布采用加色混合 lighter，粒子真正发光）：
 *    0–1s    全屏深黑，中心悬浮半透明发光「生命胚种」，微光缓慢搏动；
 *    1–2.2s  胚种炸开，金色生命光核喷涌；种子粒子球形外喷并萌发发光胚芽；卵囊光纹由中心向四角蔓延，
 *            光脉持续生成微型发光花苞，花瓣碎片飘散（多层粒子叠加，华丽有层次）；
 *    2.2–3s  光核收敛；居中大字「欢迎来到信仰之地」带淡金呼吸光晕浮现；底部八字祷词淡入；
 *    3–4.5s  花苞光点消融、光脉褪去，平稳切入首页（结尾较原设计延长 1s，观感更佳）。
 *  音效：使用 Web Audio API 程序化合成（无需外部文件），与动画时间轴同步：
 *    0–1s    地底微弱心跳式低频嗡鸣；
 *    1–2.2s  空灵水晶碎裂声 + 舒展竖琴琶音 + 种子萌发沙沙声，隐约极轻生命搏动；
 *    2.2–3s  柔和长音共鸣；
 *    3–4.5s  尾音缓缓消散（与动画结尾同步延长 1s）。
 *  16 天一轮回，一天一个信仰；文案/神徽/主题色取自 assets/js/world-data.js。
 *  右上角可开关音效（localStorage 记忆）。
 *  接入：在 index.html 的 </body> 前引入 <script defer src="assets/js/opening-rite.js?v=..."></script>
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

  // ===== 视觉 / 音效 profile（按信仰切换；诞育=第 1 日，繁荣=第 2 日）=====
  var PROFILES = {
    诞育: { pri: '#81c487', sec: '#d8ad64', accent: '255,246,220', mode: 'seed' },
    繁荣: { pri: '#2f8f4e', sec: '#5fe0b0', accent: '180,255,214', mode: 'vine' }
  };
  function profileOf(god) {
    return PROFILES[god] || { pri: '#81c487', sec: '#d8ad64', accent: '255,246,220', mode: 'seed' };
  }

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
  function createRiteAudio(name) {
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

    // ---- \u7e41\u8363\uff08\u7b2c 2 \u65e5\uff09\u97f3\u8272\uff1a\u68ee\u6797\u5e95\u566a / \u7a7a\u7075\u6728\u7ba1 / \u53f6\u7247\u6c99\u6c99 / \u6d41\u4f53\u6d41\u6c34 ----
    function forestBed(at, dur) {
      var n = noise(dur);
      var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 0.6;
      var g = ac.createGain();
      var lfo = ac.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.15;
      var lg = ac.createGain(); lg.gain.value = 0.01;
      lfo.connect(lg); lg.connect(g.gain);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.028, at + dur * 0.4);
      g.gain.linearRampToValueAtTime(0, at + dur);
      n.connect(lp); lp.connect(g); g.connect(master);
      n.start(at); lfo.start(at); lfo.stop(at + dur + 0.05);
      keep(n); keep(lfo);
    }
    function woodwind(at, dur) {
      var notes = [523.25, 659.25, 783.99];
      for (var i = 0; i < notes.length; i++) {
        var o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = notes[i];
        var vib = ac.createOscillator(); vib.type = 'sine'; vib.frequency.value = 5.0 + i * 0.4;
        var vg = ac.createGain(); vg.gain.value = 2.2;
        vib.connect(vg); vg.connect(o.frequency);
        var g = ac.createGain();
        var to = at + i * 0.14;
        g.gain.setValueAtTime(0, to);
        g.gain.linearRampToValueAtTime(0.05 / (i + 1), to + 0.5);
        g.gain.linearRampToValueAtTime(0, at + dur);
        o.connect(g); g.connect(master);
        o.start(to); o.stop(at + dur + 0.05);
        vib.start(to); vib.stop(at + dur + 0.05);
        keep(o); keep(vib);
      }
    }
    function leafShiver(at, dur) {
      var n = noise(dur);
      var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 0.7;
      var g = ac.createGain();
      var lfo = ac.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 11;
      var lg = ac.createGain(); lg.gain.value = 0.02;
      lfo.connect(lg); lg.connect(g.gain);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.032, at + dur * 0.35);
      g.gain.linearRampToValueAtTime(0, at + dur);
      n.connect(bp); bp.connect(g); g.connect(master);
      n.start(at); lfo.start(at); lfo.stop(at + dur + 0.05);
      keep(n); keep(lfo);
    }
    function water(at, dur) {
      var n = noise(dur);
      var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 1.2;
      var g = ac.createGain();
      var lfo = ac.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.6;
      var lg = ac.createGain(); lg.gain.value = 420;
      lfo.connect(lg); lg.connect(bp.frequency);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.03, at + dur * 0.3);
      g.gain.linearRampToValueAtTime(0, at + dur);
      n.connect(bp); bp.connect(g); g.connect(master);
      n.start(at); lfo.start(at); lfo.stop(at + dur + 0.05);
      keep(n); keep(lfo);
      for (var i = 0; i < 7; i++) {
        var bt = at + Math.random() * dur * 0.8;
        var o = ac.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(400 + Math.random() * 500, bt);
        o.frequency.exponentialRampToValueAtTime(900 + Math.random() * 600, bt + 0.06);
        var bg = ac.createGain();
        bg.gain.setValueAtTime(0, bt);
        bg.gain.linearRampToValueAtTime(0.014, bt + 0.012);
        bg.gain.exponentialRampToValueAtTime(0.0001, bt + 0.14);
        o.connect(bg); bg.connect(master);
        o.start(bt); o.stop(bt + 0.16); keep(o);
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
        if (name === '繁荣') {
          forestBed(T, 1.0);
          woodwind(T + 1.0, 1.25);
          leafShiver(T + 1.05, 1.15);
          water(T + 1.05, 1.15);
          pad(T + 2.2, 2.3);
          master.gain.setValueAtTime(vol, T + 3.0);
          master.gain.linearRampToValueAtTime(0, T + 4.5);
        } else {
          subHum(T, 1.0);
          heartbeat(T + 0.12, 0.16); heartbeat(T + 0.55, 0.12);
          crystal(T + 1.0);
          rustle(T + 1.05, 1.15);
          harp(T + 1.05, 1.15);
          heartbeat(T + 1.5, 0.09);
          pad(T + 2.2, 2.3);
          master.gain.setValueAtTime(vol, T + 3.0);
          master.gain.linearRampToValueAtTime(0, T + 4.5);
        }
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
    var forceGod = null;
    try { forceGod = new URLSearchParams(location.search).get('rite'); } catch (e) {}
    if (!forceGod) { try { if (localStorage.getItem(LS_SHOWN) === today) return; } catch (e) {} }
    if (document.querySelector('.fog-openrite')) return;

    var epochMs = toUTC(EPOCH), todayMs = toUTC(today);
    var totalDays = (epochMs != null && todayMs != null) ? Math.round((todayMs - epochMs) / 86400000) : 0;
    var idx = ((totalDays % CYCLE) + CYCLE) % CYCLE;
    if (forceGod) { for (var fi = 0; fi < G.length; fi++) { if (G[fi].god === forceGod) { idx = fi; break; } } }
    var cycleNum = totalDays < 0 ? 0 : Math.floor(totalDays / CYCLE);
    var faith = G[idx];
    var title = TITLES[faith.god] || faith.god;
    var boost = Math.min(cycleNum * 12, 96);         // 第 17 天起粒子小幅增加
    var prof = profileOf(faith.god);
    var priRgb = hex2rgb(prof.pri).join(',');
    var secRgb = hex2rgb(prof.sec).join(',');
    var accRgb = prof.accent;
    var isVine = prof.mode === 'vine';

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
        'transition:opacity .5s ease;animation:frgate 2.6s ease-in-out infinite;z-index:2;}',
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
        else {
          // 若动画已开始则取消静音，否则等待 start()
          if (started) riteAudio.mute(false);
        }
      }
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
    var T = { A: 1000, B: 2200, C: 3000, D: 4500 };  // 结尾较原设计延长 1s（观感更佳）

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
      glow(cx, cy, r * 5.2, priRgb, 0.5 + 0.28 * pulse);
      glow(cx, cy, r * 2.6, secRgb, 0.5 + 0.3 * pulse);
      ctx.beginPath(); ctx.arc(cx, cy, r * 1.5, 0, 6.283);
      ctx.strokeStyle = rgba(secRgb, 0.5 + 0.3 * pulse); ctx.lineWidth = 1.4; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, r * 2.1, 0, 6.283);
      ctx.strokeStyle = rgba(priRgb, 0.28 + 0.18 * pulse); ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.72, 0, 6.283);
      ctx.fillStyle = rgba('255,253,244', 0.6 + 0.4 * pulse); ctx.fill();
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
      var fade = t < T.C ? 1 : Math.max(0, 1 - (t - T.C) / 1000);
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
      var fade = t < T.C ? 1 : Math.max(0, 1 - (t - T.C) / 1000);
      for (var i = 0; i < seeds.length; i++) {
        var s = seeds[i];
        if (t >= T.C) s.sp *= 0.94;
        s.d += s.sp * dt * 0.06;
        s.bud = Math.min(1, s.bud + dt * 0.002);
        var x = cx + Math.cos(s.a) * s.d, y = cy + Math.sin(s.a) * s.d;
        var col = s.golden ? secRgb : priRgb;
        if (s.d > 1) {
          var tx = cx + Math.cos(s.a) * (s.d - s.size * 5), ty = cy + Math.sin(s.a) * (s.d - s.size * 5);
          var tg = ctx.createLinearGradient(tx, ty, x, y);
          tg.addColorStop(0, 'rgba(0,0,0,0)'); tg.addColorStop(1, rgba(col, 0.5 * fade));
          ctx.strokeStyle = tg; ctx.lineWidth = s.size * 0.7; ctx.beginPath();
          ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
        }
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
      var fade = t < T.C ? 1 : Math.max(0, 1 - (t - T.C) / 1000);
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
      var p = Math.min(1, (t - T.C) / 1200);
      var r = MAXR * 0.7 * (1 - p) + UNIT * 0.05;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283);
      ctx.strokeStyle = rgba(secRgb, (1 - p) * 0.7); ctx.lineWidth = 2.4; ctx.stroke();
      glow(cx, cy, UNIT * 0.42, secRgb, 0.42 * p);
      glow(cx, cy, UNIT * 0.22, '255,246,220', 0.28 * p);
    }

    // ==== \u7e41\u8363\uff08\u7b2c 2 \u65e5\uff09\u7ed8\u5236\uff1a\u85e4\u8513 / \u73af\u5f62\u51b2\u51fb\u6ce2 / \u53d1\u5149\u82b1\u53f6 / \u8367\u5149\u5b62\u5b50 ====
    var vines2 = [], spores = [];
    function burstVines() {
      burst = true;
      var K = 8;
      for (var d = 0; d < K; d++) {
        var v = {
          a: d / K * 6.283 + (Math.random() - 0.5) * 0.3,
          maxLen: MAXR * (0.72 + Math.random() * 0.5),
          curl: (Math.random() - 0.5) * 0.6,
          nodes: [], branch: null
        };
        var n = 5 + Math.floor(Math.random() * 5);
        for (var b = 0; b < n; b++) v.nodes.push({ at: 0.18 + Math.random() * 0.78, born: 0, r: 1.6 + Math.random() * 2.8, side: Math.random() < 0.5 ? 1 : -1 });
        v.branch = {
          at: 0.34 + Math.random() * 0.4,
          a: v.a + (Math.random() < 0.5 ? 1 : -1) * (0.45 + Math.random() * 0.4),
          maxLen: MAXR * (0.3 + Math.random() * 0.35), nodes: []
        };
        for (var c = 0; c < 3; c++) v.branch.nodes.push({ at: 0.28 + Math.random() * 0.62, born: 0, r: 1.4 + Math.random() * 2 });
        vines2.push(v);
      }
      var S = 150 + boost;
      for (var sp = 0; sp < S; sp++) {
        spores.push({
          x: cx + (Math.random() - 0.5) * W * 0.92,
          y: cy + (Math.random() - 0.5) * H * 0.5 + H * 0.22,
          r: 1.2 + Math.random() * 2.6,
          vy: -(0.5 + Math.random() * 1.6) * (UNIT / 1000),
          vx: (Math.random() - 0.5) * 0.5 * (UNIT / 1000),
          ph: Math.random() * 6.283, jade: Math.random() < 0.6
        });
      }
    }
    function drawEdgeVines(t) {
      var a = 0.09 + 0.07 * Math.sin(t / 900);
      ctx.lineWidth = 2;
      for (var i = 0; i < 14; i++) {
        var ang = i / 14 * 6.283;
        var sx = cx + Math.cos(ang) * MAXR * 0.94, sy = cy + Math.sin(ang) * MAXR * 0.94;
        var mx = cx + Math.cos(ang + 0.2) * MAXR * 0.6, my = cy + Math.sin(ang + 0.2) * MAXR * 0.6;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(mx, my, cx + Math.cos(ang + 0.06) * MAXR * 0.34, cy + Math.sin(ang + 0.06) * MAXR * 0.34);
        ctx.strokeStyle = rgba(priRgb, a);
        ctx.stroke();
      }
    }
    function drawBud(t) {
      var pulse = 0.5 + 0.5 * Math.sin(t / 320);
      var r = UNIT * (0.045 + 0.016 * pulse);
      glow(cx, cy, r * 5.5, priRgb, 0.5 + 0.3 * pulse);
      glow(cx, cy, r * 2.6, secRgb, 0.5 + 0.3 * pulse);
      for (var s = -1; s <= 1; s += 2) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(s * 0.5 + Math.sin(t / 700) * 0.12);
        ctx.beginPath(); ctx.ellipse(0, -r * (1.5 + 0.3 * pulse), r * 0.62, r * 1.5, 0, 0, 6.283);
        ctx.fillStyle = rgba(secRgb, 0.55 + 0.3 * pulse); ctx.fill();
        ctx.restore();
      }
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 0, 6.283);
      ctx.fillStyle = rgba(accRgb, 0.75 + 0.25 * pulse); ctx.fill();
    }
    function drawRing(t) {
      var p = Math.min(1, (t - T.A) / 820);
      if (p <= 0) return;
      var e = 1 - Math.pow(1 - p, 3);
      var r = MAXR * (0.12 + 1.05 * e);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283);
      ctx.strokeStyle = rgba(secRgb, (1 - e) * 0.9);
      ctx.lineWidth = 3 + 6 * (1 - e); ctx.stroke();
      glow(cx, cy, r * 0.55, secRgb, (1 - e) * 0.55);
    }
    function drawVines(t) {
      var p = Math.max(0, Math.min(1, (t - T.A) / 1150));
      var grown = t < T.C ? p : 1;
      var fade = t < T.C ? 1 : Math.max(0, 1 - (t - T.C) / 1000);
      for (var i = 0; i < vines2.length; i++) {
        var v = vines2[i];
        var len = v.maxLen * grown;
        var ex = cx + Math.cos(v.a + v.curl * 0.3) * len, ey = cy + Math.sin(v.a + v.curl * 0.3) * len;
        var mx = cx + Math.cos(v.a + v.curl) * len * 0.55, my = cy + Math.sin(v.a + v.curl) * len * 0.55;
        var lg = ctx.createLinearGradient(cx, cy, ex, ey);
        lg.addColorStop(0, rgba(accRgb, 0.9 * fade));
        lg.addColorStop(0.4, rgba(secRgb, 0.6 * fade));
        lg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.strokeStyle = lg; ctx.lineWidth = 3.4;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
        for (var b = 0; b < v.nodes.length; b++) {
          var nd = v.nodes[b];
          if (grown >= nd.at) {
            nd.born = Math.min(1, nd.born + 0.04);
            var q = nd.at;
            var nx = cx + (ex - cx) * q + Math.cos(v.a + v.curl) * Math.sin(q * 3.14) * len * 0.12;
            var ny = cy + (ey - cy) * q + Math.sin(v.a + v.curl) * Math.sin(q * 3.14) * len * 0.12;
            var pr = nd.r * nd.born * (1 + 0.6 * Math.abs(Math.sin(t / 260 + b)));
            glow(nx, ny, pr * 5, secRgb, 0.5 * fade * nd.born);
            ctx.save(); ctx.translate(nx, ny); ctx.rotate(v.a + nd.side * 0.9);
            ctx.beginPath(); ctx.ellipse(0, 0, pr * 1.2, pr * 2.4, 0, 0, 6.283);
            ctx.fillStyle = rgba(priRgb, 0.8 * fade * nd.born); ctx.fill();
            ctx.restore();
            glow(nx, ny, pr * 2, accRgb, 0.7 * fade * nd.born);
          }
        }
        if (v.branch && grown >= v.branch.at) {
          var bl = v.branch.maxLen * Math.min(1, (grown - v.branch.at) / 0.5);
          var bx = cx + Math.cos(v.a + v.curl * 0.3) * len * v.branch.at;
          var by = cy + Math.sin(v.a + v.curl * 0.3) * len * v.branch.at;
          var bex = bx + Math.cos(v.branch.a) * bl, bey = by + Math.sin(v.branch.a) * bl;
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bex, bey);
          ctx.strokeStyle = rgba(secRgb, 0.55 * fade); ctx.lineWidth = 2; ctx.stroke();
          for (var cc = 0; cc < v.branch.nodes.length; cc++) {
            var cn = v.branch.nodes[cc];
            if (bl >= v.branch.maxLen * cn.at) {
              cn.born = Math.min(1, cn.born + 0.04);
              var tx = bx + (bex - bx) * cn.at, ty = by + (bey - by) * cn.at;
              var tr = cn.r * cn.born * (1 + 0.5 * Math.abs(Math.sin(t / 300 + cc)));
              glow(tx, ty, tr * 4, priRgb, 0.45 * fade * cn.born);
              ctx.beginPath(); ctx.arc(tx, ty, tr, 0, 6.283);
              ctx.fillStyle = rgba(secRgb, 0.8 * fade * cn.born); ctx.fill();
            }
          }
        }
      }
    }
    function drawSpores(dt, t) {
      var fade = t < T.C ? 1 : Math.max(0, 1 - (t - T.C) / 1200);
      for (var i = 0; i < spores.length; i++) {
        var s = spores[i];
        if (t >= T.C) { s.vy *= 0.985; s.vx *= 0.985; } else { s.vy -= 0.0006 * (UNIT / 1000); }
        s.x += s.vx * dt * 0.06 + Math.sin(t / 700 + s.ph) * 0.25;
        s.y += s.vy * dt * 0.06;
        if (s.y < -20) { s.y = H + 10; s.x = cx + (Math.random() - 0.5) * W * 0.92; }
        var col = s.jade ? secRgb : priRgb;
        glow(s.x, s.y, s.r * 5, col, 0.7 * fade);
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283);
        ctx.fillStyle = rgba(accRgb, 0.9 * fade); ctx.fill();
      }
    }
    function drawSettle(t) {
      if (t < T.C) return;
      var p = Math.min(1, (t - T.C) / 1200);
      glow(cx, cy, UNIT * 0.44, secRgb, 0.4 * (1 - p) + 0.15);
      glow(cx, cy, UNIT * 0.22, accRgb, 0.25 * (1 - p) + 0.08);
    }

    var raf = 0, lastT = 0, startT = 0, started = false;
    function frame(ts) {
      if (!lastT) lastT = ts;
      var dt = Math.min(64, ts - lastT); lastT = ts;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (started) {
        var t = ts - startT;
        ctx.globalCompositeOperation = 'lighter';
        if (isVine) {
          if (!burst && t >= T.A) burstVines();
          if (t < T.A) { drawEdgeVines(t); drawBud(t); }
          else { drawRing(t); drawVines(t); drawSpores(dt, t); drawSettle(t); }
        } else {
          if (!burst && t >= T.A) burstNow();
          if (t < T.A) drawSeed(t);
          else { drawFlash(t); drawVeins(t); drawSeeds(dt, t); drawPetals(dt, t); drawConverge(t); }
        }
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
      if (riteAudio) { try { riteAudio.close(); } catch (e) {} }
      overlay.classList.add('fr-out');
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
      // 音效：在用户点击手势内创建并播放（满足自动播放策略）
      if (soundOn) {
        riteAudio = createRiteAudio(isVine ? '繁荣' : '诞育');
        if (riteAudio) riteAudio.start();
      }
      gate.classList.add('off');
      timers.push(setTimeout(function () { dayEl.classList.add('on'); }, 200));
      timers.push(setTimeout(function () { welcome.classList.add('on'); }, T.B));
      timers.push(setTimeout(function () { prayer.classList.add('on'); }, T.B + 320));
      timers.push(setTimeout(function () { overlay.classList.add('fr-out'); }, T.D - 500));
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

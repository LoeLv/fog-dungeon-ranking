/* 诸神愚戏 · 开卷仪式（开启动画）— v8「成年礼」电影化引擎
 *  进入站点：不透明深黑帷幕 + 淡小字「点击启封信仰之地」（首页后台静默加载）。
 *  点击后播放四段式入场动画：0–1s 静默蓄势 → 1–2.2s 高光爆发 → 2.2–3s 文字浮现 → 3–4.5s 落幕。
 *  视觉语言：去卡通化（无直线放射、无串珠、无嫩芽具象），以柔和体积光、衍射环、
 *  有机曲线、景深光点、胶片颗粒与暗角营造沉静、成熟、电影化的质感。
 *  16 天一轮回，每天一个信仰，各自拥有专属场景与音效；文案/神徽/主题色来自 world-data.js。
 *  音效：Web Audio API 程序化合成（无需外部 mp3），仅合成当日信仰，按四段匹配时间轴。
 *  右上角可开关音效（localStorage 记忆）。第 17 天起（新一轮 Day1）粒子增强彩蛋。
 *  接入：index.html 的 </body> 前 <script defer src="assets/js/opening-rite.js?v=8"></script>
 */
(function () {
  'use strict';
  var NS = '__fogOpenRite';
  try { if (window[NS] && typeof window[NS].destroy === 'function') window[NS].destroy(); } catch (e) {}

  var EPOCH = '2026-09-30';                 // 轮回起点：该日 = 第 1 个信仰「诞育」（可修改）
  var LS_SHOWN = 'fog.openRite.lastShown';
  var LS_SOUND = 'fog.openRite.sound';

  // ===== 16 信仰真值表（与 world-data.js 对齐）=====
  // scene: 专属场景键；sfx: 音效事件序列；snd: 场景微调参数
  var F = [
    { god: '诞育', path: '生命', icon: '芽', pri: '#81c487', sec: '#d8ad64', prayer: '感孕生命，行育自然', title: '生命的起点', scene: 'vine',
      sfx: [['sub', 1.0], ['heart', 0.12, 0.16], ['heart', 0.55, 0.12], ['crystal', 1.0], ['rustle', 1.05, 1.15], ['harp', 1.05, 1.15], ['heart', 1.5, 0.09], ['pad', [196, 261.6, 392], 2.2, 2.3]] },
    { god: '繁荣', path: '生命', icon: '穗', pri: '#9ccd65', sec: '#e1c36d', prayer: '万物滋生，亦繁亦荣', title: '万物的滋长', scene: 'vine',
      sfx: [['sub', 1.0], ['heart', 0.15, 0.13], ['leaf', 1.0, 1.3], ['woodwind', 1.05, 1.2], ['harp', 1.2, 1.1], ['pad', [196, 293.7, 392], 2.2, 2.3]] },
    { god: '死亡', path: '生命', icon: '眠', pri: '#d76565', sec: '#9ea1ad', prayer: '灵魂安眠，生命终焉', title: '灵魂的安眠', scene: 'spirit',
      sfx: [['sub', 1.0], ['gong', 1.05], ['whisper', 1.1, 1.2], ['bell', 1.5], ['pad', [146.8, 220, 293.7], 2.2, 2.4]] },
    { god: '记忆', path: '存在', icon: '页', pri: '#9ec9dc', sec: '#d8dde7', prayer: '昔我长铭，流光拓影', title: '流光的拓影', scene: 'memory',
      sfx: [['sub', 1.0], ['film', 1.0, 1.3], ['piano', 1.05, [392, 523.3, 587.3, 783.9]], ['pad', [196, 246.9, 392], 2.2, 2.4]] },
    { god: '时间', path: '存在', icon: '沙', pri: '#9bc9ef', sec: '#cfd8e8', prayer: '时光如隙，我亦如风', title: '流逝的长河', scene: 'time',
      sfx: [['tick', 0, 1.0], ['gear', 1.0], ['string', 1.0, 1.4], ['whoosh', 1.05, 0.9], ['tick', 2.2, 0.9], ['pad', [174.6, 261.6, 349.2], 2.2, 2.3]] },
    { god: '秩序', path: '文明', icon: '衡', pri: '#c07855', sec: '#8a5c3a', prayer: '文明火起，秩序长存', title: '长存的法则', scene: 'order',
      sfx: [['sub', 1.0], ['organ', 1.0], ['chime', 1.05], ['choir', 2.2, 2.4]] },
    { god: '真理', path: '文明', icon: '典', pri: '#dce5e8', sec: '#b48d63', prayer: '洞窥本质，行见真理', title: '本质的窥见', scene: 'crystal',
      sfx: [['sub', 1.0], ['chime', 1.0], ['piano', 1.05, [523.3, 659.3, 783.9, 1046.5]], ['glass', 1.2, 1.0], ['pad', [261.6, 392, 523.3], 2.2, 2.3]] },
    { god: '战争', path: '文明', icon: '矛', pri: '#e0644e', sec: '#5e4c45', prayer: '何以求存，唯血与火', title: '存续的烈火', scene: 'war',
      sfx: [['drumlow', 0, 1.0], ['drum', 1.0], ['clang', 1.05], ['whoosh', 1.1, 0.6], ['drum', 1.5], ['horn', 2.2, 2.3]] },
    { god: '欺诈', path: '虚无', icon: '面', pri: '#d7a95f', sec: '#7b4fc8', prayer: '不辨真伪，勿论虚实', title: '真伪的迷局', scene: 'trickery',
      sfx: [['sub', 1.0], ['porta', 1.0], ['echo', 1.05], ['pad', [196, 233.1, 311.1], 2.2, 2.4]] },
    { god: '命运', path: '虚无', icon: '骰', pri: '#91a7ff', sec: '#8a5cff', prayer: '命若繁星，望而不及', title: '难及的繁星', scene: 'fate',
      sfx: [['sub', 1.0], ['star', 1.0], ['chime', 1.1], ['glass', 1.3, 1.0], ['pad', [174.6, 261.6, 392, 523.3], 2.2, 2.4]] },
    { god: '混乱', path: '混沌', icon: '涡', pri: '#c9b967', sec: '#d48b55', prayer: '虚构规律，寰宇笑谈', title: '寰宇的笑谈', scene: 'chaos',
      sfx: [['trem', 0, 1.0], ['rock', 1.0], ['roar', 1.05], ['trem', 2.2, 1.0]] },
    { god: '痴愚', path: '混沌', icon: '眸', pri: '#d2c785', sec: '#9e9aa4', prayer: '生命皆痴，文明皆愚', title: '痴妄的明悟', scene: 'illusion',
      sfx: [['sub', 1.0], ['detune', 1.0], ['whisper', 1.05, 1.2], ['pad', [207.7, 246.9, 311.1], 2.2, 2.3]] },
    { god: '污堕', path: '沉沦', icon: '溺', pri: '#c65a88', sec: '#4a2d3a', prayer: '解开枷锁，直面心欲', title: '枷锁的解脱', scene: 'fluid',
      sfx: [['sub', 1.0], ['trem', 1.0, 1.2], ['wet', 1.0, 1.2], ['pad', [146.8, 196, 233.1], 2.2, 2.3]] },
    { god: '腐朽', path: '沉沦', icon: '朽', pri: '#a58a57', sec: '#707268', prayer: '众生应腐，万物将朽', title: '万物的凋朽', scene: 'debris',
      sfx: [['sub', 1.0], ['crack', 1.0], ['gravel', 1.05, 1.2], ['cello', 1.1, 1.4], ['pad', [146.8, 185, 233.1], 2.2, 2.2]] },
    { god: '湮灭', path: '沉沦', icon: '烬', pri: '#b8bcc8', sec: '#555b65', prayer: '于无中生，于寂中灭', title: '寂灭的终焉', scene: 'void',
      sfx: [['vacuum', 0, 1.0], ['roar', 1.0], ['suck', 1.05, 1.2], ['boom', 1.0], ['pad', [110, 146.8, 220], 2.2, 2.0]] },
    { god: '沉默', path: '混沌', icon: '默', pri: '#aebbc8', sec: '#758897', prayer: '万物归寂，寰宇无音', title: '无声的归寂', scene: 'silence',
      sfx: [['faint', 0, 1.0], ['spacehum', 1.0, 2.0], ['pad', [130.8, 196, 261.6], 2.2, 2.0]] }
  ];
  var CYCLE = F.length;

  function toUTC(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s)); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; }
  function dayKey(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function hex2rgb(hex) { var h = String(hex).replace('#', ''); if (h.length === 3) h = h.replace(/./g, function (c) { return c + c; }); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }

  // ================= 音效：Web Audio API 程序化合成 =================
  function createRiteAudio(events) {
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    var ac; try { ac = new AC(); } catch (e) { return null; }
    var master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
    var vol = 0.9, stopped = false, started = false, kill = [];
    function keep(n) { kill.push(n); return n; }
    function noiseBuf(dur) {
      var len = Math.max(1, Math.floor(ac.sampleRate * dur)); var b = ac.createBuffer(1, len, ac.sampleRate); var d = b.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; var s = ac.createBufferSource(); s.buffer = b; return s;
    }
    function osc(type, f, at, dur, g, glide) {
      var o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, at);
      if (glide) o.frequency.exponentialRampToValueAtTime(glide, at + dur);
      var gg = ac.createGain(); gg.gain.setValueAtTime(0, at);
      gg.gain.linearRampToValueAtTime(g, at + Math.min(0.02, dur * 0.2));
      gg.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(gg); gg.connect(master); o.start(at); o.stop(at + dur + 0.03); keep(o);
    }
    function noiseHit(at, dur, type, freq, q, g0) {
      var n = noiseBuf(dur), f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
      var g = ac.createGain(); g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(g0, at + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      n.connect(f); f.connect(g); g.connect(master); n.start(at); keep(n);
    }
    // ---- 音色基元 ----
    var P = {
      sub: function (dur) { var o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = 40;
        var lfo = ac.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.8; var lg = ac.createGain(); lg.gain.value = 0.016; lfo.connect(lg);
        var g = ac.createGain(); lg.connect(g.gain); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.05, 0.25); g.gain.setValueAtTime(0.05, dur - 0.3); g.gain.linearRampToValueAtTime(0, dur);
        o.connect(g); g.connect(master); o.start(0); o.stop(dur + 0.05); lfo.start(0); lfo.stop(dur + 0.05); keep(o); keep(lfo); },
      faint: function (dur) { P.sub(dur * 0.5); },
      vacuum: function (dur) { var o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = 28; var g = ac.createGain();
        g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.035, 0.3); g.gain.setValueAtTime(0.035, dur - 0.2); g.gain.linearRampToValueAtTime(0, dur);
        o.connect(g); g.connect(master); o.start(0); o.stop(dur + 0.05); keep(o); },
      heart: function (at, amp) { [0, 0.16].forEach(function (off, i) { var o = ac.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(64, at + off); o.frequency.exponentialRampToValueAtTime(38, at + off + 0.13);
        var g = ac.createGain(); g.gain.setValueAtTime(0, at + off); g.gain.linearRampToValueAtTime(amp * (i ? 0.68 : 1), at + off + 0.014); g.gain.exponentialRampToValueAtTime(0.0001, at + off + 0.17);
        o.connect(g); g.connect(master); o.start(at + off); o.stop(at + off + 0.22); keep(o); }); },
      crystal: function (at) { noiseHit(at, 0.55, 'bandpass', 6200, 0.8, 0.14); for (var i = 0; i < 8; i++) osc('sine', 1700 + Math.random() * 4400, at + i * 0.028, 0.4, 0.045); },
      bell: function (at) { [1, 2.01, 2.98, 4.2].forEach(function (h, i) { osc('sine', 220 * h, at, 2.2 - i * 0.3, 0.05 / (i + 1)); }); },
      gong: function (at) { [1, 1.48, 2.13, 3.04].forEach(function (h, i) { osc('sine', 98 * h, at, 2.4 - i * 0.35, 0.06 / (i + 1)); }); noiseHit(at, 0.6, 'lowpass', 800, 0.7, 0.05); },
      harp: function (at, dur) { var sc = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24], base = 392, st = dur / sc.length;
        for (var i = 0; i < sc.length; i++) { var f = base * Math.pow(2, sc[i] / 12); for (var h = 1; h <= 3; h++) osc('triangle', f * h, at + i * st, 0.95, 0.055 / h); } },
      piano: function (at, notes) { for (var i = 0; i < notes.length; i++) { var f = notes[i];
        osc('triangle', f, at + i * 0.16, 1.4, 0.06); osc('sine', f * 2, at + i * 0.16, 1.0, 0.025); } },
      chime: function (at) { for (var i = 0; i < 7; i++) osc('sine', 1200 * Math.pow(2, (i * 2) / 12), at + i * 0.09, 0.7, 0.05); },
      chimeSeq: function (at) { for (var i = 0; i < 9; i++) osc('sine', 880 * Math.pow(2, i / 12), at + i * 0.07, 0.5, 0.04); },
      glass: function (at, dur) { noiseHit(at, dur, 'highpass', 3200, 0.7, 0.05); for (var i = 0; i < 5; i++) osc('sine', 2400 + Math.random() * 5000, at + i * 0.05, 0.6, 0.03); },
      rustle: function (at, dur) { var n = noiseBuf(dur), bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3600; bp.Q.value = 0.6;
        var g = ac.createGain(); var lfo = ac.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 8.5; var lg = ac.createGain(); lg.gain.value = 0.018; lfo.connect(lg); lg.connect(g.gain);
        g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.03, at + dur * 0.4); g.gain.linearRampToValueAtTime(0, at + dur);
        n.connect(bp); bp.connect(g); g.connect(master); n.start(at); lfo.start(at); lfo.stop(at + dur + 0.05); keep(n); keep(lfo); },
      leaf: function (at, dur) { P.rustle(at, dur); },
      woodwind: function (at, dur) { osc('sine', 440, at, dur, 0.05, 554); osc('triangle', 660, at + 0.1, dur * 0.8, 0.03); },
      whoosh: function (at, dur) { var n = noiseBuf(dur), f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
        f.frequency.setValueAtTime(400, at); f.frequency.exponentialRampToValueAtTime(3200, at + dur);
        var g = ac.createGain(); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.07, at + dur * 0.5); g.gain.linearRampToValueAtTime(0, at + dur);
        n.connect(f); f.connect(g); g.connect(master); n.start(at); keep(n); },
      roar: function (at) { var n = noiseBuf(1.2), f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520; var g = ac.createGain();
        g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.12, at + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, at + 1.1);
        n.connect(f); f.connect(g); g.connect(master); n.start(at); keep(n); osc('sine', 60, at, 1.1, 0.06, 34); },
      boom: function (at) { osc('sine', 70, at, 0.9, 0.14, 30); noiseHit(at, 0.5, 'lowpass', 300, 0.6, 0.1); },
      suck: function (at, dur) { var n = noiseBuf(dur), f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9;
        f.frequency.setValueAtTime(3000, at); f.frequency.exponentialRampToValueAtTime(300, at + dur);
        var g = ac.createGain(); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.09, at + dur * 0.6); g.gain.linearRampToValueAtTime(0, at + dur);
        n.connect(f); f.connect(g); g.connect(master); n.start(at); keep(n); },
      spacehum: function (at, dur) { osc('sine', 55, at, dur, 0.05); osc('sine', 55.3, at, dur, 0.04); },
      trem: function (at, dur) { for (var i = 0; i < 3; i++) { var o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 220 + i * 3;
        var lfo = ac.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 11; var lg = ac.createGain(); lg.gain.value = 0.4; lfo.connect(lg);
        var g = ac.createGain(); lg.connect(g.gain); g.gain.value = 0.018; var f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
        o.connect(f); f.connect(g); g.connect(master); o.start(at); lfo.start(at); o.stop(at + dur); lfo.stop(at + dur); keep(o); keep(lfo); } },
      string: function (at, dur) { osc('sawtooth', 196, at, dur, 0.035); osc('sawtooth', 294, at + 0.05, dur * 0.9, 0.028); },
      gear: function (at) { for (var i = 0; i < 6; i++) noiseHit(at + i * 0.12, 0.06, 'bandpass', 2400, 2, 0.05); },
      tick: function (at, dur) { for (var i = 0; i < Math.floor(dur * 2); i++) noiseHit(at + i * 0.5, 0.03, 'bandpass', 4200, 3, 0.03); },
      organ: function (at) { [130.8, 196, 261.6, 392].forEach(function (f) { osc('sine', f, at, 2.2, 0.045); osc('triangle', f * 2, at, 1.6, 0.02); }); },
      choir: function (at, dur) { [196, 246.9, 293.7, 392].forEach(function (f) { osc('sine', f, at, dur, 0.03); osc('sine', f * 1.5, at, dur, 0.015); }); },
      drumlow: function (at, dur) { for (var i = 0; i < 4; i++) P.boom(at + i * (dur / 4)); },
      drum: function (at) { P.boom(at); noiseHit(at, 0.2, 'lowpass', 400, 0.7, 0.12); },
      clang: function (at) { noiseHit(at, 0.5, 'bandpass', 3600, 1.2, 0.08); osc('sine', 1800, at, 0.5, 0.03); osc('sine', 2700, at, 0.4, 0.02); },
      horn: function (at, dur) { [174.6, 220, 261.6].forEach(function (f) { osc('sawtooth', f, at, dur, 0.03); }); },
      rock: function (at) { noiseHit(at, 0.4, 'lowpass', 900, 0.7, 0.12); osc('sine', 90, at, 0.5, 0.07, 50); },
      detune: function (at) { osc('sawtooth', 233, at, 1.3, 0.03); osc('sawtooth', 235, at, 1.3, 0.03); osc('sawtooth', 346, at, 1.1, 0.02); },
      whisper: function (at, dur) { var n = noiseBuf(dur), f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 1.4;
        var g = ac.createGain(); var lfo = ac.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.7; var lg = ac.createGain(); lg.gain.value = 0.02; lfo.connect(lg); lg.connect(g.gain);
        g.gain.setValueAtTime(0.012, at); n.connect(f); f.connect(g); g.connect(master); n.start(at); lfo.start(at); lfo.stop(at + dur); keep(n); keep(lfo); },
      wet: function (at, dur) { var n = noiseBuf(dur), f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
        var g = ac.createGain(); var lfo = ac.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 3.2; var lg = ac.createGain(); lg.gain.value = 0.03; lfo.connect(lg); lg.connect(g.gain);
        g.gain.setValueAtTime(0.02, at); n.connect(f); f.connect(g); g.connect(master); n.start(at); lfo.start(at); lfo.stop(at + dur); keep(n); keep(lfo); },
      crack: function (at) { for (var i = 0; i < 5; i++) noiseHit(at + Math.random() * 0.4, 0.05, 'bandpass', 1200 + Math.random() * 1500, 2, 0.06); },
      gravel: function (at, dur) { var n = noiseBuf(dur), f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1800;
        var g = ac.createGain(); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.045, at + dur * 0.4); g.gain.linearRampToValueAtTime(0, at + dur);
        n.connect(f); f.connect(g); g.connect(master); n.start(at); keep(n); },
      cello: function (at, dur) { osc('sawtooth', 110, at, dur, 0.035); osc('sawtooth', 164.8, at, dur, 0.022); },
      film: function (at, dur) { var n = noiseBuf(dur), f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 0.7;
        var g = ac.createGain(); var lfo = ac.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 14; var lg = ac.createGain(); lg.gain.value = 0.02; lfo.connect(lg); lg.connect(g.gain);
        g.gain.setValueAtTime(0.025, at); n.connect(f); f.connect(g); g.connect(master); n.start(at); lfo.start(at); lfo.stop(at + dur); keep(n); keep(lfo); },
      porta: function (at) { osc('sawtooth', 300, at, 1.0, 0.04, 600); osc('sawtooth', 600, at + 0.5, 0.8, 0.03, 300); },
      echo: function (at) { for (var i = 0; i < 5; i++) osc('sine', 523.3, at + i * 0.22, 0.5, 0.035 / (i + 1)); },
      star: function (at) { for (var i = 0; i < 12; i++) osc('sine', 700 + Math.random() * 2000, at + Math.random() * 1.0, 0.7, 0.03); },
      pad: function (freqs, at, dur) { for (var i = 0; i < freqs.length; i++) { var o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = freqs[i];
        var g = ac.createGain(); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.038 / (i + 1), at + 0.45); g.gain.linearRampToValueAtTime(0, at + dur);
        o.connect(g); g.connect(master); o.start(at); o.stop(at + dur + 0.05); keep(o); } }
    };
    return {
      start: function () {
        if (stopped || started) return; started = true;
        try { if (ac.state === 'suspended') ac.resume(); } catch (e) {}
        var T = ac.currentTime;
        master.gain.cancelScheduledValues(T); master.gain.setValueAtTime(vol, T);
        for (var k = 0; k < events.length; k++) {
          var e3 = events[k], nm = e3[0], a = e3.slice(1);
          try {
            if (nm === 'sub' || nm === 'vacuum' || nm === 'faint') { P[nm](a[0]); }
            else if (nm === 'pad') { P.pad(a[0], T + a[1], a[2]); }
            else if (nm === 'piano') { P.piano(T + a[0], a[1]); }
            else { a[0] = T + a[0]; P[nm].apply(null, a); }
          } catch (err) {}
        }
        master.gain.setValueAtTime(vol, T + 3.0); master.gain.linearRampToValueAtTime(0, T + 4.5);
      },
      mute: function (on) { try { master.gain.cancelScheduledValues(ac.currentTime); master.gain.setValueAtTime(on ? 0 : vol, ac.currentTime); } catch (e) {} },
      state: function () { return ac.state; },
      close: function () { stopped = true; try { for (var i = 0; i < kill.length; i++) { try { kill[i].stop(); } catch (e) {} } } catch (e) {} try { ac.close(); } catch (e) {} }
    };
  }

  function boot() {
    var now = new Date(), today = dayKey(now);
    try { if (localStorage.getItem(LS_SHOWN) === today) return; } catch (e) {}
    if (document.querySelector('.fog-openrite')) return;

    var epochMs = toUTC(EPOCH), todayMs = toUTC(today);
    var totalDays = (epochMs != null && todayMs != null) ? Math.round((todayMs - epochMs) / 86400000) : 0;
    var idx = ((totalDays % CYCLE) + CYCLE) % CYCLE;
    var cycleNum = totalDays < 0 ? 0 : Math.floor(totalDays / CYCLE);
    var faith = F[idx], title = faith.title;
    var boost = Math.min(cycleNum * 10, 80);           // 第 17 天起粒子增强彩蛋
    var priRgb = hex2rgb(faith.pri), secRgb = hex2rgb(faith.sec);

    // ---- 样式 ----
    if (!document.getElementById('fogOpenRiteStyles')) {
      var st = document.createElement('style'); st.id = 'fogOpenRiteStyles';
      st.textContent = [
        '.fog-openrite{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483000;background:#030407;cursor:pointer;overflow:hidden;opacity:1;font-family:"Songti SC","STSong",Georgia,"Noto Serif SC",serif;}',
        '.fog-openrite.fr-out{opacity:0;transition:opacity .6s ease;}',
        '.fog-openrite .fr-veil{position:absolute;inset:0;z-index:0;background:radial-gradient(125% 100% at 50% 47%,#0a0c11 0%,#060709 46%,#020304 100%);}',
        '.fog-openrite .fr-canvas{position:absolute;inset:0;z-index:1;width:100%;height:100%;}',
        '.fog-openrite .fr-gate{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;color:rgba(200,208,220,.66);font-size:clamp(12px,1.5vw,15px);font-weight:300;letter-spacing:.62em;text-indent:.62em;opacity:1;transition:opacity .6s ease;animation:frgate 3.2s ease-in-out infinite;z-index:2;}',
        '.fog-openrite .fr-gate.off{opacity:0;animation:none;}',
        '@keyframes frgate{0%,100%{opacity:.26;}50%{opacity:.78;}}',
        '.fog-openrite .fr-stage{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;pointer-events:none;z-index:2;}',
        '.fog-openrite .fr-welcome{font-size:clamp(26px,5vw,54px);font-weight:400;color:#e9e3d5;letter-spacing:.42em;text-indent:.42em;opacity:0;transform:translateY(14px);}',
        '.fog-openrite .fr-welcome.on{opacity:1;transform:none;transition:opacity 1.1s ease,transform 1.2s cubic-bezier(.16,.9,.3,1);animation:frbreath 4.4s ease-in-out infinite;}',
        '@keyframes frbreath{0%,100%{opacity:.94;}50%{opacity:1;}}',
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

    var overlay = document.createElement('div');
    overlay.className = 'fog-openrite'; overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', faith.god + '之神 · 开卷仪式');
    overlay.innerHTML =
      '<div class="fr-veil" aria-hidden="true"></div>' +
      '<canvas class="fr-canvas" aria-hidden="true"></canvas>' +
      '<button class="fr-sound" type="button" aria-label="切换音效">🔇</button>' +
      '<div class="fr-day" aria-hidden="true">' + faith.god + ' · ' + title + '</div>' +
      '<div class="fr-gate" aria-hidden="true"><span>点击启封信仰之地</span></div>' +
      '<div class="fr-stage"><div class="fr-welcome">欢迎来到信仰之地</div><div class="fr-prayer">' + faith.prayer + '</div></div>';
    document.documentElement.appendChild(overlay);

    var q = function (s) { return overlay.querySelector(s); };
    var gate = q('.fr-gate'), welcome = q('.fr-welcome'), prayer = q('.fr-prayer'), dayEl = q('.fr-day'), soundBtn = q('.fr-sound'), cvs = q('.fr-canvas');
    // 文字光晕随信仰主题色
    var glowCol = 'rgba(' + secRgb.join(',') + ',';
    welcome.style.textShadow = '0 0 22px ' + glowCol + '.30), 0 0 60px ' + glowCol + '.16)';

    // ---- 音效 ----
    var soundOn = true; try { soundOn = (localStorage.getItem(LS_SOUND) || '1') === '1'; } catch (e) {}
    var riteAudio = null, started = false;
    function paint() { soundBtn.textContent = soundOn ? '🔊' : '🔇'; try { localStorage.setItem(LS_SOUND, soundOn ? '1' : '0'); } catch (e) {} }
    soundBtn.addEventListener('click', function (ev) { ev.stopPropagation(); soundOn = !soundOn; paint(); if (riteAudio) { if (!soundOn) riteAudio.mute(true); else if (started) riteAudio.mute(false); } });
    paint();

    // ---- 画布 ----
    var ctx = cvs.getContext('2d');
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, cx = 0, cy = 0, MAXR = 0, UNIT = 0;
    function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')'; }
    function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
    function desat(c, amt) { var g = (c[0] + c[1] + c[2]) / 3; return mix(c, [g, g, g], amt); }
    function shade(c, f) { return [c[0] * f, c[1] * f, c[2] * f]; }
    var HILITE = [234, 230, 219];
    var pri = desat(priRgb, 0.14), sec = desat(secRgb, 0.08);
    var priSoft = mix(pri, HILITE, 0.34), secSoft = mix(sec, HILITE, 0.28);

    var grainTile = (function () { var c = document.createElement('canvas'); c.width = c.height = 150; var g = c.getContext('2d'); var id = g.createImageData(150, 150);
      for (var i = 0; i < 150 * 150; i++) { var v = 90 + Math.random() * 165; id.data[i * 4] = v; id.data[i * 4 + 1] = v; id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = Math.random() * 20; } g.putImageData(id, 0, 0); return c; })();
    var grainPat = null;

    function glow(x, y, r, c, a) { if (a <= 0 || r <= 0) return; var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(c, a)); g.addColorStop(0.45, rgba(c, a * 0.34)); g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); }
    function eoc(x) { return 1 - Math.pow(1 - x, 3); }
    function c01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
    function rnd(a, b) { return a + Math.random() * (b - a); }

    var T = { A: 1000, B: 2200, C: 3000, D: 4500 };
    var motes = [], dust = [], burst = false, shakeX = 0, shakeY = 0;

    function buildField() {
      motes.length = 0; dust.length = 0;
      var MN = 110 + boost;
      for (var i = 0; i < MN; i++) { var z = Math.random();
        motes.push({ a: Math.random() * 6.283, sp: (0.35 + Math.random() * 1.1) * (UNIT / 1000), size: (0.9 + z * 3.2) * (UNIT / 720), blur: (2.5 + z * 7) * (UNIT / 720), z: z, gold: Math.random() < 0.4, tw: Math.random() * 6.283 }); }
      for (var j = 0; j < 80; j++) dust.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.04, vy: -0.012 - Math.random() * 0.05, r: 0.6 + Math.random() * 1.1, a: 0.05 + Math.random() * 0.15 });
    }
    function resize() {
      W = overlay.clientWidth || window.innerWidth; H = overlay.clientHeight || window.innerHeight;
      cvs.width = Math.floor(W * DPR); cvs.height = Math.floor(H * DPR); cvs.style.width = W + 'px'; cvs.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); cx = W / 2; cy = H / 2; MAXR = Math.sqrt(cx * cx + cy * cy); UNIT = Math.min(W, H);
      grainPat = ctx.createPattern(grainTile, 'repeat'); buildField(); SC.init();
    }

    // ================= 场景系统 =================
    var P2 = {};   // 场景粒子容器
    function newSeedCore() { return { pulse: 0 }; }

    // 成熟「光核」：柔和体积光 + 衍射环（无直线放射、无串珠）
    function drawCore(t) {
      var pulse = 0.5 + 0.5 * Math.sin(t / 520);
      var r = UNIT * (0.028 + 0.008 * pulse);
      glow(cx, cy, r * 12, pri, 0.05 + 0.03 * pulse);
      glow(cx, cy, r * 6.5, sec, 0.09 + 0.05 * pulse);
      glow(cx, cy, r * 2.8, priSoft, 0.22 + 0.12 * pulse);
      glow(cx, cy, r * 1.2, HILITE, 0.52 + 0.2 * pulse);
      // 衍射环（细、椭圆、缓慢旋转，镜头感而非太阳芒）
      for (var k = 0; k < 3; k++) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(t / (7000 + k * 2600) * (k % 2 ? -1 : 1));
        ctx.beginPath(); ctx.ellipse(0, 0, r * (2.6 + k * 1.4), r * (1.55 + k * 0.95), 0, 0, 6.283);
        ctx.strokeStyle = rgba(priSoft, 0.11 - k * 0.028); ctx.lineWidth = 0.8; ctx.stroke(); ctx.restore();
      }
      // 两缕有机微光（缓慢舒展的曲线，替代具象嫩芽）
      for (var w = 0; w < 2; w++) {
        var dir = w ? 1 : -1, ph = t / 1400 + w * 2.1;
        ctx.beginPath(); var px = cx, py = cy;
        for (var s = 1; s <= 20; s++) { var u = s / 20; var along = r * 0.9 + UNIT * 0.16 * u;
          var lateral = Math.sin(u * 2.6 + ph) * UNIT * 0.03 * u * dir;
          var x = cx + lateral, y = cy - along; ctx.moveTo(px, py); ctx.lineTo(x, y); px = x; py = y; }
        ctx.strokeStyle = rgba(secSoft, 0.12 + 0.06 * pulse); ctx.lineWidth = 1.0; ctx.stroke();
      }
    }

    // 段二公共：柔光外溢
    function drawFlash(t, strength) {
      var p = c01((t - T.A) / 950); if (p <= 0) return; var e = eoc(p), r = MAXR * (0.12 + 0.95 * e);
      glow(cx, cy, r, sec, (1 - e) * 0.30 * strength);
      glow(cx, cy, r * 0.42, HILITE, (1 - e) * 0.26 * strength);
    }
    function drawMotes(dt, t) {
      var appear = t < T.A ? 0 : c01((t - T.A) / 600), fade = t < T.C ? 1 : Math.max(0, 1 - (t - T.C) / 1500);
      for (var i = 0; i < motes.length; i++) { var m = motes[i]; m.a += m.sp * dt * 0.00012;
        var dv = UNIT * 0.06 + m.sp * dt * 0.0018 + (t - T.A) * m.sp * 0.00012;
        var x = cx + Math.cos(m.a) * dv, y = cy + Math.sin(m.a) * dv, col = m.gold ? sec : pri;
        var tw = 0.65 + 0.35 * Math.sin(t / 420 + m.tw), aC = (0.5 - m.z * 0.3) * fade * appear * tw;
        glow(x, y, m.size + m.blur, col, Math.max(0, aC * 0.4)); glow(x, y, m.size, mix(col, HILITE, 0.35), Math.max(0, aC)); }
    }
    function drawDust(dt) { for (var i = 0; i < dust.length; i++) { var d = dust[i]; d.x += d.vx * dt * 0.06; d.y += d.vy * dt * 0.06;
      if (d.y < -4) { d.y = H + 4; d.x = Math.random() * W; } if (d.x < -4) d.x = W + 4; if (d.x > W + 4) d.x = -4;
      ctx.fillStyle = rgba(HILITE, d.a); ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.283); ctx.fill(); } }
    function drawFilm() {
      var vg = ctx.createRadialGradient(cx, cy, UNIT * 0.18, cx, cy, MAXR * 1.03);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(0.7, 'rgba(0,0,0,0.10)'); vg.addColorStop(1, 'rgba(0,0,0,0.52)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      if (grainPat) { ctx.save(); ctx.globalAlpha = 0.85; ctx.translate(-((Math.random() * 150) | 0), -((Math.random() * 150) | 0)); ctx.fillStyle = grainPat; ctx.fillRect(0, 0, W + 150, H + 150); ctx.restore(); }
    }
    function drawStageText(t) { /* 文字由 DOM 负责 */ }

    // ---------- 各信仰专属场景 ----------
    var SC = {
      init: function () { setup[faith.scene] && setup[faith.scene](); },
      draw: function (dt, t) { var fn = draws[faith.scene]; if (fn) { try { fn(dt, t); } catch (e) {} } }
    };
    var setup = {}, draws = {};

    // 通用：有机曲线光须
    function filaments(K, spread, ampScale, wScale) {
      P2.fil = []; var N = K;
      for (var i = 0; i < N; i++) P2.fil.push({ a: (i / N) * 6.283 + rnd(-spread, spread), amp: rnd(0.7, 1.6) * ampScale, freq: rnd(0.85, 1.9), ph: Math.random() * 6.283, sway: rnd(0.00028, 0.0006), w: rnd(0.9, 1.8) * wScale, col: Math.random() < 0.5 ? priSoft : secSoft });
    }
    function drawFil(t, dur, widthA) {
      var p = c01((t - T.A) / dur); if (p <= 0) return; var reachE = eoc(p), fade = t < T.C ? 1 : Math.max(0, 1 - (t - T.C) / 1300);
      ctx.lineCap = 'round';
      for (var i = 0; i < (P2.fil || []).length; i++) { var f = P2.fil[i], reach = MAXR * 1.02 * reachE, ca = Math.cos(f.a), sa = Math.sin(f.a), px = cx, py = cy, steps = 34;
        for (var s = 1; s <= steps; s++) { var u = s / steps; if (u > reachE) break; var along = reach * u;
          var lateral = f.amp * Math.sin(u * f.freq * 2.7 + f.ph + t * f.sway) * along * 0.20;
          var x = cx + ca * along + (-sa) * lateral, y = cy + sa * along + (ca * lateral); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y);
          ctx.lineWidth = Math.max(0.3, f.w * (1 - u) * (UNIT / 720)); ctx.strokeStyle = rgba(f.col, widthA * fade * (1 - u * 0.8)); ctx.stroke(); px = x; py = y; }
        glow(cx, cy, UNIT * 0.1, mix(f.col, HILITE, 0.3), 0.1 * fade); }
    }

    // 1 生命：诞育 / 繁荣 —— 有机光须 + 光尘外涌
    setup.vine = function () { filaments(6, 0.7, 1.0, 1.0); P2.sp = []; var N = 120 + boost;
      for (var i = 0; i < N; i++) P2.sp.push({ a: Math.random() * 6.283, d: UNIT * 0.03, sp: rnd(1.6, 4.2) * (UNIT / 1100), sz: rnd(1.2, 3.0), gold: Math.random() < 0.5 }); };
    draws.vine = function (dt, t) { drawFlash(t, 0.9); drawFil(t, 1500, 0.15);
      var fade = t < T.C ? 1 : Math.max(0, 1 - (t - T.C) / 1400);
      for (var i = 0; i < P2.sp.length; i++) { var s = P2.sp[i]; if (t >= T.C) s.sp *= 0.95; s.d += s.sp * dt * 0.06;
        var x = cx + Math.cos(s.a) * s.d, y = cy + Math.sin(s.a) * s.d, col = s.gold ? sec : pri;
        if (s.d > 1) { var tx = cx + Math.cos(s.a) * (s.d - s.sz * 5), ty = cy + Math.sin(s.a) * (s.d - s.sz * 5);
          var g = ctx.createLinearGradient(tx, ty, x, y); g.addColorStop(0, rgba(col, 0)); g.addColorStop(1, rgba(col, 0.4 * fade));
          ctx.strokeStyle = g; ctx.lineWidth = s.sz * 0.6; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke(); }
        glow(x, y, s.sz * 4, col, 0.7 * fade); glow(x, y, s.sz, mix(col, HILITE, 0.4), 0.7 * fade); }
      drawConverge(t); };

    // 2 死亡：魂雾冲击波 + 自上下落的灵体碎片 + 边缘枯树剪影 + 魂引丝线
    setup.spirit = function () { P2.sh = []; var N = 90 + boost;
      for (var i = 0; i < N; i++) P2.sh.push({ x: rnd(0, W), y: rnd(-H * 0.4, H * 0.2), vy: rnd(0.4, 1.3) * (UNIT / 900), rot: rnd(0, 6.283), vr: rnd(-0.01, 0.01), len: rnd(4, 12), w: rnd(2, 5) });
      P2.threads = []; for (var j = 0; j < 14; j++) P2.threads.push({ a: Math.random() * 6.283, at: rnd(0.2, 0.9) }); };
    draws.spirit = function (dt, t) { 
      var p = c01((t - T.A) / 1200), fade = t < T.C ? 1 : Math.max(0, 1 - (t - T.C) / 1300);
      if (p > 0) { var e = eoc(p), r = MAXR * (0.15 + 0.9 * e); glow(cx, cy, r, desat(sec, 0.2), (1 - e) * 0.22); glow(cx, cy, r * 0.5, [200, 210, 220], (1 - e) * 0.16); }
      // 枯树剪影（边缘淡灰细线）
      ctx.save(); ctx.globalAlpha = Math.min(1, p * 1.2) * 0.5 * fade;
      var treeA = 0.06; [-1, 1].forEach(function (side) { var bx = cx + side * W * 0.42, by = H + 10;
        for (var b = 0; b < 6; b++) { var a0 = -Math.PI / 2 + rnd(-0.7, 0.7), L = UNIT * rnd(0.18, 0.4), ex = bx + Math.cos(a0) * L * side * 0.5, ey = by + Math.sin(a0) * L;
          ctx.strokeStyle = 'rgba(150,158,168,' + treeA + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + side * L * 0.2, by - L * 0.6, ex, ey); ctx.stroke(); } });
      ctx.restore();
      // 魂引丝线收拢
      if (p > 0) for (var i = 0; i < P2.threads.length; i++) { var th = P2.threads[i]; if (p < th.at) continue; var u = (p - th.at) / (1 - th.at + 0.001);
        var r0 = MAXR * 0.9, r1 = UNIT * 0.06, rr = r0 * (1 - u) + r1 * u, ca = Math.cos(th.a), sa = Math.sin(th.a);
        ctx.beginPath(); ctx.moveTo(cx + ca * r0, cy + sa * r0); ctx.quadraticCurveTo(cx + ca * rr * 1.2, cy + sa * rr * 1.2, cx + ca * rr, cy + sa * rr);
        ctx.strokeStyle = rgba(mix(priSoft, HILITE, 0.3), 0.14 * fade); ctx.lineWidth = 0.8; ctx.stroke(); }
      // 灵体碎片下落
      if (p > 0) for (var k = 0; k < P2.sh.length; k++) { var s = P2.sh[k]; s.y += s.vy * dt * 0.05; s.rot += s.vr * dt * 0.05; if (s.y > H + 20) { s.y = -20; s.x = rnd(0, W); }
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.fillStyle = rgba(desat(sec, 0.1), 0.18 * fade * p); ctx.beginPath(); ctx.ellipse(0, 0, s.w, s.len, 0, 0, 6.283); ctx.fill(); ctx.restore(); }
      drawConverge(t); };

    // 3 记忆：复古胶片碎片横向掠过 + 旧日残影
    setup.memory = function () { P2.flm = []; var N = 26 + Math.round(boost / 3);
      for (var i = 0; i < N; i++) P2.flm.push({ y: rnd(0, H), vx: rnd(0.8, 2.6) * (UNIT / 900), w: rnd(30, 120), h: rnd(16, 40), a: rnd(0.06, 0.18), dir: Math.random() < 0.5 ? 1 : -1 }); };
    draws.memory = function (dt, t) { var p = c01((t - T.A) / 1100), fade = t < T.C ? 1 : Math.max(0, 1 - (t - T.C) / 1300);
      if (p > 0) { var e = eoc(p); glow(cx, cy, MAXR * (0.2 + 0.7 * e), sec, (1 - e) * 0.24); glow(cx, cy, MAXR * 0.3 * (1 - e), HILITE, 0.16); }
      if (p > 0) for (var i = 0; i < P2.flm.length; i++) { var f = P2.flm[i]; f.y += Math.sin(t / 900 + i) * 0.1;
        ctx.save(); ctx.globalAlpha = f.a * fade * p; ctx.fillStyle = rgba(desat(sec, 0.15), 1); ctx.strokeStyle = rgba(desat(sec, 0.05), 0.5);
        var x = f.dir > 0 ? ((t * f.vx) % (W + f.w)) - f.w : W - ((t * f.vx) % (W + f.w));
        ctx.fillRect(x, f.y, f.w, f.h); ctx.strokeRect(x, f.y, f.w, f.h); ctx.restore(); }
      drawConverge(t); };

    // 4 时间：透明齿轮 + 环形刻度 + 循环光轨
    setup.time = function () { P2.gear = [{ r: UNIT * 0.30, sp: 0.00028, th: 20 }, { r: UNIT * 0.20, sp: -0.0004, th: 16 }, { r: UNIT * 0.42, sp: 0.00016, th: 28 }]; };
    draws.time = function (dt, t) { var p = c01((t - T.A) / 1100), fade = t < T.C ? 1 : Math.max(0, 1 - (t - T.C) / 1300);
      if (p > 0) { var e = eoc(p); glow(cx, cy, MAXR * (0.18 + 0.8 * e), sec, (1 - e) * 0.22); }
      for (var i = 0; i < P2.gear.length; i++) { var g = P2.gear[i]; if (p < 0.05) continue; var rot = t * g.sp * 1000;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); var rr = g.r * (0.5 + 0.5 * eoc(p)); ctx.strokeStyle = rgba(mix(priSoft, HILITE, 0.2), 0.22 * fade); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, rr, 0, 6.283); ctx.stroke();
        for (var k = 0; k < g.th; k++) { var a = k / g.th * 6.283; ctx.beginPath(); ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); ctx.lineTo(Math.cos(a) * (rr + UNIT * 0.012), Math.sin(a) * (rr + UNIT * 0.012)); ctx.stroke(); } ctx.restore(); }
      if (p > 0) for (var m = 0; m < 40 + boost / 2; m++) { var a2 = (m / 40) * 6.283 + t * 0.0006, rr2 = MAXR * (0.2 + 0.6 * (m / 40)) * eoc(p);
        var x = cx + Math.cos(a2) * rr2, y = cy + Math.sin(a2) * rr2; glow(x, y, UNIT * 0.012, mix(secSoft, HILITE, 0.3), 0.3 * fade); }
      drawConverge(t); };

    // 5 秩序：圣光同心环 + 律令符文矩阵（对称）
    setup.order = function () { P2.rings = []; for (var i = 0; i < 5; i++) P2.rings.push({ at: i * 0.14 }); };
    draws.order = function (dt, t) { var p = c01((t - T.A) / 1200), fade = t < T.C ? 1 : Math.max(0, 1 - (t - T.C) / 1300);
      if (p > 0) for (var i = 0; i < P2.rings.length; i++) { var r = P2.rings[i]; if (p < r.at) continue; var u = (p - r.at) / (1 - r.at + 0.001);
        var rr = MAXR * 0.9 * eoc(u); ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 6.283); ctx.strokeStyle = rgba(mix(sec, HILITE, 0.25), (1 - u) * 0.4 * fade); ctx.lineWidth = 1.4; ctx.stroke(); }
      // 符文网格（对称矩阵）
      if (p > 0) { var grid = 7, u2 = eoc(p);
        for (var gx = 0; gx < grid; gx++) for (var gy = 0; gy < grid; gy++) { var dx = (gx - (grid - 1) / 2), dy = (gy - (grid - 1) / 2);
          var dist = Math.sqrt(dx * dx + dy * dy); if (dist > 3.2) continue; var lit = c01((u2 - dist * 0.16) * 2);
          var x = cx + dx * UNIT * 0.11 * u2, y = cy + dy * UNIT * 0.11 * u2; var tw = 0.6 + 0.4 * Math.sin(t / 300 + (gx + gy));
          glow(x, y, UNIT * 0.016, mix(secSoft, HILITE, 0.5), 0.5 * lit * fade * tw); glow(x, y, UNIT * 0.005, HILITE, 0.7 * lit * fade); } }
      drawConverge(t); };

    // 6 真理：漂浮多面体晶体 + 折射微光（拆解重组）
    setup.crystal = function () { P2.poly = []; var N = 16 + boost / 4;
      for (var i = 0; i < N; i++) P2.poly.push({ x: cx, y: cy, vx: Math.cos(Math.random() * 6.283) * rnd(0.3, 1.4), vy: Math.sin(Math.random() * 6.283) * rnd(0.3, 1.4), r: rnd(8, 26), sides: 3 + Math.floor(Math.random() * 4), rot: Math.random() * 6.283, vr: rnd(-0.01, 0.01) }); };
    draws.crystal = function (dt, t) { var p = c01((t - T.A) / 1100), fade = t < T.C ? 1 : Math.max(0, 1 - (t - T.C) / 1300);
      if (p > 0) { var e = eoc(p); glow(cx, cy, MAXR * (0.15 + 0.85 * e), sec, (1 - e) * 0.26); glow(cx, cy, MAXR * 0.36 * (1 - e), HILITE, 0.16); }
      if (p > 0) for (var i = 0; i < P2.poly.length; i++) { var q = P2.poly[i]; q.x += q.vx * dt * 0.05 * (UNIT / 900); q.y += q.vy * dt * 0.05 * (UNIT / 900); q.rot += q.vr * dt * 0.05;
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); var rr = q.r * (UNIT / 900) * eoc(p); ctx.beginPath();
        for (var s = 0; s <= q.sides; s++) { var a = s / q.sides * 6.283; var x = Math.cos(a) * rr, y = Math.sin(a) * rr; s ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.strokeStyle = rgba(mix(priSoft, HILITE, 0.35), 0.3 * fade); ctx.lineWidth = 1; ctx.stroke();
        glow(q.x, q.y, rr * 2.2, mix(secSoft, HILITE, 0.4), 0.18 * fade); ctx.restore(); }
      drawConverge(t); };

    // 7 战争：战辉脉冲 + 光刃高速划过 + 金属火花（画面轻震）
    setup.war = function () { P2.blade = []; var N = 12 + boost / 4;
      for (var i = 0; i < N; i++) P2.blade.push({ a: Math.random() * 6.283, off: rnd(-0.3, 0.3) * UNIT, sp: rnd(4, 9), w: rnd(1, 2.4), at: rnd(0, 0.6) });
      P2.spark = []; for (var j = 0; j < 70; j++) P2.spark.push({ a: Math.random() * 6.283, sp: rnd(2, 7), life: rnd(0.4, 1.0), t0: rnd(0, 0.4) }); };
    draws.war = function (dt, t) { var p = c01((t - T.A) / 1000), fade = t < T.C ? 1 : Math.max(0, 1 - (t - T.C) / 1200);
      shakeX = (Math.random() - 0.5) * UNIT * 0.006 * Math.max(0, 1 - (t - T.A) / 1500); shakeY = (Math.random() - 0.5) * UNIT * 0.006 * Math.max(0, 1 - (t - T.A) / 1500);
      if (p > 0) { var e = eoc(p), r = MAXR * (0.15 + 0.95 * e); glow(cx, cy, r, desat(pri, 0.1), (1 - e) * 0.28); glow(cx, cy, r * 0.4, [255, 220, 170], (1 - e) * 0.2); }
      if (p > 0) for (var i = 0; i < P2.blade.length; i++) { var b = P2.blade[i]; if (p < b.at) continue; var u = (t - T.A) / 1000 - b.at; if (u < 0 || u > 0.5) continue;
        var ca = Math.cos(b.a), sa = Math.sin(b.a), len = MAXR * 1.1; var prog = u / 0.5; var head = -MAXR + len * 2 * prog;
        var x0 = cx + ca * head + (-sa) * b.off, y0 = cy + sa * head + (ca * b.off);
        var g = ctx.createLinearGradient(x0 - ca * len * 0.3, y0 - sa * len * 0.3, x0, y0);
        g.addColorStop(0, rgba(mix(priSoft, HILITE, 0.3), 0)); g.addColorStop(1, rgba(mix(priSoft, HILITE, 0.6), 0.7 * fade));
        ctx.strokeStyle = g; ctx.lineWidth = b.w * (UNIT / 900); ctx.beginPath(); ctx.moveTo(x0 - ca * len * 0.3, y0 - sa * len * 0.3); ctx.lineTo(x0, y0); ctx.stroke();
        glow(x0, y0, UNIT * 0.03, mix(secSoft, HILITE, 0.4), 0.5 * fade); }
      if (p > 0) for (var k = 0; k < P2.spark.length; k++) { var s = P2.spark[k]; if (p < s.t0) continue; var u2 = ((t - T.A) / 1000 - s.t0); if (u2 < 0) continue; var d = u2 * s.sp * (UNIT / 900) * 60;
        var x = cx + Math.cos(s.a) * d, y = cy + Math.sin(s.a) * d + u2 * u2 * UNIT * 0.3; var al = Math.max(0, 1 - u2 / s.life) * fade; glow(x, y, UNIT * 0.008, [255, 230, 180], 0.6 * al); }
      drawConverge(t); };

    // 8 欺诈：幻彩循环 + 镜像翻转 + 幻象粒子（色彩在紫/蓝/粉循环）
    setup.trickery = function () { P2.ghost = []; var N = 80 + boost / 2; for (var i = 0; i < N; i++) P2.ghost.push({ a: Math.random() * 6.283, d: rnd(0, 1), sp: rnd(1, 3), born: rnd(0, 1.4) }); };
    draws.trickery = function (dt, t) { var p = c01((t - T.A) / 1000), fade = t < T.C ? 1 : Math.max(0, 1 - (t - T.C) / 1300);
      var hue = (t / 1000) % 3; var cc = hue < 1 ? [140, 110, 230] : hue < 2 ? [120, 160, 240] : [220, 130, 200];
      if (p > 0) { var e = eoc(p); glow(cx, cy, MAXR * (0.15 + 0.9 * e), cc, (1 - e) * 0.26); glow(cx, cy, MAXR * 0.34 * (1 - e), HILITE, 0.16); }
      if (p > 0) for (var i = 0; i < P2.ghost.length; i++) { var g = P2.ghost[i]; var u = ((t - T.A) / 1000 - (i % 3) * 0.1); if (u < 0) continue; var d = (g.d + u * g.sp * 0.1) % 1.2 * MAXR * eoc(p);
        var x = cx + Math.cos(g.a) * d, y = cy + Math.sin(g.a) * d; var al = Math.max(0, Math.sin(u * 6 + i)) * 0.5 * fade; var flip = (i % 2) ? -1 : 1;
        glow(x, y, UNIT * 0.014, cc, al * 0.6); glow(cx + (x - cx) * flip, y, UNIT * 0.006, HILITE, al * 0.4); }
      drawConverge(t); };

    // 9 命运：金色星核 + 星轨命运丝线 + 星云
    setup.fate = function () { P2.star = []; var N = 150 + boost; for (var i = 0; i < N; i++) P2.star.push({ a: Math.random() * 6.283, d: rnd(0, 1), sp: rnd(1.5, 5), sz: rnd(0.8, 2.4), tw: Math.random() * 6.283 });
      P2.nodes = []; for (var j = 0; j < 12; j++) P2.nodes.push({ a: Math.random() * 6.283, r: rnd(0.2, 0.8) }); };
    draws.fate = function (dt, t) { var p = c01((t - T.A) / 1100), fade = t < T.C ? 1 : Math.max(0, 1 - (t - T.C) / 1400);
      if (p > 0) { var e = eoc(p); glow(cx, cy, MAXR * (0.15 + 1.0 * e), sec, (1 - e) * 0.3); glow(cx, cy, MAXR * 0.4 * (1 - e), [255, 235, 190], 0.2); }
      // 星云
      if (p > 0) for (var n = 0; n < 4; n++) { glow(cx + Math.cos(t / 3000 + n * 1.7) * UNIT * 0.2, cy + Math.sin(t / 2600 + n) * UNIT * 0.16, UNIT * 0.4, mix(sec, [40, 30, 70], 0.5), 0.05 * fade); }
      // 命运丝线
      if (p > 0) for (var i = 0; i < P2.nodes.length; i++) { var a1 = P2.nodes[i], b1 = P2.nodes[(i + 3) % P2.nodes.length];
        var x1 = cx + Math.cos(a1.a + t * 0.0002) * MAXR * a1.r * eoc(p), y1 = cy + Math.sin(a1.a + t * 0.0002) * MAXR * a1.r * eoc(p);
        var x2 = cx + Math.cos(b1.a + t * 0.0002) * MAXR * b1.r * eoc(p), y2 = cy + Math.sin(b1.a + t * 0.0002) * MAXR * b1.r * eoc(p);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2); ctx.strokeStyle = rgba(mix(secSoft, HILITE, 0.3), 0.12 * fade); ctx.lineWidth = 0.7; ctx.stroke(); }
      // 星屑
      if (p > 0) for (var k = 0; k < P2.star.length; k++) { var s = P2.star[k]; var d = (s.d + ((t - T.A) / 1000) * s.sp * 0.08) % 1.1 * MAXR * eoc(p);
        var x = cx + Math.cos(s.a) * d, y = cy + Math.sin(s.a) * d; var tw = 0.5 + 0.5 * Math.sin(t / 260 + s.tw); glow(x, y, s.sz * (UNIT / 720) * 3, mix(secSoft, [255, 240, 200], 0.5), 0.5 * fade * tw); glow(x, y, s.sz * (UNIT / 720), [255, 245, 220], 0.7 * fade * tw); }
      drawConverge(t); };

    // 10 混乱：裂纹炸裂 + 熔岩奔流 + 无序粒子（画面抖动）
    setup.chaos = function () { P2.crk = []; var N = 10;
      for (var i = 0; i < N; i++) { var seg = []; var a = Math.random() * 6.283, r = 0; var pts = [{ x: 0, y: 0 }];
        for (var s = 0; s < 14; s++) { a += rnd(-0.5, 0.5); r += UNIT * rnd(0.03, 0.08); pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r }); } P2.crk.push({ pts: pts, at: i / N * 0.5 }); }
      P2.ch = []; for (var j = 0; j < 140 + boost; j++) P2.ch.push({ a: Math.random() * 6.283, d: rnd(0, 1), sp: rnd(2, 8), sz: rnd(1, 3) }); };
    draws.chaos = function (dt, t) { var p = c01((t - T.A) / 1000), fade = t < T.C ? 1 : Math.max(0, 1 - (t - T.C) / 1200);
      shakeX = (Math.random() - 0.5) * UNIT * 0.008 * Math.max(0, 1 - (t - T.A) / 1400); shakeY = (Math.random() - 0.5) * UNIT * 0.008 * Math.max(0, 1 - (t - T.A) / 1400);
      if (p > 0) { var e = eoc(p); glow(cx, cy, MAXR * (0.1 + 0.6 * e), desat(pri, 0.05), (1 - e) * 0.26); }
      if (p > 0) for (var i = 0; i < P2.crk.length; i++) { var c = P2.crk[i]; if (p < c.at) continue; var u = (p - c.at) / (1 - c.at + 0.001); var vis = Math.floor(c.pts.length * c01(u * 1.4));
        ctx.beginPath(); ctx.moveTo(cx + c.pts[0].x, cy + c.pts[0].y);
        for (var s = 1; s < vis; s++) ctx.lineTo(cx + c.pts[s].x * eoc(p), cy + c.pts[s].y * eoc(p));
        ctx.strokeStyle = rgba([255, 150, 60], 0.5 * fade); ctx.lineWidth = 1.6; ctx.stroke();
        ctx.strokeStyle = rgba([255, 220, 160], 0.4 * fade); ctx.lineWidth = 0.6; ctx.stroke(); }
      if (p > 0) for (var k = 0; k < P2.ch.length; k++) { var q = P2.ch[k]; var d = (q.d + ((t - T.A) / 1000) * q.sp * 0.1) % 1.1 * MAXR * eoc(p);
        var x = cx + Math.cos(q.a) * d, y = cy + Math.sin(q.a) * d; glow(x, y, q.sz * (UNIT / 720) * 3, [255, 140, 60], 0.4 * fade); }
      drawConverge(t); };

    // 11 痴愚：球面扭曲 + 镜像重影 + 苍白眼瞳虚影 + 色散
    setup.illusion = function () { P2.eye = { at: 0 }; };
    draws.illusion = function (dt, t) { var p = c01((t - T.A) / 1100), fade = t < T.C ? 1 : Math.max(0, 1 - (t - T.C) / 1300);
      if (p > 0) { var e = eoc(p);
        // 色散重影环
        for (var c = 0; c < 3; c++) { var off = (c - 1) * UNIT * 0.01; glow(cx + off, cy, MAXR * 0.5 * e * (1 - (t - T.A) / 1000 * 0.2), c === 0 ? [190, 120, 220] : c === 2 ? [120, 220, 200] : sec, (1 - e) * 0.12); } }
      // 苍白眼瞳虚影（一闪而过）
      if (p > 0) { var u = (t - T.A) / 1000; if (u > 0.15 && u < 0.75) { var al = Math.sin((u - 0.15) / 0.6 * Math.PI) * 0.5 * fade;
        ctx.save(); ctx.translate(cx, cy); ctx.beginPath(); ctx.ellipse(0, 0, UNIT * 0.16, UNIT * 0.075, 0, 0, 6.283); ctx.strokeStyle = rgba([220, 214, 200], al); ctx.lineWidth = 1.2; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, UNIT * 0.03, 0, 6.283); ctx.fillStyle = rgba([200, 194, 180], al * 0.8); ctx.fill(); ctx.restore(); } }
      drawConverge(t); };

    // 12 污堕：欲海流体浊雾（多层） + 嫣红丝絮向心拉扯 + 涟漪色散
    setup.fluid = function () { P2.met = []; var N = 40 + boost / 2;
      for (var i = 0; i < N; i++) P2.met.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(40, 140) * (UNIT / 900), vx: rnd(-0.03, 0.03), vy: rnd(-0.03, 0.03), hue: Math.random() }); };
    draws.fluid = function (dt, t) { var p = c01((t - T.A) / 1200), fade = t < T.C ? 1 : Math.max(0, 1 - (t - T.C) / 1400);
      if (p > 0) for (var i = 0; i < P2.met.length; i++) { var m = P2.met[i]; m.x += m.vx * dt * 0.05; m.y += m.vy * dt * 0.05;
        if (m.x < -m.r) m.x = W + m.r; if (m.x > W + m.r) m.x = -m.r; if (m.y < -m.r) m.y = H + m.r; if (m.y > H + m.r) m.y = -m.r;
        var col = mix(pri, [120, 40, 80], m.hue); glow(m.x, m.y, m.r * (0.6 + 0.6 * p), col, 0.05 * fade * p); }
      // 嫣红丝絮向心拉扯
      if (p > 0) for (var k = 0; k < 70; k++) { var a = (k / 70) * 6.283 + t * 0.0004, d = MAXR * (0.9 - 0.6 * eoc(p));
        var x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; var g = ctx.createLinearGradient(cx, cy, x, y);
        g.addColorStop(0, rgba([210, 90, 130], 0.16 * fade * p)); g.addColorStop(1, rgba([210, 90, 130], 0)); ctx.strokeStyle = g; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(cx + Math.cos(a) * d * 0.6, cy + Math.sin(a) * d * 0.6); ctx.stroke(); }
      drawConverge(t); };

    // 13 腐朽：风化石雕/枯木残片下坠 + 老化胶片纹理 + 氧化褪色
    setup.debris = function () { P2.frag = []; var N = 60 + boost / 2;
      for (var i = 0; i < N; i++) P2.frag.push({ x: rnd(0, W), y: rnd(-H * 0.3, 0), vy: rnd(0.5, 1.6) * (UNIT / 900), rot: rnd(0, 6.283), vr: rnd(-0.02, 0.02), w: rnd(4, 14), h: rnd(3, 9), a: rnd(0.1, 0.32) }); };
    draws.debris = function (dt, t) { var p = c01((t - T.A) / 1200), fade = t < T.C ? 1 : Math.max(0, 1 - (t - T.C) / 1400);
      if (p > 0) { var e = eoc(p); glow(cx, cy, MAXR * (0.12 + 0.7 * e), mix(pri, [90, 70, 40], 0.4), (1 - e) * 0.2); }
      if (p > 0) for (var i = 0; i < P2.frag.length; i++) { var f = P2.frag[i]; f.y += f.vy * dt * 0.05; f.rot += f.vr * dt * 0.05; if (f.y > H + 20) { f.y = -20; f.x = rnd(0, W); }
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.fillStyle = rgba(mix(pri, [80, 60, 38], 0.5), f.a * fade * p); ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h); ctx.restore(); }
      drawConverge(t); };

    // 14 湮灭：微型黑洞 + 一切向心坍缩 + 虚空裂隙 + 色彩抽离
    setup.void = function () { P2.pull = []; var N = 180 + boost; for (var i = 0; i < N; i++) P2.pull.push({ a: Math.random() * 6.283, d: rnd(0.2, 1.2), sp: rnd(1, 4), sz: rnd(0.8, 2.4) });
      P2.crk = []; for (var j = 0; j < 7; j++) { var a = Math.random() * 6.283, pts = []; for (var s = 0; s < 8; s++) { a += rnd(-0.4, 0.4); var r = UNIT * (0.05 + s * 0.04); pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r }); } P2.crk.push(pts); } };
    draws.void = function (dt, t) { var p = c01((t - T.A) / 1300), fade = t < T.C ? 1 : Math.max(0, 1 - (t - T.C) / 1400);
      // 黑洞
      if (p > 0) { var e = eoc(p); var core = UNIT * (0.02 + 0.04 * e); ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.beginPath(); ctx.arc(cx, cy, core, 0, 6.283); ctx.fill();
        glow(cx, cy, core * 4, [140, 150, 165], 0.3 * (1 - e * 0.4)); }
      // 裂隙灰光
      if (p > 0) for (var i = 0; i < P2.crk.length; i++) { var pts = P2.crk[i]; ctx.beginPath(); ctx.moveTo(cx + pts[0].x * e, cy + pts[0].y * e);
        for (var s = 1; s < pts.length; s++) ctx.lineTo(cx + pts[s].x * e, cy + pts[s].y * e);
        var fl = 0.5 + 0.5 * Math.sin(t / 120 + i); ctx.strokeStyle = rgba([170, 180, 195], 0.25 * fl * (1 - e * 0.5)); ctx.lineWidth = 0.8; ctx.stroke(); }
      // 向心坍缩粒子
      if (p > 0) for (var k = 0; k < P2.pull.length; k++) { var q = P2.pull[k]; var d = (q.d - ((t - T.A) / 1000) * q.sp * 0.12); if (d < 0.02) continue; var dd = d * MAXR;
        var x = cx + Math.cos(q.a) * dd, y = cy + Math.sin(q.a) * dd; var al = c01(d) * fade * p; glow(x, y, q.sz * (UNIT / 720) * 3, [150, 160, 175], 0.35 * al); }
      drawConverge(t); };

    // 15 沉默：静默灰雾吞噬（无强光爆发）
    setup.silence = function () { P2.fog = []; var N = 30; for (var i = 0; i < N; i++) P2.fog.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(120, 320) * (UNIT / 900), vx: rnd(-0.02, 0.02), vy: rnd(-0.015, 0.015) }); };
    draws.silence = function (dt, t) { var p = c01((t - T.A) / 1600), fade = t < T.C ? 1 : Math.max(0, 1 - (t - T.C) / 1600);
      if (p > 0) for (var i = 0; i < P2.fog.length; i++) { var f = P2.fog[i]; f.x += f.vx * dt * 0.04; f.y += f.vy * dt * 0.04;
        if (f.x < -f.r) f.x = W + f.r; if (f.x > W + f.r) f.x = -f.r; if (f.y < -f.r) f.y = H + f.r; if (f.y > H + f.r) f.y = -f.r;
        glow(f.x, f.y, f.r * (0.5 + 0.7 * p), [120, 126, 134], 0.045 * fade * p); }
      // 淡灰絮
      if (p > 0) for (var k = 0; k < 40; k++) { var a = (k / 40) * 6.283, d = MAXR * 0.7 * eoc(p); var x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
        glow(x, y, UNIT * 0.02, [150, 156, 164], 0.08 * fade * p); }
      drawConverge(t, true); };

    function drawConverge(t, muteGlow) { if (t < T.C) return; var p = c01((t - T.C) / 1300);
      var r = MAXR * 0.72 * (1 - p) + UNIT * 0.04; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283);
      ctx.strokeStyle = rgba(secSoft, (1 - p) * (muteGlow ? 0.14 : 0.26)); ctx.lineWidth = 1.2; ctx.stroke();
      if (!muteGlow) { glow(cx, cy, UNIT * 0.4, sec, 0.14 * (1 - p)); glow(cx, cy, UNIT * 0.2, HILITE, 0.1 * (1 - p)); } }

    // 帷幕阶段（未点击）极淡浮尘
    var raf = 0, lastT = 0, startT = 0;
    function frame(ts) {
      if (!lastT) lastT = ts; var dt = Math.min(64, ts - lastT); lastT = ts;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
      if (started) { var t = ts - startT;
        ctx.save(); ctx.translate(shakeX, shakeY);
        if (t < T.A) { ctx.globalCompositeOperation = 'lighter'; drawCore(t); ctx.globalCompositeOperation = 'source-over'; }
        else { ctx.globalCompositeOperation = 'lighter'; SC.draw(dt, t); drawMotes(dt, t); ctx.globalCompositeOperation = 'source-over'; }
        drawDust(dt); drawFilm(); ctx.restore();
      } else { drawDust(dt); drawFilm(); }
      raf = window.requestAnimationFrame(frame);
    }
    SC.init(); resize(); window.addEventListener('resize', resize); raf = window.requestAnimationFrame(frame);

    // ---- 生命周期 ----
    var done = false, timers = [];
    function clr() { for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]); timers.length = 0; }
    function finish() { if (done) return; done = true; clr(); if (riteAudio) { try { riteAudio.close(); } catch (e) {} }
      overlay.classList.add('fr-out');
      timers.push(setTimeout(function () { window.cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('keydown', onKey, true); overlay.removeEventListener('click', onClick);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay); try { localStorage.setItem(LS_SHOWN, today); } catch (e) {} }, 620)); }
    function start() { if (started) { finish(); return; } started = true; startT = performance.now();
      if (soundOn) { riteAudio = createRiteAudio(faith.sfx); if (riteAudio) riteAudio.start(); }
      gate.classList.add('off');
      timers.push(setTimeout(function () { dayEl.classList.add('on'); }, 240));
      timers.push(setTimeout(function () { welcome.classList.add('on'); }, T.B));
      timers.push(setTimeout(function () { prayer.classList.add('on'); }, T.B + 360));
      timers.push(setTimeout(function () { overlay.classList.add('fr-out'); }, T.D - 600));
      timers.push(setTimeout(function () { finish(); }, T.D)); }
    function onClick(e) { if (e.target === soundBtn || soundBtn.contains(e.target)) return; start(); }
    function onKey() { start(); }
    overlay.addEventListener('click', onClick); window.addEventListener('keydown', onKey, true);

    window[NS] = { destroy: function () { finish(); }, finishNow: finish, start: start, audioState: function () { return riteAudio ? riteAudio.state() : 'none'; }, god: faith.god, day: idx + 1, scene: faith.scene };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

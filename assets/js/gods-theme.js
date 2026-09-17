/* ==========================================================================
   诸神愚戏 · 神性主题增强脚本  (gods-theme.js)
   --------------------------------------------------------------------------
   仅做装饰性 DOM 注入，不改变任何业务逻辑：
     1. 注入全站金砂星尘氛围层 .gods-atmosphere
     2. 为主要卡片/面板注入四角纹饰 .gods-corner
   全部为 pointer-events:none / aria-hidden，安全无副作用。
   卸载：window.__godsTheme.destroy()
   ========================================================================== */
(function () {
    if (window.__godsTheme && window.__godsTheme.loaded) return;

    var CARD_SELECTOR = [
        '.dungeon-card',
        '.detail-panel',
        '.oracle-panel',
        '.stele-card',
        '.match-card',
        '.trial-dossier-card',
        '.profile-panel',
        '.admin-panel',
        '.authored-card',
        '.leaderboard-panel'
    ].join(',');
    var CORNER_POSITIONS = ['tl', 'tr', 'bl', 'br'];
    var reduceMotion = window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;

    var observer = null;
    var pending = null;

    function injectAtmosphere() {
        if (document.querySelector('.gods-atmosphere')) return;
        var layer = document.createElement('div');
        layer.className = 'gods-atmosphere';
        layer.setAttribute('aria-hidden', 'true');
        document.body.appendChild(layer);
    }

    function makeCorner(position) {
        var span = document.createElement('span');
        span.className = 'gods-corner ' + position;
        span.setAttribute('aria-hidden', 'true');
        return span;
    }

    /* 抽卡品阶：从 rank-* 类提取 S/A/B/C/EX，挂 gt-rank-* 并注入徽章 */
    var RANK_ORDER = { C: 0, B: 1, A: 2, S: 3, EX: 4 };

    function detectRank(el) {
        var cls = el.classList;
        for (var r in RANK_ORDER) {
            if (cls.contains('rank-' + r)) return r;
        }
        if (cls.contains('is-exclusive') || cls.contains('exclusive')) return 'EX';
        return null;
    }

    function decorateTalentCards(root) {
        var cards;
        try {
            cards = (root || document).querySelectorAll('.talent-card');
        } catch (err) {
            return;
        }
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            var rank = detectRank(card);
            if (!rank) continue;
            var cls = 'gt-rank-' + rank;
            if (!card.classList.contains(cls)) {
                card.classList.remove('gt-rank-C', 'gt-rank-B', 'gt-rank-A', 'gt-rank-S', 'gt-rank-EX');
                card.classList.add(cls);
            }
            if (!card.querySelector(':scope > .gt-rank-badge')) {
                var badge = document.createElement('span');
                badge.className = 'gt-rank-badge';
                badge.textContent = rank;
                badge.setAttribute('aria-hidden', 'true');
                card.appendChild(badge);
            }
        }
    }

    function decorate(root) {
        var nodes;
        try {
            nodes = (root || document).querySelectorAll(CARD_SELECTOR);
        } catch (err) {
            nodes = [];
        }
        decorateTalentCards(root);
        for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            if (el.classList.contains('gods-cornered')) continue;
            if (el.querySelector(':scope > .gods-corner')) continue;
            el.classList.add('gods-cornered');
            for (var j = 0; j < CORNER_POSITIONS.length; j++) {
                el.appendChild(makeCorner(CORNER_POSITIONS[j]));
            }
        }
    }

    /* 抽取瞬间：结果容器短暂挂 .gt-draw-burst 触发神谕光爆 */
    var burstObserver = null;
    var burstTimers = new WeakMap();

    var BURST_CLASSES = ['gt-burst-C', 'gt-burst-B', 'gt-burst-A', 'gt-burst-S', 'gt-burst-EX'];

    function clearBurst(el) {
        if (!el || !el.classList) return;
        el.classList.remove('gt-draw-burst');
        for (var i = 0; i < BURST_CLASSES.length; i++) el.classList.remove(BURST_CLASSES[i]);
    }

    function triggerBurst(el) {
        if (!el || el.nodeType !== 1) return;
        // 只对"结果"网格触发，避免仓库/已携带列表误触发
        if (!el.classList || !el.classList.contains('talent-result-grid')) return;
        var cards = el.querySelectorAll(':scope > .talent-card');
        if (cards.length === 0) return;
        // 找出本批最高品阶
        var maxRank = 0, maxName = 'C';
        for (var i = 0; i < cards.length; i++) {
            var r = detectRank(cards[i]);
            var v = (r && RANK_ORDER[r] != null) ? RANK_ORDER[r] : 0;
            if (v > maxRank) { maxRank = v; maxName = r; }
        }
        clearBurst(el);
        // 强制重排以重启动画
        void el.offsetWidth;
        el.classList.add('gt-draw-burst');
        el.classList.add('gt-burst-' + maxName);
        var prev = burstTimers.get(el);
        if (prev) window.clearTimeout(prev);
        burstTimers.set(el, window.setTimeout(function () {
            clearBurst(el);
        }, 1000));
    }

    function startBurstObserver() {
        if (reduceMotion || !window.MutationObserver || burstObserver) return;
        try {
            burstObserver = new MutationObserver(function (mutations) {
                for (var i = 0; i < mutations.length; i++) {
                    var m = mutations[i];
                    if (m.type === 'childList' && m.target && m.target.classList &&
                        m.target.classList.contains('talent-result-grid')) {
                        triggerBurst(m.target);
                    }
                }
            });
            burstObserver.observe(document.body, { childList: true, subtree: true });
        } catch (err) {
            burstObserver = null;
        }
    }

    function scheduleDecorate() {
        if (pending) return;
        pending = window.setTimeout(function () {
            pending = null;
            decorate(document);
        }, 320);
    }

    function startObserver() {
        if (reduceMotion || !window.MutationObserver || observer) return;
        try {
            observer = new MutationObserver(scheduleDecorate);
            observer.observe(document.body, { childList: true, subtree: true });
        } catch (err) {
            observer = null;
        }
    }

    function init() {
        if (!document.body) return;
        injectAtmosphere();
        decorate(document);
        startObserver();
        startBurstObserver();
    }

    window.__godsTheme = {
        loaded: true,
        refresh: function () { decorate(document); },
        destroy: function () {
            if (observer) { observer.disconnect(); observer = null; }
            if (burstObserver) { burstObserver.disconnect(); burstObserver = null; }
            var atmosphere = document.querySelector('.gods-atmosphere');
            if (atmosphere && atmosphere.parentNode) atmosphere.parentNode.removeChild(atmosphere);
            var corners = document.querySelectorAll('.gods-corner');
            for (var i = 0; i < corners.length; i++) {
                if (corners[i].parentNode) corners[i].parentNode.removeChild(corners[i]);
            }
            var marked = document.querySelectorAll('.gods-cornered');
            for (var k = 0; k < marked.length; k++) marked[k].classList.remove('gods-cornered');
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();

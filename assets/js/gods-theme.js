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

    function decorate(root) {
        var nodes;
        try {
            nodes = (root || document).querySelectorAll(CARD_SELECTOR);
        } catch (err) {
            return;
        }
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

    function triggerBurst(el) {
        if (!el || el.nodeType !== 1) return;
        // 只对"结果"网格触发，避免仓库/已携带列表误触发
        if (!el.classList || !el.classList.contains('talent-result-grid')) return;
        if (el.querySelectorAll(':scope > .talent-card').length === 0) return;
        el.classList.remove('gt-draw-burst');
        // 强制重排以重启动画
        void el.offsetWidth;
        el.classList.add('gt-draw-burst');
        var prev = burstTimers.get(el);
        if (prev) window.clearTimeout(prev);
        burstTimers.set(el, window.setTimeout(function () {
            el.classList.remove('gt-draw-burst');
        }, 950));
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

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
    }

    window.__godsTheme = {
        loaded: true,
        refresh: function () { decorate(document); },
        destroy: function () {
            if (observer) { observer.disconnect(); observer = null; }
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

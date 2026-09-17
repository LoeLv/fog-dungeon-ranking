/* ==========================================================================
   诸神愚戏 · 星辉圣所  (gods-theme.js  v3 "Celestial Sanctum")
   --------------------------------------------------------------------------
   纯装饰性 DOM 注入，绝不触碰任何业务逻辑：
     1. 注入星辉氛围层     .gods-atmosphere
     2. 注入指针聚光层     .gt-spotlight（跟随鼠标，screen 混合）
     3. 为卡片/面板注入金饰画框 .gods-cornered > .gods-corner ×4
     4. 为天赋卡识别品阶并挂 gt-rank-* 与品阶徽章 .gt-rank-badge
     5. 抽卡结果网格分级光爆 .gt-draw-burst / .gt-burst-*
   安全：全部 pointer-events:none / aria-hidden，无副作用。
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
        '.leaderboard-panel',
        '.forum-feed',
        '.controls'
    ].join(',');
    var CORNER_POSITIONS = ['tl', 'tr', 'bl', 'br'];
    var RANK_ORDER = { C: 0, B: 1, A: 2, S: 3, EX: 4 };
    var BURST_CLASSES = ['gt-burst-C', 'gt-burst-B', 'gt-burst-A', 'gt-burst-S', 'gt-burst-EX'];

    var reduceMotion = window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;

    var observer = null;
    var burstObserver = null;
    var burstTimers = new WeakMap();
    var pending = null;
    var pointerBound = false;

    /* ---------- 1. 氛围层 ---------- */
    function injectAtmosphere() {
        if (document.querySelector('.gods-atmosphere')) return;
        var layer = document.createElement('div');
        layer.className = 'gods-atmosphere';
        layer.setAttribute('aria-hidden', 'true');
        document.body.appendChild(layer);
    }

    /* ---------- 2. 指针聚光 ---------- */
    function injectSpotlight() {
        if (reduceMotion) return;
        if (document.querySelector('.gt-spotlight')) return;
        var s = document.createElement('div');
        s.className = 'gt-spotlight';
        s.setAttribute('aria-hidden', 'true');
        document.body.appendChild(s);
    }

    function bindPointer() {
        if (reduceMotion || pointerBound) return;
        pointerBound = true;
        var root = document.documentElement;
        var raf = 0, mx = 0, my = 0;
        function apply() {
            raf = 0;
            root.style.setProperty('--gt-mx', mx + 'px');
            root.style.setProperty('--gt-my', my + 'px');
        }
        window.addEventListener('pointermove', function (e) {
            mx = e.clientX; my = e.clientY;
            if (!raf) raf = window.requestAnimationFrame(apply);
        }, { passive: true });
    }

    /* ---------- 3. 金饰画框 ---------- */
    function makeCorner(position) {
        var span = document.createElement('span');
        span.className = 'gods-corner ' + position;
        span.setAttribute('aria-hidden', 'true');
        return span;
    }

    /* ---------- 4. 品阶识别 ---------- */
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
        } catch (err) { return; }
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
        } catch (err) { nodes = []; }
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

    /* ---------- 5. 抽卡分级光爆 ---------- */
    function clearBurst(el) {
        if (!el || !el.classList) return;
        el.classList.remove('gt-draw-burst');
        for (var i = 0; i < BURST_CLASSES.length; i++) el.classList.remove(BURST_CLASSES[i]);
    }

    function triggerBurst(el) {
        if (!el || el.nodeType !== 1) return;
        if (!el.classList || !el.classList.contains('talent-result-grid')) return;
        var cards = el.querySelectorAll(':scope > .talent-card');
        if (cards.length === 0) return;
        var maxRank = 0, maxName = 'C';
        for (var i = 0; i < cards.length; i++) {
            var r = detectRank(cards[i]);
            var v = (r && RANK_ORDER[r] != null) ? RANK_ORDER[r] : 0;
            if (v > maxRank) { maxRank = v; maxName = r; }
        }
        clearBurst(el);
        void el.offsetWidth; /* 重排以重启动画 */
        el.classList.add('gt-draw-burst');
        el.classList.add('gt-burst-' + maxName);
        var prev = burstTimers.get(el);
        if (prev) window.clearTimeout(prev);
        burstTimers.set(el, window.setTimeout(function () { clearBurst(el); }, 1100));
    }

    /* ---------- 观察器 ---------- */
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
        } catch (err) { observer = null; }
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
        } catch (err) { burstObserver = null; }
    }

    function init() {
        if (!document.body) return;
        injectAtmosphere();
        injectSpotlight();
        bindPointer();
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
            var spot = document.querySelector('.gt-spotlight');
            if (spot && spot.parentNode) spot.parentNode.removeChild(spot);
            var corners = document.querySelectorAll('.gods-corner');
            for (var i = 0; i < corners.length; i++) {
                if (corners[i].parentNode) corners[i].parentNode.removeChild(corners[i]);
            }
            var marked = document.querySelectorAll('.gods-cornered');
            for (var k = 0; k < marked.length; k++) marked[k].classList.remove('gods-cornered');
            pointerBound = false;
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();


/* ==========================================================================
   v3.1 追加：为携带槽 / 仓库位注入品阶标记（gt-slot-X + 角标）
   独立于主脚本，自建观察器，随列表重渲染自动补挂。
   ========================================================================== */
(function () {
    if (window.__godsSlotDecor) return;
    window.__godsSlotDecor = true;

    var RANK_CLASSES = ['gt-slot-C', 'gt-slot-B', 'gt-slot-A', 'gt-slot-S', 'gt-slot-EX'];
    var pending = null;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function slotRank(text) {
        var m = text.match(/[（(]\s*(EX|S|A|B|C)\s*[·•]/) || text.match(/\b(EX|S|A|B|C)\s*级/);
        return m ? m[1] : null;
    }

    function decorateSlots(root) {
        var cards;
        try { cards = (root || document).querySelectorAll('.talent-slot-card'); }
        catch (e) { return; }
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            var empty = card.classList.contains('empty') || card.classList.contains('pending');
            var rank = empty ? null : slotRank(card.textContent || '');
            var tag = card.querySelector(':scope > .gt-slot-tag');
            if (!rank) {
                for (var r = 0; r < RANK_CLASSES.length; r++) card.classList.remove(RANK_CLASSES[r]);
                if (tag) tag.parentNode.removeChild(tag);
                continue;
            }
            var cls = 'gt-slot-' + rank;
            if (!card.classList.contains(cls)) {
                for (var k = 0; k < RANK_CLASSES.length; k++) card.classList.remove(RANK_CLASSES[k]);
                card.classList.add(cls);
            }
            if (!tag) {
                tag = document.createElement('span');
                tag.className = 'gt-slot-tag';
                tag.setAttribute('aria-hidden', 'true');
                tag.textContent = rank;
                card.appendChild(tag);
            } else if (tag.textContent !== rank) {
                tag.textContent = rank;
            }
        }
    }

    function schedule() {
        if (pending) return;
        pending = window.setTimeout(function () { pending = null; decorateSlots(document); }, 320);
    }

    function init() {
        if (!document.body) return;
        decorateSlots(document);
        if (!reduce && window.MutationObserver) {
            try { new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true }); }
            catch (e) {}
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.__godsSlotDecor = { refresh: function () { decorateSlots(document); } };
})();

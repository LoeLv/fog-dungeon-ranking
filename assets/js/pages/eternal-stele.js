// Eternal stele page for memorial entries.

const ETERNAL_STELE_RECORDS = [
    {
        motif: 'tomb',
        title: '\u81ea\u7531\u4e4b\u795e--\u66e6',
        subtitle: '\u661f\u9014 \u00b7 \u521d\u94ed\u591c\u6b4c',
        summary: '\u4f5c\u4e3a\u4fe1\u4ef0\u4e4b\u5730\u7684\u521d\u521b\u8005\uff0c\u66e6\u5386\u7ecf\u9ed1\u6697\u65f6\u4ee3\u7684\u538b\u8feb\u4e0e\u8840\u706b\uff0c\u72ec\u7acb\u6210\u957f\uff0c\u6700\u7ec8\u6210\u4e3a\u81ea\u7531\u4e4b\u795e\uff0c\u53d7\u4e07\u6c11\u656c\u4ef0\u3002',
        note: '\u6c38\u94ed\u6b64\u540d',
    },
    {
        motif: 'pages',
        title: '\u5fe7\u853c\u4e4b\u795e--\u5357\u6cb3\u4e66\u6dee',
        subtitle: '\u524d\u8eab \u00b7 \u8bb0\u5fc6\u4e4b\u795e',
        summary: '\u7942\u5386\u7ecf\u9ed1\u6697\u65f6\u4ee3\u7684\u5927\u706d\u7edd\uff0c\u4eb2\u624b\u5efa\u7acb\u66d9\u5149\uff0c\u66fe\u638c\u8bb0\u5fc6\u4e4b\u4f4d\uff0c\u4ee5\u4e66\u9875\u627f\u63a5\u65e7\u65e5\u7684\u56de\u58f0\u3002\u98ce\u7ffb\u8fc7\u7684\u540d\u5b57\u4e0d\u4f1a\u6563\u5c3d\uff0c\u5b83\u4eec\u5728\u51a0\u4e0b\u6536\u62e2\uff0c\u5316\u4f5c\u6e29\u548c\u800c\u957f\u4e45\u7684\u5fe7\u853c\u3002',
        note: '\u4e66\u9875\u4e0d\u706d',
    },
    {
        motif: 'luck',
        title: '\u6b22\u6109\u4e4b\u795e--incredible luck',
        subtitle: '\u524d\u8eab \u00b7 \u6c61\u5815\u4e4b\u795e',
        summary: '\u9f99\u9f99\u662f\u4e16\u4e0a\u6700\u5f3a\u5927\u7684\u6c61\u5815\u9f99\u79cd\uff0c\u7942\u82f1\u52c7\uff0c\u667a\u6167\uff0c\u4e50\u5584\u597d\u65bd\u3002\u4e24\u4ee3\u53f2\u8bd7\u90fd\u66fe\u7559\u4e0b\u7942\u7684\u4f20\u5947\u3002\u7942\u5386\u7ecf\u4e86\u4e24\u4e2a\u65f6\u4ee3\u7684\u8bde\u751f\u4e0e\u8fdb\u7a0b\uff0c\u4e5f\u662f\u5e74\u5c81\u6700\u957f\u7684\u795e\u8bdd\u4e4b\u9f99\u3002\u4f5c\u4e3a\u6c61\u5815\u4e4b\u795e\uff0c\u7942\u7ed9\u4eba\u4eec\u7684\u5f62\u8c61\u603b\u662f\u4ece\u4e0d\u62d2\u7edd\uff0c\u4ece\u5e0c\u671b\u4e4b\u5dde\u5230\u4fe1\u4ef0\u4e4b\u5730\uff0c\u6240\u6709\u4fe1\u5f92\u90fd\u559c\u6b22\u8fd9\u6761\u4f1f\u5927\u4e4b\u9f99\uff0c\u7942\u603b\u662f\u80fd\u5e26\u7ed9\u6240\u6709\u4eba\u6b22\u4e50\u3002',
        motto: '\u62e5\u62b1\u81ea\u6211\uff0c\u8ffd\u5df1\u6c42\u65b0--\u6c38\u5ff5\u52ff\u5fd8\u3002',
        note: '\u6b22\u610f\u4e0d\u62d2',
    }
];

let eternalSteleScrollY = 0;

function renderEternalSteleMotif(record) {
    if (record.motif === 'pages') {
        return `
            <span class="stele-page-sheet page-left"></span>
            <span class="stele-page-sheet page-center"></span>
            <span class="stele-page-sheet page-right"></span>
            <span class="stele-page-thread"></span>
            <span class="stele-page-glow"></span>
        `;
    }
    if (record.motif === 'luck') {
        return `
            <span class="stele-luck-wheel"></span>
            <span class="stele-luck-wheel-track"></span>
            <span class="stele-luck-wheel-rune rune-top"></span>
            <span class="stele-luck-wheel-rune rune-right"></span>
            <span class="stele-luck-wheel-rune rune-bottom"></span>
            <span class="stele-luck-wheel-rune rune-left"></span>
            <span class="stele-luck-dragon-arc arc-left"></span>
            <span class="stele-luck-dragon-arc arc-right"></span>
            <span class="stele-luck-scale scale-1"></span>
            <span class="stele-luck-scale scale-2"></span>
            <span class="stele-luck-scale scale-3"></span>
            <span class="stele-luck-gold-trail"></span>
        `;
    }
    return `
        <span class="stele-motif-stone"></span>
        <span class="stele-motif-crack"></span>
        <span class="stele-motif-light"></span>
        <span class="stele-motif-base"></span>
    `;
}

function renderEternalSteleRecord(record) {
    const motifClass =
        record.motif === 'pages' ? 'stele-monolith-pages' :
        record.motif === 'luck' ? 'stele-monolith-luck' :
        'stele-monolith-tomb';
    return `
        <section class="stele-sanctum stele-sanctum-${escapeHtml(record.motif)}" aria-label="${escapeHtml(record.title)}">
            <div class="stele-sanctum-pillars" aria-hidden="true">
                <span class="stele-pillar stele-pillar-left"></span>
                <span class="stele-pillar stele-pillar-right"></span>
                <span class="stele-sanctum-arch"></span>
            </div>
            <div class="stele-monolith ${motifClass}">
                <div class="stele-monolith-crown stele-crown-${escapeHtml(record.motif)}" aria-hidden="true">
                    ${record.motif === 'pages' ? `
                        <span class="stele-crown-halo"></span>
                        <span class="stele-crown-arc"></span>
                        <span class="stele-crown-panel panel-left"></span>
                        <span class="stele-crown-panel panel-mid-left"></span>
                        <span class="stele-crown-panel panel-mid"></span>
                        <span class="stele-crown-panel panel-mid-right"></span>
                        <span class="stele-crown-panel panel-right"></span>
                        <span class="stele-crown-gem gem-left"></span>
                        <span class="stele-crown-gem gem-center"></span>
                        <span class="stele-crown-gem gem-right"></span>
                        <span class="stele-crown-break"></span>
                    ` : record.motif === 'luck' ? `
                        <span class="stele-luck-crown-ring"></span>
                        <span class="stele-luck-crown-ring-ring"></span>
                        <span class="stele-luck-crown-horn horn-left"></span>
                        <span class="stele-luck-crown-horn horn-right"></span>
                        <span class="stele-luck-crown-bead bead-left"></span>
                        <span class="stele-luck-crown-bead bead-right"></span>
                        <span class="stele-luck-crown-bead bead-center"></span>
                    ` : `
                        <span class="stele-crown-halo"></span>
                        <span class="stele-crown-arc"></span>
                        <span class="stele-crown-panel panel-left"></span>
                        <span class="stele-crown-panel panel-mid-left"></span>
                        <span class="stele-crown-panel panel-mid"></span>
                        <span class="stele-crown-panel panel-mid-right"></span>
                        <span class="stele-crown-panel panel-right"></span>
                        <span class="stele-crown-gem gem-left"></span>
                        <span class="stele-crown-gem gem-center"></span>
                        <span class="stele-crown-gem gem-right"></span>
                        <span class="stele-crown-break"></span>
                    `}
                </div>
                <div class="stele-monolith-motif stele-motif-${escapeHtml(record.motif)}" aria-hidden="true">
                    ${renderEternalSteleMotif(record)}
                </div>
                <div class="stele-monolith-head">
                    <div class="stele-monolith-heading">
                        <div class="stele-monolith-title">${escapeHtml(record.title)}</div>
                        <div class="stele-monolith-subtitle">${escapeHtml(record.subtitle)}</div>
                    </div>
                </div>
                <div class="stele-monolith-body">
                    <p>${escapeHtml(record.summary)}${record.motto ? `<span class="stele-luck-motto">${escapeHtml(record.motto)}</span>` : ''}</p>
                </div>
                <div class="stele-monolith-foot">
                    <span>${escapeHtml(record.note)}</span>
                </div>
                <div class="stele-monolith-base" aria-hidden="true"></div>
            </div>
        </section>
    `;
}

function renderEternalStelePage() {
    const container = document.getElementById('eternalSteleContent');
    if (!container) return;
    container.innerHTML = `
        <section class="stele-hero stele-hero-silent">
            <div class="stele-hero-copy">
                <div class="stele-kicker">\u591c\u6b4c\u94ed\u523b</div>
                <h1 class="stele-title">\u6c38\u6052\u795e\u7891</h1>
            </div>
        </section>
        ${ETERNAL_STELE_RECORDS.map(renderEternalSteleRecord).join('')}
    `;
}

async function openEternalStelePage() {
    eternalSteleScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const page = document.getElementById('eternalStelePage');
    if (!page) return;
    const ids = ['detailOverlay', 'profilePage', 'leaderboardPage', 'scorePage', 'matchPage', 'battleRoomPage', 'adminPage', 'permissionPage'];
    for (const id of ids) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    }
    document.body.classList.add('eternal-stele-view-open');
    page.style.display = 'block';
    window.scrollTo(0, 0);
    renderEternalStelePage();
}

function closeEternalStelePage(restoreScroll = true) {
    const page = document.getElementById('eternalStelePage');
    if (page) page.style.display = 'none';
    document.body.classList.remove('eternal-stele-view-open');
    if (restoreScroll !== false) requestAnimationFrame(() => window.scrollTo(0, eternalSteleScrollY || 0));
}

function hideEternalStelePage() {
    const page = document.getElementById('eternalStelePage');
    if (page) page.style.display = 'none';
    document.body.classList.remove('eternal-stele-view-open');
}

function installEternalStelePageGuards() {
    const wrap = (name) => {
        const original = window[name];
        if (typeof original !== 'function') return;
        window[name] = async function (...args) {
            hideEternalStelePage();
            return await original.apply(this, args);
        };
    };
    ['openProfilePage', 'openLeaderboardPage', 'openScorePage', 'openMatchPage', 'openBattlePage', 'openAdminPage', 'openPermissionDesk'].forEach(wrap);
}

function bindEternalSteleButtons() {
    const ids = ['eternalSteleButton', 'mobileEternalSteleButton'];
    for (const id of ids) {
        const button = document.getElementById(id);
        if (!button || button.dataset.steleBound === 'true') continue;
        button.dataset.steleBound = 'true';
        button.addEventListener('click', (event) => {
            event.preventDefault();
            openEternalStelePage();
        });
    }
}

window.openEternalStelePage = openEternalStelePage;
window.closeEternalStelePage = closeEternalStelePage;
window.hideEternalStelePage = hideEternalStelePage;
window.renderEternalStelePage = renderEternalStelePage;

installEternalStelePageGuards();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEternalSteleButtons, { once: true });
} else {
    bindEternalSteleButtons();
}

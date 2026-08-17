// Eternal stele page for memorial entries.

const ETERNAL_STELE_RECORDS = [
    {
        title: '\u81ea\u7531\u4e4b\u795e--\u66e6',
        subtitle: '\u661f\u9014 \u00b7 \u521d\u94ed\u591c\u6b4c',
        summary: '\u4e0d\u662f\u6392\u540d\uff0c\u800c\u662f\u88ab\u8bb0\u4f4f\u7684\u5f62\u72b6\u3002\u66e6\u7684\u60c5\u666f\u4ee5\u201c\u65ad\u51a0 + \u5893\u7891\u201d\u4e3a\u6838\u5fc3\uff0c\u5c06\u81ea\u7531\u3001\u6253\u7834\u4e0e\u7acb\u4f4f\u540c\u65f6\u653e\u5728\u4e00\u4e2a\u7eaf\u7c8e\u7684\u7eaa\u5ff5\u56fe\u8c61\u91cc\u3002',
        note: '\u6c38\u94ed\u6b64\u540d',
        motif: '\u738b\u51a0 + \u5893\u7891',
    }
];

let eternalSteleScrollY = 0;

function renderEternalStelePage() {
    const container = document.getElementById('eternalSteleContent');
    if (!container) return;
    const record = ETERNAL_STELE_RECORDS[0];
    container.innerHTML = `
        <section class="stele-hero stele-hero-silent">
            <div class="stele-hero-copy">
                <div class="stele-kicker">\u591c\u6b4c\u94ed\u523b</div>
                <h1 class="stele-title">\u6c38\u6052\u795e\u7891</h1>
                <p class="stele-lead">\u8fd9\u91cc\u6ca1\u6709\u6392\u884c\uff0c\u53ea\u6709\u88ab\u4fdd\u7559\u7684\u56fe\u5f62\u3002\u6bcf\u4e00\u5757\u7891\u90fd\u6709\u81ea\u5df1\u7684\u738b\u51a0\u4e0e\u7269\u4ef6\uff0c\u8c61\u5f81\u4e00\u6bb5\u4e0d\u8be5\u88ab\u5fd8\u8bb0\u7684\u603b\u548c\u3002</p>
            </div>
            <div class="stele-meta">
                <div class="stele-stat"><span>\u7eaa\u5ff5\u72b6\u6001</span><strong>\u5df2\u94ed\u523b</strong></div>
                <div class="stele-stat"><span>\u56fe\u5f62\u6bcd\u9898</span><strong>${escapeHtml(record.motif)}</strong></div>
            </div>
        </section>
        <section class="stele-sanctum" aria-label="\u6c38\u6052\u795e\u7891\u4e3b\u7891">
            <div class="stele-sanctum-pillars" aria-hidden="true">
                <span class="stele-pillar stele-pillar-left"></span>
                <span class="stele-pillar stele-pillar-right"></span>
                <span class="stele-sanctum-arch"></span>
            </div>
            <div class="stele-monolith">
                <div class="stele-monolith-crown" aria-hidden="true">
                    <span class="stele-crown-halo"></span>
                    <span class="stele-crown-arc"></span>
                    <span class="stele-crown-spike spike-left"></span>
                    <span class="stele-crown-spike spike-mid-left"></span>
                    <span class="stele-crown-spike spike-mid"></span>
                    <span class="stele-crown-spike spike-mid-right"></span>
                    <span class="stele-crown-spike spike-right"></span>
                    <span class="stele-crown-gem gem-left"></span>
                    <span class="stele-crown-gem gem-center"></span>
                    <span class="stele-crown-gem gem-right"></span>
                    <span class="stele-crown-break"></span>
                </div>
                <div class="stele-monolith-motif" aria-hidden="true">
                    <span class="stele-motif-stone"></span>
                    <span class="stele-motif-crack"></span>
                    <span class="stele-motif-light"></span>
                    <span class="stele-motif-base"></span>
                </div>
                <div class="stele-monolith-head">
                    <div class="stele-monolith-heading">
                        <div class="stele-monolith-title">${escapeHtml(record.title)}</div>
                        <div class="stele-monolith-subtitle">${escapeHtml(record.subtitle)}</div>
                    </div>
                </div>
                <div class="stele-monolith-body">
                    <p>${escapeHtml(record.summary)}</p>
                </div>
                <div class="stele-monolith-foot">
                    <span>${escapeHtml(record.motif)}</span>
                    <span>${escapeHtml(record.note)}</span>
                </div>
                <div class="stele-monolith-base" aria-hidden="true"></div>
            </div>
        </section>
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

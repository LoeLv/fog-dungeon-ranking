// Eternal stele page for memorial entries.

const ETERNAL_STELE_RECORDS = [
    {
        title: '\u81ea\u7531\u4e4b\u795e--\u66e6',
        subtitle: '\u661f\u9014 \u00b7 \u521d\u94ed\u591c\u6b4c',
        summary: '\u4f5c\u4e3a\u4fe1\u4ef0\u4e4b\u5730\u7684\u521d\u521b\u8005\uff0c\u66e6\u5386\u7ecf\u9ed1\u6697\u65f6\u4ee3\u7684\u538b\u8feb\u4e0e\u8840\u706b\uff0c\u72ec\u7acb\u6210\u957f\uff0c\u6700\u7ec8\u6210\u4e3a\u81ea\u7531\u4e4b\u795e\uff0c\u53d7\u4e07\u6c11\u656c\u4ef0\u3002',
        note: '\u6c38\u94ed\u6b64\u540d',
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
                    <span class="stele-crown-panel panel-left"></span>
                    <span class="stele-crown-panel panel-mid-left"></span>
                    <span class="stele-crown-panel panel-mid"></span>
                    <span class="stele-crown-panel panel-mid-right"></span>
                    <span class="stele-crown-panel panel-right"></span>
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

// Eternal stele page for memorial entries.

const ETERNAL_STELE_RECORDS = [
    {
        rank: '01',
        title: '\u81ea\u7531\u4e4b\u795e--\u66e6',
        subtitle: '\u661f\u9014 \u00b7 \u7b2c\u4e00\u5757\u7891',
        summary: '\u4f5c\u4e3a\u4fe1\u4ef0\u4e4b\u5730\u7684\u521d\u521b\u8005\uff0c\u7972\u5386\u7ecf\u9ed1\u6697\u65f6\u4ee3\u7684\u538b\u8feb\u4e0e\u8840\u706b\uff0c\u72ec\u7acb\u6210\u957f\uff0c\u6700\u7ec8\u6210\u4e3a\u81ea\u7531\u4e4b\u795e\uff0c\u53d7\u4e07\u6c11\u656c\u4fef\u3002',
        note: '\u5927\u6bb5\u7ec8\u5f52 \u00b7 \u6027\u8d28\u4fdd\u7559',
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
                <div class="stele-kicker">ETERNAL STELE</div>
                <h1 class="stele-title">\u6c38\u6052\u795e\u7891</h1>
                <p class="stele-lead">\u8fd9\u91cc\u4e0d\u662f\u699c\u5355\uff0c\u800c\u662f\u628a\u88ab\u8bb0\u4f4f\u7684\u4eba\u4f5c\u4e3a\u4e00\u5757\u5899\uff0c\u4e00\u5757\u7845\uff0c\u4e00\u9053\u4e0d\u4f1a\u9000\u8272\u7684\u7b7e\u8bb0\u3002</p>
            </div>
            <div class="stele-meta">
                <div class="stele-stat"><span>\u9ed8\u8bb0\u5e8f\u5217</span><strong>${ETERNAL_STELE_RECORDS.length}</strong></div>
                <div class="stele-stat"><span>\u5f53\u524d\u4e3b\u4f4d</span><strong>\u661f\u9014</strong></div>
                <div class="stele-stat"><span>\u7f16\u8f91\u72b6\u6001</span><strong>\u7ee7\u7eed\u7acb\u7a0b</strong></div>
            </div>
        </section>
        <section class="stele-monolith">
            <div class="stele-monolith-head">
                <span class="stele-rank">${escapeHtml(record.rank)}</span>
                <div>
                    <div class="stele-monolith-title">${escapeHtml(record.title)}</div>
                    <div class="stele-monolith-subtitle">${escapeHtml(record.subtitle)}</div>
                </div>
            </div>
            <div class="stele-monolith-body">
                <p>${escapeHtml(record.summary)}</p>
            </div>
            <div class="stele-monolith-foot">
                <span>${escapeHtml(record.note)}</span>
                <span>\u53ea\u7559\u4e0b\u4e00\u4e2a\u540d\u5b57\uff0c\u5176\u4f59\u4ea4\u7ed9\u65f6\u95f4\u3002</span>
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

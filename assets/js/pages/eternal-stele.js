// Eternal stele page for memorial entries.

const ETERNAL_STELE_RECORDS = [
    {
        rank: '01',
        title: '自由之神--曦',
        subtitle: '星途 · 第一块碑',
        summary: '作为信仰之地的初创者，祂历经黑暗时代的压迫与血火，独立成长，最终成为自由之神，受万民敬仰。',
        note: '永恒铭记 · 不入信徒排行',
    }
];

let eternalSteleScrollY = 0;

function renderEternalStelePage() {
    const container = document.getElementById('eternalSteleContent');
    if (!container) return;
    const record = ETERNAL_STELE_RECORDS[0];
    container.innerHTML = `
        <section class="stele-hero">
            <div>
                <div class="stele-kicker">ETERNAL STELE</div>
                <h1 class="stele-title">永恒神碑</h1>
                <p class="stele-lead">这里不是榜单的延伸，而是把被记住的人，安静地立成碑。</p>
            </div>
            <div class="stele-meta">
                <div class="stele-stat"><span>铭刻数量</span><strong>${ETERNAL_STELE_RECORDS.length}</strong></div>
                <div class="stele-stat"><span>席位属性</span><strong>星途</strong></div>
                <div class="stele-stat"><span>页面性质</span><strong>纪念</strong></div>
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
        </section>
        <div class="stele-grid">
            <section class="stele-panel">
                <div class="profile-panel-title">
                    <span>星途说明</span>
                    <small>特殊账号</small>
                </div>
                <p class="stele-copy">星途会保留独立身份，但不会进入普通信徒排行榜。</p>
            </section>
            <section class="stele-panel">
                <div class="profile-panel-title">
                    <span>后续扩展</span>
                    <small>留白预留</small>
                </div>
                <p class="stele-copy">以后如果要继续立碑，可以直接在这里追加新的铭刻记录。</p>
            </section>
        </div>
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

installEternalStelePageGuards();

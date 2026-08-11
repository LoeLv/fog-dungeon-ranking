// Eternal stele page: commemorative memorial for special accounts.

const ETERNAL_STELE_RECORDS = [
    {
        id: 'stele-01',
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
        <section class="eternal-stele-hero">
            <div class="eternal-stele-hero-copy">
                <div class="profile-kicker">ETERNAL STELE</div>
                <h1 class="eternal-stele-title">永恒神碑</h1>
                <p class="eternal-stele-lead">这里不是榜单的延伸，而是把被记住的人，安静地立成碑。</p>
            </div>
            <div class="eternal-stele-hero-meta">
                <div class="eternal-stele-stat">
                    <span>铭刻数量</span>
                    <strong>${ETERNAL_STELE_RECORDS.length}</strong>
                </div>
                <div class="eternal-stele-stat">
                    <span>特殊席位</span>
                    <strong>星途</strong>
                </div>
                <div class="eternal-stele-stat">
                    <span>排行属性</span>
                    <strong>纪念</strong>
                </div>
            </div>
        </section>
        <div class="eternal-stele-layout">
            <section class="eternal-stele-monolith">
                <div class="eternal-stele-monolith-head">
                    <span class="eternal-stele-rank">${escapeHtml(record.rank)}</span>
                    <div>
                        <div class="eternal-stele-monolith-title">${escapeHtml(record.title)}</div>
                        <div class="eternal-stele-monolith-subtitle">${escapeHtml(record.subtitle)}</div>
                    </div>
                </div>
                <div class="eternal-stele-monolith-body">
                    <p>${escapeHtml(record.summary)}</p>
                </div>
                <div class="eternal-stele-monolith-foot">
                    <span class="metric-pill">${escapeHtml(record.note)}</span>
                </div>
            </section>
            <aside class="eternal-stele-sidebar">
                <section class="eternal-stele-panel">
                    <div class="profile-panel-title">
                        <span>星途说明</span>
                        <small>特殊账号</small>
                    </div>
                    <p class="eternal-stele-copy">星途与神明同属特殊席位，能够在网站上保留独立身份，但不会进入信徒之间的普通排行榜。</p>
                    <p class="eternal-stele-copy">它更适合被看作一块纪念碑，而不是一个需要和别人比较的账号。</p>
                </section>
                <section class="eternal-stele-panel">
                    <div class="profile-panel-title">
                        <span>留名方式</span>
                        <small>后续可扩展</small>
                    </div>
                    <p class="eternal-stele-copy">如果以后还要继续立碑，可以继续在这里追加新的星途铭刻，让纪念页保留单独的仪式感。</p>
                </section>
            </aside>
        </div>
    `;
}

async function openEternalStelePage() {
    eternalSteleScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const detailOverlay = document.getElementById('detailOverlay');
    if (detailOverlay) detailOverlay.style.display = 'none';
    const profilePage = document.getElementById('profilePage');
    if (profilePage) profilePage.style.display = 'none';
    const leaderboardPage = document.getElementById('leaderboardPage');
    if (leaderboardPage) leaderboardPage.style.display = 'none';
    const scorePage = document.getElementById('scorePage');
    if (scorePage) scorePage.style.display = 'none';
    const matchPage = document.getElementById('matchPage');
    if (matchPage) matchPage.style.display = 'none';
    const battleRoomPage = document.getElementById('battleRoomPage');
    if (battleRoomPage) battleRoomPage.style.display = 'none';
    const adminPage = document.getElementById('adminPage');
    if (adminPage) adminPage.style.display = 'none';
    const permissionPage = document.getElementById('permissionPage');
    if (permissionPage) permissionPage.style.display = 'none';
    document.body.classList.remove('detail-view-open', 'profile-view-open', 'leaderboard-view-open', 'score-view-open', 'match-view-open', 'battle-room-view-open');
    document.body.classList.add('eternal-stele-view-open');
    setMobileNavActive('profile');
    const page = document.getElementById('eternalStelePage');
    if (page) page.style.display = 'block';
    window.scrollTo(0, 0);
    renderEternalStelePage();
}

function closeEternalStelePage(restoreScroll = true) {
    const page = document.getElementById('eternalStelePage');
    if (page) page.style.display = 'none';
    document.body.classList.remove('eternal-stele-view-open');
    setMobileNavActive('dungeons');
    if (restoreScroll !== false) requestAnimationFrame(() => window.scrollTo(0, eternalSteleScrollY || 0));
}

function hideEternalStelePage(restoreScroll = false) {
    const page = document.getElementById('eternalStelePage');
    if (page) page.style.display = 'none';
    document.body.classList.remove('eternal-stele-view-open');
    if (restoreScroll) requestAnimationFrame(() => window.scrollTo(0, eternalSteleScrollY || 0));
}

function installEternalStelePageGuards() {
    [
        'openProfilePage',
        'openLeaderboardPage',
        'openScorePage',
        'openMatchPage',
        'openAdminPage',
        'openPermissionDesk'
    ].forEach(name => {
        const original = window[name];
        if (typeof original !== 'function' || original.__eternalSteleGuarded) return;
        const wrapped = async function (...args) {
            hideEternalStelePage(false);
            return await original.apply(this, args);
        };
        wrapped.__eternalSteleGuarded = true;
        window[name] = wrapped;
    });
}

installEternalStelePageGuards();

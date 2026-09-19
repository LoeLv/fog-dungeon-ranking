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
    },
    {
        motif: 'coffin',
        title: '护短之神--棺材板',
        subtitle: '\u524d\u8eab \u00b7 \u8150\u673d\u4e4b\u795e',
        summary: '作为死亡家族中最感性的存在，骨头座下第一人，棺材板的为人被众人所知，脱离希望之州后来到信仰之地，并且将宗门扩大至数人。期间尽职尽责，担任过多项职责，是我们必不可缺的伙伴。但是由于宗门裙带关系，棺材板陨落至黑风峡谷（信仰杀）之中。至今，棺材板的事迹仍然在被歌颂，永恒传唱！',
        note: '\u6c38\u6052\u4f20\u5531',
    },
    {
        motif: 'sun',
        title: '暖阳女神--槐柏',
        subtitle: '前身 · 湮灭之神',
        summary: '槐柏是世界上最温情的存在，虽身负湮灭破坏之力，却从未做出伤害。祂是一代神女，而后成为湮灭，祂的柔情与温暖照拂世间。执世界之崩坏，护苍生，保天下。历经黑暗时代后，集结数人开辟新的信仰大陆，保全己身，护人周全，天穹早就吹响湮灭的和风，祂的柔情和光照耀，无不咏叹。',
        note: '暖阳长照',
    },
    {
        motif: 'guard',
        title: '皮卡丘之神--守护',
        subtitle: '前身 · 秩序之神',
        summary: '世界的终结者--皮卡丘，这是一种邪恶的黄色生物。处在希望之州的预言家神棍有一天意外碰到这种生物，历经大战之后，最终成功收容，但是外表被皮卡丘腐蚀，最终沦为黄色的猫，改名守护。祂用自己的身体，使用秩序的权柄将这个生物封锁在自己身体中，来到信仰之地，被赋予秩序之力。祂即是律法的化身，虽然自己的身体已经如此，但祂仍然被群众们所信仰，爱戴，拥护，而祂也因此热爱着这个接受祂的地方，勤奋且不知疲倦地守护这里，不忘初心，刻心执守。',
        note: '刻心执守',
    }
];

let eternalSteleScrollY = 0;

function renderEternalSteleMotif(record) {
    if (record.motif === 'pages') {
        return `
            <span class="stele-art stele-art-pages">
                <span class="art-pages-board"></span>
                <span class="art-pages-leaf art-leaf-left"></span>
                <span class="art-pages-leaf art-leaf-right"></span>
                <span class="art-pages-spine"></span>
                <span class="art-pages-line art-line-1"></span>
                <span class="art-pages-line art-line-2"></span>
                <span class="art-pages-line art-line-3"></span>
                <span class="art-pages-sheet art-sheet-1"></span>
                <span class="art-pages-sheet art-sheet-2"></span>
                <span class="art-pages-sheet art-sheet-3"></span>
                <span class="art-pages-glyph art-glyph-1"></span>
                <span class="art-pages-glyph art-glyph-2"></span>
                <span class="art-pages-glyph art-glyph-3"></span>
                <span class="art-pages-inkflow"></span>
            </span>`;
    }
    if (record.motif === 'luck') {
        return `
            <span class="stele-art stele-art-luck">
                <span class="art-luck-ring"></span>
                <span class="art-luck-scale art-scale-1"></span>
                <span class="art-luck-scale art-scale-2"></span>
                <span class="art-luck-scale art-scale-3"></span>
                <span class="art-luck-scale art-scale-4"></span>
                <span class="art-luck-scale art-scale-5"></span>
                <span class="art-luck-scale art-scale-6"></span>
                <span class="art-luck-wheel"></span>
                <span class="art-luck-spoke art-spoke-1"></span>
                <span class="art-luck-spoke art-spoke-2"></span>
                <span class="art-luck-spoke art-spoke-3"></span>
                <span class="art-luck-spoke art-spoke-4"></span>
                <span class="art-luck-hub"></span>
                <span class="art-luck-eye"></span>
                <span class="art-luck-dragon art-dragon-left"></span>
                <span class="art-luck-dragon art-dragon-right"></span>
                <span class="art-luck-sweep"></span>
            </span>`;
    }
    if (record.motif === 'coffin') {
        return `
            <span class="stele-art stele-art-coffin">
                <span class="art-coffin-board"></span>
                <span class="art-coffin-shield"></span>
                <span class="art-coffin-cross-v"></span>
                <span class="art-coffin-cross-h"></span>
                <span class="art-coffin-band art-band-top"></span>
                <span class="art-coffin-band art-band-bottom"></span>
                <span class="art-coffin-bolt art-bolt-lt"></span>
                <span class="art-coffin-bolt art-bolt-rt"></span>
                <span class="art-coffin-bolt art-bolt-lb"></span>
                <span class="art-coffin-bolt art-bolt-rb"></span>
                <span class="art-coffin-rune art-rune-1"></span>
                <span class="art-coffin-rune art-rune-2"></span>
                <span class="art-coffin-rune art-rune-3"></span>
                <span class="art-coffin-miasma"></span>
                <span class="art-coffin-ember art-ember-1"></span>
                <span class="art-coffin-ember art-ember-2"></span>
                <span class="art-coffin-ember art-ember-3"></span>
            </span>`;
    }
    if (record.motif === 'sun') {
        return `
            <span class="stele-art stele-art-sun">
                <span class="art-sun-halo"></span>
                <span class="art-sun-corona"></span>
                <span class="art-sun-ray art-sun-ray-1"></span>
                <span class="art-sun-ray art-sun-ray-2"></span>
                <span class="art-sun-ray art-sun-ray-3"></span>
                <span class="art-sun-ray art-sun-ray-4"></span>
                <span class="art-sun-disc"></span>
                <span class="art-sun-core"></span>
                <span class="art-sun-horizon"></span>
                <span class="art-sun-petal art-petal-1"></span>
                <span class="art-sun-petal art-petal-2"></span>
                <span class="art-sun-petal art-petal-3"></span>
                <span class="art-sun-mote art-mote-1"></span>
                <span class="art-sun-mote art-mote-2"></span>
                <span class="art-sun-mote art-mote-3"></span>
                <span class="art-sun-mote art-mote-4"></span>
            </span>`;
    }
    if (record.motif === 'guard') {
        return `
            <span class="stele-art stele-art-guard">
                <span class="art-guard-lattice"></span>
                <span class="art-guard-column art-col-left"></span>
                <span class="art-guard-column art-col-right"></span>
                <span class="art-guard-scale"></span>
                <span class="art-guard-shield"></span>
                <span class="art-guard-shield-core"></span>
                <span class="art-guard-bolt art-bolt-1"></span>
                <span class="art-guard-bolt art-bolt-2"></span>
                <span class="art-guard-bolt art-bolt-3"></span>
                <span class="art-guard-ear art-ear-left"></span>
                <span class="art-guard-ear art-ear-right"></span>
                <span class="art-guard-cheek art-cheek-left"></span>
                <span class="art-guard-cheek art-cheek-right"></span>
                <span class="art-guard-seal"></span>
                <span class="art-guard-spark art-spark-1"></span>
                <span class="art-guard-spark art-spark-2"></span>
                <span class="art-guard-spark art-spark-3"></span>
                <span class="art-guard-spark art-spark-4"></span>
            </span>`;
    }
    return `
        <span class="stele-art stele-art-tomb">
            <span class="art-tomb-obelisk"></span>
            <span class="art-tomb-cap"></span>
            <span class="art-tomb-star"></span>
            <span class="art-tomb-star-core"></span>
            <span class="art-tomb-rune art-tomb-rune-1"></span>
            <span class="art-tomb-rune art-tomb-rune-2"></span>
            <span class="art-tomb-rune art-tomb-rune-3"></span>
            <span class="art-tomb-crack"></span>
            <span class="art-tomb-moonlight"></span>
            <span class="art-tomb-orbit"></span>
            <span class="art-tomb-dust art-dust-1"></span>
            <span class="art-tomb-dust art-dust-2"></span>
            <span class="art-tomb-dust art-dust-3"></span>
            <span class="art-tomb-dust art-dust-4"></span>
            <span class="art-tomb-dust art-dust-5"></span>
        </span>`;
}

function renderEternalSteleRecord(record) {
    const motifClass =
        record.motif === 'pages' ? 'stele-monolith-pages' :
        record.motif === 'luck' ? 'stele-monolith-luck' :
        record.motif === 'coffin' ? 'stele-monolith-coffin' :
        record.motif === 'sun' ? 'stele-monolith-sun' :
        record.motif === 'guard' ? 'stele-monolith-guard' :
        'stele-monolith-tomb';
    return `
        <section class="stele-sanctum stele-sanctum-${escapeHtml(record.motif)}" aria-label="${escapeHtml(record.title)}">
            <div class="stele-atmos" aria-hidden="true">
                <span class="stele-atmos-aura"></span>
                <span class="stele-atmos-ray r1"></span>
                <span class="stele-atmos-ray r2"></span>
                <span class="stele-atmos-ray r3"></span>
                <span class="stele-atmos-mote m1"></span>
                <span class="stele-atmos-mote m2"></span>
                <span class="stele-atmos-mote m3"></span>
                <span class="stele-atmos-mote m4"></span>
                <span class="stele-atmos-mote m5"></span>
                <span class="stele-atmos-mote m6"></span>
                <span class="stele-atmos-cast"></span>
                <span class="stele-atmos-floor"></span>
                <span class="stele-atmos-ripple"></span>
            </div>
            <div class="stele-sanctum-pillars" aria-hidden="true">
                <span class="stele-pillar stele-pillar-left"></span>
                <span class="stele-pillar stele-pillar-right"></span>
                <span class="stele-sanctum-arch"></span>
            </div>
            <div class="stele-monolith ${motifClass}">
                <span class="stele-sheen" aria-hidden="true"></span>
                <span class="stele-rim stele-rim-left" aria-hidden="true"></span>
                <span class="stele-rim stele-rim-right" aria-hidden="true"></span>
                <span class="stele-grain" aria-hidden="true"></span>
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
                    ` : record.motif === 'coffin' ? `
                        <span class="stele-coffin-crown-lid"></span>
                        <span class="stele-coffin-crown-lid-shadow"></span>
                        <span class="stele-coffin-crown-spine"></span>
                        <span class="stele-coffin-crown-brace coffin-brace-left"></span>
                        <span class="stele-coffin-crown-brace coffin-brace-right"></span>
                        <span class="stele-coffin-crown-bolt coffin-bolt-left"></span>
                        <span class="stele-coffin-crown-bolt coffin-bolt-center"></span>
                        <span class="stele-coffin-crown-bolt coffin-bolt-right"></span>
                    ` : record.motif === 'sun' ? `
                        <span class="stele-crown-sun-ring"></span>
                        <span class="stele-crown-sun-ray sun-crown-ray-left"></span>
                        <span class="stele-crown-sun-ray sun-crown-ray-right"></span>
                        <span class="stele-crown-sun-gem"></span>
                        <span class="stele-crown-sun-flare"></span>
                    ` : record.motif === 'guard' ? `
                        <span class="stele-crown-guard-bolt"></span>
                        <span class="stele-crown-guard-ear ear-left"></span>
                        <span class="stele-crown-guard-ear ear-right"></span>
                        <span class="stele-crown-guard-core"></span>
                        <span class="stele-crown-guard-ring"></span>
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
            <div class="stele-veil" aria-hidden="true"></div>
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

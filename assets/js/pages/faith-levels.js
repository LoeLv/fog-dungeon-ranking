// Faith level page: aggregates a pilgrim's behaviour (clear records + authored
// trials) into per-god / per-path faith progress and maps it to the existing
// three-stage faith titles (初阶 / 执印 / 纪元执掌).
let faithLevelScrollY = 0;

const FAITH_LEVEL_WEIGHTS = { clear: 12, forge: 8 };

function canOpenFaithLevels() {
    return Boolean(inviteSession);
}

function getFaithLevelGods() {
    return GOD_GROUPS.flatMap(group => group.gods.map(god => ({ god, path: group.path, className: group.className })));
}

// Award each dungeon's god tags once per god so multi-tag trials count fairly.
function buildFaithContributions(clearRecords, authored) {
    const points = {};
    getFaithLevelGods().forEach(({ god }) => { points[god] = { clear: 0, forge: 0 }; });
    const credit = (type, field) => {
        const seen = new Set();
        getDungeonGodInfos(type).forEach(info => {
            if (!points[info.god] || seen.has(info.god)) return;
            seen.add(info.god);
            points[info.god][field] += 1;
        });
    };
    (clearRecords || []).forEach(record => { if (record?.dungeon) credit(record.dungeon.type, 'clear'); });
    (authored || []).forEach(dungeon => credit(dungeon?.type, 'forge'));
    return points;
}

function getFaithGodProgress(entry) {
    const { clear, forge } = entry;
    const value = clear * FAITH_LEVEL_WEIGHTS.clear + forge * FAITH_LEVEL_WEIGHTS.forge;
    const progress = Math.max(0, Math.min(100, value));
    return { clear, forge, value, progress };
}

function getFaithLevelTierMeta(progress) {
    if (progress >= 72) return { stage: 3, label: '纪元执掌', className: 'faith-tier-3' };
    if (progress >= 36) return { stage: 2, label: '执印信徒', className: 'faith-tier-2' };
    return { stage: 1, label: '初阶观测', className: 'faith-tier-1' };
}

function renderFaithRankCard(god, entry, isPrimary) {
    const info = getGodInfo(god);
    const stat = getFaithGodProgress(entry);
    const rank = getProfileFaithRank(god, stat.progress);
    const tier = getFaithLevelTierMeta(stat.progress);
    const nextGap = stat.progress >= 72 ? 0 : (stat.progress >= 36 ? 72 - stat.progress : 36 - stat.progress);
    return `
        <article class="faith-god-card ${isPrimary ? 'is-primary' : ''} ${tier.className}">
            <div class="faith-god-head">
                <span class="faith-god-name">${escapeHtml(god)}</span>
                <span class="faith-god-path">${escapeHtml(info.path)}命途</span>
            </div>
            <div class="faith-god-rank">${escapeHtml(rank.title)}</div>
            <div class="faith-god-track"><div class="faith-god-fill" style="width:${stat.progress}%"></div></div>
            <div class="faith-god-meta">
                <span>通关 <strong>${stat.clear}</strong></span>
                <span>构筑 <strong>${stat.forge}</strong></span>
                <span>信仰值 <strong>${stat.value}</strong></span>
            </div>
            <div class="faith-god-next">${nextGap > 0 ? `距 ${escapeHtml(rank.next)} 还需 ${nextGap}` : '已抵此神阶位巅峰'}</div>
        </article>`;
}

function renderFaithPathBars(godStats) {
    const rows = GOD_GROUPS.map(group => {
        const value = group.gods.reduce((sum, god) => sum + (godStats[god]?.value || 0), 0);
        const max = Math.max(1, ...GOD_GROUPS.map(g => g.gods.reduce((s, gd) => s + (godStats[gd]?.value || 0), 0)));
        const pct = Math.round((value / max) * 100);
        return `
            <div class="faith-path-row">
                <span class="faith-path-label">${escapeHtml(group.path)}</span>
                <div class="faith-path-track"><div class="faith-path-fill ${escapeHtml(group.className)}" style="width:${pct}%"></div></div>
                <span class="faith-path-value">${value}</span>
            </div>`;
    }).join('');
    return `<div class="faith-path-bars">${rows}</div>`;
}

async function renderFaithLevels() {
    const container = document.getElementById('faithLevelContent');
    if (!container) return;
    if (!inviteSession) {
        container.innerHTML = renderRitualEmpty('请先通过同契召引入局，再查看信仰阶位。', '命运', '信仰阶位尚未开启');
        return;
    }
    const inviteSnapshot = getInviteSnapshot();
    container.innerHTML = '<div class="loading"><div class="spinner"></div><br>正在测算你的信仰阶位...</div>';

    let clearRecords = [];
    let authored = [];
    try {
        const dungeons = await fetchDungeons();
        clearRecords = await fetchMyClearRecords(dungeons);
        authored = await fetchMyAuthoredDungeons(dungeons);
    } catch (_) { /* fall through to empty */ }
    if (!isInviteSnapshotCurrent(inviteSnapshot)) return;

    const profile = getCurrentProfile();
    const faith = getProfileDisplayFaith(profile);
    const primaryGod = faith.god || '命运';
    const contributions = buildFaithContributions(clearRecords, authored);

    const godStats = {};
    getFaithLevelGods().forEach(({ god }) => { godStats[god] = getFaithGodProgress(contributions[god]); });

    const primaryStat = godStats[primaryGod] || { value: 0, progress: 0, clear: 0, forge: 0 };
    const primaryRank = getProfileFaithRank(primaryGod, primaryStat.progress);
    const totalFaith = Object.values(godStats).reduce((sum, s) => sum + s.value, 0);
    const ascendedGods = Object.keys(godStats).filter(god => godStats[god].progress >= 72).length;
    const rankedGods = getFaithLevelGods()
        .slice()
        .sort((a, b) => (godStats[b.god]?.value || 0) - (godStats[a.god]?.value || 0));

    const pathSections = GOD_GROUPS.map(group => {
        const groupValue = group.gods.reduce((sum, god) => sum + (godStats[god]?.value || 0), 0);
        const cards = group.gods
            .map(god => renderFaithRankCard(god, contributions[god], god === primaryGod))
            .join('');
        return `
            <section class="profile-panel" data-god="${escapeHtml(primaryGod)}" style="${getGodSkinStyle(primaryGod)}">
                <div class="profile-panel-title"><span>${escapeHtml(group.path)}命途</span><small>累计信仰值 ${groupValue}</small></div>
                <div class="faith-god-grid">${cards}</div>
            </section>`;
    }).join('');

    container.innerHTML = `
        <div class="profile-hero">
            <div class="profile-hero-copy">
                <div class="profile-kicker">FAITH ASCENSION · 神明信仰阶位</div>
                <h1 class="profile-name">${escapeHtml(inviteSession?.name || '入局信徒')}</h1>
                <div class="profile-subline">
                    <span class="metric-pill">本命 ${escapeHtml(primaryGod)}</span>
                    <span class="metric-pill">当前阶位 <strong>${escapeHtml(primaryRank.title)}</strong></span>
                    <span class="metric-pill">信仰总值 ${totalFaith}</span>
                </div>
            </div>
        </div>

        <section class="profile-panel" data-god="${escapeHtml(primaryGod)}" style="${getGodSkinStyle(primaryGod)}">
            <div class="profile-panel-title"><span>🕊️ 本命信仰进阶</span><small>${escapeHtml(primaryGod)} · ${escapeHtml(getGodInfo(primaryGod).path)}命途</small></div>
            <div class="faith-primary">
                <div class="faith-primary-rank">
                    <strong>${escapeHtml(primaryRank.title)}</strong>
                    <small>第 ${primaryRank.stage} 阶 / 共 3 阶</small>
                </div>
                <div class="faith-primary-track"><div class="faith-primary-fill" style="width:${primaryStat.progress}%"></div></div>
                <div class="faith-primary-meta">
                    <span class="metric-pill">信仰值 <strong>${primaryStat.value}</strong></span>
                    <span class="metric-pill">通关 <strong>${primaryStat.clear}</strong></span>
                    <span class="metric-pill">构筑 <strong>${primaryStat.forge}</strong></span>
                </div>
                <div class="faith-primary-next">${primaryStat.progress >= 72 ? '你已抵达此神的纪元执掌之位。' : `下一阶位：${escapeHtml(primaryRank.next)}（还需 ${72 - primaryStat.progress >= 36 - primaryStat.progress ? (primaryStat.progress >= 36 ? 72 - primaryStat.progress : 36 - primaryStat.progress) : 0} 信仰值）`}</div>
            </div>
        </section>

        <section class="profile-panel" data-god="${escapeHtml(primaryGod)}" style="${getGodSkinStyle(primaryGod)}">
            <div class="profile-panel-title"><span>📊 六命途信仰谱</span><small>已抵达最高阶位的神明 ${ascendedGods} 位</small></div>
            ${renderFaithPathBars(godStats)}
        </section>

        <section class="profile-panel" data-god="${escapeHtml(primaryGod)}" style="${getGodSkinStyle(primaryGod)}">
            <div class="profile-panel-title"><span>🏅 神明信仰序列</span><small>按信仰值排序（前 5）</small></div>
            <div class="faith-leader-list">
                ${rankedGods.slice(0, 5).map((g, i) => {
                    const s = godStats[g.god];
                    const rank = getProfileFaithRank(g.god, s.progress);
                    return `<div class="faith-leader-row">
                        <span class="faith-leader-no">${i + 1}</span>
                        <span class="faith-leader-god">${escapeHtml(g.god)}<small>${escapeHtml(g.path)}</small></span>
                        <span class="faith-leader-rank">${escapeHtml(rank.title)}</span>
                        <span class="faith-leader-value">${s.value}</span>
                    </div>`;
                }).join('')}
            </div>
        </section>

        ${pathSections}
    `;
}

function ensureFaithLevelStyles() {
    if (document.getElementById('faithLevelStyles')) return;
    const style = document.createElement('style');
    style.id = 'faithLevelStyles';
    style.textContent = `
.faith-primary{display:flex;flex-direction:column;gap:12px}
.faith-primary-rank{display:flex;flex-direction:column;gap:2px}
.faith-primary-rank strong{font-size:22px;color:var(--god-primary,#d8b56a)}
.faith-primary-rank small{font-size:12px;color:#9aa7b4}
.faith-primary-track{height:12px;border-radius:7px;background:rgba(255,255,255,.08);overflow:hidden}
.faith-primary-fill{height:100%;border-radius:7px;background:linear-gradient(90deg,var(--god-glow,#7aaec2),var(--god-primary,#d8b56a));transition:width .4s ease}
.faith-primary-meta{display:flex;flex-wrap:wrap;gap:8px}
.faith-primary-next{font-size:12px;color:#9aa7b4}
.faith-path-bars{display:flex;flex-direction:column;gap:10px}
.faith-path-row{display:grid;grid-template-columns:64px 1fr 48px;align-items:center;gap:10px}
.faith-path-label{font-size:13px;color:#cfd8e3}
.faith-path-track{height:10px;border-radius:6px;background:rgba(255,255,255,.08);overflow:hidden}
.faith-path-fill{height:100%;border-radius:6px;background:linear-gradient(90deg,var(--god-glow,#7aaec2),var(--god-primary,#d8b56a))}
.faith-path-value{font-size:13px;color:#e6d3a3;text-align:right}
.faith-leader-list{display:flex;flex-direction:column;gap:8px}
.faith-leader-row{display:grid;grid-template-columns:26px 1fr auto 56px;align-items:center;gap:10px;padding:8px 12px;border-radius:10px;background:rgba(255,255,255,.03)}
.faith-leader-no{font-weight:700;color:var(--god-primary,#d8b56a)}
.faith-leader-god{font-size:14px;color:#eef3f8}
.faith-leader-god small{margin-left:6px;font-size:11px;color:#8b98a6}
.faith-leader-rank{font-size:12px;color:#9aa7b4}
.faith-leader-value{font-size:13px;font-weight:600;color:#e6d3a3;text-align:right}
.faith-god-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
.faith-god-card{padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08)}
.faith-god-card.is-primary{border-color:rgba(216,181,106,.55);box-shadow:0 0 14px rgba(216,181,106,.14)}
.faith-god-card.faith-tier-3{border-color:rgba(216,181,106,.5)}
.faith-god-head{display:flex;justify-content:space-between;align-items:baseline}
.faith-god-name{font-size:15px;font-weight:600;color:#eef3f8}
.faith-god-path{font-size:11px;color:#8b98a6}
.faith-god-rank{margin-top:4px;font-size:12px;color:#e6d3a3}
.faith-god-track{margin-top:8px;height:7px;border-radius:5px;background:rgba(255,255,255,.08);overflow:hidden}
.faith-god-fill{height:100%;border-radius:5px;background:linear-gradient(90deg,var(--god-glow,#7aaec2),var(--god-primary,#d8b56a));transition:width .4s ease}
.faith-god-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;font-size:11px;color:#9aa7b4}
.faith-god-meta strong{color:#cfd8e3}
.faith-god-next{margin-top:6px;font-size:11px;color:#7d8a98}
@media (max-width:640px){.faith-god-grid{grid-template-columns:1fr}.faith-path-row{grid-template-columns:52px 1fr 40px}}
`;
    document.head.appendChild(style);
}

async function openFaithLevels() {
    if (!canOpenFaithLevels()) { showToast('请先通过同契召引入局，再查看信仰阶位'); return; }
    ensureFaithLevelStyles();
    faithLevelScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    ['profilePage', 'leaderboardPage', 'scorePage', 'matchPage', 'permissionPage', 'adminPage', 'eternalStelePage', 'authorPanelPage', 'achievementPage'].forEach(id => {
        const page = document.getElementById(id);
        if (page) page.style.display = 'none';
    });
    document.body.classList.remove('leaderboard-view-open', 'score-view-open', 'match-view-open');
    document.body.classList.add('profile-view-open');
    document.getElementById('faithLevelPage').style.display = 'block';
    window.scrollTo(0, 0);
    await renderFaithLevels();
}

function closeFaithLevels(restoreScroll = true) {
    const page = document.getElementById('faithLevelPage');
    if (page) page.style.display = 'none';
    document.body.classList.remove('profile-view-open');
    if (restoreScroll !== false) requestAnimationFrame(() => window.scrollTo(0, faithLevelScrollY || 0));
}

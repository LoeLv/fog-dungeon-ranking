// Achievement hall: derives a catalogue of achievements from readable data
// (clear records / talent warehouse / authored dungeons / profile scores).
let achievementScrollY = 0;

const ACHIEVEMENT_CATEGORIES = [
    { key: 'trial', name: '试炼征程', icon: '⚔️' },
    { key: 'talent', name: '天赋星图', icon: '✨' },
    { key: 'forge', name: '筑戏功业', icon: '🎭' },
    { key: 'faith', name: '信仰阵营', icon: '🕊️' }
];

// Each achievement exposes progress(context) -> { value, detail }.
const ACHIEVEMENT_DEFS = [
    // ---- 试炼征程 ----
    {
        id: 'first_clear', category: 'trial', name: '初入棋局', icon: '🎲', tier: 'bronze',
        desc: '完成首次试炼通关留存',
        progress: ctx => ({ value: ctx.clearCount, detail: `已通关 ${ctx.clearCount} 次` })
    },
    {
        id: 'clear_5', category: 'trial', name: '破局者', icon: '🛡️', tier: 'silver',
        desc: '累计通关留存 5 次',
        progress: ctx => ({ value: ctx.clearCount, detail: `已通关 ${ctx.clearCount} 次` })
    },
    {
        id: 'clear_20', category: 'trial', name: '命途常客', icon: '🏆', tier: 'gold',
        desc: '累计通关留存 20 次',
        progress: ctx => ({ value: ctx.clearCount, detail: `已通关 ${ctx.clearCount} 次` })
    },
    {
        id: 'explore_5', category: 'trial', name: '万象阅览', icon: '🧭', tier: 'silver',
        desc: '通关 5 个不同试炼',
        progress: ctx => ({ value: ctx.uniqueCleared, detail: `已涉猎 ${ctx.uniqueCleared} 个试炼` })
    },
    {
        id: 'ascension_100', category: 'trial', name: '登神初阶', icon: '🪜', tier: 'bronze',
        desc: '登神之路分数达到 100',
        progress: ctx => ({ value: ctx.ascensionScore, detail: `当前 ${ctx.ascensionScore} 分` })
    },
    {
        id: 'audience_50', category: 'trial', name: '觐见有声', icon: '📜', tier: 'bronze',
        desc: '觐见之梯分数达到 50',
        progress: ctx => ({ value: ctx.audienceScore, detail: `当前 ${ctx.audienceScore} 分` })
    },
    // ---- 天赋星图 ----
    {
        id: 'first_b_talent', category: 'talent', name: '初窥天赋', icon: '🔹', tier: 'bronze',
        desc: '首次获得 B 级天赋',
        progress: ctx => ({ value: ctx.rankB, detail: `B 级天赋 ${ctx.rankB} 个` })
    },
    {
        id: 'first_a_talent', category: 'talent', name: '天赋异禀', icon: '🔶', tier: 'silver',
        desc: '首次获得 A 级天赋',
        progress: ctx => ({ value: ctx.rankA, detail: `A 级天赋 ${ctx.rankA} 个` })
    },
    {
        id: 'first_s_talent', category: 'talent', name: '神选之才', icon: '👑', tier: 'gold',
        desc: '首次获得 S 级天赋',
        progress: ctx => ({ value: ctx.rankS, detail: `S 级天赋 ${ctx.rankS} 个` })
    },
    {
        id: 'talent_10', category: 'talent', name: '天赋收藏家', icon: '📦', tier: 'silver',
        desc: '累计拥有 10 个天赋',
        progress: ctx => ({ value: ctx.talentCount, detail: `已拥有 ${ctx.talentCount} 个天赋` })
    },
    {
        id: 'fragment_200', category: 'talent', name: '碎片富商', icon: '💠', tier: 'silver',
        desc: '累计持有 200 枚天赋碎片',
        progress: ctx => ({ value: ctx.fragmentTotal, detail: `当前 ${ctx.fragmentTotal} 枚碎片` })
    },
    // ---- 筑戏功业 ----
    {
        id: 'first_forge', category: 'forge', name: '初执笔', icon: '✒️', tier: 'bronze',
        desc: '首次构筑试炼',
        progress: ctx => ({ value: ctx.authoredCount, detail: `已构筑 ${ctx.authoredCount} 件` })
    },
    {
        id: 'forge_5', category: 'forge', name: '筑戏人', icon: '🎭', tier: 'silver',
        desc: '构筑 5 件试炼作品',
        progress: ctx => ({ value: ctx.authoredCount, detail: `已构筑 ${ctx.authoredCount} 件` })
    },
    {
        id: 'beloved_10', category: 'forge', name: '口碑载道', icon: '📣', tier: 'silver',
        desc: '作品累计获得 10 条读者证言',
        progress: ctx => ({ value: ctx.authoredComments, detail: `累计 ${ctx.authoredComments} 条证言` })
    },
    {
        id: 'high_rating', category: 'forge', name: '神格加冕', icon: '🌟', tier: 'gold',
        desc: '有作品神格判定达到 4.5 及以上',
        progress: ctx => ({ value: ctx.maxRating >= 4.5 ? 1 : 0, detail: `最高神格 ${ctx.maxRating.toFixed(1)}` })
    },
    // ---- 信仰阵营 ----
    {
        id: 'faction_life', category: 'faith', name: '生命行者', icon: '🌱', tier: 'bronze',
        desc: '通关任一生命命途试炼',
        progress: ctx => ({ value: ctx.pathCounts['生命'] || 0, detail: `生命命途通关 ${ctx.pathCounts['生命'] || 0} 次` })
    },
    {
        id: 'faction_void', category: 'faith', name: '虚无行者', icon: '🕳️', tier: 'bronze',
        desc: '通关任一虚无命途试炼',
        progress: ctx => ({ value: ctx.pathCounts['虚无'] || 0, detail: `虚无命途通关 ${ctx.pathCounts['虚无'] || 0} 次` })
    },
    {
        id: 'faction_all', category: 'faith', name: '六道通途', icon: '☯️', tier: 'gold',
        desc: '通关覆盖全部六大命途',
        progress: ctx => ({ value: ctx.coveredPaths, detail: `已覆盖 ${ctx.coveredPaths}/6 命途` })
    },
    {
        id: 'faction_dedicated', category: 'faith', name: '一途深耕', icon: '⛰️', tier: 'silver',
        desc: '在单一命途内通关 8 次',
        progress: ctx => ({ value: ctx.maxPathCount, detail: `最高单命途通关 ${ctx.maxPathCount} 次` })
    }
];

const ACHIEVEMENT_TIER_TARGETS = {
    bronze: { default: 1, order: 0 },
    silver: { default: 5, order: 1 },
    gold: { default: 20, order: 2 }
};

function getAchievementTarget(def) {
    const explicit = { clear_5: 5, clear_20: 20, explore_5: 5, ascension_100: 100, audience_50: 50,
        talent_10: 10, fragment_200: 200, forge_5: 5, beloved_10: 10, faction_all: 6, faction_dedicated: 8,
        first_clear: 1, first_b_talent: 1, first_a_talent: 1, first_s_talent: 1,
        first_forge: 1, high_rating: 1, faction_life: 1, faction_void: 1 };
    if (explicit[def.id] !== undefined) return explicit[def.id];
    return ACHIEVEMENT_TIER_TARGETS[def.tier]?.default || 1;
}

function canOpenAchievements() {
    return Boolean(inviteSession);
}

async function buildAchievementContext() {
    const profile = getCurrentProfile();
    const dungeons = await fetchDungeons();
    const clearRecords = await fetchMyClearRecords(dungeons);
    const authored = await fetchMyAuthoredDungeons(dungeons);
    let talentState = currentTalentState;
    try {
        const res = await fetchTalentState();
        if (res && !res.error && res.state) talentState = res.state;
    } catch (_) { /* keep cached state */ }

    const ownedTalents = (talentState?.ownedTalents) || [];
    const rankCount = rank => ownedTalents.filter(t => String(t.rank || '').toUpperCase() === rank).length;
    const pathCounts = countDungeonsByPath(clearRecords, record => record?.dungeon?.type);
    const coveredPaths = Object.values(pathCounts).filter(v => Number(v) > 0).length;
    const maxPathCount = Math.max(0, ...Object.values(pathCounts).map(v => Number(v) || 0));
    const authoredComments = authored.reduce((s, d) => s + Number(d.comment_count || 0), 0);
    const maxRating = authored.reduce((m, d) => Math.max(m, Number(d.avg_rating || 0)), 0);

    return {
        clearCount: clearRecords.length,
        uniqueCleared: new Set(clearRecords.map(r => String(r.dungeon_id))).size,
        ascensionScore: Number(profile.ascensionScore || 0),
        audienceScore: Number(profile.audienceScore || 0),
        talentCount: ownedTalents.length,
        rankB: rankCount('B'),
        rankA: rankCount('A'),
        rankS: rankCount('S'),
        fragmentTotal: Number(talentState?.fragmentTotal || 0),
        authoredCount: authored.length,
        authoredComments,
        maxRating,
        pathCounts,
        coveredPaths,
        maxPathCount
    };
}

function evaluateAchievements(ctx) {
    return ACHIEVEMENT_DEFS.map(def => {
        const target = getAchievementTarget(def);
        const raw = def.progress(ctx) || { value: 0, detail: '' };
        const value = Math.max(0, Number(raw.value) || 0);
        const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : (value > 0 ? 100 : 0);
        return {
            ...def,
            target,
            value,
            detail: raw.detail || '',
            pct,
            unlocked: value >= target
        };
    });
}

function renderAchievementCard(item, faithGod) {
    return `
        <article class="ach-card ${item.unlocked ? 'is-unlocked' : 'is-locked'} tier-${escapeHtml(item.tier)}">
            <div class="ach-card-icon">${item.unlocked ? item.icon : '🔒'}</div>
            <div class="ach-card-body">
                <div class="ach-card-head">
                    <span class="ach-card-name">${escapeHtml(item.name)}</span>
                    ${item.unlocked ? '<span class="ach-card-badge">已达成</span>' : ''}
                </div>
                <div class="ach-card-desc">${escapeHtml(item.desc)}</div>
                <div class="ach-card-progress">
                    <div class="ach-card-track"><div class="ach-card-fill" style="width:${item.pct}%"></div></div>
                    <span class="ach-card-count">${item.value}/${item.target}</span>
                </div>
                ${item.detail ? `<div class="ach-card-detail">${escapeHtml(item.detail)}</div>` : ''}
            </div>
        </article>`;
}

function renderAchievementSummary(items, faithGod) {
    const total = items.length;
    const unlocked = items.filter(i => i.unlocked).length;
    const pct = total ? Math.round((unlocked / total) * 100) : 0;
    return `
        <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${getGodSkinStyle(faithGod)}">
            <div class="profile-panel-title"><span>🏛️ 成就总览</span><small>已达成 ${unlocked} / ${total}</small></div>
            <div class="ach-summary">
                <div class="ach-summary-ring" style="--ach-pct:${pct}">
                    <span class="ach-summary-num">${pct}%</span>
                    <small>完成度</small>
                </div>
                <div class="ach-summary-stat">
                    <span class="metric-pill">已达成 <strong>${unlocked}</strong></span>
                    <span class="metric-pill">待解锁 <strong>${total - unlocked}</strong></span>
                </div>
            </div>
        </section>`;
}

async function renderAchievements() {
    const container = document.getElementById('achievementContent');
    if (!container) return;
    if (!inviteSession) {
        container.innerHTML = renderRitualEmpty('请先通过同契召引入局，再查看成就殿堂。', '命运', '成就殿堂尚未开启');
        return;
    }
    const inviteSnapshot = getInviteSnapshot();
    container.innerHTML = '<div class="loading"><div class="spinner"></div><br>正在点亮你的成就星图...</div>';

    let ctx = null;
    try {
        ctx = await buildAchievementContext();
    } catch (_) {
        ctx = null;
    }
    if (!isInviteSnapshotCurrent(inviteSnapshot)) return;
    if (!ctx) {
        container.innerHTML = renderRitualEmpty('成就数据读取失败，请稍后重试。', '命运', '成就数据暂不可用');
        return;
    }

    const items = evaluateAchievements(ctx);
    const faithGod = '命运';
    const sections = ACHIEVEMENT_CATEGORIES.map(cat => {
        const catItems = items.filter(i => i.category === cat.key);
        if (!catItems.length) return '';
        const got = catItems.filter(i => i.unlocked).length;
        return `
            <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${getGodSkinStyle(faithGod)}">
                <div class="profile-panel-title"><span>${cat.icon} ${escapeHtml(cat.name)}</span><small>${got}/${catItems.length}</small></div>
                <div class="ach-grid">${catItems.map(i => renderAchievementCard(i, faithGod)).join('')}</div>
            </section>`;
    }).join('');

    container.innerHTML = `
        <div class="profile-hero">
            <div class="profile-hero-copy">
                <div class="profile-kicker">ACHIEVEMENT HALL · 成就殿堂</div>
                <h1 class="profile-name">${escapeHtml(inviteSession?.name || '入局信徒')}</h1>
                <div class="profile-subline">
                    <span class="metric-pill">通关 ${ctx.clearCount}</span>
                    <span class="metric-pill">天赋 ${ctx.talentCount}</span>
                    <span class="metric-pill">作品 ${ctx.authoredCount}</span>
                </div>
            </div>
        </div>
        ${renderAchievementSummary(items, faithGod)}
        ${sections}
    `;
}

function ensureAchievementStyles() {
    if (document.getElementById('achievementStyles')) return;
    const style = document.createElement('style');
    style.id = 'achievementStyles';
    style.textContent = `
.ach-summary{display:flex;align-items:center;gap:20px;flex-wrap:wrap}
.ach-summary-ring{width:96px;height:96px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:conic-gradient(var(--god-primary,#d8b56a) calc(var(--ach-pct) * 1%), rgba(255,255,255,.08) 0);position:relative}
.ach-summary-ring::before{content:'';position:absolute;inset:8px;border-radius:50%;background:rgba(12,14,22,.85)}
.ach-summary-num{position:relative;font-size:22px;font-weight:700;color:var(--god-primary,#d8b56a)}
.ach-summary-ring small{position:relative;font-size:11px;color:#9aa7b4}
.ach-summary-stat{display:flex;flex-wrap:wrap;gap:8px}
.ach-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.ach-card{display:flex;gap:12px;padding:14px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);transition:transform .2s,border-color .2s}
.ach-card.is-locked{opacity:.62}
.ach-card.is-unlocked.tier-bronze{border-color:rgba(198,124,78,.5)}
.ach-card.is-unlocked.tier-silver{border-color:rgba(176,192,205,.55)}
.ach-card.is-unlocked.tier-gold{border-color:rgba(216,181,106,.65);box-shadow:0 0 14px rgba(216,181,106,.14)}
.ach-card-icon{font-size:26px;line-height:1;width:42px;height:42px;flex:0 0 42px;display:flex;align-items:center;justify-content:center;border-radius:12px;background:rgba(255,255,255,.05)}
.ach-card-body{flex:1;min-width:0}
.ach-card-head{display:flex;justify-content:space-between;align-items:center;gap:8px}
.ach-card-name{font-size:14px;font-weight:600;color:#eef3f8}
.ach-card-badge{font-size:10px;padding:2px 6px;border-radius:8px;background:rgba(216,181,106,.16);color:#e6d3a3;white-space:nowrap}
.ach-card-desc{margin-top:4px;font-size:12px;color:#9aa7b4}
.ach-card-progress{display:flex;align-items:center;gap:8px;margin-top:8px}
.ach-card-track{flex:1;height:7px;border-radius:5px;background:rgba(255,255,255,.08);overflow:hidden}
.ach-card-fill{height:100%;border-radius:5px;background:linear-gradient(90deg,var(--god-glow,#7aaec2),var(--god-primary,#d8b56a));transition:width .4s ease}
.ach-card-count{font-size:11px;color:#cfd8e3;white-space:nowrap}
.ach-card-detail{margin-top:5px;font-size:11px;color:#7d8a98}
@media (max-width:640px){.ach-grid{grid-template-columns:1fr}}
`;
    document.head.appendChild(style);
}

async function openAchievements() {
    if (!canOpenAchievements()) { showToast('请先通过同契召引入局，再查看成就殿堂'); return; }
    ensureAchievementStyles();
    achievementScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    ['profilePage', 'leaderboardPage', 'scorePage', 'matchPage', 'permissionPage', 'adminPage', 'eternalStelePage', 'authorPanelPage'].forEach(id => {
        const page = document.getElementById(id);
        if (page) page.style.display = 'none';
    });
    document.body.classList.remove('leaderboard-view-open', 'score-view-open', 'match-view-open');
    document.body.classList.add('profile-view-open');
    document.getElementById('achievementPage').style.display = 'block';
    window.scrollTo(0, 0);
    await renderAchievements();
}

function closeAchievements(restoreScroll = true) {
    const page = document.getElementById('achievementPage');
    if (page) page.style.display = 'none';
    document.body.classList.remove('profile-view-open');
    if (restoreScroll !== false) requestAnimationFrame(() => window.scrollTo(0, achievementScrollY || 0));
}

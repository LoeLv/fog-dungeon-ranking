// Leaderboard page and public profile preview flows.

function normalizeLeaderboardEntry(key, rawProfile) {
    const profile = { ...getProfileDefaults(), ...(rawProfile || {}) };
    const faithGod = cleanGodName(profile.faithGod || '');
    const faithInfo = getGodInfo(faithGod);
    const professionInfo = getProfessionInfo(profile.profession);
    const displayName = cleanDisplayNameInput(profile.displayName || (key === getProfileKey() ? inviteSession?.name : '') || '');
    return {
        key,
        displayName: displayName || '未命名信徒',
        role: normalizeRole(profile.role || '') || '',
        faithGod: faithInfo.known ? faithInfo.god : '',
        faithPath: faithInfo.known ? faithInfo.path : (profile.faithPath || ''),
        faithClass: faithInfo.known ? faithInfo.className : getPathClassByPath(profile.faithPath || '存在'),
        profession: professionInfo.known ? professionInfo.name : '',
        professionClass: professionInfo.known ? professionInfo.className : '',
        ascensionScore: normalizeProfileScore(profile.ascensionScore),
        audienceScore: normalizeProfileScore(profile.audienceScore),
        showTitles: profile.showTitles !== false && profile.show_titles !== false,
        activeTitle: normalizeProfileTitle(profile.activeTitle || profile.active_title),
        activeTitles: normalizeProfileTitleList(profile.activeTitles || profile.active_titles, profile.activeTitle || profile.active_title),
        activeCurse: normalizeProfileCurse(profile.activeCurse || profile.active_curse),
        activeCurses: normalizeProfileCurseList(profile.activeCurses || profile.active_curses, profile.activeCurse || profile.active_curse),
        updatedAt: profile.updatedAt || '',
        isCurrent: key === getProfileKey()
    };
}

function getLeaderboardEntries() {
    return Object.entries(getStoredProfiles())
        .map(([key, profile]) => normalizeLeaderboardEntry(key, profile))
        .filter(entry => entry.faithGod || entry.profession || entry.ascensionScore || entry.audienceScore || entry.displayName !== '未命名信徒');
}

function mapCloudProfileToLocal(profile) {
    if (!profile) return null;
    return {
        displayName: cleanDisplayNameInput(profile.display_name || profile.displayName || ''),
        role: normalizeRole(profile.role || '') || '',
        faithGod: cleanGodName(profile.faith_god || profile.faithGod || ''),
        faithPath: profile.faith_path || profile.faithPath || '',
        originalFaithGod: cleanGodName(profile.original_faith_god || profile.originalFaithGod || ''),
        originalFaithPath: profile.original_faith_path || profile.originalFaithPath || '',
        profession: normalizeProfession(profile.profession || ''),
        trickeryDisplayFaithGod: cleanGodName(profile.trickery_display_faith_god || profile.trickeryDisplayFaithGod || ''),
        trickeryDisplayFaithPath: profile.trickery_display_faith_path || profile.trickeryDisplayFaithPath || '',
        trickeryDisplayProfession: normalizeProfession(profile.trickery_display_profession || profile.trickeryDisplayProfession || ''),
        ascensionScore: normalizeProfileScore(profile.ascension_score ?? profile.ascensionScore, DEFAULT_ASCENSION_SCORE),
        audienceScore: normalizeProfileScore(profile.audience_score ?? profile.audienceScore, DEFAULT_AUDIENCE_SCORE),
        items: String(profile.items || '').trim().slice(0, 800),
        talents: String(profile.talents || '').trim().slice(0, 800),
        showTitles: profile.show_titles !== false && profile.showTitles !== false,
        activeTitle: normalizeProfileTitle(profile.active_title || profile.activeTitle),
        activeTitles: normalizeProfileTitleList(profile.active_titles || profile.activeTitles, profile.active_title || profile.activeTitle),
        activeCurse: normalizeProfileCurse(profile.active_curse || profile.activeCurse),
        activeCurses: normalizeProfileCurseList(profile.active_curses || profile.activeCurses, profile.active_curse || profile.activeCurse),
        scoresLockedAt: profile.scores_locked_at || profile.scoresLockedAt || '',
        updatedAt: profile.updated_at || profile.updatedAt || ''
    };
}

function mapCloudLeaderboardEntry(profile, index) {
    const localProfile = mapCloudProfileToLocal(profile);
    const publicProfileKey = profile?.profile_key || profile?.profileKey || `cloud:${index}`;
    const key = profile?.is_current ? getProfileKey() : publicProfileKey;
    return {
        ...normalizeLeaderboardEntry(key, localProfile),
        publicProfileKey,
        isCurrent: !!profile?.is_current
    };
}

async function fetchLeaderboardEntries() {
    const localEntries = getLeaderboardEntries();
    if (USE_LOCAL_FALLBACK) return { entries: localEntries, source: 'local' };
    return getShortCachedRead('leaderboard', async () => {
        try {
            const { data, error } = await invokeDungeonAction('listProfiles', {});
            if (error || !Array.isArray(data)) {
                console.warn('云端榜单读取失败，使用本地榜单:', error);
                return { entries: localEntries, source: 'local', error };
            }
            return { entries: data.map(mapCloudLeaderboardEntry), source: 'cloud' };
        } catch (error) {
            console.warn('云端榜单读取异常，使用本地榜单:', error);
            return { entries: localEntries, source: 'local', error };
        }
    });
}

function sortLeaderboardEntries(entries, scoreType) {
    return [...entries].sort((a, b) =>
        getLeaderboardScore(b, scoreType) - getLeaderboardScore(a, scoreType) ||
        Number(b.audienceScore || 0) - Number(a.audienceScore || 0) ||
        Number(b.ascensionScore || 0) - Number(a.ascensionScore || 0) ||
        new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
    );
}

function renderLeaderboardFaithDistribution(entries) {
    const counts = countByPath(entries, entry => entry.faithPath);
    return `
        <section class="leaderboard-faith-strip">
            <h3>寰宇信仰占比简录</h3>
            <div class="leaderboard-faith-bars">
                ${renderFaithFlowBars(counts, entries.length, { note: '本录收束已保存个人档案，信徒更新档案后会同步刷新。' })}
            </div>
        </section>`;
}

function getLeaderboardRank(entries, entry, scoreType) {
    return sortLeaderboardEntries(entries, scoreType).findIndex(item => item.key === entry.key) + 1;
}

function renderLeaderboardLookup(entries) {
    const query = String(leaderboardSearchQuery || '').trim();
    const queryKey = normalizeNameKey(query);
    const matches = queryKey
        ? entries.filter(entry => normalizeNameKey(entry.displayName).includes(queryKey)).slice(0, 12)
        : [];
    const results = !queryKey
        ? ''
        : !matches.length
        ? '<div class="profile-empty">没有找到匹配昵称，请检查输入。</div>'
        : `<div class="leaderboard-lookup-results">${matches.map(entry => {
            const faith = entry.faithGod ? `${entry.faithGod}之神 · ${entry.faithPath}命途` : '未立信仰';
            const ascensionRank = getLeaderboardRank(entries, entry, 'ascension');
            const audienceRank = getLeaderboardRank(entries, entry, 'audience');
            return `<article class="leaderboard-lookup-result" onclick='openProfileFromLeaderboard(${jsString(entry.key)})'>
                <div>
                    <strong>${escapeHtml(entry.displayName)}</strong>
                    <small>${escapeHtml(faith)} · ${escapeHtml(ROLE_LABELS[entry.role] || '入局信徒')}</small>
                </div>
                <div class="leaderboard-lookup-metrics">
                    <span class="metric-pill">登神 #${ascensionRank} · ${escapeHtml(formatProfileScore(entry.ascensionScore))}</span>
                    <span class="metric-pill">觐见 #${audienceRank} · ${escapeHtml(formatProfileScore(entry.audienceScore))}</span>
                </div>
            </article>`;
        }).join('')}</div>`;
    return `<section class="leaderboard-lookup">
        <div class="leaderboard-lookup-head"><span>昵称查询</span><small>跨全部分页定位玩家</small></div>
        <div class="leaderboard-lookup-controls">
            <input id="leaderboardSearchInput" maxlength="40" value="${escapeHtml(query).replace(/"/g, '&quot;')}" placeholder="输入完整或部分昵称" onkeydown="if(event.key === 'Enter'){ event.preventDefault(); applyLeaderboardSearch(); }">
            <button type="button" class="btn btn-primary btn-sm" onclick="applyLeaderboardSearch()">查询</button>
            <button type="button" class="btn btn-outline btn-sm leaderboard-lookup-clear" onclick="clearLeaderboardSearch()" ${query ? '' : 'disabled'}>清除</button>
        </div>
        ${results}
    </section>`;
}

async function applyLeaderboardSearch() {
    const input = document.getElementById('leaderboardSearchInput');
    leaderboardSearchQuery = cleanDisplayNameInput(input?.value || '');
    if (!Array.isArray(leaderboardEntriesCache)) {
        showToast('榜单数据尚未准备，请刷新榜单后查询');
        return;
    }
    await renderLeaderboardPage({ useCachedEntries: true });
}

async function clearLeaderboardSearch() {
    if (!leaderboardSearchQuery) return;
    leaderboardSearchQuery = '';
    if (Array.isArray(leaderboardEntriesCache)) await renderLeaderboardPage({ useCachedEntries: true });
}

function getLeaderboardGodSeats(scoreType, options = {}) {
    const gods = getAllGods();
    const filtered = options.path ? gods.filter(item => item.path === options.path) : gods;
    if (options.mergeGodSeats && !options.path) {
        return [{
            key: 'god-seat-cosmos',
            displayName: '寰宇至尊',
            role: 'god',
            faithGod: '命运',
            faithPath: '诸神',
            faithClass: 'path-void',
            profession: '',
            professionClass: '',
            ascensionScore: '∞',
            audienceScore: '∞',
            updatedAt: new Date(0).toISOString(),
            isCurrent: false,
            isGodSeat: true,
            isMergedGodSeat: true,
            activeTitle: {
                titleText: '第零神席',
                titleGod: '命运',
                grantedByType: 'god',
                grantedByName: '十六神明'
            },
            scoreType
        }];
    }
    return filtered.map(({ god, path, className }) => ({
        key: `god-seat-${god}`,
        displayName: god,
        role: 'god',
        faithGod: god,
        faithPath: path,
        faithClass: className,
        profession: '',
        professionClass: '',
        ascensionScore: '∞',
        audienceScore: '∞',
        updatedAt: new Date(0).toISOString(),
        isCurrent: isGodRole() && inviteSession?.name === god,
        isGodSeat: true,
        activeTitle: {
            titleText: '第零神席',
            titleGod: god,
            grantedByType: 'god',
            grantedByName: god
        },
        scoreType
    }));
}

function renderLeaderboardRows(entries, scoreType, limit = LEADERBOARD_PAGE_SIZE, options = {}) {
    const godRows = options.includeGodSeats ? getLeaderboardGodSeats(scoreType, options).slice(0, options.godLimit || 16) : [];
    const ranked = sortLeaderboardEntries(entries, scoreType).slice(0, limit);
    if (!ranked.length && !godRows.length) return renderRitualEmpty('此途暂无留存信徒档案，静待众生踏入新的愚戏。', '命运', '信徒名录暂空');
    const topScore = ranked.reduce((max, entry) => Math.max(max, getLeaderboardScore(entry, scoreType)), 1);
    const renderEntryRow = (entry, index) => {
        const role = ROLE_LABELS[entry.role] || '入局信徒';
        const faith = entry.faithGod ? `${entry.faithGod}之神 · ${entry.faithPath}命途` : '未立信仰';
        const profession = entry.profession ? `${entry.professionClass} · ${entry.profession}` : '未定职业';
        const metaHtml = entry.isMergedGodSeat
            ? '<span class="mini-tag path-void">十六神明</span><span class="metric-pill">第零神席</span>'
            : entry.isGodSeat
            ? `<span class="mini-tag ${entry.faithClass}">${escapeHtml(faith)}</span><span class="metric-pill">第零神席</span>`
            : `<span class="mini-tag ${entry.faithClass}">${escapeHtml(faith)}</span><span class="metric-pill">${escapeHtml(profession)}</span><span class="metric-pill">${escapeHtml(role)}</span>`;
        const score = getLeaderboardScore(entry, scoreType);
        const scoreText = entry.isGodSeat ? '∞' : scoreType === 'total'
            ? `${formatProfileScore(entry.ascensionScore)} / ${formatProfileScore(entry.audienceScore)}`
            : formatProfileScore(score);
        const secondaryScoreText = options.showAscensionInParentheses && !entry.isGodSeat
            ? `<em>（登神之路 ${escapeHtml(formatProfileScore(entry.ascensionScore))}）</em>`
            : '';
        const progress = entry.isGodSeat ? 100 : Math.max(4, Math.round((Math.max(0, score) / Math.max(1, topScore)) * 100));
        const skinStyle = entry.faithGod ? getGodSkinStyle(entry.faithGod) : getGodSkinStyle('命运');
        const skin = getGodSkin(entry.faithGod || '命运');
        const rankIndex = Number(options.rankOffset || 0) + index;
        const rankClass = entry.isGodSeat ? 'rank-0' : rankIndex === 0 ? 'rank-1' : rankIndex === 1 ? 'rank-2' : rankIndex === 2 ? 'rank-3' : '';
        const rankLabel = entry.isGodSeat ? '0' : String(rankIndex + 1);
        const clickAction = entry.isGodSeat ? '' : ` onclick='openProfileFromLeaderboard(${jsString(entry.key)})'`;
        return `
            <article class="leaderboard-row ${entry.isCurrent ? 'is-current' : ''} ${entry.isGodSeat ? 'god-seat' : ''}" data-god="${escapeHtml(entry.faithGod || '命运')}" data-motif="${escapeHtml(skin.motif)}" style="${skinStyle};--rank-progress:${progress}%"${clickAction}>
                <div class="leaderboard-rank ${rankClass}">${rankLabel}</div>
                <div>
                    <div class="leaderboard-name-line">
                        ${renderGodSigil(entry.faithGod || '命运', 'sm', 'leaderboard-god-mark')}
                        <div class="leaderboard-name">${escapeHtml(entry.displayName)}${entry.isCurrent ? ' · 你' : ''}</div>
                        ${entry.showTitles === false ? '' : renderProfileTitleBadge(entry.activeTitle, { fallbackGod: entry.faithGod || '命运', compact: true })}
                    </div>
                    <div class="leaderboard-meta">
                        ${metaHtml}
                    </div>
                    <div class="leaderboard-progress"><div class="leaderboard-progress-fill"></div></div>
                </div>
                <div class="leaderboard-score">
                    <strong>${escapeHtml(scoreText)}</strong>
                    ${secondaryScoreText}
                    <span>${escapeHtml(getLeaderboardScoreLabel(scoreType))}</span>
                </div>
            </article>`;
    };
    return [...godRows.map((entry, index) => renderEntryRow(entry, index)), ...ranked.map(renderEntryRow)].join('');
}

function renderLeaderboardBoard(title, entries, scoreType, options = {}) {
    const boardClass = options.full ? 'leaderboard-board full' : 'leaderboard-board';
    const subtitle = options.subtitle || `${entries.length} 位信徒`;
    const boardKey = [
        leaderboardMode,
        leaderboardPath,
        scoreType,
        options.path || 'all',
        title
    ].join('|');
    const boardKeyToken = encodeURIComponent(boardKey);
    const pageCount = Math.max(1, Math.ceil(entries.length / LEADERBOARD_PAGE_SIZE));
    const currentPage = Math.min(Math.max(1, Number(leaderboardPages[boardKey] || 1)), pageCount);
    const pageStart = (currentPage - 1) * LEADERBOARD_PAGE_SIZE;
    const pageEntries = entries.slice(pageStart, pageStart + LEADERBOARD_PAGE_SIZE);
    const boardOptions = {
        ...options,
        includeGodSeats: !!options.includeGodSeats && currentPage === 1,
        rankOffset: pageStart
    };
    const pagination = pageCount > 1
        ? `<nav class="leaderboard-pagination" aria-label="${escapeHtml(title)} 分页">
            <button type="button" class="leaderboard-page-button" data-leaderboard-page-key="${boardKeyToken}" data-leaderboard-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>上一页</button>
            <span class="leaderboard-page-status">第 ${currentPage} / ${pageCount} 页 · 本页 ${pageEntries.length} 位 / 共 ${entries.length} 位</span>
            <button type="button" class="leaderboard-page-button" data-leaderboard-page-key="${boardKeyToken}" data-leaderboard-page="${currentPage + 1}" ${currentPage === pageCount ? 'disabled' : ''}>下一页</button>
        </nav>`
        : '';
    return `
        <section class="${boardClass} ${options.path ? getPathClassByPath(options.path) : ''}">
            <div class="profile-panel-title">
                <span>${escapeHtml(title)}</span>
                <small>${escapeHtml(subtitle)}</small>
            </div>
            <div class="leaderboard-list">${renderLeaderboardRows(pageEntries, scoreType, LEADERBOARD_PAGE_SIZE, boardOptions)}</div>
            ${pagination}
        </section>`;
}

async function setLeaderboardPage(boardKey, page) {
    const normalizedKey = String(boardKey || '');
    const normalizedPage = Math.max(1, Number(page) || 1);
    if (!normalizedKey || !Array.isArray(leaderboardEntriesCache)) {
        showToast('榜单数据尚未准备，请刷新榜单后重试');
        return;
    }
    const lockKey = `leaderboard-page:${normalizedKey}`;
    if (!acquireUiActionLock(lockKey, '榜单正在翻页，请勿重复点击')) return;
    try {
        leaderboardPages[normalizedKey] = normalizedPage;
        await renderLeaderboardPage({ useCachedEntries: true });
    } catch (error) {
        console.error('榜单翻页失败', error);
        showToast(`❌ ${getFriendlyActionError(error, '榜单翻页失败')}`);
    } finally {
        releaseUiActionLock(lockKey);
    }
}

function renderLeaderboardTabs() {
    const tabs = [
        ['overall', '寰宇信徒总览'],
        ['path', '分途信仰名录'],
        ['ascension', '登神阶途榜单'],
        ['audience', '觐见观星榜单']
    ];
    return `<div class="leaderboard-tabs">${tabs.map(([mode, label]) => `<button type="button" class="leaderboard-tab ${leaderboardMode === mode ? 'active' : ''}" data-leaderboard-mode="${escapeHtml(mode)}">${escapeHtml(label)}</button>`).join('')}</div>`;
}

function renderLeaderboardPathTabs() {
    const tabs = [['all', '全部命途'], ...GOD_GROUPS.map(group => [group.path, `${getPathMetaByPath(group.path).sigil} ${group.path}`])];
    return `<div class="leaderboard-path-tabs">${tabs.map(([path, label]) => `<button type="button" class="leaderboard-tab ${leaderboardPath === path ? 'active' : ''}" data-leaderboard-path="${escapeHtml(path)}">${escapeHtml(label)}</button>`).join('')}</div>`;
}

function renderLeaderboardContent(entries) {
    const lookup = renderLeaderboardLookup(entries);
    if (leaderboardMode === 'ascension') {
        return `${lookup}<div class="leaderboard-layout">${renderLeaderboardBoard('命运骰录 · 登神阶途总榜', entries, 'ascension', { full: true, includeGodSeats: true, mergeGodSeats: true })}</div><div class="leaderboard-observer-note">第 0 位为寰宇至尊；登神之路分数越高，代表信徒踏遍试炼切片越多。</div>`;
    }
    if (leaderboardMode === 'audience') {
        return `${lookup}<div class="leaderboard-layout">${renderLeaderboardBoard('星轨观览 · 觐见之梯总榜', entries, 'audience', { full: true, includeGodSeats: true, mergeGodSeats: true })}</div><div class="leaderboard-observer-note">第 0 位为寰宇至尊；觐见之梯源自信徒对试炼的评判证言。</div>`;
    }
    if (leaderboardMode === 'path') {
        const pathTabs = renderLeaderboardPathTabs();
        if (leaderboardPath !== 'all') {
            const pathEntries = entries.filter(entry => entry.faithPath === leaderboardPath);
            return `${lookup}${pathTabs}<div class="leaderboard-layout">${renderLeaderboardBoard(`${leaderboardPath}命途 · 信徒独立录`, pathEntries, 'audience', { full: true, subtitle: `${pathEntries.length} 位信徒 · 第 0 位为神席`, path: leaderboardPath, showAscensionInParentheses: true, includeGodSeats: true })}</div>`;
        }
        const boards = GOD_GROUPS.map(group => {
            const pathEntries = entries.filter(entry => entry.faithPath === group.path);
            const gods = group.gods.map(god => `${god}`).join('、');
            return renderLeaderboardBoard(`${group.path}命途 · ${gods}信徒录`, pathEntries, 'audience', { subtitle: `${pathEntries.length} 位信徒 · 第 0 位为神席`, path: group.path, showAscensionInParentheses: true, includeGodSeats: true });
        }).join('');
        return `${lookup}${pathTabs}<div class="leaderboard-layout">${boards}</div>`;
    }
    return `
        ${lookup}
        <div class="leaderboard-layout">
            ${renderLeaderboardBoard('命运骰录 · 登神阶途总榜', entries, 'ascension', { includeGodSeats: true, mergeGodSeats: true })}
            ${renderLeaderboardBoard('星轨观览 · 觐见之梯总榜', entries, 'audience', { includeGodSeats: true, mergeGodSeats: true })}
        </div>`;
}

async function renderLeaderboardPage(options = {}) {
    const container = document.getElementById('leaderboardContent');
    if (!container) return;
    container.innerHTML = '<div class="loading"><div class="spinner"></div><br>正在整理登神与觐见名录...</div>';
    const leaderboardResult = options.useCachedEntries && Array.isArray(leaderboardEntriesCache)
        ? { entries: leaderboardEntriesCache, source: leaderboardEntriesSource, error: leaderboardEntriesError }
        : await fetchLeaderboardEntries();
    const { entries, source, error } = leaderboardResult;
    leaderboardEntriesCache = entries;
    leaderboardEntriesSource = source;
    leaderboardEntriesError = error || null;
    const currentEntry = entries.find(entry => entry.isCurrent);
    const heroGod = currentEntry?.faithGod || '命运';
    const heroSkin = getGodSkin(heroGod);
    const heroStyle = getGodSkinStyle(heroGod);
    const currentFaithLabel = currentEntry?.faithGod ? `${currentEntry.faithGod}之神` : '未立信仰';
    const currentSummary = currentEntry
        ? `<span class="mini-tag ${currentEntry.faithClass}">${escapeHtml(currentFaithLabel)}</span><span class="metric-pill">你：<strong>${escapeHtml(currentEntry.displayName)}</strong></span><span class="metric-pill">${escapeHtml(ROLE_LABELS[currentEntry.role] || '入局信徒')}</span>`
        : '<span class="metric-pill">尚未保存个人档案</span>';
    const sourceText = source === 'cloud' ? '云端榜单' : '本地记录';
    const sourceHint = error?.message ? ` · ${error.message}` : '';
    container.innerHTML = `
        <section class="profile-hero leaderboard-hero" data-god="${escapeHtml(heroGod)}" data-motif="${escapeHtml(heroSkin.motif)}" style="${heroStyle}">
            <div class="profile-avatar path-void" style="${heroStyle}">${renderGodSigil(heroGod, 'lg')}</div>
            <div class="profile-hero-copy">
                <div class="profile-kicker">ASCENSION LEDGER</div>
                <h1 class="profile-name">登神觐见录</h1>
                <div class="profile-subline">
                    ${currentSummary}
                </div>
                <div class="profile-faith-prayer">寰宇信徒登神之路，诸神观览万民命途。${escapeHtml(source === 'cloud' ? '此为云端全域观览册。' : '当前读取本地记录。')}</div>
            </div>
            <div class="leaderboard-mini-stats">
                <div class="leaderboard-mini-card"><span>登神之路分</span><strong>${currentEntry ? formatProfileScore(currentEntry.ascensionScore) : '—'}</strong></div>
                <div class="leaderboard-mini-card"><span>觐见之梯分</span><strong>${currentEntry ? formatProfileScore(currentEntry.audienceScore) : '—'}</strong></div>
                <div class="leaderboard-mini-card"><span>${escapeHtml(sourceText)}</span><strong>${entries.length}</strong></div>
            </div>
        </section>
        <section class="profile-panel">
            ${renderLeaderboardTabs()}
            <div class="leaderboard-summary">本录收录已保存的个人档案；信徒更新自身信仰记录后，名录将同步刷新。${source === 'cloud' ? '当前为云端全域观览册。' : `当前为本地榜单，运行 Supabase 档案表并更新 Edge Function 后会切换为全站榜。${escapeHtml(sourceHint)}`}</div>
            ${renderLeaderboardFaithDistribution(entries)}
            ${renderLeaderboardContent(entries)}
            <div class="leaderboard-observer-note">登神阶途观测记事：${escapeHtml(VOID_CHRONICLES[entries.length % VOID_CHRONICLES.length])}</div>
        </section>`;
}

async function setLeaderboardMode(mode) {
    leaderboardMode = ['overall', 'path', 'ascension', 'audience'].includes(mode) ? mode : 'overall';
    if (leaderboardMode !== 'path') leaderboardPath = 'all';
    leaderboardPages = {};
    await renderLeaderboardPage();
}

async function setLeaderboardPath(path) {
    const allowed = ['all', ...GOD_GROUPS.map(group => group.path)];
    leaderboardPath = allowed.includes(path) ? path : 'all';
    leaderboardPages = {};
    await renderLeaderboardPage();
}

async function openLeaderboardPage() {
    setMobileNavActive('leaderboard');
    leaderboardScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const detailOverlay = document.getElementById('detailOverlay');
    if (detailOverlay) detailOverlay.style.display = 'none';
    const profilePage = document.getElementById('profilePage');
    if (profilePage) profilePage.style.display = 'none';
    const scorePage = document.getElementById('scorePage');
    if (scorePage) scorePage.style.display = 'none';
    const matchPage = document.getElementById('matchPage');
    if (matchPage) matchPage.style.display = 'none';
    const adminPage = document.getElementById('adminPage');
    if (adminPage) adminPage.style.display = 'none';
    document.body.classList.remove('detail-view-open', 'profile-view-open', 'score-view-open', 'match-view-open');
    document.body.classList.add('leaderboard-view-open');
    document.getElementById('leaderboardPage').style.display = 'block';
    window.scrollTo(0, 0);
    await renderLeaderboardPage();
}

function closeLeaderboardPage(restoreScroll = true) {
    const page = document.getElementById('leaderboardPage');
    if (page) page.style.display = 'none';
    document.body.classList.remove('leaderboard-view-open');
    setMobileNavActive('dungeons');
    if (restoreScroll !== false) requestAnimationFrame(() => window.scrollTo(0, leaderboardScrollY || 0));
}

function closePublicProfileModal(e) {
    const overlay = document.getElementById('publicProfileModalOverlay');
    if (!overlay) return;
    if (e && e.target !== overlay) return;
    overlay.style.display = 'none';
    document.body.style.overflow = '';
}

function buildLocalPublicProfilePreview(key) {
    const storedProfile = getStoredProfiles()[key];
    if (!storedProfile) return { data: null, error: { message: '这份本地档案已经不存在。' } };
    const profile = { ...getProfileDefaults(), ...storedProfile };
    const displayName = cleanDisplayNameInput(profile.displayName || '') || '未命名信徒';
    const nameKey = displayName.trim().toLowerCase();
    const dungeons = getLocalData('dungeons', []);
    const authoredDungeons = (dungeons || [])
        .filter(d => nameKey && ([d.invite_name, d.creator].some(value => String(value || '').trim().toLowerCase() === nameKey) || isCoCreatorName(d, nameKey)))
        .slice(0, 12);
    const authoredCommentCount = authoredDungeons.reduce((sum, d) => sum + Number(d.comment_count || 0), 0);
    const avgAuthoredRating = authoredDungeons.length
        ? authoredDungeons.reduce((sum, d) => sum + Number(d.avg_rating || 0), 0) / authoredDungeons.length
        : 0;
    return {
        data: {
            profileKey: key,
            profile: {
                display_name: displayName,
                role: profile.role,
                faith_god: profile.faithGod,
                faith_path: profile.faithPath,
                profession: profile.profession,
                ascension_score: profile.ascensionScore,
                audience_score: profile.audienceScore,
                items: profile.items,
                talents: profile.talents,
                active_title: normalizeProfileTitle(profile.activeTitle),
                active_titles: normalizeProfileTitleList(profile.activeTitles, profile.activeTitle),
                show_titles: profile.showTitles !== false,
                active_curse: normalizeProfileCurse(profile.activeCurse),
                active_curses: normalizeProfileCurseList(profile.activeCurses, profile.activeCurse),
                updated_at: profile.updatedAt,
                is_current: key === getProfileKey()
            },
            clearRecords: [],
            authoredDungeons,
            stats: {
                clearRecordCount: 0,
                uniqueClearDungeonCount: 0,
                authoredCount: authoredDungeons.length,
                authoredCommentCount,
                avgAuthoredRating
            }
        },
        error: null
    };
}

async function fetchPublicProfilePreview(key) {
    if (USE_LOCAL_FALLBACK || !inviteSession?.code) return buildLocalPublicProfilePreview(key);
    if (!/^[a-f0-9]{64}$/i.test(String(key || ''))) {
        return { data: null, error: { message: '这条榜单记录缺少公开档案标识，请刷新榜单后重试。' } };
    }
    const { data, error } = await invokeDungeonAction('getPublicProfile', { profileKey: key });
    return { data, error };
}

function normalizePublicProfilePayload(payload) {
    const profile = mapCloudProfileToLocal(payload?.profile) || getProfileDefaults();
    return {
        profileKey: payload?.profileKey || payload?.profile_key || payload?.profile?.profile_key || '',
        profile,
        isCurrent: !!(payload?.profile?.is_current || payload?.is_current),
        clearRecords: Array.isArray(payload?.clearRecords) ? payload.clearRecords : [],
        authoredDungeons: Array.isArray(payload?.authoredDungeons) ? payload.authoredDungeons : [],
        stats: payload?.stats || {}
    };
}

function renderPublicProfileClearRecords(records, faithGod = '命运') {
    if (!records.length) return renderRitualEmpty(`${getGodOracle(faithGod)} 尚未公开通关履迹。`, faithGod, '公开履迹暂空');
    return records.slice(0, 12).map(record => {
        const d = record.dungeon || {};
        const targetId = record.dungeon_id || d.id || '';
        const title = d.name || '未知试炼';
        const god = d.type ? `${formatGodName(d.type)} · ${formatGodPath(d.type)}命途` : '未归档神明';
        const note = record.feedback_note ? `反馈：${record.feedback_note}` : '已登记通过。';
        const tags = Array.isArray(record.feedback_tags) && record.feedback_tags.length ? ` · ${record.feedback_tags.join(' / ')}` : '';
        const clickAttr = targetId ? ` onclick='openDetailFromPublicProfile(${jsString(targetId)})'` : '';
        return `
            <article class="profile-list-item${targetId ? ' clickable' : ''}"${clickAttr}>
                <div class="profile-list-title">
                    <span>《${escapeHtml(title)}》</span>
                    <small>${escapeHtml(formatDate(record.created_at))}</small>
                </div>
                <div class="profile-list-meta">试炼轮回：第 ${Number(record.run_number || 1)} 周目 · ${escapeHtml(god)}</div>
                <div class="profile-list-meta">${escapeHtml(note)}${escapeHtml(tags)}</div>
            </article>`;
    }).join('');
}

function renderPublicProfileAuthoredDungeons(authored, faithGod = '命运') {
    if (!authored.length) return renderRitualEmpty(`${getGodOracle(faithGod)} 尚未留下公开构筑记录。`, faithGod, '构筑记录暂空');
    return authored.slice(0, 12).map(d => {
        const clickAttr = d.id ? ` onclick='openDetailFromPublicProfile(${jsString(d.id)})'` : '';
        return `
            <article class="profile-list-item${d.id ? ' clickable' : ''}"${clickAttr}>
                <div class="profile-list-title">
                    <span>《${escapeHtml(d.name || '未命名试炼')}》</span>
                    <small>神格 ${Number(d.avg_rating || 0).toFixed(1)}</small>
                </div>
                <div class="profile-list-meta">${escapeHtml(formatGodName(d.type))} · ${escapeHtml(formatGodPath(d.type))}命途 · ${escapeHtml(formatDifficulty(d.difficulty))}</div>
                <div class="profile-list-meta">证言 ${Number(d.comment_count || 0)} · 通关留存率 ${formatClearRate(d)} · ${formatDate(d.created_at)}</div>
            </article>`;
    }).join('');
}

function renderPublicProfileDossier(payload) {
    const data = normalizePublicProfilePayload(payload);
    const profile = data.profile;
    const faith = getProfileDisplayFaith(profile);
    const faithGod = getProfileFaithGod(profile) || faith.god || '命运';
    const faithSkin = getGodSkin(faithGod);
    const faithStyle = getGodSkinStyle(faithGod);
    const faithClass = faith.className || getPathClassByPath(faith.path || '虚无');
    const profession = getProfessionInfo(profile.profession);
    const roleLabel = ROLE_LABELS[normalizeRole(profile.role) || 'player'] || '入局信徒';
    const displayName = cleanDisplayNameInput(profile.displayName || '') || '未命名信徒';
    const clearRecords = data.clearRecords;
    const authored = data.authoredDungeons;
    const uniqueCleared = Number(data.stats.uniqueClearDungeonCount ?? new Set(clearRecords.map(record => String(record.dungeon_id || record.dungeon?.id || ''))).size);
    const clearCount = Number(data.stats.clearRecordCount ?? clearRecords.length);
    const authoredCount = Number(data.stats.authoredCount ?? authored.length);
    const authoredCommentCount = Number(data.stats.authoredCommentCount ?? authored.reduce((sum, d) => sum + Number(d.comment_count || 0), 0));
    const avgAuthoredRating = Number(data.stats.avgAuthoredRating ?? (authored.length ? authored.reduce((sum, d) => sum + Number(d.avg_rating || 0), 0) / authored.length : 0));
    const faithProgress = Math.min(100, Math.max(6, Math.round(uniqueCleared * 12 + authoredCount * 8 + Number(profile.audienceScore || 0))));
    return `
        <section class="profile-hero" data-god="${escapeHtml(faithGod)}" data-motif="${escapeHtml(faithSkin.motif)}" style="${faithStyle}">
            <div class="profile-avatar ${faithClass}" style="${faithStyle}">${renderGodSigil(faithGod, 'lg')}</div>
            <div class="profile-hero-copy">
                <div class="profile-kicker">PUBLIC PILGRIM DOSSIER</div>
                ${renderProfileNameWithTitle(displayName, profile.activeTitle, { fallbackGod: faithGod, titles: profile.activeTitles, showTitles: profile.showTitles })}
                <div class="profile-subline">
                    <span class="mini-tag ${faithClass}">${escapeHtml(faith.label)}</span>
                    <span class="mini-tag ${faithClass}">${escapeHtml(faith.path)}命途</span>
                    <span class="metric-pill">${escapeHtml(roleLabel)}</span>
                    <span class="metric-pill">职业 <strong>${escapeHtml(profile.profession || '未填写')}</strong></span>
                    ${profession.known ? `<span class="metric-pill">${escapeHtml(profession.god)}之神 <strong>${escapeHtml(profession.className)}</strong></span>` : ''}
                </div>
                <div class="profile-faith-prayer">${escapeHtml(getGodPrayer(faithGod))} · ${escapeHtml(faithSkin.pattern)}</div>
            </div>
            <div class="profile-hero-stats">
                <div class="profile-hero-score"><span>登神之路</span><strong>${formatProfileScore(profile.ascensionScore)}</strong></div>
                <div class="profile-hero-score"><span>觐见之梯</span><strong>${formatProfileScore(profile.audienceScore)}</strong></div>
            </div>
            <div class="faith-progress-card">
                <div class="faith-progress-label"><span>公开履历</span><strong>${escapeHtml(faithSkin.motif)} · ${faithProgress}%</strong></div>
                <div class="faith-progress-track"><div class="faith-progress-fill" style="--faith-progress:${faithProgress}%"></div></div>
            </div>
        </section>
        <div class="public-profile-grid">
            <div>
                <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${faithStyle}">
                    <div class="profile-panel-title">
                        <span>公开数值</span>
                        <small>${escapeHtml(formatDate(profile.updatedAt))} 更新</small>
                    </div>
                    <div class="profile-score-row">
                        <div class="profile-score-card"><span>登神之路</span><strong>${formatProfileScore(profile.ascensionScore)}</strong></div>
                        <div class="profile-score-card"><span>觐见之梯</span><strong>${formatProfileScore(profile.audienceScore)}</strong></div>
                    </div>
                    <div class="metric-strip">
                        <span class="metric-pill">通关副本 <strong>${uniqueCleared}</strong></span>
                        <span class="metric-pill">通关记录 <strong>${clearCount}</strong></span>
                        <span class="metric-pill">构筑试炼 <strong>${authoredCount}</strong></span>
                    </div>
                    <div class="public-profile-note">公开档案只展示榜单字段、履迹摘要和构筑摘要；入局谕令、内部结算明细和邀请码哈希不会公开。</div>
                </section>
                <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${faithStyle}">
                    <div class="profile-panel-title">
                        <span>试炼履迹录</span>
                        <small>${uniqueCleared} 个副本 / ${clearCount} 条记录</small>
                    </div>
                    <div class="profile-list">${renderPublicProfileClearRecords(clearRecords, faithGod)}</div>
                </section>
            </div>
            <div>
                ${renderProfileFaithObservatory(clearRecords, authored, faithGod, profile)}
                <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${faithStyle}">
                    <div class="profile-panel-title">
                        <span>构筑者记录</span>
                        <small>神格均值 ${authoredCount ? avgAuthoredRating.toFixed(1) : '—'}</small>
                    </div>
                    <div class="metric-strip">
                        <span class="metric-pill">构筑试炼 <strong>${authoredCount}</strong></span>
                        <span class="metric-pill">证言总数 <strong>${authoredCommentCount}</strong></span>
                    </div>
                    <div class="profile-list" style="margin-top:14px;">${renderPublicProfileAuthoredDungeons(authored, faithGod)}</div>
                </section>
                <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${faithStyle}">
                    <div class="profile-panel-title"><span>公开携带</span><small>道具 / 天赋</small></div>
                    ${renderProfileChips(profile.items, getGodEmptyText(faithGod, 'items', '未公开个人道具。'), faithGod)}
                    <div style="height:12px;"></div>
                    ${renderProfileChips(profile.talents, getGodEmptyText(faithGod, 'talents', '未公开个人天赋。'), faithGod)}
                </section>
            </div>
        </div>`;
}

async function openProfileFromLeaderboard(key) {
    if (key === getProfileKey() && inviteSession) {
        closeLeaderboardPage(false);
        await openProfilePage();
        return;
    }
    if (!inviteSession?.code && !USE_LOCAL_FALLBACK) {
        openInviteModal('先验入局谕令后可查看榜单公开档案。');
        return;
    }
    const overlay = document.getElementById('publicProfileModalOverlay');
    const content = document.getElementById('publicProfileModalContent');
    if (!overlay || !content) return;
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    content.innerHTML = '<div class="loading"><div class="spinner"></div><br>正在读取公开档案...</div>';
    overlay.scrollTop = 0;
    content.scrollTop = 0;
    const { data, error } = await fetchPublicProfilePreview(key);
    if (error || !data) {
        content.innerHTML = renderRitualEmpty(error?.message || '公开档案暂不可读。', '命运', '档案读取失败');
        return;
    }
    content.innerHTML = renderPublicProfileDossier(data);
    content.scrollTop = 0;
}

async function openDetailFromPublicProfile(id) {
    closePublicProfileModal();
    closeLeaderboardPage(false);
    await openDetail(id);
}

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
    const sortedEntries = sortLeaderboardEntries(entries, scoreType);
    const pageEntries = sortedEntries.slice(pageStart, pageStart + LEADERBOARD_PAGE_SIZE);
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

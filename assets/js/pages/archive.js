async function renderDungeonList() {
    const listEl = document.getElementById('dungeonList');
    listEl.innerHTML = `<div class="loading"><div class="spinner"></div><br>正在从切片宇宙中加载祈愿试炼...<br><span>${escapeHtml(getLoadingOracle())}</span></div>`;
    let dungeons = [];
    let archiveSidebar = null;
    let usingPagedArchive = false;
    let totalDungeons = 0;
    let pageCount = 1;
    let pageStart = 0;
    try {
        usingPagedArchive = canUsePagedArchive();
        if (usingPagedArchive) {
            const pageData = await fetchDungeonArchivePage(archivePage);
            dungeons = Array.isArray(pageData?.dungeons) ? pageData.dungeons : [];
            archiveSidebar = pageData?.sidebar || null;
            totalDungeons = Math.max(0, Number(pageData?.total || 0));
            pageCount = Math.max(1, Number(pageData?.total_pages || Math.ceil(totalDungeons / ARCHIVE_PAGE_SIZE) || 1));
            archivePage = Math.min(Math.max(1, Number(pageData?.page || archivePage)), pageCount);
            // A stale or partially failed page response must not make a populated archive look empty.
            // Fall back once to the compact full-list endpoint, then continue with normal client paging.
            if (totalDungeons === 0 && !dungeons.length) {
                const fallbackDungeons = await fetchDungeons({ force: true });
                if (fallbackDungeons.length) {
                    console.warn('分页归档返回空结果，已使用完整归档兜底。');
                    usingPagedArchive = false;
                    dungeons = fallbackDungeons;
                    archiveSidebar = null;
                    archivePageMeta = null;
                }
            }
            if (usingPagedArchive) {
                if (totalDungeons > 0 && !dungeons.length) {
                    archivePage = pageCount;
                    archivePageMeta = null;
                    return renderDungeonList();
                }
                pageStart = (archivePage - 1) * ARCHIVE_PAGE_SIZE;
                archivePageMeta = { total: totalDungeons, pageCount, pageSize: ARCHIVE_PAGE_SIZE, sidebar: archiveSidebar };
            }
        } else {
            dungeons = await fetchDungeons();
            archivePageMeta = null;
        }
    } catch (error) {
        console.error('加载试炼失败:', error);
        updateDiscoveryFilterStatus(0, 0);
        listEl.innerHTML = `
            <div class="empty-state ritual-empty-state" data-motif="ARCHIVE ERROR">
                <div class="empty-state-sigil">⚠</div>
                <div class="empty-state-title">祈愿试炼加载失败</div>
                <p class="empty-state-note">神谕名录暂时无法读取。请刷新页面，或稍后再观测当前试炼切片。</p>
            </div>`;
        return;
    }
    if (!usingPagedArchive) totalDungeons = dungeons.length;
    if (!usingPagedArchive && searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        dungeons = dungeons.filter(d => [
            d.name,
            d.creator,
            getCoCreators(d).join(' '),
            d.type,
            d.description,
            formatGodName(d.type),
            formatGodPath(d.type),
            formatDifficulty(d.difficulty)
        ].some(value => String(value || '').toLowerCase().includes(q)));
    }
    if (!usingPagedArchive && selectedPath !== 'all') dungeons = dungeons.filter(d => dungeonHasPath(d.type, selectedPath));
    if (!usingPagedArchive && selectedGod !== 'all') dungeons = dungeons.filter(d => dungeonHasGod(d.type, selectedGod));
    if (!usingPagedArchive && selectedDifficulty !== 'all') dungeons = dungeons.filter(d => normalizeDifficulty(d.difficulty) === selectedDifficulty);
    if (!usingPagedArchive && reviewFilter === 'pending') dungeons = dungeons.filter(d => getDungeonReviewStatus(d) === 'pending');
    if (!usingPagedArchive && currentSort === 'popular') dungeons.sort((a,b) =>
        (b.rating_count||0) - (a.rating_count||0) ||
        (b.avg_rating||0) - (a.avg_rating||0) ||
        (b.comment_count||0) - (a.comment_count||0) ||
        new Date(b.created_at) - new Date(a.created_at)
    );
    else if (!usingPagedArchive && currentSort === 'rating') dungeons.sort((a,b) => (b.avg_rating||0)-(a.avg_rating||0));
    else if (!usingPagedArchive && currentSort === 'newest') dungeons.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    else if (!usingPagedArchive && currentSort === 'comments') dungeons.sort((a,b) => (b.comment_count||0)-(a.comment_count||0));
    updateDiscoveryFilterStatus(totalDungeons, dungeons.length);
    archiveFilteredDungeons = [...dungeons];
    if (!dungeons.length) {
        archivePage = 1;
        const filtered = searchQuery || selectedGod !== 'all' || selectedPath !== 'all' || selectedDifficulty !== 'all' || reviewFilter !== 'all';
        listEl.innerHTML = renderArchiveEmptyState(!!filtered);
        await renderOracleSidebar([], archiveSidebar);
        return;
    }
    if (!usingPagedArchive) {
        pageCount = Math.max(1, Math.ceil(dungeons.length / ARCHIVE_PAGE_SIZE));
        archivePage = Math.min(Math.max(1, archivePage), pageCount);
        pageStart = (archivePage - 1) * ARCHIVE_PAGE_SIZE;
    }
    const visibleDungeons = usingPagedArchive ? dungeons : dungeons.slice(pageStart, pageStart + ARCHIVE_PAGE_SIZE);
    listEl.innerHTML = visibleDungeons.map((d,i) => {
        const godLabel = formatGodName(d.type);
        const godPath = formatGodPath(d.type);
        const godClass = getGodClass(d.type);
        const pathMeta = getPathMetaByGod(d.type);
        const skin = getGodSkin(d.type);
        const godStyle = getGodSkinStyle(d.type);
        const difficultyLabel = formatDifficulty(d.difficulty);
        const divineClass = isDivineTrial(d) ? 'divine-trial' : '';
        const score = Number(d.avg_rating || 0);
        const ratingValue = score ? score.toFixed(1) : '—';
        const testimonyCount = Number(d.comment_count || 0);
        const godSigil = renderGodSigil(d.type, 'lg', 'god-emblem');
        const trialIndex = pageStart + i + 1;
        return `
        <div class="dungeon-card ${godClass} ${divineClass}" data-dungeon-id="${escapeHtml(d.id)}" data-god="${escapeHtml(getGodInfo(d.type).god)}" data-motif="${escapeHtml(skin.motif)}" data-particle="${escapeHtml(skin.particle)}" style="${godStyle}" onclick='openDetail(${jsString(d.id)})'>
            <div class="trial-card-head">
                <div class="trial-title-block">
                    ${godSigil}
                    <div>
                        <div class="card-title-line">
                            <span class="card-title">${escapeHtml(d.name||'未命名试炼')}</span>
                            <span class="trial-number">试炼编号 #${trialIndex}</span>
                        </div>
                        <div class="trial-subline">${escapeHtml(godPath)}命途 · ${escapeHtml(godLabel)}</div>
                    </div>
                </div>
                <div class="judgement-badge" aria-label="神格判定">
                    <span class="judgement-score">🎲 神格判定：${ratingValue}</span>
                    <span class="judgement-tier">${escapeHtml(getRatingTier(score))}</span>
                    <span class="judgement-count">评议人次 (${Number(d.rating_count || 0)})</span>
                </div>
            </div>
            <div class="trial-identity-row">
                <span class="author-mark ${isVeteranArchitect(d) ? 'master' : ''}">${getArchitectLabel(d)}${escapeHtml(formatCreatorLine(d))}</span>
                <span class="tag god-tag lore-tag ${godClass}" data-prayer="${escapeHtml(getGodPrayer(d.type))}">${escapeHtml(godLabel)}</span>
                <span class="tag path-tag lore-tag ${godClass}" data-prayer="${escapeHtml(pathMeta.edict)}">${escapeHtml(godPath)}命途</span>
                <span class="tag danger-stamp ${getDiffClass(d.difficulty)} ${godClass}-difficulty">${escapeHtml(difficultyLabel)}</span>
                <span class="tag lore-tag ${isOneShotDungeon(d) ? 'divine-tag' : ''}">${escapeHtml(formatTrialArchive(d))}</span>
                ${isDungeonApproved(d) ? '' : `<span class="tag divine-tag">${escapeHtml(formatDungeonReviewStatus(d))}</span>`}
                ${isDivineTrial(d) ? '<span class="tag divine-tag">神级愚戏</span>' : ''}
                <span class="trial-data-pill">🎲 ${formatDate(d.created_at)}降下</span>
            </div>
            <div class="trial-data-row">
                <span class="trial-data-pill">同契人数：<strong>${formatContractSize(d)}</strong></span>
                <span class="trial-data-pill">试炼轮回：<strong>${escapeHtml(getTrialCycle(d))}</strong></span>
                <span class="trial-data-pill">归档：<strong>${escapeHtml(formatTrialArchive(d))}</strong></span>
                <span class="trial-data-pill">通关留存率：<strong>${formatClearRate(d)}</strong></span>
                <span class="trial-data-pill">证言条数：<strong>${testimonyCount}</strong></span>
            </div>
            ${renderTrialOracle(d, godClass)}
        </div>`;
    }).join('') + renderArchivePagination(usingPagedArchive ? totalDungeons : dungeons.length, archivePage, pageCount);
    await renderOracleSidebar(dungeons, archiveSidebar);
    if (archiveFocusId) {
        const pendingFocusId = archiveFocusId;
        archiveFocusId = null;
        requestAnimationFrame(() => {
            markLinkedOracle(pendingFocusId);
            highlightArchiveCard(pendingFocusId);
        });
    }
}

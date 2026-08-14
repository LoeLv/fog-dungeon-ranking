// Archive page helpers for empty states, pagination, focus, and oracle sidebars.

function renderArchiveEmptyState(filtered) {
    const title = filtered ? '未检索到对应试炼' : '暂无新构筑的愚戏试炼';
    const note = filtered ? '暂无匹配试炼。' : '暂无试炼。';
    const actions = filtered
        ? '<button type="button" class="btn btn-outline btn-sm" onclick="clearDiscoveryFilters()">清空筛选</button>'
        : '<button type="button" class="btn btn-outline btn-sm" onclick="retryArchiveRead()">重新观测试炼</button><button type="button" class="btn btn-outline btn-sm" onclick="openLeaderboardPage()">先看登神觐见录</button>';
    return `
        <div class="empty-state ritual-empty-state" data-motif="FOLLY ARCHIVE">
            <div class="empty-state-sigil">🎭</div>
            <div class="empty-state-title">${escapeHtml(title)}</div>
            <p class="empty-state-note">${escapeHtml(note)}</p>
            <div class="empty-state-actions">${actions}</div>
        </div>`;
}

async function retryArchiveRead() {
    invalidateDungeonListCache();
    archivePage = 1;
    await renderDungeonList();
}

function renderArchivePagination(totalCount, page, pageCount) {
    if (totalCount <= ARCHIVE_PAGE_SIZE) return '';
    const start = (page - 1) * ARCHIVE_PAGE_SIZE + 1;
    const end = Math.min(totalCount, page * ARCHIVE_PAGE_SIZE);
    const radius = 1;
    const pageNumbers = [];
    for (let i = 1; i <= pageCount; i++) {
        if (i === 1 || i === pageCount || Math.abs(i - page) <= radius) pageNumbers.push(i);
    }
    const uniquePages = [...new Set(pageNumbers)].sort((a, b) => a - b);
    const buttons = [];
    let last = 0;
    uniquePages.forEach(num => {
        if (last && num - last > 1) buttons.push('<span class="archive-pagination-info">…</span>');
        buttons.push(`<button type="button" class="archive-page-btn ${num === page ? 'active' : ''}" onclick="goArchivePage(${num})" ${num === page ? 'aria-current="page"' : ''}>${num}</button>`);
        last = num;
    });
    return `
        <nav class="archive-pagination" aria-label="试炼分页">
            <div class="archive-pagination-info">当前显示 <strong>${start}-${end}</strong> / ${totalCount} 个试炼 · 第 ${page} / ${pageCount} 页</div>
            <div class="archive-pagination-actions">
                <button type="button" class="archive-page-btn" onclick="goArchivePage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>上一页</button>
                ${buttons.join('')}
                <button type="button" class="archive-page-btn" onclick="goArchivePage(${page + 1})" ${page >= pageCount ? 'disabled' : ''}>下一页</button>
            </div>
        </nav>`;
}

function goArchivePage(page) {
    const pageCount = Math.max(1, Number(archivePageMeta?.pageCount) || Math.ceil(archiveFilteredDungeons.length / ARCHIVE_PAGE_SIZE));
    const nextPage = Math.min(Math.max(1, Number(page) || 1), pageCount);
    if (nextPage === archivePage) return;
    archivePage = nextPage;
    renderDungeonList().then(() => {
        document.getElementById('dungeonList')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

function markLinkedOracle(id) {
    document.querySelectorAll('.oracle-item.is-linked').forEach(item => item.classList.remove('is-linked'));
    const linked = Array.from(document.querySelectorAll('.oracle-item[data-dungeon-id]'))
        .find(item => item.dataset.dungeonId === String(id));
    if (linked) linked.classList.add('is-linked');
}

function highlightArchiveCard(id) {
    document.querySelectorAll('.dungeon-card.is-oracle-focused').forEach(card => card.classList.remove('is-oracle-focused'));
    const card = Array.from(document.querySelectorAll('.dungeon-card[data-dungeon-id]'))
        .find(item => item.dataset.dungeonId === String(id));
    if (!card) return false;
    card.classList.add('is-oracle-focused');
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => card.classList.remove('is-oracle-focused'), 2600);
    return true;
}

async function focusArchiveTrial(id) {
    archiveFocusId = String(id);
    const index = archiveFilteredDungeons.findIndex(item => String(item.id) === String(id));
    if (index >= 0) {
        const targetPage = archivePageMeta ? archivePage : Math.floor(index / ARCHIVE_PAGE_SIZE) + 1;
        if (targetPage !== archivePage) {
            archivePage = targetPage;
            await renderDungeonList();
        }
    }
    markLinkedOracle(id);
    if (!highlightArchiveCard(id)) {
        await openDetail(id);
    }
}

function renderGodQuickIndex(godCounts = {}) {
    const index = document.getElementById('godQuickIndex');
    if (!index) return;
    index.innerHTML = getAllGods().map(({ god, path }) => {
        const active = selectedGod === god;
        const count = Number(godCounts[god] || 0);
        const label = `${god}之神 · ${path}命途｜${getGodPrayer(god)}`;
        return `<button type="button" class="god-quick-btn ${active ? 'active' : ''}" style="${getGodSkinStyle(god)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}" onclick='setGodFilter(${jsString(god)})'>${renderGodSigil(god, 'xs')}<span>${escapeHtml(god)}</span><small>${count}</small></button>`;
    }).join('');
}

function renderVoidChronicle(dungeons, index) {
    const chronicle = document.getElementById('voidChronicle');
    if (!chronicle) return;
    const filterNode = getFilterAtmosphereNode();
    const node = filterNode || getActiveAtmosphereNode();
    const era = node.path;
    syncEdgeAtmosphere();
    const library = ERA_CHRONICLE_LIBRARY[era] || ERA_CHRONICLE_LIBRARY['虚无'];
    const entry = library[index % library.length];
    const modeLabel = filterNode ? '筛选高亮' : '自动轮转';
    chronicle.classList.remove('is-rotating');
    chronicle.innerHTML = `
        <strong>${renderGodSigil(node.god, 'xs')} ${escapeHtml(node.god)}之神 · ${escapeHtml(entry.lead)}</strong>
        <span>${escapeHtml(entry.note)} ${modeLabel}：${escapeHtml(era)}命途 / ${escapeHtml(getGodPrayer(node.god))}。</span>`;
    requestAnimationFrame(() => chronicle.classList.add('is-rotating'));
}

function startVoidChronicleRotation(dungeons) {
    chronicleRotationDungeons = [...(dungeons || [])];
    if (chronicleRotationTimer) {
        clearInterval(chronicleRotationTimer);
        chronicleRotationTimer = null;
    }
    const node = getFilterAtmosphereNode() || getActiveAtmosphereNode();
    syncEdgeAtmosphere();
    const era = node.path;
    const library = ERA_CHRONICLE_LIBRARY[era] || ERA_CHRONICLE_LIBRARY['虚无'];
    chronicleRotationIndex = chronicleRotationDungeons.length
        ? chronicleRotationDungeons.length % library.length
        : new Date().getMinutes() % library.length;
    renderVoidChronicle(chronicleRotationDungeons, chronicleRotationIndex);
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || library.length < 2) return;
    chronicleRotationTimer = window.setInterval(() => {
        atmosphereCycleIndex = (atmosphereCycleIndex + 1) % ATMOSPHERE_CYCLE.length;
        const activeNode = getActiveAtmosphereNode();
        syncEdgeAtmosphere();
        const displayNode = getFilterAtmosphereNode() || activeNode;
        const activeLibrary = ERA_CHRONICLE_LIBRARY[displayNode.path] || ERA_CHRONICLE_LIBRARY['虚无'];
        chronicleRotationIndex = (chronicleRotationIndex + 1) % activeLibrary.length;
        renderVoidChronicle(chronicleRotationDungeons, chronicleRotationIndex);
    }, 15000);
}

function renderEraSidebar(dungeons = [], sidebar = null) {
    const eraPanel = document.getElementById('eraScrollPanel');
    const faithPanel = document.getElementById('faithFlowPanel');
    const hasServerSummary = !!sidebar && typeof sidebar === 'object';
    const pathCounts = hasServerSummary ? (sidebar.path_counts || {}) : countDungeonsByPath(dungeons, dungeon => dungeon.type);
    const godCounts = hasServerSummary ? (sidebar.god_counts || {}) : (() => {
        const counts = {};
        (dungeons || []).forEach(dungeon => {
            getDungeonGodInfos(dungeon.type).forEach(info => {
                const god = info.god;
                counts[god] = (counts[god] || 0) + 1;
            });
        });
        return counts;
    })();
    if (eraPanel) {
        const blocks = ERA_TIMELINE.map(era => {
            const group = GOD_GROUPS.find(item => item.path === era.path) || { gods: [], className: getPathClassByPath(era.path) };
            const active = selectedPath === era.path && selectedGod === 'all';
            const godButtons = group.gods.map(god => {
                const activeGod = selectedGod === god;
                return `<button type="button" class="era-god-btn ${activeGod ? 'active' : ''}" style="${getGodSkinStyle(god)}" onclick='setGodFilter(${jsString(god)})'>${renderGodSigil(god, 'xs')} ${escapeHtml(god)}<span>${Number(godCounts[god] || 0)}</span></button>`;
            }).join('');
            return `
                <article class="era-block ${group.className} ${active ? 'active' : ''}" data-era="${escapeHtml(era.path)}" data-rift="${escapeHtml(era.rift)}">
                    <button type="button" class="era-block-head" onclick='setPathFilter(${jsString(era.path)})'>
                        <span class="era-block-head-copy"><strong>${renderGodSigil(group.gods[0] || '命运', 'xs')} ${escapeHtml(era.order)} · ${escapeHtml(era.title)}</strong><span>${escapeHtml(era.prophecy)}</span></span>
                        <span class="era-count">${Number(pathCounts[era.path] || 0)}</span>
                    </button>
                    <div class="era-god-row">${godButtons}</div>
                </article>`;
        }).join('');
        eraPanel.innerHTML = `
            <div class="era-scroll-head">
                <div class="era-scroll-title">寰宇纪元更迭卷轴</div>
                <div class="era-scroll-note"></div>
            </div>
            <div class="era-list">${blocks}</div>`;
    }
    if (faithPanel) {
        const pathTotal = Object.values(pathCounts).reduce((sum, value) => sum + Number(value || 0), 0);
        faithPanel.innerHTML = renderFaithFlowBars(pathCounts, pathTotal);
    }
    renderGodQuickIndex(godCounts);
    startVoidChronicleRotation(dungeons);
}

async function renderOracleSidebar(dungeons = [], sidebar = null) {
    renderEraSidebar(dungeons, sidebar);
    const supreme = document.getElementById('supremeTrialList');
    const testimony = document.getElementById('testimonyLedger');
    const architects = document.getElementById('architectLedger');
    const supremeMeta = document.getElementById('supremePanelMeta');
    const testimonyMeta = document.getElementById('testimonyPanelMeta');
    const architectMeta = document.getElementById('architectPanelMeta');
    if (supreme) {
        const top = Array.isArray(sidebar?.top_trials) ? sidebar.top_trials : [...dungeons]
            .sort((a,b) => (Number(b.avg_rating || 0) - Number(a.avg_rating || 0)) || (Number(b.rating_count || 0) - Number(a.rating_count || 0)))
            .slice(0, 6);
        if (supremeMeta) supremeMeta.textContent = top.length ? `${top.length} 条` : '待降';
        supreme.innerHTML = top.length ? top.map((d, index) => `
            <div class="oracle-item" data-dungeon-id="${escapeHtml(d.id)}" data-god="${escapeHtml(getGodInfo(d.type).god)}" onclick='focusArchiveTrial(${jsString(d.id)})'>
                <div class="oracle-item-main oracle-item-main-ranked">
                    <span class="oracle-rank">${String(index + 1).padStart(2, '0')}</span>
                    ${renderGodSigil(d.type, 'xs')}
                    <strong>${escapeHtml(d.name || '未命名试炼')}</strong>
                </div>
                <span class="oracle-item-meta">${escapeHtml(getRatingTier(d.avg_rating))} · 神格判定 ${Number(d.avg_rating || 0).toFixed(1)} · ${escapeHtml(formatGodName(d.type))} · 通关 ${formatClearRate(d)}</span>
            </div>`).join('') : '<div class="oracle-item"><span>暂无诸神注目的试炼。</span></div>';
    }
    if (testimony) {
        const latest = await fetchLatestComments(6);
        if (testimonyMeta) testimonyMeta.textContent = latest.length ? `${latest.length} 条` : '空席';
        testimony.innerHTML = latest.length ? latest.map(item => `
            <div class="oracle-item" data-dungeon-id="${escapeHtml(item.dungeon_id)}" data-god="${escapeHtml(getGodInfo(item.dungeon?.type || '命运').god)}" style="${getGodSkinStyle(item.dungeon?.type || '命运')}" onclick='focusArchiveTrial(${jsString(item.dungeon_id)})'>
                <div class="oracle-item-main">
                    ${renderGodSigil(item.dungeon?.type || '命运', 'xs')}
                    <strong>${escapeHtml(item.author || '匿名信徒')}</strong>
                    ${renderCommentHonorBadges(item)}
                    <span class="oracle-item-time">${escapeHtml(formatDate(item.created_at))}</span>
                </div>
                <span class="oracle-item-meta">${escapeHtml(truncateText(item.content, 46))}</span>
            </div>`).join('') : '<div class="oracle-item"><span>暂无可采信证言。</span></div>';
    }
    if (architects) {
        const seen = new Set();
        const newest = Array.isArray(sidebar?.architects) ? sidebar.architects : [...dungeons]
            .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
            .filter(d => {
                const name = d.creator || '匿名';
                if (seen.has(name)) return false;
                seen.add(name);
                return true;
            })
            .slice(0, 6);
        if (architectMeta) architectMeta.textContent = newest.length ? `${newest.length} 位` : '空席';
        architects.innerHTML = newest.length ? newest.map(d => `
            <div class="oracle-item" data-dungeon-id="${escapeHtml(d.id)}" data-god="${escapeHtml(getGodInfo(d.type).god)}" style="${getGodSkinStyle(d.type)}" onclick='focusArchiveTrial(${jsString(d.id)})'>
                <div class="oracle-item-main">
                    ${renderGodSigil(d.type, 'xs')}
                    <strong>${escapeHtml(formatCreatorLine(d) || '匿名筑戏人')}</strong>
                    <span class="oracle-item-time">${escapeHtml(formatDate(d.created_at))}</span>
                </div>
                <span class="oracle-item-meta">献祭《${escapeHtml(d.name || '未命名试炼')}》</span>
            </div>`).join('') : '<div class="oracle-item"><span>等待新的构筑者献祭试炼。</span></div>';
    }
}

function getDiffClass(d) { const m={新手:'difficulty-newbie',低:'difficulty-low',中:'difficulty-medium',高:'difficulty-high'}; return m[normalizeDifficulty(d)]||'difficulty-medium'; }

function isDivineTrial(d) {
    return Number(d.avg_rating || 0) >= 4.8 && Number(d.rating_count || 0) >= 1;
}

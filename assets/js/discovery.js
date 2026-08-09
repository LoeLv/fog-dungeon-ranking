function renderGodFilters() {
    const listEl = document.getElementById('godFilterList');
    if (!listEl) return;
    const allButton = `<div class="god-cluster"><div class="god-cluster-title"><strong>全神廳</strong><small>不限命途，查看所有祈願試煉。</small></div><div class="god-cluster-buttons"><button class="god-button path-all ${selectedGod === 'all' && selectedPath === 'all' ? 'active' : ''}" onclick="setGodFilter('all')">全神廳</button></div></div>`;
    const groupHtml = GOD_GROUPS.map(group => `
        <div class="god-cluster ${group.className}">
            <div class="god-cluster-title">
                <strong>${escapeHtml(getPathMetaByPath(group.path).sigil)} ${escapeHtml(group.path)}命途</strong>
                <small>箴言：${escapeHtml(getPathMetaByPath(group.path).edict)}</small>
            </div>
            <div class="god-cluster-buttons">
                ${group.gods.map(god => `<button class="god-button ${group.className} ${selectedGod === god ? 'active' : ''}" onclick="setGodFilter('${escapeHtml(god)}')">${renderGodSigil(god, 'sm')} ${escapeHtml(god)}之神</button>`).join('')}
            </div>
        </div>
    `).join('');
    listEl.innerHTML = allButton + groupHtml;
}

function renderPathNav() {
    const nav = document.getElementById('pathNav');
    if (!nav) return;
    nav.innerHTML = GOD_GROUPS.map(group => {
        const meta = getPathMetaByPath(group.path);
        const active = selectedPath === group.path && selectedGod === 'all';
        const leadGod = group.gods[0] || '命运';
        return `<button class="path-nav-btn ${group.className} ${active ? 'active' : ''}" title="${escapeHtml(group.path)}纪元｜${escapeHtml(group.gods.join(' / '))}" onclick="setPathFilter('${escapeHtml(group.path)}')">
            ${renderGodSigil(leadGod, 'xs', 'path-nav-sigil')} <span>${escapeHtml(group.path)}</span>
            <span class="path-nav-prayer">${escapeHtml(group.gods.join(' / '))} 路 ${escapeHtml(meta.edict)}</span>
        </button>`;
    }).join('');
}

function renderDifficultyFilters() {
    const listEl = document.getElementById('difficultyFilterList');
    if (!listEl) return;
    listEl.innerHTML = `<button class="difficulty-filter-btn ${selectedDifficulty === 'all' ? 'active' : ''}" onclick="setDifficultyFilter('all')">全部难度</button>` +
        DIFFICULTY_OPTIONS.map(item => `<button class="difficulty-filter-btn ${selectedDifficulty === item.value ? 'active' : ''}" onclick="setDifficultyFilter('${item.value}')">${item.label}</button>`).join('');
    updateFilterSummary();
}

function updateFilterSummary() {
    const summary = document.getElementById('filterSummaryText');
    if (!summary) return;
    const godText = selectedGod !== 'all' ? `${selectedGod}之神` : (selectedPath !== 'all' ? `${selectedPath}命途` : '全神廳');
    const difficultyText = selectedDifficulty === 'all' ? '全部难度' : formatDifficulty(selectedDifficulty);
    const reviewText = reviewFilter === 'pending' ? '待审核' : '全部发布';
    summary.textContent = canReviewDungeonsUI() ? `${godText} 路 ${difficultyText} 路 ${reviewText}` : `${godText} 路 ${difficultyText}`;
}

function toggleAdvancedFilters(force) {
    const panel = document.getElementById('advancedFilters');
    const button = document.getElementById('filterToggleBtn');
    if (!panel || !button) return;
    const shouldOpen = typeof force === 'boolean' ? force : panel.hasAttribute('hidden');
    if (shouldOpen) {
        panel.removeAttribute('hidden');
        button.setAttribute('aria-expanded', 'true');
    } else {
        panel.setAttribute('hidden', '');
        button.setAttribute('aria-expanded', 'false');
    }
    document.body.classList.toggle('mobile-filter-open', shouldOpen);
}

function toggleForumFeed(force) {
    const panel = document.getElementById('forumFeed');
    const feed = document.getElementById('latestCommentsFeed');
    const button = document.getElementById('forumFeedToggle');
    if (!panel || !feed || !button) return;
    const shouldOpen = typeof force === 'boolean' ? force : panel.classList.contains('is-collapsed');
    panel.classList.toggle('is-collapsed', !shouldOpen);
    feed.hidden = !shouldOpen;
    button.setAttribute('aria-expanded', String(shouldOpen));
    button.textContent = shouldOpen ? '收起' : '展开';
}

function applyVisualEffectsPreference() {
    document.body.classList.toggle('visual-effects-muted', !visualEffectsEnabled);
    const button = document.getElementById('visualEffectsToggle');
    const label = document.getElementById('visualEffectsText');
    if (button) button.setAttribute('aria-pressed', String(visualEffectsEnabled));
    if (label) label.textContent = visualEffectsEnabled ? '开启' : '静默';
}

function toggleVisualEffects() {
    visualEffectsEnabled = !visualEffectsEnabled;
    setLocalData(VISUAL_EFFECTS_STORAGE_KEY, visualEffectsEnabled);
    applyVisualEffectsPreference();
    showToast(visualEffectsEnabled ? '视觉粒子已开启' : '视觉粒子已静默');
}

function getActiveAtmosphereEra() {
    return getActiveAtmosphereNode().path;
}

function getActiveAtmosphereNode() {
    const index = ((atmosphereCycleIndex % ATMOSPHERE_CYCLE.length) + ATMOSPHERE_CYCLE.length) % ATMOSPHERE_CYCLE.length;
    return ATMOSPHERE_CYCLE[index] || { path: '虚无', god: '欺诈' };
}

function getFilterAtmosphereNode() {
    if (selectedGod !== 'all') {
        const info = getGodInfo(selectedGod);
        if (info.known) return { path: info.path, god: selectedGod };
    }
    if (selectedPath !== 'all') {
        const group = GOD_GROUPS.find(item => item.path === selectedPath);
        if (group) return { path: group.path, god: group.gods?.[0] || '欺诈' };
    }
    return null;
}

function syncEdgeAtmosphere() {
    updateEdgeAtmosphere(getFilterAtmosphereNode() || getActiveAtmosphereNode());
}

function renderEdgeAtmosphereSignals() {
    const eraLabel = document.getElementById('edgeEraLabel');
    const godLabel = document.getElementById('edgeGodLabel');
    const band = document.getElementById('edgeChronologyBand');
    const meta = PATH_META[currentAtmosphereEra] || PATH_META['虚无'];
    const prayer = getGodPrayer(currentAtmosphereGod);
    const sigil = renderGodSigil(currentAtmosphereGod, 'sm', 'edge-god-sigil');
    const modeLabel = getFilterAtmosphereNode() ? '筛选牵引' : '自动轮转';
    if (eraLabel) {
        eraLabel.classList.remove('is-switching');
        eraLabel.innerHTML = `
            <small>${escapeHtml(modeLabel)} 路 ERA</small>
            <strong>${escapeHtml(meta.sigil)} ${escapeHtml(currentAtmosphereEra)}纪元</strong>
            <span>${escapeHtml(meta.edict)}</span>`;
        requestAnimationFrame(() => eraLabel.classList.add('is-switching'));
    }
    if (godLabel) {
        godLabel.classList.remove('is-switching');
        godLabel.innerHTML = `
            ${sigil}
            <small>ACTIVE GOD</small>
            <strong>${escapeHtml(currentAtmosphereGod)}之神</strong>
            <span>${escapeHtml(prayer)}</span>`;
        requestAnimationFrame(() => godLabel.classList.add('is-switching'));
    }
    if (band) {
        band.innerHTML = ERA_TIMELINE.map((era, index) => `
            <span class="edge-era-tick ${era.path === currentAtmosphereEra ? 'is-active' : ''}" title="${escapeHtml(era.title)}">
                ${index + 1} ${escapeHtml(era.path)}
            </span>`).join('');
    }
}

function updateEdgeAtmosphere(node = getActiveAtmosphereNode()) {
    currentAtmosphereEra = ERA_CHRONICLE_LIBRARY[node.path] ? node.path : '虚无';
    currentAtmosphereGod = getGodInfo(node.god).known ? node.god : (GOD_GROUPS.find(group => group.path === currentAtmosphereEra)?.gods?.[0] || '欺诈');
    const layer = document.getElementById('edgeAtmosphere');
    if (layer) layer.dataset.era = currentAtmosphereEra;
    const title = document.getElementById('chronicleEraName');
    if (title) title.textContent = `${currentAtmosphereEra}·${currentAtmosphereGod}`;
    renderEdgeAtmosphereSignals();
}

function resetDiscoveryFiltersToEmpty() {
    searchQuery = '';
    selectedGod = 'all';
    selectedPath = 'all';
    selectedDifficulty = 'all';
    reviewFilter = 'all';
    archivePage = 1;
    const input = document.getElementById('searchInput');
    if (input) input.value = '';
    updateReviewFilterButton();
}

function populateGodSelect() {
    const select = document.getElementById('dungeonType');
    if (!select) return;
    select.innerHTML = GOD_GROUPS.map(group => `<optgroup label="${escapeHtml(group.path)}命途">${group.gods.map(god => `<option value="${escapeHtml(god)}">${escapeHtml(getGodIcon(god))} ${escapeHtml(group.path)} 路 ${escapeHtml(god)}之神</option>`).join('')}</optgroup>`).join('');
    Array.from(select.options).forEach(option => { option.selected = false; });
    renderSubmitGodPicker();
}

function renderSubmitGodPicker() {
    const panel = document.getElementById('dungeonGodPicker');
    if (!panel) return;
    panel.innerHTML = GOD_GROUPS.map(group => `
        <div class="god-pick-row ${group.className}">
            <div class="god-pick-path">${escapeHtml(group.path)}</div>
            <div class="god-pick-buttons">
                ${group.gods.map(god => `<button type="button" class="god-pick-btn" data-submit-god="${escapeHtml(god)}" style="${getGodSkinStyle(god)}" onclick='toggleSubmitGod(${jsString(god)})'>${renderGodSigil(god, 'xs')}<span>${escapeHtml(god)}</span></button>`).join('')}
            </div>
        </div>
    `).join('');
    syncSubmitGodPicker();
}

function getSelectedSubmitGods() {
    const select = document.getElementById('dungeonType');
    return select ? Array.from(select.selectedOptions).map(option => option.value).filter(Boolean) : [];
}

function setSelectedSubmitGods(gods = []) {
    const select = document.getElementById('dungeonType');
    if (!select) return;
    const selected = new Set((Array.isArray(gods) ? gods : splitGodTags(gods)).map(cleanGodName).filter(Boolean));
    Array.from(select.options).forEach(option => { option.selected = selected.has(cleanGodName(option.value)); });
    syncSubmitGodPicker();
}

function syncSubmitGodPicker() {
    const selected = new Set(getSelectedSubmitGods());
    document.querySelectorAll('[data-submit-god]').forEach(button => {
        const god = button.getAttribute('data-submit-god') || '';
        button.classList.toggle('active', selected.has(god));
        button.setAttribute('aria-pressed', selected.has(god) ? 'true' : 'false');
    });
    const summary = document.getElementById('dungeonGodSummary');
    if (summary) {
        const gods = [...selected];
        summary.innerHTML = gods.length
            ? `已选<strong>${gods.map(escapeHtml).join('、')}</strong>`
            : '未选择神明标签';
    }
}

function toggleSubmitGod(god) {
    const select = document.getElementById('dungeonType');
    if (!select) return;
    const option = Array.from(select.options).find(item => item.value === god);
    if (!option) return;
    option.selected = !option.selected;
    syncSubmitGodPicker();
}

function setGodFilter(god) {
    selectedGod = god;
    selectedPath = 'all';
    archivePage = 1;
    renderGodFilters();
    renderPathNav();
    updateFilterSummary();
    syncEdgeAtmosphere();
    renderDungeonList();
}

function setPathFilter(path) {
    selectedPath = selectedPath === path ? 'all' : path;
    selectedGod = 'all';
    archivePage = 1;
    renderPathNav();
    renderGodFilters();
    updateFilterSummary();
    syncEdgeAtmosphere();
    renderDungeonList();
}

function setDifficultyFilter(difficulty) {
    selectedDifficulty = difficulty;
    archivePage = 1;
    renderDifficultyFilters();
    updateFilterSummary();
    renderDungeonList();
}

function hasActiveDiscoveryFilters() {
    return Boolean(searchQuery.trim()) ||
        selectedGod !== 'all' ||
        selectedPath !== 'all' ||
        selectedDifficulty !== 'all' ||
        reviewFilter !== 'all';
}

function updateDiscoveryFilterStatus(totalCount, visibleCount) {
    const box = document.getElementById('filterStatus');
    const text = document.getElementById('filterStatusText');
    if (!box || !text) return;
    if (!hasActiveDiscoveryFilters()) {
        box.hidden = true;
        return;
    }
    const parts = [];
    if (searchQuery.trim()) parts.push(`搜索：${searchQuery.trim()}`);
    if (selectedGod !== 'all') parts.push(`${selectedGod}之神`);
    if (selectedPath !== 'all') parts.push(`${selectedPath}命途`);
    if (selectedDifficulty !== 'all') parts.push(`${formatDifficulty(selectedDifficulty)}难度`);
    if (reviewFilter === 'pending') parts.push('待审核');
    text.innerHTML = `当前只显示<strong>${visibleCount}</strong> / ${totalCount} 个试炼，条件：${escapeHtml(parts.join(' · '))}`;
    box.hidden = false;
}

function clearDiscoveryFilters() {
    resetDiscoveryFiltersToEmpty();
    renderPathNav();
    renderGodFilters();
    renderDifficultyFilters();
    updateFilterSummary();
    syncEdgeAtmosphere();
    renderDungeonList();
    showToast('已显示全部试炼');
}

function toggleReviewFilter() {
    if (!canReviewDungeonsUI()) return;
    reviewFilter = reviewFilter === 'pending' ? 'all' : 'pending';
    archivePage = 1;
    updateReviewFilterButton();
    updateFilterSummary();
    renderDungeonList();
}

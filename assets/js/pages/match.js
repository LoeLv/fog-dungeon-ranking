function getMatchTargetCount(dungeon) {
    const count = Number(dungeon?.participant_count ?? dungeon?.participantCount ?? dungeon?.target_player_count ?? dungeon?.targetPlayerCount);
    return Number.isFinite(count) && count > 0 ? count : 1;
}

function getCurrentMatchName() {
    return cleanDisplayNameInput(inviteSession?.name || ROLE_LABELS[getInviteRole()] || '本地入局者') || '本地入局者';
}

function isCurrentMatchPlayer(name) {
    const current = getCurrentMatchName().trim().toLowerCase();
    return current && String(name || '').trim().toLowerCase() === current;
}

async function fetchMatchDungeons(limit = 80) {
    if (USE_LOCAL_FALLBACK) {
        const localQueue = getLocalData('match_queue_v1', {});
        const dungeons = await fetchDungeons();
        return {
            dungeons: dungeons.map(dungeon => ({
                ...dungeon,
                queuedCount: (localQueue[dungeon.id] || []).length,
                runningRoomCount: 0
            })),
            error: null
        };
    }
    if (!canInteract()) return { dungeons: [], error: { message: '需要入局谕令后才能查看试炼召集。' } };
    const { data, error } = await invokeDungeonAction('listMatchDungeons', { limit });
    return { dungeons: Array.isArray(data) ? data : [], error };
}

async function fetchMatchState(dungeonId) {
    if (USE_LOCAL_FALLBACK) {
        const dungeons = await fetchDungeons();
        const dungeon = dungeons.find(item => String(item.id) === String(dungeonId));
        const localQueue = getLocalData('match_queue_v1', {});
        return {
            state: dungeon ? {
                dungeon,
                queue: localQueue[dungeonId] || [],
                queuedCount: (localQueue[dungeonId] || []).length,
                rooms: []
            } : null,
            error: dungeon ? null : { message: '试炼未找到' }
        };
    }
    const { data, error } = await invokeDungeonAction('getMatchState', { dungeonId });
    return { state: data || null, error };
}

function renderMatchDungeonCards(dungeons) {
    if (!dungeons.length) return '<div class="profile-empty">暂无可召集的试炼。</div>';
    return `<div class="match-list">${dungeons.map(dungeon => {
        const active = String(dungeon.id) === String(selectedMatchDungeonId);
        const queued = Number(dungeon.queuedCount || 0);
        const rooms = Number(dungeon.runningRoomCount || 0);
        const target = getMatchTargetCount(dungeon);
        return `
            <article class="match-card ${active ? 'active' : ''}" onclick='openMatchDungeon(${jsString(dungeon.id)})'>
                <div class="match-card-head">
                    <div>
                        <div class="match-card-title">${renderGodSigil(dungeon.type, 'xs')} ${escapeHtml(dungeon.name || '未命名试炼')}</div>
                        <div class="match-card-meta">${escapeHtml(formatGodName(dungeon.type))} · ${escapeHtml(formatDifficulty(dungeon.difficulty))} · ${escapeHtml(formatCreatorLine(dungeon) || '匿名构筑者')}</div>
                    </div>
                    <button class="btn btn-outline btn-xs match-card-button" onclick='event.stopPropagation(); openMatchDungeon(${jsString(dungeon.id)})'>查看召集</button>
                </div>
                <div class="metric-strip">
                    <span class="metric-pill">队列 <strong>${queued}/${target}</strong></span>
                    <span class="metric-pill">房间 <strong>${rooms}</strong></span>
                    <span class="metric-pill">轮回 <strong>${escapeHtml(getTrialCycle(dungeon))}</strong></span>
                </div>
            </article>`;
    }).join('')}</div>`;
}

function renderMatchQueue(queue) {
    if (!queue.length) return '<div class="profile-empty">当前无人排队。成为第一个召集者吧。</div>';
    return `<div class="match-player-list">${queue.map((player, index) => `
        <div class="match-player-row ${isCurrentMatchPlayer(player.player_name) ? 'profile-notice' : ''}">
            <strong>${index + 1}. ${escapeHtml(player.player_name || '未命名信徒')}</strong>
            <span class="match-player-note">${escapeHtml(formatDate(player.created_at))}${isCurrentMatchPlayer(player.player_name) ? ' · 你' : ''}</span>
        </div>`).join('')}</div>`;
}

function renderMatchRooms(rooms) {
    if (!rooms.length) return '<div class="profile-empty">暂无已成房队伍；队列满员后会自动生成房间。</div>';
    return `<div class="match-room-list">${rooms.map((room, index) => {
        const players = room.match_room_players || room.players || [];
        return `
            <article class="match-room-card">
                <div class="match-room-head">
                    <strong>房间 ${index + 1} · ${escapeHtml(String(room.id || '').slice(0, 8))}</strong>
                    <span class="match-player-note">${players.length}/${Number(room.target_player_count || 0) || players.length} 人 · ${escapeHtml(formatDate(room.created_at))}</span>
                </div>
                <div class="match-player-list">
                    ${players.map(player => `
                        <div class="match-player-row ${isCurrentMatchPlayer(player.player_name) ? 'profile-notice' : ''}">
                            <strong>${escapeHtml(player.player_name || '未命名信徒')}</strong>
                            <span class="match-player-note">${player.finish_status ? '已完成' : '进行中'}${isCurrentMatchPlayer(player.player_name) ? ' · 你' : ''}</span>
                        </div>`).join('') || '<div class="profile-empty">房间成员读取中。</div>'}
                </div>
            </article>`;
    }).join('')}</div>`;
}

function renderMatchStatePanel(state, error) {
    if (error) return `<div class="profile-empty">${escapeHtml(error.message || '试炼召集暂不可用。')}</div>`;
    const dungeon = state?.dungeon || matchDungeonsCache.find(item => String(item.id) === String(selectedMatchDungeonId));
    if (!dungeon) return '<div class="profile-empty">从左侧选择一个试炼，查看当前召集状态。</div>';
    const queue = Array.isArray(state?.queue) ? state.queue : [];
    const rooms = Array.isArray(state?.rooms) ? state.rooms : [];
    const target = getMatchTargetCount(dungeon);
    const queuedCount = Number(state?.queuedCount ?? queue.length ?? 0);
    const currentQueued = queue.some(player => isCurrentMatchPlayer(player.player_name));
    const currentInRoom = rooms.some(room => (room.match_room_players || room.players || []).some(player => isCurrentMatchPlayer(player.player_name)));
    const godClass = getGodClass(dungeon.type);
    return `
        <section class="profile-panel">
            <div class="profile-panel-title">
                <span>${renderGodSigil(dungeon.type, 'sm')} ${escapeHtml(dungeon.name || '未命名试炼')}</span>
                <small>${escapeHtml(formatGodName(dungeon.type))} · ${escapeHtml(formatDifficulty(dungeon.difficulty))}</small>
            </div>
            <div class="leaderboard-summary">召集按副本固定人数自动成房；已成房成员会留在房间记录里，方便后续网页或小程序继续接入。</div>
            <div class="match-state-grid">
                <div class="match-state-tile"><span>排队人数</span><strong>${queuedCount}/${target}</strong></div>
                <div class="match-state-tile"><span>运行房间</span><strong>${rooms.length}</strong></div>
                <div class="match-state-tile"><span>我的状态</span><strong>${currentInRoom ? '已成房' : currentQueued ? '排队中' : '未加入'}</strong></div>
            </div>
            <div class="match-inline-actions">
                ${currentInRoom ? '<span class="metric-pill">你已在运行房间中</span>' : `<button class="btn btn-primary btn-sm" onclick='joinMatchQueueUI(${jsString(dungeon.id)})'>${currentQueued ? '更新排队' : '加入排队'}</button>`}
                ${currentQueued ? `<button class="btn btn-outline btn-sm" onclick='cancelMatchQueueUI(${jsString(dungeon.id)})'>取消排队</button>` : ''}
                <button class="btn btn-outline btn-sm" onclick='refreshMatchStateUI(${jsString(dungeon.id)})'>刷新状态</button>
                <button class="btn btn-outline btn-sm" onclick='openDetailFromMatch(${jsString(dungeon.id)})'>查看详情</button>
            </div>
        </section>
        <div class="profile-grid" style="margin-top:18px;">
            <section class="profile-panel">
                <div class="profile-panel-title"><span>当前队列</span><small>${queuedCount}/${target}</small></div>
                ${renderMatchQueue(queue)}
            </section>
            <section class="profile-panel">
                <div class="profile-panel-title"><span>运行房间</span><small>${rooms.length} 间</small></div>
                ${renderMatchRooms(rooms)}
            </section>
        </div>
        <div class="trial-oracle ${godClass}" style="${getGodSkinStyle(dungeon.type)};margin-top:18px;">${escapeHtml(getGodOracle(dungeon.type))}</div>`;
}

async function renderMatchPage() {
    const container = document.getElementById('matchContent');
    if (!container) return;
    if (!USE_LOCAL_FALLBACK && !canInteract()) {
        container.innerHTML = `
            <section class="profile-panel">
                <div class="profile-empty">需要入局谕令后才能进入试炼召集。</div>
                <div class="profile-tools"><button class="btn btn-primary btn-sm" onclick="openInviteModal('验入局谕令后可进入试炼召集。')">掷骰入局</button></div>
            </section>`;
        return;
    }
    container.innerHTML = '<div class="loading"><div class="spinner"></div><br>正在监听试炼召集...</div>';
    const { dungeons, error } = await fetchMatchDungeons(80);
    matchDungeonsCache = dungeons;
    if (error) {
        container.innerHTML = `<div class="profile-empty">${escapeHtml(error.message || '试炼召集读取失败。')}</div>`;
        return;
    }
    if (!selectedMatchDungeonId || !dungeons.some(dungeon => String(dungeon.id) === String(selectedMatchDungeonId))) {
        selectedMatchDungeonId = dungeons[0]?.id || null;
    }
    matchStateCache = null;
    matchStateError = null;
    if (selectedMatchDungeonId) {
        const stateResult = await fetchMatchState(selectedMatchDungeonId);
        matchStateCache = stateResult.state;
        matchStateError = stateResult.error;
    }
    container.innerHTML = `
        <section class="profile-hero">
            <div class="profile-avatar path-void">${renderGodSigil('命运', 'lg')}</div>
            <div>
                <div class="profile-kicker">TRIAL MUSTER</div>
                <h1 class="profile-name">试炼召集厅</h1>
                <div class="profile-subline">
                    <span class="metric-pill">当前身份 <strong>${escapeHtml(inviteSession?.name || ROLE_LABELS[getInviteRole()] || '本地入局者')}</strong></span>
                    <span class="metric-pill">可召集试炼 <strong>${dungeons.length}</strong></span>
                    <span class="metric-pill">自动成房 <strong>满员触发</strong></span>
                </div>
            </div>
        </section>
        <div class="match-layout">
            <section class="profile-panel">
                <div class="profile-panel-title"><span>可召集试炼</span><small>选择副本查看队列</small></div>
                ${renderMatchDungeonCards(dungeons)}
            </section>
            <div>
                ${renderMatchStatePanel(matchStateCache, matchStateError)}
            </div>
        </div>`;
}

async function openMatchDungeon(dungeonId) {
    selectedMatchDungeonId = String(dungeonId || '');
    await renderMatchPage();
}

async function openMatchPage(initialDungeonId = null) {
    if (!USE_LOCAL_FALLBACK && !canInteract()) {
        openInviteModal('验入局谕令后可进入试炼召集。');
        return;
    }
    if (initialDungeonId) selectedMatchDungeonId = String(initialDungeonId);
    matchScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const detailOverlay = document.getElementById('detailOverlay');
    if (detailOverlay) detailOverlay.style.display = 'none';
    const profilePage = document.getElementById('profilePage');
    if (profilePage) profilePage.style.display = 'none';
    const leaderboardPage = document.getElementById('leaderboardPage');
    if (leaderboardPage) leaderboardPage.style.display = 'none';
    const scorePage = document.getElementById('scorePage');
    if (scorePage) scorePage.style.display = 'none';
    const adminPage = document.getElementById('adminPage');
    if (adminPage) adminPage.style.display = 'none';
    document.body.classList.remove('detail-view-open', 'profile-view-open', 'leaderboard-view-open', 'score-view-open');
    document.body.classList.add('match-view-open');
    document.getElementById('matchPage').style.display = 'block';
    window.scrollTo(0, 0);
    await renderMatchPage();
}

function closeMatchPage(restoreScroll = true) {
    const page = document.getElementById('matchPage');
    if (page) page.style.display = 'none';
    document.body.classList.remove('match-view-open');
    if (restoreScroll !== false) requestAnimationFrame(() => window.scrollTo(0, matchScrollY || 0));
}

async function openDetailFromMatch(id) {
    closeMatchPage(false);
    await openDetail(id);
}

async function refreshMatchStateUI(dungeonId = selectedMatchDungeonId) {
    if (!dungeonId) return;
    const { state, error } = await fetchMatchState(dungeonId);
    matchStateCache = state;
    matchStateError = error;
    if (error) showToast(`❌ ${error.message || '刷新失败'}`);
    await renderMatchPage();
}

async function joinMatchQueueUI(dungeonId) {
    if (!requireInvite(['player', 'author', 'reviewer', 'admin'], '验入局谕令后可加入试炼召集。')) return;
    if (USE_LOCAL_FALLBACK) {
        const queueByDungeon = getLocalData('match_queue_v1', {});
        const list = (queueByDungeon[dungeonId] || []).filter(player => !isCurrentMatchPlayer(player.player_name));
        list.push({ player_name: getCurrentMatchName(), created_at: new Date().toISOString() });
        queueByDungeon[dungeonId] = list;
        setLocalData('match_queue_v1', queueByDungeon);
        showToast('已加入本地试炼召集');
        await renderMatchPage();
        return;
    }
    const { data, error } = await invokeDungeonAction('joinMatchQueue', { dungeonId });
    if (error) { showToast(`❌ ${error.message || '加入失败'}`); return; }
    matchStateCache = data?.state || null;
    matchStateError = null;
    const status = data?.result?.status;
    showToast(status === 'matched' || status === 'already_matched' ? '试炼召集已成房' : '已加入试炼召集队列');
    await renderMatchPage();
}

async function cancelMatchQueueUI(dungeonId) {
    if (!requireInvite(['player', 'author', 'reviewer', 'admin'], '验入局谕令后可取消试炼召集。')) return;
    if (USE_LOCAL_FALLBACK) {
        const queueByDungeon = getLocalData('match_queue_v1', {});
        queueByDungeon[dungeonId] = (queueByDungeon[dungeonId] || []).filter(player => !isCurrentMatchPlayer(player.player_name));
        setLocalData('match_queue_v1', queueByDungeon);
        showToast('已取消本地排队');
        await renderMatchPage();
        return;
    }
    const { data, error } = await invokeDungeonAction('cancelMatchQueue', { dungeonId });
    if (error) { showToast(`❌ ${error.message || '取消失败'}`); return; }
    matchStateCache = data?.state || null;
    matchStateError = null;
    showToast(data?.result?.cancelled ? '已取消试炼召集排队' : '当前没有排队记录');
    await renderMatchPage();
}

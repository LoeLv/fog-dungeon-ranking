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
    if (selectedBattleRoomId) {
        const battleResult = await fetchBattleRoomState({ battleRoomId: selectedBattleRoomId });
        battleRoomStateCache = battleResult.state;
        battleRoomError = battleResult.error;
        if (battleResult.error) selectedBattleRoomId = null;
    } else {
        battleRoomStateCache = null;
        battleRoomError = null;
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
    selectedBattleRoomId = null;
    battleRoomStateCache = null;
    battleRoomError = null;
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

async function openBattleRoomFromMatch(matchRoomId) {
    if (!requireInvite(['player', 'author', 'reviewer', 'admin'], '验入局谕令后可进入战斗房间。')) return;
    if (USE_LOCAL_FALLBACK) { showToast('本地模式暂不保存战斗房间'); return; }
    const { data, error } = await invokeDungeonAction('createBattleRoomFromMatchRoom', { matchRoomId });
    if (error) { showToast(`❌ ${error.message || '战斗房间开启失败'}`); return; }
    selectedBattleRoomId = data?.room?.id || null;
    battleRoomStateCache = data || null;
    battleRoomError = null;
    showToast('已进入战斗房间');
    await renderMatchPage();
}

async function refreshBattleRoomUI(battleRoomId = selectedBattleRoomId) {
    if (!battleRoomId) return;
    const { state, error } = await fetchBattleRoomState({ battleRoomId });
    battleRoomStateCache = state;
    battleRoomError = error;
    if (error) showToast(`❌ ${error.message || '战斗房间刷新失败'}`);
    await renderMatchPage();
}

async function updateBattleRoomRoundUI(battleRoomId = selectedBattleRoomId) {
    if (!battleRoomId) return;
    const currentRound = Number(document.getElementById('battleRoundInput')?.value || 1);
    const note = document.getElementById('battleRoomNoteInput')?.value || '';
    const { data, error } = await invokeDungeonAction('updateBattleRoomRound', { battleRoomId, currentRound, note });
    if (error) { showToast(`❌ ${error.message || '回合保存失败'}`); return; }
    selectedBattleRoomId = data?.room?.id || battleRoomId;
    battleRoomStateCache = data || null;
    battleRoomError = null;
    showToast('战斗回合已保存');
    await renderMatchPage();
}

async function applyBattlePlayerActionUI(battleRoomId, playerId, actionType) {
    if (!battleRoomId || !playerId) return;
    const amount = Number(document.getElementById(`battleAmount-${playerId}`)?.value || 0);
    const note = document.getElementById(`battleNote-${playerId}`)?.value || '';
    const { data, error } = await invokeDungeonAction('applyBattlePlayerAction', { battleRoomId, playerId, actionType, amount, note });
    if (error) { showToast(`❌ ${error.message || '战斗操作失败'}`); return; }
    selectedBattleRoomId = data?.room?.id || battleRoomId;
    battleRoomStateCache = data || null;
    battleRoomError = null;
    showToast('战斗操作已记录');
    await renderMatchPage();
}

async function finishBattleRoomUI(battleRoomId, status = 'finished') {
    if (!battleRoomId) return;
    const note = document.getElementById('battleFinishNote')?.value || '';
    const { data, error } = await invokeDungeonAction('finishBattleRoom', { battleRoomId, status, note });
    if (error) { showToast(`❌ ${error.message || '房间收束失败'}`); return; }
    selectedBattleRoomId = data?.room?.id || battleRoomId;
    battleRoomStateCache = data || null;
    battleRoomError = null;
    showToast(status === 'cancelled' ? '战斗房间已取消' : '战斗房间已结束');
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

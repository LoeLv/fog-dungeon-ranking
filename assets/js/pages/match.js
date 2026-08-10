async function renderMatchPage() {
    const container = document.getElementById('matchContent');
    if (!container) return;
    if (!USE_LOCAL_FALLBACK && !canInteract()) {
        container.innerHTML = `
            <section class="profile-panel">
                <div class="profile-empty">需要入局谕令后才能进入神域战场。</div>
                <div class="profile-tools"><button class="btn btn-primary btn-sm" onclick="openInviteModal('验入局谕令后可进入神域战场。')">掷骰入局</button></div>
            </section>`;
        return;
    }
    container.innerHTML = '<div class="loading"><div class="spinner"></div><br>正在开启神域战场...</div>';
    const { dungeons, error } = await fetchMatchDungeons(80);
    matchDungeonsCache = dungeons;
    if (error) {
        container.innerHTML = `<div class="profile-empty">${escapeHtml(error.message || '神域战场读取失败。')}</div>`;
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
        if (battleResult.state?.dungeon?.id) selectedMatchDungeonId = battleResult.state.dungeon.id;
        if (battleResult.error) {
            selectedBattleRoomId = null;
            setLocalData(BATTLE_ROOM_STORAGE_KEY, null);
        } else if (battleResult.state?.room?.room_status !== 'active') {
            selectedBattleRoomId = null;
            setLocalData(BATTLE_ROOM_STORAGE_KEY, null);
            battleRoomStateCache = null;
            battleRoomError = null;
        }
    } else if (selectedMatchDungeonId) {
        const battleResult = await fetchBattleRoomState({ dungeonId: selectedMatchDungeonId });
        battleRoomError = battleResult.error;
        battleRoomStateCache = battleResult.state?.room?.room_status === 'active' ? battleResult.state : null;
        selectedBattleRoomId = battleRoomStateCache?.room?.id || null;
        if (selectedBattleRoomId) setLocalData(BATTLE_ROOM_STORAGE_KEY, selectedBattleRoomId);
    } else {
        battleRoomStateCache = null;
        battleRoomError = null;
    }
    container.innerHTML = `
        <section class="profile-hero">
            <div class="profile-avatar path-void">${renderGodSigil('命运', 'lg')}</div>
            <div>
                <div class="profile-kicker">BATTLEFIELD</div>
                <h1 class="profile-name">神域战场</h1>
                <div class="profile-subline">
                    <span class="metric-pill">当前身份 <strong>${escapeHtml(inviteSession?.name || ROLE_LABELS[getInviteRole()] || '本地入局者')}</strong></span>
                    <span class="metric-pill">可开战场 <strong>${dungeons.length}</strong></span>
                    <span class="metric-pill">入场方式 <strong>房间号</strong></span>
                </div>
            </div>
        </section>
        <div class="match-layout">
            <section class="profile-panel">
                <div class="profile-panel-title"><span>可开战场</span><small>选择副本开房间</small></div>
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
    setLocalData(BATTLE_ROOM_STORAGE_KEY, null);
    battleRoomStateCache = null;
    battleRoomError = null;
    await renderMatchPage();
}

async function openMatchPage(initialDungeonId = null) {
    if (!USE_LOCAL_FALLBACK && !canInteract()) {
        openInviteModal('验入局谕令后可进入神域战场。');
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
    const battleRoomPage = document.getElementById('battleRoomPage');
    if (battleRoomPage) battleRoomPage.style.display = 'none';
    document.body.classList.remove('detail-view-open', 'profile-view-open', 'leaderboard-view-open', 'score-view-open', 'battle-room-view-open');
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

async function openBattlePage(initialDungeonId = null) {
    await openMatchPage(initialDungeonId);
}

function closeBattlePage(restoreScroll = true) {
    closeMatchPage(restoreScroll);
}

async function renderBattleRoomPage() {
    const container = document.getElementById('battleRoomContent');
    if (!container) return;
    if (!selectedBattleRoomId) {
        container.innerHTML = '<div class="profile-empty">还没有进入任何战场房间。</div>';
        return;
    }
    container.innerHTML = '<div class="loading"><div class="spinner"></div><br>正在读取战场房间...</div>';
    const { state, error } = await fetchBattleRoomState({ battleRoomId: selectedBattleRoomId });
    battleRoomStateCache = state;
    battleRoomError = error;
    if (error) {
        container.innerHTML = `<div class="profile-empty">${escapeHtml(error.message || '战场房间读取失败。')}</div>`;
        return;
    }
    if (state?.room?.room_status !== 'active') {
        selectedMatchDungeonId = state?.dungeon?.id || selectedMatchDungeonId;
        selectedBattleRoomId = null;
        setLocalData(BATTLE_ROOM_STORAGE_KEY, null);
        battleRoomStateCache = null;
        battleRoomError = null;
        showToast('这个房间已经关闭，已返回神域战场入口');
        await backToBattleLobby();
        return;
    }
    selectedBattleRoomId = state?.room?.id || selectedBattleRoomId;
    setLocalData(BATTLE_ROOM_STORAGE_KEY, selectedBattleRoomId);
    selectedMatchDungeonId = state?.dungeon?.id || selectedMatchDungeonId;
    container.innerHTML = renderBattleRoomPanel(battleRoomStateCache, battleRoomError, { embedded: false });
}

function renderBattleRoomPageFromCache() {
    const container = document.getElementById('battleRoomContent');
    if (!container) return;
    container.innerHTML = renderBattleRoomPanel(battleRoomStateCache, battleRoomError, { embedded: false });
}

async function openBattleRoomPage(battleRoomId = selectedBattleRoomId) {
    if (!battleRoomId) return;
    selectedBattleRoomId = String(battleRoomId);
    setLocalData(BATTLE_ROOM_STORAGE_KEY, selectedBattleRoomId);
    battleRoomScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const detailOverlay = document.getElementById('detailOverlay');
    if (detailOverlay) detailOverlay.style.display = 'none';
    ['matchPage', 'profilePage', 'leaderboardPage', 'scorePage', 'adminPage', 'permissionPage'].forEach(id => {
        const page = document.getElementById(id);
        if (page) page.style.display = 'none';
    });
    document.body.classList.remove('detail-view-open', 'profile-view-open', 'leaderboard-view-open', 'score-view-open', 'match-view-open');
    document.body.classList.add('battle-room-view-open');
    const page = document.getElementById('battleRoomPage');
    if (page) page.style.display = 'block';
    window.scrollTo(0, 0);
    await renderBattleRoomPage();
}

function closeBattleRoomPage(restoreScroll = true) {
    const page = document.getElementById('battleRoomPage');
    if (page) page.style.display = 'none';
    document.body.classList.remove('battle-room-view-open');
    if (restoreScroll !== false) requestAnimationFrame(() => window.scrollTo(0, battleRoomScrollY || 0));
}

async function backToBattleLobby() {
    closeBattleRoomPage(false);
    await openMatchPage(selectedMatchDungeonId);
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
    if (!requireInvite(['player', 'author', 'reviewer', 'admin'], '验入局谕令后可进入神域战场。')) return;
    if (USE_LOCAL_FALLBACK) { showToast('本地模式暂不保存战斗房间'); return; }
    const { data, error } = await invokeDungeonAction('createBattleRoomFromMatchRoom', { matchRoomId });
    if (error) { showToast(`❌ ${error.message || '神域战场开启失败'}`); return; }
    selectedBattleRoomId = data?.room?.id || null;
    setLocalData(BATTLE_ROOM_STORAGE_KEY, selectedBattleRoomId);
    battleRoomStateCache = data || null;
    battleRoomError = null;
    selectedMatchDungeonId = data?.dungeon?.id || selectedMatchDungeonId;
    showToast('已进入神域战场');
    await openBattleRoomPage(selectedBattleRoomId);
}

async function createBattleRoomUI(dungeonId = selectedMatchDungeonId) {
    if (!dungeonId) return;
    if (!requireInvite(['player', 'author', 'reviewer', 'admin'], '验入局谕令后可开神域战场。')) return;
    if (USE_LOCAL_FALLBACK) { showToast('本地模式暂不保存神域战场房间'); return; }
    const { data, error } = await invokeDungeonAction('createBattleRoom', { dungeonId });
    if (error) { showToast(`❌ ${error.message || '开房失败'}`); return; }
    selectedMatchDungeonId = data?.dungeon?.id || dungeonId;
    selectedBattleRoomId = data?.room?.id || null;
    setLocalData(BATTLE_ROOM_STORAGE_KEY, selectedBattleRoomId);
    battleRoomStateCache = data || null;
    battleRoomError = null;
    showToast('神域战场已开房');
    await openBattleRoomPage(selectedBattleRoomId);
}

async function joinBattleRoomUI(battleRoomId = selectedBattleRoomId) {
    if (!battleRoomId) return;
    if (!requireInvite(['player', 'author', 'reviewer', 'admin'], '验入局谕令后可加入神域战场。')) return;
    if (USE_LOCAL_FALLBACK) { showToast('本地模式暂不保存神域战场房间'); return; }
    const { data, error } = await invokeDungeonAction('joinBattleRoom', { battleRoomId });
    if (error) { showToast(`❌ ${error.message || '加入战场失败'}`); return; }
    selectedMatchDungeonId = data?.dungeon?.id || selectedMatchDungeonId;
    selectedBattleRoomId = data?.room?.id || battleRoomId;
    setLocalData(BATTLE_ROOM_STORAGE_KEY, selectedBattleRoomId);
    battleRoomStateCache = data || null;
    battleRoomError = null;
    showToast('已加入神域战场');
    await openBattleRoomPage(selectedBattleRoomId);
}

async function joinBattleRoomByInputUI() {
    const input = document.getElementById('battleRoomJoinInput');
    const battleRoomId = String(input?.value || '').trim();
    if (!battleRoomId) { showToast('请输入房间号'); return; }
    await joinBattleRoomUI(battleRoomId);
}

async function copyBattleRoomIdUI(battleRoomId = selectedBattleRoomId) {
    const text = String(battleRoomId || document.getElementById('battleRoomIdDisplay')?.value || '').trim();
    if (!text) { showToast('暂无房间号可复制'); return; }
    try {
        await navigator.clipboard.writeText(text);
        showToast('房间号已复制');
    } catch (_) {
        const input = document.getElementById('battleRoomIdDisplay');
        if (input) {
            input.focus();
            input.select();
        }
        showToast('已选中房间号，可手动复制');
    }
}

async function refreshBattleRoomUI(battleRoomId = selectedBattleRoomId) {
    if (!battleRoomId) return;
    const { state, error } = await fetchBattleRoomState({ battleRoomId });
    battleRoomError = error;
    battleRoomStateCache = !error && state?.room?.room_status === 'active' ? state : null;
    selectedBattleRoomId = battleRoomStateCache?.room?.id || null;
    setLocalData(BATTLE_ROOM_STORAGE_KEY, selectedBattleRoomId);
    if (error) showToast(`❌ ${error.message || '神域战场刷新失败'}`);
    if (!error && state?.room?.room_status !== 'active') showToast('这个房间已经关闭，不再显示为当前房间');
    if (document.getElementById('battleRoomPage')?.style.display === 'block') {
        if (selectedBattleRoomId) renderBattleRoomPageFromCache();
        else await backToBattleLobby();
    }
    else await renderMatchPage();
}

async function updateBattleRoomRoundUI(battleRoomId = selectedBattleRoomId) {
    if (!battleRoomId) return;
    const currentRound = Number(document.getElementById('battleRoundInput')?.value || 1);
    const note = document.getElementById('battleRoomNoteInput')?.value || '';
    const { data, error } = await invokeDungeonAction('updateBattleRoomRound', { battleRoomId, currentRound, note });
    if (error) { showToast(`❌ ${error.message || '回合保存失败'}`); return; }
    selectedBattleRoomId = data?.room?.id || battleRoomId;
    setLocalData(BATTLE_ROOM_STORAGE_KEY, selectedBattleRoomId);
    battleRoomStateCache = data || null;
    battleRoomError = null;
    showToast('战场回合已保存');
    if (document.getElementById('battleRoomPage')?.style.display === 'block') renderBattleRoomPageFromCache();
    else await renderMatchPage();
}

async function applyBattlePlayerActionUI(battleRoomId, playerId, actionType) {
    if (!battleRoomId || !playerId) return;
    const amount = Number(document.getElementById(`battleAmount-${playerId}`)?.value || 0);
    const note = document.getElementById(`battleNote-${playerId}`)?.value || '';
    const { data, error } = await invokeDungeonAction('applyBattlePlayerAction', { battleRoomId, playerId, actionType, amount, note });
    if (error) { showToast(`❌ ${error.message || '战斗操作失败'}`); return; }
    selectedBattleRoomId = data?.room?.id || battleRoomId;
    setLocalData(BATTLE_ROOM_STORAGE_KEY, selectedBattleRoomId);
    battleRoomStateCache = data || null;
    battleRoomError = null;
    showToast('战斗操作已记录');
    if (document.getElementById('battleRoomPage')?.style.display === 'block') renderBattleRoomPageFromCache();
    else await renderMatchPage();
}

async function finishBattleRoomUI(battleRoomId, status = 'finished') {
    if (!battleRoomId) return;
    if (status === 'cancelled') {
        const confirmed = window.confirm('关闭房间会结束本场战斗，并在战斗日志中提示 DM/主持人房间已关闭。确定关闭吗？');
        if (!confirmed) return;
    }
    const note = document.getElementById('battleFinishNote')?.value || '';
    const finalNote = status === 'cancelled' ? (note || '房间已关闭，DM/主持人已收到关闭提示。') : note;
    const { data, error } = await invokeDungeonAction('finishBattleRoom', { battleRoomId, status, note: finalNote });
    if (error) { showToast(`❌ ${error.message || '房间收束失败'}`); return; }
    selectedBattleRoomId = data?.room?.room_status === 'active' ? (data?.room?.id || battleRoomId) : null;
    setLocalData(BATTLE_ROOM_STORAGE_KEY, selectedBattleRoomId);
    battleRoomStateCache = data || null;
    battleRoomError = null;
    showToast(status === 'cancelled' ? '神域战场已取消' : '神域战场已结束');
    if (status === 'cancelled' || status === 'finished') {
        if (document.getElementById('battleRoomPage')?.style.display === 'block') await backToBattleLobby();
        else await renderMatchPage();
    } else if (document.getElementById('battleRoomPage')?.style.display === 'block') renderBattleRoomPageFromCache();
    else await renderMatchPage();
}

async function closeBattleRoomUI(battleRoomId = selectedBattleRoomId) {
    await finishBattleRoomUI(battleRoomId, 'cancelled');
}

async function joinMatchQueueUI(dungeonId) {
    if (!requireInvite(['player', 'author', 'reviewer', 'admin'], '验入局谕令后可加入神域战场。')) return;
    if (USE_LOCAL_FALLBACK) {
        const queueByDungeon = getLocalData('match_queue_v1', {});
        const list = (queueByDungeon[dungeonId] || []).filter(player => !isCurrentMatchPlayer(player.player_name));
        list.push({ player_name: getCurrentMatchName(), created_at: new Date().toISOString() });
        queueByDungeon[dungeonId] = list;
        setLocalData('match_queue_v1', queueByDungeon);
        showToast('已加入本地候场');
        await renderMatchPage();
        return;
    }
    const { data, error } = await invokeDungeonAction('joinMatchQueue', { dungeonId });
    if (error) { showToast(`❌ ${error.message || '加入失败'}`); return; }
    matchStateCache = data?.state || null;
    matchStateError = null;
    const status = data?.result?.status;
    showToast(status === 'matched' || status === 'already_matched' ? '已成房' : '已加入候场队列');
    await renderMatchPage();
}

async function cancelMatchQueueUI(dungeonId) {
    if (!requireInvite(['player', 'author', 'reviewer', 'admin'], '验入局谕令后可取消候场。')) return;
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
    showToast(data?.result?.cancelled ? '已取消候场排队' : '当前没有排队记录');
    await renderMatchPage();
}

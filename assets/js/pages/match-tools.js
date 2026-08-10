// Battlefield page helpers for dungeon loading and battle room panels.

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
    if (!canInteract()) return { dungeons: [], error: { message: '需要入局谕令后才能查看神域战场。' } };
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

async function fetchBattleRoomState({ battleRoomId = null, matchRoomId = null, dungeonId = null } = {}) {
    if (USE_LOCAL_FALLBACK) return { state: null, error: { message: '本地模式暂不保存战斗房间。' } };
    const payload = {};
    if (battleRoomId) payload.battleRoomId = battleRoomId;
    if (matchRoomId) payload.matchRoomId = matchRoomId;
    if (dungeonId) payload.dungeonId = dungeonId;
    const { data, error } = await invokeDungeonAction('getBattleRoom', payload);
    return { state: data || null, error };
}

function renderMatchDungeonCards(dungeons) {
    if (!dungeons.length) return '<div class="profile-empty">暂无可开战场的试炼。</div>';
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
                    <button class="btn btn-outline btn-xs match-card-button" onclick='event.stopPropagation(); openMatchDungeon(${jsString(dungeon.id)})'>查看战场</button>
                </div>
                <div class="metric-strip">
                    <span class="metric-pill">建议人数 <strong>${target}</strong></span>
                    <span class="metric-pill">候场记录 <strong>${queued}</strong></span>
                    <span class="metric-pill">历史组队 <strong>${rooms}</strong></span>
                    <span class="metric-pill">轮回 <strong>${escapeHtml(getTrialCycle(dungeon))}</strong></span>
                </div>
            </article>`;
    }).join('')}</div>`;
}

function renderMatchQueue(queue) {
    if (!queue.length) return '<div class="profile-empty">当前无人候场。可直接开一个神域战场房间。</div>';
    return `<div class="match-player-list">${queue.map((player, index) => `
        <div class="match-player-row ${isCurrentMatchPlayer(player.player_name) ? 'profile-notice' : ''}">
            <strong>${index + 1}. ${escapeHtml(player.player_name || '未命名信徒')}</strong>
            <span class="match-player-note">${escapeHtml(formatDate(player.created_at))}${isCurrentMatchPlayer(player.player_name) ? ' · 你' : ''}</span>
        </div>`).join('')}</div>`;
}

function renderMatchRooms(rooms, canOpenBattle = true) {
    if (!rooms.length) return '<div class="profile-empty">暂无历史组队房间；可直接在神域战场开房。</div>';
    return `<div class="match-room-list">${rooms.map((room, index) => {
        const players = room.match_room_players || room.players || [];
        const roomId = String(room.id || '');
        return `
            <article class="match-room-card">
                <div class="match-room-head">
                    <strong>房间 ${index + 1} · ${escapeHtml(roomId.slice(0, 8))}</strong>
                    <span class="match-player-note">${players.length}/${Number(room.target_player_count || 0) || players.length} 人 · ${escapeHtml(formatDate(room.created_at))}</span>
                </div>
                <div class="match-player-list">
                    ${players.map(player => `
                        <div class="match-player-row ${isCurrentMatchPlayer(player.player_name) ? 'profile-notice' : ''}">
                            <strong>${escapeHtml(player.player_name || '未命名信徒')}</strong>
                            <span class="match-player-note">${player.finish_status ? '已完成' : '进行中'}${isCurrentMatchPlayer(player.player_name) ? ' · 你' : ''}</span>
                        </div>`).join('') || '<div class="profile-empty">房间成员读取中。</div>'}
                </div>
                ${canOpenBattle ? `
                <div class="match-inline-actions battle-room-entry">
                    <button class="btn btn-primary btn-sm" onclick='openBattleRoomFromMatch(${jsString(roomId)})'>转入神域战场</button>
                </div>` : ''}
            </article>`;
    }).join('')}</div>`;
}

function getBattleStatusLabel(status) {
    if (status === 'finished') return '已结束';
    if (status === 'cancelled') return '已取消';
    return '进行中';
}

function getBattleActionLabel(type) {
    return {
        create: '开房',
        round: '回合',
        damage: '伤害',
        heal: '治疗',
        shield: '护盾',
        set_hp: '设血',
        revive: '复活',
        defeat: '击倒',
        note: '备注',
        finish: '结束',
        cancel: '取消'
    }[type] || type || '记录';
}

function renderBattleRoomPanel(state, error) {
    if (error) return `<section class="profile-panel battle-room-panel"><div class="profile-empty">${escapeHtml(error.message || '战斗房间读取失败。')}</div></section>`;
    if (!state?.room) return '';
    const room = state.room;
    const dungeon = state.dungeon || {};
    const players = Array.isArray(state.players) ? state.players : [];
    const logs = Array.isArray(state.logs) ? state.logs : [];
    const canOperate = !!state.canOperate && room.room_status === 'active';
    const round = Math.max(1, Number(room.current_round || 1));
    return `
        <section class="profile-panel battle-room-panel">
            <div class="profile-panel-title">
                <span>神域战场 · ${escapeHtml(dungeon.name || String(room.id || '').slice(0, 8))}</span>
                <small>${escapeHtml(getBattleStatusLabel(room.room_status))} · 第 ${round} 回合 · 主持 ${escapeHtml(room.host_name || '未知')}</small>
            </div>
            <div class="leaderboard-summary">把房间号发给其他入局者即可拉人入场。当前血量是本场战斗事实；伤害会先扣护盾，治疗可超过初始上限。</div>
            <div class="battle-room-topline">
                <label>回合 <input class="battle-room-input" id="battleRoundInput" type="number" min="1" max="999" value="${round}" ${canOperate ? '' : 'disabled'}></label>
                <label>房间号 <input class="battle-room-input" id="battleRoomIdDisplay" readonly value="${escapeHtml(room.id || '')}"></label>
                <label>房间备注 <input class="battle-room-input" id="battleRoomNoteInput" maxlength="800" value="${escapeHtml(room.note || '')}" ${canOperate ? '' : 'disabled'}></label>
                ${canOperate ? `<button class="btn btn-outline btn-sm" onclick='updateBattleRoomRoundUI(${jsString(room.id)})'>保存回合</button>` : '<span class="metric-pill">仅主持人可操作</span>'}
                ${room.room_status === 'active' && !state.isParticipant ? `<button class="btn btn-primary btn-sm" onclick='joinBattleRoomUI(${jsString(room.id)})'>加入战场</button>` : ''}
                <button class="btn btn-outline btn-sm" onclick='copyBattleRoomIdUI(${jsString(room.id)})'>复制房间号</button>
                <button class="btn btn-outline btn-sm" onclick='refreshBattleRoomUI(${jsString(room.id)})'>刷新战斗</button>
            </div>
            <div class="battle-roster">
                ${players.map(player => renderBattlePlayerCard(player, room.id, canOperate)).join('') || '<div class="profile-empty">战斗成员读取中。</div>'}
            </div>
            <div class="profile-grid battle-room-bottom">
                <section class="profile-panel battle-log-panel">
                    <div class="profile-panel-title"><span>战斗日志</span><small>最近 ${logs.length} 条</small></div>
                    ${renderBattleLogs(logs)}
                </section>
                <section class="profile-panel battle-finish-panel">
                    <div class="profile-panel-title"><span>房间收束</span><small>${escapeHtml(getBattleStatusLabel(room.room_status))}</small></div>
                    ${canOperate ? `
                        <textarea class="profile-textarea battle-finish-note" id="battleFinishNote" maxlength="800" placeholder="结算备注、胜负摘要或异常说明"></textarea>
                        <div class="match-inline-actions">
                            <button class="btn btn-primary btn-sm" onclick='finishBattleRoomUI(${jsString(room.id)}, "finished")'>结束战斗</button>
                            <button class="btn btn-outline btn-sm" onclick='finishBattleRoomUI(${jsString(room.id)}, "cancelled")'>取消房间</button>
                        </div>` : `<div class="profile-empty">${escapeHtml(room.note || '房间结束后会保留成员状态和日志。')}</div>`}
                </section>
            </div>
        </section>`;
}

function renderBattlePlayerCard(player, battleRoomId, canOperate) {
    const hp = Number(player.current_hp || 0);
    const maxHp = Number(player.max_hp || 0);
    const shield = Number(player.shield || 0);
    const defeated = !!player.is_defeated || hp <= 0;
    const hpRatio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
    return `
        <article class="battle-player-card ${defeated ? 'defeated' : ''}">
            <div class="battle-player-head">
                <div>
                    <strong>${escapeHtml(player.player_name || '未命名信徒')}</strong>
                    <span>${escapeHtml(player.faith_god || '未定信仰')} · ${escapeHtml(player.class_name || '未定职业')} · ${escapeHtml(player.profession || '')}</span>
                </div>
                <span class="metric-pill">${defeated ? '已击倒' : '可行动'}</span>
            </div>
            <div class="battle-hp-line">
                <span style="width:${Math.round(hpRatio * 100)}%"></span>
            </div>
            <div class="match-state-grid battle-stat-grid">
                <div class="match-state-tile"><span>当前血量</span><strong>${hp}</strong></div>
                <div class="match-state-tile"><span>初始上限</span><strong>${maxHp}</strong></div>
                <div class="match-state-tile"><span>护盾</span><strong>${shield}</strong></div>
            </div>
            ${player.note ? `<div class="battle-player-note">${escapeHtml(player.note)}</div>` : ''}
            ${canOperate ? renderBattlePlayerControls(player, battleRoomId) : ''}
        </article>`;
}

function renderBattlePlayerControls(player, battleRoomId) {
    const id = Number(player.id);
    return `
        <div class="battle-player-controls">
            <input class="battle-room-input" id="battleAmount-${id}" type="number" step="1" value="10" aria-label="数值">
            <input class="battle-room-input" id="battleNote-${id}" maxlength="500" placeholder="备注">
            <button class="btn btn-outline btn-xs" onclick='applyBattlePlayerActionUI(${jsString(battleRoomId)}, ${id}, "damage")'>伤害</button>
            <button class="btn btn-outline btn-xs" onclick='applyBattlePlayerActionUI(${jsString(battleRoomId)}, ${id}, "heal")'>治疗</button>
            <button class="btn btn-outline btn-xs" onclick='applyBattlePlayerActionUI(${jsString(battleRoomId)}, ${id}, "shield")'>护盾</button>
            <button class="btn btn-outline btn-xs" onclick='applyBattlePlayerActionUI(${jsString(battleRoomId)}, ${id}, "set_hp")'>设血</button>
            <button class="btn btn-outline btn-xs" onclick='applyBattlePlayerActionUI(${jsString(battleRoomId)}, ${id}, "revive")'>复活</button>
            <button class="btn btn-outline btn-xs" onclick='applyBattlePlayerActionUI(${jsString(battleRoomId)}, ${id}, "defeat")'>击倒</button>
            <button class="btn btn-outline btn-xs" onclick='applyBattlePlayerActionUI(${jsString(battleRoomId)}, ${id}, "note")'>备注</button>
        </div>`;
}

function renderBattleLogs(logs) {
    if (!logs.length) return '<div class="profile-empty">暂无战斗日志。</div>';
    return `<div class="battle-log-list">${logs.map(log => `
        <div class="battle-log-row">
            <strong>${escapeHtml(getBattleActionLabel(log.action_type))}${log.amount !== null && log.amount !== undefined ? ` ${escapeHtml(log.amount)}` : ''}</strong>
            <span>${escapeHtml(log.target_player_name || log.actor_name || '')}${log.note ? ` · ${escapeHtml(log.note)}` : ''}</span>
            <small>第 ${Number(log.round_no || 1)} 回合 · ${escapeHtml(formatDate(log.created_at))}</small>
        </div>`).join('')}</div>`;
}

function renderMatchStatePanel(state, error) {
    if (error) return `<div class="profile-empty">${escapeHtml(error.message || '神域战场暂不可用。')}</div>`;
    const dungeon = state?.dungeon || matchDungeonsCache.find(item => String(item.id) === String(selectedMatchDungeonId));
    if (!dungeon) return '<div class="profile-empty">从左侧选择一个试炼，开一个神域战场房间。</div>';
    const rooms = Array.isArray(state?.rooms) ? state.rooms : [];
    const target = getMatchTargetCount(dungeon);
    const currentBattleRoom = battleRoomStateCache?.room || null;
    const inBattleRoom = !!battleRoomStateCache?.isParticipant;
    const godClass = getGodClass(dungeon.type);
    return `
        <section class="profile-panel">
            <div class="profile-panel-title">
                <span>${renderGodSigil(dungeon.type, 'sm')} ${escapeHtml(dungeon.name || '未命名试炼')}</span>
                <small>${escapeHtml(formatGodName(dungeon.type))} · ${escapeHtml(formatDifficulty(dungeon.difficulty))}</small>
            </div>
            <div class="leaderboard-summary">在网站端直接开一个神域战场房间，把房间号发给其他入局者，他们输入房间号即可加入。</div>
            <div class="match-state-grid">
                <div class="match-state-tile"><span>建议人数</span><strong>${target}</strong></div>
                <div class="match-state-tile"><span>历史组队</span><strong>${rooms.length}</strong></div>
                <div class="match-state-tile"><span>我的状态</span><strong>${inBattleRoom ? '已入场' : currentBattleRoom ? '可加入' : '未开房'}</strong></div>
            </div>
            <div class="battle-room-entry">
                <input class="battle-room-input" id="battleRoomJoinInput" placeholder="输入房间号加入别人开的战场">
                <button class="btn btn-primary btn-sm" onclick="joinBattleRoomByInputUI()">加入房间</button>
            </div>
            <div class="match-inline-actions">
                ${currentBattleRoom ? `<button class="btn btn-primary btn-sm" onclick='joinBattleRoomUI(${jsString(currentBattleRoom.id)})'>${inBattleRoom ? '回到战场' : '加入战场'}</button>` : `<button class="btn btn-primary btn-sm" onclick='createBattleRoomUI(${jsString(dungeon.id)})'>开房间</button>`}
                <button class="btn btn-outline btn-sm" onclick='refreshMatchStateUI(${jsString(dungeon.id)})'>刷新状态</button>
                <button class="btn btn-outline btn-sm" onclick='openDetailFromMatch(${jsString(dungeon.id)})'>查看详情</button>
            </div>
        </section>
        ${renderBattleRoomPanel(battleRoomStateCache, battleRoomError)}
        ${rooms.length ? `<section class="profile-panel" style="margin-top:18px;"><div class="profile-panel-title"><span>历史组队房间</span><small>${rooms.length} 间</small></div>${renderMatchRooms(rooms)}</section>` : ''}
        <div class="trial-oracle ${godClass}" style="${getGodSkinStyle(dungeon.type)};margin-top:18px;">${escapeHtml(getGodOracle(dungeon.type))}</div>`;
}

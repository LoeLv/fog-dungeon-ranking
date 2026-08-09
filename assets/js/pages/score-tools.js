// Score page helpers for messages, previews, settlements, and submissions.

function formatScoreNumber(value, sign = false) {
    const number = Number(value || 0);
    const text = Number.isInteger(number) ? String(number) : number.toFixed(1);
    return sign && number > 0 ? `+${text}` : text;
}

async function fetchMyScoreMessages(limit = 8) {
    if (USE_LOCAL_FALLBACK || !inviteSession?.code) return { messages: [], unread: [], error: null };
    const { data, error } = await invokeDungeonAction('listMyScoreMessages', { limit });
    if (error) return { messages: [], unread: [], error };
    const messages = Array.isArray(data) ? data : [];
    return { messages, unread: messages.filter(message => !message.is_read), error: null };
}

function renderScoreMessages(messages, error, god = '命运') {
    if (error) return renderRitualEmpty(error.message || '结算信封暂不可用。', god, '结算信封暂不可用');
    if (!messages?.length) return renderRitualEmpty(getGodEmptyText(god, 'scoreMessages'), god, '结算信封暂空');
    return `<div class="profile-list">${messages.map(message => `
        <article class="profile-list-item score-message-card ${message.is_read ? '' : 'unread'}" data-score-message-id="${Number(message.id)}">
            <div class="profile-list-title">
                <span>${message.is_read ? '' : '<span class="profile-notice-mark" data-score-message-unread-mark>未读</span> '}${escapeHtml(message.msg_type || 'score')}</span>
                <small>${escapeHtml(formatDate(message.created_at))}</small>
            </div>
            <div class="profile-list-meta">${escapeHtml(message.content || '')}</div>
            ${message.is_read ? '' : `<div class="profile-tools" data-score-message-actions style="margin-top:10px;"><button class="btn btn-outline btn-sm" onclick="markScoreMessageReadUI(${Number(message.id)})">封缄此信</button></div>`}
        </article>`).join('')}</div>`;
}

function syncScoreMessageUnreadUI() {
    const unreadCount = document.querySelectorAll('#profileContent .score-message-card.unread').length;
    const panelCount = document.getElementById('scoreMessagesPanelCount');
    if (panelCount) panelCount.textContent = unreadCount ? `${unreadCount} 封未读` : '暂无未读';
    const scoreSyncLabel = document.getElementById('profileScoreSyncLabel');
    if (scoreSyncLabel) scoreSyncLabel.textContent = unreadCount ? `${unreadCount} 封未读` : '结算同步';
    const heroPill = document.getElementById('profileScoreMessagePill');
    if (heroPill) {
        heroPill.style.display = unreadCount ? '' : 'none';
        const value = heroPill.querySelector('strong');
        if (value) value.textContent = String(unreadCount);
    }
}

async function markScoreMessageReadUI(messageId) {
    const { error } = await invokeDungeonAction('markScoreMessageRead', { messageId: Number(messageId) });
    if (error) { showToast(`❌ ${error.message || '标记失败'}`); return; }
    showToast('结算信封已读');
    const card = document.querySelector(`[data-score-message-id="${Number(messageId)}"]`);
    if (card) {
        card.classList.remove('unread');
        card.querySelector('[data-score-message-unread-mark]')?.remove();
        card.querySelector('[data-score-message-actions]')?.remove();
        syncScoreMessageUnreadUI();
    }
}

function rememberScoreClearChoice(nick, status) {
    if (!scorePreviewState) return;
    scorePreviewState.clearStatuses = {
        ...(scorePreviewState.clearStatuses || {}),
        [String(nick || '')]: status
    };
}

function getBatchClearStatusesFromPreview() {
    const statuses = {};
    const missing = [];
    document.querySelectorAll('[data-score-clear-row]').forEach(row => {
        const nick = row.getAttribute('data-score-clear-nick') || '';
        const checked = row.querySelector('input[type="radio"]:checked');
        if (!nick) return;
        if (!checked) missing.push(nick);
        else statuses[nick] = checked.value;
    });
    return { statuses, missing };
}

function renderScorePreview(preview) {
    if (!preview) return '<div class="profile-empty">粘贴结算文本后先预览校验。</div>';
    const errors = [
        ...(preview.invalidLines || []).map(item => `第 ${item.line} 行：${item.msg}｜${item.raw}`),
        ...(preview.scoreErrList || []).map(item => `${item.nick}：${item.msg}`),
        ...(preview.missingNick || []).map(nick => `${nick}：未找到已保存个人档案`),
        ...(preview.duplicateNick || []).map(nick => `${nick}：本次结算中重复出现`)
    ];
    const rows = (preview.allList || []).slice(0, 80).map((item, index) => {
        const status = preview.clearStatuses?.[item.nick] || '';
        return `
        <tr data-score-clear-row data-score-clear-nick="${escapeHtml(item.nick)}">
            <td>${escapeHtml(item.nick)}</td>
            <td>${escapeHtml(formatScoreNumber(item.deng, true))}</td>
            <td>${escapeHtml(formatScoreNumber(item.jin, true))}</td>
            <td>${escapeHtml(formatScoreNumber(item.total, true))}</td>
            <td>
                <div class="score-clear-choice">
                    <label><input type="radio" name="scoreClearStatus${index}" value="passed" ${status === 'passed' ? 'checked' : ''} onchange="rememberScoreClearChoice(${jsString(item.nick)}, this.value)"> 逢生</label>
                    <label><input type="radio" name="scoreClearStatus${index}" value="lost" ${status === 'lost' ? 'checked' : ''} onchange="rememberScoreClearChoice(${jsString(item.nick)}, this.value)"> 迷失</label>
                </div>
            </td>
        </tr>`;
    }).join('');
    return `
        <div class="metric-strip">
            <span class="metric-pill">人数 <strong>${Number(preview.totalPlayers || 0)}</strong></span>
            <span class="metric-pill">登神合计 <strong>${escapeHtml(formatScoreNumber(preview.totalDeng, true))}</strong></span>
            <span class="metric-pill">觐见合计 <strong>${escapeHtml(formatScoreNumber(preview.totalJin, true))}</strong></span>
            <span class="metric-pill">${preview.valid ? '可结算' : '需修正'} <strong>${errors.length}</strong></span>
        </div>
        ${errors.length ? `<div class="score-error-list">${errors.map(error => `<div class="score-error-item">${escapeHtml(error)}</div>`).join('')}</div>` : ''}
        <table class="score-preview-table">
            <thead><tr><th>玩家</th><th>登神</th><th>觐见</th><th>合计</th><th>通关（可空）</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="5">暂无有效条目</td></tr>'}</tbody>
        </table>`;
}

async function checkScorePreviewUI() {
    const textContent = document.getElementById('scoreBatchText')?.value || '';
    autoSelectScoreDungeonFromText('scoreDungeonId', textContent);
    const { data, error } = await invokeDungeonAction('checkScorePreview', { textContent });
    if (error) { showToast(`❌ ${error.message || '预览失败'}`); return; }
    scorePreviewState = data;
    const panel = document.getElementById('scorePreviewPanel');
    if (panel) panel.innerHTML = renderScorePreview(scorePreviewState);
}

function createSettlementRequestId(action) {
    const randomPart = (window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    return `${action}-${randomPart}`;
}

function setScoreActionBusy(lockKey, busy, label = '处理中...') {
    document.querySelectorAll(`[data-score-action="${lockKey}"]`).forEach(button => {
        if (!(button instanceof HTMLButtonElement)) return;
        if (busy) {
            button.dataset.originalText = button.dataset.originalText || button.textContent || '';
            button.textContent = label;
            button.disabled = true;
        } else {
            if (button.dataset.originalText) button.textContent = button.dataset.originalText;
            delete button.dataset.originalText;
            button.disabled = false;
        }
    });
}

async function submitScoreBatchUI() {
    const lockKey = 'submit-score-batch';
    if (scoreActionLocks.has(lockKey)) { showToast('结算正在提交，请等待结果'); return; }
    scoreActionLocks.add(lockKey);
    setScoreActionBusy(lockKey, true, '结算中...');
    showToast('结算提交中，请勿重复点击');
    const dungeonSelect = document.getElementById('scoreDungeonId');
    const textContent = document.getElementById('scoreBatchText')?.value || '';
    autoSelectScoreDungeonFromText('scoreDungeonId', textContent);
    const dungeonId = dungeonSelect?.value || '';
    const dungeonName = dungeonSelect?.selectedOptions?.[0]?.dataset?.name || '';
    const remark = document.getElementById('scoreBatchRemark')?.value || '';
    const { statuses: clearStatuses } = getBatchClearStatusesFromPreview();
    if (!scorePreviewState?.valid) {
        showToast('请先预览校验，确认名单和分数无误');
        scoreActionLocks.delete(lockKey);
        setScoreActionBusy(lockKey, false);
        return;
    }
    scorePreviewState.clearStatuses = clearStatuses;
    const settlementRequestId = createSettlementRequestId('batch');
    try {
        const { data, error } = await invokeDungeonAction('submitScoreBatch', { dungeonId, dungeonName, textContent, remark, clearStatuses, settlementRequestId });
        if (error) {
            if (error.data) {
                scorePreviewState = error.data;
                const panel = document.getElementById('scorePreviewPanel');
                if (panel) panel.innerHTML = renderScorePreview(scorePreviewState);
            }
            showToast(`❌ ${error.message || '结算失败'}`);
            return;
        }
        scorePreviewState = null;
        showToast(`结算完成：${data?.entries?.length || 0} 人${data?.clearConfirmed ? `，通关确认 ${data.clearConfirmed} 人` : ''}，正在刷新最近结算`);
        await refreshScoreSettlementsPanel(data?.settlement?.id || '');
    } finally {
        scoreActionLocks.delete(lockKey);
        setScoreActionBusy(lockKey, false);
    }
}

async function submitScoreSingleUI() {
    const lockKey = 'submit-score-single';
    if (scoreActionLocks.has(lockKey)) { showToast('补分正在提交，请等待结果'); return; }
    scoreActionLocks.add(lockKey);
    setScoreActionBusy(lockKey, true, '补分中...');
    showToast('补分提交中，请勿重复点击');
    const dungeonSelect = document.getElementById('singleDungeonId');
    const playerName = document.getElementById('singlePlayerName')?.value || '';
    const singleClearStatus = document.querySelector('input[name="singleClearStatus"]:checked')?.value || '';
    const payload = {
        dungeonId: dungeonSelect?.value || '',
        dungeonName: dungeonSelect?.selectedOptions?.[0]?.dataset?.name || '',
        playerName,
        dengScore: document.getElementById('singleDengScore')?.value || 0,
        jinScore: document.getElementById('singleJinScore')?.value || 0,
        remark: document.getElementById('singleRemark')?.value || '',
        clearStatuses: singleClearStatus ? { [playerName]: singleClearStatus } : {},
        settlementRequestId: createSettlementRequestId('single')
    };
    try {
        const { data, error } = await invokeDungeonAction('submitScoreSingle', payload);
        if (error) { showToast(`❌ ${error.message || '补分失败'}`); return; }
        showToast(`补分完成：${data?.entries?.[0]?.player_name || payload.playerName}${data?.clearConfirmed ? '，通关已确认' : ''}，正在刷新最近结算`);
        await refreshScoreSettlementsPanel(data?.settlement?.id || '');
    } finally {
        scoreActionLocks.delete(lockKey);
        setScoreActionBusy(lockKey, false);
    }
}

function renderScoreDungeonOptions(dungeons) {
    if (!dungeons?.length) return '<option value="">暂无可结算副本</option>';
    return '<option value="">选择要结算的副本</option>' + dungeons.map(dungeon => {
        const name = dungeon.name || '未命名试炼';
        const meta = `${formatDifficulty(dungeon.difficulty)} · ${formatGodName(dungeon.type)} · ${formatCreatorLine(dungeon)}`;
        return `<option value="${escapeHtml(dungeon.id)}" data-name="${escapeHtml(name)}" data-search="${escapeHtml(`${name} ${meta}`)}">${escapeHtml(name)}｜${escapeHtml(meta)}</option>`;
    }).join('');
}

function normalizeScoreDungeonText(value) {
    return String(value || '').toLowerCase().replace(/[《》「」『』【】\[\]（）()·\s|｜:：,，.。;；、\-_/\\]/g, '');
}

function filterScoreDungeonOptions(inputId, selectId) {
    const input = document.getElementById(inputId);
    const select = document.getElementById(selectId);
    if (!input || !select) return;
    const keyword = normalizeScoreDungeonText(input.value);
    let visibleCount = 0;
    Array.from(select.options).forEach(option => {
        if (!option.value) {
            option.hidden = false;
            return;
        }
        const haystack = normalizeScoreDungeonText(`${option.dataset.name || ''} ${option.dataset.search || ''} ${option.textContent || ''}`);
        const visible = !keyword || haystack.includes(keyword);
        option.hidden = !visible;
        if (visible) visibleCount += 1;
    });
    if (select.selectedOptions[0]?.hidden) select.value = '';
    if (!select.value && visibleCount === 1) {
        const only = Array.from(select.options).find(option => option.value && !option.hidden);
        if (only) select.value = only.value;
    }
    const status = document.getElementById(`${inputId}Status`);
    if (status) status.textContent = keyword ? `匹配 ${visibleCount} 个副本` : '输入副本名可快速过滤';
}

function extractScoreDungeonHint(textContent) {
    const lines = String(textContent || '').split(/\r?\n/u).map(line => line.trim()).filter(Boolean).slice(0, 6);
    for (const line of lines) {
        const bookMatch = line.match(/《([^》]{2,80})》/u);
        if (bookMatch) return bookMatch[1];
        const labelMatch = line.match(/^(?:副本|试炼|本名|副本名|试炼名)\s*[：:\s]\s*(.{2,80})$/u);
        if (labelMatch) return labelMatch[1].replace(/[|｜].*$/u, '').trim();
        const firstLineHint = line
            .replace(/^\s*\d+\s*[.．、)]\s*/u, '')
            .split(/[，,。；;：:\s]/u)[0]
            .replace(/[《》「」『』【】\[\]（）()]/g, '')
            .trim();
        if (firstLineHint && !/[+-]?\d+(?:\.\d+)?\s*\+\s*[+-]?\d/u.test(line)) return firstLineHint;
    }
    return '';
}

function autoSelectScoreDungeonFromText(selectId, textContent) {
    const select = document.getElementById(selectId);
    if (!select || select.value) return false;
    const hint = extractScoreDungeonHint(textContent);
    if (!hint) return false;
    const key = normalizeScoreDungeonText(hint);
    if (!key) return false;
    const options = Array.from(select.options).filter(option => option.value);
    const matches = options
        .map(option => ({
            option,
            nameKey: normalizeScoreDungeonText(option.dataset.name || ''),
            textKey: normalizeScoreDungeonText(option.textContent || '')
        }))
        .filter(item => item.nameKey === key || item.nameKey.includes(key) || key.includes(item.nameKey) || item.textKey.includes(key))
        .sort((a, b) => a.nameKey.length - b.nameKey.length);
    if (!matches.length) return false;
    select.value = matches[0].option.value;
    showToast(`已自动匹配副本：${matches[0].option.dataset.name || matches[0].option.textContent || ''}`);
    return true;
}

function getScoreSettlementSearchQuery() {
    return String(document.getElementById('scoreSettlementSearch')?.value || '').trim().slice(0, 80);
}

async function fetchScoreSettlements(limit = 50, dungeonQuery = '') {
    if (!canSettleScores()) return { settlements: [], error: { message: '需要审核员权限' } };
    if (USE_LOCAL_FALLBACK) return { settlements: [], error: null };
    const { data, error } = await invokeDungeonAction('listScoreSettlements', { limit, dungeonQuery });
    if (error) return { settlements: [], error };
    return { settlements: Array.isArray(data) ? data : [], error: null };
}

function renderScoreSettlementsPanel() {
    const panel = document.getElementById('scoreSettlementsPanel');
    if (panel) panel.innerHTML = renderScoreSettlements(scoreSettlementState.settlements, scoreSettlementState.error);
}

function queueScoreSettlementSearch() {
    window.clearTimeout(scoreSettlementSearchTimer);
    scoreSettlementSearchTimer = window.setTimeout(() => refreshScoreSettlementsPanel(), 260);
}

async function refreshScoreSettlementsPanel(expectedSettlementId = '') {
    const panel = document.getElementById('scoreSettlementsPanel');
    if (!panel) {
        await renderScorePage();
        return;
    }
    panel.innerHTML = '<div class="profile-empty">最近结算刷新中...</div>';
    const dungeonQuery = getScoreSettlementSearchQuery();
    let result = await fetchScoreSettlements(50, dungeonQuery);
    const expectedId = String(expectedSettlementId || '');
    if (expectedId && !result.error && !result.settlements.some(item => String(item.id) === expectedId)) {
        await new Promise(resolve => setTimeout(resolve, 700));
        result = await fetchScoreSettlements(50, dungeonQuery);
    }
    scoreSettlementState = result;
    renderScoreSettlementsPanel();
    const count = document.getElementById('scoreRecentCount');
    if (count && !result.error) count.textContent = String(result.settlements?.length || 0);
    if (result.error) showToast(`❌ 最近结算刷新失败：${result.error.message || '请手动刷新'}`);
    else showToast('最近结算已刷新');
}

function renderScoreSettlementDetail(settlementId) {
    if (!scoreSettlementExpanded.has(settlementId)) return '';
    const detail = scoreSettlementDetails.get(settlementId);
    if (!detail) return '<div class="score-settlement-detail">正在读取本场加分明细...</div>';
    const entries = Array.isArray(detail.entries) ? detail.entries : [];
    if (!entries.length) return '<div class="score-settlement-detail">本场没有可展示的玩家加分明细。</div>';
    return `<div class="score-settlement-detail">
        <div class="score-settlement-detail-title">本场玩家加分</div>
        <div class="score-settlement-entry-list">${entries.map(entry => `
            <div class="score-settlement-entry-row">
                <strong>${escapeHtml(entry.player_name || '未命名玩家')}</strong>
                <span>登神 ${escapeHtml(formatScoreNumber(entry.score_deng, true))}</span>
                <span>觐见 ${escapeHtml(formatScoreNumber(entry.score_jin, true))}</span>
                <span>合计 ${escapeHtml(formatScoreNumber(entry.total_add, true))}</span>
            </div>`).join('')}</div>
    </div>`;
}

function renderScoreSettlements(settlements, error) {
    if (error) return `<div class="profile-empty">${escapeHtml(error.message || '结算记录暂不可用。')}</div>`;
    if (!settlements.length) return '<div class="profile-empty">最近 48 小时内没有匹配的加分记录。</div>';
    return `<div class="profile-list">${settlements.map(item => `
        <article class="profile-list-item">
            <div class="profile-list-title">
                <span>${item.is_revoked ? '<span class="profile-notice-mark">已撤销</span> ' : ''}${escapeHtml(item.dungeon_name || '未命名副本')}</span>
                <small>${escapeHtml(formatDate(item.created_at))}</small>
            </div>
            <div class="profile-list-meta">审核员 ${escapeHtml(item.operator_name || '')} · ${escapeHtml(item.source_type || '')} · ${Number(item.total_players || 0)} 人</div>
            <div class="metric-strip">
                <span class="metric-pill">登神 <strong>${escapeHtml(formatScoreNumber(item.total_ascension, true))}</strong></span>
                <span class="metric-pill">觐见 <strong>${escapeHtml(formatScoreNumber(item.total_audience, true))}</strong></span>
                <span class="metric-pill">总变化 <strong>${escapeHtml(formatScoreNumber(item.total_score, true))}</strong></span>
            </div>
            <div class="profile-tools" style="margin-top:10px;">
                <button class="btn btn-outline btn-sm" onclick='toggleScoreSettlementDetail(${jsString(item.id)})'>${scoreSettlementExpanded.has(item.id) ? '收起明细' : '查看明细'}</button>
                ${item.is_revoked ? '' : `<button class="btn btn-outline btn-sm" data-score-action="revoke-${escapeHtml(item.id)}" onclick='revokeScoreSettlementUI(${jsString(item.id)})'>撤销本场结算</button>`}
            </div>
            ${item.is_revoked ? `<div class="profile-list-meta">撤销备注：${escapeHtml(item.revoke_remark || '')}</div>` : ''}
            ${renderScoreSettlementDetail(item.id)}
        </article>`).join('')}</div>`;
}

async function toggleScoreSettlementDetail(settlementId) {
    const id = String(settlementId || '');
    if (!id) return;
    if (scoreSettlementExpanded.has(id)) {
        scoreSettlementExpanded.delete(id);
        renderScoreSettlementsPanel();
        return;
    }
    scoreSettlementExpanded.add(id);
    renderScoreSettlementsPanel();
    if (scoreSettlementDetails.has(id)) return;
    const lockKey = `score-settlement-detail:${id}`;
    if (!acquireUiActionLock(lockKey, '本场明细正在读取，请勿重复点击')) return;
    try {
        const { data, error } = await invokeDungeonAction('getScoreSettlementDetail', { settlementId: id });
        if (error) {
            scoreSettlementExpanded.delete(id);
            showToast(`❌ ${error.message || '读取加分明细失败'}`);
            return;
        }
        scoreSettlementDetails.set(id, data || { entries: [] });
    } finally {
        releaseUiActionLock(lockKey);
        renderScoreSettlementsPanel();
    }
}

async function revokeScoreSettlementUI(settlementId) {
    const lockKey = `revoke-${settlementId}`;
    if (scoreActionLocks.has(lockKey)) { showToast('撤销正在处理中，请等待结果'); return; }
    const revokeRemark = window.prompt('请输入撤销备注');
    if (!revokeRemark) return;
    if (!window.confirm('确认撤销这场结算并回滚对应分数？')) return;
    scoreActionLocks.add(lockKey);
    setScoreActionBusy(lockKey, true, '撤销中...');
    showToast('撤销处理中，请勿重复点击');
    try {
        const { error } = await invokeDungeonAction('revokeScoreSettlement', { settlementId, revokeRemark });
        if (error) { showToast(`❌ ${error.message || '撤销失败'}`); return; }
        showToast('结算已撤销并回滚分数');
        await renderScorePage();
    } finally {
        scoreActionLocks.delete(lockKey);
        setScoreActionBusy(lockKey, false);
    }
}

function formatAdminTime(value) {
    const date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? '时间未记录' : date.toLocaleString('zh-CN', { hour12: false });
}

function renderAdminHonorRows(items, type, targetName) {
    if (!items?.length) return renderRitualEmpty(`该玩家尚无${type === 'title' ? '称号' : '诅咒'}记录。`, '真理', '暂无记录');
    return items.map(item => {
        const active = !!item.is_active;
        const label = type === 'title' ? item.title_text : item.curse_text;
        const source = type === 'title' ? item.title_god : item.curse_god;
        const typeLabel = type === 'curse' ? ` · ${getProfileCurseTypeLabel(item.curse_type || item.curseType)}` : '';
        const action = active
            ? `<button class="btn btn-outline btn-sm" onclick="adminRevokeHonor('${type}', ${Number(item.id)}, ${escapeHtml(jsString(targetName))}, ${escapeHtml(jsString(label))})">回收</button>`
            : `<button class="btn btn-primary btn-sm" onclick="adminRestoreHonor('${type}', ${Number(item.id)}, ${escapeHtml(jsString(targetName))}, ${escapeHtml(jsString(label))})">恢复</button>`;
        return `<div class="profile-title-status ${type === 'curse' ? 'profile-curse-status' : ''}">
            <div class="profile-title-status-head"><strong>${escapeHtml(label || '未命名')}</strong><small>${active ? '生效中' : '已回收'}</small></div>
            <div class="profile-title-status-note">${escapeHtml(source || '馆主亲授')}${escapeHtml(typeLabel)} · ${escapeHtml(item.granted_by_name || '未记录')} · ${escapeHtml(formatAdminTime(item.granted_at))}</div>
            ${item.title_note || item.curse_note ? `<div class="profile-title-status-note">${escapeHtml(item.title_note || item.curse_note)}</div>` : ''}
            <div class="profile-tools">${action}</div>
        </div>`;
    }).join('');
}

function renderAdminTalentRows(snapshot) {
    const talents = snapshot.talents || [];
    if (!talents.length) return renderRitualEmpty('该玩家尚未拥有任何天赋。', '真理', '仓库为空');
    return talents.map(item => {
        const placement = item.equipped_slot ? `携带槽 ${item.equipped_slot}` : (item.storage_slot ? `仓库 ${item.storage_slot} 号位` : '未分配');
        return `<div class="profile-title-status"><div class="profile-title-status-head"><strong>${escapeHtml(item.talent_name)} · ${escapeHtml(item.rank)}</strong><small>${escapeHtml(placement)}</small></div><div class="profile-title-status-note">${escapeHtml(item.pool_key)} · ${escapeHtml(item.acquired_from || '未知来源')} · ${escapeHtml(formatAdminTime(item.acquired_at))}</div></div>`;
    }).join('');
}

function renderAdminOperationRows(logs, unavailable = false) {
    if (unavailable) return renderRitualEmpty('请先运行 admin_operation_logs_migration_20260719.sql，启用统一操作审计。', '真理', '日志未启用');
    if (!logs?.length) return renderRitualEmpty('尚未记录馆主后台操作。', '真理', '暂无操作');
    return logs.map(log => `<div class="profile-title-status"><div class="profile-title-status-head"><strong>${escapeHtml(log.action || '后台操作')}</strong><small>${escapeHtml(formatAdminTime(log.created_at))}</small></div><div class="profile-title-status-note">操作者：${escapeHtml(log.actor_name || '未记录')} · 对象：${escapeHtml(log.target_name || log.object_type || '全站')}</div>${log.summary ? `<div class="profile-title-status-note">${escapeHtml(log.summary)}</div>` : ''}</div>`).join('');
}

function renderAdminSnapshot(snapshot) {
    const profile = snapshot.profile || {};
    const anomaly = snapshot.anomalies || { hasIssues: false, messages: [] };
    const scoreLogs = snapshot.scoreLogs || [];
    const overflow = snapshot.overflowChoices || [];
    return `
        <section class="profile-hero" data-god="真理" data-motif="CURATOR CONSOLE" style="${getGodSkinStyle('真理')}">
            <div class="profile-avatar ${getGodClass('真理')}" style="${getGodSkinStyle('真理')}">${renderGodSigil('真理', 'lg')}</div>
            <div class="profile-hero-copy"><div class="profile-kicker">PLAYER BACKSTAGE DOSSIER</div><h1 class="profile-name">${escapeHtml(profile.displayName || '未命名档案')}</h1><div class="profile-subline"><span class="metric-pill">${escapeHtml(ROLE_LABELS[profile.role] || profile.role || '未知身份')}</span><span class="metric-pill">${escapeHtml(profile.faithPath || '未定命途')} · ${escapeHtml(profile.faithGod || '未定信仰')}</span><span class="metric-pill">${escapeHtml(profile.profession || '未定职业')}</span></div><div class="profile-faith-prayer">档案最后更新：${escapeHtml(formatAdminTime(profile.updatedAt))}</div></div>
            <div class="profile-hero-stats"><div class="profile-hero-score"><span>登神之路</span><strong>${formatProfileScore(profile.ascensionScore)}</strong></div><div class="profile-hero-score"><span>觐见之梯</span><strong>${formatProfileScore(profile.audienceScore)}</strong></div></div>
        </section>
        <div class="profile-grid">
            <div>
                <section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}"><div class="profile-panel-title"><span>称号册</span><small>${(snapshot.titles || []).length} 条记录</small></div>${renderAdminHonorRows(snapshot.titles || [], 'title', profile.displayName)}</section>
                <section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}"><div class="profile-panel-title"><span>诅咒册</span><small>${(snapshot.curses || []).length} 条记录</small></div>${renderAdminHonorRows(snapshot.curses || [], 'curse', profile.displayName)}</section>
                <section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}"><div class="profile-panel-title"><span>分数记录</span><small>最近 ${scoreLogs.length} 条</small></div>${scoreLogs.length ? scoreLogs.map(log => `<div class="profile-title-status"><div class="profile-title-status-head"><strong>${escapeHtml(log.source_type || '结算')} · 登神 ${Number(log.change_deng || 0) >= 0 ? '+' : ''}${Number(log.change_deng || 0)} / 觐见 +${Number(log.change_jin || 0)}</strong><small>${escapeHtml(formatAdminTime(log.created_at))}</small></div><div class="profile-title-status-note">审核：${escapeHtml(log.operator_name || '未记录')}</div></div>`).join('') : renderRitualEmpty('暂无分数变动记录。', '真理', '记录为空')}</section>
            </div>
            <div>
                <section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}"><div class="profile-panel-title"><span>天赋状态</span><small>碎片 ${Number(snapshot.fragments || 0)}</small></div><div class="profile-score-row"><div class="profile-stat-card"><span>仓库</span><strong>${(snapshot.talents || []).filter(item => item.storage_slot).length}/${Number(snapshot.inventorySlotLimit || 10)}</strong></div><div class="profile-stat-card"><span>待取舍</span><strong>${overflow.length}</strong></div></div><div class="profile-tools"><button class="btn btn-outline btn-sm" data-admin-scan onclick="adminScanTalentState()">扫描异常</button><button class="btn btn-primary btn-sm" data-admin-repair onclick="adminRepairTalentState()">修复可处理项</button></div><div class="identity-help">${anomaly.hasIssues ? escapeHtml(anomaly.messages.join('；')) : '未发现天赋仓库异常。'}</div></section>
                <section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}"><div class="profile-panel-title"><span>天赋仓库</span><small>仓库 / 携带槽</small></div>${renderAdminTalentRows(snapshot)}</section>
                <section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}"><div class="profile-panel-title"><span>溢出待取舍</span><small>${overflow.length} 项</small></div>${overflow.length ? overflow.map(item => `<div class="profile-title-status"><div class="profile-title-status-head"><strong>${escapeHtml(item.talent_name)} · ${escapeHtml(item.rank)}</strong><small>${escapeHtml(item.source || 'draw')}</small></div><div class="profile-title-status-note">${escapeHtml(item.pool_key)} · ${escapeHtml(formatAdminTime(item.created_at))}</div></div>`).join('') : renderRitualEmpty('没有待取舍溢出项。', '真理', '队列为空')}</section>
                <section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}"><div class="profile-panel-title"><span>该玩家最近操作</span><small>${(snapshot.operationLogs || []).length} 条</small></div>${renderAdminOperationRows(snapshot.operationLogs || [], snapshot.operationLogsUnavailable)}</section>
            </div>
        </div>`;
}

async function renderAdminPage() {
    const container = document.getElementById('adminContent');
    if (!container) return;
    if (!canOpenAdminWorkspace()) { container.innerHTML = renderRitualEmpty('此处只对神谕馆主与管理席开放。', '真理', '权限不足'); return; }
    if (!isAdmin()) {
        container.innerHTML = typeof renderPermissionDeskContent === 'function'
            ? renderPermissionDeskContent()
            : renderRitualEmpty('权限工作台尚未载入。', '真理', '等待载入');
        return;
    }
    const lookup = adminLookupState.snapshot ? `<div class="admin-snapshot">${renderAdminSnapshot(adminLookupState.snapshot)}</div>` : renderRitualEmpty('暂无查询结果。', '真理', '等待查询');
    const globalOperations = `<section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}"><div class="profile-panel-title"><span>全站最近操作</span><small>最近 50 条</small></div>${renderAdminOperationRows(adminRecentOperations, adminOperationsUnavailable)}</section>`;
    const workbench = typeof renderPermissionDeskContent === 'function' ? renderPermissionDeskContent() : '';
    container.innerHTML = `${workbench}<section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}"><div class="profile-panel-title"><span>玩家查询</span><small>仅馆主可见</small></div><div class="profile-form-grid"><div class="form-group full"><label>玩家昵称</label><input id="adminTargetName" maxlength="40" value="${escapeHtml(adminLookupState.targetName || '')}" placeholder="输入已保存个人档案的昵称" onkeydown="if(event.key==='Enter') adminLookupPlayer()"></div></div><div class="profile-tools"><button class="btn btn-primary btn-sm" data-admin-lookup onclick="adminLookupPlayer()">查询档案</button></div></section>${globalOperations}${lookup}`;
}

async function refreshAdminOperationLogs() {
    if (!isAdmin()) return;
    const { data, error } = await invokeDungeonAction('adminListOperationLogs');
    if (error) {
        adminRecentOperations = [];
        adminOperationsUnavailable = true;
        return;
    }
    adminRecentOperations = Array.isArray(data?.logs) ? data.logs : [];
    adminOperationsUnavailable = !!data?.unavailable;
}

async function adminLookupPlayer(targetName = '') {
    if (!isAdmin()) { showToast('只有神谕馆主可以查询后台档案'); return; }
    const name = cleanDisplayNameInput(targetName || document.getElementById('adminTargetName')?.value || '');
    if (!name) { showToast('请输入玩家昵称'); return; }
    if (!acquireUiActionLock(`adminLookup:${name}`, '该玩家档案正在读取，请勿重复点击')) return;
    const restore = setActionButtonsBusy('[data-admin-lookup]', '读取中...');
    try {
        const { data, error } = await invokeDungeonAction('adminLookupPlayer', { targetName: name });
        if (error) { showToast(`❌ ${error.message || '玩家档案读取失败'}`); return; }
        adminLookupState = { targetName: name, snapshot: data };
        await refreshAdminOperationLogs();
        await renderAdminPage();
        showToast(`已读取 ${name} 的馆主后台档案`);
    } finally { restore(); releaseUiActionLock(`adminLookup:${name}`); }
}

async function adminScanTalentState() {
    const name = adminLookupState.targetName;
    if (!name) { showToast('请先查询玩家档案'); return; }
    if (!acquireUiActionLock(`adminScan:${name}`, '天赋状态正在扫描，请勿重复点击')) return;
    const restore = setActionButtonsBusy('[data-admin-scan]', '扫描中...');
    try {
        const { data, error } = await invokeDungeonAction('adminScanTalentState', { targetName: name });
        if (error) { showToast(`❌ ${error.message || '天赋扫描失败'}`); return; }
        if (adminLookupState.snapshot) adminLookupState.snapshot.anomalies = data?.anomalies || { hasIssues: false, messages: [] };
        await refreshAdminOperationLogs();
        await renderAdminPage();
        showToast(data?.anomalies?.hasIssues ? '扫描完成，发现需要处理的天赋状态' : '扫描完成，未发现天赋异常');
    } finally { restore(); releaseUiActionLock(`adminScan:${name}`); }
}

async function adminRepairTalentState() {
    const name = adminLookupState.targetName;
    if (!name) { showToast('请先查询玩家档案'); return; }
    if (!window.confirm(`确认修复 ${name} 的可自动处理天赋状态？不会删除已拥有天赋。`)) return;
    if (!acquireUiActionLock(`adminRepair:${name}`, '天赋状态正在修复，请勿重复点击')) return;
    const restore = setActionButtonsBusy('[data-admin-repair]', '修复中...');
    try {
        const { data, error } = await invokeDungeonAction('adminRepairTalentState', { targetName: name });
        if (error) { showToast(`❌ ${error.message || '天赋修复失败'}`); return; }
        adminLookupState.snapshot = data?.snapshot || adminLookupState.snapshot;
        await refreshAdminOperationLogs();
        await renderAdminPage();
        const count = Array.isArray(data?.repaired) ? data.repaired.length : 0;
        showToast(count ? `已完成 ${count} 项天赋状态修复` : '没有可自动修复的天赋项');
    } finally { restore(); releaseUiActionLock(`adminRepair:${name}`); }
}

async function adminRevokeHonor(type, id, targetName, label) {
    const action = type === 'title' ? 'revokeProfileTitle' : 'revokeProfileCurse';
    const key = `adminRevoke:${type}:${id}`;
    if (!window.confirm(`确认回收 ${targetName} 的${type === 'title' ? '称号' : '诅咒'}「${label}」？`)) return;
    if (!acquireUiActionLock(key, '回收正在处理，请勿重复点击')) return;
    try {
        const payload = type === 'title' ? { targetName, titleId: id } : { targetName, curseId: id };
        const { error } = await invokeDungeonAction(action, payload);
        if (error) { showToast(`❌ ${error.message || '回收失败'}`); return; }
        showToast(`已回收「${label}」`);
        await adminLookupPlayer(targetName);
    } finally { releaseUiActionLock(key); }
}

async function adminRestoreHonor(type, id, targetName, label) {
    const action = type === 'title' ? 'restoreProfileTitle' : 'restoreProfileCurse';
    const key = `adminRestore:${type}:${id}`;
    if (!window.confirm(`确认恢复 ${targetName} 的${type === 'title' ? '称号' : '诅咒'}「${label}」？`)) return;
    if (!acquireUiActionLock(key, '恢复正在处理，请勿重复点击')) return;
    try {
        const payload = type === 'title' ? { targetName, titleId: id } : { targetName, curseId: id };
        const { error } = await invokeDungeonAction(action, payload);
        if (error) { showToast(`❌ ${error.message || '恢复失败'}`); return; }
        showToast(`已恢复「${label}」`);
        await adminLookupPlayer(targetName);
    } finally { releaseUiActionLock(key); }
}

async function openAdminPage() {
    if (!canOpenAdminWorkspace()) { showToast('只有馆主或管理席可以进入后台'); return; }
    adminScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    ['profilePage', 'leaderboardPage', 'scorePage', 'matchPage', 'permissionPage'].forEach(id => { const page = document.getElementById(id); if (page) page.style.display = 'none'; });
    document.body.classList.remove('profile-view-open', 'leaderboard-view-open', 'score-view-open', 'match-view-open');
    document.body.classList.add('profile-view-open');
    document.getElementById('adminPage').style.display = 'block';
    window.scrollTo(0, 0);
    if (isAdmin()) await refreshAdminOperationLogs();
    await renderAdminPage();
}

function closeAdminPage(restoreScroll = true) {
    const page = document.getElementById('adminPage');
    if (page) page.style.display = 'none';
    document.body.classList.remove('profile-view-open');
    if (restoreScroll !== false) requestAnimationFrame(() => window.scrollTo(0, adminScrollY || 0));
}

Object.assign(window, {
    adminLookupPlayer,
    adminScanTalentState,
    adminRepairTalentState,
    adminRevokeHonor,
    adminRestoreHonor,
    openAdminPage,
    closeAdminPage
});

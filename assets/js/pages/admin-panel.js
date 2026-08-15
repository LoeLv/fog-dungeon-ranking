// Admin panel helpers for titles, curses, believer operations, and snapshot rendering.

function renderTitlePlayerOptions(entries, mode = 'title') {
    const godName = isGodRole() ? cleanGodName(inviteSession?.name || '') : '';
    return (entries || [])
        .filter(entry => {
            if (!entry.displayName || entry.displayName === '未命名信徒') return false;
            if (!godName) return true;
            const faithGod = cleanGodName(entry.faithGod || '');
            return mode === 'curse' ? faithGod && faithGod !== godName : faithGod === godName;
        })
        .map(entry => {
            const titleCount = normalizeProfileTitleList(entry.activeTitles, entry.activeTitle).length;
            const curseCount = normalizeProfileCurseList(entry.activeCurses, entry.activeCurse).length;
            const titleLabel = titleCount ? `｜称号${titleCount}` : '';
            const curseLabel = curseCount ? `｜诅咒${curseCount}` : '';
            const faithLabel = entry.faithGod ? `｜${entry.faithGod}信徒` : '';
            return `<option value="${escapeHtml(entry.displayName)}">${escapeHtml(entry.displayName)}${escapeHtml(faithLabel + titleLabel + curseLabel)}</option>`;
        })
        .join('');
}

function renderGodSelectOptions(selected = '') {
    const cleanSelected = cleanGodName(selected || '');
    return '<option value="">馆主亲授</option>' + GOD_GROUPS.map(group =>
        `<optgroup label="${escapeHtml(group.path)}命途">${group.gods.map(god => `<option value="${escapeHtml(god)}" ${god === cleanSelected ? 'selected' : ''}>${escapeHtml(god)}之神</option>`).join('')}</optgroup>`
    ).join('');
}

function renderHonorActionStatus() {
    const type = honorActionStatus?.type === 'error'
        ? 'error'
        : (honorActionStatus?.type === 'pending' ? 'pending' : (honorActionStatus?.type === 'success' ? 'success' : ''));
    const message = honorActionStatus?.message || '等待称号或诅咒操作。';
    return `<div id="honorActionStatus" class="profile-action-status ${type}">${escapeHtml(message)}</div>`;
}

function setHonorActionStatus(message, type = 'success') {
    honorActionStatus = { message, type };
    const el = document.getElementById('honorActionStatus');
    if (el) {
        el.className = `profile-action-status ${type === 'error' ? 'error' : (type === 'pending' ? 'pending' : 'success')}`;
        el.textContent = message;
    }
}

function renderHonorOperationLogPanel() {
    const title = isGodRole() ? '本神最近敕令' : '称号诅咒最近敕令';
    const note = isGodRole() ? '仅显示你自己发出的称号/诅咒操作' : '最近 30 条称号/诅咒操作';
    const body = honorOperationLogsLoading
        ? '<div class="profile-empty">正在读取敕令日志...</div>'
        : renderAdminOperationRows(honorOperationLogs, honorOperationLogsUnavailable);
    return `
        <section class="profile-panel" data-god="${escapeHtml(isGodRole() ? (inviteSession?.name || '命运') : '真理')}" style="${getGodSkinStyle(isGodRole() ? (inviteSession?.name || '命运') : '真理')}">
            <div class="profile-panel-title"><span>${escapeHtml(title)}</span><small>${escapeHtml(note)}</small></div>
            <div class="profile-tools" style="margin-bottom:10px;">
                <button class="btn btn-outline btn-sm" data-honor-log-refresh onclick="refreshHonorOperationLogs(true)">刷新日志</button>
            </div>
            <div id="honorOperationLogRows">${body}</div>
        </section>`;
}

function renderHonorOperationLogRows() {
    const container = document.getElementById('honorOperationLogRows');
    if (!container) return;
    container.innerHTML = honorOperationLogsLoading
        ? '<div class="profile-empty">正在读取敕令日志...</div>'
        : renderAdminOperationRows(honorOperationLogs, honorOperationLogsUnavailable);
}

function renderGodBelieverOptions() {
    const list = Array.isArray(godBelievers) ? godBelievers : [];
    if (!list.length) {
        return '<option value="">暂无信徒，请先刷新</option>';
    }
    return '<option value="">请选择信徒</option>' + list.map(entry => {
        const displayName = String(entry.display_name || '').trim();
        const faith = String(entry.faith_god || '').trim();
        const profession = String(entry.profession || '').trim();
        const ascension = Number(entry.ascension_score || 0);
        const audience = Number(entry.audience_score || 0);
        return `<option value="${escapeHtml(String(entry.invite_code_hash || ''))}" data-faith="${escapeHtml(faith)}" data-profession="${escapeHtml(profession)}">${escapeHtml(displayName)}｜${escapeHtml(faith)}｜${escapeHtml(profession)}｜登神${ascension}｜觐见${audience}</option>`;
    }).join('');
}

function renderGodConversionFaithOptions(selected = '') {
    const actorGod = cleanGodName(inviteSession?.name || '');
    const cleanSelected = cleanGodName(selected || '');
    return '<option value="">请选择新的信仰神明</option>' + GOD_GROUPS.flatMap(group => group.gods)
        .filter(god => god !== actorGod)
        .map(god => `<option value="${escapeHtml(god)}" ${god === cleanSelected ? 'selected' : ''}>${escapeHtml(getGodIcon(god))} ${escapeHtml(god)}之神 · ${escapeHtml(getGodInfo(god).path)}命途</option>`)
        .join('');
}

function renderGodBelieverStatus() {
    const type = godBelieverStatus?.type === 'error'
        ? 'error'
        : (godBelieverStatus?.type === 'pending' ? 'pending' : (godBelieverStatus?.type === 'success' ? 'success' : ''));
    const message = godBelieverStatus?.message || '等待神明改信敕令。';
    return `<div id="godBelieverStatus" class="profile-action-status ${type}">${escapeHtml(message)}</div>`;
}

function renderGodBelieverRows() {
    if (godBelieversLoading) return '<div class="profile-empty">正在读取本神信徒名单...</div>';
    const list = Array.isArray(godBelievers) ? godBelievers : [];
    if (!list.length) return '<div class="profile-empty">暂无属于本神的信徒，请先刷新或确认信仰是否绑定正确。</div>';
    return list.map(entry => `<article class="profile-list-item">
        <div class="profile-list-title"><span>${escapeHtml(String(entry.display_name || ''))}</span><small>${escapeHtml(String(entry.role || ''))}</small></div>
        <div class="profile-list-meta">${escapeHtml(String(entry.faith_god || ''))} · ${escapeHtml(String(entry.profession || ''))}</div>
        <div class="profile-list-meta">登神 ${Number(entry.ascension_score || 0)} / 觐见 ${Number(entry.audience_score || 0)}</div>
    </article>`).join('');
}

function setGodBelieverStatus(message, type = 'success') {
    godBelieverStatus = { message, type };
    const el = document.getElementById('godBelieverStatus');
    if (el) {
        el.className = `profile-action-status ${type === 'error' ? 'error' : (type === 'pending' ? 'pending' : 'success')}`;
        el.textContent = message;
    }
}

function updateGodConversionProfessionOptions() {
    const faithSelect = document.getElementById('godConvertFaithSelect');
    const professionSelect = document.getElementById('godConvertProfessionSelect');
    if (!faithSelect || !professionSelect) return;
    professionSelect.innerHTML = renderProfileProfessionOptions('', faithSelect.value || '');
}

function syncGodConversionSelection() {
    const believerSelect = document.getElementById('godConvertTargetSelect');
    const faithSelect = document.getElementById('godConvertFaithSelect');
    const professionSelect = document.getElementById('godConvertProfessionSelect');
    if (!believerSelect || !faithSelect || !professionSelect) return;
    const selected = Array.isArray(godBelievers) ? godBelievers.find(entry => String(entry.invite_code_hash || '') === believerSelect.value) : null;
    if (!selected) return;
    const currentFaith = cleanGodName(selected.faith_god || '');
    const nextFaith = GOD_GROUPS.flatMap(group => group.gods).find(god => god !== currentFaith && god !== cleanGodName(inviteSession?.name || '')) || '';
    faithSelect.value = nextFaith;
    updateGodConversionProfessionOptions();
    const professionInfo = getProfessionInfo(String(selected.profession || ''));
    const nextProfession = professionInfo.known && getProfessionInfo(String(selected.profession || '')).god === faithSelect.value
        ? String(selected.profession || '')
        : (Object.values((PROFESSION_GROUPS.find(group => group.god === faithSelect.value) || {}).careers || {})[0] || '');
    professionSelect.value = nextProfession;
}

function renderGodCommandPanel() {
    if (!isGodRole()) return '';
    const godName = cleanGodName(inviteSession?.name || '') || '命运';
    const currentBeliever = Array.isArray(godBelievers) ? godBelievers[0] : null;
    const currentFaith = currentBeliever ? cleanGodName(currentBeliever.faith_god || '') : godName;
    const initialFaith = GOD_GROUPS.flatMap(group => group.gods).find(god => god !== currentFaith && god !== godName) || '';
    const initialProfession = Object.values((PROFESSION_GROUPS.find(group => group.god === initialFaith) || {}).careers || {})[0] || '';
    return `
        ${renderGodBelieverStatus()}
        <section class="profile-panel" data-god="${escapeHtml(godName)}" style="${getGodSkinStyle(godName)}">
            <div class="profile-panel-title"><span>神明改信区</span></div>
            <div class="profile-form-grid">
                <div class="form-group full">
                    <label>目标信徒</label>
                    <select id="godConvertTargetSelect" onchange="syncGodConversionSelection()">${renderGodBelieverOptions()}</select>
                </div>
                <div class="form-group">
                    <label>新的信仰神明</label>
                    <select id="godConvertFaithSelect" onchange="updateGodConversionProfessionOptions()">${renderGodConversionFaithOptions(initialFaith)}</select>
                </div>
                <div class="form-group">
                    <label>新的职业</label>
                    <select id="godConvertProfessionSelect">${renderProfileProfessionOptions(initialProfession, initialFaith)}</select>
                </div>
                <div class="form-group full">
                    <label class="identity-help"><input type="checkbox" id="godConvertCurseEnabled" onchange="toggleGodConversionCurseFields()"> 追加诅咒（可选）</label>
                </div>
                <div class="form-group"><label>诅咒名字</label><input id="godConvertCurseName" maxlength="32" placeholder="勾选后填写" disabled></div>
                <div class="form-group"><label>诅咒效果</label><input id="godConvertCurseEffect" maxlength="120" placeholder="勾选后填写" disabled></div>
            </div>
            <div class="profile-tools">
                <button class="btn btn-outline btn-sm" data-god-convert-action="profession" onclick="godChangeBelieverProfessionUI()">单独改职业</button>
                <button class="btn btn-primary btn-sm" data-god-convert-action="convert" onclick="godConvertBelieverUI()">执行改信敕令</button>
                <button class="btn btn-outline btn-sm" data-god-convert-action="refresh" onclick="refreshGodBelievers(true)">刷新信徒名单</button>
            </div>
            <div id="godBelieverPanel" class="profile-list" style="margin-top:14px;">${renderGodBelieverRows()}</div>
        </section>`;
}

async function godChangeBelieverProfessionUI() {
    if (!isGodRole()) { showToast('只有神明账号可以单独改职业'); return; }
    const targetHash = String(document.getElementById('godConvertTargetSelect')?.value || '').trim();
    const target = Array.isArray(godBelievers) ? godBelievers.find(entry => String(entry.invite_code_hash || '') === targetHash) : null;
    if (!targetHash || !target) { showToast('请先选择要改职业的信徒'); return; }
    const faithGod = cleanGodName(target.faith_god || '');
    const careers = Object.values((PROFESSION_GROUPS.find(group => group.god === faithGod) || {}).careers || {});
    const profession = String(window.prompt(`请输入新职业（可选：${careers.join('、')}），当前：${target.profession || '未设置'}`, careers[0] || '') || '').trim();
    if (!profession) return;
    if (!careers.includes(profession)) { showToast('职业不属于该信仰，请从提示列表中选择'); return; }
    if (!window.confirm(`确认将 ${target.display_name} 的职业改为 ${profession}？这会清空天赋和碎片，并返还已用抽数。`)) return;
    const lockKey = `godProfession:${targetHash}:${profession}`;
    if (!acquireUiActionLock(lockKey, '职业调整正在处理，请勿重复点击')) return;
    setGodBelieverStatus(`正在调整职业：${target.display_name} -> ${profession}...`, 'pending');
    const restore = setActionButtonsBusy('[data-god-convert-action]', '处理中...');
    try {
        const { data, error } = await invokeDungeonAction('godChangeBelieverProfession', { targetHash, targetName: target.display_name, profession });
        if (error) {
            const message = `职业调整失败：${error.message || '后端未返回原因'}`;
            setGodBelieverStatus(message, 'error');
            showToast(`❌ ${message}`);
            return;
        }
        const message = `职业调整成功：${data?.targetName || target.display_name} 已改为 ${profession}，天赋、碎片和已用抽数已重置`;
        setGodBelieverStatus(message, 'success');
        showToast(message);
        await refreshGodBelievers(false);
        if (document.getElementById('profilePage')?.style.display !== 'none') await renderProfilePage();
    } finally {
        restore();
        releaseUiActionLock(lockKey);
    }
}

function toggleGodConversionCurseFields() {
    const enabled = !!document.getElementById('godConvertCurseEnabled')?.checked;
    const nameInput = document.getElementById('godConvertCurseName');
    const effectInput = document.getElementById('godConvertCurseEffect');
    if (nameInput) nameInput.disabled = !enabled;
    if (effectInput) effectInput.disabled = !enabled;
}

async function refreshGodBelievers(showResult = false) {
    if (!isGodRole()) return;
    godBelieversLoading = true;
    const panel = document.getElementById('godBelieverPanel');
    if (panel) panel.innerHTML = '<div class="profile-empty">正在读取本神信徒名单...</div>';
    try {
        const { data, error } = await invokeDungeonAction('listGodBelievers', {});
        if (error) {
            godBelievers = [];
            if (showResult) showToast(`❌ ${error.message || '信徒名单读取失败'}`);
            return;
        }
        godBelievers = Array.isArray(data?.believers) ? data.believers : [];
        if (showResult) showToast(`已加载 ${godBelievers.length} 位信徒`);
    } finally {
        godBelieversLoading = false;
        const targetSelect = document.getElementById('godConvertTargetSelect');
        if (targetSelect) targetSelect.innerHTML = renderGodBelieverOptions();
        const container = document.getElementById('godBelieverPanel');
        if (container) container.innerHTML = renderGodBelieverRows();
    }
}

async function godConvertBelieverUI() {
    if (!isGodRole()) { showToast('只有神明账号可以执行改信敕令'); return; }
    const targetHash = String(document.getElementById('godConvertTargetSelect')?.value || '').trim();
    const faithGod = cleanGodName(document.getElementById('godConvertFaithSelect')?.value || '');
    const profession = normalizeProfession(document.getElementById('godConvertProfessionSelect')?.value || '');
    const curseEnabled = !!document.getElementById('godConvertCurseEnabled')?.checked;
    const curseName = String(document.getElementById('godConvertCurseName')?.value || '').trim().slice(0, 32);
    const curseEffect = String(document.getElementById('godConvertCurseEffect')?.value || '').trim().slice(0, 120);
    const target = Array.isArray(godBelievers) ? godBelievers.find(entry => String(entry.invite_code_hash || '') === targetHash) : null;
    if (!targetHash || !target) {
        const message = '请先选择要改信的信徒';
        setGodBelieverStatus(message, 'error');
        showToast(message);
        return;
    }
    if (!faithGod) {
        const message = '请选择新的信仰神明';
        setGodBelieverStatus(message, 'error');
        showToast(message);
        return;
    }
    if (!profession) {
        const message = '请选择新的职业';
        setGodBelieverStatus(message, 'error');
        showToast(message);
        return;
    }
    const professionInfo = getProfessionInfo(profession);
    if (!professionInfo.known || professionInfo.god !== faithGod) {
        const message = '职业必须属于新的信仰神明';
        setGodBelieverStatus(message, 'error');
        showToast(message);
        return;
    }
    if (cleanGodName(target.faith_god || '') === faithGod) {
        const message = '只能在改信仰时同步改职业，不能同信仰内单独改职业';
        setGodBelieverStatus(message, 'error');
        showToast(message);
        return;
    }
    if (curseEnabled && (!curseName || !curseEffect)) {
        const message = '勾选诅咒后必须填写诅咒名字和效果';
        setGodBelieverStatus(message, 'error');
        showToast(message);
        return;
    }
    if (!window.confirm(`确认将 ${target.display_name} 从 ${target.faith_god} 改到 ${faithGod}，并同步改成 ${profession} 吗？`)) return;
    const lockKey = `godConvert:${targetHash}:${faithGod}:${profession}`;
    if (!acquireUiActionLock(lockKey, '神明改信正在处理中，请勿重复点击')) return;
    setGodBelieverStatus(`正在改信：${target.display_name} -> ${faithGod}/${profession}...`, 'pending');
    const restore = setActionButtonsBusy('[data-god-convert-action]', '处理中...');
    try {
        const { data, error } = await invokeDungeonAction('godConvertBeliever', {
            targetHash,
            targetName: target.display_name,
            faithGod,
            profession,
            curseEnabled,
            curseName,
            curseEffect,
        });
        if (error) {
            const message = `改信失败：${error.message || '后端未返回原因'}`;
            setGodBelieverStatus(message, 'error');
            showToast(`❌ ${message}`);
            return;
        }
        setGodBelieverStatus(`改信成功：${data?.targetName || target.display_name} 已改为 ${faithGod}/${profession}`, 'success');
        await refreshGodBelievers(false);
        if (document.getElementById('scorePage')?.style.display !== 'none') await renderScorePage();
        if (document.getElementById('profilePage')?.style.display !== 'none') await renderProfilePage();
        showToast(`改信成功：${data?.targetName || target.display_name} 已完成改信敕令`);
    } finally {
        restore();
        releaseUiActionLock(lockKey);
    }
}

async function refreshHonorOperationLogs(showResult = false) {
    if (!canGrantTitlesUI()) return;
    honorOperationLogsLoading = true;
    renderHonorOperationLogRows();
    const restore = setActionButtonsBusy('[data-honor-log-refresh]', '刷新中...');
    try {
        const { data, error } = await invokeDungeonAction('listHonorOperationLogs', { limit: 30 });
        if (error) {
            honorOperationLogs = [];
            honorOperationLogsUnavailable = true;
            if (showResult) showToast(`❌ ${error.message || '敕令日志读取失败'}`);
            return;
        }
        honorOperationLogs = Array.isArray(data?.logs) ? data.logs : [];
        honorOperationLogsUnavailable = !!data?.unavailable;
        if (showResult) showToast(honorOperationLogsUnavailable ? '敕令日志尚未启用，请先运行后台日志 SQL' : '敕令日志已刷新');
    } finally {
        honorOperationLogsLoading = false;
        restore();
        renderHonorOperationLogRows();
    }
}

function updateCurseTypeUI() {
    const curseType = normalizeProfileCurseType(document.getElementById('curseTypeSelect')?.value);
    const nameInput = document.getElementById('curseTextInput');
    if (!nameInput) return;
    nameInput.placeholder = curseType === 'ordinary'
        ? '普通诅咒请填写具体名称'
        : '默认：背弃诅咒';
}

function renderTitleAdminPanel(entries) {
    if (!canGrantTitlesUI()) return '';
    const godName = isGodRole() ? cleanGodName(inviteSession?.name || '') : '';
    const titleOptions = renderTitlePlayerOptions(entries, 'title');
    const curseOptions = renderTitlePlayerOptions(entries, 'any');
    const titleGodControl = isGodRole()
        ? `<input id="titleGodSelect" value="${escapeHtml(godName)}" disabled>`
        : `<select id="titleGodSelect">${renderGodSelectOptions()}</select>`;
    const curseGodControl = isGodRole()
        ? `<input id="curseGodSelect" value="${escapeHtml(godName)}" disabled>`
        : `<select id="curseGodSelect">${renderGodSelectOptions(godName)}</select>`;
    return `
        ${renderHonorActionStatus()}
        <section class="profile-panel" data-god="${escapeHtml(godName || '命运')}" style="${getGodSkinStyle(godName || '命运')}">
            <div class="profile-panel-title"><span>称号敕令</span></div>
            <div class="profile-form-grid">
                <div class="form-group full">
                    <label>受封昵称</label>
                    <input id="titleTargetName" list="titlePlayerList" maxlength="40" placeholder="选择或输入玩家昵称">
                    <datalist id="titlePlayerList">${titleOptions}</datalist>
                </div>
                <div class="form-group full"><label>称号</label><input id="titleTextInput" maxlength="32" placeholder="发放或回收指定称号，例如：雾中执灯者"></div>
                <div class="form-group"><label>降号名义</label>${titleGodControl}</div>
                <div class="form-group"><label>敕令备注</label><input id="titleNoteInput" maxlength="120" placeholder="可选，授予缘由"></div>
            </div>
            <div class="profile-tools">
                <button class="btn btn-primary btn-sm" data-honor-action="grant-title" onclick="grantProfileTitleUI()">降下称号</button>
                <button class="btn btn-outline btn-sm" data-honor-action="revoke-title" onclick="revokeProfileTitleUI()">回收称号</button>
            </div>
        </section>
        <section class="profile-panel" data-god="${escapeHtml(godName || '命运')}" style="${getGodSkinStyle(godName || '命运')}">
            <div class="profile-panel-title"><span>下放诅咒</span></div>
            <div class="profile-form-grid">
                <div class="form-group full">
                    <label>受诅昵称</label>
                    <input id="curseTargetName" list="cursePlayerList" maxlength="40" placeholder="选择或输入玩家昵称">
                    <datalist id="cursePlayerList">${curseOptions}</datalist>
                </div>
                <div class="form-group">
                    <label>诅咒类型</label>
                    <select id="curseTypeSelect" onchange="updateCurseTypeUI()">
                        <option value="betrayal">背弃诅咒</option>
                        <option value="ordinary">普通诅咒</option>
                    </select>
                </div>
                <div class="form-group"><label>诅咒名义</label>${curseGodControl}</div>
                <div class="form-group"><label>诅咒名</label><input id="curseTextInput" maxlength="32" placeholder="默认：背弃诅咒"></div>
                <div class="form-group"><label>诅咒效果</label><input id="curseNoteInput" maxlength="120" placeholder="建议填写：此诅咒的实际效果或限制"></div>
            </div>
            <div class="profile-tools">
                <button class="btn btn-danger btn-sm" data-honor-action="grant-curse" onclick="grantBetrayalCurseUI()">下放诅咒</button>
                <button class="btn btn-outline btn-sm" data-honor-action="revoke-curse" onclick="revokeProfileCurseUI()">回收诅咒</button>
            </div>
        </section>
        ${renderHonorOperationLogPanel()}`;
}

async function grantProfileTitleUI() {
    if (!canGrantTitlesUI()) { showToast('需要馆主或神明谕令'); return; }
    const targetName = cleanDisplayNameInput(document.getElementById('titleTargetName')?.value || '');
    const titleText = String(document.getElementById('titleTextInput')?.value || '').trim().slice(0, 32);
    const titleGod = isGodRole() ? cleanGodName(inviteSession?.name || '') : cleanGodName(document.getElementById('titleGodSelect')?.value || '');
    const titleNote = String(document.getElementById('titleNoteInput')?.value || '').trim().slice(0, 120);
    if (!targetName || !titleText) {
        const message = '称号降下失败：请填写受封昵称和称号';
        setHonorActionStatus(message, 'error');
        showToast(message);
        return;
    }
    const lockKey = `grantTitle:${targetName}:${titleText}`;
    if (!acquireUiActionLock(lockKey, '称号正在授予，请勿重复点击')) return;
    setHonorActionStatus(`称号降下中：正在为 ${targetName} 写入「${titleText}」...`, 'pending');
    const restore = setActionButtonsBusy('[data-honor-action]', '处理中...');
    try {
        const { data, error } = await invokeDungeonAction('grantProfileTitle', { targetName, titleText, titleGod, titleNote });
        if (error) {
            const message = `称号降下失败：${error.message || '后端未返回原因'}`;
            setHonorActionStatus(message, 'error');
            showToast(`❌ ${message}`);
            return;
        }
        const message = `称号降下成功：已为 ${data?.targetName || targetName} 降下「${data?.activeTitle?.title_text || titleText}」`;
        await renderScorePage();
        setHonorActionStatus(message, 'success');
        showToast(message);
    } finally {
        restore();
        releaseUiActionLock(lockKey);
    }
}

async function grantBetrayalCurseUI() {
    if (!canGrantTitlesUI()) { showToast('需要馆主或神明谕令'); return; }
    const targetName = cleanDisplayNameInput(document.getElementById('curseTargetName')?.value || '');
    const curseGod = isGodRole() ? cleanGodName(inviteSession?.name || '') : cleanGodName(document.getElementById('curseGodSelect')?.value || '');
    const curseType = normalizeProfileCurseType(document.getElementById('curseTypeSelect')?.value);
    const curseText = String(document.getElementById('curseTextInput')?.value || '').trim().slice(0, 32);
    const curseNote = String(document.getElementById('curseNoteInput')?.value || '').trim().slice(0, 120);
    if (!targetName) {
        const message = '诅咒下放失败：请填写受诅昵称';
        setHonorActionStatus(message, 'error');
        showToast(message);
        return;
    }
    if (!curseGod) {
        const message = '诅咒下放失败：请选择诅咒名义';
        setHonorActionStatus(message, 'error');
        showToast(message);
        return;
    }
    if (curseType === 'ordinary' && !curseText) {
        const message = '普通诅咒下放失败：请填写具体诅咒名';
        setHonorActionStatus(message, 'error');
        showToast(message);
        return;
    }
    const curseName = curseText || '背弃诅咒';
    const titleHint = curseType === 'betrayal' ? '，并自动赋予「背弃者」称号' : '，不自动赋予称号';
    if (!window.confirm(`对 ${targetName} 下放${getProfileCurseTypeLabel(curseType)}「${curseName}」${titleHint}？`)) return;
    const lockKey = `grantCurse:${targetName}:${curseType}:${curseName}`;
    if (!acquireUiActionLock(lockKey, '诅咒正在下放，请勿重复点击')) return;
    setHonorActionStatus(`诅咒下放中：正在为 ${targetName} 写入「${curseName}」...`, 'pending');
    const restore = setActionButtonsBusy('[data-honor-action]', '处理中...');
    try {
        const { data, error } = await invokeDungeonAction('grantBetrayalCurse', { targetName, curseGod, curseType, curseText, curseNote });
        if (error) {
            const message = `诅咒下放失败：${error.message || '后端未返回原因'}`;
            setHonorActionStatus(message, 'error');
            showToast(`❌ ${message}`);
            return;
        }
        const grantedCurse = data?.activeCurse?.curse_text || curseName;
        const message = curseType === 'betrayal'
            ? `背弃诅咒下放成功：${data?.targetName || targetName} 获得「${grantedCurse}」与称号「${data?.grantedTitle || '背弃者'}」`
            : `普通诅咒下放成功：${data?.targetName || targetName} 获得「${grantedCurse}」`;
        await renderScorePage();
        if (document.getElementById('profilePage')?.style.display !== 'none') await renderProfilePage();
        if (document.getElementById('leaderboardPage')?.style.display !== 'none') await renderLeaderboardPage();
        setHonorActionStatus(message, 'success');
        showToast(message);
    } finally {
        restore();
        releaseUiActionLock(lockKey);
    }
}

async function revokeProfileTitleUI() {
    if (!canGrantTitlesUI()) { showToast('需要馆主或神明谕令'); return; }
    const targetName = cleanDisplayNameInput(document.getElementById('titleTargetName')?.value || '');
    const titleText = String(document.getElementById('titleTextInput')?.value || '').trim().slice(0, 32);
    if (!targetName) {
        const message = '称号回收失败：请填写要回收称号的昵称';
        setHonorActionStatus(message, 'error');
        showToast(message);
        return;
    }
    if (!window.confirm(titleText ? `回收 ${targetName} 的称号「${titleText}」？` : `回收 ${targetName} 最新生效称号？`)) return;
    const lockKey = `revokeTitle:${targetName}:${titleText || 'latest'}`;
    if (!acquireUiActionLock(lockKey, '称号正在回收，请勿重复点击')) return;
    setHonorActionStatus(`称号回收中：正在处理 ${targetName} 的${titleText ? `「${titleText}」` : '最新生效称号'}...`, 'pending');
    const restore = setActionButtonsBusy('[data-honor-action]', '处理中...');
    try {
        const { data, error } = await invokeDungeonAction('revokeProfileTitle', { targetName, titleText });
        if (error) {
            const message = `称号回收失败：${error.message || '后端未返回原因'}`;
            setHonorActionStatus(message, 'error');
            showToast(`❌ ${message}`);
            return;
        }
        const message = `称号回收成功：已回收 ${data?.targetName || targetName} 的「${data?.revokedTitle || titleText || '最新称号'}」`;
        await renderScorePage();
        if (document.getElementById('profilePage')?.style.display !== 'none') await renderProfilePage();
        if (document.getElementById('leaderboardPage')?.style.display !== 'none') await renderLeaderboardPage();
        setHonorActionStatus(message, 'success');
        showToast(message);
    } finally {
        restore();
        releaseUiActionLock(lockKey);
    }
}

async function revokeProfileCurseUI() {
    if (!canGrantTitlesUI()) { showToast('需要馆主或神明谕令'); return; }
    const targetName = cleanDisplayNameInput(document.getElementById('curseTargetName')?.value || '');
    const curseText = String(document.getElementById('curseTextInput')?.value || '').trim().slice(0, 32);
    if (!targetName) {
        const message = '诅咒回收失败：请填写要回收诅咒的昵称';
        setHonorActionStatus(message, 'error');
        showToast(message);
        return;
    }
    if (!window.confirm(curseText ? `回收 ${targetName} 的诅咒「${curseText}」？` : `回收 ${targetName} 最新生效诅咒？`)) return;
    const lockKey = `revokeCurse:${targetName}:${curseText || 'latest'}`;
    if (!acquireUiActionLock(lockKey, '诅咒正在回收，请勿重复点击')) return;
    setHonorActionStatus(`诅咒回收中：正在处理 ${targetName} 的${curseText ? `「${curseText}」` : '最新生效诅咒'}...`, 'pending');
    const restore = setActionButtonsBusy('[data-honor-action]', '处理中...');
    try {
        const { data, error } = await invokeDungeonAction('revokeProfileCurse', { targetName, curseText });
        if (error) {
            const message = `诅咒回收失败：${error.message || '后端未返回原因'}`;
            setHonorActionStatus(message, 'error');
            showToast(`❌ ${message}`);
            return;
        }
        const message = `诅咒回收成功：已回收 ${data?.targetName || targetName} 的「${data?.revokedCurse || curseText || '最新诅咒'}」`;
        await renderScorePage();
        if (document.getElementById('profilePage')?.style.display !== 'none') await renderProfilePage();
        if (document.getElementById('leaderboardPage')?.style.display !== 'none') await renderLeaderboardPage();
        setHonorActionStatus(message, 'success');
        showToast(message);
    } finally {
        restore();
        releaseUiActionLock(lockKey);
    }
}

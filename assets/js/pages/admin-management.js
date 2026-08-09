// Curator-only member management and talent warehouse panels.

let adminMembers = [];
let adminTalentPools = [];
let adminTalentPoolSelected = '';
let adminManagementLoading = false;
let adminTalentWarehouseLoading = false;

function formatAdminMemberStatus(member) {
    if (!member?.isActive) return '已禁用';
    if (member.status === 'online') return '在线';
    if (member.status === 'recent') return '近24小时';
    if (member.status === 'inactive') return '久未活动';
    return '未记录';
}

function renderAdminMemberRows() {
    if (adminManagementLoading) return '<div class="profile-empty">正在读取成员状态...</div>';
    if (!adminMembers.length) return renderRitualEmpty('暂无成员记录。', '真理', '名单为空');
    return adminMembers.map(member => {
        const status = formatAdminMemberStatus(member);
        const seen = member.lastSeenAt ? formatAdminTime(member.lastSeenAt) : '从未记录';
        const hash = escapeHtml(jsString(member.codeHash || ''));
        const name = escapeHtml(member.displayName || '未命名');
        const roleLabel = typeof ROLE_LABELS !== 'undefined' ? (ROLE_LABELS[member.role] || member.role || '未知身份') : (member.role || '未知身份');
        return `<article class="profile-list-item">
            <div class="profile-list-title"><span>${name}</span><small>${escapeHtml(status)}</small></div>
            <div class="profile-list-meta">${escapeHtml(roleLabel)} · ${escapeHtml(member.faithGod || '未定信仰')} · ${escapeHtml(member.profession || '未定职业')}</div>
            <div class="profile-list-meta">登神 ${Number(member.ascensionScore || 0)} / 觐见 ${Number(member.audienceScore || 0)} · 最近活动：${escapeHtml(seen)} · ${escapeHtml(member.lastSeenAction || '无动作')}</div>
            <div class="profile-tools">
                <button class="btn btn-outline btn-sm" onclick="adminInspectMember(${hash}, ${escapeHtml(jsString(member.displayName || ''))})">查看档案</button>
                <button class="btn btn-outline btn-sm" onclick="adminRenameMember(${hash}, ${escapeHtml(jsString(member.displayName || ''))})">改名</button>
                <button class="btn btn-outline btn-sm" onclick="adminResetMember(${hash}, ${escapeHtml(jsString(member.displayName || ''))})">重置</button>
                <button class="btn btn-outline btn-sm" onclick="adminDeleteMember(${hash}, ${escapeHtml(jsString(member.displayName || ''))})">删除</button>
            </div>
        </article>`;
    }).join('');
}

function getAdminTalentSelectedPool() {
    if (!adminTalentPoolSelected && adminTalentPools.length) adminTalentPoolSelected = adminTalentPools[0].poolKey;
    return adminTalentPools.find(pool => pool.poolKey === adminTalentPoolSelected) || adminTalentPools[0] || null;
}

function renderAdminTalentPoolOptions() {
    return adminTalentPools.map(pool => `<option value="${escapeHtml(pool.poolKey)}" ${pool.poolKey === adminTalentPoolSelected ? 'selected' : ''}>${escapeHtml(pool.poolKey)} · ${pool.items?.length || 0}</option>`).join('');
}

function renderAdminTalentRows() {
    if (adminTalentWarehouseLoading) return '<div class="profile-empty">正在读取天赋仓库...</div>';
    const pool = getAdminTalentSelectedPool();
    if (!pool) return renderRitualEmpty('暂无天赋池记录。', '真理', '仓库为空');
    return (pool.items || []).map(item => {
        const payload = escapeHtml(jsString(JSON.stringify(item)));
        return `<article class="profile-list-item">
            <div class="profile-list-title"><span>#${Number(item.talentId || 0)} ${escapeHtml(item.talentName || '未命名')}</span><small>${escapeHtml(item.rank || 'C')} · ${item.isEnabled ? '启用' : '停用'}</small></div>
            <div class="profile-list-meta">${escapeHtml(item.effect || '未填写效果')}</div>
            <div class="profile-list-meta">行动点 ${Number(item.actionCost || 0)} · ${escapeHtml(item.adminNote || '无备注')}</div>
            <div class="profile-tools">
                <button class="btn btn-outline btn-sm" onclick="adminEditTalentPoolItem(${payload})">编辑</button>
                <button class="btn btn-outline btn-sm" onclick="adminToggleTalentPoolItem(${escapeHtml(jsString(item.poolKey))}, ${Number(item.talentId || 0)}, ${item.isEnabled ? 'false' : 'true'})">${item.isEnabled ? '停用' : '启用'}</button>
            </div>
        </article>`;
    }).join('');
}

function renderAdminTalentWarehousePanel() {
    const pool = getAdminTalentSelectedPool();
    return `<section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}">
        <div class="profile-panel-title"><span>天赋仓库</span><small>馆主维护抽池，不修改玩家已拥有天赋</small></div>
        <div class="profile-form-grid">
            <div class="form-group">
                <label>天赋池</label>
                <select id="adminTalentPoolSelect" onchange="adminSelectTalentPool(this.value)">${renderAdminTalentPoolOptions()}</select>
            </div>
            <div class="form-group">
                <label>池名 / 新池名</label>
                <input id="adminTalentPoolKey" maxlength="40" value="${escapeHtml(pool?.poolKey || '')}" placeholder="例如 Pool战士">
            </div>
            <div class="form-group">
                <label>编号</label>
                <input id="adminTalentId" type="number" min="1" placeholder="留空自动编号">
            </div>
            <div class="form-group">
                <label>等级</label>
                <select id="adminTalentRank"><option>S</option><option>A</option><option>B</option><option selected>C</option></select>
            </div>
            <div class="form-group full">
                <label>天赋名</label>
                <input id="adminTalentName" maxlength="80" placeholder="填写天赋名称">
            </div>
            <div class="form-group full">
                <label>效果</label>
                <textarea id="adminTalentEffect" maxlength="600" rows="3" placeholder="填写天赋效果"></textarea>
            </div>
            <div class="form-group">
                <label>行动点</label>
                <input id="adminTalentActionCost" type="number" min="0" max="99" value="0">
            </div>
            <div class="form-group">
                <label class="identity-help"><input id="adminTalentEnabled" type="checkbox" checked> 启用到抽池</label>
            </div>
            <div class="form-group full">
                <label>馆主备注</label>
                <input id="adminTalentNote" maxlength="300" placeholder="可选，仅后台显示">
            </div>
        </div>
        <div class="profile-tools">
            <button class="btn btn-primary btn-sm" data-admin-talent-save onclick="adminSaveTalentPoolItem()">保存天赋</button>
            <button class="btn btn-outline btn-sm" data-admin-talent-refresh onclick="adminLoadTalentWarehouse(true)">刷新仓库</button>
            <button class="btn btn-outline btn-sm" onclick="adminClearTalentPoolForm()">清空表单</button>
        </div>
        <div id="adminTalentPoolRows" class="profile-list" style="margin-top:14px;">${renderAdminTalentRows()}</div>
    </section>`;
}

function renderAdminManagementPanels() {
    if (!isAdmin()) return '';
    return `<section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}">
        <div class="profile-panel-title"><span>成员管理</span><small>活跃状态 / 改名 / 重置 / 删除</small></div>
        <div class="profile-tools" style="margin-bottom:12px;">
            <button class="btn btn-primary btn-sm" data-admin-members-refresh onclick="adminLoadMembers(true)">刷新成员</button>
        </div>
        <div id="adminMemberRows" class="profile-list">${renderAdminMemberRows()}</div>
    </section>${renderAdminTalentWarehousePanel()}`;
}

function renderAdminRolePanel() {
    const options = adminMembers
        .filter(member => member.isActive && member.role !== 'god')
        .map(member => `<option value="${escapeHtml(member.codeHash)}">${escapeHtml(member.displayName || '未命名')} · ${escapeHtml(member.role || 'player')}</option>`)
        .join('');
    return `<section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}">
        <div class="profile-panel-title"><span>权限调整</span><small>馆主可直接调整成员权限</small></div>
        <div class="profile-form-grid">
            <div class="form-group">
                <label>成员</label>
                <select id="adminRoleTarget">${options || '<option value="">暂无可调整成员</option>'}</select>
            </div>
            <div class="form-group">
                <label>新权限</label>
                <select id="adminRoleValue">
                    <option value="player">玩家</option>
                    <option value="author">作者</option>
                    <option value="reviewer">审核员</option>
                    <option value="admin">馆主</option>
                </select>
            </div>
        </div>
        <div class="profile-tools">
            <button class="btn btn-primary btn-sm" onclick="adminSetMemberRole()">保存权限</button>
        </div>
    </section>`;
}

function injectAdminManagementPanels() {
    const container = document.getElementById('adminContent');
    if (!container || !isAdmin() || document.getElementById('adminMemberRows')) return;
    container.insertAdjacentHTML('beforeend', renderAdminManagementPanels());
    container.insertAdjacentHTML('beforeend', renderAdminRolePanel());
}

async function adminLoadMembers(showResult = false) {
    if (!isAdmin()) return;
    adminManagementLoading = true;
    const rows = document.getElementById('adminMemberRows');
    if (rows) rows.innerHTML = '<div class="profile-empty">正在读取成员状态...</div>';
    try {
        const { data, error } = await invokeDungeonAction('adminListMembers', {});
        if (error) { showToast(`失败：${error.message || '成员列表读取失败'}`); return; }
        adminMembers = Array.isArray(data) ? data : [];
        if (showResult) showToast(`已读取 ${adminMembers.length} 位成员`);
    } finally {
        adminManagementLoading = false;
        const target = document.getElementById('adminMemberRows');
        if (target) target.innerHTML = renderAdminMemberRows();
        const roleTarget = document.getElementById('adminRoleTarget');
        if (roleTarget) {
            roleTarget.innerHTML = adminMembers
                .filter(member => member.isActive && member.role !== 'god')
                .map(member => `<option value="${escapeHtml(member.codeHash)}">${escapeHtml(member.displayName || '未命名')} · ${escapeHtml(member.role || 'player')}</option>`)
                .join('') || '<option value="">暂无可调整成员</option>';
        }
    }
}

async function adminLoadTalentWarehouse(showResult = false) {
    if (!isAdmin()) return;
    adminTalentWarehouseLoading = true;
    const rows = document.getElementById('adminTalentPoolRows');
    if (rows) rows.innerHTML = '<div class="profile-empty">正在读取天赋仓库...</div>';
    try {
        const { data, error } = await invokeDungeonAction('adminListTalentPoolItems', {});
        if (error) { showToast(`失败：${error.message || '天赋仓库读取失败'}`); return; }
        adminTalentPools = Array.isArray(data?.pools) ? data.pools : [];
        if (!adminTalentPoolSelected && adminTalentPools.length) adminTalentPoolSelected = adminTalentPools[0].poolKey;
        if (showResult) showToast(`已读取 ${adminTalentPools.length} 个天赋池`);
    } finally {
        adminTalentWarehouseLoading = false;
        const select = document.getElementById('adminTalentPoolSelect');
        if (select) select.innerHTML = renderAdminTalentPoolOptions();
        const target = document.getElementById('adminTalentPoolRows');
        if (target) target.innerHTML = renderAdminTalentRows();
    }
}

function adminSelectTalentPool(poolKey) {
    adminTalentPoolSelected = String(poolKey || '');
    const input = document.getElementById('adminTalentPoolKey');
    if (input) input.value = adminTalentPoolSelected;
    const rows = document.getElementById('adminTalentPoolRows');
    if (rows) rows.innerHTML = renderAdminTalentRows();
}

function adminInspectMember(_targetHash, displayName) {
    adminLookupPlayer(displayName || '');
}

async function adminSetMemberRole() {
    const targetHash = document.getElementById('adminRoleTarget')?.value || '';
    const nextRole = document.getElementById('adminRoleValue')?.value || '';
    if (!targetHash || !nextRole) {
        showToast('请选择成员和新权限');
        return;
    }
    const target = adminMembers.find(member => member.codeHash === targetHash);
    if (!target) {
        showToast('没有找到目标成员');
        return;
    }
    if (!window.confirm(`确认将 ${target.displayName || '该成员'} 的权限调整为 ${nextRole}？`)) return;
    const { error } = await invokeDungeonAction('adminSetAccountRole', { targetHash, role: nextRole });
    if (error) {
        showToast(`失败：${error.message || '权限调整失败'}`);
        return;
    }
    showToast('权限调整完成');
    await refreshAdminOperationLogs();
    await adminLoadMembers(false);
    await renderAdminPage();
}

async function adminRenameMember(targetHash, currentName) {
    const nextName = window.prompt(`给 ${currentName || '该玩家'} 改成什么名字？`, currentName || '');
    if (!nextName) return;
    const { error } = await invokeDungeonAction('adminRenameAccount', { targetHash, displayName: nextName });
    if (error) { showToast(`失败：${error.message || '改名失败'}`); return; }
    showToast('改名完成');
    await Promise.all([adminLoadMembers(false), refreshAdminOperationLogs()]);
    await renderAdminPage();
}

async function adminResetMember(targetHash, displayName) {
    if (!window.confirm(`确认重置 ${displayName || '该玩家'} 的个人状态？这会清空档案、分数、天赋、称号诅咒等个人数据，但保留账号。`)) return;
    const { error } = await invokeDungeonAction('adminResetAccount', { targetHash });
    if (error) { showToast(`失败：${error.message || '重置失败'}`); return; }
    showToast('账号已重置');
    await Promise.all([adminLoadMembers(false), refreshAdminOperationLogs()]);
    await renderAdminPage();
}

async function adminDeleteMember(targetHash, displayName) {
    const typed = window.prompt(`删除会禁用 ${displayName || '该账号'} 并清空个人状态。请输入玩家昵称确认。`);
    if (typed !== displayName) { showToast('昵称不一致，已取消删除'); return; }
    const { error } = await invokeDungeonAction('adminDeleteAccount', { targetHash });
    if (error) { showToast(`失败：${error.message || '删除失败'}`); return; }
    showToast('账号已禁用并清理');
    await Promise.all([adminLoadMembers(false), refreshAdminOperationLogs()]);
    await renderAdminPage();
}

function adminEditTalentPoolItem(rawItem) {
    const item = typeof rawItem === 'string' ? JSON.parse(rawItem) : rawItem;
    adminTalentPoolSelected = item.poolKey || adminTalentPoolSelected;
    const fields = {
        adminTalentPoolKey: item.poolKey || '',
        adminTalentId: item.talentId || '',
        adminTalentName: item.talentName || '',
        adminTalentRank: item.rank || 'C',
        adminTalentEffect: item.effect || '',
        adminTalentActionCost: item.actionCost || 0,
        adminTalentNote: item.adminNote || ''
    };
    Object.entries(fields).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
    });
    const enabled = document.getElementById('adminTalentEnabled');
    if (enabled) enabled.checked = item.isEnabled !== false;
}

function adminClearTalentPoolForm() {
    ['adminTalentId', 'adminTalentName', 'adminTalentEffect', 'adminTalentNote'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const rank = document.getElementById('adminTalentRank');
    if (rank) rank.value = 'C';
    const cost = document.getElementById('adminTalentActionCost');
    if (cost) cost.value = '0';
    const enabled = document.getElementById('adminTalentEnabled');
    if (enabled) enabled.checked = true;
}

async function adminSaveTalentPoolItem() {
    const payload = {
        poolKey: document.getElementById('adminTalentPoolKey')?.value || adminTalentPoolSelected,
        talentId: document.getElementById('adminTalentId')?.value || '',
        talentName: document.getElementById('adminTalentName')?.value || '',
        rank: document.getElementById('adminTalentRank')?.value || 'C',
        effect: document.getElementById('adminTalentEffect')?.value || '',
        actionCost: document.getElementById('adminTalentActionCost')?.value || 0,
        isEnabled: !!document.getElementById('adminTalentEnabled')?.checked,
        adminNote: document.getElementById('adminTalentNote')?.value || ''
    };
    const { error } = await invokeDungeonAction('adminUpsertTalentPoolItem', payload);
    if (error) { showToast(`失败：${error.message || '保存失败'}`); return; }
    adminTalentPoolSelected = String(payload.poolKey || '');
    showToast('天赋已保存');
    await Promise.all([adminLoadTalentWarehouse(false), refreshAdminOperationLogs()]);
    await renderAdminPage();
}

async function adminToggleTalentPoolItem(poolKey, talentId, enabled) {
    const { error } = await invokeDungeonAction('adminSetTalentPoolItemEnabled', { poolKey, talentId, enabled });
    if (error) { showToast(`失败：${error.message || '启停失败'}`); return; }
    showToast(enabled ? '天赋已启用' : '天赋已停用');
    await Promise.all([adminLoadTalentWarehouse(false), refreshAdminOperationLogs()]);
    await renderAdminPage();
}

if (typeof renderAdminPage === 'function') {
    const renderAdminPageBase = renderAdminPage;
    renderAdminPage = async function renderAdminPageWithManagement() {
        await renderAdminPageBase();
        injectAdminManagementPanels();
        if (isAdmin()) {
            if (!adminMembers.length && !adminManagementLoading) adminLoadMembers(false);
            if (!adminTalentPools.length && !adminTalentWarehouseLoading) adminLoadTalentWarehouse(false);
        }
    };
}

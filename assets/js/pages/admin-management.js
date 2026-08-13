// Curator-only member management and talent warehouse panels.

let adminMembers = [];
let adminTalentPools = [];
let adminTalentPoolSelected = '';
let adminTalentEditingItem = null;
let adminFaithTraits = [];
let adminFaithTraitsLoading = false;
let adminFaithTraitEditingItem = null;
let adminManagementLoading = false;
let adminTalentWarehouseLoading = false;
let adminManagementView = 'overview';
let adminMemberSearchQuery = '';
let adminMemberSortMode = 'oldest';
let adminMemberPage = 1;
const adminMemberPageSize = 18;
let adminManagementStatus = null;

function setAdminManagementStatus(message, type = 'success') {
    adminManagementStatus = message ? { message, type } : null;
    const el = document.getElementById('adminManagementStatus');
    if (!el) return;
    if (!adminManagementStatus) {
        el.hidden = true;
        el.textContent = '';
        return;
    }
    el.hidden = false;
    el.className = `profile-action-status ${type === 'error' ? 'error' : (type === 'pending' ? 'pending' : 'success')}`;
    el.textContent = message;
}

function formatAdminMemberStatus(member) {
    if (!member?.isActive) return '已禁用';
    if (member.status === 'online') return '在线';
    if (member.status === 'recent') return '近24小时';
    if (member.status === 'inactive') return '久未活动';
    return '未记录';
}

function isAdminMemberBound(member) {
    return !!member?.hasProfile || !!member?.faithGod || !!member?.profession || Number(member?.ascensionScore || 0) > 0 || Number(member?.audienceScore || 0) > 0;
}

function getAdminMemberLastSeenTime(member) {
    const timestamp = Date.parse(member?.lastSeenAt || '');
    return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getAdminFilteredMembers() {
    const query = adminMemberSearchQuery.trim().toLowerCase();
    const filtered = adminMembers.filter(member => {
        if (!query) return true;
        return [
            member.displayName,
            member.role,
            member.faithGod,
            member.profession,
            member.lastSeenAction,
            formatAdminMemberStatus(member),
            isAdminMemberBound(member) ? '已绑定' : '未绑定'
        ].some(value => String(value || '').toLowerCase().includes(query));
    });
    return filtered.sort((a, b) => {
        const boundDelta = Number(!isAdminMemberBound(a)) - Number(!isAdminMemberBound(b));
        if (boundDelta) return boundDelta;
        const timeA = getAdminMemberLastSeenTime(a);
        const timeB = getAdminMemberLastSeenTime(b);
        const timeDelta = adminMemberSortMode === 'newest' ? timeB - timeA : timeA - timeB;
        if (timeDelta) return timeDelta;
        return String(a.displayName || '').localeCompare(String(b.displayName || ''), 'zh-CN');
    });
}

function clampAdminMemberPage(totalPages) {
    adminMemberPage = Math.max(1, Math.min(adminMemberPage, Math.max(1, totalPages)));
}

function renderAdminMemberToolbar(filteredCount = adminMembers.length) {
    const totalPages = Math.max(1, Math.ceil(filteredCount / adminMemberPageSize));
    return `<div class="profile-form-grid" style="margin-bottom:12px;">
        <div class="form-group full">
            <label>搜索成员</label>
            <input id="adminMemberSearchInput" maxlength="40" value="${escapeHtml(adminMemberSearchQuery)}" placeholder="输入昵称、身份、信仰、职业或状态" oninput="adminSetMemberSearch(this.value)">
        </div>
        <div class="form-group">
            <label>最后登录排序</label>
            <select id="adminMemberSortSelect" onchange="adminSetMemberSort(this.value)">
                <option value="oldest" ${adminMemberSortMode === 'oldest' ? 'selected' : ''}>最早登录优先</option>
                <option value="newest" ${adminMemberSortMode === 'newest' ? 'selected' : ''}>最近登录优先</option>
            </select>
        </div>
        <div class="form-group">
            <label>分页</label>
            <div class="profile-tools">
                <button class="btn btn-outline btn-sm" onclick="adminSetMemberPage(${adminMemberPage - 1})" ${adminMemberPage <= 1 ? 'disabled' : ''}>上一页</button>
                <button class="btn btn-outline btn-sm" onclick="adminSetMemberPage(${adminMemberPage + 1})" ${adminMemberPage >= totalPages ? 'disabled' : ''}>下一页</button>
            </div>
        </div>
    </div>
    <div class="identity-help">共 ${filteredCount} / ${adminMembers.length} 位成员，第 ${adminMemberPage} / ${totalPages} 页。未绑定成员固定排在最后。</div>`;
}

function renderAdminMemberRows() {
    if (adminManagementLoading) return '<div class="profile-empty">正在读取成员状态...</div>';
    if (!adminMembers.length) return renderRitualEmpty('暂无成员记录。', '真理', '名单为空');
    const filtered = getAdminFilteredMembers();
    const totalPages = Math.max(1, Math.ceil(filtered.length / adminMemberPageSize));
    clampAdminMemberPage(totalPages);
    const start = (adminMemberPage - 1) * adminMemberPageSize;
    const pageItems = filtered.slice(start, start + adminMemberPageSize);
    if (!pageItems.length) return renderAdminMemberToolbar(filtered.length) + renderRitualEmpty('没有匹配的成员。', '真理', '查询为空');
    return renderAdminMemberToolbar(filtered.length) + pageItems.map(member => {
        const status = formatAdminMemberStatus(member);
        const seen = member.lastSeenAt ? formatAdminTime(member.lastSeenAt) : '从未记录';
        const boundLabel = isAdminMemberBound(member) ? '已绑定' : '未绑定';
        const hash = escapeHtml(jsString(member.codeHash || ''));
        const name = escapeHtml(member.displayName || '未命名');
        const roleLabel = typeof ROLE_LABELS !== 'undefined' ? (ROLE_LABELS[member.role] || member.role || '未知身份') : (member.role || '未知身份');
        return `<article class="profile-list-item">
            <div class="profile-list-title"><span>${name}</span><small>${escapeHtml(boundLabel)} · ${escapeHtml(status)}</small></div>
            <div class="profile-list-meta">${escapeHtml(roleLabel)} · ${escapeHtml(member.faithGod || '未定信仰')} · ${escapeHtml(member.profession || '未定职业')}</div>
            <div class="profile-list-meta">登神 ${Number(member.ascensionScore || 0)} / 觐见 ${Number(member.audienceScore || 0)} · 最后登录网站：${escapeHtml(seen)} · ${escapeHtml(member.lastSeenAction || '无动作')}</div>
            <div class="profile-tools">
                <button class="btn btn-outline btn-sm" onclick="adminInspectMember(${hash}, ${escapeHtml(jsString(member.displayName || ''))})">查看档案</button>
                <button class="btn btn-outline btn-sm" onclick="adminRenameMember(${hash}, ${escapeHtml(jsString(member.displayName || ''))})">改名</button>
                <button class="btn btn-outline btn-sm" onclick="adminResetMember(${hash}, ${escapeHtml(jsString(member.displayName || ''))})">重置</button>
                <button class="btn btn-outline btn-sm" onclick="adminDeleteMember(${hash}, ${escapeHtml(jsString(member.displayName || ''))})">删除</button>
            </div>
        </article>`;
    }).join('');
}

function adminSetMemberSearch(value) {
    adminMemberSearchQuery = String(value || '');
    adminMemberPage = 1;
    const rows = document.getElementById('adminMemberRows');
    if (rows) rows.innerHTML = renderAdminMemberRows();
}

function adminSetMemberSort(value) {
    adminMemberSortMode = value === 'newest' ? 'newest' : 'oldest';
    adminMemberPage = 1;
    const rows = document.getElementById('adminMemberRows');
    if (rows) rows.innerHTML = renderAdminMemberRows();
}

function adminSetMemberPage(page) {
    adminMemberPage = Number(page) || 1;
    const rows = document.getElementById('adminMemberRows');
    if (rows) rows.innerHTML = renderAdminMemberRows();
}

async function adminSetManagementView(view) {
    const allowedViews = ['overview'];
    if (isAdmin()) allowedViews.push('members');
    if (canManageTalentPoolUI()) allowedViews.push('talents');
    adminManagementView = allowedViews.includes(view) ? view : 'overview';
    if (adminManagementView !== 'members') adminMemberPage = 1;
    await renderAdminPage();
}

function renderAdminManagementNav() {
    const items = [
        ['overview', '权限工作台', '']
    ];
    if (isAdmin()) items.push(['members', '成员管理', '']);
    if (canManageTalentPoolUI()) items.push(['talents', '天赋池维护', '']);
    return `<section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}">
        <div class="profile-panel-title"><span>馆主后台</span></div>
        <div id="adminManagementStatus" class="profile-action-status ${adminManagementStatus?.type === 'error' ? 'error' : (adminManagementStatus?.type === 'pending' ? 'pending' : 'success')}" ${adminManagementStatus ? '' : 'hidden'}>${escapeHtml(adminManagementStatus?.message || '')}</div>
        <div class="profile-tools">
            ${items.map(([key, label, note]) => `<button class="btn ${adminManagementView === key ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="adminSetManagementView('${key}')" title="${escapeHtml(note)}">${escapeHtml(label)}</button>`).join('')}
        </div>
    </section>`;
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
    const groups = ['S', 'A', 'B', 'C'].map(rank => {
        const items = (pool.items || [])
            .filter(item => String(item.rank || 'C').toUpperCase() === rank)
            .sort((a, b) => Number(a.talentId || 0) - Number(b.talentId || 0));
        return { rank, items };
    }).filter(group => group.items.length);
    if (!groups.length) return renderRitualEmpty('这个天赋池暂时没有记录。', '真理', '仓库为空');
    return groups.map(group => `<section class="profile-panel" data-god="真理" style="margin-top:12px;${getGodSkinStyle('真理')}">
        <div class="profile-panel-title"><span>${group.rank} 级天赋</span><small>${group.items.length} 项</small></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">
            ${group.items.map(item => {
                const cooldown = String(item.cooldown || '').trim() || '无';
                return `<article class="profile-list-item" style="height:100%;display:flex;flex-direction:column;gap:8px;">
                    <div class="profile-list-title"><span>#${Number(item.talentId || 0)} ${escapeHtml(item.talentName || '未命名')}</span><small>${item.isEnabled ? '启用' : '停用'}</small></div>
                    <div class="profile-list-meta">冷却 ${escapeHtml(cooldown)} · 行动点 ${Number(item.actionCost || 0)}</div>
                    <div class="profile-list-meta" style="white-space:pre-wrap;">${escapeHtml(item.effect || '未填写效果')}</div>
                    <div class="profile-list-meta">${escapeHtml(item.adminNote || '无备注')}</div>
                    <div class="profile-tools" style="margin-top:auto;">
                        <button class="btn btn-outline btn-sm" onclick='adminEditTalentPoolItemByKey(${jsString(item.poolKey)}, ${Number(item.talentId || 0)})'>编辑</button>
                        <button class="btn btn-outline btn-sm" onclick='adminToggleTalentPoolItem(${jsString(item.poolKey)}, ${Number(item.talentId || 0)}, ${item.isEnabled ? 'false' : 'true'})'>${item.isEnabled ? '停用' : '启用'}</button>
                    </div>
                </article>`;
            }).join('')}
        </div>
    </section>`).join('');
}

function renderAdminTalentWarehousePanel() {
    const pool = getAdminTalentSelectedPool();
    return `<section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}">
        <div class="profile-panel-title"><span>天赋仓库</span></div>
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
                <label>冷却</label>
                <input id="adminTalentCooldown" maxlength="40" placeholder="例如 5回合 / 一局一次 / 无">
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
        <div class="profile-form-grid" style="margin-top:14px;">
            <div class="form-group full">
                <label>批量导入</label>
                <textarea id="adminTalentBatchInput" rows="6" maxlength="20000" placeholder="一行一个天赋：编号｜名字｜等级｜效果｜冷却｜行动点&#10;也可以从表格复制：编号<Tab>名字<Tab>等级<Tab>效果<Tab>冷却<Tab>行动点"></textarea>
            </div>
        </div>
        <div class="profile-tools">
            <button class="btn btn-primary btn-sm" data-admin-talent-batch onclick="adminBatchSaveTalentPoolItems()">批量保存到当前池</button>
        </div>
        <div id="adminTalentPoolRows" class="profile-list" style="margin-top:14px;">${renderAdminTalentRows()}</div>
    </section>`;
}

function getAdminFaithTraitList() {
    const overrides = new Map((adminFaithTraits || []).map(item => [cleanGodName(item.god), item]));
    return GOD_GROUPS.flatMap(group => group.gods.map(god => {
        const override = overrides.get(god) || {};
        return {
            path: group.path,
            god,
            trait: override.trait || FAITH_TRAITS[god] || DEFAULT_FAITH_TRAITS[god] || '',
            adminNote: override.adminNote || '',
            updatedAt: override.updatedAt || ''
        };
    }));
}

function renderAdminFaithTraitCards() {
    if (adminFaithTraitsLoading) return '<div class="profile-empty">正在读取信仰特性...</div>';
    return GOD_GROUPS.map(group => {
        const items = getAdminFaithTraitList().filter(item => item.path === group.path);
        return `<section class="profile-panel" data-god="${escapeHtml(items[0]?.god || '真理')}" style="margin-top:12px;${getGodSkinStyle(items[0]?.god || '真理')}">
            <div class="profile-panel-title"><span>${escapeHtml(group.path)}命途</span><small>${items.length} 位神明</small></div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;">
                ${items.map(item => `<article class="profile-list-item" style="height:100%;display:flex;flex-direction:column;gap:8px;">
                    <div class="profile-list-title"><span>${escapeHtml(getGodIcon(item.god))} ${escapeHtml(item.god)}之神</span><small>${escapeHtml(item.path)}</small></div>
                    <div class="profile-list-meta" style="white-space:pre-wrap;">${escapeHtml(item.trait || '未填写信仰特性')}</div>
                    ${item.adminNote ? `<div class="profile-list-meta">${escapeHtml(item.adminNote)}</div>` : ''}
                    <div class="profile-tools" style="margin-top:auto;">
                        <button class="btn btn-outline btn-sm" onclick='adminEditFaithTrait(${jsString(item.god)})'>编辑</button>
                    </div>
                </article>`).join('')}
            </div>
        </section>`;
    }).join('');
}

function renderAdminFaithTraitPanel() {
    return `<section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}">
        <div class="profile-panel-title"><span>信仰特性维护</span></div>
        <div class="profile-tools" style="margin-bottom:12px;">
            <button class="btn btn-primary btn-sm" onclick="adminLoadFaithTraits(true)">刷新信仰特性</button>
        </div>
        <div id="adminFaithTraitRows">${renderAdminFaithTraitCards()}</div>
    </section>`;
}

function renderAdminManagementPanels() {
    if (!isAdmin()) return '';
    return `<section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}">
        <div class="profile-panel-title"><span>成员管理</span></div>
        <div class="profile-tools" style="margin-bottom:12px;">
            <button class="btn btn-primary btn-sm" data-admin-members-refresh onclick="adminLoadMembers(true)">刷新成员</button>
        </div>
        <div id="adminMemberRows" class="profile-list">${renderAdminMemberRows()}</div>
    </section>`;
}

function renderAdminMembersPage() {
    return `${renderAdminManagementPanels()}${renderAdminRolePanel()}`;
}

function renderAdminTalentPoolPage() {
    return `${renderAdminTalentWarehousePanel()}${renderAdminFaithTraitPanel()}`;
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
        adminMembers = (Array.isArray(data) ? data : []).filter(member => member?.isActive !== false);
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
    if (!canManageTalentPoolUI()) return;
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

async function adminLoadFaithTraits(showResult = false) {
    if (!canManageTalentPoolUI()) return;
    adminFaithTraitsLoading = true;
    const rows = document.getElementById('adminFaithTraitRows');
    if (rows) rows.innerHTML = '<div class="profile-empty">正在读取信仰特性...</div>';
    try {
        const traits = await loadFaithTraits({ showError: showResult, ttl: showResult ? 1 : undefined });
        adminFaithTraits = Array.isArray(traits) ? traits : getFaithTraitEntries();
        if (showResult) showToast(`已读取 ${adminFaithTraits.length} 条信仰特性`);
    } finally {
        adminFaithTraitsLoading = false;
        const target = document.getElementById('adminFaithTraitRows');
        if (target) target.innerHTML = renderAdminFaithTraitCards();
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

function findAdminTalentPoolItem(poolKey, talentId) {
    const cleanPool = String(poolKey || '');
    const cleanId = Number(talentId || 0);
    for (const pool of adminTalentPools || []) {
        const item = (pool.items || []).find(candidate =>
            String(candidate.poolKey || '') === cleanPool &&
            Number(candidate.talentId || 0) === cleanId
        );
        if (item) return item;
    }
    return null;
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
    setAdminManagementStatus('权限调整处理中...', 'pending');
    try {
        const { error } = await invokeDungeonAction('adminSetAccountRole', { targetHash, role: nextRole });
        if (error) {
            const message = `权限调整失败：${error.message || '后端未返回原因'}`;
            setAdminManagementStatus(message, 'error');
            showToast(`失败：${error.message || '权限调整失败'}`);
            return;
        }
        setAdminManagementStatus('权限调整完成', 'success');
        showToast('权限调整完成');
        await refreshAdminOperationLogs();
        await adminLoadMembers(false);
        await renderAdminPage();
    } catch (error) {
        const message = `权限调整失败：${error?.message || error || '未知错误'}`;
        setAdminManagementStatus(message, 'error');
        showToast(`失败：${error?.message || '权限调整失败'}`);
    }
}

async function adminRenameMember(targetHash, currentName) {
    const nextName = window.prompt(`给 ${currentName || '该玩家'} 改成什么名字？`, currentName || '');
    if (!nextName) return;
    setAdminManagementStatus('改名处理中...', 'pending');
    try {
        const { error } = await invokeDungeonAction('adminRenameAccount', { targetHash, displayName: nextName });
        if (error) {
            const message = `改名失败：${error.message || '后端未返回原因'}`;
            setAdminManagementStatus(message, 'error');
            showToast(`失败：${error.message || '改名失败'}`);
            return;
        }
        setAdminManagementStatus('改名完成', 'success');
        showToast('改名完成');
        await Promise.all([adminLoadMembers(false), refreshAdminOperationLogs()]);
        await renderAdminPage();
    } catch (error) {
        const message = `改名失败：${error?.message || error || '未知错误'}`;
        setAdminManagementStatus(message, 'error');
        showToast(`失败：${error?.message || '改名失败'}`);
    }
}

async function adminResetMember(targetHash, displayName) {
    if (!window.confirm(`确认重置 ${displayName || '该玩家'} 的个人状态？这会清空档案、分数、天赋、称号诅咒等个人数据，但保留账号。`)) return;
    setAdminManagementStatus('账号重置处理中...', 'pending');
    try {
        const { error } = await invokeDungeonAction('adminResetAccount', { targetHash });
        if (error) {
            const message = `重置失败：${error.message || '后端未返回原因'}`;
            setAdminManagementStatus(message, 'error');
            showToast(`失败：${error.message || '重置失败'}`);
            return;
        }
        setAdminManagementStatus('账号已重置', 'success');
        showToast('账号已重置');
        await Promise.all([adminLoadMembers(false), refreshAdminOperationLogs()]);
        await renderAdminPage();
    } catch (error) {
        const message = `重置失败：${error?.message || error || '未知错误'}`;
        setAdminManagementStatus(message, 'error');
        showToast(`失败：${error?.message || '重置失败'}`);
    }
}

async function adminDeleteMember(targetHash, displayName) {
    const typed = window.prompt(`删除会禁用 ${displayName || '该账号'} 并清空个人状态。请输入玩家昵称确认。`);
    if (typed !== displayName) { showToast('昵称不一致，已取消删除'); return; }
    setAdminManagementStatus('账号删除处理中...', 'pending');
    try {
        const { error } = await invokeDungeonAction('adminDeleteAccount', { targetHash });
        if (error) {
            const message = `删除失败：${error.message || '后端未返回原因'}`;
            setAdminManagementStatus(message, 'error');
            showToast(`失败：${error.message || '删除失败'}`);
            return;
        }
        adminMembers = adminMembers.filter(member => member.codeHash !== targetHash);
        const rows = document.getElementById('adminMemberRows');
        if (rows) rows.innerHTML = renderAdminMemberRows();
        const roleTarget = document.getElementById('adminRoleTarget');
        if (roleTarget) {
            roleTarget.innerHTML = adminMembers
                .filter(member => member.isActive && member.role !== 'god')
                .map(member => `<option value="${escapeHtml(member.codeHash)}">${escapeHtml(member.displayName || '未命名')} · ${escapeHtml(member.role || 'player')}</option>`)
                .join('') || '<option value="">暂无可调整成员</option>';
        }
        const successMessage = `已删除 ${displayName || '该账号'}，成员列表已刷新`;
        setAdminManagementStatus(successMessage, 'success');
        showToast(successMessage);
        await Promise.all([adminLoadMembers(false), refreshAdminOperationLogs()]);
        setAdminManagementStatus(successMessage, 'success');
    } catch (error) {
        const message = `删除失败：${error?.message || error || '未知错误'}`;
        setAdminManagementStatus(message, 'error');
        showToast(`失败：${error?.message || '删除失败'}`);
    }
}

function fillAdminTalentFields(fields) {
    Object.entries(fields).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === 'checkbox') {
            el.checked = value !== false;
        } else {
            el.value = value ?? '';
        }
    });
}

function getAdminTalentPayloadFromFields(prefix = 'adminTalent') {
    return {
        poolKey: document.getElementById(`${prefix}PoolKey`)?.value || adminTalentPoolSelected,
        talentId: document.getElementById(`${prefix}Id`)?.value || '',
        talentName: document.getElementById(`${prefix}Name`)?.value || '',
        rank: document.getElementById(`${prefix}Rank`)?.value || 'C',
        effect: document.getElementById(`${prefix}Effect`)?.value || '',
        cooldown: document.getElementById(`${prefix}Cooldown`)?.value || '',
        actionCost: document.getElementById(`${prefix}ActionCost`)?.value || 0,
        isEnabled: !!document.getElementById(`${prefix}Enabled`)?.checked,
        adminNote: document.getElementById(`${prefix}Note`)?.value || ''
    };
}

function openAdminTalentEditModal(item) {
    adminTalentEditingItem = item || null;
    if (!adminTalentEditingItem) {
        showToast('没有找到这个天赋，请刷新仓库后再试');
        return;
    }
    adminTalentPoolSelected = adminTalentEditingItem.poolKey || adminTalentPoolSelected;
    fillAdminTalentFields({
        adminTalentModalPoolKey: adminTalentEditingItem.poolKey || '',
        adminTalentModalId: adminTalentEditingItem.talentId || '',
        adminTalentModalName: adminTalentEditingItem.talentName || '',
        adminTalentModalRank: adminTalentEditingItem.rank || 'C',
        adminTalentModalEffect: adminTalentEditingItem.effect || '',
        adminTalentModalCooldown: adminTalentEditingItem.cooldown || '',
        adminTalentModalActionCost: adminTalentEditingItem.actionCost || 0,
        adminTalentModalEnabled: adminTalentEditingItem.isEnabled !== false,
        adminTalentModalNote: adminTalentEditingItem.adminNote || ''
    });
    const title = document.getElementById('adminTalentEditModalTitle');
    if (title) title.textContent = `编辑天赋 #${Number(adminTalentEditingItem.talentId || 0)}`;
    const overlay = document.getElementById('adminTalentEditModalOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
    }
    setAdminManagementStatus(`正在编辑 #${Number(adminTalentEditingItem.talentId || 0)} ${adminTalentEditingItem.talentName || '天赋'}`, 'success');
    window.setTimeout(() => document.getElementById('adminTalentModalName')?.focus(), 80);
}

function closeAdminTalentEditModal(event) {
    const overlay = document.getElementById('adminTalentEditModalOverlay');
    if (event && event.target !== overlay) return;
    if (overlay) overlay.style.display = 'none';
    adminTalentEditingItem = null;
}

function findAdminFaithTrait(god) {
    const cleanGod = cleanGodName(god);
    return getAdminFaithTraitList().find(item => item.god === cleanGod) || null;
}

function openAdminFaithTraitEditModal(item) {
    adminFaithTraitEditingItem = item || null;
    if (!adminFaithTraitEditingItem) {
        showToast('没有找到这个信仰特性，请刷新后再试');
        return;
    }
    fillAdminTalentFields({
        adminFaithTraitModalGod: adminFaithTraitEditingItem.god || '',
        adminFaithTraitModalPath: adminFaithTraitEditingItem.path || '',
        adminFaithTraitModalTrait: adminFaithTraitEditingItem.trait || '',
        adminFaithTraitModalNote: adminFaithTraitEditingItem.adminNote || ''
    });
    const title = document.getElementById('adminFaithTraitEditModalTitle');
    if (title) title.textContent = `编辑 ${adminFaithTraitEditingItem.god || '信仰'}特性`;
    const overlay = document.getElementById('adminFaithTraitEditModalOverlay');
    if (overlay) overlay.style.display = 'flex';
    setAdminManagementStatus(`正在编辑 ${adminFaithTraitEditingItem.god || '信仰'}特性`, 'success');
    window.setTimeout(() => document.getElementById('adminFaithTraitModalTrait')?.focus(), 80);
}

function closeAdminFaithTraitEditModal(event) {
    const overlay = document.getElementById('adminFaithTraitEditModalOverlay');
    if (event && event.target !== overlay) return;
    if (overlay) overlay.style.display = 'none';
    adminFaithTraitEditingItem = null;
}

function adminEditFaithTrait(god) {
    openAdminFaithTraitEditModal(findAdminFaithTrait(god));
}

async function adminSaveFaithTraitFromModal() {
    const payload = {
        god: document.getElementById('adminFaithTraitModalGod')?.value || '',
        path: document.getElementById('adminFaithTraitModalPath')?.value || '',
        trait: document.getElementById('adminFaithTraitModalTrait')?.value || '',
        adminNote: document.getElementById('adminFaithTraitModalNote')?.value || '',
        isEnabled: true
    };
    if (!payload.god || !payload.trait.trim()) {
        showToast('请填写神明和信仰特性');
        return;
    }
    setAdminManagementStatus('信仰特性保存处理中...', 'pending');
    try {
        const { error } = await invokeDungeonAction('adminUpsertFaithTrait', payload);
        if (error) {
            const message = `保存失败：${error.message || '后端未返回原因'}`;
            setAdminManagementStatus(message, 'error');
            showToast(`失败：${error.message || '保存失败'}`);
            return;
        }
        closeAdminFaithTraitEditModal();
        invalidateShortReadCache('faith-traits');
        await adminLoadFaithTraits(false);
        await refreshAdminOperationLogs();
        if (document.getElementById('profilePage')?.style.display !== 'none') await renderProfilePage();
        setAdminManagementStatus('信仰特性已保存', 'success');
        showToast('信仰特性已保存');
    } catch (error) {
        const message = `保存失败：${error?.message || error || '未知错误'}`;
        setAdminManagementStatus(message, 'error');
        showToast(`失败：${error?.message || '保存失败'}`);
    }
}

function adminEditTalentPoolItem(rawItem) {
    const item = typeof rawItem === 'string' ? JSON.parse(rawItem) : rawItem;
    openAdminTalentEditModal(item);
}

function adminEditTalentPoolItemByKey(poolKey, talentId) {
    adminEditTalentPoolItem(findAdminTalentPoolItem(poolKey, talentId));
}

function adminClearTalentPoolForm() {
    ['adminTalentId', 'adminTalentName', 'adminTalentEffect', 'adminTalentCooldown', 'adminTalentNote'].forEach(id => {
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
    const payload = getAdminTalentPayloadFromFields('adminTalent');
    setAdminManagementStatus('天赋保存处理中...', 'pending');
    try {
        const { error } = await invokeDungeonAction('adminUpsertTalentPoolItem', payload);
        if (error) {
            const message = `保存失败：${error.message || '后端未返回原因'}`;
            setAdminManagementStatus(message, 'error');
            showToast(`失败：${error.message || '保存失败'}`);
            return;
        }
        adminTalentPoolSelected = String(payload.poolKey || '');
        setAdminManagementStatus('天赋已保存', 'success');
        showToast('天赋已保存');
        await Promise.all([adminLoadTalentWarehouse(false), refreshAdminOperationLogs()]);
        await renderAdminPage();
    } catch (error) {
        const message = `保存失败：${error?.message || error || '未知错误'}`;
        setAdminManagementStatus(message, 'error');
        showToast(`失败：${error?.message || '保存失败'}`);
    }
}

async function adminSaveTalentPoolItemFromModal() {
    const payload = getAdminTalentPayloadFromFields('adminTalentModal');
    setAdminManagementStatus('天赋保存处理中...', 'pending');
    try {
        const { error } = await invokeDungeonAction('adminUpsertTalentPoolItem', payload);
        if (error) {
            const message = `保存失败：${error.message || '后端未返回原因'}`;
            setAdminManagementStatus(message, 'error');
            showToast(`失败：${error.message || '保存失败'}`);
            return;
        }
        adminTalentPoolSelected = String(payload.poolKey || '');
        fillAdminTalentFields({
            adminTalentPoolKey: payload.poolKey,
            adminTalentId: payload.talentId,
            adminTalentName: payload.talentName,
            adminTalentRank: payload.rank,
            adminTalentEffect: payload.effect,
            adminTalentCooldown: payload.cooldown,
            adminTalentActionCost: payload.actionCost,
            adminTalentEnabled: payload.isEnabled,
            adminTalentNote: payload.adminNote
        });
        closeAdminTalentEditModal();
        setAdminManagementStatus('天赋已保存，仓库已刷新', 'success');
        showToast('天赋已保存');
        await Promise.all([adminLoadTalentWarehouse(false), refreshAdminOperationLogs()]);
        await renderAdminPage();
    } catch (error) {
        const message = `保存失败：${error?.message || error || '未知错误'}`;
        setAdminManagementStatus(message, 'error');
        showToast(`失败：${error?.message || '保存失败'}`);
    }
}

function parseAdminTalentBatchLine(line, index) {
    const raw = String(line || '').trim();
    if (!raw) return null;
    const parts = raw.includes('\t') ? raw.split('\t') : raw.split(/[|｜]/);
    if (parts.length < 6) throw new Error(`第 ${index + 1} 行格式不足：需要 编号｜名字｜等级｜效果｜冷却｜行动点`);
    const [talentId, talentName, rank, effect, cooldown, actionCost] = parts.map(part => String(part || '').trim());
    const cleanRank = String(rank || '').toUpperCase();
    if (!Number(talentId) || !talentName || !['S', 'A', 'B', 'C'].includes(cleanRank)) {
        throw new Error(`第 ${index + 1} 行格式错误：编号、名字、等级不能为空，等级只能是 S/A/B/C`);
    }
    return { talentId, talentName, rank: cleanRank, effect, cooldown, actionCost, isEnabled: true, adminNote: '批量导入' };
}

async function adminBatchSaveTalentPoolItems() {
    const poolKey = document.getElementById('adminTalentPoolKey')?.value || adminTalentPoolSelected;
    const text = document.getElementById('adminTalentBatchInput')?.value || '';
    if (!poolKey) { showToast('请先选择或填写天赋池'); return; }
    let items = [];
    try {
        items = text.split(/\r?\n/).map(parseAdminTalentBatchLine).filter(Boolean);
    } catch (error) {
        setAdminManagementStatus(error.message || '批量格式错误', 'error');
        showToast(error.message || '批量格式错误');
        return;
    }
    if (!items.length) { showToast('请粘贴至少一行天赋'); return; }
    if (!window.confirm(`确认批量保存 ${items.length} 个天赋到 ${poolKey}？同编号会覆盖。`)) return;
    setAdminManagementStatus(`正在批量保存 ${items.length} 个天赋...`, 'pending');
    try {
        const { data, error } = await invokeDungeonAction('adminBatchUpsertTalentPoolItems', { poolKey, items });
        if (error) {
            const message = `批量保存失败：${error.message || '后端未返回原因'}`;
            setAdminManagementStatus(message, 'error');
            showToast(message);
            return;
        }
        adminTalentPoolSelected = String(poolKey || '');
        setAdminManagementStatus(`批量保存完成：${Number(data?.count || items.length)} 个天赋`, 'success');
        showToast('批量保存完成');
        const input = document.getElementById('adminTalentBatchInput');
        if (input) input.value = '';
        await Promise.all([adminLoadTalentWarehouse(false), refreshAdminOperationLogs()]);
        await renderAdminPage();
    } catch (error) {
        const message = `批量保存失败：${error?.message || error || '未知错误'}`;
        setAdminManagementStatus(message, 'error');
        showToast(message);
    }
}

async function adminToggleTalentPoolItem(poolKey, talentId, enabled) {
    setAdminManagementStatus('天赋状态更新中...', 'pending');
    try {
        const { error } = await invokeDungeonAction('adminSetTalentPoolItemEnabled', { poolKey, talentId, enabled });
        if (error) {
            const message = `启停失败：${error.message || '后端未返回原因'}`;
            setAdminManagementStatus(message, 'error');
            showToast(`失败：${error.message || '启停失败'}`);
            return;
        }
        const message = enabled ? '天赋已启用' : '天赋已停用';
        setAdminManagementStatus(message, 'success');
        showToast(message);
        await Promise.all([adminLoadTalentWarehouse(false), refreshAdminOperationLogs()]);
        await renderAdminPage();
    } catch (error) {
        const message = `启停失败：${error?.message || error || '未知错误'}`;
        setAdminManagementStatus(message, 'error');
        showToast(`失败：${error?.message || '启停失败'}`);
    }
}

if (typeof renderAdminPage === 'function') {
    const renderAdminPageBase = renderAdminPage;
    renderAdminPage = async function renderAdminPageWithManagement() {
        const container = document.getElementById('adminContent');
        if (!container || !canUseAdminConsole()) {
            await renderAdminPageBase();
            return;
        }
        if (!isAdmin() && adminManagementView === 'members') adminManagementView = 'overview';
        if (!canManageTalentPoolUI() && adminManagementView === 'talents') adminManagementView = 'overview';
        if (adminManagementView === 'members') {
            container.innerHTML = `${renderAdminManagementNav()}${renderAdminMembersPage()}`;
            if (!adminMembers.length && !adminManagementLoading) await adminLoadMembers(false);
            return;
        }
        if (adminManagementView === 'talents') {
            container.innerHTML = `${renderAdminManagementNav()}${renderAdminTalentPoolPage()}`;
            const loads = [];
            if (!adminTalentPools.length && !adminTalentWarehouseLoading) loads.push(adminLoadTalentWarehouse(false));
            if (!adminFaithTraits.length && !adminFaithTraitsLoading) loads.push(adminLoadFaithTraits(false));
            if (loads.length) await Promise.all(loads);
            return;
        }
        await renderAdminPageBase();
        container.insertAdjacentHTML('afterbegin', renderAdminManagementNav());
    };
}

// Delegated permission workbench for non-curator staff.

let permissionDeskScrollY = 0;

function canUsePermissionDesk() {
    return hasInvitePermission('talent_pool_manage') ||
        hasInvitePermission('account_role_manage') ||
        hasInvitePermission('review_dungeons') ||
        hasInvitePermission('settle_scores');
}

function openReviewQueueFromWorkbench() {
    closePermissionDesk(false);
    closeAdminPage(false);
    setSort('newest');
    if (reviewFilter !== 'pending') toggleReviewFilter();
    window.scrollTo(0, 0);
}

async function openTalentManagementFromWorkbench() {
    adminManagementView = 'talents';
    await openAdminPage();
}

function renderPermissionShortcutCards() {
    const cards = [];
    if (hasInvitePermission('review_dungeons')) {
        cards.push(['副本审核', 'openReviewQueueFromWorkbench()']);
    }
    if (hasInvitePermission('account_role_manage')) {
        cards.push(['玩家升作者', "document.getElementById('permissionUpgradeName')?.focus()"]);
    }
    if (hasInvitePermission('settle_scores')) {
        cards.push(['分数结算', 'openScorePage()']);
    }
    if (hasInvitePermission('talent_pool_manage')) {
        cards.push(['天赋池维护', 'openTalentManagementFromWorkbench()']);
        cards.push(['天赋池仓库', 'openTalentManagementFromWorkbench()']);
    }
    return `<section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}">
        <div class="profile-panel-title"><span>权限工作台</span></div>
        <div class="profile-tools">
            ${cards.map(([label, action]) => `<button class="btn btn-outline btn-sm" onclick="${escapeHtml(action)}">${escapeHtml(label)}</button>`).join('')}
        </div>
    </section>`;
}

function renderPermissionDeskContent() {
    if (!canUsePermissionDesk()) {
        return renderRitualEmpty('当前账号没有额外管理权限。', '真理', '权限不足');
    }
    const panels = [renderPermissionShortcutCards()];
    if (hasInvitePermission('settle_scores')) {
        panels.push(`<section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}">
            <div class="profile-panel-title"><span>分数权限</span></div>
            <div class="profile-tools"><button class="btn btn-primary btn-sm" onclick="openScorePage()">打开分数结算</button></div>
        </section>`);
    }
    if (hasInvitePermission('review_dungeons')) {
        panels.push(`<section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}">
            <div class="profile-panel-title"><span>副本审核</span></div>
            <div class="profile-tools"><button class="btn btn-primary btn-sm" onclick="openReviewQueueFromWorkbench()">查看待审核副本</button></div>
        </section>`);
    }
    if (hasInvitePermission('account_role_manage')) {
        panels.push(`<section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}">
            <div class="profile-panel-title"><span>玩家升作者</span></div>
            <div class="profile-form-grid">
                <div class="form-group full">
                    <label>玩家昵称</label>
                    <input id="permissionUpgradeName" maxlength="40" placeholder="输入玩家当前昵称">
                </div>
            </div>
            <div class="profile-tools">
                <button class="btn btn-primary btn-sm" onclick="permissionUpgradePlayerToAuthor()">升级为作者</button>
            </div>
        </section>`);
    }
    if (hasInvitePermission('talent_pool_manage')) {
        panels.push(`<section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}">
            <div class="profile-panel-title"><span>天赋池仓库</span></div>
            <div class="profile-tools"><button class="btn btn-primary btn-sm" onclick="openTalentManagementFromWorkbench()">打开天赋池维护</button></div>
        </section>`);
    }
    return panels.join('');
}

function renderPermissionDesk() {
    const container = document.getElementById('permissionContent');
    if (!container) return;
    container.innerHTML = renderPermissionDeskContent();
}

function renderPermissionTalentPoolPanel() {
    return `<section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}">
        <div class="profile-panel-title"><span>天赋池维护</span></div>
        <div class="profile-form-grid">
            <div class="form-group"><label>天赋池</label><input id="permissionTalentPoolKey" maxlength="40" placeholder="例如 Pool战士"></div>
            <div class="form-group"><label>编号</label><input id="permissionTalentId" type="number" min="1" placeholder="留空自动编号"></div>
            <div class="form-group"><label>等级</label><select id="permissionTalentRank"><option>S</option><option>A</option><option>B</option><option selected>C</option></select></div>
            <div class="form-group"><label>行动点</label><input id="permissionTalentActionCost" type="number" min="0" max="99" value="0"></div>
            <div class="form-group full"><label>天赋名</label><input id="permissionTalentName" maxlength="80" placeholder="填写天赋名称"></div>
            <div class="form-group full"><label>效果</label><textarea id="permissionTalentEffect" maxlength="600" rows="3" placeholder="填写天赋效果"></textarea></div>
            <div class="form-group"><label class="identity-help"><input id="permissionTalentEnabled" type="checkbox" checked> 启用到抽池</label></div>
            <div class="form-group full"><label>备注</label><input id="permissionTalentNote" maxlength="300" placeholder="可选"></div>
        </div>
        <div class="profile-tools">
            <button class="btn btn-primary btn-sm" onclick="permissionSaveTalentPoolItem()">保存天赋</button>
        </div>
    </section>`;
}

async function permissionUpgradePlayerToAuthor() {
    const targetName = cleanDisplayNameInput(document.getElementById('permissionUpgradeName')?.value || '');
    if (!targetName) {
        showToast('请输入玩家昵称');
        return;
    }
    if (!window.confirm(`确认将 ${targetName} 从玩家升级为作者？`)) return;
    const { error } = await invokeDungeonAction('adminSetAccountRole', { targetName, role: 'author' });
    if (error) {
        showToast(`失败：${error.message || '升级失败'}`);
        return;
    }
    showToast(`${targetName} 已升级为作者`);
}

async function permissionSaveTalentPoolItem() {
    const payload = {
        poolKey: document.getElementById('permissionTalentPoolKey')?.value || '',
        talentId: document.getElementById('permissionTalentId')?.value || '',
        talentName: document.getElementById('permissionTalentName')?.value || '',
        rank: document.getElementById('permissionTalentRank')?.value || 'C',
        effect: document.getElementById('permissionTalentEffect')?.value || '',
        actionCost: document.getElementById('permissionTalentActionCost')?.value || 0,
        isEnabled: !!document.getElementById('permissionTalentEnabled')?.checked,
        adminNote: document.getElementById('permissionTalentNote')?.value || ''
    };
    const { error } = await invokeDungeonAction('adminUpsertTalentPoolItem', payload);
    if (error) {
        showToast(`失败：${error.message || '保存失败'}`);
        return;
    }
    showToast('天赋已保存到抽池');
}

function openPermissionDesk() {
    if (!canUsePermissionDesk()) {
        showToast('当前账号没有权限工作台权限');
        return;
    }
    permissionDeskScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    ['profilePage', 'leaderboardPage', 'scorePage', 'matchPage', 'adminPage'].forEach(id => {
        const page = document.getElementById(id);
        if (page) page.style.display = 'none';
    });
    document.body.classList.remove('leaderboard-view-open', 'score-view-open', 'match-view-open');
    document.body.classList.add('profile-view-open');
    const page = document.getElementById('permissionPage');
    if (page) page.style.display = 'block';
    window.scrollTo(0, 0);
    renderPermissionDesk();
}

function closePermissionDesk(restoreScroll = true) {
    const page = document.getElementById('permissionPage');
    if (page) page.style.display = 'none';
    document.body.classList.remove('profile-view-open');
    if (restoreScroll !== false) requestAnimationFrame(() => window.scrollTo(0, permissionDeskScrollY || 0));
}

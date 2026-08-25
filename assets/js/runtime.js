function updateReviewFilterButton() {
    const button = document.getElementById('reviewFilterBtn');
    if (!button) return;
    const visible = canReviewDungeonsUI();
    button.style.display = visible ? '' : 'none';
    button.classList.toggle('active', reviewFilter === 'pending');
    button.textContent = reviewFilter === 'pending' ? '待审核中' : '待审核';
}

function isMobileViewport() {
    return window.matchMedia('(max-width: 720px)').matches;
}

function getMobileDestinations() {
    return ['dungeons', 'leaderboard', 'profile', 'talent', 'messages'];
}

function setMobileScreenClass(destination, direction = 0) {
    mobileActiveDestination = getMobileDestinations().includes(destination) ? destination : 'dungeons';
    document.body.classList.toggle('mobile-app-mode', isMobileViewport());
    document.body.style.setProperty('--mobile-screen-shift', direction < 0 ? '-14px' : '14px');
    document.body.classList.remove(
        'mobile-screen-dungeons',
        'mobile-screen-leaderboard',
        'mobile-screen-profile',
        'mobile-screen-talent',
        'mobile-screen-messages'
    );
    document.body.classList.add(`mobile-screen-${mobileActiveDestination}`);
}

function setMobileNavActive(destination) {
    mobileActiveDestination = getMobileDestinations().includes(destination) ? destination : 'dungeons';
    setMobileScreenClass(mobileActiveDestination);
    document.querySelectorAll('.mobile-nav-item').forEach(button => {
        button.classList.toggle('active', button.dataset.mobileDest === mobileActiveDestination);
    });
}

function renderMobileProfileTabs() {
    const tabs = [
        ['base', '基础'],
        ['talent', '天赋'],
        ['trials', '试炼'],
        ['titles', '称号'],
        ['messages', '消息']
    ];
    return `<div class="mobile-profile-tabs" role="tablist" aria-label="信徒档案分区">${tabs.map(([key, label]) => `<button type="button" class="mobile-profile-tab ${mobileProfileTab === key ? 'active' : ''}" data-profile-tab="${key}" onclick="setMobileProfileTab('${key}')">${label}</button>`).join('')}</div>`;
}

function setMobileProfileTab(tab, options = {}) {
    const allowed = ['base', 'talent', 'trials', 'titles', 'messages'];
    mobileProfileTab = allowed.includes(tab) ? tab : 'base';
    document.querySelectorAll('.mobile-profile-tab').forEach(button => {
        button.classList.toggle('active', button.dataset.profileTab === mobileProfileTab);
    });
    document.querySelectorAll('.profile-mobile-section').forEach(section => {
        section.classList.toggle('active', section.dataset.mobileProfileSection === mobileProfileTab);
    });
    if (options.scroll !== false && isMobileViewport()) {
        document.getElementById('profileContent')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (mobileProfileTab === 'talent') setMobileNavActive('talent');
    else if (mobileProfileTab === 'messages') setMobileNavActive('messages');
    else setMobileNavActive('profile');
}

async function mobileNavigate(destination) {
    const dest = destination || 'dungeons';
    const order = getMobileDestinations();
    const fromIndex = order.indexOf(mobileActiveDestination);
    const toIndex = order.indexOf(dest);
    setMobileScreenClass(dest, toIndex >= fromIndex ? 1 : -1);
    if (dest === 'dungeons') {
        closeProfilePage(false);
        closeLeaderboardPage(false);
        closeMatchPage(false);
        closeScorePage(false);
        closeAdminPage(false);
        const detailOverlay = document.getElementById('detailOverlay');
        if (detailOverlay) detailOverlay.style.display = 'none';
        document.body.classList.remove('detail-view-open');
        setMobileNavActive('dungeons');
        requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
        return;
    }
    if (dest === 'leaderboard') {
        setMobileNavActive('leaderboard');
        await openLeaderboardPage();
        return;
    }
    if (dest === 'talent' || dest === 'messages' || dest === 'profile') {
        mobileProfileTab = dest === 'talent' ? 'talent' : dest === 'messages' ? 'messages' : 'base';
        setMobileNavActive(dest);
        await openProfilePage(mobileProfileTab);
    }
}

function dismissMobileOnboarding(remember = false) {
    if (remember) setLocalData(MOBILE_ONBOARDING_STORAGE_KEY, true);
    document.getElementById('mobileOnboarding')?.classList.remove('visible');
}

function maybeShowMobileOnboarding() {
    if (!isMobileViewport()) return;
    setMobileScreenClass(mobileActiveDestination || 'dungeons');
    if (getLocalData(MOBILE_ONBOARDING_STORAGE_KEY, false)) return;
    window.setTimeout(() => {
        if (isMobileViewport()) document.getElementById('mobileOnboarding')?.classList.add('visible');
    }, 650);
}

function shouldIgnoreMobileSwipe(target) {
    if (!isMobileViewport()) return true;
    if (!(target instanceof Element)) return false;
    return !!target.closest('input, textarea, select, button, a, .modal-overlay, .detail-overlay, .mobile-onboarding, .advanced-filters, .mobile-profile-tabs, .leaderboard-tabs, .leaderboard-path-tabs, .sort-group, .path-nav');
}

function handleMobileTouchStart(event) {
    if (shouldIgnoreMobileSwipe(event.target) || event.touches.length !== 1) return;
    const touch = event.touches[0];
    mobileTouchStart = { x: touch.clientX, y: touch.clientY, time: Date.now() };
}

function handleMobileTouchEnd(event) {
    if (!mobileTouchStart || shouldIgnoreMobileSwipe(event.target)) {
        mobileTouchStart = null;
        return;
    }
    const touch = event.changedTouches[0];
    const dx = touch.clientX - mobileTouchStart.x;
    const dy = touch.clientY - mobileTouchStart.y;
    const dt = Date.now() - mobileTouchStart.time;
    mobileTouchStart = null;
    if (dt > 700 || Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    const order = getMobileDestinations();
    const currentIndex = Math.max(0, order.indexOf(mobileActiveDestination));
    const nextIndex = dx < 0 ? Math.min(order.length - 1, currentIndex + 1) : Math.max(0, currentIndex - 1);
    if (nextIndex !== currentIndex) mobileNavigate(order[nextIndex]);
}

function toggleMobileFab() {
    document.getElementById('mobileFab')?.classList.toggle('open');
}

async function mobileQuickAction(action) {
    document.getElementById('mobileFab')?.classList.remove('open');
    if (action === 'top') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }
    if (action === 'invite') {
        openInviteModal();
        return;
    }
    if (action === 'build') {
        openSubmitModal();
        return;
    }
    if (action === 'save') {
        if (document.getElementById('profilePage')?.style.display !== 'none') await saveProfilePage();
        else showToast('请先进入个人档案');
        return;
    }
    if (action === 'refresh') {
        if (document.getElementById('profilePage')?.style.display !== 'none') await renderProfilePage();
        else if (document.getElementById('leaderboardPage')?.style.display !== 'none') await renderLeaderboardPage();
        else await renderDungeonList();
        showToast('已刷新当前数据');
        return;
    }
    if (action === 'profile') await mobileNavigate('profile');
}

function acquireUiActionLock(key, busyMessage = '操作正在处理中，请勿重复点击') {
    if (uiActionLocks.has(key)) {
        showToast(busyMessage);
        return false;
    }
    uiActionLocks.add(key);
    return true;
}

function releaseUiActionLock(key) {
    uiActionLocks.delete(key);
}

function setActionButtonsBusy(selector, busyText = '处理中...') {
    const buttons = [...document.querySelectorAll(selector)].filter(button => button instanceof HTMLButtonElement);
    buttons.forEach(button => {
        if (!button.dataset.idleText) button.dataset.idleText = button.textContent || '';
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        button.textContent = busyText;
    });
    return () => {
        buttons.forEach(button => {
            button.disabled = false;
            button.removeAttribute('aria-busy');
            button.textContent = button.dataset.idleText || button.textContent || '';
            delete button.dataset.idleText;
        });
    };
}

function resetTalentViewState() {
    selectedTalentPool = '';
    lastTalentDrawResult = [];
    talentDrawInFlight = false;
    talentManageInFlight = false;
    currentTalentState = normalizeTalentState(null);
    currentTalentError = null;
}

function updateInviteUI() {
    const role = getInviteRole();
    const roleBadge = document.getElementById('roleBadge');
    const inviteButton = document.getElementById('inviteButton');
    const submitButton = document.getElementById('submitEntryButton');
    const scoreButton = document.getElementById('scoreDeskButton');
    const mobileScoreButton = document.getElementById('mobileScoreButton');
    const permissionButton = document.getElementById('permissionDeskButton');
    const mobilePermissionButton = document.getElementById('mobilePermissionButton');
    const adminButton = document.getElementById('adminDeskButton');
    const mobileAdminButton = document.getElementById('mobileAdminButton');
    const mobileActionStrip = document.getElementById('mobileActionStrip');
    const identityCard = document.getElementById('identityCard');
    const identityRoleText = document.getElementById('identityRoleText');
    const displayNameInput = document.getElementById('displayNameInput');
    const displayNameRow = displayNameInput?.closest('.identity-row');
    const displayNameHelp = identityCard?.querySelector('.identity-help');
    const showDisplayNameBinding = !role || canEditDisplayName();
    const initialDisplayNameBinding = isInitialDisplayNameBinding();
    if (roleBadge) {
        const registry = role === 'god' ? '神明席' : role === 'astral' ? '星途席' : role === 'admin' ? '神谕馆册' : role === 'reviewer' ? '审核席' : role === 'author' ? '构筑者名录' : '信徒名录';
        roleBadge.textContent = role ? `${registry} · ${inviteSession?.name || ROLE_LABELS[role]}` : '旁观者只读';
        roleBadge.classList.toggle('active', !!role);
        roleBadge.dataset.role = role || 'guest';
        roleBadge.classList.remove('has-notice');
        roleBadge.removeAttribute('data-notice');
        roleBadge.title = role ? '打开个人档案' : '验入局谕令后查看个人档案';
    }
    if (inviteButton) inviteButton.textContent = '🎲 同契召引';
    if (scoreButton) {
        scoreButton.style.display = isGodRole() ? '' : 'none';
        scoreButton.textContent = '✦ 称号敕令';
        scoreButton.title = '神明称号敕令台';
    }
    if (mobileScoreButton) {
        mobileScoreButton.hidden = !isGodRole();
        mobileScoreButton.textContent = '称号敕令';
        mobileScoreButton.title = '神明称号敕令台';
    }
    if (permissionButton) {
        permissionButton.style.display = canUsePermissionDesk() ? '' : 'none';
        permissionButton.title = '按已分配职责处理权限事务';
    }
    if (mobilePermissionButton) {
        mobilePermissionButton.hidden = !canUsePermissionDesk();
        mobilePermissionButton.title = '按已分配职责处理权限事务';
    }
    if (adminButton) {
        adminButton.style.display = canUseAdminConsole() ? '' : 'none';
        adminButton.title = '馆主后台与权限工作台';
    }
    if (mobileAdminButton) {
        mobileAdminButton.hidden = !canUseAdminConsole();
        mobileAdminButton.title = '馆主后台与权限工作台';
    }
    if (mobileActionStrip) {
        const actionCount = [...mobileActionStrip.querySelectorAll('button:not([hidden])')].length;
        mobileActionStrip.classList.remove('action-count-2', 'action-count-3', 'action-count-4');
        mobileActionStrip.classList.add(`action-count-${Math.max(2, Math.min(4, actionCount))}`);
    }
    if (submitButton) {
        submitButton.textContent = isGodRole() ? '✦ 祈愿创本' : '🎭 构筑愚戏';
        submitButton.style.display = (!role || canSubmit()) ? '' : 'none';
        submitButton.title = isGodRole() ? '写下祈愿创本' : (canSubmit() ? '构筑愚戏' : '需要构筑者或审核员谕令');
    }
    if (identityCard) identityCard.classList.toggle('active', !!role);
    if (identityRoleText) identityRoleText.textContent = role ? `${ROLE_LABELS[role]}` : '未入局';
    if (displayNameRow) displayNameRow.style.display = showDisplayNameBinding ? '' : 'none';
    if (displayNameHelp) {
        displayNameHelp.style.display = showDisplayNameBinding ? '' : 'none';
        displayNameHelp.textContent = initialDisplayNameBinding
            ? '这是首次绑定昵称，保存后这枚谕令会固定显示该昵称，之后不可自行更改。'
            : isAdminDisplayNameEdit()
            ? '馆主可校正自己的身份昵称；其他身份昵称由入局谕令绑定。'
            : '保存后，这枚谕令在证言、判定、构筑愚戏和分数结算时都会显示这个昵称。';
    }
    if (displayNameInput && role) {
        displayNameInput.value = initialDisplayNameBinding ? '' : (inviteSession?.name || ROLE_LABELS[role]);
        displayNameInput.disabled = !canEditDisplayName();
        displayNameInput.title = initialDisplayNameBinding ? '首次绑定昵称，保存后不可自行更改' : (isAdminDisplayNameEdit() ? '馆主可更改身份昵称' : '昵称为身份绑定字段，只有馆主可以更改');
    }
    const displayNameButton = document.getElementById('displayNameButton');
    if (displayNameButton) {
        displayNameButton.disabled = !canEditDisplayName();
        displayNameButton.textContent = initialDisplayNameBinding ? '绑定昵称' : (canEditDisplayName() ? '保存昵称' : '昵称固定');
        displayNameButton.title = initialDisplayNameBinding ? '首次绑定昵称' : (isAdminDisplayNameEdit() ? '保存馆主昵称' : '昵称为身份绑定字段，只有馆主可以更改');
    }
    updateRoleCards(role);
    updateRoleInsightPanel(role);
    updateReviewFilterButton();
    updateFilterSummary();
    updateProfileNoticeBadge();
}

function updateRoleCards(role) {
    document.querySelectorAll('.role-card[data-role]').forEach(card => {
        card.classList.toggle('active', !!role && card.dataset.role === role);
    });
}

function updateRoleInsightPanel(role = getInviteRole()) {
    const panel = document.getElementById('roleInsightPanel');
    if (!panel) return;
    const key = normalizeRole(role || '') || 'guest';
    const copy = ROLE_UI_COPY[key] || ROLE_UI_COPY.guest;
    panel.innerHTML = `
        <div class="role-insight-head">
            <div class="role-insight-title">当前入局身份 · ${escapeHtml(copy.title)}</div>
            <div class="role-insight-note">${escapeHtml(copy.note)}</div>
        </div>
        <div class="role-insight-cards">
            ${copy.cards.map(([mark, title, note], index) => `
                <div class="role-insight-card ${index === 0 ? 'active' : ''}">
                    <strong>${escapeHtml(mark)} ${escapeHtml(title)}</strong>
                    <span>${escapeHtml(note)}</span>
                </div>`).join('')}
        </div>`;
}

function requireInvite(roles, message) {
    if (USE_LOCAL_FALLBACK || canUseRole(roles)) return true;
    openInviteModal(message || '请先验入局谕令。');
    return false;
}

function openInviteModal(message) {
    const overlay = document.getElementById('inviteModalOverlay');
    const hint = document.getElementById('inviteHint');
    if (hint) hint.textContent = message || '输入群内谕令后，才能参与神格判定、试炼证言、构筑愚戏或分数结算。';
    updateInviteUI();
    overlay.style.display='flex';
    document.body.style.overflow='hidden';
    setTimeout(() => document.getElementById('inviteCodeInput')?.focus(), 50);
}

function closeInviteModal(e) {
    if(e && e.target!==document.getElementById('inviteModalOverlay')) return;
    document.getElementById('inviteModalOverlay').style.display='none';
    document.body.style.overflow='';
}

async function submitInviteCode() {
    const input = document.getElementById('inviteCodeInput');
    const btn = document.getElementById('inviteSubmitButton');
    const code = input?.value.trim();
    if (!code) { showToast('请输入入局谕令'); return; }
    if (!acquireUiActionLock('submitInviteCode', '入局谕令正在验证，请勿重复点击')) return;
    btn.disabled = true;
    btn.textContent = '掷骰中...';
    try {
        const { error, role, name, permissions, sessionId, deviceKind } = USE_LOCAL_FALLBACK ? { error: null, role: 'author', name: '本地构筑者', permissions: [], sessionId: 'local', deviceKind: getClientDeviceKind() } : await invokeDungeonAction('verifyInvite', {}, code);
        if (error || !role) { showToast(`❌ ${getFriendlyActionError(error, '入局谕令无效')}`); return; }
        resetTalentViewState();
        saveInviteSession({ role, code, name: name || ROLE_LABELS[role], permissions: Array.isArray(permissions) ? permissions : [], sessionId: sessionId || '', deviceKind: deviceKind || getClientDeviceKind() });
        const profileRefresh = await refreshCurrentProfileFromCloud({ preserveSessionOnInvalid: true });
        if (profileRefresh.data?.displayName) {
            saveInviteSession({ role, code, name: profileRefresh.data.displayName, permissions: Array.isArray(permissions) ? permissions : [], sessionId: sessionId || '', deviceKind: deviceKind || getClientDeviceKind() });
        }
        input.value = '';
        closeInviteModal();
        showToast(`✅ ${(profileRefresh.data?.displayName || name || ROLE_LABELS[role])}已入局：${ROLE_LABELS[role]}`);
        if (currentDetailId) await openDetail(currentDetailId);
        if (document.getElementById('profilePage')?.style.display !== 'none') await renderProfilePage();
        if (document.getElementById('matchPage')?.style.display !== 'none') await renderMatchPage();
        await updateProfileNoticeBadge();
    } catch (error) {
        console.error('验证入局谕令失败', error);
        showToast(`❌ ${getFriendlyActionError(error, '入局谕令无效')}`);
    } finally {
        btn.disabled = false;
        btn.textContent = '掷骰入局';
        releaseUiActionLock('submitInviteCode');
    }
}

async function saveDisplayName() {
    if (!inviteSession?.code) { showToast('请先验入局谕令'); return; }
    if (!canEditDisplayName()) { showToast('昵称为身份绑定字段，只有馆主可以更改'); updateInviteUI(); return; }
    const input = document.getElementById('displayNameInput');
    const btn = document.getElementById('displayNameButton');
    const name = cleanDisplayNameInput(input?.value);
    if (!name) { showToast('请输入昵称'); return; }
    if (!acquireUiActionLock('saveDisplayName', '昵称正在保存，请勿重复点击')) return;
    btn.disabled = true;
    btn.textContent = '保存中...';
    try {
        const { error } = await updateDisplayName(name);
        if (error) { showToast(`❌ ${getFriendlyActionError(error, '昵称保存失败')}`); return; }
        showToast(`✅ 昵称已绑定为 ${name}`);
        updateInviteUI();
        if (currentDetailId) await openDetail(currentDetailId);
        await renderDungeonList();
        if (document.getElementById('profilePage')?.style.display !== 'none') await renderProfilePage();
        if (document.getElementById('matchPage')?.style.display !== 'none') await renderMatchPage();
    } catch (error) {
        console.error('保存昵称失败', error);
        showToast(`❌ ${getFriendlyActionError(error, '昵称保存失败')}`);
    } finally {
        btn.disabled = false;
        btn.textContent = '保存昵称';
        releaseUiActionLock('saveDisplayName');
    }
}

function clearInviteSession() {
    inviteSession = null;
    resetTalentViewState();
    localStorage.removeItem('fog_' + INVITE_STORAGE_KEY);
    try { sessionStorage.removeItem('fog_' + INVITE_STORAGE_KEY); } catch {}
    updateInviteUI();
    closeProfilePage(false);
    closeLeaderboardPage(false);
    closeScorePage(false);
    closeMatchPage(false);
    closeAdminPage(false);
    closeInviteModal();
    showToast('已退出邀请身份');
    if (currentDetailId) openDetail(currentDetailId);
}

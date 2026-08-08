let inviteSession = getLocalData(INVITE_STORAGE_KEY, null);
let currentSort = 'popular', searchQuery = '', selectedGod = 'all', selectedPath = 'all', selectedDifficulty = 'all', reviewFilter = 'all', searchTimeout = null, currentDetailId = null;
let archivePage = 1;
let archiveFilteredDungeons = [];
let archivePageMeta = null;
let archiveFocusId = null;
let visualEffectsEnabled = getLocalData(VISUAL_EFFECTS_STORAGE_KEY, true) !== false;
let archiveScrollY = 0;
let profileScrollY = 0;
let leaderboardScrollY = 0;
let matchScrollY = 0;
let scoreScrollY = 0;
let adminScrollY = 0;
let adminLookupState = { targetName: '', snapshot: null };
let honorActionStatus = null;
let honorOperationLogs = [];
let honorOperationLogsUnavailable = false;
let honorOperationLogsLoading = false;
let godBelievers = [];
let godBelieversLoading = false;
let godBelieverStatus = null;
let adminRecentOperations = [];
let adminOperationsUnavailable = false;
let editingDungeonId = '';
let profileChronicleTimer = null;
let profileChronicleIndex = 0;
let leaderboardMode = 'overall';
let leaderboardPath = 'all';
let leaderboardSearchQuery = '';
let leaderboardEntriesCache = null;
let leaderboardEntriesSource = 'local';
let leaderboardEntriesError = null;
let chronicleRotationTimer = null;
let chronicleRotationDungeons = [];
let chronicleRotationIndex = 0;
let atmosphereCycleIndex = ATMOSPHERE_CYCLE.findIndex(item => item.path === '虚无');
let currentAtmosphereEra = '虚无';
let currentAtmosphereGod = '欺诈';
let selectedMatchDungeonId = null;
let matchDungeonsCache = [];
let matchStateCache = null;
let matchStateError = null;
let scorePreviewState = null;
let scoreSettlementState = { settlements: [], error: null };
let scoreSettlementSearchTimer = null;
const scoreSettlementDetails = new Map();
const scoreSettlementExpanded = new Set();
let selectedTalentPool = '';
let lastTalentDrawResult = [];
let talentDrawInFlight = false;
let talentManageInFlight = false;
let currentTalentState = normalizeTalentState(null);
let currentTalentError = null;
let mobileProfileTab = 'base';
let mobileActiveDestination = 'dungeons';
let mobileTouchStart = null;
let leaderboardPages = {};
let replyTarget = null;
let testimonyTargetId = null;
let pendingRating = { dungeonId: null, value: 5 };
const uiActionLocks = new Set();

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
        const registry = role === 'god' ? '神明席' : role === 'admin' ? '神谕馆册' : role === 'reviewer' ? '审核席' : role === 'author' ? '构筑者名录' : '信徒名录';
        roleBadge.textContent = role ? `${registry} · ${inviteSession?.name || ROLE_LABELS[role]}` : '旁观者只读';
        roleBadge.classList.toggle('active', !!role);
        roleBadge.dataset.role = role || 'guest';
        roleBadge.classList.remove('has-notice');
        roleBadge.removeAttribute('data-notice');
        roleBadge.title = role ? '打开个人档案' : '验入局谕令后查看个人档案';
    }
    if (inviteButton) inviteButton.textContent = '🎲 同契召引';
    if (scoreButton) {
        scoreButton.style.display = (canSettleScores() || isGodRole()) ? '' : 'none';
        scoreButton.textContent = isGodRole() ? '✦ 称号敕令' : '⚖ 分数结算';
        scoreButton.title = isGodRole() ? '神明称号敕令台' : (canSettleScores() ? '审核员分数结算工作台' : '仅审核员可见');
    }
    if (mobileScoreButton) {
        const showMobileScore = canSettleScores() || isGodRole();
        mobileScoreButton.hidden = !showMobileScore;
        mobileScoreButton.textContent = isGodRole() ? '称号敕令' : '分数结算';
        mobileScoreButton.title = isGodRole() ? '神明称号敕令台' : '审核员分数结算工作台';
    }
    if (adminButton) {
        adminButton.style.display = isAdmin() ? '' : 'none';
        adminButton.title = '馆主玩家档案与天赋维护后台';
    }
    if (mobileAdminButton) {
        mobileAdminButton.hidden = !isAdmin();
        mobileAdminButton.title = '馆主玩家档案与天赋维护后台';
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

function getProfileKey() {
    return inviteSession?.code || `${getInviteRole() || 'guest'}:${inviteSession?.name || 'visitor'}`;
}

function getProfileDefaults() {
    return {
        displayName: '',
        role: '',
        faithGod: '',
        faithPath: '存在',
        originalFaithGod: '',
        originalFaithPath: '',
        profession: '',
        trickeryDisplayFaithGod: '',
        trickeryDisplayFaithPath: '',
        trickeryDisplayProfession: '',
        ascensionScore: DEFAULT_ASCENSION_SCORE,
        audienceScore: DEFAULT_AUDIENCE_SCORE,
        scoresLockedAt: '',
        items: '',
        talents: '',
        showTitles: true,
        activeTitle: null,
        activeTitles: [],
        activeCurse: null,
        activeCurses: []
    };
}

function getStoredProfiles() {
    return getLocalData(PROFILE_STORAGE_KEY, {});
}

function getCurrentProfile() {
    const allProfiles = getStoredProfiles();
    const stored = { ...getProfileDefaults(), ...(allProfiles[getProfileKey()] || {}) };
    stored.displayName = cleanDisplayNameInput(stored.displayName || inviteSession?.name || '');
    stored.role = normalizeRole(stored.role || inviteSession?.role || '') || '';
    stored.faithGod = cleanGodName(stored.faithGod || '');
    stored.faithPath = getGodInfo(stored.faithGod).known ? getGodInfo(stored.faithGod).path : (stored.faithPath || '存在');
    stored.originalFaithGod = cleanGodName(stored.originalFaithGod || stored.original_faith_god || '');
    stored.originalFaithPath = stored.originalFaithGod ? getGodInfo(stored.originalFaithGod).path : (stored.originalFaithPath || stored.original_faith_path || '');
    stored.profession = normalizeProfession(stored.profession || '');
    stored.trickeryDisplayFaithGod = cleanGodName(stored.trickeryDisplayFaithGod || '');
    stored.trickeryDisplayFaithPath = stored.trickeryDisplayFaithGod ? getGodInfo(stored.trickeryDisplayFaithGod).path : (stored.trickeryDisplayFaithPath || '');
    stored.trickeryDisplayProfession = normalizeProfession(stored.trickeryDisplayProfession || '');
    stored.ascensionScore = normalizeProfileScore(stored.ascensionScore);
    stored.audienceScore = normalizeProfileScore(stored.audienceScore);
    stored.scoresLockedAt = stored.scoresLockedAt || '';
    stored.showTitles = stored.showTitles !== false;
    stored.activeTitle = normalizeProfileTitle(stored.activeTitle);
    stored.activeTitles = normalizeProfileTitleList(stored.activeTitles, stored.activeTitle);
    stored.activeCurse = normalizeProfileCurse(stored.activeCurse);
    stored.activeCurses = normalizeProfileCurseList(stored.activeCurses, stored.activeCurse);
    return stored;
}

function saveCurrentProfile(profile) {
    const allProfiles = getStoredProfiles();
    allProfiles[getProfileKey()] = {
        ...getProfileDefaults(),
        ...profile,
        updatedAt: new Date().toISOString()
    };
    setLocalData(PROFILE_STORAGE_KEY, allProfiles);
}

function getProfileNoticeSeenMap() {
    return getLocalData(PROFILE_NOTICE_SEEN_KEY, {});
}

function getProfileNoticeSeenTime() {
    return getProfileNoticeSeenMap()[getProfileKey()] || '';
}

function setProfileNoticeSeenTime(value) {
    const seen = getProfileNoticeSeenMap();
    seen[getProfileKey()] = value || new Date().toISOString();
    setLocalData(PROFILE_NOTICE_SEEN_KEY, seen);
}





function isProfileBindingMismatched(profile) {
    const god = getProfileFaithGod(profile);
    const profession = getProfessionInfo(profile?.profession);
    return !!god && profession.known && profession.god !== god;
}


function getProfileFaithGod(profile) {
    return cleanGodName(profile?.faithGod || '');
}

function getProfileVisualFaithGod(profile) {
    const displayGod = cleanGodName(profile?.trickeryDisplayFaithGod || '');
    return hasTrickeryFaithPrivilege(profile) && displayGod ? displayGod : getProfileFaithGod(profile);
}

function getProfileVisualFaithPath(profile) {
    const visualGod = getProfileVisualFaithGod(profile);
    return getGodInfo(visualGod).path || profile?.trickeryDisplayFaithPath || profile?.faithPath || '存在';
}

function getProfileVisualProfession(profile) {
    const displayProfession = normalizeProfession(profile?.trickeryDisplayProfession || '');
    return hasTrickeryFaithPrivilege(profile) && displayProfession ? displayProfession : normalizeProfession(profile?.profession || '');
}

function isFaithLocked(profile) {
    if (canOverrideProfileLocks()) return false;
    const god = getProfileFaithGod(profile);
    return !!god && !hasTrickeryFaithPrivilege(profile) && !isProfileBindingMismatched(profile);
}

function isTrickeryProfile(profile) {
    return cleanGodName(profile?.originalFaithGod || profile?.original_faith_god || '') === '欺诈' || getProfileFaithGod(profile) === '欺诈';
}

function hasTrickeryFaithPrivilege(profile) {
    return isTrickeryProfile(profile) || getProfessionInfo(profile?.profession).god === '欺诈';
}

function isProfessionLocked(profile) {
    if (canOverrideProfileLocks()) return false;
    return getProfessionInfo(profile?.profession).known && !hasTrickeryFaithPrivilege(profile) && !isProfileBindingMismatched(profile);
}

function areProfileScoresLocked(profile) {
    return !canEditProfileScores();
}

function getProfileDisplayFaith(profile) {
    const god = getProfileVisualFaithGod(profile);
    if (!god) return {
        god: '',
        label: '未立信仰',
        path: getProfileVisualFaithPath(profile),
        className: getPathClassByPath(getProfileVisualFaithPath(profile))
    };
    const info = getGodInfo(god);
    return {
        god: info.god,
        label: `${info.god}之神`,
        path: info.path || getProfileVisualFaithPath(profile),
        className: info.className || getPathClassByPath(getProfileVisualFaithPath(profile))
    };
}

function renderProfileGodOptions(selected) {
    const cleanSelected = cleanGodName(selected || '');
    const emptyOption = `<option value="" ${cleanSelected ? '' : 'selected'}>请选择信仰神明</option>`;
    return emptyOption + GOD_GROUPS.map(group => `<optgroup label="${escapeHtml(group.path)}命途">${group.gods.map(god => `<option value="${escapeHtml(god)}" ${god === cleanSelected ? 'selected' : ''}>${escapeHtml(getGodIcon(god))} ${escapeHtml(god)}之神 · ${escapeHtml(group.path)}命途</option>`).join('')}</optgroup>`).join('');
}

function renderProfileProfessionOptions(selected, faithGod = '') {
    const cleanSelected = normalizeProfession(selected || '');
    const selectedGod = cleanGodName(faithGod);
    const groups = selectedGod ? PROFESSION_GROUPS.filter(group => group.god === selectedGod) : PROFESSION_GROUPS;
    const hasSelectedInGroups = groups.some(group => Object.values(group.careers).includes(cleanSelected));
    const emptyOption = `<option value="" ${hasSelectedInGroups ? '' : 'selected'}>请选择游戏职业</option>`;
    return emptyOption + groups.map(group => {
        const groupLabel = `${group.path}命途 · ${group.god}之神`;
        const options = Object.entries(group.careers)
            .map(([className, profession]) => `<option value="${escapeHtml(profession)}" ${profession === cleanSelected && hasSelectedInGroups ? 'selected' : ''}>${escapeHtml(className)} · ${escapeHtml(profession)}</option>`)
            .join('');
        return `<optgroup label="${escapeHtml(groupLabel)}">${options}</optgroup>`;
    }).join('');
}

function getClassHealthRule(className) {
    const clean = String(className || '').trim();
    const rule = CLASS_HEALTH_RULES[clean];
    return rule ? { className: clean, ...rule, known: true } : { className: clean, baseHp: 0, known: false };
}

function getFaithHealthBonus(god, className) {
    return cleanGodName(god) === '繁荣' ? Number(PROSPERITY_HEALTH_BONUS[className] || 0) : 0;
}

function getProfileHealthSummary(profile) {
    const profession = getProfessionInfo(profile?.profession);
    const rule = getClassHealthRule(profession.className);
    const ascensionScore = normalizeProfileScore(profile?.ascensionScore, DEFAULT_ASCENSION_SCORE);
    const tableHealth = rule.known ? getHealthTableValue(rule.className, ascensionScore) : { band: CLASS_HEALTH_SCORE_MIN, hp: 0, isClampedHigh: false };
    const growthSteps = rule.known ? Math.max(0, Math.floor((tableHealth.band - DEFAULT_ASCENSION_SCORE) / 100)) : 0;
    const growthHp = rule.known ? Math.max(0, tableHealth.hp - rule.baseHp) : 0;
    const faithGod = getProfileFaithGod(profile);
    const faithBonus = rule.known ? getFaithHealthBonus(faithGod, rule.className) : 0;
    const resistanceSkin = getScoreResistanceSkin(ascensionScore);
    return {
        profession,
        rule,
        ascensionScore,
        healthBand: tableHealth.band,
        tableHp: tableHealth.hp,
        isHealthClampedHigh: tableHealth.isClampedHigh,
        growthSteps,
        growthHp,
        faithGod,
        faithBonus,
        resistanceSkin,
        maxHp: rule.known ? tableHealth.hp + faithBonus : 0,
        trait: FAITH_TRAITS[faithGod] || '',
        classTrait: CLASS_TRAITS[rule.className] || ''
    };
}

function renderProfileBattlePanel(profile) {
    const summary = getProfileHealthSummary(profile);
    const faithGod = summary.faithGod || '命运';
    const hasProfession = summary.rule.known;
    const hasFaith = !!summary.trait;
    return `
        <section id="profileBattlePanel" class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${getGodSkinStyle(faithGod)}">
            <div class="profile-panel-title">
                <span>战斗面板</span>
                <small>由职业、登神之路与信仰特性实时推导</small>
            </div>
            ${hasProfession ? `
                <div class="profile-battle-grid">
                    <div class="profile-battle-hp">
                        <span>血量上限</span>
                        <strong>${summary.maxHp}</strong>
                        <small>${escapeHtml(summary.profession.className)} · ${escapeHtml(summary.profession.name)}，登神 ${summary.ascensionScore} 分</small>
                    </div>
                    <div class="profile-battle-breakdown">
                        <div class="profile-battle-line"><span>职业基础血量</span><strong>${summary.rule.baseHp}</strong></div>
                        <div class="profile-battle-line"><span>${summary.healthBand} 档血量</span><strong>${summary.tableHp}</strong></div>
                        <div class="profile-battle-line"><span>档位成长</span><strong>+${summary.growthHp}</strong></div>
                        <div class="profile-battle-line"><span>信仰生命加成</span><strong>${summary.faithBonus ? `+${summary.faithBonus}` : '0'}</strong></div>
                        <div class="profile-battle-line"><span>血量表范围</span><strong>${escapeHtml(CLASS_HEALTH_SCORE_LABEL)} 分</strong></div>
                    </div>
                </div>` : `
                <div class="profile-empty">请选择职业后查看血量成长。</div>`}
            ${hasProfession && summary.resistanceSkin ? `
            <div class="profile-battle-trait">
                <strong>${escapeHtml(summary.resistanceSkin.name)} · 分数档被动</strong>
                ${escapeHtml(summary.resistanceSkin.description)}<br>${escapeHtml(SCORE_RESISTANCE_NOTE)}
            </div>` : ''}
            <div class="profile-battle-trait">
                <strong>${hasFaith ? `${escapeHtml(faithGod)}之神 · 信仰特性` : '信仰特性'}</strong>
                ${hasFaith ? escapeHtml(summary.trait) : '请选择信仰后查看信仰特性。'}
            </div>
            <div class="profile-battle-trait">
                <strong>${hasProfession ? `${escapeHtml(summary.profession.className)} · 职业特性` : '职业特性'}</strong>
                ${hasProfession ? escapeHtml(summary.classTrait || '该职业暂未记录职业特性。') : '请选择职业后查看职业特性。'}
            </div>
        </section>`;
}

function getProfileBattlePreviewProfile() {
    const current = getCurrentProfile();
    const faithSelect = document.getElementById('profileFaithGod');
    const professionSelect = document.getElementById('profileProfession');
    const scoreInput = document.getElementById('profileAscensionScore');
    const selectedFaithGod = faithSelect ? cleanGodName(faithSelect.value) : getProfileFaithGod(current);
    const selectedProfession = professionSelect ? normalizeProfession(professionSelect.value) : (current.profession || '');
    const ascensionScore = scoreInput ? normalizeProfileScore(scoreInput.value, current.ascensionScore ?? DEFAULT_ASCENSION_SCORE) : normalizeProfileScore(current.ascensionScore, DEFAULT_ASCENSION_SCORE);
    const isTrickery = hasTrickeryFaithPrivilege(current);
    return {
        ...current,
        faithGod: isTrickery ? getProfileFaithGod(current) : selectedFaithGod,
        faithPath: isTrickery ? current.faithPath : (getGodInfo(selectedFaithGod).path || current.faithPath || ''),
        profession: isTrickery ? current.profession : selectedProfession,
        ascensionScore
    };
}

function updateProfileBattlePanel() {
    const panel = document.getElementById('profileBattlePanel');
    if (!panel) return;
    panel.outerHTML = renderProfileBattlePanel(getProfileBattlePreviewProfile());
}

function renderProfileChips(value, emptyText, god = '') {
    const items = splitProfileLines(value);
    if (!items.length) return god ? renderRitualEmpty(emptyText, god, '个人收纳暂空') : `<div class="profile-empty">${escapeHtml(emptyText)}</div>`;
    return `<div class="profile-chip-row">${items.map(item => `<span class="metric-pill">${escapeHtml(item)}</span>`).join('')}</div>`;
}

function normalizeProfileTitle(value) {
    if (!value) return null;
    const titleText = String(value.title_text || value.titleText || '').trim().slice(0, 32);
    if (!titleText) return null;
    return {
        titleText,
        titleGod: cleanGodName(value.title_god || value.titleGod || ''),
        titleNote: String(value.title_note || value.titleNote || '').trim().slice(0, 120),
        grantedByType: String(value.granted_by_type || value.grantedByType || 'admin').trim(),
        grantedByName: String(value.granted_by_name || value.grantedByName || '').trim().slice(0, 40),
        grantedAt: value.granted_at || value.grantedAt || ''
    };
}

function normalizeProfileTitleList(value, fallback = null) {
    const source = Array.isArray(value) ? value : (value ? [value] : []);
    const titles = source.map(normalizeProfileTitle).filter(Boolean);
    const fallbackTitle = normalizeProfileTitle(fallback);
    if (!titles.length && fallbackTitle) return [fallbackTitle];
    return titles;
}

function normalizeProfileCurse(value) {
    if (!value) return null;
    const curseText = String(value.curse_text || value.curseText || '').trim().slice(0, 32);
    if (!curseText) return null;
    return {
        curseText,
        curseGod: cleanGodName(value.curse_god || value.curseGod || ''),
        curseNote: String(value.curse_note || value.curseNote || '').trim().slice(0, 120),
        curseType: normalizeProfileCurseType(value.curse_type || value.curseType),
        grantedByType: String(value.granted_by_type || value.grantedByType || 'god').trim(),
        grantedByName: String(value.granted_by_name || value.grantedByName || '').trim().slice(0, 40),
        grantedAt: value.granted_at || value.grantedAt || ''
    };
}

function normalizeProfileCurseType(value) {
    return String(value || '').trim() === 'ordinary' ? 'ordinary' : 'betrayal';
}

function getProfileCurseTypeLabel(value) {
    return normalizeProfileCurseType(value) === 'ordinary' ? '普通诅咒' : '背弃诅咒';
}

function getProfileCurseBadgeLabel(value) {
    return normalizeProfileCurseType(value) === 'ordinary' ? '普通' : '背弃';
}

function normalizeProfileCurseList(value, fallback = null) {
    const source = Array.isArray(value) ? value : (value ? [value] : []);
    const curses = source.map(normalizeProfileCurse).filter(Boolean);
    const fallbackCurse = normalizeProfileCurse(fallback);
    if (!curses.length && fallbackCurse) return [fallbackCurse];
    return curses;
}

function renderProfileTitleBadge(title, options = {}) {
    const normalized = normalizeProfileTitle(title);
    if (!normalized) return '';
    const god = normalized.titleGod || options.fallbackGod || '命运';
    const issuer = normalized.grantedByType === 'god'
        ? `${god}之神降下`
        : (normalized.grantedByName ? `${normalized.grantedByName}降下` : '馆主降下');
    const small = options.compact ? '' : `<small>${escapeHtml(issuer)}</small>`;
    const extraClass = options.compact ? ' leaderboard-title-badge' : '';
    return `<span class="divine-title-badge${extraClass}" style="${getGodSkinStyle(god)}" title="${escapeHtml(`${issuer}｜${normalized.titleText}${normalized.titleNote ? `｜${normalized.titleNote}` : ''}`)}">神诞 · ${escapeHtml(normalized.titleText)}${small}</span>`;
}

function renderProfileNameWithTitle(displayName, title, options = {}) {
    const titles = options.showTitles === false ? [] : normalizeProfileTitleList(options.titles, title);
    return `
        <div class="profile-name-row">
            <h1 class="profile-name">${escapeHtml(displayName)}</h1>
            ${titles.slice(0, 3).map(item => renderProfileTitleBadge(item, { fallbackGod: options.fallbackGod })).join('')}
        </div>`;
}

function renderProfileCurseStatus(curse, fallbackGod = '命运', curses = null) {
    const normalizedCurses = normalizeProfileCurseList(curses, curse);
    if (!normalizedCurses.length) {
        return `
            <div class="profile-title-status profile-curse-status" style="${getGodSkinStyle(fallbackGod)}">
                <div class="profile-title-status-head">
                    <strong>当前诅咒</strong>
                    <span class="metric-pill">暂无诅咒</span>
                </div>
                <div class="profile-title-status-note">未被神明下放诅咒。</div>
            </div>`;
    }
    const primary = normalizedCurses[0];
    const god = primary.curseGod || fallbackGod;
    const curseBadges = normalizedCurses.slice(0, 5).map(item => {
        const itemGod = item.curseGod || fallbackGod;
        const typeLabel = getProfileCurseBadgeLabel(item.curseType);
        return `<span class="divine-curse-badge" style="${getGodSkinStyle(itemGod)}" title="${escapeHtml(`${itemGod}｜${getProfileCurseTypeLabel(item.curseType)}｜${item.curseText}${item.curseNote ? `｜${item.curseNote}` : ''}`)}">${escapeHtml(typeLabel)} · ${escapeHtml(item.curseText)}</span>`;
    }).join('');
    const curseEffects = normalizedCurses.slice(0, 5).map(item => {
        const itemGod = item.curseGod || fallbackGod;
        const typeLabel = getProfileCurseTypeLabel(item.curseType);
        return `
            <div class="profile-curse-effect-row" style="${getGodSkinStyle(itemGod)}">
                <div class="profile-curse-effect-head">
                    <strong>${escapeHtml(typeLabel)}｜${escapeHtml(item.curseText)}</strong>
                    <small>${escapeHtml(itemGod)}</small>
                </div>
                <div class="profile-curse-effect-note">${escapeHtml(item.curseNote || '暂无记录具体效果。')}</div>
            </div>`;
    }).join('');
    const issuer = primary.grantedByType === 'god'
        ? `${god}之神下放`
        : (primary.grantedByName ? `${primary.grantedByName}下放` : '馆主下放');
    const hasBetrayalCurse = normalizedCurses.some(item => normalizeProfileCurseType(item.curseType) === 'betrayal');
    const curseRuleNote = hasBetrayalCurse
        ? '背弃诅咒会自动赋予称号「背弃者」；普通诅咒不会自动赋予称号。'
        : '普通诅咒不会自动赋予称号；诅咒不会受称号佩戴开关影响。';
    return `
        <div class="profile-title-status profile-curse-status" style="${getGodSkinStyle(god)}">
            <div class="profile-title-status-head">
                <strong>当前诅咒</strong>
                <div class="comment-honor-stack">${curseBadges}</div>
            </div>
            <div class="profile-title-status-note">${escapeHtml(issuer)}｜${escapeHtml(curseRuleNote)}</div>
            <div class="profile-curse-effect-list">${curseEffects}</div>
        </div>`;
}

function renderProfileTitleStatus(title, curse = null, fallbackGod = '命运', titles = null, curses = null, showTitles = true) {
    const normalizedTitles = normalizeProfileTitleList(titles, title);
    if (!normalizedTitles.length) {
        return `
            <div class="profile-title-status" style="${getGodSkinStyle(fallbackGod)}">
                <div class="profile-title-status-head">
                    <strong>当前称号</strong>
                    <span class="metric-pill">暂无称号</span>
                </div>
                <div class="profile-title-status-note">尚未有馆主或神明为你降下称号。获得称号后，会绑定昵称显示在个人面板、公开档案和榜单里。</div>
            </div>
            ${renderProfileCurseStatus(curse, fallbackGod, curses)}`;
    }
    const primary = normalizedTitles[0];
    const issuer = primary.grantedByType === 'god'
        ? `${primary.titleGod || fallbackGod}之神降下`
        : (primary.grantedByName ? `${primary.grantedByName}降下` : '馆主降下');
    return `
        <div class="profile-title-status" style="${getGodSkinStyle(primary.titleGod || fallbackGod)}">
            <div class="profile-title-status-head">
                <strong>当前称号</strong>
                ${showTitles === false ? '<span class="metric-pill">未佩戴</span>' : `<div class="comment-honor-stack">${normalizedTitles.slice(0, 5).map(item => renderProfileTitleBadge(item, { fallbackGod })).join('')}</div>`}
            </div>
            <div class="profile-title-status-note">${showTitles === false ? '已获得称号，但当前选择不佩戴；诅咒仍会始终显示。' : `${escapeHtml(issuer)}${primary.titleNote ? `｜${escapeHtml(primary.titleNote)}` : ''}`}</div>
        </div>
        ${renderProfileCurseStatus(curse, primary.titleGod || fallbackGod, curses)}`;
}









async function syncProfileToCloud(profile) {
    if (USE_LOCAL_FALLBACK || !inviteSession?.code) return { data: null, error: null };
    const { data, error } = await invokeDungeonAction('saveProfile', {
        faithGod: profile.faithGod,
        faithPath: profile.faithPath,
        profession: profile.profession,
        ascensionScore: profile.ascensionScore,
        audienceScore: profile.audienceScore,
        showTitles: profile.showTitles !== false,
        items: profile.items
    });
    if (error) return { data: null, error };
    const cloudProfile = mapCloudProfileToLocal(data);
    if (cloudProfile) saveCurrentProfile(cloudProfile);
    return { data: cloudProfile, error: null };
}

async function refreshCurrentProfileFromCloud() {
    if (USE_LOCAL_FALLBACK || !inviteSession?.code) return { data: null, error: null };
    const { data, error, name, role } = await invokeDungeonAction('getMyProfile', {});
    if (error) return { data: null, error };
    if (name || role) {
        saveInviteSession({
            ...inviteSession,
            name: name || inviteSession.name,
            role: normalizeRole(role || inviteSession.role) || inviteSession.role
        });
    }
    const cloudProfile = mapCloudProfileToLocal(data);
    if (!cloudProfile) return { data: null, error: null };
    saveCurrentProfile({
        ...getCurrentProfile(),
        ...cloudProfile
    });
    return { data: cloudProfile, error: null };
}

async function syncTrickeryFaithToCloud(faithGod, profession) {
    if (USE_LOCAL_FALLBACK || !inviteSession?.code) return { data: null, error: null };
    const { data, error } = await invokeDungeonAction('updateTrickeryFaith', { faithGod, profession });
    if (error) return { data: null, error };
    // The dedicated action returns identity metadata plus its profile in `data`.
    const profilePayload = data?.data && typeof data.data === 'object' ? data.data : data;
    const cloudProfile = mapCloudProfileToLocal(profilePayload);
    if (cloudProfile) saveCurrentProfile({ ...getCurrentProfile(), ...cloudProfile });
    return { data: cloudProfile, error: null };
}

let profileTitleVisibilityInFlight = false;
async function setProfileTitleVisibility(showTitles) {
    if (profileTitleVisibilityInFlight) return;
    const nextValue = showTitles === true;
    const toggle = document.getElementById('profileTitleVisibilityToggle');
    const currentProfile = getCurrentProfile();
    if (currentProfile.showTitles === nextValue) return;
    profileTitleVisibilityInFlight = true;
    if (toggle) toggle.disabled = true;
    try {
        if (USE_LOCAL_FALLBACK || !inviteSession?.code) {
            saveCurrentProfile({ ...currentProfile, showTitles: nextValue });
        } else {
            const { data, error } = await invokeDungeonAction('setProfileTitleVisibility', { showTitles: nextValue });
            if (error) throw error;
            saveCurrentProfile({ ...currentProfile, showTitles: data?.show_titles !== false, updatedAt: data?.updated_at || currentProfile.updatedAt });
        }
        showToast(nextValue ? '称号已佩戴' : '称号已收起，诅咒仍会显示');
        await renderProfilePage();
        if (document.getElementById('leaderboardPage')?.style.display !== 'none') await renderLeaderboardPage();
    } catch (error) {
        showToast(`称号状态保存失败：${getFriendlyActionError(error, '请稍后重试')}`);
        if (toggle) toggle.checked = currentProfile.showTitles !== false;
    } finally {
        profileTitleVisibilityInFlight = false;
        if (toggle) toggle.disabled = false;
    }
}


function normalizeTalentState(rawState) {
    const state = rawState || {};
    return {
        profile: state.profile || null,
        inventorySlotLimit: Number(state.inventorySlotLimit || 10),
        equippedSlotLimit: Number(state.equippedSlotLimit || 3),
        maxEquippedSlotLimit: Number(state.maxEquippedSlotLimit || state.equippedSlotLimit || 3),
        talentSlotRule: state.talentSlotRule || null,
        talentSlotScoreRules: Array.isArray(state.talentSlotScoreRules) ? state.talentSlotScoreRules : [],
        talentSlotKinds: Array.isArray(state.talentSlotKinds) ? state.talentSlotKinds : ['faith', 'profession', 'any', 'any'],
        faithTalentPoolKey: state.faithTalentPoolKey || '',
        professionTalentPoolKey: state.professionTalentPoolKey || '',
        starterTalentDrawGrant: Number(state.starterTalentDrawGrant || 10),
        bTalentDrawRate: Number(state.bTalentDrawRate || 0.2),
        advancedBTalentDrawRate: Number(state.advancedBTalentDrawRate || 0.25),
        aTalentDrawRate: Number(state.aTalentDrawRate || 0.02),
        sTalentDrawRate: Number(state.sTalentDrawRate || 0.001),
        bTalentGuaranteeDraws: Number(state.bTalentGuaranteeDraws || 10),
        sTalentGuaranteeDraws: Number(state.sTalentGuaranteeDraws || 60),
        cTalentFragmentGain: Number(state.cTalentFragmentGain || 5),
        bTalentFragmentGain: Number(state.bTalentFragmentGain || 10),
        targetTalentExchangeCost: Number(state.targetTalentExchangeCost || 180),
        aTalentExchangeCost: Number(state.aTalentExchangeCost || 260),
        totalDrawsEarned: Number(state.totalDrawsEarned || 0),
        spentDraws: Number(state.spentDraws || 0),
        availableDraws: Number(state.availableDraws || 0),
        baseBasicDrawsEarned: Number(state.baseBasicDrawsEarned || 0),
        eventBasicDraws: Number(state.eventBasicDraws || 0),
        eventAdvancedDraws: Number(state.eventAdvancedDraws || 0),
        basicDrawsEarned: Number(state.basicDrawsEarned || 0),
        basicSpentDraws: Number(state.basicSpentDraws || 0),
        basicAvailableDraws: Number(state.basicAvailableDraws || 0),
        advancedDrawsEarned: Number(state.advancedDrawsEarned || 0),
        advancedSpentDraws: Number(state.advancedSpentDraws || 0),
        advancedAvailableDraws: Number(state.advancedAvailableDraws || 0),
        advancedTalentDrawScore: Number(state.advancedTalentDrawScore || 1500),
        fragmentTotal: Number(state.fragmentTotal || 0),
        pools: Array.isArray(state.pools) ? state.pools : [],
        allowedPoolKeys: Array.isArray(state.allowedPoolKeys) ? state.allowedPoolKeys : [],
        poolItems: Array.isArray(state.poolItems) ? state.poolItems : [],
        counters: Array.isArray(state.counters) ? state.counters : [],
        ownedTalents: Array.isArray(state.ownedTalents) ? state.ownedTalents : [],
        overflowChoices: Array.isArray(state.overflowChoices) ? state.overflowChoices : [],
        settledOverflowChoices: Array.isArray(state.settledOverflowChoices) ? state.settledOverflowChoices : [],
        drawLogs: Array.isArray(state.drawLogs) ? state.drawLogs : [],
        exchangeLogs: Array.isArray(state.exchangeLogs) ? state.exchangeLogs : []
    };
}

function applyTalentStateProfile(state) {
    const profile = mapCloudProfileToLocal(state?.profile);
    if (profile) saveCurrentProfile(profile);
}

async function fetchTalentState() {
    if (USE_LOCAL_FALLBACK || !inviteSession?.code) {
        return { state: normalizeTalentState(null), error: { message: '天赋池需要云端 Supabase 支持，本地模式仅显示个人档案。' } };
    }
    const inviteSnapshot = getInviteSnapshot();
    const { data, error } = await invokeDungeonAction('getTalentState', {});
    if (!isInviteSnapshotCurrent(inviteSnapshot)) {
        return { state: currentTalentState, error: { message: '身份已切换，已忽略旧账号天赋回包。' }, stale: true };
    }
    if (error) return { state: normalizeTalentState(null), error };
    const state = normalizeTalentState(data);
    applyTalentStateProfile(state);
    return { state, error: null };
}

function setCurrentTalentState(state, error = null) {
    currentTalentState = normalizeTalentState(state);
    currentTalentError = error;
}

function replaceTalentPoolPanel(profile = getCurrentProfile()) {
    const panel = document.getElementById('talentPoolPanel');
    if (panel) panel.outerHTML = renderTalentPoolPanel(currentTalentState, currentTalentError, profile);
    const equipPanel = document.getElementById('profileTalentEquipPanel');
    if (equipPanel) equipPanel.innerHTML = renderEquippedTalentSlots(currentTalentState, getProfileFaithGod(profile) || '命运');
    if (isMobileViewport() && document.getElementById('profilePage')?.style.display !== 'none') {
        setMobileProfileTab(mobileProfileTab, { scroll: false });
    }
}

function getSelectedTalentPool(profile, state) {
    const poolKeys = state.pools.map(pool => pool.poolKey).filter(Boolean);
    if (selectedTalentPool && poolKeys.includes(selectedTalentPool)) return selectedTalentPool;
    const preferred = state.faithTalentPoolKey || `Pool${getProfileFaithGod(profile) || '欺诈'}`;
    selectedTalentPool = poolKeys.includes(preferred) ? preferred : (poolKeys[0] || preferred);
    return selectedTalentPool;
}

function getTalentPoolCounter(state, poolKey) {
    return Number((state.counters || []).find(item => item.pool_key === poolKey)?.continue_draw || 0);
}

function renderTalentPoolOptions(state, selected) {
    const pools = state.pools || [];
    if (!pools.length) return '<option value="">暂无天赋池</option>';
    return pools.map(pool => {
        const disabled = Number(pool.total || 0) <= 0 ? 'disabled' : '';
        const label = `${formatTalentPoolLabel(pool.poolKey)}池 · B${Number(pool.bCount || 0)} / C${Number(pool.cCount || 0)}`;
        return `<option value="${escapeHtml(pool.poolKey)}" ${pool.poolKey === selected ? 'selected' : ''} ${disabled}>${escapeHtml(label)}</option>`;
    }).join('');
}

function renderTalentCards(talents, emptyText = '还没有抽到天赋。') {
    if (!talents?.length) return `<div class="profile-empty">${escapeHtml(emptyText)}</div>`;
    return `<div class="talent-result-grid">${talents.map(talent => {
        const name = talent.talentName || talent.talent_name || '未知天赋';
        const rank = talent.rank || 'C';
        const effect = talent.effect || talent.talent_effect || '';
        const actionCost = Number(talent.actionCost ?? talent.action_cost ?? 0);
        const pool = formatTalentPoolLabel(talent.poolKey || talent.pool_key);
        const repeat = talent.isRepeat || talent.is_repeat;
        const guarantee = talent.isGuarantee || talent.is_guarantee;
        const overflow = talent.isOverflow || talent.is_overflow;
        const fragment = Number(talent.fragmentGain ?? talent.fragment_gain ?? 0);
        const storageSlot = Number(talent.storageSlot ?? talent.storage_slot ?? 0);
        const source = talent.acquired_from === 'exchange' ? '碎片兑换' : (talent.acquired_from === 'draw' ? '天赋池抽取' : pool);
        const place = overflow ? ' · 仓库已满，待取舍' : (storageSlot ? ` · 入库${storageSlot}号位` : '');
        return `
            <div class="talent-card rank-${escapeHtml(rank)} ${repeat ? 'repeat' : ''} ${overflow ? 'pending' : ''}">
                <strong>${escapeHtml(name)}</strong>
                <small>${escapeHtml(rank)}级 · ${escapeHtml(pool || source)} · 行动点 ${actionCost}${guarantee ? ' · 保底' : ''}${repeat ? ` · 重复转化 +${fragment} 碎片` : ''}${escapeHtml(place)}</small>
                ${effect ? `<span class="talent-effect-text">${escapeHtml(effect)}</span>` : ''}
            </div>`;
    }).join('')}</div>`;
}

function renderTalentLogs(state, god = '命运') {
    const logs = state.drawLogs || [];
    if (!logs.length) return renderRitualEmpty(getGodEmptyText(god, 'drawLogs'), god, '抽取记录暂空');
    return `<div class="talent-log-list">${logs.slice(0, 12).map(log => {
        const label = `${formatTalentPoolLabel(log.pool_key)}池 · ${log.draw_type === 'ten' ? '十连谕' : '单枚牵引'}`;
        const guarantee = log.is_guarantee ? ' · 保底' : '';
        const repeat = log.is_repeat ? ` · 重复 +${Number(log.fragment_gain || 0)}碎片` : '';
        return `<div class="talent-log-item"><span><strong>${escapeHtml(log.talent_name)}</strong> ${escapeHtml(log.rank)}级${escapeHtml(guarantee)}${escapeHtml(repeat)}</span><span>${escapeHtml(label)}</span></div>`;
    }).join('')}</div>`;
}

function renderTalentExchangeOptions(state, poolKey) {
    const ownedKeys = new Set((state.ownedTalents || []).map(t => `${t.pool_key}:${t.talent_id}`));
    const advancedDraw = Number(state.profile?.ascension_score || 0) >= Number(state.advancedTalentDrawScore || 1500);
    const allowedRanks = advancedDraw ? ['A', 'B'] : ['B'];
    const options = (state.poolItems || [])
        .filter(item => item.pool_key === poolKey && allowedRanks.includes(item.rank))
        .map(item => {
            const owned = ownedKeys.has(`${item.pool_key}:${item.talent_id}`);
            const cost = item.rank === 'A' ? Number(state.aTalentExchangeCost || 260) : Number(state.targetTalentExchangeCost || 80);
            const actionCost = Number(item.action_cost ?? item.actionCost ?? 0);
            return `<option value="${Number(item.talent_id)}" data-rank="${escapeHtml(item.rank)}" data-cost="${cost}" data-name="${escapeHtml(item.talent_name)}" ${owned ? 'disabled' : ''}>${escapeHtml(item.rank)} · ${escapeHtml(item.talent_name)} · 行动点 ${actionCost}（${cost}碎片）${owned ? '（已拥有）' : ''}</option>`;
        });
    return options.length ? options.join('') : '<option value="">该池暂无可兑换 B/A 天赋</option>';
}

function renderTalentOptionLabel(talent) {
    if (!talent) return '空';
    return `${talent.talent_name}（${talent.rank} · ${formatTalentPoolLabel(talent.pool_key)}池）`;
}

function getTalentEffectText(state, talent) {
    if (!talent) return '';
    return String(
        talent.effect ||
        (state.poolItems || []).find(item =>
            item.pool_key === talent.pool_key && Number(item.talent_id) === Number(talent.talent_id)
        )?.effect ||
        ''
    ).trim();
}

function getTalentActionCost(state, talent) {
    if (!talent) return 0;
    const direct = talent.actionCost ?? talent.action_cost;
    if (direct !== undefined && direct !== null && direct !== '') return Number(direct) || 0;
    const poolItem = (state.poolItems || []).find(item =>
        item.pool_key === talent.pool_key && Number(item.talent_id) === Number(talent.talent_id)
    );
    return Number(poolItem?.action_cost ?? poolItem?.actionCost ?? 0) || 0;
}

function getTalentDismantleGain(state, rank) {
    const normalizedRank = String(rank || '').toUpperCase();
    if (normalizedRank === 'A') return 200;
    if (normalizedRank === 'B') return Number(state.bTalentFragmentGain || 10);
    if (normalizedRank === 'C') return Number(state.cTalentFragmentGain || 5);
    return 0;
}

function getTalentRankWeight(rank) {
    return ({ C: 1, B: 2, A: 3, S: 4 })[String(rank || '').toUpperCase()] || 0;
}

function canTalentFitRankAllowance(ranks, allowance) {
    const sortedRanks = ranks.map(rank => String(rank || '').toUpperCase()).sort((a, b) => getTalentRankWeight(b) - getTalentRankWeight(a));
    const sortedAllowance = allowance.map(rank => String(rank || '').toUpperCase()).sort((a, b) => getTalentRankWeight(b) - getTalentRankWeight(a));
    if (sortedRanks.length > sortedAllowance.length) return false;
    return sortedRanks.every((rank, index) => getTalentRankWeight(rank) <= getTalentRankWeight(sortedAllowance[index]));
}

function canTalentFitCurrentRankRule(state, candidate, slot, currentTalent) {
    const allowance = Array.isArray(state.talentSlotRule?.ranks) ? state.talentSlotRule.ranks : ['C', 'C'];
    const ranks = (state.ownedTalents || [])
        .filter(talent => talent.equipped_slot)
        .filter(talent => Number(talent.equipped_slot) !== slot && Number(talent.id) !== Number(candidate?.id || 0))
        .map(talent => talent.rank);
    if (candidate) ranks.push(candidate.rank);
    if (currentTalent && !candidate) ranks.push(currentTalent.rank);
    return canTalentFitRankAllowance(ranks, allowance);
}

function renderTalentSlotRuleText(state) {
    const rule = state.talentSlotRule || {};
    const ranks = Array.isArray(rule.ranks) ? rule.ranks : [];
    if (!ranks.length) return '携带规则读取中';
    const kinds = Array.isArray(state.talentSlotKinds) ? state.talentSlotKinds : [];
    const activeSlots = Number(state.equippedSlotLimit || 2);
    const slotText = Array.from({ length: Number(state.maxEquippedSlotLimit || 4) }, (_, index) => {
        const open = index < activeSlots;
        return `${getTalentSlotKindLabel(kinds[index])}:${open ? '开' : '未开'}`;
    }).join(' · ');
    return `${slotText}；品阶组合 ${ranks.join('')}`;
}

function getTalentSlotKindLabel(kind) {
    if (kind === 'faith') return '信仰槽';
    if (kind === 'profession') return '职业槽';
    return '任意槽';
}

function getTalentSlotRequirement(state, slot) {
    const kind = (Array.isArray(state.talentSlotKinds) ? state.talentSlotKinds[slot - 1] : '') || 'any';
    if (kind === 'faith') return { kind, poolKey: state.faithTalentPoolKey || '', label: '信仰' };
    if (kind === 'profession') return { kind, poolKey: state.professionTalentPoolKey || '', label: '职业' };
    return { kind, poolKey: '', label: '任意' };
}

function canTalentFitSlotRequirement(talent, requirement) {
    if (!talent || requirement.kind === 'any') return true;
    return !!requirement.poolKey && talent.pool_key === requirement.poolKey;
}

function renderEquippedTalentSlots(state, god = getProfileFaithGod(getCurrentProfile()) || '命运') {
    const talents = state.ownedTalents || [];
    const byEquippedSlot = new Map(talents.filter(t => t.equipped_slot).map(t => [Number(t.equipped_slot), t]));
    const activeLimit = Number(state.equippedSlotLimit || 3);
    const limit = Number(state.maxEquippedSlotLimit || activeLimit || 3);
    return `<div class="talent-equipped-grid">${Array.from({ length: limit }, (_, index) => {
        const slot = index + 1;
        const talent = byEquippedSlot.get(slot);
        const locked = slot > activeLimit;
        const requirement = getTalentSlotRequirement(state, slot);
        const slotLabel = getTalentSlotKindLabel(requirement.kind);
        const optionHtml = [
            '<option value="">卸下到仓库</option>',
            ...talents.filter(item => item.storage_slot || Number(item.id) === Number(talent?.id || 0)).map(item => {
                const id = Number(item.id);
                const isCurrent = id === Number(talent?.id || 0);
                const rankBlocked = !canTalentFitCurrentRankRule(state, item, slot, talent);
                const poolBlocked = !canTalentFitSlotRequirement(item, requirement);
                const disabled = !isCurrent && (rankBlocked || poolBlocked);
                const reason = rankBlocked ? `当前分数只允许 ${escapeHtml((state.talentSlotRule?.ranks || []).join(''))} 品阶组合` : `${slotLabel}不能嵌入这个池子的天赋`;
                const disabledText = disabled ? ` disabled title="${escapeHtml(reason)}"` : '';
                const suffix = disabled ? `（${escapeHtml(rankBlocked ? '品阶超限' : '池子不符')}）` : '';
                return `<option value="${id}" ${isCurrent ? 'selected' : ''}${disabledText}>${escapeHtml(renderTalentOptionLabel(item))}${suffix}</option>`;
            })
        ].join('');
        return `
            <div class="talent-slot-card ${talent ? '' : 'empty'} ${locked ? 'pending' : ''}">
                <div class="talent-slot-head"><span>${escapeHtml(slotLabel)} ${slot === 2 ? '（必带）' : ''}</span><span>${locked ? '未开启' : '已开启'}</span></div>
                <select onchange="equipTalentUI(${slot}, this.value)" ${locked ? 'disabled' : ''}>${optionHtml}</select>
                ${locked ? renderMiniRitualEmpty('分数达到对应门槛后开启此携带槽。', god, '携带环封锁') : (talent ? `<div class="talent-slot-meta">${escapeHtml(renderTalentOptionLabel(talent))}</div>` : renderMiniRitualEmpty(getGodEmptyText(god, 'equipped'), god, '携带环空置'))}
            </div>`;
    }).join('')}</div>`;
}

function renderTalentWarehouse(state, god = getProfileFaithGod(getCurrentProfile()) || '命运') {
    const talents = state.ownedTalents || [];
    const byStorageSlot = new Map(talents.filter(t => t.storage_slot).map(t => [Number(t.storage_slot), t]));
    const limit = Number(state.inventorySlotLimit || 10);
    return `<div class="talent-inventory-grid">${Array.from({ length: limit }, (_, index) => {
        const slot = index + 1;
        const talent = byStorageSlot.get(slot);
        if (!talent) {
            return `
                <div class="talent-slot-card empty">
                    <div class="talent-slot-head"><span>仓库位 ${slot}</span><span>空</span></div>
                    ${renderMiniRitualEmpty(getGodEmptyText(god, 'warehouse'), god, '仓库格空置')}
                </div>`;
        }
        const effect = getTalentEffectText(state, talent);
        const actionCost = getTalentActionCost(state, talent);
        const fragmentGain = getTalentDismantleGain(state, talent.rank);
        const canDismantle = String(talent.rank || '').toUpperCase() !== 'S';
        return `
            <div class="talent-slot-card">
                <div class="talent-slot-head"><span>仓库位 ${slot}</span><span>未佩戴</span></div>
                <div class="talent-slot-name">${escapeHtml(talent.talent_name)}</div>
                <div class="talent-slot-meta">${escapeHtml(talent.rank)}级 · ${escapeHtml(formatTalentPoolLabel(talent.pool_key))}池 · 行动点 ${actionCost}</div>
                ${effect ? `<div class="talent-effect-text">${escapeHtml(effect)}</div>` : ''}
                <div class="talent-slot-actions">
                    <button type="button" class="btn btn-outline btn-sm" onclick="discardOwnedTalentUI(${Number(talent.id)})" ${talentManageInFlight || !canDismantle ? 'disabled' : ''}>${talentManageInFlight ? '处理中' : (canDismantle ? `分解 +${fragmentGain}` : 'S级不可分解')}</button>
                </div>
            </div>`;
    }).join('')}</div>`;
}

function renderOverflowChoices(state) {
    const choices = state.overflowChoices || [];
    if (!choices.length) return '';
    const replacementOptions = (state.ownedTalents || [])
        .filter(talent => talent.storage_slot)
        .filter(talent => String(talent.rank || '').toUpperCase() !== 'S')
        .map(talent => `<option value="${Number(talent.id)}">仓库${Number(talent.storage_slot || 0)} · ${escapeHtml(renderTalentOptionLabel(talent))}</option>`)
        .join('');
    return `
        <div class="profile-panel-title" style="margin-top:16px;"><span>待取舍天赋</span><small>${choices.length} 个溢出</small></div>
        <div class="talent-overflow-list">${choices.map(choice => {
            const id = Number(choice.id);
            const actionCost = getTalentActionCost(state, choice);
            const canDiscardChoice = String(choice.rank || '').toUpperCase() !== 'S';
            return `
                <div class="talent-overflow-card">
                    <div class="talent-slot-head"><span>新天赋溢出</span><span>${escapeHtml(choice.source || 'draw')}</span></div>
                    <div class="talent-slot-name">${escapeHtml(choice.talent_name)}</div>
                    <div class="talent-slot-meta">${escapeHtml(choice.rank)}级 · ${escapeHtml(formatTalentPoolLabel(choice.pool_key))}池 · 行动点 ${actionCost}。仓库已满，请选择保留新天赋并替换旧天赋，或分解新天赋。</div>
                    ${getTalentEffectText(state, choice) ? `<div class="talent-effect-text">${escapeHtml(getTalentEffectText(state, choice))}</div>` : ''}
                    <div class="talent-exchange-row">
                        <select id="overflowReplaceSelect-${id}">${replacementOptions || '<option value="">仓库暂无可替换天赋</option>'}</select>
                        <button type="button" class="btn btn-primary btn-sm" onclick="resolveTalentOverflowUI(${id}, 'replace')" ${talentManageInFlight || !replacementOptions ? 'disabled' : ''}>${talentManageInFlight ? '处理中' : '保留并分解旧天赋'}</button>
                    </div>
                    <div class="talent-slot-actions">
                        <button type="button" class="btn btn-outline btn-sm" onclick="resolveTalentOverflowUI(${id}, 'discard')" ${talentManageInFlight || !canDiscardChoice ? 'disabled' : ''}>${talentManageInFlight ? '处理中' : (canDiscardChoice ? `分解新天赋 +${getTalentDismantleGain(state, choice.rank)}` : 'S级不可分解')}</button>
                    </div>
                </div>`;
        }).join('')}</div>`;
}

function renderTalentPoolPanel(state, error, profile) {
    const profileGod = getProfileFaithGod(profile) || '欺诈';
    const profileGodStyle = getGodSkinStyle(profileGod);
    if (error) {
        return `
            <section class="profile-panel" id="talentPoolPanel" data-god="${escapeHtml(profileGod)}" style="${profileGodStyle}">
                <div class="profile-panel-title"><span>${escapeHtml(getGodTalentPoolName(profileGod))}</span><small>待启用</small></div>
                <div class="profile-empty">${escapeHtml(error.message || '天赋池暂不可用。请先运行天赋池 SQL 并部署后端函数。')}</div>
            </section>`;
    }
    const selectedPool = getSelectedTalentPool(profile, state);
    const selectedPoolGod = cleanGodName(String(selectedPool || '').replace(/^Pool/u, '')) || profileGod;
    const selectedPoolTitle = getGodInfo(selectedPoolGod).known ? getGodTalentPoolName(selectedPoolGod) : `${formatTalentPoolLabel(selectedPool)}池`;
    const selectedPoolMeta = (state.pools || []).find(pool => pool.poolKey === selectedPool) || {};
    const selectedPoolReady = Number(selectedPoolMeta.total || 0) > 0;
    const latestResults = lastTalentDrawResult.length ? renderTalentCards(lastTalentDrawResult, '') : '';
    const allowedPoolText = (state.pools || []).map(pool => formatTalentPoolLabel(pool.poolKey)).join(' / ') || '未绑定';
    const inventoryCount = (state.ownedTalents || []).filter(talent => talent.storage_slot).length;
    const inventoryLimit = Number(state.inventorySlotLimit || 10);
    const equippedCount = (state.ownedTalents || []).filter(talent => talent.equipped_slot).length;
    const exchangeCost = Number(state.targetTalentExchangeCost || 180);
    const aExchangeCost = Number(state.aTalentExchangeCost || 260);
    const ascensionScore = Number(state.profile?.ascension_score || profile?.ascensionScore || 0);
    const advancedDraw = ascensionScore >= Number(state.advancedTalentDrawScore || 1500);
    const basicAvailableDraws = Number(state.basicAvailableDraws || 0);
    const advancedAvailableDraws = Number(state.advancedAvailableDraws || 0);
    const bRateText = `${Math.round(Number(advancedDraw ? state.advancedBTalentDrawRate : state.bTalentDrawRate || 0.2) * 100)}%`;
    const aRateText = `${Math.round(Number(state.aTalentDrawRate || 0.02) * 10000) / 100}%`;
    const sRateText = `${Math.round(Number(state.sTalentDrawRate || 0.001) * 10000) / 100}%`;
    const guaranteeDraws = Number(state.bTalentGuaranteeDraws || 10);
    const sGuaranteeDraws = Number(state.sTalentGuaranteeDraws || 60);
    const currentMisses = Math.min(guaranteeDraws - 1, getTalentPoolCounter(state, selectedPool));
    const sCounter = Number((state.counters || []).find(counter => counter.pool_key === selectedPool)?.s_continue_draw || 0);
    const drawRuleText = advancedDraw
        ? `1500+：S ${sRateText}（${sGuaranteeDraws}抽保底）/ A ${aRateText}（无保底）/ B ${bRateText}（${guaranteeDraws}抽保底）`
        : `1500前：仅 B/C，B ${bRateText}（${guaranteeDraws}抽保底）`;
    return `
        <section class="profile-panel" id="talentPoolPanel" data-god="${escapeHtml(profileGod)}" style="${profileGodStyle}">
            <div class="profile-panel-title">
                <span>${escapeHtml(selectedPoolTitle)}</span>
                <small>仅开放信仰池与职业池</small>
            </div>
            <div class="talent-pool-card" data-god="${escapeHtml(profileGod)}" style="${profileGodStyle}">
                <div class="profile-score-row">
                    <div class="profile-stat-card"><span>可用抽数</span><strong>${Number(state.availableDraws || 0)}</strong></div>
                    <div class="profile-stat-card"><span>天赋碎片</span><strong>${Number(state.fragmentTotal || 0)}</strong></div>
                </div>
                <div class="metric-strip">
                    <span class="metric-pill">累计获得抽数 <strong>${Number(state.totalDrawsEarned || 0)}</strong></span>
                    <span class="metric-pill">已用抽数 <strong>${Number(state.spentDraws || 0)}</strong></span>
                    ${Number(state.eventBasicDraws || 0) ? `<span class="metric-pill">腐朽登神 B/C <strong>${Number(state.eventBasicDraws || 0)}</strong></span>` : ''}
                    ${Number(state.eventAdvancedDraws || 0) ? `<span class="metric-pill">腐朽登神 S/A/B/C <strong>${Number(state.eventAdvancedDraws || 0)}</strong></span>` : ''}
                    <span class="metric-pill">基础 B/C 抽 <strong>${basicAvailableDraws}</strong></span>
                    <span class="metric-pill">进阶 S/A/B/C 抽 <strong>${advancedAvailableDraws}</strong></span>
                    <span class="metric-pill">B级概率 <strong>${escapeHtml(bRateText)}</strong></span>
                    <span class="metric-pill">保底进度 <strong>${currentMisses}/${guaranteeDraws - 1}</strong></span>
                    ${advancedDraw ? `<span class="metric-pill">S保底 <strong>${Math.min(sGuaranteeDraws - 1, sCounter)}/${sGuaranteeDraws - 1}</strong></span>` : ''}
                    <span class="metric-pill">仓库 <strong>${inventoryCount}/${inventoryLimit}</strong></span>
                    <span class="metric-pill">携带 <strong>${equippedCount}/${Number(state.equippedSlotLimit || 3)}</strong></span>
                    <span class="metric-pill">可选池 <strong>${escapeHtml(allowedPoolText)}</strong></span>
                </div>
                <div class="talent-rule-strip">
                    <span>新手赠送 <strong>${Number(state.starterTalentDrawGrant || 15)}</strong> 抽，不计保底</span>
                    ${Number(state.eventBasicDraws || 0) ? `<span>庆祝腐朽登神活动 <strong>${Number(state.eventBasicDraws || 0)}</strong> 抽，属于基础 B/C 抽</span>` : ''}
                    ${Number(state.eventAdvancedDraws || 0) ? `<span>庆祝腐朽登神活动 <strong>${Number(state.eventAdvancedDraws || 0)}</strong> 抽，属于进阶 S/A/B/C 抽</span>` : ''}
                    <span>${escapeHtml(drawRuleText)}</span>
                    <span>基础抽数优先消耗，1500 前获得的抽数不会转化为进阶抽数</span>
                    <span>重复 C/B：<strong>+${Number(state.cTalentFragmentGain || 5)} / +${Number(state.bTalentFragmentGain || 10)}</strong> 碎片</span>
                    <span>分解 C/B/A：<strong>+${Number(state.cTalentFragmentGain || 5)} / +${Number(state.bTalentFragmentGain || 10)} / +200</strong> 碎片，S不可分解</span>
                    <span>携带上限：<strong>${escapeHtml(renderTalentSlotRuleText(state))}</strong></span>
                    <span>指定 B/A 兑换：<strong>${exchangeCost} / ${aExchangeCost}</strong> 碎片</span>
                </div>
                <div class="talent-control-row">
                    <div class="form-group" style="margin:0;">
                        <label for="talentPoolSelect">选择天赋池</label>
                        <select id="talentPoolSelect" onchange="selectTalentPoolUI(this.value)">${renderTalentPoolOptions(state, selectedPool)}</select>
                    </div>
                    <button type="button" class="btn btn-outline btn-sm" onclick="refreshTalentPoolUI()">重观池纹</button>
                    <button type="button" class="btn btn-outline btn-sm" onclick="drawTalentUI('single')" ${talentDrawInFlight || !selectedPoolReady || state.availableDraws < 1 ? 'disabled' : ''}>${talentDrawInFlight ? '牵引中' : '牵引一枚'}</button>
                    <button type="button" class="btn btn-primary btn-sm" onclick="drawTalentUI('ten')" ${talentDrawInFlight || !selectedPoolReady || state.availableDraws < 10 ? 'disabled' : ''}>${talentDrawInFlight ? '十连牵引中' : '启十连谕'}</button>
                </div>
                ${selectedPoolReady ? '' : '<div class="identity-help">当前天赋池暂无配置，等补完池子后就能抽取。</div>'}
                ${latestResults ? `<div class="profile-list-meta" style="margin-top:12px;">本次抽取</div>${latestResults}` : ''}
            </div>
            ${renderOverflowChoices(state)}
            <div class="profile-panel-title" style="margin-top:16px;"><span>天赋仓库</span><small>${inventoryCount}/${inventoryLimit} 个槽位</small></div>
            ${renderTalentWarehouse(state, profileGod)}
            <div class="talent-exchange-row">
                <select id="talentExchangeSelect">${renderTalentExchangeOptions(state, selectedPool)}</select>
                <button type="button" class="btn btn-outline btn-sm" onclick="exchangeTalentUI()" ${!selectedPoolReady ? 'disabled' : ''}>B${exchangeCost} / A${aExchangeCost} 碎片赎取</button>
            </div>
            <div class="profile-panel-title" style="margin-top:16px;"><span>抽取记录</span></div>
            ${renderTalentLogs(state, profileGod)}
        </section>`;
}

async function selectTalentPoolUI(poolKey) {
    selectedTalentPool = poolKey;
    lastTalentDrawResult = [];
    replaceTalentPoolPanel();
}

async function refreshTalentPoolUI(showToastOnSuccess = true) {
    const { state, error } = await fetchTalentState();
    if (error?.message?.includes('身份已切换')) return;
    setCurrentTalentState(state, error);
    lastTalentDrawResult = [];
    replaceTalentPoolPanel();
    if (error) showToast(`❌ ${error.message || '刷新失败'}`);
    else if ((state?.settledOverflowChoices || []).length) showToast(`已将 ${state.settledOverflowChoices.length} 个待取舍天赋补入空仓位`);
    else if (showToastOnSuccess) showToast('天赋池已刷新');
}

function applyTalentActionState(data) {
    if (!data?.state) return;
    const nextState = normalizeTalentState(data.state);
    setCurrentTalentState(nextState, null);
    applyTalentStateProfile(nextState);
    replaceTalentPoolPanel();
    if ((nextState.settledOverflowChoices || []).length) showToast(`已将 ${nextState.settledOverflowChoices.length} 个待取舍天赋补入空仓位`);
}

function getProfileExportPayload() {
    const profile = getCurrentProfile();
    const state = normalizeTalentState(currentTalentState);
    const displayName = cleanDisplayNameInput(inviteSession?.name || profile.displayName || '') || '未命名信徒';
    const faithGod = getProfileFaithGod(profile) || '命运';
    const visualProfession = getProfileVisualProfession(profile) || profile.profession || '';
    const profession = visualProfession || '未填写职业';
    const professionInfo = getProfessionInfo(visualProfession);
    const titles = profile.showTitles === false
        ? []
        : normalizeProfileTitleList(profile.activeTitles, profile.activeTitle).map(title => ({
            name: title.titleText,
            god: title.titleGod || '',
            note: title.titleNote || '',
        })).filter(title => title.name);
    const curses = normalizeProfileCurseList(profile.activeCurses, profile.activeCurse).map(curse => ({
        name: curse.curseText,
        god: curse.curseGod || '',
        effect: curse.curseNote || '',
        type: curse.curseType || 'betrayal',
    })).filter(curse => curse.name);
    const healthSummary = getProfileHealthSummary({ ...profile, profession: visualProfession || profile.profession });
    const equippedTalents = (state.ownedTalents || [])
        .filter(talent => Number(talent.equipped_slot || 0) > 0)
        .sort((a, b) => Number(a.equipped_slot || 0) - Number(b.equipped_slot || 0))
        .map(talent => ({
            slot: Number(talent.equipped_slot || 0),
            name: String(talent.talent_name || ''),
            rank: String(talent.rank || ''),
            pool: formatTalentPoolLabel(talent.pool_key),
            effect: getTalentEffectText(state, talent),
        }));
    return {
        displayName,
        faithGod,
        profession,
        professionClass: professionInfo.className || healthSummary.profession.className || '',
        professionTrait: healthSummary.classTrait || CLASS_TRAITS[professionInfo.className] || '',
        ascensionScore: Number(profile.ascensionScore || 0),
        audienceScore: Number(profile.audienceScore || 0),
        health: {
            maxHp: healthSummary.maxHp,
            baseHp: healthSummary.rule.baseHp,
            tableHp: healthSummary.tableHp,
            healthBand: healthSummary.healthBand,
            growthHp: healthSummary.growthHp,
            faithBonus: healthSummary.faithBonus,
            resistanceSkinName: healthSummary.resistanceSkin?.name || '',
            resistanceSkinDescription: healthSummary.resistanceSkin?.description || '',
            className: healthSummary.rule.className || healthSummary.profession.className || '',
            trait: healthSummary.trait || ''
        },
        titles,
        curses,
        equippedTalents,
        exportedAt: new Date(),
    };
}

function drawProfileCardImage(payload) {
    const width = 1200;
    const scale = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    measureCtx.font = '600 23px "Microsoft YaHei", sans-serif';
    const faithTraitLines = wrapCanvasText(measureCtx, payload.health.trait || '请选择信仰后查看信仰特性。', 570, Infinity);
    const professionTraitLines = wrapCanvasText(measureCtx, payload.professionTrait || '请选择职业后查看职业特性。', 570, Infinity);
    measureCtx.font = '800 34px "Microsoft YaHei", sans-serif';
    const titleEntries = Array.isArray(payload.titles) ? payload.titles : [];
    const titleText = titleEntries.length
        ? titleEntries.slice(0, 5).map(title => {
            if (typeof title === 'string') return title;
            return [title.name, title.note].filter(Boolean).join('｜');
        }).filter(Boolean).join(' / ')
        : '暂无已佩戴称号';
    const titleLines = wrapCanvasText(measureCtx, titleText, 960, Infinity);
    const curseEntries = Array.isArray(payload.curses) && payload.curses.length
        ? payload.curses
        : [{ name: '暂无诅咒', god: payload.faithGod || '命运', effect: '当前没有挂载中的诅咒。', type: 'ordinary', empty: true }];
    const curseLayouts = curseEntries.slice(0, 5).map(curse => {
        measureCtx.font = '900 32px "Microsoft YaHei", sans-serif';
        const nameLines = wrapCanvasText(measureCtx, String(curse.name || '未知诅咒'), 880, Infinity);
        measureCtx.font = '600 22px "Microsoft YaHei", sans-serif';
        const effectLines = wrapCanvasText(measureCtx, curse.effect || '暂无记录具体效果。', 880, Infinity);
        const cardHeight = Math.max(132, 98 + nameLines.length * 36 + effectLines.length * 29);
        return { curse, nameLines, effectLines, cardHeight };
    });
    const talents = payload.equippedTalents.length ? payload.equippedTalents : [{ slot: 0, name: '尚未携带天赋', rank: '', pool: '', effect: '打开个人面板后可在天赋仓库配置携带槽。' }];
    const talentLayouts = talents.slice(0, 4).map(talent => {
        measureCtx.font = '900 34px "Microsoft YaHei", sans-serif';
        const name = `${talent.name}${talent.rank ? `（${talent.rank}）` : ''}`;
        const nameLines = wrapCanvasText(measureCtx, name, 880, Infinity);
        measureCtx.font = '600 22px "Microsoft YaHei", sans-serif';
        const meta = [talent.pool ? `${talent.pool}池` : '', talent.effect || ''].filter(Boolean).join(' · ');
        const metaLines = wrapCanvasText(measureCtx, meta, 880, Infinity);
        const cardHeight = Math.max(138, 104 + nameLines.length * 38 + metaLines.length * 29);
        return { talent, nameLines, metaLines, cardHeight };
    });
    const battleTop = 630;
    const battleHeight = Math.max(240, 104 + faithTraitLines.length * 31 + 58 + professionTraitLines.length * 31);
    const titlesHeadingY = battleTop + battleHeight + 84;
    const titleStartY = titlesHeadingY + 52;
    const curseHeadingY = titleStartY + titleLines.length * 44 + 86;
    const curseStartY = curseHeadingY + 38;
    const curseTotalHeight = curseLayouts.reduce((sum, item, index) => sum + item.cardHeight + (index ? 18 : 0), 0);
    const talentsHeadingY = curseStartY + curseTotalHeight + 76;
    const firstTalentY = talentsHeadingY + 38;
    const talentTotalHeight = talentLayouts.reduce((sum, item, index) => sum + item.cardHeight + (index ? 22 : 0), 0);
    const footerY = firstTalentY + talentTotalHeight + 90;
    const height = Math.max(1960, footerY + 170);
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    const skin = getGodSkin(payload.faithGod);
    const main = skin.primary || '#d5a742';
    const accent = skin.secondary || '#7f8cff';
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, '#080a10');
    bg.addColorStop(0.48, '#111521');
    bg.addColorStop(1, '#07070b');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = main;
    ctx.lineWidth = 2;
    for (let x = -height; x < width; x += 72) {
        ctx.beginPath();
        ctx.moveTo(x, height);
        ctx.lineTo(x + height, 0);
        ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-Math.PI / 7);
    ctx.font = '900 118px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(231,207,138,0.055)';
    ctx.textAlign = 'center';
    for (let y = -760; y <= 760; y += 260) {
        for (let x = -760; x <= 760; x += 680) {
            ctx.fillText('诸神愚戏', x, y);
        }
    }
    ctx.restore();

    drawRoundRect(ctx, 62, 62, width - 124, height - 124, 28);
    ctx.fillStyle = 'rgba(12,14,22,0.82)';
    ctx.fill();
    ctx.strokeStyle = main;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = main;
    ctx.font = '900 34px "Microsoft YaHei", sans-serif';
    ctx.fillText('诸神愚戏 · 信徒档案', 108, 138);
    ctx.fillStyle = 'rgba(234,234,242,0.58)';
    ctx.font = '600 22px "Microsoft YaHei", sans-serif';
    ctx.fillText(`导出时间 ${formatDate(payload.exportedAt.toISOString())}`, 108, 178);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(231,207,138,0.9)';
    ctx.font = '900 92px "Microsoft YaHei", sans-serif';
    ctx.fillText(getGodIcon(payload.faithGod) || '✦', width - 110, 150);
    ctx.font = '700 24px "Microsoft YaHei", sans-serif';
    ctx.fillText(`${payload.faithGod} · ${skin.motif || '命途'}`, width - 110, 188);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#f4f0df';
    ctx.font = '900 72px "Microsoft YaHei", sans-serif';
    ctx.fillText(payload.displayName, 108, 292);
    ctx.fillStyle = 'rgba(234,234,242,0.78)';
    ctx.font = '700 30px "Microsoft YaHei", sans-serif';
    const professionLine = payload.professionClass
        ? `职业：${payload.professionClass} · ${payload.profession}`
        : `职业：${payload.profession}`;
    ctx.fillText(professionLine, 112, 342);

    const scoreCards = [
        ['登神之路', String(payload.ascensionScore)],
        ['觐见之梯', String(payload.audienceScore)],
    ];
    scoreCards.forEach(([label, value], index) => {
        const x = 108 + index * 500;
        drawRoundRect(ctx, x, 396, 440, 130, 18);
        ctx.fillStyle = index ? 'rgba(127,140,255,0.12)' : 'rgba(213,167,66,0.13)';
        ctx.fill();
        ctx.strokeStyle = index ? accent : main;
        ctx.globalAlpha = 0.45;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(234,234,242,0.62)';
        ctx.font = '700 24px "Microsoft YaHei", sans-serif';
        ctx.fillText(label, x + 28, 438);
        ctx.fillStyle = '#f4f0df';
        ctx.font = '900 48px "Microsoft YaHei", sans-serif';
        ctx.fillText(value, x + 28, 494);
    });

    ctx.fillStyle = main;
    ctx.font = '900 30px "Microsoft YaHei", sans-serif';
    ctx.fillText('战斗面板', 108, 596);
    drawRoundRect(ctx, 108, battleTop, 310, battleHeight, 20);
    ctx.fillStyle = 'rgba(213,167,66,0.12)';
    ctx.fill();
    ctx.strokeStyle = main;
    ctx.globalAlpha = 0.42;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(234,234,242,0.62)';
    ctx.font = '800 24px "Microsoft YaHei", sans-serif';
    ctx.fillText('血量上限', 136, battleTop + 44);
    ctx.fillStyle = '#f4f0df';
    ctx.font = '900 70px "Microsoft YaHei", sans-serif';
    ctx.fillText(payload.health.maxHp ? String(payload.health.maxHp) : '未定', 136, battleTop + 118);
    ctx.fillStyle = 'rgba(234,234,242,0.62)';
    ctx.font = '600 21px "Microsoft YaHei", sans-serif';
    const healthParts = payload.health.maxHp
        ? [`基础 ${payload.health.baseHp}`, `${payload.health.healthBand}档 ${payload.health.tableHp}`, `成长 +${payload.health.growthHp}`]
        : ['请选择职业后查看血量成长'];
    ctx.fillText(healthParts.join(' / '), 136, battleTop + 156);
    const healthRuleText = payload.health.maxHp
        ? `信仰 +${payload.health.faithBonus || 0} / ${payload.health.resistanceSkinName || '暂无分数档被动'}`
        : '';
    if (healthRuleText) ctx.fillText(healthRuleText, 136, battleTop + 188);

    drawRoundRect(ctx, 444, battleTop, 648, battleHeight, 20);
    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.36;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(231,207,138,0.86)';
    ctx.font = '800 24px "Microsoft YaHei", sans-serif';
    ctx.fillText(`${payload.faithGod}之神 · 信仰特性`, 474, battleTop + 44);
    ctx.fillStyle = 'rgba(244,240,223,0.84)';
    ctx.font = '600 23px "Microsoft YaHei", sans-serif';
    faithTraitLines.forEach((line, index) => {
        ctx.fillText(line, 474, battleTop + 88 + index * 31);
    });
    const professionTraitTitleY = battleTop + 104 + faithTraitLines.length * 31;
    ctx.fillStyle = 'rgba(231,207,138,0.86)';
    ctx.font = '800 24px "Microsoft YaHei", sans-serif';
    const classLabel = payload.professionClass || '职业';
    ctx.fillText(`${classLabel} · 职业特性`, 474, professionTraitTitleY);
    ctx.fillStyle = 'rgba(244,240,223,0.84)';
    ctx.font = '600 23px "Microsoft YaHei", sans-serif';
    professionTraitLines.forEach((line, index) => {
        ctx.fillText(line, 474, professionTraitTitleY + 44 + index * 31);
    });

    ctx.fillStyle = main;
    ctx.font = '900 30px "Microsoft YaHei", sans-serif';
    ctx.fillText('已佩戴称号', 108, titlesHeadingY);
    titleLines.forEach((line, index) => {
        ctx.fillStyle = index ? 'rgba(244,240,223,0.72)' : '#f4f0df';
        ctx.font = '800 34px "Microsoft YaHei", sans-serif';
        ctx.fillText(line, 108, titleStartY + index * 44);
    });

    ctx.fillStyle = '#d98d8d';
    ctx.font = '900 30px "Microsoft YaHei", sans-serif';
    ctx.fillText('现存诅咒', 108, curseHeadingY);
    let curseY = curseStartY;
    curseLayouts.forEach((layout, index) => {
        const { curse, nameLines, effectLines, cardHeight } = layout;
        const y = curseY;
        const curseGod = curse.god || payload.faithGod || '命运';
        const curseSkin = getGodSkin(curseGod);
        const curseAccent = curse.empty ? main : (curseSkin.primary || '#b84545');
        drawRoundRect(ctx, 108, y, 984, cardHeight, 18);
        ctx.fillStyle = curse.empty ? 'rgba(255,255,255,0.035)' : 'rgba(80,15,22,0.18)';
        ctx.fill();
        ctx.strokeStyle = curseAccent;
        ctx.globalAlpha = curse.empty ? 0.24 : 0.42;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = curse.empty ? 'rgba(231,207,138,0.76)' : 'rgba(217,141,141,0.92)';
        ctx.font = '800 24px "Microsoft YaHei", sans-serif';
        const curseTypeLabel = getProfileCurseTypeLabel(curse.type || curse.curseType);
        ctx.fillText(curse.empty ? '诅咒状态' : `${curseGod} · ${curseTypeLabel}`, 136, y + 38);
        ctx.fillStyle = '#f4f0df';
        ctx.font = '900 32px "Microsoft YaHei", sans-serif';
        nameLines.forEach((line, lineIndex) => {
            ctx.fillText(line, 136, y + 76 + lineIndex * 36);
        });
        ctx.fillStyle = 'rgba(234,234,242,0.68)';
        ctx.font = '600 22px "Microsoft YaHei", sans-serif';
        const effectStartY = y + 100 + nameLines.length * 36;
        effectLines.forEach((line, lineIndex) => {
            ctx.fillText(line, 136, effectStartY + lineIndex * 29);
        });
        curseY += cardHeight + 18;
    });

    ctx.fillStyle = main;
    ctx.font = '900 30px "Microsoft YaHei", sans-serif';
    ctx.fillText('携带天赋', 108, talentsHeadingY);
    let talentY = firstTalentY;
    talentLayouts.forEach((layout, index) => {
        const { talent, nameLines, metaLines, cardHeight } = layout;
        const y = talentY;
        drawRoundRect(ctx, 108, y, 984, cardHeight, 18);
        ctx.fillStyle = 'rgba(255,255,255,0.045)';
        ctx.fill();
        ctx.strokeStyle = index % 2 ? accent : main;
        ctx.globalAlpha = 0.36;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(231,207,138,0.86)';
        ctx.font = '800 24px "Microsoft YaHei", sans-serif';
        ctx.fillText(talent.slot ? `携带槽 ${talent.slot}` : '携带槽', 136, y + 38);
        ctx.fillStyle = '#f4f0df';
        ctx.font = '900 34px "Microsoft YaHei", sans-serif';
        nameLines.forEach((line, lineIndex) => {
            ctx.fillText(line, 136, y + 78 + lineIndex * 38);
        });
        ctx.fillStyle = 'rgba(234,234,242,0.64)';
        ctx.font = '600 22px "Microsoft YaHei", sans-serif';
        const metaStartY = y + 104 + nameLines.length * 38;
        metaLines.forEach((line, lineIndex) => {
            ctx.fillText(line, 136, metaStartY + lineIndex * 29);
        });
        talentY += cardHeight + 22;
    });

    ctx.fillStyle = 'rgba(234,234,242,0.48)';
    ctx.font = '600 22px "Microsoft YaHei", sans-serif';
    ctx.fillText('由诸神愚戏副本论坛生成 · 仅作玩家档案展示', 108, height - 130);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(231,207,138,0.72)';
    ctx.font = '900 28px "Microsoft YaHei", sans-serif';
    ctx.fillText('诸神愚戏', width - 108, height - 130);
    ctx.textAlign = 'left';

    return canvas;
}

function exportProfileCardImage() {
    if (!inviteSession) { openInviteModal('先验入局谕令后可导出个人档案图。'); return; }
    try {
        const canvas = drawProfileCardImage(getProfileExportPayload());
        const link = document.createElement('a');
        const name = cleanDisplayNameInput(inviteSession.name || getCurrentProfile().displayName || 'profile') || 'profile';
        link.download = `诸神愚戏-个人档案-${name}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        link.remove();
        showToast('个人档案图已生成');
    } catch (error) {
        console.error('导出个人档案图失败', error);
        showToast('❌ 导出失败，请刷新个人面板后重试');
    }
}

async function drawTalentUI(drawType) {
    if (!inviteSession?.code) { openInviteModal('先验入局谕令后可开启天赋池。'); return; }
    if (talentDrawInFlight) { showToast('天赋池正在牵引，请勿重复点击'); return; }
    const poolKey = document.getElementById('talentPoolSelect')?.value || selectedTalentPool;
    talentDrawInFlight = true;
    const inviteSnapshot = getInviteSnapshot();
    replaceTalentPoolPanel();
    try {
        const { data, error } = await invokeDungeonAction('drawTalent', { poolKey, drawType });
        if (!isInviteSnapshotCurrent(inviteSnapshot)) return;
        if (error) {
            showToast(`❌ ${error.message || '抽取失败'}`);
            if (String(error.message || '').includes('抽数不足')) await refreshTalentPoolUI(false);
            return;
        }
        selectedTalentPool = poolKey;
        lastTalentDrawResult = Array.isArray(data?.results) ? data.results : [];
        applyTalentActionState(data);
        const basicUsed = Number(data?.basicDrawsUsed || 0);
        const advancedUsed = Number(data?.advancedDrawsUsed || 0);
        const tierSummary = advancedUsed
            ? `基础 B/C ${basicUsed} 抽，进阶 S/A/B/C ${advancedUsed} 抽`
            : `基础 B/C ${basicUsed} 抽`;
        showToast(`${drawType === 'ten' ? '十连完成' : '单抽完成'}：${tierSummary}`);
        if (document.getElementById('leaderboardPage')?.style.display !== 'none') await renderLeaderboardPage();
    } finally {
        if (isInviteSnapshotCurrent(inviteSnapshot)) {
            talentDrawInFlight = false;
            replaceTalentPoolPanel();
        }
    }
}

async function exchangeTalentUI() {
    if (!inviteSession?.code) { openInviteModal('先验入局谕令后可兑换天赋。'); return; }
    const poolKey = document.getElementById('talentPoolSelect')?.value || selectedTalentPool;
    const exchangeSelect = document.getElementById('talentExchangeSelect');
    const targetTalentId = Number(exchangeSelect?.value || 0);
    if (!targetTalentId) { showToast('请选择可兑换的 B/A 级天赋'); return; }
    const selectedOption = exchangeSelect?.selectedOptions?.[0];
    const optionRank = selectedOption?.dataset?.rank || '';
    const optionName = selectedOption?.dataset?.name || selectedOption?.textContent || '该天赋';
    const optionCost = Number(selectedOption?.dataset?.cost || 0);
    const confirmText = optionCost > 0
        ? `确定消耗 ${optionCost} 碎片兑换 ${optionRank}级天赋「${optionName}」吗？`
        : `确定兑换天赋「${optionName}」吗？`;
    if (!window.confirm(confirmText)) return;
    if (!acquireUiActionLock('exchangeTalent', '天赋兑换正在处理中，请勿重复点击')) return;
    const inviteSnapshot = getInviteSnapshot();
    try {
        const { data, error } = await invokeDungeonAction('exchangeTalent', { poolKey, targetTalentId });
        if (!isInviteSnapshotCurrent(inviteSnapshot)) return;
        if (error) { showToast(`❌ ${error.message || '兑换失败'}`); return; }
        selectedTalentPool = poolKey;
        lastTalentDrawResult = data?.talent ? [data.talent] : [];
        applyTalentActionState(data);
        showToast('碎片兑换完成');
        if (document.getElementById('leaderboardPage')?.style.display !== 'none') await renderLeaderboardPage();
    } finally {
        releaseUiActionLock('exchangeTalent');
    }
}

async function equipTalentUI(equippedSlot, ownedTalentId) {
    if (!inviteSession?.code) { openInviteModal('先验入局谕令后可调整携带天赋。'); return; }
    const lockKey = `equipTalent:${equippedSlot}`;
    if (!acquireUiActionLock(lockKey, '天赋携带正在更新，请勿重复点击')) return;
    const payload = {
        equippedSlot: Number(equippedSlot),
        ownedTalentId: ownedTalentId ? Number(ownedTalentId) : null
    };
    const inviteSnapshot = getInviteSnapshot();
    try {
        const { data, error } = await invokeDungeonAction('setEquippedTalent', payload);
        if (!isInviteSnapshotCurrent(inviteSnapshot)) return;
        if (error) { showToast(`❌ ${error.message || '设置失败'}`); return; }
        lastTalentDrawResult = [];
        applyTalentActionState(data);
        showToast('携带天赋已更新');
    } finally {
        releaseUiActionLock(lockKey);
    }
}

async function resolveTalentOverflowUI(choiceId, decision) {
    if (!inviteSession?.code) { openInviteModal('先验入局谕令后可处理溢出天赋。'); return; }
    if (talentManageInFlight) { showToast('天赋正在处理中，请勿重复点击'); return; }
    const payload = { choiceId: Number(choiceId), decision };
    if (decision === 'replace') {
        const replaceOwnedId = Number(document.getElementById(`overflowReplaceSelect-${choiceId}`)?.value || 0);
        if (!replaceOwnedId) { showToast('请选择要替换的仓库天赋'); return; }
        payload.replaceOwnedId = replaceOwnedId;
    }
    talentManageInFlight = true;
    const inviteSnapshot = getInviteSnapshot();
    replaceTalentPoolPanel();
    try {
        const { data, error } = await invokeDungeonAction('resolveTalentOverflow', payload);
        if (!isInviteSnapshotCurrent(inviteSnapshot)) return;
        if (error) { showToast(`❌ ${error.message || '处理失败'}`); return; }
        lastTalentDrawResult = [];
        applyTalentActionState(data);
        const gain = Number(data?.fragmentGain || 0);
        showToast(decision === 'replace' ? `已保留新天赋，旧天赋分解 +${gain} 碎片` : `已分解溢出天赋 +${gain} 碎片`);
    } finally {
        if (isInviteSnapshotCurrent(inviteSnapshot)) {
            talentManageInFlight = false;
            replaceTalentPoolPanel();
        }
    }
}

async function discardOwnedTalentUI(ownedTalentId) {
    if (!inviteSession?.code) { openInviteModal('先验入局谕令后可整理仓库。'); return; }
    if (talentManageInFlight) { showToast('天赋正在处理中，请勿重复点击'); return; }
    if (!window.confirm('确定分解这个仓库天赋并获得碎片吗？')) return;
    talentManageInFlight = true;
    const inviteSnapshot = getInviteSnapshot();
    replaceTalentPoolPanel();
    try {
        const { data, error } = await invokeDungeonAction('discardOwnedTalent', { ownedTalentId: Number(ownedTalentId) });
        if (!isInviteSnapshotCurrent(inviteSnapshot)) return;
        if (error) { showToast(`❌ ${error.message || '分解失败'}`); return; }
        lastTalentDrawResult = [];
        applyTalentActionState(data);
        showToast(`仓库天赋已分解 +${Number(data?.fragmentGain || 0)} 碎片`);
    } finally {
        if (isInviteSnapshotCurrent(inviteSnapshot)) {
            talentManageInFlight = false;
            replaceTalentPoolPanel();
        }
    }
}












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

const scoreActionLocks = new Set();

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
    const curseHelp = '勾选后才填写诅咒名与效果；不勾选则本次只改信仰与职业。';
    return `
        ${renderGodBelieverStatus()}
        <section class="profile-panel" data-god="${escapeHtml(godName)}" style="${getGodSkinStyle(godName)}">
            <div class="profile-panel-title"><span>神明改信区</span><small>改命途 + 职业，诅咒可选</small></div>
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
            <div class="identity-help">${escapeHtml(curseHelp)} 只有“改信仰”时才能同步改职业，同信仰单独改职业会被后端拒绝。</div>
            <div class="profile-tools">
                <button class="btn btn-primary btn-sm" data-god-convert-action="convert" onclick="godConvertBelieverUI()">执行改信敕令</button>
                <button class="btn btn-outline btn-sm" data-god-convert-action="refresh" onclick="refreshGodBelievers(true)">刷新信徒名单</button>
            </div>
            <div id="godBelieverPanel" class="profile-list" style="margin-top:14px;">${renderGodBelieverRows()}</div>
        </section>`;
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
    const titleGodHelp = isGodRole()
        ? `${escapeHtml(godName)}之神只能为当前 ${escapeHtml(godName)} 信徒降下称号`
        : '选择降号名义';
    const curseHelp = isGodRole()
        ? `${escapeHtml(godName)}之神下放背弃诅咒时仍要求对方已改信；普通诅咒不要求改信`
        : '馆主可代任一神明下放背弃诅咒或普通诅咒';
    return `
        ${renderHonorActionStatus()}
        <section class="profile-panel" data-god="${escapeHtml(godName || '命运')}" style="${getGodSkinStyle(godName || '命运')}">
            <div class="profile-panel-title"><span>称号敕令</span><small>${isGodRole() ? '神明降号' : '馆主降下 / 神明名义'}</small></div>
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
            <div class="identity-help">${titleGodHelp}</div>
            <div class="profile-tools">
                <button class="btn btn-primary btn-sm" data-honor-action="grant-title" onclick="grantProfileTitleUI()">降下称号</button>
                <button class="btn btn-outline btn-sm" data-honor-action="revoke-title" onclick="revokeProfileTitleUI()">回收称号</button>
            </div>
        </section>
        <section class="profile-panel" data-god="${escapeHtml(godName || '命运')}" style="${getGodSkinStyle(godName || '命运')}">
            <div class="profile-panel-title"><span>下放诅咒</span><small>背弃 / 普通</small></div>
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
            <div class="identity-help">${curseHelp}。背弃诅咒会自动授予「背弃者」；普通诅咒不会自动授予称号。诅咒效果会显示在玩家个人页与个人档案导出图中。</div>
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

async function renderScorePage() {
    const container = document.getElementById('scoreContent');
    if (!container) return;
    if (!canSettleScores()) {
        if (isGodRole()) {
            const { entries: titleEntries } = await fetchLeaderboardEntries();
            await refreshGodBelievers(false);
            await refreshHonorOperationLogs(false);
            const godName = cleanGodName(inviteSession?.name || '') || '命运';
            container.innerHTML = `
                <section class="profile-hero" data-god="${escapeHtml(godName)}" data-motif="${escapeHtml(getGodSkin(godName).motif)}" style="${getGodSkinStyle(godName)}">
                    <div class="profile-avatar ${getGodClass(godName)}" style="${getGodSkinStyle(godName)}">${renderGodSigil(godName, 'lg')}</div>
                    <div class="profile-hero-copy">
                        <div class="profile-kicker">DIVINE TITLE EDICT</div>
                        <h1 class="profile-name">称号敕令台</h1>
                        <div class="profile-subline">
                            <span class="metric-pill">神明 <strong>${escapeHtml(inviteSession?.name || godName)}</strong></span>
                            <span class="metric-pill">第零神席 <strong>∞</strong></span>
                        </div>
                        <div class="profile-faith-prayer">以神名降下称号。</div>
                    </div>
                </section>
                <div class="profile-grid">
                    <div>
                        ${renderGodCommandPanel()}
                        ${renderTitleAdminPanel(titleEntries)}
                    </div>
                </div>`;
            toggleGodConversionCurseFields();
            return;
        }
        container.innerHTML = renderRitualEmpty('此页只对结算审核员与神谕馆主开放；未持审核席权限的身份不会进入分数结算。', '真理', '需要审核席权限');
        return;
    }
    const dungeons = await fetchDungeons();
    const dungeonOptions = renderScoreDungeonOptions(dungeons);
    const { entries: titleEntries } = canGrantTitlesUI()
        ? await fetchLeaderboardEntries()
        : { entries: [] };
    if (canGrantTitlesUI()) await refreshHonorOperationLogs(false);
    const { settlements, error } = await fetchScoreSettlements(50);
    scoreSettlementState = { settlements, error };
    scoreSettlementDetails.clear();
    scoreSettlementExpanded.clear();
    container.innerHTML = `
        <section class="profile-hero" data-god="真理" data-motif="${escapeHtml(getGodSkin('真理').motif)}" style="${getGodSkinStyle('真理')}">
            <div class="profile-avatar path-exist" style="${getGodSkinStyle('真理')}">${renderGodSigil('真理', 'lg')}</div>
            <div class="profile-hero-copy">
                <div class="profile-kicker">SCORE SANCTUM</div>
                <h1 class="profile-name">分数结算神谕台</h1>
                <div class="profile-subline">
                    <span class="metric-pill">审核员 <strong>${escapeHtml(inviteSession?.name || '')}</strong></span>
                    <span class="metric-pill">登神 ${scoreDengMin}~${scoreDengMax} <strong>觐见 ${scoreJinMin}~${scoreJinMax}</strong></span>
                </div>
                <div class="profile-faith-prayer">洞窥本质，行迹真理。此页只对结算审核员与神谕馆主开放。</div>
            </div>
            <div class="profile-hero-stats">
                <div class="profile-hero-score"><span>两日加分记录</span><strong id="scoreRecentCount">${settlements?.length || 0}</strong></div>
                <div class="profile-hero-score"><span>权限席位</span><strong>${getInviteRole() === 'admin' ? '馆主' : '审核'}</strong></div>
            </div>
        </section>
        <div class="score-rule-grid">
            <div class="score-rule-card"><strong>批量结算</strong><span>适合副本结束后按名单一次性录入，先预览校验再提交。</span></div>
            <div class="score-rule-card"><strong>单人补分</strong><span>用于漏分、迟到记录或单人修正，仍会写入结算信封。</span></div>
            <div class="score-rule-card"><strong>撤销回滚</strong><span>近期结算可撤销，回滚后玩家会收到撤销通知。</span></div>
        </div>
        <div class="profile-grid">
            <div>
                <section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}">
                    <div class="profile-panel-title"><span>批量结算</span><small>格式：昵称+登神+觐见，可带编号</small></div>
                    <div class="form-group"><label>搜索副本</label><input id="scoreDungeonSearch" maxlength="80" placeholder="输入副本名过滤，或在结算文本第一行写副本名" oninput="filterScoreDungeonOptions('scoreDungeonSearch', 'scoreDungeonId')"><div class="identity-help" id="scoreDungeonSearchStatus">输入副本名可快速过滤</div></div>
                    <div class="form-group"><label>副本圣名</label><select id="scoreDungeonId">${dungeonOptions}</select></div>
                    <div class="form-group"><label>结算文本</label><textarea id="scoreBatchText" maxlength="20000" placeholder="修弥斯的钟，一人（棺材板）胜利，其余人失败&#10;1. 羔羊:+8+0&#10;2. 棺材板:+9+2"></textarea></div>
                    <div class="form-group"><label>备注</label><input id="scoreBatchRemark" maxlength="500" placeholder="可选，写结算来源或说明"></div>
                    <div class="profile-tools">
                        <button class="btn btn-outline btn-sm" onclick="checkScorePreviewUI()">预览校验</button>
                        <button class="btn btn-primary btn-sm" data-score-action="submit-score-batch" onclick="submitScoreBatchUI()">确认结算</button>
                    </div>
                    <div id="scorePreviewPanel" style="margin-top:14px;">${renderScorePreview(scorePreviewState)}</div>
                </section>
                <section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}">
                    <div class="profile-panel-title"><span>单人补分</span><small>漏分补发</small></div>
                    <div class="profile-form-grid">
                        <div class="form-group full"><label>搜索副本</label><input id="singleDungeonSearch" maxlength="80" placeholder="输入副本名过滤" oninput="filterScoreDungeonOptions('singleDungeonSearch', 'singleDungeonId')"><div class="identity-help" id="singleDungeonSearchStatus">输入副本名可快速过滤</div></div>
                        <div class="form-group full"><label>副本圣名</label><select id="singleDungeonId">${dungeonOptions}</select></div>
                        <div class="form-group"><label>玩家昵称</label><input id="singlePlayerName" maxlength="40"></div>
                        <div class="form-group"><label>登神之路</label><input id="singleDengScore" type="number" min="${scoreDengMin}" max="${scoreDengMax}" step="0.1" value="0"></div>
                        <div class="form-group"><label>觐见之梯</label><input id="singleJinScore" type="number" min="${scoreJinMin}" max="${scoreJinMax}" step="0.1" value="0"></div>
                        <div class="form-group full"><label>备注</label><input id="singleRemark" maxlength="500" placeholder="补发原因"></div>
                        <div class="form-group full"><label>通关结果（可不选）</label><div class="score-clear-choice"><label><input type="radio" name="singleClearStatus" value="passed"> 逢生</label><label><input type="radio" name="singleClearStatus" value="lost"> 迷失</label></div><div class="identity-help">作者、主持人等不计入通关数据时可留空。</div></div>
                    </div>
                    <div class="profile-tools"><button class="btn btn-primary btn-sm" data-score-action="submit-score-single" onclick="submitScoreSingleUI()">提交补分</button></div>
                </section>
            </div>
            <div>
                <section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}">
                    <div class="profile-panel-title"><span>加分记录</span><small>仅保留最近 48 小时</small></div>
                    <div class="form-group"><label for="scoreSettlementSearch">搜索副本</label><input id="scoreSettlementSearch" maxlength="80" placeholder="输入副本名，查看该副本给谁加了分" oninput="queueScoreSettlementSearch()"><div class="identity-help">输入后自动筛选；超过两天的记录不在此处显示。</div></div>
                    <div id="scoreSettlementsPanel">${renderScoreSettlements(settlements, error)}</div>
                </section>
                ${renderTitleAdminPanel(titleEntries)}
            </div>
        </div>`;
}

async function openScorePage() {
    if (!canSettleScores() && !isGodRole()) {
        openInviteModal('需要审核员谕令后才能进入分数结算。');
        return;
    }
    scoreScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const detailOverlay = document.getElementById('detailOverlay');
    if (detailOverlay) detailOverlay.style.display = 'none';
    const profilePage = document.getElementById('profilePage');
    if (profilePage) profilePage.style.display = 'none';
    const leaderboardPage = document.getElementById('leaderboardPage');
    if (leaderboardPage) leaderboardPage.style.display = 'none';
    const matchPage = document.getElementById('matchPage');
    if (matchPage) matchPage.style.display = 'none';
    const adminPage = document.getElementById('adminPage');
    if (adminPage) adminPage.style.display = 'none';
    document.body.classList.remove('detail-view-open', 'profile-view-open', 'leaderboard-view-open', 'match-view-open');
    document.body.classList.add('score-view-open');
    document.getElementById('scorePage').style.display = 'block';
    window.scrollTo(0, 0);
    await renderScorePage();
}

function closeScorePage(restoreScroll = true) {
    const page = document.getElementById('scorePage');
    if (page) page.style.display = 'none';
    document.body.classList.remove('score-view-open');
    if (restoreScroll !== false) requestAnimationFrame(() => window.scrollTo(0, scoreScrollY || 0));
}

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
    if (!isAdmin()) { container.innerHTML = renderRitualEmpty('此处只对神谕馆主开放。', '真理', '权限不足'); return; }
    const lookup = adminLookupState.snapshot ? `<div class="admin-snapshot">${renderAdminSnapshot(adminLookupState.snapshot)}</div>` : renderRitualEmpty('输入已绑定的玩家昵称，读取其后台档案、称号诅咒与天赋状态。', '真理', '等待查询');
    const globalOperations = `<section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}"><div class="profile-panel-title"><span>全站最近操作</span><small>最近 50 条</small></div>${renderAdminOperationRows(adminRecentOperations, adminOperationsUnavailable)}</section>`;
    container.innerHTML = `<section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}"><div class="profile-panel-title"><span>玩家查询</span><small>仅馆主可见</small></div><div class="profile-form-grid"><div class="form-group full"><label>玩家昵称</label><input id="adminTargetName" maxlength="40" value="${escapeHtml(adminLookupState.targetName || '')}" placeholder="输入已保存个人档案的昵称" onkeydown="if(event.key==='Enter') adminLookupPlayer()"></div></div><div class="profile-tools"><button class="btn btn-primary btn-sm" data-admin-lookup onclick="adminLookupPlayer()">查询档案</button></div></section>${globalOperations}${lookup}`;
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
    if (!isAdmin()) { showToast('只有神谕馆主可以进入后台'); return; }
    adminScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    ['profilePage', 'leaderboardPage', 'scorePage', 'matchPage'].forEach(id => { const page = document.getElementById(id); if (page) page.style.display = 'none'; });
    document.body.classList.remove('profile-view-open', 'leaderboard-view-open', 'score-view-open', 'match-view-open');
    document.body.classList.add('profile-view-open');
    document.getElementById('adminPage').style.display = 'block';
    window.scrollTo(0, 0);
    await refreshAdminOperationLogs();
    await renderAdminPage();
}

function closeAdminPage(restoreScroll = true) {
    const page = document.getElementById('adminPage');
    if (page) page.style.display = 'none';
    document.body.classList.remove('profile-view-open');
    if (restoreScroll !== false) requestAnimationFrame(() => window.scrollTo(0, adminScrollY || 0));
}

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
    if (!canInteract()) return { dungeons: [], error: { message: '需要入局谕令后才能查看试炼召集。' } };
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

function renderMatchDungeonCards(dungeons) {
    if (!dungeons.length) return '<div class="profile-empty">暂无可召集的试炼。</div>';
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
                    <button class="btn btn-outline btn-xs match-card-button" onclick='event.stopPropagation(); openMatchDungeon(${jsString(dungeon.id)})'>查看召集</button>
                </div>
                <div class="metric-strip">
                    <span class="metric-pill">队列 <strong>${queued}/${target}</strong></span>
                    <span class="metric-pill">房间 <strong>${rooms}</strong></span>
                    <span class="metric-pill">轮回 <strong>${escapeHtml(getTrialCycle(dungeon))}</strong></span>
                </div>
            </article>`;
    }).join('')}</div>`;
}

function renderMatchQueue(queue) {
    if (!queue.length) return '<div class="profile-empty">当前无人排队。成为第一个召集者吧。</div>';
    return `<div class="match-player-list">${queue.map((player, index) => `
        <div class="match-player-row ${isCurrentMatchPlayer(player.player_name) ? 'profile-notice' : ''}">
            <strong>${index + 1}. ${escapeHtml(player.player_name || '未命名信徒')}</strong>
            <span class="match-player-note">${escapeHtml(formatDate(player.created_at))}${isCurrentMatchPlayer(player.player_name) ? ' · 你' : ''}</span>
        </div>`).join('')}</div>`;
}

function renderMatchRooms(rooms) {
    if (!rooms.length) return '<div class="profile-empty">暂无已成房队伍；队列满员后会自动生成房间。</div>';
    return `<div class="match-room-list">${rooms.map((room, index) => {
        const players = room.match_room_players || room.players || [];
        return `
            <article class="match-room-card">
                <div class="match-room-head">
                    <strong>房间 ${index + 1} · ${escapeHtml(String(room.id || '').slice(0, 8))}</strong>
                    <span class="match-player-note">${players.length}/${Number(room.target_player_count || 0) || players.length} 人 · ${escapeHtml(formatDate(room.created_at))}</span>
                </div>
                <div class="match-player-list">
                    ${players.map(player => `
                        <div class="match-player-row ${isCurrentMatchPlayer(player.player_name) ? 'profile-notice' : ''}">
                            <strong>${escapeHtml(player.player_name || '未命名信徒')}</strong>
                            <span class="match-player-note">${player.finish_status ? '已完成' : '进行中'}${isCurrentMatchPlayer(player.player_name) ? ' · 你' : ''}</span>
                        </div>`).join('') || '<div class="profile-empty">房间成员读取中。</div>'}
                </div>
            </article>`;
    }).join('')}</div>`;
}

function renderMatchStatePanel(state, error) {
    if (error) return `<div class="profile-empty">${escapeHtml(error.message || '试炼召集暂不可用。')}</div>`;
    const dungeon = state?.dungeon || matchDungeonsCache.find(item => String(item.id) === String(selectedMatchDungeonId));
    if (!dungeon) return '<div class="profile-empty">从左侧选择一个试炼，查看当前召集状态。</div>';
    const queue = Array.isArray(state?.queue) ? state.queue : [];
    const rooms = Array.isArray(state?.rooms) ? state.rooms : [];
    const target = getMatchTargetCount(dungeon);
    const queuedCount = Number(state?.queuedCount ?? queue.length ?? 0);
    const currentQueued = queue.some(player => isCurrentMatchPlayer(player.player_name));
    const currentInRoom = rooms.some(room => (room.match_room_players || room.players || []).some(player => isCurrentMatchPlayer(player.player_name)));
    const godClass = getGodClass(dungeon.type);
    return `
        <section class="profile-panel">
            <div class="profile-panel-title">
                <span>${renderGodSigil(dungeon.type, 'sm')} ${escapeHtml(dungeon.name || '未命名试炼')}</span>
                <small>${escapeHtml(formatGodName(dungeon.type))} · ${escapeHtml(formatDifficulty(dungeon.difficulty))}</small>
            </div>
            <div class="leaderboard-summary">召集按副本固定人数自动成房；已成房成员会留在房间记录里，方便后续网页或小程序继续接入。</div>
            <div class="match-state-grid">
                <div class="match-state-tile"><span>排队人数</span><strong>${queuedCount}/${target}</strong></div>
                <div class="match-state-tile"><span>运行房间</span><strong>${rooms.length}</strong></div>
                <div class="match-state-tile"><span>我的状态</span><strong>${currentInRoom ? '已成房' : currentQueued ? '排队中' : '未加入'}</strong></div>
            </div>
            <div class="match-inline-actions">
                ${currentInRoom ? '<span class="metric-pill">你已在运行房间中</span>' : `<button class="btn btn-primary btn-sm" onclick='joinMatchQueueUI(${jsString(dungeon.id)})'>${currentQueued ? '更新排队' : '加入排队'}</button>`}
                ${currentQueued ? `<button class="btn btn-outline btn-sm" onclick='cancelMatchQueueUI(${jsString(dungeon.id)})'>取消排队</button>` : ''}
                <button class="btn btn-outline btn-sm" onclick='refreshMatchStateUI(${jsString(dungeon.id)})'>刷新状态</button>
                <button class="btn btn-outline btn-sm" onclick='openDetailFromMatch(${jsString(dungeon.id)})'>查看详情</button>
            </div>
        </section>
        <div class="profile-grid" style="margin-top:18px;">
            <section class="profile-panel">
                <div class="profile-panel-title"><span>当前队列</span><small>${queuedCount}/${target}</small></div>
                ${renderMatchQueue(queue)}
            </section>
            <section class="profile-panel">
                <div class="profile-panel-title"><span>运行房间</span><small>${rooms.length} 间</small></div>
                ${renderMatchRooms(rooms)}
            </section>
        </div>
        <div class="trial-oracle ${godClass}" style="${getGodSkinStyle(dungeon.type)};margin-top:18px;">${escapeHtml(getGodOracle(dungeon.type))}</div>`;
}

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

function isSameProfileName(value) {
    const currentName = String(inviteSession?.name || '').trim().toLowerCase();
    return currentName && String(value || '').trim().toLowerCase() === currentName;
}

function getAuthoredDungeons(dungeons) {
    if (!inviteSession) return [];
    return (dungeons || []).filter(d => isSameProfileName(d.invite_name) || isSameProfileName(d.creator) || isCoCreatorName(d));
}

async function fetchMyAuthoredDungeons(dungeons = null) {
    if (!inviteSession) return [];
    if (USE_LOCAL_FALLBACK) return getAuthoredDungeons(dungeons || await fetchDungeons());
    const { data, error } = await invokeDungeonAction('listMyDungeons', { limit: 100 });
    if (error) return getAuthoredDungeons(dungeons || []);
    return Array.isArray(data) ? data : [];
}

function buildLocalClearRecords(dungeons) {
    const dungeonMap = new Map((dungeons || []).map(d => [String(d.id), d]));
    const records = new Map();
    const code = inviteSession?.code || 'guest';
    Object.entries(getLocalData('cleared_supabase', {})).forEach(([key, value]) => {
        if (!value) return;
        const [dungeonId, runNumber, scopedCode] = key.split(':');
        if (scopedCode && scopedCode !== code) return;
        const dungeon = dungeonMap.get(String(dungeonId));
        records.set(`${dungeonId}:${runNumber || getRunCount(dungeon || {})}`, {
            id: key,
            dungeon_id: dungeonId,
            run_number: Number(runNumber || getRunCount(dungeon || {})),
            feedback_tags: [],
            feedback_note: '',
            created_at: '',
            dungeon
        });
    });
    Object.entries(getLocalData('cleared', {})).forEach(([key, value]) => {
        if (!value) return;
        const [dungeonId, runNumber] = key.split(':');
        const dungeon = dungeonMap.get(String(dungeonId));
        const recordKey = `${dungeonId}:${runNumber || getRunCount(dungeon || {})}`;
        if (records.has(recordKey)) return;
        records.set(recordKey, {
            id: key,
            dungeon_id: dungeonId,
            run_number: Number(runNumber || getRunCount(dungeon || {})),
            feedback_tags: [],
            feedback_note: '',
            created_at: '',
            dungeon
        });
    });
    return [...records.values()];
}

async function fetchMyClearRecords(dungeons) {
    const localRecords = buildLocalClearRecords(dungeons);
    if (USE_LOCAL_FALLBACK || !supabaseClient || !inviteSession?.code || !globalThis.crypto?.subtle) return localRecords;
    return getShortCachedRead('my-clear-records', async () => {
        try {
            const codeHash = await sha256Hex(inviteSession.code);
            const { data, error } = await supabaseClient
                .from('clear_records')
                .select('id,dungeon_id,run_number,invite_name,feedback_tags,feedback_note,created_at')
                .eq('invite_code_hash', codeHash)
                .order('created_at', { ascending: false });
            if (error) return localRecords;
            const dungeonMap = new Map((dungeons || []).map(d => [String(d.id), d]));
            return (data || []).map(record => ({
                ...record,
                dungeon: dungeonMap.get(String(record.dungeon_id)) || null
            }));
        } catch {
            return localRecords;
        }
    });
}

async function getAuthorCommentNotices(dungeons = null) {
    if (!inviteSession) return { notices: [], unread: [] };
    const sourceDungeons = dungeons || await fetchDungeons();
    const authored = await fetchMyAuthoredDungeons(sourceDungeons);
    if (!authored.length) return { notices: [], unread: [] };
    const seenAt = getProfileNoticeSeenTime();
    const seenTime = seenAt ? new Date(seenAt).getTime() : 0;
    const notices = [];
    for (const dungeon of authored) {
        const comments = await fetchComments(dungeon.id);
        comments
            .filter(comment => !comment.is_deleted && !isSameProfileName(comment.invite_name) && !isSameProfileName(comment.author))
            .forEach(comment => {
                const createdTime = comment.created_at ? new Date(comment.created_at).getTime() : 0;
                notices.push({
                    ...comment,
                    dungeon,
                    unread: createdTime > seenTime
                });
            });
    }
    notices.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return { notices, unread: notices.filter(item => item.unread) };
}

async function updateProfileNoticeBadge() {
    const roleBadge = document.getElementById('roleBadge');
    if (!roleBadge || !inviteSession) return;
    try {
        const keyAtStart = getProfileKey();
        const { unread } = await getAuthorCommentNotices();
        if (keyAtStart !== getProfileKey()) return;
        const count = unread.length;
        roleBadge.classList.toggle('has-notice', count > 0);
        if (count > 0) roleBadge.dataset.notice = count > 99 ? '99+' : String(count);
        else roleBadge.removeAttribute('data-notice');
    } catch (error) {
        console.warn('个人提醒读取失败:', error);
    }
}

function renderProfileClearRecords(records, faithGod = '命运') {
    if (!records.length) return renderRitualEmpty(`${getGodOracle(faithGod)} 尚未登记通关；踏入任意试炼后，这里会形成你的履迹录。`, faithGod, '试炼履迹暂空');
    return records.slice(0, 18).map(record => {
        const d = record.dungeon || {};
        const title = d.name || '未知试炼';
        const god = d.type ? `${formatGodName(d.type)} · ${formatGodPath(d.type)}命途` : '未归档神明';
        const note = record.feedback_note ? `反馈：${record.feedback_note}` : '本设备或神谕记录已登记通过。';
        const tags = Array.isArray(record.feedback_tags) && record.feedback_tags.length ? ` · ${record.feedback_tags.join(' / ')}` : '';
        return `
            <article class="profile-list-item clickable" onclick='openDetailFromProfile(${jsString(record.dungeon_id)})'>
                <div class="profile-list-title">
                    <span>《${escapeHtml(title)}》</span>
                    <small>${escapeHtml(formatDate(record.created_at))}</small>
                </div>
                <div class="profile-list-meta">试炼轮回：第 ${Number(record.run_number || 1)} 周目 · ${escapeHtml(god)}</div>
                <div class="profile-list-meta">${escapeHtml(note)}${escapeHtml(tags)}</div>
            </article>`;
    }).join('');
}

function renderProfileAuthoredDungeons(authored, faithGod = '命运') {
    if (!authored.length) return renderRitualEmpty(`${getGodOracle(faithGod)} 尚未构筑试炼切片；构筑完成后会进入筑戏人记录。`, faithGod, '构筑记录暂空');
    return authored.slice(0, 18).map(d => `
        <article class="profile-list-item clickable" onclick='openDetailFromProfile(${jsString(d.id)})'>
            <div class="profile-list-title">
                <span>《${escapeHtml(d.name || '未命名试炼')}》</span>
                <small>神格 ${Number(d.avg_rating || 0).toFixed(1)}</small>
            </div>
            <div class="profile-list-meta">${escapeHtml(formatGodName(d.type))} · ${escapeHtml(formatGodPath(d.type))}命途 · ${escapeHtml(formatDifficulty(d.difficulty))}</div>
            <div class="profile-list-meta">证言 ${Number(d.comment_count || 0)} · 通关留存率 ${formatClearRate(d)} · ${formatDate(d.created_at)}</div>
        </article>`).join('');
}

function renderProfileFaithObservatory(clearRecords, authored, faithGod, profile) {
    const clearedCounts = countDungeonsByPath(clearRecords, record => record.dungeon?.type);
    const authoredCounts = countDungeonsByPath(authored, dungeon => dungeon.type);
    const combinedCounts = Object.fromEntries(GOD_GROUPS.map(group => [
        group.path,
        Number(clearedCounts[group.path] || 0) + Number(authoredCounts[group.path] || 0)
    ]));
    const total = Object.values(combinedCounts).reduce((sum, value) => sum + Number(value || 0), 0);
    const faithPath = getGodInfo(faithGod).path;
    const faithCount = Number(combinedCounts[faithPath] || 0);
    const topPath = ERA_TIMELINE
        .map(era => ({ path: era.path, count: Number(combinedCounts[era.path] || 0) }))
        .sort((a, b) => b.count - a.count)[0];
    return `
        <section class="profile-panel" data-god="${escapeHtml(getGodInfo(faithGod).god)}" style="${getGodSkinStyle(faithGod)}">
            <div class="profile-panel-title">
                <span>信仰观测录</span>
                <small>游玩 / 构筑命途分布</small>
            </div>
            <div class="profile-observatory">
                <div class="profile-observatory-grid">
                    <div class="profile-observatory-card"><span>本命命途记录</span><strong>${faithCount}</strong></div>
                    <div class="profile-observatory-card"><span>最常接触命途</span><strong>${escapeHtml(topPath?.count ? topPath.path : '未定')}</strong></div>
                    <div class="profile-observatory-card"><span>观测切片总数</span><strong>${total}</strong></div>
                </div>
                ${renderFaithFlowBars(combinedCounts, total, { note: `寰宇信仰流向，见证你踏入或构筑的每一场愚戏。` })}
                <div class="profile-list-meta">${escapeHtml(getGodOracle(faithGod))}</div>
            </div>
        </section>`;
}

function renderProfileNotices(notices, faithGod = '命运') {
    if (!notices.length) return renderRitualEmpty(getGodEmptyText(faithGod, 'notices'), faithGod, '楼主提醒暂空');
    return notices.slice(0, 12).map(notice => {
        const d = notice.dungeon || {};
        return `
            <article class="profile-list-item profile-notice ${notice.unread ? 'unread' : ''} clickable" onclick='openDetailFromProfile(${jsString(notice.dungeon_id)})'>
                <div class="profile-list-title">
                    <span>${notice.unread ? '<span class="profile-notice-mark">未读</span> ' : ''}${escapeHtml(notice.author || notice.invite_name || '匿名信徒')}</span>
                    <small>${escapeHtml(formatDate(notice.created_at))}</small>
                </div>
                <div class="profile-list-meta">在《${escapeHtml(d.name || '未知试炼')}》下留下证言</div>
                <div class="profile-list-meta">${escapeHtml(truncateText(notice.content, 120))}</div>
            </article>`;
    }).join('');
}

async function renderProfilePage() {
    const container = document.getElementById('profileContent');
    if (!container) return;
    if (!inviteSession) {
        container.innerHTML = renderRitualEmpty('请先通过同契召引入局，再查看个人档案。', '命运', '个人档案尚未开启');
        return;
    }
    const inviteSnapshot = getInviteSnapshot();
    container.innerHTML = '<div class="loading"><div class="spinner"></div><br>正在读取个人档案...</div>';
    let profile = getCurrentProfile();
    const { state: talentState, error: talentError } = await fetchTalentState();
    if (!isInviteSnapshotCurrent(inviteSnapshot)) return;
    if (!talentError) profile = getCurrentProfile();
    setCurrentTalentState(talentState, talentError);
    const dungeons = await fetchDungeons();
    if (!isInviteSnapshotCurrent(inviteSnapshot)) return;
    const clearRecords = await fetchMyClearRecords(dungeons);
    const authored = await fetchMyAuthoredDungeons(dungeons);
    const { notices, unread } = await getAuthorCommentNotices(authored);
    const {
        messages: scoreMessages,
        unread: unreadScoreMessages,
        error: scoreMessageError
    } = await fetchMyScoreMessages(8);
    if (!isInviteSnapshotCurrent(inviteSnapshot)) return;
    const uniqueCleared = new Set(clearRecords.map(record => String(record.dungeon_id))).size;
    const totalAuthoredComments = authored.reduce((sum, d) => sum + Number(d.comment_count || 0), 0);
    const avgAuthorRating = authored.length
        ? authored.reduce((sum, d) => sum + Number(d.avg_rating || 0), 0) / authored.length
        : 0;
    const faith = getProfileDisplayFaith(profile);
    const faithGod = faith.god || '记忆';
    const faithClass = faith.className;
    const faithSkin = getGodSkin(faithGod);
    const faithStyle = getGodSkinStyle(faithGod);
    const faithLocked = isFaithLocked(profile);
    const professionLocked = isProfessionLocked(profile);
    const bindingMismatched = isProfileBindingMismatched(profile);
    const scoresLocked = areProfileScoresLocked(profile);
    const visualProfession = getProfileVisualProfession(profile);
    const profession = getProfessionInfo(visualProfession);
    const roleLabel = ROLE_LABELS[getInviteRole()] || '入局信徒';
    const faithProgress = Math.min(100, Math.max(6, Math.round(uniqueCleared * 12 + authored.length * 8 + Number(profile.audienceScore || 0))));
    const faithRank = getProfileFaithRank(faithGod, faithProgress);
    const authorPanel = (authored.length || canSubmit()) ? `
        <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${faithStyle}">
            <div class="profile-panel-title">
                <span>🎭 构筑者记录</span>
                <small>作者身份额外记录</small>
            </div>
            <div class="profile-score-row">
                <div class="profile-stat-card"><span>构筑试炼数</span><strong>${authored.length}</strong></div>
                <div class="profile-stat-card"><span>平均神格判定</span><strong>${authored.length ? avgAuthorRating.toFixed(1) : '—'}</strong></div>
            </div>
            <div class="metric-strip">
                <span class="metric-pill">证言总数 <strong>${totalAuthoredComments}</strong></span>
                <span class="metric-pill">楼主提醒 <strong>${unread.length}</strong></span>
            </div>
            <div class="profile-tools">
                <button class="btn btn-outline btn-sm" onclick="markProfileNoticesRead()">封缄楼主谕响</button>
            </div>
            <div class="profile-list" style="margin-top:14px;">${renderProfileAuthoredDungeons(authored, faithGod)}</div>
        </section>
        <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${faithStyle}">
            <div class="profile-panel-title">
                <span>📣 楼主提醒</span>
                <small>${unread.length ? `${unread.length} 条未读` : '暂无未读'}</small>
            </div>
            <div class="profile-list">${renderProfileNotices(notices, faithGod)}</div>
        </section>` : '';
    const page = document.getElementById('profilePage');
    if (page) {
        page.setAttribute('data-god', faithGod);
        page.setAttribute('data-path', faith.path || '');
        page.style.cssText = `display:block;${faithStyle}`;
    }
    container.innerHTML = `
        ${renderProfileAtmosphere(faithGod)}
        <section class="profile-hero" data-god="${escapeHtml(faithGod)}" data-motif="${escapeHtml(faithSkin.motif)}" style="${faithStyle}">
            <div class="profile-avatar ${faithClass}" style="${faithStyle}">${renderGodSigil(faithGod, 'lg')}</div>
            <div class="profile-hero-copy">
                <div class="profile-kicker">PERSONAL PILGRIM ARCHIVE</div>
                ${renderProfileNameWithTitle(inviteSession.name || roleLabel, profile.activeTitle, { fallbackGod: faithGod, titles: profile.activeTitles, showTitles: profile.showTitles })}
                <div class="profile-subline">
                    <span class="mini-tag ${faithClass}">${escapeHtml(faith.label)}</span>
                    <span class="mini-tag ${faithClass}">${escapeHtml(faith.path)}命途</span>
                    <span class="mini-tag ${faithClass}">${escapeHtml(roleLabel)}</span>
                    <span class="metric-pill">职业 <strong>${escapeHtml(visualProfession || '未填写')}</strong></span>
                    ${profession.known ? `<span class="metric-pill">${escapeHtml(profession.god)}之神 <strong>${escapeHtml(profession.className)}</strong></span>` : ''}
                    <span class="metric-pill" id="profileScoreMessagePill" style="${unreadScoreMessages.length ? '' : 'display:none;'}">结算信封 <strong>${unreadScoreMessages.length}</strong></span>
                    ${unread.length ? `<span class="metric-pill">楼主提醒 <strong>${unread.length}</strong></span>` : ''}
                </div>
                <div class="profile-faith-prayer">${escapeHtml(getGodPrayer(faithGod))} · ${escapeHtml(faithSkin.pattern)}</div>
                <div class="profile-faith-rank">当前信仰阶位 <strong>${escapeHtml(faithRank.title)}</strong></div>
            </div>
            <div class="profile-hero-stats">
                <div class="profile-hero-score"><span>登神之路</span><strong>${Number(profile.ascensionScore || 0)}</strong></div>
                <div class="profile-hero-score"><span>觐见之梯</span><strong>${Number(profile.audienceScore || 0)}</strong></div>
            </div>
            <div class="faith-progress-card">
                <div class="faith-progress-label"><span>信仰进度</span><strong>${escapeHtml(faithSkin.motif)} · ${faithProgress}%</strong></div>
                <div class="faith-progress-track"><div class="faith-progress-fill" style="--faith-progress:${faithProgress}%"></div></div>
            </div>
        </section>
        ${renderMobileProfileTabs()}
        <div class="profile-grid mobile-profile-layout">
            <div class="profile-mobile-section ${mobileProfileTab === 'base' ? 'active' : ''}" data-mobile-profile-section="base">
                <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${faithStyle}">
                    <div class="profile-panel-title">
                        <span>基础信仰设定</span>
                        <small>昵称会绑定到当前邀请码</small>
                    </div>
                    <div class="profile-form-grid">
                        <div class="form-group">
                            <label for="profileDisplayName">个人昵称</label>
                            <input id="profileDisplayName" maxlength="16" value="${escapeHtml(isInitialDisplayNameBinding() ? '' : (inviteSession.name || ''))}" placeholder="例如：无我" ${canEditDisplayName() ? '' : 'disabled'} title="${isInitialDisplayNameBinding() ? '首次绑定昵称，保存后不可自行更改' : (isAdminDisplayNameEdit() ? '馆主可更改身份昵称' : '昵称为身份绑定字段，只有馆主可以更改')}">
                            <div class="identity-help">${isInitialDisplayNameBinding() ? '这是首次绑定昵称，封存后会固定到当前谕令，之后不可自行更改。' : (isAdminDisplayNameEdit() ? '馆主可在这里校正自己的身份昵称。' : '昵称由入局谕令绑定；玩家、作者、审核员和神明不可自行更改。')}</div>
                        </div>
                        <div class="form-group">
                            <label for="profileFaithGod">信仰神明</label>
                            <select id="profileFaithGod" onchange="previewProfileFaithSkin(this.value)" ${faithLocked ? 'disabled' : ''}>${renderProfileGodOptions(getProfileVisualFaithGod(profile))}</select>
                            <div class="identity-help">${faithLocked ? `信仰已封存为 ${escapeHtml(faith.label)}，不可再改。` : (bindingMismatched ? '当前信仰与职业不匹配，请重新选择信仰与对应职业完成修复。' : (hasTrickeryFaithPrivilege(profile) ? '欺诈信徒可改写信仰档纹。' : '首次封存后信仰将刻入档案；欺诈信徒除外。'))}</div>
                        </div>
                        <div class="form-group full">
                            <label for="profileProfession">个人职业</label>
                        <select id="profileProfession" onchange="updateProfileBattlePanel()" ${professionLocked ? 'disabled' : ''}>${renderProfileProfessionOptions(visualProfession, getProfileVisualFaithGod(profile))}</select>
                            <div class="identity-help">${professionLocked ? `职业已封存为 ${escapeHtml(profile.profession)}，不可再改。` : (bindingMismatched ? '职业只能从当前信仰神明下选择，修复后会重新封存。' : (hasTrickeryFaithPrivilege(profile) ? '欺诈信徒可改写职业档纹。' : '请先选择信仰，再选择该信仰下的职业；首次封存后会刻入档案，欺诈信徒除外。'))}</div>
                        </div>
                        <div class="form-group">
                            <label for="profileAscensionScore">登神之路分数</label>
                            <input id="profileAscensionScore" type="number" min="0" step="0.1" value="${Number(profile.ascensionScore ?? DEFAULT_ASCENSION_SCORE)}" oninput="updateProfileBattlePanel()" ${scoresLocked ? 'disabled' : ''}>
                        </div>
                        <div class="form-group">
                            <label for="profileAudienceScore">觐见之梯分数</label>
                            <input id="profileAudienceScore" type="number" min="0" step="0.1" value="${Number(profile.audienceScore ?? DEFAULT_AUDIENCE_SCORE)}" ${scoresLocked ? 'disabled' : ''}>
                            <div class="identity-help">${scoresLocked ? `初始登神 ${DEFAULT_ASCENSION_SCORE}、觐见 ${DEFAULT_AUDIENCE_SCORE}；后续由结算信封改写，不可自行篡改。` : '馆主测试权限：可临时校准分数，用于二测验证。'}</div>
                        </div>
                        <div class="form-group full">
                            <label>当前称号</label>
                            ${renderProfileTitleStatus(profile.activeTitle, profile.activeCurse, faithGod, profile.activeTitles, profile.activeCurses, profile.showTitles)}
                            <label class="identity-help" for="profileTitleVisibilityToggle">
                                <input id="profileTitleVisibilityToggle" type="checkbox" ${profile.showTitles !== false ? 'checked' : ''} onchange="setProfileTitleVisibility(this.checked)">
                                佩戴称号
                            </label>
                        </div>
                        <div class="form-group full">
                            <label for="profileItems">个人道具</label>
                            <textarea id="profileItems" maxlength="800" placeholder="每行一个道具">${escapeHtml(profile.items)}</textarea>
                        </div>
                        <div class="form-group full">
                            <label>个人天赋</label>
                            <div class="identity-help">个人天赋由天赋仓库接管；信仰槽、职业槽与任意槽独立校验池子和品阶组合。</div>
                            <div id="profileTalentEquipPanel">${renderEquippedTalentSlots(talentState, faithGod)}</div>
                        </div>
                    </div>
                    <div class="profile-tools">
                        <button class="btn btn-outline btn-sm" onclick="openLeaderboardPage()">踏入登神观星台</button>
                        <button class="btn btn-outline btn-sm" onclick="exportProfileCardImage()">进献神恩</button>
                        <button class="btn btn-primary btn-sm" data-profile-save-button onclick="saveProfilePage()">封存信徒档案</button>
                    </div>
                </section>
                <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${faithStyle}">
                    <div class="profile-panel-title">
                        <span>个人数值</span>
                        <small id="profileScoreSyncLabel">${unreadScoreMessages.length ? `${unreadScoreMessages.length} 封未读` : '结算同步'}</small>
                    </div>
                    <div class="profile-score-row">
                        <div class="profile-score-card"><span>登神之路</span><strong>${Number(profile.ascensionScore || 0)}</strong></div>
                        <div class="profile-score-card"><span>觐见之梯</span><strong>${Number(profile.audienceScore || 0)}</strong></div>
                    </div>
                    <div class="metric-strip">
                        <span class="metric-pill">通关副本数 <strong>${uniqueCleared}</strong></span>
                        <span class="metric-pill">通关记录 <strong>${clearRecords.length}</strong></span>
                        <span class="metric-pill">当前身份 <strong>${escapeHtml(roleLabel)}</strong></span>
                    </div>
                </section>
                ${renderProfileBattlePanel(profile)}
                <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${faithStyle}">
                    <div class="profile-panel-title"><span>个人道具</span></div>
                    ${renderProfileChips(profile.items, getGodEmptyText(faithGod, 'items', '还没有填写个人道具。'), faithGod)}
                </section>
            </div>
            <div class="profile-mobile-section ${mobileProfileTab === 'trials' ? 'active' : ''}" data-mobile-profile-section="trials">
                <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${faithStyle}">
                    <div class="profile-panel-title">
                        <span>试炼履迹录</span>
                        <small>${uniqueCleared} 个副本 / ${clearRecords.length} 条记录</small>
                    </div>
                    <div class="profile-list">${renderProfileClearRecords(clearRecords, faithGod)}</div>
                </section>
                ${renderProfileFaithObservatory(clearRecords, authored, faithGod, profile)}
                ${authorPanel}
            </div>
            <div class="profile-mobile-section ${mobileProfileTab === 'messages' ? 'active' : ''}" data-mobile-profile-section="messages">
                <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${faithStyle}">
                    <div class="profile-panel-title">
                        <span>结算信封</span>
                        <small id="scoreMessagesPanelCount">${unreadScoreMessages.length ? `${unreadScoreMessages.length} 封未读` : '暂无未读'}</small>
                    </div>
                    ${renderScoreMessages(scoreMessages, scoreMessageError, faithGod)}
                </section>
                <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${faithStyle}">
                    <div class="profile-panel-title">
                        <span>📣 楼主提醒</span>
                        <small>${unread.length ? `${unread.length} 条未读` : '暂无未读'}</small>
                    </div>
                    <div class="profile-tools">
                        <button class="btn btn-outline btn-sm" onclick="markProfileNoticesRead()">封缄楼主谕响</button>
                    </div>
                    <div class="profile-list" style="margin-top:14px;">${renderProfileNotices(notices, faithGod)}</div>
                </section>
            </div>
            <div class="profile-mobile-section ${mobileProfileTab === 'talent' ? 'active' : ''}" data-mobile-profile-section="talent">
                ${renderTalentPoolPanel(talentState, talentError, profile)}
            </div>
            <div class="profile-mobile-section ${mobileProfileTab === 'titles' ? 'active' : ''}" data-mobile-profile-section="titles">
                <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${faithStyle}">
                    <div class="profile-panel-title">
                        <span>当前称号</span>
                        <small>称号 / 诅咒状态</small>
                    </div>
                    ${renderProfileTitleStatus(profile.activeTitle, profile.activeCurse, faithGod, profile.activeTitles, profile.activeCurses, profile.showTitles)}
                </section>
            </div>
        </div>
        ${renderProfileChronicle(faithGod, profileChronicleIndex)}`;
    startProfileChronicleRotation(faithGod);
    setMobileProfileTab(mobileProfileTab, { scroll: false });
}

async function openProfilePage(initialTab = mobileProfileTab || 'base') {
    if (!inviteSession) {
        openInviteModal('先验入局谕令后可查看个人档案。');
        return;
    }
    mobileProfileTab = ['base', 'talent', 'trials', 'titles', 'messages'].includes(initialTab) ? initialTab : 'base';
    profileScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const detailOverlay = document.getElementById('detailOverlay');
    if (detailOverlay) detailOverlay.style.display = 'none';
    const leaderboardPage = document.getElementById('leaderboardPage');
    if (leaderboardPage) leaderboardPage.style.display = 'none';
    const scorePage = document.getElementById('scorePage');
    if (scorePage) scorePage.style.display = 'none';
    const matchPage = document.getElementById('matchPage');
    if (matchPage) matchPage.style.display = 'none';
    const adminPage = document.getElementById('adminPage');
    if (adminPage) adminPage.style.display = 'none';
    document.body.classList.remove('detail-view-open', 'leaderboard-view-open', 'score-view-open', 'match-view-open');
    document.body.classList.add('profile-view-open');
    document.getElementById('profilePage').style.display = 'block';
    window.scrollTo(0, 0);
    await renderProfilePage();
    setMobileProfileTab(mobileProfileTab, { scroll: false });
}

function closeProfilePage(restoreScroll = true) {
    stopProfileChronicleRotation();
    const page = document.getElementById('profilePage');
    if (page) page.style.display = 'none';
    document.body.classList.remove('profile-view-open');
    setMobileNavActive('dungeons');
    if (restoreScroll !== false) requestAnimationFrame(() => window.scrollTo(0, profileScrollY || 0));
}

async function openDetailFromProfile(id) {
    closeProfilePage(false);
    await openDetail(id);
}

async function saveProfilePage() {
    if (!inviteSession?.code) {
        openInviteModal('先验入局谕令后可保存个人档案。');
        return;
    }
    if (!acquireUiActionLock('saveProfilePage', '个人档案正在保存，请勿重复点击')) return;
    const restoreSaveButtons = setActionButtonsBusy('[data-profile-save-button]', '保存中...');
    showToast('个人档案保存中，请勿重复点击');
    try {
        const name = canEditDisplayName()
            ? cleanDisplayNameInput(document.getElementById('profileDisplayName')?.value)
            : cleanDisplayNameInput(inviteSession.name || ROLE_LABELS[getInviteRole()] || '');
        if (!name) { showToast('请输入个人昵称'); return; }
        const currentProfile = getCurrentProfile();
        const lockedFaithGod = isFaithLocked(currentProfile) ? getProfileFaithGod(currentProfile) : '';
        const originalFaithGod = getProfileFaithGod(currentProfile);
        const selectedFaithGod = lockedFaithGod || cleanGodName(document.getElementById('profileFaithGod')?.value);
        if (!selectedFaithGod || !getGodInfo(selectedFaithGod).known) {
            showToast('请选择你的信仰神明');
            return;
        }
        const selectedFaithInfo = getGodInfo(selectedFaithGod);
        const lockedProfession = isProfessionLocked(currentProfile) ? currentProfile.profession : '';
        const selectedProfession = lockedProfession || normalizeProfession(document.getElementById('profileProfession')?.value);
        if (!selectedProfession) {
            showToast('请选择游戏里的 96 职业之一');
            return;
        }
        const selectedProfessionInfo = getProfessionInfo(selectedProfession);
        if (!selectedProfessionInfo.known || selectedProfessionInfo.god !== selectedFaithInfo.god) {
            showToast('职业必须选择当前信仰神明下的职业');
            return;
        }
        const scoresLocked = areProfileScoresLocked(currentProfile);
        const ascensionScore = scoresLocked
            ? (currentProfile.ascensionScore ?? DEFAULT_ASCENSION_SCORE)
            : normalizeProfileScore(document.getElementById('profileAscensionScore')?.value, DEFAULT_ASCENSION_SCORE);
        const audienceScore = scoresLocked
            ? (currentProfile.audienceScore ?? DEFAULT_AUDIENCE_SCORE)
            : normalizeProfileScore(document.getElementById('profileAudienceScore')?.value, DEFAULT_AUDIENCE_SCORE);
        const nextScoresLockedAt = canEditProfileScores()
            ? (currentProfile.scoresLockedAt || '')
            : (currentProfile.scoresLockedAt || new Date().toISOString());
        const profile = {
            displayName: name,
            role: getInviteRole() || '',
            faithGod: selectedFaithInfo.god,
            faithPath: selectedFaithInfo.path,
            originalFaithGod: currentProfile.originalFaithGod || selectedFaithInfo.god,
            originalFaithPath: currentProfile.originalFaithPath || selectedFaithInfo.path,
            profession: selectedProfession,
            ascensionScore,
            audienceScore,
            scoresLockedAt: nextScoresLockedAt,
            items: String(document.getElementById('profileItems')?.value || '').trim().slice(0, 800),
            talents: String(currentProfile.talents || '').trim().slice(0, 800),
            showTitles: currentProfile.showTitles !== false,
            activeTitle: currentProfile.activeTitle || null,
            activeTitles: normalizeProfileTitleList(currentProfile.activeTitles, currentProfile.activeTitle),
            activeCurse: currentProfile.activeCurse || null,
            activeCurses: normalizeProfileCurseList(currentProfile.activeCurses, currentProfile.activeCurse)
        };
        const isTrickerySave = hasTrickeryFaithPrivilege(currentProfile);
        const realFaithGod = isTrickerySave ? '欺诈' : (currentProfile.originalFaithGod || getProfileFaithGod(currentProfile) || '欺诈');
        const realFaithInfo = getGodInfo(realFaithGod);
        const realProfession = getProfessionInfo(currentProfile.profession).god === '欺诈'
            ? currentProfile.profession
            : '杂技演员';
        const cloudProfile = isTrickerySave ? {
            ...profile,
            faithGod: realFaithInfo.known ? realFaithInfo.god : '欺诈',
            faithPath: realFaithInfo.known ? realFaithInfo.path : '虚无',
            originalFaithGod: '欺诈',
            originalFaithPath: '虚无',
            profession: realProfession
        } : profile;
        const trickeryDisplayPatch = isTrickerySave ? {
            trickeryDisplayFaithGod: selectedFaithInfo.god,
            trickeryDisplayFaithPath: selectedFaithInfo.path,
            trickeryDisplayProfession: selectedProfession
        } : {};
        if (canEditDisplayName() && name !== inviteSession.name) {
            const { error } = await updateDisplayName(name);
            if (error) { showToast(`❌ ${getFriendlyActionError(error, '昵称保存失败')}`); return; }
        }
        const localProfile = isTrickerySave ? {
            ...currentProfile,
            displayName: name,
            role: getInviteRole() || '',
            ascensionScore,
            audienceScore,
            scoresLockedAt: nextScoresLockedAt,
            items: profile.items,
            talents: profile.talents,
            activeTitle: profile.activeTitle,
            activeTitles: profile.activeTitles,
            activeCurse: profile.activeCurse,
            activeCurses: profile.activeCurses,
            ...trickeryDisplayPatch
        } : profile;
        saveCurrentProfile(localProfile);
        const cloudSync = await syncProfileToCloud(cloudProfile);
        if (!cloudSync.error && isTrickerySave) {
            saveCurrentProfile({
                ...(cloudSync.data || localProfile),
                ...trickeryDisplayPatch,
                activeTitle: currentProfile.activeTitle || cloudSync.data?.activeTitle || null,
                activeTitles: normalizeProfileTitleList(currentProfile.activeTitles, currentProfile.activeTitle || cloudSync.data?.activeTitle),
                activeCurse: currentProfile.activeCurse || cloudSync.data?.activeCurse || null,
                activeCurses: normalizeProfileCurseList(currentProfile.activeCurses, currentProfile.activeCurse || cloudSync.data?.activeCurse),
                originalFaithGod: cloudSync.data?.originalFaithGod || currentProfile.originalFaithGod || cloudProfile.originalFaithGod,
                originalFaithPath: cloudSync.data?.originalFaithPath || currentProfile.originalFaithPath || cloudProfile.originalFaithPath,
                ascensionScore: cloudSync.data?.ascensionScore ?? profile.ascensionScore,
                audienceScore: cloudSync.data?.audienceScore ?? profile.audienceScore,
                scoresLockedAt: cloudSync.data?.scoresLockedAt || profile.scoresLockedAt,
                talents: cloudSync.data?.talents || profile.talents
            });
        }
        const shouldUseTrickeryFaithAction = isTrickerySave && !cloudSync.error;
        const trickeryFaithSync = shouldUseTrickeryFaithAction
            ? await syncTrickeryFaithToCloud(selectedFaithInfo.god, selectedProfession)
            : { data: null, error: null };
        const syncError = cloudSync.error || trickeryFaithSync.error;
        if (trickeryFaithSync.error) {
            showToast(`个人档案已保存，欺诈改信未同步：${trickeryFaithSync.error.message || '请检查专用接口'}`);
        } else if (cloudSync.error && !trickeryFaithSync.data) {
            showToast(`个人档案已本地保存，云端榜单未同步：${syncError.message || '请检查 Supabase 档案表'}`);
        } else {
            showToast('个人档案已保存');
        }
        updateInviteUI();
        await renderProfilePage();
        if (document.getElementById('leaderboardPage')?.style.display !== 'none') await renderLeaderboardPage();
        await renderDungeonList();
    } catch (error) {
        console.error('保存个人档案失败', error);
        showToast(`❌ ${getFriendlyActionError(error, '个人档案保存失败')}`);
    } finally {
        restoreSaveButtons();
        releaseUiActionLock('saveProfilePage');
    }
}

async function markProfileNoticesRead() {
    const { notices } = await getAuthorCommentNotices();
    const latest = notices[0]?.created_at || new Date().toISOString();
    setProfileNoticeSeenTime(latest);
    showToast('楼主提醒已标记为已读');
    await updateProfileNoticeBadge();
    await renderProfilePage();
}


function requireInvite(roles, message) {
    if (USE_LOCAL_FALLBACK || canUseRole(roles)) return true;
    openInviteModal(message || '请先验入局谕令。');
    return false;
}

async function updateDisplayName(displayName) {
    const name = cleanDisplayNameInput(displayName);
    if (!name) return { error: { message: '昵称不能为空' } };
    if (/[<>@#]/.test(name)) return { error: { message: '昵称不能包含特殊符号' } };
    if (!canEditDisplayName()) return { error: { message: '昵称为身份绑定字段，只有馆主可以更改' } };
    if (USE_LOCAL_FALLBACK) {
        if (!inviteSession) return { error: { message: '请先验入局谕令' } };
        saveInviteSession({ ...inviteSession, name });
        return { data: { display_name: name }, error: null, name };
    }
    return invokeDungeonAction('updateDisplayName', { displayName: name });
}

async function fetchDungeons(options = {}) {
    if (USE_LOCAL_FALLBACK) return getLocalData('dungeons', []);
    const force = !!options.force;
    if (!force) {
        const cached = readDungeonListCache();
        if (cached) return cached;
        if (dungeonListRequest) return dungeonListRequest;
    }
    const cacheVersion = dungeonListCacheVersion;
    dungeonListRequest = (async () => {
        // Keep the shared archive cache bounded. The detail view retrieves long text on demand.
        const { data, error } = await invokeDungeonAction('listDungeons', { limit: 120 });
        if (error) { showToast('❌ 获取数据失败'); return []; }
        const normalized = (data || []).map(d => ({ ...d, pinned_note: d.pinned_note || '' }));
        if (cacheVersion === dungeonListCacheVersion) writeDungeonListCache(normalized);
        return normalized;
    })();
    try {
        return await dungeonListRequest;
    } finally {
        dungeonListRequest = null;
    }
}

function hasActiveArchiveFilters() {
    return !!searchQuery.trim() || selectedGod !== 'all' || selectedPath !== 'all' || selectedDifficulty !== 'all' || reviewFilter !== 'all';
}

function canUsePagedArchive() {
    return !USE_LOCAL_FALLBACK && !hasActiveArchiveFilters() && !canReviewDungeonsUI();
}

async function fetchDungeonArchivePage(page = 1) {
    const safePage = Math.max(1, Math.floor(Number(page) || 1));
    const cacheName = `archive-page:${currentSort}:${safePage}:${ARCHIVE_PAGE_SIZE}`;
    return getShortCachedRead(cacheName, async () => {
        const { data, error } = await invokeDungeonAction('listDungeonArchivePage', {
            page: safePage,
            pageSize: ARCHIVE_PAGE_SIZE,
            sort: currentSort
        });
        if (error) throw new Error(error.message || '分页档案读取失败');
        return data || { dungeons: [], page: safePage, page_size: ARCHIVE_PAGE_SIZE, total: 0, total_pages: 1, sidebar: null };
    }, DUNGEON_LIST_CACHE_TTL_MS);
}

async function fetchDungeonDetail(dungeonId) {
    const id = String(dungeonId || '').trim();
    if (!id) return null;
    if (USE_LOCAL_FALLBACK) {
        const dungeons = await fetchDungeons();
        return dungeons.find(dungeon => String(dungeon?.id) === id) || null;
    }
    return getShortCachedRead(`dungeon-detail:${id}`, async () => {
        const { data, error } = await invokeDungeonAction('getDungeonDetail', { dungeonId: id });
        if (error) {
            console.warn('获取试炼详情失败:', error.message);
            return null;
        }
        return data || null;
    }, DUNGEON_LIST_CACHE_TTL_MS);
}

function normalizeHonorBuckets(response) {
    const buckets = response?.data?.byCommentId || response?.byCommentId || {};
    return buckets && typeof buckets === 'object' ? buckets : {};
}

async function fetchCommentHonorBuckets(commentIds) {
    if (USE_LOCAL_FALLBACK || !commentIds.length) return {};
    const { data, error } = await invokeDungeonAction('getCommentHonors', { commentIds });
    return error ? {} : normalizeHonorBuckets(data);
}

async function enrichCommentsWithHonors(comments) {
    const commentIds = [...new Set((comments || []).map(comment => String(comment?.id || '').trim()).filter(Boolean))];
    if (!commentIds.length || USE_LOCAL_FALLBACK) return comments;
    const byCommentId = await fetchCommentHonorBuckets(commentIds);
    return (comments || []).map(comment => {
        const bucket = byCommentId[String(comment?.id || '').trim()] || {};
        return {
            ...comment,
            active_titles: bucket.active_titles || [],
            active_curses: bucket.active_curses || [],
        };
    });
}

async function fetchComments(dungeonId) {
    if (USE_LOCAL_FALLBACK) {
        const all = getLocalData('comments', []);
        return all.filter(c => c.dungeon_id === dungeonId).sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
    }
    return getShortCachedRead(`comments:${dungeonId}`, async () => {
        const query = () => supabaseClient
            .from('comments')
            .select('id,dungeon_id,parent_comment_id,author,content,invite_name,is_deleted,created_at')
            .eq('dungeon_id', dungeonId)
            .order('created_at', { ascending: true });
        let { data, error } = await query();
        if (error) {
            console.warn('读取楼中楼证言失败，使用旧字段兼容:', error);
            const fallback = await supabaseClient
                .from('comments')
                .select('id,dungeon_id,author,content,invite_name,created_at')
                .eq('dungeon_id', dungeonId)
                .order('created_at', { ascending: true });
            data = fallback.data || [];
            error = fallback.error;
        }
        if (error) return [];
        const comments = (data || []).map(c => ({
            ...c,
            parent_comment_id: c.parent_comment_id || c.parentCommentId || null,
            is_deleted: !!c.is_deleted
        }));
        return await enrichCommentsWithHonors(comments);
    });
}

async function fetchLatestComments(limit = 3) {
    if (USE_LOCAL_FALLBACK) {
        const dungeons = getLocalData('dungeons', []);
        return getLocalData('comments', [])
            .filter(c => !c.is_deleted)
            .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, limit)
            .map(c => ({ ...c, dungeon: dungeons.find(d => d.id === c.dungeon_id) || null }));
    }
    return getShortCachedRead(`latest-comments:${limit}`, async () => {
        let { data, error } = await supabaseClient
            .from('comments')
            .select('id,dungeon_id,parent_comment_id,author,content,invite_name,is_deleted,created_at')
            .eq('is_deleted', false)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) {
            console.warn('读取最新楼中楼证言失败，使用旧字段兼容:', error);
            const fallback = await supabaseClient
                .from('comments')
                .select('id,dungeon_id,author,content,invite_name,created_at')
                .order('created_at', { ascending: false })
                .limit(limit);
            data = fallback.data || [];
            error = fallback.error;
        }
        if (error) return [];
        const dungeons = await fetchDungeons();
        return await enrichCommentsWithHonors((data || []).map(c => ({
            ...c,
            parent_comment_id: c.parent_comment_id || c.parentCommentId || null,
            is_deleted: !!c.is_deleted,
            dungeon: dungeons.find(d => d.id === c.dungeon_id) || null
        })));
    });
}

async function fetchClearFeedbackSummary(dungeonId) {
    if (USE_LOCAL_FALLBACK) {
        const local = getLocalData('clear_feedback', {});
        return Object.entries(local[dungeonId] || {}).map(([tag, tag_count]) => ({ tag, tag_count }));
    }
    return getShortCachedRead(`feedback:${dungeonId}`, async () => {
        const { data, error } = await supabaseClient
            .from('clear_feedback_summary')
            .select('tag,tag_count')
            .eq('dungeon_id', dungeonId)
            .order('tag_count', { ascending: false });
        return error ? [] : data || [];
    });
}

async function addDungeon(dungeonData) {
    if (USE_LOCAL_FALLBACK) {
        const dungeons = getLocalData('dungeons', []);
        if (dungeonData.dungeonId) {
            const d = dungeons.find(item => item.id === dungeonData.dungeonId);
            if (!d) return { error: { message: '试炼未找到' } };
            Object.assign(d, dungeonData, {
                id: dungeonData.dungeonId,
                pinned_note: dungeonData.pinnedNote || '',
                co_creators: dungeonData.coCreators || [],
                participant_count: dungeonData.participantCount,
                run_count: dungeonData.runCount,
                is_one_shot: !!dungeonData.isOneShot
            });
            setLocalData('dungeons', dungeons);
            return { data: [d], error: null };
        }
        const newDungeon = { id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2,6), ...dungeonData, clear_count:0, clear_rate:0, avg_rating:0, rating_count:0, comment_count:0, created_at: new Date().toISOString() };
        dungeons.push(newDungeon); setLocalData('dungeons', dungeons); return { data: [newDungeon], error: null };
    }
    return invokeDungeonAction('submitDungeon', dungeonData);
}

async function addRating(dungeonId, ratingValue) {
    if (USE_LOCAL_FALLBACK) {
        const rated = getLocalData('rated', {});
        const scoped = inviteScopedKey(dungeonId);
        if (rated[scoped] || rated[dungeonId]) return { error: { message: '你已经封存过神格评议了' } };
        rated[scoped] = ratingValue; rated[dungeonId] = ratingValue; setLocalData('rated', rated);
        const dungeons = getLocalData('dungeons', []);
        const d = dungeons.find(d => d.id === dungeonId);
        if (d) { const total = d.avg_rating * d.rating_count + ratingValue; d.rating_count += 1; d.avg_rating = Math.round((total / d.rating_count)*10)/10; setLocalData('dungeons', dungeons); }
        return { data: [{}], error: null };
    }
    return invokeDungeonAction('addRating', { dungeonId, rating: ratingValue });
}

async function addComment(dungeonId, author, content, parentCommentId = null) {
    const displayAuthor = cleanDisplayNameInput(author) || inviteSession?.name || '匿名探索者';
    if (USE_LOCAL_FALLBACK) {
        const comments = getLocalData('comments', []);
        const newComment = {
            id: 'c_'+Date.now(),
            dungeon_id: dungeonId,
            parent_comment_id: parentCommentId,
            author: displayAuthor,
            content: content.trim(),
            invite_code_hash: inviteSession?.code || 'local',
            invite_name: inviteSession?.name || displayAuthor,
            is_deleted: false,
            created_at: new Date().toISOString()
        };
        comments.push(newComment); setLocalData('comments', comments);
        const dungeons = getLocalData('dungeons', []); const d = dungeons.find(d=>d.id===dungeonId);
        if(d) { d.comment_count = (d.comment_count||0)+1; setLocalData('dungeons', dungeons); }
        return { data: [newComment], error: null };
    }
    return invokeDungeonAction('addComment', { dungeonId, parentCommentId, author: displayAuthor, content: content.trim() });
}

async function removeComment(commentId) {
    if (USE_LOCAL_FALLBACK) {
        const comments = getLocalData('comments', []);
        const comment = comments.find(c => c.id === commentId);
        if (!comment) return { error: { message: '证言不存在' } };
        if (comment.invite_code_hash !== (inviteSession?.code || 'local') && !isAdmin()) return { error: { message: '只能抹去自己的证言' } };
        comment.is_deleted = true;
        comment.deleted_at = new Date().toISOString();
        comment.content = '此证言已被抹去';
        setLocalData('comments', comments);
        return { data: [comment], error: null };
    }
    return invokeDungeonAction('deleteComment', { commentId });
}

async function savePinnedNote(dungeonId, pinnedNote) {
    if (USE_LOCAL_FALLBACK) {
        const dungeons = getLocalData('dungeons', []);
        const d = dungeons.find(d => d.id === dungeonId);
        if (!d) return { error: { message: '试炼未找到' } };
        d.pinned_note = pinnedNote.trim();
        setLocalData('dungeons', dungeons);
        return { data: [d], error: null };
    }
    return invokeDungeonAction('updatePinnedNote', { dungeonId, pinnedNote: pinnedNote.trim() });
}

async function reviewDungeon(dungeonId, decision, reviewNote = '') {
    if (USE_LOCAL_FALLBACK) {
        const dungeons = getLocalData('dungeons', []);
        const d = dungeons.find(item => item.id === dungeonId);
        if (!d) return { error: { message: '试炼未找到' } };
        d.review_status = decision === 'approve' ? 'approved' : 'rejected';
        d.review_note = reviewNote;
        d.reviewed_by_name = inviteSession?.name || '';
        d.reviewed_at = new Date().toISOString();
        setLocalData('dungeons', dungeons);
        return { data: d, error: null };
    }
    return invokeDungeonAction('reviewDungeon', { dungeonId, decision, reviewNote });
}

async function removeDungeon(dungeonId) {
    if (USE_LOCAL_FALLBACK) {
        const dungeons = getLocalData('dungeons', []).filter(d => d.id !== dungeonId);
        const comments = getLocalData('comments', []).filter(c => c.dungeon_id !== dungeonId);
        setLocalData('dungeons', dungeons);
        setLocalData('comments', comments);
        return { data: [{}], error: null };
    }
    return invokeDungeonAction('deleteDungeon', { dungeonId });
}

async function markDungeonCleared(dungeonId, feedbackTags = [], feedbackNote = '') {
    if (USE_LOCAL_FALLBACK) {
        const cleared = getLocalData('cleared', {});
        const dungeons = getLocalData('dungeons', []);
        const d = dungeons.find(d => d.id === dungeonId);
        if (!d) return { error: { message: '试炼未找到' } };
        const run = Number(d.run_count || d.runCount || 1);
        const key = `${dungeonId}:${run}`;
        if (cleared[key]) return { error: { message: '你已经登记过本局通过了' } };
        cleared[key] = true;
        d.clear_count = Number(d.clear_count || d.clearCount || 0) + 1;
        const slots = Number(d.participant_count || d.participantCount || 1) * run;
        d.clear_rate = slots > 0 ? Math.round((d.clear_count / slots) * 1000) / 10 : 0;
        setLocalData('cleared', cleared);
        setLocalData('dungeons', dungeons);
        const feedback = getLocalData('clear_feedback', {});
        feedback[dungeonId] = feedback[dungeonId] || {};
        feedbackTags.forEach(tag => { feedback[dungeonId][tag] = (feedback[dungeonId][tag] || 0) + 1; });
        setLocalData('clear_feedback', feedback);
        return { data: [{}], error: null };
    }
    return invokeDungeonAction('markCleared', { dungeonId, feedbackTags, feedbackNote: feedbackNote.trim() });
}

async function advanceDungeonRun(dungeonId) {
    if (USE_LOCAL_FALLBACK) {
        const dungeons = getLocalData('dungeons', []);
        const d = dungeons.find(d => d.id === dungeonId);
        if (!d) return { error: { message: '试炼未找到' } };
        d.run_count = Number(d.run_count || d.runCount || 1) + 1;
        const slots = Number(d.participant_count || d.participantCount || 1) * d.run_count;
        d.clear_rate = slots > 0 ? Math.round((Number(d.clear_count || 0) / slots) * 1000) / 10 : 0;
        setLocalData('dungeons', dungeons);
        return { data: [d], error: null };
    }
    return invokeDungeonAction('advanceRun', { dungeonId });
}

function inviteScopedKey(id) {
    const session = inviteSession || getLocalData(INVITE_STORAGE_KEY, null);
    return `${id}:${session?.code || 'guest'}`;
}
async function sha256Hex(value) {
    const bytes = new TextEncoder().encode(String(value || ''));
    const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function hasRatedLocal(id) {
    const scoped = inviteScopedKey(id);
    return !!getLocalData('rated', {})[scoped] || !!getLocalData('rated', {})[id] || !!getLocalData('rated_supabase', {})[scoped];
}
async function checkHasRated(id) {
    const key = USE_LOCAL_FALLBACK ? 'rated' : 'rated_supabase';
    const scoped = inviteScopedKey(id);
    if (!!getLocalData(key, {})[scoped] || !!getLocalData('rated', {})[scoped] || !!getLocalData('rated', {})[id]) return true;
    const session = inviteSession || getLocalData(INVITE_STORAGE_KEY, null);
    if (USE_LOCAL_FALLBACK || !supabaseClient || !session?.code || !globalThis.crypto?.subtle) return false;
    try {
        const codeHash = await sha256Hex(session.code);
        const { data, error } = await supabaseClient
            .from('ratings')
            .select('id')
            .eq('dungeon_id', id)
            .eq('invite_code_hash', codeHash)
            .limit(1);
        if (!error && data?.length) {
            markAsRated(id);
            return true;
        }
    } catch (error) {
        console.warn('判定状态读取失败:', error);
    }
    return false;
}
function markAsRated(id) {
    const key = USE_LOCAL_FALLBACK ? 'rated' : 'rated_supabase';
    const r = getLocalData(key, {});
    r[inviteScopedKey(id)] = true;
    if (USE_LOCAL_FALLBACK) r[id] = true;
    setLocalData(key, r);
}












function renderProfileChronicle(god = '命运', index = profileChronicleIndex) {
    const info = getGodInfo(god);
    const skin = getGodSkin(god);
    const entries = getProfileChronicleEntries(god);
    const safeIndex = ((Number(index) || 0) % entries.length + entries.length) % entries.length;
    const entry = entries[safeIndex];
    return `
        <section class="profile-chronicle-card" id="profileChronicleCard" data-god="${escapeHtml(info.god)}" data-motif="${escapeHtml(skin.motif)}" style="${getGodSkinStyle(god)}">
            <div class="profile-chronicle-icon">${renderGodSigil(god, 'sm')}</div>
            <div class="profile-chronicle-copy">
                <small>信徒现世记事 · ${escapeHtml(info.path)}纪元</small>
                <strong>${escapeHtml(entry.lead)}</strong>
                <span>${escapeHtml(entry.note)}</span>
            </div>
            <div class="profile-chronicle-step">${safeIndex + 1}/${entries.length}</div>
        </section>`;
}

function stopProfileChronicleRotation() {
    if (profileChronicleTimer) {
        clearInterval(profileChronicleTimer);
        profileChronicleTimer = null;
    }
}

function startProfileChronicleRotation(god = '命运') {
    stopProfileChronicleRotation();
    const entries = getProfileChronicleEntries(god);
    if (entries.length <= 1) return;
    profileChronicleTimer = setInterval(() => {
        if (document.getElementById('profilePage')?.style.display === 'none') {
            stopProfileChronicleRotation();
            return;
        }
        profileChronicleIndex = (profileChronicleIndex + 1) % entries.length;
        const oldCard = document.getElementById('profileChronicleCard');
        if (!oldCard) return;
        oldCard.outerHTML = renderProfileChronicle(god, profileChronicleIndex);
        document.getElementById('profileChronicleCard')?.classList.add('is-rotating');
    }, 15000);
}

function renderRitualEmpty(text, god = '命运', title = '神谕暂未留存') {
    const info = getGodInfo(god);
    const skin = getGodSkin(god);
    return `
        <div class="profile-empty ritual-empty" data-god="${escapeHtml(info.god)}" data-motif="${escapeHtml(skin.motif)}" style="${getGodSkinStyle(god)}">
            <div class="profile-empty-mark">${renderGodSigil(god, 'sm')}</div>
            <div class="profile-empty-copy">
                <strong>${escapeHtml(title)}</strong>
                <span>${escapeHtml(text)}</span>
            </div>
        </div>`;
}

function renderMiniRitualEmpty(text, god = '命运', title = '空位') {
    return `
        <div class="talent-mini-empty" data-god="${escapeHtml(getGodInfo(god).god)}" style="${getGodSkinStyle(god)}">
            <span>${renderGodSigil(god, 'sm')}</span>
            <strong>${escapeHtml(title)}</strong>
            <small>${escapeHtml(text)}</small>
        </div>`;
}

function renderProfileAtmosphere(god = '命运') {
    const info = getGodInfo(god);
    const skin = getGodSkin(god);
    const sigil = renderGodSigil(god, 'lg');
    return `
        <div class="profile-atmosphere" aria-hidden="true">
            <div class="profile-era-mural left"></div>
            <div class="profile-era-mural right"></div>
            <div class="profile-particle-stream left"></div>
            <div class="profile-particle-stream right"></div>
            <div class="profile-corner-silhouette tl">${sigil}</div>
            <div class="profile-corner-silhouette tr">${sigil}</div>
            <div class="profile-corner-silhouette bl">${sigil}</div>
            <div class="profile-corner-silhouette br">${sigil}</div>
            <div class="profile-chronology-strip">${ERA_TIMELINE.map(() => '<span></span>').join('')}</div>
        </div>
        <aside class="profile-god-badge" aria-hidden="true">
            <div class="profile-god-badge-title">${renderGodSigil(god, 'sm')}<span>${escapeHtml(info.god)}之神</span></div>
            <small>${escapeHtml(skin.oracle || getGodPrayer(god))}</small>
        </aside>`;
}

function previewProfileFaithSkin(value) {
    const info = getGodInfo(value);
    if (!info.known) return;
    const skin = getGodSkin(info.god);
    const style = getGodSkinStyle(info.god);
    const professionSelect = document.getElementById('profileProfession');
    if (professionSelect && !professionSelect.disabled) {
        const currentProfession = normalizeProfession(professionSelect.value);
        const currentInfo = getProfessionInfo(currentProfession);
        const nextProfession = currentInfo.known && currentInfo.god === info.god ? currentProfession : '';
        professionSelect.innerHTML = renderProfileProfessionOptions(nextProfession, info.god);
        professionSelect.value = nextProfession;
    }
    const page = document.getElementById('profilePage');
    if (page) {
        page.setAttribute('data-god', info.god);
        page.setAttribute('data-path', info.path || '');
        page.style.cssText = `display:block;${style}`;
    }
    document.querySelectorAll('#profileContent [data-god]').forEach(element => {
        element.setAttribute('data-god', info.god);
        element.setAttribute('style', style);
    });
    const content = document.getElementById('profileContent');
    if (!content) return;
    const hero = content.querySelector('.profile-hero');
    if (hero) hero.setAttribute('data-motif', skin.motif || '');
    const avatar = content.querySelector('.profile-avatar');
    if (avatar) avatar.innerHTML = renderGodSigil(info.god, 'lg');
    const prayer = content.querySelector('.profile-hero .profile-faith-prayer');
    if (prayer) prayer.textContent = `${getGodPrayer(info.god)} · ${skin.pattern}`;
    const rank = content.querySelector('.profile-faith-rank strong');
    if (rank) {
        const currentProgress = Number(content.querySelector('.faith-progress-fill')?.style.getPropertyValue('--faith-progress')?.replace('%', '') || 0);
        rank.textContent = getProfileFaithRank(info.god, currentProgress).title;
    }
    content.querySelector('.profile-atmosphere')?.remove();
    content.querySelector('.profile-god-badge')?.remove();
    content.insertAdjacentHTML('afterbegin', renderProfileAtmosphere(info.god));
    const chronicle = content.querySelector('#profileChronicleCard');
    if (chronicle) {
        profileChronicleIndex = 0;
        chronicle.outerHTML = renderProfileChronicle(info.god, 0);
        startProfileChronicleRotation(info.god);
    }
    updateProfileBattlePanel();
}

function renderDetailDossier(d, context = {}) {
    const locked = !!context.locked;
    const rated = !!context.rated;
    const clearDone = !!context.clearDone;
    const activeCommentCount = Number(context.activeCommentCount || 0);
    const role = getInviteRole();
    const roleLabel = role ? ROLE_LABELS[role] : '旁观者';
    const archiveNote = formatTrialArchiveNote(d);
    const playerAction = locked
        ? '验入局谕令后可判定、证言与登记通关。'
        : `${rated ? '已封存判定' : '可降下判定'}；${clearDone ? '本局已登记通关' : '可登记本局通关'}。`;
    return `
        <div class="trial-dossier-grid" style="${getGodSkinStyle(d.type)}">
            <div class="trial-dossier-card" data-mark="卷">
                <span>归档律令</span>
                <strong>${escapeHtml(formatTrialArchive(d))}</strong>
                <small>${escapeHtml(archiveNote)}</small>
            </div>
            <div class="trial-dossier-card" data-mark="召">
                <span>召集入口</span>
                <strong>小程序主入口</strong>
                <small>网站端召集入口保持隐藏，此处只保留浏览、证言和判定。</small>
            </div>
            <div class="trial-dossier-card" data-mark="身">
                <span>当前身份</span>
                <strong>${escapeHtml(roleLabel)}</strong>
                <small>${escapeHtml(playerAction)}</small>
            </div>
            <div class="trial-dossier-card" data-mark="录">
                <span>试炼留存</span>
                <strong>${escapeHtml(formatClearSlots(d))}</strong>
                <small>证言 ${activeCommentCount} 条 · 神格 ${Number(d.avg_rating || 0).toFixed(1)}</small>
            </div>
        </div>`;
}

function normalizeNameKey(value) {
    return String(value || '').trim().toLowerCase();
}

function parseCoCreators(value) {
    if (Array.isArray(value)) {
        return [...new Set(value.map(item => cleanDisplayNameInput(item)).filter(Boolean))].slice(0, 12);
    }
    return [...new Set(String(value || '')
        .split(/[、,，;；\n\r]+/u)
        .map(item => cleanDisplayNameInput(item))
        .filter(Boolean))]
        .slice(0, 12);
}

function getCoCreators(d) {
    return parseCoCreators(d?.co_creators || d?.coCreators || []);
}

function isCoCreatorName(d, name = inviteSession?.name) {
    const key = normalizeNameKey(name);
    return !!key && getCoCreators(d).some(item => normalizeNameKey(item) === key);
}

function formatCreatorLine(d) {
    const creator = d?.creator || '匿名';
    const coCreators = getCoCreators(d).filter(name => normalizeNameKey(name) !== normalizeNameKey(creator));
    return coCreators.length ? `${creator} ｜ 同契共筑：${coCreators.join('、')}` : creator;
}

function getPathDisplayColor(path) {
    const colors = {
        生命: 'var(--path-life)',
        沉沦: '#782f40',
        文明: 'var(--path-civil)',
        混沌: 'var(--path-chaos)',
        存在: 'var(--path-exist)',
        虚无: 'var(--path-void)'
    };
    return colors[path] || 'var(--gold-light)';
}

function countByPath(items, pathGetter) {
    const counts = Object.fromEntries(GOD_GROUPS.map(group => [group.path, 0]));
    (items || []).forEach(item => {
        const path = pathGetter(item);
        if (counts[path] !== undefined) counts[path] += 1;
    });
    return counts;
}

function countDungeonsByPath(items, typeGetter) {
    const counts = Object.fromEntries(GOD_GROUPS.map(group => [group.path, 0]));
    (items || []).forEach(item => {
        const paths = [...new Set(getDungeonGodInfos(typeGetter(item)).map(info => info.path))];
        paths.forEach(path => {
            if (counts[path] !== undefined) counts[path] += 1;
        });
    });
    return counts;
}

function renderFaithFlowBars(counts, total, options = {}) {
    const safeTotal = Math.max(1, Number(total || 0));
    const rows = ERA_TIMELINE.map(era => {
        const count = Number(counts?.[era.path] || 0);
        const width = count > 0 ? Math.max(8, Math.round((count / safeTotal) * 100)) : 0;
        const flowColor = getPathDisplayColor(era.path);
        const percent = Number(total || 0) > 0 ? Math.round((count / safeTotal) * 100) : 0;
        return `
            <div class="faith-flow-row" style="--flow-color:${flowColor}" data-tip="${escapeHtml(`${era.path}命途 / 游玩切片 ${count} 个 / ${percent}%`)}">
                <span>${escapeHtml(era.path)}</span>
                <div class="faith-flow-track" title="${escapeHtml(era.path)} · ${count}">
                    <div class="faith-flow-fill" style="--flow:${width}%"></div>
                </div>
                <strong>${count}</strong>
            </div>`;
    }).join('');
    const note = options.note ? `<div class="era-scroll-note">${escapeHtml(options.note)}</div>` : '';
    return `<div class="faith-flow-bars">${rows}</div>${note}`;
}

function getGodSigilMeta(value) {
    const god = getGodInfo(value).god;
    return GOD_SIGILS[god] || {
        key: 'unknown',
        svg: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2" ${SIGIL_STROKE}/><path d="M8 12h8M12 8v8" ${SIGIL_STROKE}/></svg>`
    };
}

function renderGodSigil(value, size = 'md', extraClass = '') {
    const info = getGodInfo(value);
    const meta = getGodSigilMeta(value);
    const prayer = getGodPrayer(value);
    const label = `${info.god}之神 · ${info.path}命途｜${prayer}`;
    const classes = ['god-sigil', `god-sigil-${size}`, info.className, `sigil-${meta.key}`, extraClass].filter(Boolean).join(' ');
    return `<span class="${classes}" data-god="${escapeHtml(info.god)}" style="${getGodSkinStyle(value)}" title="${escapeHtml(label)}" data-tooltip="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${meta.svg}</span>`;
}

function getRitualLayout(id, type) {
    const god = getGodInfo(type).god;
    const allGods = getAllGods().map(item => item.god);
    const index = Math.max(0, allGods.indexOf(god));
    const layouts = ['center', 'anchored', 'side'];
    return layouts[index % layouts.length];
}

function getRatingTier(score) {
    const value = Number(score || 0);
    if (value >= 4.95) return '愚戏至尊';
    if (value >= 4.5) return '半神';
    if (value >= 3.5) return '黄金';
    if (value >= 2.5) return '白银';
    if (value >= 1.5) return '黑铁';
    if (value > 0) return '凡俗';
    return '未判定';
}

function getRatingCopy(value) {
    const copies = {
        1: '凡俗：试炼浅薄，难称愚戏',
        2: '黑铁：循规试炼，无甚反转',
        3: '白银：合格祈愿试炼，中规中矩',
        4: '黄金：精巧布局，窥见神明博弈',
        5: '愚戏至尊：完美切片愚戏，源初见喜'
    };
    return copies[value] || '';
}

function getLoadingOracle() {
    return LOADING_ORACLES[Math.floor(Math.random() * LOADING_ORACLES.length)] || '凡骨入局，诸神设戏';
}

function getTrialCycle(d) {
    const count = getRunCount(d);
    return count === 1 ? '初周目' : `第${count}周目`;
}

function formatContractSize(d) {
    const count = getParticipantCount(d);
    return count ? `${count} 人组队` : '人数未定';
}

function isOneShotDungeon(d) {
    return !!(d?.is_one_shot || d?.isOneShot);
}

function formatTrialArchive(d) {
    return isOneShotDungeon(d) ? '绝响试炼' : '轮回试炼';
}

function formatTrialArchiveNote(d) {
    return isOneShotDungeon(d) ? '绝响试炼：被抽中参与后不可再入局' : '轮回试炼：可反复发起召集';
}

function getTestimonyPlaceholder(type) {
    const info = getGodInfo(type);
    if (info.path === '生命') return '【敬献你在繁衍试炼中的见闻】';
    if (info.path === '存在') return '【敬献一段试炼留存的记忆】';
    if (info.path === '虚无') return '【留下你识破谎言的证言】';
    return `【${getGodPrayer(type)}】`;
}

function isTaskOracle(d) {
    const text = `${d.name || ''} ${d.description || ''} ${d.pinned_note || ''}`;
    return /任务|要求|提示|48h|虫皇|击败|结束/.test(text);
}

function renderTrialOracle(d, godClass) {
    return `<div class="trial-oracle ${godClass}" style="${getGodSkinStyle(d.type)}">${escapeHtml(getGodOracle(d.type))}</div>`;
}

function isVeteranArchitect(d) {
    return Number(d.avg_rating || 0) >= 4.8 && Number(d.rating_count || 0) >= 2;
}

function getArchitectLabel(d) {
    return isVeteranArchitect(d) ? '🎭 愚戏构筑师：' : '筑戏人：';
}





function renderGodFilters() {
    const listEl = document.getElementById('godFilterList');
    if (!listEl) return;
    const allButton = `<div class="god-cluster"><div class="god-cluster-title"><strong>全神席</strong><small>不限定命途，查看所有祈愿试炼。</small></div><div class="god-cluster-buttons"><button class="god-button path-all ${selectedGod === 'all' && selectedPath === 'all' ? 'active' : ''}" onclick="setGodFilter('all')">全神席</button></div></div>`;
    const groupHtml = GOD_GROUPS.map(group => `
        <div class="god-cluster ${group.className}">
            <div class="god-cluster-title">
                <strong>${escapeHtml(getPathMetaByPath(group.path).sigil)} ${escapeHtml(group.path)}命途</strong>
                <small>谕行：${escapeHtml(getPathMetaByPath(group.path).edict)}</small>
            </div>
            <div class="god-cluster-buttons">
                ${group.gods.map(god => `<button class="god-button ${group.className} ${selectedGod === god ? 'active' : ''}" onclick="setGodFilter('${escapeHtml(god)}')">${renderGodSigil(god, 'sm')} ${escapeHtml(god)}之神</button>`).join('')}
            </div>
        </div>
    `).join('');
    listEl.innerHTML = allButton + groupHtml;
}

function renderPathNav() {
    const nav = document.getElementById('pathNav');
    if (!nav) return;
    nav.innerHTML = GOD_GROUPS.map(group => {
        const meta = getPathMetaByPath(group.path);
        const active = selectedPath === group.path && selectedGod === 'all';
        const leadGod = group.gods[0] || '命运';
        return `<button class="path-nav-btn ${group.className} ${active ? 'active' : ''}" title="${escapeHtml(group.path)}纪元｜${escapeHtml(group.gods.join(' / '))}" onclick="setPathFilter('${escapeHtml(group.path)}')">
            ${renderGodSigil(leadGod, 'xs', 'path-nav-sigil')} <span>${escapeHtml(group.path)}</span>
            <span class="path-nav-prayer">${escapeHtml(group.gods.join(' / '))} · ${escapeHtml(meta.edict)}</span>
        </button>`;
    }).join('');
}

function renderDifficultyFilters() {
    const listEl = document.getElementById('difficultyFilterList');
    if (!listEl) return;
    listEl.innerHTML = `<button class="difficulty-filter-btn ${selectedDifficulty === 'all' ? 'active' : ''}" onclick="setDifficultyFilter('all')">全部难度</button>` +
        DIFFICULTY_OPTIONS.map(item => `<button class="difficulty-filter-btn ${selectedDifficulty === item.value ? 'active' : ''}" onclick="setDifficultyFilter('${item.value}')">${item.label}</button>`).join('');
    updateFilterSummary();
}

function updateFilterSummary() {
    const summary = document.getElementById('filterSummaryText');
    if (!summary) return;
    const godText = selectedGod !== 'all' ? `${selectedGod}之神` : (selectedPath !== 'all' ? `${selectedPath}命途` : '全神席');
    const difficultyText = selectedDifficulty === 'all' ? '全部难度' : formatDifficulty(selectedDifficulty);
    const reviewText = reviewFilter === 'pending' ? '待审核' : '全部发布';
    summary.textContent = canReviewDungeonsUI() ? `${godText} · ${difficultyText} · ${reviewText}` : `${godText} · ${difficultyText}`;
}

function toggleAdvancedFilters(force) {
    const panel = document.getElementById('advancedFilters');
    const button = document.getElementById('filterToggleBtn');
    if (!panel || !button) return;
    const shouldOpen = typeof force === 'boolean' ? force : panel.hasAttribute('hidden');
    if (shouldOpen) {
        panel.removeAttribute('hidden');
        button.setAttribute('aria-expanded', 'true');
    } else {
        panel.setAttribute('hidden', '');
        button.setAttribute('aria-expanded', 'false');
    }
    document.body.classList.toggle('mobile-filter-open', shouldOpen);
}

function toggleForumFeed(force) {
    const panel = document.getElementById('forumFeed');
    const feed = document.getElementById('latestCommentsFeed');
    const button = document.getElementById('forumFeedToggle');
    if (!panel || !feed || !button) return;
    const shouldOpen = typeof force === 'boolean' ? force : panel.classList.contains('is-collapsed');
    panel.classList.toggle('is-collapsed', !shouldOpen);
    feed.hidden = !shouldOpen;
    button.setAttribute('aria-expanded', String(shouldOpen));
    button.textContent = shouldOpen ? '收起' : '展开';
}

function applyVisualEffectsPreference() {
    document.body.classList.toggle('visual-effects-muted', !visualEffectsEnabled);
    const button = document.getElementById('visualEffectsToggle');
    const label = document.getElementById('visualEffectsText');
    if (button) button.setAttribute('aria-pressed', String(visualEffectsEnabled));
    if (label) label.textContent = visualEffectsEnabled ? '开启' : '静默';
}

function toggleVisualEffects() {
    visualEffectsEnabled = !visualEffectsEnabled;
    setLocalData(VISUAL_EFFECTS_STORAGE_KEY, visualEffectsEnabled);
    applyVisualEffectsPreference();
    showToast(visualEffectsEnabled ? '视觉粒子已开启' : '视觉粒子已静默');
}

function getActiveAtmosphereEra() {
    return getActiveAtmosphereNode().path;
}

function getActiveAtmosphereNode() {
    const index = ((atmosphereCycleIndex % ATMOSPHERE_CYCLE.length) + ATMOSPHERE_CYCLE.length) % ATMOSPHERE_CYCLE.length;
    return ATMOSPHERE_CYCLE[index] || { path: '虚无', god: '欺诈' };
}

function getFilterAtmosphereNode() {
    if (selectedGod !== 'all') {
        const info = getGodInfo(selectedGod);
        if (info.known) return { path: info.path, god: selectedGod };
    }
    if (selectedPath !== 'all') {
        const group = GOD_GROUPS.find(item => item.path === selectedPath);
        if (group) return { path: group.path, god: group.gods?.[0] || '欺诈' };
    }
    return null;
}

function syncEdgeAtmosphere() {
    updateEdgeAtmosphere(getFilterAtmosphereNode() || getActiveAtmosphereNode());
}

function renderEdgeAtmosphereSignals() {
    const eraLabel = document.getElementById('edgeEraLabel');
    const godLabel = document.getElementById('edgeGodLabel');
    const band = document.getElementById('edgeChronologyBand');
    const meta = PATH_META[currentAtmosphereEra] || PATH_META['虚无'];
    const prayer = getGodPrayer(currentAtmosphereGod);
    const sigil = renderGodSigil(currentAtmosphereGod, 'sm', 'edge-god-sigil');
    const modeLabel = getFilterAtmosphereNode() ? '筛选牵引' : '自动轮转';
    if (eraLabel) {
        eraLabel.classList.remove('is-switching');
        eraLabel.innerHTML = `
            <small>${escapeHtml(modeLabel)} · ERA</small>
            <strong>${escapeHtml(meta.sigil)} ${escapeHtml(currentAtmosphereEra)}纪元</strong>
            <span>${escapeHtml(meta.edict)}</span>`;
        requestAnimationFrame(() => eraLabel.classList.add('is-switching'));
    }
    if (godLabel) {
        godLabel.classList.remove('is-switching');
        godLabel.innerHTML = `
            ${sigil}
            <small>ACTIVE GOD</small>
            <strong>${escapeHtml(currentAtmosphereGod)}之神</strong>
            <span>${escapeHtml(prayer)}</span>`;
        requestAnimationFrame(() => godLabel.classList.add('is-switching'));
    }
    if (band) {
        band.innerHTML = ERA_TIMELINE.map((era, index) => `
            <span class="edge-era-tick ${era.path === currentAtmosphereEra ? 'is-active' : ''}" title="${escapeHtml(era.title)}">
                ${index + 1} ${escapeHtml(era.path)}
            </span>`).join('');
    }
}

function updateEdgeAtmosphere(node = getActiveAtmosphereNode()) {
    currentAtmosphereEra = ERA_CHRONICLE_LIBRARY[node.path] ? node.path : '虚无';
    currentAtmosphereGod = getGodInfo(node.god).known ? node.god : (GOD_GROUPS.find(group => group.path === currentAtmosphereEra)?.gods?.[0] || '欺诈');
    const layer = document.getElementById('edgeAtmosphere');
    if (layer) layer.dataset.era = currentAtmosphereEra;
    const title = document.getElementById('chronicleEraName');
    if (title) title.textContent = `${currentAtmosphereEra}・${currentAtmosphereGod}`;
    renderEdgeAtmosphereSignals();
}

function resetDiscoveryFiltersToEmpty() {
    searchQuery = '';
    selectedGod = 'all';
    selectedPath = 'all';
    selectedDifficulty = 'all';
    reviewFilter = 'all';
    archivePage = 1;
    const input = document.getElementById('searchInput');
    if (input) input.value = '';
    updateReviewFilterButton();
}

function populateGodSelect() {
    const select = document.getElementById('dungeonType');
    if (!select) return;
    select.innerHTML = GOD_GROUPS.map(group => `<optgroup label="${escapeHtml(group.path)}命途">${group.gods.map(god => `<option value="${escapeHtml(god)}">${escapeHtml(getGodIcon(god))} ${escapeHtml(group.path)} · ${escapeHtml(god)}之神</option>`).join('')}</optgroup>`).join('');
    Array.from(select.options).forEach(option => { option.selected = false; });
    renderSubmitGodPicker();
}

function renderSubmitGodPicker() {
    const panel = document.getElementById('dungeonGodPicker');
    if (!panel) return;
    panel.innerHTML = GOD_GROUPS.map(group => `
        <div class="god-pick-row ${group.className}">
            <div class="god-pick-path">${escapeHtml(group.path)}</div>
            <div class="god-pick-buttons">
                ${group.gods.map(god => `<button type="button" class="god-pick-btn" data-submit-god="${escapeHtml(god)}" style="${getGodSkinStyle(god)}" onclick='toggleSubmitGod(${jsString(god)})'>${renderGodSigil(god, 'xs')}<span>${escapeHtml(god)}</span></button>`).join('')}
            </div>
        </div>
    `).join('');
    syncSubmitGodPicker();
}

function getSelectedSubmitGods() {
    const select = document.getElementById('dungeonType');
    return select ? Array.from(select.selectedOptions).map(option => option.value).filter(Boolean) : [];
}

function setSelectedSubmitGods(gods = []) {
    const select = document.getElementById('dungeonType');
    if (!select) return;
    const selected = new Set((Array.isArray(gods) ? gods : splitGodTags(gods)).map(cleanGodName).filter(Boolean));
    Array.from(select.options).forEach(option => { option.selected = selected.has(cleanGodName(option.value)); });
    syncSubmitGodPicker();
}

function syncSubmitGodPicker() {
    const selected = new Set(getSelectedSubmitGods());
    document.querySelectorAll('[data-submit-god]').forEach(button => {
        const god = button.getAttribute('data-submit-god') || '';
        button.classList.toggle('active', selected.has(god));
        button.setAttribute('aria-pressed', selected.has(god) ? 'true' : 'false');
    });
    const summary = document.getElementById('dungeonGodSummary');
    if (summary) {
        const gods = [...selected];
        summary.innerHTML = gods.length
            ? `已选 <strong>${gods.map(escapeHtml).join('、')}</strong>`
            : '未选择神明标签';
    }
}

function toggleSubmitGod(god) {
    const select = document.getElementById('dungeonType');
    if (!select) return;
    const option = Array.from(select.options).find(item => item.value === god);
    if (!option) return;
    option.selected = !option.selected;
    syncSubmitGodPicker();
}

function setGodFilter(god) {
    selectedGod = god;
    selectedPath = 'all';
    archivePage = 1;
    renderGodFilters();
    renderPathNav();
    updateFilterSummary();
    syncEdgeAtmosphere();
    renderDungeonList();
}

function setPathFilter(path) {
    selectedPath = selectedPath === path ? 'all' : path;
    selectedGod = 'all';
    archivePage = 1;
    renderPathNav();
    renderGodFilters();
    updateFilterSummary();
    syncEdgeAtmosphere();
    renderDungeonList();
}

function setDifficultyFilter(difficulty) {
    selectedDifficulty = difficulty;
    archivePage = 1;
    renderDifficultyFilters();
    updateFilterSummary();
    renderDungeonList();
}

function hasActiveDiscoveryFilters() {
    return Boolean(searchQuery.trim()) ||
        selectedGod !== 'all' ||
        selectedPath !== 'all' ||
        selectedDifficulty !== 'all' ||
        reviewFilter !== 'all';
}

function updateDiscoveryFilterStatus(totalCount, visibleCount) {
    const box = document.getElementById('filterStatus');
    const text = document.getElementById('filterStatusText');
    if (!box || !text) return;
    if (!hasActiveDiscoveryFilters()) {
        box.hidden = true;
        return;
    }
    const parts = [];
    if (searchQuery.trim()) parts.push(`搜索：${searchQuery.trim()}`);
    if (selectedGod !== 'all') parts.push(`${selectedGod}之神`);
    if (selectedPath !== 'all') parts.push(`${selectedPath}命途`);
    if (selectedDifficulty !== 'all') parts.push(`${formatDifficulty(selectedDifficulty)}难度`);
    if (reviewFilter === 'pending') parts.push('待审核');
    text.innerHTML = `当前只显示 <strong>${visibleCount}</strong> / ${totalCount} 个试炼，条件：${escapeHtml(parts.join(' · '))}`;
    box.hidden = false;
}

function clearDiscoveryFilters() {
    resetDiscoveryFiltersToEmpty();
    renderPathNav();
    renderGodFilters();
    renderDifficultyFilters();
    updateFilterSummary();
    syncEdgeAtmosphere();
    renderDungeonList();
    showToast('已显示全部试炼');
}

function toggleReviewFilter() {
    if (!canReviewDungeonsUI()) return;
    reviewFilter = reviewFilter === 'pending' ? 'all' : 'pending';
    archivePage = 1;
    updateReviewFilterButton();
    updateFilterSummary();
    renderDungeonList();
}

async function renderDungeonList() {
    const listEl = document.getElementById('dungeonList');
    listEl.innerHTML = `<div class="loading"><div class="spinner"></div><br>正在从切片宇宙中加载祈愿试炼...<br><span>${escapeHtml(getLoadingOracle())}</span></div>`;
    let dungeons = [];
    let archiveSidebar = null;
    let usingPagedArchive = false;
    let totalDungeons = 0;
    let pageCount = 1;
    let pageStart = 0;
    try {
        usingPagedArchive = canUsePagedArchive();
        if (usingPagedArchive) {
            const pageData = await fetchDungeonArchivePage(archivePage);
            dungeons = Array.isArray(pageData?.dungeons) ? pageData.dungeons : [];
            archiveSidebar = pageData?.sidebar || null;
            totalDungeons = Math.max(0, Number(pageData?.total || 0));
            pageCount = Math.max(1, Number(pageData?.total_pages || Math.ceil(totalDungeons / ARCHIVE_PAGE_SIZE) || 1));
            archivePage = Math.min(Math.max(1, Number(pageData?.page || archivePage)), pageCount);
            // A stale or partially failed page response must not make a populated archive look empty.
            // Fall back once to the compact full-list endpoint, then continue with normal client paging.
            if (totalDungeons === 0 && !dungeons.length) {
                const fallbackDungeons = await fetchDungeons({ force: true });
                if (fallbackDungeons.length) {
                    console.warn('分页归档返回空结果，已使用完整归档兜底。');
                    usingPagedArchive = false;
                    dungeons = fallbackDungeons;
                    archiveSidebar = null;
                    archivePageMeta = null;
                }
            }
            if (usingPagedArchive) {
                if (totalDungeons > 0 && !dungeons.length) {
                    archivePage = pageCount;
                    archivePageMeta = null;
                    return renderDungeonList();
                }
                pageStart = (archivePage - 1) * ARCHIVE_PAGE_SIZE;
                archivePageMeta = { total: totalDungeons, pageCount, pageSize: ARCHIVE_PAGE_SIZE, sidebar: archiveSidebar };
            }
        } else {
            dungeons = await fetchDungeons();
            archivePageMeta = null;
        }
    } catch (error) {
        console.error('加载试炼失败:', error);
        updateDiscoveryFilterStatus(0, 0);
        listEl.innerHTML = `
            <div class="empty-state ritual-empty-state" data-motif="ARCHIVE ERROR">
                <div class="empty-state-sigil">⚠</div>
                <div class="empty-state-title">祈愿试炼加载失败</div>
                <p class="empty-state-note">神谕名录暂时无法读取。请刷新页面，或稍后再观测当前试炼切片。</p>
            </div>`;
        return;
    }
    if (!usingPagedArchive) totalDungeons = dungeons.length;
    if (!usingPagedArchive && searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        dungeons = dungeons.filter(d => [
            d.name,
            d.creator,
            getCoCreators(d).join(' '),
            d.type,
            d.description,
            formatGodName(d.type),
            formatGodPath(d.type),
            formatDifficulty(d.difficulty)
        ].some(value => String(value || '').toLowerCase().includes(q)));
    }
    if (!usingPagedArchive && selectedPath !== 'all') dungeons = dungeons.filter(d => dungeonHasPath(d.type, selectedPath));
    if (!usingPagedArchive && selectedGod !== 'all') dungeons = dungeons.filter(d => dungeonHasGod(d.type, selectedGod));
    if (!usingPagedArchive && selectedDifficulty !== 'all') dungeons = dungeons.filter(d => normalizeDifficulty(d.difficulty) === selectedDifficulty);
    if (!usingPagedArchive && reviewFilter === 'pending') dungeons = dungeons.filter(d => getDungeonReviewStatus(d) === 'pending');
    if (!usingPagedArchive && currentSort === 'popular') dungeons.sort((a,b) =>
        (b.rating_count||0) - (a.rating_count||0) ||
        (b.avg_rating||0) - (a.avg_rating||0) ||
        (b.comment_count||0) - (a.comment_count||0) ||
        new Date(b.created_at) - new Date(a.created_at)
    );
    else if (!usingPagedArchive && currentSort === 'rating') dungeons.sort((a,b) => (b.avg_rating||0)-(a.avg_rating||0));
    else if (!usingPagedArchive && currentSort === 'newest') dungeons.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    else if (!usingPagedArchive && currentSort === 'comments') dungeons.sort((a,b) => (b.comment_count||0)-(a.comment_count||0));
    updateDiscoveryFilterStatus(totalDungeons, dungeons.length);
    archiveFilteredDungeons = [...dungeons];
    if (!dungeons.length) {
        archivePage = 1;
        const filtered = searchQuery || selectedGod !== 'all' || selectedPath !== 'all' || selectedDifficulty !== 'all' || reviewFilter !== 'all';
        listEl.innerHTML = renderArchiveEmptyState(!!filtered);
        await renderOracleSidebar([], archiveSidebar);
        return;
    }
    if (!usingPagedArchive) {
        pageCount = Math.max(1, Math.ceil(dungeons.length / ARCHIVE_PAGE_SIZE));
        archivePage = Math.min(Math.max(1, archivePage), pageCount);
        pageStart = (archivePage - 1) * ARCHIVE_PAGE_SIZE;
    }
    const visibleDungeons = usingPagedArchive ? dungeons : dungeons.slice(pageStart, pageStart + ARCHIVE_PAGE_SIZE);
    listEl.innerHTML = visibleDungeons.map((d,i) => {
        const godLabel = formatGodName(d.type);
        const godPath = formatGodPath(d.type);
        const godClass = getGodClass(d.type);
        const pathMeta = getPathMetaByGod(d.type);
        const skin = getGodSkin(d.type);
        const godStyle = getGodSkinStyle(d.type);
        const difficultyLabel = formatDifficulty(d.difficulty);
        const divineClass = isDivineTrial(d) ? 'divine-trial' : '';
        const score = Number(d.avg_rating || 0);
        const ratingValue = score ? score.toFixed(1) : '—';
        const testimonyCount = Number(d.comment_count || 0);
        const godSigil = renderGodSigil(d.type, 'lg', 'god-emblem');
        const trialIndex = pageStart + i + 1;
        return `
        <div class="dungeon-card ${godClass} ${divineClass}" data-dungeon-id="${escapeHtml(d.id)}" data-god="${escapeHtml(getGodInfo(d.type).god)}" data-motif="${escapeHtml(skin.motif)}" data-particle="${escapeHtml(skin.particle)}" style="${godStyle}" onclick='openDetail(${jsString(d.id)})'>
            <div class="trial-card-head">
                <div class="trial-title-block">
                    ${godSigil}
                    <div>
                        <div class="card-title-line">
                            <span class="card-title">${escapeHtml(d.name||'未命名试炼')}</span>
                            <span class="trial-number">试炼编号 #${trialIndex}</span>
                        </div>
                        <div class="trial-subline">${escapeHtml(godPath)}命途 · ${escapeHtml(godLabel)}</div>
                    </div>
                </div>
                <div class="judgement-badge" aria-label="神格判定">
                    <span class="judgement-score">🎲 神格判定：${ratingValue}</span>
                    <span class="judgement-tier">${escapeHtml(getRatingTier(score))}</span>
                    <span class="judgement-count">评议人次 (${Number(d.rating_count || 0)})</span>
                </div>
            </div>
            <div class="trial-identity-row">
                <span class="author-mark ${isVeteranArchitect(d) ? 'master' : ''}">${getArchitectLabel(d)}${escapeHtml(formatCreatorLine(d))}</span>
                <span class="tag god-tag lore-tag ${godClass}" data-prayer="${escapeHtml(getGodPrayer(d.type))}">${escapeHtml(godLabel)}</span>
                <span class="tag path-tag lore-tag ${godClass}" data-prayer="${escapeHtml(pathMeta.edict)}">${escapeHtml(godPath)}命途</span>
                <span class="tag danger-stamp ${getDiffClass(d.difficulty)} ${godClass}-difficulty">${escapeHtml(difficultyLabel)}</span>
                <span class="tag lore-tag ${isOneShotDungeon(d) ? 'divine-tag' : ''}">${escapeHtml(formatTrialArchive(d))}</span>
                ${isDungeonApproved(d) ? '' : `<span class="tag divine-tag">${escapeHtml(formatDungeonReviewStatus(d))}</span>`}
                ${isDivineTrial(d) ? '<span class="tag divine-tag">神级愚戏</span>' : ''}
                <span class="trial-data-pill">🎲 ${formatDate(d.created_at)}降下</span>
            </div>
            <div class="trial-data-row">
                <span class="trial-data-pill">同契人数：<strong>${formatContractSize(d)}</strong></span>
                <span class="trial-data-pill">试炼轮回：<strong>${escapeHtml(getTrialCycle(d))}</strong></span>
                <span class="trial-data-pill">归档：<strong>${escapeHtml(formatTrialArchive(d))}</strong></span>
                <span class="trial-data-pill">通关留存率：<strong>${formatClearRate(d)}</strong></span>
                <span class="trial-data-pill">证言条数：<strong>${testimonyCount}</strong></span>
            </div>
            ${renderTrialOracle(d, godClass)}
        </div>`;
    }).join('') + renderArchivePagination(usingPagedArchive ? totalDungeons : dungeons.length, archivePage, pageCount);
    await renderOracleSidebar(dungeons, archiveSidebar);
    if (archiveFocusId) {
        const pendingFocusId = archiveFocusId;
        archiveFocusId = null;
        requestAnimationFrame(() => {
            markLinkedOracle(pendingFocusId);
            highlightArchiveCard(pendingFocusId);
        });
    }
}

function getDiffClass(d) { const m={新手:'difficulty-newbie',低:'difficulty-low',中:'difficulty-medium',高:'difficulty-high'}; return m[normalizeDifficulty(d)]||'difficulty-medium'; }
function isDivineTrial(d) {
    return Number(d.avg_rating || 0) >= 4.8 && Number(d.rating_count || 0) >= 1;
}

function formatParticipants(d) {
    const count = Number(d.participant_count || d.participantCount);
    return Number.isFinite(count) && count > 0 ? `同契人数：${count} 人组队` : '同契人数：未定';
}
function getParticipantCount(d) {
    const count = Number(d.participant_count || d.participantCount);
    return Number.isFinite(count) && count > 0 ? count : 0;
}
function getRunCount(d) {
    const count = Number(d.run_count || d.runCount);
    return Number.isFinite(count) && count > 0 ? count : 1;
}
function getClearCount(d) {
    const count = Number(d.clear_count || d.clearCount);
    return Number.isFinite(count) && count >= 0 ? count : 0;
}
function getTotalSlots(d) {
    return getParticipantCount(d) * getRunCount(d);
}
function formatRunCount(d) {
    return `试炼轮回：${getTrialCycle(d)}`;
}
function formatClearRate(d) {
    const stored = Number(d.clear_rate ?? d.clearRate);
    const slots = getTotalSlots(d);
    const value = Number.isFinite(stored) ? stored : (slots > 0 ? (getClearCount(d) / slots) * 100 : 0);
    return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}
function formatClearSlots(d) {
    const slots = getTotalSlots(d);
    return `${getClearCount(d)} / ${slots || '未定'}`;
}
function getDungeonReviewStatus(d) {
    return String(d?.review_status || 'approved');
}
function isDungeonApproved(d) {
    return getDungeonReviewStatus(d) === 'approved';
}
function formatDungeonReviewStatus(d) {
    const status = getDungeonReviewStatus(d);
    if (status === 'pending') return '待审核';
    if (status === 'rejected') return '已退回';
    return '已发布';
}
function truncateText(value, length = 80) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > length ? `${text.slice(0, length)}…` : text;
}

function canEditPinned(d) {
    const sessionName = String(inviteSession?.name || '').trim();
    const sessionNameKey = normalizeNameKey(sessionName);
    const sessionCode = String(inviteSession?.code || '').trim();
    const creator = String(d?.creator || '').trim();
    const inviteName = String(d?.invite_name || d?.inviteName || '').trim();
    const inviteHash = String(d?.invite_code_hash || d?.inviteCodeHash || '').trim();
    return isAdmin() ||
        d?.can_manage === true ||
        (!!sessionCode && !!inviteHash && sessionCode === inviteHash) ||
        (!!sessionNameKey && (sessionNameKey === normalizeNameKey(creator) || sessionNameKey === normalizeNameKey(inviteName))) ||
        isCoCreatorName(d, sessionName);
}

function canManageDungeon(d) {
    return canEditPinned(d);
}
function canReviewDungeon(d) {
    return canReviewDungeonsUI();
}

function canDeleteComment(c) {
    return isAdmin() || (!!inviteSession?.name && !!c.invite_name && inviteSession.name === c.invite_name) || (USE_LOCAL_FALLBACK && c.invite_code_hash === inviteSession?.code);
}

function buildCommentTree(comments) {
    const map = new Map();
    comments.forEach(comment => map.set(comment.id, { ...comment, replies: [] }));
    const roots = [];
    map.forEach(comment => {
        const parentId = comment.parent_comment_id || comment.parentCommentId;
        const parent = parentId ? map.get(parentId) : null;
        if (parent) parent.replies.push(comment);
        else roots.push(comment);
    });
    return roots;
}

function renderCommentHonorBadges(comment) {
    const titles = normalizeProfileTitleList(comment.active_titles || comment.activeTitles, comment.active_title || comment.activeTitle);
    const curses = normalizeProfileCurseList(comment.active_curses || comment.activeCurses, comment.active_curse || comment.activeCurse);
    const titleBadges = titles.slice(0, 3).map(title => {
        const god = title.titleGod || '命运';
        return `<span class="comment-honor-badge title" style="${getGodSkinStyle(god)}" title="${escapeHtml(`${god}｜${title.titleText}${title.titleNote ? `｜${title.titleNote}` : ''}`)}">神诞 · ${escapeHtml(title.titleText)}</span>`;
    });
    const curseBadges = curses.slice(0, 2).map(curse => {
        const god = curse.curseGod || '命运';
        const typeLabel = getProfileCurseBadgeLabel(curse.curseType);
        const visibleText = curse.curseNote
            ? `${curse.curseText}｜${truncateText(curse.curseNote, 14)}`
            : curse.curseText;
        return `<span class="comment-honor-badge curse" style="${getGodSkinStyle(god)}" title="${escapeHtml(`${god}｜${getProfileCurseTypeLabel(curse.curseType)}｜${curse.curseText}${curse.curseNote ? `｜${curse.curseNote}` : ''}`)}">${escapeHtml(typeLabel)} · ${escapeHtml(visibleText)}</span>`;
    });
    const extra = Math.max(0, titles.length - 3) + Math.max(0, curses.length - 2);
    const extraBadge = extra ? [`<span class="comment-honor-badge" title="还有 ${extra} 条称号或诅咒">+${extra}</span>`] : [];
    const badges = [...titleBadges, ...curseBadges, ...extraBadge];
    return badges.length ? `<span class="comment-honor-stack">${badges.join('')}</span>` : '';
}

function renderCommentNode(comment, depth = 0, floorNumber = '', creator = '') {
    const deleted = !!comment.is_deleted;
    const canReply = canInteract() && !deleted;
    const isReply = depth > 0;
    const isArchitect = !!creator && (comment.author === creator || comment.invite_name === creator);
    const roleLabel = isReply ? '副证言' : '主证言';
    const floorLabel = isReply ? '楼中证言' : `第 ${floorNumber} 则证言`;
    const replyLabel = isReply ? '回应副证' : '回应主证';
    const deleteButton = canDeleteComment(comment) && !deleted
        ? `<button type="button" class="text-action" data-delete-comment-id="${escapeHtml(comment.id)}">抹去证言</button>`
        : '';
    const replyAuthor = comment.author || comment.invite_name || '匿名';
    const honorBadges = renderCommentHonorBadges(comment);
    return `
        <div class="comment-item ${isReply ? 'reply' : 'root'} ${isArchitect ? 'architect' : ''}">
            <div class="comment-head">
                <div class="comment-author-line">
                    <span class="comment-role ${isReply ? 'reply' : 'root'}">${roleLabel}</span>
                    <span class="comment-author">${escapeHtml(comment.author || comment.invite_name || '匿名')}</span>
                    ${honorBadges}
                    <span class="comment-floor">${escapeHtml(floorLabel)}</span>
                </div>
                <span class="comment-time">${formatDate(comment.created_at)}</span>
            </div>
            <div class="comment-content ${deleted ? 'deleted-comment' : ''}">${escapeHtml(comment.content || '')}</div>
            <div class="comment-actions">
                ${canReply ? `<button type="button" class="text-action" data-reply-comment-id="${escapeHtml(comment.id)}" data-reply-author="${escapeHtml(replyAuthor)}">${replyLabel}</button>` : ''}
                ${deleteButton}
            </div>
            ${(comment.replies || []).length ? `<div class="comment-replies">${comment.replies.map(reply => renderCommentNode(reply, depth + 1, '', creator)).join('')}</div>` : ''}
        </div>`;
}

function renderComments(comments, creator = '') {
    const roots = buildCommentTree(comments);
    if (!roots.length) return '<div class="no-comments">尚无证言，成为第一位向试炼证言殿递交见闻的入局者。</div>';
    return roots.map((comment, index) => renderCommentNode(comment, 0, index + 1, creator)).join('');
}

function renderFeedbackTags(disabled) {
    return CLEAR_FEEDBACK_OPTIONS.map(tag => `<button type="button" class="feedback-chip" ${disabled ? 'disabled' : ''} onclick="toggleFeedbackTag(this)">${escapeHtml(tag)}</button>`).join('');
}

function renderFeedbackSummary(summary) {
    if (!summary.length) return '<div class="feedback-summary-title">暂无通关反馈标签</div>';
    return `
        <div class="feedback-summary-title">入局者通关反馈</div>
        <div class="feedback-summary-list">
            ${summary.map(item => `<span class="feedback-summary-pill">${escapeHtml(item.tag)} × ${Number(item.tag_count || 0)}</span>`).join('')}
        </div>`;
}

async function renderLatestComments() {
    const feed = document.getElementById('latestCommentsFeed');
    if (!feed) return;
    const comments = await fetchLatestComments(3);
    if (!comments.length) {
        feed.innerHTML = '<div class="feed-empty"><strong>神谕石壁暂时无声</strong><span>等第一位入局者递交证言，新的神谕会出现在这里。</span></div>';
        return;
    }
    const feedGlyphs = ['♟', '✦', '◈', '◇', '✧', '✷', '✹', '✺'];
    const feedMarks = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ'];
    feed.innerHTML = comments.map((comment, index) => {
        const dungeon = comment.dungeon || {};
        const title = dungeon.name || '未知试炼';
        const action = comment.parent_comment_id ? '楼中副证' : '递交证言';
        const godLabel = dungeon.type ? formatGodName(dungeon.type) : '未归档神明';
        const godPath = dungeon.type ? `${formatGodPath(dungeon.type)}命途` : '未知命途';
        const godClass = dungeon.type ? getGodClass(dungeon.type) : 'path-unknown';
        const difficultyLabel = dungeon.difficulty ? formatDifficulty(dungeon.difficulty) : '难度未定';
        const difficultyClass = dungeon.difficulty ? getDiffClass(dungeon.difficulty) : 'path-unknown';
        return `
            <article class="feed-item" onclick='openDetail(${jsString(comment.dungeon_id)})'>
                <div class="feed-sigil"><span>${feedGlyphs[index % feedGlyphs.length]}</span><small>${feedMarks[index] || index + 1}</small></div>
                <div class="feed-main">
                    <div class="feed-row">
                        <span class="feed-author">${escapeHtml(comment.author || '匿名探索者')}</span>
                        ${renderCommentHonorBadges(comment)}
                        <span class="feed-action">${escapeHtml(action)}</span>
                        <span class="feed-dungeon">《${escapeHtml(title)}》</span>
                    </div>
                    <div class="feed-lore">${escapeHtml(truncateText(comment.content, 120))}</div>
                    <div class="feed-meta">
                        <span class="mini-tag ${godClass}">${escapeHtml(godLabel)}</span>
                        <span class="mini-tag ${godClass}">${escapeHtml(godPath)}</span>
                        <span class="mini-tag ${difficultyClass}">${escapeHtml(difficultyLabel)}</span>
                    </div>
                </div>
                <time class="feed-time">${formatDate(comment.created_at)}</time>
            </article>`;
    }).join('');
}

async function openDetail(id) {
    const detailWasOpen = document.body.classList.contains('detail-view-open');
    if (!detailWasOpen) archiveScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    currentDetailId = id;
    replyTarget = null;
    const dungeons = await fetchDungeons();
    const summary = dungeons.find(d=>d.id===id);
    if(!summary){showToast('试炼未找到');return;}
    const [detail, comments, feedbackSummary, rated] = await Promise.all([
        fetchDungeonDetail(id),
        fetchComments(id),
        fetchClearFeedbackSummary(id),
        checkHasRated(id)
    ]);
    const d = detail || summary;
    const reviewStatus = getDungeonReviewStatus(d);
    const published = isDungeonApproved(d);
    const ratingLocked = !canInteract() || !published;
    const testimonyLocked = !canTestify() || !published;
    const ratingText = !published ? `此试炼${formatDungeonReviewStatus(d)}，暂不可判定` : (rated ? '✅ 你已经封存神格评议' : (ratingLocked ? '🎲 验入局谕令后可降下判定' : '选择 1-5 阶，封存你的神格评议'));
    const commentLockedAttrs = testimonyLocked ? 'disabled' : '';
    const commentPlaceholder = !published ? '副本通过审核后才可递交证言' : (testimonyLocked ? '验入局谕令后可递交证言' : getTestimonyPlaceholder(d.type));
    const runCount = getRunCount(d);
    const clearLocalKey = `${id}:${runCount}:${inviteSession?.code || 'guest'}`;
    const clearDone = !!getLocalData('cleared_supabase', {})[clearLocalKey];
    const clearButtonText = clearDone ? '通关名已入神谕' : '待审核刻名';
    const clearRateNumber = Number.parseFloat(formatClearRate(d)) || 0;
    const godLabel = formatGodName(d.type);
    const godPath = formatGodPath(d.type);
    const godClass = getGodClass(d.type);
    const godSigil = renderGodSigil(d.type, 'xl', 'detail-god-mark');
    const pathMeta = getPathMetaByGod(d.type);
    const skin = getGodSkin(d.type);
    const godStyle = getGodSkinStyle(d.type);
    const difficultyLabel = formatDifficulty(d.difficulty);
    const activeCommentCount = comments.filter(c => !c.is_deleted).length;
    const ratingScore = Number(d.avg_rating || 0);
    const ratingValue = ratingScore ? ratingScore.toFixed(1) : '—';
    const judgementControl = rated
        ? '<span class="judgement-seal">已封存判定</span>'
        : `<button class="btn btn-outline btn-sm" onclick="${ratingLocked ? `openInviteModal('验入局谕令后可为试炼降下神格判定。')` : `openRatingModal('${escapeHtml(id)}')`}">${ratingLocked ? '验入局谕令' : '降下你的判定'}</button>`;
    const pinnedNote = d.pinned_note || '';
    const canEditNote = canEditPinned(d);
    const reviewActionsHtml = canReviewDungeon(d) && reviewStatus !== 'approved' ? `
        <div class="profile-tools" style="margin:12px 0;">
            <button class="btn btn-primary btn-sm" onclick="reviewDungeonUI('${escapeHtml(id)}', 'approve')">审核通过</button>
            <button class="btn btn-outline btn-sm" onclick="reviewDungeonUI('${escapeHtml(id)}', 'reject')">退回副本</button>
        </div>` : '';
    const pinnedNoteHtml = pinnedNote || canEditNote ? `
        <div class="pinned-note">
            <div class="pinned-note-head">
                <span>📌 构筑者置顶神谕</span>
                ${canEditNote ? `<button class="text-action" onclick="togglePinnedEditor()">编辑</button>` : ''}
            </div>
            <div class="pinned-note-body" id="pinnedNoteBody">${pinnedNote ? escapeHtml(pinnedNote) : '构筑者还没有留下置顶神谕。'}</div>
            ${canEditNote ? `
                <div id="pinnedNoteEditor" style="display:none;margin-top:10px;">
                    <textarea id="pinnedNoteTextarea" maxlength="800" placeholder="写下开本时间、注意事项、车卡要求、构筑者补充神谕...">${escapeHtml(pinnedNote)}</textarea>
                    <div class="form-actions" style="margin-top:10px;">
                        <button class="btn btn-outline btn-sm" onclick="togglePinnedEditor(false)">取消</button>
                        <button class="btn btn-primary btn-sm" onclick="savePinnedNoteUI('${escapeHtml(id)}')">保存置顶</button>
                    </div>
                </div>` : ''}
        </div>` : '';
    document.getElementById('detailContent').innerHTML = `
        <section class="trial-entry-window ${godClass}" data-god="${escapeHtml(getGodInfo(d.type).god)}" data-motif="${escapeHtml(skin.motif)}" style="${godStyle}">
            <div class="trial-entry-head">
                ${renderGodSigil(d.type, 'lg')}
                <div>
                    <div class="trial-entry-kicker">${escapeHtml(skin.entryTitle)}</div>
                    <h3>${escapeHtml(d.name || '未命名试炼')}</h3>
                    <p>${escapeHtml(godPath)}命途 · ${escapeHtml(godLabel)} · 筑戏人：${escapeHtml(formatCreatorLine(d))}</p>
                </div>
                <div class="trial-entry-score">
                    <span>神格判定</span>
                    <strong>${ratingValue}</strong>
                    <small>${escapeHtml(getRatingTier(ratingScore))} · 评议人次 ${Number(d.rating_count || 0)}</small>
                </div>
            </div>
            <div class="trial-entry-meta">
                <span class="tag god-tag ${godClass}">${escapeHtml(godLabel)}</span>
                <span class="tag path-tag ${godClass}">${escapeHtml(godPath)}命途</span>
                <span class="tag ${getDiffClass(d.difficulty)} ${godClass}-difficulty">${escapeHtml(difficultyLabel)}</span>
                <span class="tag ${isOneShotDungeon(d) ? 'divine-tag' : ''}">${escapeHtml(formatTrialArchive(d))}</span>
                ${isDivineTrial(d) ? '<span class="tag divine-tag">神级愚戏</span>' : ''}
                <span class="trial-data-pill">${formatParticipants(d)}</span>
                <span class="trial-data-pill">${formatRunCount(d)}</span>
                <span class="trial-data-pill">归档：${escapeHtml(formatTrialArchive(d))}</span>
                <span class="trial-data-pill">通关留存率：${formatClearRate(d)}</span>
                <span class="trial-data-pill">证言条数：${activeCommentCount}</span>
                <span class="trial-data-pill">审核状态：${escapeHtml(formatDungeonReviewStatus(d))}</span>
                ${canSubmit() ? `<button class="btn btn-outline btn-xs" onclick="advanceRunUI('${escapeHtml(id)}')">重掷下一局</button>` : ''}
                ${canManageDungeon(d) ? `<button class="btn btn-outline btn-xs" onclick="editDungeonUI('${escapeHtml(id)}')">重铸绝境</button>` : ''}
                ${canManageDungeon(d) ? `<button class="btn btn-danger btn-xs" onclick="deleteDungeon('${escapeHtml(id)}')">封存试炼</button>` : ''}
            </div>
            <div class="trial-entry-body">
                <p><strong>神明专属说明：</strong>${escapeHtml(skin.entryHint)}</p>
                <p><strong>试炼说明：</strong>${escapeHtml(d.description || '此试炼尚未留下说明。')}</p>
                <p>${escapeHtml(skin.oracle)}</p>
            </div>
        </section>
        ${renderDetailDossier(d, { locked: ratingLocked, rated, clearDone, activeCommentCount })}
        ${reviewActionsHtml}
        ${pinnedNoteHtml}
        <div class="clear-panel">
            <div class="clear-panel-head">
                <span class="clear-panel-title">🎲 命运骰记录 · ${formatRunCount(d)}</span>
                <span class="clear-rate-big">${formatClearRate(d)}</span>
            </div>
            <div class="clear-progress"><div class="clear-progress-fill" style="width:${Math.max(0, Math.min(100, clearRateNumber))}%"></div></div>
            <div class="feedback-picker">
                <div class="feedback-tags">${renderFeedbackTags(true)}</div>
                <textarea id="clearFeedbackNote" class="feedback-note" maxlength="200" placeholder="通关由审核员结算确认；玩家不可自行登记。" disabled></textarea>
            </div>
            <div class="feedback-summary">${renderFeedbackSummary(feedbackSummary)}</div>
            <div class="clear-panel-foot">
                <span>已穿越裂隙 ${formatClearSlots(d)} 人次</span>
                <button class="btn btn-primary btn-sm" disabled>${clearButtonText}</button>
            </div>
        </div>
        <div class="rating-area judgement-area ${rated ? 'is-rated' : ''}">
            <div class="judgement-area-main">
                <span class="judgement-area-title">🎲 神格判定</span>
                <span class="rating-text">${ratingText}</span>
            </div>
            ${judgementControl}
        </div>
        <div class="comments-section">
            <div class="section-title">💬 试炼证言殿 (${activeCommentCount})</div>
            <div class="testimony-launch ${godClass}" data-god="${escapeHtml(getGodInfo(d.type).god)}" style="${godStyle}">
                <div>
                    <div class="testimony-launch-title">${renderGodSigil(d.type, 'sm')} 递交试炼证言</div>
                    <div class="testimony-launch-note">当前身份：<strong>${testimonyLocked ? '访客' : escapeHtml(inviteSession?.name || ROLE_LABELS[getInviteRole()] || '匿名')}</strong>。神谕记录将被留存，供后来信徒判断。</div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="${testimonyLocked?`openInviteModal('验入局谕令后可递交证言。')`:`openTestimonyModal('${escapeHtml(id)}')`}">${testimonyLocked?'验入局谕令':'递交证言'}</button>
            </div>
            <div id="commentsList">${renderComments(comments, d.creator)}</div>
        </div>`;
    const overlay = document.getElementById('detailOverlay');
    const panel = document.getElementById('detailPanel');
    overlay.className = `detail-overlay ${godClass}`;
    overlay.dataset.god = getGodInfo(d.type).god;
    overlay.setAttribute('style', `${godStyle};display:block;`);
    overlay.dataset.layout = 'page';
    document.body.classList.add('detail-view-open');
    panel.className = `detail-panel ${godClass}`;
    panel.dataset.god = getGodInfo(d.type).god;
    panel.setAttribute('style', godStyle);
    const footer = document.getElementById('detailFooter');
    if (footer) {
        footer.innerHTML = `
            <span class="detail-footer-note">${escapeHtml(skin.oracle)} · ${escapeHtml(skin.entryHint)}</span>
            <div class="detail-footer-actions">
                <button type="button" class="btn btn-outline btn-sm detail-leave-btn" onclick="closeDetail()">${escapeHtml(skin.cancelText)}</button>
                <button type="button" class="btn btn-primary btn-sm" onclick="focusTrialRecord()">${escapeHtml(skin.confirmText)}</button>
            </div>`;
    }
    const content = document.getElementById('detailContent');
    const resetDetailScroll = () => {
        if (content) content.scrollTo({ top: 0, behavior: 'auto' });
        panel.scrollTop = 0;
        overlay.scrollTop = 0;
        window.scrollTo(0, 0);
    };
    resetDetailScroll();
    requestAnimationFrame(() => requestAnimationFrame(resetDetailScroll));
}

function closeDetail(e){
    if(e && e.target!==document.getElementById('detailOverlay')) return;
    document.getElementById('detailOverlay').style.display='none';
    document.body.classList.remove('detail-view-open');
    document.body.style.overflow='';
    currentDetailId=null;
    requestAnimationFrame(() => window.scrollTo(0, archiveScrollY || 0));
}
function focusTrialRecord() {
    const target = document.getElementById('clearFeedbackNote') || document.querySelector('.clear-panel');
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof target.focus === 'function' && !target.disabled) target.focus();
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
        const { error, role, name } = USE_LOCAL_FALLBACK ? { error: null, role: 'author', name: '本地构筑者' } : await invokeDungeonAction('verifyInvite', {}, code);
        if (error || !role) { showToast(`❌ ${getFriendlyActionError(error, '入局谕令无效')}`); return; }
        resetTalentViewState();
        saveInviteSession({ role, code, name: name || ROLE_LABELS[role] });
        const profileRefresh = await refreshCurrentProfileFromCloud();
        if (profileRefresh.data?.displayName) {
            saveInviteSession({ role, code, name: profileRefresh.data.displayName });
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

function toggleFeedbackTag(button) {
    if (!button || button.disabled) return;
    button.classList.toggle('active');
}

function getSelectedFeedbackTags() {
    return [...document.querySelectorAll('.feedback-chip.active')].map(btn => btn.textContent.trim()).slice(0, 5);
}

async function openTestimonyModal(id, options = {}) {
    if(!requireInvite(['player','author','reviewer','admin','god'], '验入局谕令后可递交试炼证言。')) return;
    testimonyTargetId = id;
    const dungeons = await fetchDungeons();
    const d = dungeons.find(item => item.id === id);
    if (!d) { showToast('试炼未找到'); return; }
    if (!options.keepReply) replyTarget = null;
    const info = getGodInfo(d.type);
    const godClass = getGodClass(d.type);
    const skin = getGodSkin(d.type);
    const godStyle = getGodSkinStyle(d.type);
    const modal = document.getElementById('testimonyModal');
    const sigil = document.getElementById('testimonyModalSigil');
    const prayer = document.getElementById('testimonyModalPrayer');
    const dossier = document.getElementById('testimonyModalDossier');
    const input = document.getElementById('testimonyContentInput');
    if (modal) {
        modal.className = `modal ritual-modal ${godClass}`;
        modal.dataset.god = info.god;
        modal.setAttribute('style', godStyle);
    }
    if (sigil) sigil.innerHTML = renderGodSigil(d.type, 'xl', 'detail-god-mark');
    if (prayer) prayer.textContent = `${skin.oracle} —— ${info.god}之神`;
    if (dossier) {
        dossier.innerHTML = `
            <strong>${escapeHtml(d.name || '未命名试炼')}</strong>
            <span>${escapeHtml(info.god)}之神 · ${escapeHtml(info.path)}命途<br>难度：${escapeHtml(formatDifficulty(d.difficulty))} · 通关留存率：${formatClearRate(d)}</span>
        `;
    }
    if (input) {
        input.value = '';
        input.placeholder = getTestimonyPlaceholder(d.type);
    }
    syncReplyContext();
    document.getElementById('testimonyModalOverlay').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    document.getElementById('testimonyModal')?.scrollTo?.(0, 0);
    if (shouldAutoFocusModalInput()) setTimeout(() => input?.focus(), 50);
}

function closeTestimonyModal(e) {
    if(e && e.target!==document.getElementById('testimonyModalOverlay')) return;
    document.getElementById('testimonyModalOverlay').style.display='none';
    const detailVisible = getComputedStyle(document.getElementById('detailOverlay')).display !== 'none';
    document.body.style.overflow = '';
}

async function setRatingModalContext(id) {
    const dungeons = await fetchDungeons();
    const d = dungeons.find(item => item.id === id);
    if (!d) return;
    const info = getGodInfo(d.type);
    const godClass = getGodClass(d.type);
    const skin = getGodSkin(d.type);
    const godStyle = getGodSkinStyle(d.type);
    const modal = document.getElementById('ratingModal');
    const sigil = document.getElementById('ratingModalSigil');
    const prayer = document.getElementById('ratingModalPrayer');
    const dossier = document.getElementById('ratingModalDossier');
    if (modal) {
        modal.className = `modal judgement-modal ritual-modal ${godClass}`;
        modal.dataset.god = info.god;
        modal.setAttribute('style', godStyle);
    }
    if (sigil) sigil.innerHTML = renderGodSigil(d.type, 'xl', 'detail-god-mark');
    if (prayer) prayer.textContent = `${skin.oracle} —— ${info.god}之神`;
    if (dossier) {
        dossier.innerHTML = `
            <strong>${escapeHtml(d.name || '未命名试炼')}</strong>
            <span>${escapeHtml(info.god)}之神 · ${escapeHtml(info.path)}命途<br>难度：${escapeHtml(formatDifficulty(d.difficulty))} · 通关留存率：${formatClearRate(d)}</span>
        `;
    }
}

function syncReplyContext() {
    const contexts = [
        [document.getElementById('replyContext'), document.getElementById('replyContextText')],
        [document.getElementById('testimonyReplyContext'), document.getElementById('testimonyReplyContextText')]
    ];
    contexts.forEach(([context, text]) => {
        if (!context || !text) return;
        context.style.display = replyTarget ? 'flex' : 'none';
        if (replyTarget) text.textContent = `正在回应 ${replyTarget.author}，会显示在这条证言下面`;
    });
}

async function setReplyTarget(commentId, author) {
    replyTarget = { id: commentId, author };
    syncReplyContext();
    if (currentDetailId) await openTestimonyModal(currentDetailId, { keepReply: true });
}

function clearReplyTarget() {
    replyTarget = null;
    syncReplyContext();
    const input = document.getElementById('testimonyContentInput');
    if (input && testimonyTargetId) input.placeholder = '敬献你在这场愚戏中的证言……';
}

function togglePinnedEditor(force) {
    const editor = document.getElementById('pinnedNoteEditor');
    if (!editor) return;
    const next = typeof force === 'boolean' ? force : editor.style.display === 'none';
    editor.style.display = next ? 'block' : 'none';
    if (next) document.getElementById('pinnedNoteTextarea')?.focus();
}

async function savePinnedNoteUI(id) {
    if(!requireInvite(['author','reviewer','admin'], '只有试炼构筑者、结算审核员或神谕馆主可以修改置顶神谕。')) return;
    const note = document.getElementById('pinnedNoteTextarea')?.value || '';
    const { error } = await savePinnedNote(id, note);
    if(error){ showToast(`❌ ${error.message || '保存失败'}`); return; }
    showToast('📌 置顶神谕已更新');
    await openDetail(id);
    await renderDungeonList();
}

async function openRatingModal(id) {
    if(!requireInvite(['player','author','reviewer','admin'], '验入局谕令后可为试炼降下神格判定。')) return;
    if (await checkHasRated(id)) {
        showToast('你已经封存过这场试炼的神格评议。');
        if (currentDetailId === id) await openDetail(id);
        return;
    }
    pendingRating = { dungeonId: id, value: 5 };
    await setRatingModalContext(id);
    renderRatingChoices();
    document.getElementById('ratingModalOverlay').style.display='flex';
    document.body.style.overflow='hidden';
}

function closeRatingModal(e) {
    if(e && e.target!==document.getElementById('ratingModalOverlay')) return;
    document.getElementById('ratingModalOverlay').style.display='none';
    const detailVisible = getComputedStyle(document.getElementById('detailOverlay')).display !== 'none';
    document.body.style.overflow = '';
}

function renderRatingChoices() {
    const grid = document.getElementById('ratingChoiceGrid');
    if (!grid) return;
    grid.innerHTML = [5,4,3,2,1].map(value => {
        const copy = getRatingCopy(value);
        const [tier, text] = copy.split('：');
        return `
            <button type="button" class="rating-choice ${pendingRating.value === value ? 'active' : ''}" onclick="selectRatingValue(${value})">
                <span class="rating-choice-mark">🎲${value}</span>
                <span><strong>${escapeHtml(tier || value)}</strong>${escapeHtml(text || copy)}</span>
            </button>`;
    }).join('');
}

function selectRatingValue(value) {
    pendingRating.value = value;
    renderRatingChoices();
}

async function submitRatingJudgement() {
    if (!pendingRating.dungeonId || !pendingRating.value) { showToast('请选择神格判定'); return; }
    const { dungeonId, value } = pendingRating;
    if (await checkHasRated(dungeonId)) {
        closeRatingModal();
        showToast('你已经封存过这场试炼的神格评议。');
        if (currentDetailId === dungeonId) await openDetail(dungeonId);
        return;
    }
    closeRatingModal();
    await rateDungeon(dungeonId, value);
}

async function rateDungeon(id, val){
    if(!requireInvite(['player','author','reviewer','admin'], '验入局谕令后可为试炼降下神格判定。')) return;
    const lockKey = `rateDungeon:${id}`;
    if (!acquireUiActionLock(lockKey, '神格评议正在封存，请勿重复点击')) return;
    if (await checkHasRated(id)) {
        releaseUiActionLock(lockKey);
        showToast('你已经封存过这场试炼的神格评议。');
        if(currentDetailId===id) await openDetail(id);
        return;
    }
    try {
        const {error}=await addRating(id,val);
        if(error){
            if (error.message?.includes('已经')) {
                markAsRated(id);
                showToast('⚠️ 你已经封存过神格评议了');
                if(currentDetailId===id) await openDetail(id);
                return;
            }
            showToast(`❌ ${error.message || '判定失败'}`);
            return;
        }
        markAsRated(id);
        showToast('🎲 神格评议已封存');
        if(currentDetailId===id) await openDetail(id);
        await renderDungeonList();
    } finally {
        releaseUiActionLock(lockKey);
    }
}

async function submitComment(id){
    if(!requireInvite(['player','author','reviewer','admin','god'], '验入局谕令后可递交试炼证言。')) return;
    const lockKey = `submitComment:${id}:${replyTarget?.id || 'root'}`;
    if (!acquireUiActionLock(lockKey, '证言正在递交，请勿重复点击')) return;
    const a=inviteSession?.name || ROLE_LABELS[getInviteRole()] || '';
    const input = document.getElementById('testimonyContentInput') || document.getElementById('commentContentInput');
    const c=input?.value.trim();
    if(!c){releaseUiActionLock(lockKey);showToast('请输入证言');return;}
    try {
        const {error}=await addComment(id,a,c, replyTarget?.id || null);
        if(error){showToast(`❌ ${error.message || '证言失败'}`);return;}
        showToast(replyTarget ? '↩️ 副证言已递交' : '💬 主证言已递交');
        clearReplyTarget();
        closeTestimonyModal();
        if(input) input.value='';
        if(currentDetailId===id) await openDetail(id);
        await renderDungeonList();
        await renderLatestComments();
        await updateProfileNoticeBadge();
        if (document.getElementById('profilePage')?.style.display !== 'none') await renderProfilePage();
    } finally {
        releaseUiActionLock(lockKey);
    }
}

async function deleteCommentUI(commentId){
    if(!requireInvite(['player','author','reviewer','admin','god'], '验入局谕令后才可抹去自己的证言。')) return;
    if(!confirm('确定抹去这条证言吗？')) return;
    const lockKey = `deleteComment:${commentId}`;
    if (!acquireUiActionLock(lockKey, '证言正在抹去，请勿重复点击')) return;
    try {
        const {error}=await removeComment(commentId);
        if(error){showToast(`❌ ${error.message || '删除失败'}`);return;}
        showToast('证言已抹去');
        if(currentDetailId) await openDetail(currentDetailId);
        await renderDungeonList();
        await renderLatestComments();
        await updateProfileNoticeBadge();
        if (document.getElementById('profilePage')?.style.display !== 'none') await renderProfilePage();
    } finally {
        releaseUiActionLock(lockKey);
    }
}

async function markClearedUI(id){
    if(!requireInvite(['player','author','reviewer','admin'], '验入局谕令后可登记通关。')) return;
    const lockKey = `markCleared:${id}`;
    if (!acquireUiActionLock(lockKey, '通关登记正在提交，请勿重复点击')) return;
    const feedbackTags = getSelectedFeedbackTags();
    const feedbackNote = document.getElementById('clearFeedbackNote')?.value || '';
    try {
        const {error}=await markDungeonCleared(id, feedbackTags, feedbackNote);
        if(error){ showToast(`❌ ${error.message || '登记失败'}`); return; }
        const dungeons = await fetchDungeons();
        const d = dungeons.find(d => d.id === id);
        const key = `${id}:${getRunCount(d || {})}:${inviteSession?.code || 'guest'}`;
        const cleared = getLocalData('cleared_supabase', {});
        cleared[key] = true;
        setLocalData('cleared_supabase', cleared);
        showToast('🎲 已记录本局通关');
        if(currentDetailId===id) await openDetail(id);
        await renderDungeonList();
        await renderLatestComments();
        if (document.getElementById('profilePage')?.style.display !== 'none') await renderProfilePage();
    } finally {
        releaseUiActionLock(lockKey);
    }
}

async function advanceRunUI(id){
    if(!requireInvite(['author','reviewer','admin','god'], '只有试炼构筑者、结算审核员、神明或神谕馆主可以重掷下一局。')) return;
    if(!confirm('确定重掷下一局吗？通关率会按新的总参与人次重新计算。')) return;
    const lockKey = `advanceRun:${id}`;
    if (!acquireUiActionLock(lockKey, '下一局正在重掷，请勿重复点击')) return;
    try {
        const {error}=await advanceDungeonRun(id);
        if(error){ showToast(`❌ ${error.message || '开启失败'}`); return; }
        showToast('🎲 已重掷下一局');
        if(currentDetailId===id) await openDetail(id);
        await renderDungeonList();
    } finally {
        releaseUiActionLock(lockKey);
    }
}

async function editDungeonUI(id) {
    if(!requireInvite(['author','reviewer','admin','god'], '只有试炼构筑者、同契共筑者或神谕馆主可以重铸绝境。')) return;
    const dungeons = await fetchDungeons();
    const dungeon = dungeons.find(item => String(item.id) === String(id));
    if (!dungeon) { showToast('试炼未找到'); return; }
    if (!canManageDungeon(dungeon)) { showToast('只有副本作者、同契共筑者或馆主可以重铸绝境'); return; }
    const detail = await fetchDungeonDetail(id);
    openSubmitModal(detail || dungeon);
}

function setSubmitModalMode(dungeon = null) {
    editingDungeonId = dungeon?.id || '';
    const isEditing = !!editingDungeonId;
    const modalTitle = document.querySelector('#submitModal h2');
    const submitButton = document.querySelector('#submitForm button[type="submit"]');
    if (modalTitle) modalTitle.textContent = isEditing ? '🜂 《重铸绝境》' : (isGodRole() ? '✦ 《祈愿创本》' : '🎭 《构筑你的试炼愚戏》');
    if (submitButton) submitButton.textContent = isEditing ? '重铸绝境' : (isGodRole() ? '降下祈愿创本' : '献祭试炼至圣殿');
}

function fillSubmitModal(dungeon = null) {
    const form = document.getElementById('submitForm');
    if (!form) return;
    form.reset();
    resetSubmitDefaults();
    const creatorInput = document.getElementById('dungeonCreator');
    if (creatorInput) {
        creatorInput.disabled = false;
        creatorInput.readOnly = false;
        creatorInput.removeAttribute('aria-readonly');
    }
    if (!dungeon) {
        if (creatorInput && !creatorInput.value && inviteSession?.name && !inviteSession.name.includes('共享')) creatorInput.value = inviteSession.name;
        return;
    }
    document.getElementById('dungeonName').value = dungeon.name || '';
    document.getElementById('dungeonCreator').value = dungeon.creator || '';
    document.getElementById('dungeonCoCreators').value = getCoCreators(dungeon).join('、');
    document.getElementById('dungeonDifficulty').value = normalizeDifficulty(dungeon);
    document.getElementById('participantCount').value = Number(dungeon.participant_count || dungeon.participantCount || 1) || 1;
    document.getElementById('runCount').value = getRunCount(dungeon);
    document.getElementById('dungeonDesc').value = dungeon.description || '';
    document.getElementById('pinnedNoteInput').value = dungeon.pinned_note || '';
    document.getElementById('dungeonMode').value = isOneShotDungeon(dungeon) ? 'one_shot' : 'cycle';
    setSelectedSubmitGods(splitGodTags(dungeon.type));
}

function openSubmitModal(dungeon = null){
    if(!requireInvite(['author','reviewer','admin','god'], '只有试炼构筑者、结算审核员、神明或神谕馆主可以构筑试炼。')) return;
    try {
        setSubmitModalMode(dungeon);
        fillSubmitModal(dungeon);
        const creatorInput = document.getElementById('dungeonCreator');
        if (creatorInput) {
            creatorInput.readOnly = isGodRole();
            creatorInput.setAttribute('aria-readonly', isGodRole() ? 'true' : 'false');
        }
        document.getElementById('submitModalOverlay').style.display='flex';
        document.body.style.overflow='hidden';
        document.getElementById('dungeonName').focus();
    } catch (error) {
        console.error('打开构筑窗口失败:', error);
        showToast('构筑窗口打开失败，请刷新后再试');
    }
}

function resetSubmitDefaults() {
    const godSelect = document.getElementById('dungeonType');
    const diffSelect = document.getElementById('dungeonDifficulty');
    const modeSelect = document.getElementById('dungeonMode');
    if (godSelect) Array.from(godSelect.options).forEach(option => { option.selected = false; });
    syncSubmitGodPicker();
    if (diffSelect) diffSelect.value = '中';
    if (modeSelect) modeSelect.value = 'cycle';
}

function closeSubmitModal(e){
    if(e && e.target!==document.getElementById('submitModalOverlay')) return;
    document.getElementById('submitModalOverlay').style.display='none';
    document.body.style.overflow='';
    document.getElementById('submitForm').reset();
    editingDungeonId = '';
    const creatorInput = document.getElementById('dungeonCreator');
    if (creatorInput) {
        creatorInput.disabled = false;
        creatorInput.readOnly = false;
        creatorInput.removeAttribute('aria-readonly');
    }
    resetSubmitDefaults();
    setSubmitModalMode(null);
}

function focusSubmitField(targetId, message) {
    showToast(message);
    const target = document.getElementById(targetId);
    const focusTarget = target?.closest('.form-group') || target;
    focusTarget?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (target && typeof target.focus === 'function' && target.tabIndex !== -1 && !target.disabled) {
        setTimeout(() => target.focus(), 180);
    }
}

async function submitDungeon(e){
    e.preventDefault();
    if(!requireInvite(['author','reviewer','admin','god'], '只有试炼构筑者、结算审核员、神明或神谕馆主可以构筑试炼。')) return;
    const name=document.getElementById('dungeonName').value.trim();
    const creator=isGodRole() ? (inviteSession?.name || '') : document.getElementById('dungeonCreator').value.trim();
    const coCreators=parseCoCreators(document.getElementById('dungeonCoCreators')?.value || '');
    const difficulty=document.getElementById('dungeonDifficulty').value;
    const selectedTypes=getSelectedSubmitGods();
    const type=selectedTypes.join('、');
    const participantCount=Number(document.getElementById('participantCount').value);
    const runCount=Number(document.getElementById('runCount').value);
    const desc=document.getElementById('dungeonDesc').value.trim();
    const pinnedNote=document.getElementById('pinnedNoteInput')?.value.trim() || '';
    const dungeonMode=document.getElementById('dungeonMode')?.value || 'cycle';
    const isOneShot=dungeonMode==='one_shot';
    if(!name){focusSubmitField('dungeonName', '请填写试炼名');return;}
    if(!creator){focusSubmitField('dungeonCreator', '请填写构筑者');return;}
    if(!selectedTypes.length){focusSubmitField('dungeonGodPicker', '请至少选择一个神明标签');return;}
    if(!Number.isInteger(participantCount)||participantCount<1||participantCount>99){focusSubmitField('participantCount', '请检查固定人数');return;}
    if(!Number.isInteger(runCount)||runCount<1||runCount>999){focusSubmitField('runCount', '请检查当前局数');return;}
    if(!desc){focusSubmitField('dungeonDesc', '请填写试炼简介');return;}
    const btn=e.target.querySelector('button[type="submit"]');
    const dungeonId = editingDungeonId;
    const lockKey = dungeonId ? `submitDungeon:${dungeonId}` : 'submitDungeon:new';
    if (!acquireUiActionLock(lockKey, dungeonId ? '试炼正在重铸，请勿重复点击' : '试炼正在献祭，请勿重复点击')) return;
    btn.disabled=true;
    btn.textContent=dungeonId ? '重铸中...' : '献祭中...';
    try {
        const {data, error}=await addDungeon({dungeonId,name,creator,coCreators,difficulty,type,participantCount,runCount,description:desc,pinnedNote,isOneShot,dungeonMode});
        if(error){showToast(`❌ ${error.message || '失败'}`);return;}
        const submittedStatus = data?.review_status || (canReviewDungeonsUI() ? 'approved' : 'pending');
        const successText = submittedStatus === 'approved'
            ? (dungeonId ? '绝境已重铸并发布' : '试炼已正式发布')
            : (dungeonId ? '绝境已重铸，等待副本审核员复核' : '试炼已提交，等待副本审核员审核后发布');
        showToast(successText);
        closeSubmitModal();
        if (dungeonId) await openDetail(dungeonId);
        await renderDungeonList();
        await renderLatestComments();
        await updateProfileNoticeBadge();
        if (document.getElementById('profilePage')?.style.display !== 'none') await renderProfilePage();
    } finally {
        btn.disabled=false;
        btn.textContent=dungeonId ? '重铸绝境' : (isGodRole() ? '降下祈愿创本' : '献祭试炼至圣殿');
        releaseUiActionLock(lockKey);
    }
}

async function reviewDungeonUI(id, decision) {
    if (!canReviewDungeonsUI()) { showToast('需要副本审核员权限'); return; }
    const approve = decision === 'approve';
    const note = approve ? '' : (prompt('填写退回原因（可选）') || '').trim().slice(0, 800);
    if (!approve && !confirm('确定退回这个副本吗？作者可重铸后再次提交。')) return;
    const lockKey = `reviewDungeon:${id}`;
    if (!acquireUiActionLock(lockKey, '副本正在审核，请勿重复点击')) return;
    try {
        const { error } = await reviewDungeon(id, decision, note);
        if (error) { showToast(`❌ ${error.message || '审核失败'}`); return; }
        showToast(approve ? '副本已审核通过并发布' : '副本已退回');
        await renderDungeonList();
        await openDetail(id);
    } finally {
        releaseUiActionLock(lockKey);
    }
}

async function deleteDungeon(id) {
    if(!requireInvite(['author','reviewer','admin','god'], '只有副本作者、同契共筑者或神谕馆主可以封存试炼。')) return;
    if(!confirm('确定封存这场试炼吗？神格判定和证言会一起消失。')) return;
    const lockKey = `deleteDungeon:${id}`;
    if (!acquireUiActionLock(lockKey, '试炼正在封存，请勿重复点击')) return;
    try {
        const { error } = await removeDungeon(id);
        if(error){ showToast(`❌ ${error.message || '删除失败'}`); return; }
        showToast('🗑️ 试炼已封存');
        closeDetail();
        await renderDungeonList();
        await renderLatestComments();
        await updateProfileNoticeBadge();
        if (document.getElementById('profilePage')?.style.display !== 'none') await renderProfilePage();
    } finally {
        releaseUiActionLock(lockKey);
    }
}
function setSort(sort,btn){ currentSort=sort; archivePage=1; document.querySelectorAll('.sort-btn[data-sort]').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); updateReviewFilterButton(); renderDungeonList(); }
function debounceSearch(){ clearTimeout(searchTimeout); searchTimeout=setTimeout(()=>{ searchQuery=document.getElementById('searchInput').value; archivePage=1; renderDungeonList(); },350); }
function showToast(msg){ const c=document.getElementById('toastContainer'); const t=document.createElement('div'); t.className='toast'; t.textContent=msg; c.appendChild(t); setTimeout(()=>{if(t.parentNode)t.remove();},3200); }
function shouldGuardActionButton(button) {
    const action = `${button.getAttribute('onclick') || ''} ${button.getAttribute('type') || ''}`;
    return /(save|submit|delete|remove|mark|draw|exchange|equip|resolve|discard|grant|revoke|expand|showMore|loadMore|joinMatchQueue|cancelMatchQueue|advanceRun|reviewDungeon|addComment|Rating|Clear|保存|提交|删除|撤销|授予|回收|分解|兑换|结算|显示更多|展开)/i.test(action);
}
document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest('button');
    if (!button || button.disabled || !shouldGuardActionButton(button)) return;
    const now = Date.now();
    const lockedUntil = Number(button.dataset.clickGuardUntil || 0);
    if (lockedUntil > now) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showToast('操作正在处理中，请勿重复点击');
        return;
    }
    button.classList.add('is-action-ack');
    button.setAttribute('aria-busy', 'true');
    window.setTimeout(() => {
        button.classList.remove('is-action-ack');
        if (!button.disabled) button.removeAttribute('aria-busy');
    }, 650);
    button.dataset.clickGuardUntil = String(now + 900);
    window.setTimeout(() => {
        if (Number(button.dataset.clickGuardUntil || 0) <= Date.now()) delete button.dataset.clickGuardUntil;
    }, 950);
}, true);
document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const leaderboardPageButton = target.closest('[data-leaderboard-page-key][data-leaderboard-page]');
    if (leaderboardPageButton instanceof HTMLButtonElement) {
        event.preventDefault();
        let boardKey = '';
        try {
            boardKey = decodeURIComponent(leaderboardPageButton.dataset.leaderboardPageKey || '');
        } catch (error) {
            console.error('榜单分页参数解析失败', error);
            showToast('❌ 榜单分页参数无效，请刷新后重试');
            return;
        }
        setLeaderboardPage(boardKey, leaderboardPageButton.dataset.leaderboardPage || '1');
        return;
    }
    const leaderboardModeButton = target.closest('[data-leaderboard-mode]');
    if (leaderboardModeButton) {
        event.preventDefault();
        setLeaderboardMode(leaderboardModeButton.dataset.leaderboardMode || 'overall');
        return;
    }
    const leaderboardPathButton = target.closest('[data-leaderboard-path]');
    if (leaderboardPathButton) {
        event.preventDefault();
        setLeaderboardPath(leaderboardPathButton.dataset.leaderboardPath || 'all');
        return;
    }
    const replyButton = target.closest('[data-reply-comment-id]');
    if (replyButton) {
        event.preventDefault();
        setReplyTarget(replyButton.dataset.replyCommentId || '', replyButton.dataset.replyAuthor || '匿名');
        return;
    }
    const deleteCommentButton = target.closest('[data-delete-comment-id]');
    if (deleteCommentButton) {
        event.preventDefault();
        deleteCommentUI(deleteCommentButton.dataset.deleteCommentId || '');
    }
});
document.addEventListener('focusin', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.matches('input, textarea, select')) document.body.classList.add('mobile-keyboard-active');
});
document.addEventListener('focusout', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.matches('input, textarea, select')) {
        window.setTimeout(() => document.body.classList.remove('mobile-keyboard-active'), 120);
    }
});
document.addEventListener('touchstart', handleMobileTouchStart, { passive: true });
document.addEventListener('touchend', handleMobileTouchEnd, { passive: true });
window.addEventListener('resize', () => {
    window.clearTimeout(window.__fogMobileResizeTimer);
    window.__fogMobileResizeTimer = window.setTimeout(() => setMobileScreenClass(mobileActiveDestination || 'dungeons'), 120);
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        const detailOverlay = document.getElementById('detailOverlay');
        const profilePage = document.getElementById('profilePage');
        const leaderboardPage = document.getElementById('leaderboardPage');
        const matchPage = document.getElementById('matchPage');
        const scorePage = document.getElementById('scorePage');
        const publicProfileOverlay = document.getElementById('publicProfileModalOverlay');
        if (document.getElementById('testimonyModalOverlay').style.display === 'flex') closeTestimonyModal();
        else if (document.getElementById('ratingModalOverlay').style.display === 'flex') closeRatingModal();
        else if (document.getElementById('inviteModalOverlay').style.display === 'flex') closeInviteModal();
        else if (publicProfileOverlay && publicProfileOverlay.style.display === 'flex') closePublicProfileModal();
        else if (profilePage && getComputedStyle(profilePage).display !== 'none') closeProfilePage();
        else if (leaderboardPage && getComputedStyle(leaderboardPage).display !== 'none') closeLeaderboardPage();
        else if (matchPage && getComputedStyle(matchPage).display !== 'none') closeMatchPage();
        else if (scorePage && getComputedStyle(scorePage).display !== 'none') closeScorePage();
        else if (detailOverlay && getComputedStyle(detailOverlay).display !== 'none') closeDetail();
        else if (document.getElementById('submitModalOverlay').style.display === 'flex') closeSubmitModal();
    }
    if (e.key === 'Enter' && document.activeElement?.id === 'inviteCodeInput') submitInviteCode();
    if (e.key === 'Enter' && document.activeElement?.id === 'displayNameInput') saveDisplayName();
});

(async function init(){
    resetDiscoveryFiltersToEmpty();
    setMobileScreenClass('dungeons');
    maybeShowMobileOnboarding();
    applyVisualEffectsPreference();
    populateGodSelect();
    renderPathNav();
    renderGodFilters();
    renderDifficultyFilters();
    updateInviteUI();
    await renderDungeonList();
    await renderLatestComments();
    if(USE_LOCAL_FALLBACK && getLocalData('dungeons',[]).length===0){
        const samples = [
            { id:'s1',name:'深渊回廊',creator:'灰袍叙事者',difficulty:'中',type:'记忆',description:'在无尽深渊边缘，一座古老回廊静静等待。封印着陨落神祇的记忆碎片，踏入者将直面内心最深的恐惧……',pinned_note:'建议 6 人满员进入，第二幕需要有人记录线索。',participant_count:6,run_count:2,clear_count:6,clear_rate:50,avg_rating:4.7,rating_count:23,comment_count:8,created_at:new Date(Date.now()-7*86400000).toISOString()},
            { id:'s2',name:'愚者之塔',creator:'星辰旅人',difficulty:'高',type:'痴愚',description:'倒悬于天空的巨塔，每一层都蕴含悖论与谜题。唯有拥抱荒诞之人，方能窥见塔顶的真相。',pinned_note:'高难解谜本，建议预留 2 小时以上。',participant_count:4,run_count:3,clear_count:9,clear_rate:75,avg_rating:4.9,rating_count:41,comment_count:15,created_at:new Date(Date.now()-3*86400000).toISOString()},
            { id:'s3',name:'血色竞技场',creator:'铁腕判官',difficulty:'高',type:'战争',description:'上古诸神取乐的竞技场，回荡着古老战吼。策略与力量并重，每一战都可能揭开神戏一角。',participant_count:8,run_count:1,clear_count:3,clear_rate:37.5,avg_rating:4.3,rating_count:17,comment_count:5,created_at:new Date(Date.now()-14*86400000).toISOString()},
            { id:'s4',name:'雾隐村',creator:'迷雾行者',difficulty:'低',type:'污堕',description:'永远被浓雾笼罩的村庄，平静生活之下，每个夜晚雾中都会出现不可名状之物。',participant_count:5,run_count:2,clear_count:4,clear_rate:40,avg_rating:4.1,rating_count:12,comment_count:4,created_at:new Date(Date.now()-5*86400000).toISOString()},
            { id:'s5',name:'诸神棋盘',creator:'执棋人',difficulty:'中',type:'命运',description:'整场试炼就是一张巨大的棋盘，参与者成为诸神的棋子。每一步都可能改变命运。',participant_count:6,run_count:4,clear_count:18,clear_rate:75,avg_rating:4.6,rating_count:30,comment_count:11,created_at:new Date(Date.now()-10*86400000).toISOString()}
        ];
        setLocalData('dungeons',samples);
        setLocalData('comments',[
            {id:'c1',dungeon_id:'s1',parent_comment_id:null,author:'探索者A',content:'氛围太棒了，跑完回味了好几天。',invite_name:'探索者A',is_deleted:false,created_at:new Date(Date.now()-6*86400000).toISOString()},
            {id:'c2',dungeon_id:'s2',parent_comment_id:null,author:'逻辑粉碎机',content:'完全颠覆了我的思维，愚者神太有趣了',invite_name:'逻辑粉碎机',is_deleted:false,created_at:new Date(Date.now()-2*86400000).toISOString()},
            {id:'c3',dungeon_id:'s2',parent_comment_id:'c2',author:'星辰旅人',content:'下一次我会把第三层谜题再改得柔和一点。',invite_name:'星辰旅人',is_deleted:false,created_at:new Date(Date.now()-1*86400000).toISOString()}
        ]);
        setLocalData('clear_feedback',{s1:{'氛围强':4,'机制清楚':3,'想再跑':2},s2:{'有挑战':6,'偏难':3,'剧情好':2}});
        await renderDungeonList();
        await renderLatestComments();
    }
    requestAnimationFrame(scrollPageToTop);
})();

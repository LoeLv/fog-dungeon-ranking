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






























const scoreActionLocks = new Set();




























































































































































































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

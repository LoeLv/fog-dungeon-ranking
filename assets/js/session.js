// Invite session and role permission helpers. DOM update flows stay in assets/app.js.

function getInviteRole() { return inviteSession?.role || null; }

function getInvitePermissions() {
    return Array.isArray(inviteSession?.permissions) ? inviteSession.permissions : [];
}

const STAFF_ADMIN_NAMES = ['羔羊', '槐柏', '南河书淮', '慕辞', '棺材板', '我不想死', '情忆浮生', '知更', '变态', '墨染流年', '洛泽攸'];
const TALENT_MANAGER_NAMES = ['羔羊'];
const SCORE_SETTLER_NAMES = ['慕辞', '情忆浮生', '知更'];

function getInviteDisplayName() {
    return String(inviteSession?.name || '').trim();
}

function hasStaffName(names) {
    const displayName = getInviteDisplayName();
    return !!displayName && names.includes(displayName);
}

function isNamedStaffAdmin() { return hasStaffName(STAFF_ADMIN_NAMES); }

function isNamedTalentManager() { return hasStaffName(TALENT_MANAGER_NAMES); }

function isNamedScoreSettler() { return hasStaffName(SCORE_SETTLER_NAMES); }

function hasInvitePermission(permission) {
    if (getInviteRole() === 'admin') return true;
    if (permission === 'review_dungeons' || permission === 'account_role_manage') return isNamedStaffAdmin() || getInvitePermissions().includes(permission);
    if (permission === 'talent_pool_manage') return isNamedTalentManager() || getInvitePermissions().includes(permission);
    if (permission === 'settle_scores') return isNamedScoreSettler() || getInvitePermissions().includes(permission);
    return getInvitePermissions().includes(permission);
}

function getClientDeviceKind() {
    return window.matchMedia('(max-width: 720px), (pointer: coarse)').matches ? 'mobile' : 'desktop';
}

function canUseRole(roles) { return roles.includes(getInviteRole()); }

function canInteract() { return canUseRole(['player', 'author', 'reviewer', 'admin']); }

function canTestify() { return canUseRole(['player', 'author', 'reviewer', 'admin', 'god', 'astral']); }

function canSubmit() { return canUseRole(['author', 'reviewer', 'admin', 'god', 'astral']); }

function isAdmin() { return getInviteRole() === 'admin'; }

function isGodRole() { return getInviteRole() === 'god' || getInviteRole() === 'astral'; }

function canGrantTitlesUI() { return canUseRole(['admin', 'god', 'astral']); }

function canSettleScores() { return isAdmin() || hasInvitePermission('settle_scores'); }

function canReviewDungeonsUI() {
    return isGodRole() || isAdmin() || hasInvitePermission('review_dungeons');
}

function canManageTalentPoolUI() { return isAdmin() || hasInvitePermission('talent_pool_manage'); }

function canManageAccountRolesUI() { return isAdmin() || hasInvitePermission('account_role_manage'); }

function canUseAdminConsole() { return isAdmin() || canUsePermissionDesk(); }

function isInitialDisplayNameBinding() {
    if (!inviteSession?.code || !inviteSession?.name || isGodRole()) return false;
    return String(inviteSession.name).trim().toLowerCase() === String(inviteSession.code).trim().toLowerCase();
}

function canEditDisplayName() { return isAdmin() || isInitialDisplayNameBinding(); }

function isAdminDisplayNameEdit() { return isAdmin() && !isInitialDisplayNameBinding(); }

function canOverrideProfileLocks() { return isAdmin(); }

function canEditProfileScores() { return canOverrideProfileLocks(); }

function shouldAutoFocusModalInput() {
    return !window.matchMedia('(max-width: 720px)').matches;
}

function saveInviteSession(session) {
    inviteSession = session;
    setLocalData(INVITE_STORAGE_KEY, inviteSession);
    updateInviteUI();
}

function getInviteSnapshot() {
    return inviteSession?.code || '';
}

function isInviteSnapshotCurrent(snapshot) {
    return (snapshot || '') === getInviteSnapshot();
}

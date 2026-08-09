// Invite session and role permission helpers. DOM update flows stay in assets/app.js.

function getInviteRole() { return inviteSession?.role || null; }

function getInvitePermissions() {
    return Array.isArray(inviteSession?.permissions) ? inviteSession.permissions : [];
}

function hasInvitePermission(permission) {
    return getInviteRole() === 'admin' || getInvitePermissions().includes(permission);
}

function canUseRole(roles) { return roles.includes(getInviteRole()); }

function canInteract() { return canUseRole(['player', 'author', 'reviewer', 'admin']); }

function canTestify() { return canUseRole(['player', 'author', 'reviewer', 'admin', 'god']); }

function canSubmit() { return canUseRole(['author', 'reviewer', 'admin', 'god']); }

function isAdmin() { return getInviteRole() === 'admin'; }

function isGodRole() { return getInviteRole() === 'god'; }

function canGrantTitlesUI() { return canUseRole(['admin', 'god']); }

function canSettleScores() { return canUseRole(['reviewer', 'admin']) || hasInvitePermission('settle_scores'); }

function canReviewDungeonsUI() {
    return canUseRole(['admin', 'god']) || hasInvitePermission('review_dungeons') || (getInviteRole() === 'reviewer' && ['羔羊', '槐柏'].includes(inviteSession?.name || ''));
}

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

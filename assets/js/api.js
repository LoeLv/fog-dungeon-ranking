// Supabase Edge Function request wrapper and frontend read caches.

// Keep the large archive payload out of repeated page renders. The cache is
// per invite identity and is cleared immediately after a write succeeds.
const DUNGEON_LIST_CACHE_TTL_MS = 3 * 60 * 1000;
const SHORT_READ_CACHE_TTL_MS = 90 * 1000;
let dungeonListRequest = null;
let dungeonListCacheVersion = 0;
const shortReadRequests = new Map();
let shortReadCacheVersion = 0;

function getDungeonListCacheKey() {
    const identity = inviteSession?.code || 'guest';
    return `fog-dungeon-list-v2:${identity}`;
}

function readDungeonListCache() {
    try {
        const cached = JSON.parse(sessionStorage.getItem(getDungeonListCacheKey()) || 'null');
        if (!cached || !Array.isArray(cached.data) || Date.now() - Number(cached.savedAt || 0) > DUNGEON_LIST_CACHE_TTL_MS) return null;
        return cached.data;
    } catch (_) {
        return null;
    }
}

function writeDungeonListCache(data) {
    try {
        sessionStorage.setItem(getDungeonListCacheKey(), JSON.stringify({ savedAt: Date.now(), data }));
    } catch (_) {
        // Storage can be unavailable or full; the live request remains usable.
    }
}

function invalidateDungeonListCache() {
    try { sessionStorage.removeItem(getDungeonListCacheKey()); } catch (_) {}
    dungeonListRequest = null;
    dungeonListCacheVersion += 1;
    archivePageMeta = null;
    invalidateShortReadCache('archive-page:');
}

function getShortReadCacheKey(name) {
    return `fog-read-cache-v2:${name}:${inviteSession?.code || 'guest'}`;
}

function invalidateShortReadCache(name = '') {
    try {
        for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
            const key = sessionStorage.key(index);
            if (key?.startsWith(`fog-read-cache-v2:${name}`)) sessionStorage.removeItem(key);
        }
    } catch (_) {}
    [...shortReadRequests.keys()]
        .filter(key => key.startsWith(name))
        .forEach(key => shortReadRequests.delete(key));
    shortReadCacheVersion += 1;
}

async function getShortCachedRead(name, loader, ttl = SHORT_READ_CACHE_TTL_MS) {
    const key = getShortReadCacheKey(name);
    try {
        const cached = JSON.parse(sessionStorage.getItem(key) || 'null');
        if (cached && Date.now() - Number(cached.savedAt || 0) <= ttl) return cached.data;
    } catch (_) {}
    if (shortReadRequests.has(name)) return shortReadRequests.get(name);
    const cacheVersion = shortReadCacheVersion;
    const request = Promise.resolve()
        .then(loader)
        .then(data => {
            if (cacheVersion === shortReadCacheVersion) {
                try { sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data })); } catch (_) {}
            }
            return data;
        })
        .finally(() => shortReadRequests.delete(name));
    shortReadRequests.set(name, request);
    return request;
}

function isDungeonListMutation(action) {
    return new Set([
        'submitDungeon', 'updateDungeon', 'deleteDungeon', 'reviewDungeon',
        'advanceRun', 'markCleared', 'submitScoreBatch', 'submitScoreSingle',
        'addComment', 'deleteComment', 'addRating', 'updatePinnedNote'
    ]).has(action);
}

async function invokeDungeonAction(action, payload = {}, codeOverride = null, options = {}) {
    const inviteCode = codeOverride ?? inviteSession?.code;
    const inviteSnapshot = codeOverride ? '' : getInviteSnapshot();
    const publicReadActions = new Set(['listDungeons', 'listDungeonArchivePage', 'getDungeonDetail', 'listProfiles', 'listFaithTraits']);
    if (!USE_LOCAL_FALLBACK && !inviteCode && !publicReadActions.has(action)) {
        return { data: null, error: { message: '请先验入局谕令' } };
    }
    const requestController = new AbortController();
    const requestTimeout = window.setTimeout(() => requestController.abort(), 15000);
    const response = await fetch(DUNGEON_ACTION_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
            action,
            inviteCode,
            sessionId: codeOverride ? '' : (inviteSession?.sessionId || ''),
            deviceKind: codeOverride ? getClientDeviceKind() : (inviteSession?.deviceKind || getClientDeviceKind()),
            payload
        }),
        signal: requestController.signal
    }).catch(error => ({ ok: false, status: 0, json: async () => ({ error: getFriendlyActionError(error, requestController.signal.aborted ? '请求超时，请稍后重试' : '网络请求失败') }) }));
    window.clearTimeout(requestTimeout);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        const errorData = result.data ?? null;
        if (result.code === 'session_invalid' && !options.preserveSessionOnInvalid) {
            inviteSession = null;
            setLocalData(INVITE_STORAGE_KEY, null);
            updateInviteUI();
        }
        return { data: errorData, error: { message: getFriendlyActionError(result.error, '请求失败'), data: errorData } };
    }
    const role = normalizeRole(result.role);
    const canRefreshSession = !!codeOverride || isInviteSnapshotCurrent(inviteSnapshot);
    if (role && inviteCode && canRefreshSession) {
        saveInviteSession({
            role,
            code: inviteCode,
            name: result.name || result.label || ROLE_LABELS[role],
            permissions: Array.isArray(result.permissions) ? result.permissions : (inviteSession?.permissions || []),
            sessionId: result.sessionId || inviteSession?.sessionId || '',
            deviceKind: result.deviceKind || inviteSession?.deviceKind || getClientDeviceKind()
        });
    }
    if (isDungeonListMutation(action)) {
        invalidateDungeonListCache();
        invalidateShortReadCache('latest-comments');
        invalidateShortReadCache('comments:');
        invalidateShortReadCache('feedback:');
        invalidateShortReadCache('my-clear-records');
        invalidateShortReadCache('dungeon-detail:');
    }
    if (new Set(['saveProfile', 'updateDisplayName', 'updateTrickeryFaith', 'redeemPromoCode', 'godConvertBeliever', 'grantProfileTitle', 'revokeProfileTitle', 'restoreProfileTitle', 'grantBetrayalCurse', 'revokeProfileCurse', 'restoreProfileCurse']).has(action)) {
        invalidateShortReadCache('leaderboard');
    }
    if (action === 'adminUpsertFaithTrait') invalidateShortReadCache('faith-traits');
    return { data: result.data ?? null, error: null, role, name: result.name };
}

async function loadFaithTraits(options = {}) {
    if (USE_LOCAL_FALLBACK) return getFaithTraitEntries();
    try {
        const data = await getShortCachedRead('faith-traits', async () => {
            const { data, error } = await invokeDungeonAction('listFaithTraits', {}, null, { preserveSessionOnInvalid: true });
            if (error) throw new Error(error.message || '信仰特性读取失败');
            return Array.isArray(data?.traits) ? data.traits : [];
        }, options.ttl || 5 * 60 * 1000);
        applyFaithTraitOverrides(data);
        return getFaithTraitEntries();
    } catch (error) {
        if (options.showError) showToast(`信仰特性读取失败：${error?.message || error || '未知错误'}`);
        return getFaithTraitEntries();
    }
}

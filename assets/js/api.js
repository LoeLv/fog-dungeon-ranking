// Supabase Edge Function request wrapper and frontend read caches.

// Keep the large archive payload out of repeated page renders. The cache is
// per invite identity and is cleared immediately after a write succeeds.
const DUNGEON_LIST_CACHE_TTL_MS = 3 * 60 * 1000;
const SHORT_READ_CACHE_TTL_MS = 90 * 1000;
const DUNGEON_LIST_CACHE_PREFIX = 'fog-dungeon-list-v4';
const SHORT_READ_CACHE_PREFIX = 'fog-read-cache-v4';
const UNCACHED_READ_MARKER = '__fogSkipShortReadCache';
let dungeonListRequest = null;
let dungeonListCacheVersion = 0;
const shortReadRequests = new Map();
let shortReadCacheVersion = 0;

function purgeLegacyReadCaches() {
    try {
        for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
            const key = sessionStorage.key(index);
            if (
                key?.startsWith('fog-dungeon-list-v1:') ||
                key?.startsWith('fog-dungeon-list-v2:') ||
                key?.startsWith('fog-dungeon-list-v3:') ||
                key?.startsWith('fog-read-cache-v1:') ||
                key?.startsWith('fog-read-cache-v2:') ||
                key?.startsWith('fog-read-cache-v3:')
            ) {
                sessionStorage.removeItem(key);
            }
        }
    } catch (_) {}
}

purgeLegacyReadCaches();

function getDungeonListCacheKey() {
    const identity = inviteSession?.code || 'guest';
    return `${DUNGEON_LIST_CACHE_PREFIX}:${identity}`;
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
    return `${SHORT_READ_CACHE_PREFIX}:${name}:${inviteSession?.code || 'guest'}`;
}

function invalidateShortReadCache(name = '') {
    try {
        for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
            const key = sessionStorage.key(index);
            if (key?.startsWith(`${SHORT_READ_CACHE_PREFIX}:${name}`)) sessionStorage.removeItem(key);
        }
    } catch (_) {}
    [...shortReadRequests.keys()]
        .filter(key => key.startsWith(name))
        .forEach(key => shortReadRequests.delete(key));
    shortReadCacheVersion += 1;
}

function clearFrontendReadCaches() {
    try {
        for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
            const key = sessionStorage.key(index);
            if (key?.startsWith('fog-dungeon-list-') || key?.startsWith('fog-read-cache-')) {
                sessionStorage.removeItem(key);
            }
        }
    } catch (_) {}
    dungeonListRequest = null;
    shortReadRequests.clear();
    dungeonListCacheVersion += 1;
    shortReadCacheVersion += 1;
    archivePageMeta = null;
}

function skipShortReadCache(data) {
    return { [UNCACHED_READ_MARKER]: true, data };
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
            if (data && typeof data === 'object' && data[UNCACHED_READ_MARKER]) {
                return data.data;
            }
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

// ==================== 方案A：公开读走 Data API（PostgREST RPC） ====================
// PostgREST（Data API，含 rpc）调用【不计入】Edge Function 调用量，
// 因此把 5 个“公开读”优先改为 rpc() 直连，可显著降低 Edge 调用次数。
// 任一 rpc 调用失败（未部署迁移 / 网络异常 / 返回业务错误）都会返回 null，
// 由 invokeDungeonAction 自动回退到原 Edge 路径，保证向后兼容。
let PUBLIC_READ_RPC_ENABLED = true; // 迁移部署后可保持 true；如需紧急关闭可置 false

function buildPublicReadRpcSpec(action, payload, inviteCode) {
    switch (action) {
        case 'listDungeons':
            return { fn: 'fog_list_dungeons', args: { p_invite_code: inviteCode || null, p_limit: Number(payload && payload.limit) || 500 } };
        case 'listDungeonArchivePage':
            return { fn: 'fog_list_dungeon_archive_page', args: {
                p_page: Number(payload && payload.page) || 1,
                p_page_size: Number(payload && payload.pageSize) || 5,
                p_sort: (payload && payload.sort) || ''
            } };
        case 'getDungeonDetail':
            return { fn: 'fog_get_dungeon_detail', args: { p_invite_code: inviteCode || null, p_dungeon_id: String((payload && payload.dungeonId) || '') } };
        case 'listProfiles':
            return { fn: 'fog_list_profiles', args: {} };
        case 'listFaithTraits':
            return { fn: 'fog_list_faith_traits', args: {} };
        default:
            return null;
    }
}

async function invokePublicReadViaRpc(action, payload, inviteCode) {
    if (USE_LOCAL_FALLBACK || !PUBLIC_READ_RPC_ENABLED || !supabaseClient?.rpc) return null;
    const spec = buildPublicReadRpcSpec(action, payload, inviteCode);
    if (!spec) return null;
    try {
        const { data, error } = await supabaseClient.rpc(spec.fn, spec.args);
        if (error) return null; // 回退到 Edge
        if (data && typeof data === 'object' && data.error) {
            return { data: null, error: { message: String(data.error) } };
        }
        return { data: (data && data.data !== undefined) ? data.data : null, error: null };
    } catch (_) {
        return null; // 回退到 Edge
    }
}

// ==================== 方案B：首屏合并引导 ====================
// 一次 fog_open_bootstrap 调用同时取回「信仰特性 + 首屏副本列表」，
// 并直接写入前端两处缓存（faith-traits 短缓存 + 副本列表缓存）。
// 这样首屏原先 2 次调用（listFaithTraits + listDungeons）合并为 1 次。
// 仅当 rpc 可用且迁移已部署时生效；失败则静默回退到各自单独加载。
let openBootstrapPromise = null;
async function primeOpenBootstrap() {
    if (USE_LOCAL_FALLBACK || !supabaseClient?.rpc) return null;
    if (readDungeonListCache()) return null; // 已有副本列表缓存，无需预热
    if (openBootstrapPromise) return openBootstrapPromise;
    openBootstrapPromise = (async () => {
        try {
            const { data, error } = await supabaseClient.rpc('fog_open_bootstrap', {
                p_invite_code: inviteSession?.code || null,
                p_limit: 500
            });
            if (error || !data || !data.data) return null;
            const payload = data.data;
            // 1) 写入信仰特性短缓存（与 loadFaithTraits 的缓存形态一致：数组）
            const traits = Array.isArray(payload.traits?.traits) ? payload.traits.traits
                          : (Array.isArray(payload.traits) ? payload.traits : null);
            if (traits) {
                try {
                    sessionStorage.setItem(getShortReadCacheKey('faith-traits'),
                        JSON.stringify({ savedAt: Date.now(), data: traits }));
                } catch (_) {}
            }
            // 2) 写入副本列表缓存（与 fetchDungeons 归一化一致）
            const dungeons = Array.isArray(payload.dungeons)
                ? payload.dungeons.map(d => ({ ...d, pinned_note: d.pinned_note || '' }))
                : null;
            if (dungeons) writeDungeonListCache(dungeons);
            return true;
        } catch (_) {
            return null;
        } finally {
            openBootstrapPromise = null;
        }
    })();
    return openBootstrapPromise;
}

async function invokeDungeonAction(action, payload = {}, codeOverride = null, options = {}) {
    const inviteCode = codeOverride ?? inviteSession?.code;
    const inviteSnapshot = codeOverride ? '' : getInviteSnapshot();
    const publicReadActions = new Set(['listDungeons', 'listDungeonArchivePage', 'getDungeonDetail', 'listProfiles', 'listFaithTraits']);
    if (!USE_LOCAL_FALLBACK && !inviteCode && !publicReadActions.has(action)) {
        return { data: null, error: { message: '请先验入局谕令' } };
    }
    // 方案A：公开读优先走 Data API RPC；成功即返回，失败/未部署则继续走 Edge。
    if (publicReadActions.has(action)) {
        const rpcResult = await invokePublicReadViaRpc(action, payload, inviteCode);
        if (rpcResult && !rpcResult.error) {
            return { data: rpcResult.data ?? null, error: null };
        }
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

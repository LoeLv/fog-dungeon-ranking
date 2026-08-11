
window.__fogDungeonBootStarted = true;
document.getElementById('bootError')?.classList.remove('visible');
// ==================== SUPABASE 配置 ====================
const SUPABASE_URL = 'https://trosjcbvfhnfkelflijc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_sZYKAIzDJJYQgzC2Buzhyw_art6KnAS';
const DUNGEON_ACTION_URL = `${SUPABASE_URL}/functions/v1/fog-dungeon-action`;
const supabaseClient = window.supabase?.createClient ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const USE_LOCAL_FALLBACK = !supabaseClient || SUPABASE_URL.includes('your-project-id');
const INVITE_DEVICE_SESSION_ENFORCEMENT = false;
if (USE_LOCAL_FALLBACK) {
    console.warn('⚠️ Supabase 未配置，使用本地存储模式。替换 SUPABASE_URL 和 SUPABASE_ANON_KEY 以启用在线功能。');
}
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
let initialTopLockActive = true;
function scrollPageToTop() {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
}
function releaseInitialTopLock() {
    initialTopLockActive = false;
}
function lockInitialViewToTop(duration = 2200) {
    initialTopLockActive = true;
    const startedAt = performance.now();
    const tick = () => {
        if (!initialTopLockActive) return;
        scrollPageToTop();
        if (performance.now() - startedAt < duration) requestAnimationFrame(tick);
        else releaseInitialTopLock();
    };
    tick();
}
['wheel', 'touchstart', 'pointerdown'].forEach(eventName => {
    window.addEventListener(eventName, releaseInitialTopLock, { once: true, passive: true });
});
window.addEventListener('keydown', releaseInitialTopLock, { once: true });
window.addEventListener('pageshow', () => lockInitialViewToTop());

function getLocalData(key, defaultValue) {
    const storageKey = 'fog_' + key;
    for (const store of [localStorage, sessionStorage]) {
        try {
            const raw = store.getItem(storageKey);
            if (raw) return JSON.parse(raw);
        } catch {}
    }
    return defaultValue;
}
function setLocalData(key, value) {
    const storageKey = 'fog_' + key;
    const raw = JSON.stringify(value);
    try { localStorage.setItem(storageKey, raw); } catch {}
    try { sessionStorage.setItem(storageKey, raw); } catch {}
}

const INVITE_STORAGE_KEY = 'invite_session_v1';
const PROFILE_STORAGE_KEY = 'personal_profiles_v1';
const PROFILE_NOTICE_SEEN_KEY = 'profile_notice_seen_v1';
const MOBILE_ONBOARDING_STORAGE_KEY = 'mobile_onboarding_seen_v1';
const ROLE_LABELS = { player: '入局信徒', author: '试炼构筑者', reviewer: '结算审核员', admin: '神谕馆主', god: '祈愿神明', astral: '星途' };
const ROLE_UI_COPY = {
    guest: {
        title: '旁观者只读',
        note: '公开观览',
        cards: [
            ['🎲', '旁观者', '公开试炼'],
            ['✦', '信徒入口', '同契谕令'],
            ['🎭', '构筑入口', '构筑席位'],
            ['⚖', '结算入口', '审核席位']
        ]
    },
    player: {
        title: '入局信徒',
        note: '信徒铭牌',
        cards: [
            ['🎲', '神格判定', '一至五阶'],
            ['💬', '试炼证言', '主证 / 副证'],
            ['✦', '个人档案', '信仰档纹'],
            ['⚖', '分数结算', '审核席']
        ]
    },
    author: {
        title: '试炼构筑者',
        note: '构筑席位',
        cards: [
            ['🎭', '构筑愚戏', '轮回 / 绝响'],
            ['📌', '置顶神谕', '构筑者留痕'],
            ['💬', '楼主提醒', '证言回声'],
            ['⚖', '分数结算', '审核席']
        ]
    },
    reviewer: {
        title: '结算审核员',
        note: '审核席位',
        cards: [
            ['⚖', '批量结算', '名单校验'],
            ['🎭', '构筑愚戏', '试炼构筑'],
            ['📌', '作者维护', '置顶 / 周目'],
            ['↩', '撤销回滚', '结算信封']
        ]
    },
    admin: {
        title: '神谕馆主',
        note: '神谕馆册',
        cards: [
            ['🎭', '构筑管理', '创建 / 封存'],
            ['⚖', '分数结算', '结算神谕台'],
            ['📌', '神谕维护', '置顶 / 状态'],
            ['✦', '档案观测', '档案 / 榜单']
        ]
    },
    god: {
        title: '祈愿神明',
        note: '祈愿创本，降下称号。',
        cards: [
            ['✦', '称号敕令', '神名降号'],
            ['🎭', '祈愿创本', '祈愿试炼'],
            ['◇', '第零神席', '寰宇至尊'],
            ['✧', '神明证言', '试炼证言']
        ]
    },
    astral: {
        title: '星途',
        note: '永恒留名，受万民敬仰。',
        cards: [
            ['✦', '永恒神碑', '纪念名录'],
            ['◇', '自由之神', '曦'],
            ['✧', '星途席位', '特殊账号'],
            ['🎭', '纪念留档', '不入信徒榜']
        ]
    }
};

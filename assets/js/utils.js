// Shared utility and lookup helpers. Keep page-state and write-flow functions in assets/app.js.

function normalizeRole(role) {
    return ['player', 'author', 'reviewer', 'admin', 'god', 'astral'].includes(role) ? role : null;
}

function cssEscape(value) {
    if (window.CSS?.escape) return window.CSS.escape(String(value));
    return String(value).replace(/["\\]/g, '\\$&');
}

function getFriendlyActionError(error, fallback = '操作失败') {
    const raw = String(error?.message || error || '').trim();
    if (/duplicate key|already exists|unique|display_name|昵称.*(重复|占用|存在)|重复|唯一约束/i.test(raw)) {
        return '这个昵称已经被使用，请换一个昵称';
    }
    if (/failed to fetch|networkerror|load failed|请求失败|network/i.test(raw)) {
        return '网络请求失败，请检查连接后重试';
    }
    return raw || fallback;
}

function normalizeProfileScore(value, fallback = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(0, Math.min(999999, Math.round(number * 10) / 10));
}

function normalizeIdentityText(value) {
    return String(value || '').trim().slice(0, 40);
}

function normalizeProfession(value) {
    const clean = String(value || '').trim();
    const normalized = PROFESSION_ALIASES?.[clean] || clean;
    return PROFESSION_NAMES.has(normalized) ? normalized : '';
}

function getProfessionInfo(value) {
    const clean = normalizeProfession(value);
    const info = PROFESSIONS.find(item => item.name === clean);
    return info ? { ...info, known: true } : { name: clean, className: '', god: '', path: '', known: false };
}

function splitProfileLines(value) {
    return String(value || '')
        .split(/[\n,，;；]/)
        .map(item => item.trim())
        .filter(Boolean)
        .slice(0, 24);
}

function formatProfileScore(value) {
    const score = normalizeProfileScore(value);
    return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function getLeaderboardScore(entry, scoreType) {
    if (scoreType === 'audience') return Number(entry.audienceScore || 0);
    if (scoreType === 'total') return Number(entry.ascensionScore || 0) + Number(entry.audienceScore || 0);
    return Number(entry.ascensionScore || 0);
}

function getLeaderboardScoreLabel(scoreType) {
    if (scoreType === 'audience') return '觐见之梯';
    if (scoreType === 'total') return '双榜总和';
    return '登神之路';
}

function formatTalentPoolLabel(poolKey) {
    return String(poolKey || '').replace(/^Pool/u, '') || '未知池';
}

function wrapCanvasText(ctx, text, maxWidth, maxLines = 2) {
    const chars = String(text || '').split('');
    const lineLimit = Number.isFinite(maxLines) ? Math.max(1, maxLines) : Infinity;
    const lines = [];
    let line = '';
    for (const char of chars) {
        const nextLine = line + char;
        if (ctx.measureText(nextLine).width > maxWidth && line) {
            lines.push(line);
            line = char;
            if (lines.length >= lineLimit) break;
        } else {
            line = nextLine;
        }
    }
    if (line && lines.length < lineLimit) lines.push(line);
    if (Number.isFinite(lineLimit) && lines.length === lineLimit && chars.join('').length > lines.join('').length) {
        lines[lineLimit - 1] = `${lines[lineLimit - 1].slice(0, Math.max(0, lines[lineLimit - 1].length - 1))}…`;
    }
    return lines.length ? lines : ['未记录'];
}

function drawRoundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function cleanDisplayNameInput(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 16);
}

function getAllGods() {
    return GOD_GROUPS.flatMap(group => group.gods.map(god => ({ god, path: group.path, className: group.className })));
}

function cleanGodName(value) {
    const raw = String(value || '').replace(/之神$/u, '').trim();
    return GOD_ALIASES[raw] || raw;
}

function splitGodTags(value) {
    const seen = new Set();
    return String(value || '')
        .split(/[、,，/|;；\s]+/u)
        .map(cleanGodName)
        .filter(god => {
            if (!god || seen.has(god)) return false;
            seen.add(god);
            return true;
        })
        ;
}

function getPrimaryGod(value) {
    return splitGodTags(value)[0] || cleanGodName(value);
}

function getDungeonGodInfos(value) {
    const tags = splitGodTags(value);
    const source = tags.length ? tags : [value];
    return source.map(getGodInfo);
}

function dungeonHasGod(value, god) {
    return splitGodTags(value).some(item => item === cleanGodName(god));
}

function dungeonHasPath(value, path) {
    return getDungeonGodInfos(value).some(info => info.path === path);
}

function getGodInfo(value) {
    const clean = cleanGodName(getPrimaryGod(value));
    const found = getAllGods().find(item => item.god === clean);
    return found ? { ...found, known: true } : { god: clean || '未归档', path: '旧档案', className: 'path-unknown', known: false };
}

function getGodSkin(value) {
    const info = getGodInfo(value);
    return GOD_SKINS[info.god] || {
        primary: '#d5b25b',
        secondary: '#7a8cff',
        glow: 'rgba(213,178,91,0.16)',
        dark: 'rgba(18,19,27,0.82)',
        palette: '旧档暗金 / 星尘蓝',
        motif: '旧档碎片',
        pattern: '未归档神谕纹路',
        particle: '星尘碎光',
        oracle: '谕行原文待补。',
        entryTitle: '进入旧档试炼',
        entryHint: '这场试炼尚未归入神明名录。',
        confirmText: '踏入试炼',
        cancelText: '暂不进入'
    };
}

function getGodSkinStyle(value) {
    const skin = getGodSkin(value);
    const pathMeta = getPathMetaByGod(value);
    const primaryInfo = getGodInfo(value);
    return [
        `--god-primary:${skin.primary}`,
        `--god-secondary:${skin.secondary}`,
        `--god-glow:${skin.glow}`,
        `--god-dark:${skin.dark}`,
        `--era-base:var(--${primaryInfo.className}, ${skin.secondary})`,
        `--god-pattern-label:'${String(skin.motif || pathMeta.emblem || '').replace(/'/g, '')}'`
    ].join(';');
}

function getGodOracle(value) {
    return getGodSkin(value).oracle || getGodPrayer(value);
}

function getPathMetaByPath(path) {
    return PATH_META[path] || { sigil: '✧', tone: '旧档案', edict: '谕行原文待补' };
}

function getPathClassByPath(path) {
    return GOD_GROUPS.find(group => group.path === path)?.className || 'path-unknown';
}

function getPathMetaByGod(value) {
    return getPathMetaByPath(getGodInfo(value).path);
}

function getGodPrayer(value) {
    const god = getGodInfo(value).god;
    return GOD_PRAYERS[god] || '谕行待补';
}

function getGodIcon(value) {
    const god = getGodInfo(value).god;
    return GOD_ICONS[god] || '✧';
}

function getGodTalentPoolName(value) {
    const god = getGodInfo(value).god;
    return GOD_TALENT_POOL_NAMES[god] || `${formatTalentPoolLabel(`Pool${god}`)}池`;
}

function getGodEmptyText(value, type, fallback = '暂无记录。') {
    const god = getGodInfo(value).god;
    return GOD_EMPTY_TEXT[type]?.[god] || GOD_EMPTY_TEXT[type]?.default || fallback;
}

function getProfileFaithRank(god, progress = 0) {
    const titles = GOD_FAITH_TITLES[getGodInfo(god).god] || ['初阶观测者', '执印信徒', '纪元执掌者'];
    const index = progress >= 72 ? 2 : (progress >= 36 ? 1 : 0);
    return { stage: index + 1, title: titles[index], next: titles[Math.min(index + 1, titles.length - 1)] };
}

function getProfileChronicleEntries(god) {
    const info = getGodInfo(god);
    const skin = getGodSkin(god);
    const eraLines = ERA_CHRONICLE_LIBRARY[info.path] || ERA_CHRONICLE_LIBRARY.虚无 || [];
    const godLines = PROFILE_CHRONICLE_LINES[info.god] || [];
    const entries = [
        ...godLines.map((line, index) => ({
            lead: index === 0 ? `${info.god}之神正在观测本页。` : getGodPrayer(info.god),
            note: line
        })),
        ...eraLines
    ];
    return entries.length ? entries : [{ lead: skin.oracle || getGodPrayer(god), note: `${skin.pattern}在档案底层缓慢浮现。` }];
}

function formatGodName(value) {
    const infos = getDungeonGodInfos(value);
    return infos.map(info => info.known ? `${info.god}之神` : info.god).join('、');
}

function formatGodPath(value) {
    const paths = [...new Set(getDungeonGodInfos(value).map(info => info.path).filter(Boolean))];
    return paths.join('、') || '旧档案';
}

function getGodClass(value) {
    return getGodInfo(value).className;
}

function normalizeDifficulty(value) {
    const clean = String(value || '').replace(/难|本/g, '').trim();
    return DIFFICULTY_OPTIONS.some(item => item.value === clean) ? clean : (LEGACY_DIFFICULTY_MAP[String(value || '').trim()] || '中');
}

function formatDifficulty(value) {
    const normalized = normalizeDifficulty(value);
    return DIFFICULTY_OPTIONS.find(item => item.value === normalized)?.label || '中难';
}

function formatDate(iso) { if(!iso)return'未知'; const d=new Date(iso),n=new Date(),diff=Math.floor((n-d)/86400000); if(diff===0)return'今天'; if(diff===1)return'昨天'; if(diff<7)return`${diff}天前`; if(diff<30)return`${Math.floor(diff/7)}周前`; return d.toLocaleDateString('zh-CN'); }

function escapeHtml(s) { const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }

function jsString(value) { return JSON.stringify(String(value ?? '')); }

// 用于内联 onclick="...（双引号属性）" 场景：先转义 & < >，再把双引号转成 &quot;，
// 避免 JSON 字符串自带的双引号提前截断 HTML 属性，导致内联处理器语法错误而“按钮失效”。
function escapeAttrString(value) { return escapeHtml(jsString(value)).replace(/"/g, '&quot;'); }

// 站内确认框：替代 window.confirm，避免在部分环境中原生对话框被自动取消而导致操作流程提前中断。
function gtEnsureConfirmStyles() {
    if (document.getElementById('gtConfirmStyles')) return;
    const style = document.createElement('style');
    style.id = 'gtConfirmStyles';
    style.textContent = `
.gt-confirm-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(6,7,16,.72);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:0;transition:opacity .18s ease}
.gt-confirm-overlay.is-open{opacity:1}
.gt-confirm-box{width:min(440px,92vw);border-radius:16px;padding:22px 22px 18px;background:linear-gradient(160deg,rgba(26,24,42,.98),rgba(14,13,26,.98));border:1px solid rgba(214,178,96,.45);box-shadow:0 24px 60px rgba(0,0,0,.55),inset 0 0 0 1px rgba(214,178,96,.12);color:#f3ecd9;transform:translateY(10px) scale(.98);transition:transform .18s ease}
.gt-confirm-overlay.is-open .gt-confirm-box{transform:translateY(0) scale(1)}
.gt-confirm-title{font-size:15px;letter-spacing:.08em;color:#e8c877;margin-bottom:10px;font-weight:600}
.gt-confirm-message{font-size:14px;line-height:1.7;color:#ded7c6;white-space:pre-wrap;word-break:break-word}
.gt-confirm-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
.gt-confirm-btn{cursor:pointer;border-radius:10px;padding:9px 18px;font-size:14px;border:1px solid transparent;transition:filter .15s ease,background .15s ease}
.gt-confirm-cancel{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.16);color:#cfc8ba}
.gt-confirm-cancel:hover{background:rgba(255,255,255,.12)}
.gt-confirm-ok{background:linear-gradient(135deg,#d8b56a,#b98f3d);color:#1a1508;font-weight:600}
.gt-confirm-ok:hover{filter:brightness(1.08)}
.gt-confirm-ok.is-danger{background:linear-gradient(135deg,#e07070,#b23b3b);color:#fff}
`;
    document.head.appendChild(style);
}

function gtConfirm(message, options = {}) {
    gtEnsureConfirmStyles();
    return new Promise(resolve => {
        const title = options.title || '请确认';
        const confirmText = options.confirmText || '确认';
        const cancelText = options.cancelText || '取消';
        const dangerous = options.dangerous === true;

        const overlay = document.createElement('div');
        overlay.className = 'gt-confirm-overlay';

        const box = document.createElement('div');
        box.className = 'gt-confirm-box';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');

        const titleEl = document.createElement('div');
        titleEl.className = 'gt-confirm-title';
        titleEl.textContent = title;

        const msgEl = document.createElement('div');
        msgEl.className = 'gt-confirm-message';
        msgEl.textContent = String(message ?? '');

        const actions = document.createElement('div');
        actions.className = 'gt-confirm-actions';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'gt-confirm-btn gt-confirm-cancel';
        cancelBtn.textContent = cancelText;

        const okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.className = 'gt-confirm-btn gt-confirm-ok' + (dangerous ? ' is-danger' : '');
        okBtn.textContent = confirmText;

        actions.appendChild(cancelBtn);
        actions.appendChild(okBtn);
        box.appendChild(titleEl);
        box.appendChild(msgEl);
        box.appendChild(actions);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        let settled = false;
        const cleanup = result => {
            if (settled) return;
            settled = true;
            document.removeEventListener('keydown', onKey, true);
            overlay.remove();
            resolve(result);
        };
        const onKey = event => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cleanup(false); }
            else if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); cleanup(true); }
        };
        cancelBtn.addEventListener('click', () => cleanup(false));
        okBtn.addEventListener('click', () => cleanup(true));
        overlay.addEventListener('click', event => { if (event.target === overlay) cleanup(false); });
        document.addEventListener('keydown', onKey, true);

        requestAnimationFrame(() => { overlay.classList.add('is-open'); okBtn.focus(); });
    });
}

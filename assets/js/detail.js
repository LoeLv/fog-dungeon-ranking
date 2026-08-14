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

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

async function refreshCurrentProfileFromCloud(options = {}) {
    if (USE_LOCAL_FALLBACK || !inviteSession?.code) return { data: null, error: null };
    const { data, error, name, role } = await invokeDungeonAction('getMyProfile', {}, null, {
        preserveSessionOnInvalid: options.preserveSessionOnInvalid === true
    });
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

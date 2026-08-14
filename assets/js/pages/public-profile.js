// Public profile modal and dossier rendering used by the leaderboard page.

function closePublicProfileModal(e) {
    const overlay = document.getElementById('publicProfileModalOverlay');
    if (!overlay) return;
    if (e && e.target !== overlay) return;
    overlay.style.display = 'none';
    document.body.style.overflow = '';
}

function buildLocalPublicProfilePreview(key) {
    const storedProfile = getStoredProfiles()[key];
    if (!storedProfile) return { data: null, error: { message: '这份本地档案已经不存在。' } };
    const profile = { ...getProfileDefaults(), ...storedProfile };
    const displayName = cleanDisplayNameInput(profile.displayName || '') || '未命名信徒';
    const nameKey = displayName.trim().toLowerCase();
    const dungeons = getLocalData('dungeons', []);
    const authoredDungeons = (dungeons || [])
        .filter(d => nameKey && ([d.invite_name, d.creator].some(value => String(value || '').trim().toLowerCase() === nameKey) || isCoCreatorName(d, nameKey)))
        .slice(0, 12);
    const authoredCommentCount = authoredDungeons.reduce((sum, d) => sum + Number(d.comment_count || 0), 0);
    const avgAuthoredRating = authoredDungeons.length
        ? authoredDungeons.reduce((sum, d) => sum + Number(d.avg_rating || 0), 0) / authoredDungeons.length
        : 0;
    return {
        data: {
            profileKey: key,
            profile: {
                display_name: displayName,
                role: profile.role,
                faith_god: profile.faithGod,
                faith_path: profile.faithPath,
                profession: profile.profession,
                ascension_score: profile.ascensionScore,
                audience_score: profile.audienceScore,
                items: profile.items,
                talents: profile.talents,
                active_title: normalizeProfileTitle(profile.activeTitle),
                active_titles: normalizeProfileTitleList(profile.activeTitles, profile.activeTitle),
                show_titles: profile.showTitles !== false,
                active_curse: normalizeProfileCurse(profile.activeCurse),
                active_curses: normalizeProfileCurseList(profile.activeCurses, profile.activeCurse),
                updated_at: profile.updatedAt,
                is_current: key === getProfileKey()
            },
            clearRecords: [],
            authoredDungeons,
            stats: {
                clearRecordCount: 0,
                uniqueClearDungeonCount: 0,
                authoredCount: authoredDungeons.length,
                authoredCommentCount,
                avgAuthoredRating
            }
        },
        error: null
    };
}

async function fetchPublicProfilePreview(key) {
    if (USE_LOCAL_FALLBACK || !inviteSession?.code) return buildLocalPublicProfilePreview(key);
    if (!/^[a-f0-9]{64}$/i.test(String(key || ''))) {
        return { data: null, error: { message: '这条榜单记录缺少公开档案标识，请刷新榜单后重试。' } };
    }
    const { data, error } = await invokeDungeonAction('getPublicProfile', { profileKey: key });
    return { data, error };
}

function normalizePublicProfilePayload(payload) {
    const profile = mapCloudProfileToLocal(payload?.profile) || getProfileDefaults();
    return {
        profileKey: payload?.profileKey || payload?.profile_key || payload?.profile?.profile_key || '',
        profile,
        isCurrent: !!(payload?.profile?.is_current || payload?.is_current),
        clearRecords: Array.isArray(payload?.clearRecords) ? payload.clearRecords : [],
        authoredDungeons: Array.isArray(payload?.authoredDungeons) ? payload.authoredDungeons : [],
        stats: payload?.stats || {}
    };
}

function renderPublicProfileClearRecords(records, faithGod = '命运') {
    if (!records.length) return renderRitualEmpty(`${getGodOracle(faithGod)} 尚未公开通关履迹。`, faithGod, '公开履迹暂空');
    return records.slice(0, 12).map(record => {
        const d = record.dungeon || {};
        const targetId = record.dungeon_id || d.id || '';
        const title = d.name || '未知试炼';
        const god = d.type ? `${formatGodName(d.type)} · ${formatGodPath(d.type)}命途` : '未归档神明';
        const note = record.feedback_note ? `反馈：${record.feedback_note}` : '已登记通过。';
        const tags = Array.isArray(record.feedback_tags) && record.feedback_tags.length ? ` · ${record.feedback_tags.join(' / ')}` : '';
        const clickAttr = targetId ? ` onclick='openDetailFromPublicProfile(${jsString(targetId)})'` : '';
        return `
            <article class="profile-list-item${targetId ? ' clickable' : ''}"${clickAttr}>
                <div class="profile-list-title">
                    <span>《${escapeHtml(title)}》</span>
                    <small>${escapeHtml(formatDate(record.created_at))}</small>
                </div>
                <div class="profile-list-meta">试炼轮回：第 ${Number(record.run_number || 1)} 周目 · ${escapeHtml(god)}</div>
                <div class="profile-list-meta">${escapeHtml(note)}${escapeHtml(tags)}</div>
            </article>`;
    }).join('');
}

function renderPublicProfileAuthoredDungeons(authored, faithGod = '命运') {
    if (!authored.length) return renderRitualEmpty(`${getGodOracle(faithGod)} 尚未留下公开构筑记录。`, faithGod, '构筑记录暂空');
    return authored.slice(0, 12).map(d => {
        const clickAttr = d.id ? ` onclick='openDetailFromPublicProfile(${jsString(d.id)})'` : '';
        return `
            <article class="profile-list-item${d.id ? ' clickable' : ''}"${clickAttr}>
                <div class="profile-list-title">
                    <span>《${escapeHtml(d.name || '未命名试炼')}》</span>
                    <small>神格 ${Number(d.avg_rating || 0).toFixed(1)}</small>
                </div>
                <div class="profile-list-meta">${escapeHtml(formatGodName(d.type))} · ${escapeHtml(formatGodPath(d.type))}命途 · ${escapeHtml(formatDifficulty(d.difficulty))}</div>
                <div class="profile-list-meta">证言 ${Number(d.comment_count || 0)} · 通关留存率 ${formatClearRate(d)} · ${formatDate(d.created_at)}</div>
            </article>`;
    }).join('');
}

function renderPublicProfileDossier(payload) {
    const data = normalizePublicProfilePayload(payload);
    const profile = data.profile;
    const faith = getProfileDisplayFaith(profile);
    const faithGod = getProfileFaithGod(profile) || faith.god || '命运';
    const faithSkin = getGodSkin(faithGod);
    const faithStyle = getGodSkinStyle(faithGod);
    const faithClass = faith.className || getPathClassByPath(faith.path || '虚无');
    const profession = getProfessionInfo(profile.profession);
    const roleLabel = ROLE_LABELS[normalizeRole(profile.role) || 'player'] || '入局信徒';
    const displayName = cleanDisplayNameInput(profile.displayName || '') || '未命名信徒';
    const clearRecords = data.clearRecords;
    const authored = data.authoredDungeons;
    const uniqueCleared = Number(data.stats.uniqueClearDungeonCount ?? new Set(clearRecords.map(record => String(record.dungeon_id || record.dungeon?.id || ''))).size);
    const clearCount = Number(data.stats.clearRecordCount ?? clearRecords.length);
    const authoredCount = Number(data.stats.authoredCount ?? authored.length);
    const authoredCommentCount = Number(data.stats.authoredCommentCount ?? authored.reduce((sum, d) => sum + Number(d.comment_count || 0), 0));
    const avgAuthoredRating = Number(data.stats.avgAuthoredRating ?? (authored.length ? authored.reduce((sum, d) => sum + Number(d.avg_rating || 0), 0) / authored.length : 0));
    const faithProgress = Math.min(100, Math.max(6, Math.round(uniqueCleared * 12 + authoredCount * 8 + Number(profile.audienceScore || 0))));
    return `
        <section class="profile-hero" data-god="${escapeHtml(faithGod)}" data-motif="${escapeHtml(faithSkin.motif)}" style="${faithStyle}">
            <div class="profile-avatar ${faithClass}" style="${faithStyle}">${renderGodSigil(faithGod, 'lg')}</div>
            <div class="profile-hero-copy">
                <div class="profile-kicker">PUBLIC PILGRIM DOSSIER</div>
                ${renderProfileNameWithTitle(displayName, profile.activeTitle, { fallbackGod: faithGod, titles: profile.activeTitles, showTitles: profile.showTitles })}
                <div class="profile-subline">
                    <span class="mini-tag ${faithClass}">${escapeHtml(faith.label)}</span>
                    <span class="mini-tag ${faithClass}">${escapeHtml(faith.path)}命途</span>
                    <span class="metric-pill">${escapeHtml(roleLabel)}</span>
                    <span class="metric-pill">职业 <strong>${escapeHtml(profile.profession || '未填写')}</strong></span>
                    ${profession.known ? `<span class="metric-pill">${escapeHtml(profession.god)}之神 <strong>${escapeHtml(profession.className)}</strong></span>` : ''}
                </div>
                <div class="profile-faith-prayer">${escapeHtml(getGodPrayer(faithGod))} · ${escapeHtml(faithSkin.pattern)}</div>
            </div>
            <div class="profile-hero-stats">
                <div class="profile-hero-score"><span>登神之路</span><strong>${formatProfileScore(profile.ascensionScore)}</strong></div>
                <div class="profile-hero-score"><span>觐见之梯</span><strong>${formatProfileScore(profile.audienceScore)}</strong></div>
            </div>
            <div class="faith-progress-card">
                <div class="faith-progress-label"><span>公开履历</span><strong>${escapeHtml(faithSkin.motif)} · ${faithProgress}%</strong></div>
                <div class="faith-progress-track"><div class="faith-progress-fill" style="--faith-progress:${faithProgress}%"></div></div>
            </div>
        </section>
        <div class="public-profile-grid">
            <div>
                <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${faithStyle}">
                    <div class="profile-panel-title">
                        <span>公开数值</span>
                        <small>${escapeHtml(formatDate(profile.updatedAt))} 更新</small>
                    </div>
                    <div class="profile-score-row">
                        <div class="profile-score-card"><span>登神之路</span><strong>${formatProfileScore(profile.ascensionScore)}</strong></div>
                        <div class="profile-score-card"><span>觐见之梯</span><strong>${formatProfileScore(profile.audienceScore)}</strong></div>
                    </div>
                    <div class="metric-strip">
                        <span class="metric-pill">通关副本 <strong>${uniqueCleared}</strong></span>
                        <span class="metric-pill">通关记录 <strong>${clearCount}</strong></span>
                        <span class="metric-pill">构筑试炼 <strong>${authoredCount}</strong></span>
                    </div>
                </section>
                <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${faithStyle}">
                    <div class="profile-panel-title">
                        <span>试炼履迹录</span>
                        <small>${uniqueCleared} 个副本 / ${clearCount} 条记录</small>
                    </div>
                    <div class="profile-list">${renderPublicProfileClearRecords(clearRecords, faithGod)}</div>
                </section>
            </div>
            <div>
                ${renderProfileFaithObservatory(clearRecords, authored, faithGod, profile)}
                <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${faithStyle}">
                    <div class="profile-panel-title">
                        <span>构筑者记录</span>
                        <small>神格均值 ${authoredCount ? avgAuthoredRating.toFixed(1) : '—'}</small>
                    </div>
                    <div class="metric-strip">
                        <span class="metric-pill">构筑试炼 <strong>${authoredCount}</strong></span>
                        <span class="metric-pill">证言总数 <strong>${authoredCommentCount}</strong></span>
                    </div>
                    <div class="profile-list" style="margin-top:14px;">${renderPublicProfileAuthoredDungeons(authored, faithGod)}</div>
                </section>
                <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${faithStyle}">
                    <div class="profile-panel-title"><span>公开携带</span><small>道具 / 天赋</small></div>
                    ${renderProfileChips(profile.items, getGodEmptyText(faithGod, 'items', '未公开个人道具。'), faithGod)}
                    <div style="height:12px;"></div>
                    ${renderProfileChips(profile.talents, getGodEmptyText(faithGod, 'talents', '未公开个人天赋。'), faithGod)}
                </section>
            </div>
        </div>`;
}

async function openProfileFromLeaderboard(key) {
    if (key === getProfileKey() && inviteSession) {
        closeLeaderboardPage(false);
        await openProfilePage();
        return;
    }
    if (!inviteSession?.code && !USE_LOCAL_FALLBACK) {
        openInviteModal('先验入局谕令后可查看榜单公开档案。');
        return;
    }
    const overlay = document.getElementById('publicProfileModalOverlay');
    const content = document.getElementById('publicProfileModalContent');
    if (!overlay || !content) return;
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    content.innerHTML = '<div class="loading"><div class="spinner"></div><br>正在读取公开档案...</div>';
    overlay.scrollTop = 0;
    content.scrollTop = 0;
    const { data, error } = await fetchPublicProfilePreview(key);
    if (error || !data) {
        content.innerHTML = renderRitualEmpty(error?.message || '公开档案暂不可读。', '命运', '档案读取失败');
        return;
    }
    content.innerHTML = renderPublicProfileDossier(data);
    content.scrollTop = 0;
}

async function openDetailFromPublicProfile(id) {
    closePublicProfileModal();
    closeLeaderboardPage(false);
    await openDetail(id);
}

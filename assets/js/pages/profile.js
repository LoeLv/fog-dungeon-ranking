function isSameProfileName(value) {
    const currentName = String(inviteSession?.name || '').trim().toLowerCase();
    return currentName && String(value || '').trim().toLowerCase() === currentName;
}

function getAuthoredDungeons(dungeons) {
    if (!inviteSession) return [];
    return (dungeons || []).filter(d => isSameProfileName(d.invite_name) || isSameProfileName(d.creator) || isCoCreatorName(d));
}

async function fetchMyAuthoredDungeons(dungeons = null) {
    if (!inviteSession) return [];
    if (USE_LOCAL_FALLBACK) return getAuthoredDungeons(dungeons || await fetchDungeons());
    const { data, error } = await invokeDungeonAction('listMyDungeons', { limit: 100 });
    if (error) return getAuthoredDungeons(dungeons || []);
    return Array.isArray(data) ? data : [];
}

function buildLocalClearRecords(dungeons) {
    const dungeonMap = new Map((dungeons || []).map(d => [String(d.id), d]));
    const records = new Map();
    const code = inviteSession?.code || 'guest';
    Object.entries(getLocalData('cleared_supabase', {})).forEach(([key, value]) => {
        if (!value) return;
        const [dungeonId, runNumber, scopedCode] = key.split(':');
        if (scopedCode && scopedCode !== code) return;
        const dungeon = dungeonMap.get(String(dungeonId));
        records.set(`${dungeonId}:${runNumber || getRunCount(dungeon || {})}`, {
            id: key,
            dungeon_id: dungeonId,
            run_number: Number(runNumber || getRunCount(dungeon || {})),
            feedback_tags: [],
            feedback_note: '',
            created_at: '',
            dungeon
        });
    });
    Object.entries(getLocalData('cleared', {})).forEach(([key, value]) => {
        if (!value) return;
        const [dungeonId, runNumber] = key.split(':');
        const dungeon = dungeonMap.get(String(dungeonId));
        const recordKey = `${dungeonId}:${runNumber || getRunCount(dungeon || {})}`;
        if (records.has(recordKey)) return;
        records.set(recordKey, {
            id: key,
            dungeon_id: dungeonId,
            run_number: Number(runNumber || getRunCount(dungeon || {})),
            feedback_tags: [],
            feedback_note: '',
            created_at: '',
            dungeon
        });
    });
    return [...records.values()];
}

async function fetchMyClearRecords(dungeons) {
    const localRecords = buildLocalClearRecords(dungeons);
    if (USE_LOCAL_FALLBACK || !supabaseClient || !inviteSession?.code || !globalThis.crypto?.subtle) return localRecords;
    return getShortCachedRead('my-clear-records', async () => {
        try {
            const codeHash = await sha256Hex(inviteSession.code);
            const { data, error } = await supabaseClient
                .from('clear_records')
                .select('id,dungeon_id,run_number,invite_name,feedback_tags,feedback_note,created_at')
                .eq('invite_code_hash', codeHash)
                .order('created_at', { ascending: false });
            if (error) return localRecords;
            const dungeonMap = new Map((dungeons || []).map(d => [String(d.id), d]));
            return (data || []).map(record => ({
                ...record,
                dungeon: dungeonMap.get(String(record.dungeon_id)) || null
            }));
        } catch {
            return localRecords;
        }
    });
}

async function getAuthorCommentNotices(dungeons = null) {
    if (!inviteSession) return { notices: [], unread: [] };
    const sourceDungeons = dungeons || await fetchDungeons();
    const authored = await fetchMyAuthoredDungeons(sourceDungeons);
    if (!authored.length) return { notices: [], unread: [] };
    const seenAt = getProfileNoticeSeenTime();
    const seenTime = seenAt ? new Date(seenAt).getTime() : 0;
    const notices = [];
    for (const dungeon of authored) {
        const comments = await fetchComments(dungeon.id);
        comments
            .filter(comment => !comment.is_deleted && !isSameProfileName(comment.invite_name) && !isSameProfileName(comment.author))
            .forEach(comment => {
                const createdTime = comment.created_at ? new Date(comment.created_at).getTime() : 0;
                notices.push({
                    ...comment,
                    dungeon,
                    unread: createdTime > seenTime
                });
            });
    }
    notices.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return { notices, unread: notices.filter(item => item.unread) };
}

async function updateProfileNoticeBadge() {
    const roleBadge = document.getElementById('roleBadge');
    if (!roleBadge || !inviteSession) return;
    try {
        const keyAtStart = getProfileKey();
        const { unread } = await getAuthorCommentNotices();
        if (keyAtStart !== getProfileKey()) return;
        const count = unread.length;
        roleBadge.classList.toggle('has-notice', count > 0);
        if (count > 0) roleBadge.dataset.notice = count > 99 ? '99+' : String(count);
        else roleBadge.removeAttribute('data-notice');
    } catch (error) {
        console.warn('个人提醒读取失败:', error);
    }
}

function renderProfileClearRecords(records, faithGod = '命运') {
    if (!records.length) return renderRitualEmpty(`${getGodOracle(faithGod)} 尚未登记通关；踏入任意试炼后，这里会形成你的履迹录。`, faithGod, '试炼履迹暂空');
    return records.slice(0, 18).map(record => {
        const d = record.dungeon || {};
        const title = d.name || '未知试炼';
        const god = d.type ? `${formatGodName(d.type)} · ${formatGodPath(d.type)}命途` : '未归档神明';
        const note = record.feedback_note ? `反馈：${record.feedback_note}` : '本设备或神谕记录已登记通过。';
        const tags = Array.isArray(record.feedback_tags) && record.feedback_tags.length ? ` · ${record.feedback_tags.join(' / ')}` : '';
        return `
            <article class="profile-list-item clickable" onclick='openDetailFromProfile(${jsString(record.dungeon_id)})'>
                <div class="profile-list-title">
                    <span>《${escapeHtml(title)}》</span>
                    <small>${escapeHtml(formatDate(record.created_at))}</small>
                </div>
                <div class="profile-list-meta">试炼轮回：第 ${Number(record.run_number || 1)} 周目 · ${escapeHtml(god)}</div>
                <div class="profile-list-meta">${escapeHtml(note)}${escapeHtml(tags)}</div>
            </article>`;
    }).join('');
}

function renderProfileAuthoredDungeons(authored, faithGod = '命运') {
    if (!authored.length) return renderRitualEmpty(`${getGodOracle(faithGod)} 尚未构筑试炼切片；构筑完成后会进入筑戏人记录。`, faithGod, '构筑记录暂空');
    return authored.slice(0, 18).map(d => `
        <article class="profile-list-item clickable" onclick='openDetailFromProfile(${jsString(d.id)})'>
            <div class="profile-list-title">
                <span>《${escapeHtml(d.name || '未命名试炼')}》</span>
                <small>神格 ${Number(d.avg_rating || 0).toFixed(1)}</small>
            </div>
            <div class="profile-list-meta">${escapeHtml(formatGodName(d.type))} · ${escapeHtml(formatGodPath(d.type))}命途 · ${escapeHtml(formatDifficulty(d.difficulty))}</div>
            <div class="profile-list-meta">证言 ${Number(d.comment_count || 0)} · 通关留存率 ${formatClearRate(d)} · ${formatDate(d.created_at)}</div>
        </article>`).join('');
}

function renderProfileFaithObservatory(clearRecords, authored, faithGod, profile) {
    const clearedCounts = countDungeonsByPath(clearRecords, record => record.dungeon?.type);
    const authoredCounts = countDungeonsByPath(authored, dungeon => dungeon.type);
    const combinedCounts = Object.fromEntries(GOD_GROUPS.map(group => [
        group.path,
        Number(clearedCounts[group.path] || 0) + Number(authoredCounts[group.path] || 0)
    ]));
    const total = Object.values(combinedCounts).reduce((sum, value) => sum + Number(value || 0), 0);
    const faithPath = getGodInfo(faithGod).path;
    const faithCount = Number(combinedCounts[faithPath] || 0);
    const topPath = ERA_TIMELINE
        .map(era => ({ path: era.path, count: Number(combinedCounts[era.path] || 0) }))
        .sort((a, b) => b.count - a.count)[0];
    return `
        <section class="profile-panel" data-god="${escapeHtml(getGodInfo(faithGod).god)}" style="${getGodSkinStyle(faithGod)}">
            <div class="profile-panel-title">
                <span>信仰观测录</span>
                <small>游玩 / 构筑命途分布</small>
            </div>
            <div class="profile-observatory">
                <div class="profile-observatory-grid">
                    <div class="profile-observatory-card"><span>本命命途记录</span><strong>${faithCount}</strong></div>
                    <div class="profile-observatory-card"><span>最常接触命途</span><strong>${escapeHtml(topPath?.count ? topPath.path : '未定')}</strong></div>
                    <div class="profile-observatory-card"><span>观测切片总数</span><strong>${total}</strong></div>
                </div>
                ${renderFaithFlowBars(combinedCounts, total, { note: `寰宇信仰流向，见证你踏入或构筑的每一场愚戏。` })}
                <div class="profile-list-meta">${escapeHtml(getGodOracle(faithGod))}</div>
            </div>
        </section>`;
}

function renderProfileNotices(notices, faithGod = '命运') {
    if (!notices.length) return renderRitualEmpty(getGodEmptyText(faithGod, 'notices'), faithGod, '楼主提醒暂空');
    return notices.slice(0, 12).map(notice => {
        const d = notice.dungeon || {};
        return `
            <article class="profile-list-item profile-notice ${notice.unread ? 'unread' : ''} clickable" onclick='openDetailFromProfile(${jsString(notice.dungeon_id)})'>
                <div class="profile-list-title">
                    <span>${notice.unread ? '<span class="profile-notice-mark">未读</span> ' : ''}${escapeHtml(notice.author || notice.invite_name || '匿名信徒')}</span>
                    <small>${escapeHtml(formatDate(notice.created_at))}</small>
                </div>
                <div class="profile-list-meta">在《${escapeHtml(d.name || '未知试炼')}》下留下证言</div>
                <div class="profile-list-meta">${escapeHtml(truncateText(notice.content, 120))}</div>
            </article>`;
    }).join('');
}

async function renderProfilePage() {
    const container = document.getElementById('profileContent');
    if (!container) return;
    if (!inviteSession) {
        container.innerHTML = renderRitualEmpty('请先通过同契召引入局，再查看个人档案。', '命运', '个人档案尚未开启');
        return;
    }
    const inviteSnapshot = getInviteSnapshot();
    container.innerHTML = '<div class="loading"><div class="spinner"></div><br>正在读取个人档案...</div>';
    let profile = getCurrentProfile();
    const { state: talentState, error: talentError } = await fetchTalentState();
    if (!isInviteSnapshotCurrent(inviteSnapshot)) return;
    if (!talentError) profile = getCurrentProfile();
    setCurrentTalentState(talentState, talentError);
    const dungeons = await fetchDungeons();
    if (!isInviteSnapshotCurrent(inviteSnapshot)) return;
    const clearRecords = await fetchMyClearRecords(dungeons);
    const authored = await fetchMyAuthoredDungeons(dungeons);
    const { notices, unread } = await getAuthorCommentNotices(authored);
    const {
        messages: scoreMessages,
        unread: unreadScoreMessages,
        error: scoreMessageError
    } = await fetchMyScoreMessages(8);
    if (!isInviteSnapshotCurrent(inviteSnapshot)) return;
    const uniqueCleared = new Set(clearRecords.map(record => String(record.dungeon_id))).size;
    const totalAuthoredComments = authored.reduce((sum, d) => sum + Number(d.comment_count || 0), 0);
    const avgAuthorRating = authored.length
        ? authored.reduce((sum, d) => sum + Number(d.avg_rating || 0), 0) / authored.length
        : 0;
    const faith = getProfileDisplayFaith(profile);
    const faithGod = faith.god || '记忆';
    const faithClass = faith.className;
    const faithSkin = getGodSkin(faithGod);
    const faithStyle = getGodSkinStyle(faithGod);
    const faithLocked = isFaithLocked(profile);
    const professionLocked = isProfessionLocked(profile);
    const bindingMismatched = isProfileBindingMismatched(profile);
    const scoresLocked = areProfileScoresLocked(profile);
    const visualProfession = getProfileVisualProfession(profile);
    const profession = getProfessionInfo(visualProfession);
    const roleLabel = ROLE_LABELS[getInviteRole()] || '入局信徒';
    const faithProgress = Math.min(100, Math.max(6, Math.round(uniqueCleared * 12 + authored.length * 8 + Number(profile.audienceScore || 0))));
    const faithRank = getProfileFaithRank(faithGod, faithProgress);
    const authorPanel = (authored.length || canSubmit()) ? `
        <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${faithStyle}">
            <div class="profile-panel-title">
                <span>🎭 构筑者记录</span>
                <small>作者身份额外记录</small>
            </div>
            <div class="profile-score-row">
                <div class="profile-stat-card"><span>构筑试炼数</span><strong>${authored.length}</strong></div>
                <div class="profile-stat-card"><span>平均神格判定</span><strong>${authored.length ? avgAuthorRating.toFixed(1) : '—'}</strong></div>
            </div>
            <div class="metric-strip">
                <span class="metric-pill">证言总数 <strong>${totalAuthoredComments}</strong></span>
                <span class="metric-pill">楼主提醒 <strong>${unread.length}</strong></span>
            </div>
            <div class="profile-tools">
                <button class="btn btn-outline btn-sm" onclick="markProfileNoticesRead()">封缄楼主谕响</button>
            </div>
            <div class="profile-list" style="margin-top:14px;">${renderProfileAuthoredDungeons(authored, faithGod)}</div>
        </section>
        <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${faithStyle}">
            <div class="profile-panel-title">
                <span>📣 楼主提醒</span>
                <small>${unread.length ? `${unread.length} 条未读` : '暂无未读'}</small>
            </div>
            <div class="profile-list">${renderProfileNotices(notices, faithGod)}</div>
        </section>` : '';
    const page = document.getElementById('profilePage');
    if (page) {
        page.setAttribute('data-god', faithGod);
        page.setAttribute('data-path', faith.path || '');
        page.style.cssText = `display:block;${faithStyle}`;
    }
    container.innerHTML = `
        ${renderProfileAtmosphere(faithGod)}
        <section class="profile-hero" data-god="${escapeHtml(faithGod)}" data-motif="${escapeHtml(faithSkin.motif)}" style="${faithStyle}">
            <div class="profile-avatar ${faithClass}" style="${faithStyle}">${renderGodSigil(faithGod, 'lg')}</div>
            <div class="profile-hero-copy">
                <div class="profile-kicker">PERSONAL PILGRIM ARCHIVE</div>
                ${renderProfileNameWithTitle(inviteSession.name || roleLabel, profile.activeTitle, { fallbackGod: faithGod, titles: profile.activeTitles, showTitles: profile.showTitles })}
                <div class="profile-subline">
                    <span class="mini-tag ${faithClass}">${escapeHtml(faith.label)}</span>
                    <span class="mini-tag ${faithClass}">${escapeHtml(faith.path)}命途</span>
                    <span class="mini-tag ${faithClass}">${escapeHtml(roleLabel)}</span>
                    <span class="metric-pill">职业 <strong>${escapeHtml(visualProfession || '未填写')}</strong></span>
                    ${profession.known ? `<span class="metric-pill">${escapeHtml(profession.god)}之神 <strong>${escapeHtml(profession.className)}</strong></span>` : ''}
                    <span class="metric-pill" id="profileScoreMessagePill" style="${unreadScoreMessages.length ? '' : 'display:none;'}">结算信封 <strong>${unreadScoreMessages.length}</strong></span>
                    ${unread.length ? `<span class="metric-pill">楼主提醒 <strong>${unread.length}</strong></span>` : ''}
                </div>
                <div class="profile-faith-prayer">${escapeHtml(getGodPrayer(faithGod))} · ${escapeHtml(faithSkin.pattern)}</div>
                <div class="profile-faith-rank">当前信仰阶位 <strong>${escapeHtml(faithRank.title)}</strong></div>
            </div>
            <div class="profile-hero-stats">
                <div class="profile-hero-score"><span>登神之路</span><strong>${Number(profile.ascensionScore || 0)}</strong></div>
                <div class="profile-hero-score"><span>觐见之梯</span><strong>${Number(profile.audienceScore || 0)}</strong></div>
            </div>
            <div class="faith-progress-card">
                <div class="faith-progress-label"><span>信仰进度</span><strong>${escapeHtml(faithSkin.motif)} · ${faithProgress}%</strong></div>
                <div class="faith-progress-track"><div class="faith-progress-fill" style="--faith-progress:${faithProgress}%"></div></div>
            </div>
        </section>
        ${renderMobileProfileTabs()}
        <div class="profile-grid mobile-profile-layout">
            <div class="profile-mobile-section ${mobileProfileTab === 'base' ? 'active' : ''}" data-mobile-profile-section="base">
                <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${faithStyle}">
                    <div class="profile-panel-title">
                        <span>基础信仰设定</span>
                        <small>昵称会绑定到当前邀请码</small>
                    </div>
                    <div class="profile-form-grid">
                        <div class="form-group">
                            <label for="profileDisplayName">个人昵称</label>
                            <input id="profileDisplayName" maxlength="16" value="${escapeHtml(isInitialDisplayNameBinding() ? '' : (inviteSession.name || ''))}" placeholder="例如：无我" ${canEditDisplayName() ? '' : 'disabled'} title="${isInitialDisplayNameBinding() ? '首次绑定昵称，保存后不可自行更改' : (isAdminDisplayNameEdit() ? '馆主可更改身份昵称' : '昵称为身份绑定字段，只有馆主可以更改')}">
                            <div class="identity-help">${isInitialDisplayNameBinding() ? '这是首次绑定昵称，封存后会固定到当前谕令，之后不可自行更改。' : (isAdminDisplayNameEdit() ? '馆主可在这里校正自己的身份昵称。' : '昵称由入局谕令绑定；玩家、作者、审核员和神明不可自行更改。')}</div>
                        </div>
                        <div class="form-group">
                            <label for="profileFaithGod">信仰神明</label>
                            <select id="profileFaithGod" onchange="previewProfileFaithSkin(this.value)" ${faithLocked ? 'disabled' : ''}>${renderProfileGodOptions(getProfileVisualFaithGod(profile))}</select>
                            <div class="identity-help">${faithLocked ? `信仰已封存为 ${escapeHtml(faith.label)}，不可再改。` : (bindingMismatched ? '当前信仰与职业不匹配，请重新选择信仰与对应职业完成修复。' : (hasTrickeryFaithPrivilege(profile) ? '欺诈信徒可改写信仰档纹。' : '首次封存后信仰将刻入档案；欺诈信徒除外。'))}</div>
                        </div>
                        <div class="form-group full">
                            <label for="profileProfession">个人职业</label>
                        <select id="profileProfession" onchange="updateProfileBattlePanel()" ${professionLocked ? 'disabled' : ''}>${renderProfileProfessionOptions(visualProfession, getProfileVisualFaithGod(profile))}</select>
                            <div class="identity-help">${professionLocked ? `职业已封存为 ${escapeHtml(profile.profession)}，不可再改。` : (bindingMismatched ? '职业只能从当前信仰神明下选择，修复后会重新封存。' : (hasTrickeryFaithPrivilege(profile) ? '欺诈信徒可改写职业档纹。' : '请先选择信仰，再选择该信仰下的职业；首次封存后会刻入档案，欺诈信徒除外。'))}</div>
                        </div>
                        <div class="form-group">
                            <label for="profileAscensionScore">登神之路分数</label>
                            <input id="profileAscensionScore" type="number" min="0" step="0.1" value="${Number(profile.ascensionScore ?? DEFAULT_ASCENSION_SCORE)}" oninput="updateProfileBattlePanel()" ${scoresLocked ? 'disabled' : ''}>
                        </div>
                        <div class="form-group">
                            <label for="profileAudienceScore">觐见之梯分数</label>
                            <input id="profileAudienceScore" type="number" min="0" step="0.1" value="${Number(profile.audienceScore ?? DEFAULT_AUDIENCE_SCORE)}" ${scoresLocked ? 'disabled' : ''}>
                            <div class="identity-help">${scoresLocked ? `初始登神 ${DEFAULT_ASCENSION_SCORE}、觐见 ${DEFAULT_AUDIENCE_SCORE}；后续由结算信封改写，不可自行篡改。` : '馆主测试权限：可临时校准分数，用于二测验证。'}</div>
                        </div>
                        <div class="form-group full">
                            <label>当前称号</label>
                            ${renderProfileTitleStatus(profile.activeTitle, profile.activeCurse, faithGod, profile.activeTitles, profile.activeCurses, profile.showTitles)}
                            <label class="identity-help" for="profileTitleVisibilityToggle">
                                <input id="profileTitleVisibilityToggle" type="checkbox" ${profile.showTitles !== false ? 'checked' : ''} onchange="setProfileTitleVisibility(this.checked)">
                                佩戴称号
                            </label>
                        </div>
                        <div class="form-group full">
                            <label for="profileItems">个人道具</label>
                            <textarea id="profileItems" maxlength="800" placeholder="每行一个道具">${escapeHtml(profile.items)}</textarea>
                        </div>
                        <div class="form-group full">
                            <label>个人天赋</label>
                            <div class="identity-help">个人天赋由天赋仓库接管；信仰槽、职业槽与任意槽独立校验池子和品阶组合。</div>
                            <div id="profileTalentEquipPanel">${renderEquippedTalentSlots(talentState, faithGod)}</div>
                        </div>
                    </div>
                    <div class="profile-tools">
                        <button class="btn btn-outline btn-sm" onclick="openLeaderboardPage()">踏入登神观星台</button>
                        <button class="btn btn-outline btn-sm" onclick="exportProfileCardImage()">进献神恩</button>
                        <button class="btn btn-primary btn-sm" data-profile-save-button onclick="saveProfilePage()">封存信徒档案</button>
                    </div>
                </section>
                <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${faithStyle}">
                    <div class="profile-panel-title">
                        <span>个人数值</span>
                        <small id="profileScoreSyncLabel">${unreadScoreMessages.length ? `${unreadScoreMessages.length} 封未读` : '结算同步'}</small>
                    </div>
                    <div class="profile-score-row">
                        <div class="profile-score-card"><span>登神之路</span><strong>${Number(profile.ascensionScore || 0)}</strong></div>
                        <div class="profile-score-card"><span>觐见之梯</span><strong>${Number(profile.audienceScore || 0)}</strong></div>
                    </div>
                    <div class="metric-strip">
                        <span class="metric-pill">通关副本数 <strong>${uniqueCleared}</strong></span>
                        <span class="metric-pill">通关记录 <strong>${clearRecords.length}</strong></span>
                        <span class="metric-pill">当前身份 <strong>${escapeHtml(roleLabel)}</strong></span>
                    </div>
                </section>
                ${renderProfileBattlePanel(profile)}
                <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${faithStyle}">
                    <div class="profile-panel-title"><span>个人道具</span></div>
                    ${renderProfileChips(profile.items, getGodEmptyText(faithGod, 'items', '还没有填写个人道具。'), faithGod)}
                </section>
            </div>
            <div class="profile-mobile-section ${mobileProfileTab === 'trials' ? 'active' : ''}" data-mobile-profile-section="trials">
                <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${faithStyle}">
                    <div class="profile-panel-title">
                        <span>试炼履迹录</span>
                        <small>${uniqueCleared} 个副本 / ${clearRecords.length} 条记录</small>
                    </div>
                    <div class="profile-list">${renderProfileClearRecords(clearRecords, faithGod)}</div>
                </section>
                ${renderProfileFaithObservatory(clearRecords, authored, faithGod, profile)}
                ${authorPanel}
            </div>
            <div class="profile-mobile-section ${mobileProfileTab === 'messages' ? 'active' : ''}" data-mobile-profile-section="messages">
                <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${faithStyle}">
                    <div class="profile-panel-title">
                        <span>结算信封</span>
                        <small id="scoreMessagesPanelCount">${unreadScoreMessages.length ? `${unreadScoreMessages.length} 封未读` : '暂无未读'}</small>
                    </div>
                    ${renderScoreMessages(scoreMessages, scoreMessageError, faithGod)}
                </section>
                <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${faithStyle}">
                    <div class="profile-panel-title">
                        <span>📣 楼主提醒</span>
                        <small>${unread.length ? `${unread.length} 条未读` : '暂无未读'}</small>
                    </div>
                    <div class="profile-tools">
                        <button class="btn btn-outline btn-sm" onclick="markProfileNoticesRead()">封缄楼主谕响</button>
                    </div>
                    <div class="profile-list" style="margin-top:14px;">${renderProfileNotices(notices, faithGod)}</div>
                </section>
            </div>
            <div class="profile-mobile-section ${mobileProfileTab === 'talent' ? 'active' : ''}" data-mobile-profile-section="talent">
                ${renderTalentPoolPanel(talentState, talentError, profile)}
            </div>
            <div class="profile-mobile-section ${mobileProfileTab === 'titles' ? 'active' : ''}" data-mobile-profile-section="titles">
                <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${faithStyle}">
                    <div class="profile-panel-title">
                        <span>当前称号</span>
                        <small>称号 / 诅咒状态</small>
                    </div>
                    ${renderProfileTitleStatus(profile.activeTitle, profile.activeCurse, faithGod, profile.activeTitles, profile.activeCurses, profile.showTitles)}
                </section>
            </div>
        </div>
        ${renderProfileChronicle(faithGod, profileChronicleIndex)}`;
    startProfileChronicleRotation(faithGod);
    setMobileProfileTab(mobileProfileTab, { scroll: false });
}

async function openProfilePage(initialTab = mobileProfileTab || 'base') {
    if (!inviteSession) {
        openInviteModal('先验入局谕令后可查看个人档案。');
        return;
    }
    mobileProfileTab = ['base', 'talent', 'trials', 'titles', 'messages'].includes(initialTab) ? initialTab : 'base';
    profileScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const detailOverlay = document.getElementById('detailOverlay');
    if (detailOverlay) detailOverlay.style.display = 'none';
    const leaderboardPage = document.getElementById('leaderboardPage');
    if (leaderboardPage) leaderboardPage.style.display = 'none';
    const scorePage = document.getElementById('scorePage');
    if (scorePage) scorePage.style.display = 'none';
    const matchPage = document.getElementById('matchPage');
    if (matchPage) matchPage.style.display = 'none';
    const adminPage = document.getElementById('adminPage');
    if (adminPage) adminPage.style.display = 'none';
    document.body.classList.remove('detail-view-open', 'leaderboard-view-open', 'score-view-open', 'match-view-open');
    document.body.classList.add('profile-view-open');
    document.getElementById('profilePage').style.display = 'block';
    window.scrollTo(0, 0);
    await renderProfilePage();
    setMobileProfileTab(mobileProfileTab, { scroll: false });
}

function closeProfilePage(restoreScroll = true) {
    stopProfileChronicleRotation();
    const page = document.getElementById('profilePage');
    if (page) page.style.display = 'none';
    document.body.classList.remove('profile-view-open');
    setMobileNavActive('dungeons');
    if (restoreScroll !== false) requestAnimationFrame(() => window.scrollTo(0, profileScrollY || 0));
}

async function openDetailFromProfile(id) {
    closeProfilePage(false);
    await openDetail(id);
}

async function saveProfilePage() {
    if (!inviteSession?.code) {
        openInviteModal('先验入局谕令后可保存个人档案。');
        return;
    }
    if (!acquireUiActionLock('saveProfilePage', '个人档案正在保存，请勿重复点击')) return;
    const restoreSaveButtons = setActionButtonsBusy('[data-profile-save-button]', '保存中...');
    showToast('个人档案保存中，请勿重复点击');
    try {
        const name = canEditDisplayName()
            ? cleanDisplayNameInput(document.getElementById('profileDisplayName')?.value)
            : cleanDisplayNameInput(inviteSession.name || ROLE_LABELS[getInviteRole()] || '');
        if (!name) { showToast('请输入个人昵称'); return; }
        const currentProfile = getCurrentProfile();
        const lockedFaithGod = isFaithLocked(currentProfile) ? getProfileFaithGod(currentProfile) : '';
        const originalFaithGod = getProfileFaithGod(currentProfile);
        const selectedFaithGod = lockedFaithGod || cleanGodName(document.getElementById('profileFaithGod')?.value);
        if (!selectedFaithGod || !getGodInfo(selectedFaithGod).known) {
            showToast('请选择你的信仰神明');
            return;
        }
        const selectedFaithInfo = getGodInfo(selectedFaithGod);
        const lockedProfession = isProfessionLocked(currentProfile) ? currentProfile.profession : '';
        const selectedProfession = lockedProfession || normalizeProfession(document.getElementById('profileProfession')?.value);
        if (!selectedProfession) {
            showToast('请选择游戏里的 96 职业之一');
            return;
        }
        const selectedProfessionInfo = getProfessionInfo(selectedProfession);
        if (!selectedProfessionInfo.known || selectedProfessionInfo.god !== selectedFaithInfo.god) {
            showToast('职业必须选择当前信仰神明下的职业');
            return;
        }
        const scoresLocked = areProfileScoresLocked(currentProfile);
        const ascensionScore = scoresLocked
            ? (currentProfile.ascensionScore ?? DEFAULT_ASCENSION_SCORE)
            : normalizeProfileScore(document.getElementById('profileAscensionScore')?.value, DEFAULT_ASCENSION_SCORE);
        const audienceScore = scoresLocked
            ? (currentProfile.audienceScore ?? DEFAULT_AUDIENCE_SCORE)
            : normalizeProfileScore(document.getElementById('profileAudienceScore')?.value, DEFAULT_AUDIENCE_SCORE);
        const nextScoresLockedAt = canEditProfileScores()
            ? (currentProfile.scoresLockedAt || '')
            : (currentProfile.scoresLockedAt || new Date().toISOString());
        const profile = {
            displayName: name,
            role: getInviteRole() || '',
            faithGod: selectedFaithInfo.god,
            faithPath: selectedFaithInfo.path,
            originalFaithGod: currentProfile.originalFaithGod || selectedFaithInfo.god,
            originalFaithPath: currentProfile.originalFaithPath || selectedFaithInfo.path,
            profession: selectedProfession,
            ascensionScore,
            audienceScore,
            scoresLockedAt: nextScoresLockedAt,
            items: String(document.getElementById('profileItems')?.value || '').trim().slice(0, 800),
            talents: String(currentProfile.talents || '').trim().slice(0, 800),
            showTitles: currentProfile.showTitles !== false,
            activeTitle: currentProfile.activeTitle || null,
            activeTitles: normalizeProfileTitleList(currentProfile.activeTitles, currentProfile.activeTitle),
            activeCurse: currentProfile.activeCurse || null,
            activeCurses: normalizeProfileCurseList(currentProfile.activeCurses, currentProfile.activeCurse)
        };
        const isTrickerySave = hasTrickeryFaithPrivilege(currentProfile);
        const realFaithGod = isTrickerySave ? '欺诈' : (currentProfile.originalFaithGod || getProfileFaithGod(currentProfile) || '欺诈');
        const realFaithInfo = getGodInfo(realFaithGod);
        const realProfession = getProfessionInfo(currentProfile.profession).god === '欺诈'
            ? currentProfile.profession
            : '杂技演员';
        const cloudProfile = isTrickerySave ? {
            ...profile,
            faithGod: realFaithInfo.known ? realFaithInfo.god : '欺诈',
            faithPath: realFaithInfo.known ? realFaithInfo.path : '虚无',
            originalFaithGod: '欺诈',
            originalFaithPath: '虚无',
            profession: realProfession
        } : profile;
        const trickeryDisplayPatch = isTrickerySave ? {
            trickeryDisplayFaithGod: selectedFaithInfo.god,
            trickeryDisplayFaithPath: selectedFaithInfo.path,
            trickeryDisplayProfession: selectedProfession
        } : {};
        if (canEditDisplayName() && name !== inviteSession.name) {
            const { error } = await updateDisplayName(name);
            if (error) { showToast(`❌ ${getFriendlyActionError(error, '昵称保存失败')}`); return; }
        }
        const localProfile = isTrickerySave ? {
            ...currentProfile,
            displayName: name,
            role: getInviteRole() || '',
            ascensionScore,
            audienceScore,
            scoresLockedAt: nextScoresLockedAt,
            items: profile.items,
            talents: profile.talents,
            activeTitle: profile.activeTitle,
            activeTitles: profile.activeTitles,
            activeCurse: profile.activeCurse,
            activeCurses: profile.activeCurses,
            ...trickeryDisplayPatch
        } : profile;
        saveCurrentProfile(localProfile);
        const cloudSync = await syncProfileToCloud(cloudProfile);
        if (!cloudSync.error && isTrickerySave) {
            saveCurrentProfile({
                ...(cloudSync.data || localProfile),
                ...trickeryDisplayPatch,
                activeTitle: currentProfile.activeTitle || cloudSync.data?.activeTitle || null,
                activeTitles: normalizeProfileTitleList(currentProfile.activeTitles, currentProfile.activeTitle || cloudSync.data?.activeTitle),
                activeCurse: currentProfile.activeCurse || cloudSync.data?.activeCurse || null,
                activeCurses: normalizeProfileCurseList(currentProfile.activeCurses, currentProfile.activeCurse || cloudSync.data?.activeCurse),
                originalFaithGod: cloudSync.data?.originalFaithGod || currentProfile.originalFaithGod || cloudProfile.originalFaithGod,
                originalFaithPath: cloudSync.data?.originalFaithPath || currentProfile.originalFaithPath || cloudProfile.originalFaithPath,
                ascensionScore: cloudSync.data?.ascensionScore ?? profile.ascensionScore,
                audienceScore: cloudSync.data?.audienceScore ?? profile.audienceScore,
                scoresLockedAt: cloudSync.data?.scoresLockedAt || profile.scoresLockedAt,
                talents: cloudSync.data?.talents || profile.talents
            });
        }
        const shouldUseTrickeryFaithAction = isTrickerySave && !cloudSync.error;
        const trickeryFaithSync = shouldUseTrickeryFaithAction
            ? await syncTrickeryFaithToCloud(selectedFaithInfo.god, selectedProfession)
            : { data: null, error: null };
        const syncError = cloudSync.error || trickeryFaithSync.error;
        if (trickeryFaithSync.error) {
            showToast(`个人档案已保存，欺诈改信未同步：${trickeryFaithSync.error.message || '请检查专用接口'}`);
        } else if (cloudSync.error && !trickeryFaithSync.data) {
            showToast(`个人档案已本地保存，云端榜单未同步：${syncError.message || '请检查 Supabase 档案表'}`);
        } else {
            showToast('个人档案已保存');
        }
        updateInviteUI();
        await renderProfilePage();
        if (document.getElementById('leaderboardPage')?.style.display !== 'none') await renderLeaderboardPage();
        await renderDungeonList();
    } catch (error) {
        console.error('保存个人档案失败', error);
        showToast(`❌ ${getFriendlyActionError(error, '个人档案保存失败')}`);
    } finally {
        restoreSaveButtons();
        releaseUiActionLock('saveProfilePage');
    }
}

async function markProfileNoticesRead() {
    const { notices } = await getAuthorCommentNotices();
    const latest = notices[0]?.created_at || new Date().toISOString();
    setProfileNoticeSeenTime(latest);
    showToast('楼主提醒已标记为已读');
    await updateProfileNoticeBadge();
    await renderProfilePage();
}

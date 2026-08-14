async function openDetail(id) {
    const detailWasOpen = document.body.classList.contains('detail-view-open');
    if (!detailWasOpen) archiveScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    currentDetailId = id;
    replyTarget = null;
    const dungeons = await fetchDungeons();
    const summary = dungeons.find(d => d.id === id);
    if (!summary) { showToast('试炼未找到'); return; }
    const [detail, comments, feedbackSummary, rated] = await Promise.all([
        fetchDungeonDetail(id),
        fetchComments(id),
        fetchClearFeedbackSummary(id),
        checkHasRated(id)
    ]);
    const d = detail || summary;
    const reviewStatus = getDungeonReviewStatus(d);
    const published = isDungeonApproved(d);
    const ratingLocked = !canInteract() || !published;
    const testimonyLocked = !canTestify() || !published;
    const ratingText = !published ? `此试炼为${formatDungeonReviewStatus(d)}，暂不可判定` : (rated ? '你已经封存过这场神格评议。' : (ratingLocked ? '入局谕令后可对试炼做出判定' : '选择 1-5 级，封存你的神格评议'));
    const commentLockedAttrs = testimonyLocked ? 'disabled' : '';
    const commentPlaceholder = !published ? '通过审核后才可提交证言' : (testimonyLocked ? '入局谕令后可提交证言' : getTestimonyPlaceholder(d.type));
    const runCount = getRunCount(d);
    const clearLocalKey = `${id}:${runCount}:${inviteSession?.code || 'guest'}`;
    const clearDone = !!getLocalData('cleared_supabase', {})[clearLocalKey];
    const clearButtonText = clearDone ? '通关名已记录' : '待审核后登记';
    const clearRateNumber = Number.parseFloat(formatClearRate(d)) || 0;
    const godLabel = formatGodName(d.type);
    const godPath = formatGodPath(d.type);
    const godClass = getGodClass(d.type);
    const skin = getGodSkin(d.type);
    const godStyle = getGodSkinStyle(d.type);
    const difficultyLabel = formatDifficulty(d.difficulty);
    const activeCommentCount = comments.filter(c => !c.is_deleted).length;
    const ratingScore = Number(d.avg_rating || 0);
    const ratingValue = ratingScore ? ratingScore.toFixed(1) : '—';
    const judgementControl = rated
        ? '<span class="judgement-seal">已封存判定</span>'
        : `<button class="btn btn-outline btn-sm" onclick="${ratingLocked ? `openInviteModal('入局谕令后可进行判定。')` : `openRatingModal('${escapeHtml(id)}')`}">${ratingLocked ? '入局谕令' : '降下你的判定'}</button>`;
    const pinnedNote = d.pinned_note || '';
    const canEditNote = canEditPinned(d);
    const reviewActionsHtml = canReviewDungeon(d) && reviewStatus !== 'approved' ? `
        <div class="profile-tools" style="margin:12px 0;">
            <button class="btn btn-primary btn-sm" onclick="reviewDungeonUI('${escapeHtml(id)}', 'approve')">审核通过</button>
            <button class="btn btn-outline btn-sm" onclick="reviewDungeonUI('${escapeHtml(id)}', 'reject')">退回副本</button>
        </div>` : '';
    const pinnedNoteHtml = pinnedNote || canEditNote ? `
        <div class="pinned-note">
            <div class="pinned-note-head">
                <span>置顶神谕</span>
                ${canEditNote ? `<button class="text-action" onclick="togglePinnedEditor()">编辑</button>` : ''}
            </div>
            <div class="pinned-note-body" id="pinnedNoteBody">${pinnedNote ? escapeHtml(pinnedNote) : '构筑者还没有留下置顶神谕。'}</div>
            ${canEditNote ? `
                <div id="pinnedNoteEditor" style="display:none;margin-top:10px;">
                    <textarea id="pinnedNoteTextarea" maxlength="800" placeholder="写下开本时间、注意事项、车卡要求、构筑者补充神谕...">${escapeHtml(pinnedNote)}</textarea>
                    <div class="form-actions" style="margin-top:10px;">
                        <button class="btn btn-outline btn-sm" onclick="togglePinnedEditor(false)">取消</button>
                        <button class="btn btn-primary btn-sm" onclick="savePinnedNoteUI('${escapeHtml(id)}')">保存置顶</button>
                    </div>
                </div>` : ''}
        </div>` : '';
    const detailContent = document.getElementById('detailContent');
    detailContent.innerHTML = `
        <section class="trial-entry-window ${godClass}" data-god="${escapeHtml(getGodInfo(d.type).god)}" data-motif="${escapeHtml(skin.motif)}" style="${godStyle}">
            <div class="trial-entry-head">
                ${renderGodSigil(d.type, 'lg')}
                <div>
                    <div class="trial-entry-kicker">${escapeHtml(skin.entryTitle)}</div>
                    <h3>${escapeHtml(d.name || '未命名试炼')}</h3>
                    <p>${escapeHtml(godPath)} 命途 · ${escapeHtml(godLabel)} · 筑试人：${escapeHtml(formatCreatorLine(d))}</p>
                </div>
                <div class="trial-entry-score">
                    <span>神格判定</span>
                    <strong>${ratingValue}</strong>
                    <small>${escapeHtml(getRatingTier(ratingScore))} · 评议人数 ${Number(d.rating_count || 0)}</small>
                </div>
            </div>
            <div class="trial-entry-meta">
                <span class="tag god-tag ${godClass}">${escapeHtml(godLabel)}</span>
                <span class="tag path-tag ${godClass}">${escapeHtml(godPath)} 命途</span>
                <span class="tag ${getDiffClass(d.difficulty)} ${godClass}-difficulty">${escapeHtml(difficultyLabel)}</span>
                <span class="tag ${isOneShotDungeon(d) ? 'divine-tag' : ''}">${escapeHtml(formatTrialArchive(d))}</span>
                ${isDivineTrial(d) ? '<span class="tag divine-tag">神级愚戏</span>' : ''}
                <span class="trial-data-pill">${formatParticipants(d)}</span>
                <span class="trial-data-pill">${formatRunCount(d)}</span>
                <span class="trial-data-pill">归档：${escapeHtml(formatTrialArchive(d))}</span>
                <span class="trial-data-pill">通关留存率：${formatClearRate(d)}</span>
                <span class="trial-data-pill">证言数：${activeCommentCount}</span>
                <span class="trial-data-pill">审核状态：${escapeHtml(formatDungeonReviewStatus(d))}</span>
                ${canSubmit() ? `<button class="btn btn-outline btn-xs" onclick="advanceRunUI('${escapeHtml(id)}')">重开下一局</button>` : ''}
                ${canManageDungeon(d) ? `<button class="btn btn-outline btn-xs" onclick="editDungeonUI('${escapeHtml(id)}')">重铸副本</button>` : ''}
                ${canManageDungeon(d) ? `<button class="btn btn-danger btn-xs" onclick="deleteDungeon('${escapeHtml(id)}')">封存试炼</button>` : ''}
            </div>
            <div class="trial-entry-body">
                <p><strong>试炼说明：</strong>${escapeHtml(d.description || '此试炼尚未留下说明。')}</p>
                <p>${escapeHtml(skin.oracle)}</p>
            </div>
        </section>
        ${renderDetailDossier(d, { locked: ratingLocked, rated, clearDone, activeCommentCount })}
        ${reviewActionsHtml}
        ${pinnedNoteHtml}
        <div class="clear-panel">
            <div class="clear-panel-head">
                <span class="clear-panel-title">命运档案 · ${formatRunCount(d)}</span>
                <span class="clear-rate-big">${formatClearRate(d)}</span>
            </div>
            <div class="clear-progress"><div class="clear-progress-fill" style="width:${Math.max(0, Math.min(100, clearRateNumber))}%"></div></div>
            <div class="feedback-picker">
                <div class="feedback-tags">${renderFeedbackTags(true)}</div>
                <textarea id="clearFeedbackNote" class="feedback-note" maxlength="200" placeholder="通关由审核员结算确认；玩家不可自行登记。" disabled></textarea>
            </div>
            <div class="feedback-summary">${renderFeedbackSummary(feedbackSummary)}</div>
            <div class="clear-panel-foot">
                <span>已穿越裂隙 ${formatClearSlots(d)} 人次</span>
                <button class="btn btn-primary btn-sm" disabled>${clearButtonText}</button>
            </div>
        </div>
        <div class="rating-area judgement-area ${rated ? 'is-rated' : ''}">
            <div class="judgement-area-main">
                <span class="judgement-area-title">神格判定</span>
                <span class="rating-text">${ratingText}</span>
            </div>
            ${judgementControl}
        </div>
        <div class="comments-section">
            <div class="section-title">试炼证言 (${activeCommentCount})</div>
            <div class="testimony-launch ${godClass}" data-god="${escapeHtml(getGodInfo(d.type).god)}" style="${godStyle}">
                <div>
                    <div class="testimony-launch-title">${renderGodSigil(d.type, 'sm')} 提交试炼证言</div>
                    <div class="testimony-launch-note">当前身份：<strong>${testimonyLocked ? '访客' : escapeHtml(inviteSession?.name || ROLE_LABELS[getInviteRole()] || '匿名')}</strong></div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="${testimonyLocked ? `openInviteModal('入局谕令后可提交证言。')` : `openTestimonyModal('${escapeHtml(id)}')`}">${testimonyLocked ? '入局谕令' : '留下证言'}</button>
            </div>
            <div id="commentsList">${renderComments(comments, d.creator)}</div>
        </div>`;
    const overlay = document.getElementById('detailOverlay');
    const panel = document.getElementById('detailPanel');
    overlay.className = `detail-overlay ${godClass}`;
    overlay.dataset.god = getGodInfo(d.type).god;
    overlay.setAttribute('style', `${godStyle};display:block;`);
    overlay.dataset.layout = 'page';
    document.body.classList.add('detail-view-open');
    panel.className = `detail-panel ${godClass}`;
    panel.dataset.god = getGodInfo(d.type).god;
    panel.setAttribute('style', godStyle);
    const footer = document.getElementById('detailFooter');
    if (footer) {
        footer.innerHTML = `
            <span class="detail-footer-note">${escapeHtml(skin.oracle)}</span>
            <div class="detail-footer-actions">
                <button type="button" class="btn btn-outline btn-sm detail-leave-btn" onclick="closeDetail()">${escapeHtml(skin.cancelText)}</button>
                <button type="button" class="btn btn-primary btn-sm" onclick="focusTrialRecord()">${escapeHtml(skin.confirmText)}</button>
            </div>`;
    }
    const content = document.getElementById('detailContent');
    const resetDetailScroll = () => {
        if (content) content.scrollTo({ top: 0, behavior: 'auto' });
        panel.scrollTop = 0;
        overlay.scrollTop = 0;
        window.scrollTo(0, 0);
    };
    resetDetailScroll();
    requestAnimationFrame(() => requestAnimationFrame(resetDetailScroll));
}
function closeDetail(e){
    if(e && e.target!==document.getElementById('detailOverlay')) return;
    document.getElementById('detailOverlay').style.display='none';
    document.body.classList.remove('detail-view-open');
    document.body.style.overflow='';
    currentDetailId=null;
    requestAnimationFrame(() => window.scrollTo(0, archiveScrollY || 0));
}
function focusTrialRecord() {
    const target = document.getElementById('clearFeedbackNote') || document.querySelector('.clear-panel');
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof target.focus === 'function' && !target.disabled) target.focus();
}











function toggleFeedbackTag(button) {
    if (!button || button.disabled) return;
    button.classList.toggle('active');
}

function getSelectedFeedbackTags() {
    return [...document.querySelectorAll('.feedback-chip.active')].map(btn => btn.textContent.trim()).slice(0, 5);
}

async function openTestimonyModal(id, options = {}) {
    if (!requireInvite(['player', 'author', 'reviewer', 'admin', 'god'], '入局谕令后可提交试炼证言。')) return;
    testimonyTargetId = id;
    const dungeons = await fetchDungeons();
    const d = dungeons.find(item => item.id === id);
    if (!d) { showToast('试炼未找到'); return; }
    if (!options.keepReply) replyTarget = null;
    const info = getGodInfo(d.type);
    const godClass = getGodClass(d.type);
    const skin = getGodSkin(d.type);
    const godStyle = getGodSkinStyle(d.type);
    const modal = document.getElementById('testimonyModal');
    const sigil = document.getElementById('testimonyModalSigil');
    const prayer = document.getElementById('testimonyModalPrayer');
    const dossier = document.getElementById('testimonyModalDossier');
    const input = document.getElementById('testimonyContentInput');
    if (modal) {
        modal.className = `modal ritual-modal ${godClass}`;
        modal.dataset.god = info.god;
        modal.setAttribute('style', godStyle);
    }
    if (sigil) sigil.innerHTML = renderGodSigil(d.type, 'xl', 'detail-god-mark');
    if (prayer) prayer.textContent = `${skin.oracle} · ${info.god}之神`;
    if (dossier) {
        dossier.innerHTML = `
            <strong>${escapeHtml(d.name || '未命名试炼')}</strong>
            <span>${escapeHtml(info.god)}之神 · ${escapeHtml(info.path)}命途<br>难度：${escapeHtml(formatDifficulty(d.difficulty))} · 通关留存率：${formatClearRate(d)}</span>
        `;
    }
    if (input) {
        input.value = '';
        input.placeholder = getTestimonyPlaceholder(d.type);
    }
    syncReplyContext();
    document.getElementById('testimonyModalOverlay').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    document.getElementById('testimonyModal')?.scrollTo?.(0, 0);
    if (shouldAutoFocusModalInput()) setTimeout(() => input?.focus(), 50);
}

function closeTestimonyModal(e) {
    if (e && e.target !== document.getElementById('testimonyModalOverlay')) return;
    document.getElementById('testimonyModalOverlay').style.display = 'none';
    document.body.style.overflow = '';
}

async function setRatingModalContext(id) {
    const dungeons = await fetchDungeons();
    const d = dungeons.find(item => item.id === id);
    if (!d) return;
    const info = getGodInfo(d.type);
    const godClass = getGodClass(d.type);
    const skin = getGodSkin(d.type);
    const godStyle = getGodSkinStyle(d.type);
    const modal = document.getElementById('ratingModal');
    const sigil = document.getElementById('ratingModalSigil');
    const prayer = document.getElementById('ratingModalPrayer');
    const dossier = document.getElementById('ratingModalDossier');
    if (modal) {
        modal.className = `modal judgement-modal ritual-modal ${godClass}`;
        modal.dataset.god = info.god;
        modal.setAttribute('style', godStyle);
    }
    if (sigil) sigil.innerHTML = renderGodSigil(d.type, 'xl', 'detail-god-mark');
    if (prayer) prayer.textContent = `${skin.oracle} · ${info.god}之神`;
    if (dossier) {
        dossier.innerHTML = `
            <strong>${escapeHtml(d.name || '未命名试炼')}</strong>
            <span>${escapeHtml(info.god)}之神 · ${escapeHtml(info.path)}命途<br>难度：${escapeHtml(formatDifficulty(d.difficulty))} · 通关留存率：${formatClearRate(d)}</span>
        `;
    }
}

function syncReplyContext() {
    const contexts = [
        [document.getElementById('replyContext'), document.getElementById('replyContextText')],
        [document.getElementById('testimonyReplyContext'), document.getElementById('testimonyReplyContextText')]
    ];
    contexts.forEach(([context, text]) => {
        if (!context || !text) return;
        context.style.display = replyTarget ? 'flex' : 'none';
        if (replyTarget) text.textContent = `正在回应 ${replyTarget.author}，会显示在这条证言下面`;
    });
}

async function setReplyTarget(commentId, author) {
    replyTarget = { id: commentId, author };
    syncReplyContext();
    if (currentDetailId) await openTestimonyModal(currentDetailId, { keepReply: true });
}

function clearReplyTarget() {
    replyTarget = null;
    syncReplyContext();
    const input = document.getElementById('testimonyContentInput');
    if (input && testimonyTargetId) input.placeholder = '写下你在这场愚戏中的证言…';
}

function togglePinnedEditor(force) {
    const editor = document.getElementById('pinnedNoteEditor');
    if (!editor) return;
    const next = typeof force === 'boolean' ? force : editor.style.display === 'none';
    editor.style.display = next ? 'block' : 'none';
    if (next) document.getElementById('pinnedNoteTextarea')?.focus();
}

async function savePinnedNoteUI(id) {
    if (!requireInvite(['author', 'reviewer', 'admin'], '只有构筑者、审核员或馆主可以修改置顶神谕。')) return;
    const note = document.getElementById('pinnedNoteTextarea')?.value || '';
    const { error } = await savePinnedNote(id, note);
    if (error) { showToast(`❌ ${error.message || '保存失败'}`); return; }
    showToast('置顶神谕已更新');
    await openDetail(id);
    await renderDungeonList();
}

async function openRatingModal(id) {
    if (!requireInvite(['player', 'author', 'reviewer', 'admin'], '入局谕令后可进行神格判定。')) return;
    if (await checkHasRated(id)) {
        showToast('你已经封存过这场试炼的神格评议。');
        if (currentDetailId === id) await openDetail(id);
        return;
    }
    pendingRating = { dungeonId: id, value: 5 };
    await setRatingModalContext(id);
    renderRatingChoices();
    document.getElementById('ratingModalOverlay').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeRatingModal(e) {
    if (e && e.target !== document.getElementById('ratingModalOverlay')) return;
    document.getElementById('ratingModalOverlay').style.display = 'none';
    document.body.style.overflow = '';
}
function renderRatingChoices() {
    const grid = document.getElementById('ratingChoiceGrid');
    if (!grid) return;
    grid.innerHTML = [5, 4, 3, 2, 1].map(value => {
        const copy = getRatingCopy(value);
        const [tier, text] = copy.split('，');
        return `
            <button type="button" class="rating-choice ${pendingRating.value === value ? 'active' : ''}" onclick="selectRatingValue(${value})">
                <span class="rating-choice-mark">${value}</span>
                <span><strong>${escapeHtml(tier || String(value))}</strong>${escapeHtml(text || copy)}</span>
            </button>`;
    }).join('');
}

function selectRatingValue(value) {
    pendingRating.value = value;
    renderRatingChoices();
}

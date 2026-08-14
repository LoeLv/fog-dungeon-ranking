async function submitRatingJudgement() {
    if (!pendingRating.dungeonId || !pendingRating.value) { showToast('请选择神格判定'); return; }
    const { dungeonId, value } = pendingRating;
    if (await checkHasRated(dungeonId)) {
        closeRatingModal();
        showToast('你已经封存过这场试炼的神格评议。');
        if (currentDetailId === dungeonId) await openDetail(dungeonId);
        return;
    }
    closeRatingModal();
    await rateDungeon(dungeonId, value);
}

async function rateDungeon(id, val) {
    if (!requireInvite(['player', 'author', 'reviewer', 'admin'], '入局谕令后可进行神格判定。')) return;
    const lockKey = `rateDungeon:${id}`;
    if (!acquireUiActionLock(lockKey, '神格评议正在封存，请勿重复点击')) return;
    if (await checkHasRated(id)) {
        releaseUiActionLock(lockKey);
        showToast('你已经封存过这场试炼的神格评议。');
        if (currentDetailId === id) await openDetail(id);
        return;
    }
    try {
        const { error } = await addRating(id, val);
        if (error) {
            if (error.message?.includes('已经')) {
                markAsRated(id);
                showToast('你已经封存过神格评议。');
                if (currentDetailId === id) await openDetail(id);
                return;
            }
            showToast(`❌ ${error.message || '判定失败'}`);
            return;
        }
        markAsRated(id);
        showToast('神格评议已封存');
        if (currentDetailId === id) await openDetail(id);
        await renderDungeonList();
    } finally {
        releaseUiActionLock(lockKey);
    }
}

async function submitComment(id) {
    if (!requireInvite(['player', 'author', 'reviewer', 'admin', 'god'], '入局谕令后可提交试炼证言。')) return;
    const lockKey = `submitComment:${id}:${replyTarget?.id || 'root'}`;
    if (!acquireUiActionLock(lockKey, '证言正在提交，请勿重复点击')) return;
    const author = inviteSession?.name || ROLE_LABELS[getInviteRole()] || '';
    const input = document.getElementById('testimonyContentInput') || document.getElementById('commentContentInput');
    const content = input?.value.trim();
    if (!content) { releaseUiActionLock(lockKey); showToast('请输入证言'); return; }
    try {
        const { error } = await addComment(id, author, content, replyTarget?.id || null);
        if (error) { showToast(`❌ ${error.message || '证言提交失败'}`); return; }
        showToast(replyTarget ? '副证言已提交' : '主证言已提交');
        clearReplyTarget();
        closeTestimonyModal();
        if (input) input.value = '';
        if (currentDetailId === id) await openDetail(id);
        await renderDungeonList();
        await renderLatestComments();
        await updateProfileNoticeBadge();
        if (document.getElementById('profilePage')?.style.display !== 'none') await renderProfilePage();
    } finally {
        releaseUiActionLock(lockKey);
    }
}

async function deleteCommentUI(commentId) {
    if (!requireInvite(['player', 'author', 'reviewer', 'admin', 'god'], '入局谕令后才能删除证言。')) return;
    if (!confirm('确定删除这条证言吗？')) return;
    const lockKey = `deleteComment:${commentId}`;
    if (!acquireUiActionLock(lockKey, '证言正在删除，请勿重复点击')) return;
    try {
        const { error } = await removeComment(commentId);
        if (error) { showToast(`❌ ${error.message || '删除失败'}`); return; }
        showToast('证言已删除');
        if (currentDetailId) await openDetail(currentDetailId);
        await renderDungeonList();
        await renderLatestComments();
        await updateProfileNoticeBadge();
        if (document.getElementById('profilePage')?.style.display !== 'none') await renderProfilePage();
    } finally {
        releaseUiActionLock(lockKey);
    }
}

async function markClearedUI(id) {
    if (!requireInvite(['player', 'author', 'reviewer', 'admin'], '入局谕令后可登记通关。')) return;
    const lockKey = `markCleared:${id}`;
    if (!acquireUiActionLock(lockKey, '通关登记正在提交，请勿重复点击')) return;
    const feedbackTags = getSelectedFeedbackTags();
    const feedbackNote = document.getElementById('clearFeedbackNote')?.value || '';
    try {
        const { error } = await markDungeonCleared(id, feedbackTags, feedbackNote);
        if (error) { showToast(`❌ ${error.message || '登记失败'}`); return; }
        const dungeons = await fetchDungeons();
        const d = dungeons.find(item => item.id === id);
        const key = `${id}:${getRunCount(d || {})}:${inviteSession?.code || 'guest'}`;
        const cleared = getLocalData('cleared_supabase', {});
        cleared[key] = true;
        setLocalData('cleared_supabase', cleared);
        showToast('通关已记录');
        if (currentDetailId === id) await openDetail(id);
        await renderDungeonList();
        await renderLatestComments();
        if (document.getElementById('profilePage')?.style.display !== 'none') await renderProfilePage();
    } finally {
        releaseUiActionLock(lockKey);
    }
}

async function advanceRunUI(id) {
    if (!requireInvite(['author', 'reviewer', 'admin', 'god'], '只有构筑者、审核员、神明或神谕馆主可以重开下一局。')) return;
    if (!confirm('确定重开下一局吗？通关率会按新的总参与人次重新计算。')) return;
    const lockKey = `advanceRun:${id}`;
    if (!acquireUiActionLock(lockKey, '下一局正在重开，请勿重复点击')) return;
    try {
        const { error } = await advanceDungeonRun(id);
        if (error) { showToast(`❌ ${error.message || '重开失败'}`); return; }
        showToast('已重开下一局');
        if (currentDetailId === id) await openDetail(id);
        await renderDungeonList();
    } finally {
        releaseUiActionLock(lockKey);
    }
}

async function editDungeonUI(id) {
    if (!requireInvite(['author', 'reviewer', 'admin', 'god'], '只有构筑者、同契共筑者或馆主可以重铸副本。')) return;
    const dungeons = await fetchDungeons();
    const dungeon = dungeons.find(item => String(item.id) === String(id));
    if (!dungeon) { showToast('试炼未找到'); return; }
    if (!canManageDungeon(dungeon)) { showToast('只有原作者、同契共筑者或馆主可以重铸副本'); return; }
    const detail = await fetchDungeonDetail(id);
    openSubmitModal(detail || dungeon);
}

function setSubmitModalMode(dungeon = null) {
    editingDungeonId = dungeon?.id || '';
    const isEditing = !!editingDungeonId;
    const modalTitle = document.querySelector('#submitModal h2');
    const submitButton = document.querySelector('#submitForm button[type="submit"]');
    if (modalTitle) modalTitle.textContent = isEditing ? '重铸副本' : (isGodRole() ? '降下祈愿创本' : '构筑你的试炼愚戏');
    if (submitButton) submitButton.textContent = isEditing ? '重铸副本' : (isGodRole() ? '降下祈愿创本' : '献祭试炼至圣殿');
}

function fillSubmitModal(dungeon = null) {
    const form = document.getElementById('submitForm');
    if (!form) return;
    form.reset();
    resetSubmitDefaults();
    const creatorInput = document.getElementById('dungeonCreator');
    if (creatorInput) {
        creatorInput.disabled = false;
        creatorInput.readOnly = false;
        creatorInput.removeAttribute('aria-readonly');
    }
    if (!dungeon) {
        if (creatorInput && !creatorInput.value && inviteSession?.name && !inviteSession.name.includes('共享')) creatorInput.value = inviteSession.name;
        return;
    }
    document.getElementById('dungeonName').value = dungeon.name || '';
    document.getElementById('dungeonCreator').value = dungeon.creator || '';
    document.getElementById('dungeonCoCreators').value = getCoCreators(dungeon).join('、');
    document.getElementById('dungeonDifficulty').value = normalizeDifficulty(dungeon);
    document.getElementById('participantCount').value = Number(dungeon.participant_count || dungeon.participantCount || 1) || 1;
    document.getElementById('runCount').value = getRunCount(dungeon);
    document.getElementById('dungeonDesc').value = dungeon.description || '';
    document.getElementById('pinnedNoteInput').value = dungeon.pinned_note || '';
    document.getElementById('dungeonMode').value = isOneShotDungeon(dungeon) ? 'one_shot' : 'cycle';
    setSelectedSubmitGods(splitGodTags(dungeon.type));
}

function openSubmitModal(dungeon = null) {
    if (!requireInvite(['author', 'reviewer', 'admin', 'god'], '只有构筑者、审核员、神明或神谕馆主可以构筑试炼。')) return;
    try {
        setSubmitModalMode(dungeon);
        fillSubmitModal(dungeon);
        const creatorInput = document.getElementById('dungeonCreator');
        if (creatorInput) {
            creatorInput.readOnly = isGodRole();
            creatorInput.setAttribute('aria-readonly', isGodRole() ? 'true' : 'false');
        }
        document.getElementById('submitModalOverlay').style.display = 'flex';
        document.body.style.overflow = 'hidden';
        document.getElementById('dungeonName').focus();
    } catch (error) {
        console.error('打开构筑窗口失败:', error);
        showToast('构筑窗口打开失败，请刷新后再试');
    }
}

function resetSubmitDefaults() {
    const godSelect = document.getElementById('dungeonType');
    const diffSelect = document.getElementById('dungeonDifficulty');
    const modeSelect = document.getElementById('dungeonMode');
    if (godSelect) Array.from(godSelect.options).forEach(option => { option.selected = false; });
    syncSubmitGodPicker();
    if (diffSelect) diffSelect.value = '中';
    if (modeSelect) modeSelect.value = 'cycle';
}

function closeSubmitModal(e) {
    if (e && e.target !== document.getElementById('submitModalOverlay')) return;
    document.getElementById('submitModalOverlay').style.display = 'none';
    document.body.style.overflow = '';
    document.getElementById('submitForm').reset();
    editingDungeonId = '';
    const creatorInput = document.getElementById('dungeonCreator');
    if (creatorInput) {
        creatorInput.disabled = false;
        creatorInput.readOnly = false;
        creatorInput.removeAttribute('aria-readonly');
    }
    resetSubmitDefaults();
    setSubmitModalMode(null);
}

function focusSubmitField(targetId, message) {
    showToast(message);
    const target = document.getElementById(targetId);
    const focusTarget = target?.closest('.form-group') || target;
    focusTarget?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (target && typeof target.focus === 'function' && target.tabIndex !== -1 && !target.disabled) {
        setTimeout(() => target.focus(), 180);
    }
}

async function submitDungeon(e) {
    e.preventDefault();
    if (!requireInvite(['author', 'reviewer', 'admin', 'god'], '只有构筑者、审核员、神明或神谕馆主可以提交试炼。')) return;
    const name = document.getElementById('dungeonName').value.trim();
    const creator = isGodRole() ? (inviteSession?.name || '') : document.getElementById('dungeonCreator').value.trim();
    const coCreators = parseCoCreators(document.getElementById('dungeonCoCreators')?.value || '');
    const difficulty = document.getElementById('dungeonDifficulty').value;
    const selectedTypes = getSelectedSubmitGods();
    const type = selectedTypes.join('、');
    const participantCount = Number(document.getElementById('participantCount').value);
    const runCount = Number(document.getElementById('runCount').value);
    const description = document.getElementById('dungeonDesc').value.trim();
    const pinnedNote = document.getElementById('pinnedNoteInput').value.trim();
    const mode = document.getElementById('dungeonMode').value;
    const btn = e.submitter || document.querySelector('#submitForm button[type="submit"]');
    if (!name) { focusSubmitField('dungeonName', '请输入试炼名称'); return; }
    if (!creator) { focusSubmitField('dungeonCreator', '请输入构筑者名称'); return; }
    if (!type) { focusSubmitField('dungeonType', '请选择神明标签'); return; }
    if (!Number.isFinite(participantCount) || participantCount < 1) { focusSubmitField('participantCount', '请输入有效的参与人数'); return; }
    if (!Number.isFinite(runCount) || runCount < 1) { focusSubmitField('runCount', '请输入有效的试炼轮回次数'); return; }
    const isEditing = !!editingDungeonId;
    const activeEditingDungeonId = editingDungeonId;
    const lockKey = editingDungeonId ? `submitDungeon:edit:${editingDungeonId}` : 'submitDungeon:new';
    if (!acquireUiActionLock(lockKey, '试炼正在提交，请勿重复点击')) return;
    if (btn) {
        btn.disabled = true;
        btn.textContent = isEditing ? '重铸中...' : (isGodRole() ? '降下中...' : '献祭中...');
    }
    try {
        const payload = { name, creator, coCreators, difficulty, participantCount, runCount, description, pinnedNote, type, mode, dungeonMode: mode, isOneShot: mode === 'one_shot' };
        const { error, data } = await addDungeon(payload, activeEditingDungeonId || undefined);
        if (error) { showToast(`❌ ${error.message || '提交失败'}`); return; }
        const savedDungeon = Array.isArray(data) ? data[0] : data;
        const dungeonId = activeEditingDungeonId || savedDungeon?.id || '';
        const submittedStatus = savedDungeon?.review_status || (canReviewDungeonsUI() ? 'approved' : 'pending');
        const successText = submittedStatus === 'approved'
            ? (isEditing ? '副本已重铸并发布' : '试炼已正式发布')
            : (isEditing ? '副本已重铸，等待审核' : '试炼已提交，等待审核后发布');
        showToast(successText);
        closeSubmitModal();
        if (dungeonId) await openDetail(dungeonId);
        await renderDungeonList();
        await renderLatestComments();
        await updateProfileNoticeBadge();
        if (document.getElementById('profilePage')?.style.display !== 'none') await renderProfilePage();
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = isEditing ? '重铸副本' : (isGodRole() ? '降下祈愿创本' : '献祭试炼至圣殿');
        }
        releaseUiActionLock(lockKey);
    }
}

async function reviewDungeonUI(id, decision) {
    if (!canReviewDungeonsUI()) { showToast('需要副本审核员权限'); return; }
    const approve = decision === 'approve';
    const note = approve ? '' : (prompt('填写退回原因（可选）') || '').trim().slice(0, 800);
    if (!approve && !confirm('确定退回这个副本吗？作者可重铸后再次提交。')) return;
    const lockKey = `reviewDungeon:${id}`;
    if (!acquireUiActionLock(lockKey, '副本正在审核，请勿重复点击')) return;
    try {
        const { error } = await reviewDungeon(id, decision, note);
        if (error) { showToast(`❌ ${error.message || '审核失败'}`); return; }
        showToast(approve ? '副本已审核通过并发布' : '副本已退回');
        await renderDungeonList();
        await openDetail(id);
    } finally {
        releaseUiActionLock(lockKey);
    }
}

async function deleteDungeon(id) {
    if (!requireInvite(['author', 'reviewer', 'admin', 'god'], '只有构筑者、同契共筑者或馆主可以封存试炼。')) return;
    if (!confirm('确定封存这场试炼吗？神格判定和证言会一起消失。')) return;
    const lockKey = `deleteDungeon:${id}`;
    if (!acquireUiActionLock(lockKey, '试炼正在封存，请勿重复点击')) return;
    try {
        const { error } = await removeDungeon(id);
        if (error) { showToast(`❌ ${error.message || '删除失败'}`); return; }
        showToast('试炼已封存');
        closeDetail();
        await renderDungeonList();
        await renderLatestComments();
        await updateProfileNoticeBadge();
        if (document.getElementById('profilePage')?.style.display !== 'none') await renderProfilePage();
    } finally {
        releaseUiActionLock(lockKey);
    }
}

function setSort(sort, btn) {
    currentSort = sort;
    archivePage = 1;
    document.querySelectorAll('.sort-btn[data-sort]').forEach(item => item.classList.remove('active'));
    if (btn) btn.classList.add('active');
    updateReviewFilterButton();
    renderDungeonList();
}

function debounceSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        searchQuery = document.getElementById('searchInput').value;
        archivePage = 1;
        renderDungeonList();
    }, 350);
}

function showToast(msg) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 3200);
}

function shouldGuardActionButton(button) {
    const action = `${button.getAttribute('onclick') || ''} ${button.getAttribute('type') || ''}`;
    return /(save|submit|delete|remove|mark|draw|exchange|equip|resolve|discard|grant|revoke|expand|showMore|loadMore|joinMatchQueue|cancelMatchQueue|advanceRun|reviewDungeon|addComment|rating|clear|保存|提交|删除|撤销|授予|回收|分解|兑换|结算|显示更多|展开)/i.test(action);
}

document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest('button');
    if (!button || button.disabled || !shouldGuardActionButton(button)) return;
    const now = Date.now();
    const lockedUntil = Number(button.dataset.clickGuardUntil || 0);
    if (lockedUntil > now) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showToast('操作正在处理中，请勿重复点击');
        return;
    }
    button.classList.add('is-action-ack');
    button.setAttribute('aria-busy', 'true');
    window.setTimeout(() => {
        button.classList.remove('is-action-ack');
        if (!button.disabled) button.removeAttribute('aria-busy');
    }, 650);
    button.dataset.clickGuardUntil = String(now + 900);
    window.setTimeout(() => {
        if (Number(button.dataset.clickGuardUntil || 0) <= Date.now()) delete button.dataset.clickGuardUntil;
    }, 950);
}, true);

document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const leaderboardPageButton = target.closest('[data-leaderboard-page-key][data-leaderboard-page]');
    if (leaderboardPageButton instanceof HTMLButtonElement) {
        event.preventDefault();
        let boardKey = '';
        try {
            boardKey = decodeURIComponent(leaderboardPageButton.dataset.leaderboardPageKey || '');
        } catch (error) {
            console.error('排行榜分页参数解析失败', error);
            showToast('排行榜分页参数无效，请刷新后重试');
            return;
        }
        setLeaderboardPage(boardKey, leaderboardPageButton.dataset.leaderboardPage || '1');
        return;
    }
    const leaderboardModeButton = target.closest('[data-leaderboard-mode]');
    if (leaderboardModeButton) {
        event.preventDefault();
        setLeaderboardMode(leaderboardModeButton.dataset.leaderboardMode || 'overall');
        return;
    }
    const leaderboardPathButton = target.closest('[data-leaderboard-path]');
    if (leaderboardPathButton) {
        event.preventDefault();
        setLeaderboardPath(leaderboardPathButton.dataset.leaderboardPath || 'all');
        return;
    }
    const replyButton = target.closest('[data-reply-comment-id]');
    if (replyButton) {
        event.preventDefault();
        setReplyTarget(replyButton.dataset.replyCommentId || '', replyButton.dataset.replyAuthor || '匿名');
        return;
    }
    const deleteCommentButton = target.closest('[data-delete-comment-id]');
    if (deleteCommentButton) {
        event.preventDefault();
        deleteCommentUI(deleteCommentButton.dataset.deleteCommentId || '');
    }
});
document.addEventListener('focusin', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.matches('input, textarea, select')) document.body.classList.add('mobile-keyboard-active');
});
document.addEventListener('focusout', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.matches('input, textarea, select')) {
        window.setTimeout(() => document.body.classList.remove('mobile-keyboard-active'), 120);
    }
});
document.addEventListener('touchstart', handleMobileTouchStart, { passive: true });
document.addEventListener('touchend', handleMobileTouchEnd, { passive: true });
window.addEventListener('resize', () => {
    window.clearTimeout(window.__fogMobileResizeTimer);
    window.__fogMobileResizeTimer = window.setTimeout(() => setMobileScreenClass(mobileActiveDestination || 'dungeons'), 120);
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        const detailOverlay = document.getElementById('detailOverlay');
        const profilePage = document.getElementById('profilePage');
        const leaderboardPage = document.getElementById('leaderboardPage');
        const matchPage = document.getElementById('matchPage');
        const scorePage = document.getElementById('scorePage');
        const publicProfileOverlay = document.getElementById('publicProfileModalOverlay');
        if (document.getElementById('testimonyModalOverlay').style.display === 'flex') closeTestimonyModal();
        else if (document.getElementById('ratingModalOverlay').style.display === 'flex') closeRatingModal();
        else if (document.getElementById('inviteModalOverlay').style.display === 'flex') closeInviteModal();
        else if (publicProfileOverlay && publicProfileOverlay.style.display === 'flex') closePublicProfileModal();
        else if (profilePage && getComputedStyle(profilePage).display !== 'none') closeProfilePage();
        else if (leaderboardPage && getComputedStyle(leaderboardPage).display !== 'none') closeLeaderboardPage();
        else if (matchPage && getComputedStyle(matchPage).display !== 'none') closeMatchPage();
        else if (scorePage && getComputedStyle(scorePage).display !== 'none') closeScorePage();
        else if (detailOverlay && getComputedStyle(detailOverlay).display !== 'none') closeDetail();
        else if (document.getElementById('submitModalOverlay').style.display === 'flex') closeSubmitModal();
    }
    if (e.key === 'Enter' && document.activeElement?.id === 'inviteCodeInput') submitInviteCode();
    if (e.key === 'Enter' && document.activeElement?.id === 'displayNameInput') saveDisplayName();
});

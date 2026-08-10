function formatParticipants(d) {
    const count = Number(d.participant_count || d.participantCount);
    return Number.isFinite(count) && count > 0 ? `同契人数：${count} 人组队` : '同契人数：未定';
}
function getParticipantCount(d) {
    const count = Number(d.participant_count || d.participantCount);
    return Number.isFinite(count) && count > 0 ? count : 0;
}
function getRunCount(d) {
    const count = Number(d.run_count || d.runCount);
    return Number.isFinite(count) && count > 0 ? count : 1;
}
function getClearCount(d) {
    const count = Number(d.clear_count || d.clearCount);
    return Number.isFinite(count) && count >= 0 ? count : 0;
}
function getTotalSlots(d) {
    return getParticipantCount(d) * getRunCount(d);
}
function formatRunCount(d) {
    return `试炼轮回：${getTrialCycle(d)}`;
}
function formatClearRate(d) {
    const stored = Number(d.clear_rate ?? d.clearRate);
    const slots = getTotalSlots(d);
    const value = Number.isFinite(stored) ? stored : (slots > 0 ? (getClearCount(d) / slots) * 100 : 0);
    return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}
function formatClearSlots(d) {
    const slots = getTotalSlots(d);
    return `${getClearCount(d)} / ${slots || '未定'}`;
}
function getDungeonReviewStatus(d) {
    return String(d?.review_status || 'approved');
}
function isDungeonApproved(d) {
    return getDungeonReviewStatus(d) === 'approved';
}
function formatDungeonReviewStatus(d) {
    const status = getDungeonReviewStatus(d);
    if (status === 'pending') return '待审核';
    if (status === 'rejected') return '已退回';
    return '已发布';
}
function truncateText(value, length = 80) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > length ? `${text.slice(0, length)}…` : text;
}

function canEditPinned(d) {
    const sessionName = String(inviteSession?.name || '').trim();
    const sessionNameKey = normalizeNameKey(sessionName);
    const sessionCode = String(inviteSession?.code || '').trim();
    const creator = String(d?.creator || '').trim();
    const inviteName = String(d?.invite_name || d?.inviteName || '').trim();
    const inviteHash = String(d?.invite_code_hash || d?.inviteCodeHash || '').trim();
    return isAdmin() ||
        d?.can_manage === true ||
        (!!sessionCode && !!inviteHash && sessionCode === inviteHash) ||
        (!!sessionNameKey && (sessionNameKey === normalizeNameKey(creator) || sessionNameKey === normalizeNameKey(inviteName))) ||
        isCoCreatorName(d, sessionName);
}

function canManageDungeon(d) {
    return canEditPinned(d);
}
function canReviewDungeon(d) {
    return canReviewDungeonsUI();
}

function canDeleteComment(c) {
    return isAdmin() || (!!inviteSession?.name && !!c.invite_name && inviteSession.name === c.invite_name) || (USE_LOCAL_FALLBACK && c.invite_code_hash === inviteSession?.code);
}

function buildCommentTree(comments) {
    const map = new Map();
    comments.forEach(comment => map.set(comment.id, { ...comment, replies: [] }));
    const roots = [];
    map.forEach(comment => {
        const parentId = comment.parent_comment_id || comment.parentCommentId;
        const parent = parentId ? map.get(parentId) : null;
        if (parent) parent.replies.push(comment);
        else roots.push(comment);
    });
    return roots;
}

function renderCommentHonorBadges(comment) {
    const titles = normalizeProfileTitleList(comment.active_titles || comment.activeTitles, comment.active_title || comment.activeTitle);
    const curses = normalizeProfileCurseList(comment.active_curses || comment.activeCurses, comment.active_curse || comment.activeCurse);
    const titleBadges = titles.slice(0, 3).map(title => {
        const god = title.titleGod || '命运';
        return `<span class="comment-honor-badge title" style="${getGodSkinStyle(god)}" title="${escapeHtml(`${god}｜${title.titleText}${title.titleNote ? `｜${title.titleNote}` : ''}`)}">神诞 · ${escapeHtml(title.titleText)}</span>`;
    });
    const curseBadges = curses.slice(0, 2).map(curse => {
        const god = curse.curseGod || '命运';
        const typeLabel = getProfileCurseBadgeLabel(curse.curseType);
        const visibleText = curse.curseNote
            ? `${curse.curseText}｜${truncateText(curse.curseNote, 14)}`
            : curse.curseText;
        return `<span class="comment-honor-badge curse" style="${getGodSkinStyle(god)}" title="${escapeHtml(`${god}｜${getProfileCurseTypeLabel(curse.curseType)}｜${curse.curseText}${curse.curseNote ? `｜${curse.curseNote}` : ''}`)}">${escapeHtml(typeLabel)} · ${escapeHtml(visibleText)}</span>`;
    });
    const extra = Math.max(0, titles.length - 3) + Math.max(0, curses.length - 2);
    const extraBadge = extra ? [`<span class="comment-honor-badge" title="还有 ${extra} 条称号或诅咒">+${extra}</span>`] : [];
    const badges = [...titleBadges, ...curseBadges, ...extraBadge];
    return badges.length ? `<span class="comment-honor-stack">${badges.join('')}</span>` : '';
}

function renderCommentNode(comment, depth = 0, floorNumber = '', creator = '') {
    const deleted = !!comment.is_deleted;
    const canReply = canInteract() && !deleted;
    const isReply = depth > 0;
    const isArchitect = !!creator && (comment.author === creator || comment.invite_name === creator);
    const roleLabel = isReply ? '副证言' : '主证言';
    const floorLabel = isReply ? '楼中证言' : `第 ${floorNumber} 则证言`;
    const replyLabel = isReply ? '回应副证' : '回应主证';
    const deleteButton = canDeleteComment(comment) && !deleted
        ? `<button type="button" class="text-action" data-delete-comment-id="${escapeHtml(comment.id)}">抹去证言</button>`
        : '';
    const replyAuthor = comment.author || comment.invite_name || '匿名';
    const honorBadges = renderCommentHonorBadges(comment);
    return `
        <div class="comment-item ${isReply ? 'reply' : 'root'} ${isArchitect ? 'architect' : ''}">
            <div class="comment-head">
                <div class="comment-author-line">
                    <span class="comment-role ${isReply ? 'reply' : 'root'}">${roleLabel}</span>
                    <span class="comment-author">${escapeHtml(comment.author || comment.invite_name || '匿名')}</span>
                    ${honorBadges}
                    <span class="comment-floor">${escapeHtml(floorLabel)}</span>
                </div>
                <span class="comment-time">${formatDate(comment.created_at)}</span>
            </div>
            <div class="comment-content ${deleted ? 'deleted-comment' : ''}">${escapeHtml(comment.content || '')}</div>
            <div class="comment-actions">
                ${canReply ? `<button type="button" class="text-action" data-reply-comment-id="${escapeHtml(comment.id)}" data-reply-author="${escapeHtml(replyAuthor)}">${replyLabel}</button>` : ''}
                ${deleteButton}
            </div>
            ${(comment.replies || []).length ? `<div class="comment-replies">${comment.replies.map(reply => renderCommentNode(reply, depth + 1, '', creator)).join('')}</div>` : ''}
        </div>`;
}

function renderComments(comments, creator = '') {
    const roots = buildCommentTree(comments);
    if (!roots.length) return '<div class="no-comments">尚无证言，成为第一位向试炼证言殿递交见闻的入局者。</div>';
    return roots.map((comment, index) => renderCommentNode(comment, 0, index + 1, creator)).join('');
}

function renderFeedbackTags(disabled) {
    return CLEAR_FEEDBACK_OPTIONS.map(tag => `<button type="button" class="feedback-chip" ${disabled ? 'disabled' : ''} onclick="toggleFeedbackTag(this)">${escapeHtml(tag)}</button>`).join('');
}

function renderFeedbackSummary(summary) {
    if (!summary.length) return '<div class="feedback-summary-title">暂无通关反馈标签</div>';
    return `
        <div class="feedback-summary-title">入局者通关反馈</div>
        <div class="feedback-summary-list">
            ${summary.map(item => `<span class="feedback-summary-pill">${escapeHtml(item.tag)} × ${Number(item.tag_count || 0)}</span>`).join('')}
        </div>`;
}

async function renderLatestComments() {
    const feed = document.getElementById('latestCommentsFeed');
    if (!feed) return;
    const comments = await fetchLatestComments(3);
    if (!comments.length) {
        feed.innerHTML = '<div class="feed-empty"><strong>神谕石壁暂时无声</strong><span>等第一位入局者递交证言，新的神谕会出现在这里。</span></div>';
        return;
    }
    const feedGlyphs = ['♟', '✦', '◈', '◇', '✧', '✷', '✹', '✺'];
    const feedMarks = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ'];
    feed.innerHTML = comments.map((comment, index) => {
        const dungeon = comment.dungeon || {};
        const title = dungeon.name || '未知试炼';
        const action = comment.parent_comment_id ? '楼中副证' : '递交证言';
        const godLabel = dungeon.type ? formatGodName(dungeon.type) : '未归档神明';
        const godPath = dungeon.type ? `${formatGodPath(dungeon.type)}命途` : '未知命途';
        const godClass = dungeon.type ? getGodClass(dungeon.type) : 'path-unknown';
        const difficultyLabel = dungeon.difficulty ? formatDifficulty(dungeon.difficulty) : '难度未定';
        const difficultyClass = dungeon.difficulty ? getDiffClass(dungeon.difficulty) : 'path-unknown';
        return `
            <article class="feed-item" onclick='openDetail(${jsString(comment.dungeon_id)})'>
                <div class="feed-sigil"><span>${feedGlyphs[index % feedGlyphs.length]}</span><small>${feedMarks[index] || index + 1}</small></div>
                <div class="feed-main">
                    <div class="feed-row">
                        <span class="feed-author">${escapeHtml(comment.author || '匿名探索者')}</span>
                        ${renderCommentHonorBadges(comment)}
                        <span class="feed-action">${escapeHtml(action)}</span>
                        <span class="feed-dungeon">《${escapeHtml(title)}》</span>
                    </div>
                    <div class="feed-lore">${escapeHtml(truncateText(comment.content, 120))}</div>
                    <div class="feed-meta">
                        <span class="mini-tag ${godClass}">${escapeHtml(godLabel)}</span>
                        <span class="mini-tag ${godClass}">${escapeHtml(godPath)}</span>
                        <span class="mini-tag ${difficultyClass}">${escapeHtml(difficultyLabel)}</span>
                    </div>
                </div>
                <time class="feed-time">${formatDate(comment.created_at)}</time>
            </article>`;
    }).join('');
}

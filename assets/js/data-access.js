async function updateDisplayName(displayName) {
    const name = cleanDisplayNameInput(displayName);
    if (!name) return { error: { message: '昵称不能为空' } };
    if (/[<>@#]/.test(name)) return { error: { message: '昵称不能包含特殊符号' } };
    if (!canEditDisplayName()) return { error: { message: '昵称为身份绑定字段，只有馆主可以更改' } };
    if (USE_LOCAL_FALLBACK) {
        if (!inviteSession) return { error: { message: '请先验入局谕令' } };
        saveInviteSession({ ...inviteSession, name });
        return { data: { display_name: name }, error: null, name };
    }
    return invokeDungeonAction('updateDisplayName', { displayName: name });
}

async function fetchDungeons(options = {}) {
    if (USE_LOCAL_FALLBACK) return getLocalData('dungeons', []);
    const force = !!options.force;
    if (!force) {
        const cached = readDungeonListCache();
        if (cached) return cached;
        if (dungeonListRequest) return dungeonListRequest;
    }
    const cacheVersion = dungeonListCacheVersion;
    dungeonListRequest = (async () => {
        // Keep the shared archive cache bounded. The detail view retrieves long text on demand.
        const { data, error } = await invokeDungeonAction('listDungeons', { limit: 120 });
        if (error) { showToast('❌ 获取数据失败'); return []; }
        const normalized = (data || []).map(d => ({ ...d, pinned_note: d.pinned_note || '' }));
        if (cacheVersion === dungeonListCacheVersion) writeDungeonListCache(normalized);
        return normalized;
    })();
    try {
        return await dungeonListRequest;
    } finally {
        dungeonListRequest = null;
    }
}

function hasActiveArchiveFilters() {
    return !!searchQuery.trim() || selectedGod !== 'all' || selectedPath !== 'all' || selectedDifficulty !== 'all' || reviewFilter !== 'all';
}

function canUsePagedArchive() {
    return !USE_LOCAL_FALLBACK && !hasActiveArchiveFilters() && !canReviewDungeonsUI();
}

async function fetchDungeonArchivePage(page = 1) {
    const safePage = Math.max(1, Math.floor(Number(page) || 1));
    const cacheName = `archive-page:${currentSort}:${safePage}:${ARCHIVE_PAGE_SIZE}`;
    return getShortCachedRead(cacheName, async () => {
        const { data, error } = await invokeDungeonAction('listDungeonArchivePage', {
            page: safePage,
            pageSize: ARCHIVE_PAGE_SIZE,
            sort: currentSort
        });
        if (error) throw new Error(error.message || '分页档案读取失败');
        return data || { dungeons: [], page: safePage, page_size: ARCHIVE_PAGE_SIZE, total: 0, total_pages: 1, sidebar: null };
    }, DUNGEON_LIST_CACHE_TTL_MS);
}

async function fetchDungeonDetail(dungeonId) {
    const id = String(dungeonId || '').trim();
    if (!id) return null;
    if (USE_LOCAL_FALLBACK) {
        const dungeons = await fetchDungeons();
        return dungeons.find(dungeon => String(dungeon?.id) === id) || null;
    }
    return getShortCachedRead(`dungeon-detail:${id}`, async () => {
        const { data, error } = await invokeDungeonAction('getDungeonDetail', { dungeonId: id });
        if (error) {
            console.warn('获取试炼详情失败:', error.message);
            return null;
        }
        return data || null;
    }, DUNGEON_LIST_CACHE_TTL_MS);
}

function normalizeHonorBuckets(response) {
    const buckets = response?.data?.byCommentId || response?.byCommentId || {};
    return buckets && typeof buckets === 'object' ? buckets : {};
}

async function fetchCommentHonorBuckets(commentIds) {
    if (USE_LOCAL_FALLBACK || !commentIds.length) return {};
    const { data, error } = await invokeDungeonAction('getCommentHonors', { commentIds });
    return error ? {} : normalizeHonorBuckets(data);
}

async function enrichCommentsWithHonors(comments) {
    const commentIds = [...new Set((comments || []).map(comment => String(comment?.id || '').trim()).filter(Boolean))];
    if (!commentIds.length || USE_LOCAL_FALLBACK) return comments;
    const byCommentId = await fetchCommentHonorBuckets(commentIds);
    return (comments || []).map(comment => {
        const bucket = byCommentId[String(comment?.id || '').trim()] || {};
        return {
            ...comment,
            active_titles: bucket.active_titles || [],
            active_curses: bucket.active_curses || [],
        };
    });
}

async function fetchComments(dungeonId) {
    if (USE_LOCAL_FALLBACK) {
        const all = getLocalData('comments', []);
        return all.filter(c => c.dungeon_id === dungeonId).sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
    }
    return getShortCachedRead(`comments:${dungeonId}`, async () => {
        const query = () => supabaseClient
            .from('comments')
            .select('id,dungeon_id,parent_comment_id,author,content,invite_name,is_deleted,created_at')
            .eq('dungeon_id', dungeonId)
            .order('created_at', { ascending: true });
        let { data, error } = await query();
        if (error) {
            console.warn('读取楼中楼证言失败，使用旧字段兼容:', error);
            const fallback = await supabaseClient
                .from('comments')
                .select('id,dungeon_id,author,content,invite_name,created_at')
                .eq('dungeon_id', dungeonId)
                .order('created_at', { ascending: true });
            data = fallback.data || [];
            error = fallback.error;
        }
        if (error) return [];
        const comments = (data || []).map(c => ({
            ...c,
            parent_comment_id: c.parent_comment_id || c.parentCommentId || null,
            is_deleted: !!c.is_deleted
        }));
        return await enrichCommentsWithHonors(comments);
    });
}

async function fetchLatestComments(limit = 3) {
    if (USE_LOCAL_FALLBACK) {
        const dungeons = getLocalData('dungeons', []);
        return getLocalData('comments', [])
            .filter(c => !c.is_deleted)
            .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, limit)
            .map(c => ({ ...c, dungeon: dungeons.find(d => d.id === c.dungeon_id) || null }));
    }
    return getShortCachedRead(`latest-comments:${limit}`, async () => {
        let { data, error } = await supabaseClient
            .from('comments')
            .select('id,dungeon_id,parent_comment_id,author,content,invite_name,is_deleted,created_at')
            .eq('is_deleted', false)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) {
            console.warn('读取最新楼中楼证言失败，使用旧字段兼容:', error);
            const fallback = await supabaseClient
                .from('comments')
                .select('id,dungeon_id,author,content,invite_name,created_at')
                .order('created_at', { ascending: false })
                .limit(limit);
            data = fallback.data || [];
            error = fallback.error;
        }
        if (error) return [];
        const dungeons = await fetchDungeons();
        return await enrichCommentsWithHonors((data || []).map(c => ({
            ...c,
            parent_comment_id: c.parent_comment_id || c.parentCommentId || null,
            is_deleted: !!c.is_deleted,
            dungeon: dungeons.find(d => d.id === c.dungeon_id) || null
        })));
    });
}

async function fetchClearFeedbackSummary(dungeonId) {
    if (USE_LOCAL_FALLBACK) {
        const local = getLocalData('clear_feedback', {});
        return Object.entries(local[dungeonId] || {}).map(([tag, tag_count]) => ({ tag, tag_count }));
    }
    return getShortCachedRead(`feedback:${dungeonId}`, async () => {
        const { data, error } = await supabaseClient
            .from('clear_feedback_summary')
            .select('tag,tag_count')
            .eq('dungeon_id', dungeonId)
            .order('tag_count', { ascending: false });
        return error ? [] : data || [];
    });
}

async function addDungeon(dungeonData) {
    if (USE_LOCAL_FALLBACK) {
        const dungeons = getLocalData('dungeons', []);
        if (dungeonData.dungeonId) {
            const d = dungeons.find(item => item.id === dungeonData.dungeonId);
            if (!d) return { error: { message: '试炼未找到' } };
            Object.assign(d, dungeonData, {
                id: dungeonData.dungeonId,
                pinned_note: dungeonData.pinnedNote || '',
                co_creators: dungeonData.coCreators || [],
                participant_count: dungeonData.participantCount,
                run_count: dungeonData.runCount,
                is_one_shot: !!dungeonData.isOneShot
            });
            setLocalData('dungeons', dungeons);
            return { data: [d], error: null };
        }
        const newDungeon = { id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2,6), ...dungeonData, clear_count:0, clear_rate:0, avg_rating:0, rating_count:0, comment_count:0, created_at: new Date().toISOString() };
        dungeons.push(newDungeon); setLocalData('dungeons', dungeons); return { data: [newDungeon], error: null };
    }
    return invokeDungeonAction('submitDungeon', dungeonData);
}

async function addRating(dungeonId, ratingValue) {
    if (USE_LOCAL_FALLBACK) {
        const rated = getLocalData('rated', {});
        const scoped = inviteScopedKey(dungeonId);
        if (rated[scoped] || rated[dungeonId]) return { error: { message: '你已经封存过神格评议了' } };
        rated[scoped] = ratingValue; rated[dungeonId] = ratingValue; setLocalData('rated', rated);
        const dungeons = getLocalData('dungeons', []);
        const d = dungeons.find(d => d.id === dungeonId);
        if (d) { const total = d.avg_rating * d.rating_count + ratingValue; d.rating_count += 1; d.avg_rating = Math.round((total / d.rating_count)*10)/10; setLocalData('dungeons', dungeons); }
        return { data: [{}], error: null };
    }
    return invokeDungeonAction('addRating', { dungeonId, rating: ratingValue });
}

async function addComment(dungeonId, author, content, parentCommentId = null) {
    const displayAuthor = cleanDisplayNameInput(author) || inviteSession?.name || '匿名探索者';
    if (USE_LOCAL_FALLBACK) {
        const comments = getLocalData('comments', []);
        const newComment = {
            id: 'c_'+Date.now(),
            dungeon_id: dungeonId,
            parent_comment_id: parentCommentId,
            author: displayAuthor,
            content: content.trim(),
            invite_code_hash: inviteSession?.code || 'local',
            invite_name: inviteSession?.name || displayAuthor,
            is_deleted: false,
            created_at: new Date().toISOString()
        };
        comments.push(newComment); setLocalData('comments', comments);
        const dungeons = getLocalData('dungeons', []); const d = dungeons.find(d=>d.id===dungeonId);
        if(d) { d.comment_count = (d.comment_count||0)+1; setLocalData('dungeons', dungeons); }
        return { data: [newComment], error: null };
    }
    return invokeDungeonAction('addComment', { dungeonId, parentCommentId, author: displayAuthor, content: content.trim() });
}

async function removeComment(commentId) {
    if (USE_LOCAL_FALLBACK) {
        const comments = getLocalData('comments', []);
        const comment = comments.find(c => c.id === commentId);
        if (!comment) return { error: { message: '证言不存在' } };
        if (comment.invite_code_hash !== (inviteSession?.code || 'local') && !isAdmin()) return { error: { message: '只能抹去自己的证言' } };
        comment.is_deleted = true;
        comment.deleted_at = new Date().toISOString();
        comment.content = '此证言已被抹去';
        setLocalData('comments', comments);
        return { data: [comment], error: null };
    }
    return invokeDungeonAction('deleteComment', { commentId });
}

async function savePinnedNote(dungeonId, pinnedNote) {
    if (USE_LOCAL_FALLBACK) {
        const dungeons = getLocalData('dungeons', []);
        const d = dungeons.find(d => d.id === dungeonId);
        if (!d) return { error: { message: '试炼未找到' } };
        d.pinned_note = pinnedNote.trim();
        setLocalData('dungeons', dungeons);
        return { data: [d], error: null };
    }
    return invokeDungeonAction('updatePinnedNote', { dungeonId, pinnedNote: pinnedNote.trim() });
}

async function reviewDungeon(dungeonId, decision, reviewNote = '') {
    if (USE_LOCAL_FALLBACK) {
        const dungeons = getLocalData('dungeons', []);
        const d = dungeons.find(item => item.id === dungeonId);
        if (!d) return { error: { message: '试炼未找到' } };
        d.review_status = decision === 'approve' ? 'approved' : 'rejected';
        d.review_note = reviewNote;
        d.reviewed_by_name = inviteSession?.name || '';
        d.reviewed_at = new Date().toISOString();
        setLocalData('dungeons', dungeons);
        return { data: d, error: null };
    }
    return invokeDungeonAction('reviewDungeon', { dungeonId, decision, reviewNote });
}

async function removeDungeon(dungeonId) {
    if (USE_LOCAL_FALLBACK) {
        const dungeons = getLocalData('dungeons', []).filter(d => d.id !== dungeonId);
        const comments = getLocalData('comments', []).filter(c => c.dungeon_id !== dungeonId);
        setLocalData('dungeons', dungeons);
        setLocalData('comments', comments);
        return { data: [{}], error: null };
    }
    return invokeDungeonAction('deleteDungeon', { dungeonId });
}

async function markDungeonCleared(dungeonId, feedbackTags = [], feedbackNote = '') {
    if (USE_LOCAL_FALLBACK) {
        const cleared = getLocalData('cleared', {});
        const dungeons = getLocalData('dungeons', []);
        const d = dungeons.find(d => d.id === dungeonId);
        if (!d) return { error: { message: '试炼未找到' } };
        const run = Number(d.run_count || d.runCount || 1);
        const key = `${dungeonId}:${run}`;
        if (cleared[key]) return { error: { message: '你已经登记过本局通过了' } };
        cleared[key] = true;
        d.clear_count = Number(d.clear_count || d.clearCount || 0) + 1;
        const slots = Number(d.participant_count || d.participantCount || 1) * run;
        d.clear_rate = slots > 0 ? Math.round((d.clear_count / slots) * 1000) / 10 : 0;
        setLocalData('cleared', cleared);
        setLocalData('dungeons', dungeons);
        const feedback = getLocalData('clear_feedback', {});
        feedback[dungeonId] = feedback[dungeonId] || {};
        feedbackTags.forEach(tag => { feedback[dungeonId][tag] = (feedback[dungeonId][tag] || 0) + 1; });
        setLocalData('clear_feedback', feedback);
        return { data: [{}], error: null };
    }
    return invokeDungeonAction('markCleared', { dungeonId, feedbackTags, feedbackNote: feedbackNote.trim() });
}

async function advanceDungeonRun(dungeonId) {
    if (USE_LOCAL_FALLBACK) {
        const dungeons = getLocalData('dungeons', []);
        const d = dungeons.find(d => d.id === dungeonId);
        if (!d) return { error: { message: '试炼未找到' } };
        d.run_count = Number(d.run_count || d.runCount || 1) + 1;
        const slots = Number(d.participant_count || d.participantCount || 1) * d.run_count;
        d.clear_rate = slots > 0 ? Math.round((Number(d.clear_count || 0) / slots) * 1000) / 10 : 0;
        setLocalData('dungeons', dungeons);
        return { data: [d], error: null };
    }
    return invokeDungeonAction('advanceRun', { dungeonId });
}

function inviteScopedKey(id) {
    const session = inviteSession || getLocalData(INVITE_STORAGE_KEY, null);
    return `${id}:${session?.code || 'guest'}`;
}
async function sha256Hex(value) {
    const bytes = new TextEncoder().encode(String(value || ''));
    const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function hasRatedLocal(id) {
    const scoped = inviteScopedKey(id);
    return !!getLocalData('rated', {})[scoped] || !!getLocalData('rated', {})[id] || !!getLocalData('rated_supabase', {})[scoped];
}
async function checkHasRated(id) {
    const key = USE_LOCAL_FALLBACK ? 'rated' : 'rated_supabase';
    const scoped = inviteScopedKey(id);
    if (!!getLocalData(key, {})[scoped] || !!getLocalData('rated', {})[scoped] || !!getLocalData('rated', {})[id]) return true;
    const session = inviteSession || getLocalData(INVITE_STORAGE_KEY, null);
    if (USE_LOCAL_FALLBACK || !supabaseClient || !session?.code || !globalThis.crypto?.subtle) return false;
    try {
        const codeHash = await sha256Hex(session.code);
        const { data, error } = await supabaseClient
            .from('ratings')
            .select('id')
            .eq('dungeon_id', id)
            .eq('invite_code_hash', codeHash)
            .limit(1);
        if (!error && data?.length) {
            markAsRated(id);
            return true;
        }
    } catch (error) {
        console.warn('判定状态读取失败:', error);
    }
    return false;
}
function markAsRated(id) {
    const key = USE_LOCAL_FALLBACK ? 'rated' : 'rated_supabase';
    const r = getLocalData(key, {});
    r[inviteScopedKey(id)] = true;
    if (USE_LOCAL_FALLBACK) r[id] = true;
    setLocalData(key, r);
}

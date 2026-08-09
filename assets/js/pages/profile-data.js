// Profile data readers for authored dungeons, clear records, and notice badges.

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

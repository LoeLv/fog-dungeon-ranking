(async function init(){
    resetDiscoveryFiltersToEmpty();
    setMobileScreenClass('dungeons');
    maybeShowMobileOnboarding();
    applyVisualEffectsPreference();
    populateGodSelect();
    renderPathNav();
    renderGodFilters();
    renderDifficultyFilters();
    updateInviteUI();
    await renderDungeonList();
    await renderLatestComments();
    if (USE_LOCAL_FALLBACK && getLocalData('dungeons', []).length === 0) {
        const samples = [
            { id:'s1', name:'深渊回廊', creator:'灰袍记事者', difficulty:'中', type:'记忆', description:'无尽深渊边缘的一座古老回廊，保存着坠落神迹的记忆碎片。', pinned_note:'建议 6 人进入，第二幕需要有人记录线索。', participant_count:6, run_count:2, clear_count:6, clear_rate:50, avg_rating:4.7, rating_count:23, comment_count:8, created_at:new Date(Date.now()-7*86400000).toISOString() },
            { id:'s2', name:'镜中审判庭', creator:'银面审判官', difficulty:'高', type:'秩序', description:'所有证词都会在镜中留下第二个版本，玩家必须决定相信哪一个。', pinned_note:'第二轮后开放反证。', participant_count:4, run_count:3, clear_count:9, clear_rate:75, avg_rating:4.9, rating_count:41, comment_count:15, created_at:new Date(Date.now()-3*86400000).toISOString() },
            { id:'s3', name:'腐朽花园', creator:'雨中编年者', difficulty:'高', type:'腐朽', description:'花园中的每一朵花都会记录一段背叛。', participant_count:8, run_count:1, clear_count:3, clear_rate:37.5, avg_rating:4.3, rating_count:17, comment_count:5, created_at:new Date(Date.now()-14*86400000).toISOString() }
        ];
        setLocalData('dungeons', samples);
        setLocalData('comments', [
            { id:'c1', dungeon_id:'s1', parent_comment_id:null, author:'旧灯塔', content:'第二幕的信息压力很足，适合慢热队伍。', invite_name:'旧灯塔', is_deleted:false, created_at:new Date(Date.now()-6*86400000).toISOString() },
            { id:'c2', dungeon_id:'s2', parent_comment_id:null, author:'蓝羽', content:'镜像证词的交叉检验很有张力。', invite_name:'蓝羽', is_deleted:false, created_at:new Date(Date.now()-2*86400000).toISOString() },
            { id:'c3', dungeon_id:'s2', parent_comment_id:'c2', author:'银面审判官', content:'建议把反证卡提前放入主持人提示。', invite_name:'银面审判官', is_deleted:false, created_at:new Date(Date.now()-1*86400000).toISOString() }
        ]);
        setLocalData('clear_feedback', { s1:{ '线索清晰':4, '节奏稳定':3 }, s2:{ '机制有趣':6, '审判压迫感':3 } });
        await renderDungeonList();
        await renderLatestComments();
    }
    requestAnimationFrame(scrollPageToTop);
})();

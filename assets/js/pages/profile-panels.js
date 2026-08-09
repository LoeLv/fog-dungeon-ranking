// Profile panel renderers shared by the profile page and public dossier.

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

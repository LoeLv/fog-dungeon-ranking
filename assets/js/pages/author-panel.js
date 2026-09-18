// Author analytics panel: aggregates authored dungeon metrics, rating trend,
// and reader feedback (证言) for 试炼构筑者 / 审核员 / 馆主 / 神明.
let authorPanelScrollY = 0;

function canOpenAuthorPanel() {
    return canSubmit();
}

// Aggregate all authored-dungeon statistics into a single summary object.
function getAuthorPanelTotals(authored) {
    const list = Array.isArray(authored) ? authored : [];
    const totals = {
        count: list.length,
        run: 0,
        clear: 0,
        participants: 0,
        comments: 0,
        ratingSum: 0,
        ratingWeight: 0,
        clearRateSum: 0,
        clearRateWeight: 0
    };
    for (const d of list) {
        const runCount = Number(d.run_count || 0);
        const clearCount = Number(d.clear_count || 0);
        const ratingCount = Number(d.rating_count || 0);
        totals.run += runCount;
        totals.clear += clearCount;
        totals.participants += Number(d.participant_count || 0);
        totals.comments += Number(d.comment_count || 0);
        const weight = ratingCount > 0 ? ratingCount : 1;
        totals.ratingSum += Number(d.avg_rating || 0) * weight;
        totals.ratingWeight += weight;
        if (runCount > 0) {
            const rate = Number.isFinite(Number(d.clear_rate)) ? Number(d.clear_rate) : (clearCount / runCount) * 100;
            totals.clearRateSum += rate * runCount;
            totals.clearRateWeight += runCount;
        }
    }
    totals.avgRating = totals.ratingWeight ? totals.ratingSum / totals.ratingWeight : 0;
    totals.clearRate = totals.clearRateWeight
        ? totals.clearRateSum / totals.clearRateWeight
        : (totals.run > 0 ? (totals.clear / totals.run) * 100 : 0);
    return totals;
}

function getAuthorPanelTopDungeon(list) {
    return [...(list || [])]
        .sort((a, b) => (Number(b.avg_rating || 0) - Number(a.avg_rating || 0))
            || (Number(b.rating_count || 0) - Number(a.rating_count || 0))
            || (Number(b.comment_count || 0) - Number(a.comment_count || 0)))[0] || null;
}

function renderAuthorPanelMetricCard(label, value, hint = '') {
    return `
        <div class="author-metric-card">
            <span class="author-metric-label">${escapeHtml(label)}</span>
            <strong class="author-metric-value">${escapeHtml(String(value))}</strong>
            ${hint ? `<small class="author-metric-hint">${escapeHtml(hint)}</small>` : ''}
        </div>`;
}

// Horizontal bars ordered chronologically so authors can read a rating trend.
function renderAuthorPanelRatingTrend(authored, faithGod) {
    const ordered = [...(authored || [])]
        .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
    if (!ordered.length) return '';
    const rows = ordered.map(d => {
        const score = Math.max(0, Math.min(5, Number(d.avg_rating || 0)));
        const pct = Math.round((score / 5) * 100);
        const count = Number(d.rating_count || 0);
        return `
            <div class="author-trend-row">
                <span class="author-trend-label" title="${escapeAttrString(d.name || '未命名试炼')}">《${escapeHtml(d.name || '未命名试炼')}》</span>
                <div class="author-trend-track">
                    <div class="author-trend-fill" style="width:${pct}%"></div>
                </div>
                <span class="author-trend-value">${score.toFixed(1)}<small>（${count}）</small></span>
            </div>`;
    }).join('');
    return `
        <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${getGodSkinStyle(faithGod)}">
            <div class="profile-panel-title"><span>📈 神格判定趋势</span><small>按构筑时间排序（括号为评议人次）</small></div>
            <div class="author-trend">${rows}</div>
        </section>`;
}

function renderAuthorPanelDungeonList(authored) {
    if (!authored.length) {
        return renderRitualEmpty('尚未构筑试炼切片；构筑完成后这里会形成你的作品数据。', '命运', '作品数据暂空');
    }
    return [...authored]
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
        .map(d => {
            const rating = Number(d.avg_rating || 0);
            const commentCount = Number(d.comment_count || 0);
            const runCount = Number(d.run_count || 0);
            const clearCount = Number(d.clear_count || 0);
            return `
                <article class="author-work-card clickable" onclick="openDetailFromProfile(${jsString(d.id)})">
                    <div class="author-work-head">
                        <span class="author-work-name">《${escapeHtml(d.name || '未命名试炼')}》</span>
                        <span class="author-work-score">★ ${rating.toFixed(1)} <small>(${Number(d.rating_count || 0)})</small></span>
                    </div>
                    <div class="author-work-meta">${escapeHtml(formatGodName(d.type))} · ${escapeHtml(formatGodPath(d.type))}命途 · ${escapeHtml(formatDifficulty(d.difficulty))}</div>
                    <div class="author-work-stats">
                        <span class="metric-pill">运行 <strong>${runCount}</strong></span>
                        <span class="metric-pill">通关 <strong>${clearCount}</strong></span>
                        <span class="metric-pill">通关率 <strong>${escapeHtml(formatClearRate(d))}</strong></span>
                        <span class="metric-pill">证言 <strong>${commentCount}</strong></span>
                    </div>
                    <div class="author-work-foot">${escapeHtml(formatDate(d.created_at))}</div>
                </article>`;
        })
        .join('');
}

async function renderAuthorPanelFeedback(authored) {
    const entries = [];
    for (const dungeon of authored.slice(0, 30)) {
        let comments = [];
        try {
            comments = await fetchComments(dungeon.id);
        } catch (_) {
            comments = [];
        }
        (comments || [])
            .filter(comment => !comment.is_deleted && String(comment.content || '').trim())
            .forEach(comment => {
                entries.push({ comment, dungeon });
            });
    }
    entries.sort((a, b) => new Date(b.comment.created_at || 0) - new Date(a.comment.created_at || 0));
    const recent = entries.slice(0, 10);
    if (!recent.length) {
        return renderRitualEmpty('尚未收到读者证言；试炼被评议后，反馈会汇入这里。', '命运', '暂无读者反馈');
    }
    return recent.map(({ comment, dungeon }) => {
        const authorName = comment.invite_name || comment.author || '匿名信徒';
        return `
            <article class="author-feedback-item clickable" onclick="openDetailFromProfile(${jsString(dungeon.id)})">
                <div class="author-feedback-head">
                    <span class="author-feedback-author">${escapeHtml(authorName)}</span>
                    <small>${escapeHtml(formatDate(comment.created_at))}</small>
                </div>
                <div class="author-feedback-body">${escapeHtml(String(comment.content || '').slice(0, 180))}</div>
                <div class="author-feedback-src">于《${escapeHtml(dungeon.name || '未命名试炼')}》留下证言</div>
            </article>`;
    }).join('');
}

async function renderAuthorPanel() {
    const container = document.getElementById('authorPanelContent');
    if (!container) return;
    if (!inviteSession) {
        container.innerHTML = renderRitualEmpty('请先通过同契召引入局，再查看作者数据面板。', '命运', '作者数据面板尚未开启');
        return;
    }
    if (!canOpenAuthorPanel()) {
        container.innerHTML = renderRitualEmpty('当前身份无法访问作者数据面板，需要构筑者及以上身份。', '命运', '权限不足');
        return;
    }
    const inviteSnapshot = getInviteSnapshot();
    container.innerHTML = '<div class="loading"><div class="spinner"></div><br>正在整理筑戏人数据...</div>';

    let authored = [];
    try {
        authored = await fetchMyAuthoredDungeons();
    } catch (_) {
        authored = [];
    }
    if (!isInviteSnapshotCurrent(inviteSnapshot)) return;

    const totals = getAuthorPanelTotals(authored);
    const topDungeon = getAuthorPanelTopDungeon(authored);
    const faithGod = '命运';

    if (!authored.length) {
        container.innerHTML = renderRitualEmpty('尚未构筑试炼切片；构筑完成后这里会汇成完整的作者数据面板。', faithGod, '作品数据暂空');
        return;
    }

    container.innerHTML = `
        <div class="profile-hero">
            <div class="profile-hero-copy">
                <div class="profile-kicker">AUTHOR ANALYTICS · 筑戏人数据面板</div>
                <h1 class="profile-name">${escapeHtml(inviteSession?.name || '筑戏人')}</h1>
                <div class="profile-subline">
                    <span class="metric-pill">作品 ${totals.count} 件</span>
                    <span class="metric-pill">累计运行 ${totals.run}</span>
                    <span class="metric-pill">累计通关 ${totals.clear}</span>
                </div>
            </div>
        </div>

        <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${getGodSkinStyle(faithGod)}">
            <div class="profile-panel-title"><span>📊 核心指标</span><small>基于全部作品汇总</small></div>
            <div class="author-metric-grid">
                ${renderAuthorPanelMetricCard('构筑试炼数', totals.count, '含合著作品')}
                ${renderAuthorPanelMetricCard('平均神格判定', totals.ratingWeight ? totals.avgRating.toFixed(2) : '—', '按评议人次加权')}
                ${renderAuthorPanelMetricCard('平均通关率', `${totals.clearRate.toFixed(1)}%`, '按运行次数加权')}
                ${renderAuthorPanelMetricCard('累计运行次数', totals.run, '试炼总周目')}
                ${renderAuthorPanelMetricCard('累计通关次数', totals.clear, '成功留存次数')}
                ${renderAuthorPanelMetricCard('读者证言总数', totals.comments, '已收评议与反馈')}
            </div>
            ${topDungeon ? `<div class="author-top-note">🏆 口碑之最：《${escapeHtml(topDungeon.name || '未命名试炼')}》 · 神格 ${Number(topDungeon.avg_rating || 0).toFixed(1)}（${Number(topDungeon.rating_count || 0)} 次评议）</div>` : ''}
        </section>

        ${renderAuthorPanelRatingTrend(authored, faithGod)}

        <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${getGodSkinStyle(faithGod)}">
            <div class="profile-panel-title"><span>🎭 作品明细</span><small>${totals.count} 件作品</small></div>
            <div class="author-work-list">${renderAuthorPanelDungeonList(authored)}</div>
        </section>

        <section class="profile-panel" data-god="${escapeHtml(faithGod)}" style="${getGodSkinStyle(faithGod)}" id="authorFeedbackPanel">
            <div class="profile-panel-title"><span>📣 读者反馈</span><small>最近 10 条证言</small></div>
            <div class="author-feedback-list"><div class="loading"><div class="spinner"></div><br>正在汇入读者证言...</div></div>
        </section>
    `;

    const feedbackHtml = await renderAuthorPanelFeedback(authored);
    if (!isInviteSnapshotCurrent(inviteSnapshot)) return;
    const feedbackList = container.querySelector('#authorFeedbackPanel .author-feedback-list');
    if (feedbackList) feedbackList.innerHTML = feedbackHtml;
}

function ensureAuthorPanelStyles() {
    if (document.getElementById('authorPanelStyles')) return;
    const style = document.createElement('style');
    style.id = 'authorPanelStyles';
    style.textContent = `
.author-metric-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}
.author-metric-card{display:flex;flex-direction:column;gap:4px;padding:14px 16px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}
.author-metric-label{font-size:12px;color:var(--text-muted,#9aa7b4)}
.author-metric-value{font-size:24px;font-weight:700;color:var(--god-primary,#d8b56a)}
.author-metric-hint{font-size:11px;color:var(--text-muted,#8b98a6)}
.author-top-note{margin-top:14px;padding:10px 14px;border-radius:12px;background:rgba(216,181,106,.1);border:1px solid rgba(216,181,106,.28);color:#e6d3a3;font-size:13px}
.author-trend{display:flex;flex-direction:column;gap:10px}
.author-trend-row{display:grid;grid-template-columns:minmax(90px,180px) 1fr auto;align-items:center;gap:12px}
.author-trend-label{font-size:13px;color:#cfd8e3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.author-trend-track{height:10px;border-radius:6px;background:rgba(255,255,255,.08);overflow:hidden}
.author-trend-fill{height:100%;border-radius:6px;background:linear-gradient(90deg,var(--god-glow,#7aaec2),var(--god-primary,#d8b56a));transition:width .4s ease}
.author-trend-value{font-size:13px;font-weight:600;color:#e6d3a3;white-space:nowrap}
.author-trend-value small{color:#8b98a6;font-weight:400}
.author-work-list,.author-feedback-list{display:flex;flex-direction:column;gap:12px}
.author-work-card{padding:14px 16px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);transition:border-color .2s,transform .2s}
.author-work-card:hover{border-color:rgba(216,181,106,.4);transform:translateY(-1px)}
.author-work-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.author-work-name{font-size:15px;font-weight:600;color:#eef3f8}
.author-work-score{font-size:14px;font-weight:600;color:var(--god-primary,#d8b56a);white-space:nowrap}
.author-work-score small{color:#8b98a6;font-weight:400}
.author-work-meta{margin-top:6px;font-size:12px;color:#9aa7b4}
.author-work-stats{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.author-work-foot{margin-top:8px;font-size:11px;color:#7d8a98}
.author-feedback-item{padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07)}
.author-feedback-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.author-feedback-author{font-size:13px;font-weight:600;color:#e6d3a3}
.author-feedback-head small{font-size:11px;color:#8b98a6}
.author-feedback-body{margin-top:6px;font-size:13px;line-height:1.5;color:#cfd8e3}
.author-feedback-src{margin-top:6px;font-size:11px;color:#7d8a98}
@media (max-width:640px){
    .author-trend-row{grid-template-columns:minmax(70px,110px) 1fr auto;gap:8px}
    .author-metric-value{font-size:20px}
}
`;
    document.head.appendChild(style);
}

async function openAuthorPanel() {
    if (!canOpenAuthorPanel()) { showToast('只有构筑者及以上身份可以查看作者数据面板'); return; }
    ensureAuthorPanelStyles();
    authorPanelScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    ['profilePage', 'leaderboardPage', 'scorePage', 'matchPage', 'permissionPage', 'adminPage', 'eternalStelePage'].forEach(id => {
        const page = document.getElementById(id);
        if (page) page.style.display = 'none';
    });
    document.body.classList.remove('profile-view-open', 'leaderboard-view-open', 'score-view-open', 'match-view-open');
    document.body.classList.add('profile-view-open');
    document.getElementById('authorPanelPage').style.display = 'block';
    window.scrollTo(0, 0);
    await renderAuthorPanel();
}

function closeAuthorPanel(restoreScroll = true) {
    const page = document.getElementById('authorPanelPage');
    if (page) page.style.display = 'none';
    document.body.classList.remove('profile-view-open');
    if (restoreScroll !== false) requestAnimationFrame(() => window.scrollTo(0, authorPanelScrollY || 0));
}

async function renderScorePage() {
    const container = document.getElementById('scoreContent');
    if (!container) return;
    if (!canSettleScores()) {
        if (isGodRole()) {
            const { entries: titleEntries } = await fetchLeaderboardEntries();
            await refreshGodBelievers(false);
            await refreshHonorOperationLogs(false);
            const godName = cleanGodName(inviteSession?.name || '') || '命运';
            container.innerHTML = `
                <section class="profile-hero" data-god="${escapeHtml(godName)}" data-motif="${escapeHtml(getGodSkin(godName).motif)}" style="${getGodSkinStyle(godName)}">
                    <div class="profile-avatar ${getGodClass(godName)}" style="${getGodSkinStyle(godName)}">${renderGodSigil(godName, 'lg')}</div>
                    <div class="profile-hero-copy">
                        <div class="profile-kicker">DIVINE TITLE EDICT</div>
                        <h1 class="profile-name">称号敕令台</h1>
                        <div class="profile-subline">
                            <span class="metric-pill">神明 <strong>${escapeHtml(inviteSession?.name || godName)}</strong></span>
                            <span class="metric-pill">第零神席 <strong>∞</strong></span>
                        </div>
                        <div class="profile-faith-prayer">以神名降下称号。</div>
                    </div>
                </section>
                <div class="profile-grid">
                    <div>
                        ${renderGodCommandPanel()}
                        ${renderTitleAdminPanel(titleEntries)}
                    </div>
                </div>`;
            toggleGodConversionCurseFields();
            return;
        }
        container.innerHTML = renderRitualEmpty('此页只对结算审核员与神谕馆主开放；未持审核席权限的身份不会进入分数结算。', '真理', '需要审核席权限');
        return;
    }
    const dungeons = await fetchDungeons();
    const dungeonOptions = renderScoreDungeonOptions(dungeons);
    const { entries: titleEntries } = canGrantTitlesUI()
        ? await fetchLeaderboardEntries()
        : { entries: [] };
    if (canGrantTitlesUI()) await refreshHonorOperationLogs(false);
    const { settlements, error } = await fetchScoreSettlements(50);
    scoreSettlementState = { settlements, error };
    scoreSettlementDetails.clear();
    scoreSettlementExpanded.clear();
    container.innerHTML = `
        <section class="profile-hero" data-god="真理" data-motif="${escapeHtml(getGodSkin('真理').motif)}" style="${getGodSkinStyle('真理')}">
            <div class="profile-avatar path-exist" style="${getGodSkinStyle('真理')}">${renderGodSigil('真理', 'lg')}</div>
            <div class="profile-hero-copy">
                <div class="profile-kicker">SCORE SANCTUM</div>
                <h1 class="profile-name">分数结算神谕台</h1>
                <div class="profile-subline">
                    <span class="metric-pill">审核员 <strong>${escapeHtml(inviteSession?.name || '')}</strong></span>
                    <span class="metric-pill">登神 ${scoreDengMin}~${scoreDengMax} <strong>觐见 ${scoreJinMin}~${scoreJinMax}</strong></span>
                </div>
                <div class="profile-faith-prayer">洞窥本质，行迹真理。此页只对结算审核员与神谕馆主开放。</div>
            </div>
            <div class="profile-hero-stats">
                <div class="profile-hero-score"><span>两日加分记录</span><strong id="scoreRecentCount">${settlements?.length || 0}</strong></div>
                <div class="profile-hero-score"><span>权限席位</span><strong>${getInviteRole() === 'admin' ? '馆主' : '审核'}</strong></div>
            </div>
        </section>
        <div class="profile-grid">
            <div>
                <section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}">
                    <div class="profile-panel-title"><span>批量结算</span></div>
                    <div class="form-group"><label>搜索副本</label><input id="scoreDungeonSearch" maxlength="80" placeholder="输入副本名过滤，或在结算文本第一行写副本名" oninput="filterScoreDungeonOptions('scoreDungeonSearch', 'scoreDungeonId')"><div class="identity-help" id="scoreDungeonSearchStatus"></div></div>
                    <div class="form-group"><label>副本圣名</label><select id="scoreDungeonId">${dungeonOptions}</select></div>
                    <div class="form-group"><label>结算文本</label><textarea id="scoreBatchText" maxlength="20000" placeholder="修弥斯的钟，一人（棺材板）胜利，其余人失败&#10;1. 腐朽 羔羊+8+0&#10;2. 欺诈 无我+2+1"></textarea></div>
                    <div class="form-group"><label>备注</label><input id="scoreBatchRemark" maxlength="500" placeholder="可选，写结算来源或说明"></div>
                    <div class="profile-tools">
                        <button class="btn btn-outline btn-sm" onclick="checkScorePreviewUI()">预览校验</button>
                        <button class="btn btn-primary btn-sm" data-score-action="submit-score-batch" onclick="submitScoreBatchUI()">确认结算</button>
                    </div>
                    <div id="scorePreviewPanel" style="margin-top:14px;">${renderScorePreview(scorePreviewState)}</div>
                </section>
                <section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}">
                    <div class="profile-panel-title"><span>单人补分</span></div>
                    <div class="profile-form-grid">
                        <div class="form-group full"><label>搜索副本</label><input id="singleDungeonSearch" maxlength="80" placeholder="输入副本名过滤" oninput="filterScoreDungeonOptions('singleDungeonSearch', 'singleDungeonId')"><div class="identity-help" id="singleDungeonSearchStatus"></div></div>
                        <div class="form-group full"><label>副本圣名</label><select id="singleDungeonId">${dungeonOptions}</select></div>
                        <div class="form-group"><label>玩家昵称</label><input id="singlePlayerName" maxlength="40"></div>
                        <div class="form-group"><label>登神之路</label><input id="singleDengScore" type="number" min="${scoreDengMin}" max="${scoreDengMax}" step="0.1" value="0"></div>
                        <div class="form-group"><label>觐见之梯</label><input id="singleJinScore" type="number" min="${scoreJinMin}" max="${scoreJinMax}" step="0.1" value="0"></div>
                        <div class="form-group full"><label>备注</label><input id="singleRemark" maxlength="500" placeholder="补发原因"></div>
                        <div class="form-group full"><label>通关结果（可不选）</label><div class="score-clear-choice"><label><input type="radio" name="singleClearStatus" value="passed"> 逢生</label><label><input type="radio" name="singleClearStatus" value="lost"> 迷失</label></div></div>
                    </div>
                    <div class="profile-tools"><button class="btn btn-primary btn-sm" data-score-action="submit-score-single" onclick="submitScoreSingleUI()">提交补分</button></div>
                </section>
            </div>
            <div>
                <section class="profile-panel" data-god="真理" style="${getGodSkinStyle('真理')}">
                    <div class="profile-panel-title"><span>加分记录</span></div>
                    <div class="form-group"><label for="scoreSettlementSearch">搜索副本</label><input id="scoreSettlementSearch" maxlength="80" placeholder="输入副本名，查看该副本给谁加了分" oninput="queueScoreSettlementSearch()"></div>
                    <div id="scoreSettlementsPanel">${renderScoreSettlements(settlements, error)}</div>
                </section>
                ${renderTitleAdminPanel(titleEntries)}
            </div>
        </div>`;
}

async function openScorePage() {
    if (!canSettleScores() && !isGodRole()) {
        openInviteModal('需要审核员谕令后才能进入分数结算。');
        return;
    }
    scoreScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const detailOverlay = document.getElementById('detailOverlay');
    if (detailOverlay) detailOverlay.style.display = 'none';
    const profilePage = document.getElementById('profilePage');
    if (profilePage) profilePage.style.display = 'none';
    const leaderboardPage = document.getElementById('leaderboardPage');
    if (leaderboardPage) leaderboardPage.style.display = 'none';
    const matchPage = document.getElementById('matchPage');
    if (matchPage) matchPage.style.display = 'none';
    const adminPage = document.getElementById('adminPage');
    if (adminPage) adminPage.style.display = 'none';
    document.body.classList.remove('detail-view-open', 'profile-view-open', 'leaderboard-view-open', 'match-view-open');
    document.body.classList.add('score-view-open');
    document.getElementById('scorePage').style.display = 'block';
    window.scrollTo(0, 0);
    await renderScorePage();
}

function closeScorePage(restoreScroll = true) {
    const page = document.getElementById('scorePage');
    if (page) page.style.display = 'none';
    document.body.classList.remove('score-view-open');
    if (restoreScroll !== false) requestAnimationFrame(() => window.scrollTo(0, scoreScrollY || 0));
}

function normalizeTalentState(rawState) {
    const state = rawState || {};
    return {
        profile: state.profile || null,
        inventorySlotLimit: Number(state.inventorySlotLimit || 10),
        equippedSlotLimit: Number(state.equippedSlotLimit || 3),
        maxEquippedSlotLimit: Number(state.maxEquippedSlotLimit || state.equippedSlotLimit || 3),
        talentSlotRule: state.talentSlotRule || null,
        talentSlotScoreRules: Array.isArray(state.talentSlotScoreRules) ? state.talentSlotScoreRules : [],
        talentSlotKinds: Array.isArray(state.talentSlotKinds) ? state.talentSlotKinds : ['faith', 'profession', 'any', 'any'],
        faithTalentPoolKey: state.faithTalentPoolKey || '',
        professionTalentPoolKey: state.professionTalentPoolKey || '',
        starterTalentDrawGrant: Number(state.starterTalentDrawGrant || 10),
        bTalentDrawRate: Number(state.bTalentDrawRate || 0.2),
        advancedBTalentDrawRate: Number(state.advancedBTalentDrawRate || 0.25),
        aTalentDrawRate: Number(state.aTalentDrawRate || 0.02),
        sTalentDrawRate: Number(state.sTalentDrawRate || 0.001),
        bTalentGuaranteeDraws: Number(state.bTalentGuaranteeDraws || 10),
        sTalentGuaranteeDraws: Number(state.sTalentGuaranteeDraws || 60),
        cTalentFragmentGain: Number(state.cTalentFragmentGain || 5),
        bTalentFragmentGain: Number(state.bTalentFragmentGain || 10),
        targetTalentExchangeCost: Number(state.targetTalentExchangeCost || 180),
        aTalentExchangeCost: Number(state.aTalentExchangeCost || 260),
        totalDrawsEarned: Number(state.totalDrawsEarned || 0),
        spentDraws: Number(state.spentDraws || 0),
        availableDraws: Number(state.availableDraws || 0),
        baseBasicDrawsEarned: Number(state.baseBasicDrawsEarned || 0),
        eventBasicDraws: Number(state.eventBasicDraws || 0),
        eventAdvancedDraws: Number(state.eventAdvancedDraws || 0),
        basicDrawsEarned: Number(state.basicDrawsEarned || 0),
        basicSpentDraws: Number(state.basicSpentDraws || 0),
        basicAvailableDraws: Number(state.basicAvailableDraws || 0),
        advancedDrawsEarned: Number(state.advancedDrawsEarned || 0),
        advancedSpentDraws: Number(state.advancedSpentDraws || 0),
        advancedAvailableDraws: Number(state.advancedAvailableDraws || 0),
        advancedTalentDrawScore: Number(state.advancedTalentDrawScore || 1500),
        fragmentTotal: Number(state.fragmentTotal || 0),
        pools: Array.isArray(state.pools) ? state.pools : [],
        allowedPoolKeys: Array.isArray(state.allowedPoolKeys) ? state.allowedPoolKeys : [],
        poolItems: Array.isArray(state.poolItems) ? state.poolItems : [],
        counters: Array.isArray(state.counters) ? state.counters : [],
        ownedTalents: Array.isArray(state.ownedTalents) ? state.ownedTalents : [],
        overflowChoices: Array.isArray(state.overflowChoices) ? state.overflowChoices : [],
        settledOverflowChoices: Array.isArray(state.settledOverflowChoices) ? state.settledOverflowChoices : [],
        drawLogs: Array.isArray(state.drawLogs) ? state.drawLogs : [],
        exchangeLogs: Array.isArray(state.exchangeLogs) ? state.exchangeLogs : []
    };
}

function applyTalentStateProfile(state) {
    const profile = mapCloudProfileToLocal(state?.profile);
    if (profile) saveCurrentProfile(profile);
}

async function fetchTalentState() {
    if (USE_LOCAL_FALLBACK || !inviteSession?.code) {
        return { state: normalizeTalentState(null), error: { message: '天赋池需要云端 Supabase 支持，本地模式仅显示个人档案。' } };
    }
    const inviteSnapshot = getInviteSnapshot();
    const { data, error } = await invokeDungeonAction('getTalentState', {});
    if (!isInviteSnapshotCurrent(inviteSnapshot)) {
        return { state: currentTalentState, error: { message: '身份已切换，已忽略旧账号天赋回包。' }, stale: true };
    }
    if (error) return { state: normalizeTalentState(null), error };
    const state = normalizeTalentState(data);
    applyTalentStateProfile(state);
    return { state, error: null };
}

function setCurrentTalentState(state, error = null) {
    currentTalentState = normalizeTalentState(state);
    currentTalentError = error;
}

function replaceTalentPoolPanel(profile = getCurrentProfile()) {
    const panel = document.getElementById('talentPoolPanel');
    if (panel) panel.outerHTML = renderTalentPoolPanel(currentTalentState, currentTalentError, profile);
    const equipPanel = document.getElementById('profileTalentEquipPanel');
    if (equipPanel) equipPanel.innerHTML = renderEquippedTalentSlots(currentTalentState, getProfileFaithGod(profile) || '命运');
    if (isMobileViewport() && document.getElementById('profilePage')?.style.display !== 'none') {
        setMobileProfileTab(mobileProfileTab, { scroll: false });
    }
}

function getSelectedTalentPool(profile, state) {
    const poolKeys = state.pools.map(pool => pool.poolKey).filter(Boolean);
    if (selectedTalentPool && poolKeys.includes(selectedTalentPool)) return selectedTalentPool;
    const preferred = state.faithTalentPoolKey || `Pool${getProfileFaithGod(profile) || '欺诈'}`;
    selectedTalentPool = poolKeys.includes(preferred) ? preferred : (poolKeys[0] || preferred);
    return selectedTalentPool;
}

function getTalentPoolCounter(state, poolKey) {
    return Number((state.counters || []).find(item => item.pool_key === poolKey)?.continue_draw || 0);
}

function renderTalentPoolOptions(state, selected) {
    const pools = state.pools || [];
    if (!pools.length) return '<option value="">暂无天赋池</option>';
    return pools.map(pool => {
        const disabled = Number(pool.total || 0) <= 0 ? 'disabled' : '';
        const label = `${formatTalentPoolLabel(pool.poolKey)}池 · B${Number(pool.bCount || 0)} / C${Number(pool.cCount || 0)}`;
        return `<option value="${escapeHtml(pool.poolKey)}" ${pool.poolKey === selected ? 'selected' : ''} ${disabled}>${escapeHtml(label)}</option>`;
    }).join('');
}

function renderTalentCards(talents, emptyText = '还没有抽到天赋。') {
    if (!talents?.length) return `<div class="profile-empty">${escapeHtml(emptyText)}</div>`;
    return `<div class="talent-result-grid">${talents.map(talent => {
        const name = talent.talentName || talent.talent_name || '未知天赋';
        const rank = talent.rank || 'C';
        const effect = talent.effect || talent.talent_effect || '';
        const actionCost = Number(talent.actionCost ?? talent.action_cost ?? 0);
        const pool = formatTalentPoolLabel(talent.poolKey || talent.pool_key);
        const repeat = talent.isRepeat || talent.is_repeat;
        const guarantee = talent.isGuarantee || talent.is_guarantee;
        const overflow = talent.isOverflow || talent.is_overflow;
        const fragment = Number(talent.fragmentGain ?? talent.fragment_gain ?? 0);
        const storageSlot = Number(talent.storageSlot ?? talent.storage_slot ?? 0);
        const source = talent.acquired_from === 'exchange' ? '碎片兑换' : (talent.acquired_from === 'draw' ? '天赋池抽取' : pool);
        const place = overflow ? ' · 仓库已满，待取舍' : (storageSlot ? ` · 入库${storageSlot}号位` : '');
        return `
            <div class="talent-card rank-${escapeHtml(rank)} ${repeat ? 'repeat' : ''} ${overflow ? 'pending' : ''}">
                <strong>${escapeHtml(name)}</strong>
                <small>${escapeHtml(rank)}级 · ${escapeHtml(pool || source)} · 行动点 ${actionCost}${guarantee ? ' · 保底' : ''}${repeat ? ` · 重复转化 +${fragment} 碎片` : ''}${escapeHtml(place)}</small>
                ${effect ? `<span class="talent-effect-text">${escapeHtml(effect)}</span>` : ''}
            </div>`;
    }).join('')}</div>`;
}

function renderTalentLogs(state, god = '命运') {
    const logs = state.drawLogs || [];
    if (!logs.length) return renderRitualEmpty(getGodEmptyText(god, 'drawLogs'), god, '抽取记录暂空');
    return `<div class="talent-log-list">${logs.slice(0, 12).map(log => {
        const label = `${formatTalentPoolLabel(log.pool_key)}池 · ${log.draw_type === 'ten' ? '十连谕' : '单枚牵引'}`;
        const guarantee = log.is_guarantee ? ' · 保底' : '';
        const repeat = log.is_repeat ? ` · 重复 +${Number(log.fragment_gain || 0)}碎片` : '';
        return `<div class="talent-log-item"><span><strong>${escapeHtml(log.talent_name)}</strong> ${escapeHtml(log.rank)}级${escapeHtml(guarantee)}${escapeHtml(repeat)}</span><span>${escapeHtml(label)}</span></div>`;
    }).join('')}</div>`;
}

function renderTalentExchangeOptions(state, poolKey) {
    const ownedKeys = new Set((state.ownedTalents || []).map(t => `${t.pool_key}:${t.talent_id}`));
    const advancedDraw = Number(state.profile?.ascension_score || 0) >= Number(state.advancedTalentDrawScore || 1500);
    const allowedRanks = advancedDraw ? ['A', 'B'] : ['B'];
    const options = (state.poolItems || [])
        .filter(item => item.pool_key === poolKey && allowedRanks.includes(item.rank))
        .map(item => {
            const owned = ownedKeys.has(`${item.pool_key}:${item.talent_id}`);
            const cost = item.rank === 'A' ? Number(state.aTalentExchangeCost || 260) : Number(state.targetTalentExchangeCost || 80);
            const actionCost = Number(item.action_cost ?? item.actionCost ?? 0);
            return `<option value="${Number(item.talent_id)}" data-rank="${escapeHtml(item.rank)}" data-cost="${cost}" data-name="${escapeHtml(item.talent_name)}" ${owned ? 'disabled' : ''}>${escapeHtml(item.rank)} · ${escapeHtml(item.talent_name)} · 行动点 ${actionCost}（${cost}碎片）${owned ? '（已拥有）' : ''}</option>`;
        });
    return options.length ? options.join('') : '<option value="">该池暂无可兑换 B/A 天赋</option>';
}

function renderTalentOptionLabel(talent) {
    if (!talent) return '空';
    return `${talent.talent_name}（${talent.rank} · ${formatTalentPoolLabel(talent.pool_key)}池）`;
}

function getTalentEffectText(state, talent) {
    if (!talent) return '';
    return String(
        talent.effect ||
        (state.poolItems || []).find(item =>
            item.pool_key === talent.pool_key && Number(item.talent_id) === Number(talent.talent_id)
        )?.effect ||
        ''
    ).trim();
}

function getTalentActionCost(state, talent) {
    if (!talent) return 0;
    const direct = talent.actionCost ?? talent.action_cost;
    if (direct !== undefined && direct !== null && direct !== '') return Number(direct) || 0;
    const poolItem = (state.poolItems || []).find(item =>
        item.pool_key === talent.pool_key && Number(item.talent_id) === Number(talent.talent_id)
    );
    return Number(poolItem?.action_cost ?? poolItem?.actionCost ?? 0) || 0;
}

function getTalentDismantleGain(state, rank) {
    const normalizedRank = String(rank || '').toUpperCase();
    if (normalizedRank === 'A') return 200;
    if (normalizedRank === 'B') return Number(state.bTalentFragmentGain || 10);
    if (normalizedRank === 'C') return Number(state.cTalentFragmentGain || 5);
    return 0;
}

function getTalentRankWeight(rank) {
    return ({ C: 1, B: 2, A: 3, S: 4 })[String(rank || '').toUpperCase()] || 0;
}

function canTalentFitRankAllowance(ranks, allowance) {
    const sortedRanks = ranks.map(rank => String(rank || '').toUpperCase()).sort((a, b) => getTalentRankWeight(b) - getTalentRankWeight(a));
    const sortedAllowance = allowance.map(rank => String(rank || '').toUpperCase()).sort((a, b) => getTalentRankWeight(b) - getTalentRankWeight(a));
    if (sortedRanks.length > sortedAllowance.length) return false;
    return sortedRanks.every((rank, index) => getTalentRankWeight(rank) <= getTalentRankWeight(sortedAllowance[index]));
}

function canTalentFitCurrentRankRule(state, candidate, slot, currentTalent) {
    const allowance = Array.isArray(state.talentSlotRule?.ranks) ? state.talentSlotRule.ranks : ['C', 'C'];
    const ranks = (state.ownedTalents || [])
        .filter(talent => talent.equipped_slot)
        .filter(talent => Number(talent.equipped_slot) !== slot && Number(talent.id) !== Number(candidate?.id || 0))
        .map(talent => talent.rank);
    if (candidate) ranks.push(candidate.rank);
    if (currentTalent && !candidate) ranks.push(currentTalent.rank);
    return canTalentFitRankAllowance(ranks, allowance);
}

function renderTalentSlotRuleText(state) {
    const rule = state.talentSlotRule || {};
    const ranks = Array.isArray(rule.ranks) ? rule.ranks : [];
    if (!ranks.length) return '携带规则读取中';
    const kinds = Array.isArray(state.talentSlotKinds) ? state.talentSlotKinds : [];
    const activeSlots = Number(state.equippedSlotLimit || 2);
    const slotText = Array.from({ length: Number(state.maxEquippedSlotLimit || 4) }, (_, index) => {
        const open = index < activeSlots;
        return `${getTalentSlotKindLabel(kinds[index])}:${open ? '开' : '未开'}`;
    }).join(' · ');
    return `${slotText}；品阶组合 ${ranks.join('')}`;
}

function getTalentSlotKindLabel(kind) {
    if (kind === 'faith') return '信仰槽';
    if (kind === 'profession') return '职业槽';
    return '任意槽';
}

function getTalentSlotRequirement(state, slot) {
    const kind = (Array.isArray(state.talentSlotKinds) ? state.talentSlotKinds[slot - 1] : '') || 'any';
    if (kind === 'faith') return { kind, poolKey: state.faithTalentPoolKey || '', label: '信仰' };
    if (kind === 'profession') return { kind, poolKey: state.professionTalentPoolKey || '', label: '职业' };
    return { kind, poolKey: '', label: '任意' };
}

function canTalentFitSlotRequirement(talent, requirement) {
    if (!talent || requirement.kind === 'any') return true;
    return !!requirement.poolKey && talent.pool_key === requirement.poolKey;
}

function renderEquippedTalentSlots(state, god = getProfileFaithGod(getCurrentProfile()) || '命运') {
    const talents = state.ownedTalents || [];
    const byEquippedSlot = new Map(talents.filter(t => t.equipped_slot).map(t => [Number(t.equipped_slot), t]));
    const activeLimit = Number(state.equippedSlotLimit || 3);
    const limit = Number(state.maxEquippedSlotLimit || activeLimit || 3);
    return `<div class="talent-equipped-grid">${Array.from({ length: limit }, (_, index) => {
        const slot = index + 1;
        const talent = byEquippedSlot.get(slot);
        const locked = slot > activeLimit;
        const requirement = getTalentSlotRequirement(state, slot);
        const slotLabel = getTalentSlotKindLabel(requirement.kind);
        const optionHtml = [
            '<option value="">卸下到仓库</option>',
            ...talents.filter(item => item.storage_slot || Number(item.id) === Number(talent?.id || 0)).map(item => {
                const id = Number(item.id);
                const isCurrent = id === Number(talent?.id || 0);
                const rankBlocked = !canTalentFitCurrentRankRule(state, item, slot, talent);
                const poolBlocked = !canTalentFitSlotRequirement(item, requirement);
                const disabled = !isCurrent && (rankBlocked || poolBlocked);
                const reason = rankBlocked ? `当前分数只允许 ${escapeHtml((state.talentSlotRule?.ranks || []).join(''))} 品阶组合` : `${slotLabel}不能嵌入这个池子的天赋`;
                const disabledText = disabled ? ` disabled title="${escapeHtml(reason)}"` : '';
                const suffix = disabled ? `（${escapeHtml(rankBlocked ? '品阶超限' : '池子不符')}）` : '';
                return `<option value="${id}" ${isCurrent ? 'selected' : ''}${disabledText}>${escapeHtml(renderTalentOptionLabel(item))}${suffix}</option>`;
            })
        ].join('');
        return `
            <div class="talent-slot-card ${talent ? '' : 'empty'} ${locked ? 'pending' : ''}">
                <div class="talent-slot-head"><span>${escapeHtml(slotLabel)} ${slot === 2 ? '（必带）' : ''}</span><span>${locked ? '未开启' : '已开启'}</span></div>
                <select onchange="equipTalentUI(${slot}, this.value)" ${locked ? 'disabled' : ''}>${optionHtml}</select>
                ${locked ? renderMiniRitualEmpty('分数达到对应门槛后开启此携带槽。', god, '携带环封锁') : (talent ? `<div class="talent-slot-meta">${escapeHtml(renderTalentOptionLabel(talent))}</div>` : renderMiniRitualEmpty(getGodEmptyText(god, 'equipped'), god, '携带环空置'))}
            </div>`;
    }).join('')}</div>`;
}

function renderTalentWarehouse(state, god = getProfileFaithGod(getCurrentProfile()) || '命运') {
    const talents = state.ownedTalents || [];
    const byStorageSlot = new Map(talents.filter(t => t.storage_slot).map(t => [Number(t.storage_slot), t]));
    const limit = Number(state.inventorySlotLimit || 10);
    return `<div class="talent-inventory-grid">${Array.from({ length: limit }, (_, index) => {
        const slot = index + 1;
        const talent = byStorageSlot.get(slot);
        if (!talent) {
            return `
                <div class="talent-slot-card empty">
                    <div class="talent-slot-head"><span>仓库位 ${slot}</span><span>空</span></div>
                    ${renderMiniRitualEmpty(getGodEmptyText(god, 'warehouse'), god, '仓库格空置')}
                </div>`;
        }
        const effect = getTalentEffectText(state, talent);
        const actionCost = getTalentActionCost(state, talent);
        const fragmentGain = getTalentDismantleGain(state, talent.rank);
        const canDismantle = String(talent.rank || '').toUpperCase() !== 'S';
        return `
            <div class="talent-slot-card">
                <div class="talent-slot-head"><span>仓库位 ${slot}</span><span>未佩戴</span></div>
                <div class="talent-slot-name">${escapeHtml(talent.talent_name)}</div>
                <div class="talent-slot-meta">${escapeHtml(talent.rank)}级 · ${escapeHtml(formatTalentPoolLabel(talent.pool_key))}池 · 行动点 ${actionCost}</div>
                ${effect ? `<div class="talent-effect-text">${escapeHtml(effect)}</div>` : ''}
                <div class="talent-slot-actions">
                    <button type="button" class="btn btn-outline btn-sm" onclick="discardOwnedTalentUI(${Number(talent.id)})" ${talentManageInFlight || !canDismantle ? 'disabled' : ''}>${talentManageInFlight ? '处理中' : (canDismantle ? `分解 +${fragmentGain}` : 'S级不可分解')}</button>
                </div>
            </div>`;
    }).join('')}</div>`;
}

function renderOverflowChoices(state) {
    const choices = state.overflowChoices || [];
    if (!choices.length) return '';
    const replacementOptions = (state.ownedTalents || [])
        .filter(talent => talent.storage_slot)
        .filter(talent => String(talent.rank || '').toUpperCase() !== 'S')
        .map(talent => `<option value="${Number(talent.id)}">仓库${Number(talent.storage_slot || 0)} · ${escapeHtml(renderTalentOptionLabel(talent))}</option>`)
        .join('');
    return `
        <div class="profile-panel-title" style="margin-top:16px;"><span>待取舍天赋</span><small>${choices.length} 个溢出</small></div>
        <div class="talent-overflow-list">${choices.map(choice => {
            const id = Number(choice.id);
            const actionCost = getTalentActionCost(state, choice);
            const canDiscardChoice = String(choice.rank || '').toUpperCase() !== 'S';
            return `
                <div class="talent-overflow-card">
                    <div class="talent-slot-head"><span>新天赋溢出</span><span>${escapeHtml(choice.source || 'draw')}</span></div>
                    <div class="talent-slot-name">${escapeHtml(choice.talent_name)}</div>
                    <div class="talent-slot-meta">${escapeHtml(choice.rank)}级 · ${escapeHtml(formatTalentPoolLabel(choice.pool_key))}池 · 行动点 ${actionCost}。仓库已满，请选择保留新天赋并替换旧天赋，或分解新天赋。</div>
                    ${getTalentEffectText(state, choice) ? `<div class="talent-effect-text">${escapeHtml(getTalentEffectText(state, choice))}</div>` : ''}
                    <div class="talent-exchange-row">
                        <select id="overflowReplaceSelect-${id}">${replacementOptions || '<option value="">仓库暂无可替换天赋</option>'}</select>
                        <button type="button" class="btn btn-primary btn-sm" onclick="resolveTalentOverflowUI(${id}, 'replace')" ${talentManageInFlight || !replacementOptions ? 'disabled' : ''}>${talentManageInFlight ? '处理中' : '保留并分解旧天赋'}</button>
                    </div>
                    <div class="talent-slot-actions">
                        <button type="button" class="btn btn-outline btn-sm" onclick="resolveTalentOverflowUI(${id}, 'discard')" ${talentManageInFlight || !canDiscardChoice ? 'disabled' : ''}>${talentManageInFlight ? '处理中' : (canDiscardChoice ? `分解新天赋 +${getTalentDismantleGain(state, choice.rank)}` : 'S级不可分解')}</button>
                    </div>
                </div>`;
        }).join('')}</div>`;
}

function renderTalentPoolPanel(state, error, profile) {
    const profileGod = getProfileFaithGod(profile) || '欺诈';
    const profileGodStyle = getGodSkinStyle(profileGod);
    if (error) {
        return `
            <section class="profile-panel" id="talentPoolPanel" data-god="${escapeHtml(profileGod)}" style="${profileGodStyle}">
                <div class="profile-panel-title"><span>${escapeHtml(getGodTalentPoolName(profileGod))}</span><small>待启用</small></div>
                <div class="profile-empty">${escapeHtml(error.message || '天赋池暂不可用。请先运行天赋池 SQL 并部署后端函数。')}</div>
            </section>`;
    }
    const selectedPool = getSelectedTalentPool(profile, state);
    const selectedPoolGod = cleanGodName(String(selectedPool || '').replace(/^Pool/u, '')) || profileGod;
    const selectedPoolTitle = getGodInfo(selectedPoolGod).known ? getGodTalentPoolName(selectedPoolGod) : `${formatTalentPoolLabel(selectedPool)}池`;
    const selectedPoolMeta = (state.pools || []).find(pool => pool.poolKey === selectedPool) || {};
    const selectedPoolReady = Number(selectedPoolMeta.total || 0) > 0;
    const latestResults = lastTalentDrawResult.length ? renderTalentCards(lastTalentDrawResult, '') : '';
    const allowedPoolText = (state.pools || []).map(pool => formatTalentPoolLabel(pool.poolKey)).join(' / ') || '未绑定';
    const inventoryCount = (state.ownedTalents || []).filter(talent => talent.storage_slot).length;
    const inventoryLimit = Number(state.inventorySlotLimit || 10);
    const equippedCount = (state.ownedTalents || []).filter(talent => talent.equipped_slot).length;
    const exchangeCost = Number(state.targetTalentExchangeCost || 180);
    const aExchangeCost = Number(state.aTalentExchangeCost || 260);
    const ascensionScore = Number(state.profile?.ascension_score || profile?.ascensionScore || 0);
    const advancedDraw = ascensionScore >= Number(state.advancedTalentDrawScore || 1500);
    const basicAvailableDraws = Number(state.basicAvailableDraws || 0);
    const advancedAvailableDraws = Number(state.advancedAvailableDraws || 0);
    const bRateText = `${Math.round(Number(advancedDraw ? state.advancedBTalentDrawRate : state.bTalentDrawRate || 0.2) * 100)}%`;
    const aRateText = `${Math.round(Number(state.aTalentDrawRate || 0.02) * 10000) / 100}%`;
    const sRateText = `${Math.round(Number(state.sTalentDrawRate || 0.001) * 10000) / 100}%`;
    const guaranteeDraws = Number(state.bTalentGuaranteeDraws || 10);
    const sGuaranteeDraws = Number(state.sTalentGuaranteeDraws || 60);
    const currentMisses = Math.min(guaranteeDraws - 1, getTalentPoolCounter(state, selectedPool));
    const sCounter = Number((state.counters || []).find(counter => counter.pool_key === selectedPool)?.s_continue_draw || 0);
    const drawRuleText = advancedDraw
        ? `1500+：S ${sRateText}（${sGuaranteeDraws}抽保底）/ A ${aRateText}（无保底）/ B ${bRateText}（${guaranteeDraws}抽保底）`
        : `1500前：仅 B/C，B ${bRateText}（${guaranteeDraws}抽保底）`;
    return `
        <section class="profile-panel" id="talentPoolPanel" data-god="${escapeHtml(profileGod)}" style="${profileGodStyle}">
            <div class="profile-panel-title">
                <span>${escapeHtml(selectedPoolTitle)}</span>
            </div>
            <div class="talent-pool-card" data-god="${escapeHtml(profileGod)}" style="${profileGodStyle}">
                <div class="profile-score-row">
                    <div class="profile-stat-card"><span>可用抽数</span><strong>${Number(state.availableDraws || 0)}</strong></div>
                    <div class="profile-stat-card"><span>天赋碎片</span><strong>${Number(state.fragmentTotal || 0)}</strong></div>
                </div>
                <div class="metric-strip">
                    <span class="metric-pill">累计获得抽数 <strong>${Number(state.totalDrawsEarned || 0)}</strong></span>
                    <span class="metric-pill">已用抽数 <strong>${Number(state.spentDraws || 0)}</strong></span>
                    ${Number(state.eventBasicDraws || 0) ? `<span class="metric-pill">腐朽登神 B/C <strong>${Number(state.eventBasicDraws || 0)}</strong></span>` : ''}
                    ${Number(state.eventAdvancedDraws || 0) ? `<span class="metric-pill">腐朽登神 S/A/B/C <strong>${Number(state.eventAdvancedDraws || 0)}</strong></span>` : ''}
                    <span class="metric-pill">基础 B/C 抽 <strong>${basicAvailableDraws}</strong></span>
                    <span class="metric-pill">进阶 S/A/B/C 抽 <strong>${advancedAvailableDraws}</strong></span>
                    <span class="metric-pill">B级概率 <strong>${escapeHtml(bRateText)}</strong></span>
                    <span class="metric-pill">保底进度 <strong>${currentMisses}/${guaranteeDraws - 1}</strong></span>
                    ${advancedDraw ? `<span class="metric-pill">S保底 <strong>${Math.min(sGuaranteeDraws - 1, sCounter)}/${sGuaranteeDraws - 1}</strong></span>` : ''}
                    <span class="metric-pill">仓库 <strong>${inventoryCount}/${inventoryLimit}</strong></span>
                    <span class="metric-pill">携带 <strong>${equippedCount}/${Number(state.equippedSlotLimit || 3)}</strong></span>
                    <span class="metric-pill">可选池 <strong>${escapeHtml(allowedPoolText)}</strong></span>
                </div>
                <div class="talent-rule-strip">
                    <span>新手赠送 <strong>${Number(state.starterTalentDrawGrant || 15)}</strong> 抽，不计保底</span>
                    ${Number(state.eventBasicDraws || 0) ? `<span>庆祝腐朽登神活动 <strong>${Number(state.eventBasicDraws || 0)}</strong> 抽，属于基础 B/C 抽</span>` : ''}
                    ${Number(state.eventAdvancedDraws || 0) ? `<span>庆祝腐朽登神活动 <strong>${Number(state.eventAdvancedDraws || 0)}</strong> 抽，属于进阶 S/A/B/C 抽</span>` : ''}
                    <span>${escapeHtml(drawRuleText)}</span>
                    <span>基础抽数优先消耗，1500 前获得的抽数不会转化为进阶抽数</span>
                    <span>重复 C/B：<strong>+${Number(state.cTalentFragmentGain || 5)} / +${Number(state.bTalentFragmentGain || 10)}</strong> 碎片</span>
                    <span>分解 C/B/A：<strong>+${Number(state.cTalentFragmentGain || 5)} / +${Number(state.bTalentFragmentGain || 10)} / +200</strong> 碎片，S不可分解</span>
                    <span>携带上限：<strong>${escapeHtml(renderTalentSlotRuleText(state))}</strong></span>
                    <span>指定 B/A 兑换：<strong>${exchangeCost} / ${aExchangeCost}</strong> 碎片</span>
                </div>
                <div class="talent-control-row">
                    <div class="form-group" style="margin:0;">
                        <label for="talentPoolSelect">选择天赋池</label>
                        <select id="talentPoolSelect" onchange="selectTalentPoolUI(this.value)">${renderTalentPoolOptions(state, selectedPool)}</select>
                    </div>
                    <button type="button" class="btn btn-outline btn-sm" onclick="refreshTalentPoolUI()">重观池纹</button>
                    <button type="button" class="btn btn-outline btn-sm" onclick="drawTalentUI('single')" ${talentDrawInFlight || !selectedPoolReady || state.availableDraws < 1 ? 'disabled' : ''}>${talentDrawInFlight ? '牵引中' : '牵引一枚'}</button>
                    <button type="button" class="btn btn-primary btn-sm" onclick="drawTalentUI('ten')" ${talentDrawInFlight || !selectedPoolReady || state.availableDraws < 10 ? 'disabled' : ''}>${talentDrawInFlight ? '十连牵引中' : '启十连谕'}</button>
                </div>
                ${selectedPoolReady ? '' : '<div class="identity-help">当前天赋池暂无配置，等补完池子后就能抽取。</div>'}
                ${latestResults ? `<div class="profile-list-meta" style="margin-top:12px;">本次抽取</div>${latestResults}` : ''}
            </div>
            ${renderOverflowChoices(state)}
            <div class="profile-panel-title" style="margin-top:16px;"><span>天赋仓库</span><small>${inventoryCount}/${inventoryLimit} 个槽位</small></div>
            ${renderTalentWarehouse(state, profileGod)}
            <div class="talent-exchange-row">
                <select id="talentExchangeSelect">${renderTalentExchangeOptions(state, selectedPool)}</select>
                <button type="button" class="btn btn-outline btn-sm" onclick="exchangeTalentUI()" ${!selectedPoolReady ? 'disabled' : ''}>B${exchangeCost} / A${aExchangeCost} 碎片赎取</button>
            </div>
            <div class="profile-panel-title" style="margin-top:16px;"><span>抽取记录</span></div>
            ${renderTalentLogs(state, profileGod)}
        </section>`;
}

async function selectTalentPoolUI(poolKey) {
    selectedTalentPool = poolKey;
    lastTalentDrawResult = [];
    replaceTalentPoolPanel();
}

async function refreshTalentPoolUI(showToastOnSuccess = true) {
    const { state, error } = await fetchTalentState();
    if (error?.message?.includes('身份已切换')) return;
    setCurrentTalentState(state, error);
    lastTalentDrawResult = [];
    replaceTalentPoolPanel();
    if (error) showToast(`❌ ${error.message || '刷新失败'}`);
    else if ((state?.settledOverflowChoices || []).length) showToast(`已将 ${state.settledOverflowChoices.length} 个待取舍天赋补入空仓位`);
    else if (showToastOnSuccess) showToast('天赋池已刷新');
}

function applyTalentActionState(data) {
    if (!data?.state) return;
    const nextState = normalizeTalentState(data.state);
    setCurrentTalentState(nextState, null);
    applyTalentStateProfile(nextState);
    replaceTalentPoolPanel();
    if ((nextState.settledOverflowChoices || []).length) showToast(`已将 ${nextState.settledOverflowChoices.length} 个待取舍天赋补入空仓位`);
}

function getProfileExportPayload() {
    const profile = getCurrentProfile();
    const state = normalizeTalentState(currentTalentState);
    const displayName = cleanDisplayNameInput(inviteSession?.name || profile.displayName || '') || '未命名信徒';
    const faithGod = getProfileFaithGod(profile) || '命运';
    const visualProfession = getProfileVisualProfession(profile) || profile.profession || '';
    const profession = visualProfession || '未填写职业';
    const professionInfo = getProfessionInfo(visualProfession);
    const titles = profile.showTitles === false
        ? []
        : normalizeProfileTitleList(profile.activeTitles, profile.activeTitle).map(title => ({
            name: title.titleText,
            god: title.titleGod || '',
            note: title.titleNote || '',
        })).filter(title => title.name);
    const curses = normalizeProfileCurseList(profile.activeCurses, profile.activeCurse).map(curse => ({
        name: curse.curseText,
        god: curse.curseGod || '',
        effect: curse.curseNote || '',
        type: curse.curseType || 'betrayal',
    })).filter(curse => curse.name);
    const healthSummary = getProfileHealthSummary({ ...profile, profession: visualProfession || profile.profession });
    const equippedTalents = (state.ownedTalents || [])
        .filter(talent => Number(talent.equipped_slot || 0) > 0)
        .sort((a, b) => Number(a.equipped_slot || 0) - Number(b.equipped_slot || 0))
        .map(talent => ({
            slot: Number(talent.equipped_slot || 0),
            name: String(talent.talent_name || ''),
            rank: String(talent.rank || ''),
            pool: formatTalentPoolLabel(talent.pool_key),
            effect: getTalentEffectText(state, talent),
        }));
    return {
        displayName,
        faithGod,
        profession,
        professionClass: professionInfo.className || healthSummary.profession.className || '',
        professionTrait: healthSummary.classTrait || CLASS_TRAITS[professionInfo.className] || '',
        ascensionScore: Number(profile.ascensionScore || 0),
        audienceScore: Number(profile.audienceScore || 0),
        items: splitProfileLines(profile.items).slice(0, 20),
        health: {
            maxHp: healthSummary.maxHp,
            baseHp: healthSummary.rule.baseHp,
            tableHp: healthSummary.tableHp,
            healthBand: healthSummary.healthBand,
            growthHp: healthSummary.growthHp,
            faithBonus: healthSummary.faithBonus,
            resistanceSkinName: healthSummary.resistanceSkin?.name || '',
            resistanceSkinDescription: healthSummary.resistanceSkin?.description || '',
            className: healthSummary.rule.className || healthSummary.profession.className || '',
            trait: healthSummary.trait || ''
        },
        titles,
        curses,
        equippedTalents,
        exportedAt: new Date(),
    };
}

function drawProfileCardImage(payload) {
    const width = 1200;
    const scale = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    measureCtx.font = '600 23px "Microsoft YaHei", sans-serif';
    const faithTraitLines = wrapCanvasText(measureCtx, payload.health.trait || '请选择信仰后查看信仰特性。', 570, Infinity);
    const professionTraitLines = wrapCanvasText(measureCtx, payload.professionTrait || '请选择职业后查看职业特性。', 570, Infinity);
    measureCtx.font = '800 34px "Microsoft YaHei", sans-serif';
    const titleEntries = Array.isArray(payload.titles) ? payload.titles : [];
    const titleText = titleEntries.length
        ? titleEntries.slice(0, 5).map(title => {
            if (typeof title === 'string') return title;
            return [title.name, title.note].filter(Boolean).join('｜');
        }).filter(Boolean).join(' / ')
        : '暂无已佩戴称号';
    const titleLines = wrapCanvasText(measureCtx, titleText, 960, Infinity);
    const itemEntries = Array.isArray(payload.items) && payload.items.length
        ? payload.items
        : ['无'];
    const itemLayouts = itemEntries.map(item => {
        measureCtx.font = '700 28px "Microsoft YaHei", sans-serif';
        const lines = wrapCanvasText(measureCtx, String(item || '无'), 880, Infinity);
        const cardHeight = Math.max(76, 42 + lines.length * 34);
        return { lines, cardHeight };
    });
    const curseEntries = Array.isArray(payload.curses) && payload.curses.length
        ? payload.curses
        : [{ name: '暂无诅咒', god: payload.faithGod || '命运', effect: '当前没有挂载中的诅咒。', type: 'ordinary', empty: true }];
    const curseLayouts = curseEntries.slice(0, 5).map(curse => {
        measureCtx.font = '900 32px "Microsoft YaHei", sans-serif';
        const nameLines = wrapCanvasText(measureCtx, String(curse.name || '未知诅咒'), 880, Infinity);
        measureCtx.font = '600 22px "Microsoft YaHei", sans-serif';
        const effectLines = wrapCanvasText(measureCtx, curse.effect || '暂无记录具体效果。', 880, Infinity);
        const cardHeight = Math.max(132, 98 + nameLines.length * 36 + effectLines.length * 29);
        return { curse, nameLines, effectLines, cardHeight };
    });
    const talents = payload.equippedTalents.length ? payload.equippedTalents : [{ slot: 0, name: '尚未携带天赋', rank: '', pool: '', effect: '打开个人面板后可在天赋仓库配置携带槽。' }];
    const talentLayouts = talents.slice(0, 4).map(talent => {
        measureCtx.font = '900 34px "Microsoft YaHei", sans-serif';
        const name = `${talent.name}${talent.rank ? `（${talent.rank}）` : ''}`;
        const nameLines = wrapCanvasText(measureCtx, name, 880, Infinity);
        measureCtx.font = '600 22px "Microsoft YaHei", sans-serif';
        const meta = [talent.pool ? `${talent.pool}池` : '', talent.effect || ''].filter(Boolean).join(' · ');
        const metaLines = wrapCanvasText(measureCtx, meta, 880, Infinity);
        const cardHeight = Math.max(138, 104 + nameLines.length * 38 + metaLines.length * 29);
        return { talent, nameLines, metaLines, cardHeight };
    });
    const battleTop = 630;
    const battleHeight = Math.max(240, 104 + faithTraitLines.length * 31 + 58 + professionTraitLines.length * 31);
    const titlesHeadingY = battleTop + battleHeight + 84;
    const titleStartY = titlesHeadingY + 52;
    const itemsHeadingY = titleStartY + titleLines.length * 44 + 76;
    const firstItemY = itemsHeadingY + 38;
    const itemTotalHeight = itemLayouts.reduce((sum, item, index) => sum + item.cardHeight + (index ? 14 : 0), 0);
    const curseHeadingY = firstItemY + itemTotalHeight + 62;
    const curseStartY = curseHeadingY + 38;
    const curseTotalHeight = curseLayouts.reduce((sum, item, index) => sum + item.cardHeight + (index ? 18 : 0), 0);
    const talentsHeadingY = curseStartY + curseTotalHeight + 76;
    const firstTalentY = talentsHeadingY + 38;
    const talentTotalHeight = talentLayouts.reduce((sum, item, index) => sum + item.cardHeight + (index ? 22 : 0), 0);
    const footerY = firstTalentY + talentTotalHeight + 90;
    const height = Math.max(1960, footerY + 170);
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    const skin = getGodSkin(payload.faithGod);
    const main = skin.primary || '#d5a742';
    const accent = skin.secondary || '#7f8cff';
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, '#080a10');
    bg.addColorStop(0.48, '#111521');
    bg.addColorStop(1, '#07070b');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = main;
    ctx.lineWidth = 2;
    for (let x = -height; x < width; x += 72) {
        ctx.beginPath();
        ctx.moveTo(x, height);
        ctx.lineTo(x + height, 0);
        ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-Math.PI / 7);
    ctx.font = '900 118px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(231,207,138,0.055)';
    ctx.textAlign = 'center';
    for (let y = -760; y <= 760; y += 260) {
        for (let x = -760; x <= 760; x += 680) {
            ctx.fillText('诸神愚戏', x, y);
        }
    }
    ctx.restore();

    drawRoundRect(ctx, 62, 62, width - 124, height - 124, 28);
    ctx.fillStyle = 'rgba(12,14,22,0.82)';
    ctx.fill();
    ctx.strokeStyle = main;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = main;
    ctx.font = '900 34px "Microsoft YaHei", sans-serif';
    ctx.fillText('诸神愚戏 · 信徒档案', 108, 138);
    ctx.fillStyle = 'rgba(234,234,242,0.58)';
    ctx.font = '600 22px "Microsoft YaHei", sans-serif';
    ctx.fillText(`导出时间 ${formatDate(payload.exportedAt.toISOString())}`, 108, 178);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(231,207,138,0.9)';
    ctx.font = '900 92px "Microsoft YaHei", sans-serif';
    ctx.fillText(getGodIcon(payload.faithGod) || '✦', width - 110, 150);
    ctx.font = '700 24px "Microsoft YaHei", sans-serif';
    ctx.fillText(`${payload.faithGod} · ${skin.motif || '命途'}`, width - 110, 188);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#f4f0df';
    ctx.font = '900 72px "Microsoft YaHei", sans-serif';
    ctx.fillText(payload.displayName, 108, 292);
    ctx.fillStyle = 'rgba(234,234,242,0.78)';
    ctx.font = '700 30px "Microsoft YaHei", sans-serif';
    const professionLine = payload.professionClass
        ? `职业：${payload.professionClass} · ${payload.profession}`
        : `职业：${payload.profession}`;
    ctx.fillText(professionLine, 112, 342);

    const scoreCards = [
        ['登神之路', String(payload.ascensionScore)],
        ['觐见之梯', String(payload.audienceScore)],
    ];
    scoreCards.forEach(([label, value], index) => {
        const x = 108 + index * 500;
        drawRoundRect(ctx, x, 396, 440, 130, 18);
        ctx.fillStyle = index ? 'rgba(127,140,255,0.12)' : 'rgba(213,167,66,0.13)';
        ctx.fill();
        ctx.strokeStyle = index ? accent : main;
        ctx.globalAlpha = 0.45;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(234,234,242,0.62)';
        ctx.font = '700 24px "Microsoft YaHei", sans-serif';
        ctx.fillText(label, x + 28, 438);
        ctx.fillStyle = '#f4f0df';
        ctx.font = '900 48px "Microsoft YaHei", sans-serif';
        ctx.fillText(value, x + 28, 494);
    });

    ctx.fillStyle = main;
    ctx.font = '900 30px "Microsoft YaHei", sans-serif';
    ctx.fillText('战斗面板', 108, 596);
    drawRoundRect(ctx, 108, battleTop, 310, battleHeight, 20);
    ctx.fillStyle = 'rgba(213,167,66,0.12)';
    ctx.fill();
    ctx.strokeStyle = main;
    ctx.globalAlpha = 0.42;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(234,234,242,0.62)';
    ctx.font = '800 24px "Microsoft YaHei", sans-serif';
    ctx.fillText('血量上限', 136, battleTop + 44);
    ctx.fillStyle = '#f4f0df';
    ctx.font = '900 70px "Microsoft YaHei", sans-serif';
    ctx.fillText(payload.health.maxHp ? String(payload.health.maxHp) : '未定', 136, battleTop + 118);
    ctx.fillStyle = 'rgba(234,234,242,0.62)';
    ctx.font = '600 21px "Microsoft YaHei", sans-serif';
    const healthParts = payload.health.maxHp
        ? [`基础 ${payload.health.baseHp}`, `${payload.health.healthBand}档 ${payload.health.tableHp}`, `成长 +${payload.health.growthHp}`]
        : ['请选择职业后查看血量成长'];
    ctx.fillText(healthParts.join(' / '), 136, battleTop + 156);
    const healthRuleText = payload.health.maxHp
        ? `信仰 +${payload.health.faithBonus || 0} / ${payload.health.resistanceSkinName || '暂无分数档被动'}`
        : '';
    if (healthRuleText) ctx.fillText(healthRuleText, 136, battleTop + 188);

    drawRoundRect(ctx, 444, battleTop, 648, battleHeight, 20);
    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.36;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(231,207,138,0.86)';
    ctx.font = '800 24px "Microsoft YaHei", sans-serif';
    ctx.fillText(`${payload.faithGod}之神 · 信仰特性`, 474, battleTop + 44);
    ctx.fillStyle = 'rgba(244,240,223,0.84)';
    ctx.font = '600 23px "Microsoft YaHei", sans-serif';
    faithTraitLines.forEach((line, index) => {
        ctx.fillText(line, 474, battleTop + 88 + index * 31);
    });
    const professionTraitTitleY = battleTop + 104 + faithTraitLines.length * 31;
    ctx.fillStyle = 'rgba(231,207,138,0.86)';
    ctx.font = '800 24px "Microsoft YaHei", sans-serif';
    const classLabel = payload.professionClass || '职业';
    ctx.fillText(`${classLabel} · 职业特性`, 474, professionTraitTitleY);
    ctx.fillStyle = 'rgba(244,240,223,0.84)';
    ctx.font = '600 23px "Microsoft YaHei", sans-serif';
    professionTraitLines.forEach((line, index) => {
        ctx.fillText(line, 474, professionTraitTitleY + 44 + index * 31);
    });

    ctx.fillStyle = main;
    ctx.font = '900 30px "Microsoft YaHei", sans-serif';
    ctx.fillText('已佩戴称号', 108, titlesHeadingY);
    titleLines.forEach((line, index) => {
        ctx.fillStyle = index ? 'rgba(244,240,223,0.72)' : '#f4f0df';
        ctx.font = '800 34px "Microsoft YaHei", sans-serif';
        ctx.fillText(line, 108, titleStartY + index * 44);
    });

    ctx.fillStyle = main;
    ctx.font = '900 30px "Microsoft YaHei", sans-serif';
    ctx.fillText('个人道具', 108, itemsHeadingY);
    let itemY = firstItemY;
    itemLayouts.forEach((layout, index) => {
        const y = itemY;
        drawRoundRect(ctx, 108, y, 984, layout.cardHeight, 16);
        ctx.fillStyle = 'rgba(255,255,255,0.035)';
        ctx.fill();
        ctx.strokeStyle = index % 2 ? accent : main;
        ctx.globalAlpha = 0.28;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#f4f0df';
        ctx.font = '700 28px "Microsoft YaHei", sans-serif';
        layout.lines.forEach((line, lineIndex) => {
            ctx.fillText(line, 136, y + 48 + lineIndex * 34);
        });
        itemY += layout.cardHeight + 14;
    });

    ctx.fillStyle = '#d98d8d';
    ctx.font = '900 30px "Microsoft YaHei", sans-serif';
    ctx.fillText('现存诅咒', 108, curseHeadingY);
    let curseY = curseStartY;
    curseLayouts.forEach((layout, index) => {
        const { curse, nameLines, effectLines, cardHeight } = layout;
        const y = curseY;
        const curseGod = curse.god || payload.faithGod || '命运';
        const curseSkin = getGodSkin(curseGod);
        const curseAccent = curse.empty ? main : (curseSkin.primary || '#b84545');
        drawRoundRect(ctx, 108, y, 984, cardHeight, 18);
        ctx.fillStyle = curse.empty ? 'rgba(255,255,255,0.035)' : 'rgba(80,15,22,0.18)';
        ctx.fill();
        ctx.strokeStyle = curseAccent;
        ctx.globalAlpha = curse.empty ? 0.24 : 0.42;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = curse.empty ? 'rgba(231,207,138,0.76)' : 'rgba(217,141,141,0.92)';
        ctx.font = '800 24px "Microsoft YaHei", sans-serif';
        const curseTypeLabel = getProfileCurseTypeLabel(curse.type || curse.curseType);
        ctx.fillText(curse.empty ? '诅咒状态' : `${curseGod} · ${curseTypeLabel}`, 136, y + 38);
        ctx.fillStyle = '#f4f0df';
        ctx.font = '900 32px "Microsoft YaHei", sans-serif';
        nameLines.forEach((line, lineIndex) => {
            ctx.fillText(line, 136, y + 76 + lineIndex * 36);
        });
        ctx.fillStyle = 'rgba(234,234,242,0.68)';
        ctx.font = '600 22px "Microsoft YaHei", sans-serif';
        const effectStartY = y + 100 + nameLines.length * 36;
        effectLines.forEach((line, lineIndex) => {
            ctx.fillText(line, 136, effectStartY + lineIndex * 29);
        });
        curseY += cardHeight + 18;
    });

    ctx.fillStyle = main;
    ctx.font = '900 30px "Microsoft YaHei", sans-serif';
    ctx.fillText('携带天赋', 108, talentsHeadingY);
    let talentY = firstTalentY;
    talentLayouts.forEach((layout, index) => {
        const { talent, nameLines, metaLines, cardHeight } = layout;
        const y = talentY;
        drawRoundRect(ctx, 108, y, 984, cardHeight, 18);
        ctx.fillStyle = 'rgba(255,255,255,0.045)';
        ctx.fill();
        ctx.strokeStyle = index % 2 ? accent : main;
        ctx.globalAlpha = 0.36;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(231,207,138,0.86)';
        ctx.font = '800 24px "Microsoft YaHei", sans-serif';
        ctx.fillText(talent.slot ? `携带槽 ${talent.slot}` : '携带槽', 136, y + 38);
        ctx.fillStyle = '#f4f0df';
        ctx.font = '900 34px "Microsoft YaHei", sans-serif';
        nameLines.forEach((line, lineIndex) => {
            ctx.fillText(line, 136, y + 78 + lineIndex * 38);
        });
        ctx.fillStyle = 'rgba(234,234,242,0.64)';
        ctx.font = '600 22px "Microsoft YaHei", sans-serif';
        const metaStartY = y + 104 + nameLines.length * 38;
        metaLines.forEach((line, lineIndex) => {
            ctx.fillText(line, 136, metaStartY + lineIndex * 29);
        });
        talentY += cardHeight + 22;
    });

    ctx.fillStyle = 'rgba(234,234,242,0.48)';
    ctx.font = '600 22px "Microsoft YaHei", sans-serif';
    ctx.fillText('由诸神愚戏副本论坛生成 · 仅作玩家档案展示', 108, height - 130);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(231,207,138,0.72)';
    ctx.font = '900 28px "Microsoft YaHei", sans-serif';
    ctx.fillText('诸神愚戏', width - 108, height - 130);
    ctx.textAlign = 'left';

    return canvas;
}

function exportProfileCardImage() {
    if (!inviteSession) { openInviteModal('先验入局谕令后可导出个人档案图。'); return; }
    try {
        const canvas = drawProfileCardImage(getProfileExportPayload());
        const link = document.createElement('a');
        const name = cleanDisplayNameInput(inviteSession.name || getCurrentProfile().displayName || 'profile') || 'profile';
        link.download = `诸神愚戏-个人档案-${name}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        link.remove();
        showToast('个人档案图已生成');
    } catch (error) {
        console.error('导出个人档案图失败', error);
        showToast('❌ 导出失败，请刷新个人面板后重试');
    }
}

async function drawTalentUI(drawType) {
    if (!inviteSession?.code) { openInviteModal('先验入局谕令后可开启天赋池。'); return; }
    if (talentDrawInFlight) { showToast('天赋池正在牵引，请勿重复点击'); return; }
    const poolKey = document.getElementById('talentPoolSelect')?.value || selectedTalentPool;
    talentDrawInFlight = true;
    const inviteSnapshot = getInviteSnapshot();
    replaceTalentPoolPanel();
    try {
        const { data, error } = await invokeDungeonAction('drawTalent', { poolKey, drawType });
        if (!isInviteSnapshotCurrent(inviteSnapshot)) return;
        if (error) {
            showToast(`❌ ${error.message || '抽取失败'}`);
            if (String(error.message || '').includes('抽数不足')) await refreshTalentPoolUI(false);
            return;
        }
        selectedTalentPool = poolKey;
        lastTalentDrawResult = Array.isArray(data?.results) ? data.results : [];
        applyTalentActionState(data);
        const basicUsed = Number(data?.basicDrawsUsed || 0);
        const advancedUsed = Number(data?.advancedDrawsUsed || 0);
        const tierSummary = advancedUsed
            ? `基础 B/C ${basicUsed} 抽，进阶 S/A/B/C ${advancedUsed} 抽`
            : `基础 B/C ${basicUsed} 抽`;
        showToast(`${drawType === 'ten' ? '十连完成' : '单抽完成'}：${tierSummary}`);
        if (document.getElementById('leaderboardPage')?.style.display !== 'none') await renderLeaderboardPage();
    } finally {
        if (isInviteSnapshotCurrent(inviteSnapshot)) {
            talentDrawInFlight = false;
            replaceTalentPoolPanel();
        }
    }
}

async function exchangeTalentUI() {
    if (!inviteSession?.code) { openInviteModal('先验入局谕令后可兑换天赋。'); return; }
    const poolKey = document.getElementById('talentPoolSelect')?.value || selectedTalentPool;
    const exchangeSelect = document.getElementById('talentExchangeSelect');
    const targetTalentId = Number(exchangeSelect?.value || 0);
    if (!targetTalentId) { showToast('请选择可兑换的 B/A 级天赋'); return; }
    const selectedOption = exchangeSelect?.selectedOptions?.[0];
    const optionRank = selectedOption?.dataset?.rank || '';
    const optionName = selectedOption?.dataset?.name || selectedOption?.textContent || '该天赋';
    const optionCost = Number(selectedOption?.dataset?.cost || 0);
    const confirmText = optionCost > 0
        ? `确定消耗 ${optionCost} 碎片兑换 ${optionRank}级天赋「${optionName}」吗？`
        : `确定兑换天赋「${optionName}」吗？`;
    if (!window.confirm(confirmText)) return;
    if (!acquireUiActionLock('exchangeTalent', '天赋兑换正在处理中，请勿重复点击')) return;
    const inviteSnapshot = getInviteSnapshot();
    try {
        const { data, error } = await invokeDungeonAction('exchangeTalent', { poolKey, targetTalentId });
        if (!isInviteSnapshotCurrent(inviteSnapshot)) return;
        if (error) { showToast(`❌ ${error.message || '兑换失败'}`); return; }
        selectedTalentPool = poolKey;
        lastTalentDrawResult = data?.talent ? [data.talent] : [];
        applyTalentActionState(data);
        showToast('碎片兑换完成');
        if (document.getElementById('leaderboardPage')?.style.display !== 'none') await renderLeaderboardPage();
    } finally {
        releaseUiActionLock('exchangeTalent');
    }
}

async function equipTalentUI(equippedSlot, ownedTalentId) {
    if (!inviteSession?.code) { openInviteModal('先验入局谕令后可调整携带天赋。'); return; }
    const lockKey = `equipTalent:${equippedSlot}`;
    if (!acquireUiActionLock(lockKey, '天赋携带正在更新，请勿重复点击')) return;
    const payload = {
        equippedSlot: Number(equippedSlot),
        ownedTalentId: ownedTalentId ? Number(ownedTalentId) : null
    };
    const inviteSnapshot = getInviteSnapshot();
    try {
        const { data, error } = await invokeDungeonAction('setEquippedTalent', payload);
        if (!isInviteSnapshotCurrent(inviteSnapshot)) return;
        if (error) { showToast(`❌ ${error.message || '设置失败'}`); return; }
        lastTalentDrawResult = [];
        applyTalentActionState(data);
        showToast('携带天赋已更新');
    } finally {
        releaseUiActionLock(lockKey);
    }
}

async function resolveTalentOverflowUI(choiceId, decision) {
    if (!inviteSession?.code) { openInviteModal('先验入局谕令后可处理溢出天赋。'); return; }
    if (talentManageInFlight) { showToast('天赋正在处理中，请勿重复点击'); return; }
    const payload = { choiceId: Number(choiceId), decision };
    if (decision === 'replace') {
        const replaceOwnedId = Number(document.getElementById(`overflowReplaceSelect-${choiceId}`)?.value || 0);
        if (!replaceOwnedId) { showToast('请选择要替换的仓库天赋'); return; }
        payload.replaceOwnedId = replaceOwnedId;
    }
    talentManageInFlight = true;
    const inviteSnapshot = getInviteSnapshot();
    replaceTalentPoolPanel();
    try {
        const { data, error } = await invokeDungeonAction('resolveTalentOverflow', payload);
        if (!isInviteSnapshotCurrent(inviteSnapshot)) return;
        if (error) { showToast(`❌ ${error.message || '处理失败'}`); return; }
        lastTalentDrawResult = [];
        applyTalentActionState(data);
        const gain = Number(data?.fragmentGain || 0);
        showToast(decision === 'replace' ? `已保留新天赋，旧天赋分解 +${gain} 碎片` : `已分解溢出天赋 +${gain} 碎片`);
    } finally {
        if (isInviteSnapshotCurrent(inviteSnapshot)) {
            talentManageInFlight = false;
            replaceTalentPoolPanel();
        }
    }
}

async function discardOwnedTalentUI(ownedTalentId) {
    if (!inviteSession?.code) { openInviteModal('先验入局谕令后可整理仓库。'); return; }
    if (talentManageInFlight) { showToast('天赋正在处理中，请勿重复点击'); return; }
    if (!window.confirm('确定分解这个仓库天赋并获得碎片吗？')) return;
    talentManageInFlight = true;
    const inviteSnapshot = getInviteSnapshot();
    replaceTalentPoolPanel();
    try {
        const { data, error } = await invokeDungeonAction('discardOwnedTalent', { ownedTalentId: Number(ownedTalentId) });
        if (!isInviteSnapshotCurrent(inviteSnapshot)) return;
        if (error) { showToast(`❌ ${error.message || '分解失败'}`); return; }
        lastTalentDrawResult = [];
        applyTalentActionState(data);
        showToast(`仓库天赋已分解 +${Number(data?.fragmentGain || 0)} 碎片`);
    } finally {
        if (isInviteSnapshotCurrent(inviteSnapshot)) {
            talentManageInFlight = false;
            replaceTalentPoolPanel();
        }
    }
}

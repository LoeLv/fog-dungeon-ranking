let talentWarehouseBatchSelections = new Set();
let talentWarehouseBatchInFlight = false;

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
        sTalentWarehouseSlotLimit: Number(state.sTalentWarehouseSlotLimit || 5),
        sTalentWarehouseCount: Number(state.sTalentWarehouseCount || 0),
        sTalentExchangeCost: Number(state.sTalentExchangeCost || 800),
        pools: Array.isArray(state.pools) ? state.pools : [],
        allowedPoolKeys: Array.isArray(state.allowedPoolKeys) ? state.allowedPoolKeys : [],
        poolItems: Array.isArray(state.poolItems) ? state.poolItems : [],
        counters: Array.isArray(state.counters) ? state.counters : [],
        ownedTalents: Array.isArray(state.ownedTalents) ? state.ownedTalents : [],
        overflowChoices: Array.isArray(state.overflowChoices) ? state.overflowChoices : [],
        settledOverflowChoices: Array.isArray(state.settledOverflowChoices) ? state.settledOverflowChoices : [],
        exclusiveTalentSlot: state.exclusiveTalentSlot || { enabled: false, scoreUnlocked: false, manualEnabled: false, talent: null },
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
    syncWarehouseBatchToolbar();
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
        const label = `${formatTalentPoolLabel(pool.poolKey)}池 · S${Number(pool.sCount || 0)} / A${Number(pool.aCount || 0)} / B${Number(pool.bCount || 0)} / C${Number(pool.cCount || 0)}`;
        return `<option value="${escapeHtml(pool.poolKey)}" ${pool.poolKey === selected ? 'selected' : ''} ${disabled}>${escapeHtml(label)}</option>`;
    }).join('');
}

function renderTalentCards(talents, emptyText = '还没有抽到天赋。') {
    if (!talents?.length) return `<div class="profile-empty">${escapeHtml(emptyText)}</div>`;
    return `<div class="talent-result-grid">${talents.map(talent => {
        const name = talent.talentName || talent.talent_name || '未知天赋';
        const rank = talent.rank || 'C';
        const effect = talent.effect || talent.talent_effect || '';
        const cooldown = talent.cooldown || talent.cooldownText || talent.cooldown_text || '无';
        const actionCost = Number(talent.actionCost ?? talent.action_cost ?? 0);
        const pool = formatTalentPoolLabel(talent.poolKey || talent.pool_key);
        const repeat = talent.isRepeat || talent.is_repeat;
        const guarantee = talent.isGuarantee || talent.is_guarantee;
        const overflow = talent.isOverflow || talent.is_overflow;
        const fragment = Number(talent.fragmentGain ?? talent.fragment_gain ?? 0);
        const sGuaranteeFragment = Number(talent.sGuaranteeFragmentGain ?? talent.s_guarantee_fragment_gain ?? 0);
        const storageSlot = Number(talent.storageSlot ?? talent.storage_slot ?? 0);
        const sStorageSlot = Number(talent.sStorageSlot ?? talent.s_storage_slot ?? talent.s_slot ?? 0);
        const source = talent.acquired_from === 'exchange' ? '碎片兑换' : (talent.acquired_from === 'draw' ? '天赋池抽取' : pool);
        const place = overflow ? ' · 仓库已满，待取舍' : (sStorageSlot ? ` · S仓库${sStorageSlot}号位` : (storageSlot ? ` · 入库${storageSlot}号位` : ''));
        return `
            <div class="talent-card rank-${escapeHtml(rank)} ${repeat ? 'repeat' : ''} ${overflow ? 'pending' : ''}">
                <strong>${escapeHtml(name)}</strong>
                <small>${escapeHtml(rank)}级 · ${escapeHtml(pool || source)} · 行动点 ${actionCost}${cooldown ? ` · 冷却 ${escapeHtml(cooldown)}` : ''}${guarantee ? ' · 保底' : ''}${repeat ? ` · 重复转化 +${fragment} 碎片` : ''}${sGuaranteeFragment ? ` · S保底补偿 +${sGuaranteeFragment} 碎片` : ''}${escapeHtml(place)}</small>
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
    const allowedRanks = advancedDraw ? ['S', 'A', 'B'] : ['S', 'B'];
    const options = (state.poolItems || [])
        .filter(item => item.pool_key === poolKey && allowedRanks.includes(item.rank))
        .map(item => {
            const owned = ownedKeys.has(`${item.pool_key}:${item.talent_id}`);
            const cost = item.rank === 'S' ? Number(state.sTalentExchangeCost || 800) : (item.rank === 'A' ? Number(state.aTalentExchangeCost || 260) : Number(state.targetTalentExchangeCost || 80));
            const actionCost = Number(item.action_cost ?? item.actionCost ?? 0);
            const effect = formatTalentEffectSummary(getTalentEffectText(state, item), 26);
            return `<option value="${Number(item.talent_id)}" data-rank="${escapeHtml(item.rank)}" data-cost="${cost}" data-name="${escapeHtml(item.talent_name)}" data-effect="${escapeHtml(effect)}" ${owned ? 'disabled' : ''}>${escapeHtml(item.rank)} · ${escapeHtml(item.talent_name)} · 行动点 ${actionCost} · 效果 ${escapeHtml(effect || '无')}（${cost}碎片）${owned ? '（已拥有）' : ''}</option>`;
        });
    return options.length ? options.join('') : '<option value="">该池暂无可兑换 B/A/S 天赋</option>';
}

function renderTalentOptionLabel(talent) {
    if (!talent) return '空';
    return `${talent.talent_name}（${talent.rank} · ${formatTalentPoolLabel(talent.pool_key)}池）`;
}

function getTalentEffectText(state, talent) {
    if (!talent) return '';
    const poolItems = state.poolItems || [];
    const poolKey = String(talent.pool_key || talent.poolKey || '');
    const talentId = Number(talent.talent_id || talent.talentId || 0);
    const talentName = String(talent.talent_name || talent.talentName || '').trim();
    const rank = String(talent.rank || '').toUpperCase();
    const byId = poolItems.find(item =>
        item.pool_key === poolKey && Number(item.talent_id) === talentId
    );
    const byName = poolItems.find(item =>
        item.pool_key === poolKey &&
        String(item.talent_name || '').trim() === talentName &&
        String(item.rank || '').toUpperCase() === rank
    );
    return String(
        byId?.effect ||
        talent.effect ||
        byName?.effect ||
        ''
    ).trim();
}

function getCanonicalTalent(state, talent) {
    if (!talent) return talent;
    const poolKey = String(talent.pool_key || talent.poolKey || '');
    const talentId = Number(talent.talent_id || talent.talentId || 0);
    const canonical = (state.poolItems || []).find(item =>
        item.pool_key === poolKey && Number(item.talent_id) === talentId
    );
    return canonical ? { ...talent, talent_name: canonical.talent_name, rank: canonical.rank } : talent;
}

function formatTalentEffectSummary(effect, maxLength = 28) {
    const text = String(effect || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(1, maxLength - 1))}…`;
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

function getTalentCooldownText(state, talent) {
    if (!talent) return '';
    const direct = talent.cooldown ?? talent.cooldownText ?? talent.cooldown_text ?? talent.cooldownRounds;
    if (direct !== undefined && direct !== null && String(direct).trim() !== '') return String(direct).trim();
    const poolItem = (state.poolItems || []).find(item =>
        item.pool_key === talent.pool_key && Number(item.talent_id) === Number(talent.talent_id)
    );
    const value = poolItem?.cooldown ?? poolItem?.cooldownText ?? poolItem?.cooldown_text ?? poolItem?.cooldownRounds;
    return value === undefined || value === null ? '' : String(value).trim();
}

function getTalentDismantleGain(state, rank) {
    const normalizedRank = String(rank || '').toUpperCase();
    if (normalizedRank === 'S') return 500;
    if (normalizedRank === 'A') return 200;
    if (normalizedRank === 'B') return Number(state.bTalentFragmentGain || 10);
    if (normalizedRank === 'C') return Number(state.cTalentFragmentGain || 5);
    return 0;
}

function syncWarehouseBatchToolbar() {
    const selectedCount = talentWarehouseBatchSelections.size;
    const label = document.getElementById('talentWarehouseBatchLabel');
    if (label) label.textContent = selectedCount ? `已选 ${selectedCount} 个` : '批量分解';
    const batchButton = document.getElementById('talentWarehouseBatchButton');
    if (batchButton) batchButton.disabled = selectedCount === 0 || talentManageInFlight || talentWarehouseBatchInFlight;
    const clearButton = document.getElementById('talentWarehouseClearButton');
    if (clearButton) clearButton.disabled = selectedCount === 0 || talentManageInFlight || talentWarehouseBatchInFlight;
    const selectAllButton = document.getElementById('talentWarehouseSelectAllButton');
    if (selectAllButton) selectAllButton.disabled = talentManageInFlight || talentWarehouseBatchInFlight;
}

function clearWarehouseBatchSelection() {
    talentWarehouseBatchSelections.clear();
    syncWarehouseBatchToolbar();
}

function selectAllWarehouseTalents() {
    const selectableIds = (currentTalentState.ownedTalents || [])
        .filter(talent => talent.storage_slot && String(talent.rank || '').toUpperCase() !== 'S')
        .map(talent => Number(talent.id));
    talentWarehouseBatchSelections = new Set(selectableIds);
    syncWarehouseBatchToolbar();
    replaceTalentPoolPanel();
}

function toggleWarehouseTalentSelection(ownedTalentId, checked) {
    const talentId = Number(ownedTalentId);
    if (!talentId) return;
    if (checked) talentWarehouseBatchSelections.add(talentId);
    else talentWarehouseBatchSelections.delete(talentId);
    syncWarehouseBatchToolbar();
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

function formatTalentPercent(value) {
    const number = Math.max(0, Number(value) || 0) * 100;
    return `${Math.round(number * 10) / 10}%`;
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
    const regularSlots = `<div class="talent-equipped-grid">${Array.from({ length: limit }, (_, index) => {
        const slot = index + 1;
        const talent = byEquippedSlot.get(slot);
        const locked = slot > activeLimit;
        const requirement = getTalentSlotRequirement(state, slot);
        const slotLabel = getTalentSlotKindLabel(requirement.kind);
        const optionHtml = [
            '<option value="">卸下到仓库</option>',
            ...talents.filter(item => item.storage_slot || Number(item.s_slot || 0) > 0 || Number(item.id) === Number(talent?.id || 0)).map(item => {
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
    const exclusive = state.exclusiveTalentSlot || {};
    if (!exclusive.enabled) return regularSlots;
    const exclusiveTalent = exclusive.talent;
    const exclusiveBody = exclusiveTalent
        ? `<div class="talent-slot-name">${escapeHtml(exclusiveTalent.talentName || '未命名专属天赋')}（${escapeHtml(exclusiveTalent.rank || 'EX')}）</div>
           <div class="talent-slot-meta">专属天赋 · 行动点 ${Number(exclusiveTalent.actionCost || 0)} · 冷却 ${escapeHtml(exclusiveTalent.cooldown || '无')}</div>
           ${exclusiveTalent.effect ? `<div class="talent-effect-text">${escapeHtml(exclusiveTalent.effect)}</div>` : ''}`
        : renderMiniRitualEmpty('等待羔羊编辑并授予专属天赋。', god, '专属槽空置');
    const exclusiveCard = `<div class="talent-slot-card ${exclusiveTalent ? '' : 'empty'}">
        <div class="talent-slot-head"><span>专属槽</span><span>已开启</span></div>
        ${exclusiveBody}
    </div>`;
    return `${regularSlots}<div class="talent-equipped-grid">${exclusiveCard}</div>`;
}

function renderTalentWarehouse(state, god = getProfileFaithGod(getCurrentProfile()) || '命运') {
    const talents = state.ownedTalents || [];
    const byStorageSlot = new Map(talents.filter(t => t.storage_slot).map(t => [Number(t.storage_slot), t]));
    const limit = Number(state.inventorySlotLimit || 10);
    const selectableCount = talents.filter(t => t.storage_slot).length;
    return `
        <div class="talent-warehouse-toolbar">
            <div class="talent-warehouse-batch-note">勾选多个仓库天赋后可一次性分解，避免逐个处理。</div>
            <div class="talent-warehouse-batch-actions">
                <button type="button" class="btn btn-outline btn-sm" id="talentWarehouseSelectAllButton" onclick="selectAllWarehouseTalents()" ${talentManageInFlight || talentWarehouseBatchInFlight || !selectableCount ? 'disabled' : ''}>全选</button>
                <button type="button" class="btn btn-outline btn-sm" id="talentWarehouseClearButton" onclick="clearWarehouseBatchSelection()" ${talentManageInFlight || talentWarehouseBatchInFlight || !talentWarehouseBatchSelections.size ? 'disabled' : ''}>清空</button>
                <button type="button" class="btn btn-primary btn-sm" id="talentWarehouseBatchButton" onclick="discardWarehouseTalentsUI()" ${talentManageInFlight || talentWarehouseBatchInFlight || !talentWarehouseBatchSelections.size ? 'disabled' : ''}>${talentWarehouseBatchSelections.size ? `批量分解 ${talentWarehouseBatchSelections.size} 个` : '批量分解'}</button>
            </div>
        </div>
        <div class="talent-inventory-grid">${Array.from({ length: limit }, (_, index) => {
        const slot = index + 1;
        const talent = getCanonicalTalent(state, byStorageSlot.get(slot));
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
        return `
            <div class="talent-slot-card">
                <div class="talent-slot-head"><span>仓库位 ${slot}</span><span>未佩戴</span></div>
                <label class="talent-slot-select">
                    <input type="checkbox" ${talentWarehouseBatchSelections.has(Number(talent.id)) ? 'checked' : ''} ${talentManageInFlight || talentWarehouseBatchInFlight ? 'disabled' : ''} onchange="toggleWarehouseTalentSelection(${Number(talent.id)}, this.checked)">
                    <span>批量分解</span>
                </label>
                <div class="talent-slot-name">${escapeHtml(talent.talent_name)}</div>
                <div class="talent-slot-meta">${escapeHtml(talent.rank)}级 · ${escapeHtml(formatTalentPoolLabel(talent.pool_key))}池 · 行动点 ${actionCost}</div>
                ${effect ? `<div class="talent-effect-text">${escapeHtml(effect)}</div>` : ''}
                <div class="talent-slot-actions">
                    <button type="button" class="btn btn-outline btn-sm" onclick="discardOwnedTalentUI(${Number(talent.id)})" ${talentManageInFlight ? 'disabled' : ''}>${talentManageInFlight ? '处理中' : `分解 +${fragmentGain}`}</button>
                </div>
            </div>`;
    }).join('')}</div>`;
}

function renderSTalentWarehouse(state, god = getProfileFaithGod(getCurrentProfile()) || '命运') {
    const talents = state.ownedTalents || [];
    const bySlot = new Map(talents.filter(t => String(t.rank || '').toUpperCase() === 'S' && Number(t.s_slot || 0) > 0).map(t => [Number(t.s_slot), t]));
    const limit = Number(state.sTalentWarehouseSlotLimit || 5);
    return `
        <div class="profile-panel-title" style="margin-top:16px;"><span>S级天赋仓库</span><small>${bySlot.size}/${limit} 个槽位</small></div>
        <div class="talent-inventory-grid">${Array.from({ length: limit }, (_, index) => {
        const slot = index + 1;
        const talent = getCanonicalTalent(state, bySlot.get(slot));
        if (!talent) {
            return `
                <div class="talent-slot-card empty">
                    <div class="talent-slot-head"><span>S仓库位 ${slot}</span><span>空</span></div>
                    ${renderMiniRitualEmpty('S级天赋抽取或兑换后进入这里，可佩戴到普通携带槽。', god, 'S仓库空置')}
                </div>`;
        }
        const effect = getTalentEffectText(state, talent);
        const actionCost = getTalentActionCost(state, talent);
        const fragmentGain = getTalentDismantleGain(state, talent.rank);
        return `
            <div class="talent-slot-card">
                <div class="talent-slot-head"><span>S仓库位 ${slot}</span><span>${talent.equipped_slot ? `携带槽 ${Number(talent.equipped_slot)}` : '未佩戴'}</span></div>
                <div class="talent-slot-name">${escapeHtml(talent.talent_name)}</div>
                <div class="talent-slot-meta">S级 · ${escapeHtml(formatTalentPoolLabel(talent.pool_key))}池 · 行动点 ${actionCost}</div>
                ${effect ? `<div class="talent-effect-text">${escapeHtml(effect)}</div>` : ''}
                <div class="talent-slot-actions">
                    <button type="button" class="btn btn-outline btn-sm" onclick="discardOwnedTalentUI(${Number(talent.id)})" ${talentManageInFlight ? 'disabled' : ''}>${talentManageInFlight ? '处理中' : `分解 +${fragmentGain}`}</button>
                </div>
            </div>`;
    }).join('')}</div>`;
}

function renderOverflowChoices(state) {
    const choices = state.overflowChoices || [];
    if (!choices.length) return '';
    const replacementOptions = (state.ownedTalents || [])
        .filter(talent => talent.storage_slot || Number(talent.s_slot || 0) > 0)
        .map(talent => `<option value="${Number(talent.id)}">${Number(talent.s_slot || 0) > 0 ? `S仓库${Number(talent.s_slot || 0)}` : `仓库${Number(talent.storage_slot || 0)}`} · ${escapeHtml(renderTalentOptionLabel(talent))}</option>`)
        .join('');
    return `
        <div class="profile-panel-title" style="margin-top:16px;"><span>待取舍天赋</span><small>${choices.length} 个溢出</small></div>
        <div class="talent-overflow-list">${choices.map(choice => {
            const id = Number(choice.id);
            const actionCost = getTalentActionCost(state, choice);
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
                        <button type="button" class="btn btn-outline btn-sm" onclick="resolveTalentOverflowUI(${id}, 'discard')" ${talentManageInFlight ? 'disabled' : ''}>${talentManageInFlight ? '处理中' : `分解新天赋 +${getTalentDismantleGain(state, choice.rank)}`}</button>
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
    const sWarehouseCount = Number(state.sTalentWarehouseCount || (state.ownedTalents || []).filter(talent => String(talent.rank || '').toUpperCase() === 'S' && Number(talent.s_slot || 0) > 0).length);
    const sWarehouseLimit = Number(state.sTalentWarehouseSlotLimit || 5);
    const equippedCount = (state.ownedTalents || []).filter(talent => talent.equipped_slot).length;
    const exchangeCost = Number(state.targetTalentExchangeCost || 180);
    const aExchangeCost = Number(state.aTalentExchangeCost || 260);
    const sExchangeCost = Number(state.sTalentExchangeCost || 800);
    const basicAvailableDraws = Number(state.basicAvailableDraws || 0);
    const advancedAvailableDraws = Number(state.advancedAvailableDraws || 0);
    const bRate = Number(state.advancedBTalentDrawRate || 0.25);
    const aRate = Number(state.aTalentDrawRate || 0.02);
    const sRate = Number(state.sTalentDrawRate || 0.001);
    const cRate = Math.max(0, 1 - sRate - aRate - bRate);
    const probabilityText = `S ${formatTalentPercent(sRate)} / A ${formatTalentPercent(aRate)} / B ${formatTalentPercent(bRate)} / C ${formatTalentPercent(cRate)}`;
    const guaranteeDraws = Number(state.bTalentGuaranteeDraws || 10);
    const sGuaranteeDraws = Number(state.sTalentGuaranteeDraws || 60);
    const currentMisses = Math.min(guaranteeDraws - 1, getTalentPoolCounter(state, selectedPool));
    const sCounter = Number((state.counters || []).find(counter => counter.pool_key === selectedPool)?.s_continue_draw || 0);
    return `
        <section class="profile-panel" id="talentPoolPanel" data-god="${escapeHtml(profileGod)}" style="${profileGodStyle}">
            <div class="profile-panel-title">
                <span>${escapeHtml(selectedPoolTitle)}</span>
            </div>
            <div class="talent-pool-card" data-god="${escapeHtml(profileGod)}" style="${profileGodStyle}">
                <div class="metric-strip">
                    <span class="metric-pill">累计获得抽数 <strong>${Number(state.totalDrawsEarned || 0)}</strong></span>
                    <span class="metric-pill">已用抽数 <strong>${Number(state.spentDraws || 0)}</strong></span>
                    <span class="metric-pill">天赋碎片 <strong>${Number(state.fragmentTotal || 0)}</strong></span>
                    <span class="metric-pill">基础抽 <strong>${basicAvailableDraws}</strong></span>
                    <span class="metric-pill">进阶抽 <strong>${advancedAvailableDraws}</strong></span>
                    <span class="metric-pill">B级保底 <strong>${currentMisses}/${guaranteeDraws - 1}</strong></span>
                    <span class="metric-pill">S级保底 <strong>${Math.min(sGuaranteeDraws - 1, sCounter)}/${sGuaranteeDraws - 1}</strong></span>
                    <span class="metric-pill">仓库 <strong>${inventoryCount}/${inventoryLimit}</strong></span>
                    <span class="metric-pill">S仓库 <strong>${sWarehouseCount}/${sWarehouseLimit}</strong></span>
                    <span class="metric-pill">携带 <strong>${equippedCount}/${Number(state.equippedSlotLimit || 3)}</strong></span>
                    <span class="metric-pill">可选池 <strong>${escapeHtml(allowedPoolText)}</strong></span>
                </div>
                <div class="talent-rule-strip">
                    <span>S/A/B/C 概率：<strong>${escapeHtml(probabilityText)}</strong></span>
                    <span>A/B/C/S 分解：<strong>+200 / +${Number(state.bTalentFragmentGain || 10)} / +${Number(state.cTalentFragmentGain || 5)} / +500</strong> 碎片</span>
                    <span>携带上限：<strong>${escapeHtml(renderTalentSlotRuleText(state))}</strong></span>
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
            ${renderSTalentWarehouse(state, profileGod)}
            ${renderOverflowChoices(state)}
            <div class="profile-panel-title" style="margin-top:16px;"><span>天赋仓库</span><small>${inventoryCount}/${inventoryLimit} 个槽位</small></div>
            ${renderTalentWarehouse(state, profileGod)}
            <div class="talent-exchange-row">
                <select id="talentExchangeSelect">${renderTalentExchangeOptions(state, selectedPool)}</select>
                <button type="button" class="btn btn-outline btn-sm" onclick="exchangeTalentUI()" ${!selectedPoolReady ? 'disabled' : ''}>B${exchangeCost} / A${aExchangeCost} / S${sExchangeCost} 碎片赎取</button>
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
    clearWarehouseBatchSelection();
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
    clearWarehouseBatchSelection();
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
        .map(talent => {
            const canonical = getCanonicalTalent(state, talent);
            const actionCost = getTalentActionCost(state, canonical);
            const cooldown = getTalentCooldownText(state, canonical);
            return {
                slot: Number(canonical.equipped_slot || 0),
                name: String(canonical.talent_name || ''),
                rank: String(canonical.rank || ''),
                pool: formatTalentPoolLabel(canonical.pool_key),
                actionCost,
                cooldown,
                effect: getTalentEffectText(state, canonical),
            };
        });
    const exclusiveTalent = state.exclusiveTalentSlot?.enabled && state.exclusiveTalentSlot?.talent
        ? state.exclusiveTalentSlot.talent
        : null;
    if (exclusiveTalent) {
        equippedTalents.push({
            slot: '专属',
            name: String(exclusiveTalent.talentName || ''),
            rank: String(exclusiveTalent.rank || ''),
            pool: '专属',
            actionCost: Number(exclusiveTalent.actionCost || 0),
            cooldown: String(exclusiveTalent.cooldown || '无'),
            effect: String(exclusiveTalent.effect || ''),
        });
    }
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
            currentHp: Number(profile.currentHp ?? profile.current_hp ?? healthSummary.maxHp ?? 0),
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

/* ===== 导出档案图 v4「圣所档案」· 辅助绘制函数 ===== */
function gtSeededRandom(seed) {
    let s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function gtHexA(color, a) {
    if (typeof color !== 'string') return color;
    const m = color.match(/^#([0-9a-fA-F]{6})$/);
    if (!m) return color;
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function gtRankColor(rank) {
    const r = String(rank || '').toUpperCase();
    if (!r) return null;
    if (r.includes('EX') || r.includes('专')) return '#f5e3a8';
    if (r.includes('S')) return '#f0b25c';
    if (r.includes('A')) return '#8b7bd8';
    if (r.includes('B')) return '#c49254';
    if (r.includes('C')) return '#96a8bc';
    return null;
}

function gtHairline(ctx, x1, y, x2, color, alpha = 0.5, lineWidth = 2) {
    const g = ctx.createLinearGradient(x1, 0, x2, 0);
    g.addColorStop(0, gtHexA(color, 0));
    g.addColorStop(0.5, gtHexA(color, alpha));
    g.addColorStop(1, gtHexA(color, 0));
    ctx.save();
    ctx.strokeStyle = g;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    ctx.restore();
}

function gtDiamond(ctx, cx, cy, size, color, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.restore();
}

function gtStarfield(ctx, w, h, main, accent, seed) {
    const rnd = gtSeededRandom(seed);
    for (let i = 0; i < 180; i++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = rnd() * 1.5 + 0.3;
        ctx.save();
        ctx.globalAlpha = 0.10 + rnd() * 0.45;
        ctx.fillStyle = rnd() < 0.16 ? '#ffffff' : (rnd() < 0.5 ? main : accent);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    for (let i = 0; i < 16; i++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = 1.4 + rnd() * 1.8;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 7);
        g.addColorStop(0, 'rgba(255,255,255,0.42)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r * 7, 0, Math.PI * 2);
        ctx.fill();
    }
}

function gtCornerOrnaments(ctx, x, y, w, h, size, color) {
    const corners = [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]];
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.85;
    for (const [cx, cy, sx, sy] of corners) {
        ctx.beginPath();
        ctx.moveTo(cx + sx * size, cy);
        ctx.lineTo(cx + sx * 16, cy);
        ctx.quadraticCurveTo(cx, cy, cx, cy + sy * 16);
        ctx.lineTo(cx, cy + sy * size);
        ctx.stroke();
    }
    ctx.restore();
}

function gtSectionHeading(ctx, text, x, y, color, ruleEnd) {
    gtDiamond(ctx, x + 9, y - 10, 13, color, 0.95);
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = '900 30px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(text, x + 30, y);
    const tw = ctx.measureText(text).width;
    ctx.restore();
    const startX = x + 30 + tw + 22;
    if (startX < ruleEnd) gtHairline(ctx, startX, y - 10, ruleEnd, color, 0.42, 2);
}

function gtCardShell(ctx, x, y, w, h, r, borderColor, fillA, fillB, leftColor) {
    drawRoundRect(ctx, x, y, w, h, r);
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, fillA);
    g.addColorStop(1, fillB);
    ctx.fillStyle = g;
    ctx.fill();
    if (leftColor) {
        ctx.save();
        drawRoundRect(ctx, x, y, w, h, r);
        ctx.clip();
        const lg = ctx.createLinearGradient(x, y, x + 40, y);
        lg.addColorStop(0, gtHexA(leftColor, 0.9));
        lg.addColorStop(1, gtHexA(leftColor, 0));
        ctx.fillStyle = lg;
        ctx.fillRect(x, y, 40, h);
        ctx.restore();
    }
    ctx.save();
    drawRoundRect(ctx, x, y, w, h, r);
    ctx.clip();
    const hg = ctx.createLinearGradient(x, 0, x + w, 0);
    hg.addColorStop(0, 'rgba(255,255,255,0)');
    hg.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(x, y, w, 2);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = borderColor;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.5;
    drawRoundRect(ctx, x, y, w, h, r);
    ctx.stroke();
    ctx.restore();
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
    const itemEntries = Array.isArray(payload.items) && payload.items.length ? payload.items : ['无'];
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
    const talentLayouts = talents.map(talent => {
        measureCtx.font = '900 34px "Microsoft YaHei", sans-serif';
        const name = `${talent.name}${talent.rank ? `（${talent.rank}）` : ''}`;
        const nameLines = wrapCanvasText(measureCtx, name, 880, Infinity);
        measureCtx.font = '600 22px "Microsoft YaHei", sans-serif';
        const meta = [talent.pool ? `${talent.pool}池` : '', talent.effect || ''].filter(Boolean).join(' · ');
        const actionText = Number.isFinite(Number(talent.actionCost)) ? `行动点 ${Number(talent.actionCost) || 0}` : '';
        const cooldownText = `冷却 ${talent.cooldown || '无'}`;
        const metaWithTiming = [talent.pool ? `${talent.pool}池` : '', actionText, cooldownText, talent.effect || ''].filter(Boolean).join(' · ');
        const metaLines = wrapCanvasText(measureCtx, metaWithTiming || meta, 880, Infinity);
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

    /* --- 底色：深邃星域渐变 --- */
    const bg = ctx.createLinearGradient(0, 0, width * 0.4, height);
    bg.addColorStop(0, '#070810');
    bg.addColorStop(0.46, '#10131f');
    bg.addColorStop(1, '#06060a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    /* --- 神性辉光：左上主色 + 右下副色 --- */
    const glowTL = ctx.createRadialGradient(200, 150, 0, 200, 150, 980);
    glowTL.addColorStop(0, gtHexA(main, 0.20));
    glowTL.addColorStop(0.5, gtHexA(main, 0.05));
    glowTL.addColorStop(1, gtHexA(main, 0));
    ctx.fillStyle = glowTL;
    ctx.fillRect(0, 0, width, height);

    const glowBR = ctx.createRadialGradient(width - 210, height - 300, 0, width - 210, height - 300, 1100);
    glowBR.addColorStop(0, gtHexA(accent, 0.16));
    glowBR.addColorStop(0.55, gtHexA(accent, 0.04));
    glowBR.addColorStop(1, gtHexA(accent, 0));
    ctx.fillStyle = glowBR;
    ctx.fillRect(0, 0, width, height);

    /* --- 斜向细纹 --- */
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = main;
    ctx.lineWidth = 2;
    for (let x = -height; x < width; x += 76) {
        ctx.beginPath();
        ctx.moveTo(x, height);
        ctx.lineTo(x + height, 0);
        ctx.stroke();
    }
    ctx.restore();

    /* --- 星尘粒子 --- */
    gtStarfield(ctx, width, height, main, accent, 20260918);

    /* --- 背景水印 --- */
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-Math.PI / 7);
    ctx.font = '900 118px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(231,207,138,0.04)';
    ctx.textAlign = 'center';
    for (let y = -760; y <= 760; y += 260) {
        for (let x = -760; x <= 760; x += 680) {
            ctx.fillText('诸神愚戏', x, y);
        }
    }
    ctx.restore();

    /* --- 主框体：暗底 + 常显金框 + 内边框 + 四角纹饰 --- */
    drawRoundRect(ctx, 62, 62, width - 124, height - 124, 28);
    const frameFill = ctx.createLinearGradient(0, 62, 0, height - 62);
    frameFill.addColorStop(0, 'rgba(14,16,25,0.86)');
    frameFill.addColorStop(1, 'rgba(10,11,18,0.90)');
    ctx.fillStyle = frameFill;
    ctx.fill();
    ctx.save();
    ctx.strokeStyle = main;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
    const inset = 20;
    ctx.save();
    ctx.strokeStyle = gtHexA(main, 0.30);
    ctx.lineWidth = 1;
    drawRoundRect(ctx, 62 + inset, 62 + inset, width - 124 - inset * 2, height - 124 - inset * 2, 20);
    ctx.stroke();
    ctx.restore();
    gtCornerOrnaments(ctx, 62 + inset, 62 + inset, width - 124 - inset * 2, height - 124 - inset * 2, 46, gtHexA(main, 0.9));

    /* --- 顶部标题 + 圣辉分隔线 --- */
    gtDiamond(ctx, 112, 128, 15, main, 0.95);
    ctx.fillStyle = main;
    ctx.font = '900 34px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('诸神愚戏 · 信徒档案', 132, 138);
    ctx.fillStyle = 'rgba(234,234,242,0.58)';
    ctx.font = '600 22px "Microsoft YaHei", sans-serif';
    ctx.fillText(`导出时间 ${formatDate(payload.exportedAt.toISOString())}`, 132, 178);

    /* --- 信仰之神徽记章 --- */
    const mx = width - 176;
    const my = 152;
    const mr = 58;
    const mg = ctx.createRadialGradient(mx, my, mr * 0.3, mx, my, mr * 1.8);
    mg.addColorStop(0, gtHexA(main, 0.5));
    mg.addColorStop(1, gtHexA(main, 0));
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mx, my, mr * 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    const dg = ctx.createLinearGradient(mx - mr, my - mr, mx + mr, my + mr);
    dg.addColorStop(0, 'rgba(22,24,36,0.96)');
    dg.addColorStop(1, 'rgba(11,12,20,0.96)');
    ctx.fillStyle = dg;
    ctx.fill();
    ctx.save();
    ctx.strokeStyle = gtHexA(main, 0.85);
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = gtHexA(main, 0.32);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(mx, my, mr - 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = gtHexA(main, 0.75);
    ctx.shadowBlur = 16;
    ctx.fillStyle = gtHexA(main, 0.97);
    ctx.font = '900 58px "Microsoft YaHei", sans-serif';
    ctx.fillText(getGodIcon(payload.faithGod) || '✦', mx, my + 2);
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(234,234,242,0.74)';
    ctx.font = '700 22px "Microsoft YaHei", sans-serif';
    ctx.fillText(`${payload.faithGod} · ${skin.motif || '命途'}`, mx, my + mr + 32);
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    /* --- 圣辉分隔线 --- */
    gtHairline(ctx, 96, 214, width - 96, main, 0.55, 2);

    /* --- 名讳 --- */
    ctx.save();
    ctx.shadowColor = gtHexA(main, 0.35);
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#f6f2e2';
    ctx.font = '900 72px "Microsoft YaHei", sans-serif';
    ctx.fillText(payload.displayName, 108, 300);
    ctx.restore();
    const nameWidth = ctx.measureText(payload.displayName).width;
    ctx.save();
    const ng = ctx.createLinearGradient(108, 0, 108 + Math.max(nameWidth, 240), 0);
    ng.addColorStop(0, gtHexA(main, 0.9));
    ng.addColorStop(1, gtHexA(main, 0));
    ctx.strokeStyle = ng;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(108, 318);
    ctx.lineTo(108 + Math.max(nameWidth, 240), 318);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(234,234,242,0.78)';
    ctx.font = '700 30px "Microsoft YaHei", sans-serif';
    const professionLine = payload.professionClass
        ? `职业：${payload.professionClass} · ${payload.profession}`
        : `职业：${payload.profession}`;
    ctx.fillText(professionLine, 112, 356);

    /* --- 双榜评分卡 --- */
    const scoreCards = [
        ['登神之路', String(payload.ascensionScore)],
        ['觐见之梯', String(payload.audienceScore)],
    ];
    scoreCards.forEach(([label, value], index) => {
        const x = 108 + index * 500;
        const cc = index ? accent : main;
        drawRoundRect(ctx, x, 396, 440, 130, 18);
        const sg = ctx.createLinearGradient(x, 396, x, 526);
        sg.addColorStop(0, index ? 'rgba(127,140,255,0.16)' : 'rgba(213,167,66,0.17)');
        sg.addColorStop(1, 'rgba(255,255,255,0.02)');
        ctx.fillStyle = sg;
        ctx.fill();
        ctx.save();
        drawRoundRect(ctx, x, 396, 440, 130, 18);
        ctx.clip();
        const bar = ctx.createLinearGradient(x, 0, x + 40, 0);
        bar.addColorStop(0, gtHexA(cc, 0.85));
        bar.addColorStop(1, gtHexA(cc, 0));
        ctx.fillStyle = bar;
        ctx.fillRect(x, 396, 40, 130);
        const hg = ctx.createLinearGradient(x, 0, x + 440, 0);
        hg.addColorStop(0, 'rgba(255,255,255,0)');
        hg.addColorStop(0.5, 'rgba(255,255,255,0.14)');
        hg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hg;
        ctx.fillRect(x, 396, 440, 2);
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = cc;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.5;
        drawRoundRect(ctx, x, 396, 440, 130, 18);
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = 'rgba(234,234,242,0.66)';
        ctx.font = '700 24px "Microsoft YaHei", sans-serif';
        ctx.fillText(label, x + 30, 440);
        ctx.save();
        ctx.shadowColor = gtHexA(cc, 0.6);
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#f6f2e2';
        ctx.font = '900 48px "Microsoft YaHei", sans-serif';
        ctx.fillText(value, x + 30, 496);
        ctx.restore();
    });

    /* --- 战斗面板 --- */
    gtSectionHeading(ctx, '战斗面板', 108, 596, main, width - 108);
    drawRoundRect(ctx, 108, battleTop, 310, battleHeight, 20);
    const hpFill = ctx.createLinearGradient(108, battleTop, 108, battleTop + battleHeight);
    hpFill.addColorStop(0, 'rgba(213,167,66,0.16)');
    hpFill.addColorStop(1, 'rgba(213,167,66,0.03)');
    ctx.fillStyle = hpFill;
    ctx.fill();
    ctx.save();
    ctx.strokeStyle = main;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    ctx.save();
    drawRoundRect(ctx, 108, battleTop, 310, battleHeight, 20);
    ctx.clip();
    const hpBar = ctx.createLinearGradient(108, 0, 148, 0);
    hpBar.addColorStop(0, gtHexA(main, 0.85));
    hpBar.addColorStop(1, gtHexA(main, 0));
    ctx.fillStyle = hpBar;
    ctx.fillRect(108, battleTop, 40, battleHeight);
    ctx.restore();
    ctx.fillStyle = 'rgba(234,234,242,0.62)';
    ctx.font = '800 24px "Microsoft YaHei", sans-serif';
    ctx.fillText('当前血量', 136, battleTop + 44);
    ctx.save();
    ctx.shadowColor = gtHexA(main, 0.6);
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#f6f2e2';
    ctx.font = '900 70px "Microsoft YaHei", sans-serif';
    const currentHpText = Number.isFinite(Number(payload.health.currentHp)) ? String(Number(payload.health.currentHp)) : '未定';
    ctx.fillText(currentHpText, 136, battleTop + 122);
    ctx.restore();

    drawRoundRect(ctx, 444, battleTop, 648, battleHeight, 20);
    const tpFill = ctx.createLinearGradient(444, battleTop, 444, battleTop + battleHeight);
    tpFill.addColorStop(0, 'rgba(255,255,255,0.06)');
    tpFill.addColorStop(1, 'rgba(255,255,255,0.015)');
    ctx.fillStyle = tpFill;
    ctx.fill();
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    ctx.save();
    drawRoundRect(ctx, 444, battleTop, 648, battleHeight, 20);
    ctx.clip();
    const tBar = ctx.createLinearGradient(444, 0, 484, 0);
    tBar.addColorStop(0, gtHexA(accent, 0.7));
    tBar.addColorStop(1, gtHexA(accent, 0));
    ctx.fillStyle = tBar;
    ctx.fillRect(444, battleTop, 40, battleHeight);
    ctx.restore();
    gtDiamond(ctx, 490, battleTop + 36, 11, accent, 0.9);
    ctx.fillStyle = gtHexA(main, 0.9);
    ctx.font = '800 24px "Microsoft YaHei", sans-serif';
    ctx.fillText(`${payload.faithGod}之神 · 信仰特性`, 504, battleTop + 44);
    ctx.fillStyle = 'rgba(244,240,223,0.84)';
    ctx.font = '600 23px "Microsoft YaHei", sans-serif';
    faithTraitLines.forEach((line, index) => {
        ctx.fillText(line, 504, battleTop + 88 + index * 31);
    });
    const professionTraitTitleY = battleTop + 104 + faithTraitLines.length * 31;
    gtDiamond(ctx, 490, professionTraitTitleY - 8, 11, main, 0.9);
    ctx.fillStyle = gtHexA(main, 0.9);
    ctx.font = '800 24px "Microsoft YaHei", sans-serif';
    const classLabel = payload.professionClass || '职业';
    ctx.fillText(`${classLabel} · 职业特性`, 504, professionTraitTitleY);
    ctx.fillStyle = 'rgba(244,240,223,0.84)';
    ctx.font = '600 23px "Microsoft YaHei", sans-serif';
    professionTraitLines.forEach((line, index) => {
        ctx.fillText(line, 504, professionTraitTitleY + 44 + index * 31);
    });

    /* --- 已佩戴称号 --- */
    gtSectionHeading(ctx, '已佩戴称号', 108, titlesHeadingY, main, width - 108);
    titleLines.forEach((line, index) => {
        ctx.fillStyle = index ? 'rgba(244,240,223,0.72)' : '#f6f2e2';
        ctx.font = '800 34px "Microsoft YaHei", sans-serif';
        ctx.fillText(line, 108, titleStartY + index * 44);
    });

    /* --- 个人道具 --- */
    gtSectionHeading(ctx, '个人道具', 108, itemsHeadingY, main, width - 108);
    let itemY = firstItemY;
    itemLayouts.forEach((layout, index) => {
        const y = itemY;
        const cc = index % 2 ? accent : main;
        gtCardShell(ctx, 108, y, 984, layout.cardHeight, 16, gtHexA(cc, 0.4), 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.015)', cc);
        gtDiamond(ctx, 142, y + 40, 11, gtHexA(cc, 0.95), 1);
        ctx.fillStyle = '#f6f2e2';
        ctx.font = '700 28px "Microsoft YaHei", sans-serif';
        layout.lines.forEach((line, lineIndex) => {
            ctx.fillText(line, 166, y + 48 + lineIndex * 34);
        });
        itemY += layout.cardHeight + 14;
    });

    /* --- 现存诅咒 --- */
    gtSectionHeading(ctx, '现存诅咒', 108, curseHeadingY, '#d98d8d', width - 108);
    let curseY = curseStartY;
    curseLayouts.forEach((layout, index) => {
        const { curse, nameLines, effectLines, cardHeight } = layout;
        const y = curseY;
        const curseGod = curse.god || payload.faithGod || '命运';
        const curseSkin = getGodSkin(curseGod);
        const curseAccent = curse.empty ? main : (curseSkin.primary || '#b84545');
        gtCardShell(ctx, 108, y, 984, cardHeight, 18, gtHexA(curseAccent, curse.empty ? 0.28 : 0.5),
            curse.empty ? 'rgba(255,255,255,0.04)' : 'rgba(80,15,22,0.22)',
            curse.empty ? 'rgba(255,255,255,0.012)' : 'rgba(80,15,22,0.06)', curseAccent);
        ctx.fillStyle = curse.empty ? 'rgba(231,207,138,0.76)' : 'rgba(217,141,141,0.92)';
        ctx.font = '800 24px "Microsoft YaHei", sans-serif';
        const curseTypeLabel = getProfileCurseTypeLabel(curse.type || curse.curseType);
        ctx.fillText(curse.empty ? '诅咒状态' : `${curseGod} · ${curseTypeLabel}`, 166, y + 38);
        ctx.fillStyle = '#f6f2e2';
        ctx.font = '900 32px "Microsoft YaHei", sans-serif';
        nameLines.forEach((line, lineIndex) => {
            ctx.fillText(line, 166, y + 76 + lineIndex * 36);
        });
        ctx.fillStyle = 'rgba(234,234,242,0.68)';
        ctx.font = '600 22px "Microsoft YaHei", sans-serif';
        const effectStartY = y + 100 + nameLines.length * 36;
        effectLines.forEach((line, lineIndex) => {
            ctx.fillText(line, 166, effectStartY + lineIndex * 29);
        });
        curseY += cardHeight + 18;
    });

    /* --- 携带天赋 --- */
    gtSectionHeading(ctx, '携带天赋', 108, talentsHeadingY, main, width - 108);
    let talentY = firstTalentY;
    talentLayouts.forEach((layout, index) => {
        const { talent, nameLines, metaLines, cardHeight } = layout;
        const y = talentY;
        const rankColor = gtRankColor(talent.rank);
        const cc = rankColor || (index % 2 ? accent : main);
        gtCardShell(ctx, 108, y, 984, cardHeight, 18, gtHexA(cc, rankColor ? 0.72 : 0.4),
            'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.015)', cc);
        if (rankColor) {
            ctx.save();
            const badgeGrad = ctx.createLinearGradient(108, y, 108, y + cardHeight);
            badgeGrad.addColorStop(0, gtHexA(rankColor, 0.95));
            badgeGrad.addColorStop(1, gtHexA(rankColor, 0.5));
            ctx.fillStyle = badgeGrad;
            ctx.fillRect(108, y, 6, cardHeight);
            ctx.restore();
        }
        ctx.fillStyle = 'rgba(231,207,138,0.86)';
        ctx.font = '800 24px "Microsoft YaHei", sans-serif';
        ctx.fillText(talent.slot ? `携带槽 ${talent.slot}` : '携带槽', 166, y + 38);
        ctx.fillStyle = '#f6f2e2';
        ctx.font = '900 34px "Microsoft YaHei", sans-serif';
        nameLines.forEach((line, lineIndex) => {
            ctx.fillText(line, 166, y + 78 + lineIndex * 38);
        });
        ctx.fillStyle = 'rgba(234,234,242,0.64)';
        ctx.font = '600 22px "Microsoft YaHei", sans-serif';
        const metaStartY = y + 104 + nameLines.length * 38;
        metaLines.forEach((line, lineIndex) => {
            ctx.fillText(line, 166, metaStartY + lineIndex * 29);
        });
        if (talent.rank) {
            ctx.font = '900 24px "Microsoft YaHei", sans-serif';
            const label = String(talent.rank);
            const cw = ctx.measureText(label).width + 36;
            const cx = 108 + 984 - 26 - cw;
            const cy = y + 18;
            drawRoundRect(ctx, cx, cy, cw, 38, 19);
            const chipGrad = ctx.createLinearGradient(cx, cy, cx, cy + 38);
            chipGrad.addColorStop(0, gtHexA(cc, 0.98));
            chipGrad.addColorStop(1, gtHexA(cc, 0.7));
            ctx.fillStyle = chipGrad;
            ctx.fill();
            ctx.save();
            ctx.strokeStyle = gtHexA('#ffffff', 0.5);
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
            ctx.fillStyle = '#101018';
            ctx.textAlign = 'center';
            ctx.fillText(label, cx + cw / 2, cy + 27);
            ctx.textAlign = 'left';
        }
        talentY += cardHeight + 22;
    });

    /* --- 页脚 --- */
    gtHairline(ctx, 96, height - 176, width - 96, main, 0.4, 2);
    gtDiamond(ctx, width / 2, height - 176, 12, main, 0.9);
    ctx.fillStyle = 'rgba(234,234,242,0.48)';
    ctx.font = '600 22px "Microsoft YaHei", sans-serif';
    ctx.fillText('由诸神愚戏副本论坛生成 · 仅作玩家档案展示', 108, height - 128);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(231,207,138,0.72)';
    ctx.font = '900 28px "Microsoft YaHei", sans-serif';
    ctx.fillText('诸神愚戏', width - 108, height - 128);
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
    if (!targetTalentId) { showToast('请选择可兑换的 B/A/S 级天赋'); return; }
    const selectedOption = exchangeSelect?.selectedOptions?.[0];
    const optionRank = selectedOption?.dataset?.rank || '';
    const optionName = selectedOption?.dataset?.name || selectedOption?.textContent || '该天赋';
    const optionCost = Number(selectedOption?.dataset?.cost || 0);
    const optionEffect = selectedOption?.dataset?.effect || '';
    const confirmText = optionCost > 0
        ? `确定消耗 ${optionCost} 碎片兑换 ${optionRank}级天赋「${optionName}」吗？${optionEffect ? `\n效果：${optionEffect}` : ''}`
        : `确定兑换天赋「${optionName}」吗？`;
    if (!await gtConfirm(confirmText)) return;
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
    if (!await gtConfirm('确定分解这个仓库天赋并获得碎片吗？')) return;
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

async function discardWarehouseTalentsUI() {
    if (!inviteSession?.code) { openInviteModal('先验入局谕令后可整理仓库。'); return; }
    if (talentManageInFlight || talentWarehouseBatchInFlight) { showToast('天赋正在处理中，请勿重复点击'); return; }
    const selectedIds = (currentTalentState.ownedTalents || [])
        .filter(talent => talent.storage_slot && String(talent.rank || '').toUpperCase() !== 'S' && talentWarehouseBatchSelections.has(Number(talent.id)))
        .map(talent => Number(talent.id));
    if (!selectedIds.length) { showToast('先勾选要分解的仓库天赋'); return; }
    const previewCount = selectedIds.length;
    const previewGain = (currentTalentState.ownedTalents || [])
        .filter(talent => selectedIds.includes(Number(talent.id)))
        .reduce((sum, talent) => sum + getTalentDismantleGain(currentTalentState, talent.rank), 0);
    if (!await gtConfirm(`确定批量分解这 ${previewCount} 个仓库天赋吗？预计获得 ${previewGain} 碎片。`)) return;

    talentWarehouseBatchInFlight = true;
    talentManageInFlight = true;
    const inviteSnapshot = getInviteSnapshot();
    replaceTalentPoolPanel();
    try {
        let lastData = null;
        let totalGain = 0;
        for (const ownedTalentId of selectedIds) {
            const { data, error } = await invokeDungeonAction('discardOwnedTalent', { ownedTalentId });
            if (!isInviteSnapshotCurrent(inviteSnapshot)) return;
            if (error) {
                if (lastData) {
                    lastTalentDrawResult = [];
                    applyTalentActionState(lastData);
                    clearWarehouseBatchSelection();
                }
                showToast(`❌ ${error.message || '批量分解失败'}`);
                return;
            }
            lastData = data;
            totalGain += Number(data?.fragmentGain || 0);
        }
        if (lastData) {
            lastTalentDrawResult = [];
            applyTalentActionState(lastData);
            clearWarehouseBatchSelection();
            showToast(`已批量分解 ${previewCount} 个仓库天赋 +${totalGain} 碎片`);
        }
    } finally {
        talentWarehouseBatchInFlight = false;
        talentManageInFlight = false;
        if (isInviteSnapshotCurrent(inviteSnapshot)) {
            replaceTalentPoolPanel();
        }
    }
}

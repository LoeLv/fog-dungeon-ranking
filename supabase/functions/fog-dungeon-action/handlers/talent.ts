import {
  TalentPoolItem, addOwnedTalentToStorage, addUserFragments, buildTalentState, canEquipTalentPool, canEquipTalentRanks, 
  cleanBigIntId, cleanPoolKey, cleanSlot, cleanTalentId, cleanText, compactTalentStateForAction, drawScoreStep, 
  equippedSlotLimit, getAdvancedDrawsEarned, getAllowedTalentPools, getAvailableSTalentSlot, getAvailableStorageSlot, 
  getBasicDrawsEarned, getFragmentTotal, getTalentDrawState, getTalentExchangeCost, getTalentFragmentGain, 
  getTalentKey, getTalentProfile, getTalentRankAllowance, getTalentSlotLimit, getTalentSlotRequirement, 
  hasRole, inventorySlotLimit, isAdvancedTalentDrawUnlocked, isMissingTalentEffectColumn, isMissingTalentTable, 
  json, pickDrawTalentWithGuarantee, rebuildTalentPoolCounterFromLogs, sTalentGuaranteeDraws, starterTalentDrawGrant, 
  updateProfileTalentText, 
} from "../_shared/core.ts";
import type { Ctx, AuthCtx } from "../_shared/core.ts";

// action: getTalentState
export async function handleGetTalentState(ctx: AuthCtx) {
  const { identity, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const state = await buildTalentState(supabase, identity);
      if (isMissingTalentTable(state.error ?? null)) return json({ error: "请先运行 talent_pool_migration.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
}

// action: drawTalent
export async function handleDrawTalent(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const poolKey = cleanPoolKey(payload.poolKey);
      const drawType = cleanText(payload.drawType, 12) === "ten" ? "ten" : "single";
      const drawCount = drawType === "ten" ? 10 : 1;
      if (!poolKey) return json({ error: "请选择天赋池" }, 400);

      const profileResult = await getTalentProfile(supabase, identity);
      if (profileResult.error) {
        if (isMissingTalentTable(profileResult.error)) return json({ error: "请先运行 player_profiles_migration.sql" }, 400);
        return json({ error: profileResult.error.message }, 400);
      }
      const profile = profileResult.data;
      const allowedPoolKeys = getAllowedTalentPools(profile);
      if (!allowedPoolKeys.length) return json({ error: "请先保存信仰神明和个人职业" }, 400);
      if (!allowedPoolKeys.includes(poolKey)) {
        return json({ error: "只能抽取你的信仰池和职业池" }, 403);
      }
      const drawState = await getTalentDrawState(supabase, identity.codeHash);
      if (isMissingTalentTable(drawState.error ?? null)) return json({ error: "请先运行 talent_pool_migration.sql" }, 400);
      if (drawState.error) return json({ error: drawState.error.message }, 400);

      const basicDrawsEarned = getBasicDrawsEarned(profile.ascension_score) + drawState.eventBasicDraws;
      const advancedDrawsEarned = getAdvancedDrawsEarned(profile.ascension_score) + drawState.eventAdvancedDraws;
      const basicSpentDraws = drawState.basicSpentDraws;
      const advancedSpentDraws = drawState.advancedSpentDraws;
      const eventBasicSpentDraws = Math.min(drawState.eventBasicDraws, drawState.eventBasicSpentDraws);
      const eventAdvancedSpentDraws = Math.min(drawState.eventAdvancedDraws, drawState.eventAdvancedSpentDraws);
      const basicAvailableDraws = Math.max(0, basicDrawsEarned - basicSpentDraws);
      const advancedAvailableDraws = Math.max(0, advancedDrawsEarned - advancedSpentDraws);
      const eventBasicAvailableDraws = Math.max(0, drawState.eventBasicDraws - eventBasicSpentDraws);
      const eventAdvancedAvailableDraws = Math.max(0, drawState.eventAdvancedDraws - eventAdvancedSpentDraws);
      const availableDraws = basicAvailableDraws + advancedAvailableDraws;
      if (availableDraws < drawCount) {
        return json({
          error: `抽数不足：当前可用 ${availableDraws} 抽。登神之路每获得 ${drawScoreStep} 分增加 1 抽，抽数可攒。`,
        }, 400);
      }

      const { data: poolItems, error: poolError } = await supabase
        .from("talent_pool_items")
        .select("pool_key, talent_id, talent_name, rank, effect, cooldown, action_cost")
        .eq("pool_key", poolKey)
        .eq("is_enabled", true);
      let poolRows = poolItems;
      if (isMissingTalentEffectColumn(poolError ?? null)) {
        const fallbackPoolResult = await supabase
          .from("talent_pool_items")
          .select("pool_key, talent_id, talent_name, rank")
          .eq("pool_key", poolKey)
          .eq("is_enabled", true);
        if (fallbackPoolResult.error) return json({ error: fallbackPoolResult.error.message }, 400);
        poolRows = (fallbackPoolResult.data || []) as any[];
      } else {
        if (isMissingTalentTable(poolError)) return json({ error: "请先运行 talent_pool_migration.sql" }, 400);
        if (poolError) return json({ error: poolError.message }, 400);
      }
      if (!poolRows?.length) return json({ error: "该天赋池暂无天赋" }, 400);

      const talentItems = (poolRows || []) as TalentPoolItem[];
      const { data: counterRow, error: counterError } = await supabase
        .from("talent_pool_counters")
        .select("continue_draw, s_continue_draw")
        .eq("invite_code_hash", identity.codeHash)
        .eq("pool_key", poolKey)
        .maybeSingle();
      if (counterError) return json({ error: counterError.message }, 400);
      let continueDraw = Number(counterRow?.continue_draw || 0);
      let sContinueDraw = Number(counterRow?.s_continue_draw || 0);
      if (!counterRow) {
        const rebuiltCounter = await rebuildTalentPoolCounterFromLogs(supabase, identity.codeHash, poolKey);
        if (rebuiltCounter.error) return json({ error: rebuiltCounter.error.message }, 400);
        if (rebuiltCounter.rebuilt) {
          continueDraw = rebuiltCounter.continueDraw;
          sContinueDraw = rebuiltCounter.sContinueDraw;
        }
      }
      const basicDrawsToUse = Math.min(drawCount, basicAvailableDraws);
      const advancedDrawsToUse = drawCount - basicDrawsToUse;
      const eventBasicDrawsToUse = Math.min(basicDrawsToUse, eventBasicAvailableDraws);
      const eventAdvancedDrawsToUse = Math.min(advancedDrawsToUse, eventAdvancedAvailableDraws);
      const results: Record<string, unknown>[] = [];
      let fragmentGainTotal = 0;
      const sItems = talentItems.filter((item) => item.rank === "S");
      const nextBasicSpentDraws = basicSpentDraws + basicDrawsToUse;
      const nextAdvancedSpentDraws = advancedSpentDraws + advancedDrawsToUse;
      const nextEventBasicSpentDraws = eventBasicSpentDraws + eventBasicDrawsToUse;
      const nextEventAdvancedSpentDraws = eventAdvancedSpentDraws + eventAdvancedDrawsToUse;
      const nextSpentDraws = nextBasicSpentDraws + nextAdvancedSpentDraws;

      const { error: initialStateError } = await supabase
        .from("talent_draw_state")
        .insert({
          invite_code_hash: identity.codeHash,
          spent_draws: 0,
          basic_spent_draws: 0,
          advanced_spent_draws: 0,
          updated_at: new Date().toISOString(),
        });
      if (initialStateError && initialStateError.code !== "23505") {
        return json({ error: initialStateError.message }, 400);
      }

      const { data: reservedState, error: reserveError } = await supabase
        .from("talent_draw_state")
        .update({
          spent_draws: nextSpentDraws,
          basic_spent_draws: nextBasicSpentDraws,
          advanced_spent_draws: nextAdvancedSpentDraws,
          event_basic_spent_draws: nextEventBasicSpentDraws,
          event_advanced_spent_draws: nextEventAdvancedSpentDraws,
          updated_at: new Date().toISOString(),
        })
        .eq("invite_code_hash", identity.codeHash)
        .eq("spent_draws", drawState.spentDraws)
        .eq("basic_spent_draws", basicSpentDraws)
        .eq("advanced_spent_draws", advancedSpentDraws)
        .select("spent_draws, basic_spent_draws, advanced_spent_draws")
        .maybeSingle();
      if (reserveError) return json({ error: reserveError.message }, 400);
      if (!reservedState) {
        return json({ error: "抽取请求已在处理中，请刷新天赋池后再试" }, 409);
      }

      const { data: ownedTalentRows, error: ownedTalentReadError } = await supabase
        .from("owned_talents")
        .select("pool_key, talent_id, storage_slot")
        .eq("invite_code_hash", identity.codeHash);
      if (ownedTalentReadError) return json({ error: ownedTalentReadError.message }, 400);
      const ownedTalentKeys = new Set(
        (ownedTalentRows || []).map((item) => getTalentKey(item.pool_key, item.talent_id)),
      );
      const usedStorageSlots = new Set(
        (ownedTalentRows || [])
          .map((item) => Number(item.storage_slot || 0))
          .filter((slot) => slot >= 1 && slot <= inventorySlotLimit),
      );
      const takeAvailableDrawStorageSlot = () => {
        for (let slot = 1; slot <= inventorySlotLimit; slot += 1) {
          if (!usedStorageSlots.has(slot)) {
            usedStorageSlots.add(slot);
            return slot;
          }
        }
        return 0;
      };

      let baseBasicIndex = 0;
      for (let i = 0; i < drawCount; i += 1) {
        const isBasicDraw = i < basicDrawsToUse;
        const tierIndex = isBasicDraw ? i : i - basicDrawsToUse;
        const isEventDraw = isBasicDraw
          ? tierIndex < eventBasicDrawsToUse
          : tierIndex < eventAdvancedDrawsToUse;
        const isStarterDraw = isBasicDraw
          && !isEventDraw
          && (basicSpentDraws - eventBasicSpentDraws + baseBasicIndex < starterTalentDrawGrant);
        const shouldAwardSGuaranteeFragments = !isBasicDraw
          && !isStarterDraw
          && sItems.length === 0
          && sContinueDraw >= sTalentGuaranteeDraws - 1;
        const drawResult = pickDrawTalentWithGuarantee(talentItems, continueDraw, sContinueDraw, !isStarterDraw && !shouldAwardSGuaranteeFragments, !isBasicDraw);
        const target = drawResult.talent;
        const isB = target.rank === "B";
        const isS = target.rank === "S";
        const isGuarantee = drawResult.isGuarantee && (isB || isS);
        if (!isStarterDraw) {
          continueDraw = isB ? 0 : continueDraw + 1;
          if (!isBasicDraw) sContinueDraw = (isS || shouldAwardSGuaranteeFragments) ? 0 : sContinueDraw + 1;
        }
        if (isBasicDraw && !isEventDraw) baseBasicIndex += 1;

        let isRepeat = false;
        let fragmentGain = 0;
        const sGuaranteeFragmentGain = shouldAwardSGuaranteeFragments ? getTalentExchangeCost("S") : 0;
        if (sGuaranteeFragmentGain > 0) fragmentGainTotal += sGuaranteeFragmentGain;
        let storageSlot = 0;
        let sStorageSlot = 0;
        let overflowChoice: Record<string, unknown> | null = null;
        const targetKey = getTalentKey(poolKey, target.talent_id);
        isRepeat = ownedTalentKeys.has(targetKey);
        if (isRepeat) {
          fragmentGain = getTalentFragmentGain(target.rank);
          fragmentGainTotal += fragmentGain;
        } else {
          const addResult = await addOwnedTalentToStorage(supabase, identity.codeHash, {
            pool_key: target.pool_key,
            talent_id: target.talent_id,
            talent_name: target.talent_name,
            rank: target.rank,
          }, "draw");
          if (addResult.error) return json({ error: addResult.error.message }, 400);
          if (addResult.duplicateFragmentGain) {
            fragmentGain = addResult.duplicateFragmentGain;
            fragmentGainTotal += fragmentGain;
          }
          if (addResult.ownedTalent) {
            ownedTalentKeys.add(targetKey);
            storageSlot = Number((addResult.ownedTalent as Record<string, unknown>).storage_slot || 0);
            sStorageSlot = Number((addResult.ownedTalent as Record<string, unknown>).s_slot || 0);
          }
          if (addResult.overflowChoice) overflowChoice = addResult.overflowChoice;
        }

        const { data: logRow, error: logError } = await supabase
          .from("talent_draw_logs")
          .insert({
            invite_code_hash: identity.codeHash,
            pool_key: poolKey,
            draw_type: drawType,
            talent_id: target.talent_id,
            talent_name: target.talent_name,
            rank: target.rank,
            is_guarantee: isGuarantee,
            is_repeat: isRepeat,
            fragment_gain: fragmentGain,
          })
          .select("id")
          .single();
        if (logError) return json({ error: logError.message }, 400);

        results.push({
          poolKey,
          talentId: target.talent_id,
          talentName: target.talent_name,
          effect: target.effect || "",
          cooldown: target.cooldown || "",
          actionCost: Number(target.action_cost || 0),
          rank: target.rank,
          drawTier: isBasicDraw ? "basic" : "advanced",
          isGuarantee,
          isRepeat,
          fragmentGain,
          sGuaranteeFragmentGain,
          storageSlot,
          sStorageSlot,
          isOverflow: !!overflowChoice,
          overflowChoiceId: overflowChoice?.id || null,
        });
      }

      const { error: counterUpdateError } = await supabase
        .from("talent_pool_counters")
        .upsert({
          invite_code_hash: identity.codeHash,
          pool_key: poolKey,
          continue_draw: continueDraw,
          s_continue_draw: sContinueDraw,
          updated_at: new Date().toISOString(),
        });
      if (counterUpdateError) return json({ error: counterUpdateError.message }, 400);

      if (fragmentGainTotal > 0) {
        const fragmentUpdate = await addUserFragments(supabase, identity.codeHash, fragmentGainTotal);
        if (fragmentUpdate.error) return json({ error: fragmentUpdate.error.message }, 400);
      }

      const talentTextUpdate = await updateProfileTalentText(supabase, identity.codeHash);
      if (talentTextUpdate.error) return json({ error: talentTextUpdate.error.message }, 400);
      const state = await buildTalentState(supabase, identity);
      if (state.error) return json({ error: state.error.message }, 400);
      const responseState = payload.compactState === true ? compactTalentStateForAction(state.data || {}) : state.data;

      return json({
        role,
        name: identity.displayName,
        data: {
          drawType,
          basicDrawsUsed: basicDrawsToUse,
          advancedDrawsUsed: advancedDrawsToUse,
          results,
          fragmentGain: fragmentGainTotal,
          state: responseState,
        },
      });
}

// action: exchangeTalent
export async function handleExchangeTalent(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const poolKey = cleanPoolKey(payload.poolKey);
      const targetTalentId = cleanTalentId(payload.targetTalentId);
      if (!poolKey || !targetTalentId) return json({ error: "兑换目标不正确" }, 400);

      const profileResult = await getTalentProfile(supabase, identity);
      if (profileResult.error) {
        if (isMissingTalentTable(profileResult.error)) return json({ error: "请先保存个人档案" }, 400);
        return json({ error: profileResult.error.message }, 400);
      }
      const allowedPoolKeys = getAllowedTalentPools(profileResult.data);
      if (!allowedPoolKeys.length) return json({ error: "请先保存信仰神明和个人职业" }, 400);
      if (!allowedPoolKeys.includes(poolKey)) {
        return json({ error: "只能兑换你的信仰池和职业池天赋" }, 403);
      }

      const { data: targetTalent, error: targetError } = await supabase
        .from("talent_pool_items")
        .select("pool_key, talent_id, talent_name, rank, effect, cooldown, action_cost")
        .eq("pool_key", poolKey)
        .eq("talent_id", targetTalentId)
        .eq("is_enabled", true)
        .maybeSingle();
      let targetTalentRow = targetTalent;
      if (isMissingTalentEffectColumn(targetError ?? null)) {
        const fallbackTargetResult = await supabase
          .from("talent_pool_items")
          .select("pool_key, talent_id, talent_name, rank")
          .eq("pool_key", poolKey)
          .eq("talent_id", targetTalentId)
          .eq("is_enabled", true)
          .maybeSingle();
        if (fallbackTargetResult.error) return json({ error: fallbackTargetResult.error.message }, 400);
        targetTalentRow = fallbackTargetResult.data as any;
      } else {
        if (isMissingTalentTable(targetError)) return json({ error: "请先运行 talent_pool_migration.sql" }, 400);
        if (targetError) return json({ error: targetError.message }, 400);
      }
      if (!targetTalentRow || !["S", "A", "B"].includes(targetTalentRow.rank)) return json({ error: "只能兑换该池的 B/A/S 级天赋" }, 400);
      if (targetTalentRow.rank === "A" && !isAdvancedTalentDrawUnlocked(profileResult.data.ascension_score)) {
        return json({ error: "1500 分后才开放 A 级天赋兑换" }, 403);
      }
      const exchangeCost = getTalentExchangeCost(targetTalentRow.rank);

      const { data: owned, error: ownedError } = await supabase
        .from("owned_talents")
        .select("id, storage_slot, s_slot")
        .eq("invite_code_hash", identity.codeHash)
        .eq("pool_key", poolKey)
        .eq("talent_id", targetTalentId)
        .maybeSingle();
      if (ownedError) return json({ error: ownedError.message }, 400);
      if (owned) return json({ error: "你已经拥有这个天赋了，不需要重复兑换" }, 409);

      const { data: pendingSame, error: pendingSameError } = await supabase
        .from("talent_overflow_choices")
        .select("id")
        .eq("invite_code_hash", identity.codeHash)
        .eq("pool_key", poolKey)
        .eq("talent_id", targetTalentId)
        .maybeSingle();
      if (pendingSameError) return json({ error: pendingSameError.message }, 400);
      if (pendingSame) return json({ error: "这个天赋已经在待取舍列表里了，请先处理" }, 409);

      const fragmentState = await getFragmentTotal(supabase, identity.codeHash);
      if (fragmentState.error) return json({ error: fragmentState.error.message }, 400);
      if (fragmentState.fragmentTotal < exchangeCost) {
        return json({
          error: `碎片不足：需要 ${exchangeCost}，当前 ${fragmentState.fragmentTotal}`,
        }, 400);
      }

      const { error: fragmentUpdateError } = await supabase
        .from("user_fragments")
        .upsert({
          invite_code_hash: identity.codeHash,
          fragment_total: fragmentState.fragmentTotal - exchangeCost,
          updated_at: new Date().toISOString(),
        });
      if (fragmentUpdateError) return json({ error: fragmentUpdateError.message }, 400);

      const addResult = await addOwnedTalentToStorage(supabase, identity.codeHash, targetTalentRow, "exchange");
      if (addResult.error) return json({ error: addResult.error.message }, 400);

      const { error: logError } = await supabase
        .from("talent_exchange_logs")
        .insert({
          invite_code_hash: identity.codeHash,
          pool_key: poolKey,
          target_talent_id: targetTalentRow.talent_id,
          target_talent_name: targetTalentRow.talent_name,
          cost_fragment: exchangeCost,
        });
      if (logError) return json({ error: logError.message }, 400);

      const talentTextUpdate = await updateProfileTalentText(supabase, identity.codeHash);
      if (talentTextUpdate.error) return json({ error: talentTextUpdate.error.message }, 400);
      const state = await buildTalentState(supabase, identity);
      if (state.error) return json({ error: state.error.message }, 400);

      return json({
        role,
        name: identity.displayName,
        data: {
          talent: {
            poolKey,
             talentId: targetTalentRow.talent_id,
             talentName: targetTalentRow.talent_name,
             effect: targetTalentRow.effect || "",
             actionCost: Number(targetTalentRow.action_cost || 0),
             rank: targetTalentRow.rank,
            storageSlot: Number(addResult.ownedTalent?.storage_slot || 0),
            isOverflow: !!addResult.overflowChoice,
            overflowChoiceId: addResult.overflowChoice?.id || null,
          },
          costFragment: exchangeCost,
          state: state.data,
        },
      });
}

// action: resolveTalentOverflow
export async function handleResolveTalentOverflow(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const choiceId = cleanBigIntId(payload.choiceId);
      const decision = cleanText(payload.decision, 12);
      if (!choiceId || !["discard", "replace"].includes(decision)) return json({ error: "溢出处理参数不正确" }, 400);
      const replaceOwnedId = decision === "replace" ? cleanBigIntId(payload.replaceOwnedId) : 0;
      if (decision === "replace" && !replaceOwnedId) return json({ error: "请选择要替换的仓库天赋" }, 400);

      const { data: choice, error: choiceError } = await supabase
        .from("talent_overflow_choices")
        .select("id, pool_key, talent_id, talent_name, rank, source")
        .eq("id", choiceId)
        .eq("invite_code_hash", identity.codeHash)
        .maybeSingle();
      if (isMissingTalentTable(choiceError)) return json({ error: "请先运行 talent_inventory_migration.sql" }, 400);
      if (choiceError) return json({ error: choiceError.message }, 400);
      if (!choice) return json({ error: "待处理天赋不存在或已处理" }, 404);
      let fragmentGainTotal = 0;
      let existingSame: Record<string, unknown> | null = null;
      let replaced: Record<string, unknown> | null = null;
      if (decision === "discard") {
        fragmentGainTotal += getTalentFragmentGain(choice.rank);
      } else {
        const { data: existingSameRow, error: existingSameError } = await supabase
          .from("owned_talents")
          .select("id")
          .eq("invite_code_hash", identity.codeHash)
          .eq("pool_key", choice.pool_key)
          .eq("talent_id", choice.talent_id)
          .maybeSingle();
        if (existingSameError) return json({ error: existingSameError.message }, 400);
        existingSame = existingSameRow;
        if (existingSame) {
          fragmentGainTotal += getTalentFragmentGain(choice.rank);
        } else {
          const { data: replacedRow, error: replacedReadError } = await supabase
            .from("owned_talents")
            .select("id, storage_slot, s_slot, rank")
            .eq("id", replaceOwnedId)
            .eq("invite_code_hash", identity.codeHash)
            .or("storage_slot.not.is.null,s_slot.not.is.null")
            .maybeSingle();
          if (replacedReadError) return json({ error: replacedReadError.message }, 400);
          if (!replacedRow) return json({ error: "要替换的仓库天赋不存在或已处理" }, 404);
          replaced = replacedRow;
          fragmentGainTotal += getTalentFragmentGain(replacedRow.rank);
        }
      }

      const { error: clearChoiceError } = await supabase
        .from("talent_overflow_choices")
        .delete()
        .eq("id", choiceId)
        .eq("invite_code_hash", identity.codeHash);
      if (clearChoiceError) return json({ error: clearChoiceError.message }, 400);

      if (decision === "replace" && !existingSame && replaced) {
        const { error: deleteOwnedError } = await supabase
          .from("owned_talents")
          .delete()
          .eq("id", replaceOwnedId)
          .eq("invite_code_hash", identity.codeHash)
          .or("storage_slot.not.is.null,s_slot.not.is.null");
        if (deleteOwnedError) return json({ error: deleteOwnedError.message }, 400);
        const { error: insertReplacementError } = await supabase
          .from("owned_talents")
          .insert({
            invite_code_hash: identity.codeHash,
            pool_key: choice.pool_key,
            talent_id: choice.talent_id,
            talent_name: choice.talent_name,
            rank: choice.rank,
            acquired_from: choice.source === "exchange" ? "exchange" : "draw",
            storage_slot: replaced.storage_slot,
            s_slot: replaced.s_slot || null,
          });
        if (insertReplacementError) return json({ error: insertReplacementError.message }, 400);
      }

      if (fragmentGainTotal > 0) {
        const fragmentUpdate = await addUserFragments(supabase, identity.codeHash, fragmentGainTotal);
        if (fragmentUpdate.error) return json({ error: fragmentUpdate.error.message }, 400);
      }

      const talentTextUpdate = await updateProfileTalentText(supabase, identity.codeHash);
      if (talentTextUpdate.error) return json({ error: talentTextUpdate.error.message }, 400);
      const state = await buildTalentState(supabase, identity);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: { fragmentGain: fragmentGainTotal, state: state.data } });
}

// action: setEquippedTalent
export async function handleSetEquippedTalent(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const equippedSlot = cleanSlot(payload.equippedSlot, equippedSlotLimit);
      const ownedTalentId = cleanBigIntId(payload.ownedTalentId);
      if (!equippedSlot) return json({ error: "携带槽位不正确" }, 400);

      const profileResult = await getTalentProfile(supabase, identity);
      if (profileResult.error) return json({ error: profileResult.error.message }, 400);
      const activeEquippedSlotLimit = getTalentSlotLimit(profileResult.data.ascension_score);
      if (equippedSlot > activeEquippedSlotLimit) {
        return json({ error: "当前分数尚未开启这个携带槽" }, 403);
      }
      const rankAllowance = getTalentRankAllowance(profileResult.data.ascension_score);
      const slotRequirement = getTalentSlotRequirement(profileResult.data, equippedSlot);

      const { data: currentEquipped, error: currentEquippedError } = await supabase
        .from("owned_talents")
        .select("id, pool_key, rank, equipped_slot, storage_slot, s_slot")
        .eq("invite_code_hash", identity.codeHash)
        .not("equipped_slot", "is", null);
      if (currentEquippedError) return json({ error: currentEquippedError.message }, 400);

      const currentSlotTalent = (currentEquipped || []).find((item) => Number(item.equipped_slot) === equippedSlot) || null;
      let owned: Record<string, unknown> | null = null;
      if (ownedTalentId) {
        if (currentSlotTalent && Number(currentSlotTalent.id) === ownedTalentId) {
          owned = currentSlotTalent as Record<string, unknown>;
        } else {
          const { data: ownedRow, error: ownedError } = await supabase
            .from("owned_talents")
            .select("id, pool_key, rank, storage_slot, equipped_slot, s_slot")
            .eq("id", ownedTalentId)
            .eq("invite_code_hash", identity.codeHash)
            .maybeSingle();
          if (ownedError) return json({ error: ownedError.message }, 400);
          if (!ownedRow) return json({ error: "owned talent not found" }, 404);
          owned = ownedRow as Record<string, unknown>;
          if (String(owned.rank || "").toUpperCase() === "S") {
            if (!Number(owned.s_slot || 0)) return json({ error: "S仓库位状态异常，请刷新后重试" }, 400);
          } else if (!Number(owned.storage_slot || 0)) {
            return json({ error: "仓库位状态异常，请刷新后重试" }, 400);
          }
          if (!canEquipTalentPool(owned.pool_key, slotRequirement)) {
            return json({ error: "slot pool mismatch" }, 403);
          }
        }
        const prospectiveRanks = (currentEquipped || [])
          .filter((item) => Number(item.equipped_slot) !== equippedSlot && Number(item.id) !== ownedTalentId)
          .map((item) => item.rank);
        prospectiveRanks.push(owned.rank);
        if (!canEquipTalentRanks(prospectiveRanks, rankAllowance)) {
          return json({ error: `当前分数最多只能携带 ${rankAllowance.join("/")} 品阶组合` }, 403);
        }
      }

      if (ownedTalentId && currentSlotTalent && Number(currentSlotTalent.id) === ownedTalentId) {
        // No state change needed; the request kept the current equipped talent selected.
      } else if (ownedTalentId) {
        const sourceStorageSlot = Number(owned?.storage_slot || 0);
        const sourceSStorageSlot = Number(owned?.s_slot || 0);
        const isSpecialSOwned = String(owned?.rank || "").toUpperCase() === "S" && sourceSStorageSlot > 0;
        let previousStorageSlot = sourceStorageSlot;
        let previousSStorageSlot = 0;
        const currentSlotIsS = String(currentSlotTalent?.rank || "").toUpperCase() === "S";
        if (currentSlotTalent && currentSlotIsS) {
          if (isSpecialSOwned) {
            previousSStorageSlot = sourceSStorageSlot;
          } else {
            const sSlotResult = await getAvailableSTalentSlot(supabase, identity.codeHash);
            if (sSlotResult.error) return json({ error: sSlotResult.error.message }, 400);
            if (!sSlotResult.slot) return json({ error: "S仓库已满，无法替换当前天赋" }, 409);
            previousSStorageSlot = sSlotResult.slot;
          }
        }
        if (currentSlotTalent && !currentSlotIsS && !previousStorageSlot) {
          const slotResult = await getAvailableStorageSlot(supabase, identity.codeHash);
          if (slotResult.error) return json({ error: slotResult.error.message }, 400);
          if (!slotResult.slot) return json({ error: "仓库已满，无法替换当前天赋" }, 409);
          previousStorageSlot = slotResult.slot;
        }
        if (!sourceStorageSlot && !isSpecialSOwned) return json({ error: "仓库位状态异常，请刷新后重试" }, 400);

        // When switching from one equipped S talent to another S talent,
        // release the incoming talent's S-warehouse slot first. Otherwise
        // storing the outgoing talent in that same slot hits the unique
        // (invite_code_hash, s_slot) index before the incoming row is updated.
        if (currentSlotTalent && currentSlotIsS && isSpecialSOwned) {
          const { error: releaseIncomingSStorageError } = await supabase
            .from("owned_talents")
            .update({ s_slot: null, equipped_slot: null })
            .eq("id", ownedTalentId)
            .eq("invite_code_hash", identity.codeHash);
          if (releaseIncomingSStorageError) return json({ error: releaseIncomingSStorageError.message }, 400);
        }

        if (currentSlotTalent) {
          const clearCurrentSlotUpdate: Record<string, unknown> = { equipped_slot: null };
          if (currentSlotIsS) {
            clearCurrentSlotUpdate.s_slot = previousSStorageSlot || null;
            clearCurrentSlotUpdate.storage_slot = null;
          } else {
            clearCurrentSlotUpdate.storage_slot = null;
          }
          const { error: clearCurrentSlotError } = await supabase
            .from("owned_talents")
            .update(clearCurrentSlotUpdate)
            .eq("id", currentSlotTalent.id)
            .eq("invite_code_hash", identity.codeHash);
          if (clearCurrentSlotError) return json({ error: clearCurrentSlotError.message }, 400);
        }

        const equipUpdate: Record<string, unknown> = { equipped_slot: equippedSlot };
        if (isSpecialSOwned) equipUpdate.s_slot = null;
        else equipUpdate.storage_slot = null;
        const { error: equipError } = await supabase
          .from("owned_talents")
          .update(equipUpdate)
          .eq("id", ownedTalentId)
          .eq("invite_code_hash", identity.codeHash);
        if (equipError) return json({ error: equipError.message }, 400);

        if (currentSlotTalent && !currentSlotIsS) {
          const { error: storePreviousError } = await supabase
            .from("owned_talents")
            .update({ storage_slot: previousStorageSlot, equipped_slot: null })
            .eq("id", currentSlotTalent.id)
            .eq("invite_code_hash", identity.codeHash);
          if (storePreviousError) return json({ error: storePreviousError.message }, 400);
        }
      } else if (currentSlotTalent) {
        const currentSlotIsS = String(currentSlotTalent.rank || "").toUpperCase() === "S";
        if (currentSlotIsS) {
          const sSlotResult = await getAvailableSTalentSlot(supabase, identity.codeHash);
          if (sSlotResult.error) return json({ error: sSlotResult.error.message }, 400);
          if (!sSlotResult.slot) return json({ error: "S仓库已满，无法卸下该天赋；请先分解一个S仓库天赋" }, 409);
          const { error: unequipSError } = await supabase
            .from("owned_talents")
            .update({ equipped_slot: null, s_slot: sSlotResult.slot })
            .eq("id", currentSlotTalent.id)
            .eq("invite_code_hash", identity.codeHash);
          if (unequipSError) return json({ error: unequipSError.message }, 400);
        } else {
          const slotResult = await getAvailableStorageSlot(supabase, identity.codeHash);
          if (slotResult.error) return json({ error: slotResult.error.message }, 400);
          if (!slotResult.slot) return json({ error: "仓库已满，无法卸下该天赋；请先分解一个仓库天赋" }, 409);

          const { error: unequipError } = await supabase
            .from("owned_talents")
            .update({ storage_slot: slotResult.slot, equipped_slot: null })
            .eq("id", currentSlotTalent.id)
            .eq("invite_code_hash", identity.codeHash);
          if (unequipError) return json({ error: unequipError.message }, 400);
        }
      }

      const talentTextUpdate = await updateProfileTalentText(supabase, identity.codeHash);
      if (talentTextUpdate.error) return json({ error: talentTextUpdate.error.message }, 400);
      const state = await buildTalentState(supabase, identity);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: { state: state.data } });
}

// action: discardOwnedTalent
export async function handleDiscardOwnedTalent(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const ownedTalentId = cleanBigIntId(payload.ownedTalentId);
      if (!ownedTalentId) return json({ error: "仓库天赋不正确" }, 400);

      const { data: ownedTalent, error: ownedReadError } = await supabase
        .from("owned_talents")
        .select("id, rank")
        .eq("id", ownedTalentId)
        .eq("invite_code_hash", identity.codeHash)
        .or("storage_slot.not.is.null,s_slot.not.is.null")
        .maybeSingle();
      if (ownedReadError) return json({ error: ownedReadError.message }, 400);
      if (!ownedTalent) return json({ error: "仓库天赋不存在或已处理" }, 404);
      const fragmentGain = getTalentFragmentGain(ownedTalent.rank);
      const { error: deleteOwnedError } = await supabase
        .from("owned_talents")
        .delete()
        .eq("id", ownedTalentId)
        .eq("invite_code_hash", identity.codeHash)
        .or("storage_slot.not.is.null,s_slot.not.is.null");
      if (deleteOwnedError) return json({ error: deleteOwnedError.message }, 400);

      const fragmentUpdate = await addUserFragments(supabase, identity.codeHash, fragmentGain);
      if (fragmentUpdate.error) return json({ error: fragmentUpdate.error.message }, 400);

      if (payload.compactState === true) {
        return json({
          role,
          name: identity.displayName,
          data: {
            fragmentGain,
            removedOwnedTalentIds: [ownedTalentId],
            state: {
              compact: true,
              fragmentTotal: fragmentUpdate.fragmentTotal,
              settledOverflowChoices: [],
            },
          },
        });
      }

      const talentTextUpdate = await updateProfileTalentText(supabase, identity.codeHash);
      if (talentTextUpdate.error) return json({ error: talentTextUpdate.error.message }, 400);
      const state = await buildTalentState(supabase, identity);
      if (state.error) return json({ error: state.error.message }, 400);
      const responseState = payload.compactState === true ? compactTalentStateForAction(state.data || {}) : state.data;
      return json({ role, name: identity.displayName, data: { fragmentGain, state: responseState } });
}

// action: discardOwnedTalents
export async function handleDiscardOwnedTalents(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const ownedTalentIds = Array.isArray(payload.ownedTalentIds)
        ? [...new Set(payload.ownedTalentIds.map((item: unknown) => cleanBigIntId(item)).filter(Boolean))]
        : [];
      if (!ownedTalentIds.length) return json({ error: "请先选择要分解的仓库天赋" }, 400);
      if (ownedTalentIds.length > inventorySlotLimit) return json({ error: `一次最多分解 ${inventorySlotLimit} 个仓库天赋` }, 400);

      const { data: ownedTalents, error: ownedReadError } = await supabase
        .from("owned_talents")
        .select("id, rank")
        .eq("invite_code_hash", identity.codeHash)
        .or("storage_slot.not.is.null,s_slot.not.is.null")
        .in("id", ownedTalentIds);
      if (ownedReadError) return json({ error: ownedReadError.message }, 400);
      if ((ownedTalents || []).length !== ownedTalentIds.length) {
        return json({ error: "部分仓库天赋不存在或已经处理，请刷新后重试" }, 404);
      }
      const fragmentGain = (ownedTalents || []).reduce((sum, item) => sum + getTalentFragmentGain(item.rank), 0);
      const { error: deleteOwnedError } = await supabase
        .from("owned_talents")
        .delete()
        .eq("invite_code_hash", identity.codeHash)
        .or("storage_slot.not.is.null,s_slot.not.is.null")
        .in("id", ownedTalentIds);
      if (deleteOwnedError) return json({ error: deleteOwnedError.message }, 400);

      if (fragmentGain > 0) {
        const fragmentUpdate = await addUserFragments(supabase, identity.codeHash, fragmentGain);
        if (fragmentUpdate.error) return json({ error: fragmentUpdate.error.message }, 400);
        if (payload.compactState === true) {
          return json({
            role,
            name: identity.displayName,
            data: {
              discardedCount: ownedTalents?.length || 0,
              fragmentGain,
              removedOwnedTalentIds: ownedTalentIds,
              state: {
                compact: true,
                fragmentTotal: fragmentUpdate.fragmentTotal,
                settledOverflowChoices: [],
              },
            },
          });
        }
      }

      const talentTextUpdate = await updateProfileTalentText(supabase, identity.codeHash);
      if (talentTextUpdate.error) return json({ error: talentTextUpdate.error.message }, 400);
      const state = await buildTalentState(supabase, identity);
      if (state.error) return json({ error: state.error.message }, 400);
      const responseState = payload.compactState === true ? compactTalentStateForAction(state.data || {}) : state.data;
      return json({
        role,
        name: identity.displayName,
        data: {
          discardedCount: ownedTalents?.length || 0,
          fragmentGain,
          state: responseState,
        },
      });
}

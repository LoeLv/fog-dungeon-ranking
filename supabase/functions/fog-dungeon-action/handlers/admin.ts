import {
  InviteRole, LooseError, buildAdminPlayerSnapshot, canGrantTitles, cleanDisplayName, cleanExclusiveTalentPayload, 
  cleanFaithTraitPayload, cleanGodName, cleanPoolKey, cleanScore, cleanTalentId, cleanTalentPoolPayload, 
  cleanText, cleanupMemberState, getAdminTargetAccount, getFaithPathByGod, getNextTalentId, getProfessionGod, 
  getProfileByDisplayName, godBelieverProfileSelect, godNames, hasPermission, isRecord, json, listAdminExclusiveTalentWorkbench, 
  listAdminMembers, listAdminOperationLogs, listAdminTalentPoolItems, listHonorOperationLogs, repairAdminTalentState, 
  resetTalentStateAfterIdentityChange, specialAccountRoles, writeAdminOperationLog, 
} from "../_shared/core.ts";
import type { Ctx, AuthCtx } from "../_shared/core.ts";

// action: adminLookupPlayer
export async function handleAdminLookupPlayer(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (role !== "admin") return json({ error: "只有神谕馆主可以查询后台档案" }, 403);
      const result = await buildAdminPlayerSnapshot(supabase, payload.targetName);
      if (result.error) return json({ error: result.error.message || "玩家后台档案读取失败" }, 400);
      return json({ role, name: identity.displayName, data: result.data });
}

// action: adminListOperationLogs
export async function handleAdminListOperationLogs(ctx: AuthCtx) {
  const { identity, role, supabase } = ctx;
      if (role !== "admin") return json({ error: "只有神谕馆主可以查看管理操作日志" }, 403);
      const result = await listAdminOperationLogs(supabase, null, 50);
      if (result.error) return json({ error: result.error.message || "管理操作日志读取失败" }, 400);
      return json({ role, name: identity.displayName, data: { logs: result.data || [], unavailable: !!result.unavailable } });
}

// action: adminListMembers
export async function handleAdminListMembers(ctx: AuthCtx) {
  const { identity, role, supabase } = ctx;
      if (role !== "admin") return json({ error: "只有馆主可以查看成员状态" }, 403);
      const result = await listAdminMembers(supabase);
      if (result.error) return json({ error: result.error.message || "成员列表读取失败" }, 400);
      return json({ role, name: identity.displayName, data: (result as any).data });
}

// action: adminSetAccountRole
export async function handleAdminSetAccountRole(ctx: AuthCtx) {
  const { action, identity, payload, role, supabase } = ctx;
      const delegatedRoleManager = hasPermission(identity, "account_role_manage");
      if (role !== "admin" && !delegatedRoleManager) return json({ error: "没有账号权限调整权限" }, 403);
      const targetResult = await getAdminTargetAccount(supabase, payload.targetHash, payload.targetName);
      if (targetResult.error) return json({ error: targetResult.error.message || "目标账号读取失败" }, 400);
      const targetAccount = targetResult.data as Record<string, unknown>;
      const targetHash = cleanText(targetAccount.code_hash, 64);
      const beforeRole = cleanText(targetAccount.role, 20);
      const nextRole = cleanText(payload.role, 20);
      const allowedRoles = new Set(["player", "author", "reviewer", "admin"]);
      if (!allowedRoles.has(nextRole)) return json({ error: "只能设置为玩家、作者、审核员或馆主" }, 400);
      if (targetHash === identity.codeHash) return json({ error: "不能调整当前正在使用的馆主账号权限" }, 400);
      if (specialAccountRoles.has(beforeRole as InviteRole)) return json({ error: "特殊账号不能通过馆主管理面板改权" }, 403);
      if (delegatedRoleManager && !(beforeRole === "player" && nextRole === "author")) {
        return json({ error: "当前权限只允许将玩家升级为作者" }, 403);
      }
      if (beforeRole === nextRole) return json({ error: "目标账号已经是这个权限" }, 400);

      const { error: inviteError } = await supabase
        .from("invite_codes")
        .update({ role: nextRole })
        .eq("code_hash", targetHash);
      if (inviteError) return json({ error: inviteError.message }, 400);
      const { error: profileError } = await supabase
        .from("player_profiles")
        .update({ role: nextRole, updated_at: new Date().toISOString() })
        .eq("invite_code_hash", targetHash);
      if (profileError && profileError.code !== "42P01" && profileError.code !== "42703") return json({ error: profileError.message }, 400);

      await writeAdminOperationLog(supabase, identity, {
        action: "account.role",
        targetCodeHash: targetHash,
        targetName: cleanText(targetAccount.display_name, 40),
        objectType: "invite_code",
        summary: `馆主将 ${cleanText(targetAccount.display_name, 40)} 的权限从 ${beforeRole} 调整为 ${nextRole}`,
        beforeState: { role: beforeRole },
        afterState: { role: nextRole },
      });
      return json({ role, name: identity.displayName, data: { targetHash, role: nextRole } });
}

// action: adminRenameAccount
export async function handleAdminRenameAccount(ctx: AuthCtx) {
  const { action, identity, payload, role, supabase } = ctx;
      if (role !== "admin") return json({ error: "只有馆主可以改名" }, 403);
      const targetResult = await getAdminTargetAccount(supabase, payload.targetHash);
      if (targetResult.error) return json({ error: targetResult.error.message || "目标账号读取失败" }, 400);
      const targetAccount = targetResult.data as Record<string, unknown>;
      const display = cleanDisplayName(payload.displayName, "admin");
      if (display.error || !display.name) return json({ error: display.error || "昵称不正确" }, 400);
      const beforeName = cleanText(targetAccount.display_name, 40);
      const codeHash = cleanText(targetAccount.code_hash, 64);
      const { error: inviteError } = await supabase
        .from("invite_codes")
        .update({ display_name: display.name, last_seen_at: new Date().toISOString(), last_seen_action: "adminRenameAccount" })
        .eq("code_hash", codeHash);
      if (inviteError?.code === "23505") return json({ error: "这个昵称已经被使用了" }, 409);
      if (inviteError) return json({ error: inviteError.message }, 400);
      const [profileUpdate, titleUpdate, curseUpdate] = await Promise.all([
        supabase.from("player_profiles").update({ display_name: display.name, updated_at: new Date().toISOString() }).eq("invite_code_hash", codeHash),
        supabase.from("profile_titles").update({ display_name: display.name }).eq("invite_code_hash", codeHash),
        supabase.from("profile_curses").update({ display_name: display.name }).eq("invite_code_hash", codeHash),
      ]);
      const renameError = [profileUpdate.error, titleUpdate.error, curseUpdate.error].find((error) => error && error.code !== "42P01" && error.code !== "42703");
      if (renameError) return json({ error: renameError.message || "改名同步失败" }, 400);
      await writeAdminOperationLog(supabase, identity, {
        action: "account.rename",
        targetCodeHash: codeHash,
        targetName: beforeName,
        objectType: "invite_code",
        summary: `馆主将 ${beforeName} 改名为 ${display.name}`,
        beforeState: { displayName: beforeName },
        afterState: { displayName: display.name },
      });
      return json({ role, name: identity.displayName, data: { codeHash, displayName: display.name } });
}

// action: adminChangeMemberIdentity
export async function handleAdminChangeMemberIdentity(ctx: AuthCtx) {
  const { action, identity, payload, role, supabase } = ctx;
      if (role !== "admin") return json({ error: "只有馆主可以修改成员信仰和职业" }, 403);
      const targetResult = await getAdminTargetAccount(supabase, payload.targetHash);
      if (targetResult.error) return json({ error: targetResult.error.message || "目标账号读取失败" }, 400);
      const targetAccount = targetResult.data as Record<string, unknown>;
      const targetHash = cleanText(targetAccount.code_hash, 64);
      const targetRole = cleanText(targetAccount.role, 20) as InviteRole;
      if (!targetHash) return json({ error: "目标账号缺少邀请码哈希" }, 400);
      if (targetHash === identity.codeHash) return json({ error: "不能修改当前馆主自己的信仰或职业" }, 400);
      if (specialAccountRoles.has(targetRole)) return json({ error: "神明和星途账号不能通过馆主成员面板修改" }, 403);

      const { data: beforeProfile, error: profileReadError } = await supabase
        .from("player_profiles")
        .select(godBelieverProfileSelect)
        .eq("invite_code_hash", targetHash)
        .maybeSingle();
      if (profileReadError) return json({ error: profileReadError.message }, 400);
      if (!beforeProfile) return json({ error: "目标成员还没有个人档案" }, 404);

      const before = beforeProfile as Record<string, unknown>;
      const beforeFaithGod = cleanGodName(before.faith_god);
      const beforeProfession = cleanText(before.profession, 40);
      const professionOnly = cleanText(payload.changeMode, 30) === "profession";
      const nextFaithGod = professionOnly ? beforeFaithGod : cleanGodName(payload.faithGod);
      const nextProfession = cleanText(payload.profession, 40);
      const nextFaithPath = getFaithPathByGod(nextFaithGod);
      if (!nextFaithGod || !nextFaithPath || !godNames.has(nextFaithGod)) return json({ error: "请选择有效的信仰神明" }, 400);
      if (!nextProfession || getProfessionGod(nextProfession) !== nextFaithGod) return json({ error: "职业必须属于当前信仰神明" }, 400);
      if (professionOnly && nextProfession === beforeProfession) return json({ error: "新职业不能与当前职业相同" }, 400);
      if (!professionOnly && nextFaithGod === beforeFaithGod && nextProfession === beforeProfession) return json({ error: "信仰和职业都没有变化" }, 400);

      const talentReset = await resetTalentStateAfterIdentityChange(supabase, targetHash);
      if (talentReset.error) return json({ error: talentReset.error.message || "身份变更后的天赋重置失败，请联系馆主检查" }, 400);
      const profileUpdate: Record<string, unknown> = {
        faith_god: nextFaithGod,
        faith_path: nextFaithPath,
        original_faith_god: nextFaithGod,
        original_faith_path: nextFaithPath,
        profession: nextProfession,
        updated_at: new Date().toISOString(),
      };
      if (!professionOnly) profileUpdate.audience_score = 0;
      const { data: updatedProfile, error: updateError } = await supabase
        .from("player_profiles")
        .update(profileUpdate)
        .eq("invite_code_hash", targetHash)
        .select(godBelieverProfileSelect)
        .single();
      if (updateError) return json({ error: updateError.message }, 400);

      await writeAdminOperationLog(supabase, identity, {
        action: professionOnly ? "member.profession_change" : "member.identity_change",
        targetCodeHash: targetHash,
        targetName: cleanText(before.display_name, 40),
        objectType: "player_profile",
        summary: `馆主将 ${cleanText(before.display_name, 40)} 从 ${beforeFaithGod}/${beforeProfession} 调整为 ${nextFaithGod}/${nextProfession}，天赋、碎片和已用抽数已重置`,
        beforeState: { faithGod: beforeFaithGod, profession: beforeProfession },
        afterState: { faithGod: nextFaithGod, profession: nextProfession, talentReset },
      });
      return json({ role, name: identity.displayName, data: { targetName: cleanText(before.display_name, 40), profile: updatedProfile, talentReset } });
}

// action: adminResetAccount, adminDeleteAccount
export async function handleAdminResetAccount(ctx: AuthCtx) {
  const { action, identity, payload, role, supabase } = ctx;
      if (role !== "admin") return json({ error: "只有馆主可以管理账号" }, 403);
      const mode = action === "adminDeleteAccount" ? "delete" : "reset";
      const targetResult = await getAdminTargetAccount(supabase, payload.targetHash);
      if (targetResult.error) return json({ error: targetResult.error.message || "目标账号读取失败" }, 400);
      const targetAccount = targetResult.data as Record<string, unknown>;
      const codeHash = cleanText(targetAccount.code_hash, 64);
      const beforeName = cleanText(targetAccount.display_name, 40);
      if (codeHash === identity.codeHash) return json({ error: "不能重置或删除当前正在使用的馆主账号" }, 400);
      const cleanupResult = await cleanupMemberState(supabase, codeHash, mode);
      if ((cleanupResult as any).error) return json({ error: (cleanupResult as any).error.message || "账号处理失败" }, 400);
      await writeAdminOperationLog(supabase, identity, {
        action: mode === "delete" ? "account.delete" : "account.reset",
        targetCodeHash: codeHash,
        targetName: beforeName,
        objectType: "invite_code",
        summary: mode === "delete" ? `馆主注销了 ${beforeName} 的账号` : `馆主重置了 ${beforeName} 的个人状态`,
        beforeState: { displayName: beforeName, isActive: targetAccount.is_active },
        afterState: { mode },
      });
      return json({ role, name: identity.displayName, data: { codeHash, displayName: beforeName, mode } });
}

// action: adminListTalentPoolItems
export async function handleAdminListTalentPoolItems(ctx: AuthCtx) {
  const { identity, role, supabase } = ctx;
      if (!hasPermission(identity, "talent_pool_manage")) return json({ error: "没有天赋池管理权限" }, 403);
      const result = await listAdminTalentPoolItems(supabase);
      if (result.error) return json({ error: result.error.message || "天赋仓库读取失败" }, 400);
      return json({ role, name: identity.displayName, data: result.data });
}

// action: adminListExclusiveTalentWorkbench
export async function handleAdminListExclusiveTalentWorkbench(ctx: AuthCtx) {
  const { identity, role, supabase } = ctx;
      if (!hasPermission(identity, "talent_pool_manage")) return json({ error: "没有天赋池管理权限" }, 403);
      const result = await listAdminExclusiveTalentWorkbench(supabase);
      if (result.error) return json({ error: result.error.message || "专属天赋工作台读取失败" }, 400);
      return json({ role, name: identity.displayName, data: result.data });
}

// action: adminUpsertExclusiveTalent
export async function handleAdminUpsertExclusiveTalent(ctx: AuthCtx) {
  const { action, identity, payload, role, supabase } = ctx;
      if (!hasPermission(identity, "talent_pool_manage")) return json({ error: "没有天赋池管理权限" }, 403);
      const cleanResult = cleanExclusiveTalentPayload(payload);
      if (cleanResult.error) return json({ error: cleanResult.error.message }, 400);
      const targetName = cleanText(payload.targetName, 40);
      const targetHash = cleanText(payload.targetHash, 64);
      let profileResult = targetHash
        ? await supabase.from("player_profiles").select("invite_code_hash, display_name, ascension_score").eq("invite_code_hash", targetHash).maybeSingle()
        : await supabase.from("player_profiles").select("invite_code_hash, display_name, ascension_score").eq("display_name", targetName).maybeSingle();
      if (profileResult.error) return json({ error: profileResult.error.message }, 400);
      if (!profileResult.data) return json({ error: "没有找到目标玩家档案" }, 404);
      const target = profileResult.data as Record<string, unknown>;
      const codeHash = cleanText(target.invite_code_hash, 64);
      const item = cleanResult.data;
      const now = new Date().toISOString();
      const { error: slotError } = await supabase.from("exclusive_talent_slots").upsert({
        invite_code_hash: codeHash,
        manual_enabled: true,
        enabled_note: "馆主已开启专属天赋槽",
        enabled_by_hash: identity.codeHash,
        enabled_by_name: identity.displayName,
        enabled_at: now,
        updated_at: now,
      }, { onConflict: "invite_code_hash" });
      if (slotError) return json({ error: slotError.message }, 400);
      const { error: talentError } = await supabase.from("exclusive_talents").upsert({
        invite_code_hash: codeHash,
        talent_name: item.talentName,
        rank: item.rank,
        effect: item.effect,
        cooldown: item.cooldown,
        action_cost: item.actionCost,
        admin_note: item.adminNote,
        is_enabled: item.isEnabled,
        updated_by_hash: identity.codeHash,
        updated_by_name: identity.displayName,
        updated_at: now,
      }, { onConflict: "invite_code_hash" });
      if (talentError) return json({ error: talentError.message }, 400);
      if (item.saveTemplate && item.templateName) {
        const { error: templateError } = await supabase.from("exclusive_talent_templates").insert({
          template_name: item.templateName,
          talent_name: item.talentName,
          rank: item.rank,
          effect: item.effect,
          cooldown: item.cooldown,
          action_cost: item.actionCost,
          admin_note: item.adminNote,
          is_enabled: true,
          created_by_hash: identity.codeHash,
          created_by_name: identity.displayName,
          updated_by_hash: identity.codeHash,
          updated_by_name: identity.displayName,
          updated_at: now,
        });
        if (templateError) return json({ error: templateError.message }, 400);
      }
      await writeAdminOperationLog(supabase, identity, {
        action: "exclusive_talent.upsert",
        targetCodeHash: codeHash,
        targetName: cleanText(target.display_name, 40),
        objectType: "exclusive_talent",
        summary: `为 ${cleanText(target.display_name, 40)} 开启并保存专属天赋`,
        afterState: { ...item, targetName: cleanText(target.display_name, 40), ascensionScore: cleanScore(target.ascension_score) },
      });
      return json({ role, name: identity.displayName, data: { targetName: cleanText(target.display_name, 40), savedTemplate: item.saveTemplate && !!item.templateName } });
}

// action: adminDeleteExclusiveTalent
export async function handleAdminDeleteExclusiveTalent(ctx: AuthCtx) {
  const { action, identity, payload, role, supabase } = ctx;
      if (!hasPermission(identity, "talent_pool_manage")) return json({ error: "没有天赋池管理权限" }, 403);
      const targetHash = cleanText(payload.targetHash, 64);
      if (!targetHash) return json({ error: "目标玩家不正确" }, 400);
      const { data: target, error: targetError } = await supabase.from("player_profiles")
        .select("invite_code_hash, display_name")
        .eq("invite_code_hash", targetHash)
        .maybeSingle();
      if (targetError) return json({ error: targetError.message }, 400);
      if (!target) return json({ error: "没有找到目标玩家档案" }, 404);
      const { error } = await supabase.from("exclusive_talents").delete().eq("invite_code_hash", targetHash);
      if (error) return json({ error: error.message }, 400);
      await writeAdminOperationLog(supabase, identity, {
        action: "exclusive_talent.delete",
        targetCodeHash: targetHash,
        targetName: cleanText(target.display_name, 40),
        objectType: "exclusive_talent",
        summary: `删除 ${cleanText(target.display_name, 40)} 的 EX 专属天赋，保留专属槽`,
      });
      return json({ role, name: identity.displayName, data: { targetName: cleanText(target.display_name, 40), deleted: true } });
}

// action: adminUpsertTalentPoolItem
export async function handleAdminUpsertTalentPoolItem(ctx: AuthCtx) {
  const { action, identity, payload, role, supabase } = ctx;
      if (!hasPermission(identity, "talent_pool_manage")) return json({ error: "没有天赋池管理权限" }, 403);
      const cleanResult = cleanTalentPoolPayload(payload);
      if (cleanResult.error) return json({ error: cleanResult.error.message }, 400);
      const { poolKey, talentName, rank, effect, cooldown, adminNote, isEnabled, actionCost, talentIdInput } = cleanResult.data;
      const nextIdResult = talentIdInput ? { data: talentIdInput, error: null as LooseError } : await getNextTalentId(supabase, poolKey);
      if (nextIdResult.error) return json({ error: nextIdResult.error.message || "天赋编号分配失败" }, 400);
      const talentId = Number(nextIdResult.data || 1);
      const originalTalentId = cleanTalentId(payload.originalTalentId);
      if (originalTalentId && originalTalentId !== talentId) {
        const beforeOriginalResult = await supabase
          .from("talent_pool_items")
          .select("pool_key, talent_id, talent_name, rank, effect, cooldown, action_cost, is_enabled, admin_note")
          .eq("pool_key", poolKey)
          .eq("talent_id", originalTalentId)
          .maybeSingle();
        if (beforeOriginalResult.error) return json({ error: beforeOriginalResult.error.message }, 400);
        if (!beforeOriginalResult.data) return json({ error: "原天赋编号不存在，请刷新后再试" }, 404);
        const conflictResult = await supabase
          .from("talent_pool_items")
          .select("pool_key, talent_id")
          .eq("pool_key", poolKey)
          .eq("talent_id", talentId)
          .maybeSingle();
        if (conflictResult.error) return json({ error: conflictResult.error.message }, 400);
        if (conflictResult.data) return json({ error: `编号 ${talentId} 已存在，不能覆盖另一个天赋` }, 409);
        const { error: renameError } = await supabase
          .from("talent_pool_items")
          .update({
            talent_id: talentId,
            talent_name: talentName,
            rank,
            effect,
            cooldown,
            action_cost: actionCost,
            is_enabled: isEnabled,
            admin_note: adminNote,
            updated_by_hash: identity.codeHash,
            updated_at: new Date().toISOString(),
          })
          .eq("pool_key", poolKey)
          .eq("talent_id", originalTalentId);
        if (renameError) return json({ error: renameError.message }, 400);
        await writeAdminOperationLog(supabase, identity, {
          action: "talent_pool.renumber",
          objectType: "talent_pool_item",
          objectId: `${poolKey}:${originalTalentId}->${talentId}`,
          summary: `重编号 ${poolKey} #${originalTalentId} -> #${talentId} 天赋`,
          beforeState: beforeOriginalResult.data || {},
          afterState: { poolKey, originalTalentId, talentId, talentName, rank, effect, cooldown, actionCost, isEnabled, adminNote },
        });
        return json({ role, name: identity.displayName, data: { poolKey, talentId, talentName, rank, effect, cooldown, actionCost, isEnabled, adminNote } });
      }
      const beforeResult = await supabase
        .from("talent_pool_items")
        .select("pool_key, talent_id, talent_name, rank, effect, cooldown, action_cost, is_enabled, admin_note")
        .eq("pool_key", poolKey)
        .eq("talent_id", talentId)
        .maybeSingle();
      if (beforeResult.error) return json({ error: beforeResult.error.message }, 400);
      const { error } = await supabase.from("talent_pool_items").upsert({
        pool_key: poolKey,
        talent_id: talentId,
        talent_name: talentName,
        rank,
        effect,
        cooldown,
        action_cost: actionCost,
        is_enabled: isEnabled,
        admin_note: adminNote,
        created_by_hash: identity.codeHash,
        updated_by_hash: identity.codeHash,
        updated_at: new Date().toISOString(),
      }, { onConflict: "pool_key,talent_id" });
      if (error) return json({ error: error.message }, 400);
      await writeAdminOperationLog(supabase, identity, {
        action: "talent_pool.upsert",
        objectType: "talent_pool_item",
        objectId: `${poolKey}:${talentId}`,
        summary: `${beforeResult.data ? "更新" : "新增"} ${poolKey} #${talentId} 天赋`,
        beforeState: beforeResult.data || {},
        afterState: { poolKey, talentId, talentName, rank, effect, cooldown, actionCost, isEnabled, adminNote },
      });
      return json({ role, name: identity.displayName, data: { poolKey, talentId, talentName, rank, effect, cooldown, actionCost, isEnabled, adminNote } });
}

// action: adminBatchUpsertTalentPoolItems
export async function handleAdminBatchUpsertTalentPoolItems(ctx: AuthCtx) {
  const { action, identity, payload, role, supabase } = ctx;
      if (!hasPermission(identity, "talent_pool_manage")) return json({ error: "没有天赋池管理权限" }, 403);
      const poolKey = cleanPoolKey(payload.poolKey);
      const rawItems = Array.isArray(payload.items) ? payload.items : [];
      if (!poolKey || !rawItems.length) return json({ error: "请填写天赋池和批量天赋" }, 400);
      if (rawItems.length > 100) return json({ error: "单次最多批量保存 100 个天赋" }, 400);
      const rows = [];
      for (const [index, rawItem] of rawItems.entries()) {
        if (!isRecord(rawItem)) return json({ error: `第 ${index + 1} 行格式不正确` }, 400);
        const cleanResult = cleanTalentPoolPayload({ ...rawItem, poolKey }, true);
        if (cleanResult.error) return json({ error: `第 ${index + 1} 行：${cleanResult.error.message}` }, 400);
        const item = cleanResult.data;
        rows.push({
          pool_key: poolKey,
          talent_id: item.talentIdInput,
          talent_name: item.talentName,
          rank: item.rank,
          effect: item.effect,
          cooldown: item.cooldown,
          action_cost: item.actionCost,
          is_enabled: item.isEnabled,
          admin_note: item.adminNote,
          created_by_hash: identity.codeHash,
          updated_by_hash: identity.codeHash,
          updated_at: new Date().toISOString(),
        });
      }
      const { error } = await supabase.from("talent_pool_items").upsert(rows, { onConflict: "pool_key,talent_id" });
      if (error) return json({ error: error.message }, 400);
      await writeAdminOperationLog(supabase, identity, {
        action: "talent_pool.batch_upsert",
        objectType: "talent_pool_item",
        objectId: poolKey,
        summary: `批量保存 ${poolKey} ${rows.length} 个天赋`,
        afterState: { poolKey, count: rows.length, talentIds: rows.map((row) => row.talent_id) },
      });
      return json({ role, name: identity.displayName, data: { poolKey, count: rows.length } });
}

// action: adminBatchDeleteTalentPoolItems
export async function handleAdminBatchDeleteTalentPoolItems(ctx: AuthCtx) {
  const { action, identity, payload, role, supabase } = ctx;
      if (!hasPermission(identity, "talent_pool_manage")) return json({ error: "没有天赋池管理权限" }, 403);
      const poolKey = cleanPoolKey(payload.poolKey);
      const rawTalentIds = Array.isArray(payload.talentIds) ? payload.talentIds : [];
      const talentIds = Array.from(new Set(rawTalentIds.map(cleanTalentId).filter(Boolean)));
      if (!poolKey || !talentIds.length) return json({ error: "请填写天赋池和要删除的天赋编号" }, 400);
      if (talentIds.length > 100) return json({ error: "单次最多批量删除 100 个天赋" }, 400);
      const beforeResult = await supabase
        .from("talent_pool_items")
        .select("pool_key, talent_id, talent_name, rank, effect, cooldown, action_cost, is_enabled, admin_note")
        .eq("pool_key", poolKey)
        .in("talent_id", talentIds);
      if (beforeResult.error) return json({ error: beforeResult.error.message }, 400);
      const beforeRows = (beforeResult.data || []) as Record<string, unknown>[];
      const foundIds = new Set(beforeRows.map((row) => cleanTalentId(row.talent_id)).filter(Boolean));
      const missingTalentIds = talentIds.filter((talentId) => !foundIds.has(talentId));
      if (!beforeRows.length) return json({ error: "没有找到要删除的天赋池条目" }, 404);
      const { error } = await supabase
        .from("talent_pool_items")
        .delete()
        .eq("pool_key", poolKey)
        .in("talent_id", [...foundIds]);
      if (error) return json({ error: error.message }, 400);
      await writeAdminOperationLog(supabase, identity, {
        action: "talent_pool.batch_delete",
        objectType: "talent_pool_item",
        objectId: poolKey,
        summary: `批量删除 ${poolKey} ${beforeRows.length} 个天赋`,
        beforeState: { poolKey, items: beforeRows },
        afterState: { poolKey, count: beforeRows.length, talentIds: [...foundIds], missingTalentIds },
      });
      return json({ role, name: identity.displayName, data: { poolKey, count: beforeRows.length, talentIds: [...foundIds], missingTalentIds } });
}

// action: adminSetTalentPoolItemEnabled
export async function handleAdminSetTalentPoolItemEnabled(ctx: AuthCtx) {
  const { action, identity, payload, role, supabase } = ctx;
      if (!hasPermission(identity, "talent_pool_manage")) return json({ error: "没有天赋池管理权限" }, 403);
      const poolKey = cleanPoolKey(payload.poolKey);
      const talentId = cleanTalentId(payload.talentId);
      const enabled = payload.enabled === true;
      if (!poolKey || !talentId) return json({ error: "天赋项目不完整" }, 400);
      const beforeResult = await supabase
        .from("talent_pool_items")
        .select("pool_key, talent_id, talent_name, rank, effect, action_cost, is_enabled, admin_note")
        .eq("pool_key", poolKey)
        .eq("talent_id", talentId)
        .maybeSingle();
      if (beforeResult.error) return json({ error: beforeResult.error.message }, 400);
      if (!beforeResult.data) return json({ error: "没有找到这个天赋" }, 404);
      const { error } = await supabase
        .from("talent_pool_items")
        .update({ is_enabled: enabled, updated_by_hash: identity.codeHash, updated_at: new Date().toISOString() })
        .eq("pool_key", poolKey)
        .eq("talent_id", talentId);
      if (error) return json({ error: error.message }, 400);
      await writeAdminOperationLog(supabase, identity, {
        action: "talent_pool.toggle",
        objectType: "talent_pool_item",
        objectId: `${poolKey}:${talentId}`,
        targetName: cleanText(beforeResult.data.talent_name, 80),
        summary: `${enabled ? "启用" : "停用"} ${poolKey} #${talentId}`,
        beforeState: beforeResult.data as Record<string, unknown>,
        afterState: { ...(beforeResult.data as Record<string, unknown>), is_enabled: enabled },
      });
      return json({ role, name: identity.displayName, data: { poolKey, talentId, isEnabled: enabled } });
}

// action: adminUpsertFaithTrait
export async function handleAdminUpsertFaithTrait(ctx: AuthCtx) {
  const { action, identity, payload, role, supabase } = ctx;
      if (!hasPermission(identity, "talent_pool_manage")) return json({ error: "没有信仰特性管理权限" }, 403);
      const cleanResult = cleanFaithTraitPayload(payload);
      if (cleanResult.error) return json({ error: cleanResult.error.message }, 400);
      const { god, path, trait, adminNote, isEnabled } = cleanResult.data;
      const beforeResult = await supabase
        .from("faith_traits")
        .select("god_name, path_name, trait_text, is_enabled, admin_note")
        .eq("god_name", god)
        .maybeSingle();
      if (beforeResult.error?.code === "42P01" || beforeResult.error?.code === "42703") return json({ error: "请先运行 faith_traits_management_20260812.sql" }, 400);
      if (beforeResult.error) return json({ error: beforeResult.error.message }, 400);
      const sortOrder = [...godNames].indexOf(god) + 1;
      const { error } = await supabase.from("faith_traits").upsert({
        god_name: god,
        path_name: path,
        trait_text: trait,
        is_enabled: isEnabled,
        admin_note: adminNote,
        sort_order: sortOrder > 0 ? sortOrder : 999,
        updated_by_hash: identity.codeHash,
        updated_at: new Date().toISOString(),
      }, { onConflict: "god_name" });
      if (error) return json({ error: error.message }, 400);
      await writeAdminOperationLog(supabase, identity, {
        action: "faith_trait.upsert",
        objectType: "faith_trait",
        objectId: god,
        targetName: god,
        summary: `更新 ${god} 信仰特性`,
        beforeState: beforeResult.data || {},
        afterState: { god, path, trait, isEnabled, adminNote },
      });
      return json({ role, name: identity.displayName, data: { god, path, trait, isEnabled, adminNote } });
}

// action: listHonorOperationLogs
export async function handleListHonorOperationLogs(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!canGrantTitles(identity)) return json({ error: "需要馆主或神明谕令" }, 403);
      const limit = Math.max(1, Math.min(50, Number(payload.limit || 30)));
      const result = await listHonorOperationLogs(supabase, identity, limit);
      if (result.error) return json({ error: result.error.message || "称号诅咒操作日志读取失败" }, 400);
      return json({ role, name: identity.displayName, data: { logs: result.data || [], unavailable: !!result.unavailable } });
}

// action: adminScanTalentState
export async function handleAdminScanTalentState(ctx: AuthCtx) {
  const { action, identity, payload, role, supabase } = ctx;
      if (role !== "admin") return json({ error: "只有神谕馆主可以扫描天赋状态" }, 403);
      const result = await buildAdminPlayerSnapshot(supabase, payload.targetName);
      if (result.error) return json({ error: result.error.message || "天赋状态扫描失败" }, 400);
      const targetResult = await getProfileByDisplayName(supabase, payload.targetName);
      await writeAdminOperationLog(supabase, identity, {
        action: "talent.scan", targetCodeHash: targetResult.data?.invite_code_hash, targetName: result.data?.profile.displayName, objectType: "talent_state",
        summary: result.data?.anomalies?.hasIssues ? "扫描发现天赋状态异常" : "扫描完成，未发现天赋异常",
        afterState: { hasIssues: !!result.data?.anomalies?.hasIssues, messages: result.data?.anomalies?.messages || [] },
      });
      return json({ role, name: identity.displayName, data: { profile: result.data?.profile, anomalies: result.data?.anomalies } });
}

// action: adminRepairTalentState
export async function handleAdminRepairTalentState(ctx: AuthCtx) {
  const { action, identity, payload, role, supabase } = ctx;
      if (role !== "admin") return json({ error: "只有神谕馆主可以修复天赋状态" }, 403);
      const result = await repairAdminTalentState(supabase, payload.targetName);
      if ((result as any).error) return json({ error: (result as any).error.message || "天赋状态修复失败" }, 400);
      const targetResult = await getProfileByDisplayName(supabase, payload.targetName);
      await writeAdminOperationLog(supabase, identity, {
        action: "talent.repair", targetCodeHash: targetResult.data?.invite_code_hash, targetName: result.data?.snapshot?.profile?.displayName, objectType: "talent_state",
        summary: `完成 ${Array.isArray(result.data?.repaired) ? result.data.repaired.length : 0} 项天赋状态修复`,
        afterState: { repaired: result.data?.repaired || [], unresolved: result.data?.unresolved || [] },
      });
      return json({ role, name: identity.displayName, data: (result as any).data });
}

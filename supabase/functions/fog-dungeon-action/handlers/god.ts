import {
  cleanGodName, cleanScore, cleanText, getActiveCurseForHash, getActiveTitleForHash, getFaithPathByGod, 
  getProfessionGod, getPublicProfileKey, godBelieverProfileSelect, godNames, json, listGodBelievers, 
  resetTalentStateAfterIdentityChange, specialAccountRoles, toPublicCurse, toPublicProfile, updateProfileTalentText, 
  writeAdminOperationLog, 
} from "../_shared/core.ts";
import type { Ctx, AuthCtx } from "../_shared/core.ts";

// action: listGodBelievers
export async function handleListGodBelievers(ctx: AuthCtx) {
  const { identity, role, supabase } = ctx;
      if (!specialAccountRoles.has(role)) return json({ error: "只有神明账号可以查看自己的信徒" }, 403);
      const godName = cleanGodName(identity.displayName);
      if (!godNames.has(godName)) {
        if (role === "astral") return json({ role, name: identity.displayName, data: { god: identity.displayName, believers: [] } });
        return json({ error: "当前神明账号未绑定有效神名" }, 403);
      }
      const result = await listGodBelievers(supabase, godName);
      if (result.error) return json({ error: result.error.message || "信徒列表读取失败" }, 400);
      return json({ role, name: identity.displayName, data: { god: godName, believers: result.data || [] } });
}

// action: godChangeBelieverProfession
export async function handleGodChangeBelieverProfession(ctx: AuthCtx) {
  const { action, identity, payload, role, supabase } = ctx;
      if (!specialAccountRoles.has(role)) return json({ error: "只有神明账号可以单独修改信徒职业" }, 403);
      const actorGod = cleanGodName(identity.displayName);
      if (!godNames.has(actorGod)) return json({ error: role === "astral" ? "星途账号不执行信徒职业调整" : "当前神明账号未绑定有效神名" }, 403);
      const targetHash = cleanText(payload.targetHash, 64);
      const targetName = cleanText(payload.targetName, 40);
      if (!targetHash && !targetName) return json({ error: "请选择要修改职业的信徒" }, 400);

      let targetQuery = supabase.from("player_profiles").select(godBelieverProfileSelect);
      targetQuery = targetHash ? targetQuery.eq("invite_code_hash", targetHash) : targetQuery.eq("display_name", targetName);
      const { data: targetProfile, error: targetError } = await targetQuery.maybeSingle();
      if (targetError) return json({ error: targetError.message }, 400);
      if (!targetProfile) return json({ error: "没有找到这个信徒档案" }, 404);

      const beforeProfile = targetProfile as Record<string, unknown>;
      const beforeHash = cleanText(beforeProfile.invite_code_hash, 64);
      const beforeName = cleanText(beforeProfile.display_name, 40);
      const beforeFaithGod = cleanGodName(beforeProfile.faith_god);
      const beforeProfession = cleanText(beforeProfile.profession, 40);
      const nextProfession = cleanText(payload.profession, 40);
      if (!beforeHash) return json({ error: "目标信徒缺少邀请码哈希" }, 400);
      if (beforeFaithGod !== actorGod) return json({ error: "神明只能操作当前信仰自己的信徒" }, 403);
      if (!nextProfession || getProfessionGod(nextProfession) !== beforeFaithGod) return json({ error: "新职业必须属于当前信仰神明" }, 400);
      if (nextProfession === beforeProfession) return json({ error: "新职业不能与当前职业相同" }, 400);

      const talentReset = await resetTalentStateAfterIdentityChange(supabase, beforeHash);
      if (talentReset.error) return json({ error: talentReset.error.message || "职业变更后的天赋重置失败，请联系馆主检查" }, 400);
      const { data: updatedProfile, error: updateError } = await supabase
        .from("player_profiles")
        .update({ profession: nextProfession, talents: "", updated_at: new Date().toISOString() })
        .eq("invite_code_hash", beforeHash)
        .select(godBelieverProfileSelect)
        .single();
      if (updateError) return json({ error: updateError.message }, 400);

      await writeAdminOperationLog(supabase, identity, {
        action: "faith.profession_change",
        targetCodeHash: beforeHash,
        targetName: beforeName,
        objectType: "player_profile",
        summary: `神明单独改职业：${beforeName} 从 ${beforeFaithGod}/${beforeProfession} 调整为 ${beforeFaithGod}/${nextProfession}，天赋、碎片和已用抽数已重置`,
        beforeState: { faithGod: beforeFaithGod, profession: beforeProfession },
        afterState: { faithGod: beforeFaithGod, profession: nextProfession, talentReset },
      });
      return json({ role, name: identity.displayName, data: { targetName: beforeName, profile: updatedProfile, talentReset } });
}

// action: godConvertBeliever
export async function handleGodConvertBeliever(ctx: AuthCtx) {
  const { action, identity, payload, role, supabase } = ctx;
      if (!specialAccountRoles.has(role)) return json({ error: "只有神明账号可以执行改信敕令" }, 403);
      const actorGod = cleanGodName(identity.displayName);
      if (!godNames.has(actorGod)) return json({ error: role === "astral" ? "星途账号不执行改信敕令" : "当前神明账号未绑定有效神名" }, 403);

      const targetHash = cleanText(payload.targetHash, 64);
      const targetName = cleanText(payload.targetName, 40);
      if (!targetHash && !targetName) return json({ error: "请选择要改信的信徒" }, 400);

      const nextFaithGod = cleanGodName(payload.faithGod);
      const nextFaithPath = getFaithPathByGod(nextFaithGod);
      const nextProfession = cleanText(payload.profession, 40);
      const nextProfessionGod = getProfessionGod(nextProfession);
      if (!nextFaithGod || !nextFaithPath || !godNames.has(nextFaithGod)) return json({ error: "请选择有效的新信仰神明" }, 400);
      if (!nextProfession || !nextProfessionGod) return json({ error: "请选择新信仰下的职业" }, 400);
      if (nextProfessionGod !== nextFaithGod) return json({ error: "职业必须属于新的信仰神明" }, 400);

      let targetQuery = supabase
        .from("player_profiles")
        .select(godBelieverProfileSelect);
      targetQuery = targetHash ? targetQuery.eq("invite_code_hash", targetHash) : targetQuery.eq("display_name", targetName);
      const { data: targetProfile, error: targetError } = await targetQuery.maybeSingle();
      if (targetError) return json({ error: targetError.message }, 400);
      if (!targetProfile) return json({ error: "没有找到这个信徒档案" }, 404);

      const beforeProfile = targetProfile as Record<string, unknown>;
      const beforeHash = cleanText(beforeProfile.invite_code_hash, 64);
      const beforeName = cleanText(beforeProfile.display_name, 40);
      const beforeFaithGod = cleanGodName(beforeProfile.faith_god);
      const beforeProfession = cleanText(beforeProfile.profession, 40);
      if (!beforeHash) return json({ error: "目标信徒缺少邀请码哈希，无法执行改信" }, 400);
      if (beforeFaithGod !== actorGod) return json({ error: "神明只能操作当前信仰自己的信徒" }, 403);
      if (nextFaithGod === beforeFaithGod) return json({ error: "只能在改信仰时同步改职业，不能同信仰内单独改职业" }, 400);

      const curseEnabled = payload.curseEnabled === true;
      const curseText = cleanText(payload.curseName ?? payload.curseText, 32);
      const curseNote = cleanText(payload.curseEffect ?? payload.curseNote, 120);
      if (curseEnabled && (!curseText || !curseNote)) return json({ error: "勾选诅咒后必须填写诅咒名和诅咒效果" }, 400);

      const { data: updatedProfile, error: updateError } = await supabase
        .from("player_profiles")
        .update({
          faith_god: nextFaithGod,
          faith_path: nextFaithPath,
          original_faith_god: nextFaithGod,
          original_faith_path: nextFaithPath,
          profession: nextProfession,
          audience_score: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("invite_code_hash", beforeHash)
        .select(godBelieverProfileSelect)
        .single();
      if (updateError) return json({ error: updateError.message }, 400);

      const talentRebalance = await resetTalentStateAfterIdentityChange(supabase, beforeHash);
      if (talentRebalance.error) return json({ error: talentRebalance.error.message || "改信后天赋池回退失败，请联系馆主检查" }, 400);
      if (talentRebalance.removedPoolKeys.length) {
        const refreshResult = await updateProfileTalentText(supabase, beforeHash);
        if (refreshResult.error) return json({ error: refreshResult.error.message || "改信后天赋文本刷新失败" }, 400);
      }

      let curseData: Record<string, unknown> | null = null;
      if (curseEnabled) {
        const { data: insertedCurse, error: curseError } = await supabase
          .from("profile_curses")
          .insert({
            invite_code_hash: beforeHash,
            display_name: beforeName,
            curse_text: curseText,
            curse_god: actorGod,
            curse_note: curseNote,
            curse_type: "ordinary",
            granted_by_type: "god",
            granted_by_hash: identity.codeHash,
            granted_by_name: identity.displayName,
            is_active: true,
          })
          .select("id, curse_text, curse_god, curse_note, curse_type, granted_by_type, granted_by_name, granted_at")
          .single();
        if (curseError?.code === "42P01") return json({ error: "请先运行 profile_curses_migration.sql" }, 400);
        if (curseError) return json({ error: curseError.message }, 400);
        curseData = insertedCurse as Record<string, unknown>;
      }

      await writeAdminOperationLog(supabase, identity, {
        action: "faith.convert",
        targetCodeHash: beforeHash,
        targetName: beforeName,
        objectType: "player_profile",
        summary: `神明改信：${beforeName} 从 ${beforeFaithGod}/${beforeProfession} 改为 ${nextFaithGod}/${nextProfession}，觐见清零`,
        beforeState: {
          faithGod: beforeFaithGod,
          faithPath: cleanText(beforeProfile.faith_path, 20),
          profession: beforeProfession,
          audienceScore: cleanScore(beforeProfile.audience_score),
          ascensionScore: cleanScore(beforeProfile.ascension_score),
        },
        afterState: {
          faithGod: nextFaithGod,
          faithPath: nextFaithPath,
          profession: nextProfession,
          audienceScore: 0,
          ascensionScore: cleanScore((updatedProfile as Record<string, unknown>).ascension_score),
          talentRebalance,
          curse: curseData ? toPublicCurse(curseData) : null,
        },
      });

      const titleResult = await getActiveTitleForHash(supabase, beforeHash);
      if (titleResult.error) return json({ error: titleResult.error.message }, 400);
      const curseResult = await getActiveCurseForHash(supabase, beforeHash);
      if (curseResult.error) return json({ error: curseResult.error.message }, 400);
      const publicProfile = {
        ...(updatedProfile as Record<string, unknown>),
        active_title: (updatedProfile as Record<string, unknown>).show_titles === false ? null : titleResult.title,
        active_titles: (updatedProfile as Record<string, unknown>).show_titles === false ? [] : (titleResult.titles || []),
        active_curse: curseResult.curse,
        active_curses: curseResult.curses || [],
      };
      return json({
        role,
        name: identity.displayName,
        data: {
          targetName: beforeName,
          profile: toPublicProfile(publicProfile, await getPublicProfileKey(beforeHash), false),
          talentRebalance,
          activeCurse: curseData ? toPublicCurse(curseData) : null,
        },
      });
}

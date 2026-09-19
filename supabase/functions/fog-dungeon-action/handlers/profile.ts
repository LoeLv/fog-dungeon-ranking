import {
  canGrantTitles, cleanBigIntId, cleanDeviceKind, cleanDisplayName, cleanScore, cleanText, defaultAscensionScore, 
  defaultAudienceScore, getActiveCurseForHash, getActiveTitleForHash, getFaithPathByGod, getProfessionGod, 
  getProfileByDisplayName, getPublicProfileKey, getTitleGrantGod, hasRole, hasTrickeryFaithPrivilege, 
  inviteDeviceSessionEnforcement, isMissingCoCreatorsColumn, isProfileBindingMismatched, isUuid, issueInviteSession, 
  json, normalizeCurseType, rebalanceTalentPoolsAfterProfileChange, roleLabels, specialAccountRoles, 
  toPublicCurse, toPublicDungeonSummary, toPublicProfile, toPublicTitle, updateProfileTalentText, writeAdminOperationLog, 
} from "../_shared/core.ts";
import type { Ctx, AuthCtx } from "../_shared/core.ts";

// action: verifyInvite
export async function handleVerifyInvite(ctx: AuthCtx) {
  const { body, identity, req, role, supabase } = ctx;
      if (!inviteDeviceSessionEnforcement) {
        return json({
          role,
          label: roleLabels[role],
          name: identity.displayName,
          permissions: identity.permissions,
          sessionId: "",
          deviceKind: cleanDeviceKind(body.deviceKind),
        });
      }
      const sessionResult = await issueInviteSession(supabase, identity, body.deviceKind, req.headers.get("user-agent"));
      if (sessionResult.error) return json({ error: sessionResult.error.message || "登录会话签发失败" }, 400);
      return json({
        role,
        label: roleLabels[role],
        name: identity.displayName,
        permissions: identity.permissions,
        sessionId: sessionResult.data?.sessionId,
        deviceKind: sessionResult.data?.deviceKind,
      });
}

// action: getMyProfile
export async function handleGetMyProfile(ctx: AuthCtx) {
  const { identity, role, supabase } = ctx;
      if (specialAccountRoles.has(role)) return json({ role, name: identity.displayName, data: null });
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const { data: profile, error: profileError } = await supabase
        .from("player_profiles")
        .select("invite_code_hash, display_name, role, faith_god, faith_path, original_faith_god, original_faith_path, trickery_display_faith_god, trickery_display_faith_path, trickery_display_profession, profession, ascension_score, audience_score, items, talents, show_titles, scores_locked_at, updated_at")
        .eq("invite_code_hash", identity.codeHash)
        .maybeSingle();
      if (profileError?.code === "42P01") return json({ error: "请先运行 player_profiles_migration.sql" }, 400);
      if (profileError) return json({ error: profileError.message }, 400);
      if (!profile) return json({ role, name: identity.displayName, data: null });

      const titleResult = await getActiveTitleForHash(supabase, identity.codeHash);
      if (titleResult.error) return json({ error: titleResult.error.message }, 400);
      const curseResult = await getActiveCurseForHash(supabase, identity.codeHash);
      if (curseResult.error) return json({ error: curseResult.error.message }, 400);
      const profileWithTitle = {
        ...profile,
        active_title: profile.show_titles === false ? null : titleResult.title,
        active_titles: profile.show_titles === false ? [] : (titleResult.titles || []),
        active_curse: curseResult.curse,
        active_curses: curseResult.curses || [],
      };
      return json({
        role,
        name: identity.displayName,
        data: toPublicProfile(profileWithTitle, await getPublicProfileKey(identity.codeHash), true),
      });
}

// action: updateDisplayName
export async function handleUpdateDisplayName(ctx: AuthCtx) {
  const { body, identity, payload, role, supabase } = ctx;
      if (!identity.inviteId) return json({ error: "共享邀请码不能绑定个人昵称，请使用专属码" }, 403);
      const inviteCodeText = cleanText(body.inviteCode, 200);
      const isInitialBinding = !specialAccountRoles.has(role) && cleanText(identity.displayName, 200).toLowerCase() === inviteCodeText.toLowerCase();
      if (role !== "admin" && !isInitialBinding) return json({ error: "昵称为身份绑定字段，只有馆主可以更改" }, 403);

      const display = cleanDisplayName(payload.displayName, role);
      if (display.error || !display.name) return json({ error: display.error || "昵称不正确" }, 400);

      const { data, error } = await supabase
        .from("invite_codes")
        .update({ display_name: display.name })
        .eq("id", identity.inviteId)
        .select("id, role, display_name")
        .single();
      if (error?.code === "23505") return json({ error: "这个昵称已经有人绑定了" }, 409);
      if (error) return json({ error: error.message }, 400);

      await supabase
        .from("player_profiles")
        .update({ display_name: display.name, updated_at: new Date().toISOString() })
        .eq("invite_code_hash", identity.codeHash);

      return json({ role, label: roleLabels[role], name: data.display_name });
}

// action: saveProfile
export async function handleSaveProfile(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (specialAccountRoles.has(role)) return json({ error: "神明账号不建立信徒个人档案" }, 403);
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const faithGod = cleanText(payload.faithGod, 20);
      const faithPath = cleanText(payload.faithPath, 20);
      const profession = cleanText(payload.profession, 40);
      const items = cleanText(payload.items, 800);
      const ascensionScore = cleanScore(payload.ascensionScore);
      const audienceScore = cleanScore(payload.audienceScore);
      if (!faithGod || !faithPath || !profession) return json({ error: "个人档案缺少信仰或职业" }, 400);
      const expectedFaithPath = getFaithPathByGod(faithGod);
      const professionGod = getProfessionGod(profession);
      if (!expectedFaithPath) return json({ error: "请选择有效信仰神明" }, 400);
      if (faithPath !== expectedFaithPath) return json({ error: "信仰命途与神明不匹配" }, 400);
      if (!professionGod) return json({ error: "请选择有效职业" }, 400);
      if (professionGod !== faithGod) return json({ error: "职业必须选择当前信仰神明下的职业" }, 400);

      const { data: existing, error: readError } = await supabase
        .from("player_profiles")
        .select("faith_god, faith_path, original_faith_god, original_faith_path, profession, ascension_score, audience_score, items, talents, scores_locked_at")
        .eq("invite_code_hash", identity.codeHash)
        .maybeSingle();
      if (readError?.code === "42P01") return json({ error: "请先运行 player_profiles_migration.sql" }, 400);
      if (readError) return json({ error: readError.message }, 400);

      const canOverride = role === "admin";
      const locked = !canOverride && existing?.faith_god && !hasTrickeryFaithPrivilege(existing) && !isProfileBindingMismatched(existing);
      const existingIsTrickery = !!existing && hasTrickeryFaithPrivilege(existing);
      const nextFaithGod = existingIsTrickery
        ? (existing.original_faith_god || existing.faith_god || "欺诈")
        : (locked ? existing.faith_god : faithGod);
      const nextFaithPath = existingIsTrickery
        ? (existing.original_faith_path || getFaithPathByGod(String(nextFaithGod)) || existing.faith_path || "虚无")
        : (locked ? existing.faith_path : faithPath);
      const nextProfession = existingIsTrickery
        ? existing.profession
        : (locked ? existing.profession : profession);
      const nextOriginalFaithGod = existing?.original_faith_god || faithGod;
      const nextOriginalFaithPath = existing?.original_faith_path || faithPath;
      const nextAscension = canOverride
        ? ascensionScore
        : (existing?.ascension_score ?? defaultAscensionScore);
      const nextAudience = canOverride
        ? audienceScore
        : (existing?.audience_score ?? defaultAudienceScore);
      const nextTalents = existing?.talents ?? "";
      const nextScoresLockedAt = canOverride
        ? (existing?.scores_locked_at ?? null)
        : (existing?.scores_locked_at || new Date().toISOString());

      const { data, error } = await supabase
        .from("player_profiles")
        .upsert({
          invite_code_hash: identity.codeHash,
          display_name: identity.displayName,
          role,
          faith_god: nextFaithGod,
          faith_path: nextFaithPath,
          original_faith_god: nextOriginalFaithGod,
          original_faith_path: nextOriginalFaithPath,
          profession: nextProfession,
          ascension_score: nextAscension,
          audience_score: nextAudience,
          items,
          talents: nextTalents,
          scores_locked_at: nextScoresLockedAt,
          updated_at: new Date().toISOString(),
        })
        .select("display_name, role, faith_god, faith_path, original_faith_god, original_faith_path, profession, ascension_score, audience_score, items, talents, show_titles, scores_locked_at, updated_at")
        .single();
      if (error?.code === "42P01") return json({ error: "请先运行 player_profiles_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);

      const talentRebalance = await rebalanceTalentPoolsAfterProfileChange(supabase, identity.codeHash, existing, data);
      if (talentRebalance.error) return json({ error: talentRebalance.error.message }, 400);
      let profileData = data;
      if (talentRebalance.removedPoolKeys.length) {
        const talentTextUpdate = await updateProfileTalentText(supabase, identity.codeHash);
        if (talentTextUpdate.error) return json({ error: talentTextUpdate.error.message }, 400);
        profileData = {
          ...data,
          talents: talentTextUpdate.talentText ?? data.talents,
        };
      }

      const titleResult = await getActiveTitleForHash(supabase, identity.codeHash);
      if (titleResult.error) return json({ error: titleResult.error.message }, 400);
      const curseResult = await getActiveCurseForHash(supabase, identity.codeHash);
      if (curseResult.error) return json({ error: curseResult.error.message }, 400);
      const dataWithTitle = {
        ...profileData,
        active_title: titleResult.title,
        active_titles: titleResult.titles || [],
        active_curse: curseResult.curse,
        active_curses: curseResult.curses || [],
      };

      return json({ role, name: identity.displayName, data: dataWithTitle });
}

// action: setProfileTitleVisibility
export async function handleSetProfileTitleVisibility(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (specialAccountRoles.has(role)) return json({ error: "神明账号不建立信徒个人档案" }, 403);
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);
      if (typeof payload.showTitles !== "boolean") return json({ error: "称号佩戴状态不正确" }, 400);

      const { data, error } = await supabase
        .from("player_profiles")
        .update({ show_titles: payload.showTitles, updated_at: new Date().toISOString() })
        .eq("invite_code_hash", identity.codeHash)
        .select("show_titles, updated_at")
        .maybeSingle();
      if (error?.code === "42703") return json({ error: "请先运行 profile_title_visibility_migration_20260727.sql" }, 400);
      if (error) return json({ error: error.message }, 400);
      if (!data) return json({ error: "请先保存个人档案，再设置称号佩戴状态" }, 400);
      return json({ role, name: identity.displayName, data });
}

// action: updateTrickeryFaith
export async function handleUpdateTrickeryFaith(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (specialAccountRoles.has(role)) return json({ error: "神明账号不建立信徒个人档案" }, 403);
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const faithGod = cleanText(payload.faithGod, 20);
      const faithPath = getFaithPathByGod(faithGod);
      const profession = cleanText(payload.profession, 40);
      if (!faithGod || !faithPath) return json({ error: "请选择有效信仰神明" }, 400);
      if (!profession || getProfessionGod(profession) !== faithGod) return json({ error: "展示职业必须属于当前展示信仰" }, 400);

      const { data: existing, error: readError } = await supabase
        .from("player_profiles")
        .select("faith_god, faith_path, original_faith_god, original_faith_path, profession")
        .eq("invite_code_hash", identity.codeHash)
        .maybeSingle();
      if (readError?.code === "42P01") return json({ error: "请先运行 player_profiles_migration.sql" }, 400);
      if (readError) return json({ error: readError.message }, 400);
      if (!existing) return json({ error: "请先保存个人档案" }, 400);
      if (role !== "admin" && !hasTrickeryFaithPrivilege(existing) && !isProfileBindingMismatched(existing)) {
        return json({ error: "只有欺诈信徒可以改写信仰档纹" }, 403);
      }

      const { data, error } = await supabase
        .from("player_profiles")
        .update({
          trickery_display_faith_god: faithGod,
          trickery_display_faith_path: faithPath,
          trickery_display_profession: profession,
          updated_at: new Date().toISOString(),
        })
        .eq("invite_code_hash", identity.codeHash)
        .select("display_name, role, faith_god, faith_path, original_faith_god, original_faith_path, trickery_display_faith_god, trickery_display_faith_path, trickery_display_profession, profession, ascension_score, audience_score, items, talents, show_titles, scores_locked_at, updated_at")
        .single();
      if (error?.code === "42703") return json({ error: "请先运行 trickery_display_profile_migration_20260719.sql" }, 400);
      if (error) return json({ error: error.message }, 400);
      if (!data) return json({ error: "请先保存个人档案" }, 400);

      const titleResult = await getActiveTitleForHash(supabase, identity.codeHash);
      if (titleResult.error) return json({ error: titleResult.error.message }, 400);
      const curseResult = await getActiveCurseForHash(supabase, identity.codeHash);
      if (curseResult.error) return json({ error: curseResult.error.message }, 400);
      return json({
        role,
        name: identity.displayName,
        data: {
          ...data,
          active_title: titleResult.title,
          active_titles: titleResult.titles || [],
          active_curse: curseResult.curse,
          active_curses: curseResult.curses || [],
        },
      });
}

// action: redeemPromoCode
export async function handleRedeemPromoCode(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (specialAccountRoles.has(role)) return json({ error: "星途账号不使用兑换口令" }, 403);
      const codeText = cleanText(payload.codeText ?? payload.code, 120);
      if (!codeText) return json({ error: "请输入兑换口令" }, 400);

      const { data, error } = await supabase.rpc("redeem_promo_code", {
        p_code_text: codeText,
        p_invite_code_hash: identity.codeHash,
      });
      if (error?.code === "42883" || error?.code === "PGRST202") return json({ error: "请先运行 promo_code_redemption_20260811.sql" }, 400);
      if (error) return json({ error: error.message }, 400);
      const result = Array.isArray(data) ? data[0] : data;
      if (!result?.ok) return json({ error: result?.error || "兑换失败" }, 400);
      return json({ role, name: identity.displayName, data: result });
}

// action: getPublicProfile
export async function handleGetPublicProfile(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin", "god", "astral"])) return json({ error: "需要入局谕令" }, 403);

      const profileKey = cleanText(payload.profileKey ?? payload.profile_key, 96);
      if (!/^[a-f0-9]{64}$/i.test(profileKey)) return json({ error: "公开档案标识不正确" }, 400);

      const { data: profiles, error: profileError } = await supabase
        .from("player_profiles")
        .select("invite_code_hash, display_name, role, faith_god, faith_path, original_faith_god, original_faith_path, trickery_display_faith_god, trickery_display_faith_path, trickery_display_profession, profession, ascension_score, audience_score, items, talents, show_titles, updated_at")
        .order("ascension_score", { ascending: false })
        .limit(1000);
      if (profileError?.code === "42P01") return json({ error: "请先运行 player_profiles_migration.sql" }, 400);
      if (profileError) return json({ error: profileError.message }, 400);

      let targetProfile: Record<string, unknown> | null = null;
      let matchedProfileKey = "";
      for (const profile of profiles || []) {
        const nextProfileKey = await getPublicProfileKey((profile as Record<string, unknown>).invite_code_hash);
        if (nextProfileKey === profileKey) {
          targetProfile = profile as Record<string, unknown>;
          matchedProfileKey = nextProfileKey;
          break;
        }
      }
      if (!targetProfile) return json({ error: "公开档案不存在或尚未保存" }, 404);

      const targetInviteHash = cleanText(targetProfile.invite_code_hash, 64);
      const targetDisplayName = cleanText(targetProfile.display_name, 40);
      const titleResult = await getActiveTitleForHash(supabase, targetInviteHash);
      if (titleResult.error) return json({ error: titleResult.error.message }, 400);
      const curseResult = await getActiveCurseForHash(supabase, targetInviteHash);
      if (curseResult.error) return json({ error: curseResult.error.message }, 400);
      targetProfile.active_title = targetProfile.show_titles === false ? null : titleResult.title;
      targetProfile.active_titles = targetProfile.show_titles === false ? [] : (titleResult.titles || []);
      targetProfile.active_curse = curseResult.curse;
      let clearRecords: Record<string, unknown>[] = [];
      const clearResult = await supabase
        .from("clear_records")
        .select("id, dungeon_id, run_number, feedback_tags, feedback_note, created_at")
        .eq("invite_code_hash", targetInviteHash)
        .order("created_at", { ascending: false })
        .limit(12);
      if (clearResult.error) {
        if (clearResult.error.code !== "42P01") return json({ error: clearResult.error.message }, 400);
      } else {
        clearRecords = (clearResult.data || []) as Record<string, unknown>[];
      }

      const dungeonFields = "id, name, creator, difficulty, type, participant_count, run_count, clear_count, clear_rate, avg_rating, rating_count, comment_count, created_at, is_one_shot";
      const dungeonFieldsWithCoCreators = "id, name, creator, co_creators, difficulty, type, participant_count, run_count, clear_count, clear_rate, avg_rating, rating_count, comment_count, created_at, is_one_shot";
      const clearDungeonIds = [...new Set(clearRecords.map((record) => cleanText(record.dungeon_id, 80)).filter(isUuid))];
      const clearDungeonById = new Map<string, Record<string, unknown>>();
      if (clearDungeonIds.length) {
        const { data: clearDungeons, error: clearDungeonError } = await supabase
          .from("dungeons")
          .select(dungeonFields)
          .in("id", clearDungeonIds);
        if (clearDungeonError) return json({ error: clearDungeonError.message }, 400);
        for (const dungeon of clearDungeons || []) {
          clearDungeonById.set(cleanText((dungeon as Record<string, unknown>).id, 80), dungeon as Record<string, unknown>);
        }
      }

      const authoredById = new Map<string, Record<string, unknown>>();
      const addAuthoredRows = (rows: Record<string, unknown>[] | null | undefined) => {
        for (const dungeon of rows || []) {
          const id = cleanText(dungeon.id, 80);
          if (id && !authoredById.has(id)) authoredById.set(id, dungeon);
        }
      };
      if (targetInviteHash) {
        const byInviteHash = await supabase
          .from("dungeons")
          .select(dungeonFieldsWithCoCreators)
          .eq("invite_code_hash", targetInviteHash)
          .order("created_at", { ascending: false })
          .limit(100);
        if (byInviteHash.error) {
          if (byInviteHash.error.code !== "42703") return json({ error: byInviteHash.error.message }, 400);
        } else {
          addAuthoredRows((byInviteHash.data || []) as Record<string, unknown>[]);
        }
      }
      if (targetDisplayName) {
        const byInviteName = await supabase
          .from("dungeons")
          .select(dungeonFields)
          .eq("invite_name", targetDisplayName)
          .order("created_at", { ascending: false })
          .limit(12);
        if (byInviteName.error) {
          if (byInviteName.error.code !== "42703") return json({ error: byInviteName.error.message }, 400);
        } else {
          addAuthoredRows((byInviteName.data || []) as Record<string, unknown>[]);
        }

        const byCreator = await supabase
          .from("dungeons")
          .select(dungeonFields)
          .eq("creator", targetDisplayName)
          .order("created_at", { ascending: false })
          .limit(12);
        if (byCreator.error) return json({ error: byCreator.error.message }, 400);
        addAuthoredRows((byCreator.data || []) as Record<string, unknown>[]);

        const byCoCreator = await supabase
          .from("dungeons")
          .select(dungeonFieldsWithCoCreators)
          .contains("co_creators", [targetDisplayName])
          .order("created_at", { ascending: false })
          .limit(12);
        if (byCoCreator.error) {
          if (!isMissingCoCreatorsColumn(byCoCreator.error)) return json({ error: byCoCreator.error.message }, 400);
        } else {
          addAuthoredRows((byCoCreator.data || []) as Record<string, unknown>[]);
        }
      }

      const publicClearRecords = clearRecords.map((record) => {
        const dungeonId = cleanText(record.dungeon_id, 80);
        const tags = Array.isArray(record.feedback_tags)
          ? record.feedback_tags.map((tag) => cleanText(tag, 20)).filter(Boolean)
          : [];
        return {
          id: cleanText(record.id, 80),
          dungeon_id: dungeonId,
          run_number: Number(record.run_number || 1),
          feedback_tags: tags,
          feedback_note: cleanText(record.feedback_note, 160),
          created_at: cleanText(record.created_at, 80),
          dungeon: toPublicDungeonSummary(clearDungeonById.get(dungeonId)),
        };
      });
      const authoredDungeons = [...authoredById.values()]
        .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
        .slice(0, 12)
        .map(toPublicDungeonSummary)
        .filter(Boolean);
      const uniqueClearDungeonCount = new Set(publicClearRecords.map((record) => record.dungeon_id).filter(Boolean)).size;
      const authoredCommentCount = authoredDungeons.reduce((sum, dungeon) => sum + Number((dungeon as Record<string, unknown>).comment_count || 0), 0);
      const avgAuthoredRating = authoredDungeons.length
        ? authoredDungeons.reduce((sum, dungeon) => sum + Number((dungeon as Record<string, unknown>).avg_rating || 0), 0) / authoredDungeons.length
        : 0;

      return json({
        role,
        name: identity.displayName,
        data: {
          profileKey: matchedProfileKey,
          profile: toPublicProfile(targetProfile, matchedProfileKey, targetInviteHash === identity.codeHash),
          clearRecords: publicClearRecords,
          authoredDungeons,
          stats: {
            clearRecordCount: publicClearRecords.length,
            uniqueClearDungeonCount,
            authoredCount: authoredDungeons.length,
            authoredCommentCount,
            avgAuthoredRating,
          },
        },
      });
}

// action: grantProfileTitle
export async function handleGrantProfileTitle(ctx: AuthCtx) {
  const { action, identity, payload, role, supabase } = ctx;
      if (!canGrantTitles(identity)) return json({ error: "需要馆主或神明谕令" }, 403);

      const targetResult = await getProfileByDisplayName(supabase, payload.targetName);
      if (targetResult.error) {
        if (targetResult.error.code === "42P01") return json({ error: "请先运行 player_profiles_migration.sql" }, 400);
        return json({ error: targetResult.error.message }, 400);
      }

      const target = targetResult.data as Record<string, unknown>;
      const targetHash = cleanText(target.invite_code_hash, 64);
      const titleText = cleanText(payload.titleText, 32);
      const titleGod = getTitleGrantGod(identity, payload.titleGod);
      const titleNote = cleanText(payload.titleNote, 120);
      if (!targetHash || !titleText) return json({ error: "请填写受封昵称和称号" }, 400);
      if (specialAccountRoles.has(role) && cleanText(target.faith_god, 20) !== identity.displayName) {
        return json({ error: "神明只能为对应信徒降下称号" }, 403);
      }

      const { data, error } = await supabase
        .from("profile_titles")
        .insert({
          invite_code_hash: targetHash,
          display_name: cleanText(target.display_name, 40),
          title_text: titleText,
          title_god: titleGod,
          title_note: titleNote,
          granted_by_type: specialAccountRoles.has(role) || titleGod ? "god" : "admin",
          granted_by_hash: identity.codeHash,
          granted_by_name: identity.displayName,
          is_active: true,
        })
        .select("id, title_text, title_god, title_note, granted_by_type, granted_by_name, granted_at")
        .single();
      if (error?.code === "42P01") return json({ error: "请先运行 profile_titles_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);
      await writeAdminOperationLog(supabase, identity, {
        action: "title.grant", targetCodeHash: targetHash, targetName: target.display_name, objectType: "profile_title", objectId: data.id,
        summary: `授予称号「${titleText}」`, afterState: { title: titleText, god: titleGod, note: titleNote },
      });

      return json({
        role,
        name: identity.displayName,
        data: {
          targetName: cleanText(target.display_name, 40),
          activeTitle: toPublicTitle(data as Record<string, unknown>),
          activeTitles: [toPublicTitle(data as Record<string, unknown>)].filter(Boolean),
        },
      });
}

// action: grantBetrayalCurse
export async function handleGrantBetrayalCurse(ctx: AuthCtx) {
  const { action, identity, payload, role, supabase } = ctx;
      if (!canGrantTitles(identity)) return json({ error: "需要馆主或神明谕令" }, 403);

      const targetResult = await getProfileByDisplayName(supabase, payload.targetName);
      if (targetResult.error) {
        if (targetResult.error.code === "42P01") return json({ error: "请先运行 player_profiles_migration.sql" }, 400);
        return json({ error: targetResult.error.message }, 400);
      }

      const target = targetResult.data as Record<string, unknown>;
      const targetHash = cleanText(target.invite_code_hash, 64);
      const targetFaithGod = cleanText(target.faith_god, 20);
      const curseGod = getTitleGrantGod(identity, payload.curseGod || payload.titleGod);
      const curseNote = cleanText(payload.curseNote ?? payload.titleNote, 120);
      const curseType = normalizeCurseType(payload.curseType ?? payload.curse_type);
      const isBetrayalCurse = curseType === "betrayal";
      const curseText = cleanText(payload.curseText, 32) || (isBetrayalCurse ? "背弃诅咒" : "普通诅咒");
      if (!targetHash) return json({ error: "请填写受诅昵称" }, 400);
      if (!curseGod) return json({ error: "请选择诅咒名义" }, 400);
      if (specialAccountRoles.has(role) && isBetrayalCurse && (!targetFaithGod || targetFaithGod === identity.displayName)) {
        return json({ error: "对应神明只能对已改信者下放背弃诅咒" }, 403);
      }

      const apostateTitle = "背弃者";
      const { data: curseData, error: curseError } = await supabase
        .from("profile_curses")
        .insert({
          invite_code_hash: targetHash,
          display_name: cleanText(target.display_name, 40),
          curse_text: curseText,
          curse_god: curseGod,
          curse_note: curseNote,
          curse_type: curseType,
          granted_by_type: specialAccountRoles.has(role) || curseGod ? "god" : "admin",
          granted_by_hash: identity.codeHash,
          granted_by_name: identity.displayName,
          is_active: true,
        })
        .select("id, curse_text, curse_god, curse_note, curse_type, granted_by_type, granted_by_name, granted_at")
        .single();
      if (curseError?.code === "42P01") return json({ error: "请先运行 profile_curses_migration.sql" }, 400);
      if (curseError) return json({ error: curseError.message }, 400);

      let titleData: Record<string, unknown> | null = null;
      if (isBetrayalCurse) {
        const titleResult = await supabase
          .from("profile_titles")
          .insert({
            invite_code_hash: targetHash,
            display_name: cleanText(target.display_name, 40),
            title_text: apostateTitle,
            title_god: curseGod,
            title_note: curseNote || curseText,
            granted_by_type: "god",
            granted_by_hash: identity.codeHash,
            granted_by_name: identity.displayName,
            is_active: true,
          })
          .select("id, title_text, title_god, title_note, granted_by_type, granted_by_name, granted_at")
          .single();
        if (titleResult.error?.code === "42P01") return json({ error: "请先运行 profile_titles_migration.sql" }, 400);
        if (titleResult.error) return json({ error: titleResult.error.message }, 400);
        titleData = titleResult.data as Record<string, unknown>;
      }
      await writeAdminOperationLog(supabase, identity, {
        action: "curse.grant", targetCodeHash: targetHash, targetName: target.display_name, objectType: "profile_curse", objectId: curseData.id,
        summary: isBetrayalCurse ? `下放背弃诅咒「${curseText}」，并授予「${apostateTitle}」` : `下放普通诅咒「${curseText}」`,
        afterState: { curse: curseText, curseType, title: isBetrayalCurse ? apostateTitle : "", god: curseGod, note: curseNote },
      });

      return json({
        role,
        name: identity.displayName,
        data: {
          targetName: cleanText(target.display_name, 40),
          curseType,
          grantedTitle: isBetrayalCurse ? apostateTitle : "",
          activeTitle: toPublicTitle(titleData),
          activeTitles: [toPublicTitle(titleData)].filter(Boolean),
          activeCurse: toPublicCurse(curseData as Record<string, unknown>),
          activeCurses: [toPublicCurse(curseData as Record<string, unknown>)].filter(Boolean),
        },
      });
}

// action: revokeProfileTitle
export async function handleRevokeProfileTitle(ctx: AuthCtx) {
  const { action, identity, payload, role, supabase } = ctx;
      if (!canGrantTitles(identity)) return json({ error: "需要馆主或神明谕令" }, 403);

      const targetResult = await getProfileByDisplayName(supabase, payload.targetName);
      if (targetResult.error) {
        if (targetResult.error.code === "42P01") return json({ error: "请先运行 player_profiles_migration.sql" }, 400);
        return json({ error: targetResult.error.message }, 400);
      }

      const target = targetResult.data as Record<string, unknown>;
      const targetHash = cleanText(target.invite_code_hash, 64);
      const titleText = cleanText(payload.titleText, 32);
      const titleId = cleanBigIntId(payload.titleId);
      let activeTitleQuery = supabase
        .from("profile_titles")
        .select("id, title_text, title_god, granted_by_hash")
        .eq("invite_code_hash", targetHash)
        .eq("is_active", true)
        .order("granted_at", { ascending: false })
        .limit(1);
      if (titleText) activeTitleQuery = activeTitleQuery.eq("title_text", titleText);
      if (titleId) activeTitleQuery = activeTitleQuery.eq("id", titleId);
      const { data: activeTitles, error: activeTitleError } = await activeTitleQuery;
      if (activeTitleError?.code === "42P01") return json({ error: "请先运行 profile_titles_migration.sql" }, 400);
      if (activeTitleError) return json({ error: activeTitleError.message }, 400);
      const activeTitle = (activeTitles || [])[0];
      if (!activeTitle) return json({ error: "这个玩家当前没有生效称号" }, 404);
      if (
        specialAccountRoles.has(role) &&
        cleanText((activeTitle as Record<string, unknown>).granted_by_hash, 64) !== identity.codeHash &&
        cleanText((activeTitle as Record<string, unknown>).title_god, 20) !== identity.displayName
      ) {
        return json({ error: "神明只能回收本神名义下的称号" }, 403);
      }

      const { data, error } = await supabase
        .from("profile_titles")
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoked_by_hash: identity.codeHash,
          revoked_by_name: identity.displayName,
        })
        .eq("id", (activeTitle as Record<string, unknown>).id)
        .select("id, title_text")
        .maybeSingle();
      if (error) return json({ error: error.message }, 400);
      if (!data) return json({ error: "这个玩家当前没有生效称号" }, 404);
      await writeAdminOperationLog(supabase, identity, {
        action: "title.revoke", targetCodeHash: targetHash, targetName: target.display_name, objectType: "profile_title", objectId: data.id,
        summary: `回收称号「${cleanText((data as Record<string, unknown>).title_text, 32)}」`, beforeState: { isActive: true }, afterState: { isActive: false },
      });

      return json({
        role,
        name: identity.displayName,
        data: {
          targetName: cleanText(target.display_name, 40),
          revokedTitle: cleanText((data as Record<string, unknown>).title_text, 32),
        },
      });
}

// action: restoreProfileTitle
export async function handleRestoreProfileTitle(ctx: AuthCtx) {
  const { action, identity, payload, role, supabase } = ctx;
      if (role !== "admin") return json({ error: "只有神谕馆主可以恢复称号" }, 403);
      const targetResult = await getProfileByDisplayName(supabase, payload.targetName);
      if (targetResult.error) return json({ error: targetResult.error.message || "玩家档案读取失败" }, 400);
      const target = targetResult.data as Record<string, unknown>;
      const targetHash = cleanText(target.invite_code_hash, 64);
      const titleId = cleanBigIntId(payload.titleId);
      if (!titleId) return json({ error: "称号记录不正确" }, 400);
      const { data, error } = await supabase
        .from("profile_titles")
        .update({ is_active: true, revoked_at: null, revoked_by_hash: null, revoked_by_name: null })
        .eq("id", titleId)
        .eq("invite_code_hash", targetHash)
        .eq("is_active", false)
        .select("id, title_text")
        .maybeSingle();
      if (error?.code === "42P01") return json({ error: "请先运行 profile_titles_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);
      if (!data) return json({ error: "未找到可恢复的已回收称号" }, 404);
      await writeAdminOperationLog(supabase, identity, {
        action: "title.restore", targetCodeHash: targetHash, targetName: target.display_name, objectType: "profile_title", objectId: data.id,
        summary: `恢复称号「${cleanText((data as Record<string, unknown>).title_text, 32)}」`, beforeState: { isActive: false }, afterState: { isActive: true },
      });
      return json({ role, name: identity.displayName, data: { targetName: cleanText(target.display_name, 40), restoredTitle: cleanText((data as Record<string, unknown>).title_text, 32) } });
}

// action: restoreProfileCurse
export async function handleRestoreProfileCurse(ctx: AuthCtx) {
  const { action, identity, payload, role, supabase } = ctx;
      if (role !== "admin") return json({ error: "只有神谕馆主可以恢复诅咒" }, 403);
      const targetResult = await getProfileByDisplayName(supabase, payload.targetName);
      if (targetResult.error) return json({ error: targetResult.error.message || "玩家档案读取失败" }, 400);
      const target = targetResult.data as Record<string, unknown>;
      const targetHash = cleanText(target.invite_code_hash, 64);
      const curseId = cleanBigIntId(payload.curseId);
      if (!curseId) return json({ error: "诅咒记录不正确" }, 400);
      const { data, error } = await supabase
        .from("profile_curses")
        .update({ is_active: true, revoked_at: null, revoked_by_hash: null, revoked_by_name: null })
        .eq("id", curseId)
        .eq("invite_code_hash", targetHash)
        .eq("is_active", false)
        .select("id, curse_text")
        .maybeSingle();
      if (error?.code === "42P01") return json({ error: "请先运行 profile_curses_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);
      if (!data) return json({ error: "未找到可恢复的已回收诅咒" }, 404);
      await writeAdminOperationLog(supabase, identity, {
        action: "curse.restore", targetCodeHash: targetHash, targetName: target.display_name, objectType: "profile_curse", objectId: data.id,
        summary: `恢复诅咒「${cleanText((data as Record<string, unknown>).curse_text, 32)}」`, beforeState: { isActive: false }, afterState: { isActive: true },
      });
      return json({ role, name: identity.displayName, data: { targetName: cleanText(target.display_name, 40), restoredCurse: cleanText((data as Record<string, unknown>).curse_text, 32) } });
}

// action: revokeProfileCurse
export async function handleRevokeProfileCurse(ctx: AuthCtx) {
  const { action, identity, payload, role, supabase } = ctx;
      if (!canGrantTitles(identity)) return json({ error: "需要馆主或神明谕令" }, 403);

      const targetResult = await getProfileByDisplayName(supabase, payload.targetName);
      if (targetResult.error) {
        if (targetResult.error.code === "42P01") return json({ error: "请先运行 player_profiles_migration.sql" }, 400);
        return json({ error: targetResult.error.message }, 400);
      }

      const target = targetResult.data as Record<string, unknown>;
      const targetHash = cleanText(target.invite_code_hash, 64);
      const curseText = cleanText(payload.curseText, 32);
      const curseId = cleanBigIntId(payload.curseId);
      let activeCurseQuery = supabase
        .from("profile_curses")
        .select("id, curse_text, curse_god, granted_by_hash")
        .eq("invite_code_hash", targetHash)
        .eq("is_active", true)
        .order("granted_at", { ascending: false })
        .limit(1);
      if (curseText) activeCurseQuery = activeCurseQuery.eq("curse_text", curseText);
      if (curseId) activeCurseQuery = activeCurseQuery.eq("id", curseId);
      const { data: activeCurses, error: activeCurseError } = await activeCurseQuery;
      if (activeCurseError?.code === "42P01") return json({ error: "请先运行 profile_curses_migration.sql" }, 400);
      if (activeCurseError) return json({ error: activeCurseError.message }, 400);
      const activeCurse = (activeCurses || [])[0];
      if (!activeCurse) return json({ error: "这个玩家当前没有生效诅咒" }, 404);
      if (
        specialAccountRoles.has(role) &&
        cleanText((activeCurse as Record<string, unknown>).granted_by_hash, 64) !== identity.codeHash &&
        cleanText((activeCurse as Record<string, unknown>).curse_god, 20) !== identity.displayName
      ) {
        return json({ error: "神明只能回收本神名义下的诅咒" }, 403);
      }

      const { data, error } = await supabase
        .from("profile_curses")
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoked_by_hash: identity.codeHash,
          revoked_by_name: identity.displayName,
        })
        .eq("id", (activeCurse as Record<string, unknown>).id)
        .select("id, curse_text")
        .maybeSingle();
      if (error) return json({ error: error.message }, 400);
      if (!data) return json({ error: "这个玩家当前没有生效诅咒" }, 404);
      await writeAdminOperationLog(supabase, identity, {
        action: "curse.revoke", targetCodeHash: targetHash, targetName: target.display_name, objectType: "profile_curse", objectId: data.id,
        summary: `回收诅咒「${cleanText((data as Record<string, unknown>).curse_text, 32)}」`, beforeState: { isActive: true }, afterState: { isActive: false },
      });

      return json({
        role,
        name: identity.displayName,
        data: {
          targetName: cleanText(target.display_name, 40),
          revokedCurse: cleanText((data as Record<string, unknown>).curse_text, 32),
        },
      });
}

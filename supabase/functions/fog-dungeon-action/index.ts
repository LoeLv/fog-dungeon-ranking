import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type InviteRole = "player" | "author" | "admin";

type RequestBody = {
  action?: string;
  inviteCode?: string;
  payload?: Record<string, unknown>;
};

type InviteIdentity = {
  role: InviteRole;
  codeHash: string;
  displayName: string;
  inviteId?: string;
};

const roleLabels: Record<InviteRole, string> = {
  player: "玩家",
  author: "作者",
  admin: "馆主",
};

const feedbackTagAllowlist = new Set([
  "机制清楚",
  "剧情好",
  "氛围强",
  "有挑战",
  "偏难",
  "想再跑",
  "需要修订",
]);

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function cleanDisplayName(value: unknown, role: InviteRole) {
  const name = cleanText(value, 16).replace(/\s+/g, " ");
  if (!name || name.length < 1) return { error: "昵称不能为空" };
  if (/[<>@#]/.test(name)) return { error: "昵称不能包含特殊符号" };
  const reserved = ["馆主", "官方", "管理员", "系统"];
  if (role !== "admin" && reserved.some((word) => name.includes(word))) {
    return { error: "这个昵称像管理身份，换一个吧" };
  }
  return { name };
}

function cleanScore(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(999999, Math.round(number * 10) / 10));
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hashBuffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function getInviteIdentity(
  supabase: ReturnType<typeof createClient>,
  inviteCode: unknown,
): Promise<InviteIdentity | null> {
  const code = cleanText(inviteCode, 200);
  if (!code) return null;
  const codeHash = await sha256Hex(code);

  const { data } = await supabase
    .from("invite_codes")
    .select("id, role, display_name, is_active")
    .eq("code_hash", codeHash)
    .maybeSingle();

  const roleFromTable = data?.role as InviteRole | undefined;
  if (data?.is_active && roleFromTable && ["player", "author", "admin"].includes(roleFromTable)) {
    await supabase
      .from("invite_codes")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id);
    return {
      role: roleFromTable,
      codeHash,
      displayName: cleanText(data.display_name, 40) || roleLabels[roleFromTable],
      inviteId: data.id,
    };
  }

  const adminCode = Deno.env.get("DUNGEON_ADMIN_CODE")?.trim();
  const authorCode = Deno.env.get("DUNGEON_AUTHOR_CODE")?.trim();
  const playerCode = Deno.env.get("DUNGEON_PLAYER_CODE")?.trim();

  if (adminCode && code === adminCode) return { role: "admin", codeHash, displayName: "共享馆主码" };
  if (authorCode && code === authorCode) return { role: "author", codeHash, displayName: "共享作者码" };
  if (playerCode && code === playerCode) return { role: "player", codeHash, displayName: "共享玩家码" };
  return null;
}

function hasRole(role: InviteRole, allowed: InviteRole[]) {
  return allowed.includes(role);
}

function isMissingInviteColumn(error: { code?: string; message?: string } | null) {
  return error?.code === "42703" && (
    error?.message?.includes("invite_code_hash") ||
    error?.message?.includes("invite_name")
  );
}

function isMissingForumColumn(error: { code?: string; message?: string } | null) {
  return error?.code === "42703";
}

function cleanFeedbackTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  const tags = value
    .map((item) => cleanText(item, 20))
    .filter((tag) => feedbackTagAllowlist.has(tag));
  return [...new Set(tags)].slice(0, 5);
}

async function recalculateClearStats(
  supabase: ReturnType<typeof createClient>,
  dungeonId: string,
) {
  const { data: dungeon, error: dungeonError } = await supabase
    .from("dungeons")
    .select("participant_count, run_count")
    .eq("id", dungeonId)
    .single();
  if (dungeonError) return { error: dungeonError };

  const { count, error: countError } = await supabase
    .from("clear_records")
    .select("id", { count: "exact", head: true })
    .eq("dungeon_id", dungeonId);
  if (countError) return { error: countError };

  const participantCount = Number(dungeon.participant_count) || 0;
  const runCount = Number(dungeon.run_count) || 1;
  const clearCount = count ?? 0;
  const totalSlots = participantCount * runCount;
  const clearRate = totalSlots > 0 ? Math.round((clearCount / totalSlots) * 10000) / 100 : 0;

  const { data, error } = await supabase
    .from("dungeons")
    .update({ clear_count: clearCount, clear_rate: clearRate })
    .eq("id", dungeonId)
    .select()
    .single();

  return { data, error };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "只接受 POST 请求" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "后端环境变量缺失" }, 500);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "请求格式不正确" }, 400);
  }

  const action = cleanText(body.action, 40);
  const payload = body.payload ?? {};
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const identity = await getInviteIdentity(supabase, body.inviteCode);
  if (!identity) return json({ error: "邀请码无效或已过期" }, 401);
  const role = identity.role;

  try {
    if (action === "verifyInvite") {
      return json({ role, label: roleLabels[role], name: identity.displayName });
    }

    if (action === "updateDisplayName") {
      if (!identity.inviteId) return json({ error: "共享邀请码不能绑定个人昵称，请使用专属码" }, 403);

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

      return json({ role, label: roleLabels[role], name: data.display_name });
    }

    if (action === "saveProfile") {
      if (!hasRole(role, ["player", "author", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const faithGod = cleanText(payload.faithGod, 20);
      const faithPath = cleanText(payload.faithPath, 20);
      const profession = cleanText(payload.profession, 40);
      const items = cleanText(payload.items, 800);
      const talents = cleanText(payload.talents, 800);
      const ascensionScore = cleanScore(payload.ascensionScore);
      const audienceScore = cleanScore(payload.audienceScore);
      if (!faithGod || !faithPath || !profession) return json({ error: "个人档案缺少信仰或职业" }, 400);

      const { data: existing, error: readError } = await supabase
        .from("player_profiles")
        .select("faith_god, faith_path, profession, ascension_score, audience_score, scores_locked_at")
        .eq("invite_code_hash", identity.codeHash)
        .maybeSingle();
      if (readError?.code === "42P01") return json({ error: "请先运行 player_profiles_migration.sql" }, 400);
      if (readError) return json({ error: readError.message }, 400);

      const locked = existing?.faith_god && existing.faith_god !== "欺诈";
      const nextFaithGod = locked ? existing.faith_god : faithGod;
      const nextFaithPath = locked ? existing.faith_path : faithPath;
      const nextProfession = locked ? existing.profession : profession;
      const nextAscension = locked ? existing.ascension_score : ascensionScore;
      const nextAudience = locked ? existing.audience_score : audienceScore;
      const nextScoresLockedAt = nextFaithGod === "欺诈"
        ? null
        : (existing?.scores_locked_at || new Date().toISOString());

      const { data, error } = await supabase
        .from("player_profiles")
        .upsert({
          invite_code_hash: identity.codeHash,
          display_name: identity.displayName,
          role,
          faith_god: nextFaithGod,
          faith_path: nextFaithPath,
          profession: nextProfession,
          ascension_score: nextAscension,
          audience_score: nextAudience,
          items,
          talents,
          scores_locked_at: nextScoresLockedAt,
          updated_at: new Date().toISOString(),
        })
        .select("display_name, role, faith_god, faith_path, profession, ascension_score, audience_score, items, talents, scores_locked_at, updated_at")
        .single();
      if (error?.code === "42P01") return json({ error: "请先运行 player_profiles_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);

      return json({ role, name: identity.displayName, data });
    }

    if (action === "listProfiles") {
      if (!hasRole(role, ["player", "author", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const { data, error } = await supabase
        .from("player_profiles")
        .select("invite_code_hash, display_name, role, faith_god, faith_path, profession, ascension_score, audience_score, updated_at")
        .order("ascension_score", { ascending: false })
        .limit(300);
      if (error?.code === "42P01") return json({ error: "请先运行 player_profiles_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);

      return json({
        role,
        name: identity.displayName,
        data: (data || []).map(({ invite_code_hash: inviteCodeHash, ...profile }) => ({
          ...profile,
          is_current: inviteCodeHash === identity.codeHash,
        })),
      });
    }

    if (action === "submitDungeon") {
      if (!hasRole(role, ["author", "admin"])) return json({ error: "需要作者邀请码" }, 403);

      const name = cleanText(payload.name, 80);
      const creator = cleanText(payload.creator, 40);
      const description = cleanText(payload.description, 1800);
      const pinnedNote = cleanText(payload.pinnedNote, 800);
      const difficulty = cleanText(payload.difficulty, 20) || "超凡";
      const type = cleanText(payload.type, 20) || "综合";
      const participantCount = Number(payload.participantCount ?? payload.participant_count);
      const runCount = Number(payload.runCount ?? payload.run_count ?? 1);
      if (!name || !creator || !description) return json({ error: "请填写完整副本信息" }, 400);
      if (
        !Number.isInteger(participantCount) ||
        participantCount < 1 ||
        participantCount > 99
      ) {
        return json({ error: "固定人数不正确" }, 400);
      }
      if (!Number.isInteger(runCount) || runCount < 1 || runCount > 999) return json({ error: "当前周目不正确" }, 400);

      const { data, error } = await supabase
        .from("dungeons")
        .insert({
          name,
          creator,
          difficulty,
          type,
          description,
          pinned_note: pinnedNote,
          participant_count: participantCount,
          run_count: runCount,
          clear_count: 0,
          clear_rate: 0,
          invite_code_hash: identity.codeHash,
          invite_name: identity.displayName,
        })
        .select()
        .single();
      if (isMissingInviteColumn(error)) {
        const retry = await supabase
          .from("dungeons")
          .insert({ name, creator, difficulty, type, description })
          .select()
          .single();
        if (retry.error) return json({ error: retry.error.message }, 400);
        return json({ role, name: identity.displayName, data: retry.data });
      }
      if (isMissingForumColumn(error)) {
        const retry = await supabase
          .from("dungeons")
          .insert({
            name,
            creator,
            difficulty,
            type,
            description,
            participant_count: participantCount,
            run_count: runCount,
            clear_count: 0,
            clear_rate: 0,
            invite_code_hash: identity.codeHash,
            invite_name: identity.displayName,
          })
          .select()
          .single();
        if (retry.error) return json({ error: retry.error.message }, 400);
        return json({ role, name: identity.displayName, data: retry.data });
      }
      if (error) return json({ error: error.message }, 400);
      return json({ role, name: identity.displayName, data });
    }

    if (action === "markCleared") {
      if (!hasRole(role, ["player", "author", "admin"])) return json({ error: "需要玩家或作者邀请码" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      if (!isUuid(dungeonId)) return json({ error: "副本 ID 不正确" }, 400);

      const { data: dungeon, error: dungeonError } = await supabase
        .from("dungeons")
        .select("run_count")
        .eq("id", dungeonId)
        .single();
      if (dungeonError) return json({ error: dungeonError.message }, 400);
      const runNumber = Number(dungeon.run_count) || 1;
      const feedbackTags = cleanFeedbackTags(payload.feedbackTags);
      const feedbackNote = cleanText(payload.feedbackNote, 200);

      const { data: clearRecord, error } = await supabase
        .from("clear_records")
        .insert({
          dungeon_id: dungeonId,
          run_number: runNumber,
          invite_code_hash: identity.codeHash,
          invite_name: identity.displayName,
          feedback_tags: feedbackTags,
          feedback_note: feedbackNote,
        })
        .select()
        .single();
      if (error?.code === "23505") return json({ error: "你已经登记过本周目通过了" }, 409);
      if (isMissingForumColumn(error)) {
        const retry = await supabase
          .from("clear_records")
          .insert({
            dungeon_id: dungeonId,
            run_number: runNumber,
            invite_code_hash: identity.codeHash,
            invite_name: identity.displayName,
          })
          .select()
          .single();
        if (retry.error?.code === "23505") return json({ error: "你已经登记过本周目通过了" }, 409);
        if (retry.error) return json({ error: retry.error.message }, 400);
        const stats = await recalculateClearStats(supabase, dungeonId);
        if (stats.error) return json({ error: stats.error.message }, 400);
        return json({ role, name: identity.displayName, data: { clearRecord: retry.data, dungeon: stats.data } });
      }
      if (error) return json({ error: error.message }, 400);

      const stats = await recalculateClearStats(supabase, dungeonId);
      if (stats.error) return json({ error: stats.error.message }, 400);
      return json({ role, name: identity.displayName, data: { clearRecord, dungeon: stats.data } });
    }

    if (action === "advanceRun") {
      if (!hasRole(role, ["author", "admin"])) return json({ error: "需要作者邀请码" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      if (!isUuid(dungeonId)) return json({ error: "副本 ID 不正确" }, 400);

      const { data: dungeon, error } = await supabase
        .from("dungeons")
        .select("run_count")
        .eq("id", dungeonId)
        .single();
      if (error) return json({ error: error.message }, 400);

      const nextRun = (Number(dungeon.run_count) || 1) + 1;
      const { error: updateError } = await supabase
        .from("dungeons")
        .update({ run_count: nextRun })
        .eq("id", dungeonId);
      if (updateError) return json({ error: updateError.message }, 400);

      const stats = await recalculateClearStats(supabase, dungeonId);
      if (stats.error) return json({ error: stats.error.message }, 400);
      return json({ role, name: identity.displayName, data: stats.data });
    }

    if (action === "addRating") {
      if (!hasRole(role, ["player", "author", "admin"])) return json({ error: "需要玩家或作者邀请码" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      const rating = Number(payload.rating);
      if (!isUuid(dungeonId) || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        return json({ error: "评分参数不正确" }, 400);
      }

      const { data, error } = await supabase
        .from("ratings")
        .insert({
          dungeon_id: dungeonId,
          rating,
          invite_code_hash: identity.codeHash,
          invite_name: identity.displayName,
        })
        .select()
        .single();
      if (error?.code === "23505") return json({ error: "你已经评价过这个副本了" }, 409);
      if (isMissingInviteColumn(error)) {
        const retry = await supabase
          .from("ratings")
          .insert({ dungeon_id: dungeonId, rating })
          .select()
          .single();
        if (retry.error) return json({ error: retry.error.message }, 400);
        return json({ role, name: identity.displayName, data: retry.data });
      }
      if (error) return json({ error: error.message }, 400);
      return json({ role, name: identity.displayName, data });
    }

    if (action === "addComment") {
      if (!hasRole(role, ["player", "author", "admin"])) return json({ error: "需要玩家或作者邀请码" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      const authorInput = cleanText(payload.author, 40);
      const author = identity.inviteId ? identity.displayName : (authorInput || identity.displayName || "匿名探索者");
      const content = cleanText(payload.content, 800);
      const parentCommentId = cleanText(payload.parentCommentId, 80);
      if (!isUuid(dungeonId) || !content) return json({ error: "评论参数不正确" }, 400);
      if (parentCommentId) {
        if (!isUuid(parentCommentId)) return json({ error: "回复目标不正确" }, 400);
        const { data: parent, error: parentError } = await supabase
          .from("comments")
          .select("id, dungeon_id, is_deleted")
          .eq("id", parentCommentId)
          .single();
        if (isMissingForumColumn(parentError)) {
          return json({ error: "请先运行论坛功能数据库升级 SQL" }, 400);
        }
        if (parentError || parent?.dungeon_id !== dungeonId || parent?.is_deleted) {
          return json({ error: "回复目标不存在" }, 400);
        }
      }

      const { data, error } = await supabase
        .from("comments")
        .insert({
          dungeon_id: dungeonId,
          parent_comment_id: parentCommentId || null,
          author,
          content,
          invite_code_hash: identity.codeHash,
          invite_name: identity.displayName,
        })
        .select()
        .single();
      if (isMissingInviteColumn(error)) {
        const retry = await supabase
          .from("comments")
          .insert({ dungeon_id: dungeonId, author, content })
          .select()
          .single();
        if (retry.error) return json({ error: retry.error.message }, 400);
        return json({ role, name: identity.displayName, data: retry.data });
      }
      if (isMissingForumColumn(error)) {
        return json({ error: "请先运行论坛功能数据库升级 SQL" }, 400);
      }
      if (error) return json({ error: error.message }, 400);
      return json({ role, name: identity.displayName, data });
    }

    if (action === "deleteComment") {
      if (!hasRole(role, ["player", "author", "admin"])) return json({ error: "需要邀请码" }, 403);

      const commentId = cleanText(payload.commentId, 80);
      if (!isUuid(commentId)) return json({ error: "评论 ID 不正确" }, 400);

      const { data: comment, error: readError } = await supabase
        .from("comments")
        .select("id, invite_code_hash, is_deleted")
        .eq("id", commentId)
        .single();
      if (isMissingForumColumn(readError)) return json({ error: "请先运行论坛功能数据库升级 SQL" }, 400);
      if (readError) return json({ error: readError.message }, 400);
      if (comment.is_deleted) return json({ role, name: identity.displayName, data: comment });
      if (role !== "admin" && comment.invite_code_hash !== identity.codeHash) {
        return json({ error: "只能删除自己的评论" }, 403);
      }

      const { data, error } = await supabase
        .from("comments")
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          content: "此评论已被删除",
        })
        .eq("id", commentId)
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ role, name: identity.displayName, data });
    }

    if (action === "updatePinnedNote") {
      if (!hasRole(role, ["author", "admin"])) return json({ error: "需要作者或馆主邀请码" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      const pinnedNote = cleanText(payload.pinnedNote, 800);
      if (!isUuid(dungeonId)) return json({ error: "副本 ID 不正确" }, 400);

      const { data: dungeon, error: readError } = await supabase
        .from("dungeons")
        .select("id, invite_code_hash")
        .eq("id", dungeonId)
        .single();
      if (isMissingInviteColumn(readError)) return json({ error: "请先运行邀请码数据库升级 SQL" }, 400);
      if (readError) return json({ error: readError.message }, 400);
      if (role !== "admin" && dungeon.invite_code_hash !== identity.codeHash) {
        return json({ error: "只有副本作者或馆主可以修改置顶说明" }, 403);
      }

      const { data, error } = await supabase
        .from("dungeons")
        .update({ pinned_note: pinnedNote })
        .eq("id", dungeonId)
        .select()
        .single();
      if (isMissingForumColumn(error)) return json({ error: "请先运行论坛功能数据库升级 SQL" }, 400);
      if (error) return json({ error: error.message }, 400);
      return json({ role, name: identity.displayName, data });
    }

    if (action === "deleteDungeon") {
      if (!hasRole(role, ["admin"])) return json({ error: "需要馆主邀请码" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      if (!isUuid(dungeonId)) return json({ error: "副本 ID 不正确" }, 400);

      const { error } = await supabase.from("dungeons").delete().eq("id", dungeonId);
      if (error) return json({ error: error.message }, 400);
      return json({ role, name: identity.displayName, data: { id: dungeonId } });
    }

    return json({ error: "未知操作" }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "后端处理失败" }, 500);
  }
});

import {
  canManageDungeonRecord, canReviewDungeons, canViewDungeonRecord, cleanCoCreators, cleanFeedbackTags, 
  cleanText, getCommentHonorBuckets, getDungeonReviewStatus, hasRole, isMissingCoCreatorsColumn, isMissingDungeonReviewColumn, 
  isMissingForumColumn, isMissingInviteColumn, isUuid, json, recalculateClearStats, specialAccountRoles, 
  toPublicDungeonSummary, 
} from "../_shared/core.ts";
import type { Ctx, AuthCtx } from "../_shared/core.ts";

// action: listMyDungeons
export async function handleListMyDungeons(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["author", "reviewer", "admin", "god", "astral"])) return json({ error: "需要作者、审核员、神明或馆主邀请码" }, 403);
      const limit = Math.max(1, Math.min(100, Number(payload.limit || 80)));
      const dungeonFields = "id, name, creator, co_creators, difficulty, type, participant_count, run_count, clear_count, clear_rate, avg_rating, rating_count, comment_count, created_at, is_one_shot";
      const authoredById = new Map<string, Record<string, unknown>>();
      const addRows = (rows: Record<string, unknown>[] | null | undefined) => {
        for (const dungeon of rows || []) {
          const id = cleanText(dungeon.id, 80);
          if (id && !authoredById.has(id)) authoredById.set(id, dungeon);
        }
      };

      const byHash = await supabase
        .from("dungeons")
        .select(dungeonFields)
        .eq("invite_code_hash", identity.codeHash)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (byHash.error) {
        if (byHash.error.code !== "42703") return json({ error: byHash.error.message }, 400);
      } else {
        addRows((byHash.data || []) as Record<string, unknown>[]);
      }

      if (identity.displayName) {
        const byInviteName = await supabase
          .from("dungeons")
          .select(dungeonFields)
          .eq("invite_name", identity.displayName)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (byInviteName.error) {
          if (byInviteName.error.code !== "42703") return json({ error: byInviteName.error.message }, 400);
        } else {
          addRows((byInviteName.data || []) as Record<string, unknown>[]);
        }

        const byCreator = await supabase
          .from("dungeons")
          .select(dungeonFields)
          .eq("creator", identity.displayName)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (byCreator.error) return json({ error: byCreator.error.message }, 400);
        addRows((byCreator.data || []) as Record<string, unknown>[]);

        const byCoCreator = await supabase
          .from("dungeons")
          .select(dungeonFields)
          .contains("co_creators", [identity.displayName])
          .order("created_at", { ascending: false })
          .limit(limit);
        if (byCoCreator.error) {
          if (!isMissingCoCreatorsColumn(byCoCreator.error)) return json({ error: byCoCreator.error.message }, 400);
        } else {
          addRows((byCoCreator.data || []) as Record<string, unknown>[]);
        }
      }

      const dungeons = [...authoredById.values()]
        .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
        .slice(0, limit)
        .map(toPublicDungeonSummary)
        .filter(Boolean);
      return json({ role, name: identity.displayName, data: dungeons });
}

// action: submitDungeon
export async function handleSubmitDungeon(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["author", "reviewer", "admin", "god", "astral"])) return json({ error: "需要作者、审核员、神明或馆主邀请码" }, 403);

      const name = cleanText(payload.name, 80);
      const creator = specialAccountRoles.has(role) ? identity.displayName : cleanText(payload.creator, 40);
      const coCreators = cleanCoCreators(payload.coCreators ?? payload.co_creators);
      const description = cleanText(payload.description, 1800);
      const pinnedNote = cleanText(payload.pinnedNote, 800);
      const difficulty = cleanText(payload.difficulty, 20) || "超凡";
      const type = cleanText(payload.type, 160) || "综合";
      const participantCount = Number(payload.participantCount ?? payload.participant_count);
      const runCount = Number(payload.runCount ?? payload.run_count ?? 1);
      const isOneShot = payload.isOneShot === true || payload.is_one_shot === true || cleanText(payload.dungeonMode, 20) === "one_shot";
      if (!name || !creator || !description) return json({ error: "请填写完整副本信息" }, 400);
      if (
        !Number.isInteger(participantCount) ||
        participantCount < 1 ||
        participantCount > 99
      ) {
        return json({ error: "固定人数不正确" }, 400);
      }
      if (!Number.isInteger(runCount) || runCount < 1 || runCount > 999) return json({ error: "当前周目不正确" }, 400);

      const editDungeonId = cleanText(payload.dungeonId ?? payload.dungeon_id, 80);
      const reviewStatus = canReviewDungeons(identity) ? "approved" : "pending";
      const reviewUpdate = reviewStatus === "approved"
        ? {
          review_status: "approved",
          reviewed_by_hash: identity.codeHash,
          reviewed_by_name: identity.displayName,
          reviewed_at: new Date().toISOString(),
          review_note: "",
        }
        : {
          review_status: "pending",
          reviewed_by_hash: null,
          reviewed_by_name: null,
          reviewed_at: null,
          review_note: "",
        };
      if (editDungeonId) {
        if (!isUuid(editDungeonId)) return json({ error: "副本 ID 不正确" }, 400);
        const { data: existingDungeon, error: readError } = await supabase
          .from("dungeons")
          .select("id, invite_code_hash, invite_name, creator, co_creators, clear_count")
          .eq("id", editDungeonId)
          .single();
        if (isMissingInviteColumn(readError)) return json({ error: "请先运行邀请码数据库升级 SQL" }, 400);
        if (isMissingCoCreatorsColumn(readError)) return json({ error: "请先运行同契共筑数据库升级 SQL" }, 400);
        if (readError) return json({ error: readError.message }, 400);
        if (role !== "admin" && !canManageDungeonRecord(existingDungeon as Record<string, unknown>, identity)) {
          return json({ error: "只有副本作者、同契共筑者或馆主可以重铸绝境" }, 403);
        }

        const clearCount = Number((existingDungeon as Record<string, unknown>).clear_count || 0);
        const slots = Math.max(1, participantCount * runCount);
        const clearRate = Math.round((clearCount / slots) * 1000) / 10;
        const { data, error } = await supabase
          .from("dungeons")
          .update({
            name,
            creator,
            co_creators: coCreators,
            difficulty,
            type,
            description,
            pinned_note: pinnedNote,
            participant_count: participantCount,
            run_count: runCount,
            is_one_shot: isOneShot,
            clear_rate: clearRate,
            ...reviewUpdate,
          })
          .eq("id", editDungeonId)
          .select()
          .single();
        if (isMissingCoCreatorsColumn(error)) return json({ error: "请先运行同契共筑数据库升级 SQL" }, 400);
        if (isMissingDungeonReviewColumn(error)) return json({ error: "请先运行副本审核数据库升级 SQL" }, 400);
        if (isMissingForumColumn(error)) return json({ error: "请先运行论坛功能数据库升级 SQL" }, 400);
        if (error) return json({ error: error.message }, 400);
        return json({ role, name: identity.displayName, data });
      }

      const { data, error } = await supabase
        .from("dungeons")
        .insert({
          name,
          creator,
          co_creators: coCreators,
          difficulty,
          type,
          description,
          pinned_note: pinnedNote,
          participant_count: participantCount,
          run_count: runCount,
          is_one_shot: isOneShot,
          clear_count: 0,
          clear_rate: 0,
          invite_code_hash: identity.codeHash,
          invite_name: identity.displayName,
          ...reviewUpdate,
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
      if (isMissingCoCreatorsColumn(error)) {
        const retry = await supabase
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
            is_one_shot: isOneShot,
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
      if (isMissingDungeonReviewColumn(error)) return json({ error: "请先运行副本审核数据库升级 SQL" }, 400);
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

// action: reviewDungeon
export async function handleReviewDungeon(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!canReviewDungeons(identity)) return json({ error: "需要审核员、神明或馆主权限" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      const decision = cleanText(payload.decision, 20);
      const reviewNote = cleanText(payload.reviewNote, 800);
      if (!isUuid(dungeonId)) return json({ error: "副本 ID 不正确" }, 400);
      if (!["approve", "reject"].includes(decision)) return json({ error: "审核结果不正确" }, 400);

      const { data, error } = await supabase
        .from("dungeons")
        .update({
          review_status: decision === "approve" ? "approved" : "rejected",
          reviewed_by_hash: identity.codeHash,
          reviewed_by_name: identity.displayName,
          reviewed_at: new Date().toISOString(),
          review_note: reviewNote,
        })
        .eq("id", dungeonId)
        .select()
        .single();
      if (isMissingDungeonReviewColumn(error)) return json({ error: "请先运行副本审核数据库升级 SQL" }, 400);
      if (error) return json({ error: error.message }, 400);
      return json({ role, name: identity.displayName, data });
}

// action: markCleared
export async function handleMarkCleared(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      if (!isUuid(dungeonId)) return json({ error: "副本 ID 不正确" }, 400);

      const { data: dungeon, error: dungeonError } = await supabase
        .from("dungeons")
        .select("run_count, invite_code_hash, invite_name, creator, co_creators, review_status")
        .eq("id", dungeonId)
        .single();
      if (dungeonError) return json({ error: dungeonError.message }, 400);
      if (!canViewDungeonRecord(dungeon as Record<string, unknown>, identity) || getDungeonReviewStatus(dungeon as Record<string, unknown>) !== "approved") {
        return json({ error: "副本尚未正式发布，不能登记通关" }, 403);
      }
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

// action: advanceRun
export async function handleAdvanceRun(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["author", "reviewer", "admin", "god", "astral"])) return json({ error: "需要作者、审核员、神明或馆主邀请码" }, 403);

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

// action: addRating
export async function handleAddRating(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      const rating = Number(payload.rating);
      if (!isUuid(dungeonId) || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        return json({ error: "评分参数不正确" }, 400);
      }
      const { data: dungeonForRating, error: dungeonForRatingError } = await supabase
        .from("dungeons")
        .select("id, invite_code_hash, invite_name, creator, co_creators, review_status")
        .eq("id", dungeonId)
        .single();
      if (dungeonForRatingError) return json({ error: dungeonForRatingError.message }, 400);
      if (!canViewDungeonRecord(dungeonForRating as Record<string, unknown>, identity) || getDungeonReviewStatus(dungeonForRating as Record<string, unknown>) !== "approved") {
        return json({ error: "副本尚未正式发布，不能评分" }, 403);
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

// action: addComment
export async function handleAddComment(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin", "god", "astral"])) return json({ error: "需要入局谕令" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      const authorInput = cleanText(payload.author, 40);
      const author = identity.inviteId ? identity.displayName : (authorInput || identity.displayName || "匿名探索者");
      const content = cleanText(payload.content, 800);
      const parentCommentId = cleanText(payload.parentCommentId, 80);
      if (!isUuid(dungeonId) || !content) return json({ error: "评论参数不正确" }, 400);
      const { data: dungeonForComment, error: dungeonForCommentError } = await supabase
        .from("dungeons")
        .select("id, invite_code_hash, invite_name, creator, co_creators, review_status")
        .eq("id", dungeonId)
        .single();
      if (dungeonForCommentError) return json({ error: dungeonForCommentError.message }, 400);
      if (!canViewDungeonRecord(dungeonForComment as Record<string, unknown>, identity) || getDungeonReviewStatus(dungeonForComment as Record<string, unknown>) !== "approved") {
        return json({ error: "副本尚未正式发布，不能递交证言" }, 403);
      }
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
        if (!parentCommentId) {
          const retry = await supabase
            .from("comments")
            .insert({
              dungeon_id: dungeonId,
              author,
              content,
              invite_code_hash: identity.codeHash,
              invite_name: identity.displayName,
            })
            .select()
            .single();
          if (retry.error) return json({ error: retry.error.message }, 400);
          return json({ role, name: identity.displayName, data: retry.data });
        }
        return json({ error: "请先运行论坛功能数据库升级 SQL" }, 400);
      }
      if (error) return json({ error: error.message }, 400);
      return json({ role, name: identity.displayName, data });
}

// action: deleteComment
export async function handleDeleteComment(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["player", "author", "reviewer", "admin", "god", "astral"])) return json({ error: "需要邀请码" }, 403);

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

// action: getCommentHonors
export async function handleGetCommentHonors(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      const result = await getCommentHonorBuckets(supabase, payload.commentIds);
      if (result.error) return json({ error: result.error.message }, 400);
      return json({ role, name: identity.displayName, data: { byCommentId: result.byCommentId } });
}

// action: updatePinnedNote
export async function handleUpdatePinnedNote(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["author", "reviewer", "admin", "god", "astral"])) return json({ error: "需要作者、审核员、神明或馆主邀请码" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      const pinnedNote = cleanText(payload.pinnedNote, 800);
      if (!isUuid(dungeonId)) return json({ error: "副本 ID 不正确" }, 400);

      const { data: dungeon, error: readError } = await supabase
        .from("dungeons")
        .select("id, invite_code_hash, invite_name, creator, co_creators")
        .eq("id", dungeonId)
        .single();
      if (isMissingInviteColumn(readError)) return json({ error: "请先运行邀请码数据库升级 SQL" }, 400);
      if (readError) return json({ error: readError.message }, 400);
      if (role !== "admin" && !canManageDungeonRecord(dungeon as Record<string, unknown>, identity)) {
        return json({ error: "只有副本作者、同契共筑者或馆主可以修改置顶说明" }, 403);
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

// action: deleteDungeon
export async function handleDeleteDungeon(ctx: AuthCtx) {
  const { identity, payload, role, supabase } = ctx;
      if (!hasRole(role, ["author", "reviewer", "admin", "god", "astral"])) return json({ error: "需要作者、审核员、神明或馆主邀请码" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      if (!isUuid(dungeonId)) return json({ error: "副本 ID 不正确" }, 400);

      const { data: dungeon, error: readError } = await supabase
        .from("dungeons")
        .select("id, invite_code_hash, invite_name, creator, co_creators")
        .eq("id", dungeonId)
        .single();
      if (isMissingInviteColumn(readError)) return json({ error: "请先运行邀请码数据库升级 SQL" }, 400);
      if (readError) return json({ error: readError.message }, 400);
      if (role !== "admin" && !canManageDungeonRecord(dungeon as Record<string, unknown>, identity)) {
        return json({ error: "只有副本作者、同契共筑者或馆主可以封存试炼" }, 403);
      }

      const { error } = await supabase.from("dungeons").delete().eq("id", dungeonId);
      if (error) return json({ error: error.message }, 400);
      return json({ role, name: identity.displayName, data: { id: dungeonId } });
}

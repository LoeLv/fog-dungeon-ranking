import {
  InviteRole, buildDungeonArchiveSidebar, canManageDungeonRecord, canReviewDungeons, canViewDungeonRecord, 
  cleanText, dungeonArchiveAggregateLimit, dungeonArchivePageSelectFields, dungeonArchiveSelectFields, 
  getActiveCursesByHashes, getActiveTitlesByHashes, getDungeonReviewStatus, getInviteIdentity, getPublicProfileKey, 
  isUuid, json, listFaithTraits, specialAccountRoles, toDungeonArchiveCard, toPublicDungeonSummary, 
} from "../_shared/core.ts";
import type { Ctx, AuthCtx } from "../_shared/core.ts";

// action: listDungeons
export async function handleListDungeons(ctx: Ctx) {
  const { body, payload, supabase } = ctx;
    const identity = body.inviteCode ? await getInviteIdentity(supabase, body.inviteCode) : null;
    const limit = Math.max(1, Math.min(1000, Number(payload.limit || 500)));
    const { data, error } = await supabase
      .from("dungeons")
      .select(dungeonArchiveSelectFields)
      .order("avg_rating", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error?.code === "42703") return json({ error: "请先运行 dungeon review migration" }, 400);
    if (error) return json({ error: error.message }, 400);
    const rows = (data || [])
      .filter((dungeon) => canViewDungeonRecord(dungeon as Record<string, unknown>, identity))
      .map((dungeon) => toDungeonArchiveCard(dungeon as Record<string, unknown>, identity));
    return json({ data: rows });
}

// action: listDungeonArchivePage
export async function handleListDungeonArchivePage(ctx: Ctx) {
  const { payload, supabase } = ctx;
    const requestedPage = Math.floor(Number(payload.page || 1));
    const page = Math.max(1, Math.min(1000, Number.isFinite(requestedPage) ? requestedPage : 1));
    const requestedSize = Math.floor(Number(payload.pageSize || 5));
    const pageSize = Math.max(1, Math.min(24, Number.isFinite(requestedSize) ? requestedSize : 5));
    const sort = cleanText(payload.sort, 20);
    const start = (page - 1) * pageSize;
    const visibleRecordsQuery = supabase
      .from("dungeons")
      .select(dungeonArchivePageSelectFields, { count: "exact" })
      .or("review_status.eq.approved,review_status.is.null");
    if (sort === "newest") {
      visibleRecordsQuery.order("created_at", { ascending: false });
    } else if (sort === "comments") {
      visibleRecordsQuery.order("comment_count", { ascending: false }).order("created_at", { ascending: false });
    } else if (sort === "rating") {
      visibleRecordsQuery.order("avg_rating", { ascending: false }).order("rating_count", { ascending: false }).order("created_at", { ascending: false });
    } else {
      visibleRecordsQuery
        .order("rating_count", { ascending: false })
        .order("avg_rating", { ascending: false })
        .order("comment_count", { ascending: false })
        .order("created_at", { ascending: false });
    }
    const [visibleResult, aggregateResult] = await Promise.all([
      visibleRecordsQuery.range(start, start + pageSize - 1),
      supabase
        .from("dungeons")
        .select(dungeonArchivePageSelectFields)
        .or("review_status.eq.approved,review_status.is.null")
        .order("created_at", { ascending: false })
        .limit(dungeonArchiveAggregateLimit),
    ]);
    if (visibleResult.error?.code === "42703" || aggregateResult.error?.code === "42703") return json({ error: "请先运行 dungeon review migration" }, 400);
    if (visibleResult.error) return json({ error: visibleResult.error.message }, 400);
    if (aggregateResult.error) return json({ error: aggregateResult.error.message }, 400);
    const total = Number(visibleResult.count || 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return json({
      data: {
        dungeons: (visibleResult.data || []).map((dungeon) => toDungeonArchiveCard(dungeon as Record<string, unknown>)),
        page: Math.min(page, totalPages),
        page_size: pageSize,
        total,
        total_pages: totalPages,
        sidebar: buildDungeonArchiveSidebar((aggregateResult.data || []) as Record<string, unknown>[]),
      },
    });
}

// action: getDungeonDetail
export async function handleGetDungeonDetail(ctx: Ctx) {
  const { body, payload, supabase } = ctx;
    const identity = body.inviteCode ? await getInviteIdentity(supabase, body.inviteCode) : null;
    const dungeonId = cleanText(payload.dungeonId, 80);
    if (!isUuid(dungeonId)) return json({ error: "副本 ID 不正确" }, 400);

    const selectFields = "id, name, creator, co_creators, difficulty, type, description, pinned_note, participant_count, run_count, clear_count, clear_rate, invite_code_hash, invite_name, avg_rating, rating_count, comment_count, created_at, is_one_shot, review_status, reviewed_at, reviewed_by_name, review_note";
    const { data, error } = await supabase
      .from("dungeons")
      .select(selectFields)
      .eq("id", dungeonId)
      .maybeSingle();
    if (error?.code === "42703") return json({ error: "请先运行 dungeon review migration" }, 400);
    if (error) return json({ error: error.message }, 400);
    if (!data || !canViewDungeonRecord(data as Record<string, unknown>, identity)) return json({ error: "试炼未找到" }, 404);

    const record = data as Record<string, unknown>;
    const reviewStatus = getDungeonReviewStatus(record);
    const creatorOwned = !!identity && canManageDungeonRecord(record, identity);
    return json({
      data: {
        ...toPublicDungeonSummary(record),
        description: cleanText(record.description, 1800),
        pinned_note: cleanText(record.pinned_note, 800),
        review_status: reviewStatus,
        reviewed_at: cleanText(record.reviewed_at, 80),
        reviewed_by_name: cleanText(record.reviewed_by_name, 40),
        review_note: cleanText(record.review_note, 800),
        can_manage: !!identity && (canReviewDungeons(identity) || creatorOwned),
        is_pending_review: reviewStatus === "pending",
        is_rejected: reviewStatus === "rejected",
      },
    });
}

// action: listProfiles
export async function handleListProfiles(ctx: Ctx) {
  const { role, supabase } = ctx;
    const { data, error } = await supabase
      .from("player_profiles")
      .select("invite_code_hash, display_name, role, faith_god, faith_path, original_faith_god, original_faith_path, trickery_display_faith_god, trickery_display_faith_path, trickery_display_profession, profession, ascension_score, audience_score, show_titles, updated_at")
      .order("ascension_score", { ascending: false })
      .limit(300);
    if (error?.code === "42P01") return json({ error: "请先运行 player_profiles_migration.sql" }, 400);
    if (error) return json({ error: error.message }, 400);

    const visibleProfiles = (data || []).filter((profile: Record<string, unknown>) => !specialAccountRoles.has(cleanText(profile.role, 20) as InviteRole));

    const titleResult = await getActiveTitlesByHashes(
      supabase,
      visibleProfiles.map((profile: Record<string, unknown>) => cleanText(profile.invite_code_hash, 64)),
    );
    if (titleResult.error) return json({ error: titleResult.error.message }, 400);
    const curseResult = await getActiveCursesByHashes(
      supabase,
      visibleProfiles.map((profile: Record<string, unknown>) => cleanText(profile.invite_code_hash, 64)),
    );
    if (curseResult.error) return json({ error: curseResult.error.message }, 400);

    const publicProfiles = await Promise.all(visibleProfiles.map(async (profile: Record<string, unknown>) => {
      const inviteCodeHash = cleanText(profile.invite_code_hash, 64);
      const { invite_code_hash: _hiddenInviteHash, ...rest } = profile;
      return {
        ...rest,
        active_title: profile.show_titles === false ? null : ((titleResult.titles.get(inviteCodeHash) || [])[0] || null),
        active_titles: profile.show_titles === false ? [] : (titleResult.titles.get(inviteCodeHash) || []),
        active_curse: (curseResult.curses.get(inviteCodeHash) || [])[0] || null,
        active_curses: curseResult.curses.get(inviteCodeHash) || [],
        profile_key: await getPublicProfileKey(inviteCodeHash),
        is_current: false,
      };
    }));

    return json({ data: publicProfiles });
}

// action: listFaithTraits
export async function handleListFaithTraits(ctx: Ctx) {
  const { supabase } = ctx;
    const result = await listFaithTraits(supabase);
    if (result.error) return json({ error: result.error.message || "信仰特性读取失败" }, 400);
    return json({ data: result.data });
}

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type InviteRole = "player" | "author" | "reviewer" | "admin" | "god";

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

type LooseError = { code?: string; message?: string } | null | undefined;
type TalentPoolItem = {
  pool_key: string;
  talent_id: number;
  talent_name: string;
  rank: string;
  effect?: string | null;
};

const roleLabels: Record<InviteRole, string> = {
  player: "玩家",
  author: "作者",
  reviewer: "审核员",
  admin: "馆主",
  god: "神明",
};
const dungeonReviewerNames = new Set(["羔羊", "槐柏"]);

const godNames = new Set([
  "诞育",
  "繁荣",
  "死亡",
  "记忆",
  "时间",
  "秩序",
  "真理",
  "战争",
  "欺诈",
  "命运",
  "混乱",
  "沉默",
  "痴愚",
  "污堕",
  "腐朽",
  "湮灭",
]);

const defaultAscensionScore = 1000;
const defaultAudienceScore = 0;
const drawScoreStep = 10;
const starterTalentDrawGrant = 15;
const bTalentDrawRate = 0.2;
const advancedBTalentDrawRate = 0.25;
const aTalentDrawRate = 0.02;
const sTalentDrawRate = 0.001;
const bTalentGuaranteeDraws = 10;
const sTalentGuaranteeDraws = 60;
const cTalentFragmentGain = 5;
const bTalentFragmentGain = 10;
const targetTalentExchangeCost = 80;
const aTalentExchangeCost = 260;
const inventorySlotLimit = 8;
const equippedSlotLimit = 4;
const talentSlotScoreRules = [
  { minScore: 1000, ranks: ["C", "C"], summary: "CC" },
  { minScore: 1100, ranks: ["B", "C", "C"], summary: "BCC" },
  { minScore: 1200, ranks: ["B", "C", "C", "C"], summary: "BCCC" },
  { minScore: 1300, ranks: ["B", "B", "C", "C"], summary: "BBCC" },
  { minScore: 1400, ranks: ["B", "B", "C", "C"], summary: "BBCC" },
  { minScore: 1500, ranks: ["A", "B", "C", "C"], summary: "ABCC" },
  { minScore: 1600, ranks: ["A", "B", "B", "C"], summary: "ABBC" },
  { minScore: 1700, ranks: ["A", "B", "B", "B"], summary: "ABBB" },
  { minScore: 1800, ranks: ["A", "A", "B", "B"], summary: "AABB" },
  { minScore: 1900, ranks: ["A", "A", "A", "B"], summary: "AAAB" },
  { minScore: 2000, ranks: ["A", "A", "A", "A"], summary: "AAAA" },
  { minScore: 2100, ranks: ["S", "A", "A", "A"], summary: "SAAA" },
];
const talentSlotKinds = ["faith", "profession", "any", "any"];
const talentRankOrder: Record<string, number> = { C: 1, B: 2, A: 3, S: 4 };
const scoreDengMin = -20;
const scoreDengMax = 20;
const scoreJinMin = 0;
const scoreJinMax = 3;
const knownTalentPools = [
  "Pool战士",
  "Pool法师",
  "Pool牧师",
  "Pool猎人",
  "Pool刺客",
  "Pool歌者",
  "Pool诞育",
  "Pool繁荣",
  "Pool死亡",
  "Pool污堕",
  "Pool腐朽",
  "Pool湮灭",
  "Pool秩序",
  "Pool真理",
  "Pool战争",
  "Pool痴愚",
  "Pool沉默",
  "Pool记忆",
  "Pool时间",
  "Pool欺诈",
  "Pool命运",
  "Pool混乱",
];

const professionGroups = [
  { path: "文明", god: "秩序", careers: { 战士: "秩序骑士", 法师: "元素法官", 牧师: "公正官", 刺客: "行刑官", 猎人: "搜查官", 歌者: "律者" } },
  { path: "文明", god: "真理", careers: { 战士: "格斗专家", 法师: "博士学者", 牧师: "外科医生", 刺客: "暗杀博士", 猎人: "陷阱大师", 歌者: "博闻诗人" } },
  { path: "文明", god: "战争", careers: { 战士: "陷阵勇士", 法师: "炼狱主教", 牧师: "督战官", 刺客: "隙光铁刺", 猎人: "鹰眼斥候", 歌者: "风暴之嗓" } },
  { path: "混沌", god: "混乱", careers: { 战士: "异血同袍", 法师: "灾祸之源", 牧师: "理智蚀者", 刺客: "折光诡影", 猎人: "渔夫", 歌者: "失律琴师" } },
  { path: "混沌", god: "痴愚", careers: { 战士: "坚壁骑士", 法师: "幕后戏师", 牧师: "祛愚专家", 刺客: "解构之眼", 猎人: "猎愚人", 歌者: "独奏家" } },
  { path: "混沌", god: "沉默", careers: { 战士: "苦行僧", 法师: "默剧大师", 牧师: "守夜人", 刺客: "偃偶师", 猎人: "变色龙", 歌者: "囚徒" } },
  { path: "生命", god: "诞育", careers: { 战士: "酋长", 法师: "生命贤者", 牧师: "子嗣牧", 刺客: "借诞之婴", 猎人: "创生猎人", 歌者: "生灵吟者" } },
  { path: "生命", god: "繁荣", careers: { 战士: "德鲁伊", 法师: "木精灵", 牧师: "园丁", 刺客: "荆棘之冠", 猎人: "美食家", 歌者: "不朽乐章" } },
  { path: "生命", god: "死亡", careers: { 战士: "剔骨工", 法师: "死灵法师", 牧师: "守墓人", 刺客: "死亡编织者", 猎人: "猩红猎手", 歌者: "撞钟人" } },
  { path: "沉沦", god: "污堕", careers: { 战士: "尖啸伯爵", 法师: "欲望主宰", 牧师: "悲悯领主", 刺客: "恶孽", 猎人: "感官追猎者", 歌者: "塞王" } },
  { path: "沉沦", god: "腐朽", careers: { 战士: "木乃伊", 法师: "瘟疫枢机", 牧师: "凋零祭司", 刺客: "疮瘢之目", 猎人: "黄昏猎人", 歌者: "腐烂颂唱者" } },
  { path: "沉沦", god: "湮灭", careers: { 战士: "环卫工", 法师: "炬灭者", 牧师: "焚化工", 刺客: "寂灭使徒", 猎人: "终焉行者", 歌者: "毁灭宣誓" } },
  { path: "存在", god: "时间", careers: { 战士: "指针骑士", 法师: "时间行者", 牧师: "遗忘医生", 刺客: "另日刺客", 猎人: "驯风游侠", 歌者: "吟游诗人" } },
  { path: "存在", god: "记忆", careers: { 战士: "镜中人", 法师: "回忆旅者", 牧师: "见证者", 刺客: "旧日追猎者", 猎人: "痴梦游侠", 歌者: "史学家" } },
  { path: "虚无", god: "命运", careers: { 战士: "今日勇者", 法师: "编剧", 牧师: "织命师", 刺客: "窃命之贼", 猎人: "终末之笔", 歌者: "预言家" } },
  { path: "虚无", god: "欺诈", careers: { 战士: "杂技演员", 法师: "诡术大师", 牧师: "小丑", 刺客: "受害者", 猎人: "驭兽师", 歌者: "魔术师" } },
];

const professionClassByName = new Map(
  professionGroups.flatMap((group) =>
    Object.entries(group.careers).map(([className, professionName]) => [professionName, className]),
  ),
);
const professionGodByName = new Map(
  professionGroups.flatMap((group) =>
    Object.values(group.careers).map((professionName) => [professionName, group.god]),
  ),
);
const godPathByName = new Map(professionGroups.map((group) => [group.god, group.path]));

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

function cleanRequestKey(value: unknown, maxLength = 96) {
  const text = cleanText(value, maxLength);
  return /^[A-Za-z0-9._:-]{8,96}$/.test(text) ? text : "";
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

function cleanPoolKey(value: unknown) {
  return cleanText(value, 40).replace(/[<>"']/g, "");
}

function cleanTalentId(value: unknown) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1 || id > 999999) return 0;
  return id;
}

function cleanCoCreators(value: unknown) {
  const rawItems = Array.isArray(value)
    ? value
    : String(value || "").split(/[、,，;；\n\r]+/u);
  const seen = new Set<string>();
  const names: string[] = [];
  for (const item of rawItems) {
    const name = cleanText(item, 16).replace(/\s+/g, " ");
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length >= 12) break;
  }
  return names;
}

function cleanBigIntId(value: unknown) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1 || id > Number.MAX_SAFE_INTEGER) return 0;
  return id;
}

function cleanSlot(value: unknown, maxSlot: number) {
  const slot = Number(value);
  if (!Number.isInteger(slot) || slot < 1 || slot > maxSlot) return 0;
  return slot;
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

async function getPublicProfileKey(inviteCodeHash: unknown) {
  const codeHash = cleanText(inviteCodeHash, 64);
  if (!codeHash) return "";
  return await sha256Hex(`public-profile:${codeHash}`);
}

function toPublicTitle(title: Record<string, unknown> | null | undefined) {
  if (!title) return null;
  return {
    id: cleanText(title.id, 80),
    title_text: cleanText(title.title_text, 32),
    title_god: cleanText(title.title_god, 20),
    title_note: cleanText(title.title_note, 120),
    granted_by_type: cleanText(title.granted_by_type, 20) || "admin",
    granted_by_name: cleanText(title.granted_by_name, 40),
    granted_at: cleanText(title.granted_at, 80),
  };
}

function toPublicCurse(curse: Record<string, unknown> | null | undefined) {
  if (!curse) return null;
  return {
    id: cleanText(curse.id, 80),
    curse_text: cleanText(curse.curse_text, 32),
    curse_god: cleanText(curse.curse_god, 20),
    curse_note: cleanText(curse.curse_note, 120),
    granted_by_type: cleanText(curse.granted_by_type, 20) || "admin",
    granted_by_name: cleanText(curse.granted_by_name, 40),
    granted_at: cleanText(curse.granted_at, 80),
  };
}

async function getActiveTitlesByHashes(
  supabase: ReturnType<typeof createClient>,
  inviteCodeHashes: string[],
) {
  const hashes = [...new Set(inviteCodeHashes.map((hash) => cleanText(hash, 64)).filter(Boolean))];
  const titles = new Map<string, Record<string, unknown>[]>();
  if (!hashes.length) return { titles };
  const { data, error } = await supabase
    .from("profile_titles")
    .select("id, invite_code_hash, title_text, title_god, title_note, granted_by_type, granted_by_name, granted_at")
    .in("invite_code_hash", hashes)
    .eq("is_active", true)
    .order("granted_at", { ascending: false });
  if (isMissingTitleTable(error)) return { titles };
  if (error) return { titles, error };
  for (const title of data || []) {
    const hash = cleanText((title as Record<string, unknown>).invite_code_hash, 64);
    const publicTitle = toPublicTitle(title as Record<string, unknown>) as Record<string, unknown> | null;
    if (hash && publicTitle) titles.set(hash, [...(titles.get(hash) || []), publicTitle]);
  }
  return { titles };
}

async function getActiveTitleForHash(
  supabase: ReturnType<typeof createClient>,
  inviteCodeHash: string,
) {
  const result = await getActiveTitlesByHashes(supabase, [inviteCodeHash]);
  if (result.error) return { error: result.error };
  const titles = result.titles.get(inviteCodeHash) || [];
  return { title: titles[0] || null, titles };
}

async function getActiveCursesByHashes(
  supabase: ReturnType<typeof createClient>,
  inviteCodeHashes: string[],
) {
  const hashes = [...new Set(inviteCodeHashes.map((hash) => cleanText(hash, 64)).filter(Boolean))];
  const curses = new Map<string, Record<string, unknown>[]>();
  if (!hashes.length) return { curses };
  const { data, error } = await supabase
    .from("profile_curses")
    .select("id, invite_code_hash, curse_text, curse_god, curse_note, granted_by_type, granted_by_name, granted_at")
    .in("invite_code_hash", hashes)
    .eq("is_active", true)
    .order("granted_at", { ascending: false });
  if (isMissingTitleTable(error)) return { curses };
  if (error) return { curses, error };
  for (const curse of data || []) {
    const hash = cleanText((curse as Record<string, unknown>).invite_code_hash, 64);
    const publicCurse = toPublicCurse(curse as Record<string, unknown>) as Record<string, unknown> | null;
    if (hash && publicCurse) curses.set(hash, [...(curses.get(hash) || []), publicCurse]);
  }
  return { curses };
}

async function getActiveCurseForHash(
  supabase: ReturnType<typeof createClient>,
  inviteCodeHash: string,
) {
  const result = await getActiveCursesByHashes(supabase, [inviteCodeHash]);
  if (result.error) return { error: result.error };
  const curses = result.curses.get(inviteCodeHash) || [];
  return { curse: curses[0] || null, curses };
}

async function getCommentHonorBuckets(
  supabase: ReturnType<typeof createClient>,
  rawCommentIds: unknown,
) {
  const commentIds = Array.isArray(rawCommentIds)
    ? rawCommentIds.map((id: unknown) => cleanText(id, 80)).filter(Boolean).slice(0, 200)
    : [];
  const uniqueCommentIds = [...new Set(commentIds)];
  const byCommentId: Record<string, { active_titles: Record<string, unknown>[]; active_curses: Record<string, unknown>[] }> = {};
  for (const commentId of uniqueCommentIds) {
    byCommentId[commentId] = { active_titles: [], active_curses: [] };
  }
  if (!uniqueCommentIds.length) return { byCommentId };

  const { data: commentRows, error: commentError } = await supabase
    .from("comments")
    .select("id, invite_code_hash")
    .in("id", uniqueCommentIds);
  if (commentError) return { byCommentId, error: commentError };

  const commentHashById = new Map<string, string>();
  for (const row of commentRows || []) {
    const commentId = cleanText((row as Record<string, unknown>).id, 80);
    const hash = cleanText((row as Record<string, unknown>).invite_code_hash, 64);
    if (commentId && hash) commentHashById.set(commentId, hash);
  }
  const uniqueHashes = [...new Set([...commentHashById.values()])];
  const titleResult = await getActiveTitlesByHashes(supabase, uniqueHashes);
  if (titleResult.error) return { byCommentId, error: titleResult.error };
  const curseResult = await getActiveCursesByHashes(supabase, uniqueHashes);
  if (curseResult.error) return { byCommentId, error: curseResult.error };

  for (const commentId of uniqueCommentIds) {
    const hash = commentHashById.get(commentId) || "";
    byCommentId[commentId] = {
      active_titles: titleResult.titles.get(hash) || [],
      active_curses: curseResult.curses.get(hash) || [],
    };
  }

  return { byCommentId };
}

async function getProfileByDisplayName(
  supabase: ReturnType<typeof createClient>,
  displayNameInput: unknown,
): Promise<{ data?: Record<string, unknown>; error?: LooseError }> {
  const displayName = cleanText(displayNameInput, 40);
  if (!displayName) return { error: { message: "请填写玩家昵称" } };
  const { data, error } = await supabase
    .from("player_profiles")
    .select("invite_code_hash, display_name, role, faith_god")
    .eq("display_name", displayName)
    .maybeSingle();
  if (error) return { error };
  if (!data) return { error: { message: "没有找到这个玩家档案，请确认昵称已保存" } };
  return { data };
}

function toPublicDungeonSummary(dungeon: Record<string, unknown> | null | undefined) {
  if (!dungeon) return null;
  return {
    id: cleanText(dungeon.id, 80),
    name: cleanText(dungeon.name, 80),
    creator: cleanText(dungeon.creator, 40),
    co_creators: cleanCoCreators(dungeon.co_creators),
    difficulty: cleanText(dungeon.difficulty, 20),
    type: cleanText(dungeon.type, 160),
    participant_count: Number(dungeon.participant_count || 0),
    run_count: Number(dungeon.run_count || 0),
    clear_count: Number(dungeon.clear_count || 0),
    clear_rate: Number(dungeon.clear_rate || 0),
    avg_rating: Number(dungeon.avg_rating || 0),
    rating_count: Number(dungeon.rating_count || 0),
    comment_count: Number(dungeon.comment_count || 0),
    created_at: cleanText(dungeon.created_at, 80),
    is_one_shot: dungeon.is_one_shot === true,
  };
}

function toPublicProfile(profile: Record<string, unknown>, profileKey: string, isCurrent: boolean) {
  return {
    profile_key: profileKey,
    display_name: cleanText(profile.display_name, 40),
    role: cleanText(profile.role, 20),
    faith_god: cleanText(profile.faith_god, 20),
    faith_path: cleanText(profile.faith_path, 20),
    profession: cleanText(profile.profession, 40),
    ascension_score: cleanScore(profile.ascension_score),
    audience_score: cleanScore(profile.audience_score),
    items: cleanText(profile.items, 800),
    talents: cleanText(profile.talents, 800),
    active_title: profile.active_title || null,
    active_titles: Array.isArray(profile.active_titles) ? profile.active_titles : [],
    active_curse: profile.active_curse || null,
    active_curses: Array.isArray(profile.active_curses) ? profile.active_curses : [],
    updated_at: cleanText(profile.updated_at, 80),
    is_current: isCurrent,
  };
}

async function getInviteIdentity(
  supabase: ReturnType<typeof createClient>,
  inviteCode: unknown,
): Promise<InviteIdentity | null> {
  const code = cleanText(inviteCode, 200);
  if (!code) return null;
  const codeHash = await sha256Hex(code);

  const { data, error } = await supabase
    .from("invite_codes")
    .select("id, role, display_name, is_active")
    .eq("code_hash", codeHash)
    .maybeSingle();
  if (error) return null;

  const roleFromTable = data?.role as InviteRole | undefined;
  if (data?.is_active && roleFromTable && ["player", "author", "reviewer", "admin", "god"].includes(roleFromTable)) {
    const displayName = cleanText(data.display_name, 40) || roleLabels[roleFromTable];
    if (roleFromTable === "god" && !godNames.has(displayName)) return null;
    await supabase
      .from("invite_codes")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id);
    return {
      role: roleFromTable,
      codeHash,
      displayName,
      inviteId: data.id,
    };
  }
  return null;
}

function hasRole(role: InviteRole, allowed: InviteRole[]) {
  return allowed.includes(role);
}

function canGrantTitles(role: InviteRole) {
  return hasRole(role, ["admin", "god"]);
}

function canReviewDungeons(identity: InviteIdentity) {
  if (hasRole(identity.role, ["admin", "god"])) return true;
  return identity.role === "reviewer" && dungeonReviewerNames.has(identity.displayName);
}

function getTitleGrantGod(identity: InviteIdentity, requestedGod: unknown) {
  if (identity.role === "god") return identity.displayName;
  return cleanText(requestedGod, 20);
}

function canManageDungeonRecord(dungeon: Record<string, unknown>, identity: InviteIdentity) {
  const displayName = cleanText(identity.displayName, 40);
  const creator = cleanText(dungeon.creator, 40);
  const inviteName = cleanText(dungeon.invite_name, 40);
  const inviteHash = cleanText(dungeon.invite_code_hash, 64);
  if (inviteHash && inviteHash === identity.codeHash) return true;
  if (displayName && (displayName === creator || displayName === inviteName)) return true;
  return cleanCoCreators(dungeon.co_creators).some((name) => cleanText(name, 40) === displayName);
}

function getDungeonReviewStatus(dungeon: Record<string, unknown>) {
  return cleanText(dungeon.review_status, 20) || "approved";
}

function canViewDungeonRecord(dungeon: Record<string, unknown>, identity: InviteIdentity | null) {
  if (getDungeonReviewStatus(dungeon) === "approved") return true;
  if (!identity) return false;
  return canReviewDungeons(identity) || canManageDungeonRecord(dungeon, identity);
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

function isMissingCoCreatorsColumn(error: LooseError) {
  return error?.code === "42703" && !!error.message?.includes("co_creators");
}

function isMissingDungeonReviewColumn(error: LooseError) {
  return error?.code === "42703" && (
    !!error.message?.includes("review_status") ||
    !!error.message?.includes("reviewed_by_hash") ||
    !!error.message?.includes("reviewed_by_name") ||
    !!error.message?.includes("reviewed_at") ||
    !!error.message?.includes("review_note")
  );
}

function cleanFeedbackTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  const tags = value
    .map((item) => cleanText(item, 20))
    .filter((tag) => feedbackTagAllowlist.has(tag));
  return [...new Set(tags)].slice(0, 5);
}

function isMissingTalentTable(error: LooseError) {
  return error?.code === "42P01";
}

function isMissingTitleTable(error: LooseError) {
  return error?.code === "42P01";
}

function isMissingTalentEffectColumn(error: LooseError) {
  return error?.code === "42703" && !!error.message?.includes("effect");
}

function isMissingMatchSystem(error: LooseError) {
  return error?.code === "42P01" || error?.code === "42883";
}

function isMissingMatchMusterSystem(error: LooseError) {
  return (
    error?.code === "42P01" ||
    error?.code === "42883" ||
    (error?.code === "42703" && (
      error.message?.includes("is_one_shot") ||
      error.message?.includes("muster_id") ||
      error.message?.includes("match_musters") ||
      error.message?.includes("match_muster_participants")
    ))
  );
}

function getEarnedDraws(ascensionScore: unknown) {
  const score = cleanScore(ascensionScore);
  return starterTalentDrawGrant + Math.max(0, Math.floor((score - defaultAscensionScore) / drawScoreStep));
}

function getTalentSlotRule(ascensionScore: unknown) {
  const score = cleanScore(ascensionScore);
  return talentSlotScoreRules.reduce((active, rule) => (score >= rule.minScore ? rule : active), talentSlotScoreRules[0]);
}

function getTalentSlotLimit(ascensionScore: unknown) {
  const score = cleanScore(ascensionScore);
  if (score < 1100) return 2;
  if (score < 1200) return 3;
  return 4;
}

function getTalentRankAllowance(ascensionScore: unknown) {
  return getTalentSlotRule(ascensionScore).ranks || ["C", "C"];
}

function canEquipTalentRanks(ranks: unknown[], allowance: string[]) {
  const sortedRanks = ranks.map((rank) => String(rank || "").toUpperCase()).sort((a, b) => (talentRankOrder[b] || 0) - (talentRankOrder[a] || 0));
  const sortedAllowance = allowance.map((rank) => String(rank || "").toUpperCase()).sort((a, b) => (talentRankOrder[b] || 0) - (talentRankOrder[a] || 0));
  if (sortedRanks.length > sortedAllowance.length) return false;
  return sortedRanks.every((rank, index) => (talentRankOrder[rank] || 0) <= (talentRankOrder[sortedAllowance[index]] || 0));
}

function getFaithTalentPoolKey(profile: Record<string, unknown>) {
  const faithGod = cleanText(profile.faith_god, 20);
  const poolKey = faithGod ? `Pool${faithGod}` : "";
  return knownTalentPools.includes(poolKey) ? poolKey : "";
}

function getProfessionTalentPoolKey(profile: Record<string, unknown>) {
  const profession = cleanText(profile.profession, 40);
  const professionClass = professionClassByName.get(profession);
  const poolKey = professionClass ? `Pool${professionClass}` : "";
  return knownTalentPools.includes(poolKey) ? poolKey : "";
}

function getFaithPathByGod(god: string) {
  return godPathByName.get(god) || "";
}

function getProfessionGod(profession: unknown) {
  return professionGodByName.get(cleanText(profession, 40)) || "";
}

function isProfileBindingMismatched(profile: Record<string, unknown> | null | undefined) {
  if (!profile) return false;
  const faithGod = cleanText(profile.faith_god, 20);
  const professionGod = getProfessionGod(profile.profession);
  return !!faithGod && !!professionGod && professionGod !== faithGod;
}

function hasTrickeryFaithPrivilege(profile: Record<string, unknown> | null | undefined) {
  if (!profile) return false;
  if (cleanText(profile.original_faith_god, 20) === "欺诈") return true;
  if (cleanText(profile.faith_god, 20) === "欺诈") return true;
  return getProfessionGod(profile.profession) === "欺诈";
}

function getTalentSlotKind(slot: number) {
  return talentSlotKinds[slot - 1] || "any";
}

function getTalentSlotRequirement(profile: Record<string, unknown>, slot: number) {
  const kind = getTalentSlotKind(slot);
  if (kind === "faith") return { kind, poolKey: getFaithTalentPoolKey(profile), label: "信仰" };
  if (kind === "profession") return { kind, poolKey: getProfessionTalentPoolKey(profile), label: "职业" };
  return { kind, poolKey: "", label: "任意" };
}

function canEquipTalentPool(poolKey: unknown, requirement: { kind: string; poolKey: string }) {
  if (requirement.kind === "any") return true;
  return !!requirement.poolKey && String(poolKey || "") === requirement.poolKey;
}

function getAllowedTalentPools(profile: Record<string, unknown>) {
  const poolSet = new Set<string>();
  const faithPoolKey = getFaithTalentPoolKey(profile);
  const professionPoolKey = getProfessionTalentPoolKey(profile);
  if (faithPoolKey) poolSet.add(faithPoolKey);
  if (professionPoolKey) poolSet.add(professionPoolKey);
  return [...poolSet].filter((poolKey) => knownTalentPools.includes(poolKey));
}

function canSettleScores(role: InviteRole) {
  return hasRole(role, ["reviewer", "admin"]);
}

function cleanSettlementScore(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return Number.NaN;
  return Math.round(number * 10) / 10;
}

function checkSettlementScoreRange(deng: number, jin: number) {
  if (!Number.isFinite(deng) || !Number.isFinite(jin)) return "分数格式不正确";
  if (deng < scoreDengMin || deng > scoreDengMax) return `登神之路分数必须在 ${scoreDengMin}~${scoreDengMax} 之间`;
  if (jin < scoreJinMin || jin > scoreJinMax) return `觐见之梯分数必须在 ${scoreJinMin}~${scoreJinMax} 之间`;
  return "";
}

function parseScoreSettlementText(textContent: unknown) {
  const text = cleanText(textContent, 20000);
  const entries: { nick: string; deng: number; jin: number; total: number; line: number; raw: string }[] = [];
  const invalidLines: { line: number; raw: string; msg: string }[] = [];
  text.split(/\r?\n/u).forEach((lineText, index) => {
    const raw = lineText.trim();
    if (!raw) return;
    const match = raw.match(/^(.+?)[：:]\s*([+-]?\d+(?:\.\d+)?)\s*\+\s*([+-]?\d+(?:\.\d+)?)\s*$/u);
    if (!match) {
      invalidLines.push({ line: index + 1, raw, msg: "格式应为 昵称:+登神+觐见" });
      return;
    }
    const nick = cleanText(match[1], 40);
    const deng = cleanSettlementScore(match[2]);
    const jin = cleanSettlementScore(match[3]);
    if (!nick) {
      invalidLines.push({ line: index + 1, raw, msg: "昵称不能为空" });
      return;
    }
    entries.push({ nick, deng, jin, total: Math.round((deng + jin) * 10) / 10, line: index + 1, raw });
  });
  return { entries, invalidLines };
}

async function getProfilesByNames(
  supabase: ReturnType<typeof createClient>,
  names: string[],
) {
  const uniqueNames = [...new Set(names.map((name) => cleanText(name, 40)).filter(Boolean))];
  if (!uniqueNames.length) return { profiles: new Map<string, Record<string, unknown>>() };
  const { data, error } = await supabase
    .from("player_profiles")
    .select("invite_code_hash, display_name, role, ascension_score, audience_score")
    .in("display_name", uniqueNames);
  if (error) return { error };
  const profiles = new Map<string, Record<string, unknown>>();
  (data || []).forEach((profile) => profiles.set(String(profile.display_name), profile));
  return { profiles };
}

async function buildScorePreview(
  supabase: ReturnType<typeof createClient>,
  entries: { nick: string; deng: number; jin: number; total: number; line: number; raw: string }[],
  invalidLines: { line: number; raw: string; msg: string }[],
) {
  const scoreErrList = entries
    .map((entry) => ({ ...entry, msg: checkSettlementScoreRange(entry.deng, entry.jin) }))
    .filter((entry) => entry.msg);
  const nickCounts = new Map<string, number>();
  entries.forEach((entry) => nickCounts.set(entry.nick, (nickCounts.get(entry.nick) || 0) + 1));
  const duplicateNick = [...nickCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([nick]) => nick);
  const profileResult = await getProfilesByNames(supabase, entries.map((entry) => entry.nick));
  if (profileResult.error) return { error: profileResult.error };
  const profiles = profileResult.profiles || new Map<string, Record<string, unknown>>();
  const missingNick = [...new Set(entries.map((entry) => entry.nick).filter((nick) => !profiles.has(nick)))];
  const totalDeng = entries.reduce((sum, entry) => sum + (Number.isFinite(entry.deng) ? entry.deng : 0), 0);
  const totalJin = entries.reduce((sum, entry) => sum + (Number.isFinite(entry.jin) ? entry.jin : 0), 0);
  return {
    data: {
      allList: entries,
      invalidLines,
      scoreErrList,
      missingNick,
      duplicateNick,
      totalPlayers: entries.length,
      totalDeng: Math.round(totalDeng * 10) / 10,
      totalJin: Math.round(totalJin * 10) / 10,
      totalScore: Math.round((totalDeng + totalJin) * 10) / 10,
      valid: entries.length > 0 && invalidLines.length === 0 && scoreErrList.length === 0 && missingNick.length === 0 && duplicateNick.length === 0,
    },
  };
}

function getTalentFragmentGain(rank: unknown) {
  return String(rank || "").toUpperCase() === "B" ? bTalentFragmentGain : cTalentFragmentGain;
}

function getTalentExchangeCost(rank: unknown) {
  return String(rank || "").toUpperCase() === "A" ? aTalentExchangeCost : targetTalentExchangeCost;
}

function pickRandomTalent<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)] ?? items[0];
}

function isAdvancedTalentDrawUnlocked(ascensionScore: unknown) {
  return cleanScore(ascensionScore) >= 1500;
}

function pickTalentFromRank(items: TalentPoolItem[], rank: string) {
  const rankItems = items.filter((item) => item.rank === rank);
  return rankItems.length ? pickRandomTalent(rankItems) : null;
}

function pickDrawTalent(items: TalentPoolItem[], advancedDraw = false): TalentPoolItem {
  const availableItems = advancedDraw ? items : items.filter((item) => ["B", "C"].includes(item.rank));
  const drawItems = availableItems.length ? availableItems : items;
  const bItems = items.filter((item) => item.rank === "B");
  const cItems = drawItems.filter((item) => item.rank === "C");
  if (!advancedDraw) {
    if (bItems.length && (!cItems.length || Math.random() < bTalentDrawRate)) return pickRandomTalent(bItems);
    return pickRandomTalent(cItems.length ? cItems : drawItems);
  }
  const roll = Math.random();
  const sPick = roll < sTalentDrawRate ? pickTalentFromRank(drawItems, "S") : null;
  if (sPick) return sPick;
  const aPick = roll < sTalentDrawRate + aTalentDrawRate ? pickTalentFromRank(drawItems, "A") : null;
  if (aPick) return aPick;
  const bPick = roll < sTalentDrawRate + aTalentDrawRate + advancedBTalentDrawRate ? pickTalentFromRank(drawItems, "B") : null;
  if (bPick) return bPick;
  return pickRandomTalent(cItems.length ? cItems : drawItems);
}

function pickDrawTalentWithGuarantee(
  items: TalentPoolItem[],
  continueDraw: number,
  sContinueDraw: number,
  guaranteeEnabled = true,
  advancedDraw = false,
) {
  const bItems = items.filter((item) => item.rank === "B");
  const cItems = items.filter((item) => item.rank === "C");
  const sItems = items.filter((item) => item.rank === "S");
  const shouldGuaranteeS = advancedDraw && guaranteeEnabled && sItems.length > 0 && sContinueDraw >= sTalentGuaranteeDraws - 1;
  if (shouldGuaranteeS) return { talent: pickRandomTalent(sItems), isGuarantee: true };
  const shouldGuaranteeB = guaranteeEnabled && bItems.length > 0 && cItems.length > 0 && continueDraw >= bTalentGuaranteeDraws - 1;
  if (shouldGuaranteeB) return { talent: pickRandomTalent(bItems), isGuarantee: true };
  return { talent: pickDrawTalent(items, advancedDraw), isGuarantee: false };
}

function getTalentKey(poolKey: unknown, talentId: unknown) {
  return `${String(poolKey || "")}::${Number(talentId) || 0}`;
}

function weightedPickTalent<T extends { talent_id: number }>(items: T[]): T {
  let totalWeight = 0;
  const weighted = items.map((item) => {
    totalWeight += Math.max(1, Number(item.talent_id) || 1) ** 2;
    return { item, totalWeight };
  });
  const roll = Math.random() * totalWeight;
  return weighted.find((entry) => roll <= entry.totalWeight)?.item ?? items[items.length - 1];
}

async function getTalentProfile(
  supabase: ReturnType<typeof createClient>,
  identity: InviteIdentity,
) {
  const { data, error } = await supabase
    .from("player_profiles")
    .select("display_name, role, faith_god, faith_path, original_faith_god, original_faith_path, profession, ascension_score, audience_score, items, talents, updated_at")
    .eq("invite_code_hash", identity.codeHash)
    .maybeSingle();
  if (error) return { error };
  if (!data) return { error: { message: "请先保存个人档案，再开启天赋池" } };
  const titleResult = await getActiveTitleForHash(supabase, identity.codeHash);
  if (titleResult.error) return { error: titleResult.error };
  const curseResult = await getActiveCurseForHash(supabase, identity.codeHash);
  if (curseResult.error) return { error: curseResult.error };
  return {
    data: {
      ...data,
      active_title: titleResult.title,
      active_titles: titleResult.titles || [],
      active_curse: curseResult.curse,
      active_curses: curseResult.curses || [],
    },
  };
}

async function getTalentDrawState(
  supabase: ReturnType<typeof createClient>,
  codeHash: string,
) {
  const { data, error } = await supabase
    .from("talent_draw_state")
    .select("spent_draws")
    .eq("invite_code_hash", codeHash)
    .maybeSingle();
  if (error) return { error, spentDraws: 0 };
  return { spentDraws: Number(data?.spent_draws || 0) };
}

async function getFragmentTotal(
  supabase: ReturnType<typeof createClient>,
  codeHash: string,
) {
  const { data, error } = await supabase
    .from("user_fragments")
    .select("fragment_total")
    .eq("invite_code_hash", codeHash)
    .maybeSingle();
  if (error) return { error, fragmentTotal: 0 };
  return { fragmentTotal: Number(data?.fragment_total || 0) };
}

async function addUserFragments(
  supabase: ReturnType<typeof createClient>,
  codeHash: string,
  amount: number,
) {
  const gain = Math.max(0, Math.floor(Number(amount) || 0));
  if (!gain) return { fragmentTotal: undefined };
  const fragmentState = await getFragmentTotal(supabase, codeHash);
  if (fragmentState.error) return { error: fragmentState.error };
  const nextTotal = fragmentState.fragmentTotal + gain;
  const { error } = await supabase
    .from("user_fragments")
    .upsert({
      invite_code_hash: codeHash,
      fragment_total: nextTotal,
      updated_at: new Date().toISOString(),
    });
  if (error) return { error };
  return { fragmentTotal: nextTotal };
}

async function updateProfileTalentText(
  supabase: ReturnType<typeof createClient>,
  codeHash: string,
) {
  const { data: owned, error } = await supabase
    .from("owned_talents")
    .select("talent_name, rank, equipped_slot")
    .eq("invite_code_hash", codeHash)
    .not("equipped_slot", "is", null)
    .order("equipped_slot", { ascending: true });
  if (error) return { error };
  const talentText = (owned || [])
    .map((item) => `槽位${item.equipped_slot}：${item.talent_name}（${item.rank}）`)
    .join("\n")
    .slice(0, 800);
  const { error: updateError } = await supabase
    .from("player_profiles")
    .update({ talents: talentText, updated_at: new Date().toISOString() })
    .eq("invite_code_hash", codeHash);
  return { error: updateError, talentText };
}

async function getAvailableStorageSlot(
  supabase: ReturnType<typeof createClient>,
  codeHash: string,
) {
  const { data, error } = await supabase
    .from("owned_talents")
    .select("storage_slot")
    .eq("invite_code_hash", codeHash)
    .not("storage_slot", "is", null);
  if (error) return { error, slot: 0 };
  const used = new Set((data || []).map((item) => Number(item.storage_slot)).filter(Boolean));
  for (let slot = 1; slot <= inventorySlotLimit; slot += 1) {
    if (!used.has(slot)) return { slot };
  }
  return { slot: 0 };
}

async function addOwnedTalentToStorage(
  supabase: ReturnType<typeof createClient>,
  codeHash: string,
  talent: { pool_key: string; talent_id: number; talent_name: string; rank: string },
  source: "draw" | "exchange",
) {
  const { data: existingOwned, error: existingError } = await supabase
    .from("owned_talents")
    .select("id")
    .eq("invite_code_hash", codeHash)
    .eq("pool_key", talent.pool_key)
    .eq("talent_id", talent.talent_id)
    .maybeSingle();
  if (existingError) return { error: existingError };
  if (existingOwned) {
    return { duplicateFragmentGain: getTalentFragmentGain(talent.rank) };
  }

  const slotResult = await getAvailableStorageSlot(supabase, codeHash);
  if (slotResult.error) return { error: slotResult.error };
  if (!slotResult.slot) {
    const { data: overflowChoice, error: overflowError } = await supabase
      .from("talent_overflow_choices")
      .insert({
        invite_code_hash: codeHash,
        pool_key: talent.pool_key,
        talent_id: talent.talent_id,
        talent_name: talent.talent_name,
        rank: talent.rank,
        source,
      })
      .select()
      .single();
    if (overflowError) return { error: overflowError };
    return { overflowChoice };
  }

  const { data, error } = await supabase
    .from("owned_talents")
    .insert({
      invite_code_hash: codeHash,
      pool_key: talent.pool_key,
      talent_id: talent.talent_id,
      talent_name: talent.talent_name,
      rank: talent.rank,
      acquired_from: source,
      storage_slot: slotResult.slot,
    })
    .select()
    .single();
  if (error) return { error };
  return { ownedTalent: data };
}

async function settleDuplicateOverflowChoices(
  supabase: ReturnType<typeof createClient>,
  codeHash: string,
  ownedTalents: { pool_key: string; talent_id: number }[],
  overflowChoices: {
    id: number;
    pool_key: string;
    talent_id: number;
    talent_name: string;
    rank: string;
    source: string;
    created_at: string;
  }[],
) {
  const ownedKeys = new Set(ownedTalents.map((item) => getTalentKey(item.pool_key, item.talent_id)));
  const duplicateChoices = overflowChoices.filter((choice) => ownedKeys.has(getTalentKey(choice.pool_key, choice.talent_id)));
  if (!duplicateChoices.length) return { overflowChoices, fragmentGain: 0 };

  const duplicateIds = duplicateChoices.map((choice) => choice.id);
  const { error: deleteError } = await supabase
    .from("talent_overflow_choices")
    .delete()
    .eq("invite_code_hash", codeHash)
    .in("id", duplicateIds);
  if (deleteError) return { error: deleteError };

  return {
    overflowChoices: overflowChoices.filter((choice) => !duplicateIds.includes(choice.id)),
    fragmentGain: 0,
  };
}

async function settleOpenSlotOverflowChoices(
  supabase: ReturnType<typeof createClient>,
  codeHash: string,
  ownedTalents: {
    id: number;
    pool_key: string;
    talent_id: number;
    talent_name: string;
    rank: string;
    acquired_from: string;
    storage_slot: number | null;
    equipped_slot: number | null;
    acquired_at: string;
  }[],
  overflowChoices: {
    id: number;
    pool_key: string;
    talent_id: number;
    talent_name: string;
    rank: string;
    source: string;
    created_at: string;
  }[],
) {
  const remainingChoices = [...overflowChoices];
  const settledChoices: Record<string, unknown>[] = [];
  const usedSlots = new Set(ownedTalents.map((item) => Number(item.storage_slot)).filter(Boolean));
  const ownedKeys = new Set(ownedTalents.map((item) => getTalentKey(item.pool_key, item.talent_id)));
  const settledAt = new Date().toISOString();

  for (const choice of overflowChoices) {
    let openSlot = 0;
    for (let slot = 1; slot <= inventorySlotLimit; slot += 1) {
      if (!usedSlots.has(slot)) {
        openSlot = slot;
        break;
      }
    }
    if (!openSlot) break;

    const choiceKey = getTalentKey(choice.pool_key, choice.talent_id);
    const { data: deletedChoice, error: deleteChoiceError } = await supabase
      .from("talent_overflow_choices")
      .delete()
      .eq("id", choice.id)
      .eq("invite_code_hash", codeHash)
      .select("id, pool_key, talent_id, talent_name, rank, source")
      .maybeSingle();
    if (deleteChoiceError) return { error: deleteChoiceError };
    if (!deletedChoice) continue;

    const remainingIndex = remainingChoices.findIndex((item) => Number(item.id) === Number(choice.id));
    if (remainingIndex >= 0) remainingChoices.splice(remainingIndex, 1);

    if (ownedKeys.has(choiceKey)) continue;

    const { data: insertedTalent, error: insertError } = await supabase
      .from("owned_talents")
      .insert({
        invite_code_hash: codeHash,
        pool_key: choice.pool_key,
        talent_id: choice.talent_id,
        talent_name: choice.talent_name,
        rank: choice.rank,
        acquired_from: choice.source === "exchange" ? "exchange" : "draw",
        storage_slot: openSlot,
      })
      .select("id, pool_key, talent_id, talent_name, rank, acquired_from, storage_slot, equipped_slot, acquired_at")
      .single();
    if (insertError) return { error: insertError };

    usedSlots.add(openSlot);
    ownedKeys.add(choiceKey);
    settledChoices.push({
      ...(insertedTalent as Record<string, unknown>),
      overflow_choice_id: choice.id,
      settled_from_overflow_at: settledAt,
    });
  }

  return { overflowChoices: remainingChoices, settledChoices };
}

async function buildTalentState(
  supabase: ReturnType<typeof createClient>,
  identity: InviteIdentity,
): Promise<{ data?: Record<string, unknown>; error?: LooseError }> {
  const profileResult = await getTalentProfile(supabase, identity);
  if (profileResult.error) return { error: profileResult.error };
  const profile = profileResult.data;

  const drawState = await getTalentDrawState(supabase, identity.codeHash);
  if (drawState.error) return { error: drawState.error };
  const fragmentState = await getFragmentTotal(supabase, identity.codeHash);
  if (fragmentState.error) return { error: fragmentState.error };

  const totalDrawsEarned = getEarnedDraws(profile.ascension_score);
  const spentDraws = drawState.spentDraws;
  const availableDraws = Math.max(0, totalDrawsEarned - spentDraws);
  const allowedPoolKeys = getAllowedTalentPools(profile);
  const talentSlotRule = getTalentSlotRule(profile.ascension_score);
  const activeEquippedSlotLimit = getTalentSlotLimit(profile.ascension_score);

  let poolItems: { pool_key: string; talent_id: number; talent_name: string; rank: string }[] = [];
  if (allowedPoolKeys.length > 0) {
    const poolResult = await supabase
      .from("talent_pool_items")
      .select("pool_key, talent_id, talent_name, rank, effect")
      .in("pool_key", allowedPoolKeys)
      .order("pool_key", { ascending: true })
      .order("rank", { ascending: true })
      .order("talent_id", { ascending: true });
    if (isMissingTalentEffectColumn(poolResult.error ?? null)) {
      const fallbackPoolResult = await supabase
        .from("talent_pool_items")
        .select("pool_key, talent_id, talent_name, rank")
        .in("pool_key", allowedPoolKeys)
        .order("pool_key", { ascending: true })
        .order("rank", { ascending: true })
        .order("talent_id", { ascending: true });
      if (fallbackPoolResult.error) return { error: fallbackPoolResult.error };
      poolItems = fallbackPoolResult.data || [];
    } else {
      if (poolResult.error) return { error: poolResult.error };
      poolItems = poolResult.data || [];
    }
  }

  const poolMap = new Map<string, { poolKey: string; total: number; bCount: number; cCount: number }>();
  allowedPoolKeys.forEach((poolKey) => {
    poolMap.set(poolKey, { poolKey, total: 0, bCount: 0, cCount: 0 });
  });
  poolItems.forEach((item) => {
    const existing = poolMap.get(item.pool_key) || { poolKey: item.pool_key, total: 0, bCount: 0, cCount: 0 };
    existing.total += 1;
    if (item.rank === "B") existing.bCount += 1;
    if (item.rank === "C") existing.cCount += 1;
    poolMap.set(item.pool_key, existing);
  });

  let counters: { pool_key: string; continue_draw: number; s_continue_draw?: number }[] = [];
  if (allowedPoolKeys.length > 0) {
    const countersResult = await supabase
      .from("talent_pool_counters")
      .select("pool_key, continue_draw, s_continue_draw")
      .eq("invite_code_hash", identity.codeHash)
      .in("pool_key", allowedPoolKeys);
    if (countersResult.error) return { error: countersResult.error };
    counters = countersResult.data || [];
  }

  let ownedTalents: {
    id: number;
    pool_key: string;
    talent_id: number;
    talent_name: string;
    rank: string;
    acquired_from: string;
    storage_slot: number | null;
    equipped_slot: number | null;
    acquired_at: string;
  }[] = [];
  const ownedResult = await supabase
    .from("owned_talents")
    .select("id, pool_key, talent_id, talent_name, rank, acquired_from, storage_slot, equipped_slot, acquired_at")
    .eq("invite_code_hash", identity.codeHash)
    .order("storage_slot", { ascending: true });
  if (ownedResult.error) return { error: ownedResult.error };
  ownedTalents = (ownedResult.data || []).filter((item) => item.storage_slot || item.equipped_slot);

  let drawLogs: {
    pool_key: string;
    draw_type: string;
    talent_id: number;
    talent_name: string;
    rank: string;
    is_guarantee: boolean;
    is_repeat: boolean;
    fragment_gain: number;
    draw_time: string;
  }[] = [];
  if (allowedPoolKeys.length > 0) {
    const logResult = await supabase
      .from("talent_draw_logs")
      .select("pool_key, draw_type, talent_id, talent_name, rank, is_guarantee, is_repeat, fragment_gain, draw_time")
      .eq("invite_code_hash", identity.codeHash)
      .in("pool_key", allowedPoolKeys)
      .order("draw_time", { ascending: false })
      .limit(50);
    if (logResult.error) return { error: logResult.error };
    drawLogs = logResult.data || [];
  }

  let exchangeLogs: {
    pool_key: string;
    target_talent_id: number;
    target_talent_name: string;
    cost_fragment: number;
    exchange_time: string;
  }[] = [];
  if (allowedPoolKeys.length > 0) {
    const exchangeResult = await supabase
      .from("talent_exchange_logs")
      .select("pool_key, target_talent_id, target_talent_name, cost_fragment, exchange_time")
      .eq("invite_code_hash", identity.codeHash)
      .in("pool_key", allowedPoolKeys)
      .order("exchange_time", { ascending: false })
      .limit(30);
    if (exchangeResult.error) return { error: exchangeResult.error };
    exchangeLogs = exchangeResult.data || [];
  }

  const { data: overflowChoices, error: overflowError } = await supabase
    .from("talent_overflow_choices")
    .select("id, pool_key, talent_id, talent_name, rank, source, created_at")
    .eq("invite_code_hash", identity.codeHash)
    .order("created_at", { ascending: true });
  if (overflowError) return { error: overflowError };
  const overflowSettlement = await settleDuplicateOverflowChoices(
    supabase,
    identity.codeHash,
    ownedTalents,
    overflowChoices || [],
  );
  if (overflowSettlement.error) return { error: overflowSettlement.error };
  const openSlotSettlement = await settleOpenSlotOverflowChoices(
    supabase,
    identity.codeHash,
    ownedTalents,
    overflowSettlement.overflowChoices || [],
  );
  if (openSlotSettlement.error) return { error: openSlotSettlement.error };
  if ((openSlotSettlement.settledChoices || []).length) {
    const refreshedOwnedResult = await supabase
      .from("owned_talents")
      .select("id, pool_key, talent_id, talent_name, rank, acquired_from, storage_slot, equipped_slot, acquired_at")
      .eq("invite_code_hash", identity.codeHash)
      .order("storage_slot", { ascending: true });
    if (refreshedOwnedResult.error) return { error: refreshedOwnedResult.error };
    ownedTalents = (refreshedOwnedResult.data || []).filter((item) => item.storage_slot || item.equipped_slot);
  }
  const settledFragmentTotal = fragmentState.fragmentTotal + Number(overflowSettlement.fragmentGain || 0);

  return {
    data: {
      profile,
      inventorySlotLimit,
      equippedSlotLimit: activeEquippedSlotLimit,
      maxEquippedSlotLimit: equippedSlotLimit,
      talentSlotRule,
      talentSlotScoreRules,
      talentSlotKinds,
      faithTalentPoolKey: getFaithTalentPoolKey(profile),
      professionTalentPoolKey: getProfessionTalentPoolKey(profile),
      starterTalentDrawGrant,
      bTalentDrawRate,
      advancedBTalentDrawRate,
      aTalentDrawRate,
      sTalentDrawRate,
      bTalentGuaranteeDraws,
      sTalentGuaranteeDraws,
      cTalentFragmentGain,
      bTalentFragmentGain,
      targetTalentExchangeCost,
      aTalentExchangeCost,
      totalDrawsEarned,
      spentDraws,
      availableDraws,
      fragmentTotal: settledFragmentTotal,
      pools: [...poolMap.values()],
      allowedPoolKeys,
      poolItems,
      counters,
      ownedTalents,
      overflowChoices: openSlotSettlement.overflowChoices || [],
      settledOverflowChoices: openSlotSettlement.settledChoices || [],
      drawLogs,
      exchangeLogs,
    },
  };
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

async function confirmClearRecordsFromSettlement(
  supabase: ReturnType<typeof createClient>,
  dungeon: { id: unknown; name: unknown; run_count: unknown },
  entries: { nick: string; deng: number; jin: number; total: number; line: number; raw: string }[],
  profiles: Map<string, Record<string, unknown>>,
  operatorName: string,
) {
  let confirmed = 0;
  const runNumber = Number(dungeon.run_count) || 1;
  for (const entry of entries) {
    const profile = profiles.get(entry.nick) || {};
    const codeHash = String(profile.invite_code_hash || "");
    if (!codeHash) continue;
    const { error } = await supabase
      .from("clear_records")
      .insert({
        dungeon_id: String(dungeon.id),
        run_number: runNumber,
        invite_code_hash: codeHash,
        invite_name: entry.nick,
        feedback_tags: ["审核确认"],
        feedback_note: `由审核员 ${operatorName} 在分数结算时确认通关`,
      });
    if (error?.code === "23505") continue;
    if (isMissingForumColumn(error)) {
      const retry = await supabase
        .from("clear_records")
        .insert({
          dungeon_id: String(dungeon.id),
          run_number: runNumber,
          invite_code_hash: codeHash,
          invite_name: entry.nick,
        });
      if (retry.error?.code === "23505") continue;
      if (retry.error) return { error: retry.error };
    } else if (error) {
      return { error };
    }
    confirmed += 1;
  }

  const stats = await recalculateClearStats(supabase, String(dungeon.id));
  if (stats.error) return { error: stats.error };
  return { confirmed, dungeon: stats.data };
}

async function resolveSettlementDungeon(
  supabase: ReturnType<typeof createClient>,
  dungeonIdInput: unknown,
  dungeonNameInput: unknown,
) {
  const dungeonId = cleanText(dungeonIdInput, 80);
  const dungeonName = cleanText(dungeonNameInput, 80);
  let query = supabase
    .from("dungeons")
    .select("id, name, run_count");
  if (isUuid(dungeonId)) {
    query = query.eq("id", dungeonId);
  } else if (dungeonName) {
    query = query.eq("name", dungeonName);
  } else {
    return { error: { message: "请选择副本" } };
  }
  const { data, error } = await query.maybeSingle();
  if (error) return { error };
  if (!data) return { error: { message: "未找到所选副本，请从副本列表中选择" } };
  return { data };
}

async function getMatchState(
  supabase: ReturnType<typeof createClient>,
  dungeonId: string,
) {
  const { data: dungeon, error: dungeonError } = await supabase
    .from("dungeons")
    .select("id, name, creator, co_creators, difficulty, type, participant_count, run_count, clear_rate, avg_rating, rating_count")
    .eq("id", dungeonId)
    .single();
  if (dungeonError) return { error: dungeonError };

  const { data: queue, error: queueError } = await supabase
    .from("match_queue")
    .select("id, player_name, created_at")
    .eq("dungeon_id", dungeonId)
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (queueError) return { error: queueError };

  const { data: rooms, error: roomsError } = await supabase
    .from("match_rooms")
    .select(`
      id,
      dungeon_id,
      target_player_count,
      room_status,
      created_at,
      finished_at,
      match_room_players (
        id,
        player_name,
        finish_status,
        joined_at
      )
    `)
    .eq("dungeon_id", dungeonId)
    .eq("room_status", "running")
    .order("created_at", { ascending: false })
    .limit(10);
  if (roomsError) return { error: roomsError };

  return {
    data: {
      dungeon,
      queue: queue || [],
      queuedCount: queue?.length || 0,
      rooms: rooms || [],
    },
  };
}

async function getMatchMusterState(
  supabase: ReturnType<typeof createClient>,
  musterId: string,
  identity: InviteIdentity,
) {
  const readMuster = () => supabase
    .from("match_musters")
    .select("id, dungeon_id, creator_code_hash, creator_name, target_player_count, status, opens_at, closes_at, room_id, created_at, drawn_at")
    .eq("id", musterId)
    .single();

  let { data: muster, error: musterError } = await readMuster();
  if (musterError) return { error: musterError };

  const closesAt = new Date(String(muster.closes_at || "")).getTime();
  if (muster.status === "open" && Number.isFinite(closesAt) && closesAt <= Date.now()) {
    const { error: drawError } = await supabase.rpc("draw_match_muster", {
      p_muster_id: musterId,
    });
    if (drawError && !String(drawError.message || "").includes("召集尚未截止")) return { error: drawError };

    const reread = await readMuster();
    muster = reread.data;
    musterError = reread.error;
    if (musterError) return { error: musterError };
  }

  const dungeonId = String(muster.dungeon_id || "");
  const { data: dungeon, error: dungeonError } = await supabase
    .from("dungeons")
    .select("id, name, creator, co_creators, difficulty, type, participant_count, run_count, clear_rate, avg_rating, rating_count, comment_count, is_one_shot")
    .eq("id", dungeonId)
    .single();
  if (dungeonError) return { error: dungeonError };

  const { data: participants, error: participantError } = await supabase
    .from("match_muster_participants")
    .select("id, player_name, status, joined_at, selected_at")
    .eq("muster_id", musterId)
    .order("joined_at", { ascending: true })
    .order("id", { ascending: true });
  if (participantError) return { error: participantError };

  let room = null;
  if (muster.room_id) {
    const { data: roomData, error: roomError } = await supabase
      .from("match_rooms")
      .select("id, dungeon_id, target_player_count, room_status, created_at, finished_at")
      .eq("id", String(muster.room_id))
      .maybeSingle();
    if (roomError) return { error: roomError };

    const { data: players, error: playerError } = await supabase
      .from("match_room_players")
      .select("id, player_name, finish_status, joined_at")
      .eq("room_id", String(muster.room_id))
      .order("joined_at", { ascending: true })
      .order("id", { ascending: true });
    if (playerError) return { error: playerError };

    room = roomData ? { ...roomData, players: players || [] } : null;
  }

  const participantRows = participants || [];
  const joinedCount = participantRows.filter((player) => player.status === "joined").length;
  const selectedCount = participantRows.filter((player) => player.status === "selected").length;
  const myName = identity.displayName.trim().toLowerCase();
  const myParticipant = participantRows.find((player) => String(player.player_name || "").trim().toLowerCase() === myName);
  const isCreator = String(muster.creator_code_hash || "") === identity.codeHash;
  const secondsRemaining = Math.max(0, Math.ceil((new Date(String(muster.closes_at || "")).getTime() - Date.now()) / 1000));

  return {
    data: {
      muster: {
        id: muster.id,
        dungeon_id: muster.dungeon_id,
        creator_name: muster.creator_name,
        target_player_count: muster.target_player_count,
        status: muster.status,
        opens_at: muster.opens_at,
        closes_at: muster.closes_at,
        room_id: muster.room_id,
        created_at: muster.created_at,
        drawn_at: muster.drawn_at,
      },
      dungeon,
      participants: participantRows,
      joinedCount,
      selectedCount,
      room,
      myStatus: myParticipant?.status || "none",
      isCreator,
      secondsRemaining,
    },
  };
}

async function commitScoreSettlement(
  supabase: ReturnType<typeof createClient>,
  identity: InviteIdentity,
  sourceType: "batch" | "single",
  dungeonNameInput: unknown,
  entries: { nick: string; deng: number; jin: number; total: number; line: number; raw: string }[],
  options: { rawText?: string; remark?: string; confirmClear?: boolean; dungeonId?: unknown; settlementRequestId?: unknown } = {},
) {
  const rawText = cleanText(options.rawText ?? "", 20000);
  const remark = cleanText(options.remark ?? "", 500);
  const confirmClear = !!options.confirmClear;
  const clientRequestId = cleanRequestKey(options.settlementRequestId);
  const dungeonResult = await resolveSettlementDungeon(supabase, options.dungeonId, dungeonNameInput);
  if (dungeonResult.error) return { error: dungeonResult.error };
  const dungeon = dungeonResult.data;
  const dungeonName = cleanText(dungeon.name, 80);

  const preview = await buildScorePreview(supabase, entries, []);
  if (preview.error) return { error: preview.error };
  if (!preview.data?.valid) return { error: { message: "预校验未通过", preview: preview.data } };

  const profileResult = await getProfilesByNames(supabase, entries.map((entry) => entry.nick));
  if (profileResult.error) return { error: profileResult.error };
  const profiles = profileResult.profiles || new Map<string, Record<string, unknown>>();
  const totalDeng = entries.reduce((sum, entry) => sum + entry.deng, 0);
  const totalJin = entries.reduce((sum, entry) => sum + entry.jin, 0);

  const { data: settlement, error: settlementError } = await supabase
    .from("score_settlements")
    .insert({
      dungeon_name: dungeonName,
      source_type: sourceType,
      operator_code_hash: identity.codeHash,
      operator_name: identity.displayName,
      raw_text: rawText,
      remark,
      total_players: entries.length,
      total_ascension: Math.round(totalDeng * 10) / 10,
      total_audience: Math.round(totalJin * 10) / 10,
      total_score: Math.round((totalDeng + totalJin) * 10) / 10,
      client_request_id: clientRequestId || null,
    })
    .select()
    .single();
  if (settlementError?.code === "23505" && clientRequestId) {
    const existing = await getScoreSettlementResultByRequestId(supabase, identity, clientRequestId);
    if (existing.data) return existing;
    return { error: { message: "这次结算正在处理，请刷新最近结算后确认结果" } };
  }
  if (settlementError) return { error: settlementError };

  const entryRows = entries.map((entry) => {
    const profile = profiles.get(entry.nick) || {};
    return {
      settlement_id: settlement.id,
      player_code_hash: String(profile.invite_code_hash || ""),
      player_name: entry.nick,
      score_deng: entry.deng,
      score_jin: entry.jin,
    };
  });
  const { error: entryError } = await supabase.from("score_settlement_entries").insert(entryRows);
  if (entryError) return { error: entryError };

  for (const entry of entries) {
    const profile = profiles.get(entry.nick) || {};
    const codeHash = String(profile.invite_code_hash || "");
    const currentAscension = cleanScore(profile.ascension_score);
    const currentAudience = cleanScore(profile.audience_score);
    const nextAscension = Math.max(0, Math.round((currentAscension + entry.deng) * 10) / 10);
    const nextAudience = Math.max(0, Math.round((currentAudience + entry.jin) * 10) / 10);
    const { error: updateError } = await supabase
      .from("player_profiles")
      .update({
        ascension_score: nextAscension,
        audience_score: nextAudience,
        updated_at: new Date().toISOString(),
      })
      .eq("invite_code_hash", codeHash);
    if (updateError) return { error: updateError };
  }

  const logRows = entries.map((entry) => {
    const profile = profiles.get(entry.nick) || {};
    return {
      player_code_hash: String(profile.invite_code_hash || ""),
      player_name: entry.nick,
      change_deng: entry.deng,
      change_jin: entry.jin,
      source_type: sourceType,
      settlement_id: settlement.id,
      operator_code_hash: identity.codeHash,
      operator_name: identity.displayName,
    };
  });
  const { error: logError } = await supabase.from("score_change_logs").insert(logRows);
  if (logError) return { error: logError };

  const clearResult = confirmClear
    ? await confirmClearRecordsFromSettlement(supabase, dungeon, entries, profiles, identity.displayName)
    : { confirmed: 0 };
  if (clearResult.error) return { error: clearResult.error };

  const messageRows = entries.map((entry) => {
    const profile = profiles.get(entry.nick) || {};
    const typeName = sourceType === "single" ? "漏分补发" : "批量结算";
    const clearText = confirmClear ? "\n通关确认：已由审核员登记通过" : "";
    const content = `【${typeName}｜副本：${dungeonName}】\n审核员：${identity.displayName}\n登神之路：${entry.deng >= 0 ? "+" : ""}${entry.deng}\n觐见之梯：+${entry.jin}\n本次总变化：${entry.total >= 0 ? "+" : ""}${entry.total}${clearText}${remark ? `\n备注：${remark}` : ""}`;
    return {
      player_code_hash: String(profile.invite_code_hash || ""),
      player_name: entry.nick,
      settlement_id: settlement.id,
      msg_type: sourceType,
      content,
    };
  });
  const { error: messageError } = await supabase.from("score_messages").insert(messageRows);
  if (messageError) return { error: messageError };

  return { data: { settlement, entries: entryRows, clearConfirmed: Number(clearResult.confirmed || 0) } };
}

async function getScoreSettlementResultByRequestId(
  supabase: ReturnType<typeof createClient>,
  identity: InviteIdentity,
  clientRequestId: string,
) {
  const { data: settlement, error: settlementError } = await supabase
    .from("score_settlements")
    .select("*")
    .eq("operator_code_hash", identity.codeHash)
    .eq("client_request_id", clientRequestId)
    .maybeSingle();
  if (settlementError || !settlement) return { data: null, error: settlementError || null };
  const { data: entries, error: entriesError } = await supabase
    .from("score_settlement_entries")
    .select("settlement_id, player_code_hash, player_name, score_deng, score_jin")
    .eq("settlement_id", settlement.id);
  if (entriesError) return { data: null, error: entriesError };
  return { data: { settlement, entries: entries || [], clearConfirmed: 0 } };
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

  if (action === "getCommentHonors") {
    const result = await getCommentHonorBuckets(supabase, payload.commentIds);
    if (result.error) return json({ error: result.error.message }, 400);
    return json({ data: { byCommentId: result.byCommentId } });
  }

  if (action === "listDungeons") {
    const identity = body.inviteCode ? await getInviteIdentity(supabase, body.inviteCode) : null;
    const limit = Math.max(1, Math.min(300, Number(payload.limit || 300)));
    const selectFields = "id, name, creator, co_creators, difficulty, type, description, pinned_note, participant_count, run_count, clear_count, clear_rate, invite_code_hash, invite_name, avg_rating, rating_count, comment_count, created_at, is_one_shot, review_status, reviewed_at, reviewed_by_name, review_note";
    const { data, error } = await supabase
      .from("dungeons")
      .select(selectFields)
      .order("avg_rating", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error?.code === "42703") return json({ error: "请先运行 dungeon review migration" }, 400);
    if (error) return json({ error: error.message }, 400);
    const rows = (data || [])
      .filter((dungeon) => canViewDungeonRecord(dungeon as Record<string, unknown>, identity))
      .map((dungeon) => {
        const record = dungeon as Record<string, unknown>;
        const reviewStatus = getDungeonReviewStatus(record);
        const creatorOwned = !!identity && canManageDungeonRecord(record, identity);
        return {
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
        };
      });
    return json({ data: rows });
  }

  const identity = await getInviteIdentity(supabase, body.inviteCode);
  if (!identity) return json({ error: "邀请码无效或已过期" }, 401);
  const role = identity.role;

  try {
    if (action === "verifyInvite") {
      return json({ role, label: roleLabels[role], name: identity.displayName });
    }

    if (action === "updateDisplayName") {
      if (!identity.inviteId) return json({ error: "共享邀请码不能绑定个人昵称，请使用专属码" }, 403);
      const inviteCodeText = cleanText(body.inviteCode, 200);
      const isInitialBinding = role !== "god" && cleanText(identity.displayName, 200).toLowerCase() === inviteCodeText.toLowerCase();
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

      return json({ role, label: roleLabels[role], name: data.display_name });
    }

    if (action === "saveProfile") {
      if (role === "god") return json({ error: "神明账号不建立信徒个人档案" }, 403);
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
      const nextFaithGod = locked ? existing.faith_god : faithGod;
      const nextFaithPath = locked ? existing.faith_path : faithPath;
      const nextProfession = locked ? existing.profession : profession;
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
        .select("display_name, role, faith_god, faith_path, original_faith_god, original_faith_path, profession, ascension_score, audience_score, items, talents, scores_locked_at, updated_at")
        .single();
      if (error?.code === "42P01") return json({ error: "请先运行 player_profiles_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);

      const titleResult = await getActiveTitleForHash(supabase, identity.codeHash);
      if (titleResult.error) return json({ error: titleResult.error.message }, 400);
      const curseResult = await getActiveCurseForHash(supabase, identity.codeHash);
      if (curseResult.error) return json({ error: curseResult.error.message }, 400);
      const dataWithTitle = {
        ...data,
        active_title: titleResult.title,
        active_titles: titleResult.titles || [],
        active_curse: curseResult.curse,
        active_curses: curseResult.curses || [],
      };

      return json({ role, name: identity.displayName, data: dataWithTitle });
    }

    if (action === "updateTrickeryFaith") {
      if (role === "god") return json({ error: "神明账号不建立信徒个人档案" }, 403);
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const faithGod = cleanText(payload.faithGod, 20);
      const faithPath = getFaithPathByGod(faithGod);
      if (!faithGod || !faithPath) return json({ error: "请选择有效信仰神明" }, 400);

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
          faith_god: faithGod,
          faith_path: faithPath,
          updated_at: new Date().toISOString(),
        })
        .eq("invite_code_hash", identity.codeHash)
        .select("display_name, role, faith_god, faith_path, original_faith_god, original_faith_path, profession, ascension_score, audience_score, items, talents, scores_locked_at, updated_at")
        .single();
      if (error) return json({ error: error.message }, 400);

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

    if (action === "listProfiles") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin", "god"])) return json({ error: "需要入局谕令" }, 403);

      const { data, error } = await supabase
        .from("player_profiles")
        .select("invite_code_hash, display_name, role, faith_god, faith_path, original_faith_god, original_faith_path, profession, ascension_score, audience_score, updated_at")
        .order("ascension_score", { ascending: false })
        .limit(300);
      if (error?.code === "42P01") return json({ error: "请先运行 player_profiles_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);

      const titleResult = await getActiveTitlesByHashes(
        supabase,
        (data || []).map((profile: Record<string, unknown>) => cleanText(profile.invite_code_hash, 64)),
      );
      if (titleResult.error) return json({ error: titleResult.error.message }, 400);
      const curseResult = await getActiveCursesByHashes(
        supabase,
        (data || []).map((profile: Record<string, unknown>) => cleanText(profile.invite_code_hash, 64)),
      );
      if (curseResult.error) return json({ error: curseResult.error.message }, 400);

      const publicProfiles = await Promise.all((data || []).map(async (profile: Record<string, unknown>) => {
        const inviteCodeHash = cleanText(profile.invite_code_hash, 64);
        const { invite_code_hash: _hiddenInviteHash, ...rest } = profile;
        return {
          ...rest,
          active_title: (titleResult.titles.get(inviteCodeHash) || [])[0] || null,
          active_titles: titleResult.titles.get(inviteCodeHash) || [],
          active_curse: (curseResult.curses.get(inviteCodeHash) || [])[0] || null,
          active_curses: curseResult.curses.get(inviteCodeHash) || [],
          profile_key: await getPublicProfileKey(inviteCodeHash),
          is_current: inviteCodeHash === identity.codeHash,
        };
      }));

      return json({
        role,
        name: identity.displayName,
        data: publicProfiles,
      });
    }

    if (action === "getPublicProfile") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin", "god"])) return json({ error: "需要入局谕令" }, 403);

      const profileKey = cleanText(payload.profileKey ?? payload.profile_key, 96);
      if (!/^[a-f0-9]{64}$/i.test(profileKey)) return json({ error: "公开档案标识不正确" }, 400);

      const { data: profiles, error: profileError } = await supabase
        .from("player_profiles")
        .select("invite_code_hash, display_name, role, faith_god, faith_path, original_faith_god, original_faith_path, profession, ascension_score, audience_score, items, talents, updated_at")
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
      targetProfile.active_title = titleResult.title;
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

    if (action === "grantProfileTitle") {
      if (!canGrantTitles(role)) return json({ error: "需要馆主或神明谕令" }, 403);

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
      if (role === "god" && cleanText(target.faith_god, 20) !== identity.displayName) {
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
          granted_by_type: role === "god" || titleGod ? "god" : "admin",
          granted_by_hash: identity.codeHash,
          granted_by_name: identity.displayName,
          is_active: true,
        })
        .select("id, title_text, title_god, title_note, granted_by_type, granted_by_name, granted_at")
        .single();
      if (error?.code === "42P01") return json({ error: "请先运行 profile_titles_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);

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

    if (action === "grantBetrayalCurse") {
      if (!canGrantTitles(role)) return json({ error: "需要馆主或神明谕令" }, 403);

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
      if (!targetHash) return json({ error: "请填写受诅昵称" }, 400);
      if (!curseGod) return json({ error: "请选择诅咒名义" }, 400);
      if (role === "god" && (!targetFaithGod || targetFaithGod === identity.displayName)) {
        return json({ error: "对应神明只能对已改信者下放背弃诅咒" }, 403);
      }

      const curseText = "背弃诅咒";
      const apostateTitle = "背弃者";
      const { data: curseData, error: curseError } = await supabase
        .from("profile_curses")
        .insert({
          invite_code_hash: targetHash,
          display_name: cleanText(target.display_name, 40),
          curse_text: curseText,
          curse_god: curseGod,
          curse_note: curseNote,
          granted_by_type: role === "god" || curseGod ? "god" : "admin",
          granted_by_hash: identity.codeHash,
          granted_by_name: identity.displayName,
          is_active: true,
        })
        .select("id, curse_text, curse_god, curse_note, granted_by_type, granted_by_name, granted_at")
        .single();
      if (curseError?.code === "42P01") return json({ error: "请先运行 profile_curses_migration.sql" }, 400);
      if (curseError) return json({ error: curseError.message }, 400);

      const { data: titleData, error: titleError } = await supabase
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
      if (titleError?.code === "42P01") return json({ error: "请先运行 profile_titles_migration.sql" }, 400);
      if (titleError) return json({ error: titleError.message }, 400);

      return json({
        role,
        name: identity.displayName,
        data: {
          targetName: cleanText(target.display_name, 40),
          activeTitle: toPublicTitle(titleData as Record<string, unknown>),
          activeTitles: [toPublicTitle(titleData as Record<string, unknown>)].filter(Boolean),
          activeCurse: toPublicCurse(curseData as Record<string, unknown>),
          activeCurses: [toPublicCurse(curseData as Record<string, unknown>)].filter(Boolean),
        },
      });
    }

    if (action === "revokeProfileTitle") {
      if (!canGrantTitles(role)) return json({ error: "需要馆主或神明谕令" }, 403);

      const targetResult = await getProfileByDisplayName(supabase, payload.targetName);
      if (targetResult.error) {
        if (targetResult.error.code === "42P01") return json({ error: "请先运行 player_profiles_migration.sql" }, 400);
        return json({ error: targetResult.error.message }, 400);
      }

      const target = targetResult.data as Record<string, unknown>;
      const targetHash = cleanText(target.invite_code_hash, 64);
      const titleText = cleanText(payload.titleText, 32);
      let activeTitleQuery = supabase
        .from("profile_titles")
        .select("id, title_text, title_god, granted_by_hash")
        .eq("invite_code_hash", targetHash)
        .eq("is_active", true)
        .order("granted_at", { ascending: false })
        .limit(1);
      if (titleText) activeTitleQuery = activeTitleQuery.eq("title_text", titleText);
      const { data: activeTitles, error: activeTitleError } = await activeTitleQuery;
      if (activeTitleError?.code === "42P01") return json({ error: "请先运行 profile_titles_migration.sql" }, 400);
      if (activeTitleError) return json({ error: activeTitleError.message }, 400);
      const activeTitle = (activeTitles || [])[0];
      if (!activeTitle) return json({ error: "这个玩家当前没有生效称号" }, 404);
      if (
        role === "god" &&
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

      return json({
        role,
        name: identity.displayName,
        data: {
          targetName: cleanText(target.display_name, 40),
          revokedTitle: cleanText((data as Record<string, unknown>).title_text, 32),
        },
      });
    }

    if (action === "revokeProfileCurse") {
      if (!canGrantTitles(role)) return json({ error: "需要馆主或神明谕令" }, 403);

      const targetResult = await getProfileByDisplayName(supabase, payload.targetName);
      if (targetResult.error) {
        if (targetResult.error.code === "42P01") return json({ error: "请先运行 player_profiles_migration.sql" }, 400);
        return json({ error: targetResult.error.message }, 400);
      }

      const target = targetResult.data as Record<string, unknown>;
      const targetHash = cleanText(target.invite_code_hash, 64);
      const curseText = cleanText(payload.curseText, 32);
      let activeCurseQuery = supabase
        .from("profile_curses")
        .select("id, curse_text, curse_god, granted_by_hash")
        .eq("invite_code_hash", targetHash)
        .eq("is_active", true)
        .order("granted_at", { ascending: false })
        .limit(1);
      if (curseText) activeCurseQuery = activeCurseQuery.eq("curse_text", curseText);
      const { data: activeCurses, error: activeCurseError } = await activeCurseQuery;
      if (activeCurseError?.code === "42P01") return json({ error: "请先运行 profile_curses_migration.sql" }, 400);
      if (activeCurseError) return json({ error: activeCurseError.message }, 400);
      const activeCurse = (activeCurses || [])[0];
      if (!activeCurse) return json({ error: "这个玩家当前没有生效诅咒" }, 404);
      if (
        role === "god" &&
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

      return json({
        role,
        name: identity.displayName,
        data: {
          targetName: cleanText(target.display_name, 40),
          revokedCurse: cleanText((data as Record<string, unknown>).curse_text, 32),
        },
      });
    }

    if (action === "checkScorePreview") {
      if (!canSettleScores(role)) return json({ error: "需要审核员权限" }, 403);
      const { entries, invalidLines } = parseScoreSettlementText(payload.textContent);
      const preview = await buildScorePreview(supabase, entries, invalidLines);
      if (preview.error?.code === "42P01") return json({ error: "请先运行 score_system_migration.sql" }, 400);
      if (preview.error) return json({ error: preview.error.message }, 400);
      return json({ role, name: identity.displayName, data: preview.data });
    }

    if (action === "submitScoreBatch") {
      if (!canSettleScores(role)) return json({ error: "需要审核员权限" }, 403);
      const { entries, invalidLines } = parseScoreSettlementText(payload.textContent);
      if (invalidLines.length) return json({ error: "结算文本格式有误", data: { invalidLines } }, 400);
      const result = await commitScoreSettlement(
        supabase,
        identity,
        "batch",
        payload.dungeonName,
        entries,
        {
          rawText: cleanText(payload.textContent, 20000),
          remark: cleanText(payload.remark, 500),
          confirmClear: payload.confirmClear === true,
          dungeonId: payload.dungeonId,
          settlementRequestId: payload.settlementRequestId,
        },
      );
      if (result.error?.code === "42P01") return json({ error: "请先运行 score_system_migration.sql" }, 400);
      if (result.error) return json({ error: result.error.message || "结算失败", data: result.error.preview || null }, 400);
      return json({ role, name: identity.displayName, data: result.data });
    }

    if (action === "submitScoreSingle") {
      if (!canSettleScores(role)) return json({ error: "需要审核员权限" }, 403);
      const nick = cleanText(payload.playerName, 40);
      const deng = cleanSettlementScore(payload.dengScore);
      const jin = cleanSettlementScore(payload.jinScore);
      const rangeMessage = checkSettlementScoreRange(deng, jin);
      if (!nick || rangeMessage) return json({ error: rangeMessage || "请填写玩家昵称" }, 400);
      const result = await commitScoreSettlement(
        supabase,
        identity,
        "single",
        payload.dungeonName,
        [{ nick, deng, jin, total: Math.round((deng + jin) * 10) / 10, line: 1, raw: `${nick}:${deng}+${jin}` }],
        {
          remark: cleanText(payload.remark, 500),
          confirmClear: payload.confirmClear === true,
          dungeonId: payload.dungeonId,
          settlementRequestId: payload.settlementRequestId,
        },
      );
      if (result.error?.code === "42P01") return json({ error: "请先运行 score_system_migration.sql" }, 400);
      if (result.error) return json({ error: result.error.message || "补分失败", data: result.error.preview || null }, 400);
      return json({ role, name: identity.displayName, data: result.data });
    }

    if (action === "listScoreSettlements") {
      if (!canSettleScores(role)) return json({ error: "需要审核员权限" }, 403);
      const limit = Math.max(1, Math.min(100, Number(payload.limit || 30)));
      const { data, error } = await supabase
        .from("score_settlements")
        .select("id, dungeon_name, source_type, operator_name, total_players, total_ascension, total_audience, total_score, is_revoked, revoke_remark, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error?.code === "42P01") return json({ error: "请先运行 score_system_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);
      return json({ role, name: identity.displayName, data: data || [] });
    }

    if (action === "getScoreSettlementDetail") {
      if (!canSettleScores(role)) return json({ error: "需要审核员权限" }, 403);
      const settlementId = cleanText(payload.settlementId, 80);
      if (!isUuid(settlementId)) return json({ error: "结算 ID 不正确" }, 400);
      const { data: settlement, error: settlementError } = await supabase
        .from("score_settlements")
        .select("*")
        .eq("id", settlementId)
        .single();
      if (settlementError) return json({ error: settlementError.message }, 400);
      const { data: entries, error: entriesError } = await supabase
        .from("score_settlement_entries")
        .select("player_name, score_deng, score_jin, total_add")
        .eq("settlement_id", settlementId)
        .order("id", { ascending: true });
      if (entriesError) return json({ error: entriesError.message }, 400);
      return json({ role, name: identity.displayName, data: { settlement, entries: entries || [] } });
    }

    if (action === "revokeScoreSettlement") {
      if (!canSettleScores(role)) return json({ error: "需要审核员权限" }, 403);
      const settlementId = cleanText(payload.settlementId, 80);
      const revokeRemark = cleanText(payload.revokeRemark, 500);
      if (!isUuid(settlementId)) return json({ error: "结算 ID 不正确" }, 400);
      if (!revokeRemark) return json({ error: "请填写撤销备注" }, 400);

      const { data: settlement, error: settlementError } = await supabase
        .from("score_settlements")
        .select("id, dungeon_name, source_type, operator_code_hash, operator_name, is_revoked")
        .eq("id", settlementId)
        .single();
      if (settlementError) return json({ error: settlementError.message }, 400);
      if (settlement.is_revoked) return json({ error: "这场结算已经撤销过" }, 409);
      if (role !== "admin" && settlement.operator_code_hash !== identity.codeHash) {
        return json({ error: "审核员只能撤销自己提交的结算" }, 403);
      }

      const { data: entries, error: entriesError } = await supabase
        .from("score_settlement_entries")
        .select("player_code_hash, player_name, score_deng, score_jin, total_add")
        .eq("settlement_id", settlementId);
      if (entriesError) return json({ error: entriesError.message }, 400);

      for (const entry of entries || []) {
        const { data: profile, error: profileError } = await supabase
          .from("player_profiles")
          .select("ascension_score, audience_score")
          .eq("invite_code_hash", entry.player_code_hash)
          .single();
        if (profileError) return json({ error: profileError.message }, 400);
        const nextAscension = Math.max(0, Math.round((cleanScore(profile.ascension_score) - Number(entry.score_deng || 0)) * 10) / 10);
        const nextAudience = Math.max(0, Math.round((cleanScore(profile.audience_score) - Number(entry.score_jin || 0)) * 10) / 10);
        const { error: updateError } = await supabase
          .from("player_profiles")
          .update({
            ascension_score: nextAscension,
            audience_score: nextAudience,
            updated_at: new Date().toISOString(),
          })
          .eq("invite_code_hash", entry.player_code_hash);
        if (updateError) return json({ error: updateError.message }, 400);
      }

      const { error: revokeError } = await supabase
        .from("score_settlements")
        .update({
          is_revoked: true,
          revoke_remark: revokeRemark,
          revoked_by_hash: identity.codeHash,
          revoked_by_name: identity.displayName,
          revoked_at: new Date().toISOString(),
        })
        .eq("id", settlementId);
      if (revokeError) return json({ error: revokeError.message }, 400);

      const revokeLogs = (entries || []).map((entry) => ({
        player_code_hash: entry.player_code_hash,
        player_name: entry.player_name,
        change_deng: -Number(entry.score_deng || 0),
        change_jin: -Number(entry.score_jin || 0),
        source_type: "revoke",
        settlement_id: settlementId,
        operator_code_hash: identity.codeHash,
        operator_name: identity.displayName,
        revoke_remark: revokeRemark,
      }));
      if (revokeLogs.length) {
        const { error: logError } = await supabase.from("score_change_logs").insert(revokeLogs);
        if (logError) return json({ error: logError.message }, 400);
        const revokeMessages = (entries || []).map((entry) => ({
          player_code_hash: entry.player_code_hash,
          player_name: entry.player_name,
          settlement_id: settlementId,
          msg_type: "revoke",
          content: `【结算撤销｜副本：${settlement.dungeon_name}】\n撤销人：${identity.displayName}\n登神回滚：${-Number(entry.score_deng || 0)}\n觐见回滚：${-Number(entry.score_jin || 0)}\n备注：${revokeRemark}`,
        }));
        const { error: messageError } = await supabase.from("score_messages").insert(revokeMessages);
        if (messageError) return json({ error: messageError.message }, 400);
      }

      return json({ role, name: identity.displayName, data: { id: settlementId } });
    }

    if (action === "listMyScoreMessages") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);
      const limit = Math.max(1, Math.min(100, Number(payload.limit || 30)));
      const { data, error } = await supabase
        .from("score_messages")
        .select("id, settlement_id, msg_type, content, is_read, created_at")
        .eq("player_code_hash", identity.codeHash)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error?.code === "42P01") return json({ error: "请先运行 score_system_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);
      return json({ role, name: identity.displayName, data: data || [] });
    }

    if (action === "markScoreMessageRead") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);
      const messageId = cleanBigIntId(payload.messageId);
      if (!messageId) return json({ error: "信封 ID 不正确" }, 400);
      const { error } = await supabase
        .from("score_messages")
        .update({ is_read: true })
        .eq("id", messageId)
        .eq("player_code_hash", identity.codeHash);
      if (error) return json({ error: error.message }, 400);
      return json({ role, name: identity.displayName, data: { id: messageId } });
    }

    if (action === "getTalentState") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const state = await buildTalentState(supabase, identity);
      if (isMissingTalentTable(state.error ?? null)) return json({ error: "请先运行 talent_pool_migration.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
    }

    if (action === "drawTalent") {
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

      const totalDrawsEarned = getEarnedDraws(profile.ascension_score);
      const spentDraws = drawState.spentDraws;
      const availableDraws = Math.max(0, totalDrawsEarned - spentDraws);
      if (availableDraws < drawCount) {
        return json({
          error: `抽数不足：当前可用 ${availableDraws} 抽。登神之路每获得 ${drawScoreStep} 分增加 1 抽，抽数可攒。`,
        }, 400);
      }

      const { data: poolItems, error: poolError } = await supabase
        .from("talent_pool_items")
        .select("pool_key, talent_id, talent_name, rank, effect")
        .eq("pool_key", poolKey);
      let poolRows = poolItems;
      if (isMissingTalentEffectColumn(poolError ?? null)) {
        const fallbackPoolResult = await supabase
          .from("talent_pool_items")
          .select("pool_key, talent_id, talent_name, rank")
          .eq("pool_key", poolKey);
        if (fallbackPoolResult.error) return json({ error: fallbackPoolResult.error.message }, 400);
        poolRows = fallbackPoolResult.data || [];
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
      const advancedDraw = isAdvancedTalentDrawUnlocked(profile.ascension_score);
      const results: Record<string, unknown>[] = [];
      let fragmentGainTotal = 0;
      const nextSpentDraws = spentDraws + drawCount;

      const { error: initialStateError } = await supabase
        .from("talent_draw_state")
        .insert({
          invite_code_hash: identity.codeHash,
          spent_draws: spentDraws,
          updated_at: new Date().toISOString(),
        });
      if (initialStateError && initialStateError.code !== "23505") {
        return json({ error: initialStateError.message }, 400);
      }

      const { data: reservedState, error: reserveError } = await supabase
        .from("talent_draw_state")
        .update({
          spent_draws: nextSpentDraws,
          updated_at: new Date().toISOString(),
        })
        .eq("invite_code_hash", identity.codeHash)
        .eq("spent_draws", spentDraws)
        .select("spent_draws")
        .maybeSingle();
      if (reserveError) return json({ error: reserveError.message }, 400);
      if (!reservedState) {
        return json({ error: "抽取请求已在处理中，请刷新天赋池后再试" }, 409);
      }

      for (let i = 0; i < drawCount; i += 1) {
        const isStarterDraw = spentDraws + i < starterTalentDrawGrant;
        const drawResult = pickDrawTalentWithGuarantee(talentItems, continueDraw, sContinueDraw, !isStarterDraw, advancedDraw);
        const target = drawResult.talent;
        const isB = target.rank === "B";
        const isS = target.rank === "S";
        const isGuarantee = drawResult.isGuarantee && (isB || isS);
        if (!isStarterDraw) {
          continueDraw = isB ? 0 : continueDraw + 1;
          if (advancedDraw) sContinueDraw = isS ? 0 : sContinueDraw + 1;
        }

        const { data: existingOwned, error: ownedReadError } = await supabase
          .from("owned_talents")
          .select("id, storage_slot")
          .eq("invite_code_hash", identity.codeHash)
          .eq("pool_key", poolKey)
          .eq("talent_id", target.talent_id)
          .maybeSingle();
        if (ownedReadError) return json({ error: ownedReadError.message }, 400);
        let isRepeat = !!existingOwned;
        let fragmentGain = 0;
        let storageSlot = 0;
        let overflowChoice: Record<string, unknown> | null = null;
        if (!isRepeat) {
          const addResult = await addOwnedTalentToStorage(supabase, identity.codeHash, target, "draw");
          if (addResult.error) return json({ error: addResult.error.message }, 400);
          storageSlot = Number(addResult.ownedTalent?.storage_slot || 0);
          overflowChoice = addResult.overflowChoice || null;
          if (addResult.duplicateFragmentGain) {
            isRepeat = true;
            fragmentGain = Number(addResult.duplicateFragmentGain || 0);
            fragmentGainTotal += fragmentGain;
          }
        } else {
          fragmentGain = getTalentFragmentGain(target.rank);
          fragmentGainTotal += fragmentGain;
        }

        const { error: logError } = await supabase
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
          });
        if (logError) return json({ error: logError.message }, 400);

        results.push({
          poolKey,
          talentId: target.talent_id,
          talentName: target.talent_name,
          effect: target.effect || "",
          rank: target.rank,
          isGuarantee,
          isRepeat,
          fragmentGain,
          storageSlot,
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

      return json({
        role,
        name: identity.displayName,
        data: {
          drawType,
          results,
          fragmentGain: fragmentGainTotal,
          state: state.data,
        },
      });
    }

    if (action === "exchangeTalent") {
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
        .select("pool_key, talent_id, talent_name, rank, effect")
        .eq("pool_key", poolKey)
        .eq("talent_id", targetTalentId)
        .maybeSingle();
      let targetTalentRow = targetTalent;
      if (isMissingTalentEffectColumn(targetError ?? null)) {
        const fallbackTargetResult = await supabase
          .from("talent_pool_items")
          .select("pool_key, talent_id, talent_name, rank")
          .eq("pool_key", poolKey)
          .eq("talent_id", targetTalentId)
          .maybeSingle();
        if (fallbackTargetResult.error) return json({ error: fallbackTargetResult.error.message }, 400);
        targetTalentRow = fallbackTargetResult.data;
      } else {
        if (isMissingTalentTable(targetError)) return json({ error: "请先运行 talent_pool_migration.sql" }, 400);
        if (targetError) return json({ error: targetError.message }, 400);
      }
      if (!targetTalentRow || !["A", "B"].includes(targetTalentRow.rank)) return json({ error: "只能兑换该池的 B/A 级天赋" }, 400);
      if (targetTalentRow.rank === "A" && !isAdvancedTalentDrawUnlocked(profileResult.data.ascension_score)) {
        return json({ error: "1500 分后才开放 A 级天赋兑换" }, 403);
      }
      const exchangeCost = getTalentExchangeCost(targetTalentRow.rank);

      const { data: owned, error: ownedError } = await supabase
        .from("owned_talents")
        .select("id, storage_slot")
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

    if (action === "resolveTalentOverflow") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const choiceId = cleanBigIntId(payload.choiceId);
      const decision = cleanText(payload.decision, 12);
      if (!choiceId || !["discard", "replace"].includes(decision)) return json({ error: "溢出处理参数不正确" }, 400);
      const replaceOwnedId = decision === "replace" ? cleanBigIntId(payload.replaceOwnedId) : 0;
      if (decision === "replace" && !replaceOwnedId) return json({ error: "请选择要替换的仓库天赋" }, 400);

      const { data: choice, error: choiceError } = await supabase
        .from("talent_overflow_choices")
        .delete()
        .eq("id", choiceId)
        .eq("invite_code_hash", identity.codeHash)
        .select("id, pool_key, talent_id, talent_name, rank, source")
        .maybeSingle();
      if (isMissingTalentTable(choiceError)) return json({ error: "请先运行 talent_inventory_migration.sql" }, 400);
      if (choiceError) return json({ error: choiceError.message }, 400);
      if (!choice) return json({ error: "待处理天赋不存在或已处理" }, 404);

      let fragmentGainTotal = 0;
      if (decision === "discard") {
        fragmentGainTotal += getTalentFragmentGain(choice.rank);
      } else {
        const { data: existingSame, error: existingSameError } = await supabase
          .from("owned_talents")
          .select("id")
          .eq("invite_code_hash", identity.codeHash)
          .eq("pool_key", choice.pool_key)
          .eq("talent_id", choice.talent_id)
          .maybeSingle();
        if (existingSameError) return json({ error: existingSameError.message }, 400);
        if (existingSame) {
          fragmentGainTotal += getTalentFragmentGain(choice.rank);
        } else {
          const { data: replaced, error: deleteOwnedError } = await supabase
            .from("owned_talents")
            .delete()
            .eq("id", replaceOwnedId)
            .eq("invite_code_hash", identity.codeHash)
            .not("storage_slot", "is", null)
            .select("id, storage_slot, rank")
            .maybeSingle();
          if (deleteOwnedError) return json({ error: deleteOwnedError.message }, 400);
          if (!replaced) return json({ error: "要替换的仓库天赋不存在或已处理" }, 404);
          fragmentGainTotal += getTalentFragmentGain(replaced.rank);

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
            });
          if (insertReplacementError) return json({ error: insertReplacementError.message }, 400);
        }
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

    if (action === "setEquippedTalent") {
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
        .select("id, rank, equipped_slot, storage_slot")
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
            .select("id, pool_key, rank, storage_slot, equipped_slot")
            .eq("id", ownedTalentId)
            .eq("invite_code_hash", identity.codeHash)
            .not("storage_slot", "is", null)
            .is("equipped_slot", null)
            .maybeSingle();
          if (ownedError) return json({ error: ownedError.message }, 400);
          if (!ownedRow) return json({ error: "只能携带仓库中的未佩戴天赋" }, 404);
          owned = ownedRow as Record<string, unknown>;
          if (!canEquipTalentPool(owned.pool_key, slotRequirement)) {
            return json({ error: `${slotRequirement.label}槽只能嵌入${slotRequirement.label}池天赋` }, 403);
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
        if (!sourceStorageSlot) return json({ error: "仓库位状态异常，请刷新后重试" }, 400);

        if (currentSlotTalent) {
          const { error: clearCurrentSlotError } = await supabase
            .from("owned_talents")
            .update({ equipped_slot: null })
            .eq("id", currentSlotTalent.id)
            .eq("invite_code_hash", identity.codeHash);
          if (clearCurrentSlotError) return json({ error: clearCurrentSlotError.message }, 400);
        }

        const { error: equipError } = await supabase
          .from("owned_talents")
          .update({ storage_slot: null, equipped_slot: equippedSlot })
          .eq("id", ownedTalentId)
          .eq("invite_code_hash", identity.codeHash);
        if (equipError) return json({ error: equipError.message }, 400);

        if (currentSlotTalent) {
          const { error: storePreviousError } = await supabase
            .from("owned_talents")
            .update({ storage_slot: sourceStorageSlot, equipped_slot: null })
            .eq("id", currentSlotTalent.id)
            .eq("invite_code_hash", identity.codeHash);
          if (storePreviousError) return json({ error: storePreviousError.message }, 400);
        }
      } else if (currentSlotTalent) {
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

      const talentTextUpdate = await updateProfileTalentText(supabase, identity.codeHash);
      if (talentTextUpdate.error) return json({ error: talentTextUpdate.error.message }, 400);
      const state = await buildTalentState(supabase, identity);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: { state: state.data } });
    }

    if (action === "discardOwnedTalent") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const ownedTalentId = cleanBigIntId(payload.ownedTalentId);
      if (!ownedTalentId) return json({ error: "仓库天赋不正确" }, 400);

      const { data: ownedTalent, error: deleteOwnedError } = await supabase
        .from("owned_talents")
        .delete()
        .eq("id", ownedTalentId)
        .eq("invite_code_hash", identity.codeHash)
        .not("storage_slot", "is", null)
        .select("id, rank")
        .maybeSingle();
      if (deleteOwnedError) return json({ error: deleteOwnedError.message }, 400);
      if (!ownedTalent) return json({ error: "仓库天赋不存在或已处理" }, 404);

      const fragmentGain = getTalentFragmentGain(ownedTalent.rank);
      const fragmentUpdate = await addUserFragments(supabase, identity.codeHash, fragmentGain);
      if (fragmentUpdate.error) return json({ error: fragmentUpdate.error.message }, 400);

      const talentTextUpdate = await updateProfileTalentText(supabase, identity.codeHash);
      if (talentTextUpdate.error) return json({ error: talentTextUpdate.error.message }, 400);
      const state = await buildTalentState(supabase, identity);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: { fragmentGain, state: state.data } });
    }

    if (action === "listMatchDungeons") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const limit = Math.max(1, Math.min(Number(payload.limit) || 80, 200));
      let { data: dungeons, error: dungeonError } = await supabase
        .from("dungeons")
        .select("id, name, creator, co_creators, difficulty, type, participant_count, run_count, clear_rate, avg_rating, rating_count, comment_count, created_at, is_one_shot")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (isMissingCoCreatorsColumn(dungeonError)) {
        const fallback = await supabase
          .from("dungeons")
          .select("id, name, creator, difficulty, type, participant_count, run_count, clear_rate, avg_rating, rating_count, comment_count, created_at, is_one_shot")
          .order("created_at", { ascending: false })
          .limit(limit);
        dungeons = fallback.data;
        dungeonError = fallback.error;
      }
      if (isMissingMatchMusterSystem(dungeonError)) return json({ error: "请先运行 match_muster_migration.sql" }, 400);
      if (dungeonError) return json({ error: dungeonError.message }, 400);

      const dungeonIds = (dungeons || []).map((dungeon) => String(dungeon.id)).filter(Boolean);
      const queueCountByDungeon = new Map<string, number>();
      const roomCountByDungeon = new Map<string, number>();

      if (dungeonIds.length) {
        const { data: queueRows, error: queueError } = await supabase
          .from("match_queue")
          .select("dungeon_id")
          .in("dungeon_id", dungeonIds)
          .eq("status", "queued");
        if (isMissingMatchSystem(queueError)) return json({ error: "请先运行 match_system_migration.sql" }, 400);
        if (queueError) return json({ error: queueError.message }, 400);

        for (const row of queueRows || []) {
          const dungeonId = String(row.dungeon_id);
          queueCountByDungeon.set(dungeonId, (queueCountByDungeon.get(dungeonId) || 0) + 1);
        }

        const { data: roomRows, error: roomError } = await supabase
          .from("match_rooms")
          .select("dungeon_id")
          .in("dungeon_id", dungeonIds)
          .eq("room_status", "running");
        if (isMissingMatchSystem(roomError)) return json({ error: "请先运行 match_system_migration.sql" }, 400);
        if (roomError) return json({ error: roomError.message }, 400);

        for (const row of roomRows || []) {
          const dungeonId = String(row.dungeon_id);
          roomCountByDungeon.set(dungeonId, (roomCountByDungeon.get(dungeonId) || 0) + 1);
        }
      }

      return json({
        role,
        name: identity.displayName,
        data: (dungeons || []).map((dungeon) => {
          const dungeonId = String(dungeon.id);
          return {
            ...dungeon,
            queuedCount: queueCountByDungeon.get(dungeonId) || 0,
            runningRoomCount: roomCountByDungeon.get(dungeonId) || 0,
          };
        }),
      });
    }

    if (action === "getMatchState") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      if (!isUuid(dungeonId)) return json({ error: "副本 ID 不正确" }, 400);

      const state = await getMatchState(supabase, dungeonId);
      if (isMissingMatchSystem(state.error)) return json({ error: "请先运行 match_system_migration.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
    }

    if (action === "joinMatchQueue") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      if (!isUuid(dungeonId)) return json({ error: "副本 ID 不正确" }, 400);

      const { data: result, error } = await supabase.rpc("join_match_queue", {
        p_dungeon_id: dungeonId,
        p_player_code_hash: identity.codeHash,
        p_player_name: identity.displayName,
      });
      if (isMissingMatchSystem(error)) return json({ error: "请先运行 match_system_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);

      const state = await getMatchState(supabase, dungeonId);
      if (isMissingMatchSystem(state.error)) return json({ error: "请先运行 match_system_migration.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: { result, state: state.data } });
    }

    if (action === "cancelMatchQueue") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      if (!isUuid(dungeonId)) return json({ error: "副本 ID 不正确" }, 400);

      const { data: result, error } = await supabase.rpc("cancel_match_queue", {
        p_dungeon_id: dungeonId,
        p_player_code_hash: identity.codeHash,
      });
      if (isMissingMatchSystem(error)) return json({ error: "请先运行 match_system_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);

      const state = await getMatchState(supabase, dungeonId);
      if (isMissingMatchSystem(state.error)) return json({ error: "请先运行 match_system_migration.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: { result, state: state.data } });
    }

    if (action === "startMatchMuster") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      if (!isUuid(dungeonId)) return json({ error: "副本 ID 不正确" }, 400);

      const durationSeconds = Math.max(10, Math.min(Number(payload.durationSeconds) || 60, 3600));
      const { data: result, error } = await supabase.rpc("start_match_muster", {
        p_dungeon_id: dungeonId,
        p_creator_code_hash: identity.codeHash,
        p_creator_name: identity.displayName,
        p_duration_seconds: durationSeconds,
      });
      if (isMissingMatchMusterSystem(error)) return json({ error: "请先运行 match_muster_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);

      const musterId = cleanText((result as Record<string, unknown> | null)?.musterId, 80);
      if (!isUuid(musterId)) return json({ error: "召集创建失败" }, 400);
      const state = await getMatchMusterState(supabase, musterId, identity);
      if (isMissingMatchMusterSystem(state.error)) return json({ error: "请先运行 match_muster_migration.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: { result, state: state.data } });
    }

    if (action === "getMatchMuster") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const musterId = cleanText(payload.musterId, 80);
      if (!isUuid(musterId)) return json({ error: "召集 ID 不正确" }, 400);

      const state = await getMatchMusterState(supabase, musterId, identity);
      if (isMissingMatchMusterSystem(state.error)) return json({ error: "请先运行 match_muster_migration.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
    }

    if (action === "joinMatchMuster") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const musterId = cleanText(payload.musterId, 80);
      if (!isUuid(musterId)) return json({ error: "召集 ID 不正确" }, 400);

      const { data: result, error } = await supabase.rpc("join_match_muster", {
        p_muster_id: musterId,
        p_player_code_hash: identity.codeHash,
        p_player_name: identity.displayName,
      });
      if (isMissingMatchMusterSystem(error)) return json({ error: "请先运行 match_muster_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);

      const state = await getMatchMusterState(supabase, musterId, identity);
      if (isMissingMatchMusterSystem(state.error)) return json({ error: "请先运行 match_muster_migration.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: { result, state: state.data } });
    }

    if (action === "cancelMatchMuster") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const musterId = cleanText(payload.musterId, 80);
      if (!isUuid(musterId)) return json({ error: "召集 ID 不正确" }, 400);

      const { data: result, error } = await supabase.rpc("cancel_match_muster_join", {
        p_muster_id: musterId,
        p_player_code_hash: identity.codeHash,
      });
      if (isMissingMatchMusterSystem(error)) return json({ error: "请先运行 match_muster_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);

      const state = await getMatchMusterState(supabase, musterId, identity);
      if (isMissingMatchMusterSystem(state.error)) return json({ error: "请先运行 match_muster_migration.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: { result, state: state.data } });
    }

    if (action === "drawMatchMuster") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "需要入局谕令" }, 403);

      const musterId = cleanText(payload.musterId, 80);
      if (!isUuid(musterId)) return json({ error: "召集 ID 不正确" }, 400);

      const { data: result, error } = await supabase.rpc("draw_match_muster", {
        p_muster_id: musterId,
      });
      if (isMissingMatchMusterSystem(error)) return json({ error: "请先运行 match_muster_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);

      const state = await getMatchMusterState(supabase, musterId, identity);
      if (isMissingMatchMusterSystem(state.error)) return json({ error: "请先运行 match_muster_migration.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: { result, state: state.data } });
    }

    if (action === "listMyDungeons") {
      if (!hasRole(role, ["author", "reviewer", "admin", "god"])) return json({ error: "需要作者、审核员、神明或馆主邀请码" }, 403);
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

    if (action === "submitDungeon") {
      if (!hasRole(role, ["author", "reviewer", "admin", "god"])) return json({ error: "需要作者、审核员、神明或馆主邀请码" }, 403);

      const name = cleanText(payload.name, 80);
      const creator = role === "god" ? identity.displayName : cleanText(payload.creator, 40);
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

    if (action === "reviewDungeon") {
      if (!canReviewDungeons(identity)) return json({ error: "需要羔羊、槐柏、神明或馆主权限" }, 403);

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

    if (action === "markCleared") {
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

    if (action === "advanceRun") {
      if (!hasRole(role, ["author", "reviewer", "admin", "god"])) return json({ error: "需要作者、审核员、神明或馆主邀请码" }, 403);

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

    if (action === "addComment") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin", "god"])) return json({ error: "需要入局谕令" }, 403);

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

    if (action === "deleteComment") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin", "god"])) return json({ error: "需要邀请码" }, 403);

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

    if (action === "getCommentHonors") {
      const result = await getCommentHonorBuckets(supabase, payload.commentIds);
      if (result.error) return json({ error: result.error.message }, 400);
      return json({ role, name: identity.displayName, data: { byCommentId: result.byCommentId } });
    }

    if (action === "updatePinnedNote") {
      if (!hasRole(role, ["author", "reviewer", "admin", "god"])) return json({ error: "需要作者、审核员、神明或馆主邀请码" }, 403);

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

    if (action === "deleteDungeon") {
      if (!hasRole(role, ["author", "reviewer", "admin", "god"])) return json({ error: "需要作者、审核员、神明或馆主邀请码" }, 403);

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

    return json({ error: "未知操作" }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "后端处理失败" }, 500);
  }
});

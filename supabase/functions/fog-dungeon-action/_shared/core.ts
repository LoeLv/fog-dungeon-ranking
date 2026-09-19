import { createClient } from "jsr:@supabase/supabase-js@2";

// ==== shared types ====
export type Ctx = {
  supabase: SupabaseClientAny;
  body: RequestBody;
  payload: Record<string, unknown>;
  action: string;
  req: Request;
  identity?: InviteIdentity | null;
  role?: InviteRole;
};
export type AuthCtx = Ctx & { identity: InviteIdentity; role: InviteRole };


export type SupabaseClientAny = ReturnType<typeof createClient<any, "public", any>>;

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export type InviteRole = "player" | "author" | "reviewer" | "admin" | "god" | "astral";

export type RequestBody = {
  action?: string;
  inviteCode?: string;
  sessionId?: string;
  deviceKind?: string;
  payload?: Record<string, unknown>;
};

export type InviteIdentity = {
  role: InviteRole;
  codeHash: string;
  displayName: string;
  inviteId?: string;
  permissions: string[];
  sessionGeneration: number;
};

export type LooseError = { code?: string; message?: string } | null | undefined;
export type BattleActionResult = { data?: any; error?: any };

export const staffAdminNames = new Set(["羔羊", "槐柏", "南河书淮", "慕辞", "棺材板", "我不想死", "情忆浮生", "知更", "变态", "墨染流年", "洛泽攸"]);
export const talentManagerNames = new Set(["羔羊"]);
export const scoreSettlerNames = new Set(["慕辞", "情忆浮生", "知更", "六伞"]);

export type TalentPoolItem = {
  pool_key: string;
  talent_id: number;
  talent_name: string;
  rank: string;
  effect?: string | null;
  cooldown?: string | null;
  action_cost?: number | null;
  is_enabled?: boolean | null;
  admin_note?: string | null;
};

export const delegatedPermissionKeys = new Set([
  "talent_pool_manage",
  "settle_scores",
  "account_role_manage",
  "review_dungeons",
]);
export const inviteDeviceKinds = new Set(["desktop", "mobile"]);
export const inviteDeviceSessionEnforcement = false;

// Keep malformed or oversized browser requests from consuming function memory.
// The frontend only sends compact JSON action payloads, so 48 KB leaves ample room
// for legitimate submissions while rejecting accidental/bulk request floods.
export const MAX_REQUEST_BODY_BYTES = 48 * 1024;

// The production site is served from GitHub Pages. Reject browser calls from
// unrelated origins before they reach the database. Requests without an Origin
// header are kept for direct diagnostics and local file-based testing.
export const allowedBrowserOrigins = new Set([
  // GitHub Pages uses the lower-cased repository owner: LoeLv -> loelv.
  "https://loelv.github.io",
  // Retain the historical spelling during the migration of older shared links.
  "https://loevl.github.io",
  "http://localhost:3000",
  "http://localhost:5173",
]);

// This is deliberately a soft, per-isolate burst guard. It cannot replace an
// authenticated gateway, but it catches accidental refresh loops without adding
// a database write to every normal public read.
export const PUBLIC_READ_WINDOW_MS = 60_000;
export const PUBLIC_READ_MAX_PER_WINDOW = 240;
export const publicReadBuckets = new Map<string, { startedAt: number; count: number }>();
export const publicReadActions = new Set([
  "listDungeons",
  "listDungeonArchivePage",
  "getDungeonDetail",
  "listProfiles",
  "listFaithTraits",
  "listDungeonComments",
  "getDungeonCommentCount",
]);

export function isPublicReadRateLimited(req: Request, action: string) {
  if (!publicReadActions.has(action)) return false;

  const forwardedFor = cleanText(req.headers.get("x-forwarded-for"), 160).split(",")[0].trim();
  const clientKey = forwardedFor || cleanText(req.headers.get("cf-connecting-ip"), 80) || "unknown";
  const now = Date.now();
  const key = `${action}:${clientKey}`;
  const previous = publicReadBuckets.get(key);

  if (!previous || now - previous.startedAt >= PUBLIC_READ_WINDOW_MS) {
    publicReadBuckets.set(key, { startedAt: now, count: 1 });
  } else {
    previous.count += 1;
    if (previous.count > PUBLIC_READ_MAX_PER_WINDOW) return true;
  }

  // Keep a long-lived warm isolate from retaining stale client keys forever.
  if (publicReadBuckets.size > 2000) {
    for (const [bucketKey, bucket] of publicReadBuckets) {
      if (now - bucket.startedAt >= PUBLIC_READ_WINDOW_MS) publicReadBuckets.delete(bucketKey);
    }
  }
  return false;
}

export const roleLabels: Record<InviteRole, string> = {
  player: "入局信徒",
  author: "试炼构筑者",
  reviewer: "结算审核员",
  admin: "神谕馆主",
  god: "祈愿神明",
  astral: "星途",
};
export const specialAccountRoles = new Set<InviteRole>(["god", "astral"]);
export const HASH_FILTER_BATCH_SIZE = 40;
export const dungeonReviewerNames = new Set(["羔羊", "槐柏"]);

export const godNames = new Set([
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

export const defaultAscensionScore = 1000;
export const defaultAudienceScore = 0;
export const drawScoreStep = 10;
export const advancedTalentDrawScore = 1500;
export const starterTalentDrawGrant = 15;
export const bTalentDrawRate = 0.2;
export const advancedBTalentDrawRate = 0.25;
export const aTalentDrawRate = 0.02;
export const sTalentDrawRate = 0.001;
export const bTalentGuaranteeDraws = 10;
export const sTalentGuaranteeDraws = 60;
export const cTalentFragmentGain = 5;
export const bTalentFragmentGain = 10;
export const targetTalentExchangeCost = 80;
export const aTalentExchangeCost = 260;
export const inventorySlotLimit = 10;
export const sTalentWarehouseSlotLimit = 5;
export const equippedSlotLimit = 5;
export const talentSlotScoreRules = [
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
export const talentSlot5ScoreRules = [
  { minScore: 2200, ranks: ["S", "A", "A", "A", "C"], summary: "SAAAC", kind: "profession" },
  { minScore: 2300, ranks: ["S", "A", "A", "A", "B"], summary: "SAAAB", kind: "profession" },
  { minScore: 2400, ranks: ["S", "A", "A", "A", "A"], summary: "SAAAA", kind: "profession" },
  { minScore: 2500, ranks: ["S", "A", "A", "A", "A"], summary: "SAAAA", kind: "profession" },
  { minScore: 2600, ranks: ["S", "A", "A", "A", "A"], summary: "SAAAA", kind: "profession" },
] as const;
export const talentRankOrder: Record<string, number> = { C: 1, B: 2, A: 3, S: 4 };
export const scoreDengMin = -30;
export const scoreDengMax = 30;
export const scoreJinMin = -3;
export const scoreJinMax = 3;
export const knownTalentPools = [
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

export const professionGroups = [
  { path: "文明", god: "秩序", careers: { "战士": "秩序骑士", "法师": "元素法官", "牧师": "公正官", "刺客": "行刑官", "猎人": "搜查官", "歌者": "律者" } },
  { path: "文明", god: "真理", careers: { "战士": "格斗专家", "法师": "博识学者", "牧师": "外科医生", "刺客": "暗杀博士", "猎人": "陷阱大师", "歌者": "博闻诗人" } },
  { path: "文明", god: "战争", careers: { "战士": "陷阵勇士", "法师": "炼狱主教", "牧师": "督战官", "刺客": "隙光铁刺", "猎人": "鹰眼斥候", "歌者": "风暴之嗓" } },
  { path: "混沌", god: "混乱", careers: { "战士": "异血同袍", "法师": "灾祸之源", "牧师": "理智蚀者", "刺客": "折光扰影", "猎人": "渔夫", "歌者": "失律琴师" } },
  { path: "混沌", god: "痴愚", careers: { "战士": "坚壁战士", "法师": "幕后戏师", "牧师": "祛愚专家", "刺客": "解构之眼", "猎人": "猎愚人", "歌者": "独奏家" } },
  { path: "混沌", god: "沉默", careers: { "战士": "苦行僧", "法师": "默剧大师", "牧师": "守夜人", "刺客": "傀儡师", "猎人": "变色龙", "歌者": "囚徒" } },
  { path: "生命", god: "诞育", careers: { "战士": "酋长", "法师": "生命贤者", "牧师": "子嗣牧师", "刺客": "借诞之婴", "猎人": "创生猎人", "歌者": "唱夜之喉" } },
  { path: "生命", god: "繁荣", careers: { "战士": "德鲁伊", "法师": "木精灵", "牧师": "园丁", "刺客": "荆棘之冠", "猎人": "美食家", "歌者": "万籁谐音" } },
  { path: "生命", god: "死亡", careers: { "战士": "剔骨工", "法师": "死灵法师", "牧师": "守墓人", "刺客": "死亡编织者", "猎人": "猩红猎手", "歌者": "撞钟人" } },
  { path: "沉沦", god: "污堕", careers: { "战士": "尖啸伯爵", "法师": "欲望主宰", "牧师": "悲悯领主", "刺客": "恶孽", "猎人": "感官追猎者", "歌者": "塞王" } },
  { path: "沉沦", god: "腐朽", careers: { "战士": "木乃伊", "法师": "瘟疫枢机", "牧师": "凋零祭司", "刺客": "疮痍之目", "猎人": "黄昏猎人", "歌者": "腐烂颂唱者" } },
  { path: "沉沦", god: "湮灭", careers: { "战士": "清道夫", "法师": "烬灭者", "牧师": "焚化工", "刺客": "寂灭使徒", "猎人": "终焉行者", "歌者": "毁灭宣告" } },
  { path: "存在", god: "时间", careers: { "战士": "指针骑士", "法师": "时间行者", "牧师": "遗忘医生", "刺客": "另日刺客", "猎人": "驯风游侠", "歌者": "吟游诗人" } },
  { path: "存在", god: "记忆", careers: { "战士": "镜中人", "法师": "回忆旅者", "牧师": "见证者", "刺客": "旧日追猎者", "猎人": "窥梦游侠", "歌者": "史学家" } },
  { path: "虚无", god: "命运", careers: { "战士": "今日勇者", "法师": "编剧", "牧师": "织命师", "刺客": "窃命之贼", "猎人": "终末之笔", "歌者": "预言家" } },
  { path: "虚无", god: "欺诈", careers: { "战士": "杂技演员", "法师": "诡术大师", "牧师": "小丑", "刺客": "受害者", "猎人": "驯兽师", "歌者": "魔术师" } },
];

export const professionAliases = new Map<string, string>([
  ["博士学者", "博识学者"],
  ["折光诡影", "折光扰影"],
  ["坚壁骑士", "坚壁战士"],
  ["偃偶师", "傀儡师"],
  ["子嗣牧", "子嗣牧师"],
  ["生灵吟者", "唱夜之喉"],
  ["不朽乐章", "万籁谐音"],
  ["疮瘢之目", "疮痍之目"],
  ["环卫工", "清道夫"],
  ["炬灭者", "烬灭者"],
  ["毁灭宣誓", "毁灭宣告"],
  ["痴梦游侠", "窥梦游侠"],
  ["驭兽师", "驯兽师"],
]);

export const professionClassByName = new Map(
  professionGroups.flatMap((group) =>
    Object.entries(group.careers).map(([className, professionName]) => [professionName, className]),
  ),
);
export const professionGodByName = new Map(
  professionGroups.flatMap((group) =>
    Object.values(group.careers).map((professionName) => [professionName, group.god]),
  ),
);
for (const [alias, professionName] of professionAliases.entries()) {
  const className = professionClassByName.get(professionName);
  const godName = professionGodByName.get(professionName);
  if (className) professionClassByName.set(alias, className);
  if (godName) professionGodByName.set(alias, godName);
}
export const godPathByName = new Map(professionGroups.map((group) => [group.god, group.path]));
export const battleHealthTable = [
  { score: 1000, "战士": 120, "牧师": 105, "歌者": 100, "法师": 80, "刺客": 80, "猎人": 80 },
  { score: 1100, "战士": 126, "牧师": 110, "歌者": 105, "法师": 84, "刺客": 84, "猎人": 84 },
  { score: 1200, "战士": 132, "牧师": 115, "歌者": 110, "法师": 88, "刺客": 88, "猎人": 88 },
  { score: 1300, "战士": 138, "牧师": 120, "歌者": 115, "法师": 92, "刺客": 92, "猎人": 92 },
  { score: 1400, "战士": 150, "牧师": 130, "歌者": 125, "法师": 100, "刺客": 100, "猎人": 100 },
  { score: 1500, "战士": 162, "牧师": 140, "歌者": 135, "法师": 108, "刺客": 108, "猎人": 108 },
  { score: 1600, "战士": 174, "牧师": 150, "歌者": 145, "法师": 116, "刺客": 116, "猎人": 116 },
  { score: 1700, "战士": 186, "牧师": 160, "歌者": 155, "法师": 124, "刺客": 124, "猎人": 124 },
  { score: 1800, "战士": 198, "牧师": 180, "歌者": 175, "法师": 132, "刺客": 132, "猎人": 132 },
  { score: 1900, "战士": 222, "牧师": 200, "歌者": 195, "法师": 148, "刺客": 148, "猎人": 148 },
  { score: 2000, "战士": 246, "牧师": 220, "歌者": 215, "法师": 164, "刺客": 164, "猎人": 164 },
  { score: 2100, "战士": 270, "牧师": 240, "歌者": 235, "法师": 180, "刺客": 180, "猎人": 180 },
  { score: 2200, "战士": 294, "牧师": 260, "歌者": 255, "法师": 196, "刺客": 196, "猎人": 196 },
  { score: 2300, "战士": 318, "牧师": 280, "歌者": 275, "法师": 212, "刺客": 212, "猎人": 212 },
  { score: 2400, "战士": 366, "牧师": 320, "歌者": 315, "法师": 252, "刺客": 252, "猎人": 252 },
  { score: 2500, "战士": 438, "牧师": 380, "歌者": 375, "法师": 308, "刺客": 308, "猎人": 308 },
  { score: 2600, "战士": 534, "牧师": 460, "歌者": 455, "法师": 388, "刺客": 388, "猎人": 388 },
  { score: 2700, "战士": 630, "牧师": 540, "歌者": 535, "法师": 468, "刺客": 468, "猎人": 468 },
  { score: 2800, "战士": 726, "牧师": 620, "歌者": 615, "法师": 548, "刺客": 548, "猎人": 548 },
];
export const battleHealthByScore = new Map(battleHealthTable.map((row) => [row.score, row]));
export const battleClassHealthMin = battleHealthTable[0].score;
export const battleClassHealthMax = battleHealthTable[battleHealthTable.length - 1].score;
export const prosperityBattleHealthBonus: Record<string, number> = {
  "战士": 24,
  "牧师": 20,
  "歌者": 18,
  "刺客": 16,
  "猎人": 16,
  "法师": 16,
};
export const battleAttackByClass: Record<string, number> = {
  "战士": 4,
  "牧师": 2,
  "歌者": 2,
  "法师": 3,
  "刺客": 5,
  "猎人": 4,
};
export const battleClassSkillByClass: Record<string, { name: string; effect: string; cooldownRounds: number }> = {
  "战士": { name: "坚守", effect: "本回合由 DM 判断防护效果", cooldownRounds: 3 },
  "牧师": { name: "单体治疗术", effect: "治疗 25 点生命", cooldownRounds: 3 },
  "歌者": { name: "鼓舞咏唱", effect: "由 DM 判断增益效果", cooldownRounds: 3 },
  "法师": { name: "奥术轰击", effect: "由 DM 判断伤害效果", cooldownRounds: 3 },
  "刺客": { name: "致命突袭", effect: "由 DM 判断伤害效果", cooldownRounds: 3 },
  "猎人": { name: "精准射击", effect: "由 DM 判断伤害效果", cooldownRounds: 3 },
};

export const feedbackTagAllowlist = new Set([
  "机制清楚",
  "剧情好",
  "氛围强",
  "有挑战",
  "偏难",
  "想再跑",
  "需要修订",
]);

export function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

export function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export function cleanPermissionList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanText(item, 40)).filter((item) => delegatedPermissionKeys.has(item)))];
}

export function cleanDeviceKind(value: unknown) {
  const kind = cleanText(value, 20);
  return inviteDeviceKinds.has(kind) ? kind : "desktop";
}

export function cleanSessionId(value: unknown) {
  const text = cleanText(value, 80);
  return /^[0-9a-f-]{20,80}$/i.test(text) ? text : "";
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export async function readRequestBody(req: Request): Promise<{ body?: RequestBody; error?: string }> {
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
    return { error: "请求内容过大" };
  }
  if (!req.body) return { error: "请求内容不能为空" };

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_REQUEST_BODY_BYTES) {
        await reader.cancel();
        return { error: "请求内容过大" };
      }
      chunks.push(value);
    }
  } catch {
    return { error: "请求读取失败" };
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!isRecord(parsed)) return { error: "请求格式不正确" };
    return { body: parsed as RequestBody };
  } catch {
    return { error: "请求格式不正确" };
  }
}

export function cleanRequestKey(value: unknown, maxLength = 96) {
  const text = cleanText(value, maxLength);
  return /^[A-Za-z0-9._:-]{8,96}$/.test(text) ? text : "";
}

export function cleanDisplayName(value: unknown, role: InviteRole) {
  const name = cleanText(value, 16).replace(/\s+/g, " ");
  if (!name || name.length < 1) return { error: "昵称不能为空" };
  if (/[<>@#]/.test(name)) return { error: "昵称不能包含特殊符号" };
  const reserved = ["馆主", "官方", "管理员", "系统"];
  if (role !== "admin" && reserved.some((word) => name.includes(word))) {
    return { error: "这个昵称像管理身份，换一个吧" };
  }
  return { name };
}

export function cleanScore(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(999999, Math.round(number * 10) / 10));
}

export function cleanPoolKey(value: unknown) {
  return cleanText(value, 40).replace(/[<>"']/g, "");
}

export function cleanTalentId(value: unknown) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1 || id > 999999) return 0;
  return id;
}

export function cleanCoCreators(value: unknown) {
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

export function cleanBigIntId(value: unknown) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1 || id > Number.MAX_SAFE_INTEGER) return 0;
  return id;
}

export function cleanSlot(value: unknown, maxSlot: number) {
  const slot = Number(value);
  if (!Number.isInteger(slot) || slot < 1 || slot > maxSlot) return 0;
  return slot;
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hashBuffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function getPublicProfileKey(inviteCodeHash: unknown) {
  const codeHash = cleanText(inviteCodeHash, 64);
  if (!codeHash) return "";
  return await sha256Hex(`public-profile:${codeHash}`);
}

export function toPublicTitle(title: Record<string, unknown> | null | undefined) {
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

export function normalizeCurseType(value: unknown) {
  return cleanText(value, 20) === "ordinary" ? "ordinary" : "betrayal";
}

export function toPublicCurse(curse: Record<string, unknown> | null | undefined) {
  if (!curse) return null;
  return {
    id: cleanText(curse.id, 80),
    curse_text: cleanText(curse.curse_text, 32),
    curse_god: cleanText(curse.curse_god, 20),
    curse_note: cleanText(curse.curse_note, 120),
    curse_type: normalizeCurseType(curse.curse_type),
    granted_by_type: cleanText(curse.granted_by_type, 20) || "admin",
    granted_by_name: cleanText(curse.granted_by_name, 40),
    granted_at: cleanText(curse.granted_at, 80),
  };
}

export async function getActiveTitlesByHashes(
  supabase: SupabaseClientAny,
  inviteCodeHashes: string[],
) {
  const hashes = [...new Set(inviteCodeHashes.map((hash) => cleanText(hash, 64)).filter(Boolean))];
  const titles = new Map<string, Record<string, unknown>[]>();
  if (!hashes.length) return { titles };
  for (let index = 0; index < hashes.length; index += HASH_FILTER_BATCH_SIZE) {
    const batch = hashes.slice(index, index + HASH_FILTER_BATCH_SIZE);
    const { data, error } = await supabase
      .from("profile_titles")
      .select("id, invite_code_hash, title_text, title_god, title_note, granted_by_type, granted_by_name, granted_at")
      .in("invite_code_hash", batch)
      .eq("is_active", true)
      .order("granted_at", { ascending: false });
    if (isMissingTitleTable(error)) return { titles };
    if (error) return { titles, error };
    for (const title of data || []) {
      const hash = cleanText((title as Record<string, unknown>).invite_code_hash, 64);
      const publicTitle = toPublicTitle(title as Record<string, unknown>) as Record<string, unknown> | null;
      if (hash && publicTitle) titles.set(hash, [...(titles.get(hash) || []), publicTitle]);
    }
  }
  return { titles };
}

export async function getActiveTitleForHash(
  supabase: SupabaseClientAny,
  inviteCodeHash: string,
) {
  const result = await getActiveTitlesByHashes(supabase, [inviteCodeHash]);
  if (result.error) return { error: result.error };
  const titles = result.titles.get(inviteCodeHash) || [];
  return { title: titles[0] || null, titles };
}

export async function getActiveCursesByHashes(
  supabase: SupabaseClientAny,
  inviteCodeHashes: string[],
) {
  const hashes = [...new Set(inviteCodeHashes.map((hash) => cleanText(hash, 64)).filter(Boolean))];
  const curses = new Map<string, Record<string, unknown>[]>();
  if (!hashes.length) return { curses };
  for (let index = 0; index < hashes.length; index += HASH_FILTER_BATCH_SIZE) {
    const batch = hashes.slice(index, index + HASH_FILTER_BATCH_SIZE);
    const { data, error } = await supabase
      .from("profile_curses")
      .select("id, invite_code_hash, curse_text, curse_god, curse_note, curse_type, granted_by_type, granted_by_name, granted_at")
      .in("invite_code_hash", batch)
      .eq("is_active", true)
      .order("granted_at", { ascending: false });
    if (isMissingTitleTable(error)) return { curses };
    if (error) return { curses, error };
    for (const curse of data || []) {
      const hash = cleanText((curse as Record<string, unknown>).invite_code_hash, 64);
      const publicCurse = toPublicCurse(curse as Record<string, unknown>) as Record<string, unknown> | null;
      if (hash && publicCurse) curses.set(hash, [...(curses.get(hash) || []), publicCurse]);
    }
  }
  return { curses };
}

export async function getActiveCurseForHash(
  supabase: SupabaseClientAny,
  inviteCodeHash: string,
) {
  const result = await getActiveCursesByHashes(supabase, [inviteCodeHash]);
  if (result.error) return { error: result.error };
  const curses = result.curses.get(inviteCodeHash) || [];
  return { curse: curses[0] || null, curses };
}

export async function getCommentHonorBuckets(
  supabase: SupabaseClientAny,
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
  const { data: profileRows, error: profileError } = uniqueHashes.length
    ? await supabase.from("player_profiles").select("invite_code_hash, show_titles").in("invite_code_hash", uniqueHashes)
    : { data: [], error: null };
  if (profileError) return { byCommentId, error: profileError };
  const titleVisibilityByHash = new Map<string, boolean>();
  for (const profile of profileRows || []) {
    const hash = cleanText((profile as Record<string, unknown>).invite_code_hash, 64);
    if (hash) titleVisibilityByHash.set(hash, (profile as Record<string, unknown>).show_titles !== false);
  }
  const titleResult = await getActiveTitlesByHashes(supabase, uniqueHashes);
  if (titleResult.error) return { byCommentId, error: titleResult.error };
  const curseResult = await getActiveCursesByHashes(supabase, uniqueHashes);
  if (curseResult.error) return { byCommentId, error: curseResult.error };

  for (const commentId of uniqueCommentIds) {
    const hash = commentHashById.get(commentId) || "";
    byCommentId[commentId] = {
      active_titles: titleVisibilityByHash.get(hash) === false ? [] : (titleResult.titles.get(hash) || []),
      active_curses: curseResult.curses.get(hash) || [],
    };
  }

  return { byCommentId };
}

export async function getProfileByDisplayName(
  supabase: SupabaseClientAny,
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

export const godBelieverProfileSelect = "invite_code_hash, display_name, role, faith_god, faith_path, original_faith_god, original_faith_path, trickery_display_faith_god, trickery_display_faith_path, trickery_display_profession, profession, ascension_score, audience_score, items, talents, show_titles, scores_locked_at, updated_at";

export async function listGodBelievers(
  supabase: SupabaseClientAny,
  godName: string,
) {
  const { data, error } = await supabase
    .from("player_profiles")
    .select(godBelieverProfileSelect)
    .eq("faith_god", godName)
    .neq("role", "god").neq("role", "astral")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) return { error };

  const profiles = (data || []) as Record<string, unknown>[];
  const hashes = profiles.map((profile) => cleanText(profile.invite_code_hash, 64)).filter(Boolean);
  const titleResult = await getActiveTitlesByHashes(supabase, hashes);
  if (titleResult.error) return { error: titleResult.error };
  const curseResult = await getActiveCursesByHashes(supabase, hashes);
  if (curseResult.error) return { error: curseResult.error };

  return {
    data: profiles.map((profile) => {
      const hash = cleanText(profile.invite_code_hash, 64);
      return {
        invite_code_hash: hash,
        display_name: cleanText(profile.display_name, 40),
        role: cleanText(profile.role, 20),
        faith_god: cleanText(profile.faith_god, 20),
        faith_path: cleanText(profile.faith_path, 20),
        profession: cleanText(profile.profession, 40),
        ascension_score: cleanScore(profile.ascension_score),
        audience_score: cleanScore(profile.audience_score),
        active_titles: hash ? (titleResult.titles.get(hash) || []) : [],
        active_curses: hash ? (curseResult.curses.get(hash) || []) : [],
        show_titles: profile.show_titles !== false,
        updated_at: cleanText(profile.updated_at, 80),
      };
    }),
  };
}

export function toPublicDungeonSummary(dungeon: Record<string, unknown> | null | undefined) {
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
    estimated_duration: cleanText(dungeon.estimated_duration, 40),
    estimatedDuration: getDungeonEstimatedDuration(dungeon),
    avg_rating: Number(dungeon.avg_rating || 0),
    rating_count: Number(dungeon.rating_count || 0),
    comment_count: Number(dungeon.comment_count || 0),
    created_at: cleanText(dungeon.created_at, 80),
    is_one_shot: dungeon.is_one_shot === true,
  };
}

export const dungeonArchiveSelectFields = "id, name, creator, co_creators, difficulty, type, description, pinned_note, participant_count, run_count, clear_count, clear_rate, invite_code_hash, invite_name, avg_rating, rating_count, comment_count, created_at, is_one_shot, review_status, reviewed_at, reviewed_by_name, review_note";
export const dungeonArchivePageSelectFields = "id, name, creator, co_creators, difficulty, type, participant_count, run_count, clear_count, clear_rate, avg_rating, rating_count, comment_count, created_at, is_one_shot, review_status";
export const dungeonArchiveAggregateLimit = 500;

export function toDungeonArchiveCard(dungeon: Record<string, unknown>, identity: InviteIdentity | null = null) {
  const reviewStatus = getDungeonReviewStatus(dungeon);
  const creatorOwned = !!identity && canManageDungeonRecord(dungeon, identity);
  return {
    ...toPublicDungeonSummary(dungeon),
    // The index only needs enough text to identify a dungeon. Details stay on demand.
    description: cleanText(dungeon.description, 280),
    pinned_note: cleanText(dungeon.pinned_note, 180),
    review_status: reviewStatus,
    reviewed_at: cleanText(dungeon.reviewed_at, 80),
    reviewed_by_name: cleanText(dungeon.reviewed_by_name, 40),
    review_note: cleanText(dungeon.review_note, 240),
    can_manage: !!identity && (canReviewDungeons(identity) || creatorOwned),
    is_pending_review: reviewStatus === "pending",
    is_rejected: reviewStatus === "rejected",
  };
}

export function getDungeonGodNames(type: unknown) {
  const source = cleanText(type, 160);
  const matches = [...godNames].filter((god) => source.includes(god));
  return matches.length ? matches : ["未归档"];
}

export function buildDungeonArchiveSidebar(dungeons: Record<string, unknown>[]) {
  const pathCounts: Record<string, number> = {};
  const godCounts: Record<string, number> = {};
  for (const dungeon of dungeons) {
    for (const god of getDungeonGodNames(dungeon.type)) {
      godCounts[god] = (godCounts[god] || 0) + 1;
      const path = godPathByName.get(god) || "旧档案";
      pathCounts[path] = (pathCounts[path] || 0) + 1;
    }
  }
  const ranked = [...dungeons].sort((a, b) =>
    Number(b.avg_rating || 0) - Number(a.avg_rating || 0) ||
    Number(b.rating_count || 0) - Number(a.rating_count || 0) ||
    Number(b.comment_count || 0) - Number(a.comment_count || 0) ||
    String(b.created_at || "").localeCompare(String(a.created_at || "")),
  );
  const architectNames = new Set<string>();
  const architects = [...dungeons]
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
    .filter((dungeon) => {
      const creator = cleanText(dungeon.creator, 40) || "匿名";
      if (architectNames.has(creator)) return false;
      architectNames.add(creator);
      return true;
    })
    .slice(0, 6);
  return {
    path_counts: pathCounts,
    god_counts: godCounts,
    top_trials: ranked.slice(0, 6).map((dungeon) => toDungeonArchiveCard(dungeon)),
    architects: architects.map((dungeon) => toDungeonArchiveCard(dungeon)),
    aggregate_truncated: dungeons.length >= dungeonArchiveAggregateLimit,
  };
}

export function toPublicProfile(profile: Record<string, unknown>, profileKey: string, isCurrent: boolean) {
  return {
    profile_key: profileKey,
    display_name: cleanText(profile.display_name, 40),
    role: cleanText(profile.role, 20),
    faith_god: cleanText(profile.faith_god, 20),
    faith_path: cleanText(profile.faith_path, 20),
    original_faith_god: cleanText(profile.original_faith_god, 20),
    original_faith_path: cleanText(profile.original_faith_path, 20),
    trickery_display_faith_god: cleanText(profile.trickery_display_faith_god, 20),
    trickery_display_faith_path: cleanText(profile.trickery_display_faith_path, 20),
    trickery_display_profession: cleanText(profile.trickery_display_profession, 40),
    profession: cleanText(profile.profession, 40),
    ascension_score: cleanScore(profile.ascension_score),
    audience_score: cleanScore(profile.audience_score),
    items: cleanText(profile.items, 800),
    talents: cleanText(profile.talents, 800),
    show_titles: profile.show_titles !== false,
    active_title: profile.active_title || null,
    active_titles: Array.isArray(profile.active_titles) ? profile.active_titles : [],
    active_curse: profile.active_curse || null,
    active_curses: Array.isArray(profile.active_curses) ? profile.active_curses : [],
    scores_locked_at: cleanText(profile.scores_locked_at, 80),
    updated_at: cleanText(profile.updated_at, 80),
    is_current: isCurrent,
  };
}

export async function getInviteIdentity(
  supabase: SupabaseClientAny,
  inviteCode: unknown,
): Promise<InviteIdentity | null> {
  const code = cleanText(inviteCode, 200);
  if (!code) return null;
  const codeHash = await sha256Hex(code);

  const { data, error } = await supabase
    .from("invite_codes")
    .select("id, role, display_name, is_active, permissions, session_generation")
    .eq("code_hash", codeHash)
    .maybeSingle();
  if (error) return null;

  const roleFromTable = data?.role as InviteRole | undefined;
  if (data?.is_active && roleFromTable && ["player", "author", "reviewer", "admin", "god", "astral"].includes(roleFromTable)) {
    let profileDisplayName = "";
    const profileResult = await supabase
      .from("player_profiles")
      .select("display_name")
      .eq("invite_code_hash", codeHash)
      .maybeSingle();
    if (!profileResult.error) {
      profileDisplayName = cleanText(profileResult.data?.display_name, 40);
    }
    const inviteDisplayName = cleanText(data.display_name, 40);
    const displayName = profileDisplayName || inviteDisplayName || roleLabels[roleFromTable];
    if (roleFromTable === "god" && !godNames.has(displayName)) return null;
    const inviteUpdate: Record<string, unknown> = { last_used_at: new Date().toISOString() };
    if (profileDisplayName && profileDisplayName !== inviteDisplayName) inviteUpdate.display_name = profileDisplayName;
    await supabase
      .from("invite_codes")
      .update(inviteUpdate)
      .eq("id", data.id);
    return {
      role: roleFromTable,
      codeHash,
      displayName,
      inviteId: data.id,
      permissions: cleanPermissionList(data.permissions),
      sessionGeneration: Number(data.session_generation || 0),
    };
  }
  return null;
}

export async function issueInviteSession(
  supabase: SupabaseClientAny,
  identity: InviteIdentity,
  deviceKindInput: unknown,
  userAgentInput: unknown,
) {
  const deviceKind = cleanDeviceKind(deviceKindInput);
  const sessionId = crypto.randomUUID();
  const { error } = await supabase
    .from("invite_sessions")
    .upsert({
      invite_code_hash: identity.codeHash,
      device_kind: deviceKind,
      session_id: sessionId,
      session_generation: identity.sessionGeneration,
      user_agent: cleanText(userAgentInput, 240),
      created_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    }, { onConflict: "invite_code_hash,device_kind" });
  if (error) return { error };
  return { data: { sessionId, deviceKind } };
}

export async function validateInviteSession(
  supabase: SupabaseClientAny,
  identity: InviteIdentity,
  sessionIdInput: unknown,
  deviceKindInput: unknown,
) {
  const sessionId = cleanSessionId(sessionIdInput);
  const deviceKind = cleanDeviceKind(deviceKindInput);
  if (!sessionId) return { error: { message: "登录状态已更新，请重新输入邀请码", code: "session_invalid" } };
  const { data, error } = await supabase
    .from("invite_sessions")
    .select("session_id, session_generation")
    .eq("invite_code_hash", identity.codeHash)
    .eq("device_kind", deviceKind)
    .maybeSingle();
  if (error?.code === "42P01" || error?.code === "42703") return { error: { message: "请先运行 invite_device_sessions_20260809.sql", code: "session_invalid" } };
  if (error) return { error };
  if (!data || data.session_id !== sessionId || Number(data.session_generation || 0) !== identity.sessionGeneration) {
    return { error: { message: "此设备的登录已被新登录顶下，请重新输入邀请码", code: "session_invalid" } };
  }
  const { error: touchError } = await supabase
    .from("invite_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("invite_code_hash", identity.codeHash)
    .eq("device_kind", deviceKind)
    .eq("session_id", sessionId);
  if (touchError) console.error("invite session touch failed", touchError);
  return { data: { deviceKind } };
}

export function hasRole(role: InviteRole, allowed: InviteRole[]) {
  return allowed.includes(role);
}

export function hasNamedDuty(identity: InviteIdentity, names: Set<string>) {
  const displayName = cleanText(identity.displayName, 40);
  return !!displayName && names.has(displayName);
}

export function hasPermission(identity: InviteIdentity, permission: string) {
  if (identity.role === "admin") return true;
  if ((permission === "review_dungeons" || permission === "account_role_manage") && hasNamedDuty(identity, staffAdminNames)) return true;
  if (permission === "talent_pool_manage" && hasNamedDuty(identity, talentManagerNames)) return true;
  if (permission === "settle_scores" && hasNamedDuty(identity, scoreSettlerNames)) return true;
  return identity.permissions.includes(permission);
}

export function canGrantTitles(identity: InviteIdentity) {
  return hasRole(identity.role, ["admin", "god", "astral"]);
}

export function canReviewDungeons(identity: InviteIdentity) {
  if (hasRole(identity.role, ["admin", "god", "astral"])) return true;
  if (hasPermission(identity, "review_dungeons")) return true;
  return false;
}

export function getTitleGrantGod(identity: InviteIdentity, requestedGod: unknown) {
  if (specialAccountRoles.has(identity.role)) return identity.displayName;
  return cleanText(requestedGod, 20);
}

export function canManageDungeonRecord(dungeon: Record<string, unknown>, identity: InviteIdentity) {
  const displayName = cleanText(identity.displayName, 40);
  const creator = cleanText(dungeon.creator, 40);
  const inviteName = cleanText(dungeon.invite_name, 40);
  const inviteHash = cleanText(dungeon.invite_code_hash, 64);
  if (inviteHash && inviteHash === identity.codeHash) return true;
  if (displayName && (displayName === creator || displayName === inviteName)) return true;
  return cleanCoCreators(dungeon.co_creators).some((name) => cleanText(name, 40) === displayName);
}

export function getDungeonReviewStatus(dungeon: Record<string, unknown>) {
  return cleanText(dungeon.review_status, 20) || "approved";
}

export function canViewDungeonRecord(dungeon: Record<string, unknown>, identity: InviteIdentity | null) {
  if (getDungeonReviewStatus(dungeon) === "approved") return true;
  if (!identity) return false;
  return canReviewDungeons(identity) || canManageDungeonRecord(dungeon, identity);
}

export function isMissingInviteColumn(error: { code?: string; message?: string } | null) {
  return error?.code === "42703" && (
    error?.message?.includes("invite_code_hash") ||
    error?.message?.includes("invite_name")
  );
}

export function isMissingForumColumn(error: { code?: string; message?: string } | null) {
  return error?.code === "42703";
}

export function isMissingCoCreatorsColumn(error: LooseError) {
  return error?.code === "42703" && !!error.message?.includes("co_creators");
}

export function isMissingEstimatedDurationColumn(error: LooseError) {
  return error?.code === "42703" && !!error.message?.includes("estimated_duration");
}

export function isMissingBattleRoomExpiresColumn(error: LooseError) {
  return error?.code === "42703" && !!error.message?.includes("expires_at");
}

export function isMissingDungeonReviewColumn(error: LooseError) {
  return error?.code === "42703" && (
    !!error.message?.includes("review_status") ||
    !!error.message?.includes("reviewed_by_hash") ||
    !!error.message?.includes("reviewed_by_name") ||
    !!error.message?.includes("reviewed_at") ||
    !!error.message?.includes("review_note")
  );
}

export function cleanFeedbackTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  const tags = value
    .map((item) => cleanText(item, 20))
    .filter((tag) => feedbackTagAllowlist.has(tag));
  return [...new Set(tags)].slice(0, 5);
}

export function isMissingTalentTable(error: LooseError) {
  return error?.code === "42P01";
}

export function isMissingTitleTable(error: LooseError) {
  return error?.code === "42P01";
}

export function isMissingAdminOperationLogTable(error: LooseError) {
  return error?.code === "42P01" && !!error.message?.includes("admin_operation_logs");
}

export async function writeAdminOperationLog(
  supabase: SupabaseClientAny,
  identity: InviteIdentity,
  input: {
    action: string;
    targetCodeHash?: unknown;
    targetName?: unknown;
    objectType?: unknown;
    objectId?: unknown;
    summary?: unknown;
    beforeState?: Record<string, unknown>;
    afterState?: Record<string, unknown>;
  },
) {
  if (!hasRole(identity.role, ["admin", "god", "reviewer"]) && identity.permissions.length === 0) return { skipped: true };
  const { error } = await supabase.from("admin_operation_logs").insert({
    actor_code_hash: identity.codeHash,
    actor_name: identity.displayName,
    actor_role: identity.role,
    action: cleanText(input.action, 80),
    target_code_hash: cleanText(input.targetCodeHash, 64) || null,
    target_name: cleanText(input.targetName, 40),
    object_type: cleanText(input.objectType, 40),
    object_id: cleanText(input.objectId, 120),
    summary: cleanText(input.summary, 500),
    before_state: input.beforeState || {},
    after_state: input.afterState || {},
  });
  if (isMissingAdminOperationLogTable(error)) return { unavailable: true };
  if (error) console.error("admin operation log write failed", error);
  return { error: error || null };
}

export async function listAdminOperationLogs(
  supabase: SupabaseClientAny,
  targetCodeHash: string | null = null,
  limit = 50,
) {
  let query = supabase
    .from("admin_operation_logs")
    .select("id, actor_name, actor_role, action, target_name, object_type, object_id, summary, before_state, after_state, created_at")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(50, limit)));
  if (targetCodeHash) query = query.eq("target_code_hash", targetCodeHash);
  const { data, error } = await query;
  if (isMissingAdminOperationLogTable(error)) return { data: [], unavailable: true };
  if (error) return { data: [], error };
  return { data: data || [], unavailable: false };
}

export async function listHonorOperationLogs(
  supabase: SupabaseClientAny,
  identity: InviteIdentity,
  limit = 30,
) {
  const honorActions = [
    "title.grant",
    "title.revoke",
    "title.restore",
    "curse.grant",
    "curse.revoke",
    "curse.restore",
  ];
  let query = supabase
    .from("admin_operation_logs")
    .select("id, actor_name, actor_role, action, target_name, object_type, object_id, summary, before_state, after_state, created_at")
    .in("action", honorActions)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(50, limit)));
  if (specialAccountRoles.has(identity.role)) query = query.eq("actor_code_hash", identity.codeHash);
  const { data, error } = await query;
  if (isMissingAdminOperationLogTable(error)) return { data: [], unavailable: true };
  if (error) return { data: [], error };
  return { data: data || [], unavailable: false };
}

export function isMissingTalentEffectColumn(error: LooseError) {
  return error?.code === "42703" && !!error.message?.includes("effect");
}

export function isMissingMatchSystem(error: LooseError) {
  return error?.code === "42P01" || error?.code === "42883";
}

export function isMissingMatchMusterSystem(error: LooseError) {
  return (
    error?.code === "42P01" ||
    error?.code === "42883" ||
    (error?.code === "42703" && (
      error.message?.includes("is_one_shot") ||
      error.message?.includes("is_required") ||
      error.message?.includes("muster_id") ||
      error.message?.includes("match_muster_required_players") ||
      error.message?.includes("match_musters") ||
      error.message?.includes("match_muster_participants")
    ))
  );
}

export function isMissingBattleSystem(error: LooseError) {
  return error?.code === "42P01" || error?.code === "42703";
}

export function getEarnedDraws(ascensionScore: unknown) {
  return getBasicDrawsEarned(ascensionScore) + getAdvancedDrawsEarned(ascensionScore);
}

export function getBasicDrawsEarned(ascensionScore: unknown) {
  const score = Math.min(cleanScore(ascensionScore), advancedTalentDrawScore - drawScoreStep);
  return starterTalentDrawGrant + Math.max(0, Math.floor((score - defaultAscensionScore) / drawScoreStep));
}

export function getAdvancedDrawsEarned(ascensionScore: unknown) {
  const score = cleanScore(ascensionScore);
  return Math.max(0, Math.floor((score - (advancedTalentDrawScore - drawScoreStep)) / drawScoreStep));
}

export function getTalentSlotRule(ascensionScore: unknown) {
  const score = cleanScore(ascensionScore);
  const slotRules = [...talentSlotScoreRules, ...talentSlot5ScoreRules];
  return slotRules.reduce((active, rule) => (score >= rule.minScore ? rule : active), slotRules[0]);
}

export function getTalentSlotLimit(ascensionScore: unknown) {
  const score = cleanScore(ascensionScore);
  if (score < 1100) return 2;
  if (score < 1200) return 3;
  if (score < 2200) return 4;
  return 5;
}

export function getTalentRankAllowance(ascensionScore: unknown) {
  return getTalentSlotRule(ascensionScore).ranks || ["C", "C"];
}

export function canEquipTalentRanks(ranks: unknown[], allowance: readonly string[]) {
  const sortedRanks = ranks.map((rank) => String(rank || "").toUpperCase()).sort((a, b) => (talentRankOrder[b] || 0) - (talentRankOrder[a] || 0));
  const sortedAllowance = allowance.map((rank) => String(rank || "").toUpperCase()).sort((a, b) => (talentRankOrder[b] || 0) - (talentRankOrder[a] || 0));
  if (sortedRanks.length > sortedAllowance.length) return false;
  return sortedRanks.every((rank, index) => (talentRankOrder[rank] || 0) <= (talentRankOrder[sortedAllowance[index]] || 0));
}

export function getFaithTalentPoolKey(profile: Record<string, unknown>) {
  const faithGod = cleanText(profile.original_faith_god, 20) === "欺诈"
    ? "欺诈"
    : cleanText(profile.faith_god, 20);
  const poolKey = faithGod ? `Pool${faithGod}` : "";
  return knownTalentPools.includes(poolKey) ? poolKey : "";
}

export function getProfessionTalentPoolKey(profile: Record<string, unknown>) {
  const profession = cleanText(profile.profession, 40);
  if (cleanText(profile.original_faith_god, 20) === "欺诈" && getProfessionGod(profession) !== "欺诈") return "";
  const professionClass = professionClassByName.get(profession);
  const poolKey = professionClass ? `Pool${professionClass}` : "";
  return knownTalentPools.includes(poolKey) ? poolKey : "";
}

export function getFaithPathByGod(god: string) {
  return godPathByName.get(god) || "";
}

export function cleanGodName(value: unknown) {
  const godName = cleanText(value, 20);
  return godNames.has(godName) ? godName : "";
}

export function getProfessionGod(profession: unknown) {
  return professionGodByName.get(cleanText(profession, 40)) || "";
}

export function isProfileBindingMismatched(profile: Record<string, unknown> | null | undefined) {
  if (!profile) return false;
  const faithGod = cleanText(profile.faith_god, 20);
  const professionGod = getProfessionGod(profile.profession);
  return !!faithGod && !!professionGod && professionGod !== faithGod;
}

export function hasTrickeryFaithPrivilege(profile: Record<string, unknown> | null | undefined) {
  if (!profile) return false;
  if (cleanText(profile.original_faith_god, 20) === "欺诈") return true;
  if (cleanText(profile.faith_god, 20) === "欺诈") return true;
  return getProfessionGod(profile.profession) === "欺诈";
}

export function getTalentSlotKinds(ascensionScore: unknown) {
  const score = cleanScore(ascensionScore);
  if (score >= 2600) return ["faith", "profession", "any", "any", "profession"];
  if (score >= 2500) return ["faith", "profession", "any", "any", "any"];
  if (score >= 2200) return ["faith", "profession", "any", "any", "profession"];
  return ["faith", "profession", "any", "any"];
}

export function getTalentSlotKind(ascensionScore: unknown, slot: number) {
  return getTalentSlotKinds(ascensionScore)[slot - 1] || "any";
}

export function getTalentSlotRequirement(profile: Record<string, unknown>, slot: number) {
  const kind = getTalentSlotKind(profile.ascension_score, slot);
  if (kind === "faith") return { kind, poolKey: getFaithTalentPoolKey(profile), label: "???" };
  if (kind === "profession") return { kind, poolKey: getProfessionTalentPoolKey(profile), label: "???" };
  if (kind === "fusion") return { kind, poolKey: "", label: "??????" };
  return { kind, poolKey: "", label: "???" };
}
export function canEquipTalentPool(poolKey: unknown, requirement: { kind: string; poolKey: string }) {
  if (requirement.kind === "any") return true;
  return !!requirement.poolKey && String(poolKey || "") === requirement.poolKey;
}

export async function getExclusiveTalentState(
  supabase: SupabaseClientAny,
  profile: Record<string, unknown>,
  codeHash: string,
) {
  const [slotResult, talentResult] = await Promise.all([
    supabase.from("exclusive_talent_slots").select("manual_enabled, enabled_note, enabled_at").eq("invite_code_hash", codeHash).maybeSingle(),
    supabase.from("exclusive_talents").select("talent_name, rank, effect, cooldown, action_cost, admin_note, is_enabled, updated_at").eq("invite_code_hash", codeHash).maybeSingle(),
  ]);
  const missingError = [slotResult.error, talentResult.error].find((error) => error?.code === "42P01");
  if (missingError) return { error: { message: "请先运行 exclusive_talent_slot_migration_20260914.sql" } };
  if (slotResult.error) return { error: slotResult.error };
  if (talentResult.error) return { error: talentResult.error };
  const scoreUnlocked = cleanScore(profile.ascension_score) >= 2500;
  const manualEnabled = slotResult.data?.manual_enabled === true;
  const slotEnabled = scoreUnlocked || manualEnabled;
  const talent = talentResult.data && cleanText(talentResult.data.talent_name, 80)
    ? {
      talentName: cleanText(talentResult.data.talent_name, 80),
      rank: cleanText(talentResult.data.rank, 2) || "EX",
      effect: cleanText(talentResult.data.effect, 1000),
      cooldown: cleanText(talentResult.data.cooldown, 80),
      actionCost: Math.max(0, Math.min(99, Number(talentResult.data.action_cost || 0))),
      adminNote: cleanText(talentResult.data.admin_note, 300),
      isEnabled: talentResult.data.is_enabled !== false,
      updatedAt: cleanText(talentResult.data.updated_at, 80),
    }
    : null;
  return {
    data: {
      enabled: slotEnabled,
      scoreUnlocked,
      manualEnabled,
      enabledNote: cleanText(slotResult.data?.enabled_note, 300),
      enabledAt: cleanText(slotResult.data?.enabled_at, 80),
      talent,
    },
  };
}

export function getAllowedTalentPools(profile: Record<string, unknown>) {
  const poolSet = new Set<string>();
  const faithPoolKey = getFaithTalentPoolKey(profile);
  const professionPoolKey = getProfessionTalentPoolKey(profile);
  if (faithPoolKey) poolSet.add(faithPoolKey);
  if (professionPoolKey) poolSet.add(professionPoolKey);
  return [...poolSet].filter((poolKey) => knownTalentPools.includes(poolKey));
}

export type TalentPoolRebalanceResult = {
  removedPoolKeys: string[];
  refundedDraws: number;
  refundedFragments: number;
  removedFragments?: number;
  fragmentDelta?: number;
  error?: LooseError;
};

export type TalentDrawRollbackRow = {
  draw_type?: string | null;
  fragment_gain?: number | null;
};

export type TalentExchangeRollbackRow = {
  cost_fragment?: number | null;
};

export function talentPoolRebalanceError(error: LooseError): TalentPoolRebalanceResult {
  return { removedPoolKeys: [], refundedDraws: 0, refundedFragments: 0, error };
}

export async function rebalanceTalentPoolsAfterProfileChange(
  supabase: SupabaseClientAny,
  codeHash: string,
  previousProfile: Record<string, unknown> | null | undefined,
  nextProfile: Record<string, unknown> | null | undefined,
): Promise<TalentPoolRebalanceResult> {
  const previousPools = new Set(getAllowedTalentPools(previousProfile || {}));
  const nextPools = new Set(getAllowedTalentPools(nextProfile || {}));
  const removedPoolKeys = [...previousPools].filter((poolKey) => !nextPools.has(poolKey));
  if (!removedPoolKeys.length) {
    return { removedPoolKeys: [], refundedDraws: 0, refundedFragments: 0 };
  }

  const [drawLogResult, exchangeResult, drawStateResult, fragmentResult] = await Promise.all([
    supabase
      .from("talent_draw_logs")
      .select("id, pool_key, draw_type, fragment_gain")
      .eq("invite_code_hash", codeHash)
      .in("pool_key", removedPoolKeys),
    supabase
      .from("talent_exchange_logs")
      .select("id, pool_key, cost_fragment")
      .eq("invite_code_hash", codeHash)
      .in("pool_key", removedPoolKeys),
    supabase
      .from("talent_draw_state")
      .select("spent_draws, basic_spent_draws, advanced_spent_draws, event_basic_spent_draws, event_advanced_spent_draws")
      .eq("invite_code_hash", codeHash)
      .maybeSingle(),
    supabase
      .from("user_fragments")
      .select("fragment_total")
      .eq("invite_code_hash", codeHash)
      .maybeSingle(),
  ]);

  if (drawLogResult.error) return talentPoolRebalanceError(drawLogResult.error);
  if (exchangeResult.error) return talentPoolRebalanceError(exchangeResult.error);
  if (drawStateResult.error) return talentPoolRebalanceError(drawStateResult.error);
  if (fragmentResult.error) return talentPoolRebalanceError(fragmentResult.error);

  const removedDrawLogs = (drawLogResult.data || []) as TalentDrawRollbackRow[];
  const removedExchangeLogs = (exchangeResult.data || []) as TalentExchangeRollbackRow[];
  const refundedDraws = removedDrawLogs.length;
  const refundedBasicDraws = removedDrawLogs.filter((row: TalentDrawRollbackRow) => String(row.draw_type || "") === "basic").length;
  const refundedAdvancedDraws = removedDrawLogs.filter((row: TalentDrawRollbackRow) => String(row.draw_type || "") === "advanced").length;
  const removedFragments = removedDrawLogs.reduce((sum: number, row: TalentDrawRollbackRow) => sum + Number(row.fragment_gain || 0), 0);
  const exchangeFragmentRefund = removedExchangeLogs.reduce((sum: number, row: TalentExchangeRollbackRow) => sum + Number(row.cost_fragment || 0), 0);
  const currentFragmentTotal = Number(fragmentResult.data?.fragment_total || 0);
  const nextFragmentTotal = Math.max(0, currentFragmentTotal - removedFragments + exchangeFragmentRefund);
  const currentSpentDraws = Number(drawStateResult.data?.spent_draws || 0);
  const currentBasicSpentDraws = Number(drawStateResult.data?.basic_spent_draws || 0);
  const currentAdvancedSpentDraws = Number(drawStateResult.data?.advanced_spent_draws || 0);
  const currentEventBasicSpentDraws = Number(drawStateResult.data?.event_basic_spent_draws || 0);
  const currentEventAdvancedSpentDraws = Number(drawStateResult.data?.event_advanced_spent_draws || 0);
  const nextDrawState = {
    invite_code_hash: codeHash,
    spent_draws: Math.max(0, currentSpentDraws - refundedDraws),
    basic_spent_draws: Math.max(0, currentBasicSpentDraws - refundedBasicDraws),
    advanced_spent_draws: Math.max(0, currentAdvancedSpentDraws - refundedAdvancedDraws),
    event_basic_spent_draws: Math.max(0, currentEventBasicSpentDraws - refundedBasicDraws),
    event_advanced_spent_draws: Math.max(0, currentEventAdvancedSpentDraws - refundedAdvancedDraws),
    updated_at: new Date().toISOString(),
  };

  const deleteOps = [
    supabase.from("owned_talents").delete().eq("invite_code_hash", codeHash).in("pool_key", removedPoolKeys),
    supabase.from("talent_overflow_choices").delete().eq("invite_code_hash", codeHash).in("pool_key", removedPoolKeys),
    supabase.from("talent_draw_logs").delete().eq("invite_code_hash", codeHash).in("pool_key", removedPoolKeys),
    supabase.from("talent_exchange_logs").delete().eq("invite_code_hash", codeHash).in("pool_key", removedPoolKeys),
    supabase.from("talent_pool_counters").delete().eq("invite_code_hash", codeHash).in("pool_key", removedPoolKeys),
  ] as const;

  for (const op of deleteOps) {
    const { error } = await op;
    if (error) return talentPoolRebalanceError(error);
  }

  if (fragmentResult.data || nextFragmentTotal > 0 || removedFragments > 0 || removedExchangeLogs.length > 0) {
    const { error: fragmentUpdateError } = await supabase
      .from("user_fragments")
      .upsert({
        invite_code_hash: codeHash,
        fragment_total: nextFragmentTotal,
        updated_at: new Date().toISOString(),
      });
    if (fragmentUpdateError) return talentPoolRebalanceError(fragmentUpdateError);
  }

  const { error: drawStateUpdateError } = await supabase
    .from("talent_draw_state")
    .upsert(nextDrawState);
  if (drawStateUpdateError) return talentPoolRebalanceError(drawStateUpdateError);

  return {
    removedPoolKeys,
    refundedDraws,
    refundedFragments: exchangeFragmentRefund,
    removedFragments,
    fragmentDelta: nextFragmentTotal - currentFragmentTotal,
  };
}

export type IdentityResetResult = {
  removedPoolKeys: string[];
  error?: LooseError;
  refundedDraws?: number;
  refundedBasicDraws?: number;
  refundedAdvancedDraws?: number;
  refundedEventBasicDraws?: number;
  refundedEventAdvancedDraws?: number;
  clearedFragments?: number;
  removedAllTalents?: boolean;
};

export function identityResetError(error: LooseError): IdentityResetResult {
  return { removedPoolKeys: [], error };
}

export async function resetTalentStateAfterIdentityChange(
  supabase: SupabaseClientAny,
  codeHash: string,
): Promise<IdentityResetResult> {
  const [drawStateResult, fragmentResult] = await Promise.all([
    supabase
      .from("talent_draw_state")
      .select("spent_draws, basic_spent_draws, advanced_spent_draws, event_basic_spent_draws, event_advanced_spent_draws")
      .eq("invite_code_hash", codeHash)
      .maybeSingle(),
    supabase
      .from("user_fragments")
      .select("fragment_total")
      .eq("invite_code_hash", codeHash)
      .maybeSingle(),
  ]);
  if (drawStateResult.error) return identityResetError(drawStateResult.error);
  if (fragmentResult.error) return identityResetError(fragmentResult.error);

  const drawState = (drawStateResult.data || {}) as Record<string, unknown>;
  const refundedDraws = Math.max(0, Number(drawState.spent_draws || 0));
  const refundedBasicDraws = Math.max(0, Number(drawState.basic_spent_draws || 0));
  const refundedAdvancedDraws = Math.max(0, Number(drawState.advanced_spent_draws || 0));
  const refundedEventBasicDraws = Math.max(0, Number(drawState.event_basic_spent_draws || 0));
  const refundedEventAdvancedDraws = Math.max(0, Number(drawState.event_advanced_spent_draws || 0));
  const clearedFragments = Math.max(0, Number(fragmentResult.data?.fragment_total || 0));

  const deleteOps = [
    supabase.from("owned_talents").delete().eq("invite_code_hash", codeHash),
    supabase.from("talent_overflow_choices").delete().eq("invite_code_hash", codeHash),
    supabase.from("talent_draw_logs").delete().eq("invite_code_hash", codeHash),
    supabase.from("talent_exchange_logs").delete().eq("invite_code_hash", codeHash),
    supabase.from("talent_pool_counters").delete().eq("invite_code_hash", codeHash),
  ] as const;
  for (const op of deleteOps) {
    const { error } = await op;
    if (error) return identityResetError(error);
  }

  if (fragmentResult.data || clearedFragments > 0) {
    const { error } = await supabase
      .from("user_fragments")
      .upsert({
        invite_code_hash: codeHash,
        fragment_total: 0,
        updated_at: new Date().toISOString(),
      });
    if (error) return identityResetError(error);
  }

  if (drawStateResult.data) {
    const { error } = await supabase
      .from("talent_draw_state")
      .update({
        spent_draws: 0,
        basic_spent_draws: 0,
        advanced_spent_draws: 0,
        event_basic_spent_draws: 0,
        event_advanced_spent_draws: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("invite_code_hash", codeHash);
    if (error) {
      if (error.code === "42703") {
        const fallback = await supabase
          .from("talent_draw_state")
          .update({
            spent_draws: 0,
            basic_spent_draws: 0,
            advanced_spent_draws: 0,
            updated_at: new Date().toISOString(),
          })
          .eq("invite_code_hash", codeHash);
        if (fallback.error) return identityResetError(fallback.error);
      } else {
        return identityResetError(error);
      }
    }
  }

  const { error: profileTalentError } = await supabase
    .from("player_profiles")
    .update({ talents: "", updated_at: new Date().toISOString() })
    .eq("invite_code_hash", codeHash);
  if (profileTalentError && profileTalentError.code !== "42703") return identityResetError(profileTalentError);

  return {
    removedPoolKeys: [],
    refundedDraws,
    refundedBasicDraws,
    refundedAdvancedDraws,
    refundedEventBasicDraws,
    refundedEventAdvancedDraws,
    clearedFragments,
    removedAllTalents: true,
  };
}

export function canSettleScores(identity: InviteIdentity) {
  return identity.role === "admin" || hasPermission(identity, "settle_scores");
}

export function cleanSettlementScore(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return Number.NaN;
  return Math.round(number * 10) / 10;
}

export function checkSettlementScoreRange(deng: number, jin: number) {
  if (!Number.isFinite(deng) || !Number.isFinite(jin)) return "分数格式不正确";
  if (deng < scoreDengMin || deng > scoreDengMax) return `登神之路分数必须在 ${scoreDengMin}~${scoreDengMax} 之间`;
  if (jin < scoreJinMin || jin > scoreJinMax) return `觐见之梯分数必须在 ${scoreJinMin}~${scoreJinMax} 之间`;
  return "";
}

export function cleanClearStatus(value: unknown) {
  const status = cleanText(value, 20).toLowerCase();
  if (["passed", "clear", "success", "逢生"].includes(status)) return "passed";
  if (["lost", "failed", "fail", "迷失"].includes(status)) return "lost";
  return "unknown";
}

export function buildSettlementClearStatusMap(
  entries: { nick: string }[],
  rawStatuses: unknown,
  confirmClear: boolean,
) {
  const input = rawStatuses && typeof rawStatuses === "object" && !Array.isArray(rawStatuses)
    ? rawStatuses as Record<string, unknown>
    : {};
  const statuses = new Map<string, string>();
  for (const entry of entries) {
    const status = cleanClearStatus(input[entry.nick]);
    statuses.set(entry.nick, status === "unknown" && confirmClear ? "passed" : status);
  }
  return statuses;
}

export function getClearStatusLabel(status: string) {
  if (status === "passed") return "逢生";
  if (status === "lost") return "迷失";
  return "未标注";
}

export function normalizeProfileMatchKey(value: unknown) {
  return cleanText(value, 80)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export const scoreSettlementFaithPrefixes = new Set([
  "生命", "存在", "文明", "虚无", "混沌", "沉沦",
  "孕育", "繁荣", "死亡", "记忆", "时间", "秩序", "真理", "战争",
  "欺诈", "命运", "混乱", "沉默", "痴愚", "污堕", "腐朽", "湮灭",
]);

export function cleanScoreSettlementNick(value: unknown) {
  const nickText = cleanText(value, 80).replace(/^[\s:：;；,，、]+|[\s:：;；,，、]+$/gu, "");
  const faithPrefixed = nickText.match(/^([^\s:：;；,，、]+)[\s:：;；,，、]+(.+)$/u);
  if (faithPrefixed && scoreSettlementFaithPrefixes.has(faithPrefixed[1])) {
    return cleanText(faithPrefixed[2], 40);
  }
  return cleanText(nickText, 40);
}

export function parseScoreSettlementText(textContent: unknown) {
  const text = cleanText(textContent, 20000);
  const entries: { nick: string; deng: number; jin: number; total: number; line: number; raw: string }[] = [];
  const invalidLines: { line: number; raw: string; msg: string }[] = [];
  text.split(/\r?\n/u).forEach((lineText, index) => {
    const raw = lineText.trim();
    if (!raw) return;
    const normalized = raw.replace(/^\s*\d+\s*[.．、)]\s*/u, "");
    const match = normalized.match(/^(.+?)\s*([+-]?\d+(?:\.\d+)?)\s*\+\s*([+-]?\d+(?:\.\d+)?)\s*$/u);
    if (!match) {
      if (!entries.length) return;
      invalidLines.push({ line: index + 1, raw, msg: "格式应为 昵称+登神+觐见，可在昵称前加信仰前缀，例如：欺诈 无我+2+1" });
      return;
    }
    const nick = cleanScoreSettlementNick(String(match[1] || "").replace(/[：:：；;,，、\s]+$/u, ""));
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

export async function getProfilesByNames(
  supabase: SupabaseClientAny,
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
  const missingNames = uniqueNames.filter((name) => !profiles.has(name));
  if (!missingNames.length) return { profiles };

  const { data: allProfiles, error: allError } = await supabase
    .from("player_profiles")
    .select("invite_code_hash, display_name, role, ascension_score, audience_score")
    .limit(1000);
  if (allError) return { error: allError };
  const candidates = (allProfiles || [])
    .map((profile) => ({
      profile,
      displayName: String(profile.display_name || ""),
      key: normalizeProfileMatchKey(profile.display_name),
    }))
    .filter((item) => item.displayName && item.key);

  for (const name of missingNames) {
    const key = normalizeProfileMatchKey(name);
    if (!key) continue;
    const exact = candidates.find((item) => item.key === key);
    if (exact) {
      profiles.set(name, exact.profile);
      profiles.set(exact.displayName, exact.profile);
      continue;
    }
    const partialMatches = candidates
      .filter((item) => item.key.length >= 2 && key.includes(item.key))
      .sort((a, b) => b.key.length - a.key.length);
    if (partialMatches.length && partialMatches.filter((item) => item.key.length === partialMatches[0].key.length).length === 1) {
      profiles.set(name, partialMatches[0].profile);
      profiles.set(partialMatches[0].displayName, partialMatches[0].profile);
    }
  }
  return { profiles };
}

export async function buildScorePreview(
  supabase: SupabaseClientAny,
  entries: { nick: string; deng: number; jin: number; total: number; line: number; raw: string }[],
  invalidLines: { line: number; raw: string; msg: string }[],
) {
  const scoreErrList = entries
    .map((entry) => ({ ...entry, msg: checkSettlementScoreRange(entry.deng, entry.jin) }))
    .filter((entry) => entry.msg);
  const profileResult = await getProfilesByNames(supabase, entries.map((entry) => entry.nick));
  if (profileResult.error) return { error: profileResult.error };
  const profiles = profileResult.profiles || new Map<string, Record<string, unknown>>();
  const resolvedEntries = entries.map((entry) => {
    const profile = profiles.get(entry.nick);
    const displayName = cleanText(profile?.display_name, 40);
    return displayName && displayName !== entry.nick ? { ...entry, nick: displayName } : entry;
  });
  const nickCounts = new Map<string, number>();
  resolvedEntries.forEach((entry) => nickCounts.set(entry.nick, (nickCounts.get(entry.nick) || 0) + 1));
  const duplicateNick = [...nickCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([nick]) => nick);
  const missingNick = [...new Set(entries.map((entry) => entry.nick).filter((nick) => !profiles.has(nick)))];
  const totalDeng = entries.reduce((sum, entry) => sum + (Number.isFinite(entry.deng) ? entry.deng : 0), 0);
  const totalJin = entries.reduce((sum, entry) => sum + (Number.isFinite(entry.jin) ? entry.jin : 0), 0);
  return {
    data: {
      allList: resolvedEntries,
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

export function getTalentFragmentGain(rank: unknown) {
  const normalizedRank = String(rank || "").toUpperCase();
  if (normalizedRank === "S") return 500;
  if (normalizedRank === "A") return 200;
  if (normalizedRank === "B") return bTalentFragmentGain;
  if (normalizedRank === "C") return cTalentFragmentGain;
  return 0;
}

export function getTalentExchangeCost(rank: unknown) {
  const normalizedRank = String(rank || "").toUpperCase();
  if (normalizedRank === "S") return 800;
  return normalizedRank === "A" ? aTalentExchangeCost : targetTalentExchangeCost;
}

export function pickRandomTalent<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)] ?? items[0];
}

export function isAdvancedTalentDrawUnlocked(ascensionScore: unknown) {
  return cleanScore(ascensionScore) >= advancedTalentDrawScore;
}

export function pickTalentFromRank(items: TalentPoolItem[], rank: string) {
  const rankItems = items.filter((item) => item.rank === rank);
  return rankItems.length ? pickRandomTalent(rankItems) : null;
}

export function pickDrawTalent(items: TalentPoolItem[], advancedDraw = false): TalentPoolItem {
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

export function pickDrawTalentWithGuarantee(
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

export async function rebuildTalentPoolCounterFromLogs(
  supabase: SupabaseClientAny,
  codeHash: string,
  poolKey: string,
) {
  const { data, error } = await supabase
    .from("talent_draw_logs")
    .select("rank")
    .eq("invite_code_hash", codeHash)
    .eq("pool_key", poolKey)
    .order("draw_time", { ascending: false })
    .limit(Math.max(bTalentGuaranteeDraws, sTalentGuaranteeDraws) + starterTalentDrawGrant);
  if (error) return { continueDraw: 0, sContinueDraw: 0, rebuilt: false, error };

  let continueDraw = 0;
  let sContinueDraw = 0;
  let foundB = false;
  let foundS = false;
  for (const row of data || []) {
    const rank = String(row.rank || "").toUpperCase();
    if (!foundB) {
      if (rank === "B") foundB = true;
      else continueDraw += 1;
    }
    if (!foundS) {
      if (rank === "S") foundS = true;
      else sContinueDraw += 1;
    }
    if (foundB && foundS) break;
  }

  return {
    continueDraw: Math.min(Math.max(0, continueDraw), bTalentGuaranteeDraws - 1),
    sContinueDraw: Math.min(Math.max(0, sContinueDraw), sTalentGuaranteeDraws - 1),
    rebuilt: (data || []).length > 0,
  };
}

export function getTalentKey(poolKey: unknown, talentId: unknown) {
  return `${String(poolKey || "")}::${Number(talentId) || 0}`;
}

export function weightedPickTalent<T extends { talent_id: number }>(items: T[]): T {
  let totalWeight = 0;
  const weighted = items.map((item) => {
    totalWeight += Math.max(1, Number(item.talent_id) || 1) ** 2;
    return { item, totalWeight };
  });
  const roll = Math.random() * totalWeight;
  return weighted.find((entry) => roll <= entry.totalWeight)?.item ?? items[items.length - 1];
}

export async function getTalentProfile(
  supabase: SupabaseClientAny,
  identity: InviteIdentity,
) {
  const { data, error } = await supabase
    .from("player_profiles")
    .select("display_name, role, faith_god, faith_path, original_faith_god, original_faith_path, trickery_display_faith_god, trickery_display_faith_path, trickery_display_profession, profession, ascension_score, audience_score, items, talents, show_titles, updated_at")
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

export async function getTalentDrawState(
  supabase: SupabaseClientAny,
  codeHash: string,
) {
  const { data, error } = await supabase
    .from("talent_draw_state")
    .select("spent_draws, basic_spent_draws, advanced_spent_draws, event_basic_draws, event_advanced_draws, event_basic_spent_draws, event_advanced_spent_draws")
    .eq("invite_code_hash", codeHash)
    .maybeSingle();
  if (
    error?.code === "42703" &&
    (
      error.message?.includes("event_basic_draws")
      || error.message?.includes("event_advanced_draws")
      || error.message?.includes("event_basic_spent_draws")
      || error.message?.includes("event_advanced_spent_draws")
    )
  ) {
    const fallback = await supabase
      .from("talent_draw_state")
      .select("spent_draws, basic_spent_draws, advanced_spent_draws, event_basic_draws, event_advanced_draws")
      .eq("invite_code_hash", codeHash)
      .maybeSingle();
    if (fallback.error?.code === "42703") {
      return { error: { ...fallback.error, message: "请先运行 talent_draw_tier_1500_20260727.sql" }, spentDraws: 0, basicSpentDraws: 0, advancedSpentDraws: 0, eventBasicDraws: 0, eventAdvancedDraws: 0, eventBasicSpentDraws: 0, eventAdvancedSpentDraws: 0 };
    }
    if (fallback.error) return { error: fallback.error, spentDraws: 0, basicSpentDraws: 0, advancedSpentDraws: 0, eventBasicDraws: 0, eventAdvancedDraws: 0, eventBasicSpentDraws: 0, eventAdvancedSpentDraws: 0 };
    return {
      spentDraws: Number(fallback.data?.spent_draws || 0),
      basicSpentDraws: Number(fallback.data?.basic_spent_draws || 0),
      advancedSpentDraws: Number(fallback.data?.advanced_spent_draws || 0),
      eventBasicDraws: Number(fallback.data?.event_basic_draws || 0),
      eventAdvancedDraws: Number(fallback.data?.event_advanced_draws || 0),
      eventBasicSpentDraws: 0,
      eventAdvancedSpentDraws: 0,
    };
  }
  if (error?.code === "42703") {
    return { error: { ...error, message: "请先运行 talent_draw_tier_1500_20260727.sql" }, spentDraws: 0, basicSpentDraws: 0, advancedSpentDraws: 0, eventBasicDraws: 0, eventAdvancedDraws: 0, eventBasicSpentDraws: 0, eventAdvancedSpentDraws: 0 };
  }
  if (error) return { error, spentDraws: 0, basicSpentDraws: 0, advancedSpentDraws: 0, eventBasicDraws: 0, eventAdvancedDraws: 0, eventBasicSpentDraws: 0, eventAdvancedSpentDraws: 0 };
  return {
    spentDraws: Number(data?.spent_draws || 0),
    basicSpentDraws: Number(data?.basic_spent_draws || 0),
    advancedSpentDraws: Number(data?.advanced_spent_draws || 0),
    eventBasicDraws: Number(data?.event_basic_draws || 0),
    eventAdvancedDraws: Number(data?.event_advanced_draws || 0),
    eventBasicSpentDraws: Number(data?.event_basic_spent_draws || 0),
    eventAdvancedSpentDraws: Number(data?.event_advanced_spent_draws || 0),
  };
}

export async function getPendingSTalentChoices(
  supabase: SupabaseClientAny,
  codeHash: string,
) {
  const { data, error } = await supabase
    .from("talent_s_choices")
    .select("id, pool_key, source_draw_log_id, source_draw_type, is_guarantee, status, selected_talent_id, selected_talent_name, created_at, used_at")
    .eq("invite_code_hash", codeHash)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error?.code === "42P01" || error?.code === "42703") {
    return { error: { ...error, message: "请先运行 talent_s_choice_slot_20260817.sql" }, pendingChoices: [] as Record<string, unknown>[] };
  }
  if (error) return { error, pendingChoices: [] as Record<string, unknown>[] };
  return { pendingChoices: data || [] };
}

export async function consumeSTalentChoice(
  supabase: SupabaseClientAny,
  codeHash: string,
  choice: { id: number; pool_key: string; source_draw_type: string; is_guarantee: boolean },
  selectedTalent: TalentPoolItem,
) {
  const { error } = await supabase
    .from("talent_s_choices")
    .update({
      status: "used",
      selected_talent_id: selectedTalent.talent_id,
      selected_talent_name: selectedTalent.talent_name,
      used_at: new Date().toISOString(),
    })
    .eq("id", choice.id)
    .eq("invite_code_hash", codeHash)
    .eq("status", "pending");
  if (error) return { error };
  return { data: { ...choice, selectedTalent } };
}

export async function getAvailableSTalentSlotOwnedRows(
  ownedTalents: {
    id: number;
    pool_key: string;
    talent_id: number;
    talent_name: string;
    rank: string;
    acquired_from: string;
    storage_slot: number | null;
    equipped_slot: number | null;
    s_slot: number | null;
    acquired_at: string;
  }[],
) {
  const used = new Set(ownedTalents.map((item) => Number(item.s_slot)).filter((slot) => slot >= 1 && slot <= sTalentWarehouseSlotLimit));
  for (let slot = 1; slot <= sTalentWarehouseSlotLimit; slot += 1) {
    if (!used.has(slot)) return slot;
  }
  return 0;
}

export async function getFragmentTotal(
  supabase: SupabaseClientAny,
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

export async function addUserFragments(
  supabase: SupabaseClientAny,
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

export async function updateProfileTalentText(
  supabase: SupabaseClientAny,
  codeHash: string,
) {
  const { data: owned, error } = await supabase
    .from("owned_talents")
    .select("talent_name, rank, equipped_slot, storage_slot, s_slot")
    .eq("invite_code_hash", codeHash)
    .or("equipped_slot.not.is.null,s_slot.not.is.null")
    .order("equipped_slot", { ascending: true });
  if (error) return { error };
  const talentText = (owned || [])
    .map((item) => item.s_slot
      ? `S仓库${item.s_slot}：${item.talent_name}（${item.rank}）`
      : `槽位${item.equipped_slot}：${item.talent_name}（${item.rank}）`)
    .join("\n")
    .slice(0, 800);

  const { error: updateError } = await supabase
    .from("player_profiles")
    .update({ talents: talentText, updated_at: new Date().toISOString() })
    .eq("invite_code_hash", codeHash);
  return { error: updateError, talentText };
}

export async function getAvailableStorageSlot(
  supabase: SupabaseClientAny,
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

export async function getAvailableSTalentSlot(
  supabase: SupabaseClientAny,
  codeHash: string,
) {
  const { data, error } = await supabase
    .from("owned_talents")
    .select("s_slot")
    .eq("invite_code_hash", codeHash)
    .eq("rank", "S")
    .not("s_slot", "is", null);
  if (error) return { error, slot: 0 };
  const used = new Set((data || []).map((item) => Number(item.s_slot)).filter((slot) => slot >= 1 && slot <= sTalentWarehouseSlotLimit));
  for (let slot = 1; slot <= sTalentWarehouseSlotLimit; slot += 1) {
    if (!used.has(slot)) return { slot };
  }
  return { slot: 0 };
}

export async function addOwnedTalentToStorage(
  supabase: SupabaseClientAny,
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

  if (String(talent.rank || "").toUpperCase() === "S") {
    const slotResult = await getAvailableSTalentSlot(supabase, codeHash);
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
        s_slot: slotResult.slot,
      })
      .select()
      .single();
    if (error) return { error };
    return { ownedTalent: data };
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

export async function settleDuplicateOverflowChoices(
  supabase: SupabaseClientAny,
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

export async function settleOpenSlotOverflowChoices(
  supabase: SupabaseClientAny,
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

export async function buildTalentState(
  supabase: SupabaseClientAny,
  identity: InviteIdentity,
): Promise<{ data?: Record<string, unknown>; error?: LooseError }> {
  const profileResult = await getTalentProfile(supabase, identity);
  if (profileResult.error) return { error: profileResult.error };
  const profile = profileResult.data;

  const drawState = await getTalentDrawState(supabase, identity.codeHash);
  if (drawState.error) return { error: drawState.error };
  const fragmentState = await getFragmentTotal(supabase, identity.codeHash);
  if (fragmentState.error) return { error: fragmentState.error };

  const baseBasicDrawsEarned = getBasicDrawsEarned(profile.ascension_score);
  const eventBasicDraws = drawState.eventBasicDraws;
  const eventAdvancedDraws = drawState.eventAdvancedDraws;
  const basicDrawsEarned = baseBasicDrawsEarned + eventBasicDraws;
  const advancedDrawsEarned = getAdvancedDrawsEarned(profile.ascension_score) + eventAdvancedDraws;
  const totalDrawsEarned = basicDrawsEarned + advancedDrawsEarned;
  const basicSpentDraws = drawState.basicSpentDraws;
  const advancedSpentDraws = drawState.advancedSpentDraws;
  const spentDraws = basicSpentDraws + advancedSpentDraws;
  const basicAvailableDraws = Math.max(0, basicDrawsEarned - basicSpentDraws);
  const advancedAvailableDraws = Math.max(0, advancedDrawsEarned - advancedSpentDraws);
  const availableDraws = basicAvailableDraws + advancedAvailableDraws;
  const allowedPoolKeys = getAllowedTalentPools(profile);
  const talentSlotRule = getTalentSlotRule(profile.ascension_score);
  const activeEquippedSlotLimit = getTalentSlotLimit(profile.ascension_score);
  const exclusiveResult = await getExclusiveTalentState(supabase, profile, identity.codeHash);
  if (exclusiveResult.error) return { error: exclusiveResult.error };

  let poolItems: TalentPoolItem[] = [];
  if (allowedPoolKeys.length > 0) {
    const poolResult = await supabase
      .from("talent_pool_items")
      .select("pool_key, talent_id, talent_name, rank, effect, cooldown, action_cost")
      .in("pool_key", allowedPoolKeys)
      .eq("is_enabled", true)
      .order("pool_key", { ascending: true })
      .order("rank", { ascending: true })
      .order("talent_id", { ascending: true });
    if (isMissingTalentEffectColumn(poolResult.error ?? null)) {
      const fallbackPoolResult = await supabase
        .from("talent_pool_items")
        .select("pool_key, talent_id, talent_name, rank")
        .in("pool_key", allowedPoolKeys)
        .eq("is_enabled", true)
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

  const poolMap = new Map<string, { poolKey: string; total: number; sCount: number; aCount: number; bCount: number; cCount: number }>();
  allowedPoolKeys.forEach((poolKey) => {
    poolMap.set(poolKey, { poolKey, total: 0, sCount: 0, aCount: 0, bCount: 0, cCount: 0 });
  });
  poolItems.forEach((item) => {
    const existing = poolMap.get(item.pool_key) || { poolKey: item.pool_key, total: 0, sCount: 0, aCount: 0, bCount: 0, cCount: 0 };
    existing.total += 1;
    if (item.rank === "S") existing.sCount += 1;
    if (item.rank === "A") existing.aCount += 1;
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
    const counterKeys = new Set(counters.map((counter) => String(counter.pool_key || "")));
    const missingCounterKeys = allowedPoolKeys.filter((poolKey) => !counterKeys.has(poolKey));
    if (missingCounterKeys.length) {
      const rebuiltCounters = await Promise.all(missingCounterKeys.map(async (poolKey) => {
        const rebuilt = await rebuildTalentPoolCounterFromLogs(supabase, identity.codeHash, poolKey);
        if (rebuilt.error) return { error: rebuilt.error };
        if (!rebuilt.rebuilt) return null;
        return {
          pool_key: poolKey,
          continue_draw: rebuilt.continueDraw,
          s_continue_draw: rebuilt.sContinueDraw,
        };
      }));
      for (const item of rebuiltCounters) {
        if (item && "error" in item) return { error: item.error };
      }
      counters = [
        ...counters,
        ...rebuiltCounters.filter((item): item is { pool_key: string; continue_draw: number; s_continue_draw: number } => !!item && !("error" in item)),
      ];
    }
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
    s_slot: number | null;
    acquired_at: string;
  }[] = [];
  const ownedResult = await supabase
    .from("owned_talents")
    .select("id, pool_key, talent_id, talent_name, rank, acquired_from, storage_slot, equipped_slot, s_slot, acquired_at")
    .eq("invite_code_hash", identity.codeHash)
    .order("storage_slot", { ascending: true });
  if (ownedResult.error?.code === "42703") return { error: { ...ownedResult.error, message: "请先运行 talent_s_choice_slot_20260817.sql" } };
  if (ownedResult.error) return { error: ownedResult.error };
  const canonicalTalentByKey = new Map(
    poolItems.map((item) => [`${item.pool_key}:${Number(item.talent_id)}`, item]),
  );
  ownedTalents = (ownedResult.data || [])
    .filter((item) => item.storage_slot || item.equipped_slot || item.s_slot)
    .map((item) => {
      const canonical = canonicalTalentByKey.get(`${item.pool_key}:${Number(item.talent_id)}`);
      if (!canonical) return item;
      return {
        ...item,
        talent_name: canonical.talent_name,
        rank: canonical.rank,
      };
    });

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
      .select("id, pool_key, talent_id, talent_name, rank, acquired_from, storage_slot, equipped_slot, s_slot, acquired_at")
      .eq("invite_code_hash", identity.codeHash)
      .order("storage_slot", { ascending: true });
    if (refreshedOwnedResult.error?.code === "42703") return { error: { ...refreshedOwnedResult.error, message: "请先运行 talent_s_choice_slot_20260817.sql" } };
    if (refreshedOwnedResult.error) return { error: refreshedOwnedResult.error };
    ownedTalents = (refreshedOwnedResult.data || []).filter((item) => item.storage_slot || item.equipped_slot || item.s_slot);
  }
  const sWarehouseTalents = ownedTalents.filter((item) => String(item.rank || "").toUpperCase() === "S" && Number(item.s_slot || 0) >= 1);
  const settledFragmentTotal = fragmentState.fragmentTotal + Number(overflowSettlement.fragmentGain || 0);

  return {
    data: {
      profile,
      inventorySlotLimit,
      equippedSlotLimit: activeEquippedSlotLimit,
      maxEquippedSlotLimit: equippedSlotLimit,
      talentSlotRule,
      talentSlotScoreRules,
      talentSlotKinds: getTalentSlotKinds(profile.ascension_score),
      exclusiveTalentSlot: exclusiveResult.data,
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
      baseBasicDrawsEarned,
      eventBasicDraws,
      eventAdvancedDraws,
      basicDrawsEarned,
      basicSpentDraws,
      basicAvailableDraws,
      advancedDrawsEarned,
      advancedSpentDraws,
      advancedAvailableDraws,
      advancedTalentDrawScore,
      fragmentTotal: settledFragmentTotal,
      sTalentWarehouseSlotLimit,
      sTalentWarehouseCount: sWarehouseTalents.length,
      sTalentExchangeCost: 800,
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

export function compactTalentStateForAction(state: Record<string, unknown>) {
  const compactState: Record<string, unknown> = { ...state, compact: true };
  delete compactState.poolItems;
  return compactState;
}

export async function recalculateClearStats(
  supabase: SupabaseClientAny,
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

export async function confirmClearRecordsFromSettlement(
  supabase: SupabaseClientAny,
  dungeon: { id: unknown; name: unknown; run_count: unknown },
  entries: { nick: string; deng: number; jin: number; total: number; line: number; raw: string }[],
  profiles: Map<string, Record<string, unknown>>,
  operatorName: string,
  clearStatuses: Map<string, string> = new Map(),
) {
  let confirmed = 0;
  const runNumber = Number(dungeon.run_count) || 1;
  for (const entry of entries) {
    if (clearStatuses.get(entry.nick) !== "passed") continue;
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

export async function resolveSettlementDungeon(
  supabase: SupabaseClientAny,
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

export async function getMatchState(
  supabase: SupabaseClientAny,
  dungeonId: string,
) {
  let { data: dungeon, error: dungeonError } = await supabase
    .from("dungeons")
    .select("id, name, creator, co_creators, difficulty, type, participant_count, estimated_duration, run_count, clear_rate, avg_rating, rating_count")
    .eq("id", dungeonId)
    .single();
  if (isMissingEstimatedDurationColumn(dungeonError)) {
    const fallback = await supabase
      .from("dungeons")
      .select("id, name, creator, co_creators, difficulty, type, participant_count, run_count, clear_rate, avg_rating, rating_count")
      .eq("id", dungeonId)
      .single();
    dungeon = fallback.data as typeof dungeon;
    dungeonError = fallback.error;
  }
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
      dungeon: dungeon ? { ...dungeon, estimatedDuration: getDungeonEstimatedDuration(dungeon as Record<string, unknown>) } : null,
      queue: queue || [],
      queuedCount: queue?.length || 0,
      rooms: rooms || [],
    },
  };
}

export async function getMatchMusterState(
  supabase: SupabaseClientAny,
  musterId: string,
  identity: InviteIdentity,
) {
  const readMusterWithDuration = () => supabase
    .from("match_musters")
    .select("id, dungeon_id, creator_code_hash, creator_name, target_player_count, estimated_duration, status, opens_at, closes_at, room_id, created_at, drawn_at")
    .eq("id", musterId)
    .single();

  const readMuster = async () => {
    const result = await readMusterWithDuration();
    if (!isMissingEstimatedDurationColumn(result.error)) return result;
    return supabase
      .from("match_musters")
      .select("id, dungeon_id, creator_code_hash, creator_name, target_player_count, status, opens_at, closes_at, room_id, created_at, drawn_at")
      .eq("id", musterId)
      .single();
  };

  let { data: muster, error: musterError } = await readMuster();
  if (musterError) return { error: musterError };
  if (!muster) return { error: { message: "召集不存在" } };

  const musterRecord = muster as Record<string, unknown>;
  const closesAt = new Date(String(musterRecord.closes_at || "")).getTime();
  if (musterRecord.status === "open" && Number.isFinite(closesAt) && closesAt <= Date.now()) {
    const { error: drawError } = await supabase.rpc("draw_match_muster", {
      p_muster_id: musterId,
    });
    if (drawError && !String(drawError.message || "").includes("召集尚未截止")) return { error: drawError };

    const reread = await readMuster();
    muster = reread.data;
    musterError = reread.error;
    if (musterError) return { error: musterError };
    if (!muster) return { error: { message: "召集不存在" } };
  }

  const dungeonId = String(musterRecord.dungeon_id || "");
  let { data: dungeon, error: dungeonError } = await supabase
    .from("dungeons")
    .select("id, name, creator, co_creators, difficulty, type, participant_count, estimated_duration, run_count, clear_rate, avg_rating, rating_count, comment_count, is_one_shot")
    .eq("id", dungeonId)
    .single();
  if (isMissingEstimatedDurationColumn(dungeonError)) {
    const fallback = await supabase
      .from("dungeons")
      .select("id, name, creator, co_creators, difficulty, type, participant_count, run_count, clear_rate, avg_rating, rating_count, comment_count, is_one_shot")
      .eq("id", dungeonId)
      .single();
    dungeon = fallback.data as typeof dungeon;
    dungeonError = fallback.error;
  }
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
  const isCreator = String(musterRecord.creator_code_hash || "") === identity.codeHash;
  const secondsRemaining = Math.max(0, Math.ceil((new Date(String(musterRecord.closes_at || "")).getTime() - Date.now()) / 1000));
  const musterEstimatedDuration = cleanText(musterRecord.estimated_duration, 40);

  return {
    data: {
      muster: {
        id: musterRecord.id,
        dungeon_id: musterRecord.dungeon_id,
        creator_name: musterRecord.creator_name,
        target_player_count: musterRecord.target_player_count,
        estimated_duration: musterEstimatedDuration,
        status: musterRecord.status,
        opens_at: musterRecord.opens_at,
        closes_at: musterRecord.closes_at,
        room_id: musterRecord.room_id,
        created_at: musterRecord.created_at,
        drawn_at: musterRecord.drawn_at,
      },
      dungeon: dungeon ? {
        ...dungeon,
        estimatedDuration: musterEstimatedDuration || getDungeonEstimatedDuration(dungeon as Record<string, unknown>),
      } : null,
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

export function getBattleClassName(profession: unknown) {
  return professionClassByName.get(cleanText(profession, 40)) || "";
}

export function getBattleHealthBand(ascensionScore: unknown) {
  const score = cleanScore(ascensionScore) || defaultAscensionScore;
  return Math.max(battleClassHealthMin, Math.min(battleClassHealthMax, Math.floor(score / 100) * 100));
}

export function getBattleMaxHp(faithGod: unknown, profession: unknown, ascensionScore: unknown) {
  const className = getBattleClassName(profession);
  const band = getBattleHealthBand(ascensionScore);
  const tableHp = Number((battleHealthByScore.get(band) as Record<string, unknown> | undefined)?.[className] || 80);
  const faithBonus = cleanText(faithGod, 20) === "繁荣" ? Number(prosperityBattleHealthBonus[className] || 0) : 0;
  return Math.max(1, Math.min(9999, tableHp + faithBonus));
}

export function getBattleAttack(profession: unknown) {
  return Math.max(0, Number(battleAttackByClass[getBattleClassName(profession)] || 1));
}

export function parseCooldownRounds(value: unknown, fallback = 0) {
  const match = String(value || "").match(/\d+/);
  const parsed = match ? Number(match[0]) : fallback;
  return Math.max(0, Math.min(99, Number.isFinite(parsed) ? parsed : fallback));
}

export async function buildBattleAbilities(
  supabase: SupabaseClientAny,
  codeHash: string,
  profession: unknown,
) {
  const className = getBattleClassName(profession);
  const classSkill = battleClassSkillByClass[className] || {
    name: "职业技能",
    effect: "由 DM 判断效果",
    cooldownRounds: 3,
  };
  const abilities: Record<string, unknown>[] = [{
    key: "class-skill",
    abilityType: "class_skill",
    name: classSkill.name,
    effect: classSkill.effect,
    cooldownRounds: classSkill.cooldownRounds,
    availableRound: 1,
  }];

  const { data: owned, error: ownedError } = await supabase
    .from("owned_talents")
    .select("pool_key, talent_id, talent_name, rank, equipped_slot, s_slot")
    .eq("invite_code_hash", codeHash)
    .or("equipped_slot.not.is.null,s_slot.not.is.null")
    .order("equipped_slot", { ascending: true });
  if (ownedError && ownedError.code !== "42P01") return { error: ownedError };
  const ownedRows = (owned || []).filter((item) => item.equipped_slot || item.s_slot);
  if (!ownedRows.length) return { data: abilities };

  const poolKeys = Array.from(new Set(ownedRows.map((item) => String(item.pool_key || "")).filter(Boolean)));
  const { data: poolItems, error: poolError } = await supabase
    .from("talent_pool_items")
    .select("pool_key, talent_id, effect, cooldown, action_cost")
    .in("pool_key", poolKeys);
  if (poolError && poolError.code !== "42P01" && poolError.code !== "42703") return { error: poolError };
  const effectByKey = new Map((poolItems || []).map((item) => [
    `${item.pool_key}:${item.talent_id}`,
    item,
  ]));
  ownedRows.forEach((item, index) => {
    const poolItem = effectByKey.get(`${item.pool_key}:${item.talent_id}`) as Record<string, unknown> | undefined;
    const slot = Number(item.equipped_slot || 0) || index + 1;
    abilities.push({
      key: `talent-${String(item.pool_key || "unknown")}-${Number(item.talent_id || index + 1)}`,
      abilityType: "talent",
      slot,
      name: cleanText(item.talent_name, 80) || `个人天赋 ${slot}`,
      rank: cleanText(item.rank, 4),
      effect: cleanText(poolItem?.effect, 600),
      cooldown: cleanText(poolItem?.cooldown, 80),
      cooldownRounds: parseCooldownRounds(poolItem?.cooldown, 0),
      actionCost: Number(poolItem?.action_cost || 0),
      availableRound: 1,
    });
  });
  return { data: abilities.slice(0, 5) };
}

export function cleanBattleAmount(value: unknown, fallback = 0) {
  const amount = Math.round(Number(value));
  if (!Number.isFinite(amount)) return fallback;
  return Math.max(-9999, Math.min(9999, amount));
}

export function getDungeonEstimatedDuration(dungeon: Record<string, unknown> | null | undefined) {
  const explicit = cleanText(dungeon?.estimated_duration, 40);
  if (explicit) return explicit;
  const difficulty = cleanText(dungeon?.difficulty, 20);
  if (["低", "low"].includes(difficulty)) return "约1-2小时";
  if (["中", "medium"].includes(difficulty)) return "约2-3小时";
  if (["高", "high"].includes(difficulty)) return "约3-4小时";
  return "约2-4小时";
}

export const battleRoomLifetimeMs = 6 * 60 * 60 * 1000;

export function getDefaultBattleExpiresAt() {
  return new Date(Date.now() + battleRoomLifetimeMs).toISOString();
}

export function getBattleRoomExpiresAt(room: Record<string, unknown>) {
  const explicit = String(room.expires_at || "");
  if (explicit) return explicit;
  const createdAt = new Date(String(room.created_at || ""));
  if (Number.isNaN(createdAt.getTime())) return getDefaultBattleExpiresAt();
  return new Date(createdAt.getTime() + battleRoomLifetimeMs).toISOString();
}

export async function expireStaleBattleRooms(supabase: SupabaseClientAny): Promise<BattleActionResult> {
  const now = new Date();
  const { data: activeRooms, error } = await supabase
    .from("battle_rooms")
    .select("*")
    .eq("room_status", "active")
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) return { error };

  for (const room of activeRooms || []) {
    const expiresAt = new Date(getBattleRoomExpiresAt(room as Record<string, unknown>)).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt > now.getTime()) continue;
    const finishAt = now.toISOString();
    const { error: updateError } = await supabase
      .from("battle_rooms")
      .update({
        room_status: "finished",
        note: cleanText((room as Record<string, unknown>).note, 800) || "战斗房间已超过6小时自动结束",
        finished_at: finishAt,
        updated_at: finishAt,
      })
      .eq("id", String((room as Record<string, unknown>).id || ""))
      .eq("room_status", "active");
    if (updateError && !["42P01", "42703", "PGRST204"].includes(String(updateError.code || ""))) {
      return { error: updateError };
    }
  }
  return { data: true };
}

export async function buildBattlePlayerSnapshot(
  supabase: SupabaseClientAny,
  battleRoomId: string,
  identity: InviteIdentity,
  seatOrder = 1,
) {
  const { data: profile, error: profileError } = await supabase
    .from("player_profiles")
    .select("invite_code_hash, display_name, faith_god, profession, ascension_score")
    .eq("invite_code_hash", identity.codeHash)
    .maybeSingle();
  if (profileError && profileError.code !== "42P01") return { error: profileError };

  const playerName = cleanText(profile?.display_name || identity.displayName, 40) || "未命名信徒";
  const faithGod = cleanText(profile?.faith_god, 20);
  const profession = cleanText(profile?.profession, 40);
  const ascensionScore = cleanScore(profile?.ascension_score) || defaultAscensionScore;
  const maxHp = getBattleMaxHp(faithGod, profession, ascensionScore);
  const abilitiesResult = await buildBattleAbilities(supabase, identity.codeHash, profession);
  if (abilitiesResult.error) return { error: abilitiesResult.error };
  return {
    data: {
      battle_room_id: battleRoomId,
      player_code_hash: identity.codeHash,
      player_name: playerName,
      faith_god: faithGod,
      profession,
      class_name: getBattleClassName(profession),
      ascension_score: ascensionScore,
      max_hp: maxHp,
      current_hp: maxHp,
      shield: 0,
      team_name: "观众",
      attack_value: getBattleAttack(profession),
      abilities: abilitiesResult.data || [],
      is_defeated: false,
      seat_order: seatOrder,
    },
  };
}

export async function getBattleRoomState(
  supabase: SupabaseClientAny,
  battleRoomId: string,
  identity: InviteIdentity,
): Promise<BattleActionResult> {
  let { data: room, error: roomError } = await supabase
    .from("battle_rooms")
    .select("*")
    .eq("id", battleRoomId)
    .maybeSingle();
  if (roomError) return { error: roomError };
  if (!room) return { error: { message: "战斗房间不存在" } };

  const expiresAt = getBattleRoomExpiresAt(room);
  if (String(room.room_status || "") === "active" && new Date(expiresAt).getTime() <= Date.now()) {
    const now = new Date().toISOString();
    const { data: expiredRoom, error: expireError } = await supabase
      .from("battle_rooms")
      .update({
        room_status: "finished",
        note: cleanText(room.note, 800) || "战斗房间已超过6小时自动结束",
        finished_at: now,
        updated_at: now,
      })
      .eq("id", battleRoomId)
      .eq("room_status", "active")
      .select("*")
      .maybeSingle();
    if (expireError) return { error: expireError };
    if (expiredRoom) {
      room = expiredRoom;
      await supabase.from("battle_room_logs").insert({
        battle_room_id: battleRoomId,
        actor_code_hash: String(room.host_code_hash || identity.codeHash),
        actor_name: cleanText(room.host_name, 40) || identity.displayName,
        action_type: "finish",
        note: "战斗房间已超过6小时自动结束",
        round_no: Number(room.current_round || 1),
      });
    }
  }

  let { data: dungeon, error: dungeonError } = await supabase
    .from("dungeons")
    .select("id, name, creator, difficulty, type, participant_count, estimated_duration")
    .eq("id", String(room.dungeon_id))
    .maybeSingle();
  if (isMissingEstimatedDurationColumn(dungeonError)) {
    const fallback = await supabase
      .from("dungeons")
      .select("id, name, creator, difficulty, type, participant_count")
      .eq("id", String(room.dungeon_id))
      .maybeSingle();
    dungeon = fallback.data as typeof dungeon;
    dungeonError = fallback.error;
  }
  if (dungeonError) return { error: dungeonError };

  const { data: players, error: playerError } = await supabase
    .from("battle_room_players")
    .select("id, player_code_hash, player_name, faith_god, profession, class_name, ascension_score, max_hp, current_hp, shield, team_name, attack_value, abilities, is_defeated, seat_order, note, updated_at")
    .eq("battle_room_id", battleRoomId)
    .order("seat_order", { ascending: true })
    .order("id", { ascending: true });
  if (playerError) return { error: playerError };

  const { data: statusRows, error: statusError } = await supabase
    .from("battle_room_player_statuses")
    .select("id, battle_room_player_id, status_name, stack_count, is_public, created_at, updated_at")
    .eq("battle_room_id", battleRoomId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (statusError && statusError.code !== "42P01") return { error: statusError };

  const { data: logs, error: logError } = await supabase
    .from("battle_room_logs")
    .select("id, actor_name, action_type, target_player_id, target_player_name, amount, note, round_no, created_at")
    .eq("battle_room_id", battleRoomId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(30);
  if (logError) return { error: logError };

  const { data: actions, error: actionError } = await supabase
    .from("battle_room_actions")
    .select("id, battle_room_player_id, actor_name, round_no, action_text, action_status, ability_key, cooldown_until_round, dm_note, created_at, resolved_at")
    .eq("battle_room_id", battleRoomId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(60);
  if (actionError && actionError.code !== "42P01") return { error: actionError };

  const playerRows = players || [];
  const isHost = String(room.host_code_hash || "") === identity.codeHash;
  const isParticipant = playerRows.some((player) => String(player.player_code_hash || "") === identity.codeHash);
  const canOperate = isHost;
  const statusByPlayerId = new Map<string, Record<string, unknown>[]>();
  for (const status of statusRows || []) {
    if (!canOperate && status.is_public !== true) continue;
    const playerId = String(status.battle_room_player_id || "");
    statusByPlayerId.set(playerId, [...(statusByPlayerId.get(playerId) || []), status]);
  }
  const visiblePlayers = playerRows.map((player) => {
    const isSelf = String(player.player_code_hash || "") === identity.codeHash;
    const visible = { ...player } as Record<string, unknown>;
    delete visible.player_code_hash;
    visible.is_self = isSelf;
    visible.statuses = statusByPlayerId.get(String(player.id)) || [];
    if (!canOperate && !isSelf) visible.abilities = [];
    return visible;
  });
  const selfPlayer = playerRows.find((player) => String(player.player_code_hash || "") === identity.codeHash);
  const visibleActions = (actions || []).filter((item) => canOperate || String(item.battle_room_player_id) === String(selfPlayer?.id || ""));
  return {
    data: {
      room: { ...room, expiresAt },
      dungeon,
      players: visiblePlayers,
      logs: logs || [],
      actions: visibleActions,
      isHost,
      isParticipant,
      canOperate,
      canSubmitAction: !!selfPlayer && room.room_status === "active",
    },
  };
}

export async function getBattleRoomByMatchRoom(
  supabase: SupabaseClientAny,
  matchRoomId: string,
  identity: InviteIdentity,
): Promise<BattleActionResult> {
  const { data: existing, error: existingError } = await supabase
    .from("battle_rooms")
    .select("id")
    .eq("source_match_room_id", matchRoomId)
    .maybeSingle();
  if (existingError) return { error: existingError };
  if (existing?.id) return getBattleRoomState(supabase, String(existing.id), identity);
  return { data: null };
}

export async function createBattleRoomFromMatchRoom(
  supabase: SupabaseClientAny,
  matchRoomId: string,
  identity: InviteIdentity,
): Promise<BattleActionResult> {
  const existing = await getBattleRoomByMatchRoom(supabase, matchRoomId, identity);
  if (existing.error || existing.data) return existing;

  const { data: matchRoom, error: roomError } = await supabase
    .from("match_rooms")
    .select(`
      id,
      dungeon_id,
      room_status,
      match_room_players (
        id,
        player_code_hash,
        player_name,
        joined_at
      )
    `)
    .eq("id", matchRoomId)
    .maybeSingle();
  if (roomError) return { error: roomError };
  if (!matchRoom) return { error: { message: "组队房间不存在" } };

  const matchPlayers = Array.isArray(matchRoom.match_room_players) ? matchRoom.match_room_players : [];
  if (!matchPlayers.length) return { error: { message: "组队房间没有成员" } };

  const { data: sourceMusters, error: sourceMusterError } = await supabase
    .from("match_musters")
    .select("creator_code_hash, creator_name, created_at")
    .eq("room_id", matchRoomId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (sourceMusterError && !["42P01", "42703", "PGRST204"].includes(String(sourceMusterError.code || ""))) {
    return { error: sourceMusterError };
  }
  const sourceMuster = Array.isArray(sourceMusters) ? sourceMusters[0] : null;
  const isParticipant = matchPlayers.some((player) => String(player.player_code_hash || "") === identity.codeHash);
  const isMusterCreator = cleanText(sourceMuster?.creator_code_hash, 64) === identity.codeHash;
  if (!isParticipant && !isMusterCreator && !hasRole(identity.role, ["reviewer", "admin"])) {
    return { error: { message: "只有召集者、本房间成员、审核员或馆主可以开启战斗房间" } };
  }
  const hostCodeHash = cleanText(sourceMuster?.creator_code_hash, 64) || identity.codeHash;
  const hostName = cleanText(sourceMuster?.creator_name, 40) || identity.displayName;

  const { data: battleRoom, error: createError } = await supabase
    .from("battle_rooms")
    .insert({
      source_match_room_id: matchRoomId,
      dungeon_id: matchRoom.dungeon_id,
      host_code_hash: hostCodeHash,
      host_name: hostName,
      room_status: "active",
      current_round: 1,
    })
    .select("id")
    .single();
  if (createError?.code === "23505") return getBattleRoomByMatchRoom(supabase, matchRoomId, identity);
  if (createError) return { error: createError };

  const playerHashes = matchPlayers.map((player) => String(player.player_code_hash || "")).filter(Boolean);
  const { data: profiles, error: profileError } = playerHashes.length
    ? await supabase
      .from("player_profiles")
      .select("invite_code_hash, display_name, faith_god, profession, ascension_score")
      .in("invite_code_hash", playerHashes)
    : { data: [], error: null };
  if (profileError) return { error: profileError };

  const profileByHash = new Map((profiles || []).map((profile) => [String(profile.invite_code_hash || ""), profile]));
  const battlePlayers = [];
  for (let index = 0; index < matchPlayers.length; index += 1) {
    const player = matchPlayers[index];
    const hash = String(player.player_code_hash || "");
    const profile = profileByHash.get(hash) as Record<string, unknown> | undefined;
    const playerName = cleanText(profile?.display_name || player.player_name, 40) || "未命名信徒";
    const faithGod = cleanText(profile?.faith_god, 20);
    const profession = cleanText(profile?.profession, 40);
    const ascensionScore = cleanScore(profile?.ascension_score) || defaultAscensionScore;
    const maxHp = getBattleMaxHp(faithGod, profession, ascensionScore);
    const abilitiesResult = await buildBattleAbilities(supabase, hash, profession);
    if (abilitiesResult.error) return { error: abilitiesResult.error };
    battlePlayers.push({
      battle_room_id: battleRoom.id,
      player_code_hash: hash,
      player_name: playerName,
      faith_god: faithGod,
      profession,
      class_name: getBattleClassName(profession),
      ascension_score: ascensionScore,
      max_hp: maxHp,
      current_hp: maxHp,
      shield: 0,
      abilities: abilitiesResult.data || [],
      is_defeated: false,
      seat_order: index + 1,
    });
  }

  const { error: playerInsertError } = await supabase.from("battle_room_players").insert(battlePlayers);
  if (playerInsertError) return { error: playerInsertError };

  await supabase.from("battle_room_logs").insert({
    battle_room_id: battleRoom.id,
    actor_code_hash: hostCodeHash,
    actor_name: hostName,
    action_type: "create",
    note: "从网站组队房间开启神域战场",
    round_no: 1,
  });

  return getBattleRoomState(supabase, String(battleRoom.id), identity);
}

export async function createBattleRoomFromDungeon(
  supabase: SupabaseClientAny,
  dungeonId: string,
  identity: InviteIdentity,
): Promise<BattleActionResult> {
  const { data: existing, error: existingError } = await supabase
    .from("battle_rooms")
    .select("id")
    .eq("dungeon_id", dungeonId)
    .eq("host_code_hash", identity.codeHash)
    .eq("room_status", "active")
    .order("created_at", { ascending: false })
    .maybeSingle();
  if (existingError) return { error: existingError };
  if (existing?.id) return getBattleRoomState(supabase, String(existing.id), identity);

  const { data: dungeon, error: dungeonError } = await supabase
    .from("dungeons")
    .select("id, name, participant_count")
    .eq("id", dungeonId)
    .maybeSingle();
  if (dungeonError) return { error: dungeonError };
  if (!dungeon) return { error: { message: "副本不存在" } };

  const { data: battleRoom, error: createError } = await supabase
    .from("battle_rooms")
    .insert({
      source_match_room_id: null,
      dungeon_id: dungeonId,
      host_code_hash: identity.codeHash,
      host_name: identity.displayName,
      room_status: "active",
      current_round: 1,
    })
    .select("id")
    .single();
  if (createError) return { error: createError };

  const battlePlayer = await buildBattlePlayerSnapshot(supabase, String(battleRoom.id), identity, 1);
  if (battlePlayer.error) return { error: battlePlayer.error };
  const { error: playerInsertError } = await supabase.from("battle_room_players").insert(battlePlayer.data);
  if (playerInsertError) return { error: playerInsertError };

  await supabase.from("battle_room_logs").insert({
    battle_room_id: battleRoom.id,
    actor_code_hash: identity.codeHash,
    actor_name: identity.displayName,
    action_type: "create",
    note: `从网站进入神域战场：${cleanText(dungeon.name, 40) || "未命名试炼"}`,
    round_no: 1,
  });

  return getBattleRoomState(supabase, String(battleRoom.id), identity);
}

export async function joinBattleRoom(
  supabase: SupabaseClientAny,
  battleRoomId: string,
  identity: InviteIdentity,
): Promise<BattleActionResult> {
  const state = await getBattleRoomState(supabase, battleRoomId, identity);
  if (state.error) return state;
  if (!state.data?.room || state.data.room.room_status !== "active") {
    return { error: { message: "战场已结束，不能再加入" } };
  }

  const existing = (state.data.players as Record<string, unknown>[]).find((player) => String(player.player_code_hash || "") === identity.codeHash);
  if (existing) return state;

  const seatOrder = (state.data.players as Record<string, unknown>[]).length + 1;
  const battlePlayer = await buildBattlePlayerSnapshot(supabase, battleRoomId, identity, seatOrder);
  if (battlePlayer.error) return { error: battlePlayer.error };
  const { error: playerInsertError } = await supabase.from("battle_room_players").insert(battlePlayer.data);
  if (playerInsertError) return { error: playerInsertError };

  await supabase.from("battle_room_logs").insert({
    battle_room_id: battleRoomId,
    actor_code_hash: identity.codeHash,
    actor_name: identity.displayName,
    action_type: "note",
    note: "进入神域战场",
    round_no: Number((state.data.room as Record<string, unknown>).current_round || 1),
  });
  return getBattleRoomState(supabase, battleRoomId, identity);
}

export async function updateBattleRoomRound(
  supabase: SupabaseClientAny,
  battleRoomId: string,
  identity: InviteIdentity,
  nextRoundInput: unknown,
  noteInput: unknown,
): Promise<BattleActionResult> {
  const state = await getBattleRoomState(supabase, battleRoomId, identity);
  if (state.error) return state;
  if (!state.data?.canOperate) return { error: { message: "只有主持人、审核员或馆主可以调整战斗房间" } };

  const currentRound = Number((state.data.room as Record<string, unknown>).current_round || 1);
  const nextRound = Math.max(1, Math.min(999, Math.round(Number(nextRoundInput) || currentRound)));
  const note = cleanText(noteInput, 800);
  const { error: updateError } = await supabase
    .from("battle_rooms")
    .update({ current_round: nextRound, note, updated_at: new Date().toISOString() })
    .eq("id", battleRoomId);
  if (updateError) return { error: updateError };

  await supabase.from("battle_room_logs").insert({
    battle_room_id: battleRoomId,
    actor_code_hash: identity.codeHash,
    actor_name: identity.displayName,
    action_type: "round",
    note: `调整至第 ${nextRound} 回合${note ? `：${note}` : ""}`,
    round_no: nextRound,
  });
  return getBattleRoomState(supabase, battleRoomId, identity);
}

export async function applyBattlePlayerAction(
  supabase: SupabaseClientAny,
  battleRoomId: string,
  playerId: number,
  identity: InviteIdentity,
  actionType: string,
  amountInput: unknown,
  noteInput: unknown,
): Promise<BattleActionResult> {
  const state = await getBattleRoomState(supabase, battleRoomId, identity);
  if (state.error) return state;
  if (!state.data?.canOperate) return { error: { message: "只有主持人、审核员或馆主可以操作战斗房间" } };

  const player = (state.data.players as Record<string, unknown>[]).find((item) => Number(item.id) === playerId);
  if (!player) return { error: { message: "战斗成员不存在" } };

  const amount = cleanBattleAmount(amountInput);
  const note = cleanText(noteInput, 500);
  const currentHp = Math.max(0, Math.round(Number(player.current_hp || 0)));
  const maxHp = Math.max(1, Math.round(Number(player.max_hp || 1)));
  const shield = Math.max(0, Math.round(Number(player.shield || 0)));
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let logAmount: number | null = amount;
  let logType = actionType;
  let logNote = note;

  if (actionType === "damage") {
    const damage = Math.max(0, amount);
    const absorbed = Math.min(shield, damage);
    const hpDamage = Math.max(0, damage - absorbed);
    const nextHp = Math.max(0, currentHp - hpDamage);
    update.shield = shield - absorbed;
    update.current_hp = nextHp;
    update.is_defeated = nextHp <= 0;
    logNote = `${note || "伤害结算"}${absorbed ? `；护盾抵消 ${absorbed}` : ""}`;
  } else if (actionType === "heal") {
    const heal = Math.max(0, amount);
    update.current_hp = Math.min(9999, currentHp + heal);
    update.is_defeated = false;
  } else if (actionType === "shield") {
    const shieldGain = Math.max(0, amount);
    update.shield = Math.min(9999, shield + shieldGain);
  } else if (actionType === "set_hp") {
    update.current_hp = Math.max(0, Math.min(9999, amount));
    update.is_defeated = Number(update.current_hp) <= 0;
  } else if (actionType === "revive") {
    update.current_hp = Math.max(1, Math.min(9999, amount || 1));
    update.is_defeated = false;
  } else if (actionType === "defeat") {
    update.current_hp = 0;
    update.is_defeated = true;
    logAmount = null;
  } else if (actionType === "note") {
    update.note = note;
    logAmount = null;
  } else {
    return { error: { message: "战斗操作不正确" } };
  }

  const { error: updateError } = await supabase
    .from("battle_room_players")
    .update(update)
    .eq("id", playerId)
    .eq("battle_room_id", battleRoomId);
  if (updateError) return { error: updateError };

  await supabase.from("battle_room_logs").insert({
    battle_room_id: battleRoomId,
    actor_code_hash: identity.codeHash,
    actor_name: identity.displayName,
    action_type: logType,
    target_player_id: playerId,
    target_player_name: cleanText(player.player_name, 40),
    amount: logAmount,
    note: logNote,
    round_no: Number((state.data.room as Record<string, unknown>).current_round || 1),
  });
  return getBattleRoomState(supabase, battleRoomId, identity);
}

export async function submitBattleRoomAction(
  supabase: SupabaseClientAny,
  battleRoomId: string,
  playerId: number,
  identity: InviteIdentity,
  actionTextInput: unknown,
  abilityKeyInput: unknown,
): Promise<BattleActionResult> {
  const state = await getBattleRoomState(supabase, battleRoomId, identity);
  if (state.error) return state;
  if (!state.data?.canSubmitAction) return { error: { message: "你还不是这个战斗房间的成员" } };

  const player = (state.data.players as Record<string, unknown>[]).find((item) => Number(item.id) === playerId);
  if (!player || !player.is_self) return { error: { message: "只能提交自己的战斗行动" } };

  const actionText = cleanText(actionTextInput, 1200);
  const abilityKey = cleanText(abilityKeyInput, 160);
  if (!actionText) return { error: { message: "请先写下本回合行动" } };

  const currentRound = Number((state.data.room as Record<string, unknown>).current_round || 1);
  const abilities = Array.isArray(player.abilities) ? player.abilities as Record<string, unknown>[] : [];
  const ability = abilityKey ? abilities.find((item) => String(item.key || "") === abilityKey) : null;
  if (abilityKey && !ability) return { error: { message: "这个技能或天赋不属于你的战斗面板" } };
  if (ability && Number(ability.availableRound || 1) > currentRound) {
    return { error: { message: `该能力将在第 ${Number(ability.availableRound)} 回合可用` } };
  }

  const { error: insertError } = await supabase.from("battle_room_actions").insert({
    battle_room_id: battleRoomId,
    battle_room_player_id: playerId,
    actor_code_hash: identity.codeHash,
    actor_name: identity.displayName,
    round_no: currentRound,
    action_text: actionText,
    action_status: "submitted",
    ability_key: abilityKey,
    cooldown_until_round: null,
    dm_note: "",
  });
  if (insertError) return { error: insertError };
  return getBattleRoomState(supabase, battleRoomId, identity);
}

export async function resolveBattleRoomAction(
  supabase: SupabaseClientAny,
  battleRoomId: string,
  actionId: number,
  identity: InviteIdentity,
  decisionInput: unknown,
  dmNoteInput: unknown,
): Promise<BattleActionResult> {
  const state = await getBattleRoomState(supabase, battleRoomId, identity);
  if (state.error) return state;
  if (!state.data?.canOperate) return { error: { message: "只有 DM、审核员或馆主可以结算行动" } };

  const { data: action, error: actionError } = await supabase
    .from("battle_room_actions")
    .select("id, battle_room_player_id, round_no, action_status, ability_key")
    .eq("id", actionId)
    .eq("battle_room_id", battleRoomId)
    .maybeSingle();
  if (actionError) return { error: actionError };
  if (!action) return { error: { message: "行动不存在" } };
  if (String(action.action_status || "") !== "submitted") return { error: { message: "这条行动已经处理过了" } };

  const decision = cleanText(decisionInput, 20) === "dismissed" ? "dismissed" : "resolved";
  const dmNote = cleanText(dmNoteInput, 800);
  const currentRound = Number((state.data.room as Record<string, unknown>).current_round || 1);
  let cooldownUntilRound: number | null = null;

  if (decision === "resolved" && cleanText(action.ability_key, 160)) {
    const player = (state.data.players as Record<string, unknown>[]).find((item) => Number(item.id) === Number(action.battle_room_player_id));
    if (!player) return { error: { message: "行动对应的战斗成员不存在" } };
    const abilities = Array.isArray(player.abilities) ? [...player.abilities] as Record<string, unknown>[] : [];
    const abilityIndex = abilities.findIndex((item) => String(item.key || "") === String(action.ability_key || ""));
    if (abilityIndex < 0) return { error: { message: "行动对应的能力不存在" } };
    const ability = { ...abilities[abilityIndex] };
    const availableRound = Number(ability.availableRound || 1);
    if (availableRound > currentRound) return { error: { message: `该能力要到第 ${availableRound} 回合才能结算` } };
    const cooldownRounds = Math.max(0, Math.min(99, Number(ability.cooldownRounds || 0)));
    cooldownUntilRound = cooldownRounds > 0 ? currentRound + cooldownRounds : null;
    ability.availableRound = cooldownUntilRound || currentRound;
    abilities[abilityIndex] = ability;
    const { error: abilityUpdateError } = await supabase
      .from("battle_room_players")
      .update({ abilities, updated_at: new Date().toISOString() })
      .eq("id", action.battle_room_player_id)
      .eq("battle_room_id", battleRoomId);
    if (abilityUpdateError) return { error: abilityUpdateError };
  }

  const { error: updateError } = await supabase
    .from("battle_room_actions")
    .update({
      action_status: decision,
      cooldown_until_round: cooldownUntilRound,
      dm_note: dmNote,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", actionId)
    .eq("battle_room_id", battleRoomId)
    .eq("action_status", "submitted");
  if (updateError) return { error: updateError };
  return getBattleRoomState(supabase, battleRoomId, identity);
}

export async function updateBattlePlayerTeam(
  supabase: SupabaseClientAny,
  battleRoomId: string,
  playerId: number,
  identity: InviteIdentity,
  teamNameInput: unknown,
): Promise<BattleActionResult> {
  const state = await getBattleRoomState(supabase, battleRoomId, identity);
  if (state.error) return state;
  if (!state.data?.canOperate) return { error: { message: "只有 DM、审核员或馆主可以分配队伍" } };
  const teamName = cleanText(teamNameInput, 20) || "观众";
  const { error } = await supabase
    .from("battle_room_players")
    .update({ team_name: teamName, updated_at: new Date().toISOString() })
    .eq("id", playerId)
    .eq("battle_room_id", battleRoomId);
  if (error) return { error };
  return getBattleRoomState(supabase, battleRoomId, identity);
}

export async function updateBattleAbilityCooldown(
  supabase: SupabaseClientAny,
  battleRoomId: string,
  playerId: number,
  identity: InviteIdentity,
  abilityKeyInput: unknown,
): Promise<BattleActionResult> {
  const state = await getBattleRoomState(supabase, battleRoomId, identity);
  if (state.error) return state;
  if (!state.data?.canOperate) return { error: { message: "只有 DM、审核员或馆主可以调整能力冷却" } };

  const player = (state.data.players as Record<string, unknown>[]).find((item) => Number(item.id) === playerId);
  if (!player) return { error: { message: "战斗成员不存在" } };

  const abilityKey = cleanText(abilityKeyInput, 160);
  if (!abilityKey) return { error: { message: "能力标记不正确" } };

  const abilities = Array.isArray(player.abilities) ? [...player.abilities] as Record<string, unknown>[] : [];
  const abilityIndex = abilities.findIndex((item) => String(item.key || "") === abilityKey);
  if (abilityIndex < 0) return { error: { message: "这个能力不在该玩家战斗面板中" } };

  const currentRound = Number((state.data.room as Record<string, unknown>).current_round || 1);
  const ability = { ...abilities[abilityIndex] };
  const cooldownRounds = Math.max(0, Math.min(99, Number(ability.cooldownRounds || 0)));
  const cooldownUntilRound = cooldownRounds > 0 ? currentRound + cooldownRounds : currentRound;
  ability.availableRound = cooldownUntilRound;
  abilities[abilityIndex] = ability;

  const { error: updateError } = await supabase
    .from("battle_room_players")
    .update({ abilities, updated_at: new Date().toISOString() })
    .eq("id", playerId)
    .eq("battle_room_id", battleRoomId);
  if (updateError) return { error: updateError };

  await supabase.from("battle_room_logs").insert({
    battle_room_id: battleRoomId,
    actor_code_hash: identity.codeHash,
    actor_name: identity.displayName,
    action_type: "cooldown",
    target_player_id: playerId,
    target_player_name: cleanText(player.player_name, 40),
    amount: cooldownRounds,
    note: `${cleanText(ability.name, 80) || "能力"} 进入冷却，至第 ${cooldownUntilRound} 回合可用`,
    round_no: currentRound,
  });

  return getBattleRoomState(supabase, battleRoomId, identity);
}

export async function addBattlePlayerStatus(
  supabase: SupabaseClientAny,
  battleRoomId: string,
  playerId: number,
  identity: InviteIdentity,
  statusNameInput: unknown,
  stackCountInput: unknown,
  isPublicInput: unknown,
): Promise<BattleActionResult> {
  const state = await getBattleRoomState(supabase, battleRoomId, identity);
  if (state.error) return state;
  if (!state.data?.canOperate) return { error: { message: "只有 DM、审核员或馆主可以添加状态" } };
  if (String((state.data.room as Record<string, unknown>).room_status || "") !== "active") return { error: { message: "战斗房间已结束，不能添加状态" } };
  const player = (state.data.players as Record<string, unknown>[]).find((item) => Number(item.id) === playerId);
  if (!player) return { error: { message: "战斗成员不存在" } };

  const statusName = cleanText(statusNameInput, 40);
  if (!statusName) return { error: { message: "请填写状态名" } };
  const stackCount = Math.max(0, Math.min(999, Math.round(Number(stackCountInput) || 0)));
  const isPublic = isPublicInput === true;

  const { error } = await supabase.from("battle_room_player_statuses").insert({
    battle_room_id: battleRoomId,
    battle_room_player_id: playerId,
    status_name: statusName,
    stack_count: stackCount,
    is_public: isPublic,
    created_by_hash: identity.codeHash,
    created_by_name: identity.displayName,
  });
  if (error) return { error };

  await supabase.from("battle_room_logs").insert({
    battle_room_id: battleRoomId,
    actor_code_hash: identity.codeHash,
    actor_name: identity.displayName,
    action_type: "note",
    target_player_id: playerId,
    target_player_name: cleanText(player.player_name, 40),
    note: `添加状态：${statusName} ${stackCount}层${isPublic ? "（公开）" : "（DM可见）"}`,
    round_no: Number((state.data.room as Record<string, unknown>).current_round || 1),
  });
  return getBattleRoomState(supabase, battleRoomId, identity);
}

export async function updateBattlePlayerStatus(
  supabase: SupabaseClientAny,
  battleRoomId: string,
  statusId: number,
  identity: InviteIdentity,
  stackCountInput: unknown,
  isPublicInput: unknown,
): Promise<BattleActionResult> {
  const state = await getBattleRoomState(supabase, battleRoomId, identity);
  if (state.error) return state;
  if (!state.data?.canOperate) return { error: { message: "只有 DM、审核员或馆主可以调整状态" } };
  if (String((state.data.room as Record<string, unknown>).room_status || "") !== "active") return { error: { message: "战斗房间已结束，不能调整状态" } };

  const stackCount = Math.max(0, Math.min(999, Math.round(Number(stackCountInput) || 0)));
  const update: Record<string, unknown> = {
    stack_count: stackCount,
    updated_at: new Date().toISOString(),
  };
  if (isPublicInput === true || isPublicInput === false) update.is_public = isPublicInput === true;

  const { error } = await supabase
    .from("battle_room_player_statuses")
    .update(update)
    .eq("id", statusId)
    .eq("battle_room_id", battleRoomId);
  if (error) return { error };
  return getBattleRoomState(supabase, battleRoomId, identity);
}

export async function deleteBattlePlayerStatus(
  supabase: SupabaseClientAny,
  battleRoomId: string,
  statusId: number,
  identity: InviteIdentity,
): Promise<BattleActionResult> {
  const state = await getBattleRoomState(supabase, battleRoomId, identity);
  if (state.error) return state;
  if (!state.data?.canOperate) return { error: { message: "只有 DM、审核员或馆主可以删除状态" } };
  if (String((state.data.room as Record<string, unknown>).room_status || "") !== "active") return { error: { message: "战斗房间已结束，不能删除状态" } };

  const { error } = await supabase
    .from("battle_room_player_statuses")
    .delete()
    .eq("id", statusId)
    .eq("battle_room_id", battleRoomId);
  if (error) return { error };
  return getBattleRoomState(supabase, battleRoomId, identity);
}

export async function finishBattleRoom(
  supabase: SupabaseClientAny,
  battleRoomId: string,
  identity: InviteIdentity,
  statusInput: unknown,
  noteInput: unknown,
): Promise<BattleActionResult> {
  const state = await getBattleRoomState(supabase, battleRoomId, identity);
  if (state.error) return state;
  if (!state.data?.canOperate) return { error: { message: "只有主持人、审核员或馆主可以结束战斗房间" } };
  const nextStatus = cleanText(statusInput, 20) === "cancelled" ? "cancelled" : "finished";
  const note = cleanText(noteInput, 800);
  const { error: updateError } = await supabase
    .from("battle_rooms")
    .update({ room_status: nextStatus, note, finished_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", battleRoomId);
  if (updateError) return { error: updateError };

  await supabase.from("battle_room_logs").insert({
    battle_room_id: battleRoomId,
    actor_code_hash: identity.codeHash,
    actor_name: identity.displayName,
    action_type: nextStatus === "cancelled" ? "cancel" : "finish",
    note: note || (nextStatus === "cancelled" ? "取消战斗房间" : "结束战斗房间"),
    round_no: Number((state.data.room as Record<string, unknown>).current_round || 1),
  });
  return getBattleRoomState(supabase, battleRoomId, identity);
}

export async function extendBattleRoom(
  supabase: SupabaseClientAny,
  battleRoomId: string,
  identity: InviteIdentity,
): Promise<BattleActionResult> {
  const state = await getBattleRoomState(supabase, battleRoomId, identity);
  if (state.error) return state;
  if (!state.data?.canOperate) return { error: { message: "只有主持人、审核员或馆主可以延长战斗房间" } };
  const room = state.data.room as Record<string, unknown>;
  if (String(room.room_status || "") !== "active") return { error: { message: "战斗房间已结束，不能延长" } };

  const currentExpiresAt = new Date(getBattleRoomExpiresAt(room)).getTime();
  const baseTime = Math.max(Date.now(), Number.isFinite(currentExpiresAt) ? currentExpiresAt : Date.now());
  const nextExpiresAt = new Date(baseTime + battleRoomLifetimeMs).toISOString();
  const { error: updateError } = await supabase
    .from("battle_rooms")
    .update({ expires_at: nextExpiresAt, updated_at: new Date().toISOString() })
    .eq("id", battleRoomId)
    .eq("room_status", "active");
  if (updateError) {
    if (isMissingBattleRoomExpiresColumn(updateError)) {
      return { error: { message: "战斗房间缺少 expires_at 列，请先运行 supabase/current/battle_room_lifecycle_hotfix_20260822.sql" } };
    }
    return { error: updateError };
  }

  await supabase.from("battle_room_logs").insert({
    battle_room_id: battleRoomId,
    actor_code_hash: identity.codeHash,
    actor_name: identity.displayName,
    action_type: "note",
    note: "战斗房间已延长6小时",
    round_no: Number(room.current_round || 1),
  });
  return getBattleRoomState(supabase, battleRoomId, identity);
}

export function normalizeRelatedBattleRoom(value: unknown) {
  const room = Array.isArray(value) ? value[0] : value;
  if (!room || typeof room !== "object") return null;
  return room as Record<string, unknown>;
}

export async function getMyBattleOverview(
  supabase: SupabaseClientAny,
  identity: InviteIdentity,
): Promise<BattleActionResult> {
  const expireResult = await expireStaleBattleRooms(supabase);
  if (expireResult.error) return expireResult;

  const { data: playerRooms, error: playerRoomError } = await supabase
    .from("battle_room_players")
    .select(`
      battle_room_id,
      updated_at,
      battle_rooms (
        *,
        dungeons (
          id,
          name,
          creator,
          difficulty,
          type
        )
      )
    `)
    .eq("player_code_hash", identity.codeHash)
    .order("updated_at", { ascending: false })
    .limit(8);
  if (playerRoomError) return { error: playerRoomError };

  const participantBattleRooms = (playerRooms || [])
    .map((item) => normalizeRelatedBattleRoom(item.battle_rooms))
    .filter((room): room is Record<string, unknown> => !!room);

  const { data: hostRooms, error: hostRoomError } = await supabase
    .from("battle_rooms")
    .select(`
      *,
      dungeons (
        id,
        name,
        creator,
        difficulty,
        type
      )
    `)
    .eq("host_code_hash", identity.codeHash)
    .order("updated_at", { ascending: false })
    .limit(8);
  if (hostRoomError) return { error: hostRoomError };

  const battleById = new Map<string, Record<string, unknown>>();
  [...((hostRooms || []) as Record<string, unknown>[]), ...participantBattleRooms].forEach((room) => {
    battleById.set(String(room.id), {
      ...room,
      expiresAt: getBattleRoomExpiresAt(room),
    });
  });
  const battleRooms = [...battleById.values()]
    .sort((a, b) => new Date(String(b.updated_at || b.created_at || "")).getTime() - new Date(String(a.updated_at || a.created_at || "")).getTime());
  const lastBattleRoom = battleRooms[0] || null;

  const { data: musters, error: musterError } = await supabase
    .from("match_musters")
    .select(`
      id,
      dungeon_id,
      creator_name,
      status,
      target_player_count,
      closes_at,
      room_id,
      created_at,
      drawn_at,
      dungeons (
        id,
        name,
        creator,
        difficulty,
        type
      )
    `)
    .in("status", ["open", "drawn"])
    .order("created_at", { ascending: false })
    .limit(20);
  if (musterError) return { error: musterError };

  return {
    data: {
      lastBattleRoom: lastBattleRoom ? {
        ...lastBattleRoom,
        expiresAt: getBattleRoomExpiresAt(lastBattleRoom),
      } : null,
      battleRooms: battleRooms.slice(0, 8),
      activeMusters: musters || [],
    },
  };
}

export async function commitScoreSettlement(
  supabase: SupabaseClientAny,
  identity: InviteIdentity,
  sourceType: "batch" | "single",
  dungeonNameInput: unknown,
  entries: { nick: string; deng: number; jin: number; total: number; line: number; raw: string }[],
  options: { rawText?: string; remark?: string; confirmClear?: boolean; clearStatuses?: unknown; dungeonId?: unknown; settlementRequestId?: unknown } = {},
) {
  const rawText = cleanText(options.rawText ?? "", 20000);
  const remark = cleanText(options.remark ?? "", 500);
  const hasClearStatusPayload = !!options.clearStatuses && typeof options.clearStatuses === "object" && !Array.isArray(options.clearStatuses);
  const clientRequestId = cleanRequestKey(options.settlementRequestId);
  const dungeonResult = await resolveSettlementDungeon(supabase, options.dungeonId, dungeonNameInput);
  if (dungeonResult.error) return { error: dungeonResult.error };
  const dungeon = dungeonResult.data;
  const dungeonName = cleanText(dungeon.name, 80);

  const preview = await buildScorePreview(supabase, entries, []);
  if (preview.error) return { error: preview.error };
  if (!preview.data?.valid) return { error: { message: "预校验未通过", preview: preview.data } };
  const settlementEntries = Array.isArray(preview.data?.allList)
    ? preview.data.allList as { nick: string; deng: number; jin: number; total: number; line: number; raw: string }[]
    : entries;
  const confirmClear = !!options.confirmClear || hasClearStatusPayload;
  const clearStatuses = buildSettlementClearStatusMap(settlementEntries, options.clearStatuses, !!options.confirmClear);

  const profileResult = await getProfilesByNames(supabase, settlementEntries.map((entry) => entry.nick));
  if (profileResult.error) return { error: profileResult.error };
  const profiles = profileResult.profiles || new Map<string, Record<string, unknown>>();
  const totalDeng = settlementEntries.reduce((sum, entry) => sum + entry.deng, 0);
  const totalJin = settlementEntries.reduce((sum, entry) => sum + entry.jin, 0);

  const { data: settlement, error: settlementError } = await supabase
    .from("score_settlements")
    .insert({
      dungeon_name: dungeonName,
      source_type: sourceType,
      operator_code_hash: identity.codeHash,
      operator_name: identity.displayName,
      raw_text: rawText,
      remark,
      total_players: settlementEntries.length,
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

  const entryRows = settlementEntries.map((entry) => {
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

  for (const entry of settlementEntries) {
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

  const logRows = settlementEntries.map((entry) => {
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
    ? await confirmClearRecordsFromSettlement(supabase, dungeon, settlementEntries, profiles, identity.displayName, clearStatuses)
    : { confirmed: 0 };
  if ((clearResult as any).error) return { error: (clearResult as any).error };

  const messageRows = settlementEntries.map((entry) => {
    const profile = profiles.get(entry.nick) || {};
    const typeName = sourceType === "single" ? "漏分补发" : "批量结算";
    const clearStatus = clearStatuses.get(entry.nick) || "unknown";
    const clearText = confirmClear ? `\n本车结果：${getClearStatusLabel(clearStatus)}${clearStatus === "passed" ? "（已登记通关）" : ""}` : "";
    const content = `【${typeName}｜副本：${dungeonName}】\n审核员：${identity.displayName}\n登神之路：${entry.deng >= 0 ? "+" : ""}${entry.deng}\n觐见之梯：${entry.jin >= 0 ? "+" : ""}${entry.jin}\n本次总变化：${entry.total >= 0 ? "+" : ""}${entry.total}${clearText}${remark ? `\n备注：${remark}` : ""}`;
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

export async function getScoreSettlementResultByRequestId(
  supabase: SupabaseClientAny,
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

export type AdminTalentRow = {
  id: number;
  pool_key: string;
  talent_id: number;
  talent_name: string;
  rank: string;
  acquired_from: string;
  storage_slot: number | null;
  equipped_slot: number | null;
  acquired_at: string;
};

export function findTalentOpenStorageSlots(talents: AdminTalentRow[]) {
  const used = new Set(talents.map((item) => Number(item.storage_slot)).filter((slot) => slot >= 1 && slot <= inventorySlotLimit));
  const slots: number[] = [];
  for (let slot = 1; slot <= inventorySlotLimit; slot += 1) {
    if (!used.has(slot)) slots.push(slot);
  }
  return slots;
}

export function summarizeAdminTalentAnomalies(
  profile: Record<string, unknown>,
  talents: AdminTalentRow[],
  overflowChoices: Record<string, unknown>[],
) {
  const invalidStorage = talents.filter((item) => item.storage_slot !== null && !cleanSlot(item.storage_slot, inventorySlotLimit));
  const invalidEquipped = talents.filter((item) => item.equipped_slot !== null && !cleanSlot(item.equipped_slot, equippedSlotLimit));
  const dualPlaced = talents.filter((item) => item.storage_slot !== null && item.equipped_slot !== null);
  const unplaced = talents.filter((item) => item.storage_slot === null && item.equipped_slot === null);
  const storageSlots = new Map<number, number>();
  const equippedSlots = new Map<number, number>();
  const ownedKeys = new Set<string>();
  const duplicateOwnedIds: number[] = [];
  for (const talent of talents) {
    const storageSlot = Number(talent.storage_slot || 0);
    const equippedSlot = Number(talent.equipped_slot || 0);
    if (storageSlot) storageSlots.set(storageSlot, (storageSlots.get(storageSlot) || 0) + 1);
    if (equippedSlot) equippedSlots.set(equippedSlot, (equippedSlots.get(equippedSlot) || 0) + 1);
    const key = getTalentKey(talent.pool_key, talent.talent_id);
    if (ownedKeys.has(key)) duplicateOwnedIds.push(talent.id);
    ownedKeys.add(key);
  }
  const duplicateOverflowIds = overflowChoices
    .filter((choice) => ownedKeys.has(getTalentKey(choice.pool_key, choice.talent_id)))
    .map((choice) => Number(choice.id))
    .filter(Boolean);
  const activeEquippedLimit = getTalentSlotLimit(profile.ascension_score);
  const equippedTalents = talents.filter((item) => item.equipped_slot !== null);
  const equippedRanksValid = canEquipTalentRanks(equippedTalents.map((item) => item.rank), getTalentRankAllowance(profile.ascension_score));
  const messages: string[] = [];
  if (unplaced.length) messages.push(`${unplaced.length} 个孤立天赋未分配仓库或携带槽`);
  if (dualPlaced.length) messages.push(`${dualPlaced.length} 个天赋同时占用仓库和携带槽`);
  if (invalidStorage.length || invalidEquipped.length) messages.push(`${invalidStorage.length + invalidEquipped.length} 个天赋槽位超出规则范围`);
  if ([...storageSlots.values()].some((count) => count > 1) || [...equippedSlots.values()].some((count) => count > 1)) messages.push("存在重复占用的槽位");
  if (duplicateOwnedIds.length) messages.push(`${duplicateOwnedIds.length} 个重复拥有天赋，需人工确认`);
  if (duplicateOverflowIds.length) messages.push(`${duplicateOverflowIds.length} 个溢出项已在仓库中拥有，可自动清理`);
  if (overflowChoices.length && findTalentOpenStorageSlots(talents).length) messages.push(`${overflowChoices.length} 个溢出项可尝试回填仓库`);
  if (equippedTalents.some((item) => Number(item.equipped_slot) > activeEquippedLimit)) messages.push("存在尚未开启的携带槽");
  if (!equippedRanksValid) messages.push("当前携带品阶超过分数允许范围");
  return {
    hasIssues: messages.length > 0,
    messages,
    autoFixable: {
      unplacedTalentIds: unplaced.map((item) => item.id),
      dualPlacedTalentIds: dualPlaced.map((item) => item.id),
      duplicateOverflowIds,
      overflowChoiceIds: overflowChoices.map((item) => Number(item.id)).filter(Boolean),
    },
  };
}

export async function buildAdminPlayerSnapshot(
  supabase: SupabaseClientAny,
  targetNameInput: unknown,
) {
  const targetName = cleanText(targetNameInput, 40);
  if (!targetName) return { error: { message: "请填写玩家昵称" } };
  const { data: profile, error: profileError } = await supabase
    .from("player_profiles")
    .select("invite_code_hash, display_name, role, faith_god, faith_path, original_faith_god, original_faith_path, profession, ascension_score, audience_score, items, talents, updated_at")
    .eq("display_name", targetName)
    .maybeSingle();
  if (profileError) return { error: profileError };
  if (!profile) return { error: { message: "没有找到这个玩家档案，请确认昵称已保存" } };

  const codeHash = cleanText(profile.invite_code_hash, 64);
  const [titlesResult, cursesResult, talentsResult, overflowResult, fragmentsResult, scoreLogsResult, messagesResult] = await Promise.all([
    supabase.from("profile_titles").select("id, title_text, title_god, title_note, granted_by_type, granted_by_name, granted_at, is_active, revoked_at, revoked_by_name").eq("invite_code_hash", codeHash).order("granted_at", { ascending: false }),
    supabase.from("profile_curses").select("id, curse_text, curse_god, curse_note, curse_type, granted_by_type, granted_by_name, granted_at, is_active, revoked_at, revoked_by_name").eq("invite_code_hash", codeHash).order("granted_at", { ascending: false }),
    supabase.from("owned_talents").select("id, pool_key, talent_id, talent_name, rank, acquired_from, storage_slot, equipped_slot, acquired_at").eq("invite_code_hash", codeHash).order("acquired_at", { ascending: true }),
    supabase.from("talent_overflow_choices").select("id, pool_key, talent_id, talent_name, rank, source, created_at").eq("invite_code_hash", codeHash).order("created_at", { ascending: true }),
    supabase.from("user_fragments").select("fragment_total, updated_at").eq("invite_code_hash", codeHash).maybeSingle(),
    supabase.from("score_change_logs").select("id, player_name, change_deng, change_jin, source_type, settlement_id, operator_name, revoke_remark, created_at").eq("player_code_hash", codeHash).order("created_at", { ascending: false }).limit(20),
    supabase.from("score_messages").select("id, settlement_id, msg_type, content, is_read, created_at").eq("player_code_hash", codeHash).order("created_at", { ascending: false }).limit(10),
  ]);
  const firstError = [titlesResult.error, cursesResult.error, talentsResult.error, overflowResult.error, fragmentsResult.error, scoreLogsResult.error, messagesResult.error].find(Boolean) as LooseError;
  if (firstError) return { error: firstError };
  const talents = (talentsResult.data || []) as AdminTalentRow[];
  const overflowChoices = (overflowResult.data || []) as Record<string, unknown>[];
  const anomalies = summarizeAdminTalentAnomalies(profile as Record<string, unknown>, talents, overflowChoices);
  const operationLogResult = await listAdminOperationLogs(supabase, codeHash, 30);
  if (operationLogResult.error) return { error: operationLogResult.error };
  return {
    data: {
      profile: {
        displayName: cleanText(profile.display_name, 40), role: cleanText(profile.role, 20), faithGod: cleanText(profile.faith_god, 20), faithPath: cleanText(profile.faith_path, 20),
        originalFaithGod: cleanText(profile.original_faith_god, 20), originalFaithPath: cleanText(profile.original_faith_path, 20), profession: cleanText(profile.profession, 40),
        ascensionScore: cleanScore(profile.ascension_score), audienceScore: cleanScore(profile.audience_score), items: cleanText(profile.items, 800), talentsText: cleanText(profile.talents, 800), updatedAt: cleanText(profile.updated_at, 80),
      },
      titles: titlesResult.data || [], curses: cursesResult.data || [], talents, overflowChoices,
      fragments: Number(fragmentsResult.data?.fragment_total || 0), scoreLogs: scoreLogsResult.data || [], recentMessages: messagesResult.data || [],
      operationLogs: operationLogResult.data || [], operationLogsUnavailable: !!operationLogResult.unavailable,
      inventorySlotLimit, equippedSlotLimit: getTalentSlotLimit(profile.ascension_score), anomalies,
    },
  };
}

export async function repairAdminTalentState(
  supabase: SupabaseClientAny,
  targetNameInput: unknown,
) {
  const snapshot = await buildAdminPlayerSnapshot(supabase, targetNameInput);
  if (snapshot.error || !snapshot.data) return snapshot;
  const targetName = snapshot.data.profile.displayName;
  const { data: profile, error: profileError } = await supabase.from("player_profiles").select("invite_code_hash").eq("display_name", targetName).maybeSingle();
  if (profileError || !profile) return { error: profileError || { message: "玩家档案已不存在" } };
  const codeHash = cleanText(profile.invite_code_hash, 64);
  let talents = [...(snapshot.data.talents as AdminTalentRow[])];
  let overflowChoices = [...(snapshot.data.overflowChoices as Record<string, unknown>[])];
  const repaired: string[] = [];
  const unresolved: string[] = [];

  for (const talent of talents.filter((item) => item.storage_slot !== null && item.equipped_slot !== null)) {
    const { error } = await supabase.from("owned_talents").update({ storage_slot: null }).eq("id", talent.id).eq("invite_code_hash", codeHash);
    if (error) return { error };
    talent.storage_slot = null;
    repaired.push(`已修正「${talent.talent_name}」的双重槽位占用`);
  }

  const duplicateOverflowIds = snapshot.data.anomalies.autoFixable.duplicateOverflowIds;
  if (duplicateOverflowIds.length) {
    const { error } = await supabase.from("talent_overflow_choices").delete().eq("invite_code_hash", codeHash).in("id", duplicateOverflowIds);
    if (error) return { error };
    overflowChoices = overflowChoices.filter((choice) => !duplicateOverflowIds.includes(Number(choice.id)));
    repaired.push(`已清理 ${duplicateOverflowIds.length} 个重复溢出项`);
  }

  for (const talent of talents.filter((item) => item.storage_slot === null && item.equipped_slot === null)) {
    const slot = findTalentOpenStorageSlots(talents)[0];
    if (!slot) { unresolved.push(`「${talent.talent_name}」无可用仓库槽位，未自动移动`); continue; }
    const { error } = await supabase.from("owned_talents").update({ storage_slot: slot, equipped_slot: null }).eq("id", talent.id).eq("invite_code_hash", codeHash);
    if (error) return { error };
    talent.storage_slot = slot;
    repaired.push(`已将孤立天赋「${talent.talent_name}」放入仓库 ${slot} 号位`);
  }

  const ownedKeys = new Set(talents.map((item) => getTalentKey(item.pool_key, item.talent_id)));
  for (const choice of [...overflowChoices]) {
    const slot = findTalentOpenStorageSlots(talents)[0];
    if (!slot) break;
    const choiceId = Number(choice.id);
    const choiceKey = getTalentKey(choice.pool_key, choice.talent_id);
    const { data: deletedChoice, error: deleteError } = await supabase.from("talent_overflow_choices").delete().eq("id", choiceId).eq("invite_code_hash", codeHash).select("id").maybeSingle();
    if (deleteError) return { error: deleteError };
    if (!deletedChoice) continue;
    if (ownedKeys.has(choiceKey)) continue;
    const { data: inserted, error: insertError } = await supabase.from("owned_talents").insert({ invite_code_hash: codeHash, pool_key: choice.pool_key, talent_id: choice.talent_id, talent_name: choice.talent_name, rank: choice.rank, acquired_from: choice.source === "exchange" ? "exchange" : "draw", storage_slot: slot, equipped_slot: null }).select("id, pool_key, talent_id, talent_name, rank, acquired_from, storage_slot, equipped_slot, acquired_at").single();
    if (insertError) return { error: insertError };
    talents.push(inserted as AdminTalentRow);
    ownedKeys.add(choiceKey);
    repaired.push(`已将溢出天赋「${cleanText(choice.talent_name, 80)}」回填至仓库 ${slot} 号位`);
  }

  const textResult = await updateProfileTalentText(supabase, codeHash);
  if (textResult.error) return { error: textResult.error };
  const refreshed = await buildAdminPlayerSnapshot(supabase, targetName);
  if (refreshed.error) return refreshed;
  return { data: { repaired, unresolved, snapshot: refreshed.data } };
}

export async function touchInviteActivity(
  supabase: SupabaseClientAny,
  identity: InviteIdentity,
  action: string,
) {
  const { error } = await supabase
    .from("invite_codes")
    .update({ last_seen_at: new Date().toISOString(), last_seen_action: cleanText(action, 80) })
    .eq("code_hash", identity.codeHash);
  if (error && error.code !== "42703") console.error("invite activity update failed", error);
}

export async function getAdminTargetAccount(
  supabase: SupabaseClientAny,
  targetHashInput: unknown,
  targetNameInput: unknown = "",
) {
  const targetHash = cleanText(targetHashInput, 64);
  const targetName = cleanText(targetNameInput, 40);
  if (!targetHash && !targetName) return { error: { message: "请填写目标昵称" } };
  if (targetHash && !/^[a-f0-9]{64}$/i.test(targetHash)) return { error: { message: "目标账号标识不正确" } };
  let query = supabase
    .from("invite_codes")
    .select("id, code_hash, display_name, role, is_active, last_seen_at, last_seen_action");
  query = targetHash ? query.eq("code_hash", targetHash) : query.eq("display_name", targetName);
  const { data, error } = targetHash
    ? await query.maybeSingle()
    : await query.limit(2);
  if (error) return { error };
  if (!targetHash && Array.isArray(data) && data.length > 1) return { error: { message: "这个昵称对应多个账号，请联系馆主处理重名" } };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { error: { message: "没有找到这个账号" } };
  return { data: row as Record<string, unknown> };
}

export async function deleteRowsByHash(
  supabase: SupabaseClientAny,
  table: string,
  column: string,
  codeHash: string,
) {
  const { error } = await supabase.from(table).delete().eq(column, codeHash);
  if (error?.code === "42P01" || error?.code === "42703") return { skipped: true };
  return { error: error || null };
}

export async function cleanupMemberState(
  supabase: SupabaseClientAny,
  codeHash: string,
  mode: "reset" | "delete",
) {
  const deleted: string[] = [];
  const deleteTargets = [
    ["ratings", "invite_code_hash"],
    ["clear_records", "invite_code_hash"],
    ["match_queue", "player_code_hash"],
    ["match_room_players", "player_code_hash"],
    ["match_muster_participants", "player_code_hash"],
    ["match_musters", "creator_code_hash"],
    ["score_messages", "player_code_hash"],
    ["score_change_logs", "player_code_hash"],
    ["score_settlement_entries", "player_code_hash"],
    ["profile_titles", "invite_code_hash"],
    ["profile_curses", "invite_code_hash"],
    ["talent_overflow_choices", "invite_code_hash"],
    ["talent_draw_logs", "invite_code_hash"],
    ["talent_exchange_logs", "invite_code_hash"],
    ["owned_talents", "invite_code_hash"],
    ["talent_pool_counters", "invite_code_hash"],
    ["talent_draw_state", "invite_code_hash"],
    ["user_fragments", "invite_code_hash"],
    ["player_profiles", "invite_code_hash"],
  ];

  const { error: commentError } = await supabase
    .from("comments")
    .update({ is_deleted: true, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString(), content: "此用户数据已由馆主清理" })
    .eq("invite_code_hash", codeHash);
  if (commentError && commentError.code !== "42P01" && commentError.code !== "42703") return { error: commentError };
  if (!commentError) deleted.push("comments");

  const { error: grantedTitleError } = await supabase.from("profile_titles").delete().eq("granted_by_hash", codeHash);
  if (grantedTitleError && grantedTitleError.code !== "42P01" && grantedTitleError.code !== "42703") return { error: grantedTitleError };
  const { error: grantedCurseError } = await supabase.from("profile_curses").delete().eq("granted_by_hash", codeHash);
  if (grantedCurseError && grantedCurseError.code !== "42P01" && grantedCurseError.code !== "42703") return { error: grantedCurseError };

  for (const [table, column] of deleteTargets) {
    const result = await deleteRowsByHash(supabase, table, column, codeHash);
    if (result.error) return result;
    if (!result.skipped) deleted.push(table);
  }

  const invitePatch: Record<string, unknown> = {
    last_seen_at: null,
    last_seen_action: mode,
  };
  if (mode === "delete") {
    invitePatch.is_active = false;
    invitePatch.display_name = `deleted-${codeHash.slice(0, 12)}`;
  }
  const { error: inviteError } = await supabase.from("invite_codes").update(invitePatch).eq("code_hash", codeHash);
  if (inviteError) return { error: inviteError };
  return { data: { deleted } };
}

export async function listAdminMembers(supabase: SupabaseClientAny) {
  const { data: invites, error: inviteError } = await supabase
    .from("invite_codes")
    .select("code_hash, display_name, role, is_active, last_seen_at, last_seen_action")
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .order("display_name", { ascending: true })
    .limit(500);
  if (inviteError?.code === "42703") return { error: { message: "请先运行 admin_member_talent_pool_migration_20260809.sql" } };
  if (inviteError) return { error: inviteError };

  const hashes = (invites || []).map((item: Record<string, unknown>) => cleanText(item.code_hash, 64)).filter(Boolean);
  const profileMap = new Map<string, Record<string, unknown>>();
  if (hashes.length) {
    const chunkSize = 40;
    for (let index = 0; index < hashes.length; index += chunkSize) {
      const chunk = hashes.slice(index, index + chunkSize);
      const profilesResult = await supabase
        .from("player_profiles")
        .select("invite_code_hash, faith_god, profession, ascension_score, audience_score, updated_at")
        .in("invite_code_hash", chunk);
      if (profilesResult.error?.code === "42P01") {
        continue;
      }
      if (profilesResult.error) return { error: profilesResult.error };
      (profilesResult.data || []).forEach((profile: Record<string, unknown>) => {
        profileMap.set(cleanText(profile.invite_code_hash, 64), profile);
      });
    }
  }
  const now = Date.now();
  return {
    data: (invites || []).map((invite: Record<string, unknown>) => {
      const codeHash = cleanText(invite.code_hash, 64);
      const seenAt = cleanText(invite.last_seen_at, 80);
      const seenTime = seenAt ? Date.parse(seenAt) : 0;
      const minutesAgo = seenTime ? Math.max(0, Math.floor((now - seenTime) / 60000)) : null;
      const profile = profileMap.get(codeHash) || {};
      const hasProfile = profileMap.has(codeHash);
      return {
        codeHash,
        displayName: cleanText(invite.display_name, 40),
        role: cleanText(invite.role, 20),
        isActive: invite.is_active !== false,
        hasProfile,
        lastSeenAt: seenAt,
        lastSeenAction: cleanText(invite.last_seen_action, 80),
        minutesAgo,
        status: minutesAgo === null ? "never" : (minutesAgo <= 5 ? "online" : (minutesAgo <= 1440 ? "recent" : "inactive")),
        faithGod: cleanText(profile.faith_god, 20),
        profession: cleanText(profile.profession, 40),
        ascensionScore: cleanScore(profile.ascension_score),
        audienceScore: cleanScore(profile.audience_score),
        profileUpdatedAt: cleanText(profile.updated_at, 80),
      };
    }),
  };
}

export async function listAdminTalentPoolItems(supabase: SupabaseClientAny) {
  const { data, error } = await supabase
    .from("talent_pool_items")
    .select("pool_key, talent_id, talent_name, rank, effect, cooldown, action_cost, is_enabled, admin_note, updated_at")
    .order("pool_key", { ascending: true })
    .order("rank", { ascending: true })
    .order("talent_id", { ascending: true })
    .limit(2000);
  if (error?.code === "42703") return { error: { message: "请先运行 talent_pool_cooldown_batch_20260810.sql" } };
  if (error) return { error };
  const pools = new Map<string, Record<string, unknown>[]>();
  (data || []).forEach((item: Record<string, unknown>) => {
    const poolKey = cleanPoolKey(item.pool_key);
    if (!pools.has(poolKey)) pools.set(poolKey, []);
    pools.get(poolKey)?.push({
      poolKey,
      talentId: cleanTalentId(item.talent_id),
      talentName: cleanText(item.talent_name, 80),
      rank: cleanText(item.rank, 2),
      effect: cleanText(item.effect, 600),
      cooldown: cleanText(item.cooldown, 40),
      actionCost: Math.max(0, Math.min(99, Number(item.action_cost || 0))),
      isEnabled: item.is_enabled !== false,
      adminNote: cleanText(item.admin_note, 300),
      updatedAt: cleanText(item.updated_at, 80),
    });
  });
  return { data: { pools: [...pools.entries()].map(([poolKey, items]) => ({ poolKey, items })) } };
}

export async function listAdminExclusiveTalentWorkbench(supabase: SupabaseClientAny) {
  const [profilesResult, slotsResult, talentsResult, templatesResult] = await Promise.all([
    supabase.from("player_profiles").select("invite_code_hash, display_name, ascension_score, faith_god, profession").order("ascension_score", { ascending: false }).limit(500),
    supabase.from("exclusive_talent_slots").select("invite_code_hash, manual_enabled, enabled_note, enabled_at"),
    supabase.from("exclusive_talents").select("invite_code_hash, talent_name, rank, effect, cooldown, action_cost, admin_note, is_enabled, updated_at"),
    supabase.from("exclusive_talent_templates").select("id, template_name, talent_name, rank, effect, cooldown, action_cost, admin_note, is_enabled, updated_at").order("updated_at", { ascending: false }).limit(200),
  ]);
  const missingError = [profilesResult.error, slotsResult.error, talentsResult.error, templatesResult.error].find((error) => error?.code === "42P01");
  if (missingError) return { error: { message: "请先运行 exclusive_talent_slot_migration_20260914.sql" } };
  const firstError = [profilesResult.error, slotsResult.error, talentsResult.error, templatesResult.error].find(Boolean);
  if (firstError) return { error: firstError };
  const slots = new Map((slotsResult.data || []).map((row: Record<string, unknown>) => [cleanText(row.invite_code_hash, 64), row]));
  const talents = new Map((talentsResult.data || []).map((row: Record<string, unknown>) => [cleanText(row.invite_code_hash, 64), row]));
  const candidates = (profilesResult.data || [])
    .map((profile: Record<string, unknown>) => {
      const codeHash = cleanText(profile.invite_code_hash, 64);
      const slot = slots.get(codeHash) || {};
      const talent = talents.get(codeHash) || {};
      const enabled = cleanScore(profile.ascension_score) >= 2500 || slot.manual_enabled === true;
      return {
        codeHash,
        displayName: cleanText(profile.display_name, 40),
        ascensionScore: cleanScore(profile.ascension_score),
        faithGod: cleanText(profile.faith_god, 20),
        profession: cleanText(profile.profession, 40),
        manualEnabled: slot.manual_enabled === true,
        enabled,
        hasTalent: !!cleanText(talent.talent_name, 80),
        talent: cleanText(talent.talent_name, 80) ? {
          talentName: cleanText(talent.talent_name, 80),
          rank: cleanText(talent.rank, 2),
          effect: cleanText(talent.effect, 1000),
          cooldown: cleanText(talent.cooldown, 80),
          actionCost: Math.max(0, Math.min(99, Number(talent.action_cost || 0))),
          adminNote: cleanText(talent.admin_note, 300),
          isEnabled: talent.is_enabled !== false,
          updatedAt: cleanText(talent.updated_at, 80),
        } : null,
      };
    })
    .filter((candidate) => candidate.enabled && !candidate.hasTalent);
  const assigned = (profilesResult.data || [])
    .map((profile: Record<string, unknown>) => {
      const codeHash = cleanText(profile.invite_code_hash, 64);
      const slot = slots.get(codeHash) || {};
      const talent = talents.get(codeHash) || {};
      if (slot.manual_enabled !== true || !cleanText(talent.talent_name, 80)) return null;
      return {
        codeHash,
        displayName: cleanText(profile.display_name, 40),
        ascensionScore: cleanScore(profile.ascension_score),
        talent: {
          talentName: cleanText(talent.talent_name, 80),
          rank: cleanText(talent.rank, 2) || "EX",
          effect: cleanText(talent.effect, 1000),
          cooldown: cleanText(talent.cooldown, 80),
          actionCost: Math.max(0, Math.min(99, Number(talent.action_cost || 0))),
          adminNote: cleanText(talent.admin_note, 300),
          isEnabled: talent.is_enabled !== false,
          updatedAt: cleanText(talent.updated_at, 80),
        },
      };
    })
    .filter(Boolean);
  return {
    data: {
      candidates,
      assigned,
      templates: (templatesResult.data || []).map((row: Record<string, unknown>) => ({
        id: Number(row.id || 0),
        templateName: cleanText(row.template_name, 80),
        talentName: cleanText(row.talent_name, 80),
        rank: cleanText(row.rank, 2) || "EX",
        effect: cleanText(row.effect, 1000),
        cooldown: cleanText(row.cooldown, 80),
        actionCost: Math.max(0, Math.min(99, Number(row.action_cost || 0))),
        adminNote: cleanText(row.admin_note, 300),
        isEnabled: row.is_enabled !== false,
        updatedAt: cleanText(row.updated_at, 80),
      })),
    },
  };
}

export function cleanExclusiveTalentPayload(payload: Record<string, unknown>) {
  const talentName = cleanText(payload.talentName, 80);
  const rank = cleanText(payload.rank, 2).toUpperCase();
  if (!talentName) return { error: { message: "请填写专属天赋名称" } };
  if (rank !== "EX") return { error: { message: "专属天赋等级固定为 EX" } };
  return {
    data: {
      talentName,
      rank,
      effect: cleanText(payload.effect, 1000),
      cooldown: cleanText(payload.cooldown, 80),
      actionCost: Math.max(0, Math.min(99, Number(payload.actionCost || 0))),
      adminNote: cleanText(payload.adminNote, 300),
      isEnabled: payload.isEnabled !== false,
      templateName: cleanText(payload.templateName, 80),
      saveTemplate: payload.saveTemplate === true,
    },
  };
}

export async function listFaithTraits(supabase: SupabaseClientAny) {
  const { data, error } = await supabase
    .from("faith_traits")
    .select("god_name, path_name, trait_text, is_enabled, admin_note, updated_at")
    .order("sort_order", { ascending: true });
  if (error?.code === "42P01" || error?.code === "42703") return { data: { traits: [], unavailable: true } };
  if (error) return { error };
  const traits = (data || [])
    .filter((item: Record<string, unknown>) => item.is_enabled !== false)
    .map((item: Record<string, unknown>) => ({
      god: cleanGodName(item.god_name),
      path: cleanText(item.path_name, 20),
      trait: cleanText(item.trait_text, 1000),
      adminNote: cleanText(item.admin_note, 300),
      updatedAt: cleanText(item.updated_at, 80),
    }))
    .filter((item) => item.god && item.trait);
  return { data: { traits } };
}

export async function getNextTalentId(supabase: SupabaseClientAny, poolKey: string) {
  const { data, error } = await supabase
    .from("talent_pool_items")
    .select("talent_id")
    .eq("pool_key", poolKey)
    .order("talent_id", { ascending: false })
    .limit(1);
  if (error) return { error };
  return { data: Number(data?.[0]?.talent_id || 0) + 1 };
}

export function cleanFaithTraitPayload(payload: Record<string, unknown>) {
  const god = cleanGodName(payload.god || payload.godName || payload.god_name);
  const path = cleanText(payload.path || payload.pathName || payload.path_name, 20) || godPathByName.get(god) || "";
  const trait = cleanText(payload.trait || payload.traitText || payload.trait_text, 1000);
  const adminNote = cleanText(payload.adminNote || payload.admin_note, 300);
  const isEnabled = payload.isEnabled !== false;
  if (!godNames.has(god)) return { error: { message: "请选择正确的神明" } };
  if (!trait) return { error: { message: "请填写信仰特性" } };
  return { data: { god, path, trait, adminNote, isEnabled } };
}

export function cleanTalentPoolPayload(payload: Record<string, unknown>, requireTalentId = false) {
  const poolKey = cleanPoolKey(payload.poolKey);
  const talentName = cleanText(payload.talentName, 80);
  const rank = cleanText(payload.rank, 2).toUpperCase();
  const effect = cleanText(payload.effect, 600);
  const cooldown = cleanText(payload.cooldown, 40);
  const adminNote = cleanText(payload.adminNote, 300);
  const isEnabled = payload.isEnabled !== false;
  const actionCost = Math.max(0, Math.min(99, Number(payload.actionCost || 0)));
  const talentIdInput = cleanTalentId(payload.talentId);
  if (!poolKey || !talentName || !["S", "A", "B", "C"].includes(rank)) {
    return { error: { message: "天赋池、名称、等级不能为空" } };
  }
  if (requireTalentId && !talentIdInput) return { error: { message: "批量导入必须填写编号" } };
  return { data: { poolKey, talentName, rank, effect, cooldown, adminNote, isEnabled, actionCost, talentIdInput } };
}

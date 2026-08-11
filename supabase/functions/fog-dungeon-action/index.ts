import { createClient } from "jsr:@supabase/supabase-js@2";

type SupabaseClientAny = ReturnType<typeof createClient<any, "public", any>>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type InviteRole = "player" | "author" | "reviewer" | "admin" | "god" | "star";

type RequestBody = {
  action?: string;
  inviteCode?: string;
  sessionId?: string;
  deviceKind?: string;
  payload?: Record<string, unknown>;
};

type InviteIdentity = {
  role: InviteRole;
  codeHash: string;
  displayName: string;
  inviteId?: string;
  permissions: string[];
  sessionGeneration: number;
};

type LooseError = { code?: string; message?: string } | null | undefined;
type BattleActionResult = { data?: any; error?: any };

const staffAdminNames = new Set(["缇旂緤", "妲愭煆", "鍗楁渤涔︽樊", "鎱曡緸", "妫烘潗鏉?, "鎴戜笉鎯虫", "鎯呭繂娴敓", "鐭ユ洿", "鍙樻€?, "澧ㄦ煋娴佸勾"]);
const talentManagerNames = new Set(["缇旂緤"]);
const scoreSettlerNames = new Set(["鎱曡緸", "鎯呭繂娴敓", "鐭ユ洿"]);

type TalentPoolItem = {
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

const delegatedPermissionKeys = new Set([
  "talent_pool_manage",
  "settle_scores",
  "account_role_manage",
  "review_dungeons",
]);
const inviteDeviceKinds = new Set(["desktop", "mobile"]);
const inviteDeviceSessionEnforcement = false;

// Keep malformed or oversized browser requests from consuming function memory.
// The frontend only sends compact JSON action payloads, so 48 KB leaves ample room
// for legitimate submissions while rejecting accidental/bulk request floods.
const MAX_REQUEST_BODY_BYTES = 48 * 1024;

// The production site is served from GitHub Pages. Reject browser calls from
// unrelated origins before they reach the database. Requests without an Origin
// header are kept for direct diagnostics and local file-based testing.
const allowedBrowserOrigins = new Set([
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
const PUBLIC_READ_WINDOW_MS = 60_000;
const PUBLIC_READ_MAX_PER_WINDOW = 240;
const publicReadBuckets = new Map<string, { startedAt: number; count: number }>();
const publicReadActions = new Set([
  "listDungeons",
  "listDungeonArchivePage",
  "getDungeonDetail",
  "listProfiles",
  "listDungeonComments",
  "getDungeonCommentCount",
]);

function isPublicReadRateLimited(req: Request, action: string) {
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

const roleLabels: Record<InviteRole, string> = {
  player: "鐜╁",
  author: "浣滆€?",
  reviewer: "瀹℃牳鍛?",
  admin: "棣嗕富",
  god: "绁炴槑",
  star: "星途",
};
const dungeonReviewerNames = new Set(["缇旂緤", "妲愭煆"]);

const godNames = new Set([
  "璇炶偛",
  "绻佽崳",
  "姝讳骸",
  "璁板繂",
  "鏃堕棿",
  "绉╁簭",
  "鐪熺悊",
  "鎴樹簤",
  "娆鸿瘓",
  "鍛借繍",
  "娣蜂贡",
  "娌夐粯",
  "鐥存剼",
  "姹″爼",
  "鑵愭溄",
  "婀伃",
]);

const defaultAscensionScore = 1000;
const defaultAudienceScore = 0;
const drawScoreStep = 10;
const advancedTalentDrawScore = 1500;
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
const inventorySlotLimit = 10;
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
const scoreDengMin = -30;
const scoreDengMax = 30;
const scoreJinMin = -3;
const scoreJinMax = 3;
const knownTalentPools = [
  "Pool鎴樺＋",
  "Pool娉曞笀",
  "Pool鐗у笀",
  "Pool鐚庝汉",
  "Pool鍒哄",
  "Pool姝岃€?,
  "Pool璇炶偛",
  "Pool绻佽崳",
  "Pool姝讳骸",
  "Pool姹″爼",
  "Pool鑵愭溄",
  "Pool婀伃",
  "Pool绉╁簭",
  "Pool鐪熺悊",
  "Pool鎴樹簤",
  "Pool鐥存剼",
  "Pool娌夐粯",
  "Pool璁板繂",
  "Pool鏃堕棿",
  "Pool娆鸿瘓",
  "Pool鍛借繍",
  "Pool娣蜂贡",
];

const professionGroups = [
  { path: "鏂囨槑", god: "绉╁簭", careers: { "鎴樺＋": "绉╁簭楠戝＋", "娉曞笀": "鍏冪礌娉曞畼", "鐗у笀": "鍏瀹?, "鍒哄": "琛屽垜瀹?, "鐚庝汉": "鎼滄煡瀹?, "姝岃€?: "寰嬭€? } },
  { path: "鏂囨槑", god: "鐪熺悊", careers: { "鎴樺＋": "鏍兼枟涓撳", "娉曞笀": "鍗氳瘑瀛﹁€?, "鐗у笀": "澶栫鍖荤敓", "鍒哄": "鏆楁潃鍗氬＋", "鐚庝汉": "闄烽槺澶у笀", "姝岃€?: "鍗氶椈璇椾汉" } },
  { path: "鏂囨槑", god: "鎴樹簤", careers: { "鎴樺＋": "闄烽樀鍕囧＋", "娉曞笀": "鐐肩嫳涓绘暀", "鐗у笀": "鐫ｆ垬瀹?, "鍒哄": "闅欏厜閾佸埡", "鐚庝汉": "楣扮溂鏂ュ€?, "姝岃€?: "椋庢毚涔嬪棑" } },
  { path: "娣锋矊", god: "娣蜂贡", careers: { "鎴樺＋": "寮傝鍚岃", "娉曞笀": "鐏剧ジ涔嬫簮", "鐗у笀": "鐞嗘櫤铓€鑰?, "鍒哄": "鎶樺厜鎵板奖", "鐚庝汉": "娓斿か", "姝岃€?: "澶卞緥鐞村笀" } },
  { path: "娣锋矊", god: "鐥存剼", careers: { "鎴樺＋": "鍧氬鎴樺＋", "娉曞笀": "骞曞悗鎴忓笀", "鐗у笀": "绁涙剼涓撳", "鍒哄": "瑙ｆ瀯涔嬬溂", "鐚庝汉": "鐚庢剼浜?, "姝岃€?: "鐙瀹? } },
  { path: "娣锋矊", god: "娌夐粯", careers: { "鎴樺＋": "鑻﹁鍍?, "娉曞笀": "榛樺墽澶у笀", "鐗у笀": "瀹堝浜?, "鍒哄": "鍌€鍎″笀", "鐚庝汉": "鍙樿壊榫?, "姝岃€?: "鍥氬緬" } },
  { path: "鐢熷懡", god: "璇炶偛", careers: { "鎴樺＋": "閰嬮暱", "娉曞笀": "鐢熷懡璐よ€?, "鐗у笀": "瀛愬棧鐗у笀", "鍒哄": "鍊熻癁涔嬪┐", "鐚庝汉": "鍒涚敓鐚庝汉", "姝岃€?: "鍞卞涔嬪枆" } },
  { path: "鐢熷懡", god: "绻佽崳", careers: { "鎴樺＋": "寰烽瞾浼?, "娉曞笀": "鏈ㄧ簿鐏?, "鐗у笀": "鍥竵", "鍒哄": "鑽嗘涔嬪啝", "鐚庝汉": "缇庨瀹?, "姝岃€?: "涓囩眮璋愰煶" } },
  { path: "鐢熷懡", god: "姝讳骸", careers: { "鎴樺＋": "鍓旈宸?, "娉曞笀": "姝荤伒娉曞笀", "鐗у笀": "瀹堝浜?, "鍒哄": "姝讳骸缂栫粐鑰?, "鐚庝汉": "鐚╃孩鐚庢墜", "姝岃€?: "鎾為挓浜? } },
  { path: "娌夋拨", god: "姹″爼", careers: { "鎴樺＋": "灏栧暩浼埖", "娉曞笀": "娆叉湜涓诲", "鐗у笀": "鎮叉偗棰嗕富", "鍒哄": "鎭跺", "鐚庝汉": "鎰熷畼杩界寧鑰?, "姝岃€?: "濉炵帇" } },
  { path: "娌夋拨", god: "鑵愭溄", careers: { "鎴樺＋": "鏈ㄤ箖浼?, "娉曞笀": "鐦熺柅鏋㈡満", "鐗у笀": "鍑嬮浂绁徃", "鍒哄": "鐤棈涔嬬洰", "鐚庝汉": "榛勬槒鐚庝汉", "姝岃€?: "鑵愮儌棰傚敱鑰? } },
  { path: "娌夋拨", god: "婀伃", careers: { "鎴樺＋": "娓呴亾澶?, "娉曞笀": "鐑伃鑰?, "鐗у笀": "鐒氬寲宸?, "鍒哄": "瀵傜伃浣垮緬", "鐚庝汉": "缁堢剦琛岃€?, "姝岃€?: "姣佺伃瀹ｅ憡" } },
  { path: "瀛樺湪", god: "鏃堕棿", careers: { "鎴樺＋": "鎸囬拡楠戝＋", "娉曞笀": "鏃堕棿琛岃€?, "鐗у笀": "閬楀繕鍖荤敓", "鍒哄": "鍙︽棩鍒哄", "鐚庝汉": "椹娓镐緺", "姝岃€?: "鍚熸父璇椾汉" } },
  { path: "瀛樺湪", god: "璁板繂", careers: { "鎴樺＋": "闀滀腑浜?, "娉曞笀": "鍥炲繂鏃呰€?, "鐗у笀": "瑙佽瘉鑰?, "鍒哄": "鏃ф棩杩界寧鑰?, "鐚庝汉": "绐ユⅵ娓镐緺", "姝岃€?: "鍙插瀹? } },
  { path: "铏氭棤", god: "鍛借繍", careers: { "鎴樺＋": "浠婃棩鍕囪€?, "娉曞笀": "缂栧墽", "鐗у笀": "缁囧懡甯?, "鍒哄": "绐冨懡涔嬭醇", "鐚庝汉": "缁堟湯涔嬬瑪", "姝岃€?: "棰勮█瀹? } },
  { path: "铏氭棤", god: "娆鸿瘓", careers: { "鎴樺＋": "鏉傛妧婕斿憳", "娉曞笀": "璇℃湳澶у笀", "鐗у笀": "灏忎笐", "鍒哄": "鍙楀鑰?, "鐚庝汉": "椹吔甯?, "姝岃€?: "榄旀湳甯? } },
];

const professionAliases = new Map<string, string>([
  ["鍗氬＋瀛﹁€?, "鍗氳瘑瀛﹁€?],
  ["鎶樺厜璇″奖", "鎶樺厜鎵板奖"],
  ["鍧氬楠戝＋", "鍧氬鎴樺＋"],
  ["鍋冨伓甯?, "鍌€鍎″笀"],
  ["瀛愬棧鐗?, "瀛愬棧鐗у笀"],
  ["鐢熺伒鍚熻€?, "鍞卞涔嬪枆"],
  ["涓嶆溄涔愮珷", "涓囩眮璋愰煶"],
  ["鐤槩涔嬬洰", "鐤棈涔嬬洰"],
  ["鐜崼宸?, "娓呴亾澶?],
  ["鐐伃鑰?, "鐑伃鑰?],
  ["姣佺伃瀹ｈ獡", "姣佺伃瀹ｅ憡"],
  ["鐥存ⅵ娓镐緺", "绐ユⅵ娓镐緺"],
  ["椹吔甯?, "椹吔甯?],
]);

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
for (const [alias, professionName] of professionAliases.entries()) {
  const className = professionClassByName.get(professionName);
  const godName = professionGodByName.get(professionName);
  if (className) professionClassByName.set(alias, className);
  if (godName) professionGodByName.set(alias, godName);
}
const godPathByName = new Map(professionGroups.map((group) => [group.god, group.path]));
const battleHealthTable = [
  { score: 1000, "鎴樺＋": 120, "鐗у笀": 105, "姝岃€?: 100, "娉曞笀": 80, "鍒哄": 80, "鐚庝汉": 80 },
  { score: 1100, "鎴樺＋": 126, "鐗у笀": 110, "姝岃€?: 105, "娉曞笀": 84, "鍒哄": 84, "鐚庝汉": 84 },
  { score: 1200, "鎴樺＋": 132, "鐗у笀": 115, "姝岃€?: 110, "娉曞笀": 88, "鍒哄": 88, "鐚庝汉": 88 },
  { score: 1300, "鎴樺＋": 138, "鐗у笀": 120, "姝岃€?: 115, "娉曞笀": 92, "鍒哄": 92, "鐚庝汉": 92 },
  { score: 1400, "鎴樺＋": 150, "鐗у笀": 130, "姝岃€?: 125, "娉曞笀": 100, "鍒哄": 100, "鐚庝汉": 100 },
  { score: 1500, "鎴樺＋": 162, "鐗у笀": 140, "姝岃€?: 135, "娉曞笀": 108, "鍒哄": 108, "鐚庝汉": 108 },
  { score: 1600, "鎴樺＋": 174, "鐗у笀": 150, "姝岃€?: 145, "娉曞笀": 116, "鍒哄": 116, "鐚庝汉": 116 },
  { score: 1700, "鎴樺＋": 186, "鐗у笀": 160, "姝岃€?: 155, "娉曞笀": 124, "鍒哄": 124, "鐚庝汉": 124 },
  { score: 1800, "鎴樺＋": 198, "鐗у笀": 180, "姝岃€?: 175, "娉曞笀": 132, "鍒哄": 132, "鐚庝汉": 132 },
  { score: 1900, "鎴樺＋": 222, "鐗у笀": 200, "姝岃€?: 195, "娉曞笀": 148, "鍒哄": 148, "鐚庝汉": 148 },
  { score: 2000, "鎴樺＋": 246, "鐗у笀": 220, "姝岃€?: 215, "娉曞笀": 164, "鍒哄": 164, "鐚庝汉": 164 },
  { score: 2100, "鎴樺＋": 270, "鐗у笀": 240, "姝岃€?: 235, "娉曞笀": 180, "鍒哄": 180, "鐚庝汉": 180 },
  { score: 2200, "鎴樺＋": 294, "鐗у笀": 260, "姝岃€?: 255, "娉曞笀": 196, "鍒哄": 196, "鐚庝汉": 196 },
  { score: 2300, "鎴樺＋": 318, "鐗у笀": 280, "姝岃€?: 275, "娉曞笀": 212, "鍒哄": 212, "鐚庝汉": 212 },
  { score: 2400, "鎴樺＋": 342, "鐗у笀": 300, "姝岃€?: 295, "娉曞笀": 228, "鍒哄": 228, "鐚庝汉": 228 },
];
const battleHealthByScore = new Map(battleHealthTable.map((row) => [row.score, row]));
const battleClassHealthMin = battleHealthTable[0].score;
const battleClassHealthMax = battleHealthTable[battleHealthTable.length - 1].score;
const prosperityBattleHealthBonus: Record<string, number> = {
  "鎴樺＋": 24,
  "鐗у笀": 20,
  "姝岃€?: 18,
  "鍒哄": 16,
  "鐚庝汉": 16,
  "娉曞笀": 16,
};

const feedbackTagAllowlist = new Set([
  "鏈哄埗娓呮",
  "鍓ф儏濂?,
  "姘涘洿寮?,
  "鏈夋寫鎴?,
  "鍋忛毦",
  "鎯冲啀璺?,
  "闇€瑕佷慨璁?,
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

function cleanPermissionList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanText(item, 40)).filter((item) => delegatedPermissionKeys.has(item)))];
}

function cleanDeviceKind(value: unknown) {
  const kind = cleanText(value, 20);
  return inviteDeviceKinds.has(kind) ? kind : "desktop";
}

function cleanSessionId(value: unknown) {
  const text = cleanText(value, 80);
  return /^[0-9a-f-]{20,80}$/i.test(text) ? text : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

async function readRequestBody(req: Request): Promise<{ body?: RequestBody; error?: string }> {
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
    return { error: "璇锋眰鍐呭杩囧ぇ" };
  }
  if (!req.body) return { error: "璇锋眰鍐呭涓嶈兘涓虹┖" };

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
        return { error: "璇锋眰鍐呭杩囧ぇ" };
      }
      chunks.push(value);
    }
  } catch {
    return { error: "璇锋眰璇诲彇澶辫触" };
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!isRecord(parsed)) return { error: "璇锋眰鏍煎紡涓嶆纭? };
    return { body: parsed as RequestBody };
  } catch {
    return { error: "璇锋眰鏍煎紡涓嶆纭? };
  }
}

function cleanRequestKey(value: unknown, maxLength = 96) {
  const text = cleanText(value, maxLength);
  return /^[A-Za-z0-9._:-]{8,96}$/.test(text) ? text : "";
}

function cleanDisplayName(value: unknown, role: InviteRole) {
  const name = cleanText(value, 16).replace(/\s+/g, " ");
  if (!name || name.length < 1) return { error: "鏄电О涓嶈兘涓虹┖" };
  if (/[<>@#]/.test(name)) return { error: "鏄电О涓嶈兘鍖呭惈鐗规畩绗﹀彿" };
  const reserved = ["棣嗕富", "瀹樻柟", "绠＄悊鍛?, "绯荤粺"];
  if (role !== "admin" && reserved.some((word) => name.includes(word))) {
    return { error: "杩欎釜鏄电О鍍忕鐞嗚韩浠斤紝鎹竴涓惂" };
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
    : String(value || "").split(/[銆?锛?锛沑n\r]+/u);
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

function normalizeCurseType(value: unknown) {
  return cleanText(value, 20) === "ordinary" ? "ordinary" : "betrayal";
}

function toPublicCurse(curse: Record<string, unknown> | null | undefined) {
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

async function getActiveTitlesByHashes(
  supabase: SupabaseClientAny,
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
  supabase: SupabaseClientAny,
  inviteCodeHash: string,
) {
  const result = await getActiveTitlesByHashes(supabase, [inviteCodeHash]);
  if (result.error) return { error: result.error };
  const titles = result.titles.get(inviteCodeHash) || [];
  return { title: titles[0] || null, titles };
}

async function getActiveCursesByHashes(
  supabase: SupabaseClientAny,
  inviteCodeHashes: string[],
) {
  const hashes = [...new Set(inviteCodeHashes.map((hash) => cleanText(hash, 64)).filter(Boolean))];
  const curses = new Map<string, Record<string, unknown>[]>();
  if (!hashes.length) return { curses };
  const { data, error } = await supabase
    .from("profile_curses")
    .select("id, invite_code_hash, curse_text, curse_god, curse_note, curse_type, granted_by_type, granted_by_name, granted_at")
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
  supabase: SupabaseClientAny,
  inviteCodeHash: string,
) {
  const result = await getActiveCursesByHashes(supabase, [inviteCodeHash]);
  if (result.error) return { error: result.error };
  const curses = result.curses.get(inviteCodeHash) || [];
  return { curse: curses[0] || null, curses };
}

async function getCommentHonorBuckets(
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

async function getProfileByDisplayName(
  supabase: SupabaseClientAny,
  displayNameInput: unknown,
): Promise<{ data?: Record<string, unknown>; error?: LooseError }> {
  const displayName = cleanText(displayNameInput, 40);
  if (!displayName) return { error: { message: "璇峰～鍐欑帺瀹舵樀绉? } };
  const { data, error } = await supabase
    .from("player_profiles")
    .select("invite_code_hash, display_name, role, faith_god")
    .eq("display_name", displayName)
    .maybeSingle();
  if (error) return { error };
  if (!data) return { error: { message: "娌℃湁鎵惧埌杩欎釜鐜╁妗ｆ锛岃纭鏄电О宸蹭繚瀛? } };
  return { data };
}

const godBelieverProfileSelect = "invite_code_hash, display_name, role, faith_god, faith_path, original_faith_god, original_faith_path, trickery_display_faith_god, trickery_display_faith_path, trickery_display_profession, profession, ascension_score, audience_score, items, talents, show_titles, scores_locked_at, updated_at";

async function listGodBelievers(
  supabase: SupabaseClientAny,
  godName: string,
) {
  const { data, error } = await supabase
    .from("player_profiles")
    .select(godBelieverProfileSelect)
    .eq("faith_god", godName)
    .neq("role", "god").neq("role", "star")
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

const dungeonArchiveSelectFields = "id, name, creator, co_creators, difficulty, type, description, pinned_note, participant_count, run_count, clear_count, clear_rate, invite_code_hash, invite_name, avg_rating, rating_count, comment_count, created_at, is_one_shot, review_status, reviewed_at, reviewed_by_name, review_note";
const dungeonArchivePageSelectFields = "id, name, creator, co_creators, difficulty, type, participant_count, run_count, clear_count, clear_rate, avg_rating, rating_count, comment_count, created_at, is_one_shot, review_status";
const dungeonArchiveAggregateLimit = 500;

function toDungeonArchiveCard(dungeon: Record<string, unknown>, identity: InviteIdentity | null = null) {
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

function getDungeonGodNames(type: unknown) {
  const source = cleanText(type, 160);
  const matches = [...godNames].filter((god) => source.includes(god));
  return matches.length ? matches : ["鏈綊妗?];
}

function buildDungeonArchiveSidebar(dungeons: Record<string, unknown>[]) {
  const pathCounts: Record<string, number> = {};
  const godCounts: Record<string, number> = {};
  for (const dungeon of dungeons) {
    for (const god of getDungeonGodNames(dungeon.type)) {
      godCounts[god] = (godCounts[god] || 0) + 1;
      const path = godPathByName.get(god) || "鏃ф。妗?;
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
      const creator = cleanText(dungeon.creator, 40) || "鍖垮悕";
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

function toPublicProfile(profile: Record<string, unknown>, profileKey: string, isCurrent: boolean) {
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

async function getInviteIdentity(
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
  if (data?.is_active && roleFromTable && ["player", "author", "reviewer", "admin", "god", "star"].includes(roleFromTable)) {
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

async function issueInviteSession(
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

async function validateInviteSession(
  supabase: SupabaseClientAny,
  identity: InviteIdentity,
  sessionIdInput: unknown,
  deviceKindInput: unknown,
) {
  const sessionId = cleanSessionId(sessionIdInput);
  const deviceKind = cleanDeviceKind(deviceKindInput);
  if (!sessionId) return { error: { message: "鐧诲綍鐘舵€佸凡鏇存柊锛岃閲嶆柊杈撳叆閭€璇风爜", code: "session_invalid" } };
  const { data, error } = await supabase
    .from("invite_sessions")
    .select("session_id, session_generation")
    .eq("invite_code_hash", identity.codeHash)
    .eq("device_kind", deviceKind)
    .maybeSingle();
  if (error?.code === "42P01" || error?.code === "42703") return { error: { message: "璇峰厛杩愯 invite_device_sessions_20260809.sql", code: "session_invalid" } };
  if (error) return { error };
  if (!data || data.session_id !== sessionId || Number(data.session_generation || 0) !== identity.sessionGeneration) {
    return { error: { message: "姝よ澶囩殑鐧诲綍宸茶鏂扮櫥褰曢《涓嬶紝璇烽噸鏂拌緭鍏ラ個璇风爜", code: "session_invalid" } };
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

function hasRole(role: InviteRole, allowed: InviteRole[]) {
  return allowed.includes(role);
}

function hasNamedDuty(identity: InviteIdentity, names: Set<string>) {
  const displayName = cleanText(identity.displayName, 40);
  return !!displayName && names.has(displayName);
}

function hasPermission(identity: InviteIdentity, permission: string) {
  if (identity.role === "admin") return true;
  if ((permission === "review_dungeons" || permission === "account_role_manage") && hasNamedDuty(identity, staffAdminNames)) return true;
  if (permission === "talent_pool_manage" && hasNamedDuty(identity, talentManagerNames)) return true;
  if (permission === "settle_scores" && hasNamedDuty(identity, scoreSettlerNames)) return true;
  return identity.permissions.includes(permission);
}

function canGrantTitles(identity: InviteIdentity) {
  return hasRole(identity.role, ["admin", "god"]);
}

function canReviewDungeons(identity: InviteIdentity) {
  if (hasRole(identity.role, ["admin", "god"])) return true;
  if (hasPermission(identity, "review_dungeons")) return true;
  return false;
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

function isMissingAdminOperationLogTable(error: LooseError) {
  return error?.code === "42P01" && !!error.message?.includes("admin_operation_logs");
}

async function writeAdminOperationLog(
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

async function listAdminOperationLogs(
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

async function listHonorOperationLogs(
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
  if (identity.role === "god") query = query.eq("actor_code_hash", identity.codeHash);
  const { data, error } = await query;
  if (isMissingAdminOperationLogTable(error)) return { data: [], unavailable: true };
  if (error) return { data: [], error };
  return { data: data || [], unavailable: false };
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

function isMissingBattleSystem(error: LooseError) {
  return error?.code === "42P01" || error?.code === "42703";
}

function getEarnedDraws(ascensionScore: unknown) {
  return getBasicDrawsEarned(ascensionScore) + getAdvancedDrawsEarned(ascensionScore);
}

function getBasicDrawsEarned(ascensionScore: unknown) {
  const score = Math.min(cleanScore(ascensionScore), advancedTalentDrawScore - drawScoreStep);
  return starterTalentDrawGrant + Math.max(0, Math.floor((score - defaultAscensionScore) / drawScoreStep));
}

function getAdvancedDrawsEarned(ascensionScore: unknown) {
  const score = cleanScore(ascensionScore);
  return Math.max(0, Math.floor((score - (advancedTalentDrawScore - drawScoreStep)) / drawScoreStep));
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
  const faithGod = cleanText(profile.original_faith_god, 20) === "娆鸿瘓"
    ? "娆鸿瘓"
    : cleanText(profile.faith_god, 20);
  const poolKey = faithGod ? `Pool${faithGod}` : "";
  return knownTalentPools.includes(poolKey) ? poolKey : "";
}

function getProfessionTalentPoolKey(profile: Record<string, unknown>) {
  const profession = cleanText(profile.profession, 40);
  if (cleanText(profile.original_faith_god, 20) === "娆鸿瘓" && getProfessionGod(profession) !== "娆鸿瘓") return "";
  const professionClass = professionClassByName.get(profession);
  const poolKey = professionClass ? `Pool${professionClass}` : "";
  return knownTalentPools.includes(poolKey) ? poolKey : "";
}

function getFaithPathByGod(god: string) {
  return godPathByName.get(god) || "";
}

function cleanGodName(value: unknown) {
  const godName = cleanText(value, 20);
  return godNames.has(godName) ? godName : "";
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
  if (cleanText(profile.original_faith_god, 20) === "娆鸿瘓") return true;
  if (cleanText(profile.faith_god, 20) === "娆鸿瘓") return true;
  return getProfessionGod(profile.profession) === "娆鸿瘓";
}

function getTalentSlotKind(slot: number) {
  return talentSlotKinds[slot - 1] || "any";
}

function getTalentSlotRequirement(profile: Record<string, unknown>, slot: number) {
  const kind = getTalentSlotKind(slot);
  if (kind === "faith") return { kind, poolKey: getFaithTalentPoolKey(profile), label: "淇′话" };
  if (kind === "profession") return { kind, poolKey: getProfessionTalentPoolKey(profile), label: "鑱屼笟" };
  return { kind, poolKey: "", label: "浠绘剰" };
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

type TalentPoolRebalanceResult = {
  removedPoolKeys: string[];
  refundedDraws: number;
  refundedFragments: number;
  removedFragments?: number;
  fragmentDelta?: number;
  error?: LooseError;
};

type TalentDrawRollbackRow = {
  draw_type?: string | null;
  fragment_gain?: number | null;
};

type TalentExchangeRollbackRow = {
  cost_fragment?: number | null;
};

function talentPoolRebalanceError(error: LooseError): TalentPoolRebalanceResult {
  return { removedPoolKeys: [], refundedDraws: 0, refundedFragments: 0, error };
}

async function rebalanceTalentPoolsAfterProfileChange(
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
      .select("spent_draws, basic_spent_draws, advanced_spent_draws")
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
  const nextDrawState = {
    invite_code_hash: codeHash,
    spent_draws: Math.max(0, currentSpentDraws - refundedDraws),
    basic_spent_draws: Math.max(0, currentBasicSpentDraws - refundedBasicDraws),
    advanced_spent_draws: Math.max(0, currentAdvancedSpentDraws - refundedAdvancedDraws),
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

function canSettleScores(identity: InviteIdentity) {
  return identity.role === "admin" || hasPermission(identity, "settle_scores");
}

function cleanSettlementScore(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return Number.NaN;
  return Math.round(number * 10) / 10;
}

function checkSettlementScoreRange(deng: number, jin: number) {
  if (!Number.isFinite(deng) || !Number.isFinite(jin)) return "鍒嗘暟鏍煎紡涓嶆纭?;
  if (deng < scoreDengMin || deng > scoreDengMax) return `鐧荤涔嬭矾鍒嗘暟蹇呴』鍦?${scoreDengMin}~${scoreDengMax} 涔嬮棿`;
  if (jin < scoreJinMin || jin > scoreJinMax) return `瑙愯涔嬫鍒嗘暟蹇呴』鍦?${scoreJinMin}~${scoreJinMax} 涔嬮棿`;
  return "";
}

function cleanClearStatus(value: unknown) {
  const status = cleanText(value, 20).toLowerCase();
  if (["passed", "clear", "success", "閫㈢敓"].includes(status)) return "passed";
  if (["lost", "failed", "fail", "杩峰け"].includes(status)) return "lost";
  return "unknown";
}

function buildSettlementClearStatusMap(
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

function getClearStatusLabel(status: string) {
  if (status === "passed") return "閫㈢敓";
  if (status === "lost") return "杩峰け";
  return "鏈爣娉?;
}

function normalizeProfileMatchKey(value: unknown) {
  return cleanText(value, 80)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function parseScoreSettlementText(textContent: unknown) {
  const text = cleanText(textContent, 20000);
  const entries: { nick: string; deng: number; jin: number; total: number; line: number; raw: string }[] = [];
  const invalidLines: { line: number; raw: string; msg: string }[] = [];
  text.split(/\r?\n/u).forEach((lineText, index) => {
    const raw = lineText.trim();
    if (!raw) return;
    const normalized = raw.replace(/^\s*\d+\s*[.锛庛€?]\s*/u, "");
    const match = normalized.match(/^(.+?)\s*([+-]?\d+(?:\.\d+)?)\s*\+\s*([+-]?\d+(?:\.\d+)?)\s*$/u);
    if (!match) {
      if (!entries.length) return;
      invalidLines.push({ line: index + 1, raw, msg: "鏍煎紡搴斾负 鏄电О+鐧荤+瑙愯锛屽彲甯︾紪鍙凤紝濡?2. 绁?2+2" });
      return;
    }
    const nick = cleanText(String(match[1] || "").replace(/[锛?锛氾紱;,锛屻€乗s]+$/u, ""), 40);
    const deng = cleanSettlementScore(match[2]);
    const jin = cleanSettlementScore(match[3]);
    if (!nick) {
      invalidLines.push({ line: index + 1, raw, msg: "鏄电О涓嶈兘涓虹┖" });
      return;
    }
    entries.push({ nick, deng, jin, total: Math.round((deng + jin) * 10) / 10, line: index + 1, raw });
  });
  return { entries, invalidLines };
}

async function getProfilesByNames(
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

async function buildScorePreview(
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

function getTalentFragmentGain(rank: unknown) {
  const normalizedRank = String(rank || "").toUpperCase();
  if (normalizedRank === "A") return 200;
  if (normalizedRank === "B") return bTalentFragmentGain;
  if (normalizedRank === "C") return cTalentFragmentGain;
  return 0;
}

function getTalentExchangeCost(rank: unknown) {
  return String(rank || "").toUpperCase() === "A" ? aTalentExchangeCost : targetTalentExchangeCost;
}

function pickRandomTalent<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)] ?? items[0];
}

function isAdvancedTalentDrawUnlocked(ascensionScore: unknown) {
  return cleanScore(ascensionScore) >= advancedTalentDrawScore;
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

async function rebuildTalentPoolCounterFromLogs(
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
  supabase: SupabaseClientAny,
  identity: InviteIdentity,
) {
  const { data, error } = await supabase
    .from("player_profiles")
    .select("display_name, role, faith_god, faith_path, original_faith_god, original_faith_path, trickery_display_faith_god, trickery_display_faith_path, trickery_display_profession, profession, ascension_score, audience_score, items, talents, show_titles, updated_at")
    .eq("invite_code_hash", identity.codeHash)
    .maybeSingle();
  if (error) return { error };
  if (!data) return { error: { message: "璇峰厛淇濆瓨涓汉妗ｆ锛屽啀寮€鍚ぉ璧嬫睜" } };
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
  supabase: SupabaseClientAny,
  codeHash: string,
) {
  const { data, error } = await supabase
    .from("talent_draw_state")
    .select("spent_draws, basic_spent_draws, advanced_spent_draws, event_basic_draws, event_advanced_draws")
    .eq("invite_code_hash", codeHash)
    .maybeSingle();
  if (
    error?.code === "42703" &&
    (error.message?.includes("event_basic_draws") || error.message?.includes("event_advanced_draws"))
  ) {
    const fallback = await supabase
      .from("talent_draw_state")
      .select("spent_draws, basic_spent_draws, advanced_spent_draws")
      .eq("invite_code_hash", codeHash)
      .maybeSingle();
    if (fallback.error?.code === "42703") {
      return { error: { ...fallback.error, message: "璇峰厛杩愯 talent_draw_tier_1500_20260727.sql" }, spentDraws: 0, basicSpentDraws: 0, advancedSpentDraws: 0, eventBasicDraws: 0, eventAdvancedDraws: 0 };
    }
    if (fallback.error) return { error: fallback.error, spentDraws: 0, basicSpentDraws: 0, advancedSpentDraws: 0, eventBasicDraws: 0, eventAdvancedDraws: 0 };
    return {
      spentDraws: Number(fallback.data?.spent_draws || 0),
      basicSpentDraws: Number(fallback.data?.basic_spent_draws || 0),
      advancedSpentDraws: Number(fallback.data?.advanced_spent_draws || 0),
      eventBasicDraws: 0,
      eventAdvancedDraws: 0,
    };
  }
  if (error?.code === "42703") {
    return { error: { ...error, message: "璇峰厛杩愯 talent_draw_tier_1500_20260727.sql" }, spentDraws: 0, basicSpentDraws: 0, advancedSpentDraws: 0, eventBasicDraws: 0, eventAdvancedDraws: 0 };
  }
  if (error) return { error, spentDraws: 0, basicSpentDraws: 0, advancedSpentDraws: 0, eventBasicDraws: 0, eventAdvancedDraws: 0 };
  return {
    spentDraws: Number(data?.spent_draws || 0),
    basicSpentDraws: Number(data?.basic_spent_draws || 0),
    advancedSpentDraws: Number(data?.advanced_spent_draws || 0),
    eventBasicDraws: Number(data?.event_basic_draws || 0),
    eventAdvancedDraws: Number(data?.event_advanced_draws || 0),
  };
}

async function getFragmentTotal(
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

async function addUserFragments(
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

async function updateProfileTalentText(
  supabase: SupabaseClientAny,
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
    .map((item) => `妲戒綅${item.equipped_slot}锛?{item.talent_name}锛?{item.rank}锛塦)
    .join("\n")
    .slice(0, 800);
  const { error: updateError } = await supabase
    .from("player_profiles")
    .update({ talents: talentText, updated_at: new Date().toISOString() })
    .eq("invite_code_hash", codeHash);
  return { error: updateError, talentText };
}

async function getAvailableStorageSlot(
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

async function addOwnedTalentToStorage(
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

async function settleOpenSlotOverflowChoices(
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

async function buildTalentState(
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

  let poolItems: TalentPoolItem[] = [];
  if (allowedPoolKeys.length > 0) {
    const poolResult = await supabase
      .from("talent_pool_items")
      .select("pool_key, talent_id, talent_name, rank, effect, action_cost")
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

async function confirmClearRecordsFromSettlement(
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
        feedback_tags: ["瀹℃牳纭"],
        feedback_note: `鐢卞鏍稿憳 ${operatorName} 鍦ㄥ垎鏁扮粨绠楁椂纭閫氬叧`,
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
    return { error: { message: "璇烽€夋嫨鍓湰" } };
  }
  const { data, error } = await query.maybeSingle();
  if (error) return { error };
  if (!data) return { error: { message: "鏈壘鍒版墍閫夊壇鏈紝璇蜂粠鍓湰鍒楄〃涓€夋嫨" } };
  return { data };
}

async function getMatchState(
  supabase: SupabaseClientAny,
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
  supabase: SupabaseClientAny,
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
  if (!muster) return { error: { message: "鍙泦涓嶅瓨鍦? } };

  const closesAt = new Date(String(muster.closes_at || "")).getTime();
  if (muster.status === "open" && Number.isFinite(closesAt) && closesAt <= Date.now()) {
    const { error: drawError } = await supabase.rpc("draw_match_muster", {
      p_muster_id: musterId,
    });
    if (drawError && !String(drawError.message || "").includes("鍙泦灏氭湭鎴")) return { error: drawError };

    const reread = await readMuster();
    muster = reread.data;
    musterError = reread.error;
    if (musterError) return { error: musterError };
    if (!muster) return { error: { message: "鍙泦涓嶅瓨鍦? } };
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

function getBattleClassName(profession: unknown) {
  return professionClassByName.get(cleanText(profession, 40)) || "";
}

function getBattleHealthBand(ascensionScore: unknown) {
  const score = cleanScore(ascensionScore) || defaultAscensionScore;
  return Math.max(battleClassHealthMin, Math.min(battleClassHealthMax, Math.floor(score / 100) * 100));
}

function getBattleMaxHp(faithGod: unknown, profession: unknown, ascensionScore: unknown) {
  const className = getBattleClassName(profession);
  const band = getBattleHealthBand(ascensionScore);
  const tableHp = Number((battleHealthByScore.get(band) as Record<string, unknown> | undefined)?.[className] || 80);
  const faithBonus = cleanText(faithGod, 20) === "绻佽崳" ? Number(prosperityBattleHealthBonus[className] || 0) : 0;
  return Math.max(1, Math.min(9999, tableHp + faithBonus));
}

function cleanBattleAmount(value: unknown, fallback = 0) {
  const amount = Math.round(Number(value));
  if (!Number.isFinite(amount)) return fallback;
  return Math.max(-9999, Math.min(9999, amount));
}

async function buildBattlePlayerSnapshot(
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

  const playerName = cleanText(profile?.display_name || identity.displayName, 40) || "鏈懡鍚嶄俊寰?;
  const faithGod = cleanText(profile?.faith_god, 20);
  const profession = cleanText(profile?.profession, 40);
  const ascensionScore = cleanScore(profile?.ascension_score) || defaultAscensionScore;
  const maxHp = getBattleMaxHp(faithGod, profession, ascensionScore);
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
      is_defeated: false,
      seat_order: seatOrder,
    },
  };
}

async function getBattleRoomState(
  supabase: SupabaseClientAny,
  battleRoomId: string,
  identity: InviteIdentity,
): Promise<BattleActionResult> {
  const { data: room, error: roomError } = await supabase
    .from("battle_rooms")
    .select("id, source_match_room_id, dungeon_id, host_code_hash, host_name, room_status, current_round, note, created_at, updated_at, finished_at")
    .eq("id", battleRoomId)
    .maybeSingle();
  if (roomError) return { error: roomError };
  if (!room) return { error: { message: "鎴樻枟鎴块棿涓嶅瓨鍦? } };

  const { data: dungeon, error: dungeonError } = await supabase
    .from("dungeons")
    .select("id, name, creator, difficulty, type, participant_count")
    .eq("id", String(room.dungeon_id))
    .maybeSingle();
  if (dungeonError) return { error: dungeonError };

  const { data: players, error: playerError } = await supabase
    .from("battle_room_players")
    .select("id, player_code_hash, player_name, faith_god, profession, class_name, ascension_score, max_hp, current_hp, shield, is_defeated, seat_order, note, updated_at")
    .eq("battle_room_id", battleRoomId)
    .order("seat_order", { ascending: true })
    .order("id", { ascending: true });
  if (playerError) return { error: playerError };

  const { data: logs, error: logError } = await supabase
    .from("battle_room_logs")
    .select("id, actor_name, action_type, target_player_id, target_player_name, amount, note, round_no, created_at")
    .eq("battle_room_id", battleRoomId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(30);
  if (logError) return { error: logError };

  const playerRows = players || [];
  const isHost = String(room.host_code_hash || "") === identity.codeHash;
  const isParticipant = playerRows.some((player) => String(player.player_code_hash || "") === identity.codeHash);
  const canOperate = isHost || hasRole(identity.role, ["reviewer", "admin"]);
  return {
    data: {
      room,
      dungeon,
      players: playerRows,
      logs: logs || [],
      isHost,
      isParticipant,
      canOperate,
    },
  };
}

async function getBattleRoomByMatchRoom(
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

async function createBattleRoomFromMatchRoom(
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
  if (!matchRoom) return { error: { message: "缁勯槦鎴块棿涓嶅瓨鍦? } };

  const matchPlayers = Array.isArray(matchRoom.match_room_players) ? matchRoom.match_room_players : [];
  if (!matchPlayers.length) return { error: { message: "缁勯槦鎴块棿娌℃湁鎴愬憳" } };
  const isParticipant = matchPlayers.some((player) => String(player.player_code_hash || "") === identity.codeHash);
  if (!isParticipant && !hasRole(identity.role, ["reviewer", "admin"])) return { error: { message: "鍙湁鏈埧闂存垚鍛樸€佸鏍稿憳鎴栭涓诲彲浠ュ紑鍚垬鏂楁埧闂? } };

  const { data: battleRoom, error: createError } = await supabase
    .from("battle_rooms")
    .insert({
      source_match_room_id: matchRoomId,
      dungeon_id: matchRoom.dungeon_id,
      host_code_hash: identity.codeHash,
      host_name: identity.displayName,
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
  const battlePlayers = matchPlayers.map((player, index) => {
    const hash = String(player.player_code_hash || "");
    const profile = profileByHash.get(hash) as Record<string, unknown> | undefined;
    const playerName = cleanText(profile?.display_name || player.player_name, 40) || "鏈懡鍚嶄俊寰?;
    const faithGod = cleanText(profile?.faith_god, 20);
    const profession = cleanText(profile?.profession, 40);
    const ascensionScore = cleanScore(profile?.ascension_score) || defaultAscensionScore;
    const maxHp = getBattleMaxHp(faithGod, profession, ascensionScore);
    return {
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
      is_defeated: false,
      seat_order: index + 1,
    };
  });

  const { error: playerInsertError } = await supabase.from("battle_room_players").insert(battlePlayers);
  if (playerInsertError) return { error: playerInsertError };

  await supabase.from("battle_room_logs").insert({
    battle_room_id: battleRoom.id,
    actor_code_hash: identity.codeHash,
    actor_name: identity.displayName,
    action_type: "create",
    note: "浠庣綉绔欑粍闃熸埧闂村紑鍚鍩熸垬鍦?,
    round_no: 1,
  });

  return getBattleRoomState(supabase, String(battleRoom.id), identity);
}

async function createBattleRoomFromDungeon(
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
  if (!dungeon) return { error: { message: "鍓湰涓嶅瓨鍦? } };

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
    note: `浠庣綉绔欒繘鍏ョ鍩熸垬鍦猴細${cleanText(dungeon.name, 40) || "鏈懡鍚嶈瘯鐐?}`,
    round_no: 1,
  });

  return getBattleRoomState(supabase, String(battleRoom.id), identity);
}

async function joinBattleRoom(
  supabase: SupabaseClientAny,
  battleRoomId: string,
  identity: InviteIdentity,
): Promise<BattleActionResult> {
  const state = await getBattleRoomState(supabase, battleRoomId, identity);
  if (state.error) return state;
  if (!state.data?.room || state.data.room.room_status !== "active") {
    return { error: { message: "鎴樺満宸茬粨鏉燂紝涓嶈兘鍐嶅姞鍏? } };
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
    note: "杩涘叆绁炲煙鎴樺満",
    round_no: Number((state.data.room as Record<string, unknown>).current_round || 1),
  });
  return getBattleRoomState(supabase, battleRoomId, identity);
}

async function updateBattleRoomRound(
  supabase: SupabaseClientAny,
  battleRoomId: string,
  identity: InviteIdentity,
  nextRoundInput: unknown,
  noteInput: unknown,
): Promise<BattleActionResult> {
  const state = await getBattleRoomState(supabase, battleRoomId, identity);
  if (state.error) return state;
  if (!state.data?.canOperate) return { error: { message: "鍙湁涓绘寔浜恒€佸鏍稿憳鎴栭涓诲彲浠ヨ皟鏁存垬鏂楁埧闂? } };

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
    note: `璋冩暣鑷崇 ${nextRound} 鍥炲悎${note ? `锛?{note}` : ""}`,
    round_no: nextRound,
  });
  return getBattleRoomState(supabase, battleRoomId, identity);
}

async function applyBattlePlayerAction(
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
  if (!state.data?.canOperate) return { error: { message: "鍙湁涓绘寔浜恒€佸鏍稿憳鎴栭涓诲彲浠ユ搷浣滄垬鏂楁埧闂? } };

  const player = (state.data.players as Record<string, unknown>[]).find((item) => Number(item.id) === playerId);
  if (!player) return { error: { message: "鎴樻枟鎴愬憳涓嶅瓨鍦? } };

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
    logNote = `${note || "浼ゅ缁撶畻"}${absorbed ? `锛涙姢鐩炬姷娑?${absorbed}` : ""}`;
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
    return { error: { message: "鎴樻枟鎿嶄綔涓嶆纭? } };
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

async function finishBattleRoom(
  supabase: SupabaseClientAny,
  battleRoomId: string,
  identity: InviteIdentity,
  statusInput: unknown,
  noteInput: unknown,
): Promise<BattleActionResult> {
  const state = await getBattleRoomState(supabase, battleRoomId, identity);
  if (state.error) return state;
  if (!state.data?.canOperate) return { error: { message: "鍙湁涓绘寔浜恒€佸鏍稿憳鎴栭涓诲彲浠ョ粨鏉熸垬鏂楁埧闂? } };
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
    note: note || (nextStatus === "cancelled" ? "鍙栨秷鎴樻枟鎴块棿" : "缁撴潫鎴樻枟鎴块棿"),
    round_no: Number((state.data.room as Record<string, unknown>).current_round || 1),
  });
  return getBattleRoomState(supabase, battleRoomId, identity);
}

async function commitScoreSettlement(
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
  if (!preview.data?.valid) return { error: { message: "棰勬牎楠屾湭閫氳繃", preview: preview.data } };
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
    return { error: { message: "杩欐缁撶畻姝ｅ湪澶勭悊锛岃鍒锋柊鏈€杩戠粨绠楀悗纭缁撴灉" } };
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
    const typeName = sourceType === "single" ? "婕忓垎琛ュ彂" : "鎵归噺缁撶畻";
    const clearStatus = clearStatuses.get(entry.nick) || "unknown";
    const clearText = confirmClear ? `\n鏈溅缁撴灉锛?{getClearStatusLabel(clearStatus)}${clearStatus === "passed" ? "锛堝凡鐧昏閫氬叧锛? : ""}` : "";
    const content = `銆?{typeName}锝滃壇鏈細${dungeonName}銆慭n瀹℃牳鍛橈細${identity.displayName}\n鐧荤涔嬭矾锛?{entry.deng >= 0 ? "+" : ""}${entry.deng}\n瑙愯涔嬫锛?{entry.jin >= 0 ? "+" : ""}${entry.jin}\n鏈鎬诲彉鍖栵細${entry.total >= 0 ? "+" : ""}${entry.total}${clearText}${remark ? `\n澶囨敞锛?{remark}` : ""}`;
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

type AdminTalentRow = {
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

function findTalentOpenStorageSlots(talents: AdminTalentRow[]) {
  const used = new Set(talents.map((item) => Number(item.storage_slot)).filter((slot) => slot >= 1 && slot <= inventorySlotLimit));
  const slots: number[] = [];
  for (let slot = 1; slot <= inventorySlotLimit; slot += 1) {
    if (!used.has(slot)) slots.push(slot);
  }
  return slots;
}

function summarizeAdminTalentAnomalies(
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
  if (unplaced.length) messages.push(`${unplaced.length} 涓绔嬪ぉ璧嬫湭鍒嗛厤浠撳簱鎴栨惡甯︽Ы`);
  if (dualPlaced.length) messages.push(`${dualPlaced.length} 涓ぉ璧嬪悓鏃跺崰鐢ㄤ粨搴撳拰鎼哄甫妲絗);
  if (invalidStorage.length || invalidEquipped.length) messages.push(`${invalidStorage.length + invalidEquipped.length} 涓ぉ璧嬫Ы浣嶈秴鍑鸿鍒欒寖鍥碻);
  if ([...storageSlots.values()].some((count) => count > 1) || [...equippedSlots.values()].some((count) => count > 1)) messages.push("瀛樺湪閲嶅鍗犵敤鐨勬Ы浣?);
  if (duplicateOwnedIds.length) messages.push(`${duplicateOwnedIds.length} 涓噸澶嶆嫢鏈夊ぉ璧嬶紝闇€浜哄伐纭`);
  if (duplicateOverflowIds.length) messages.push(`${duplicateOverflowIds.length} 涓孩鍑洪」宸插湪浠撳簱涓嫢鏈夛紝鍙嚜鍔ㄦ竻鐞哷);
  if (overflowChoices.length && findTalentOpenStorageSlots(talents).length) messages.push(`${overflowChoices.length} 涓孩鍑洪」鍙皾璇曞洖濉粨搴揱);
  if (equippedTalents.some((item) => Number(item.equipped_slot) > activeEquippedLimit)) messages.push("瀛樺湪灏氭湭寮€鍚殑鎼哄甫妲?);
  if (!equippedRanksValid) messages.push("褰撳墠鎼哄甫鍝侀樁瓒呰繃鍒嗘暟鍏佽鑼冨洿");
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

async function buildAdminPlayerSnapshot(
  supabase: SupabaseClientAny,
  targetNameInput: unknown,
) {
  const targetName = cleanText(targetNameInput, 40);
  if (!targetName) return { error: { message: "璇峰～鍐欑帺瀹舵樀绉? } };
  const { data: profile, error: profileError } = await supabase
    .from("player_profiles")
    .select("invite_code_hash, display_name, role, faith_god, faith_path, original_faith_god, original_faith_path, profession, ascension_score, audience_score, items, talents, updated_at")
    .eq("display_name", targetName)
    .maybeSingle();
  if (profileError) return { error: profileError };
  if (!profile) return { error: { message: "娌℃湁鎵惧埌杩欎釜鐜╁妗ｆ锛岃纭鏄电О宸蹭繚瀛? } };

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

async function repairAdminTalentState(
  supabase: SupabaseClientAny,
  targetNameInput: unknown,
) {
  const snapshot = await buildAdminPlayerSnapshot(supabase, targetNameInput);
  if (snapshot.error || !snapshot.data) return snapshot;
  const targetName = snapshot.data.profile.displayName;
  const { data: profile, error: profileError } = await supabase.from("player_profiles").select("invite_code_hash").eq("display_name", targetName).maybeSingle();
  if (profileError || !profile) return { error: profileError || { message: "鐜╁妗ｆ宸蹭笉瀛樺湪" } };
  const codeHash = cleanText(profile.invite_code_hash, 64);
  let talents = [...(snapshot.data.talents as AdminTalentRow[])];
  let overflowChoices = [...(snapshot.data.overflowChoices as Record<string, unknown>[])];
  const repaired: string[] = [];
  const unresolved: string[] = [];

  for (const talent of talents.filter((item) => item.storage_slot !== null && item.equipped_slot !== null)) {
    const { error } = await supabase.from("owned_talents").update({ storage_slot: null }).eq("id", talent.id).eq("invite_code_hash", codeHash);
    if (error) return { error };
    talent.storage_slot = null;
    repaired.push(`宸蹭慨姝ｃ€?{talent.talent_name}銆嶇殑鍙岄噸妲戒綅鍗犵敤`);
  }

  const duplicateOverflowIds = snapshot.data.anomalies.autoFixable.duplicateOverflowIds;
  if (duplicateOverflowIds.length) {
    const { error } = await supabase.from("talent_overflow_choices").delete().eq("invite_code_hash", codeHash).in("id", duplicateOverflowIds);
    if (error) return { error };
    overflowChoices = overflowChoices.filter((choice) => !duplicateOverflowIds.includes(Number(choice.id)));
    repaired.push(`宸叉竻鐞?${duplicateOverflowIds.length} 涓噸澶嶆孩鍑洪」`);
  }

  for (const talent of talents.filter((item) => item.storage_slot === null && item.equipped_slot === null)) {
    const slot = findTalentOpenStorageSlots(talents)[0];
    if (!slot) { unresolved.push(`銆?{talent.talent_name}銆嶆棤鍙敤浠撳簱妲戒綅锛屾湭鑷姩绉诲姩`); continue; }
    const { error } = await supabase.from("owned_talents").update({ storage_slot: slot, equipped_slot: null }).eq("id", talent.id).eq("invite_code_hash", codeHash);
    if (error) return { error };
    talent.storage_slot = slot;
    repaired.push(`宸插皢瀛ょ珛澶╄祴銆?{talent.talent_name}銆嶆斁鍏ヤ粨搴?${slot} 鍙蜂綅`);
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
    repaired.push(`宸插皢婧㈠嚭澶╄祴銆?{cleanText(choice.talent_name, 80)}銆嶅洖濉嚦浠撳簱 ${slot} 鍙蜂綅`);
  }

  const textResult = await updateProfileTalentText(supabase, codeHash);
  if (textResult.error) return { error: textResult.error };
  const refreshed = await buildAdminPlayerSnapshot(supabase, targetName);
  if (refreshed.error) return refreshed;
  return { data: { repaired, unresolved, snapshot: refreshed.data } };
}

async function touchInviteActivity(
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

async function getAdminTargetAccount(
  supabase: SupabaseClientAny,
  targetHashInput: unknown,
  targetNameInput: unknown = "",
) {
  const targetHash = cleanText(targetHashInput, 64);
  const targetName = cleanText(targetNameInput, 40);
  if (!targetHash && !targetName) return { error: { message: "璇峰～鍐欑洰鏍囨樀绉? } };
  if (targetHash && !/^[a-f0-9]{64}$/i.test(targetHash)) return { error: { message: "鐩爣璐﹀彿鏍囪瘑涓嶆纭? } };
  let query = supabase
    .from("invite_codes")
    .select("id, code_hash, display_name, role, is_active, last_seen_at, last_seen_action");
  query = targetHash ? query.eq("code_hash", targetHash) : query.eq("display_name", targetName);
  const { data, error } = targetHash
    ? await query.maybeSingle()
    : await query.limit(2);
  if (error) return { error };
  if (!targetHash && Array.isArray(data) && data.length > 1) return { error: { message: "杩欎釜鏄电О瀵瑰簲澶氫釜璐﹀彿锛岃鑱旂郴棣嗕富澶勭悊閲嶅悕" } };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { error: { message: "娌℃湁鎵惧埌杩欎釜璐﹀彿" } };
  return { data: row as Record<string, unknown> };
}

async function deleteRowsByHash(
  supabase: SupabaseClientAny,
  table: string,
  column: string,
  codeHash: string,
) {
  const { error } = await supabase.from(table).delete().eq(column, codeHash);
  if (error?.code === "42P01" || error?.code === "42703") return { skipped: true };
  return { error: error || null };
}

async function cleanupMemberState(
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
    .update({ is_deleted: true, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString(), content: "姝ょ敤鎴锋暟鎹凡鐢遍涓绘竻鐞? })
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

async function listAdminMembers(supabase: SupabaseClientAny) {
  const { data: invites, error: inviteError } = await supabase
    .from("invite_codes")
    .select("code_hash, display_name, role, is_active, last_seen_at, last_seen_action")
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .order("display_name", { ascending: true })
    .limit(500);
  if (inviteError?.code === "42703") return { error: { message: "璇峰厛杩愯 admin_member_talent_pool_migration_20260809.sql" } };
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

async function listAdminTalentPoolItems(supabase: SupabaseClientAny) {
  const { data, error } = await supabase
    .from("talent_pool_items")
    .select("pool_key, talent_id, talent_name, rank, effect, cooldown, action_cost, is_enabled, admin_note, updated_at")
    .order("pool_key", { ascending: true })
    .order("rank", { ascending: true })
    .order("talent_id", { ascending: true })
    .limit(2000);
  if (error?.code === "42703") return { error: { message: "璇峰厛杩愯 talent_pool_cooldown_batch_20260810.sql" } };
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

async function getNextTalentId(supabase: SupabaseClientAny, poolKey: string) {
  const { data, error } = await supabase
    .from("talent_pool_items")
    .select("talent_id")
    .eq("pool_key", poolKey)
    .order("talent_id", { ascending: false })
    .limit(1);
  if (error) return { error };
  return { data: Number(data?.[0]?.talent_id || 0) + 1 };
}

function cleanTalentPoolPayload(payload: Record<string, unknown>, requireTalentId = false) {
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
    return { error: { message: "澶╄祴姹犮€佸悕绉般€佺瓑绾т笉鑳戒负绌? } };
  }
  if (requireTalentId && !talentIdInput) return { error: { message: "鎵归噺瀵煎叆蹇呴』濉啓缂栧彿" } };
  return { data: { poolKey, talentName, rank, effect, cooldown, adminNote, isEnabled, actionCost, talentIdInput } };
}

Deno.serve(async (req) => {
  // CORS preflight must be answered before origin authorization. Browsers send
  // OPTIONS without the final request body, and rejecting it blocks every call.
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const requestOrigin = cleanText(req.headers.get("origin"), 240);
  if (requestOrigin && !allowedBrowserOrigins.has(requestOrigin)) {
    return json({ error: "鏈巿鏉冪殑缃戠珯鏉ユ簮" }, 403);
  }
  if (req.method !== "POST") return json({ error: "鍙帴鍙?POST 璇锋眰" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "鍚庣鐜鍙橀噺缂哄け" }, 500);

  const requestResult = await readRequestBody(req);
  if (!requestResult.body) return json({ error: requestResult.error || "璇锋眰鏍煎紡涓嶆纭? }, 400);
  const body = requestResult.body;

  const action = cleanText(body.action, 40);
  if (!action) return json({ error: "缂哄皯鎿嶄綔绫诲瀷" }, 400);
  if (body.payload !== undefined && !isRecord(body.payload)) return json({ error: "璇锋眰鍙傛暟鏍煎紡涓嶆纭? }, 400);
  if (isPublicReadRateLimited(req, action)) {
    return json({ error: "璇锋眰杩囦簬棰戠箒锛岃绋嶅悗鍐嶈瘯" }, 429);
  }
  const payload = body.payload ?? {};
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  if (action === "listDungeons") {
    const identity = body.inviteCode ? await getInviteIdentity(supabase, body.inviteCode) : null;
    const limit = Math.max(1, Math.min(120, Number(payload.limit || 120)));
    const { data, error } = await supabase
      .from("dungeons")
      .select(dungeonArchiveSelectFields)
      .order("avg_rating", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error?.code === "42703") return json({ error: "璇峰厛杩愯 dungeon review migration" }, 400);
    if (error) return json({ error: error.message }, 400);
    const rows = (data || [])
      .filter((dungeon) => canViewDungeonRecord(dungeon as Record<string, unknown>, identity))
      .map((dungeon) => toDungeonArchiveCard(dungeon as Record<string, unknown>, identity));
    return json({ data: rows });
  }

  if (action === "listDungeonArchivePage") {
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
    if (visibleResult.error?.code === "42703" || aggregateResult.error?.code === "42703") return json({ error: "璇峰厛杩愯 dungeon review migration" }, 400);
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

  if (action === "getDungeonDetail") {
    const identity = body.inviteCode ? await getInviteIdentity(supabase, body.inviteCode) : null;
    const dungeonId = cleanText(payload.dungeonId, 80);
    if (!isUuid(dungeonId)) return json({ error: "鍓湰 ID 涓嶆纭? }, 400);

    const selectFields = "id, name, creator, co_creators, difficulty, type, description, pinned_note, participant_count, run_count, clear_count, clear_rate, invite_code_hash, invite_name, avg_rating, rating_count, comment_count, created_at, is_one_shot, review_status, reviewed_at, reviewed_by_name, review_note";
    const { data, error } = await supabase
      .from("dungeons")
      .select(selectFields)
      .eq("id", dungeonId)
      .maybeSingle();
    if (error?.code === "42703") return json({ error: "璇峰厛杩愯 dungeon review migration" }, 400);
    if (error) return json({ error: error.message }, 400);
    if (!data || !canViewDungeonRecord(data as Record<string, unknown>, identity)) return json({ error: "璇曠偧鏈壘鍒? }, 404);

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

  if (action === "listProfiles") {
    const { data, error } = await supabase
      .from("player_profiles")
      .select("invite_code_hash, display_name, role, faith_god, faith_path, original_faith_god, original_faith_path, trickery_display_faith_god, trickery_display_faith_path, trickery_display_profession, profession, ascension_score, audience_score, show_titles, updated_at")
      .order("ascension_score", { ascending: false })
      .limit(300);
    if (error?.code === "42P01") return json({ error: "璇峰厛杩愯 player_profiles_migration.sql" }, 400);
    if (error) return json({ error: error.message }, 400);

    const profiles = (data || []).filter((profile: Record<string, unknown>) => !["god", "star"].includes(cleanText(profile.role, 20)));
    const titleResult = await getActiveTitlesByHashes(
      supabase,
      profiles.map((profile: Record<string, unknown>) => cleanText(profile.invite_code_hash, 64)),
    );
    if (titleResult.error) return json({ error: titleResult.error.message }, 400);
    const curseResult = await getActiveCursesByHashes(
      supabase,
      profiles.map((profile: Record<string, unknown>) => cleanText(profile.invite_code_hash, 64)),
    );
    if (curseResult.error) return json({ error: curseResult.error.message }, 400);

    const publicProfiles = await Promise.all(profiles.map(async (profile: Record<string, unknown>) => {
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

  const identity = await getInviteIdentity(supabase, body.inviteCode);
  if (!identity) return json({ error: "閭€璇风爜鏃犳晥鎴栧凡杩囨湡" }, 401);
  const role = identity.role;
  if (inviteDeviceSessionEnforcement && action !== "verifyInvite") {
    const sessionResult = await validateInviteSession(supabase, identity, body.sessionId, body.deviceKind);
    if (sessionResult.error) return json({ error: sessionResult.error.message || "璇烽噸鏂扮櫥褰?, code: sessionResult.error.code || "session_invalid" }, 401);
  }
  await touchInviteActivity(supabase, identity, action);

  try {
    if (action === "verifyInvite") {
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
      if (sessionResult.error) return json({ error: sessionResult.error.message || "鐧诲綍浼氳瘽绛惧彂澶辫触" }, 400);
      return json({
        role,
        label: roleLabels[role],
        name: identity.displayName,
        permissions: identity.permissions,
        sessionId: sessionResult.data?.sessionId,
        deviceKind: sessionResult.data?.deviceKind,
      });
    }

    if (action === "getMyProfile") {
      if (["god", "star"].includes(role)) return json({ role, name: identity.displayName, data: null });
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

      const { data: profile, error: profileError } = await supabase
        .from("player_profiles")
        .select("invite_code_hash, display_name, role, faith_god, faith_path, original_faith_god, original_faith_path, trickery_display_faith_god, trickery_display_faith_path, trickery_display_profession, profession, ascension_score, audience_score, items, talents, show_titles, scores_locked_at, updated_at")
        .eq("invite_code_hash", identity.codeHash)
        .maybeSingle();
      if (profileError?.code === "42P01") return json({ error: "璇峰厛杩愯 player_profiles_migration.sql" }, 400);
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

    if (action === "adminLookupPlayer") {
      if (role !== "admin") return json({ error: "鍙湁绁炶皶棣嗕富鍙互鏌ヨ鍚庡彴妗ｆ" }, 403);
      const result = await buildAdminPlayerSnapshot(supabase, payload.targetName);
      if (result.error) return json({ error: result.error.message || "鐜╁鍚庡彴妗ｆ璇诲彇澶辫触" }, 400);
      return json({ role, name: identity.displayName, data: result.data });
    }

    if (action === "adminListOperationLogs") {
      if (role !== "admin") return json({ error: "鍙湁绁炶皶棣嗕富鍙互鏌ョ湅绠＄悊鎿嶄綔鏃ュ織" }, 403);
      const result = await listAdminOperationLogs(supabase, null, 50);
      if (result.error) return json({ error: result.error.message || "绠＄悊鎿嶄綔鏃ュ織璇诲彇澶辫触" }, 400);
      return json({ role, name: identity.displayName, data: { logs: result.data || [], unavailable: !!result.unavailable } });
    }

    if (action === "adminListMembers") {
      if (role !== "admin") return json({ error: "鍙湁棣嗕富鍙互鏌ョ湅鎴愬憳鐘舵€? }, 403);
      const result = await listAdminMembers(supabase);
      if (result.error) return json({ error: result.error.message || "鎴愬憳鍒楄〃璇诲彇澶辫触" }, 400);
      return json({ role, name: identity.displayName, data: (result as any).data });
    }

    if (action === "adminSetAccountRole") {
      const delegatedRoleManager = hasPermission(identity, "account_role_manage");
      if (role !== "admin" && !delegatedRoleManager) return json({ error: "娌℃湁璐﹀彿鏉冮檺璋冩暣鏉冮檺" }, 403);
      const targetResult = await getAdminTargetAccount(supabase, payload.targetHash, payload.targetName);
      if (targetResult.error) return json({ error: targetResult.error.message || "鐩爣璐﹀彿璇诲彇澶辫触" }, 400);
      const targetAccount = targetResult.data as Record<string, unknown>;
      const targetHash = cleanText(targetAccount.code_hash, 64);
      const beforeRole = cleanText(targetAccount.role, 20);
      const nextRole = cleanText(payload.role, 20);
      const allowedRoles = new Set(["player", "author", "reviewer", "admin", "star"]);
      if (!allowedRoles.has(nextRole)) return json({ error: "鍙兘璁剧疆涓虹帺瀹躲€佷綔鑰呫€佸鏍稿憳鎴栭涓? }, 400);
      if (targetHash === identity.codeHash) return json({ error: "涓嶈兘璋冩暣褰撳墠姝ｅ湪浣跨敤鐨勯涓昏处鍙锋潈闄? }, 400);
      if (["god", "star"].includes(beforeRole)) return json({ error: "绁炴槑璐﹀彿涓嶈兘閫氳繃棣嗕富绠＄悊闈㈡澘鏀规潈" }, 403);
      if (delegatedRoleManager && !(beforeRole === "player" && nextRole === "author")) {
        return json({ error: "褰撳墠鏉冮檺鍙厑璁稿皢鐜╁鍗囩骇涓轰綔鑰? }, 403);
      }
      if (beforeRole === nextRole) return json({ error: "鐩爣璐﹀彿宸茬粡鏄繖涓潈闄? }, 400);

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
        summary: `棣嗕富灏?${cleanText(targetAccount.display_name, 40)} 鐨勬潈闄愪粠 ${beforeRole} 璋冩暣涓?${nextRole}`,
        beforeState: { role: beforeRole },
        afterState: { role: nextRole },
      });
      return json({ role, name: identity.displayName, data: { targetHash, role: nextRole } });
    }

    if (action === "adminRenameAccount") {
      if (role !== "admin") return json({ error: "鍙湁棣嗕富鍙互鏀瑰悕" }, 403);
      const targetResult = await getAdminTargetAccount(supabase, payload.targetHash);
      if (targetResult.error) return json({ error: targetResult.error.message || "鐩爣璐﹀彿璇诲彇澶辫触" }, 400);
      const targetAccount = targetResult.data as Record<string, unknown>;
      const display = cleanDisplayName(payload.displayName, "admin");
      if (display.error || !display.name) return json({ error: display.error || "鏄电О涓嶆纭? }, 400);
      const beforeName = cleanText(targetAccount.display_name, 40);
      const codeHash = cleanText(targetAccount.code_hash, 64);
      const { error: inviteError } = await supabase
        .from("invite_codes")
        .update({ display_name: display.name, last_seen_at: new Date().toISOString(), last_seen_action: "adminRenameAccount" })
        .eq("code_hash", codeHash);
      if (inviteError?.code === "23505") return json({ error: "杩欎釜鏄电О宸茬粡琚娇鐢ㄤ簡" }, 409);
      if (inviteError) return json({ error: inviteError.message }, 400);
      const [profileUpdate, titleUpdate, curseUpdate] = await Promise.all([
        supabase.from("player_profiles").update({ display_name: display.name, updated_at: new Date().toISOString() }).eq("invite_code_hash", codeHash),
        supabase.from("profile_titles").update({ display_name: display.name }).eq("invite_code_hash", codeHash),
        supabase.from("profile_curses").update({ display_name: display.name }).eq("invite_code_hash", codeHash),
      ]);
      const renameError = [profileUpdate.error, titleUpdate.error, curseUpdate.error].find((error) => error && error.code !== "42P01" && error.code !== "42703");
      if (renameError) return json({ error: renameError.message || "鏀瑰悕鍚屾澶辫触" }, 400);
      await writeAdminOperationLog(supabase, identity, {
        action: "account.rename",
        targetCodeHash: codeHash,
        targetName: beforeName,
        objectType: "invite_code",
        summary: `棣嗕富灏?${beforeName} 鏀瑰悕涓?${display.name}`,
        beforeState: { displayName: beforeName },
        afterState: { displayName: display.name },
      });
      return json({ role, name: identity.displayName, data: { codeHash, displayName: display.name } });
    }

    if (action === "adminResetAccount" || action === "adminDeleteAccount") {
      if (role !== "admin") return json({ error: "鍙湁棣嗕富鍙互绠＄悊璐﹀彿" }, 403);
      const mode = action === "adminDeleteAccount" ? "delete" : "reset";
      const targetResult = await getAdminTargetAccount(supabase, payload.targetHash);
      if (targetResult.error) return json({ error: targetResult.error.message || "鐩爣璐﹀彿璇诲彇澶辫触" }, 400);
      const targetAccount = targetResult.data as Record<string, unknown>;
      const codeHash = cleanText(targetAccount.code_hash, 64);
      const beforeName = cleanText(targetAccount.display_name, 40);
      if (codeHash === identity.codeHash) return json({ error: "涓嶈兘閲嶇疆鎴栧垹闄ゅ綋鍓嶆鍦ㄤ娇鐢ㄧ殑棣嗕富璐﹀彿" }, 400);
      const cleanupResult = await cleanupMemberState(supabase, codeHash, mode);
      if ((cleanupResult as any).error) return json({ error: (cleanupResult as any).error.message || "璐﹀彿澶勭悊澶辫触" }, 400);
      await writeAdminOperationLog(supabase, identity, {
        action: mode === "delete" ? "account.delete" : "account.reset",
        targetCodeHash: codeHash,
        targetName: beforeName,
        objectType: "invite_code",
        summary: mode === "delete" ? `棣嗕富娉ㄩ攢浜?${beforeName} 鐨勮处鍙穈 : `棣嗕富閲嶇疆浜?${beforeName} 鐨勪釜浜虹姸鎬乣,
        beforeState: { displayName: beforeName, isActive: targetAccount.is_active },
        afterState: { mode },
      });
      return json({ role, name: identity.displayName, data: { codeHash, displayName: beforeName, mode } });
    }

    if (action === "adminListTalentPoolItems") {
      if (!hasPermission(identity, "talent_pool_manage")) return json({ error: "娌℃湁澶╄祴姹犵鐞嗘潈闄? }, 403);
      const result = await listAdminTalentPoolItems(supabase);
      if (result.error) return json({ error: result.error.message || "澶╄祴浠撳簱璇诲彇澶辫触" }, 400);
      return json({ role, name: identity.displayName, data: result.data });
    }

    if (action === "adminUpsertTalentPoolItem") {
      if (!hasPermission(identity, "talent_pool_manage")) return json({ error: "娌℃湁澶╄祴姹犵鐞嗘潈闄? }, 403);
      const cleanResult = cleanTalentPoolPayload(payload);
      if (cleanResult.error) return json({ error: cleanResult.error.message }, 400);
      const { poolKey, talentName, rank, effect, cooldown, adminNote, isEnabled, actionCost, talentIdInput } = cleanResult.data;
      const nextIdResult = talentIdInput ? { data: talentIdInput, error: null as LooseError } : await getNextTalentId(supabase, poolKey);
      if (nextIdResult.error) return json({ error: nextIdResult.error.message || "澶╄祴缂栧彿鍒嗛厤澶辫触" }, 400);
      const talentId = Number(nextIdResult.data || 1);
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
        summary: `${beforeResult.data ? "鏇存柊" : "鏂板"} ${poolKey} #${talentId} 澶╄祴`,
        beforeState: beforeResult.data || {},
        afterState: { poolKey, talentId, talentName, rank, effect, cooldown, actionCost, isEnabled, adminNote },
      });
      return json({ role, name: identity.displayName, data: { poolKey, talentId, talentName, rank, effect, cooldown, actionCost, isEnabled, adminNote } });
    }

    if (action === "adminBatchUpsertTalentPoolItems") {
      if (!hasPermission(identity, "talent_pool_manage")) return json({ error: "娌℃湁澶╄祴姹犵鐞嗘潈闄? }, 403);
      const poolKey = cleanPoolKey(payload.poolKey);
      const rawItems = Array.isArray(payload.items) ? payload.items : [];
      if (!poolKey || !rawItems.length) return json({ error: "璇峰～鍐欏ぉ璧嬫睜鍜屾壒閲忓ぉ璧? }, 400);
      if (rawItems.length > 100) return json({ error: "鍗曟鏈€澶氭壒閲忎繚瀛?100 涓ぉ璧? }, 400);
      const rows = [];
      for (const [index, rawItem] of rawItems.entries()) {
        if (!isRecord(rawItem)) return json({ error: `绗?${index + 1} 琛屾牸寮忎笉姝ｇ‘` }, 400);
        const cleanResult = cleanTalentPoolPayload({ ...rawItem, poolKey }, true);
        if (cleanResult.error) return json({ error: `绗?${index + 1} 琛岋細${cleanResult.error.message}` }, 400);
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
        summary: `鎵归噺淇濆瓨 ${poolKey} ${rows.length} 涓ぉ璧媊,
        afterState: { poolKey, count: rows.length, talentIds: rows.map((row) => row.talent_id) },
      });
      return json({ role, name: identity.displayName, data: { poolKey, count: rows.length } });
    }

    if (action === "adminSetTalentPoolItemEnabled") {
      if (!hasPermission(identity, "talent_pool_manage")) return json({ error: "娌℃湁澶╄祴姹犵鐞嗘潈闄? }, 403);
      const poolKey = cleanPoolKey(payload.poolKey);
      const talentId = cleanTalentId(payload.talentId);
      const enabled = payload.enabled === true;
      if (!poolKey || !talentId) return json({ error: "澶╄祴椤圭洰涓嶅畬鏁? }, 400);
      const beforeResult = await supabase
        .from("talent_pool_items")
        .select("pool_key, talent_id, talent_name, rank, effect, action_cost, is_enabled, admin_note")
        .eq("pool_key", poolKey)
        .eq("talent_id", talentId)
        .maybeSingle();
      if (beforeResult.error) return json({ error: beforeResult.error.message }, 400);
      if (!beforeResult.data) return json({ error: "娌℃湁鎵惧埌杩欎釜澶╄祴" }, 404);
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
        summary: `${enabled ? "鍚敤" : "鍋滅敤"} ${poolKey} #${talentId}`,
        beforeState: beforeResult.data as Record<string, unknown>,
        afterState: { ...(beforeResult.data as Record<string, unknown>), is_enabled: enabled },
      });
      return json({ role, name: identity.displayName, data: { poolKey, talentId, isEnabled: enabled } });
    }

    if (action === "listHonorOperationLogs") {
      if (!canGrantTitles(identity)) return json({ error: "闇€瑕侀涓绘垨绁炴槑璋曚护" }, 403);
      const limit = Math.max(1, Math.min(50, Number(payload.limit || 30)));
      const result = await listHonorOperationLogs(supabase, identity, limit);
      if (result.error) return json({ error: result.error.message || "绉板彿璇呭拻鎿嶄綔鏃ュ織璇诲彇澶辫触" }, 400);
      return json({ role, name: identity.displayName, data: { logs: result.data || [], unavailable: !!result.unavailable } });
    }

    if (action === "listGodBelievers") {
      if (role !== "god") return json({ error: "鍙湁绁炴槑璐﹀彿鍙互鏌ョ湅鑷繁鐨勪俊寰? }, 403);
      const godName = cleanGodName(identity.displayName);
      if (!godNames.has(godName)) return json({ error: "褰撳墠绁炴槑璐﹀彿鏈粦瀹氭湁鏁堢鍚? }, 403);
      const result = await listGodBelievers(supabase, godName);
      if (result.error) return json({ error: result.error.message || "淇″緬鍒楄〃璇诲彇澶辫触" }, 400);
      return json({ role, name: identity.displayName, data: { god: godName, believers: result.data || [] } });
    }

    if (action === "godConvertBeliever") {
      if (role !== "god") return json({ error: "鍙湁绁炴槑璐﹀彿鍙互鎵ц鏀逛俊鏁曚护" }, 403);
      const actorGod = cleanGodName(identity.displayName);
      if (!godNames.has(actorGod)) return json({ error: "褰撳墠绁炴槑璐﹀彿鏈粦瀹氭湁鏁堢鍚? }, 403);

      const targetHash = cleanText(payload.targetHash, 64);
      const targetName = cleanText(payload.targetName, 40);
      if (!targetHash && !targetName) return json({ error: "璇烽€夋嫨瑕佹敼淇＄殑淇″緬" }, 400);

      const nextFaithGod = cleanGodName(payload.faithGod);
      const nextFaithPath = getFaithPathByGod(nextFaithGod);
      const nextProfession = cleanText(payload.profession, 40);
      const nextProfessionGod = getProfessionGod(nextProfession);
      if (!nextFaithGod || !nextFaithPath || !godNames.has(nextFaithGod)) return json({ error: "璇烽€夋嫨鏈夋晥鐨勬柊淇′话绁炴槑" }, 400);
      if (!nextProfession || !nextProfessionGod) return json({ error: "璇烽€夋嫨鏂颁俊浠颁笅鐨勮亴涓? }, 400);
      if (nextProfessionGod !== nextFaithGod) return json({ error: "鑱屼笟蹇呴』灞炰簬鏂扮殑淇′话绁炴槑" }, 400);

      let targetQuery = supabase
        .from("player_profiles")
        .select(godBelieverProfileSelect);
      targetQuery = targetHash ? targetQuery.eq("invite_code_hash", targetHash) : targetQuery.eq("display_name", targetName);
      const { data: targetProfile, error: targetError } = await targetQuery.maybeSingle();
      if (targetError) return json({ error: targetError.message }, 400);
      if (!targetProfile) return json({ error: "娌℃湁鎵惧埌杩欎釜淇″緬妗ｆ" }, 404);

      const beforeProfile = targetProfile as Record<string, unknown>;
      const beforeHash = cleanText(beforeProfile.invite_code_hash, 64);
      const beforeName = cleanText(beforeProfile.display_name, 40);
      const beforeFaithGod = cleanGodName(beforeProfile.faith_god);
      const beforeProfession = cleanText(beforeProfile.profession, 40);
      if (!beforeHash) return json({ error: "鐩爣淇″緬缂哄皯閭€璇风爜鍝堝笇锛屾棤娉曟墽琛屾敼淇? }, 400);
      if (beforeFaithGod !== actorGod) return json({ error: "绁炴槑鍙兘鎿嶄綔褰撳墠淇′话鑷繁鐨勪俊寰? }, 403);
      if (nextFaithGod === beforeFaithGod) return json({ error: "鍙兘鍦ㄦ敼淇′话鏃跺悓姝ユ敼鑱屼笟锛屼笉鑳藉悓淇′话鍐呭崟鐙敼鑱屼笟" }, 400);

      const curseEnabled = payload.curseEnabled === true;
      const curseText = cleanText(payload.curseName ?? payload.curseText, 32);
      const curseNote = cleanText(payload.curseEffect ?? payload.curseNote, 120);
      if (curseEnabled && (!curseText || !curseNote)) return json({ error: "鍕鹃€夎瘏鍜掑悗蹇呴』濉啓璇呭拻鍚嶅拰璇呭拻鏁堟灉" }, 400);

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

      const talentRebalance = await rebalanceTalentPoolsAfterProfileChange(supabase, beforeHash, beforeProfile, updatedProfile as Record<string, unknown>);
      if (talentRebalance.error) return json({ error: talentRebalance.error.message || "鏀逛俊鍚庡ぉ璧嬫睜鍥為€€澶辫触锛岃鑱旂郴棣嗕富妫€鏌? }, 400);
      if (talentRebalance.removedPoolKeys.length) {
        const refreshResult = await updateProfileTalentText(supabase, beforeHash);
        if (refreshResult.error) return json({ error: refreshResult.error.message || "鏀逛俊鍚庡ぉ璧嬫枃鏈埛鏂板け璐? }, 400);
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
        if (curseError?.code === "42P01") return json({ error: "璇峰厛杩愯 profile_curses_migration.sql" }, 400);
        if (curseError) return json({ error: curseError.message }, 400);
        curseData = insertedCurse as Record<string, unknown>;
      }

      await writeAdminOperationLog(supabase, identity, {
        action: "faith.convert",
        targetCodeHash: beforeHash,
        targetName: beforeName,
        objectType: "player_profile",
        summary: `绁炴槑鏀逛俊锛?{beforeName} 浠?${beforeFaithGod}/${beforeProfession} 鏀逛负 ${nextFaithGod}/${nextProfession}锛岃瑙佹竻闆禶,
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

    if (action === "adminScanTalentState") {
      if (role !== "admin") return json({ error: "鍙湁绁炶皶棣嗕富鍙互鎵弿澶╄祴鐘舵€? }, 403);
      const result = await buildAdminPlayerSnapshot(supabase, payload.targetName);
      if (result.error) return json({ error: result.error.message || "澶╄祴鐘舵€佹壂鎻忓け璐? }, 400);
      const targetResult = await getProfileByDisplayName(supabase, payload.targetName);
      await writeAdminOperationLog(supabase, identity, {
        action: "talent.scan", targetCodeHash: targetResult.data?.invite_code_hash, targetName: result.data?.profile.displayName, objectType: "talent_state",
        summary: result.data?.anomalies?.hasIssues ? "鎵弿鍙戠幇澶╄祴鐘舵€佸紓甯? : "鎵弿瀹屾垚锛屾湭鍙戠幇澶╄祴寮傚父",
        afterState: { hasIssues: !!result.data?.anomalies?.hasIssues, messages: result.data?.anomalies?.messages || [] },
      });
      return json({ role, name: identity.displayName, data: { profile: result.data?.profile, anomalies: result.data?.anomalies } });
    }

    if (action === "adminRepairTalentState") {
      if (role !== "admin") return json({ error: "鍙湁绁炶皶棣嗕富鍙互淇澶╄祴鐘舵€? }, 403);
      const result = await repairAdminTalentState(supabase, payload.targetName);
      if ((result as any).error) return json({ error: (result as any).error.message || "澶╄祴鐘舵€佷慨澶嶅け璐? }, 400);
      const targetResult = await getProfileByDisplayName(supabase, payload.targetName);
      await writeAdminOperationLog(supabase, identity, {
        action: "talent.repair", targetCodeHash: targetResult.data?.invite_code_hash, targetName: result.data?.snapshot?.profile?.displayName, objectType: "talent_state",
        summary: `瀹屾垚 ${Array.isArray(result.data?.repaired) ? result.data.repaired.length : 0} 椤瑰ぉ璧嬬姸鎬佷慨澶峘,
        afterState: { repaired: result.data?.repaired || [], unresolved: result.data?.unresolved || [] },
      });
      return json({ role, name: identity.displayName, data: (result as any).data });
    }

    if (action === "updateDisplayName") {
      if (!identity.inviteId) return json({ error: "鍏变韩閭€璇风爜涓嶈兘缁戝畾涓汉鏄电О锛岃浣跨敤涓撳睘鐮? }, 403);
      const inviteCodeText = cleanText(body.inviteCode, 200);
      const isInitialBinding = role !== "god" && cleanText(identity.displayName, 200).toLowerCase() === inviteCodeText.toLowerCase();
      if (role !== "admin" && !isInitialBinding) return json({ error: "鏄电О涓鸿韩浠界粦瀹氬瓧娈碉紝鍙湁棣嗕富鍙互鏇存敼" }, 403);

      const display = cleanDisplayName(payload.displayName, role);
      if (display.error || !display.name) return json({ error: display.error || "鏄电О涓嶆纭? }, 400);

      const { data, error } = await supabase
        .from("invite_codes")
        .update({ display_name: display.name })
        .eq("id", identity.inviteId)
        .select("id, role, display_name")
        .single();
      if (error?.code === "23505") return json({ error: "杩欎釜鏄电О宸茬粡鏈変汉缁戝畾浜? }, 409);
      if (error) return json({ error: error.message }, 400);

      await supabase
        .from("player_profiles")
        .update({ display_name: display.name, updated_at: new Date().toISOString() })
        .eq("invite_code_hash", identity.codeHash);

      return json({ role, label: roleLabels[role], name: data.display_name });
    }

    if (action === "saveProfile") {
      if (["god", "star"].includes(role)) return json({ error: "绁炴槑璐﹀彿涓嶅缓绔嬩俊寰掍釜浜烘。妗? }, 403);
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

      const faithGod = cleanText(payload.faithGod, 20);
      const faithPath = cleanText(payload.faithPath, 20);
      const profession = cleanText(payload.profession, 40);
      const items = cleanText(payload.items, 800);
      const ascensionScore = cleanScore(payload.ascensionScore);
      const audienceScore = cleanScore(payload.audienceScore);
      if (!faithGod || !faithPath || !profession) return json({ error: "涓汉妗ｆ缂哄皯淇′话鎴栬亴涓? }, 400);
      const expectedFaithPath = getFaithPathByGod(faithGod);
      const professionGod = getProfessionGod(profession);
      if (!expectedFaithPath) return json({ error: "璇烽€夋嫨鏈夋晥淇′话绁炴槑" }, 400);
      if (faithPath !== expectedFaithPath) return json({ error: "淇′话鍛介€斾笌绁炴槑涓嶅尮閰? }, 400);
      if (!professionGod) return json({ error: "璇烽€夋嫨鏈夋晥鑱屼笟" }, 400);
      if (professionGod !== faithGod) return json({ error: "鑱屼笟蹇呴』閫夋嫨褰撳墠淇′话绁炴槑涓嬬殑鑱屼笟" }, 400);

      const { data: existing, error: readError } = await supabase
        .from("player_profiles")
        .select("faith_god, faith_path, original_faith_god, original_faith_path, profession, ascension_score, audience_score, items, talents, scores_locked_at")
        .eq("invite_code_hash", identity.codeHash)
        .maybeSingle();
      if (readError?.code === "42P01") return json({ error: "璇峰厛杩愯 player_profiles_migration.sql" }, 400);
      if (readError) return json({ error: readError.message }, 400);

      const canOverride = role === "admin";
      const locked = !canOverride && existing?.faith_god && !hasTrickeryFaithPrivilege(existing) && !isProfileBindingMismatched(existing);
      const existingIsTrickery = !!existing && hasTrickeryFaithPrivilege(existing);
      const nextFaithGod = existingIsTrickery
        ? (existing.original_faith_god || existing.faith_god || "娆鸿瘓")
        : (locked ? existing.faith_god : faithGod);
      const nextFaithPath = existingIsTrickery
        ? (existing.original_faith_path || getFaithPathByGod(String(nextFaithGod)) || existing.faith_path || "铏氭棤")
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
      if (error?.code === "42P01") return json({ error: "璇峰厛杩愯 player_profiles_migration.sql" }, 400);
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

    if (action === "setProfileTitleVisibility") {
      if (["god", "star"].includes(role)) return json({ error: "绁炴槑璐﹀彿涓嶅缓绔嬩俊寰掍釜浜烘。妗? }, 403);
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);
      if (typeof payload.showTitles !== "boolean") return json({ error: "绉板彿浣╂埓鐘舵€佷笉姝ｇ‘" }, 400);

      const { data, error } = await supabase
        .from("player_profiles")
        .update({ show_titles: payload.showTitles, updated_at: new Date().toISOString() })
        .eq("invite_code_hash", identity.codeHash)
        .select("show_titles, updated_at")
        .maybeSingle();
      if (error?.code === "42703") return json({ error: "璇峰厛杩愯 profile_title_visibility_migration_20260727.sql" }, 400);
      if (error) return json({ error: error.message }, 400);
      if (!data) return json({ error: "璇峰厛淇濆瓨涓汉妗ｆ锛屽啀璁剧疆绉板彿浣╂埓鐘舵€? }, 400);
      return json({ role, name: identity.displayName, data });
    }

    if (action === "updateTrickeryFaith") {
      if (["god", "star"].includes(role)) return json({ error: "绁炴槑璐﹀彿涓嶅缓绔嬩俊寰掍釜浜烘。妗? }, 403);
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

      const faithGod = cleanText(payload.faithGod, 20);
      const faithPath = getFaithPathByGod(faithGod);
      const profession = cleanText(payload.profession, 40);
      if (!faithGod || !faithPath) return json({ error: "璇烽€夋嫨鏈夋晥淇′话绁炴槑" }, 400);
      if (!profession || getProfessionGod(profession) !== faithGod) return json({ error: "灞曠ず鑱屼笟蹇呴』灞炰簬褰撳墠灞曠ず淇′话" }, 400);

      const { data: existing, error: readError } = await supabase
        .from("player_profiles")
        .select("faith_god, faith_path, original_faith_god, original_faith_path, profession")
        .eq("invite_code_hash", identity.codeHash)
        .maybeSingle();
      if (readError?.code === "42P01") return json({ error: "璇峰厛杩愯 player_profiles_migration.sql" }, 400);
      if (readError) return json({ error: readError.message }, 400);
      if (!existing) return json({ error: "璇峰厛淇濆瓨涓汉妗ｆ" }, 400);
      if (role !== "admin" && !hasTrickeryFaithPrivilege(existing) && !isProfileBindingMismatched(existing)) {
        return json({ error: "鍙湁娆鸿瘓淇″緬鍙互鏀瑰啓淇′话妗ｇ汗" }, 403);
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
      if (error?.code === "42703") return json({ error: "璇峰厛杩愯 trickery_display_profile_migration_20260719.sql" }, 400);
      if (error) return json({ error: error.message }, 400);
      if (!data) return json({ error: "璇峰厛淇濆瓨涓汉妗ｆ" }, 400);

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

    if (action === "getPublicProfile") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin", "god"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

      const profileKey = cleanText(payload.profileKey ?? payload.profile_key, 96);
      if (!/^[a-f0-9]{64}$/i.test(profileKey)) return json({ error: "鍏紑妗ｆ鏍囪瘑涓嶆纭? }, 400);

      const { data: profiles, error: profileError } = await supabase
        .from("player_profiles")
        .select("invite_code_hash, display_name, role, faith_god, faith_path, original_faith_god, original_faith_path, trickery_display_faith_god, trickery_display_faith_path, trickery_display_profession, profession, ascension_score, audience_score, items, talents, show_titles, updated_at")
        .order("ascension_score", { ascending: false })
        .limit(1000);
      if (profileError?.code === "42P01") return json({ error: "璇峰厛杩愯 player_profiles_migration.sql" }, 400);
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
      if (!targetProfile) return json({ error: "鍏紑妗ｆ涓嶅瓨鍦ㄦ垨灏氭湭淇濆瓨" }, 404);

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

    if (action === "grantProfileTitle") {
      if (!canGrantTitles(identity)) return json({ error: "闇€瑕侀涓绘垨绁炴槑璋曚护" }, 403);

      const targetResult = await getProfileByDisplayName(supabase, payload.targetName);
      if (targetResult.error) {
        if (targetResult.error.code === "42P01") return json({ error: "璇峰厛杩愯 player_profiles_migration.sql" }, 400);
        return json({ error: targetResult.error.message }, 400);
      }

      const target = targetResult.data as Record<string, unknown>;
      const targetHash = cleanText(target.invite_code_hash, 64);
      const titleText = cleanText(payload.titleText, 32);
      const titleGod = getTitleGrantGod(identity, payload.titleGod);
      const titleNote = cleanText(payload.titleNote, 120);
      if (!targetHash || !titleText) return json({ error: "璇峰～鍐欏彈灏佹樀绉板拰绉板彿" }, 400);
      if (role === "god" && cleanText(target.faith_god, 20) !== identity.displayName) {
        return json({ error: "绁炴槑鍙兘涓哄搴斾俊寰掗檷涓嬬О鍙? }, 403);
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
      if (error?.code === "42P01") return json({ error: "璇峰厛杩愯 profile_titles_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);
      await writeAdminOperationLog(supabase, identity, {
        action: "title.grant", targetCodeHash: targetHash, targetName: target.display_name, objectType: "profile_title", objectId: data.id,
        summary: `鎺堜簣绉板彿銆?{titleText}銆峘, afterState: { title: titleText, god: titleGod, note: titleNote },
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

    if (action === "grantBetrayalCurse") {
      if (!canGrantTitles(identity)) return json({ error: "闇€瑕侀涓绘垨绁炴槑璋曚护" }, 403);

      const targetResult = await getProfileByDisplayName(supabase, payload.targetName);
      if (targetResult.error) {
        if (targetResult.error.code === "42P01") return json({ error: "璇峰厛杩愯 player_profiles_migration.sql" }, 400);
        return json({ error: targetResult.error.message }, 400);
      }

      const target = targetResult.data as Record<string, unknown>;
      const targetHash = cleanText(target.invite_code_hash, 64);
      const targetFaithGod = cleanText(target.faith_god, 20);
      const curseGod = getTitleGrantGod(identity, payload.curseGod || payload.titleGod);
      const curseNote = cleanText(payload.curseNote ?? payload.titleNote, 120);
      const curseType = normalizeCurseType(payload.curseType ?? payload.curse_type);
      const isBetrayalCurse = curseType === "betrayal";
      const curseText = cleanText(payload.curseText, 32) || (isBetrayalCurse ? "鑳屽純璇呭拻" : "鏅€氳瘏鍜?);
      if (!targetHash) return json({ error: "璇峰～鍐欏彈璇呮樀绉? }, 400);
      if (!curseGod) return json({ error: "璇烽€夋嫨璇呭拻鍚嶄箟" }, 400);
      if (role === "god" && isBetrayalCurse && (!targetFaithGod || targetFaithGod === identity.displayName)) {
        return json({ error: "瀵瑰簲绁炴槑鍙兘瀵瑰凡鏀逛俊鑰呬笅鏀捐儗寮冭瘏鍜? }, 403);
      }

      const apostateTitle = "鑳屽純鑰?;
      const { data: curseData, error: curseError } = await supabase
        .from("profile_curses")
        .insert({
          invite_code_hash: targetHash,
          display_name: cleanText(target.display_name, 40),
          curse_text: curseText,
          curse_god: curseGod,
          curse_note: curseNote,
          curse_type: curseType,
          granted_by_type: role === "god" || curseGod ? "god" : "admin",
          granted_by_hash: identity.codeHash,
          granted_by_name: identity.displayName,
          is_active: true,
        })
        .select("id, curse_text, curse_god, curse_note, curse_type, granted_by_type, granted_by_name, granted_at")
        .single();
      if (curseError?.code === "42P01") return json({ error: "璇峰厛杩愯 profile_curses_migration.sql" }, 400);
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
        if (titleResult.error?.code === "42P01") return json({ error: "璇峰厛杩愯 profile_titles_migration.sql" }, 400);
        if (titleResult.error) return json({ error: titleResult.error.message }, 400);
        titleData = titleResult.data as Record<string, unknown>;
      }
      await writeAdminOperationLog(supabase, identity, {
        action: "curse.grant", targetCodeHash: targetHash, targetName: target.display_name, objectType: "profile_curse", objectId: curseData.id,
        summary: isBetrayalCurse ? `涓嬫斁鑳屽純璇呭拻銆?{curseText}銆嶏紝骞舵巿浜堛€?{apostateTitle}銆峘 : `涓嬫斁鏅€氳瘏鍜掋€?{curseText}銆峘,
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

    if (action === "revokeProfileTitle") {
      if (!canGrantTitles(identity)) return json({ error: "闇€瑕侀涓绘垨绁炴槑璋曚护" }, 403);

      const targetResult = await getProfileByDisplayName(supabase, payload.targetName);
      if (targetResult.error) {
        if (targetResult.error.code === "42P01") return json({ error: "璇峰厛杩愯 player_profiles_migration.sql" }, 400);
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
      if (activeTitleError?.code === "42P01") return json({ error: "璇峰厛杩愯 profile_titles_migration.sql" }, 400);
      if (activeTitleError) return json({ error: activeTitleError.message }, 400);
      const activeTitle = (activeTitles || [])[0];
      if (!activeTitle) return json({ error: "杩欎釜鐜╁褰撳墠娌℃湁鐢熸晥绉板彿" }, 404);
      if (
        role === "god" &&
        cleanText((activeTitle as Record<string, unknown>).granted_by_hash, 64) !== identity.codeHash &&
        cleanText((activeTitle as Record<string, unknown>).title_god, 20) !== identity.displayName
      ) {
        return json({ error: "绁炴槑鍙兘鍥炴敹鏈鍚嶄箟涓嬬殑绉板彿" }, 403);
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
      if (!data) return json({ error: "杩欎釜鐜╁褰撳墠娌℃湁鐢熸晥绉板彿" }, 404);
      await writeAdminOperationLog(supabase, identity, {
        action: "title.revoke", targetCodeHash: targetHash, targetName: target.display_name, objectType: "profile_title", objectId: data.id,
        summary: `鍥炴敹绉板彿銆?{cleanText((data as Record<string, unknown>).title_text, 32)}銆峘, beforeState: { isActive: true }, afterState: { isActive: false },
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

    if (action === "restoreProfileTitle") {
      if (role !== "admin") return json({ error: "鍙湁绁炶皶棣嗕富鍙互鎭㈠绉板彿" }, 403);
      const targetResult = await getProfileByDisplayName(supabase, payload.targetName);
      if (targetResult.error) return json({ error: targetResult.error.message || "鐜╁妗ｆ璇诲彇澶辫触" }, 400);
      const target = targetResult.data as Record<string, unknown>;
      const targetHash = cleanText(target.invite_code_hash, 64);
      const titleId = cleanBigIntId(payload.titleId);
      if (!titleId) return json({ error: "绉板彿璁板綍涓嶆纭? }, 400);
      const { data, error } = await supabase
        .from("profile_titles")
        .update({ is_active: true, revoked_at: null, revoked_by_hash: null, revoked_by_name: null })
        .eq("id", titleId)
        .eq("invite_code_hash", targetHash)
        .eq("is_active", false)
        .select("id, title_text")
        .maybeSingle();
      if (error?.code === "42P01") return json({ error: "璇峰厛杩愯 profile_titles_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);
      if (!data) return json({ error: "鏈壘鍒板彲鎭㈠鐨勫凡鍥炴敹绉板彿" }, 404);
      await writeAdminOperationLog(supabase, identity, {
        action: "title.restore", targetCodeHash: targetHash, targetName: target.display_name, objectType: "profile_title", objectId: data.id,
        summary: `鎭㈠绉板彿銆?{cleanText((data as Record<string, unknown>).title_text, 32)}銆峘, beforeState: { isActive: false }, afterState: { isActive: true },
      });
      return json({ role, name: identity.displayName, data: { targetName: cleanText(target.display_name, 40), restoredTitle: cleanText((data as Record<string, unknown>).title_text, 32) } });
    }

    if (action === "restoreProfileCurse") {
      if (role !== "admin") return json({ error: "鍙湁绁炶皶棣嗕富鍙互鎭㈠璇呭拻" }, 403);
      const targetResult = await getProfileByDisplayName(supabase, payload.targetName);
      if (targetResult.error) return json({ error: targetResult.error.message || "鐜╁妗ｆ璇诲彇澶辫触" }, 400);
      const target = targetResult.data as Record<string, unknown>;
      const targetHash = cleanText(target.invite_code_hash, 64);
      const curseId = cleanBigIntId(payload.curseId);
      if (!curseId) return json({ error: "璇呭拻璁板綍涓嶆纭? }, 400);
      const { data, error } = await supabase
        .from("profile_curses")
        .update({ is_active: true, revoked_at: null, revoked_by_hash: null, revoked_by_name: null })
        .eq("id", curseId)
        .eq("invite_code_hash", targetHash)
        .eq("is_active", false)
        .select("id, curse_text")
        .maybeSingle();
      if (error?.code === "42P01") return json({ error: "璇峰厛杩愯 profile_curses_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);
      if (!data) return json({ error: "鏈壘鍒板彲鎭㈠鐨勫凡鍥炴敹璇呭拻" }, 404);
      await writeAdminOperationLog(supabase, identity, {
        action: "curse.restore", targetCodeHash: targetHash, targetName: target.display_name, objectType: "profile_curse", objectId: data.id,
        summary: `鎭㈠璇呭拻銆?{cleanText((data as Record<string, unknown>).curse_text, 32)}銆峘, beforeState: { isActive: false }, afterState: { isActive: true },
      });
      return json({ role, name: identity.displayName, data: { targetName: cleanText(target.display_name, 40), restoredCurse: cleanText((data as Record<string, unknown>).curse_text, 32) } });
    }

    if (action === "revokeProfileCurse") {
      if (!canGrantTitles(identity)) return json({ error: "闇€瑕侀涓绘垨绁炴槑璋曚护" }, 403);

      const targetResult = await getProfileByDisplayName(supabase, payload.targetName);
      if (targetResult.error) {
        if (targetResult.error.code === "42P01") return json({ error: "璇峰厛杩愯 player_profiles_migration.sql" }, 400);
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
      if (activeCurseError?.code === "42P01") return json({ error: "璇峰厛杩愯 profile_curses_migration.sql" }, 400);
      if (activeCurseError) return json({ error: activeCurseError.message }, 400);
      const activeCurse = (activeCurses || [])[0];
      if (!activeCurse) return json({ error: "杩欎釜鐜╁褰撳墠娌℃湁鐢熸晥璇呭拻" }, 404);
      if (
        role === "god" &&
        cleanText((activeCurse as Record<string, unknown>).granted_by_hash, 64) !== identity.codeHash &&
        cleanText((activeCurse as Record<string, unknown>).curse_god, 20) !== identity.displayName
      ) {
        return json({ error: "绁炴槑鍙兘鍥炴敹鏈鍚嶄箟涓嬬殑璇呭拻" }, 403);
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
      if (!data) return json({ error: "杩欎釜鐜╁褰撳墠娌℃湁鐢熸晥璇呭拻" }, 404);
      await writeAdminOperationLog(supabase, identity, {
        action: "curse.revoke", targetCodeHash: targetHash, targetName: target.display_name, objectType: "profile_curse", objectId: data.id,
        summary: `鍥炴敹璇呭拻銆?{cleanText((data as Record<string, unknown>).curse_text, 32)}銆峘, beforeState: { isActive: true }, afterState: { isActive: false },
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

    if (action === "checkScorePreview") {
      if (!canSettleScores(identity)) return json({ error: "闇€瑕佸鏍稿憳鏉冮檺" }, 403);
      const { entries, invalidLines } = parseScoreSettlementText(payload.textContent);
      const preview = await buildScorePreview(supabase, entries, invalidLines);
      if (preview.error?.code === "42P01") return json({ error: "璇峰厛杩愯 score_system_migration.sql" }, 400);
      if (preview.error) return json({ error: preview.error.message }, 400);
      return json({ role, name: identity.displayName, data: preview.data });
    }

    if (action === "submitScoreBatch") {
      if (!canSettleScores(identity)) return json({ error: "闇€瑕佸鏍稿憳鏉冮檺" }, 403);
      const { entries, invalidLines } = parseScoreSettlementText(payload.textContent);
      if (invalidLines.length) return json({ error: "缁撶畻鏂囨湰鏍煎紡鏈夎", data: { invalidLines } }, 400);
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
          clearStatuses: payload.clearStatuses,
          dungeonId: payload.dungeonId,
          settlementRequestId: payload.settlementRequestId,
        },
      );
      if (result.error?.code === "42P01") return json({ error: "璇峰厛杩愯 score_system_migration.sql" }, 400);
      if (result.error) return json({ error: result.error.message || "缁撶畻澶辫触", data: result.error.preview || null }, 400);
      return json({ role, name: identity.displayName, data: (result as any).data });
    }

    if (action === "submitScoreSingle") {
      if (!canSettleScores(identity)) return json({ error: "闇€瑕佸鏍稿憳鏉冮檺" }, 403);
      const nick = cleanText(payload.playerName, 40);
      const deng = cleanSettlementScore(payload.dengScore);
      const jin = cleanSettlementScore(payload.jinScore);
      const rangeMessage = checkSettlementScoreRange(deng, jin);
      if (!nick || rangeMessage) return json({ error: rangeMessage || "璇峰～鍐欑帺瀹舵樀绉? }, 400);
      const result = await commitScoreSettlement(
        supabase,
        identity,
        "single",
        payload.dungeonName,
        [{ nick, deng, jin, total: Math.round((deng + jin) * 10) / 10, line: 1, raw: `${nick}:${deng}+${jin}` }],
        {
          remark: cleanText(payload.remark, 500),
          confirmClear: payload.confirmClear === true,
          clearStatuses: payload.clearStatuses,
          dungeonId: payload.dungeonId,
          settlementRequestId: payload.settlementRequestId,
        },
      );
      if (result.error?.code === "42P01") return json({ error: "璇峰厛杩愯 score_system_migration.sql" }, 400);
      if (result.error) return json({ error: result.error.message || "琛ュ垎澶辫触", data: result.error.preview || null }, 400);
      return json({ role, name: identity.displayName, data: (result as any).data });
    }

    if (action === "listScoreSettlements") {
      if (!canSettleScores(identity)) return json({ error: "闇€瑕佸鏍稿憳鏉冮檺" }, 403);
      const limit = Math.max(1, Math.min(100, Number(payload.limit || 30)));
      const dungeonQuery = cleanText(payload.dungeonQuery, 80);
      const recentCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      let query = supabase
        .from("score_settlements")
        .select("id, dungeon_name, source_type, operator_name, total_players, total_ascension, total_audience, total_score, is_revoked, revoke_remark, created_at")
        .gte("created_at", recentCutoff)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (dungeonQuery) query = query.ilike("dungeon_name", `%${dungeonQuery}%`);
      const { data, error } = await query;
      if (error?.code === "42P01") return json({ error: "璇峰厛杩愯 score_system_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);
      return json({ role, name: identity.displayName, data: data || [] });
    }

    if (action === "getScoreSettlementDetail") {
      if (!canSettleScores(identity)) return json({ error: "闇€瑕佸鏍稿憳鏉冮檺" }, 403);
      const settlementId = cleanText(payload.settlementId, 80);
      if (!isUuid(settlementId)) return json({ error: "缁撶畻 ID 涓嶆纭? }, 400);
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
      if (!canSettleScores(identity)) return json({ error: "闇€瑕佸鏍稿憳鏉冮檺" }, 403);
      const settlementId = cleanText(payload.settlementId, 80);
      const revokeRemark = cleanText(payload.revokeRemark, 500);
      if (!isUuid(settlementId)) return json({ error: "缁撶畻 ID 涓嶆纭? }, 400);
      if (!revokeRemark) return json({ error: "璇峰～鍐欐挙閿€澶囨敞" }, 400);

      const { data: settlement, error: settlementError } = await supabase
        .from("score_settlements")
        .select("id, dungeon_name, source_type, operator_code_hash, operator_name, is_revoked")
        .eq("id", settlementId)
        .single();
      if (settlementError) return json({ error: settlementError.message }, 400);
      if (settlement.is_revoked) return json({ error: "杩欏満缁撶畻宸茬粡鎾ら攢杩? }, 409);
      if (role !== "admin" && settlement.operator_code_hash !== identity.codeHash) {
        return json({ error: "瀹℃牳鍛樺彧鑳芥挙閿€鑷繁鎻愪氦鐨勭粨绠? }, 403);
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
          content: `銆愮粨绠楁挙閿€锝滃壇鏈細${settlement.dungeon_name}銆慭n鎾ら攢浜猴細${identity.displayName}\n鐧荤鍥炴粴锛?{-Number(entry.score_deng || 0)}\n瑙愯鍥炴粴锛?{-Number(entry.score_jin || 0)}\n澶囨敞锛?{revokeRemark}`,
        }));
        const { error: messageError } = await supabase.from("score_messages").insert(revokeMessages);
        if (messageError) return json({ error: messageError.message }, 400);
      }
      await writeAdminOperationLog(supabase, identity, {
        action: "score_settlement.revoke", objectType: "score_settlement", objectId: settlementId,
        summary: `鎾ら攢鍓湰銆?{cleanText(settlement.dungeon_name, 80)}銆嶇殑缁撶畻锛屽奖鍝?${revokeLogs.length} 浣嶇帺瀹禶,
        beforeState: { isRevoked: false, playerCount: revokeLogs.length }, afterState: { isRevoked: true, revokeRemark },
      });

      return json({ role, name: identity.displayName, data: { id: settlementId } });
    }

    if (action === "listMyScoreMessages") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);
      const limit = Math.max(1, Math.min(100, Number(payload.limit || 30)));
      const { data, error } = await supabase
        .from("score_messages")
        .select("id, settlement_id, msg_type, content, is_read, created_at")
        .eq("player_code_hash", identity.codeHash)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error?.code === "42P01") return json({ error: "璇峰厛杩愯 score_system_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);
      return json({ role, name: identity.displayName, data: data || [] });
    }

    if (action === "markScoreMessageRead") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);
      const messageId = cleanBigIntId(payload.messageId);
      if (!messageId) return json({ error: "淇″皝 ID 涓嶆纭? }, 400);
      const { error } = await supabase
        .from("score_messages")
        .update({ is_read: true })
        .eq("id", messageId)
        .eq("player_code_hash", identity.codeHash);
      if (error) return json({ error: error.message }, 400);
      return json({ role, name: identity.displayName, data: { id: messageId } });
    }

    if (action === "getTalentState") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

      const state = await buildTalentState(supabase, identity);
      if (isMissingTalentTable(state.error ?? null)) return json({ error: "璇峰厛杩愯 talent_pool_migration.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
    }

    if (action === "drawTalent") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

      const poolKey = cleanPoolKey(payload.poolKey);
      const drawType = cleanText(payload.drawType, 12) === "ten" ? "ten" : "single";
      const drawCount = drawType === "ten" ? 10 : 1;
      if (!poolKey) return json({ error: "璇烽€夋嫨澶╄祴姹? }, 400);

      const profileResult = await getTalentProfile(supabase, identity);
      if (profileResult.error) {
        if (isMissingTalentTable(profileResult.error)) return json({ error: "璇峰厛杩愯 player_profiles_migration.sql" }, 400);
        return json({ error: profileResult.error.message }, 400);
      }
      const profile = profileResult.data;
      const allowedPoolKeys = getAllowedTalentPools(profile);
      if (!allowedPoolKeys.length) return json({ error: "璇峰厛淇濆瓨淇′话绁炴槑鍜屼釜浜鸿亴涓? }, 400);
      if (!allowedPoolKeys.includes(poolKey)) {
        return json({ error: "鍙兘鎶藉彇浣犵殑淇′话姹犲拰鑱屼笟姹? }, 403);
      }
      const drawState = await getTalentDrawState(supabase, identity.codeHash);
      if (isMissingTalentTable(drawState.error ?? null)) return json({ error: "璇峰厛杩愯 talent_pool_migration.sql" }, 400);
      if (drawState.error) return json({ error: drawState.error.message }, 400);

      const basicDrawsEarned = getBasicDrawsEarned(profile.ascension_score) + drawState.eventBasicDraws;
      const advancedDrawsEarned = getAdvancedDrawsEarned(profile.ascension_score) + drawState.eventAdvancedDraws;
      const basicSpentDraws = drawState.basicSpentDraws;
      const advancedSpentDraws = drawState.advancedSpentDraws;
      const basicAvailableDraws = Math.max(0, basicDrawsEarned - basicSpentDraws);
      const advancedAvailableDraws = Math.max(0, advancedDrawsEarned - advancedSpentDraws);
      const availableDraws = basicAvailableDraws + advancedAvailableDraws;
      if (availableDraws < drawCount) {
        return json({
          error: `鎶芥暟涓嶈冻锛氬綋鍓嶅彲鐢?${availableDraws} 鎶姐€傜櫥绁炰箣璺瘡鑾峰緱 ${drawScoreStep} 鍒嗗鍔?1 鎶斤紝鎶芥暟鍙敀銆俙,
        }, 400);
      }

      const { data: poolItems, error: poolError } = await supabase
        .from("talent_pool_items")
        .select("pool_key, talent_id, talent_name, rank, effect, action_cost")
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
        if (isMissingTalentTable(poolError)) return json({ error: "璇峰厛杩愯 talent_pool_migration.sql" }, 400);
        if (poolError) return json({ error: poolError.message }, 400);
      }
      if (!poolRows?.length) return json({ error: "璇ュぉ璧嬫睜鏆傛棤澶╄祴" }, 400);

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
      const results: Record<string, unknown>[] = [];
      let fragmentGainTotal = 0;
      const nextBasicSpentDraws = basicSpentDraws + basicDrawsToUse;
      const nextAdvancedSpentDraws = advancedSpentDraws + advancedDrawsToUse;
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
        return json({ error: "鎶藉彇璇锋眰宸插湪澶勭悊涓紝璇峰埛鏂板ぉ璧嬫睜鍚庡啀璇? }, 409);
      }

      for (let i = 0; i < drawCount; i += 1) {
        const isBasicDraw = i < basicDrawsToUse;
        const isStarterDraw = isBasicDraw && basicSpentDraws + i < starterTalentDrawGrant;
        const drawResult = pickDrawTalentWithGuarantee(talentItems, continueDraw, sContinueDraw, !isStarterDraw, !isBasicDraw);
        const target = drawResult.talent;
        const isB = target.rank === "B";
        const isS = target.rank === "S";
        const isGuarantee = drawResult.isGuarantee && (isB || isS);
        if (!isStarterDraw) {
          continueDraw = isB ? 0 : continueDraw + 1;
          if (!isBasicDraw) sContinueDraw = isS ? 0 : sContinueDraw + 1;
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
          actionCost: Number(target.action_cost || 0),
          rank: target.rank,
          drawTier: isBasicDraw ? "basic" : "advanced",
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
          basicDrawsUsed: basicDrawsToUse,
          advancedDrawsUsed: advancedDrawsToUse,
          results,
          fragmentGain: fragmentGainTotal,
          state: state.data,
        },
      });
    }

    if (action === "exchangeTalent") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

      const poolKey = cleanPoolKey(payload.poolKey);
      const targetTalentId = cleanTalentId(payload.targetTalentId);
      if (!poolKey || !targetTalentId) return json({ error: "鍏戞崲鐩爣涓嶆纭? }, 400);

      const profileResult = await getTalentProfile(supabase, identity);
      if (profileResult.error) {
        if (isMissingTalentTable(profileResult.error)) return json({ error: "璇峰厛淇濆瓨涓汉妗ｆ" }, 400);
        return json({ error: profileResult.error.message }, 400);
      }
      const allowedPoolKeys = getAllowedTalentPools(profileResult.data);
      if (!allowedPoolKeys.length) return json({ error: "璇峰厛淇濆瓨淇′话绁炴槑鍜屼釜浜鸿亴涓? }, 400);
      if (!allowedPoolKeys.includes(poolKey)) {
        return json({ error: "鍙兘鍏戞崲浣犵殑淇′话姹犲拰鑱屼笟姹犲ぉ璧? }, 403);
      }

      const { data: targetTalent, error: targetError } = await supabase
        .from("talent_pool_items")
        .select("pool_key, talent_id, talent_name, rank, effect, action_cost")
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
        if (isMissingTalentTable(targetError)) return json({ error: "璇峰厛杩愯 talent_pool_migration.sql" }, 400);
        if (targetError) return json({ error: targetError.message }, 400);
      }
      if (!targetTalentRow || !["A", "B"].includes(targetTalentRow.rank)) return json({ error: "鍙兘鍏戞崲璇ユ睜鐨?B/A 绾уぉ璧? }, 400);
      if (targetTalentRow.rank === "A" && !isAdvancedTalentDrawUnlocked(profileResult.data.ascension_score)) {
        return json({ error: "1500 鍒嗗悗鎵嶅紑鏀?A 绾уぉ璧嬪厬鎹? }, 403);
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
      if (owned) return json({ error: "浣犲凡缁忔嫢鏈夎繖涓ぉ璧嬩簡锛屼笉闇€瑕侀噸澶嶅厬鎹? }, 409);

      const { data: pendingSame, error: pendingSameError } = await supabase
        .from("talent_overflow_choices")
        .select("id")
        .eq("invite_code_hash", identity.codeHash)
        .eq("pool_key", poolKey)
        .eq("talent_id", targetTalentId)
        .maybeSingle();
      if (pendingSameError) return json({ error: pendingSameError.message }, 400);
      if (pendingSame) return json({ error: "杩欎釜澶╄祴宸茬粡鍦ㄥ緟鍙栬垗鍒楄〃閲屼簡锛岃鍏堝鐞? }, 409);

      const fragmentState = await getFragmentTotal(supabase, identity.codeHash);
      if (fragmentState.error) return json({ error: fragmentState.error.message }, 400);
      if (fragmentState.fragmentTotal < exchangeCost) {
        return json({
          error: `纰庣墖涓嶈冻锛氶渶瑕?${exchangeCost}锛屽綋鍓?${fragmentState.fragmentTotal}`,
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

    if (action === "resolveTalentOverflow") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

      const choiceId = cleanBigIntId(payload.choiceId);
      const decision = cleanText(payload.decision, 12);
      if (!choiceId || !["discard", "replace"].includes(decision)) return json({ error: "婧㈠嚭澶勭悊鍙傛暟涓嶆纭? }, 400);
      const replaceOwnedId = decision === "replace" ? cleanBigIntId(payload.replaceOwnedId) : 0;
      if (decision === "replace" && !replaceOwnedId) return json({ error: "璇烽€夋嫨瑕佹浛鎹㈢殑浠撳簱澶╄祴" }, 400);

      const { data: choice, error: choiceError } = await supabase
        .from("talent_overflow_choices")
        .select("id, pool_key, talent_id, talent_name, rank, source")
        .eq("id", choiceId)
        .eq("invite_code_hash", identity.codeHash)
        .maybeSingle();
      if (isMissingTalentTable(choiceError)) return json({ error: "璇峰厛杩愯 talent_inventory_migration.sql" }, 400);
      if (choiceError) return json({ error: choiceError.message }, 400);
      if (!choice) return json({ error: "寰呭鐞嗗ぉ璧嬩笉瀛樺湪鎴栧凡澶勭悊" }, 404);
      if (decision === "discard" && String(choice.rank || "").toUpperCase() === "S") {
        return json({ error: "S绾уぉ璧嬩笉鍙垎瑙ｏ紝璇烽€夋嫨淇濈暀骞舵浛鎹㈠叾浠栧ぉ璧? }, 400);
      }

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
            .select("id, storage_slot, rank")
            .eq("id", replaceOwnedId)
            .eq("invite_code_hash", identity.codeHash)
            .not("storage_slot", "is", null)
            .maybeSingle();
          if (replacedReadError) return json({ error: replacedReadError.message }, 400);
          if (!replacedRow) return json({ error: "瑕佹浛鎹㈢殑浠撳簱澶╄祴涓嶅瓨鍦ㄦ垨宸插鐞? }, 404);
          if (String(replacedRow.rank || "").toUpperCase() === "S") {
            return json({ error: "S绾уぉ璧嬩笉鍙綔涓烘浛鎹㈠垎瑙ｅ璞? }, 400);
          }
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
          .not("storage_slot", "is", null);
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

    if (action === "setEquippedTalent") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

      const equippedSlot = cleanSlot(payload.equippedSlot, equippedSlotLimit);
      const ownedTalentId = cleanBigIntId(payload.ownedTalentId);
      if (!equippedSlot) return json({ error: "鎼哄甫妲戒綅涓嶆纭? }, 400);

      const profileResult = await getTalentProfile(supabase, identity);
      if (profileResult.error) return json({ error: profileResult.error.message }, 400);
      const activeEquippedSlotLimit = getTalentSlotLimit(profileResult.data.ascension_score);
      if (equippedSlot > activeEquippedSlotLimit) {
        return json({ error: "褰撳墠鍒嗘暟灏氭湭寮€鍚繖涓惡甯︽Ы" }, 403);
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
          if (!ownedRow) return json({ error: "鍙兘鎼哄甫浠撳簱涓殑鏈僵鎴村ぉ璧? }, 404);
          owned = ownedRow as Record<string, unknown>;
          if (!canEquipTalentPool(owned.pool_key, slotRequirement)) {
            return json({ error: `${slotRequirement.label}妲藉彧鑳藉祵鍏?{slotRequirement.label}姹犲ぉ璧媊 }, 403);
          }
        }
        const prospectiveRanks = (currentEquipped || [])
          .filter((item) => Number(item.equipped_slot) !== equippedSlot && Number(item.id) !== ownedTalentId)
          .map((item) => item.rank);
        prospectiveRanks.push(owned.rank);
        if (!canEquipTalentRanks(prospectiveRanks, rankAllowance)) {
          return json({ error: `褰撳墠鍒嗘暟鏈€澶氬彧鑳芥惡甯?${rankAllowance.join("/")} 鍝侀樁缁勫悎` }, 403);
        }
      }

      if (ownedTalentId && currentSlotTalent && Number(currentSlotTalent.id) === ownedTalentId) {
        // No state change needed; the request kept the current equipped talent selected.
      } else if (ownedTalentId) {
        const sourceStorageSlot = Number(owned?.storage_slot || 0);
        if (!sourceStorageSlot) return json({ error: "浠撳簱浣嶇姸鎬佸紓甯革紝璇峰埛鏂板悗閲嶈瘯" }, 400);

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
        if (!slotResult.slot) return json({ error: "浠撳簱宸叉弧锛屾棤娉曞嵏涓嬭澶╄祴锛涜鍏堝垎瑙ｄ竴涓粨搴撳ぉ璧? }, 409);

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
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

      const ownedTalentId = cleanBigIntId(payload.ownedTalentId);
      if (!ownedTalentId) return json({ error: "浠撳簱澶╄祴涓嶆纭? }, 400);

      const { data: ownedTalent, error: ownedReadError } = await supabase
        .from("owned_talents")
        .select("id, rank")
        .eq("id", ownedTalentId)
        .eq("invite_code_hash", identity.codeHash)
        .not("storage_slot", "is", null)
        .maybeSingle();
      if (ownedReadError) return json({ error: ownedReadError.message }, 400);
      if (!ownedTalent) return json({ error: "浠撳簱澶╄祴涓嶅瓨鍦ㄦ垨宸插鐞? }, 404);
      if (String(ownedTalent.rank || "").toUpperCase() === "S") {
        return json({ error: "S绾уぉ璧嬩笉鍙垎瑙? }, 400);
      }

      const fragmentGain = getTalentFragmentGain(ownedTalent.rank);
      const { error: deleteOwnedError } = await supabase
        .from("owned_talents")
        .delete()
        .eq("id", ownedTalentId)
        .eq("invite_code_hash", identity.codeHash)
        .not("storage_slot", "is", null);
      if (deleteOwnedError) return json({ error: deleteOwnedError.message }, 400);

      const fragmentUpdate = await addUserFragments(supabase, identity.codeHash, fragmentGain);
      if (fragmentUpdate.error) return json({ error: fragmentUpdate.error.message }, 400);

      const talentTextUpdate = await updateProfileTalentText(supabase, identity.codeHash);
      if (talentTextUpdate.error) return json({ error: talentTextUpdate.error.message }, 400);
      const state = await buildTalentState(supabase, identity);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: { fragmentGain, state: state.data } });
    }

      if (action === "listMatchDungeons") {
        if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

        const keyword = cleanText(payload.keyword, 120);
        const limit = Math.max(1, Math.min(Number(payload.limit) || (keyword ? 30 : 80), 200));
        let dungeonQuery = supabase
          .from("dungeons")
          .select("id, name, creator, co_creators, difficulty, type, participant_count, run_count, clear_rate, avg_rating, rating_count, comment_count, created_at, is_one_shot");
        if (keyword) dungeonQuery = dungeonQuery.ilike("name", `%${keyword}%`);
        let { data: dungeons, error: dungeonError } = await dungeonQuery
          .order("created_at", { ascending: false })
          .limit(limit);
        if (isMissingCoCreatorsColumn(dungeonError)) {
          let fallbackQuery = supabase
            .from("dungeons")
            .select("id, name, creator, difficulty, type, participant_count, run_count, clear_rate, avg_rating, rating_count, comment_count, created_at, is_one_shot");
          if (keyword) fallbackQuery = fallbackQuery.ilike("name", `%${keyword}%`);
          const fallback = await fallbackQuery
            .order("created_at", { ascending: false })
            .limit(limit);
          dungeons = (fallback.data || []) as typeof dungeons;
          dungeonError = fallback.error;
        }
      if (isMissingMatchMusterSystem(dungeonError)) return json({ error: "璇峰厛杩愯 match_muster_migration.sql" }, 400);
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
        if (isMissingMatchSystem(queueError)) return json({ error: "璇峰厛杩愯 match_system_migration.sql" }, 400);
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
        if (isMissingMatchSystem(roomError)) return json({ error: "璇峰厛杩愯 match_system_migration.sql" }, 400);
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
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      if (!isUuid(dungeonId)) return json({ error: "鍓湰 ID 涓嶆纭? }, 400);

      const state = await getMatchState(supabase, dungeonId);
      if (isMissingMatchSystem(state.error)) return json({ error: "璇峰厛杩愯 match_system_migration.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
    }

    if (action === "joinMatchQueue") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      if (!isUuid(dungeonId)) return json({ error: "鍓湰 ID 涓嶆纭? }, 400);

      const { data: result, error } = await supabase.rpc("join_match_queue", {
        p_dungeon_id: dungeonId,
        p_player_code_hash: identity.codeHash,
        p_player_name: identity.displayName,
      });
      if (isMissingMatchSystem(error)) return json({ error: "璇峰厛杩愯 match_system_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);

      const state = await getMatchState(supabase, dungeonId);
      if (isMissingMatchSystem(state.error)) return json({ error: "璇峰厛杩愯 match_system_migration.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: { result, state: state.data } });
    }

    if (action === "cancelMatchQueue") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      if (!isUuid(dungeonId)) return json({ error: "鍓湰 ID 涓嶆纭? }, 400);

      const { data: result, error } = await supabase.rpc("cancel_match_queue", {
        p_dungeon_id: dungeonId,
        p_player_code_hash: identity.codeHash,
      });
      if (isMissingMatchSystem(error)) return json({ error: "璇峰厛杩愯 match_system_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);

      const state = await getMatchState(supabase, dungeonId);
      if (isMissingMatchSystem(state.error)) return json({ error: "璇峰厛杩愯 match_system_migration.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: { result, state: state.data } });
    }

    if (action === "createBattleRoomFromMatchRoom") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

      const matchRoomId = cleanText(payload.matchRoomId, 80);
      if (!isUuid(matchRoomId)) return json({ error: "缁勯槦鎴块棿 ID 涓嶆纭? }, 400);

      const state = await createBattleRoomFromMatchRoom(supabase, matchRoomId, identity);
      if (isMissingBattleSystem(state.error)) return json({ error: "璇峰厛杩愯 battle_room_system_20260810.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
    }

    if (action === "createBattleRoom") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      if (!isUuid(dungeonId)) return json({ error: "鍓湰 ID 涓嶆纭? }, 400);

      const state = await createBattleRoomFromDungeon(supabase, dungeonId, identity);
      if (isMissingBattleSystem(state.error)) return json({ error: "璇峰厛杩愯 battle_room_system_20260810.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
    }

    if (action === "joinBattleRoom") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

      const battleRoomId = cleanText(payload.battleRoomId, 80);
      if (!isUuid(battleRoomId)) return json({ error: "鎴樻枟鎴块棿 ID 涓嶆纭? }, 400);

      const state = await joinBattleRoom(supabase, battleRoomId, identity);
      if (isMissingBattleSystem(state.error)) return json({ error: "璇峰厛杩愯 battle_room_system_20260810.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
    }

    if (action === "getBattleRoom") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

      const battleRoomId = cleanText(payload.battleRoomId, 80);
      const matchRoomId = cleanText(payload.matchRoomId, 80);
      const dungeonId = cleanText(payload.dungeonId, 80);
      if (battleRoomId && !isUuid(battleRoomId)) return json({ error: "鎴樻枟鎴块棿 ID 涓嶆纭? }, 400);
      if (matchRoomId && !isUuid(matchRoomId)) return json({ error: "缁勯槦鎴块棿 ID 涓嶆纭? }, 400);
      if (dungeonId && !isUuid(dungeonId)) return json({ error: "鍓湰 ID 涓嶆纭? }, 400);
      if (!battleRoomId && !matchRoomId && !dungeonId) return json({ error: "缂哄皯鎴樻枟鎴块棿 ID" }, 400);

      let state = battleRoomId
        ? await getBattleRoomState(supabase, battleRoomId, identity)
        : matchRoomId
          ? await getBattleRoomByMatchRoom(supabase, matchRoomId, identity)
          : { data: null };
      if (!battleRoomId && !matchRoomId && dungeonId) {
        const { data: room, error: roomError } = await supabase
          .from("battle_rooms")
          .select("id")
          .eq("dungeon_id", dungeonId)
          .eq("host_code_hash", identity.codeHash)
          .eq("room_status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (roomError) state = { error: roomError };
        else state = room?.id ? await getBattleRoomState(supabase, String(room.id), identity) : { data: null };
      }
      if (isMissingBattleSystem(state.error)) return json({ error: "璇峰厛杩愯 battle_room_system_20260810.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
    }

    if (action === "updateBattleRoomRound") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

      const battleRoomId = cleanText(payload.battleRoomId, 80);
      if (!isUuid(battleRoomId)) return json({ error: "鎴樻枟鎴块棿 ID 涓嶆纭? }, 400);

      const state = await updateBattleRoomRound(supabase, battleRoomId, identity, payload.currentRound, payload.note);
      if (isMissingBattleSystem(state.error)) return json({ error: "璇峰厛杩愯 battle_room_system_20260810.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
    }

    if (action === "applyBattlePlayerAction") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

      const battleRoomId = cleanText(payload.battleRoomId, 80);
      const playerId = cleanBigIntId(payload.playerId);
      const battleActionType = cleanText(payload.actionType, 20);
      if (!isUuid(battleRoomId)) return json({ error: "鎴樻枟鎴块棿 ID 涓嶆纭? }, 400);
      if (!playerId) return json({ error: "鎴樻枟鎴愬憳 ID 涓嶆纭? }, 400);

      const state = await applyBattlePlayerAction(supabase, battleRoomId, playerId, identity, battleActionType, payload.amount, payload.note);
      if (isMissingBattleSystem(state.error)) return json({ error: "璇峰厛杩愯 battle_room_system_20260810.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
    }

    if (action === "finishBattleRoom") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

      const battleRoomId = cleanText(payload.battleRoomId, 80);
      if (!isUuid(battleRoomId)) return json({ error: "鎴樻枟鎴块棿 ID 涓嶆纭? }, 400);

      const state = await finishBattleRoom(supabase, battleRoomId, identity, payload.status, payload.note);
      if (isMissingBattleSystem(state.error)) return json({ error: "璇峰厛杩愯 battle_room_system_20260810.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
    }

    if (action === "startMatchMuster") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      if (!isUuid(dungeonId)) return json({ error: "鍓湰 ID 涓嶆纭? }, 400);

      const durationSeconds = Math.max(10, Math.min(Number(payload.durationSeconds) || 60, 3600));
      const { data: result, error } = await supabase.rpc("start_match_muster", {
        p_dungeon_id: dungeonId,
        p_creator_code_hash: identity.codeHash,
        p_creator_name: identity.displayName,
        p_duration_seconds: durationSeconds,
      });
      if (isMissingMatchMusterSystem(error)) return json({ error: "璇峰厛杩愯 match_muster_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);

      const musterId = cleanText((result as Record<string, unknown> | null)?.musterId, 80);
      if (!isUuid(musterId)) return json({ error: "鍙泦鍒涘缓澶辫触" }, 400);
      const state = await getMatchMusterState(supabase, musterId, identity);
      if (isMissingMatchMusterSystem(state.error)) return json({ error: "璇峰厛杩愯 match_muster_migration.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: { result, state: state.data } });
    }

    if (action === "getMatchMuster") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

      const musterId = cleanText(payload.musterId, 80);
      if (!isUuid(musterId)) return json({ error: "鍙泦 ID 涓嶆纭? }, 400);

      const state = await getMatchMusterState(supabase, musterId, identity);
      if (isMissingMatchMusterSystem(state.error)) return json({ error: "璇峰厛杩愯 match_muster_migration.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: state.data });
    }

    if (action === "joinMatchMuster") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

      const musterId = cleanText(payload.musterId, 80);
      if (!isUuid(musterId)) return json({ error: "鍙泦 ID 涓嶆纭? }, 400);

      const { data: result, error } = await supabase.rpc("join_match_muster", {
        p_muster_id: musterId,
        p_player_code_hash: identity.codeHash,
        p_player_name: identity.displayName,
      });
      if (isMissingMatchMusterSystem(error)) return json({ error: "璇峰厛杩愯 match_muster_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);

      const state = await getMatchMusterState(supabase, musterId, identity);
      if (isMissingMatchMusterSystem(state.error)) return json({ error: "璇峰厛杩愯 match_muster_migration.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: { result, state: state.data } });
    }

    if (action === "cancelMatchMuster") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

      const musterId = cleanText(payload.musterId, 80);
      if (!isUuid(musterId)) return json({ error: "鍙泦 ID 涓嶆纭? }, 400);

      const { data: result, error } = await supabase.rpc("cancel_match_muster_join", {
        p_muster_id: musterId,
        p_player_code_hash: identity.codeHash,
      });
      if (isMissingMatchMusterSystem(error)) return json({ error: "璇峰厛杩愯 match_muster_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);

      const state = await getMatchMusterState(supabase, musterId, identity);
      if (isMissingMatchMusterSystem(state.error)) return json({ error: "璇峰厛杩愯 match_muster_migration.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: { result, state: state.data } });
    }

    if (action === "drawMatchMuster") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

      const musterId = cleanText(payload.musterId, 80);
      if (!isUuid(musterId)) return json({ error: "鍙泦 ID 涓嶆纭? }, 400);

      const { data: result, error } = await supabase.rpc("draw_match_muster", {
        p_muster_id: musterId,
      });
      if (isMissingMatchMusterSystem(error)) return json({ error: "璇峰厛杩愯 match_muster_migration.sql" }, 400);
      if (error) return json({ error: error.message }, 400);

      const state = await getMatchMusterState(supabase, musterId, identity);
      if (isMissingMatchMusterSystem(state.error)) return json({ error: "璇峰厛杩愯 match_muster_migration.sql" }, 400);
      if (state.error) return json({ error: state.error.message }, 400);
      return json({ role, name: identity.displayName, data: { result, state: state.data } });
    }

    if (action === "listMyDungeons") {
      if (!hasRole(role, ["author", "reviewer", "admin", "god"])) return json({ error: "闇€瑕佷綔鑰呫€佸鏍稿憳銆佺鏄庢垨棣嗕富閭€璇风爜" }, 403);
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
      if (!hasRole(role, ["author", "reviewer", "admin", "god"])) return json({ error: "闇€瑕佷綔鑰呫€佸鏍稿憳銆佺鏄庢垨棣嗕富閭€璇风爜" }, 403);

      const name = cleanText(payload.name, 80);
      const creator = role === "god" ? identity.displayName : cleanText(payload.creator, 40);
      const coCreators = cleanCoCreators(payload.coCreators ?? payload.co_creators);
      const description = cleanText(payload.description, 1800);
      const pinnedNote = cleanText(payload.pinnedNote, 800);
      const difficulty = cleanText(payload.difficulty, 20) || "瓒呭嚒";
      const type = cleanText(payload.type, 160) || "缁煎悎";
      const participantCount = Number(payload.participantCount ?? payload.participant_count);
      const runCount = Number(payload.runCount ?? payload.run_count ?? 1);
      const isOneShot = payload.isOneShot === true || payload.is_one_shot === true || cleanText(payload.dungeonMode, 20) === "one_shot";
      if (!name || !creator || !description) return json({ error: "璇峰～鍐欏畬鏁村壇鏈俊鎭? }, 400);
      if (
        !Number.isInteger(participantCount) ||
        participantCount < 1 ||
        participantCount > 99
      ) {
        return json({ error: "鍥哄畾浜烘暟涓嶆纭? }, 400);
      }
      if (!Number.isInteger(runCount) || runCount < 1 || runCount > 999) return json({ error: "褰撳墠鍛ㄧ洰涓嶆纭? }, 400);

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
        if (!isUuid(editDungeonId)) return json({ error: "鍓湰 ID 涓嶆纭? }, 400);
        const { data: existingDungeon, error: readError } = await supabase
          .from("dungeons")
          .select("id, invite_code_hash, invite_name, creator, co_creators, clear_count")
          .eq("id", editDungeonId)
          .single();
        if (isMissingInviteColumn(readError)) return json({ error: "璇峰厛杩愯閭€璇风爜鏁版嵁搴撳崌绾?SQL" }, 400);
        if (isMissingCoCreatorsColumn(readError)) return json({ error: "璇峰厛杩愯鍚屽鍏辩瓚鏁版嵁搴撳崌绾?SQL" }, 400);
        if (readError) return json({ error: readError.message }, 400);
        if (role !== "admin" && !canManageDungeonRecord(existingDungeon as Record<string, unknown>, identity)) {
          return json({ error: "鍙湁鍓湰浣滆€呫€佸悓濂戝叡绛戣€呮垨棣嗕富鍙互閲嶉摳缁濆" }, 403);
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
        if (isMissingCoCreatorsColumn(error)) return json({ error: "璇峰厛杩愯鍚屽鍏辩瓚鏁版嵁搴撳崌绾?SQL" }, 400);
        if (isMissingDungeonReviewColumn(error)) return json({ error: "璇峰厛杩愯鍓湰瀹℃牳鏁版嵁搴撳崌绾?SQL" }, 400);
        if (isMissingForumColumn(error)) return json({ error: "璇峰厛杩愯璁哄潧鍔熻兘鏁版嵁搴撳崌绾?SQL" }, 400);
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
      if (isMissingDungeonReviewColumn(error)) return json({ error: "璇峰厛杩愯鍓湰瀹℃牳鏁版嵁搴撳崌绾?SQL" }, 400);
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
      if (!canReviewDungeons(identity)) return json({ error: "闇€瑕佸鏍稿憳銆佺鏄庢垨棣嗕富鏉冮檺" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      const decision = cleanText(payload.decision, 20);
      const reviewNote = cleanText(payload.reviewNote, 800);
      if (!isUuid(dungeonId)) return json({ error: "鍓湰 ID 涓嶆纭? }, 400);
      if (!["approve", "reject"].includes(decision)) return json({ error: "瀹℃牳缁撴灉涓嶆纭? }, 400);

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
      if (isMissingDungeonReviewColumn(error)) return json({ error: "璇峰厛杩愯鍓湰瀹℃牳鏁版嵁搴撳崌绾?SQL" }, 400);
      if (error) return json({ error: error.message }, 400);
      return json({ role, name: identity.displayName, data });
    }

    if (action === "markCleared") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      if (!isUuid(dungeonId)) return json({ error: "鍓湰 ID 涓嶆纭? }, 400);

      const { data: dungeon, error: dungeonError } = await supabase
        .from("dungeons")
        .select("run_count, invite_code_hash, invite_name, creator, co_creators, review_status")
        .eq("id", dungeonId)
        .single();
      if (dungeonError) return json({ error: dungeonError.message }, 400);
      if (!canViewDungeonRecord(dungeon as Record<string, unknown>, identity) || getDungeonReviewStatus(dungeon as Record<string, unknown>) !== "approved") {
        return json({ error: "鍓湰灏氭湭姝ｅ紡鍙戝竷锛屼笉鑳界櫥璁伴€氬叧" }, 403);
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
      if (error?.code === "23505") return json({ error: "浣犲凡缁忕櫥璁拌繃鏈懆鐩€氳繃浜? }, 409);
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
        if (retry.error?.code === "23505") return json({ error: "浣犲凡缁忕櫥璁拌繃鏈懆鐩€氳繃浜? }, 409);
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
      if (!hasRole(role, ["author", "reviewer", "admin", "god"])) return json({ error: "闇€瑕佷綔鑰呫€佸鏍稿憳銆佺鏄庢垨棣嗕富閭€璇风爜" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      if (!isUuid(dungeonId)) return json({ error: "鍓湰 ID 涓嶆纭? }, 400);

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
      if (!hasRole(role, ["player", "author", "reviewer", "admin"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      const rating = Number(payload.rating);
      if (!isUuid(dungeonId) || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        return json({ error: "璇勫垎鍙傛暟涓嶆纭? }, 400);
      }
      const { data: dungeonForRating, error: dungeonForRatingError } = await supabase
        .from("dungeons")
        .select("id, invite_code_hash, invite_name, creator, co_creators, review_status")
        .eq("id", dungeonId)
        .single();
      if (dungeonForRatingError) return json({ error: dungeonForRatingError.message }, 400);
      if (!canViewDungeonRecord(dungeonForRating as Record<string, unknown>, identity) || getDungeonReviewStatus(dungeonForRating as Record<string, unknown>) !== "approved") {
        return json({ error: "鍓湰灏氭湭姝ｅ紡鍙戝竷锛屼笉鑳借瘎鍒? }, 403);
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
      if (error?.code === "23505") return json({ error: "浣犲凡缁忚瘎浠疯繃杩欎釜鍓湰浜? }, 409);
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
      if (!hasRole(role, ["player", "author", "reviewer", "admin", "god"])) return json({ error: "闇€瑕佸叆灞€璋曚护" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      const authorInput = cleanText(payload.author, 40);
      const author = identity.inviteId ? identity.displayName : (authorInput || identity.displayName || "鍖垮悕鎺㈢储鑰?);
      const content = cleanText(payload.content, 800);
      const parentCommentId = cleanText(payload.parentCommentId, 80);
      if (!isUuid(dungeonId) || !content) return json({ error: "璇勮鍙傛暟涓嶆纭? }, 400);
      const { data: dungeonForComment, error: dungeonForCommentError } = await supabase
        .from("dungeons")
        .select("id, invite_code_hash, invite_name, creator, co_creators, review_status")
        .eq("id", dungeonId)
        .single();
      if (dungeonForCommentError) return json({ error: dungeonForCommentError.message }, 400);
      if (!canViewDungeonRecord(dungeonForComment as Record<string, unknown>, identity) || getDungeonReviewStatus(dungeonForComment as Record<string, unknown>) !== "approved") {
        return json({ error: "鍓湰灏氭湭姝ｅ紡鍙戝竷锛屼笉鑳介€掍氦璇佽█" }, 403);
      }
      if (parentCommentId) {
        if (!isUuid(parentCommentId)) return json({ error: "鍥炲鐩爣涓嶆纭? }, 400);
        const { data: parent, error: parentError } = await supabase
          .from("comments")
          .select("id, dungeon_id, is_deleted")
          .eq("id", parentCommentId)
          .single();
        if (isMissingForumColumn(parentError)) {
          return json({ error: "璇峰厛杩愯璁哄潧鍔熻兘鏁版嵁搴撳崌绾?SQL" }, 400);
        }
        if (parentError || parent?.dungeon_id !== dungeonId || parent?.is_deleted) {
          return json({ error: "鍥炲鐩爣涓嶅瓨鍦? }, 400);
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
        return json({ error: "璇峰厛杩愯璁哄潧鍔熻兘鏁版嵁搴撳崌绾?SQL" }, 400);
      }
      if (error) return json({ error: error.message }, 400);
      return json({ role, name: identity.displayName, data });
    }

    if (action === "deleteComment") {
      if (!hasRole(role, ["player", "author", "reviewer", "admin", "god"])) return json({ error: "闇€瑕侀個璇风爜" }, 403);

      const commentId = cleanText(payload.commentId, 80);
      if (!isUuid(commentId)) return json({ error: "璇勮 ID 涓嶆纭? }, 400);

      const { data: comment, error: readError } = await supabase
        .from("comments")
        .select("id, invite_code_hash, is_deleted")
        .eq("id", commentId)
        .single();
      if (isMissingForumColumn(readError)) return json({ error: "璇峰厛杩愯璁哄潧鍔熻兘鏁版嵁搴撳崌绾?SQL" }, 400);
      if (readError) return json({ error: readError.message }, 400);
      if (comment.is_deleted) return json({ role, name: identity.displayName, data: comment });
      if (role !== "admin" && comment.invite_code_hash !== identity.codeHash) {
        return json({ error: "鍙兘鍒犻櫎鑷繁鐨勮瘎璁? }, 403);
      }

      const { data, error } = await supabase
        .from("comments")
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          content: "姝よ瘎璁哄凡琚垹闄?,
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
      if (!hasRole(role, ["author", "reviewer", "admin", "god"])) return json({ error: "闇€瑕佷綔鑰呫€佸鏍稿憳銆佺鏄庢垨棣嗕富閭€璇风爜" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      const pinnedNote = cleanText(payload.pinnedNote, 800);
      if (!isUuid(dungeonId)) return json({ error: "鍓湰 ID 涓嶆纭? }, 400);

      const { data: dungeon, error: readError } = await supabase
        .from("dungeons")
        .select("id, invite_code_hash, invite_name, creator, co_creators")
        .eq("id", dungeonId)
        .single();
      if (isMissingInviteColumn(readError)) return json({ error: "璇峰厛杩愯閭€璇风爜鏁版嵁搴撳崌绾?SQL" }, 400);
      if (readError) return json({ error: readError.message }, 400);
      if (role !== "admin" && !canManageDungeonRecord(dungeon as Record<string, unknown>, identity)) {
        return json({ error: "鍙湁鍓湰浣滆€呫€佸悓濂戝叡绛戣€呮垨棣嗕富鍙互淇敼缃《璇存槑" }, 403);
      }

      const { data, error } = await supabase
        .from("dungeons")
        .update({ pinned_note: pinnedNote })
        .eq("id", dungeonId)
        .select()
        .single();
      if (isMissingForumColumn(error)) return json({ error: "璇峰厛杩愯璁哄潧鍔熻兘鏁版嵁搴撳崌绾?SQL" }, 400);
      if (error) return json({ error: error.message }, 400);
      return json({ role, name: identity.displayName, data });
    }

    if (action === "deleteDungeon") {
      if (!hasRole(role, ["author", "reviewer", "admin", "god"])) return json({ error: "闇€瑕佷綔鑰呫€佸鏍稿憳銆佺鏄庢垨棣嗕富閭€璇风爜" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      if (!isUuid(dungeonId)) return json({ error: "鍓湰 ID 涓嶆纭? }, 400);

      const { data: dungeon, error: readError } = await supabase
        .from("dungeons")
        .select("id, invite_code_hash, invite_name, creator, co_creators")
        .eq("id", dungeonId)
        .single();
      if (isMissingInviteColumn(readError)) return json({ error: "璇峰厛杩愯閭€璇风爜鏁版嵁搴撳崌绾?SQL" }, 400);
      if (readError) return json({ error: readError.message }, 400);
      if (role !== "admin" && !canManageDungeonRecord(dungeon as Record<string, unknown>, identity)) {
        return json({ error: "鍙湁鍓湰浣滆€呫€佸悓濂戝叡绛戣€呮垨棣嗕富鍙互灏佸瓨璇曠偧" }, 403);
      }

      const { error } = await supabase.from("dungeons").delete().eq("id", dungeonId);
      if (error) return json({ error: error.message }, 400);
      return json({ role, name: identity.displayName, data: { id: dungeonId } });
    }

    return json({ error: "鏈煡鎿嶄綔" }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "鍚庣澶勭悊澶辫触" }, 500);
  }
});

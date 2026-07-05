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

const roleLabels: Record<InviteRole, string> = {
  player: "玩家",
  author: "作者",
  admin: "馆主",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getInviteRole(inviteCode: unknown): InviteRole | null {
  const code = cleanText(inviteCode, 200);
  if (!code) return null;

  const adminCode = Deno.env.get("DUNGEON_ADMIN_CODE")?.trim();
  const authorCode = Deno.env.get("DUNGEON_AUTHOR_CODE")?.trim();
  const playerCode = Deno.env.get("DUNGEON_PLAYER_CODE")?.trim();

  if (adminCode && code === adminCode) return "admin";
  if (authorCode && code === authorCode) return "author";
  if (playerCode && code === playerCode) return "player";
  return null;
}

function hasRole(role: InviteRole, allowed: InviteRole[]) {
  return allowed.includes(role);
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

  const role = getInviteRole(body.inviteCode);
  if (!role) return json({ error: "邀请码无效或已过期" }, 401);

  const action = cleanText(body.action, 40);
  const payload = body.payload ?? {};
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    if (action === "verifyInvite") {
      return json({ role, label: roleLabels[role] });
    }

    if (action === "submitDungeon") {
      if (!hasRole(role, ["author", "admin"])) return json({ error: "需要作者邀请码" }, 403);

      const name = cleanText(payload.name, 80);
      const creator = cleanText(payload.creator, 40);
      const description = cleanText(payload.description, 1800);
      const difficulty = cleanText(payload.difficulty, 20) || "超凡";
      const type = cleanText(payload.type, 20) || "综合";
      if (!name || !creator || !description) return json({ error: "请填写完整副本信息" }, 400);

      const { data, error } = await supabase
        .from("dungeons")
        .insert({ name, creator, difficulty, type, description })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ role, data });
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
        .insert({ dungeon_id: dungeonId, rating })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ role, data });
    }

    if (action === "addComment") {
      if (!hasRole(role, ["player", "author", "admin"])) return json({ error: "需要玩家或作者邀请码" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      const author = cleanText(payload.author, 40) || "匿名探索者";
      const content = cleanText(payload.content, 500);
      if (!isUuid(dungeonId) || !content) return json({ error: "评论参数不正确" }, 400);

      const { data, error } = await supabase
        .from("comments")
        .insert({ dungeon_id: dungeonId, author, content })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ role, data });
    }

    if (action === "deleteDungeon") {
      if (!hasRole(role, ["admin"])) return json({ error: "需要馆主邀请码" }, 403);

      const dungeonId = cleanText(payload.dungeonId, 80);
      if (!isUuid(dungeonId)) return json({ error: "副本 ID 不正确" }, 400);

      const { error } = await supabase.from("dungeons").delete().eq("id", dungeonId);
      if (error) return json({ error: error.message }, 400);
      return json({ role, data: { id: dungeonId } });
    }

    return json({ error: "未知操作" }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "后端处理失败" }, 500);
  }
});

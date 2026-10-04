// 个人账户（账号名 + 密码）登录 —— 挂在现有邀请码身份之上。
//
// 设计：不引入 Supabase Auth。在 invite_codes 行上存账号名与密码哈希；
// 绑定账号时把明文邀请码加密存入 code_enc，登录成功后解密回传，
// 前端继续沿用原有邀请码会话（saveInviteSession），其余 100+ action 零改动。
//
// 本文件自带全部加密/校验辅助，除 _shared/core.ts 的既有导出外无其他依赖。
import {
  cleanDeviceKind, cleanText, getInviteIdentity, inviteDeviceSessionEnforcement,
  issueInviteSession, json, roleLabels,
} from "../_shared/core.ts";
import type { Ctx, InviteIdentity, InviteRole } from "../_shared/core.ts";

// ==================== 本地辅助 ====================
const PBKDF2_ITERATIONS = 100000;
const USERNAME_RE = /^[A-Za-z0-9_\u4e00-\u9fa5]{2,16}$/;
const VALID_ROLES: InviteRole[] = ["player", "author", "reviewer", "admin", "god", "astral"];

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function cleanUsername(value: unknown): string {
  const username = cleanText(value, 32);
  return USERNAME_RE.test(username) ? username : "";
}

export function cleanPassword(value: unknown): string {
  const password = String(value ?? "");
  return password.length >= 6 && password.length <= 72 ? password : "";
}

async function derivePasswordBits(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const params: Pbkdf2Params = { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" };
  const bits = await crypto.subtle.deriveBits(params, keyMaterial, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derivePasswordBits(password, salt);
  return { hash: bytesToBase64(bits), salt: bytesToBase64(salt) };
}

export async function verifyPassword(password: string, hashB64: unknown, saltB64: unknown): Promise<boolean> {
  if (!password) return false;
  const hashText = cleanText(hashB64, 200);
  const saltText = cleanText(saltB64, 200);
  if (!hashText || !saltText) return false;
  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = base64ToBytes(saltText);
    expected = base64ToBytes(hashText);
  } catch {
    return false;
  }
  const bits = await derivePasswordBits(password, salt);
  if (bits.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expected[i];
  return diff === 0;
}

async function deriveCodeKey(): Promise<CryptoKey> {
  const secret = `${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""}:account-code-v1`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptInviteCode(code: string): Promise<string> {
  const key = await deriveCodeKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const params: AesGcmParams = { name: "AES-GCM", iv };
  const cipher = new Uint8Array(await crypto.subtle.encrypt(params, key, new TextEncoder().encode(code)));
  const combined = new Uint8Array(iv.length + cipher.length);
  combined.set(iv, 0);
  combined.set(cipher, iv.length);
  return bytesToBase64(combined);
}

async function decryptInviteCode(value: unknown): Promise<string> {
  const text = cleanText(value, 500);
  if (!text) return "";
  try {
    const key = await deriveCodeKey();
    const combined = base64ToBytes(text);
    const iv = combined.slice(0, 12);
    const cipher = combined.slice(12);
    const params: AesGcmParams = { name: "AES-GCM", iv };
    const plain = await crypto.subtle.decrypt(params, key, cipher);
    return new TextDecoder().decode(plain);
  } catch {
    return "";
  }
}

// 账号登录后统一签发会话（复用既有 invite_sessions 机制）
async function issueSessionForLogin(ctx: Ctx): Promise<{ sessionId: string; deviceKind: string }> {
  const deviceKind = cleanDeviceKind(ctx.body.deviceKind);
  if (!inviteDeviceSessionEnforcement) return { sessionId: "", deviceKind };
  const identity = ctx.identity;
  if (!identity) return { sessionId: "", deviceKind };
  const result = await issueInviteSession(ctx.supabase, identity, ctx.body.deviceKind, ctx.req.headers.get("user-agent"));
  if (result.error) return { sessionId: "", deviceKind };
  return { sessionId: result.data?.sessionId ?? "", deviceKind: result.data?.deviceKind ?? deviceKind };
}

// action: registerAccount —— 邀请码作为注册门槛，首次自助绑定「账号名 + 密码」。
export async function handleRegisterAccount(ctx: Ctx) {
  const { supabase } = ctx;
  const inviteCode = cleanText(ctx.body.inviteCode, 200);
  const username = cleanUsername(ctx.payload.username);
  const password = cleanPassword(ctx.payload.password);
  if (!username) return json({ error: "账号名需 2-16 位（中文 / 字母 / 数字 / 下划线）" }, 400);
  if (!password) return json({ error: "密码需 6-72 位" }, 400);
  if (!inviteCode) return json({ error: "请填写你的入局谕令" }, 400);

  const identity = await getInviteIdentity(supabase, inviteCode);
  if (!identity) return json({ error: "谕令无效或已失效" }, 401);
  const inviteId = identity.inviteId;
  if (!inviteId) return json({ error: "谕令无效或已失效" }, 401);

  const existing = await supabase
    .from("invite_codes")
    .select("id, username")
    .eq("id", inviteId)
    .maybeSingle();
  if (existing.error) return json({ error: existing.error.message }, 400);
  if (!existing.data) return json({ error: "谕令不存在" }, 404);
  if (existing.data.username) return json({ error: "该谕令已绑定账号，请直接登录" }, 409);

  const { hash, salt } = await hashPassword(password);
  const codeEnc = await encryptInviteCode(inviteCode);
  const updateResult = await supabase
    .from("invite_codes")
    .update({
      username,
      username_key: username.toLowerCase(),
      password_hash: hash,
      password_salt: salt,
      code_enc: codeEnc,
      account_linked_at: new Date().toISOString(),
    })
    .eq("id", inviteId);
  if (updateResult.error) {
    const code = updateResult.error.code;
    if (code === "23505") return json({ error: "该账号名已被占用，请换一个" }, 409);
    if (code === "23514") return json({ error: "账号名格式不符合要求" }, 400);
    if (code === "42703") return json({ error: "账号体系未初始化，请先运行账号迁移 SQL" }, 500);
    return json({ error: updateResult.error.message }, 400);
  }

  ctx.identity = identity;
  const session = await issueSessionForLogin(ctx);
  return json({
    role: identity.role,
    label: roleLabels[identity.role],
    name: identity.displayName,
    permissions: identity.permissions,
    sessionId: session.sessionId,
    deviceKind: session.deviceKind,
    inviteCode,
  });
}

// action: loginAccount —— 账号名 + 密码登录，成功后解密回传谕令，复用原有身份。
export async function handleLoginAccount(ctx: Ctx) {
  const { supabase } = ctx;
  const username = cleanUsername(ctx.payload.username);
  const password = cleanPassword(ctx.payload.password);
  if (!username || !password) return json({ error: "账号名或密码不正确" }, 401);

  const result = await supabase
    .from("invite_codes")
    .select("id, code_hash, role, display_name, is_active, permissions, session_generation, password_hash, password_salt, code_enc")
    .eq("username_key", username.toLowerCase())
    .maybeSingle();
  if (result.error) {
    if (result.error.code === "42703") return json({ error: "账号体系未初始化，请先运行账号迁移 SQL" }, 500);
    return json({ error: result.error.message }, 400);
  }
  const row = result.data;
  if (!row || !row.is_active) return json({ error: "账号名或密码不正确" }, 401);

  const role = row.role as InviteRole;
  if (!VALID_ROLES.includes(role)) return json({ error: "账号名或密码不正确" }, 401);

  const ok = await verifyPassword(password, row.password_hash, row.password_salt);
  if (!ok) return json({ error: "账号名或密码不正确" }, 401);

  const inviteCode = await decryptInviteCode(row.code_enc);
  if (!inviteCode) return json({ error: "账号凭据异常，请联系馆主重置" }, 400);

  const identity: InviteIdentity = {
    role,
    codeHash: cleanText(row.code_hash, 64),
    displayName: cleanText(row.display_name, 40) || roleLabels[role],
    inviteId: cleanText(row.id, 80),
    permissions: Array.isArray(row.permissions) ? (row.permissions as string[]) : [],
    sessionGeneration: Number(row.session_generation || 0),
  };
  ctx.identity = identity;
  const session = await issueSessionForLogin(ctx);
  return json({
    role,
    label: roleLabels[role],
    name: identity.displayName,
    permissions: identity.permissions,
    sessionId: session.sessionId,
    deviceKind: session.deviceKind,
    inviteCode,
  });
}

// action: changePassword —— 玩家自助修改自己的登录密码（需校验当前密码，仅改密码）
export async function handleChangePassword(ctx: Ctx) {
  const { supabase, identity } = ctx;
  if (!identity) return json({ error: "请先登录" }, 401);
  const oldPassword = cleanPassword(ctx.payload.oldPassword);
  const newPassword = cleanPassword(ctx.payload.newPassword);
  if (!oldPassword) return json({ error: "请输入当前密码" }, 400);
  if (!newPassword) return json({ error: "新密码需 6-72 位" }, 400);
  if (oldPassword === newPassword) return json({ error: "新密码不能与当前密码相同" }, 400);

  const result = await supabase
    .from("invite_codes")
    .select("code_hash, password_hash, password_salt")
    .eq("code_hash", identity.codeHash)
    .maybeSingle();
  if (result.error) return json({ error: result.error.message }, 400);
  const row = result.data;
  if (!row || !row.password_hash || !row.password_salt) return json({ error: "账号凭据异常，请联系馆主重置" }, 400);

  const ok = await verifyPassword(oldPassword, row.password_hash, row.password_salt);
  if (!ok) return json({ error: "当前密码不正确" }, 401);

  const { hash, salt } = await hashPassword(newPassword);
  const updateResult = await supabase
    .from("invite_codes")
    .update({ password_hash: hash, password_salt: salt })
    .eq("code_hash", identity.codeHash);
  if (updateResult.error) return json({ error: updateResult.error.message }, 400);

  return json({ role: identity.role, name: identity.displayName, data: { changed: true } });
}

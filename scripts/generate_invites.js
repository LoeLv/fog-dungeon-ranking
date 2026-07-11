const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);

function readNumber(name, fallback) {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = Number(args[index + 1]);
  if (!Number.isInteger(value) || value < 0) throw new Error(`--${name} must be a non-negative integer`);
  return value;
}

function readString(name, fallback) {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : String(args[index + 1] || fallback);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function escapeSql(value) {
  return String(value).replace(/'/g, "''");
}

function codeFor(role) {
  return `${role}-${crypto.randomBytes(5).toString("hex")}`;
}

function pad(index, total) {
  return String(index).padStart(String(Math.max(total, 9)).length, "0");
}

const players = readNumber("players", 80);
const authors = readNumber("authors", 0);
const reviewers = readNumber("reviewers", 0);
const admins = readNumber("admins", 0);
const gods = readNumber("gods", 0);
const prefix = readString("prefix", "诸神愚戏");

const godNames = [
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
];

const rows = [];
for (let i = 1; i <= players; i += 1) {
  rows.push({ role: "player", displayName: `玩家${pad(i, players)}`, code: codeFor("player") });
}
for (let i = 1; i <= authors; i += 1) {
  rows.push({ role: "author", displayName: `作者${pad(i, authors)}`, code: codeFor("author") });
}
for (let i = 1; i <= reviewers; i += 1) {
  rows.push({ role: "reviewer", displayName: `审核员${pad(i, reviewers)}`, code: codeFor("reviewer") });
}
for (let i = 1; i <= admins; i += 1) {
  rows.push({ role: "admin", displayName: `馆主${pad(i, admins)}`, code: codeFor("admin") });
}
for (let i = 0; i < Math.min(gods, godNames.length); i += 1) {
  rows.push({ role: "god", displayName: godNames[i], code: codeFor("god") });
}

const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const outputDir = path.join(process.cwd(), "private_invites");
fs.mkdirSync(outputDir, { recursive: true });

const csvPath = path.join(outputDir, `invite_codes_${stamp}.csv`);
const sqlPath = path.join(outputDir, `invite_codes_${stamp}.sql`);

const csv = [
  "display_name,role,invite_code",
  ...rows.map((row) => `${row.displayName},${row.role},${row.code}`),
].join("\n");

const values = rows.map((row) => {
  const note = `${prefix} ${row.role} invite`;
  return `('${sha256(row.code)}', '${escapeSql(row.displayName)}', '${row.role}', '${escapeSql(note)}')`;
});

const sql = `-- Generated invite-code seed. Plaintext codes are only in the CSV file.\n` +
  `-- Run this in Supabase SQL Editor after per_person_invites_migration.sql.\n\n` +
  `insert into public.invite_codes (code_hash, display_name, role, note)\nvalues\n` +
  values.join(",\n") +
  `\non conflict (code_hash) do update set\n` +
  `  display_name = excluded.display_name,\n` +
  `  role = excluded.role,\n` +
  `  note = excluded.note,\n` +
  `  is_active = true;\n`;

fs.writeFileSync(csvPath, csv, "utf8");
fs.writeFileSync(sqlPath, sql, "utf8");

console.log(`Generated ${rows.length} invite codes.`);
console.log(`CSV: ${csvPath}`);
console.log(`SQL: ${sqlPath}`);

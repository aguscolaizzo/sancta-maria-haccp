import assert from "node:assert/strict";
import { test, after } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { build } from "esbuild";
import { unzipSync, strFromU8, zipSync } from "fflate";

const directory = new URL("../.sites-runtime/backup-tests/", import.meta.url);
await mkdir(directory, { recursive: true });
const compiled = new URL("routes.mjs", directory);
await build({
  stdin: { contents: 'export {GET} from "./app/api/backup/route.ts";', resolveDir: new URL("..", import.meta.url).pathname },
  bundle: true, platform: "node", format: "esm", outfile: compiled.pathname, logLevel: "silent",
  plugins: [{ name: "backup-runtime", setup(build) {
    build.onResolve({ filter: /^(cloudflare:workers|next\/headers|next\/navigation)$/ }, (args) => ({ path: args.path, namespace: "mock" }));
    build.onLoad({ filter: /.*/, namespace: "mock" }, (args) => ({ contents:
      args.path === "cloudflare:workers" ? "export const env=globalThis.backupTestEnv;" :
      args.path === "next/headers" ? "export async function headers(){return new Headers(globalThis.backupTestHeaders)}" :
      "export function redirect(url){throw new Error(url)}" }));
  } }],
});

let sqlite;
const mediaBytes = new TextEncoder().encode("photo-bytes-é-".repeat(400));
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const bigValue = "signature/photos/'/é/".repeat(5000);
const mediaMetadata = { key: "owner-a/photos/evidence.jpg", etag: "etag-1", size: mediaBytes.length };

function reset(role = "owner") {
  sqlite?.close();
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`CREATE TABLE register_members(owner_id TEXT,user_id TEXT,status TEXT,role TEXT,revision INTEGER);
    CREATE TABLE records(id TEXT PRIMARY KEY, signature TEXT, notes TEXT, nullable TEXT, binary BLOB);
    CREATE UNIQUE INDEX record_notes ON records(notes);
    CREATE TABLE preparation_label_photos(id TEXT PRIMARY KEY, object_key TEXT,content_sha256 TEXT,byte_size INTEGER,deleted_at TEXT,record_id TEXT REFERENCES records(id));`);
  sqlite.prepare("INSERT INTO records VALUES(?,?,?,?,?)").run("r1", bigValue, "quote ' and NUL \0 and é", null, new Uint8Array([0, 127, 255]));
  sqlite.prepare("INSERT INTO preparation_label_photos VALUES(?,?,?,?,?,?)").run("p1", mediaMetadata.key, digest(mediaBytes), mediaBytes.length, null, "r1");
  if (role === "contributor" || role === "admin") sqlite.prepare("INSERT INTO register_members VALUES(?,?,?,?,?)").run("owner-a", "member-b", "active", role, 1);
  globalThis.backupTestHeaders = role === "anonymous" ? {} : { "oai-authenticated-user-email": "owner@example.test", "oai-authenticated-user-id": role === "owner" ? "owner-a" : "member-b" };
  const wrap = (sql) => ({
    bind(...values) { return { async first() { return sqlite.prepare(sql).get(...values) ?? null; } }; },
    async all() { return { success: true, results: sqlite.prepare(sql).all().map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Uint8Array ? [...value] : value]))) }; },
  });
  const env = globalThis.backupTestEnv;
  env.REGISTER_OWNER_ID = "owner-a";
  env.READING_IMPORT_JSON = '{"private":"restore-only"}';
  env.DB = { prepare: wrap, async batch(items) { return Promise.all(items.map((item) => item.all())); } };
  env.MEDIA = {
    async list() { return { objects: [mediaMetadata], truncated: false }; },
    async get() { return { ...mediaMetadata, httpMetadata: { contentType: "image/jpeg" }, async arrayBuffer() { return mediaBytes.slice().buffer; } }; },
  };
}
globalThis.backupTestEnv = {};
const { GET } = await import(compiled.href);
after(() => sqlite?.close());
const request = (site = "same-origin") => new Request("https://app.test/api/backup", { headers: { "sec-fetch-site": site } });

test("complete ZIP keeps long fields, media, source and exact configuration; Python restores SQLite", async () => {
  reset();
  const response = await GET(request());
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Disposition"), /attachment; filename="Sancta_Maria/);
  assert.match(response.headers.get("Cache-Control"), /no-store/);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const entries = unzipSync(bytes);
  const manifest = JSON.parse(strFromU8(entries["manifest.json"]));
  const database = JSON.parse(strFromU8(entries["database.json"]));
  assert.equal(database.tables.records[0].signature, bigValue);
  assert.equal(database.tables.records[0].notes, "quote ' and NUL \0 and é");
  assert.deepEqual(database.tables.records[0].binary, [0, 127, 255]);
  assert.equal(manifest.mediaObjects, 1);
  assert.equal(manifest.tables.records, 1);
  const media = JSON.parse(strFromU8(entries["media-index.json"]));
  assert.deepEqual(entries[media[0].file], mediaBytes);
  assert.equal(JSON.parse(strFromU8(entries["configuration.json"])).environment.READING_IMPORT_JSON, '{"private":"restore-only"}');
  const source = unzipSync(entries["source.zip"]);
  assert.ok(source["package-lock.json"] && source[".openai/hosting.json"] && source["scripts/restore-backup.py"]);
  assert.equal(source["lib/backup-source.generated.ts"], undefined);
  assert.equal(Object.keys(source).some((name) => name.startsWith(".env") || name.startsWith("node_modules/")), false);
  const backup = new URL("roundtrip.zip", directory);
  await writeFile(backup, bytes);
  const output = new URL("restored/", directory);
  await rm(output, { recursive: true, force: true });
  const check = JSON.parse(execFileSync("python3", ["scripts/restore-backup.py", backup.pathname, "--check-only"], { encoding: "utf8" }));
  assert.equal(check.status, "verified");
  execFileSync("python3", ["scripts/restore-backup.py", backup.pathname, "--output", output.pathname]);
  const restored = new DatabaseSync(new URL("database.sqlite", output).pathname);
  assert.equal(restored.prepare("SELECT signature FROM records").get().signature, bigValue);
  assert.deepEqual([...restored.prepare("SELECT binary FROM records").get().binary], [0, 127, 255]);
  restored.close();
  const sqlRestored = new DatabaseSync(":memory:");
  sqlRestored.exec("BEGIN;\n" + strFromU8(entries["database.sql"]) + "\nCOMMIT;");
  assert.equal(sqlRestored.prepare("SELECT notes FROM records").get().notes, "quote ' and NUL \0 and é");
  sqlRestored.close();
  assert.throws(() => execFileSync("python3", ["scripts/restore-backup.py", backup.pathname, "--output", output.pathname], { stdio: "pipe" }), /Command failed/);
  const corrupted = { ...entries, "database.json": new TextEncoder().encode("{}") };
  const corruptPath = new URL("corrupt.zip", directory);
  await writeFile(corruptPath, zipSync(corrupted));
  assert.throws(() => execFileSync("python3", ["scripts/restore-backup.py", corruptPath.pathname, "--check-only"], { stdio: "pipe" }), /Command failed/);
});

for (const role of ["anonymous", "contributor", "admin"]) test(`backup is denied to ${role}`, async () => {
  reset(role);
  const response = await GET(request());
  assert.equal(response.status, role === "anonymous" ? 401 : 403);
  assert.notEqual(response.headers.get("Content-Type"), "application/zip");
});

test("cross-site requests are refused", async () => {
  reset();
  assert.equal((await GET(request("cross-site"))).status, 403);
});

test("missing or changed media fails without producing a partial ZIP", async () => {
  reset();
  globalThis.backupTestEnv.MEDIA.get = async () => null;
  const response = await GET(request());
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /photo/);
});

test("media pages are followed and an unstable final inventory is rejected", async () => {
  reset();
  let calls = 0;
  globalThis.backupTestEnv.MEDIA.list = async ({ cursor }) => {
    calls += 1;
    if (calls === 1) return { objects: [], truncated: true, cursor: "page-two" };
    if (calls === 2) { assert.equal(cursor, "page-two"); return { objects: [mediaMetadata], truncated: false }; }
    return { objects: [], truncated: false };
  };
  assert.equal((await GET(request())).status, 503);
  assert.equal(calls, 3);
});

import { strToU8, zipSync, type Zippable } from "fflate";
import { backupSource } from "./backup-source.generated";

type Row = Record<string, unknown>;
type SchemaEntry = { type: string; name: string; tbl_name: string; sql: string };
type Database = { prepare(sql: string): { all<T = Row>(): Promise<{ results: T[] }> }; batch(statements: unknown[]): Promise<{ results: Row[]; success?: boolean }[]> };
type MediaObject = { key: string; etag: string; size: number; httpMetadata?: unknown; customMetadata?: unknown };
type Media = {
  list(options: { cursor?: string; include: string[] }): Promise<{ objects: MediaObject[]; truncated: boolean; cursor?: string }>;
  get(key: string): Promise<(MediaObject & { arrayBuffer(): Promise<ArrayBuffer> }) | null>;
};

const MAX_BYTES = 32 * 1024 * 1024;
const nameQuoted = (name: string) => '"' + name.replaceAll('"', '""') + '"';
const encoder = new TextEncoder();
export async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, "0")).join("");
}

function sqlValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Valeur numérique non exportable.");
    return String(value);
  }
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "string") {
    // Hex avoids losing embedded NULs and preserves the exact UTF-8 string.
    if (value.includes("\0")) return "CAST(X'" + [...encoder.encode(value)].map((x) => x.toString(16).padStart(2, "0")).join("") + "' AS TEXT)";
    return "'" + value.replaceAll("'", "''") + "'";
  }
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value) || Array.isArray(value)) {
    const bytes = Array.isArray(value) ? new Uint8Array(value) : value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return "X'" + [...bytes].map((x) => x.toString(16).padStart(2, "0")).join("") + "'";
  }
  throw new Error("Type de donnée non exportable.");
}

async function mediaInventory(media: Media) {
  const objects: MediaObject[] = [];
  let cursor: string | undefined;
  do {
    const page = await media.list({ ...(cursor ? { cursor } : {}), include: ["httpMetadata", "customMetadata"] });
    objects.push(...page.objects);
    if (page.truncated && (!page.cursor || page.cursor === cursor)) throw new Error("Inventaire des photos incomplet.");
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return objects.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
}

export async function createCompleteBackup(database: Database, media: Media, configuration: Record<string, unknown>) {
  const startedAt = new Date().toISOString();
  const schema = (await database.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL AND type IN ('table','index','trigger','view') AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*' ORDER BY type,name").all<SchemaEntry>()).results;
  const tableNames = schema.filter((entry) => entry.type === "table").map((entry) => entry.name).sort();
  if (!tableNames.length) throw new Error("Aucune table trouvée : sauvegarde annulée.");
  // A D1 batch runs transactionally: table rows and the schema check share one read snapshot.
  const snapshots = await database.batch([
    ...tableNames.map((name) => database.prepare(`SELECT * FROM ${nameQuoted(name)}`)),
    database.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL AND type IN ('table','index','trigger','view') AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*' ORDER BY type,name"),
  ]);
  if (snapshots.some((result) => result.success === false)) throw new Error("Lecture de la base incomplète.");
  if (JSON.stringify(snapshots.at(-1)?.results) !== JSON.stringify(schema)) throw new Error("Le schéma a changé pendant la sauvegarde. Réessayez.");
  const tables: Record<string, Row[]> = {};
  tableNames.forEach((name, index) => { tables[name] = snapshots[index].results; });
  const capturedAt = new Date().toISOString();
  const files: Record<string, Uint8Array> = {};
  let totalBytes = 0;
  const add = (name: string, bytes: Uint8Array) => {
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_BYTES) throw new Error("La sauvegarde dépasse la capacité de cet export. Aucun fichier partiel n’a été créé ; demandez un export par lots.");
    files[name] = bytes;
  };
  const text = (name: string, value: string) => add(name, strToU8(value));
  const json = (name: string, value: unknown) => text(name, JSON.stringify(value, null, 2));
  const sourceZip = Uint8Array.from(atob(backupSource.zipBase64), (character) => character.charCodeAt(0));
  if (await sha256(sourceZip) !== backupSource.zipSha256) throw new Error("Archive du code non vérifiable.");
  add("source.zip", sourceZip);
  text("LEEME_RESTAURAR.md", backupSource.guide);
  text("restore-backup.py", backupSource.restorer);
  json("database.json", { format: "sancta-maria-database-v1", capturedAt, schema, tables });
  const sql = ["-- Sancta Maria: restore into an EMPTY database only.", "PRAGMA defer_foreign_keys=TRUE;"];
  for (const entry of schema.filter((entry) => entry.type === "table")) sql.push(entry.sql + ";");
  for (const name of tableNames) for (const row of tables[name]) {
    const columns = Object.keys(row);
    sql.push(`INSERT INTO ${nameQuoted(name)} (${columns.map(nameQuoted).join(",")}) VALUES (${columns.map((column) => sqlValue(row[column])).join(",")});`);
  }
  for (const entry of schema.filter((entry) => entry.type !== "table")) sql.push(entry.sql + ";");
  text("database.sql", sql.join("\n") + "\n");
  json("configuration.json", configuration);
  const before = await mediaInventory(media);
  const mediaIndex: Record<string, unknown>[] = [];
  for (const item of before) {
    const object = await media.get(item.key);
    if (!object || object.etag !== item.etag || object.size !== item.size) throw new Error("Une photo a changé pendant la sauvegarde. Réessayez.");
    const bytes = new Uint8Array(await object.arrayBuffer());
    if (bytes.byteLength !== item.size) throw new Error("Une photo est incomplète.");
    const hash = await sha256(bytes);
    const file = "media/" + await sha256(encoder.encode(item.key)) + ".bin";
    add(file, bytes);
    mediaIndex.push({ key: item.key, file, bytes: bytes.byteLength, sha256: hash, etag: item.etag, httpMetadata: object.httpMetadata ?? {}, customMetadata: object.customMetadata ?? {} });
  }
  const objectMap = new Map(mediaIndex.map((item) => [String(item.key), item]));
  for (const row of tables.preparation_label_photos ?? []) {
    if (row.deleted_at) continue;
    const item = objectMap.get(String(row.object_key));
    if (!item || item.sha256 !== row.content_sha256 || item.bytes !== row.byte_size) throw new Error("Une photo référencée par le registre est absente ou altérée. Sauvegarde annulée.");
  }
  const after = await mediaInventory(media);
  const identity = (items: MediaObject[]) => JSON.stringify(items.map(({ key, etag, size }) => ({ key, etag, size })));
  if (identity(before) !== identity(after)) throw new Error("Les photos ont changé pendant la sauvegarde. Réessayez sans modifier les réceptions.");
  json("media-index.json", mediaIndex);
  const checksums = [];
  for (const [path, bytes] of Object.entries(files)) checksums.push({ path, bytes: bytes.byteLength, sha256: await sha256(bytes) });
  const manifest = {
    format: "sancta-maria-complete-backup-v1", status: "complete", startedAt, databaseCapturedAt: capturedAt, completedAt: new Date().toISOString(),
    projectId: "appgprj_6a988b25a3908191bce47dcc8ad65c97", application: "Sancta Maria 1187 — HACCP",
    source: { file: "source.zip", sha256: backupSource.zipSha256, treeSha256: backupSource.sourceTreeSha256, fileCount: backupSource.fileCount, parentCommitAtBuild: backupSource.parentCommit },
    tables: Object.fromEntries(tableNames.map((name) => [name, tables[name].length])), mediaObjects: mediaIndex.length,
    exclusions: ["Browser-only printer preferences, Bluetooth pairing and unsaved forms", "Platform-managed credentials, hosting resources and external OneDrive workbook contents", "Reinstallable dependencies and generated OCR assets"],
    consistency: "D1 tables read in one batch; R2 objects checked before/after. Avoid writes while downloading. No global D1/R2 transaction is available.",
    files: checksums,
  };
  json("manifest.json", manifest);
  const zippable: Zippable = {};
  for (const [path, bytes] of Object.entries(files)) zippable[path] = [bytes, { level: path === "source.zip" || path.startsWith("media/") ? 0 : 1 }];
  return { bytes: zipSync(zippable), manifest };
}

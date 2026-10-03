import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync, strToU8 } from "fflate";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const generated = "lib/backup-source.generated.ts";
const excluded = /(^|\/)(?:\.git|node_modules|dist|\.next|\.wrangler|\.sites-runtime|outputs|work|coverage|ocr-v7)(\/|$)|(^|\/)\.env[^/]*$|\.(?:pem|tsbuildinfo)$|^source-manifest\.json$/;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function walk(directory, prefix = "") {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (excluded.test(name) || name === generated || entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) result.push(...await walk(resolve(directory, entry.name), name + "/"));
    else if (entry.isFile()) result.push(name);
  }
  return result;
}

export async function prepareBackupSource() {
  let paths, parentCommit = null;
  try {
    paths = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
    parentCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    paths = await walk(root);
  }
  paths = [...new Set(paths)].filter((name) => name !== generated && !excluded.test(name)).sort();
  const entries = {}, manifest = [];
  for (const name of paths) {
    const bytes = new Uint8Array(await readFile(resolve(root, name)));
    entries[name] = bytes;
    manifest.push({ path: name, bytes: bytes.byteLength, sha256: hash(bytes) });
  }
  const sourceTreeSha256 = hash(JSON.stringify(manifest));
  entries["source-manifest.json"] = strToU8(JSON.stringify({ sourceTreeSha256, parentCommit, files: manifest }, null, 2));
  const zip = zipSync(entries, { level: 6 });
  const payload = {
    zipBase64: Buffer.from(zip).toString("base64"),
    zipSha256: hash(zip), sourceTreeSha256, parentCommit, fileCount: manifest.length,
    guide: await readFile(resolve(root, "docs/RESTAURAR_BACKUP.md"), "utf8"),
    restorer: await readFile(resolve(root, "scripts/restore-backup.py"), "utf8"),
  };
  await writeFile(resolve(root, generated), "// Generated at build time. Never put in public assets.\nexport const backupSource = " + JSON.stringify(payload) + " as const;\n");
  return { files: manifest.length, sourceTreeSha256, zipBytes: zip.byteLength };
}

if (process.argv[1] && relative(root, resolve(process.argv[1])) === relative(root, fileURLToPath(import.meta.url))) {
  console.log(JSON.stringify(await prepareBackupSource()));
}

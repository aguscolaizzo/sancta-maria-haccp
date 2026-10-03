import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir } from "node:fs/promises";
import { build } from "esbuild";

await mkdir(new URL("../.sites-runtime/tests/", import.meta.url), { recursive: true });
const bundle = new URL("../.sites-runtime/tests/qr-renderer.mjs", import.meta.url);
await build({
  entryPoints: [new URL("../lib/qr-renderer.ts", import.meta.url).pathname],
  bundle: true,
  platform: "browser",
  format: "esm",
  outfile: bundle.pathname,
  logLevel: "silent",
});
const { crispQrLayout } = await import(bundle.href);

test("the production trace URL keeps whole three-dot QR modules", () => {
  const layout = crispQrLayout(
    "https://sancta-frigo.agustingcolaizzo.chatgpt.site/preparations/3c1bda30-0000-4000-8000-123456789abc",
    144,
  );
  assert.equal(layout.moduleCount, 41);
  assert.equal(layout.scale, 3);
  assert.equal(layout.symbolSize, 123);
  assert.ok(layout.offset >= layout.scale * 3);
});

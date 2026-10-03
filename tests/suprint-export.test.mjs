import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir } from "node:fs/promises";
import { build } from "esbuild";
import { strFromU8, unzipSync } from "fflate";

await mkdir(new URL("../.sites-runtime/tests/", import.meta.url), {
  recursive: true,
});
const bundle = new URL(
  "../.sites-runtime/tests/suprint-export.mjs",
  import.meta.url,
);
await build({
  entryPoints: [new URL("../lib/suprint-export.ts", import.meta.url).pathname],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: bundle.pathname,
  logLevel: "silent",
});
const suprint = await import(bundle.href);

const labels = [
  {
    id: "label-1",
    labelCode: "ETQ-20260926-001-01",
    shortToken: "ABC12345",
    preparationId: "preparation-1",
    preparationCode: "PREP-20260926-001",
    bacId: "bac-1",
    bacCode: "PREP-20260926-001-BAC-01",
    bacIndex: 1,
    labelFormat: "50x30",
    status: "to_print",
    ingredientName: "Tomates coupées",
    shortName: "TOMATES",
    operationType: "cut",
    preparedAt: "2026-09-26T08:30",
    expiresAt: "2026-09-28T08:30",
    storageMode: "refrigerated",
    storageTemperature: 4,
    operatorInitials: "AG",
    sourceLots: [],
  },
];

test("SUPRINT export creates one traceable row per physical label", () => {
  const rows = suprint.buildSuprintRows(labels, "https://sancta.test/");
  assert.equal(rows.length, 1);
  assert.match(rows[0].TEXTE_ETIQUETTE, /TOMATES/);
  assert.match(rows[0].TEXTE_ETIQUETTE, /DLC 28\/09\/2026 08:30/);
  assert.match(rows[0].TEXTE_ETIQUETTE, /ETQ-20260926-001-01/);
  assert.equal(rows[0].QR_URL, "https://sancta.test/t/ABC12345");
});

test("CSV keeps accents, line breaks and the two-column SUPRINT template", () => {
  const rows = suprint.buildSuprintRows(labels, "https://sancta.test");
  const csv = suprint.buildSuprintCsv(rows);
  assert.ok(csv.startsWith('\uFEFF"TEXTE_ETIQUETTE";"QR_URL"'));
  assert.match(csv, /PRÉP\. 26\/09\/2026 08:30/);
  assert.match(csv, /;"https:\/\/sancta\.test\/t\/ABC12345"/);
});

test("Excel export is a valid OOXML workbook with wrapped label text", () => {
  const rows = suprint.buildSuprintRows(labels, "https://sancta.test");
  const files = unzipSync(suprint.buildSuprintXlsx(rows));
  assert.ok(files["[Content_Types].xml"]);
  assert.ok(files["xl/workbook.xml"]);
  const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
  assert.match(sheet, /TEXTE_ETIQUETTE/);
  assert.match(sheet, /TOMATES/);
  assert.match(sheet, /ABC12345/);
  assert.match(sheet, /A1:B2/);
});

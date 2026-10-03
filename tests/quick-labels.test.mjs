import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir } from "node:fs/promises";
import { build } from "esbuild";

await mkdir(new URL("../.sites-runtime/tests/", import.meta.url), { recursive: true });
const bundle = new URL("../.sites-runtime/tests/quick-labels.mjs", import.meta.url);
await build({
  entryPoints: [new URL("../lib/quick-labels.ts", import.meta.url).pathname],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: bundle.pathname,
  logLevel: "silent",
});
const quick = await import(bundle.href);

test("internal DLC never exceeds the earliest supplier deadline", () => {
  const result = quick.calculateInternalExpiry("2026-09-10T08:00", 72, [
    "2026-09-11",
    "2026-09-15",
  ]);
  assert.equal(result.internalExpiry, "2026-09-13T08:00");
  assert.equal(result.expiresAt, "2026-09-11T23:59");
  assert.equal(result.cappedBySupplier, true);
});

test("preparation and physical label identifiers are stable and distinct", () => {
  const preparation = quick.formatPreparationCode("2026-09-10", 1);
  assert.equal(preparation, "PREP-20260910-001");
  assert.equal(quick.formatLabelCode(preparation, 1), "ETQ-20260910-001-01");
  assert.equal(quick.formatLabelCode(preparation, 2), "ETQ-20260910-001-02");
});

test("manual source lots and DLC overrides require an auditable reason", () => {
  const base = {
    ingredientId: "123e4567-e89b-42d3-a456-426614174000",
    operationType: "sliced",
    bacCount: 1,
    labelCount: 1,
    preparedAt: "2026-09-10T08:00",
    sourceLotIds: [],
    notes: "",
  };
  assert.match(
    quick.validateQuickSelection({ ...base, manualSourceLot: "LOT-1" }).error,
    /Expliquez/,
  );
  assert.match(
    quick.validateQuickSelection({ ...base, durationOverride: 72 }).error,
    /motif/,
  );
  assert.ok(
    quick.validateQuickSelection({
      ...base,
      manualSourceLot: "LOT-1",
      manualSourceReason: "Bon papier",
      durationOverride: 48,
      overrideReason: "Validation responsable",
    }).value,
  );
});

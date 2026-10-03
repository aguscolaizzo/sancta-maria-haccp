import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir } from "node:fs/promises";
import { build } from "esbuild";

await mkdir(new URL("../.sites-runtime/tests/", import.meta.url), {
  recursive: true,
});
const bundle = new URL(
  "../.sites-runtime/tests/receptions.mjs",
  import.meta.url,
);
await build({
  entryPoints: [new URL("../lib/receptions.ts", import.meta.url).pathname],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: bundle.pathname,
  logLevel: "silent",
});
const { finalReceptionStatus, probeRequired, validationErrors } = await import(
  bundle.href
);

const product = (extra = {}) => ({
  id: "00000000-0000-4000-8000-000000000001",
  receptionId: "00000000-0000-4000-8000-000000000002",
  productName: "Jambon blanc",
  category: "Charcuterie",
  temperatureRegime: "refrigerated",
  quantity: "5",
  unit: "kg",
  supplierLot: "JB-42",
  deadlineType: "dlc",
  deadlineDate: "2026-09-30",
  storageTemperature: 4,
  maxTemperature: 4,
  packagingCompliant: true,
  visualCompliant: true,
  cleanlinessCompliant: null,
  humidityAbsent: null,
  pestsAbsent: null,
  productCompliant: true,
  selectedForMeasurement: true,
  suggestedForMeasurement: true,
  riskLevel: "high",
  irTemperature: 7.8,
  probeTemperature: null,
  measurementMethod: "ir_surface",
  remeasureTemperature: null,
  observations: "",
  decisionType: null,
  concernedQuantity: "",
  nonConformityReason: "",
  nonConformityComment: "",
  correctiveAction: "",
  finalDecision: "",
  supplierLotId: null,
  revision: 1,
  createdAt: "2026-09-09T08:00:00.000Z",
  createdByName: "AG",
  updatedAt: null,
  updatedByName: null,
  ...extra,
});

test("a doubtful IR reading requests a probe but is not itself a final non-conformity", () => {
  const received = product();
  assert.equal(probeRequired(received), true);
  assert.match(validationErrors([received]).join(" "), /sonde est requis/);
  assert.equal(finalReceptionStatus([received]), "compliant");
});

test("the complementary probe preserves a conforming outcome while both readings remain present", () => {
  const received = product({
    probeTemperature: 3.9,
    measurementMethod: "between_packages",
  });
  assert.deepEqual(validationErrors([received]), []);
  assert.equal(received.irTemperature, 7.8);
  assert.equal(received.probeTemperature, 3.9);
  assert.equal(finalReceptionStatus([received]), "compliant_after_probe");
});

test("a failing probe cannot close until quantity, reason, action and decision are recorded", () => {
  const failing = product({
    probeTemperature: 7.1,
    measurementMethod: "contact",
  });
  assert.match(validationErrors([failing]).join(" "), /non-conformité/);
  const documented = product({
    probeTemperature: 7.1,
    measurementMethod: "contact",
    decisionType: "partial_refusal",
    concernedQuantity: "2 kg",
    nonConformityReason: "Température confirmée hors tolérance",
    correctiveAction: "Lot isolé et quantité concernée refusée",
    finalDecision: "Refus partiel",
  });
  assert.deepEqual(validationErrors([documented]), []);
  assert.equal(finalReceptionStatus([documented]), "non_compliant");
});

test("ambient products can be validated without a systematic temperature", () => {
  const ambient = product({
    productName: "Farine",
    category: "Épicerie sèche",
    temperatureRegime: "ambient",
    deadlineType: "ddm",
    maxTemperature: null,
    storageTemperature: null,
    selectedForMeasurement: false,
    suggestedForMeasurement: false,
    irTemperature: null,
    cleanlinessCompliant: true,
    humidityAbsent: true,
    pestsAbsent: true,
    productCompliant: true,
  });
  assert.deepEqual(validationErrors([ambient]), []);
  assert.equal(finalReceptionStatus([ambient]), "compliant");
});

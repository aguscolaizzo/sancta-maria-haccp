import assert from "node:assert/strict";
import { test } from "node:test";
import { extractOcrFields } from "../lib/photo-ocr.ts";

test("OCR extraction uses explicit French supplier labels", () => {
  assert.deepEqual(
    extractOcrFields(`
      Produit : Lasagnes maison
      Fournisseur : Ets Drap
      Lot : LAS-208
      DLC : 21/09/2026
      Quantité : 2,5 kg
      BL : 98765
    `),
    {
      productName: "Lasagnes maison",
      supplierName: "Ets Drap",
      supplierLot: "LAS-208",
      deadlineDate: "2026-09-21",
      deadlineType: "dlc",
      quantity: "2,5 kg",
      deliveryNote: "98765",
    },
  );
});

test("OCR extraction leaves ambiguous or invalid traceability data empty", () => {
  const result = extractOcrFields(`
    21/09/2026
    DLC : 31/02/2026
    DLC : 22/09/2026
    Lot : A-1
    Lot : B-2
    À consommer de préférence avant le 30/09/2026
  `);
  assert.equal(result.deadlineDate, "");
  assert.equal(result.deadlineType, "");
  assert.equal(result.supplierLot, "");
});

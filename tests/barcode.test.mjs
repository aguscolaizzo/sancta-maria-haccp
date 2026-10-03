import assert from "node:assert/strict";
import { test } from "node:test";
import {
  barcodeLookupCode,
  normalizeTradeItemCode,
  parseBarcode,
} from "../lib/barcode.ts";

test("plain EAN is normalized as the product identity", () => {
  const value = parseBarcode("3760123456789", "ean_13");
  assert.equal(value.gtin, "3760123456789");
  assert.equal(value.isGs1, false);
  assert.equal(barcodeLookupCode(value.rawValue, value.format), "03760123456789");
});

test("parenthesized GS1 keeps GTIN, lot, expiry and weight separate", () => {
  const value = parseBarcode(
    "(01)03760123456789(17)261031(10)LOT-42(3102)000675",
    "data_matrix",
  );
  assert.equal(value.gtin, "03760123456789");
  assert.equal(value.lot, "LOT-42");
  assert.equal(value.deadlineDate, "2026-10-31");
  assert.equal(value.deadlineType, "dlc");
  assert.equal(value.quantity, "6,75 kg");
  assert.equal(barcodeLookupCode(value.rawValue, value.format), value.gtin);
});

test("raw GS1 reads FNC1-delimited lot and DDM", () => {
  const value = parseBarcode(
    "]d201037601234567891526123110LASAGNE-9\u001d3706",
    "data_matrix",
  );
  assert.equal(value.gtin, "03760123456789");
  assert.equal(value.deadlineDate, "2026-12-31");
  assert.equal(value.deadlineType, "ddm");
  assert.equal(value.lot, "LASAGNE-9");
  assert.equal(value.quantity, "6 unités");
});

test("invalid GS1 dates are never proposed", () => {
  const value = parseBarcode("(01)03760123456789(17)260231(10)LOT-1", "data_matrix");
  assert.equal(value.deadlineDate, "");
  assert.equal(value.deadlineType, "");
});

test("validated GTINs preserve leading zeroes and use a canonical local identity", () => {
  assert.deepEqual(normalizeTradeItemCode("3017624010701", "ean_13"), {
    externalCode: "3017624010701",
    normalized: "03017624010701",
    source: "plain",
  });
  assert.deepEqual(
    normalizeTradeItemCode("(01)03017624010701(10)LOT-1", "data_matrix"),
    {
      externalCode: "03017624010701",
      normalized: "03017624010701",
      source: "gs1",
    },
  );
});

test("UPC-E is expanded safely while arbitrary QR and Code 128 content stays local", () => {
  assert.deepEqual(normalizeTradeItemCode("04252614", "upc_e"), {
    externalCode: "042100005264",
    normalized: "00042100005264",
    source: "upc_e",
  });
  assert.equal(normalizeTradeItemCode("3017624010701", "qr_code"), null);
  assert.equal(normalizeTradeItemCode("SUPPLIER-LOT-42", "code_128"), null);
  assert.equal(
    normalizeTradeItemCode("https://sancta.test/t/abc", "qr_code"),
    null,
  );
});

test("invalid GTIN check digits are rejected for external lookup", () => {
  assert.equal(normalizeTradeItemCode("3017624010702", "ean_13"), null);
});

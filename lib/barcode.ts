export type BarcodeDeadlineType = "dlc" | "ddm";

export type ParsedBarcode = {
  rawValue: string;
  format: string;
  gtin: string;
  lot: string;
  deadlineDate: string;
  deadlineType: BarcodeDeadlineType | "";
  quantity: string;
  internalUrl: string;
  isGs1: boolean;
};

export type NormalizedTradeItemCode = {
  /** Code sent to product databases, keeping its significant leading zeroes. */
  externalCode: string;
  /** Canonical GTIN-14 identity used only for local deduplication. */
  normalized: string;
  source: "plain" | "gs1" | "upc_e";
};

const GROUP_SEPARATOR = "\u001d";

function isoGs1Date(value: string) {
  if (!/^\d{6}$/.test(value)) return "";
  const year = 2000 + Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function cleanFormat(format: string) {
  return String(format || "inconnu")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || "inconnu";
}

function validGtinCheckDigit(value: string) {
  if (!/^\d+$/.test(value) || value.length < 2) return false;
  const expected = Number(value.at(-1));
  let sum = 0;
  for (let index = value.length - 2, position = 0; index >= 0; index--, position++)
    sum += Number(value[index]) * (position % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === expected;
}

function gtinCheckDigit(data: string) {
  let sum = 0;
  for (let index = data.length - 1, position = 0; index >= 0; index--, position++)
    sum += Number(data[index]) * (position % 2 === 0 ? 3 : 1);
  return String((10 - (sum % 10)) % 10);
}

/** Expands UPC-E to UPC-A without dropping the number-system zero. */
function expandUpce(value: string) {
  let numberSystem = "0";
  let body = value;
  let suppliedCheck = "";
  if (/^\d{8}$/.test(value)) {
    numberSystem = value[0];
    body = value.slice(1, 7);
    suppliedCheck = value[7];
  } else if (/^\d{7}$/.test(value)) {
    numberSystem = value[0];
    body = value.slice(1);
  }
  if (!/^[01]$/.test(numberSystem) || !/^\d{6}$/.test(body)) return "";
  const [a, b, c, d, e, f] = body;
  let data = "";
  if (f === "0" || f === "1" || f === "2")
    data = `${numberSystem}${a}${b}${f}0000${c}${d}${e}`;
  else if (f === "3") data = `${numberSystem}${a}${b}${c}00000${d}${e}`;
  else if (f === "4") data = `${numberSystem}${a}${b}${c}${d}00000${e}`;
  else data = `${numberSystem}${a}${b}${c}${d}${e}0000${f}`;
  const check = gtinCheckDigit(data);
  if (suppliedCheck && suppliedCheck !== check) return "";
  return `${data}${check}`;
}

function parseParenthesized(value: string, result: ParsedBarcode) {
  const fields = [...value.matchAll(/\((\d{2,4})\)([^()]*)/g)];
  if (!fields.length) return false;
  for (const match of fields) applyAi(match[1], match[2].trim(), result);
  return true;
}

function applyAi(ai: string, value: string, result: ParsedBarcode) {
  if (ai === "01" && /^\d{14}$/.test(value)) result.gtin = value;
  else if (ai === "10") result.lot = value.slice(0, 20);
  else if (ai === "17") {
    const date = isoGs1Date(value.slice(0, 6));
    if (date) {
      result.deadlineDate = date;
      result.deadlineType = "dlc";
    }
  } else if (ai === "15" && !result.deadlineDate) {
    const date = isoGs1Date(value.slice(0, 6));
    if (date) {
      result.deadlineDate = date;
      result.deadlineType = "ddm";
    }
  } else if (/^310\d$/.test(ai) && /^\d{6}$/.test(value)) {
    const decimals = Number(ai[3]);
    result.quantity = `${(Number(value) / 10 ** decimals).toLocaleString("fr-FR", {
      maximumFractionDigits: decimals,
    })} kg`;
  } else if ((ai === "30" || ai === "37") && /^\d{1,8}$/.test(value)) {
    result.quantity = `${Number(value)} unité${Number(value) > 1 ? "s" : ""}`;
  }
}

function parseRawGs1(value: string, result: ParsedBarcode) {
  const source = value.replace(/^\][A-Za-z]\d/, "");
  let index = 0;
  let recognized = 0;
  while (index < source.length) {
    if (source[index] === GROUP_SEPARATOR) {
      index += 1;
      continue;
    }
    const two = source.slice(index, index + 2);
    if (two === "01") {
      const field = source.slice(index + 2, index + 16);
      if (!/^\d{14}$/.test(field)) break;
      applyAi("01", field, result);
      index += 16;
      recognized += 1;
      continue;
    }
    if (two === "15" || two === "17") {
      const field = source.slice(index + 2, index + 8);
      if (!/^\d{6}$/.test(field)) break;
      applyAi(two, field, result);
      index += 8;
      recognized += 1;
      continue;
    }
    const four = source.slice(index, index + 4);
    if (/^310\d$/.test(four)) {
      const field = source.slice(index + 4, index + 10);
      if (!/^\d{6}$/.test(field)) break;
      applyAi(four, field, result);
      index += 10;
      recognized += 1;
      continue;
    }
    if (two === "10" || two === "30" || two === "37") {
      const start = index + 2;
      const end = source.indexOf(GROUP_SEPARATOR, start);
      const max = two === "10" ? 20 : 8;
      const field = source.slice(start, end < 0 ? start + max : end);
      if (!field) break;
      applyAi(two, field, result);
      index = end < 0 ? source.length : end + 1;
      recognized += 1;
      continue;
    }
    break;
  }
  return recognized > 0;
}

export function parseBarcode(rawValue: string, format = "inconnu"): ParsedBarcode {
  const raw = String(rawValue ?? "").trim().slice(0, 512);
  const result: ParsedBarcode = {
    rawValue: raw,
    format: cleanFormat(format),
    gtin: "",
    lot: "",
    deadlineDate: "",
    deadlineType: "",
    quantity: "",
    internalUrl: "",
    isGs1: false,
  };
  if (!raw) return result;
  try {
    const url = new URL(raw);
    if (/^https?:$/.test(url.protocol) && /^\/(?:t|preparations)\//.test(url.pathname))
      result.internalUrl = url.toString();
  } catch {}
  const parenthesized = parseParenthesized(raw, result),
    rawGs1Candidate = /^\][A-Za-z]\d/.test(raw) || raw.includes(GROUP_SEPARATOR) || /^01\d{14}/.test(raw);
  result.isGs1 = parenthesized || (rawGs1Candidate && parseRawGs1(raw, result));
  if (!result.gtin && /^\d{8,14}$/.test(raw)) result.gtin = raw;
  return result;
}

export function barcodeLookupCode(rawValue: string, format = "inconnu") {
  const parsed = parseBarcode(rawValue, format);
  const identity = parsed.gtin && /^\d{8,14}$/.test(parsed.gtin)
    ? parsed.gtin.padStart(14, "0")
    : parsed.rawValue;
  return identity
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 160);
}

/**
 * Returns a GTIN that is safe to send to a public product database.
 * Arbitrary Code 128, DataMatrix and QR payloads are deliberately excluded;
 * those formats are accepted only when the existing GS1 parser extracted AI 01.
 */
export function normalizeTradeItemCode(
  rawValue: string,
  format = "inconnu",
): NormalizedTradeItemCode | null {
  const parsed = parseBarcode(rawValue, format);
  if (parsed.internalUrl) return null;
  const normalizedFormat = cleanFormat(format);
  let value = parsed.gtin;
  let source: NormalizedTradeItemCode["source"] = parsed.isGs1 ? "gs1" : "plain";

  if (normalizedFormat === "upc_e" || normalizedFormat.includes("upc_e")) {
    value = expandUpce(parsed.rawValue);
    source = "upc_e";
  } else {
    const safeLinear = new Set([
      "ean_8",
      "ean8",
      "ean_13",
      "ean13",
      "upc_a",
      "upca",
      "itf",
      "itf_14",
      "gtin_14",
      "inconnu",
      "unknown",
    ]);
    if (!parsed.isGs1 && !safeLinear.has(normalizedFormat)) return null;
  }

  if (![8, 12, 13, 14].includes(value.length) || !validGtinCheckDigit(value))
    return null;
  return {
    externalCode: value,
    normalized: value.padStart(14, "0"),
    source,
  };
}

import { strToU8, zipSync } from "fflate";
import type { QuickLabelRecord } from "./quick-labels";

export type SuprintExportRow = {
  TEXTE_ETIQUETTE: string;
  QR_URL: string;
};

function frenchDateTime(value: string) {
  const [date = "", time = ""] = value.split("T"),
    [year = "", month = "", day = ""] = date.split("-");
  return `${day}/${month}/${year} ${time.slice(0, 5)}`.trim();
}

function temperature(label: QuickLabelRecord) {
  if (label.storageTemperature === null) return "TEMP. AMBIANTE";
  const prefix = label.storageTemperature > 0 ? "+" : "";
  return `${prefix}${label.storageTemperature} °C`;
}

export function buildSuprintRows(
  labels: QuickLabelRecord[],
  baseUrl: string,
): SuprintExportRow[] {
  const origin = baseUrl.replace(/\/$/, "");
  return labels.map((label) => ({
    TEXTE_ETIQUETTE: [
      label.shortName || label.ingredientName,
      `PRÉP. ${frenchDateTime(label.preparedAt)}`,
      `DLC ${frenchDateTime(label.expiresAt)}`,
      `LOT ${label.preparationCode}`,
      `OP. ${label.operatorInitials} · ${temperature(label)}`,
      `ID ${label.labelCode}`,
    ].join("\n"),
    QR_URL: `${origin}/t/${encodeURIComponent(label.shortToken)}`,
  }));
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export function buildSuprintCsv(rows: SuprintExportRow[]) {
  const lines = [
    ["TEXTE_ETIQUETTE", "QR_URL"],
    ...rows.map((row) => [row.TEXTE_ETIQUETTE, row.QR_URL]),
  ];
  return `\uFEFF${lines.map((line) => line.map(csvCell).join(";")).join("\r\n")}`;
}

function xml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cell(reference: string, value: string, style: number) {
  return `<c r="${reference}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}

export function buildSuprintXlsx(rows: SuprintExportRow[]) {
  const sheetRows = [
    `<row r="1" ht="22" customHeight="1">${cell("A1", "TEXTE_ETIQUETTE", 2)}${cell("B1", "QR_URL", 2)}</row>`,
    ...rows.map(
      (row, index) =>
        `<row r="${index + 2}" ht="92" customHeight="1">${cell(`A${index + 2}`, row.TEXTE_ETIQUETTE, 1)}${cell(`B${index + 2}`, row.QR_URL, 1)}</row>`,
    ),
  ].join("");
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Etiquettes SUPRINT" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    "xl/styles.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    ),
    "xl/worksheets/sheet1.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:B${Math.max(1, rows.length + 1)}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><cols><col min="1" max="1" width="48" customWidth="1"/><col min="2" max="2" width="58" customWidth="1"/></cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A1:B${Math.max(1, rows.length + 1)}"/></worksheet>`,
    ),
  };
  return zipSync(files, { level: 6 });
}

export function suprintFilename(extension: "xlsx" | "csv", now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  return `SUPRINT_Etiquettes_Sancta_Maria_${date}.${extension}`;
}

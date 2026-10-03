import type { LabelFormat, OperationType } from "./quick-labels";

export type PrinterSettings = {
  format: LabelFormat;
  rotation: 0 | 90 | 180 | 270;
  mirrorHorizontal: boolean;
  mirrorVertical: boolean;
  marginX: number;
  marginY: number;
  density: number;
};

export type PrintQueueItem = {
  id: string;
  physicalLabelId: string;
  position: number;
  status: "pending" | "transmitting" | "printed" | "failed";
  attemptCount: number;
  errorMessage: string;
  transmissionId: string;
  labelCode: string;
  shortToken: string;
  labelFormat: LabelFormat;
  ingredientName: string;
  shortName: string;
  preparationCode: string;
  operationType: OperationType;
  preparedAt: string;
  expiresAt: string;
  storageMode: string;
  storageTemperature: number | null;
  operatorInitials: string;
  bacCode: string;
  bacIndex: number;
};

export type PrintQueue = {
  id: string;
  status: "pending" | "printing" | "completed" | "partial" | "failed";
  printerModel: string;
  transport: string;
  requestedAt: string;
  completedAt: string | null;
  requestedByName: string;
  items: PrintQueueItem[];
};

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  format: "50x30",
  rotation: 180,
  mirrorHorizontal: false,
  mirrorVertical: false,
  marginX: 0,
  marginY: 0,
  density: 4,
};

export const PRINTER_SETTINGS_STORAGE_KEY = "sancta-t50m-settings-v2";

export function validatePrinterSettings(value: unknown): PrinterSettings {
  const raw = (value ?? {}) as Partial<PrinterSettings>,
    format = String(raw.format ?? "50x30") as LabelFormat,
    rotation = Number(raw.rotation ?? 180) as PrinterSettings["rotation"],
    marginX = Number(raw.marginX ?? 0),
    marginY = Number(raw.marginY ?? 0),
    density = Number(raw.density ?? 4);
  if (!["50x30", "30x20", "50x80"].includes(format))
    throw new Error("Format d’étiquette invalide.");
  if (![0, 90, 180, 270].includes(rotation))
    throw new Error("Rotation invalide.");
  if (!Number.isInteger(marginX) || marginX < -80 || marginX > 80)
    throw new Error("Marge horizontale invalide.");
  if (!Number.isInteger(marginY) || marginY < -80 || marginY > 80)
    throw new Error("Marge verticale invalide.");
  if (!Number.isInteger(density) || density < 1 || density > 15)
    throw new Error("Densité invalide.");
  return {
    format,
    rotation,
    mirrorHorizontal: Boolean(raw.mirrorHorizontal),
    mirrorVertical: Boolean(raw.mirrorVertical),
    marginX,
    marginY,
    density,
  };
}

export const printQueueSelect = `SELECT j.id AS job_id,j.status AS job_status,j.printer_model,j.transport,j.requested_at,j.completed_at,j.requested_by_name,
  i.id AS item_id,i.physical_label_id,i.position,i.status AS item_status,i.attempt_count,i.error_message,i.transmission_id,
  l.label_code,l.short_token,l.label_format,p.ingredient_name,p.short_name,p.preparation_code,p.operation_type,p.prepared_at,p.expires_at,p.storage_mode,p.storage_temperature,p.operator_initials,
  b.bac_code,b.bac_index
  FROM print_jobs j JOIN print_job_items i ON i.owner_id=j.owner_id AND i.print_job_id=j.id
  JOIN physical_labels l ON l.owner_id=i.owner_id AND l.id=i.physical_label_id
  JOIN internal_preparations p ON p.owner_id=l.owner_id AND p.id=l.preparation_id AND p.deleted_at IS NULL
  JOIN preparation_bacs b ON b.owner_id=l.owner_id AND b.id=l.bac_id`;

export function queueFromRows(rows: Array<Record<string, unknown>>): PrintQueue | null {
  const first = rows[0];
  if (!first) return null;
  return {
    id: String(first.job_id),
    status: String(first.job_status) as PrintQueue["status"],
    printerModel: String(first.printer_model),
    transport: String(first.transport),
    requestedAt: String(first.requested_at),
    completedAt: first.completed_at ? String(first.completed_at) : null,
    requestedByName: String(first.requested_by_name),
    items: rows.map((row) => ({
      id: String(row.item_id),
      physicalLabelId: String(row.physical_label_id),
      position: Number(row.position),
      status: String(row.item_status) as PrintQueueItem["status"],
      attemptCount: Number(row.attempt_count),
      errorMessage: String(row.error_message ?? ""),
      transmissionId: String(row.transmission_id ?? ""),
      labelCode: String(row.label_code),
      shortToken: String(row.short_token),
      labelFormat: String(row.label_format) as LabelFormat,
      ingredientName: String(row.ingredient_name),
      shortName: String(row.short_name),
      preparationCode: String(row.preparation_code),
      operationType: String(row.operation_type) as OperationType,
      preparedAt: String(row.prepared_at),
      expiresAt: String(row.expires_at),
      storageMode: String(row.storage_mode),
      storageTemperature:
        row.storage_temperature === null ? null : Number(row.storage_temperature),
      operatorInitials: String(row.operator_initials),
      bacCode: String(row.bac_code),
      bacIndex: Number(row.bac_index),
    })),
  };
}

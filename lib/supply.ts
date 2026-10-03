import { isLocalDate, isLocalDateTime } from "./labels";

export type Supplier = {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  notes: string;
  revision: number;
  createdAt: string;
  updatedAt: string | null;
};

export type SupplierLot = {
  id: string;
  supplierId: string;
  supplierName: string;
  ingredientName: string;
  supplierLot: string;
  receivedAt: string;
  supplierDeadline: string | null;
  quantity: string;
  storageMode: "refrigerated" | "frozen" | "ambient";
  storageTemperature: number | null;
  documentRef: string;
  notes: string;
  revision: number;
  createdAt: string;
  updatedAt: string | null;
};

export type LabelPrintEvent = {
  id: string;
  printedAt: string;
  printerModel: string;
  transport: string;
  copies: number;
  createdByName: string;
};

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean = (value: unknown, max: number) =>
  String(value ?? "")
    .trim()
    .slice(0, max + 1);
const nullable = (value: unknown) =>
  value === null || value === undefined || value === "" ? null : String(value);

export const validUuid = (value: unknown): value is string =>
  typeof value === "string" && uuid.test(value);

export function supplierFromRow(row: Record<string, unknown>): Supplier {
  return {
    id: String(row.id),
    name: String(row.name),
    contactName: String(row.contact_name ?? ""),
    phone: String(row.phone ?? ""),
    email: String(row.email ?? ""),
    notes: String(row.notes ?? ""),
    revision: Number(row.revision ?? 1),
    createdAt: String(row.created_at),
    updatedAt: nullable(row.updated_at),
  };
}

export function supplierLotFromRow(row: Record<string, unknown>): SupplierLot {
  return {
    id: String(row.id),
    supplierId: String(row.supplier_id),
    supplierName: String(row.supplier_name),
    ingredientName: String(row.ingredient_name),
    supplierLot: String(row.supplier_lot),
    receivedAt: String(row.received_at),
    supplierDeadline: nullable(row.supplier_deadline),
    quantity: String(row.quantity ?? ""),
    storageMode: row.storage_mode as SupplierLot["storageMode"],
    storageTemperature:
      row.storage_temperature === null || row.storage_temperature === undefined
        ? null
        : Number(row.storage_temperature),
    documentRef: String(row.document_ref ?? ""),
    notes: String(row.notes ?? ""),
    revision: Number(row.revision ?? 1),
    createdAt: String(row.created_at),
    updatedAt: nullable(row.updated_at),
  };
}

export function printEventFromRow(
  row: Record<string, unknown>,
): LabelPrintEvent {
  return {
    id: String(row.id),
    printedAt: String(row.printed_at),
    printerModel: String(row.printer_model),
    transport: String(row.transport),
    copies: Number(row.copies),
    createdByName: String(row.created_by_name),
  };
}

export function validateSupplierPayload(payload: Record<string, unknown>) {
  const value = {
    name: clean(payload.name, 100),
    contactName: clean(payload.contactName, 100),
    phone: clean(payload.phone, 40),
    email: clean(payload.email, 200).toLowerCase(),
    notes: clean(payload.notes, 1000),
  };
  if (!value.name)
    return { error: "Renseignez le nom du fournisseur." } as const;
  if (
    value.name.length > 100 ||
    value.contactName.length > 100 ||
    value.phone.length > 40 ||
    value.email.length > 200 ||
    value.notes.length > 1000
  )
    return { error: "Un champ du fournisseur est trop long." } as const;
  if (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))
    return { error: "Vérifiez l’adresse e-mail du fournisseur." } as const;
  return { value } as const;
}

export function validateSupplierLotPayload(payload: Record<string, unknown>) {
  const storageMode = String(payload.storageMode ?? "refrigerated"),
    supplierDeadline = nullable(payload.supplierDeadline);
  const temperature =
    payload.storageTemperature === "" ||
    payload.storageTemperature === null ||
    payload.storageTemperature === undefined
      ? null
      : Number(payload.storageTemperature);
  const value = {
    supplierId: String(payload.supplierId ?? ""),
    ingredientName: clean(payload.ingredientName, 120),
    supplierLot: clean(payload.supplierLot, 100),
    receivedAt: String(payload.receivedAt ?? ""),
    supplierDeadline,
    quantity: clean(payload.quantity, 60),
    storageMode: storageMode as SupplierLot["storageMode"],
    storageTemperature: temperature,
    documentRef: clean(payload.documentRef, 100),
    notes: clean(payload.notes, 1000),
  };
  if (!validUuid(value.supplierId))
    return { error: "Sélectionnez un fournisseur." } as const;
  if (!value.ingredientName)
    return { error: "Renseignez la matière première." } as const;
  if (!value.supplierLot)
    return { error: "Recopiez le numéro de lot fournisseur." } as const;
  if (!isLocalDateTime(value.receivedAt))
    return { error: "Vérifiez la date et l’heure de réception." } as const;
  if (supplierDeadline !== null && !isLocalDate(supplierDeadline))
    return { error: "Vérifiez la DLC ou DDM fournisseur." } as const;
  if (!["refrigerated", "frozen", "ambient"].includes(storageMode))
    return { error: "Sélectionnez un mode de stockage valide." } as const;
  if (
    temperature !== null &&
    (!Number.isFinite(temperature) || temperature < -50 || temperature > 40)
  )
    return { error: "Vérifiez la température à réception." } as const;
  if (
    value.ingredientName.length > 120 ||
    value.supplierLot.length > 100 ||
    value.quantity.length > 60 ||
    value.documentRef.length > 100 ||
    value.notes.length > 1000
  )
    return { error: "Un champ du lot fournisseur est trop long." } as const;
  return { value } as const;
}

export function validateSourceLotIds(value: unknown):
  | { value: string[]; error?: never }
  | { error: string; value?: never } {
  if (value === undefined || value === null || value === "")
    return { value: [] as string[] } as const;
  if (!Array.isArray(value) || value.length > 20)
    return {
      error: "Sélectionnez au maximum 20 lots de matières premières.",
    } as const;
  const ids = [...new Set(value.map(String))];
  if (!ids.every(validUuid))
    return { error: "Un lot fournisseur sélectionné est invalide." } as const;
  return { value: ids } as const;
}

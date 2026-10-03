import { addHoursLocal, isLocalDate, isLocalDateTime } from "./labels";
import { validUuid } from "./supply";

export const QUICK_LABELS_FEATURE = "quick_labels_beta";

export const OPERATION_LABELS = {
  opened: "Produit ouvert",
  sliced: "Produit tranché",
  cut: "Produit découpé",
  portioned: "Produit portionné",
  thawed: "Produit décongelé",
  internal_preparation: "Préparation interne",
  transferred: "Transfert en bac",
} as const;

export type OperationType = keyof typeof OPERATION_LABELS;
export type LabelFormat = "50x30" | "30x20" | "50x80";
export type QuickStatus =
  | "to_prepare"
  | "prepared"
  | "label_created"
  | "to_print"
  | "printed"
  | "print_error"
  | "expired"
  | "discarded"
  | "consumed"
  | "transformed_frozen";

export type IngredientConfig = {
  id: string;
  legacyCode: string;
  displayName: string;
  shortName: string;
  category: string;
  productType: string;
  active: boolean;
  quickEnabled: boolean;
  favorite: boolean;
  displayOrder: number;
  preparationDays: number[];
  defaultOperation: OperationType;
  storageMode: "refrigerated" | "frozen" | "ambient";
  storageTemperature: number | null;
  defaultBacs: number;
  defaultLabels: number;
  labelFormat: LabelFormat;
  technicalDescription: string;
  allergens: string;
  preparationProcedure: string;
  handlingRules: string;
  usageCount: number;
  revision: number;
  durationHours: number;
  requiresSourceLot: boolean;
};

export type QuickLabelRecord = {
  id: string;
  labelCode: string;
  shortToken: string;
  preparationId: string;
  preparationCode: string;
  bacId: string;
  bacCode: string;
  bacIndex: number;
  labelFormat: LabelFormat;
  status:
    | "to_print"
    | "printing"
    | "printed"
    | "print_error"
    | "expired"
    | "discarded"
    | "consumed"
    | "transformed_frozen";
  ingredientName: string;
  shortName: string;
  operationType: OperationType;
  preparedAt: string;
  expiresAt: string;
  storageMode: string;
  storageTemperature: number | null;
  operatorInitials: string;
  sourceLots: SourceLotTrace[];
};

export type SourceLotTrace = {
  id: string;
  supplierId: string;
  supplierName: string;
  ingredientName: string;
  supplierLot: string;
  receivedAt: string;
  supplierDeadline: string | null;
  quantity: string;
  storageMode: string;
  documentRef: string;
  receptionId: string | null;
  receptionCode: string | null;
  deliveryNote: string | null;
};

export type QuickSelectionInput = {
  ingredientId: string;
  operationType: OperationType;
  bacCount: number;
  labelCount: number;
  preparedAt: string;
  sourceLotIds: string[];
  manualSourceLot: string;
  manualSourceReason: string;
  notes: string;
  durationOverride: number | null;
  overrideReason: string;
};

const text = (value: unknown, max: number) =>
  String(value ?? "")
    .trim()
    .slice(0, max + 1);

export function ingredientFromRow(
  row: Record<string, unknown>,
): IngredientConfig {
  let preparationDays: number[] = [];
  try {
    const parsed = JSON.parse(String(row.preparation_days ?? "[]"));
    if (Array.isArray(parsed))
      preparationDays = parsed
        .map(Number)
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  } catch {}
  return {
    id: String(row.id),
    legacyCode: String(row.legacy_code),
    displayName: String(row.display_name),
    shortName: String(row.short_name),
    category: String(row.category),
    productType: String(row.product_type ?? "frais"),
    active: Boolean(row.active),
    quickEnabled: Boolean(row.quick_enabled),
    favorite: Boolean(row.favorite),
    displayOrder: Number(row.display_order ?? 1000),
    preparationDays,
    defaultOperation: String(row.default_operation) as OperationType,
    storageMode: String(row.storage_mode) as IngredientConfig["storageMode"],
    storageTemperature:
      row.storage_temperature === null || row.storage_temperature === undefined
        ? null
        : Number(row.storage_temperature),
    defaultBacs: Number(row.default_bacs ?? 1),
    defaultLabels: Number(row.default_labels ?? 1),
    labelFormat: String(row.label_format ?? "50x30") as LabelFormat,
    technicalDescription: String(row.technical_description ?? ""),
    allergens: String(row.allergens ?? ""),
    preparationProcedure: String(row.preparation_procedure ?? ""),
    handlingRules: String(row.handling_rules ?? ""),
    usageCount: Number(row.usage_count ?? 0),
    revision: Number(row.revision ?? 1),
    durationHours: Number(row.duration_hours ?? 48),
    requiresSourceLot: Boolean(row.requires_source_lot ?? true),
  };
}

export function validateQuickSelection(
  payload: Record<string, unknown>,
):
  | { value: QuickSelectionInput; error?: never }
  | { value?: never; error: string } {
  const ingredientId = String(payload.ingredientId ?? "");
  const operationType = String(payload.operationType ?? "") as OperationType;
  const bacCount = Number(payload.bacCount);
  const labelCount = Number(payload.labelCount);
  const preparedAt = String(payload.preparedAt ?? "");
  const sourceLotIds = Array.isArray(payload.sourceLotIds)
    ? [...new Set(payload.sourceLotIds.map(String))]
    : [];
  const rawDuration = payload.durationOverride;
  const durationOverride =
    rawDuration === null || rawDuration === undefined || rawDuration === ""
      ? null
      : Number(rawDuration);
  const value: QuickSelectionInput = {
    ingredientId,
    operationType,
    bacCount,
    labelCount,
    preparedAt,
    sourceLotIds,
    manualSourceLot: text(payload.manualSourceLot, 100),
    manualSourceReason: text(payload.manualSourceReason, 500),
    notes: text(payload.notes, 1000),
    durationOverride,
    overrideReason: text(payload.overrideReason, 500),
  };
  if (!validUuid(ingredientId))
    return { error: "Un ingrédient sélectionné est invalide." };
  if (!(operationType in OPERATION_LABELS))
    return { error: "Sélectionnez une opération valide." };
  if (!Number.isInteger(bacCount) || bacCount < 1 || bacCount > 50)
    return { error: "Le nombre de bacs doit être compris entre 1 et 50." };
  if (!Number.isInteger(labelCount) || labelCount < 1 || labelCount > 50)
    return { error: "Le nombre d’étiquettes doit être compris entre 1 et 50." };
  if (labelCount < bacCount)
    return { error: "Prévoyez au moins une étiquette par bac." };
  if (!isLocalDateTime(preparedAt))
    return { error: "Vérifiez la date et l’heure de préparation." };
  if (sourceLotIds.length > 20 || !sourceLotIds.every(validUuid))
    return { error: "Un lot fournisseur sélectionné est invalide." };
  if (value.manualSourceLot && !value.manualSourceReason)
    return {
      error:
        "Expliquez pourquoi le lot saisi manuellement n’existe pas encore dans une réception.",
    };
  if (
    durationOverride !== null &&
    (!Number.isInteger(durationOverride) ||
      durationOverride < 1 ||
      durationOverride > 8760)
  )
    return { error: "La durée doit être comprise entre 1 heure et 365 jours." };
  if (durationOverride !== null && !value.overrideReason)
    return { error: "Indiquez le motif de la modification de DLC." };
  if (
    value.manualSourceLot.length > 100 ||
    value.manualSourceReason.length > 500 ||
    value.notes.length > 1000 ||
    value.overrideReason.length > 500
  )
    return { error: "Un champ de texte est trop long." };
  return { value };
}

export function calculateInternalExpiry(
  preparedAt: string,
  durationHours: number,
  supplierDeadlines: Array<string | null>,
) {
  if (!isLocalDateTime(preparedAt))
    throw new Error("Date de préparation invalide.");
  if (!Number.isInteger(durationHours) || durationHours < 1)
    throw new Error("Durée interne invalide.");
  const internalExpiry = addHoursLocal(preparedAt, durationHours);
  const deadlines = supplierDeadlines
    .filter((value): value is string => Boolean(value && isLocalDate(value)))
    .map((value) => value + "T23:59")
    .sort();
  const supplierLimit = deadlines[0] ?? null;
  return {
    expiresAt:
      supplierLimit && supplierLimit < internalExpiry
        ? supplierLimit
        : internalExpiry,
    internalExpiry,
    supplierLimit,
    cappedBySupplier: Boolean(supplierLimit && supplierLimit < internalExpiry),
  };
}

export function parisDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    localDateTime: `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`,
  };
}

export function formatPreparationCode(date: string, sequence: number) {
  return `PREP-${date.replaceAll("-", "")}-${String(sequence).padStart(3, "0")}`;
}

export function formatLabelCode(preparationCode: string, index: number) {
  return `ETQ-${preparationCode.slice(5)}-${String(index).padStart(2, "0")}`;
}

export function shortTraceToken(uuid: string) {
  return uuid.replaceAll("-", "").slice(0, 16);
}

export function normalizePrinterError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.trim().slice(0, 500) || "Erreur d’impression inconnue.";
}

import { isLocalDate } from "./labels";

export type ReceptionStatus =
  | "in_progress"
  | "compliant"
  | "compliant_after_probe"
  | "non_compliant"
  | "refused";
export type TemperatureRegime = "refrigerated" | "frozen" | "ambient";
export type DeadlineType = "dlc" | "ddm" | "none";
export type PhotoKind =
  "delivery_note" | "product" | "thermometer" | "label" | "other";

export type Reception = {
  id: string;
  receptionCode: string;
  status: ReceptionStatus;
  supplierId: string | null;
  supplierName: string;
  deliveryNote: string;
  orderNumber: string;
  driverName: string;
  generalNotes: string;
  pinUsed: boolean;
  validatedAt: string | null;
  validatedByName: string | null;
  validationDevice: string;
  driverCompany: string;
  driverInitials: string;
  driverSignature: string | null;
  driverSignedAt: string | null;
  driverRefusedSign: boolean;
  driverRefusalComment: string;
  driverRecordedByName: string | null;
  revision: number;
  createdAt: string;
  createdByName: string;
  updatedAt: string | null;
  updatedByName: string | null;
};

export type ReceptionProduct = {
  id: string;
  receptionId: string;
  productName: string;
  category: string;
  temperatureRegime: TemperatureRegime;
  quantity: string;
  unit: string;
  supplierLot: string;
  deadlineType: DeadlineType;
  deadlineDate: string | null;
  storageTemperature: number | null;
  maxTemperature: number | null;
  packagingCompliant: boolean | null;
  visualCompliant: boolean | null;
  cleanlinessCompliant: boolean | null;
  humidityAbsent: boolean | null;
  pestsAbsent: boolean | null;
  productCompliant: boolean | null;
  selectedForMeasurement: boolean;
  suggestedForMeasurement: boolean;
  riskLevel: "normal" | "high";
  irTemperature: number | null;
  probeTemperature: number | null;
  measurementMethod: string;
  remeasureTemperature: number | null;
  observations: string;
  decisionType: string | null;
  concernedQuantity: string;
  nonConformityReason: string;
  nonConformityComment: string;
  correctiveAction: string;
  finalDecision: string;
  supplierLotId: string | null;
  revision: number;
  createdAt: string;
  createdByName: string;
  updatedAt: string | null;
  updatedByName: string | null;
};

export type ReceptionPhoto = {
  id: string;
  receptionId: string;
  productId: string | null;
  kind: PhotoKind;
  dataUrl: string;
  caption: string;
  createdAt: string;
  createdByName: string;
};

export type ReceptionAuditEvent = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
  changedByName: string;
};

export type ReceptionSummary = Reception & {
  productCount: number;
  measuredCount: number;
  nonConformityCount: number;
};

export type ReceptionPreset = {
  name: string;
  category: string;
  regime: TemperatureRegime;
  storageTemperature: number | null;
  maxTemperature: number | null;
  deadlineType: DeadlineType;
  risk: "normal" | "high";
};

// Valeurs internes prudentes et modifiables. L'étiquette du fabricant et le PMS
// du restaurant restent prioritaires lors de chaque réception.
export const RECEPTION_PRODUCT_PRESETS: ReceptionPreset[] = [
  {
    name: "Jambon blanc",
    category: "Charcuterie",
    regime: "refrigerated",
    storageTemperature: 4,
    maxTemperature: 4,
    deadlineType: "dlc",
    risk: "high",
  },
  {
    name: "Mozzarella / fior di latte",
    category: "Produits laitiers",
    regime: "refrigerated",
    storageTemperature: 4,
    maxTemperature: 4,
    deadlineType: "dlc",
    risk: "high",
  },
  {
    name: "Crème fraîche",
    category: "Produits laitiers",
    regime: "refrigerated",
    storageTemperature: 4,
    maxTemperature: 4,
    deadlineType: "dlc",
    risk: "high",
  },
  {
    name: "Parmesan",
    category: "Produits laitiers",
    regime: "refrigerated",
    storageTemperature: 4,
    maxTemperature: 4,
    deadlineType: "dlc",
    risk: "normal",
  },
  {
    name: "Dessous de palette de bœuf frais",
    category: "Viandes fraîches",
    regime: "refrigerated",
    storageTemperature: 4,
    maxTemperature: 4,
    deadlineType: "dlc",
    risk: "high",
  },
  {
    name: "Viande fraîche pour lasagne",
    category: "Viandes fraîches",
    regime: "refrigerated",
    storageTemperature: 4,
    maxTemperature: 4,
    deadlineType: "dlc",
    risk: "high",
  },
  {
    name: "Escalope de veau fraîche",
    category: "Viandes fraîches",
    regime: "refrigerated",
    storageTemperature: 4,
    maxTemperature: 4,
    deadlineType: "dlc",
    risk: "high",
  },
  {
    name: "Poisson frais",
    category: "Poissons",
    regime: "refrigerated",
    storageTemperature: 2,
    maxTemperature: 2,
    deadlineType: "dlc",
    risk: "high",
  },
  {
    name: "Seiche surgelée",
    category: "Produits de la mer",
    regime: "frozen",
    storageTemperature: -18,
    maxTemperature: -18,
    deadlineType: "ddm",
    risk: "high",
  },
  {
    name: "Poulpe surgelé",
    category: "Produits de la mer",
    regime: "frozen",
    storageTemperature: -18,
    maxTemperature: -18,
    deadlineType: "ddm",
    risk: "high",
  },
  {
    name: "Viande macaronade surgelée",
    category: "Viandes surgelées",
    regime: "frozen",
    storageTemperature: -18,
    maxTemperature: -18,
    deadlineType: "ddm",
    risk: "high",
  },
  {
    name: "Viande hachée surgelée",
    category: "Viandes surgelées",
    regime: "frozen",
    storageTemperature: -18,
    maxTemperature: -18,
    deadlineType: "ddm",
    risk: "high",
  },
  {
    name: "Steak haché surgelé",
    category: "Viandes surgelées",
    regime: "frozen",
    storageTemperature: -18,
    maxTemperature: -18,
    deadlineType: "ddm",
    risk: "high",
  },
  {
    name: "Viande kebab surgelée",
    category: "Viandes surgelées",
    regime: "frozen",
    storageTemperature: -18,
    maxTemperature: -18,
    deadlineType: "ddm",
    risk: "high",
  },
  {
    name: "Poulet pané surgelé",
    category: "Volailles surgelées",
    regime: "frozen",
    storageTemperature: -18,
    maxTemperature: -18,
    deadlineType: "ddm",
    risk: "high",
  },
  {
    name: "Nuggets surgelés",
    category: "Volailles surgelées",
    regime: "frozen",
    storageTemperature: -18,
    maxTemperature: -18,
    deadlineType: "ddm",
    risk: "normal",
  },
  {
    name: "Figues surgelées",
    category: "Fruits surgelés",
    regime: "frozen",
    storageTemperature: -18,
    maxTemperature: -18,
    deadlineType: "ddm",
    risk: "normal",
  },
  {
    name: "Frites surgelées",
    category: "Produits surgelés",
    regime: "frozen",
    storageTemperature: -18,
    maxTemperature: -18,
    deadlineType: "ddm",
    risk: "normal",
  },
  {
    name: "Champignons frais",
    category: "Fruits et légumes",
    regime: "refrigerated",
    storageTemperature: 4,
    maxTemperature: 4,
    deadlineType: "none",
    risk: "normal",
  },
  {
    name: "Persil frais",
    category: "Fruits et légumes",
    regime: "refrigerated",
    storageTemperature: 4,
    maxTemperature: 4,
    deadlineType: "none",
    risk: "normal",
  },
  {
    name: "Tomates fraîches",
    category: "Fruits et légumes",
    regime: "ambient",
    storageTemperature: null,
    maxTemperature: null,
    deadlineType: "none",
    risk: "normal",
  },
  {
    name: "Avocats",
    category: "Fruits et légumes",
    regime: "ambient",
    storageTemperature: null,
    maxTemperature: null,
    deadlineType: "none",
    risk: "normal",
  },
  {
    name: "Grenades",
    category: "Fruits et légumes",
    regime: "ambient",
    storageTemperature: null,
    maxTemperature: null,
    deadlineType: "none",
    risk: "normal",
  },
  {
    name: "Farine",
    category: "Épicerie sèche",
    regime: "ambient",
    storageTemperature: null,
    maxTemperature: null,
    deadlineType: "ddm",
    risk: "normal",
  },
  {
    name: "Riz à risotto",
    category: "Épicerie sèche",
    regime: "ambient",
    storageTemperature: null,
    maxTemperature: null,
    deadlineType: "ddm",
    risk: "normal",
  },
  {
    name: "Conserves de tomate",
    category: "Conserves",
    regime: "ambient",
    storageTemperature: null,
    maxTemperature: null,
    deadlineType: "ddm",
    risk: "normal",
  },
  {
    name: "Olives noires",
    category: "Conserves",
    regime: "ambient",
    storageTemperature: null,
    maxTemperature: null,
    deadlineType: "ddm",
    risk: "normal",
  },
  {
    name: "Nduja fermée",
    category: "Charcuterie",
    regime: "refrigerated",
    storageTemperature: 4,
    maxTemperature: 4,
    deadlineType: "dlc",
    risk: "normal",
  },
  {
    name: "Boissons fermées",
    category: "Boissons",
    regime: "ambient",
    storageTemperature: null,
    maxTemperature: null,
    deadlineType: "ddm",
    risk: "normal",
  },
];

export const RECEPTION_STATUS_LABELS: Record<ReceptionStatus, string> = {
  in_progress: "En cours",
  compliant: "Conforme",
  compliant_after_probe: "Conforme après contrôle complémentaire",
  non_compliant: "Non conforme",
  refused: "Refusée",
};

export const DECISION_LABELS: Record<string, string> = {
  new_measure: "Nouvelle mesure",
  total_refusal: "Refus total",
  partial_refusal: "Refus partiel",
  supplier_return: "Retour fournisseur",
  delivery_reserve: "Réserve sur bon de livraison",
  justified_acceptance: "Acceptation justifiée",
  quarantine: "Mise en quarantaine",
  other: "Autre",
};

export const METHOD_LABELS: Record<string, string> = {
  ir_surface: "IR surface",
  between_packages: "Sonde entre emballages",
  contact: "Sonde au contact",
  core: "Sonde à cœur",
};

const nullableString = (value: unknown) =>
  value === null || value === undefined || value === "" ? null : String(value);
const nullableBool = (value: unknown) =>
  value === null || value === undefined ? null : Boolean(value);
const nullableNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(",", ".").replace("+", ""));
  return Number.isFinite(number) ? number : Number.NaN;
};
const clean = (value: unknown, max: number) =>
  String(value ?? "")
    .trim()
    .slice(0, max + 1);

export function receptionFromRow(row: Record<string, unknown>): Reception {
  return {
    id: String(row.id),
    receptionCode: String(row.reception_code),
    status: row.status as ReceptionStatus,
    supplierId: nullableString(row.supplier_id),
    supplierName: String(row.supplier_name ?? ""),
    deliveryNote: String(row.delivery_note ?? ""),
    orderNumber: String(row.order_number ?? ""),
    driverName: String(row.driver_name ?? ""),
    generalNotes: String(row.general_notes ?? ""),
    pinUsed: Boolean(row.pin_used),
    validatedAt: nullableString(row.validated_at),
    validatedByName: nullableString(row.validated_by_name),
    validationDevice: String(row.validation_device ?? ""),
    driverCompany: String(row.driver_company ?? ""),
    driverInitials: String(row.driver_initials ?? ""),
    driverSignature: nullableString(row.driver_signature),
    driverSignedAt: nullableString(row.driver_signed_at),
    driverRefusedSign: Boolean(row.driver_refused_sign),
    driverRefusalComment: String(row.driver_refusal_comment ?? ""),
    driverRecordedByName: nullableString(row.driver_recorded_by_name),
    revision: Number(row.revision ?? 1),
    createdAt: String(row.created_at),
    createdByName: String(row.created_by_name),
    updatedAt: nullableString(row.updated_at),
    updatedByName: nullableString(row.updated_by_name),
  };
}

export function productFromRow(row: Record<string, unknown>): ReceptionProduct {
  return {
    id: String(row.id),
    receptionId: String(row.reception_id),
    productName: String(row.product_name),
    category: String(row.category),
    temperatureRegime: row.temperature_regime as TemperatureRegime,
    quantity: String(row.quantity ?? ""),
    unit: String(row.unit ?? ""),
    supplierLot: String(row.supplier_lot ?? ""),
    deadlineType: row.deadline_type as DeadlineType,
    deadlineDate: nullableString(row.deadline_date),
    storageTemperature: nullableNumber(row.storage_temperature),
    maxTemperature: nullableNumber(row.max_temperature),
    packagingCompliant: nullableBool(row.packaging_compliant),
    visualCompliant: nullableBool(row.visual_compliant),
    cleanlinessCompliant: nullableBool(row.cleanliness_compliant),
    humidityAbsent: nullableBool(row.humidity_absent),
    pestsAbsent: nullableBool(row.pests_absent),
    productCompliant: nullableBool(row.product_compliant),
    selectedForMeasurement: Boolean(row.selected_for_measurement),
    suggestedForMeasurement: Boolean(row.suggested_for_measurement),
    riskLevel: row.risk_level === "high" ? "high" : "normal",
    irTemperature: nullableNumber(row.ir_temperature),
    probeTemperature: nullableNumber(row.probe_temperature),
    measurementMethod: String(row.measurement_method ?? ""),
    remeasureTemperature: nullableNumber(row.remeasure_temperature),
    observations: String(row.observations ?? ""),
    decisionType: nullableString(row.decision_type),
    concernedQuantity: String(row.concerned_quantity ?? ""),
    nonConformityReason: String(row.non_conformity_reason ?? ""),
    nonConformityComment: String(row.non_conformity_comment ?? ""),
    correctiveAction: String(row.corrective_action ?? ""),
    finalDecision: String(row.final_decision ?? ""),
    supplierLotId: nullableString(row.supplier_lot_id),
    revision: Number(row.revision ?? 1),
    createdAt: String(row.created_at),
    createdByName: String(row.created_by_name),
    updatedAt: nullableString(row.updated_at),
    updatedByName: nullableString(row.updated_by_name),
  };
}

export function photoFromRow(row: Record<string, unknown>): ReceptionPhoto {
  return {
    id: String(row.id),
    receptionId: String(row.reception_id),
    productId: nullableString(row.product_id),
    kind: row.kind as PhotoKind,
    dataUrl: String(row.data_url),
    caption: String(row.caption ?? ""),
    createdAt: String(row.created_at),
    createdByName: String(row.created_by_name),
  };
}

export function auditFromRow(
  row: Record<string, unknown>,
): ReceptionAuditEvent {
  return {
    id: String(row.id),
    entityType: String(row.entity_type),
    entityId: String(row.entity_id),
    action: String(row.action),
    fieldName: String(row.field_name ?? ""),
    oldValue: nullableString(row.old_value),
    newValue: nullableString(row.new_value),
    changedAt: String(row.changed_at),
    changedByName: String(row.changed_by_name),
  };
}

export function summaryFromRow(row: Record<string, unknown>): ReceptionSummary {
  return {
    ...receptionFromRow(row),
    productCount: Number(row.product_count ?? 0),
    measuredCount: Number(row.measured_count ?? 0),
    nonConformityCount: Number(row.non_conformity_count ?? 0),
  };
}

export function validateReceptionHeader(payload: Record<string, unknown>) {
  const value = {
    supplierId: nullableString(payload.supplierId),
    supplierName: clean(payload.supplierName, 120),
    deliveryNote: clean(payload.deliveryNote, 120),
    orderNumber: clean(payload.orderNumber, 120),
    driverName: clean(payload.driverName, 120),
    generalNotes: clean(payload.generalNotes, 3000),
  };
  if (!value.supplierName)
    return { error: "Sélectionnez ou renseignez le fournisseur." } as const;
  if (!value.deliveryNote)
    return { error: "Renseignez le numéro du bon de livraison." } as const;
  if (
    value.supplierName.length > 120 ||
    value.deliveryNote.length > 120 ||
    value.orderNumber.length > 120 ||
    value.driverName.length > 120 ||
    value.generalNotes.length > 3000
  )
    return { error: "Un champ de la réception est trop long." } as const;
  return { value } as const;
}

export function validateProductPayload(payload: Record<string, unknown>) {
  const temperatureRegime = String(payload.temperatureRegime ?? ""),
    deadlineType = String(payload.deadlineType ?? "none"),
    deadlineDate = nullableString(payload.deadlineDate),
    storageTemperature = nullableNumber(payload.storageTemperature),
    maxTemperature = nullableNumber(payload.maxTemperature),
    irTemperature = nullableNumber(payload.irTemperature),
    probeTemperature = nullableNumber(payload.probeTemperature),
    remeasureTemperature = nullableNumber(payload.remeasureTemperature);
  const value = {
    productName: clean(payload.productName, 140),
    category: clean(payload.category, 100) || "Autres",
    temperatureRegime: temperatureRegime as TemperatureRegime,
    quantity: clean(payload.quantity, 60),
    unit: clean(payload.unit, 30) || "kg",
    supplierLot: clean(payload.supplierLot, 120),
    deadlineType: deadlineType as DeadlineType,
    deadlineDate,
    storageTemperature,
    maxTemperature,
    packagingCompliant: nullableBool(payload.packagingCompliant),
    visualCompliant: nullableBool(payload.visualCompliant),
    cleanlinessCompliant: nullableBool(payload.cleanlinessCompliant),
    humidityAbsent: nullableBool(payload.humidityAbsent),
    pestsAbsent: nullableBool(payload.pestsAbsent),
    productCompliant: nullableBool(payload.productCompliant),
    selectedForMeasurement: Boolean(payload.selectedForMeasurement),
    suggestedForMeasurement: Boolean(payload.suggestedForMeasurement),
    riskLevel:
      payload.riskLevel === "high" ? ("high" as const) : ("normal" as const),
    irTemperature,
    probeTemperature,
    measurementMethod: clean(payload.measurementMethod, 50),
    remeasureTemperature,
    observations: clean(payload.observations, 2000),
    decisionType: nullableString(payload.decisionType),
    concernedQuantity: clean(payload.concernedQuantity, 60),
    nonConformityReason: clean(payload.nonConformityReason, 1000),
    nonConformityComment: clean(payload.nonConformityComment, 2000),
    correctiveAction: clean(payload.correctiveAction, 2000),
    finalDecision: clean(payload.finalDecision, 1000),
    revision: Math.max(0, Number(payload.revision ?? 0) || 0),
  };
  if (!value.productName)
    return { error: "Renseignez le nom du produit." } as const;
  if (!["refrigerated", "frozen", "ambient"].includes(temperatureRegime))
    return { error: "Sélectionnez le régime de température." } as const;
  if (!["dlc", "ddm", "none"].includes(deadlineType))
    return { error: "Sélectionnez DLC, DDM ou sans date." } as const;
  if (deadlineType !== "none" && (!deadlineDate || !isLocalDate(deadlineDate)))
    return { error: "Vérifiez la date DLC ou DDM." } as const;
  for (const number of [
    storageTemperature,
    maxTemperature,
    irTemperature,
    probeTemperature,
    remeasureTemperature,
  ])
    if (
      number !== null &&
      (!Number.isFinite(number) || number < -60 || number > 80)
    )
      return { error: "Vérifiez les températures saisies." } as const;
  if (temperatureRegime !== "ambient" && maxTemperature === null)
    return { error: "Renseignez la température maximale autorisée." } as const;
  if (
    value.measurementMethod &&
    !["ir_surface", "between_packages", "contact", "core"].includes(
      value.measurementMethod,
    )
  )
    return { error: "Sélectionnez une méthode de mesure valide." } as const;
  if (value.decisionType && !Object.hasOwn(DECISION_LABELS, value.decisionType))
    return { error: "Sélectionnez une décision valide." } as const;
  return { value } as const;
}

export function probeRequired(
  product: Pick<
    ReceptionProduct,
    | "selectedForMeasurement"
    | "temperatureRegime"
    | "irTemperature"
    | "maxTemperature"
  >,
) {
  return (
    product.selectedForMeasurement &&
    product.temperatureRegime !== "ambient" &&
    product.irTemperature !== null &&
    product.maxTemperature !== null &&
    product.irTemperature > product.maxTemperature
  );
}

export function probeNonCompliant(
  product: Pick<ReceptionProduct, "probeTemperature" | "maxTemperature">,
) {
  return (
    product.probeTemperature !== null &&
    product.maxTemperature !== null &&
    product.probeTemperature > product.maxTemperature
  );
}

export function validationErrors(products: ReceptionProduct[]) {
  const errors: string[] = [];
  if (!products.length) return ["Ajoutez au moins un produit reçu."];
  for (const p of products) {
    const prefix = p.productName || "Produit";
    if (!p.quantity || !p.unit)
      errors.push(`${prefix} : renseignez la quantité et l’unité.`);
    if (!p.supplierLot)
      errors.push(`${prefix} : renseignez le lot fournisseur.`);
    if (p.deadlineType !== "none" && !p.deadlineDate)
      errors.push(`${prefix} : renseignez la ${p.deadlineType.toUpperCase()}.`);
    if (p.packagingCompliant === null || p.visualCompliant === null)
      errors.push(`${prefix} : contrôlez l’emballage et l’état visuel.`);
    if (p.temperatureRegime === "ambient") {
      if (
        [
          p.cleanlinessCompliant,
          p.humidityAbsent,
          p.pestsAbsent,
          p.productCompliant,
        ].some((v) => v === null)
      )
        errors.push(
          `${prefix} : complétez les contrôles du produit à température ambiante.`,
        );
    } else if (p.selectedForMeasurement) {
      if (p.irTemperature === null)
        errors.push(`${prefix} : saisissez la température IR initiale.`);
      if (probeRequired(p)) {
        if (p.probeTemperature === null)
          errors.push(
            `${prefix} : le contrôle complémentaire par sonde est requis.`,
          );
        if (!p.measurementMethod || p.measurementMethod === "ir_surface")
          errors.push(`${prefix} : précisez la méthode de mesure par sonde.`);
      }
      if (
        probeNonCompliant(p) &&
        (!p.decisionType ||
          !p.concernedQuantity ||
          !p.nonConformityReason ||
          !p.correctiveAction ||
          !p.finalDecision)
      )
        errors.push(
          `${prefix} : documentez la non-conformité, l’action corrective et la décision finale.`,
        );
    }
    if (
      p.packagingCompliant === false ||
      p.visualCompliant === false ||
      p.productCompliant === false
    ) {
      if (
        !p.decisionType ||
        !p.concernedQuantity ||
        !p.correctiveAction ||
        !p.finalDecision
      )
        errors.push(
          `${prefix} : une non-conformité produit ne peut pas être clôturée sans action et décision.`,
        );
    }
  }
  const cold = products.filter((p) => p.temperatureRegime !== "ambient");
  if (
    cold.length &&
    !cold.some((p) => p.selectedForMeasurement && p.irTemperature !== null)
  )
    errors.push(
      "Mesurez au moins un produit réfrigéré ou surgelé représentatif.",
    );
  return [...new Set(errors)];
}

export function finalReceptionStatus(
  products: ReceptionProduct[],
): ReceptionStatus {
  const nonCompliant = products.filter(
    (p) =>
      probeNonCompliant(p) ||
      p.packagingCompliant === false ||
      p.visualCompliant === false ||
      p.productCompliant === false,
  );
  if (
    nonCompliant.some((p) =>
      ["total_refusal", "supplier_return"].includes(p.decisionType ?? ""),
    )
  )
    return "refused";
  if (nonCompliant.length) return "non_compliant";
  if (products.some((p) => p.probeTemperature !== null))
    return "compliant_after_probe";
  return "compliant";
}

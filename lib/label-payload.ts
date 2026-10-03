import {
  addHoursLocal,
  CUSTOM_PREPARATION_CATEGORY,
  CUSTOM_PREPARATION_CODE,
  customPreparationPreset,
  isLocalDate,
  isLocalDateTime,
  minutesBetween,
  presetFor,
  type ProcessType,
  type PreparationPreset,
} from "./labels";
import { validateSourceLotIds } from "./supply";

export const COOLING_TARGET_MAX_C = 10;

export type NormalizedLabelPayload = {
  preset: PreparationPreset;
  durationHours: number;
  preparedAt: string;
  frozenAt: string | null;
  expiresAt: string;
  operatorInitials: string;
  lotCode: string;
  quantity: string;
  packaging: string;
  note: string;
  supplierName: string;
  supplierLot: string;
  supplierDeadline: string | null;
  receivedAt: string | null;
  openedAt: string | null;
  sourceLabelId: string | null;
  sourceLotIds: string[];
  cookingEndedAt: string | null;
  cookingTemperature: number | null;
  coolingStartedAt: string | null;
  coolingStartTemperature: number | null;
  coolingEndedAt: string | null;
  coolingEndTemperature: number | null;
  coolingMethod: string;
  coolingDurationMinutes: number | null;
  coolingCompliant: boolean | null;
  thawingStartedAt: string | null;
  thawingMethod: string;
  freezeMethod: string;
  freezerTemperature: number | null;
  correctiveAction: string;
  controlStatus: "compliant" | "non_compliant" | "not_applicable";
};
type Result =
  | { value: NormalizedLabelPayload; error?: never }
  | { value?: never; error: string };
const dt = (v: unknown) =>
    v === null || v === undefined || v === "" ? null : String(v),
  txt = (v: unknown, max: number) =>
    String(v ?? "")
      .trim()
      .slice(0, max + 1),
  num = (v: unknown) =>
    v === null || v === undefined || v === "" ? null : Number(v),
  temp = (v: number | null, min = -50, max = 200) =>
    v !== null && Number.isFinite(v) && v >= min && v <= max;
export function validateLabelPayload(payload: Record<string, unknown>): Result {
  const productCode = String(payload.productCode ?? ""),
    requestedProductName = txt(
      payload.productName ?? payload.customProductName,
      80,
    );
  let preset = presetFor(productCode);
  if (!preset) {
    const customCategory =
        txt(payload.customCategory, 80) || CUSTOM_PREPARATION_CATEGORY,
      customProcessType = String(payload.customProcessType ?? ""),
      customStorageTemperature = num(payload.customStorageTemperature),
      processTypes: ProcessType[] = [
        "cold_preparation",
        "raw_preparation",
        "cooked_cooled",
        "opened",
        "thawed",
        "frozen_in_house",
        "supplier_frozen",
      ];
    if (!requestedProductName || requestedProductName.length > 80)
      return { error: "Écrivez le nom de la nouvelle préparation." };
    if (customCategory.length > 80)
      return { error: "La famille de la préparation est trop longue." };
    if (!processTypes.includes(customProcessType as ProcessType))
      return { error: "Sélectionnez l’opération réellement réalisée." };
    if (!temp(customStorageTemperature, -50, 15))
      return { error: "Vérifiez la température de conservation." };
    if (
      productCode !== CUSTOM_PREPARATION_CODE &&
      !/^libre-[a-z0-9-]{1,100}$/.test(productCode)
    )
      return {
        error:
          "Cette préparation personnalisée n’est pas reconnue. Sélectionnez-la à nouveau.",
      };
    preset = customPreparationPreset({
      code: productCode,
      name: requestedProductName,
      category: customCategory,
      durationHours: Number(payload.durationHours),
      processType: customProcessType as ProcessType,
      storageTemperature: customStorageTemperature!,
    });
  } else if (requestedProductName) {
    if (requestedProductName.length > 80)
      return { error: "Le nom imprimé sur l’étiquette est trop long." };
    preset = { ...preset, name: requestedProductName };
  }
  const isOpened =
      preset.processType === "opened" ||
      preset.processType === "supplier_frozen",
    isCooked = preset.processType === "cooked_cooled",
    isThawed = preset.processType === "thawed",
    isFrozen = preset.processType === "frozen_in_house";
  const preparedAt = String(payload.preparedAt ?? ""),
    frozenAt = isFrozen ? dt(payload.frozenAt) : null,
    openedAt = isOpened ? dt(payload.openedAt) : null,
    receivedAt = dt(payload.receivedAt),
    cookingEndedAt = isCooked ? dt(payload.cookingEndedAt) : null,
    coolingStartedAt = isCooked ? dt(payload.coolingStartedAt) : null,
    coolingEndedAt = isCooked ? dt(payload.coolingEndedAt) : null,
    thawingStartedAt = isThawed ? dt(payload.thawingStartedAt) : null,
    supplierDeadline = payload.supplierDeadline
      ? String(payload.supplierDeadline)
      : null;
  const operatorInitials = txt(payload.operatorInitials, 12).toUpperCase(),
    durationInput = Number(payload.durationHours),
    lotCode = txt(payload.lotCode, 50),
    quantity = txt(payload.quantity, 40),
    packaging = txt(payload.packaging, 60),
    note = txt(payload.note, 1500),
    supplierName = txt(payload.supplierName, 80),
    supplierLot = txt(payload.supplierLot, 80),
    correctiveAction = txt(payload.correctiveAction, 1200),
    sourceLabelId = payload.sourceLabelId
      ? String(payload.sourceLabelId)
      : null;
  const checkedSourceLots = validateSourceLotIds(payload.sourceLotIds);
  if (checkedSourceLots.error !== undefined)
    return { error: checkedSourceLots.error };
  const cookingTemperature = isCooked ? num(payload.cookingTemperature) : null,
    coolingStartTemperature = isCooked
      ? num(payload.coolingStartTemperature)
      : null,
    coolingEndTemperature = isCooked
      ? num(payload.coolingEndTemperature)
      : null,
    freezerTemperature = isFrozen ? num(payload.freezerTemperature) : null,
    coolingMethod = isCooked ? txt(payload.coolingMethod, 50) : "",
    thawingMethod = isThawed ? txt(payload.thawingMethod, 50) : "",
    freezeMethod = isFrozen ? txt(payload.freezeMethod, 60) : "";
  if (!isLocalDateTime(preparedAt))
    return {
      error: "Vérifiez la date et l’heure de préparation ou de mise en bac.",
    };
  if (
    ![
      frozenAt,
      openedAt,
      receivedAt,
      cookingEndedAt,
      coolingStartedAt,
      coolingEndedAt,
      thawingStartedAt,
    ].every((v) => v === null || isLocalDateTime(v))
  )
    return { error: "Vérifiez les dates et heures de la fiche." };
  if (supplierDeadline !== null && !isLocalDate(supplierDeadline))
    return { error: "Vérifiez la DLC ou DDM du fournisseur." };
  if (
    !Number.isInteger(durationInput) ||
    durationInput < 1 ||
    durationInput > 8760
  )
    return { error: "La durée doit être comprise entre 1 heure et 365 jours." };
  if (!/^[A-ZÀ-Ÿ0-9 .'-]{1,12}$/.test(operatorInitials))
    return {
      error: "Ajoutez des initiales valides, sur 12 caractères maximum.",
    };
  if (
    lotCode.length > 50 ||
    quantity.length > 40 ||
    packaging.length > 60 ||
    note.length > 1500 ||
    supplierName.length > 80 ||
    supplierLot.length > 80 ||
    correctiveAction.length > 1200
  )
    return { error: "Un champ de texte est trop long." };
  if (
    sourceLabelId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      sourceLabelId,
    )
  )
    return { error: "La fiche source sélectionnée est invalide." };
  if (
    preset.processType === "opened" ||
    preset.processType === "supplier_frozen"
  ) {
    if (!openedAt)
      return {
        error: "Renseignez la date et l’heure d’ouverture ou de transvasement.",
      };
  }
  if (preset.processType === "supplier_frozen" && !supplierDeadline)
    return { error: "Recopiez la DDM du produit surgelé fournisseur." };
  if (preset.processType === "thawed") {
    if (!thawingStartedAt)
      return { error: "Renseignez le début de la décongélation." };
    if (!thawingMethod)
      return { error: "Sélectionnez la méthode de décongélation." };
  }
  if (preset.processType === "frozen_in_house") {
    if (!frozenAt)
      return { error: "Renseignez la date et l’heure de congélation." };
    if (frozenAt < preparedAt)
      return { error: "La congélation ne peut pas précéder la préparation." };
    if (frozenAt.slice(0, 10) !== preparedAt.slice(0, 10))
      return {
        error:
          "La congélation maison doit être enregistrée le jour de la préparation.",
      };
    if (!freezeMethod)
      return { error: "Renseignez l’équipement ou la méthode de congélation." };
    if (!temp(freezerTemperature, -50, 10))
      return { error: "Vérifiez la température du congélateur." };
  }
  let coolingDurationMinutes: number | null = null,
    coolingCompliant: boolean | null = null,
    controlStatus: NormalizedLabelPayload["controlStatus"] = "not_applicable";
  if (preset.processType === "cooked_cooled") {
    if (!cookingEndedAt || !temp(cookingTemperature, 0, 200))
      return {
        error: "Renseignez la fin de cuisson et la température à cœur.",
      };
    if (!coolingStartedAt || !temp(coolingStartTemperature, 0, 200))
      return {
        error:
          "Renseignez le début du refroidissement et sa température initiale.",
      };
    if (!coolingEndedAt || !temp(coolingEndTemperature, -5, 30))
      return {
        error:
          "Renseignez la fin du refroidissement et la température finale à cœur.",
      };
    if (!coolingMethod)
      return { error: "Sélectionnez la méthode de refroidissement." };
    if (coolingStartedAt < cookingEndedAt)
      return {
        error:
          "Le refroidissement ne peut pas commencer avant la fin de cuisson.",
      };
    coolingDurationMinutes = minutesBetween(coolingStartedAt, coolingEndedAt);
    if (coolingDurationMinutes === null || coolingDurationMinutes < 0)
      return { error: "La fin du refroidissement doit suivre son début." };
    coolingCompliant =
      cookingTemperature! >= 63 &&
      coolingStartTemperature! >= 63 &&
      coolingEndTemperature! <= COOLING_TARGET_MAX_C &&
      coolingDurationMinutes <= 120;
    controlStatus = coolingCompliant ? "compliant" : "non_compliant";
  }
  if (preset.processType === "frozen_in_house")
    controlStatus =
      freezerTemperature !== null && freezerTemperature <= -18
        ? "compliant"
        : "non_compliant";
  if (controlStatus === "non_compliant" && !correctiveAction)
    return {
      error:
        "Le contrôle est hors objectif : décrivez l’action corrective réellement réalisée.",
    };
  let startsAt = preparedAt;
  if (preset.dateBasis === "opened") startsAt = openedAt!;
  if (preset.dateBasis === "thawed") startsAt = thawingStartedAt!;
  if (preset.dateBasis === "frozen") startsAt = frozenAt!;
  if (preset.dateBasis === "cooled") startsAt = coolingEndedAt!;
  let durationHours = durationInput,
    expiresAt = addHoursLocal(startsAt, durationHours);
  if (preset.supplierExpiry) {
    expiresAt = supplierDeadline + "T23:59";
    const d = minutesBetween(startsAt, expiresAt);
    if (d === null || d <= 0)
      return {
        error: "La DDM fournisseur doit être postérieure au transvasement.",
      };
    durationHours = Math.ceil(d / 60);
  }
  return {
    value: {
      preset,
      durationHours,
      preparedAt,
      frozenAt,
      expiresAt,
      operatorInitials,
      lotCode,
      quantity,
      packaging,
      note,
      supplierName,
      supplierLot,
      supplierDeadline,
      receivedAt,
      openedAt,
      sourceLabelId,
      sourceLotIds: checkedSourceLots.value,
      cookingEndedAt,
      cookingTemperature,
      coolingStartedAt,
      coolingStartTemperature,
      coolingEndedAt,
      coolingEndTemperature,
      coolingMethod,
      coolingDurationMinutes,
      coolingCompliant,
      thawingStartedAt,
      thawingMethod,
      freezeMethod,
      freezerTemperature,
      correctiveAction,
      controlStatus,
    },
  };
}
export function automaticLot(code: string, at: string, id: string) {
  return (
    code.replace(/[^a-z0-9]+/gi, "-").slice(0, 12) +
    "-" +
    at.replace(/[-:T]/g, "").slice(2, 12) +
    "-" +
    id.slice(0, 4)
  ).toUpperCase();
}

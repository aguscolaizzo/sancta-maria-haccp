export type StorageMode = "refrigerated" | "frozen";
export type ProcessType =
  | "cold_preparation"
  | "raw_preparation"
  | "cooked_cooled"
  | "opened"
  | "thawed"
  | "frozen_in_house"
  | "supplier_frozen";
export type SourceState = "fresh" | "supplier_frozen" | "opened" | "cooked";
export type PreparationPreset = {
  code: string;
  name: string;
  category: string;
  durationHours: number;
  storageMode: StorageMode;
  storageTemperature: number;
  processType: ProcessType;
  sourceState: SourceState;
  dateBasis: "prepared" | "opened" | "thawed" | "frozen" | "cooled";
  startLabel: string;
  rule: string;
  supplierExpiry?: boolean;
};

const COOKED = "Préparations cuisinées",
  PIZZA = "Mise en place pizza & légumes",
  OPENED = "Produits ouverts / transvasés",
  THAWED = "Décongélation contrôlée",
  HOUSE = "Congélation maison",
  FROZEN = "Surgelés en bac identifié",
  DESSERTS = "Desserts & pâtisserie";
const p = (
  code: string,
  name: string,
  category: string,
  durationHours: number,
  storageMode: StorageMode,
  storageTemperature: number,
  processType: ProcessType,
  sourceState: SourceState,
  dateBasis: PreparationPreset["dateBasis"],
  startLabel: string,
  rule: string,
  supplierExpiry = false,
): PreparationPreset => ({
  code,
  name,
  category,
  durationHours,
  storageMode,
  storageTemperature,
  processType,
  sourceState,
  dateBasis,
  startLabel,
  rule,
  supplierExpiry,
});
const opened = (code: string, name: string, durationHours = 24) =>
  p(
    code,
    name,
    OPENED,
    durationHours,
    "refrigerated",
    4,
    "opened",
    "opened",
    "opened",
    "OUV.",
    `Après ouverture ou transvasement : règle PMS proposée ${durationHours} h, sans dépasser le délai et la température indiqués par le fabricant.`,
  );
const frozenBin = (code: string, name: string) =>
  p(
    code,
    name,
    FROZEN,
    720,
    "frozen",
    -18,
    "supplier_frozen",
    "supplier_frozen",
    "opened",
    "TRANS.",
    "Recopier le lot et la DDM fournisseur sur le bac. Cuisson directe depuis surgelé recommandée.",
    true,
  );

export const PREPARATION_PRESETS: PreparationPreset[] = [
  p(
    "macaronade",
    "Macaronade",
    COOKED,
    72,
    "refrigerated",
    3,
    "cooked_cooled",
    "cooked",
    "cooled",
    "REFR.",
    "Refroidissement rapide contrôlé puis conservation à 0/+3 °C · PMS interne 72 h.",
  ),
  p(
    "lasagne-viande",
    "Lasagnes à la viande",
    COOKED,
    72,
    "refrigerated",
    3,
    "cooked_cooled",
    "cooked",
    "cooled",
    "REFR.",
    "Viande fraîche · refroidissement rapide contrôlé · PMS interne 72 h.",
  ),
  p(
    "lasagne-poulpe",
    "Lasagnes au poulpe",
    COOKED,
    48,
    "refrigerated",
    3,
    "cooked_cooled",
    "cooked",
    "cooled",
    "REFR.",
    "Poulpe surgelé fournisseur · conserver le lot source · PMS interne 48 h.",
  ),
  p(
    "seiche-fricassee",
    "Seiche cuite / fricassée",
    COOKED,
    48,
    "refrigerated",
    3,
    "cooked_cooled",
    "cooked",
    "cooled",
    "REFR.",
    "Cuisson depuis surgelé possible · refroidissement rapide contrôlé · PMS interne 48 h.",
  ),
  p(
    "poulpe-cuit",
    "Poulpe cuit pour lasagnes",
    COOKED,
    48,
    "refrigerated",
    3,
    "cooked_cooled",
    "cooked",
    "cooled",
    "REFR.",
    "Cuisson depuis surgelé possible · conserver le lot source · PMS interne 48 h.",
  ),
  p(
    "risotto",
    "Risotto",
    COOKED,
    48,
    "refrigerated",
    3,
    "cooked_cooled",
    "cooked",
    "cooled",
    "REFR.",
    "Riz cuit · refroidissement rapide contrôlé · PMS interne 48 h.",
  ),
  p(
    "sauce-tomate-maison",
    "Sauce tomate maison",
    COOKED,
    72,
    "refrigerated",
    3,
    "cooked_cooled",
    "cooked",
    "cooled",
    "REFR.",
    "Sauce cuite · refroidissement rapide contrôlé · PMS interne 72 h.",
  ),
  p(
    "sauce-roquefort-maison",
    "Sauce Roquefort maison",
    COOKED,
    48,
    "refrigerated",
    3,
    "cooked_cooled",
    "cooked",
    "cooled",
    "REFR.",
    "Sauce à base de crème · refroidissement rapide contrôlé · PMS interne 48 h.",
  ),
  p(
    "sauce-creme-maison",
    "Sauce crème maison",
    COOKED,
    48,
    "refrigerated",
    3,
    "cooked_cooled",
    "cooked",
    "cooled",
    "REFR.",
    "Sauce à base de crème · refroidissement rapide contrôlé · PMS interne 48 h.",
  ),
  p(
    "legumes-cuisines",
    "Poivrons / aubergines cuisinés",
    COOKED,
    72,
    "refrigerated",
    3,
    "cooked_cooled",
    "cooked",
    "cooled",
    "REFR.",
    "Légumes cuits · refroidissement rapide contrôlé · PMS interne 72 h.",
  ),
  p(
    "pommes-terre-cuites",
    "Pommes de terre cuites",
    COOKED,
    72,
    "refrigerated",
    3,
    "cooked_cooled",
    "cooked",
    "cooled",
    "REFR.",
    "Refroidissement rapide contrôlé · PMS interne 72 h.",
  ),

  p(
    "pate-pizza",
    "Pâte à pizza",
    PIZZA,
    72,
    "refrigerated",
    4,
    "cold_preparation",
    "fresh",
    "prepared",
    "PRÉP.",
    "Bac fermé · date de pétrissage et opérateur · PMS interne 72 h.",
  ),
  p(
    "tomates-coupees",
    "Tomates coupées",
    PIZZA,
    48,
    "refrigerated",
    4,
    "cold_preparation",
    "fresh",
    "prepared",
    "PRÉP.",
    "Saladette réfrigérée ≤ +4 °C · PMS interne proposée 48 h.",
  ),
  p(
    "tomates-cerises",
    "Tomates cerises coupées",
    PIZZA,
    48,
    "refrigerated",
    4,
    "cold_preparation",
    "fresh",
    "prepared",
    "PRÉP.",
    "Bac fermé en saladette réfrigérée · PMS interne 48 h.",
  ),
  p(
    "champignons-eminces",
    "Champignons émincés",
    PIZZA,
    48,
    "refrigerated",
    4,
    "cold_preparation",
    "fresh",
    "prepared",
    "PRÉP.",
    "Bac fermé en saladette réfrigérée · PMS interne 48 h.",
  ),
  p(
    "oignons-eminces",
    "Oignons émincés",
    PIZZA,
    72,
    "refrigerated",
    4,
    "cold_preparation",
    "fresh",
    "prepared",
    "PRÉP.",
    "Bac fermé en saladette réfrigérée · PMS interne 72 h.",
  ),
  p(
    "poivrons-decoupes",
    "Poivrons découpés",
    PIZZA,
    72,
    "refrigerated",
    4,
    "cold_preparation",
    "fresh",
    "prepared",
    "PRÉP.",
    "Bac fermé en saladette réfrigérée · PMS interne 72 h.",
  ),
  p(
    "persil-hache",
    "Persil haché",
    PIZZA,
    48,
    "refrigerated",
    4,
    "cold_preparation",
    "fresh",
    "prepared",
    "PRÉP.",
    "Herbes lavées, essorées et protégées · PMS interne 48 h.",
  ),
  p(
    "basilic-prepare",
    "Basilic préparé",
    PIZZA,
    24,
    "refrigerated",
    4,
    "cold_preparation",
    "fresh",
    "prepared",
    "PRÉP.",
    "Herbes lavées, essorées et protégées · PMS interne 24 h.",
  ),
  p(
    "roquette-lavee",
    "Roquette lavée",
    PIZZA,
    24,
    "refrigerated",
    4,
    "cold_preparation",
    "fresh",
    "prepared",
    "PRÉP.",
    "Salade lavée, essorée et protégée · PMS interne 24 h.",
  ),
  p(
    "salade-lavee",
    "Salade lavée / préparée",
    PIZZA,
    24,
    "refrigerated",
    4,
    "cold_preparation",
    "fresh",
    "prepared",
    "PRÉP.",
    "Salade lavée, essorée et protégée · PMS interne 24 h.",
  ),
  p(
    "grenade-grains",
    "Grains de grenade",
    PIZZA,
    72,
    "refrigerated",
    4,
    "cold_preparation",
    "fresh",
    "prepared",
    "PRÉP.",
    "Bac fermé en saladette réfrigérée · PMS interne 72 h.",
  ),
  p(
    "guacamole-maison",
    "Guacamole maison",
    PIZZA,
    24,
    "refrigerated",
    4,
    "cold_preparation",
    "fresh",
    "prepared",
    "PRÉP.",
    "Film au contact · PMS interne 24 h.",
  ),
  p(
    "brochettes-boeuf",
    "Brochettes de dessous de palette de bœuf",
    PIZZA,
    24,
    "refrigerated",
    4,
    "raw_preparation",
    "fresh",
    "prepared",
    "PRÉP.",
    "Préparation de viande crue fraîche · PMS interne 24 h.",
  ),
  p(
    "escalope-veau-fraiche",
    "Escalope de veau panée fraîche",
    PIZZA,
    24,
    "refrigerated",
    4,
    "raw_preparation",
    "fresh",
    "prepared",
    "PRÉP.",
    "Cuire ou congeler le jour de la préparation selon le PMS.",
  ),
  p(
    "gnocchis",
    "Gnocchis frais maison",
    PIZZA,
    48,
    "refrigerated",
    4,
    "cold_preparation",
    "fresh",
    "prepared",
    "PRÉP.",
    "Produit frais protégé · PMS interne 48 h.",
  ),
  p(
    "vinaigrette-maison",
    "Vinaigrette maison",
    PIZZA,
    72,
    "refrigerated",
    4,
    "cold_preparation",
    "fresh",
    "prepared",
    "PRÉP.",
    "Adapter si œuf, produit laitier ou herbes fraîches · PMS interne 72 h.",
  ),
  p(
    "chimichurri-maison",
    "Sauce Chimichurri maison",
    PIZZA,
    48,
    "refrigerated",
    4,
    "cold_preparation",
    "fresh",
    "prepared",
    "PRÉP.",
    "Herbes et ail frais · PMS interne 48 h.",
  ),
  p(
    "huile-citronnee",
    "Huile d’olive citronnée",
    PIZZA,
    72,
    "refrigerated",
    4,
    "cold_preparation",
    "fresh",
    "prepared",
    "PRÉP.",
    "Préparation maison protégée · PMS interne 72 h.",
  ),

  opened("mozzarella", "Mozzarella", 48),
  opened("cheddar", "Cheddar", 48),

  ...[
    ["creme", "Crème"],
    ["mozzarella-bufala", "Mozzarella di bufala"],
    ["fior-latte", "Fior di latte"],
    ["chevre", "Fromage de chèvre"],
    ["roquefort", "Roquefort"],
    ["emmental", "Emmental"],
    ["parmesan", "Parmesan"],
    ["camembert", "Camembert"],
    ["reblochon", "Reblochon"],
    ["jambon-blanc", "Jambon blanc"],
    ["jambon-parme", "Jambon de Parme"],
    ["mortadelle", "Mortadelle"],
    ["charcuterie", "Charcuterie assortie"],
    ["guanciale", "Guanciale"],
    ["lardons", "Lardons"],
    ["chorizo", "Chorizo"],
    ["nduja", "’Nduja"],
    ["saumon-fume", "Saumon fumé"],
    ["pesto", "Pesto"],
    ["tapenade", "Tapenade"],
    ["brandade-morue", "Brandade de morue"],
    ["anchois", "Anchois"],
    ["capres", "Câpres"],
    ["olives", "Olives"],
    ["creme-balsamique", "Crème balsamique"],
    ["creme-truffe", "Crème de truffe"],
    ["sauce-cajun", "Sauce cajun"],
    ["sauce-blanche", "Sauce blanche"],
  ].map(([code, name]) => opened(code, name)),

  p(
    "seiche-decongelee",
    "Seiche décongelée",
    THAWED,
    48,
    "refrigerated",
    2,
    "thawed",
    "supplier_frozen",
    "thawed",
    "DÉC.",
    "Décongélation à 0/+4 °C · PMS interne 48 h · ne pas recongeler en l’état.",
  ),
  p(
    "poulpe-decongele",
    "Poulpe décongelé",
    THAWED,
    48,
    "refrigerated",
    2,
    "thawed",
    "supplier_frozen",
    "thawed",
    "DÉC.",
    "Décongélation à 0/+4 °C · PMS interne 48 h · ne pas recongeler en l’état.",
  ),
  p(
    "viande-macaronade-decongelee",
    "Viande de macaronade décongelée",
    THAWED,
    48,
    "refrigerated",
    4,
    "thawed",
    "supplier_frozen",
    "thawed",
    "DÉC.",
    "Décongélation à 0/+4 °C · PMS interne 48 h · ne pas recongeler en l’état.",
  ),
  p(
    "viande-hachee-decongelee",
    "Viande hachée Hacienda décongelée",
    THAWED,
    24,
    "refrigerated",
    2,
    "thawed",
    "supplier_frozen",
    "thawed",
    "DÉC.",
    "Produit sensible · préférer la cuisson depuis surgelé · PMS interne 24 h.",
  ),
  p(
    "figues-decongelees",
    "Figues décongelées",
    THAWED,
    72,
    "refrigerated",
    4,
    "thawed",
    "supplier_frozen",
    "thawed",
    "DÉC.",
    "Décongélation au froid positif · PMS interne 72 h.",
  ),
  p(
    "kebab-decongele",
    "Viande kebab décongelée",
    THAWED,
    24,
    "refrigerated",
    4,
    "thawed",
    "supplier_frozen",
    "thawed",
    "DÉC.",
    "Suivre en priorité l’étiquette fournisseur · PMS interne prudent 24 h.",
  ),
  p(
    "steak-hache-decongele",
    "Steak haché décongelé",
    THAWED,
    24,
    "refrigerated",
    2,
    "thawed",
    "supplier_frozen",
    "thawed",
    "DÉC.",
    "Produit sensible · préférer la cuisson depuis surgelé · PMS interne 24 h.",
  ),
  p(
    "poulet-pane-decongele",
    "Poulet pané décongelé",
    THAWED,
    24,
    "refrigerated",
    4,
    "thawed",
    "supplier_frozen",
    "thawed",
    "DÉC.",
    "Suivre en priorité l’étiquette fournisseur · PMS interne prudent 24 h.",
  ),

  p(
    "escalope-veau-congelee",
    "Escalope de veau panée congelée maison",
    HOUSE,
    2160,
    "frozen",
    -18,
    "frozen_in_house",
    "fresh",
    "frozen",
    "CONG.",
    "Congeler le jour de la préparation avec un équipement adapté · DDM interne 90 jours.",
  ),
  ...[
    ["frites-surgelees", "Frites surgelées"],
    ["nuggets-surgeles", "Nuggets de poulet surgelés"],
    ["poulet-pane-surgele", "Poulet pané surgelé"],
    ["steak-hache-surgele", "Steak haché surgelé"],
    ["kebab-surgele", "Viande kebab surgelée"],
    ["figues-surgelees", "Figues surgelées"],
    ["seiche-surgelee", "Seiche surgelée"],
    ["poulpe-surgele", "Poulpe surgelé"],
    ["viande-macaronade-surgelee", "Viande de macaronade surgelée"],
    ["viande-hachee-surgelee", "Viande hachée Hacienda surgelée"],
    ["calamars-surgeles", "Calamars pour friture surgelés"],
    ["croquettes-morue-surgelees", "Croquettes de morue surgelées"],
  ].map(([code, name]) => frozenBin(code, name)),

  p(
    "tiramisu-pasteurise",
    "Tiramisu maison · œufs pasteurisés",
    DESSERTS,
    48,
    "refrigerated",
    3,
    "cold_preparation",
    "fresh",
    "prepared",
    "PRÉP.",
    "PMS interne 48 h avec ovoproduits pasteurisés.",
  ),
  p(
    "tiramisu-oeufs",
    "Tiramisu maison · œufs coquille",
    DESSERTS,
    24,
    "refrigerated",
    3,
    "cold_preparation",
    "fresh",
    "prepared",
    "PRÉP.",
    "PMS interne prudent 24 h · maîtrise renforcée des œufs crus.",
  ),
  p(
    "moelleux-chocolat",
    "Moelleux au chocolat maison",
    DESSERTS,
    72,
    "refrigerated",
    3,
    "cooked_cooled",
    "cooked",
    "cooled",
    "REFR.",
    "Refroidissement rapide contrôlé · PMS interne 72 h.",
  ),
  p(
    "chantilly-maison",
    "Crème fouettée / chantilly maison",
    DESSERTS,
    24,
    "refrigerated",
    3,
    "cold_preparation",
    "fresh",
    "prepared",
    "PRÉP.",
    "Préparation laitière protégée · PMS interne 24 h.",
  ),
  p(
    "bananes-coupees",
    "Bananes coupées",
    DESSERTS,
    4,
    "refrigerated",
    4,
    "cold_preparation",
    "fresh",
    "prepared",
    "PRÉP.",
    "Préparer au plus près du service · PMS interne 4 h.",
  ),
];

export const PRESET_CATEGORIES = [
  COOKED,
  PIZZA,
  OPENED,
  THAWED,
  HOUSE,
  FROZEN,
  DESSERTS,
];
export const PROCESS_LABELS: Record<ProcessType, string> = {
  cold_preparation: "Mise en place froide",
  raw_preparation: "Préparation crue",
  cooked_cooled: "Cuisson + refroidissement",
  opened: "Ouverture / découpe / transvasement",
  thawed: "Décongélation",
  frozen_in_house: "Congélation maison",
  supplier_frozen: "Surgelé fournisseur transvasé",
};
export const SOURCE_STATE_LABELS: Record<SourceState, string> = {
  fresh: "Frais",
  supplier_frozen: "Surgelé fournisseur",
  opened: "Ouvert / découpé / transvasé",
  cooked: "Cuit",
};

export const CUSTOM_PREPARATION_CODE = "__custom__";
export const CUSTOM_PREPARATION_CATEGORY = "Préparations personnalisées";

const CUSTOM_PROCESS_DEFAULTS: Record<
  ProcessType,
  Pick<
    PreparationPreset,
    | "storageMode"
    | "storageTemperature"
    | "sourceState"
    | "dateBasis"
    | "startLabel"
    | "rule"
    | "supplierExpiry"
  >
> = {
  cold_preparation: {
    storageMode: "refrigerated",
    storageTemperature: 3,
    sourceState: "fresh",
    dateBasis: "prepared",
    startLabel: "PRÉP.",
    rule:
      "Préparation personnalisée réfrigérée · durée interne à confirmer selon le produit et le PMS.",
    supplierExpiry: false,
  },
  raw_preparation: {
    storageMode: "refrigerated",
    storageTemperature: 3,
    sourceState: "fresh",
    dateBasis: "prepared",
    startLabel: "PRÉP.",
    rule:
      "Préparation crue personnalisée · durée interne à confirmer selon le produit et le PMS.",
    supplierExpiry: false,
  },
  cooked_cooled: {
    storageMode: "refrigerated",
    storageTemperature: 3,
    sourceState: "cooked",
    dateBasis: "cooled",
    startLabel: "REFR.",
    rule:
      "Cuisson et refroidissement contrôlés · durée interne à confirmer selon le produit et le PMS.",
    supplierExpiry: false,
  },
  opened: {
    storageMode: "refrigerated",
    storageTemperature: 4,
    sourceState: "opened",
    dateBasis: "opened",
    startLabel: "OUV.",
    rule:
      "Après ouverture, découpe ou transvasement : respecter en priorité les instructions du fabricant.",
    supplierExpiry: false,
  },
  thawed: {
    storageMode: "refrigerated",
    storageTemperature: 3,
    sourceState: "supplier_frozen",
    dateBasis: "thawed",
    startLabel: "DÉC.",
    rule:
      "Décongélation contrôlée au froid positif · ne pas recongeler le produit en l’état.",
    supplierExpiry: false,
  },
  frozen_in_house: {
    storageMode: "frozen",
    storageTemperature: -18,
    sourceState: "fresh",
    dateBasis: "frozen",
    startLabel: "CONG.",
    rule:
      "Congélation maison tracée le jour de la préparation · limite interne à confirmer dans le PMS.",
    supplierExpiry: false,
  },
  supplier_frozen: {
    storageMode: "frozen",
    storageTemperature: -18,
    sourceState: "supplier_frozen",
    dateBasis: "opened",
    startLabel: "TRANS.",
    rule:
      "Produit surgelé fournisseur transvasé : recopier le lot et la DDM d’origine.",
    supplierExpiry: true,
  },
};

export function customPreparationCode(name: string, processType: ProcessType) {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42);
  return `libre-${slug || "preparation"}-${processType.replaceAll("_", "-")}`;
}

export function customPreparationPreset(input: {
  code?: string;
  name: string;
  category?: string;
  durationHours?: number;
  processType: ProcessType;
  storageTemperature?: number;
}): PreparationPreset {
  const defaults = CUSTOM_PROCESS_DEFAULTS[input.processType],
    name = input.name.trim() || "Nouvelle préparation",
    code =
      input.code && input.code !== CUSTOM_PREPARATION_CODE
        ? input.code
        : customPreparationCode(name, input.processType);
  return {
    code,
    name,
    category: input.category?.trim() || CUSTOM_PREPARATION_CATEGORY,
    durationHours:
      Number.isInteger(input.durationHours) && Number(input.durationHours) > 0
        ? Number(input.durationHours)
        : 48,
    storageMode: defaults.storageMode,
    storageTemperature:
      typeof input.storageTemperature === "number" &&
      Number.isFinite(input.storageTemperature)
        ? input.storageTemperature
        : defaults.storageTemperature,
    processType: input.processType,
    sourceState: defaults.sourceState,
    dateBasis: defaults.dateBasis,
    startLabel: defaults.startLabel,
    rule: defaults.rule,
    supplierExpiry: defaults.supplierExpiry,
  };
}

export type PreparationLabel = {
  id: string;
  productCode: string;
  productName: string;
  category: string;
  processType: ProcessType;
  sourceState: SourceState;
  storageMode: StorageMode;
  storageTemperature: number;
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
  lifecycleStatus:
    | "active"
    | "consumed"
    | "discarded"
    | "transformed_frozen";
  lifecycleUpdatedAt: string | null;
  lifecycleUpdatedByName: string | null;
  revision: number;
  createdAt: string;
  createdByName: string;
  updatedAt: string | null;
  updatedByName: string | null;
};

export const presetFor = (code: string) =>
  PREPARATION_PRESETS.find((item) => item.code === code);
export function presetFromLabel(label: PreparationLabel) {
  return (
    presetFor(label.productCode) ??
    customPreparationPreset({
      code: label.productCode,
      name: label.productName,
      category: label.category,
      durationHours: label.durationHours,
      processType: label.processType,
      storageTemperature: label.storageTemperature,
    })
  );
}
export function isLocalDateTime(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^20\d{2}-(0[1-9]|1[0-2])-([012]\d|3[01])T([01]\d|2[0-3]):[0-5]\d$/.test(
      value,
    )
  )
    return false;
  const [d, t] = value.split("T"),
    [y, m, day] = d.split("-").map(Number),
    [h, min] = t.split(":").map(Number),
    parsed = new Date(Date.UTC(y, m - 1, day, h, min));
  return (
    parsed.getUTCFullYear() === y &&
    parsed.getUTCMonth() === m - 1 &&
    parsed.getUTCDate() === day
  );
}
export const isLocalDate = (value: unknown): value is string =>
  typeof value === "string" &&
  /^20\d{2}-(0[1-9]|1[0-2])-([012]\d|3[01])$/.test(value) &&
  isLocalDateTime(value + "T00:00");
export function addHoursLocal(value: string, hours: number) {
  if (!isLocalDateTime(value)) return "";
  const [d, t] = value.split("T"),
    [y, m, day] = d.split("-").map(Number),
    [h, min] = t.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, day, h + hours, min))
    .toISOString()
    .slice(0, 16);
}
export function minutesBetween(start: string, end: string) {
  if (!isLocalDateTime(start) || !isLocalDateTime(end)) return null;
  const parse = (v: string) => {
    const [d, t] = v.split("T"),
      [y, m, day] = d.split("-").map(Number),
      [h, min] = t.split(":").map(Number);
    return Date.UTC(y, m - 1, day, h, min);
  };
  return Math.round((parse(end) - parse(start)) / 60000);
}
const ns = (v: unknown) =>
    v === null || v === undefined || v === "" ? null : String(v),
  nn = (v: unknown) =>
    v === null || v === undefined || v === "" ? null : Number(v);
export function labelFromRow(r: Record<string, unknown>): PreparationLabel {
  const preset = presetFor(String(r.product_code)),
    processType = String(
      r.process_type ?? preset?.processType ?? "cold_preparation",
    ) as ProcessType,
    opened = processType === "opened" || processType === "supplier_frozen",
    cooked = processType === "cooked_cooled",
    thawed = processType === "thawed",
    frozen = processType === "frozen_in_house",
    storedCoolingMethod = String(r.cooling_method ?? "");
  return {
    id: String(r.id),
    productCode: String(r.product_code),
    productName: String(r.product_name),
    category: String(r.category ?? preset?.category ?? COOKED),
    processType,
    sourceState: String(
      r.source_state ?? preset?.sourceState ?? "fresh",
    ) as SourceState,
    storageMode: r.storage_mode as StorageMode,
    storageTemperature: Number(r.storage_temperature),
    durationHours: Number(r.duration_hours),
    preparedAt: String(r.prepared_at),
    frozenAt: frozen ? ns(r.frozen_at) : null,
    expiresAt: String(r.expires_at),
    operatorInitials: String(r.operator_initials),
    lotCode: String(r.lot_code ?? ""),
    quantity: String(r.quantity ?? ""),
    packaging: String(r.packaging ?? ""),
    note: String(r.note ?? ""),
    supplierName: String(r.supplier_name ?? ""),
    supplierLot: String(r.supplier_lot ?? ""),
    supplierDeadline: ns(r.supplier_deadline),
    receivedAt: ns(r.received_at),
    openedAt: opened ? ns(r.opened_at) : null,
    sourceLabelId: ns(r.source_label_id),
    sourceLotIds: String(r.source_lot_ids ?? "")
      .split(",")
      .filter(Boolean),
    cookingEndedAt: cooked ? ns(r.cooking_ended_at) : null,
    cookingTemperature: cooked ? nn(r.cooking_temperature) : null,
    coolingStartedAt: cooked ? ns(r.cooling_started_at) : null,
    coolingStartTemperature: cooked ? nn(r.cooling_start_temperature) : null,
    coolingEndedAt: cooked ? ns(r.cooling_ended_at) : null,
    coolingEndTemperature: cooked ? nn(r.cooling_end_temperature) : null,
    coolingMethod:
      cooked && storedCoolingMethod !== "cellule" ? storedCoolingMethod : "",
    coolingDurationMinutes: cooked ? nn(r.cooling_duration_minutes) : null,
    coolingCompliant: cooked
      ? r.cooling_compliant === null || r.cooling_compliant === undefined
        ? null
        : Boolean(r.cooling_compliant)
      : null,
    thawingStartedAt: thawed ? ns(r.thawing_started_at) : null,
    thawingMethod: thawed ? String(r.thawing_method ?? "") : "",
    freezeMethod: frozen ? String(r.freeze_method ?? "") : "",
    freezerTemperature: frozen ? nn(r.freezer_temperature) : null,
    correctiveAction: String(r.corrective_action ?? ""),
    controlStatus: String(
      r.control_status ?? "not_applicable",
    ) as PreparationLabel["controlStatus"],
    lifecycleStatus: String(
      r.lifecycle_status ?? "active",
    ) as PreparationLabel["lifecycleStatus"],
    lifecycleUpdatedAt: ns(r.lifecycle_updated_at),
    lifecycleUpdatedByName: ns(r.lifecycle_updated_by_name),
    revision: Number(r.revision ?? 1),
    createdAt: String(r.created_at),
    createdByName: String(r.created_by_name),
    updatedAt: ns(r.updated_at),
    updatedByName: ns(r.updated_by_name),
  };
}
export function labelStartAt(
  label: PreparationLabel,
  preset = presetFromLabel(label),
) {
  if (preset?.dateBasis === "opened") return label.openedAt ?? label.preparedAt;
  if (preset?.dateBasis === "thawed")
    return label.thawingStartedAt ?? label.preparedAt;
  if (preset?.dateBasis === "frozen") return label.frozenAt ?? label.preparedAt;
  if (preset?.dateBasis === "cooled")
    return label.coolingEndedAt ?? label.preparedAt;
  return label.preparedAt;
}
export function shortDateTime(v: string | null) {
  if (!v || !isLocalDateTime(v)) return "—";
  const [d, t] = v.split("T");
  return d.slice(8, 10) + "/" + d.slice(5, 7) + " " + t;
}
export function longDateTime(v: string | null) {
  if (!v || !isLocalDateTime(v)) return "—";
  const [d, t] = v.split("T");
  return d.slice(8, 10) + "/" + d.slice(5, 7) + "/" + d.slice(0, 4) + " à " + t;
}
export function durationText(h: number) {
  if (h % 24 === 0) return h / 24 + " jour" + (h === 24 ? "" : "s");
  return h + " heures";
}
export const temperatureText = (v: number | null) =>
  v === null ? "—" : (v > 0 ? "+" : "") + String(v).replace(".", ",") + " °C";

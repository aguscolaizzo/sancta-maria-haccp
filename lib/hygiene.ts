export type HygieneRecordType = "cleaning" | "fryer";
export type HygieneRecordStatus = "draft" | "validated";
export type HygieneCheckState =
  | "pending"
  | "done"
  | "not_applicable"
  | "issue";

export type HygieneTask = {
  code: string;
  label: string;
  frequency: string;
  protocol: string;
  optional?: boolean;
};

export type HygieneCheck = HygieneTask & {
  state: HygieneCheckState;
  observation: string;
};

export type HygieneRecord = {
  id: string;
  recordType: HygieneRecordType;
  date: string;
  time: string;
  operatorInitials: string;
  generalNotes: string;
  status: HygieneRecordStatus;
  signature: string | null;
  validatedAt: string | null;
  validatedByName: string | null;
  revision: number;
  createdAt: string;
  createdByName: string;
  updatedAt: string | null;
  updatedByName: string | null;
};

export type HygieneHistoryItem = Pick<
  HygieneRecord,
  | "id"
  | "recordType"
  | "date"
  | "time"
  | "operatorInitials"
  | "status"
  | "validatedAt"
  | "validatedByName"
  | "revision"
> & {
  doneCount: number;
  issueCount: number;
  totalCount: number;
};

export const HYGIENE_TASKS: Record<HygieneRecordType, HygieneTask[]> = {
  cleaning: [
    {
      code: "hotte",
      label: "Hotte aspirante et filtres",
      frequency: "1 fois par semaine",
      protocol:
        "Protéger les aliments, démonter les grilles, pulvériser ou laisser tremper 15 min, brosser, rincer, sécher puis remonter.",
      optional: true,
    },
    {
      code: "four",
      label: "Four / piano",
      frequency: "Après le service",
      protocol:
        "Protéger les aliments, retirer les déchets, laver, laisser agir 15 min, frotter, rincer puis sécher.",
    },
    {
      code: "etageres",
      label: "Étagères",
      frequency: "Après le service",
      protocol:
        "Débarrasser, retirer les déchets, laver, laisser agir 5 min, rincer, essuyer puis sécher.",
    },
    {
      code: "plans_travail",
      label: "Plans de travail",
      frequency: "Après le service et entre deux activités",
      protocol:
        "Débarrasser et protéger les aliments, retirer les déchets, laver, laisser agir 5 min, rincer, essuyer puis sécher.",
    },
    {
      code: "plonge",
      label: "Plonge / bac plonge",
      frequency: "Après le service",
      protocol:
        "Retirer les déchets, laver, laisser agir 5 min puis rincer. Nettoyer également les abords et la robinetterie.",
    },
    {
      code: "lave_vaisselle",
      label: "Lave-vaisselle",
      frequency: "Après le service · détartrage hebdomadaire",
      protocol:
        "Démonter les pièces amovibles, retirer les déchets, laver ou laisser tremper 5 min, brosser, rincer, sécher puis remonter.",
    },
    {
      code: "micro_ondes",
      label: "Micro-ondes",
      frequency: "Après le service",
      protocol:
        "Débrancher si nécessaire, retirer les déchets, laver, laisser agir 5 min, brosser, rincer avec une lavette puis sécher.",
    },
    {
      code: "sol",
      label: "Sol",
      frequency: "Après le service",
      protocol:
        "Retirer les déchets, laver, laisser agir 5 min, brosser, rincer, racler puis laisser sécher. Nettoyer le siphon.",
    },
  ],
  fryer: [
    {
      code: "filtration_huile",
      label: "Filtration de l’huile effectuée",
      frequency: "Chaque jour d’utilisation",
      protocol:
        "Filtrer l’huile selon la procédure et les consignes du fabricant de la friteuse, lorsque la température permet une manipulation sûre.",
    },
    {
      code: "residus_retires",
      label: "Résidus et miettes retirés",
      frequency: "À chaque filtration",
      protocol:
        "Éliminer les résidus présents dans l’huile, au fond de la cuve et dans les zones accessibles.",
    },
    {
      code: "filtre_propre",
      label: "Filtre et bac de récupération propres",
      frequency: "À chaque filtration",
      protocol:
        "Contrôler l’état du filtre et du bac de récupération, puis nettoyer les éléments conformément aux consignes du fabricant.",
    },
    {
      code: "huile_conforme",
      label: "Aspect et odeur de l’huile conformes",
      frequency: "Contrôle quotidien",
      protocol:
        "Vérifier l’absence d’odeur anormale, de mousse persistante, de fumée inhabituelle ou d’aspect fortement dégradé.",
    },
    {
      code: "cuve_panier_propres",
      label: "Cuve, panier et abords propres",
      frequency: "Après le service",
      protocol:
        "Nettoyer les surfaces accessibles, le panier et les abords sans contaminer l’huile ni les aliments.",
    },
    {
      code: "changement_huile",
      label: "Changement complet de l’huile",
      frequency: "Selon l’état de l’huile",
      protocol:
        "Cette ligne ne remplace pas le filtrage. Marquer « Fait » uniquement si l’huile a réellement été remplacée ; sinon choisir « Non applicable ».",
      optional: true,
    },
  ],
};

export const HYGIENE_TYPE_LABELS: Record<HygieneRecordType, string> = {
  cleaning: "Nettoyage cuisine",
  fryer: "Filtrage friteuse",
};

export const HYGIENE_STATE_LABELS: Record<HygieneCheckState, string> = {
  pending: "À faire",
  done: "Fait",
  not_applicable: "Non applicable",
  issue: "Anomalie",
};

export function hygieneRecordFromRow(
  row: Record<string, unknown>,
): HygieneRecord {
  return {
    id: String(row.id),
    recordType: row.record_type as HygieneRecordType,
    date: String(row.date),
    time: String(row.time),
    operatorInitials: String(row.operator_initials),
    generalNotes: String(row.general_notes ?? ""),
    status: row.status as HygieneRecordStatus,
    signature: row.signature ? String(row.signature) : null,
    validatedAt: row.validated_at ? String(row.validated_at) : null,
    validatedByName: row.validated_by_name
      ? String(row.validated_by_name)
      : null,
    revision: Number(row.revision),
    createdAt: String(row.created_at),
    createdByName: String(row.created_by_name),
    updatedAt: row.updated_at ? String(row.updated_at) : null,
    updatedByName: row.updated_by_name ? String(row.updated_by_name) : null,
  };
}

export function hygieneCheckFromRow(
  row: Record<string, unknown>,
): HygieneCheck {
  return {
    code: String(row.check_code),
    label: String(row.label),
    frequency: String(row.frequency),
    protocol: String(row.protocol),
    optional: Boolean(row.optional),
    state: row.state as HygieneCheckState,
    observation: String(row.observation ?? ""),
  };
}

export function blankHygieneChecks(type: HygieneRecordType): HygieneCheck[] {
  return HYGIENE_TASKS[type].map((task) => ({
    ...task,
    state: task.optional ? "not_applicable" : "pending",
    observation: "",
  }));
}

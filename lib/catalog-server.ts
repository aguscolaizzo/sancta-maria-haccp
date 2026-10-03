import {
  customPreparationPreset,
  PREPARATION_PRESETS,
  type PreparationPreset,
  type ProcessType,
} from "./labels";
import type { OperationType } from "./quick-labels";
import { db } from "./server";

const QUICK_DEFAULTS: Record<
  string,
  Partial<{
    operation: OperationType;
    shortName: string;
    bacs: number;
    order: number;
    allergens: string;
  }>
> = {
  "tomates-coupees": {
    operation: "cut",
    shortName: "TOMATES",
    bacs: 2,
    order: 10,
  },
  "jambon-blanc": {
    operation: "sliced",
    shortName: "JAMBON BLANC",
    order: 20,
    allergens: "À confirmer sur l’étiquette fournisseur",
  },
  mozzarella: {
    operation: "portioned",
    shortName: "MOZZARELLA",
    bacs: 3,
    order: 30,
    allergens: "Lait",
  },
  cheddar: {
    operation: "sliced",
    shortName: "CHEDDAR",
    order: 35,
    allergens: "Lait",
  },
  "oignons-eminces": {
    operation: "cut",
    shortName: "OIGNONS",
    bacs: 2,
    order: 40,
  },
  "champignons-eminces": {
    operation: "cut",
    shortName: "CHAMPIGNONS",
    order: 50,
  },
  "salade-lavee": {
    operation: "internal_preparation",
    shortName: "SALADE",
    order: 60,
  },
  "jambon-parme": {
    operation: "sliced",
    shortName: "JAMBON PARME",
    order: 70,
  },
  charcuterie: {
    operation: "portioned",
    shortName: "CHARCUTERIE",
    order: 80,
    allergens: "À confirmer sur les étiquettes fournisseurs",
  },
  "poivrons-decoupes": {
    operation: "cut",
    shortName: "POIVRONS",
    order: 90,
  },
  "tomates-cerises": {
    operation: "cut",
    shortName: "TOMATES CERISES",
    order: 100,
  },
  "mozzarella-bufala": {
    operation: "portioned",
    shortName: "MOZZA BUFALA",
    order: 110,
    allergens: "Lait",
  },
  "seiche-decongelee": {
    operation: "thawed",
    shortName: "SEICHE",
    order: 120,
    allergens: "Mollusques",
  },
  "poulpe-decongele": {
    operation: "thawed",
    shortName: "POULPE",
    order: 130,
    allergens: "Mollusques",
  },
};

const MANAGED_POLICY_UPDATES = [
  {
    code: "tomates-coupees",
    operation: "cut",
    previousHours: 72,
    durationHours: 48,
    previousRule:
      "Saladette réfrigérée ≤ +4 °C · PMS interne 72 h.",
  },
  {
    code: "mozzarella",
    operation: "portioned",
    previousHours: 24,
    durationHours: 48,
    previousRule:
      "Après ouverture ou transvasement : appliquer le délai et la température indiqués par le fabricant.",
  },
  {
    code: "cheddar",
    operation: "sliced",
    previousHours: 24,
    durationHours: 48,
    previousRule:
      "Après ouverture ou transvasement : appliquer le délai et la température indiqués par le fabricant.",
  },
] as const;

export function operationForPreparation(
  preset: PreparationPreset,
): OperationType {
  const configured = QUICK_DEFAULTS[preset.code]?.operation;
  if (configured) return configured;
  if (preset.processType === "opened") return "opened";
  if (preset.processType === "thawed") return "thawed";
  if (preset.processType === "supplier_frozen") return "transferred";
  return "internal_preparation";
}

function productTypeFor(preset: PreparationPreset) {
  if (preset.processType === "thawed") return "décongelé";
  if (preset.storageMode === "frozen") return "surgelé";
  if (preset.sourceState === "opened") return "ouvert";
  return "frais";
}

type CatalogSyncActor = {
  ownerId: string;
  userId: string;
  displayName: string;
};

function newCatalogStatements(
  actor: CatalogSyncActor,
  preset: PreparationPreset,
  reason: string,
) {
  const database = db(),
    now = new Date().toISOString(),
    ingredientId = crypto.randomUUID(),
    operation = operationForPreparation(preset),
    shortName = preset.name.slice(0, 32).toUpperCase();
  return [
    database
      .prepare(
        `INSERT INTO ingredient_catalog(id,owner_id,legacy_code,display_name,short_name,category,product_type,active,quick_enabled,favorite,display_order,preparation_days,default_operation,storage_mode,storage_temperature,default_bacs,default_labels,label_format,technical_description,allergens,preparation_procedure,handling_rules,usage_count,revision,created_at,updated_at,updated_by_id,updated_by_name)
         VALUES(?,?,?,?,?,?,?,1,1,0,900,'[0,1,2,3,4,5,6]',?,?,?,?,?,'50x30',?,?,?,?,1,1,?,?,?,?)`,
      )
      .bind(
        ingredientId,
        actor.ownerId,
        preset.code,
        preset.name,
        shortName,
        preset.category,
        productTypeFor(preset),
        operation,
        preset.storageMode,
        preset.storageTemperature,
        1,
        1,
        preset.rule,
        "À confirmer sur l’étiquette fournisseur",
        preset.rule,
        preset.rule,
        now,
        now,
        actor.userId,
        actor.displayName,
      ),
    database
      .prepare(
        `INSERT INTO ingredient_operation_rules(id,owner_id,ingredient_id,operation_type,duration_hours,storage_mode,storage_temperature,requires_source_lot,active,revision,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?,?,1,1,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        actor.ownerId,
        ingredientId,
        operation,
        preset.durationHours,
        preset.storageMode,
        preset.storageTemperature,
        1,
        now,
        now,
      ),
    database
      .prepare(
        `INSERT INTO traceability_audit_events(id,owner_id,entity_type,entity_id,action,field_name,old_value,new_value,reason,changed_at,changed_by_id,changed_by_name)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        actor.ownerId,
        "ingredient",
        ingredientId,
        "created",
        "quick_enabled",
        null,
        "1",
        reason,
        now,
        actor.userId,
        actor.displayName,
      ),
  ];
}

/**
 * Links a free preparation to the shared ingredient catalog. The returned
 * statements can be included in the same D1 batch as the preparation itself,
 * so the traceability record and its quick-print definition stay atomic.
 */
export async function quickCatalogSyncStatements(
  actor: CatalogSyncActor,
  preset: PreparationPreset,
) {
  const current = await db()
    .prepare(
      "SELECT id,quick_enabled,active,deleted_at FROM ingredient_catalog WHERE owner_id=? AND legacy_code=?",
    )
    .bind(actor.ownerId, preset.code)
    .first<Record<string, unknown>>();
  if (!current)
    return newCatalogStatements(
      actor,
      preset,
      "Synchronisation depuis Préparations & étiquettes",
    );

  const database = db(),
    now = new Date().toISOString(),
    operation = operationForPreparation(preset),
    statements: D1PreparedStatement[] = [];
  if (!Boolean(current.quick_enabled) || !Boolean(current.active) || current.deleted_at) {
    statements.push(
      database
        .prepare(
          `UPDATE ingredient_catalog SET quick_enabled=1,active=1,deleted_at=NULL,revision=revision+1,updated_at=?,updated_by_id=?,updated_by_name=?
           WHERE owner_id=? AND id=?`,
        )
        .bind(
          now,
          actor.userId,
          actor.displayName,
          actor.ownerId,
          current.id,
        ),
      database
        .prepare(
          `INSERT INTO traceability_audit_events(id,owner_id,entity_type,entity_id,action,field_name,old_value,new_value,reason,changed_at,changed_by_id,changed_by_name)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          actor.ownerId,
          "ingredient",
          current.id,
          "updated",
          "quick_enabled",
          String(Number(Boolean(current.quick_enabled))),
          "1",
          "Réactivation depuis Préparations & étiquettes",
          now,
          actor.userId,
          actor.displayName,
        ),
    );
  }
  statements.push(
    database
      .prepare(
        `INSERT OR IGNORE INTO ingredient_operation_rules(id,owner_id,ingredient_id,operation_type,duration_hours,storage_mode,storage_temperature,requires_source_lot,active,revision,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?,?,1,1,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        actor.ownerId,
        current.id,
        operation,
        preset.durationHours,
        preset.storageMode,
        preset.storageTemperature,
        1,
        now,
        now,
      ),
  );
  return statements;
}

export async function ensureIngredientCatalog(ownerId: string) {
  const existing = await db()
    .prepare("SELECT legacy_code FROM ingredient_catalog WHERE owner_id=?")
    .bind(ownerId)
    .all<{ legacy_code: string }>();
  const existingCodes = new Set(
    existing.results.map((row) => String(row.legacy_code)),
  );
  const now = new Date().toISOString();
  const statements = PREPARATION_PRESETS.filter(
    (preset) => !existingCodes.has(preset.code),
  ).map((preset, index) => {
    const quick = QUICK_DEFAULTS[preset.code],
      ingredientId = crypto.randomUUID(),
      operation = operationForPreparation(preset),
      shortName = (quick?.shortName ?? preset.name).slice(0, 32).toUpperCase(),
      bacs = quick?.bacs ?? 1,
      order = quick?.order ?? 1000 + index,
      quickEnabled = Boolean(quick),
      allergens = quick?.allergens ?? "À confirmer sur l’étiquette fournisseur";
    return db()
      .prepare(
          `INSERT OR IGNORE INTO ingredient_catalog(id,owner_id,legacy_code,display_name,short_name,category,product_type,active,quick_enabled,favorite,display_order,preparation_days,default_operation,storage_mode,storage_temperature,default_bacs,default_labels,label_format,technical_description,allergens,preparation_procedure,handling_rules,usage_count,revision,created_at)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          ingredientId,
          ownerId,
          preset.code,
          preset.name,
          shortName,
          preset.category,
          productTypeFor(preset),
          1,
          Number(quickEnabled),
          Number(quickEnabled),
          order,
          quickEnabled ? "[1,2,3,4,5,6]" : "[]",
          operation,
          preset.storageMode,
          preset.storageTemperature,
          bacs,
          bacs,
          "50x30",
          preset.rule,
          allergens,
          preset.rule,
          preset.rule,
          0,
          1,
          now,
        );
  });
  for (let start = 0; start < statements.length; start += 40)
    await db().batch(statements.slice(start, start + 40));
  // If the catalog row already existed but its initial operation rule did not,
  // create that rule using the real persisted ingredient id.
  const missing = await db()
    .prepare(
      `SELECT i.id,i.legacy_code,i.default_operation,i.storage_mode,i.storage_temperature
       FROM ingredient_catalog i LEFT JOIN ingredient_operation_rules r
       ON r.owner_id=i.owner_id AND r.ingredient_id=i.id AND r.operation_type=i.default_operation
       WHERE i.owner_id=? AND r.id IS NULL`,
    )
    .bind(ownerId)
    .all<Record<string, unknown>>();
  const missingStatements = missing.results.map((row) => {
    const preset = PREPARATION_PRESETS.find(
      (item) => item.code === String(row.legacy_code),
    );
    return db()
      .prepare(
        `INSERT OR IGNORE INTO ingredient_operation_rules(id,owner_id,ingredient_id,operation_type,duration_hours,storage_mode,storage_temperature,requires_source_lot,active,revision,created_at)
         VALUES(?,?,?,?,?,?,?,?,1,1,?)`,
      )
      .bind(
        crypto.randomUUID(),
        ownerId,
        row.id,
        row.default_operation,
        preset?.durationHours ?? 48,
        row.storage_mode,
        row.storage_temperature,
        1,
        now,
      );
  });
  if (missingStatements.length) await db().batch(missingStatements);

  // Apply only managed defaults that still have their original revision and
  // value. Any duration already edited by the restaurant is left untouched.
  const managedRows = await db()
    .prepare(
      `SELECT i.id AS ingredient_id,i.legacy_code,r.id AS rule_id,r.operation_type,r.duration_hours,r.revision AS rule_revision
       FROM ingredient_catalog i JOIN ingredient_operation_rules r
       ON r.owner_id=i.owner_id AND r.ingredient_id=i.id
       WHERE i.owner_id=? AND i.legacy_code IN ('tomates-coupees','mozzarella','cheddar')`,
    )
    .bind(ownerId)
    .all<Record<string, unknown>>();
  const managedStatements: D1PreparedStatement[] = [];
  for (const row of managedRows.results) {
    const policy = MANAGED_POLICY_UPDATES.find(
      (entry) =>
        entry.code === String(row.legacy_code) &&
        entry.operation === String(row.operation_type),
    );
    if (
      !policy ||
      Number(row.duration_hours) !== policy.previousHours ||
      Number(row.rule_revision) !== 1
    )
      continue;
    const preset = PREPARATION_PRESETS.find(
      (entry) => entry.code === policy.code,
    );
    managedStatements.push(
      db()
        .prepare(
          "UPDATE ingredient_operation_rules SET duration_hours=?,revision=revision+1,updated_at=? WHERE owner_id=? AND id=? AND revision=1 AND duration_hours=?",
        )
        .bind(
          policy.durationHours,
          now,
          ownerId,
          row.rule_id,
          policy.previousHours,
        ),
      db()
        .prepare(
          `UPDATE ingredient_catalog SET
             technical_description=CASE WHEN technical_description=? THEN ? ELSE technical_description END,
             preparation_procedure=CASE WHEN preparation_procedure=? THEN ? ELSE preparation_procedure END,
             handling_rules=CASE WHEN handling_rules=? THEN ? ELSE handling_rules END,
             revision=revision+1,updated_at=?,updated_by_id='system-policy',updated_by_name='Mise à jour PMS'
           WHERE owner_id=? AND id=? AND (technical_description=? OR preparation_procedure=? OR handling_rules=?)`,
        )
        .bind(
          policy.previousRule,
          preset?.rule ?? policy.previousRule,
          policy.previousRule,
          preset?.rule ?? policy.previousRule,
          policy.previousRule,
          preset?.rule ?? policy.previousRule,
          now,
          ownerId,
          row.ingredient_id,
          policy.previousRule,
          policy.previousRule,
          policy.previousRule,
        ),
      db()
        .prepare(
          `INSERT INTO traceability_audit_events(id,owner_id,entity_type,entity_id,action,field_name,old_value,new_value,reason,changed_at,changed_by_id,changed_by_name)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          ownerId,
          "ingredient",
          row.ingredient_id,
          "policy_update",
          "duration_hours",
          String(policy.previousHours),
          String(policy.durationHours),
          "Règle PMS proposée pour la mise en place rapide ; la limite fournisseur reste prioritaire.",
          now,
          "system-policy",
          "Mise à jour PMS",
        ),
    );
  }
  if (managedStatements.length) await db().batch(managedStatements);

  // Preparations freely entered in the classic form use a stable `libre-*`
  // code. Import any historical definition that predates catalog syncing so
  // it becomes immediately available in Impression rapide as well.
  const historical = await db()
    .prepare(
      `SELECT p.product_code,p.product_name,p.category,p.process_type,p.storage_temperature,p.duration_hours
       FROM preparation_labels p LEFT JOIN ingredient_catalog i
       ON i.owner_id=p.owner_id AND i.legacy_code=p.product_code
       WHERE p.owner_id=? AND p.deleted_at IS NULL AND p.product_code LIKE 'libre-%' AND i.id IS NULL
       ORDER BY p.created_at DESC LIMIT 500`,
    )
    .bind(ownerId)
    .all<Record<string, unknown>>();
  const seen = new Set<string>(),
    historicalStatements: D1PreparedStatement[] = [];
  for (const row of historical.results) {
    const code = String(row.product_code);
    if (seen.has(code)) continue;
    seen.add(code);
    const preset = customPreparationPreset({
      code,
      name: String(row.product_name),
      category: String(row.category),
      durationHours: Number(row.duration_hours),
      processType: String(row.process_type) as ProcessType,
      storageTemperature: Number(row.storage_temperature),
    });
    historicalStatements.push(
      ...newCatalogStatements(
        {
          ownerId,
          userId: "system-catalog-sync",
          displayName: "Synchronisation du catalogue",
        },
        preset,
        "Récupération d’une préparation libre existante",
      ),
    );
  }
  for (let start = 0; start < historicalStatements.length; start += 30)
    await db().batch(historicalStatements.slice(start, start + 30));
}

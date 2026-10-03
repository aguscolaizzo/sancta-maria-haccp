import { authorize } from "@/lib/access";
import { ensureIngredientCatalog } from "@/lib/catalog-server";
import {
  ingredientFromRow,
  OPERATION_LABELS,
  type LabelFormat,
  type OperationType,
} from "@/lib/quick-labels";
import { db, json, sameOrigin } from "@/lib/server";

export const dynamic = "force-dynamic";

const selectCatalog = `SELECT i.*,r.duration_hours,r.requires_source_lot
  FROM ingredient_catalog i JOIN ingredient_operation_rules r
  ON r.owner_id=i.owner_id AND r.ingredient_id=i.id AND r.operation_type=i.default_operation AND r.active=1`;

export async function GET() {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  try {
    await ensureIngredientCatalog(auth.access.ownerId);
    const rows = await db()
      .prepare(
        `${selectCatalog} WHERE i.owner_id=? AND i.deleted_at IS NULL AND i.active=1
         ORDER BY i.favorite DESC,i.usage_count DESC,i.display_order,i.display_name`,
      )
      .bind(auth.access.ownerId)
      .all<Record<string, unknown>>();
    return json({
      ingredients: rows.results.map(ingredientFromRow),
      operations: OPERATION_LABELS,
    });
  } catch (error) {
    console.error("catalog load failed", error);
    return json({ error: "Le catalogue d’ingrédients ne peut pas être chargé." }, 503);
  }
}

const clean = (value: unknown, max: number) =>
  String(value ?? "")
    .trim()
    .slice(0, max + 1);
const normalizedName = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");

export async function POST(request: Request) {
  const auth = await authorize("admin");
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request)) return json({ error: "Origine invalide." }, 403);
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Données invalides." }, 400);
  }
  const operation = String(payload.defaultOperation ?? "") as OperationType,
    durationHours = Number(payload.durationHours),
    labelFormat = String(payload.labelFormat ?? "50x30") as LabelFormat,
    preparationDays = Array.isArray(payload.preparationDays)
      ? [...new Set(payload.preparationDays.map(Number))].filter(
          (day) => Number.isInteger(day) && day >= 0 && day <= 6,
        )
      : [],
    defaultBacs = Number(payload.defaultBacs),
    defaultLabels = Number(payload.defaultLabels),
    storageTemperature =
      payload.storageTemperature === null || payload.storageTemperature === ""
        ? null
        : Number(payload.storageTemperature),
    storageMode = String(payload.storageMode ?? "refrigerated"),
    displayName = clean(payload.displayName, 120),
    shortName = clean(payload.shortName, 32).toUpperCase(),
    category = clean(payload.category, 80),
    productType = clean(payload.productType, 40),
    technicalDescription = clean(payload.technicalDescription, 2000),
    allergens = clean(payload.allergens, 1000),
    preparationProcedure = clean(payload.preparationProcedure, 2000),
    handlingRules = clean(payload.handlingRules, 2000);
  if (!displayName || !shortName || !category || !productType)
    return json({ error: "Complétez le nom, le nom court, la famille et le type." }, 400);
  if (!(operation in OPERATION_LABELS))
    return json({ error: "Opération invalide." }, 400);
  if (!Number.isInteger(durationHours) || durationHours < 1 || durationHours > 8760)
    return json({ error: "La DLC interne doit être comprise entre 1 heure et 365 jours." }, 400);
  if (!Number.isInteger(defaultBacs) || defaultBacs < 1 || defaultBacs > 50)
    return json({ error: "Nombre de bacs invalide." }, 400);
  if (!Number.isInteger(defaultLabels) || defaultLabels < defaultBacs || defaultLabels > 50)
    return json({ error: "Prévoyez au moins une étiquette par bac." }, 400);
  if (!["50x30", "30x20", "50x80"].includes(labelFormat))
    return json({ error: "Format d’étiquette invalide." }, 400);
  if (!["refrigerated", "frozen", "ambient"].includes(storageMode))
    return json({ error: "Mode de conservation invalide." }, 400);
  if (
    storageTemperature !== null &&
    (!Number.isFinite(storageTemperature) || storageTemperature < -50 || storageTemperature > 40)
  )
    return json({ error: "Température de conservation invalide." }, 400);
  try {
    await ensureIngredientCatalog(auth.access.ownerId);
    const existing = await db()
      .prepare("SELECT display_name FROM ingredient_catalog WHERE owner_id=? AND deleted_at IS NULL AND active=1")
      .bind(auth.access.ownerId)
      .all<{ display_name: string }>();
    if (existing.results.some((item) => normalizedName(item.display_name) === normalizedName(displayName)))
      return json({ error: "Ce produit existe déjà dans le catalogue. Recherchez-le et sélectionnez-le." }, 409);
  } catch (error) {
    console.error("catalog duplicate check failed", error);
    return json({ error: "Le catalogue est momentanément indisponible." }, 503);
  }
  const id = crypto.randomUUID(),
    slug = displayName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 42) || "ingredient",
    legacyCode = `custom-${slug}-${id.slice(0, 8)}`,
    now = new Date().toISOString(),
    database = db();
  try {
    await database.batch([
      database
        .prepare(
          `INSERT INTO ingredient_catalog(id,owner_id,legacy_code,display_name,short_name,category,product_type,active,quick_enabled,favorite,display_order,preparation_days,default_operation,storage_mode,storage_temperature,default_bacs,default_labels,label_format,technical_description,allergens,preparation_procedure,handling_rules,usage_count,revision,created_at,updated_at,updated_by_id,updated_by_name)
           VALUES(?,?,?,?,?,?,?,1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,1,?,?,?,?)`,
        )
        .bind(
          id,
          auth.access.ownerId,
          legacyCode,
          displayName,
          shortName,
          category,
          productType,
          Number(payload.quickEnabled !== false),
          Number(Boolean(payload.favorite)),
          Number(payload.displayOrder) || 1000,
          JSON.stringify(preparationDays),
          operation,
          storageMode,
          storageTemperature,
          defaultBacs,
          defaultLabels,
          labelFormat,
          technicalDescription,
          allergens,
          preparationProcedure,
          handlingRules,
          now,
          now,
          auth.access.userId,
          auth.access.displayName,
        ),
      database
        .prepare(
          `INSERT INTO ingredient_operation_rules(id,owner_id,ingredient_id,operation_type,duration_hours,storage_mode,storage_temperature,requires_source_lot,active,revision,created_at,updated_at)
           VALUES(?,?,?,?,?,?,?,?,1,1,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          auth.access.ownerId,
          id,
          operation,
          durationHours,
          storageMode,
          storageTemperature,
          Number(payload.requiresSourceLot !== false),
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
          auth.access.ownerId,
          "ingredient",
          id,
          "created",
          "display_name",
          null,
          displayName,
          "Création d’une fiche dans le catalogue HACCP",
          now,
          auth.access.userId,
          auth.access.displayName,
        ),
    ]);
    const row = await db()
      .prepare(`${selectCatalog} WHERE i.owner_id=? AND i.id=?`)
      .bind(auth.access.ownerId, id)
      .first<Record<string, unknown>>();
    return json({ ingredient: ingredientFromRow(row!) }, 201);
  } catch (error) {
    console.error("catalog create failed", error);
    return json({ error: "Le nouvel ingrédient n’a pas pu être enregistré." }, 503);
  }
}

export async function PUT(request: Request) {
  const auth = await authorize("admin");
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request)) return json({ error: "Origine invalide." }, 403);
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Données invalides." }, 400);
  }
  const id = String(payload.id ?? ""),
    revision = Number(payload.revision),
    operation = String(payload.defaultOperation ?? "") as OperationType,
    durationHours = Number(payload.durationHours),
    labelFormat = String(payload.labelFormat ?? "50x30") as LabelFormat,
    preparationDays = Array.isArray(payload.preparationDays)
      ? [...new Set(payload.preparationDays.map(Number))].filter(
          (day) => Number.isInteger(day) && day >= 0 && day <= 6,
        )
      : [],
    defaultBacs = Number(payload.defaultBacs),
    defaultLabels = Number(payload.defaultLabels),
    reason = clean(payload.reason, 500),
    storageTemperature =
      payload.storageTemperature === null || payload.storageTemperature === ""
        ? null
        : Number(payload.storageTemperature);
  const storageMode = String(payload.storageMode ?? "refrigerated");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(revision))
    return json({ error: "Fiche d’ingrédient invalide." }, 400);
  if (!(operation in OPERATION_LABELS))
    return json({ error: "Opération invalide." }, 400);
  if (!Number.isInteger(durationHours) || durationHours < 1 || durationHours > 8760)
    return json({ error: "La DLC interne doit être comprise entre 1 heure et 365 jours." }, 400);
  if (!Number.isInteger(defaultBacs) || defaultBacs < 1 || defaultBacs > 50)
    return json({ error: "Nombre de bacs invalide." }, 400);
  if (!Number.isInteger(defaultLabels) || defaultLabels < defaultBacs || defaultLabels > 50)
    return json({ error: "Prévoyez au moins une étiquette par bac." }, 400);
  if (!["50x30", "30x20", "50x80"].includes(labelFormat))
    return json({ error: "Format d’étiquette invalide." }, 400);
  if (!["refrigerated", "frozen", "ambient"].includes(storageMode))
    return json({ error: "Mode de conservation invalide." }, 400);
  if (
    storageTemperature !== null &&
    (!Number.isFinite(storageTemperature) ||
      storageTemperature < -50 ||
      storageTemperature > 40)
  )
    return json({ error: "Température de conservation invalide." }, 400);
  const current = await db()
    .prepare(
      `${selectCatalog} WHERE i.owner_id=? AND i.id=? AND i.deleted_at IS NULL`,
    )
    .bind(auth.access.ownerId, id)
    .first<Record<string, unknown>>();
  if (!current) return json({ error: "Ingrédient introuvable." }, 404);
  if (Number(current.revision) !== revision)
    return json({ error: "Cette fiche a été modifiée. Rechargez-la." }, 409);
  if (Number(current.duration_hours) !== durationHours && !reason)
    return json({ error: "Le motif est obligatoire pour modifier la DLC interne." }, 400);
  const displayName = clean(payload.displayName, 120),
    shortName = clean(payload.shortName, 32).toUpperCase(),
    category = clean(payload.category, 80),
    productType = clean(payload.productType, 40),
    technicalDescription = clean(payload.technicalDescription, 2000),
    allergens = clean(payload.allergens, 1000),
    preparationProcedure = clean(payload.preparationProcedure, 2000),
    handlingRules = clean(payload.handlingRules, 2000);
  if (!displayName || !shortName || !category || !productType)
    return json({ error: "Complétez le nom, le nom court, la famille et le type." }, 400);
  const now = new Date().toISOString(),
    database = db();
  try {
    const updates = [
      database
        .prepare(
          `UPDATE ingredient_catalog SET display_name=?,short_name=?,category=?,product_type=?,quick_enabled=?,favorite=?,display_order=?,preparation_days=?,default_operation=?,storage_mode=?,storage_temperature=?,default_bacs=?,default_labels=?,label_format=?,technical_description=?,allergens=?,preparation_procedure=?,handling_rules=?,revision=revision+1,updated_at=?,updated_by_id=?,updated_by_name=?
           WHERE owner_id=? AND id=? AND revision=? AND deleted_at IS NULL`,
        )
        .bind(
          displayName,
          shortName,
          category,
          productType,
          Number(Boolean(payload.quickEnabled)),
          Number(Boolean(payload.favorite)),
          Number(payload.displayOrder) || 1000,
          JSON.stringify(preparationDays),
          operation,
          storageMode,
          storageTemperature,
          defaultBacs,
          defaultLabels,
          labelFormat,
          technicalDescription,
          allergens,
          preparationProcedure,
          handlingRules,
          now,
          auth.access.userId,
          auth.access.displayName,
          auth.access.ownerId,
          id,
          revision,
        ),
      database
        .prepare(
          `INSERT INTO ingredient_operation_rules(id,owner_id,ingredient_id,operation_type,duration_hours,storage_mode,storage_temperature,requires_source_lot,active,revision,created_at,updated_at)
           VALUES(?,?,?,?,?,?,?,?,1,1,?,?)
           ON CONFLICT(owner_id,ingredient_id,operation_type) DO UPDATE SET duration_hours=excluded.duration_hours,storage_mode=excluded.storage_mode,storage_temperature=excluded.storage_temperature,requires_source_lot=excluded.requires_source_lot,active=1,revision=ingredient_operation_rules.revision+1,updated_at=excluded.updated_at`,
        )
        .bind(
          crypto.randomUUID(),
          auth.access.ownerId,
          id,
          operation,
          durationHours,
          storageMode,
          storageTemperature,
          Number(payload.requiresSourceLot !== false),
          now,
          now,
        ),
    ];
    if (Number(current.duration_hours) !== durationHours)
      updates.push(
        database
          .prepare(
            `INSERT INTO traceability_audit_events(id,owner_id,entity_type,entity_id,action,field_name,old_value,new_value,reason,changed_at,changed_by_id,changed_by_name)
             VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
          )
          .bind(
            crypto.randomUUID(),
            auth.access.ownerId,
            "ingredient",
            id,
            "updated",
            "duration_hours",
            String(current.duration_hours),
            String(durationHours),
            reason,
            now,
            auth.access.userId,
            auth.access.displayName,
          ),
      );
    const [result] = await database.batch(updates);
    if (!result.meta.changes)
      return json({ error: "Cette fiche a été modifiée. Rechargez-la." }, 409);
    const row = await db()
      .prepare(`${selectCatalog} WHERE i.owner_id=? AND i.id=?`)
      .bind(auth.access.ownerId, id)
      .first<Record<string, unknown>>();
    return json({ ingredient: ingredientFromRow(row!) });
  } catch (error) {
    console.error("catalog update failed", error);
    return json({ error: "La configuration n’a pas pu être enregistrée." }, 503);
  }
}

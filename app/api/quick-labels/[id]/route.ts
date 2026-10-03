import { authorize } from "@/lib/access";
import { isLocalDate, isLocalDateTime } from "@/lib/labels";
import { recordLifecycle } from "@/lib/lifecycle-server";
import { OPERATION_LABELS, type OperationType } from "@/lib/quick-labels";
import { db, json, sameOrigin } from "@/lib/server";
import { validUuid } from "@/lib/supply";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
const allowedStatuses = [
  "prepared",
  "expired",
  "discarded",
  "consumed",
  "transformed_frozen",
] as const;
const editableFields = [
  "ingredient_name",
  "short_name",
  "operation_type",
  "prepared_at",
  "expires_at",
  "duration_hours",
  "storage_mode",
  "storage_temperature",
  "operator_initials",
  "notes",
  "manual_source_lot",
  "manual_source_reason",
] as const;

function textValue(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max + 1);
}

async function currentPreparation(ownerId: string, id: string) {
  return db()
    .prepare(
      `SELECT p.*,COALESCE((SELECT group_concat(x.supplier_lot_id) FROM internal_preparation_source_lots x WHERE x.owner_id=p.owner_id AND x.preparation_id=p.id),'') AS source_lot_ids
       FROM internal_preparations p WHERE p.owner_id=? AND p.id=? AND p.deleted_at IS NULL`,
    )
    .bind(ownerId, id)
    .first<Record<string, unknown>>();
}

async function selectedSourceLots(ownerId: string, ids: string[]) {
  if (!ids.length)
    return [] as Array<{ id: string; supplierDeadline: string | null }>;
  const marks = ids.map(() => "?").join(",");
  const rows = await db()
    .prepare(
      `SELECT id,supplier_deadline FROM supplier_lots
       WHERE owner_id=? AND deleted_at IS NULL AND id IN (${marks})`,
    )
    .bind(ownerId, ...ids)
    .all<Record<string, unknown>>();
  return rows.results.map((row) => ({
    id: String(row.id),
    supplierDeadline:
      row.supplier_deadline === null ? null : String(row.supplier_deadline),
  }));
}

function detail(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    preparationCode: String(row.preparation_code),
    ingredientName: String(row.ingredient_name),
    shortName: String(row.short_name),
    operationType: String(row.operation_type) as OperationType,
    preparedAt: String(row.prepared_at),
    expiresAt: String(row.expires_at),
    durationHours: Number(row.duration_hours),
    storageMode: String(row.storage_mode),
    storageTemperature:
      row.storage_temperature === null ? null : Number(row.storage_temperature),
    operatorInitials: String(row.operator_initials),
    notes: String(row.notes ?? ""),
    manualSourceLot: String(row.manual_source_lot ?? ""),
    manualSourceReason: String(row.manual_source_reason ?? ""),
    sourceLotIds: String(row.source_lot_ids ?? "").split(",").filter(Boolean),
    status: String(row.status),
    revision: Number(row.revision),
  };
}

export async function GET(_request: Request, { params }: Context) {
  const auth = await authorize("admin");
  if ("response" in auth) return auth.response;
  const { id } = await params;
  if (!validUuid(id)) return json({ error: "Préparation invalide." }, 400);
  const row = await currentPreparation(auth.access.ownerId, id);
  return row
    ? json({ preparation: detail(row) })
    : json({ error: "Cette fiche n’existe plus dans le registre." }, 404);
}

export async function PUT(request: Request, { params }: Context) {
  const auth = await authorize("admin");
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request)) return json({ error: "Origine invalide." }, 403);
  const { id } = await params;
  if (!validUuid(id)) return json({ error: "Préparation invalide." }, 400);
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Données invalides." }, 400);
  }
  const current = await currentPreparation(auth.access.ownerId, id);
  if (!current)
    return json({ error: "Cette fiche n’existe plus dans le registre." }, 404);
  const revision = Number(payload.revision);
  if (!Number.isInteger(revision) || revision !== Number(current.revision))
    return json({ error: "Cette fiche a déjà été modifiée. Rechargez-la." }, 409);

  const ingredientName = textValue(payload.ingredientName, 100),
    shortName = textValue(payload.shortName, 48),
    operationType = textValue(payload.operationType, 40) as OperationType,
    preparedAt = textValue(payload.preparedAt, 16),
    expiresAt = textValue(payload.expiresAt, 16),
    storageMode = textValue(payload.storageMode, 20),
    temperatureRaw = payload.storageTemperature,
    storageTemperature =
      temperatureRaw === null || temperatureRaw === ""
        ? null
        : Number(temperatureRaw),
    operatorInitials = textValue(payload.operatorInitials, 8).toUpperCase(),
    notes = textValue(payload.notes, 1000),
    manualSourceLot = textValue(payload.manualSourceLot, 100),
    manualSourceReason = textValue(payload.manualSourceReason, 300),
    sourceLotIds = Array.isArray(payload.sourceLotIds)
      ? [...new Set(payload.sourceLotIds.map(String))]
      : [];
  if (!ingredientName || !shortName || !operatorInitials)
    return json({ error: "Nom, nom court et opérateur sont obligatoires." }, 400);
  if (!(operationType in OPERATION_LABELS))
    return json({ error: "Opération invalide." }, 400);
  if (sourceLotIds.length > 20 || !sourceLotIds.every(validUuid))
    return json({ error: "Un lot fournisseur sélectionné est invalide." }, 400);
  if (manualSourceLot && !manualSourceReason)
    return json(
      {
        error:
          "Indiquez pourquoi le lot saisi manuellement n’est pas encore lié à une réception.",
      },
      400,
    );
  if (
    !isLocalDateTime(preparedAt) ||
    !isLocalDateTime(expiresAt) ||
    expiresAt <= preparedAt
  )
    return json({ error: "Vérifiez les dates de préparation et de DLC." }, 400);
  if (!["refrigerated", "frozen", "ambient"].includes(storageMode))
    return json({ error: "Conservation invalide." }, 400);
  if (
    storageTemperature !== null &&
    (!Number.isFinite(storageTemperature) ||
      storageTemperature < -100 ||
      storageTemperature > 100)
  )
    return json({ error: "Température de conservation invalide." }, 400);
  const lots = await selectedSourceLots(auth.access.ownerId, sourceLotIds);
  if (lots.length !== sourceLotIds.length)
    return json({ error: "Un lot fournisseur sélectionné n’existe plus." }, 409);
  const supplierLimit = lots
      .map((lot) => lot.supplierDeadline)
      .filter((value): value is string => Boolean(value && isLocalDate(value)))
      .sort()[0],
    supplierExpiresAt = supplierLimit ? `${supplierLimit}T23:59` : null,
    effectiveExpiresAt =
      supplierExpiresAt && supplierExpiresAt < expiresAt
        ? supplierExpiresAt
        : expiresAt;
  if (effectiveExpiresAt <= preparedAt)
    return json(
      { error: "La DLC du lot fournisseur est antérieure à la préparation." },
      400,
    );
  const durationHours = Math.ceil(
    (new Date(`${effectiveExpiresAt}:00`).getTime() -
      new Date(`${preparedAt}:00`).getTime()) /
      3_600_000,
  );
  if (
    !Number.isInteger(durationHours) ||
    durationHours < 1 ||
    durationHours > 17_520
  )
    return json({ error: "La durée appliquée est invalide." }, 400);

  const currentSourceLotIds = String(current.source_lot_ids ?? "")
      .split(",")
      .filter(Boolean)
      .sort(),
    nextSourceLotIds = [...sourceLotIds].sort(),
    sourceLotsChanged =
      currentSourceLotIds.join(",") !== nextSourceLotIds.join(","),
    snapshot = (() => {
      try {
        return JSON.parse(String(current.technical_snapshot ?? "{}")) as Record<
          string,
          unknown
        >;
      } catch {
        return {};
      }
    })(),
    technicalSnapshot = JSON.stringify({
      ...snapshot,
      durationHours,
      supplierLimit: supplierLimit ?? null,
      cappedBySupplier: Boolean(
        supplierExpiresAt && supplierExpiresAt < expiresAt,
      ),
      sourceLotStatus: sourceLotIds.length
        ? "linked"
        : manualSourceLot
          ? "manual"
          : "missing",
    }),
    values: Record<(typeof editableFields)[number], unknown> = {
      ingredient_name: ingredientName,
      short_name: shortName,
      operation_type: operationType,
      prepared_at: preparedAt,
      expires_at: effectiveExpiresAt,
      duration_hours: durationHours,
      storage_mode: storageMode,
      storage_temperature: storageTemperature,
      operator_initials: operatorInitials,
      notes,
      manual_source_lot: manualSourceLot,
      manual_source_reason: manualSourceReason,
    },
    changed: string[] = editableFields.filter(
      (field) => String(current[field] ?? "") !== String(values[field] ?? ""),
    );
  if (sourceLotsChanged) changed.push("source_lot_ids");
  if (!changed.length) return json({ preparation: detail(current) });

  const now = new Date().toISOString(),
    database = db(),
    guard =
      "EXISTS(SELECT 1 FROM internal_preparations WHERE owner_id=? AND id=? AND revision=? AND updated_at=? AND deleted_at IS NULL)",
    update = database
      .prepare(
        `UPDATE internal_preparations SET ingredient_name=?,short_name=?,operation_type=?,prepared_at=?,expires_at=?,duration_hours=?,storage_mode=?,storage_temperature=?,operator_initials=?,notes=?,manual_source_lot=?,manual_source_reason=?,technical_snapshot=?,revision=revision+1,updated_at=?,updated_by_id=?,updated_by_name=?
         WHERE owner_id=? AND id=? AND revision=? AND deleted_at IS NULL`,
      )
      .bind(
        ingredientName,
        shortName,
        operationType,
        preparedAt,
        effectiveExpiresAt,
        durationHours,
        storageMode,
        storageTemperature,
        operatorInitials,
        notes,
        manualSourceLot,
        manualSourceReason,
        technicalSnapshot,
        now,
        auth.access.userId,
        auth.access.displayName,
        auth.access.ownerId,
        id,
        revision,
      ),
    linkChanges = sourceLotsChanged
      ? [
          database
            .prepare(
              `DELETE FROM internal_preparation_source_lots
               WHERE owner_id=? AND preparation_id=? AND ${guard}`,
            )
            .bind(
              auth.access.ownerId,
              id,
              auth.access.ownerId,
              id,
              revision + 1,
              now,
            ),
          ...nextSourceLotIds.map((sourceLotId) =>
            database
              .prepare(
                `INSERT INTO internal_preparation_source_lots(id,owner_id,preparation_id,supplier_lot_id,quantity_used,created_at)
                 SELECT ?,?,?,?,?,? WHERE ${guard}`,
              )
              .bind(
                crypto.randomUUID(),
                auth.access.ownerId,
                id,
                sourceLotId,
                "",
                now,
                auth.access.ownerId,
                id,
                revision + 1,
                now,
              ),
          ),
        ]
      : [],
    audits = changed.map((field) =>
      database
        .prepare(
          `INSERT INTO traceability_audit_events(id,owner_id,entity_type,entity_id,action,field_name,old_value,new_value,reason,changed_at,changed_by_id,changed_by_name)
           SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE ${guard}`,
        )
        .bind(
          crypto.randomUUID(),
          auth.access.ownerId,
          "preparation",
          id,
          "updated",
          field,
          field === "source_lot_ids"
            ? currentSourceLotIds.join(",")
            : current[field] === null
              ? null
              : String(current[field] ?? ""),
          field === "source_lot_ids"
            ? nextSourceLotIds.join(",")
            : values[field as (typeof editableFields)[number]] === null
              ? null
              : String(
                  values[field as (typeof editableFields)[number]] ?? "",
                ),
          "Correction depuis le registre unifié",
          now,
          auth.access.userId,
          auth.access.displayName,
          auth.access.ownerId,
          id,
          revision + 1,
          now,
        ),
    );
  try {
    const [result] = await database.batch([update, ...linkChanges, ...audits]);
    if (!result.meta.changes)
      return json(
        { error: "Cette fiche vient d’être modifiée. Rechargez-la." },
        409,
      );
    const saved = await currentPreparation(auth.access.ownerId, id);
    return json({ preparation: detail(saved!) });
  } catch (error) {
    console.error("quick preparation update failed", error);
    return json({ error: "La fiche n’a pas pu être modifiée." }, 503);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  const auth = await authorize("admin");
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request)) return json({ error: "Origine invalide." }, 403);
  const { id } = await params;
  if (!validUuid(id)) return json({ error: "Préparation invalide." }, 400);
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Données invalides." }, 400);
  }
  const status = String(payload.status ?? "") as (typeof allowedStatuses)[number];
  if (!allowedStatuses.includes(status))
    return json({ error: "État invalide." }, 400);
  if (["consumed", "discarded", "transformed_frozen"].includes(status)) {
    try {
      return await recordLifecycle(auth.access, {
        ...payload,
        id,
        kind: "quick",
        action: status,
      });
    } catch {
      return json({ error: "L’état n’a pas pu être enregistré." }, 503);
    }
  }
  const current = await currentPreparation(auth.access.ownerId, id);
  if (!current) return json({ error: "Préparation introuvable." }, 404);
  const now = new Date().toISOString(),
    bacStatus = status === "prepared" ? "active" : status,
    labelStatus = status === "prepared" ? "to_print" : status,
    database = db();
  try {
    await database.batch([
      database
        .prepare(
          "UPDATE internal_preparations SET status=?,revision=revision+1,updated_at=?,updated_by_id=?,updated_by_name=? WHERE owner_id=? AND id=? AND deleted_at IS NULL",
        )
        .bind(
          status,
          now,
          auth.access.userId,
          auth.access.displayName,
          auth.access.ownerId,
          id,
        ),
      database
        .prepare(
          "UPDATE preparation_bacs SET status=?,updated_at=? WHERE owner_id=? AND preparation_id=?",
        )
        .bind(bacStatus, now, auth.access.ownerId, id),
      database
        .prepare(
          "UPDATE physical_labels SET status=?,updated_at=? WHERE owner_id=? AND preparation_id=? AND status NOT IN ('printing')",
        )
        .bind(labelStatus, now, auth.access.ownerId, id),
    ]);
    return json({ status });
  } catch {
    return json({ error: "L’état n’a pas pu être enregistré." }, 503);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const auth = await authorize("admin");
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request)) return json({ error: "Origine invalide." }, 403);
  const { id } = await params;
  if (!validUuid(id)) return json({ error: "Préparation invalide." }, 400);
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Données invalides." }, 400);
  }
  const revision = Number(payload.revision),
    current = await currentPreparation(auth.access.ownerId, id);
  if (!current)
    return json({ error: "Cette fiche n’existe plus dans le registre." }, 404);
  if (!Number.isInteger(revision) || revision !== Number(current.revision))
    return json({ error: "Cette fiche a déjà été modifiée. Rechargez-la." }, 409);
  const now = new Date().toISOString(),
    database = db(),
    eventId = crypto.randomUUID();
  try {
    const [result] = await database.batch([
      database
        .prepare(
          "UPDATE internal_preparations SET revision=revision+1,deleted_at=?,deleted_by_id=?,deleted_by_name=?,updated_at=?,updated_by_id=?,updated_by_name=? WHERE owner_id=? AND id=? AND revision=? AND deleted_at IS NULL",
        )
        .bind(
          now,
          auth.access.userId,
          auth.access.displayName,
          now,
          auth.access.userId,
          auth.access.displayName,
          auth.access.ownerId,
          id,
          revision,
        ),
      database
        .prepare(
          "INSERT INTO traceability_audit_events(id,owner_id,entity_type,entity_id,action,field_name,old_value,new_value,reason,changed_at,changed_by_id,changed_by_name) SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE changes()=1",
        )
        .bind(
          eventId,
          auth.access.ownerId,
          "preparation",
          id,
          "deleted",
          "deleted_at",
          null,
          now,
          "Suppression logique depuis le registre unifié",
          now,
          auth.access.userId,
          auth.access.displayName,
        ),
    ]);
    if (!result.meta.changes)
      return json(
        { error: "Cette fiche vient d’être modifiée. Rechargez-la." },
        409,
      );
    return json({ deleted: true, id });
  } catch (error) {
    console.error("quick preparation delete failed", error);
    return json({ error: "La fiche n’a pas pu être supprimée." }, 503);
  }
}

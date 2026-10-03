import { authorize } from "@/lib/access";
import { quickCatalogSyncStatements } from "@/lib/catalog-server";
import { automaticLot, validateLabelPayload } from "@/lib/label-payload";
import { labelFromRow, presetFor, type PreparationLabel } from "@/lib/labels";
import { db, json, sameOrigin } from "@/lib/server";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const validId = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
const selectLabel = `SELECT p.*,
  COALESCE((SELECT group_concat(psl.supplier_lot_id) FROM preparation_source_lots psl
    WHERE psl.owner_id=p.owner_id AND psl.preparation_label_id=p.id),'') AS source_lot_ids
  FROM preparation_labels p`;
async function sourceLotsExist(ownerId: string, ids: string[]) {
  if (!ids.length) return true;
  const marks = ids.map(() => "?").join(",");
  const rows = await db()
    .prepare(
      `SELECT id FROM supplier_lots WHERE owner_id=? AND deleted_at IS NULL AND id IN (${marks})`,
    )
    .bind(ownerId, ...ids)
    .all();
  return rows.results.length === ids.length;
}
async function missing(ownerId: string, id: string) {
  const current = await db()
    .prepare(
      "SELECT revision,deleted_at FROM preparation_labels WHERE owner_id=? AND id=?",
    )
    .bind(ownerId, id)
    .first<{ revision: number; deleted_at: string | null }>();
  return !current || current.deleted_at
    ? json({ error: "Cette fiche n’existe plus dans le registre." }, 404)
    : json(
        { error: "Cette fiche a déjà été modifiée. Rechargez la page." },
        409,
      );
}
export async function PUT(request: Request, { params }: Context) {
  const auth = await authorize("admin");
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request))
    return json({ error: "Origine de la demande invalide." }, 403);
  const { id } = await params;
  if (!validId(id)) return json({ error: "Fiche introuvable." }, 404);
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Données invalides." }, 400);
  }
  const revision = Number(payload.revision);
  if (!Number.isInteger(revision) || revision < 1)
    return json({ error: "Rechargez la fiche avant de la modifier." }, 409);
  const checked = validateLabelPayload(payload);
  if ("error" in checked) return json({ error: checked.error }, 400);
  const v = checked.value,
    lot = v.lotCode || automaticLot(v.preset.code, v.preparedAt, id),
    now = new Date().toISOString(),
    { ownerId, userId, displayName } = auth.access;
  try {
    if (!(await sourceLotsExist(ownerId, v.sourceLotIds)))
      return json(
        { error: "Un lot fournisseur sélectionné n’existe plus." },
        409,
      );
    const database = db();
    const catalogStatements = presetFor(v.preset.code)
      ? []
      : await quickCatalogSyncStatements(
          { ownerId, userId, displayName },
          v.preset,
        );
    const update = database
      .prepare(
        `UPDATE preparation_labels SET product_code=?,product_name=?,category=?,process_type=?,source_state=?,storage_mode=?,storage_temperature=?,duration_hours=?,prepared_at=?,frozen_at=?,expires_at=?,operator_initials=?,lot_code=?,quantity=?,packaging=?,note=?,supplier_name=?,supplier_lot=?,supplier_deadline=?,received_at=?,opened_at=?,source_label_id=?,cooking_ended_at=?,cooking_temperature=?,cooling_started_at=?,cooling_start_temperature=?,cooling_ended_at=?,cooling_end_temperature=?,cooling_method=?,cooling_duration_minutes=?,cooling_compliant=?,thawing_started_at=?,thawing_method=?,freeze_method=?,freezer_temperature=?,corrective_action=?,control_status=?,revision=revision+1,updated_at=?,updated_by_id=?,updated_by_name=? WHERE owner_id=? AND id=? AND revision=? AND deleted_at IS NULL`,
      )
      .bind(
        v.preset.code,
        v.preset.name,
        v.preset.category,
        v.preset.processType,
        v.preset.sourceState,
        v.preset.storageMode,
        v.preset.storageTemperature,
        v.durationHours,
        v.preparedAt,
        v.frozenAt,
        v.expiresAt,
        v.operatorInitials,
        lot,
        v.quantity,
        v.packaging,
        v.note,
        v.supplierName,
        v.supplierLot,
        v.supplierDeadline,
        v.receivedAt,
        v.openedAt,
        v.sourceLabelId,
        v.cookingEndedAt,
        v.cookingTemperature,
        v.coolingStartedAt,
        v.coolingStartTemperature,
        v.coolingEndedAt,
        v.coolingEndTemperature,
        v.coolingMethod,
        v.coolingDurationMinutes,
        v.coolingCompliant === null ? null : Number(v.coolingCompliant),
        v.thawingStartedAt,
        v.thawingMethod,
        v.freezeMethod,
        v.freezerTemperature,
        v.correctiveAction,
        v.controlStatus,
        now,
        userId,
        displayName,
        ownerId,
        id,
        revision,
      );
    const changed =
      "EXISTS(SELECT 1 FROM preparation_labels WHERE owner_id=? AND id=? AND revision=? AND updated_at=?)";
    const unlink = database
      .prepare(
        `DELETE FROM preparation_source_lots WHERE owner_id=? AND preparation_label_id=? AND ${changed}`,
      )
      .bind(ownerId, id, ownerId, id, revision + 1, now);
    const links = v.sourceLotIds.map((sourceLotId) =>
      database
        .prepare(
          `INSERT INTO preparation_source_lots(id,owner_id,preparation_label_id,supplier_lot_id,created_at) SELECT ?,?,?,?,? WHERE ${changed}`,
        )
        .bind(
          crypto.randomUUID(),
          ownerId,
          id,
          sourceLotId,
          now,
          ownerId,
          id,
          revision + 1,
          now,
        ),
    );
    const sourceLotExpected = ["opened", "supplier_frozen", "thawed"].includes(
        v.preset.processType,
      ),
      missingSourceLot =
        sourceLotExpected && !v.sourceLotIds.length && !v.supplierLot,
      traceabilityWarnings = missingSourceLot
        ? [
            database
              .prepare(
                `INSERT INTO traceability_audit_events(id,owner_id,entity_type,entity_id,action,field_name,old_value,new_value,reason,changed_at,changed_by_id,changed_by_name)
                 SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE ${changed}`,
              )
              .bind(
                crypto.randomUUID(),
                ownerId,
                "preparation_label",
                id,
                "warning",
                "source_lot",
                null,
                "non_renseigne",
                "Fiche enregistrée sans lot fournisseur : traçabilité amont à compléter.",
                now,
                userId,
                displayName,
                ownerId,
                id,
                revision + 1,
                now,
              ),
          ]
        : [];
    const [result] = await database.batch([
      update,
      unlink,
      ...links,
      ...traceabilityWarnings,
      ...catalogStatements,
    ]);
    if (!result.meta.changes) return missing(ownerId, id);
    const row = await db()
      .prepare(
        `${selectLabel} WHERE p.owner_id=? AND p.id=? AND p.deleted_at IS NULL`,
      )
      .bind(ownerId, id)
      .first<Record<string, unknown>>();
    return json({
      label: labelFromRow(row!),
      warnings: missingSourceLot
        ? ["Lot fournisseur non renseigné · traçabilité à compléter."]
        : [],
    } satisfies {
      label: PreparationLabel;
      warnings: string[];
    });
  } catch (error) {
    console.error("label update failed", error);
    return json(
      { error: "La fiche n’a pas pu être modifiée. Réessayez." },
      503,
    );
  }
}
export async function DELETE(request: Request, { params }: Context) {
  const auth = await authorize("admin");
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request))
    return json({ error: "Origine de la demande invalide." }, 403);
  const { id } = await params;
  if (!validId(id)) return json({ error: "Fiche introuvable." }, 404);
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Données invalides." }, 400);
  }
  const revision = Number(payload.revision);
  if (!Number.isInteger(revision) || revision < 1)
    return json({ error: "Rechargez la fiche avant de la supprimer." }, 409);
  const now = new Date().toISOString(),
    { ownerId, userId, displayName } = auth.access;
  try {
    const result = await db()
      .prepare(
        "UPDATE preparation_labels SET revision=revision+1,deleted_at=?,deleted_by_id=?,deleted_by_name=? WHERE owner_id=? AND id=? AND revision=? AND deleted_at IS NULL",
      )
      .bind(now, userId, displayName, ownerId, id, revision)
      .run();
    if (!result.meta.changes) return missing(ownerId, id);
    return json({ deleted: true, id });
  } catch {
    return json(
      { error: "La fiche n’a pas pu être supprimée. Réessayez." },
      503,
    );
  }
}

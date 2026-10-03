import { authorize } from "@/lib/access";
import { prepareLineage, LineageError } from "@/lib/label-lineage-write";
import { quickCatalogSyncStatements } from "@/lib/catalog-server";
import { automaticLot, validateLabelPayload } from "@/lib/label-payload";
import { labelFromRow, presetFor, type PreparationLabel } from "@/lib/labels";
import { db, json, sameOrigin } from "@/lib/server";
export const dynamic = "force-dynamic";
const selectLabels = `SELECT p.*,
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
export async function GET() {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  try {
    const rows = await db()
      .prepare(
        `${selectLabels} WHERE p.owner_id=? AND p.deleted_at IS NULL ORDER BY p.created_at DESC LIMIT 300`,
      )
      .bind(auth.access.ownerId)
      .all();
    return json({
      labels: rows.results.map((row) =>
        labelFromRow(row as Record<string, unknown>),
      ),
    });
  } catch {
    return json(
      { error: "Les étiquettes enregistrées ne peuvent pas être chargées." },
      503,
    );
  }
}
export async function POST(request: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request))
    return json({ error: "Origine de la demande invalide." }, 403);
  if (Number(request.headers.get("content-length")) > 24000)
    return json({ error: "Fiche trop volumineuse." }, 413);
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Données invalides." }, 400);
  }
  const checked = validateLabelPayload(payload);
  if ("error" in checked) return json({ error: checked.error }, 400);
  const v = checked.value,
    id = crypto.randomUUID(),
    now = new Date().toISOString(),
    { ownerId, userId, displayName, memberRevision } = auth.access,
    lot = v.lotCode || automaticLot(v.preset.code, v.preparedAt, id);
  try {
    const lineage = await prepareLineage(payload,v,id,now,{ownerId,userId,displayName});
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
    const insert = database
      .prepare(
        `INSERT INTO preparation_labels(id,owner_id,product_code,product_name,category,process_type,source_state,storage_mode,storage_temperature,duration_hours,prepared_at,frozen_at,expires_at,operator_initials,lot_code,quantity,packaging,note,supplier_name,supplier_lot,supplier_deadline,received_at,opened_at,source_label_id,cooking_ended_at,cooking_temperature,cooling_started_at,cooling_start_temperature,cooling_ended_at,cooling_end_temperature,cooling_method,cooling_duration_minutes,cooling_compliant,thawing_started_at,thawing_method,freeze_method,freezer_temperature,corrective_action,control_status,created_at,created_by_id,created_by_name) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (?=? OR EXISTS(SELECT 1 FROM register_members WHERE owner_id=? AND user_id=? AND status='active' AND revision=?))${lineage.guard}`,
      )
      .bind(
        id,
        ownerId,
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
        userId,
        ownerId,
        ownerId,
        userId,
        memberRevision,
        ...lineage.guardValues,
      );
    const links = v.sourceLotIds.map((sourceLotId) =>
      database
        .prepare(
          "INSERT INTO preparation_source_lots(id,owner_id,preparation_label_id,supplier_lot_id,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM preparation_labels WHERE owner_id=? AND id=? AND deleted_at IS NULL)",
        )
        .bind(crypto.randomUUID(), ownerId, id, sourceLotId, now, ownerId, id),
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
                 SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM preparation_labels WHERE owner_id=? AND id=? AND deleted_at IS NULL)`,
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
                "Étiquette créée sans lot fournisseur : traçabilité amont à compléter.",
                now,
                userId,
                displayName,
                ownerId,
                id,
              ),
          ]
        : [];
    const [result] = await database.batch([
      insert,
      ...links,
      ...traceabilityWarnings,
      ...lineage.statements,
      ...catalogStatements,
    ]);
    if (!result.meta.changes)
      return json(
        {
          error:
            "Votre accès a changé. Rouvrez l’application avant d’enregistrer.",
        },
        403,
      );
    const row = await db()
      .prepare(
        `${selectLabels} WHERE p.owner_id=? AND p.id=? AND p.deleted_at IS NULL`,
      )
      .bind(ownerId, id)
      .first<Record<string, unknown>>();
    return json(
      {
        label: labelFromRow(row!),
        warnings: missingSourceLot
          ? ["Lot fournisseur non renseigné · traçabilité à compléter."]
          : [],
      } satisfies { label: PreparationLabel; warnings: string[] },
      201,
    );
  } catch (error) {
    if (error instanceof LineageError) return json({error:error.message},error.status);
    console.error("label insert failed", error);
    return json(
      { error: "L’étiquette n’a pas pu être enregistrée. Réessayez." },
      503,
    );
  }
}

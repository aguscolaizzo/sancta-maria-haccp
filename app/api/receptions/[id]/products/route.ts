import { authorize, type AuthorizedAccess } from "@/lib/access";
import { productFromRow, validateProductPayload } from "@/lib/receptions";
import { db, json, sameOrigin } from "@/lib/server";
import { validUuid } from "@/lib/supply";

export const dynamic = "force-dynamic";

function auditCreate(
  database: ReturnType<typeof db>,
  access: AuthorizedAccess,
  receptionId: string,
  productId: string,
  productName: string,
  now: string,
) {
  return database
    .prepare(
      `INSERT INTO reception_audit_events(id,owner_id,reception_id,entity_type,entity_id,action,field_name,old_value,new_value,changed_at,changed_by_id,changed_by_name)
    VALUES(?,?,?,'product',?,'created','product_name',NULL,?,?,?,?)`,
    )
    .bind(
      crypto.randomUUID(),
      access.ownerId,
      receptionId,
      productId,
      productName,
      now,
      access.userId,
      access.displayName,
    );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request))
    return json({ error: "Origine de la demande invalide." }, 403);
  const { id: receptionId } = await params;
  if (!validUuid(receptionId))
    return json({ error: "Réception introuvable." }, 404);
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Données invalides." }, 400);
  }
  const checked = validateProductPayload(payload);
  if ("error" in checked) return json({ error: checked.error }, 400);
  const v = checked.value,
    database = db(),
    { ownerId, userId, displayName, role } = auth.access;
  try {
    const reception = await database
      .prepare("SELECT status FROM receptions WHERE owner_id=? AND id=?")
      .bind(ownerId, receptionId)
      .first<{ status: string }>();
    if (!reception) return json({ error: "Réception introuvable." }, 404);
    if (reception.status !== "in_progress" && role === "contributor")
      return json(
        { error: "Seul le responsable peut corriger une réception validée." },
        403,
      );
    const existing = await database
      .prepare(
        "SELECT count(*) AS count FROM reception_products WHERE owner_id=? AND reception_id=? AND temperature_regime=? AND suggested_for_measurement=1 AND deleted_at IS NULL",
      )
      .bind(ownerId, receptionId, v.temperatureRegime)
      .first<{ count: number }>();
    const suggestionLimit =
      v.temperatureRegime === "refrigerated"
        ? 3
        : v.temperatureRegime === "frozen"
          ? 2
          : 0;
    const suggested =
      v.temperatureRegime !== "ambient" &&
      (v.riskLevel === "high" ||
        Number(existing?.count ?? 0) < suggestionLimit);
    const selected =
      v.temperatureRegime !== "ambient" &&
      (payload.selectedForMeasurement === undefined
        ? suggested
        : v.selectedForMeasurement);
    const id = crypto.randomUUID(),
      now = new Date().toISOString();
    const insert = database
      .prepare(
        `INSERT INTO reception_products(id,owner_id,reception_id,product_name,category,temperature_regime,quantity,unit,supplier_lot,deadline_type,deadline_date,storage_temperature,max_temperature,packaging_compliant,visual_compliant,cleanliness_compliant,humidity_absent,pests_absent,product_compliant,selected_for_measurement,suggested_for_measurement,risk_level,ir_temperature,probe_temperature,measurement_method,remeasure_temperature,observations,decision_type,concerned_quantity,non_conformity_reason,non_conformity_comment,corrective_action,final_decision,revision,created_at,created_by_id,created_by_name)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?)`,
      )
      .bind(
        id,
        ownerId,
        receptionId,
        v.productName,
        v.category,
        v.temperatureRegime,
        v.quantity,
        v.unit,
        v.supplierLot,
        v.deadlineType,
        v.deadlineDate,
        v.storageTemperature,
        v.maxTemperature,
        v.packagingCompliant === null ? null : Number(v.packagingCompliant),
        v.visualCompliant === null ? null : Number(v.visualCompliant),
        v.cleanlinessCompliant === null ? null : Number(v.cleanlinessCompliant),
        v.humidityAbsent === null ? null : Number(v.humidityAbsent),
        v.pestsAbsent === null ? null : Number(v.pestsAbsent),
        v.productCompliant === null ? null : Number(v.productCompliant),
        Number(selected),
        Number(suggested),
        v.riskLevel,
        v.irTemperature,
        v.probeTemperature,
        v.measurementMethod,
        v.remeasureTemperature,
        v.observations,
        v.decisionType,
        v.concernedQuantity,
        v.nonConformityReason,
        v.nonConformityComment,
        v.correctiveAction,
        v.finalDecision,
        now,
        userId,
        displayName,
      );
    await database.batch([
      insert,
      auditCreate(database, auth.access, receptionId, id, v.productName, now),
    ]);
    const row = await database
      .prepare("SELECT * FROM reception_products WHERE owner_id=? AND id=?")
      .bind(ownerId, id)
      .first<Record<string, unknown>>();
    return json({ product: productFromRow(row!) }, 201);
  } catch (error) {
    console.error("reception product create failed", error);
    return json({ error: "Le produit reçu n’a pas pu être ajouté." }, 503);
  }
}

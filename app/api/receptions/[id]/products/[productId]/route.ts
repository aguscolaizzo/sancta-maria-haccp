import { authorize, type AuthorizedAccess } from "@/lib/access";
import {
  finalReceptionStatus,
  productFromRow,
  validateProductPayload,
  validationErrors,
} from "@/lib/receptions";
import { db, json, sameOrigin } from "@/lib/server";
import { validUuid } from "@/lib/supply";

export const dynamic = "force-dynamic";

const columns: Record<string, string> = {
  productName: "product_name",
  category: "category",
  temperatureRegime: "temperature_regime",
  quantity: "quantity",
  unit: "unit",
  supplierLot: "supplier_lot",
  deadlineType: "deadline_type",
  deadlineDate: "deadline_date",
  storageTemperature: "storage_temperature",
  maxTemperature: "max_temperature",
  packagingCompliant: "packaging_compliant",
  visualCompliant: "visual_compliant",
  cleanlinessCompliant: "cleanliness_compliant",
  humidityAbsent: "humidity_absent",
  pestsAbsent: "pests_absent",
  productCompliant: "product_compliant",
  selectedForMeasurement: "selected_for_measurement",
  suggestedForMeasurement: "suggested_for_measurement",
  riskLevel: "risk_level",
  irTemperature: "ir_temperature",
  probeTemperature: "probe_temperature",
  measurementMethod: "measurement_method",
  remeasureTemperature: "remeasure_temperature",
  observations: "observations",
  decisionType: "decision_type",
  concernedQuantity: "concerned_quantity",
  nonConformityReason: "non_conformity_reason",
  nonConformityComment: "non_conformity_comment",
  correctiveAction: "corrective_action",
  finalDecision: "final_decision",
};

const serialized = (value: unknown) =>
  value === null || value === undefined
    ? null
    : typeof value === "string"
      ? value
      : JSON.stringify(value);
function audit(
  database: ReturnType<typeof db>,
  access: AuthorizedAccess,
  receptionId: string,
  productId: string,
  action: "updated" | "deleted",
  field: string,
  before: unknown,
  after: unknown,
  now: string,
) {
  return database
    .prepare(
      `INSERT INTO reception_audit_events(id,owner_id,reception_id,entity_type,entity_id,action,field_name,old_value,new_value,changed_at,changed_by_id,changed_by_name)
    VALUES(?,?,?,'product',?,?,?,?,?,?,?,?)`,
    )
    .bind(
      crypto.randomUUID(),
      access.ownerId,
      receptionId,
      productId,
      action,
      field,
      serialized(before),
      serialized(after),
      now,
      access.userId,
      access.displayName,
    );
}

async function context(
  ownerId: string,
  receptionId: string,
  productId: string,
) {
  const database = db();
  const [reception, product] = await Promise.all([
    database
      .prepare("SELECT * FROM receptions WHERE owner_id=? AND id=?")
      .bind(ownerId, receptionId)
      .first<Record<string, unknown>>(),
    database
      .prepare(
        "SELECT * FROM reception_products WHERE owner_id=? AND reception_id=? AND id=? AND deleted_at IS NULL",
      )
      .bind(ownerId, receptionId, productId)
      .first<Record<string, unknown>>(),
  ]);
  return { reception, product };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; productId: string }> },
) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request))
    return json({ error: "Origine de la demande invalide." }, 403);
  const { id: receptionId, productId } = await params;
  if (!validUuid(receptionId) || !validUuid(productId))
    return json({ error: "Produit reçu introuvable." }, 404);
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
    now = new Date().toISOString();
  try {
    const current = await context(auth.access.ownerId, receptionId, productId);
    if (!current.reception || !current.product)
      return json({ error: "Produit reçu introuvable." }, 404);
    if (
      String(current.reception.status) !== "in_progress" &&
      auth.access.role === "contributor"
    )
      return json(
        { error: "Seul le responsable peut corriger une réception validée." },
        403,
      );
    const old = productFromRow(current.product),
      revision = Number(payload.revision ?? 0);
    if (revision !== old.revision)
      return json(
        {
          error:
            "Ce produit a été modifié sur un autre appareil. Rechargez la réception.",
        },
        409,
      );
    const changed = Object.keys(columns).filter(
      (key) =>
        serialized(old[key as keyof typeof old]) !==
        serialized(v[key as keyof typeof v]),
    );
    const update = database
      .prepare(
        `UPDATE reception_products SET product_name=?,category=?,temperature_regime=?,quantity=?,unit=?,supplier_lot=?,deadline_type=?,deadline_date=?,storage_temperature=?,max_temperature=?,packaging_compliant=?,visual_compliant=?,cleanliness_compliant=?,humidity_absent=?,pests_absent=?,product_compliant=?,selected_for_measurement=?,suggested_for_measurement=?,risk_level=?,ir_temperature=?,probe_temperature=?,measurement_method=?,remeasure_temperature=?,observations=?,decision_type=?,concerned_quantity=?,non_conformity_reason=?,non_conformity_comment=?,corrective_action=?,final_decision=?,revision=revision+1,updated_at=?,updated_by_id=?,updated_by_name=? WHERE owner_id=? AND reception_id=? AND id=? AND revision=? AND deleted_at IS NULL`,
      )
      .bind(
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
        Number(v.selectedForMeasurement),
        Number(v.suggestedForMeasurement),
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
        auth.access.userId,
        auth.access.displayName,
        auth.access.ownerId,
        receptionId,
        productId,
        revision,
      );
    const audits = changed.map((key) =>
      audit(
        database,
        auth.access,
        receptionId,
        productId,
        "updated",
        columns[key],
        old[key as keyof typeof old],
        v[key as keyof typeof v],
        now,
      ),
    );
    const [result] = await database.batch([update, ...audits]);
    if (!result.meta.changes)
      return json(
        { error: "Ce produit a changé. Rechargez la réception." },
        409,
      );
    if (String(current.reception.status) !== "in_progress") {
      const rows = await database
        .prepare(
          "SELECT * FROM reception_products WHERE owner_id=? AND reception_id=? AND deleted_at IS NULL",
        )
        .bind(auth.access.ownerId, receptionId)
        .all();
      const products = rows.results.map((row) =>
        productFromRow(row as Record<string, unknown>),
      );
      if (!validationErrors(products).length) {
        const status = finalReceptionStatus(products),
          oldStatus = String(current.reception.status);
        if (status !== oldStatus)
          await database.batch([
            database
              .prepare(
                "UPDATE receptions SET status=?,revision=revision+1,updated_at=?,updated_by_id=?,updated_by_name=? WHERE owner_id=? AND id=?",
              )
              .bind(
                status,
                now,
                auth.access.userId,
                auth.access.displayName,
                auth.access.ownerId,
                receptionId,
              ),
            database
              .prepare(
                `INSERT INTO reception_audit_events(id,owner_id,reception_id,entity_type,entity_id,action,field_name,old_value,new_value,changed_at,changed_by_id,changed_by_name) VALUES(?,?,?,'reception',?,'updated','status',?,?,?,?,?)`,
              )
              .bind(
                crypto.randomUUID(),
                auth.access.ownerId,
                receptionId,
                receptionId,
                oldStatus,
                status,
                now,
                auth.access.userId,
                auth.access.displayName,
              ),
          ]);
      }
    }
    const row = await database
      .prepare("SELECT * FROM reception_products WHERE owner_id=? AND id=?")
      .bind(auth.access.ownerId, productId)
      .first<Record<string, unknown>>();
    return json({ product: productFromRow(row!) });
  } catch (error) {
    console.error("reception product update failed", error);
    return json({ error: "Le produit reçu n’a pas pu être enregistré." }, 503);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; productId: string }> },
) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request))
    return json({ error: "Origine de la demande invalide." }, 403);
  const { id: receptionId, productId } = await params;
  if (!validUuid(receptionId) || !validUuid(productId))
    return json({ error: "Produit reçu introuvable." }, 404);
  try {
    const database = db(),
      current = await context(auth.access.ownerId, receptionId, productId);
    if (!current.reception || !current.product)
      return json({ error: "Produit reçu introuvable." }, 404);
    if (String(current.reception.status) !== "in_progress")
      return json(
        {
          error:
            "Un produit d’une réception validée ne peut pas être supprimé. Corrigez-le : la modification restera tracée.",
        },
        409,
      );
    const product = productFromRow(current.product),
      now = new Date().toISOString();
    await database.batch([
      database
        .prepare(
          "UPDATE reception_products SET deleted_at=?,updated_at=?,updated_by_id=?,updated_by_name=?,revision=revision+1 WHERE owner_id=? AND reception_id=? AND id=? AND deleted_at IS NULL",
        )
        .bind(
          now,
          now,
          auth.access.userId,
          auth.access.displayName,
          auth.access.ownerId,
          receptionId,
          productId,
        ),
      audit(
        database,
        auth.access,
        receptionId,
        productId,
        "deleted",
        "product",
        product.productName,
        null,
        now,
      ),
    ]);
    return json({ deleted: true });
  } catch (error) {
    console.error("reception product delete failed", error);
    return json({ error: "Le produit reçu n’a pas pu être retiré." }, 503);
  }
}

import { authorize } from "@/lib/access";
import type { AuthorizedAccess } from "@/lib/access";
import {
  auditFromRow,
  finalReceptionStatus,
  photoFromRow,
  productFromRow,
  receptionFromRow,
  validateReceptionHeader,
  validationErrors,
} from "@/lib/receptions";
import { db, json, sameOrigin } from "@/lib/server";
import { validUuid } from "@/lib/supply";

export const dynamic = "force-dynamic";

const headerColumns: Record<string, string> = {
  supplierId: "supplier_id",
  supplierName: "supplier_name",
  deliveryNote: "delivery_note",
  orderNumber: "order_number",
  driverName: "driver_name",
  generalNotes: "general_notes",
};

function auditValue(value: unknown) {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : JSON.stringify(value);
}

function auditStatement(
  database: ReturnType<typeof db>,
  auth: { access: AuthorizedAccess },
  receptionId: string,
  entityType: string,
  entityId: string,
  action: string,
  fieldName: string,
  oldValue: unknown,
  newValue: unknown,
  now: string,
) {
  return database
    .prepare(
      `INSERT INTO reception_audit_events(id,owner_id,reception_id,entity_type,entity_id,action,field_name,old_value,new_value,changed_at,changed_by_id,changed_by_name)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      crypto.randomUUID(),
      auth.access.ownerId,
      receptionId,
      entityType,
      entityId,
      action,
      fieldName,
      auditValue(oldValue),
      auditValue(newValue),
      now,
      auth.access.userId,
      auth.access.displayName,
    );
}

async function getReception(ownerId: string, id: string) {
  return db()
    .prepare("SELECT * FROM receptions WHERE owner_id=? AND id=?")
    .bind(ownerId, id)
    .first<Record<string, unknown>>();
}

function parisLocal(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  if (!validUuid(id)) return json({ error: "Réception introuvable." }, 404);
  try {
    const database = db(),
      row = await getReception(auth.access.ownerId, id);
    if (!row) return json({ error: "Réception introuvable." }, 404);
    const [productRows, photoRows, auditRows] = await Promise.all([
      database
        .prepare(
          "SELECT * FROM reception_products WHERE owner_id=? AND reception_id=? AND deleted_at IS NULL ORDER BY created_at",
        )
        .bind(auth.access.ownerId, id)
        .all(),
      database
        .prepare(
          "SELECT * FROM reception_photos WHERE owner_id=? AND reception_id=? AND deleted_at IS NULL ORDER BY created_at",
        )
        .bind(auth.access.ownerId, id)
        .all(),
      database
        .prepare(
          "SELECT * FROM reception_audit_events WHERE owner_id=? AND reception_id=? ORDER BY changed_at DESC LIMIT 500",
        )
        .bind(auth.access.ownerId, id)
        .all(),
    ]);
    return json({
      reception: receptionFromRow(row),
      products: productRows.results.map((item) =>
        productFromRow(item as Record<string, unknown>),
      ),
      photos: photoRows.results.map((item) =>
        photoFromRow(item as Record<string, unknown>),
      ),
      audits: auditRows.results.map((item) =>
        auditFromRow(item as Record<string, unknown>),
      ),
    });
  } catch (error) {
    console.error("reception detail failed", error);
    return json({ error: "La réception ne peut pas être chargée." }, 503);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await authorize();
  if ("response" in authResult) return authResult.response;
  if (!sameOrigin(request))
    return json({ error: "Origine de la demande invalide." }, 403);
  const { id } = await params;
  if (!validUuid(id)) return json({ error: "Réception introuvable." }, 404);
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Données invalides." }, 400);
  }
  const action = String(payload.action ?? "update_header"),
    database = db(),
    { ownerId, userId, displayName } = authResult.access;
  try {
    const oldRow = await getReception(ownerId, id);
    if (!oldRow) return json({ error: "Réception introuvable." }, 404);
    const old = receptionFromRow(oldRow),
      now = new Date().toISOString();
    if (old.status !== "in_progress" && authResult.access.role === "contributor")
      return json(
        {
          error:
            "Seul le responsable peut corriger une réception déjà validée.",
        },
        403,
      );

    if (action === "update_header") {
      const checked = validateReceptionHeader(payload);
      if ("error" in checked) return json({ error: checked.error }, 400);
      const revision = Number(payload.revision ?? 0);
      if (revision !== old.revision)
        return json(
          {
            error:
              "Cette réception a été modifiée sur un autre appareil. Rechargez-la.",
          },
          409,
        );
      const changes = Object.entries(checked.value).filter(
        ([key, value]) =>
          auditValue(old[key as keyof typeof old]) !== auditValue(value),
      );
      const update = database
        .prepare(
          `UPDATE receptions SET supplier_id=?,supplier_name=?,delivery_note=?,order_number=?,driver_name=?,general_notes=?,revision=revision+1,updated_at=?,updated_by_id=?,updated_by_name=? WHERE owner_id=? AND id=? AND revision=?`,
        )
        .bind(
          checked.value.supplierId,
          checked.value.supplierName,
          checked.value.deliveryNote,
          checked.value.orderNumber,
          checked.value.driverName,
          checked.value.generalNotes,
          now,
          userId,
          displayName,
          ownerId,
          id,
          revision,
        );
      const audits = changes.map(([key, value]) =>
        auditStatement(
          database,
          authResult,
          id,
          "reception",
          id,
          "updated",
          headerColumns[key] ?? key,
          old[key as keyof typeof old],
          value,
          now,
        ),
      );
      const [result] = await database.batch([update, ...audits]);
      if (!result.meta.changes)
        return json({ error: "La réception a changé. Rechargez-la." }, 409);
    } else if (action === "signature") {
      const driverCompany = String(payload.driverCompany ?? "")
          .trim()
          .slice(0, 120),
        driverInitials = String(payload.driverInitials ?? "")
          .trim()
          .slice(0, 20),
        driverRefusedSign = Boolean(payload.driverRefusedSign),
        driverRefusalComment = String(payload.driverRefusalComment ?? "")
          .trim()
          .slice(0, 1000),
        signature = driverRefusedSign
          ? null
          : typeof payload.driverSignature === "string" &&
              payload.driverSignature.startsWith("data:image/png;base64,") &&
              payload.driverSignature.length < 260000
            ? payload.driverSignature
            : null;
      if (
        driverRefusedSign &&
        !driverRefusalComment &&
        old.status !== "in_progress"
      )
        return json(
          { error: "Ajoutez un commentaire sur le refus de signature." },
          400,
        );
      if (!driverRefusedSign && signature && !driverInitials)
        return json({ error: "Ajoutez les initiales du livreur." }, 400);
      const signedAt = signature || driverRefusedSign ? now : null;
      const update = database
        .prepare(
          `UPDATE receptions SET driver_company=?,driver_initials=?,driver_signature=?,driver_signed_at=?,driver_refused_sign=?,driver_refusal_comment=?,driver_recorded_by_id=?,driver_recorded_by_name=?,revision=revision+1,updated_at=?,updated_by_id=?,updated_by_name=? WHERE owner_id=? AND id=?`,
        )
        .bind(
          driverCompany,
          driverInitials,
          signature,
          signedAt,
          Number(driverRefusedSign),
          driverRefusalComment,
          userId,
          displayName,
          now,
          userId,
          displayName,
          ownerId,
          id,
        );
      const audit = auditStatement(
        database,
        authResult,
        id,
        "signature",
        id,
        "signed",
        driverRefusedSign ? "driver_refused_sign" : "driver_signature",
        old.driverRefusedSign
          ? "refus"
          : old.driverSignature
            ? "signature enregistrée"
            : null,
        driverRefusedSign
          ? "refus"
          : signature
            ? "signature enregistrée"
            : "effacée",
        now,
      );
      await database.batch([update, audit]);
    } else if (action === "validate") {
      const headerCheck = validateReceptionHeader(
        old as unknown as Record<string, unknown>,
      );
      if ("error" in headerCheck)
        return json({ error: headerCheck.error }, 400);
      const productRows = await database
        .prepare(
          "SELECT * FROM reception_products WHERE owner_id=? AND reception_id=? AND deleted_at IS NULL ORDER BY created_at",
        )
        .bind(ownerId, id)
        .all();
      const products = productRows.results.map((item) =>
          productFromRow(item as Record<string, unknown>),
        ),
        errors = validationErrors(products);
      if (errors.length) return json({ error: errors[0], errors }, 400);
      const status = finalReceptionStatus(products),
        pin = String(payload.pin ?? "").trim();
      if (pin && !/^\d{4,8}$/.test(pin))
        return json({ error: "Le PIN doit contenir 4 à 8 chiffres." }, 400);
      const validationPinHash = pin
        ? Array.from(
            new Uint8Array(
              await crypto.subtle.digest(
                "SHA-256",
                new TextEncoder().encode(`${ownerId}:${id}:${pin}`),
              ),
            ),
          )
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("")
        : null;
      const device = String(
          payload.device ?? request.headers.get("user-agent") ?? "",
        ).slice(0, 500),
        statements = [];
      statements.push(
        database
          .prepare(
            `UPDATE receptions SET status=?,validation_pin_hash=?,pin_used=?,validated_at=?,validated_by_id=?,validated_by_name=?,validation_device=?,revision=revision+1,updated_at=?,updated_by_id=?,updated_by_name=? WHERE owner_id=? AND id=?`,
          )
          .bind(
            status,
            validationPinHash,
            Number(Boolean(pin)),
            now,
            userId,
            displayName,
            device,
            now,
            userId,
            displayName,
            ownerId,
            id,
          ),
      );
      statements.push(
        auditStatement(
          database,
          authResult,
          id,
          "validation",
          id,
          "validated",
          "status",
          old.status,
          status,
          now,
        ),
      );
      if (old.supplierId) {
        for (const product of products) {
          let lot = await database
            .prepare(
              "SELECT id FROM supplier_lots WHERE owner_id=? AND supplier_id=? AND ingredient_name=? AND supplier_lot=? AND deleted_at IS NULL LIMIT 1",
            )
            .bind(
              ownerId,
              old.supplierId,
              product.productName,
              product.supplierLot,
            )
            .first<{ id: string }>();
          if (!lot) {
            const lotId = crypto.randomUUID();
            lot = { id: lotId };
            statements.push(
              database
                .prepare(
                  `INSERT INTO supplier_lots(id,owner_id,supplier_id,ingredient_name,supplier_lot,received_at,supplier_deadline,quantity,storage_mode,storage_temperature,document_ref,notes,revision,created_at)
              VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1,?)`,
                )
                .bind(
                  lotId,
                  ownerId,
                  old.supplierId,
                  product.productName,
                  product.supplierLot,
                  parisLocal(now),
                  product.deadlineDate,
                  `${product.quantity} ${product.unit}`.trim(),
                  product.temperatureRegime,
                  product.storageTemperature,
                  old.deliveryNote,
                  `Créé depuis ${old.receptionCode}`,
                  now,
                ),
            );
          }
          statements.push(
            database
              .prepare(
                "UPDATE reception_products SET supplier_lot_id=?,updated_at=?,updated_by_id=?,updated_by_name=?,revision=revision+1 WHERE owner_id=? AND id=?",
              )
              .bind(lot.id, now, userId, displayName, ownerId, product.id),
          );
        }
      }
      await database.batch(statements);
    } else return json({ error: "Action inconnue." }, 400);

    const row = await getReception(ownerId, id);
    return json({ reception: receptionFromRow(row!) });
  } catch (error) {
    console.error("reception update failed", error);
    return json({ error: "La réception n’a pas pu être enregistrée." }, 503);
  }
}

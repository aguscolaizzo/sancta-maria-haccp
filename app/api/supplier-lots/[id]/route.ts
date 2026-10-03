import { authorize } from "@/lib/access";
import { db, json, sameOrigin } from "@/lib/server";
import {
  supplierLotFromRow,
  validUuid,
  validateSupplierLotPayload,
} from "@/lib/supply";

type Context = { params: Promise<{ id: string }> };
const selectLot =
  "SELECT l.*,s.name AS supplier_name FROM supplier_lots l JOIN suppliers s ON s.owner_id=l.owner_id AND s.id=l.supplier_id";

export async function PUT(request: Request, { params }: Context) {
  const auth = await authorize("admin");
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request))
    return json({ error: "Origine de la demande invalide." }, 403);
  const { id } = await params;
  if (!validUuid(id))
    return json({ error: "Lot fournisseur introuvable." }, 404);
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Données invalides." }, 400);
  }
  const revision = Number(payload.revision),
    checked = validateSupplierLotPayload(payload);
  if (!Number.isInteger(revision) || revision < 1)
    return json({ error: "Rechargez le lot avant de le modifier." }, 409);
  if ("error" in checked) return json({ error: checked.error }, 400);
  const v = checked.value,
    ownerId = auth.access.ownerId;
  const result = await db()
    .prepare(
      `UPDATE supplier_lots SET supplier_id=?,ingredient_name=?,supplier_lot=?,received_at=?,supplier_deadline=?,quantity=?,storage_mode=?,storage_temperature=?,document_ref=?,notes=?,revision=revision+1,updated_at=?
    WHERE owner_id=? AND id=? AND revision=? AND deleted_at IS NULL AND EXISTS(SELECT 1 FROM suppliers WHERE owner_id=? AND id=? AND deleted_at IS NULL)`,
    )
    .bind(
      v.supplierId,
      v.ingredientName,
      v.supplierLot,
      v.receivedAt,
      v.supplierDeadline,
      v.quantity,
      v.storageMode,
      v.storageTemperature,
      v.documentRef,
      v.notes,
      new Date().toISOString(),
      ownerId,
      id,
      revision,
      ownerId,
      v.supplierId,
    )
    .run();
  if (!result.meta.changes)
    return json(
      {
        error:
          "Ce lot a déjà été modifié, supprimé ou son fournisseur n’existe plus.",
      },
      409,
    );
  const row = await db()
    .prepare(
      `${selectLot} WHERE l.owner_id=? AND l.id=? AND l.deleted_at IS NULL`,
    )
    .bind(ownerId, id)
    .first<Record<string, unknown>>();
  return json({ lot: supplierLotFromRow(row!) });
}

export async function DELETE(request: Request, { params }: Context) {
  const auth = await authorize("admin");
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request))
    return json({ error: "Origine de la demande invalide." }, 403);
  const { id } = await params;
  if (!validUuid(id))
    return json({ error: "Lot fournisseur introuvable." }, 404);
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Données invalides." }, 400);
  }
  const revision = Number(payload.revision),
    ownerId = auth.access.ownerId;
  if (!Number.isInteger(revision) || revision < 1)
    return json({ error: "Rechargez le lot avant de le supprimer." }, 409);
  const linked = await db()
    .prepare(
      `SELECT p.id FROM preparation_source_lots x JOIN preparation_labels p ON p.owner_id=x.owner_id AND p.id=x.preparation_label_id
    WHERE x.owner_id=? AND x.supplier_lot_id=? AND p.deleted_at IS NULL LIMIT 1`,
    )
    .bind(ownerId, id)
    .first();
  if (linked)
    return json(
      {
        error:
          "Ce lot est lié à une fiche de traçabilité et ne peut pas être supprimé.",
      },
      409,
    );
  const now = new Date().toISOString();
  const result = await db()
    .prepare(
      "UPDATE supplier_lots SET revision=revision+1,deleted_at=?,updated_at=? WHERE owner_id=? AND id=? AND revision=? AND deleted_at IS NULL",
    )
    .bind(now, now, ownerId, id, revision)
    .run();
  return result.meta.changes
    ? json({ deleted: true, id })
    : json({ error: "Ce lot a déjà été modifié ou supprimé." }, 409);
}

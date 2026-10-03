import { authorize } from "@/lib/access";
import { db, json, sameOrigin } from "@/lib/server";
import { supplierLotFromRow, validateSupplierLotPayload } from "@/lib/supply";

export const dynamic = "force-dynamic";
const selectLots =
  "SELECT l.*,s.name AS supplier_name FROM supplier_lots l JOIN suppliers s ON s.owner_id=l.owner_id AND s.id=l.supplier_id";

export async function GET() {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  try {
    const rows = await db()
      .prepare(
        `${selectLots} WHERE l.owner_id=? AND l.deleted_at IS NULL AND s.deleted_at IS NULL ORDER BY l.received_at DESC LIMIT 500`,
      )
      .bind(auth.access.ownerId)
      .all();
    return json({
      lots: rows.results.map((row) =>
        supplierLotFromRow(row as Record<string, unknown>),
      ),
    });
  } catch {
    return json(
      { error: "Les lots fournisseurs ne peuvent pas être chargés." },
      503,
    );
  }
}

export async function POST(request: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request))
    return json({ error: "Origine de la demande invalide." }, 403);
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Données invalides." }, 400);
  }
  const checked = validateSupplierLotPayload(payload);
  if ("error" in checked) return json({ error: checked.error }, 400);
  const v = checked.value,
    id = crypto.randomUUID(),
    now = new Date().toISOString();
  const { ownerId, userId, memberRevision } = auth.access;
  try {
    const result = await db()
      .prepare(
        `INSERT INTO supplier_lots(id,owner_id,supplier_id,ingredient_name,supplier_lot,received_at,supplier_deadline,quantity,storage_mode,storage_temperature,document_ref,notes,revision,created_at)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,?,1,? WHERE EXISTS(SELECT 1 FROM suppliers WHERE owner_id=? AND id=? AND deleted_at IS NULL)
      AND (?=? OR EXISTS(SELECT 1 FROM register_members WHERE owner_id=? AND user_id=? AND status='active' AND revision=?))`,
      )
      .bind(
        id,
        ownerId,
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
        now,
        ownerId,
        v.supplierId,
        userId,
        ownerId,
        ownerId,
        userId,
        memberRevision,
      )
      .run();
    if (!result.meta.changes)
      return json(
        { error: "Le fournisseur n’existe plus ou votre accès a changé." },
        409,
      );
    const row = await db()
      .prepare(
        `${selectLots} WHERE l.owner_id=? AND l.id=? AND l.deleted_at IS NULL`,
      )
      .bind(ownerId, id)
      .first<Record<string, unknown>>();
    return json({ lot: supplierLotFromRow(row!) }, 201);
  } catch {
    return json(
      { error: "Le lot fournisseur n’a pas pu être enregistré." },
      503,
    );
  }
}

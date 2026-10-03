import { authorize } from "@/lib/access";
import { db, json } from "@/lib/server";
import { validUuid } from "@/lib/supply";
import type { SourceLotTrace } from "@/lib/quick-labels";

export const dynamic = "force-dynamic";

function sourceLotFromRow(row: Record<string, unknown>): SourceLotTrace {
  const nullable = (value: unknown) =>
    value === null || value === undefined || value === "" ? null : String(value);
  return {
    id: String(row.id),
    supplierId: String(row.supplier_id),
    supplierName: String(row.supplier_name),
    ingredientName: String(row.ingredient_name),
    supplierLot: String(row.supplier_lot),
    receivedAt: String(row.received_at),
    supplierDeadline: nullable(row.supplier_deadline),
    quantity: String(row.quantity ?? ""),
    storageMode: String(row.storage_mode),
    documentRef: String(row.document_ref ?? ""),
    receptionId: nullable(row.reception_id),
    receptionCode: nullable(row.reception_code),
    deliveryNote: nullable(row.delivery_note),
  };
}

export async function GET(request: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const ingredientId = new URL(request.url).searchParams.get("ingredientId") ?? "";
  if (ingredientId && !validUuid(ingredientId))
    return json({ error: "Ingrédient invalide." }, 400);
  const ingredient = ingredientId
    ? await db()
        .prepare(
          "SELECT display_name FROM ingredient_catalog WHERE owner_id=? AND id=? AND deleted_at IS NULL",
        )
        .bind(auth.access.ownerId, ingredientId)
        .first<{ display_name: string }>()
    : null;
  if (ingredientId && !ingredient)
    return json({ error: "Ingrédient introuvable." }, 404);
  try {
    const rows = await db()
      .prepare(
        `SELECT DISTINCT sl.*,s.name AS supplier_name,rp.reception_id,r.reception_code,r.delivery_note
         FROM supplier_lots sl
         JOIN suppliers s ON s.owner_id=sl.owner_id AND s.id=sl.supplier_id AND s.deleted_at IS NULL
         LEFT JOIN reception_products rp ON rp.owner_id=sl.owner_id AND rp.supplier_lot_id=sl.id AND rp.deleted_at IS NULL
         LEFT JOIN receptions r ON r.owner_id=sl.owner_id AND r.id=rp.reception_id
         WHERE sl.owner_id=? AND sl.deleted_at IS NULL
         ORDER BY CASE WHEN lower(sl.ingredient_name)=lower(?) THEN 0 WHEN lower(sl.ingredient_name) LIKE lower(?) THEN 1 ELSE 2 END,
                  sl.received_at DESC LIMIT 200`,
      )
      .bind(
        auth.access.ownerId,
        ingredient?.display_name ?? "",
        `%${ingredient?.display_name ?? ""}%`,
      )
      .all<Record<string, unknown>>();
    const lots = rows.results.map(sourceLotFromRow);
    return json({
      lots: [...new Map(lots.map((lot) => [lot.id, lot])).values()],
    });
  } catch (error) {
    console.error("source lots load failed", error);
    return json({ error: "Les lots d’origine ne peuvent pas être chargés." }, 503);
  }
}

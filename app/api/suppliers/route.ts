import { authorize } from "@/lib/access";
import { db, json, sameOrigin } from "@/lib/server";
import { supplierFromRow, validateSupplierPayload } from "@/lib/supply";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  try {
    const rows = await db()
      .prepare(
        "SELECT * FROM suppliers WHERE owner_id=? AND deleted_at IS NULL ORDER BY name COLLATE NOCASE",
      )
      .bind(auth.access.ownerId)
      .all();
    return json({
      suppliers: rows.results.map((row) =>
        supplierFromRow(row as Record<string, unknown>),
      ),
    });
  } catch {
    return json(
      { error: "Les fournisseurs ne peuvent pas être chargés." },
      503,
    );
  }
}

export async function POST(request: Request) {
  const auth = await authorize("admin");
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request))
    return json({ error: "Origine de la demande invalide." }, 403);
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Données invalides." }, 400);
  }
  const checked = validateSupplierPayload(payload);
  if ("error" in checked) return json({ error: checked.error }, 400);
  const id = crypto.randomUUID(),
    now = new Date().toISOString(),
    v = checked.value;
  try {
    await db()
      .prepare(
        "INSERT INTO suppliers(id,owner_id,name,contact_name,phone,email,notes,revision,created_at) VALUES(?,?,?,?,?,?,?,1,?)",
      )
      .bind(
        id,
        auth.access.ownerId,
        v.name,
        v.contactName,
        v.phone,
        v.email,
        v.notes,
        now,
      )
      .run();
    const row = await db()
      .prepare(
        "SELECT * FROM suppliers WHERE owner_id=? AND id=? AND deleted_at IS NULL",
      )
      .bind(auth.access.ownerId, id)
      .first<Record<string, unknown>>();
    return json({ supplier: supplierFromRow(row!) }, 201);
  } catch {
    return json({ error: "Le fournisseur n’a pas pu être enregistré." }, 503);
  }
}

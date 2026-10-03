import { authorize } from "@/lib/access";
import { db, json, sameOrigin } from "@/lib/server";
import {
  supplierFromRow,
  validUuid,
  validateSupplierPayload,
} from "@/lib/supply";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  const auth = await authorize("admin");
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request))
    return json({ error: "Origine de la demande invalide." }, 403);
  const { id } = await params;
  if (!validUuid(id)) return json({ error: "Fournisseur introuvable." }, 404);
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Données invalides." }, 400);
  }
  const revision = Number(payload.revision),
    checked = validateSupplierPayload(payload);
  if (!Number.isInteger(revision) || revision < 1)
    return json(
      { error: "Rechargez le fournisseur avant de le modifier." },
      409,
    );
  if ("error" in checked) return json({ error: checked.error }, 400);
  const v = checked.value,
    now = new Date().toISOString(),
    ownerId = auth.access.ownerId;
  try {
    const result = await db()
      .prepare(
        "UPDATE suppliers SET name=?,contact_name=?,phone=?,email=?,notes=?,revision=revision+1,updated_at=? WHERE owner_id=? AND id=? AND revision=? AND deleted_at IS NULL",
      )
      .bind(
        v.name,
        v.contactName,
        v.phone,
        v.email,
        v.notes,
        now,
        ownerId,
        id,
        revision,
      )
      .run();
    if (!result.meta.changes)
      return json(
        { error: "Ce fournisseur a déjà été modifié ou supprimé." },
        409,
      );
    const row = await db()
      .prepare(
        "SELECT * FROM suppliers WHERE owner_id=? AND id=? AND deleted_at IS NULL",
      )
      .bind(ownerId, id)
      .first<Record<string, unknown>>();
    return json({ supplier: supplierFromRow(row!) });
  } catch {
    return json({ error: "Le fournisseur n’a pas pu être modifié." }, 503);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const auth = await authorize("admin");
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request))
    return json({ error: "Origine de la demande invalide." }, 403);
  const { id } = await params;
  if (!validUuid(id)) return json({ error: "Fournisseur introuvable." }, 404);
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Données invalides." }, 400);
  }
  const revision = Number(payload.revision),
    ownerId = auth.access.ownerId;
  if (!Number.isInteger(revision) || revision < 1)
    return json(
      { error: "Rechargez le fournisseur avant de le supprimer." },
      409,
    );
  const linked = await db()
    .prepare(
      "SELECT id FROM supplier_lots WHERE owner_id=? AND supplier_id=? AND deleted_at IS NULL LIMIT 1",
    )
    .bind(ownerId, id)
    .first();
  if (linked)
    return json(
      {
        error:
          "Ce fournisseur possède encore des lots actifs. Supprimez d’abord ces lots.",
      },
      409,
    );
  const result = await db()
    .prepare(
      "UPDATE suppliers SET revision=revision+1,deleted_at=?,updated_at=? WHERE owner_id=? AND id=? AND revision=? AND deleted_at IS NULL",
    )
    .bind(
      new Date().toISOString(),
      new Date().toISOString(),
      ownerId,
      id,
      revision,
    )
    .run();
  return result.meta.changes
    ? json({ deleted: true, id })
    : json({ error: "Ce fournisseur a déjà été modifié ou supprimé." }, 409);
}

import { authorize } from "@/lib/access";
import { photoFromRow, type PhotoKind } from "@/lib/receptions";
import { db, json, sameOrigin } from "@/lib/server";
import { validUuid } from "@/lib/supply";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request))
    return json({ error: "Origine de la demande invalide." }, 403);
  if (Number(request.headers.get("content-length") ?? 0) > 1_100_000)
    return json(
      {
        error:
          "Photo trop volumineuse. Reprenez-la avec une résolution plus faible.",
      },
      413,
    );
  const { id: receptionId } = await params;
  if (!validUuid(receptionId))
    return json({ error: "Réception introuvable." }, 404);
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Données invalides." }, 400);
  }
  const kind = String(payload.kind ?? "other") as PhotoKind,
    productId = payload.productId ? String(payload.productId) : null,
    dataUrl = String(payload.dataUrl ?? ""),
    caption = String(payload.caption ?? "")
      .trim()
      .slice(0, 300);
  if (
    !["delivery_note", "product", "thermometer", "label", "other"].includes(
      kind,
    )
  )
    return json({ error: "Type de photo invalide." }, 400);
  if (productId && !validUuid(productId))
    return json({ error: "Produit lié invalide." }, 400);
  const match = dataUrl.match(
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/,
  );
  if (!match || dataUrl.length > 1_000_000)
    return json({ error: "Photo invalide ou trop volumineuse." }, 400);
  const database = db(),
    { ownerId, userId, displayName } = auth.access;
  try {
    const reception = await database
      .prepare("SELECT id FROM receptions WHERE owner_id=? AND id=?")
      .bind(ownerId, receptionId)
      .first();
    if (!reception) return json({ error: "Réception introuvable." }, 404);
    if (productId) {
      const product = await database
        .prepare(
          "SELECT id FROM reception_products WHERE owner_id=? AND reception_id=? AND id=? AND deleted_at IS NULL",
        )
        .bind(ownerId, receptionId, productId)
        .first();
      if (!product) return json({ error: "Produit lié introuvable." }, 404);
    }
    const count = await database
      .prepare(
        "SELECT count(*) AS count FROM reception_photos WHERE owner_id=? AND reception_id=? AND deleted_at IS NULL",
      )
      .bind(ownerId, receptionId)
      .first<{ count: number }>();
    if (Number(count?.count ?? 0) >= 12)
      return json(
        {
          error:
            "Cette réception contient déjà 12 photos, le maximum autorisé.",
        },
        409,
      );
    const id = crypto.randomUUID(),
      now = new Date().toISOString();
    await database.batch([
      database
        .prepare(
          "INSERT INTO reception_photos(id,owner_id,reception_id,product_id,kind,mime_type,data_url,caption,created_at,created_by_id,created_by_name) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          ownerId,
          receptionId,
          productId,
          kind,
          match[1],
          dataUrl,
          caption,
          now,
          userId,
          displayName,
        ),
      database
        .prepare(
          `INSERT INTO reception_audit_events(id,owner_id,reception_id,entity_type,entity_id,action,field_name,old_value,new_value,changed_at,changed_by_id,changed_by_name)
        VALUES(?,?,?,'photo',?,'created','kind',NULL,?,?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          ownerId,
          receptionId,
          id,
          kind,
          now,
          userId,
          displayName,
        ),
    ]);
    const row = await database
      .prepare("SELECT * FROM reception_photos WHERE owner_id=? AND id=?")
      .bind(ownerId, id)
      .first<Record<string, unknown>>();
    return json({ photo: photoFromRow(row!) }, 201);
  } catch (error) {
    console.error("reception photo failed", error);
    return json({ error: "La photo n’a pas pu être enregistrée." }, 503);
  }
}

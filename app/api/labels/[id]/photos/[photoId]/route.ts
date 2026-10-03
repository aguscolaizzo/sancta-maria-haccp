import { authorize } from "@/lib/access";
import { db, media } from "@/lib/server";
import { validUuid } from "@/lib/supply";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const { id: labelId, photoId } = await params;
  if (!validUuid(labelId) || !validUuid(photoId))
    return new Response("Photo introuvable.", { status: 404 });
  try {
    const row = await db()
      .prepare(
        `SELECT p.object_key,p.mime_type,p.byte_size
         FROM preparation_label_photos p
         JOIN preparation_labels l ON l.owner_id=p.owner_id AND l.id=p.preparation_label_id
         WHERE p.owner_id=? AND p.preparation_label_id=? AND p.id=?
           AND p.deleted_at IS NULL AND l.deleted_at IS NULL`,
      )
      .bind(auth.access.ownerId, labelId, photoId)
      .first<{ object_key: string; mime_type: string; byte_size: number }>();
    if (!row) return new Response("Photo introuvable.", { status: 404 });
    const object = await media().get(row.object_key);
    if (!object) return new Response("Photo introuvable.", { status: 404 });
    return new Response(object.body, {
      headers: {
        "Content-Type": row.mime_type,
        "Content-Length": String(row.byte_size),
        "Content-Disposition": 'inline; filename="preuve-fournisseur"',
        "Cache-Control": "private, max-age=300",
        Vary: "Cookie",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("label photo download failed", error);
    return new Response("Photo indisponible.", { status: 503 });
  }
}

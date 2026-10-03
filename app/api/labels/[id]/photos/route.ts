import { env } from "cloudflare:workers";
import { authorize } from "@/lib/access";
import { labelEvidencePhotoFromRow } from "@/lib/label-photos";
import { db, json, media, sameOrigin } from "@/lib/server";
import { validUuid } from "@/lib/supply";

export const dynamic = "force-dynamic";
const MAX_PHOTO_BYTES = 1_500_000;
const PHOTO_LIMIT = 6;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const hex = (value: ArrayBuffer) =>
  [...new Uint8Array(value)].map((part) => part.toString(16).padStart(2, "0")).join("");

async function ownedLabel(ownerId: string, labelId: string) {
  return db()
    .prepare(
      "SELECT id FROM preparation_labels WHERE owner_id=? AND id=? AND deleted_at IS NULL",
    )
    .bind(ownerId, labelId)
    .first();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const { id: labelId } = await params;
  if (!validUuid(labelId)) return json({ error: "Fiche introuvable." }, 404);
  try {
    if (!(await ownedLabel(auth.access.ownerId, labelId)))
      return json({ error: "Fiche introuvable." }, 404);
    const rows = await db()
      .prepare(
        "SELECT * FROM preparation_label_photos WHERE owner_id=? AND preparation_label_id=? AND deleted_at IS NULL ORDER BY created_at ASC",
      )
      .bind(auth.access.ownerId, labelId)
      .all<Record<string, unknown>>();
    return json({ photos: rows.results.map(labelEvidencePhotoFromRow) });
  } catch (error) {
    console.error("label photo list failed", error);
    return json({ error: "Les photos ne peuvent pas être chargées." }, 503);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request))
    return json({ error: "Origine de la demande invalide." }, 403);
  const statedSize = Number(request.headers.get("content-length") ?? 0);
  if (statedSize > MAX_PHOTO_BYTES + 100_000)
    return json({ error: "Photo trop volumineuse." }, 413);
  const { id: labelId } = await params;
  if (!validUuid(labelId)) return json({ error: "Fiche introuvable." }, 404);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Photo invalide." }, 400);
  }
  const file = form.get("photo");
  if (!(file instanceof File) || !allowedTypes.has(file.type))
    return json({ error: "Choisissez une photo JPG, PNG ou WebP." }, 400);
  if (!file.size || file.size > MAX_PHOTO_BYTES)
    return json({ error: "La photo compressée doit faire moins de 1,5 Mo." }, 413);
  const caption = String(form.get("caption") ?? "")
    .trim()
    .slice(0, 300);
  const { ownerId, userId, displayName } = auth.access;
  const database = db();
  try {
    if (!(await ownedLabel(ownerId, labelId)))
      return json({ error: "Fiche introuvable." }, 404);
    const count = await database
      .prepare(
        "SELECT count(*) AS count FROM preparation_label_photos WHERE owner_id=? AND preparation_label_id=? AND deleted_at IS NULL",
      )
      .bind(ownerId, labelId)
      .first<{ count: number }>();
    if (Number(count?.count ?? 0) >= PHOTO_LIMIT)
      return json(
        { error: `Cette fiche contient déjà ${PHOTO_LIMIT} photos, le maximum autorisé.` },
        409,
      );
    const bytes = await file.arrayBuffer();
    const digest = hex(await crypto.subtle.digest("SHA-256", bytes));
    const id = crypto.randomUUID();
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const objectKey = `preparation-evidence/${ownerId}/${labelId}/${id}.${extension}`;
    const now = new Date().toISOString();
    await media().put(objectKey, bytes, {
      httpMetadata: { contentType: file.type },
      customMetadata: { labelId, photoId: id, sha256: digest },
    });
    try {
      await database.batch([
        database
          .prepare(
            "INSERT INTO preparation_label_photos(id,owner_id,preparation_label_id,purpose,object_key,mime_type,byte_size,content_sha256,original_name,caption,created_at,created_by_id,created_by_name) VALUES(?,?,?,'supplier_evidence',?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            id,
            ownerId,
            labelId,
            objectKey,
            file.type,
            file.size,
            digest,
            file.name.slice(0, 160),
            caption,
            now,
            userId,
            displayName,
          ),
        database
          .prepare(
            "INSERT INTO traceability_audit_events(id,owner_id,entity_type,entity_id,action,field_name,old_value,new_value,reason,changed_at,changed_by_id,changed_by_name) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            crypto.randomUUID(),
            ownerId,
            "preparation_label",
            labelId,
            "photo_attached",
            "supplier_evidence_photo",
            null,
            id,
            caption || "Photo de l’étiquette du produit d’origine ajoutée.",
            now,
            userId,
            displayName,
          ),
      ]);
    } catch (error) {
      await env.MEDIA?.delete(objectKey).catch(() => undefined);
      throw error;
    }
    const row = await database
      .prepare("SELECT * FROM preparation_label_photos WHERE owner_id=? AND id=?")
      .bind(ownerId, id)
      .first<Record<string, unknown>>();
    return json({ photo: labelEvidencePhotoFromRow(row!) }, 201);
  } catch (error) {
    console.error("label photo upload failed", error);
    return json(
      { error: "La fiche est enregistrée, mais la photo n’a pas pu être archivée. Réessayez." },
      503,
    );
  }
}

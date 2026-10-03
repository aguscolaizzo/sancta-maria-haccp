import { authorize } from "@/lib/access";
import { db, json, sameOrigin } from "@/lib/server";
import { printEventFromRow, validUuid } from "@/lib/supply";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request))
    return json({ error: "Origine de la demande invalide." }, 403);
  const { id: preparationLabelId } = await params;
  if (!validUuid(preparationLabelId))
    return json({ error: "Fiche introuvable." }, 404);
  let payload: Record<string, unknown> = {};
  try {
    payload = await request.json();
  } catch {}
  const copies = Number(payload.copies ?? 1);
  if (!Number.isInteger(copies) || copies < 1 || copies > 50)
    return json({ error: "Nombre de copies invalide." }, 400);
  const id = crypto.randomUUID(),
    printedAt = new Date().toISOString(),
    { ownerId, userId, displayName, memberRevision } = auth.access;
  const result = await db()
    .prepare(
      `INSERT INTO label_print_events(id,owner_id,preparation_label_id,printed_at,printer_model,transport,copies,created_by_id,created_by_name)
    SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM preparation_labels WHERE owner_id=? AND id=? AND deleted_at IS NULL)
    AND (?=? OR EXISTS(SELECT 1 FROM register_members WHERE owner_id=? AND user_id=? AND status='active' AND revision=?))`,
    )
    .bind(
      id,
      ownerId,
      preparationLabelId,
      printedAt,
      "SUPVAN T50M Pro",
      "web_serial_bluetooth",
      copies,
      userId,
      displayName,
      ownerId,
      preparationLabelId,
      userId,
      ownerId,
      ownerId,
      userId,
      memberRevision,
    )
    .run();
  if (!result.meta.changes)
    return json(
      { error: "La fiche n’existe plus ou votre accès a changé." },
      409,
    );
  const row = await db()
    .prepare("SELECT * FROM label_print_events WHERE owner_id=? AND id=?")
    .bind(ownerId, id)
    .first<Record<string, unknown>>();
  return json({ print: printEventFromRow(row!) }, 201);
}

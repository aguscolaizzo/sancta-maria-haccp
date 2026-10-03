import { authorize } from "@/lib/access";
import { printQueueSelect, queueFromRows } from "@/lib/print-jobs";
import { db, json } from "@/lib/server";
import { validUuid } from "@/lib/supply";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorize("admin");
  if ("response" in auth) return auth.response;
  const { id } = await params;
  if (!validUuid(id)) return json({ error: "File d’impression invalide." }, 400);
  try {
    const rows = await db()
      .prepare(
        `${printQueueSelect} WHERE j.owner_id=? AND j.id=? ORDER BY i.position`,
      )
      .bind(auth.access.ownerId, id)
      .all<Record<string, unknown>>();
    const queue = queueFromRows(rows.results);
    if (!queue) return json({ error: "File d’impression introuvable." }, 404);
    return json({ queue });
  } catch {
    return json({ error: "La file d’impression ne peut pas être chargée." }, 503);
  }
}

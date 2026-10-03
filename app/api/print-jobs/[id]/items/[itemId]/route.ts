import { authorize } from "@/lib/access";
import { normalizePrinterError } from "@/lib/quick-labels";
import { validatePrinterSettings } from "@/lib/print-jobs";
import { db, json, sameOrigin } from "@/lib/server";
import { validUuid } from "@/lib/supply";

export const dynamic = "force-dynamic";

async function updateJobStatus(ownerId: string, jobId: string) {
  const counts = await db()
    .prepare(
      `SELECT COUNT(*) AS total,
       SUM(CASE WHEN status='printed' THEN 1 ELSE 0 END) AS printed,
       SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
       SUM(CASE WHEN status='transmitting' THEN 1 ELSE 0 END) AS transmitting
       FROM print_job_items WHERE owner_id=? AND print_job_id=?`,
    )
    .bind(ownerId, jobId)
    .first<{ total: number; printed: number; failed: number; transmitting: number }>();
  const total = Number(counts?.total ?? 0),
    printed = Number(counts?.printed ?? 0),
    failed = Number(counts?.failed ?? 0),
    transmitting = Number(counts?.transmitting ?? 0);
  let status = "pending",
    completedAt: string | null = null;
  if (printed === total && total > 0) {
    status = "completed";
    completedAt = new Date().toISOString();
  } else if (printed + failed === total && failed > 0) {
    status = printed ? "partial" : "failed";
    completedAt = new Date().toISOString();
  } else if (transmitting || printed || failed) status = "printing";
  await db()
    .prepare("UPDATE print_jobs SET status=?,completed_at=? WHERE owner_id=? AND id=?")
    .bind(status, completedAt, ownerId, jobId)
    .run();
  return status;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const auth = await authorize("admin");
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request)) return json({ error: "Origine invalide." }, 403);
  const { id, itemId } = await params;
  if (!validUuid(id) || !validUuid(itemId))
    return json({ error: "Élément d’impression invalide." }, 400);
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Données invalides." }, 400);
  }
  const status = String(payload.status ?? ""),
    transmissionId = String(payload.transmissionId ?? "");
  if (!["transmitting", "printed", "failed"].includes(status))
    return json({ error: "État d’impression invalide." }, 400);
  if (!validUuid(transmissionId))
    return json({ error: "Identifiant de transmission invalide." }, 400);
  const current = await db()
    .prepare(
      `SELECT i.*,l.status AS label_status FROM print_job_items i
       JOIN physical_labels l ON l.owner_id=i.owner_id AND l.id=i.physical_label_id
       WHERE i.owner_id=? AND i.print_job_id=? AND i.id=?`,
    )
    .bind(auth.access.ownerId, id, itemId)
    .first<Record<string, unknown>>();
  if (!current) return json({ error: "Élément d’impression introuvable." }, 404);
  const now = new Date().toISOString(),
    database = db();
  if (status === "transmitting") {
    let settings;
    try {
      settings = validatePrinterSettings(payload.settings);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Réglages invalides." }, 400);
    }
    if (!["pending", "failed"].includes(String(current.status)))
      return json({ error: "Cette étiquette est déjà en cours ou imprimée." }, 409);
    const attempt = Number(current.attempt_count ?? 0) + 1;
    try {
      await database.batch([
        database
          .prepare(
            `UPDATE print_job_items SET status='transmitting',attempt_count=?,started_at=?,completed_at=NULL,error_code='',error_message='',settings_snapshot=?,transmission_id=? WHERE owner_id=? AND print_job_id=? AND id=? AND status IN ('pending','failed')`,
          )
          .bind(
            attempt,
            now,
            JSON.stringify(settings),
            transmissionId,
            auth.access.ownerId,
            id,
            itemId,
          ),
        database
          .prepare("UPDATE physical_labels SET status='printing',updated_at=? WHERE owner_id=? AND id=?")
          .bind(now, auth.access.ownerId, current.physical_label_id),
        database
          .prepare(
            `INSERT INTO label_print_attempts(id,owner_id,physical_label_id,print_job_id,print_job_item_id,transmission_id,attempt_number,outcome,started_at,settings_snapshot,created_by_id,created_by_name) VALUES(?,?,?,?,?,?,?,'started',?,?,?,?)`,
          )
          .bind(
            crypto.randomUUID(),
            auth.access.ownerId,
            current.physical_label_id,
            id,
            itemId,
            transmissionId,
            attempt,
            now,
            JSON.stringify(settings),
            auth.access.userId,
            auth.access.displayName,
          ),
      ]);
      await updateJobStatus(auth.access.ownerId, id);
      return json({ status: "transmitting", attempt });
    } catch (error) {
      console.error("print attempt start failed", error);
      return json({ error: "La transmission n’a pas pu être préparée." }, 503);
    }
  }
  if (String(current.status) !== "transmitting" || String(current.transmission_id) !== transmissionId)
    return json({ error: "Cette transmission n’est plus active." }, 409);
  const failed = status === "failed",
    errorMessage = failed ? normalizePrinterError(payload.errorMessage) : "",
    errorCode = failed ? String(payload.errorCode ?? "TRANSPORT_ERROR").slice(0, 80) : "";
  try {
    await database.batch([
      database
        .prepare(
          `UPDATE print_job_items SET status=?,completed_at=?,error_code=?,error_message=? WHERE owner_id=? AND print_job_id=? AND id=? AND status='transmitting' AND transmission_id=?`,
        )
        .bind(
          failed ? "failed" : "printed",
          now,
          errorCode,
          errorMessage,
          auth.access.ownerId,
          id,
          itemId,
          transmissionId,
        ),
      database
        .prepare("UPDATE physical_labels SET status=?,updated_at=? WHERE owner_id=? AND id=?")
        .bind(
          failed ? "print_error" : "printed",
          now,
          auth.access.ownerId,
          current.physical_label_id,
        ),
      database
        .prepare(
          `UPDATE label_print_attempts SET outcome=?,completed_at=?,error_code=?,error_message=? WHERE owner_id=? AND transmission_id=? AND outcome='started'`,
        )
        .bind(
          failed ? "failed" : "printed",
          now,
          errorCode,
          errorMessage,
          auth.access.ownerId,
          transmissionId,
        ),
    ]);
    const jobStatus = await updateJobStatus(auth.access.ownerId, id);
    return json({ status: failed ? "failed" : "printed", jobStatus });
  } catch (error) {
    console.error("print attempt completion failed", error);
    return json({ error: "Le résultat de l’impression n’a pas pu être enregistré." }, 503);
  }
}

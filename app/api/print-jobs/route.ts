import { authorize } from "@/lib/access";
import { db, json, sameOrigin } from "@/lib/server";
import { validUuid } from "@/lib/supply";
import { validatePrinterSettings } from "@/lib/print-jobs";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await authorize("admin");
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request)) return json({ error: "Origine invalide." }, 403);
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Données invalides." }, 400);
  }
  let labelIds = Array.isArray(payload.labelIds)
    ? [...new Set(payload.labelIds.map(String))]
    : [];
  if (!labelIds.length && payload.failedOnly === true) {
    const failed = await db()
      .prepare(
        `SELECT id FROM physical_labels WHERE owner_id=? AND status='print_error' ORDER BY updated_at DESC LIMIT 100`,
      )
      .bind(auth.access.ownerId)
      .all<{ id: string }>();
    labelIds = failed.results.map((row) => String(row.id));
  }
  if (!labelIds.length)
    return json({ error: "Aucune étiquette en erreur à réimprimer." }, 404);
  if (labelIds.length > 100 || !labelIds.every(validUuid))
    return json({ error: "Sélection d’étiquettes invalide." }, 400);
  let settings;
  try {
    settings = validatePrinterSettings(payload.settings);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Réglages invalides." }, 400);
  }
  const marks = labelIds.map(() => "?").join(",");
  const rows = await db()
    .prepare(
      `SELECT id FROM physical_labels WHERE owner_id=? AND id IN (${marks}) AND status NOT IN ('expired','discarded','consumed','transformed_frozen')`,
    )
    .bind(auth.access.ownerId, ...labelIds)
    .all<{ id: string }>();
  if (rows.results.length !== labelIds.length)
    return json({ error: "Une étiquette n’existe plus ou ne peut pas être réimprimée." }, 409);
  const jobId = crypto.randomUUID(),
    now = new Date().toISOString(),
    database = db(),
    statements = [
      database
        .prepare(
          `INSERT INTO print_jobs(id,owner_id,status,printer_model,transport,requested_at,requested_by_id,requested_by_name) VALUES(?,?,'pending','T50M Pro','web_serial_bluetooth',?,?,?)`,
        )
        .bind(jobId, auth.access.ownerId, now, auth.access.userId, auth.access.displayName),
      ...labelIds.map((labelId, position) =>
        database
          .prepare(
            `INSERT INTO print_job_items(id,owner_id,print_job_id,physical_label_id,position,status,attempt_count,settings_snapshot) VALUES(?,?,?,?,?,'pending',0,?)`,
          )
          .bind(
            crypto.randomUUID(),
            auth.access.ownerId,
            jobId,
            labelId,
            position + 1,
            JSON.stringify(settings),
          ),
      ),
    ];
  try {
    await database.batch(statements);
    return json({ printJobId: jobId }, 201);
  } catch (error) {
    console.error("print job creation failed", error);
    return json({ error: "La file d’impression n’a pas pu être créée." }, 503);
  }
}

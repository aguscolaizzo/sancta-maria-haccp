import { authorize } from "@/lib/access";
import { summaryFromRow } from "@/lib/receptions";
import { db, json, sameOrigin } from "@/lib/server";

export const dynamic = "force-dynamic";

function parisCodeDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}${get("month")}${get("day")}`;
}

export async function GET(request: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const url = new URL(request.url),
    conditions = ["r.owner_id=?"],
    values: unknown[] = [auth.access.ownerId];
  const addLike = (key: string, sql: string) => {
    const value = url.searchParams.get(key)?.trim();
    if (value) {
      conditions.push(sql);
      values.push(`%${value.slice(0, 120)}%`);
    }
  };
  const date = url.searchParams.get("date")?.trim();
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    conditions.push("substr(r.created_at,1,10)=?");
    values.push(date);
  }
  const status = url.searchParams.get("status")?.trim();
  if (
    status &&
    [
      "in_progress",
      "compliant",
      "compliant_after_probe",
      "non_compliant",
      "refused",
    ].includes(status)
  ) {
    conditions.push("r.status=?");
    values.push(status);
  }
  addLike("supplier", "r.supplier_name LIKE ? COLLATE NOCASE");
  addLike(
    "user",
    "COALESCE(r.validated_by_name,r.created_by_name) LIKE ? COLLATE NOCASE",
  );
  addLike(
    "product",
    "EXISTS(SELECT 1 FROM reception_products fp WHERE fp.owner_id=r.owner_id AND fp.reception_id=r.id AND fp.deleted_at IS NULL AND fp.product_name LIKE ? COLLATE NOCASE)",
  );
  addLike(
    "category",
    "EXISTS(SELECT 1 FROM reception_products fc WHERE fc.owner_id=r.owner_id AND fc.reception_id=r.id AND fc.deleted_at IS NULL AND fc.category LIKE ? COLLATE NOCASE)",
  );
  addLike(
    "lot",
    "EXISTS(SELECT 1 FROM reception_products fl WHERE fl.owner_id=r.owner_id AND fl.reception_id=r.id AND fl.deleted_at IS NULL AND fl.supplier_lot LIKE ? COLLATE NOCASE)",
  );
  try {
    const rows = await db()
      .prepare(
        `SELECT r.*,
      (SELECT count(*) FROM reception_products p WHERE p.owner_id=r.owner_id AND p.reception_id=r.id AND p.deleted_at IS NULL) AS product_count,
      (SELECT count(*) FROM reception_products p WHERE p.owner_id=r.owner_id AND p.reception_id=r.id AND p.deleted_at IS NULL AND p.selected_for_measurement=1 AND p.ir_temperature IS NOT NULL) AS measured_count,
      (SELECT count(*) FROM reception_products p WHERE p.owner_id=r.owner_id AND p.reception_id=r.id AND p.deleted_at IS NULL AND (p.decision_type IS NOT NULL OR p.packaging_compliant=0 OR p.visual_compliant=0 OR p.product_compliant=0)) AS non_conformity_count
      FROM receptions r WHERE ${conditions.join(" AND ")} ORDER BY r.created_at DESC LIMIT 300`,
      )
      .bind(...values)
      .all();
    return json({
      receptions: rows.results.map((row) =>
        summaryFromRow(row as Record<string, unknown>),
      ),
    });
  } catch (error) {
    console.error("reception history failed", error);
    return json(
      { error: "L’historique des réceptions ne peut pas être chargé." },
      503,
    );
  }
}

export async function POST(request: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request))
    return json({ error: "Origine de la demande invalide." }, 403);
  const { ownerId, userId, displayName, memberRevision } = auth.access;
  const now = new Date().toISOString(),
    dateCode = parisCodeDate();
  try {
    const database = db();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const previous = await database
        .prepare(
          "SELECT reception_code FROM receptions WHERE owner_id=? AND reception_code LIKE ? ORDER BY reception_code DESC LIMIT 1",
        )
        .bind(ownerId, `REC-${dateCode}-%`)
        .first<{ reception_code: string }>();
      const sequence = Math.max(
        1,
        Number(previous?.reception_code.slice(-3) ?? 0) + 1 + attempt,
      );
      const receptionCode = `REC-${dateCode}-${String(sequence).padStart(3, "0")}`,
        id = crypto.randomUUID();
      const insert = database
        .prepare(
          `INSERT INTO receptions(id,owner_id,reception_code,status,created_at,created_by_id,created_by_name)
        SELECT ?,?,?,'in_progress',?,?,? WHERE ?=? OR EXISTS(SELECT 1 FROM register_members WHERE owner_id=? AND user_id=? AND status='active' AND revision=?)`,
        )
        .bind(
          id,
          ownerId,
          receptionCode,
          now,
          userId,
          displayName,
          userId,
          ownerId,
          ownerId,
          userId,
          memberRevision,
        );
      const audit = database
        .prepare(
          `INSERT INTO reception_audit_events(id,owner_id,reception_id,entity_type,entity_id,action,field_name,old_value,new_value,changed_at,changed_by_id,changed_by_name)
        SELECT ?,?,?,'reception',?,'created','',NULL,?, ?,?,? WHERE EXISTS(SELECT 1 FROM receptions WHERE owner_id=? AND id=?)`,
        )
        .bind(
          crypto.randomUUID(),
          ownerId,
          id,
          id,
          receptionCode,
          now,
          userId,
          displayName,
          ownerId,
          id,
        );
      try {
        const [result] = await database.batch([insert, audit]);
        if (!result.meta.changes)
          return json(
            { error: "Votre accès a changé. Rouvrez l’application." },
            403,
          );
        const row = await database
          .prepare(
            "SELECT r.*,0 AS product_count,0 AS measured_count,0 AS non_conformity_count FROM receptions r WHERE owner_id=? AND id=?",
          )
          .bind(ownerId, id)
          .first<Record<string, unknown>>();
        return json({ reception: summaryFromRow(row!) }, 201);
      } catch (error) {
        if (String(error).toLowerCase().includes("unique")) continue;
        throw error;
      }
    }
    return json(
      { error: "Impossible de générer l’identifiant de réception. Réessayez." },
      409,
    );
  } catch (error) {
    console.error("reception create failed", error);
    return json({ error: "La réception n’a pas pu être créée." }, 503);
  }
}

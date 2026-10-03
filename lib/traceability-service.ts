import { db } from "./server";

export type LabelTraceability = {
  label: Record<string, unknown>;
  sources: Array<Record<string, unknown>>;
  impressions: Array<Record<string, unknown>>;
  audits: Array<Record<string, unknown>>;
};

export class TraceabilityService {
  constructor(private readonly ownerId: string) {}

  async byShortToken(token: string): Promise<LabelTraceability | null> {
    if (!/^[0-9a-f]{16}$/i.test(token)) return null;
    const label = await db()
      .prepare(
        `SELECT p.*,p.id AS preparation_id,l.id AS physical_label_id,l.label_code,l.short_token,l.label_format,l.status AS label_status,l.created_at AS label_created_at,
                b.id AS bac_id,b.bac_code,b.bac_index,b.status AS bac_status,i.category,i.product_type
         FROM physical_labels l
         JOIN preparation_bacs b ON b.owner_id=l.owner_id AND b.id=l.bac_id
         JOIN internal_preparations p ON p.owner_id=l.owner_id AND p.id=l.preparation_id
         JOIN ingredient_catalog i ON i.owner_id=p.owner_id AND i.id=p.ingredient_id
         WHERE l.owner_id=? AND l.short_token=? AND p.deleted_at IS NULL`,
      )
      .bind(this.ownerId, token)
      .first<Record<string, unknown>>();
    if (!label) return null;
    const [sourceRows, printRows, auditRows] = await Promise.all([
      db()
        .prepare(
          `SELECT sl.id,sl.ingredient_name,sl.supplier_lot,sl.received_at,sl.supplier_deadline,sl.quantity,sl.storage_mode,sl.document_ref,
                  s.name AS supplier_name,r.id AS reception_id,r.reception_code,r.delivery_note,r.status AS reception_status
           FROM internal_preparation_source_lots x
           JOIN supplier_lots sl ON sl.owner_id=x.owner_id AND sl.id=x.supplier_lot_id
           JOIN suppliers s ON s.owner_id=sl.owner_id AND s.id=sl.supplier_id
           LEFT JOIN reception_products rp ON rp.owner_id=sl.owner_id AND rp.supplier_lot_id=sl.id AND rp.deleted_at IS NULL
           LEFT JOIN receptions r ON r.owner_id=sl.owner_id AND r.id=rp.reception_id
           WHERE x.owner_id=? AND x.preparation_id=? ORDER BY sl.received_at`,
        )
        .bind(this.ownerId, label.preparation_id)
        .all<Record<string, unknown>>(),
      db()
        .prepare(
          `SELECT a.* FROM label_print_attempts a WHERE a.owner_id=? AND a.physical_label_id=? ORDER BY a.started_at DESC`,
        )
        .bind(this.ownerId, label.physical_label_id)
        .all<Record<string, unknown>>(),
      db()
        .prepare(
          `SELECT * FROM traceability_audit_events WHERE owner_id=? AND entity_id IN (?,?) ORDER BY changed_at DESC`,
        )
        .bind(this.ownerId, label.ingredient_id, label.preparation_id)
        .all<Record<string, unknown>>(),
    ]);
    return {
      label,
      sources: sourceRows.results,
      impressions: printRows.results,
      audits: auditRows.results,
    };
  }
}

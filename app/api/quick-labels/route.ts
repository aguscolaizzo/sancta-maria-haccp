import { authorize } from "@/lib/access";
import { ensureIngredientCatalog } from "@/lib/catalog-server";
import {
  calculateInternalExpiry,
  formatLabelCode,
  formatPreparationCode,
  shortTraceToken,
  validateQuickSelection,
  type IngredientConfig,
  type QuickLabelRecord,
  type SourceLotTrace,
} from "@/lib/quick-labels";
import { db, json, sameOrigin } from "@/lib/server";

export const dynamic = "force-dynamic";

const ingredientSql = `SELECT i.*,r.duration_hours,r.requires_source_lot
  FROM ingredient_catalog i JOIN ingredient_operation_rules r
  ON r.owner_id=i.owner_id AND r.ingredient_id=i.id AND r.operation_type=? AND r.active=1
  WHERE i.owner_id=? AND i.id=? AND i.deleted_at IS NULL AND i.active=1`;

function ingredient(row: Record<string, unknown>): IngredientConfig {
  let days: number[] = [];
  try {
    days = JSON.parse(String(row.preparation_days ?? "[]"));
  } catch {}
  return {
    id: String(row.id),
    legacyCode: String(row.legacy_code),
    displayName: String(row.display_name),
    shortName: String(row.short_name),
    category: String(row.category),
    productType: String(row.product_type),
    active: Boolean(row.active),
    quickEnabled: Boolean(row.quick_enabled),
    favorite: Boolean(row.favorite),
    displayOrder: Number(row.display_order),
    preparationDays: days,
    defaultOperation: String(row.default_operation) as IngredientConfig["defaultOperation"],
    storageMode: String(row.storage_mode) as IngredientConfig["storageMode"],
    storageTemperature:
      row.storage_temperature === null ? null : Number(row.storage_temperature),
    defaultBacs: Number(row.default_bacs),
    defaultLabels: Number(row.default_labels),
    labelFormat: String(row.label_format) as IngredientConfig["labelFormat"],
    technicalDescription: String(row.technical_description ?? ""),
    allergens: String(row.allergens ?? ""),
    preparationProcedure: String(row.preparation_procedure ?? ""),
    handlingRules: String(row.handling_rules ?? ""),
    usageCount: Number(row.usage_count ?? 0),
    revision: Number(row.revision ?? 1),
    durationHours: Number(row.duration_hours),
    requiresSourceLot: Boolean(row.requires_source_lot),
  };
}

async function nextPreparationSequence(ownerId: string, date: string) {
  const id = `${ownerId}:${date}:preparation`;
  const row = await db()
    .prepare(
      `INSERT INTO daily_sequences(id,owner_id,sequence_date,kind,next_value) VALUES(?,?,?,?,1)
       ON CONFLICT(owner_id,sequence_date,kind) DO UPDATE SET next_value=daily_sequences.next_value+1
       RETURNING next_value`,
    )
    .bind(id, ownerId, date, "preparation")
    .first<{ next_value: number }>();
  if (!row) throw new Error("sequence unavailable");
  return Number(row.next_value);
}

async function sourceLots(ownerId: string, ids: string[]) {
  if (!ids.length) return [] as SourceLotTrace[];
  const marks = ids.map(() => "?").join(",");
  const rows = await db()
    .prepare(
      `SELECT DISTINCT sl.*,s.name AS supplier_name,rp.reception_id,r.reception_code,r.delivery_note
       FROM supplier_lots sl JOIN suppliers s ON s.owner_id=sl.owner_id AND s.id=sl.supplier_id
       LEFT JOIN reception_products rp ON rp.owner_id=sl.owner_id AND rp.supplier_lot_id=sl.id AND rp.deleted_at IS NULL
       LEFT JOIN receptions r ON r.owner_id=sl.owner_id AND r.id=rp.reception_id
       WHERE sl.owner_id=? AND sl.deleted_at IS NULL AND sl.id IN (${marks})`,
    )
    .bind(ownerId, ...ids)
    .all<Record<string, unknown>>();
  const mapped = rows.results.map((row) => ({
    id: String(row.id),
    supplierId: String(row.supplier_id),
    supplierName: String(row.supplier_name),
    ingredientName: String(row.ingredient_name),
    supplierLot: String(row.supplier_lot),
    receivedAt: String(row.received_at),
    supplierDeadline:
      row.supplier_deadline === null ? null : String(row.supplier_deadline),
    quantity: String(row.quantity ?? ""),
    storageMode: String(row.storage_mode),
    documentRef: String(row.document_ref ?? ""),
    receptionId: row.reception_id ? String(row.reception_id) : null,
    receptionCode: row.reception_code ? String(row.reception_code) : null,
    deliveryNote: row.delivery_note ? String(row.delivery_note) : null,
  }));
  return [...new Map(mapped.map((row) => [row.id, row])).values()];
}

export async function GET() {
  const auth = await authorize("admin");
  if ("response" in auth) return auth.response;
  try {
    const rows = await db()
      .prepare(
        `SELECT p.id,p.preparation_code,p.ingredient_id,p.ingredient_name,p.short_name,p.operation_type,p.prepared_at,p.expires_at,p.storage_mode,p.storage_temperature,p.operator_initials,p.status,
                COUNT(DISTINCT b.id) AS bac_count,COUNT(DISTINCT l.id) AS label_count,
                SUM(CASE WHEN l.status='printed' THEN 1 ELSE 0 END) AS printed_count,
                SUM(CASE WHEN l.status='print_error' THEN 1 ELSE 0 END) AS error_count
         FROM internal_preparations p
         LEFT JOIN preparation_bacs b ON b.owner_id=p.owner_id AND b.preparation_id=p.id
         LEFT JOIN physical_labels l ON l.owner_id=p.owner_id AND l.preparation_id=p.id
         WHERE p.owner_id=? AND p.deleted_at IS NULL GROUP BY p.id ORDER BY p.created_at DESC LIMIT 100`,
      )
      .bind(auth.access.ownerId)
      .all<Record<string, unknown>>();
    return json({ preparations: rows.results });
  } catch {
    return json({ error: "L’historique de mise en place ne peut pas être chargé." }, 503);
  }
}

export async function POST(request: Request) {
  const auth = await authorize("admin");
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request)) return json({ error: "Origine invalide." }, 403);
  if (Number(request.headers.get("content-length")) > 100000)
    return json({ error: "Sélection trop volumineuse." }, 413);
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Données invalides." }, 400);
  }
  const rawSelections = payload.selections;
  if (!Array.isArray(rawSelections) || !rawSelections.length || rawSelections.length > 30)
    return json({ error: "Sélectionnez entre 1 et 30 ingrédients." }, 400);
  await ensureIngredientCatalog(auth.access.ownerId);
  const checked = rawSelections.map((raw) =>
    validateQuickSelection((raw ?? {}) as Record<string, unknown>),
  );
  const invalid = checked.find((entry) => entry.error);
  if (invalid?.error) return json({ error: invalid.error }, 400);
  const selections = checked.map((entry) => entry.value!);
  if (selections.reduce((sum, entry) => sum + entry.labelCount, 0) > 100)
    return json({ error: "Créez au maximum 100 étiquettes à la fois." }, 400);
  const createPrintJob = payload.createPrintJob !== false;
  const now = new Date().toISOString();
  const records: QuickLabelRecord[] = [];
  const warnings: string[] = [];
  const database = db();
  const printJobId = createPrintJob ? crypto.randomUUID() : null;
  try {
    const allStatements: D1PreparedStatement[] = [];
    let queuePosition = 0;
    for (const selection of selections) {
      const row = await database
        .prepare(ingredientSql)
        .bind(selection.operationType, auth.access.ownerId, selection.ingredientId)
        .first<Record<string, unknown>>();
      if (!row)
        return json(
          {
            error:
              "La règle de DLC de cette opération n’est pas configurée pour un ingrédient sélectionné.",
          },
          409,
        );
      const item = ingredient(row);
      if (selection.durationOverride !== null && auth.access.role === "contributor")
        return json(
          { error: "Seul le responsable peut modifier la DLC proposée." },
          403,
        );
      const origins = await sourceLots(auth.access.ownerId, selection.sourceLotIds);
      if (origins.length !== selection.sourceLotIds.length)
        return json({ error: "Un lot fournisseur sélectionné n’existe plus." }, 409);
      const missingSourceLot =
        item.requiresSourceLot &&
        !origins.length &&
        !selection.manualSourceLot;
      const durationHours = selection.durationOverride ?? item.durationHours;
      const expiry = calculateInternalExpiry(
        selection.preparedAt,
        durationHours,
        origins.map((origin) => origin.supplierDeadline),
      );
      if (expiry.expiresAt <= selection.preparedAt)
        return json(
          { error: `La DLC fournisseur de « ${item.displayName} » est déjà dépassée.` },
          400,
        );
      const preparationId = crypto.randomUUID(),
        date = selection.preparedAt.slice(0, 10),
        sequence = await nextPreparationSequence(auth.access.ownerId, date),
        preparationCode = formatPreparationCode(date, sequence),
        technicalSnapshot = JSON.stringify({
          ingredientName: item.displayName,
          shortName: item.shortName,
          description: item.technicalDescription,
          allergens: item.allergens,
          conservation: item.handlingRules,
          preparationProcedure: item.preparationProcedure,
          productType: item.productType,
          durationHours,
          supplierLimit: expiry.supplierLimit,
          cappedBySupplier: expiry.cappedBySupplier,
          sourceLotStatus: missingSourceLot
            ? "missing"
            : origins.length
              ? "linked"
              : selection.manualSourceLot
                ? "manual"
                : "not_required",
        });
      if (missingSourceLot)
        warnings.push(
          `${item.displayName} · ${preparationCode} : lot d’origine à compléter.`,
        );
      allStatements.push(
        database
          .prepare(
            `INSERT INTO internal_preparations(id,owner_id,preparation_code,ingredient_id,ingredient_name,short_name,operation_type,prepared_at,duration_hours,expires_at,storage_mode,storage_temperature,bac_count,label_count,status,operator_initials,notes,manual_source_lot,manual_source_reason,technical_snapshot,revision,created_at,created_by_id,created_by_name)
             VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?)`,
          )
          .bind(
            preparationId,
            auth.access.ownerId,
            preparationCode,
            item.id,
            item.displayName,
            item.shortName,
            selection.operationType,
            selection.preparedAt,
            durationHours,
            expiry.expiresAt,
            item.storageMode,
            item.storageTemperature,
            selection.bacCount,
            selection.labelCount,
            "prepared",
            auth.access.displayName
              .split(/\s+/)
              .map((part) => part[0])
              .join("")
              .slice(0, 6)
              .toUpperCase(),
            selection.notes,
            selection.manualSourceLot,
            selection.manualSourceReason,
            technicalSnapshot,
            now,
            auth.access.userId,
            auth.access.displayName,
          ),
      );
      if (missingSourceLot)
        allStatements.push(
          database
            .prepare(
              `INSERT INTO traceability_audit_events(id,owner_id,entity_type,entity_id,action,field_name,old_value,new_value,reason,changed_at,changed_by_id,changed_by_name) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
            )
            .bind(
              crypto.randomUUID(),
              auth.access.ownerId,
              "preparation",
              preparationId,
              "warning",
              "source_lot",
              null,
              "non_renseigne",
              "Étiquette rapide créée sans lot d’origine : traçabilité amont à compléter.",
              now,
              auth.access.userId,
              auth.access.displayName,
            ),
        );
      allStatements.push(
        database
          .prepare(
            `INSERT INTO traceability_audit_events(id,owner_id,entity_type,entity_id,action,field_name,old_value,new_value,reason,changed_at,changed_by_id,changed_by_name) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
          )
          .bind(
            crypto.randomUUID(),
            auth.access.ownerId,
            "preparation",
            preparationId,
            "created",
            "operation_type",
            null,
            selection.operationType,
            preparationCode,
            now,
            auth.access.userId,
            auth.access.displayName,
          ),
      );
      for (const origin of origins)
        allStatements.push(
          database
            .prepare(
              `INSERT INTO internal_preparation_source_lots(id,owner_id,preparation_id,supplier_lot_id,quantity_used,created_at) VALUES(?,?,?,?,?,?)`,
            )
            .bind(
              crypto.randomUUID(),
              auth.access.ownerId,
              preparationId,
              origin.id,
              "",
              now,
            ),
        );
      const bacs = Array.from({ length: selection.bacCount }, (_, index) => ({
        id: crypto.randomUUID(),
        index: index + 1,
        code: `${preparationCode}-BAC-${String(index + 1).padStart(2, "0")}`,
      }));
      for (const bac of bacs)
        allStatements.push(
          database
            .prepare(
              `INSERT INTO preparation_bacs(id,owner_id,preparation_id,bac_code,bac_index,status,created_at) VALUES(?,?,?,?,?,'active',?)`,
            )
            .bind(
              bac.id,
              auth.access.ownerId,
              preparationId,
              bac.code,
              bac.index,
              now,
            ),
        );
      for (let index = 1; index <= selection.labelCount; index++) {
        const labelId = crypto.randomUUID(),
          bac = bacs[(index - 1) % bacs.length],
          labelCode = formatLabelCode(preparationCode, index),
          shortToken = shortTraceToken(labelId),
          status = "to_print" as const;
        allStatements.push(
          database
            .prepare(
              `INSERT INTO physical_labels(id,owner_id,label_code,short_token,preparation_id,bac_id,label_format,status,created_at,created_by_id,created_by_name) VALUES(?,?,?,?,?,?,?,? ,?,?,?)`,
            )
            .bind(
              labelId,
              auth.access.ownerId,
              labelCode,
              shortToken,
              preparationId,
              bac.id,
              item.labelFormat,
              status,
              now,
              auth.access.userId,
              auth.access.displayName,
            ),
        );
        if (printJobId) {
          const printItemId = crypto.randomUUID();
          allStatements.push(
            database
              .prepare(
                `INSERT INTO print_job_items(id,owner_id,print_job_id,physical_label_id,position,status,attempt_count,settings_snapshot) VALUES(?,?,?,?,?,'pending',0,'{}')`,
              )
              .bind(
                printItemId,
                auth.access.ownerId,
                printJobId,
                labelId,
                ++queuePosition,
              ),
          );
          records.push({
            id: labelId,
            labelCode,
            shortToken,
            preparationId,
            preparationCode,
            bacId: bac.id,
            bacCode: bac.code,
            bacIndex: bac.index,
            labelFormat: item.labelFormat,
            status,
            ingredientName: item.displayName,
            shortName: item.shortName,
            operationType: selection.operationType,
            preparedAt: selection.preparedAt,
            expiresAt: expiry.expiresAt,
            storageMode: item.storageMode,
            storageTemperature: item.storageTemperature,
            operatorInitials: auth.access.displayName
              .split(/\s+/)
              .map((part) => part[0])
              .join("")
              .slice(0, 6)
              .toUpperCase(),
            sourceLots: origins,
          });
        } else {
          records.push({
            id: labelId,
            labelCode,
            shortToken,
            preparationId,
            preparationCode,
            bacId: bac.id,
            bacCode: bac.code,
            bacIndex: bac.index,
            labelFormat: item.labelFormat,
            status,
            ingredientName: item.displayName,
            shortName: item.shortName,
            operationType: selection.operationType,
            preparedAt: selection.preparedAt,
            expiresAt: expiry.expiresAt,
            storageMode: item.storageMode,
            storageTemperature: item.storageTemperature,
            operatorInitials: auth.access.displayName
              .split(/\s+/)
              .map((part) => part[0])
              .join("")
              .slice(0, 6)
              .toUpperCase(),
            sourceLots: origins,
          });
        }
      }
      allStatements.push(
        database
          .prepare("UPDATE ingredient_catalog SET usage_count=usage_count+1 WHERE owner_id=? AND id=?")
          .bind(auth.access.ownerId, item.id),
      );
      if (selection.durationOverride !== null)
        allStatements.push(
          database
            .prepare(
              `INSERT INTO traceability_audit_events(id,owner_id,entity_type,entity_id,action,field_name,old_value,new_value,reason,changed_at,changed_by_id,changed_by_name) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
            )
            .bind(
              crypto.randomUUID(),
              auth.access.ownerId,
              "preparation",
              preparationId,
              "override",
              "duration_hours",
              String(item.durationHours),
              String(durationHours),
              selection.overrideReason,
              now,
              auth.access.userId,
              auth.access.displayName,
            ),
        );
    }
    if (printJobId)
      allStatements.unshift(
        database
          .prepare(
            `INSERT INTO print_jobs(id,owner_id,status,printer_model,transport,requested_at,requested_by_id,requested_by_name) VALUES(?,?,'pending','T50M Pro','web_serial_bluetooth',?,?,?)`,
          )
          .bind(
            printJobId,
            auth.access.ownerId,
            now,
            auth.access.userId,
            auth.access.displayName,
          ),
      );
    // One D1 batch keeps the whole creation atomic: either every preparation,
    // bac, label and queue item is stored, or none of them is.
    await database.batch(allStatements);
    return json(
      {
        preparations: [...new Set(records.map((record) => record.preparationId))]
          .map((id) => records.find((record) => record.preparationId === id)!.preparationCode),
        labels: records,
        printJobId,
        createdAt: now,
        warnings,
      },
      201,
    );
  } catch (error) {
    console.error("quick labels creation failed", error);
    return json(
      { error: "Les préparations n’ont pas pu être créées. Aucune impression n’a été lancée." },
      503,
    );
  }
}

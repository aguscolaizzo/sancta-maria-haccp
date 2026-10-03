import { authorize } from "@/lib/access";
import { isValidDate, todayParis } from "@/lib/frigo";
import {
  HYGIENE_TASKS,
  hygieneCheckFromRow,
  hygieneRecordFromRow,
  type HygieneCheckState,
  type HygieneHistoryItem,
  type HygieneRecordType,
} from "@/lib/hygiene";
import { db, json, sameOrigin } from "@/lib/server";

export const dynamic = "force-dynamic";

const recordTypes: HygieneRecordType[] = ["cleaning", "fryer"];
const checkStates: HygieneCheckState[] = [
  "pending",
  "done",
  "not_applicable",
  "issue",
];

function validType(value: string | null): value is HygieneRecordType {
  return recordTypes.includes(value as HygieneRecordType);
}

function historyFromRow(row: Record<string, unknown>): HygieneHistoryItem {
  return {
    id: String(row.id),
    recordType: row.record_type as HygieneRecordType,
    date: String(row.date),
    time: String(row.time),
    operatorInitials: String(row.operator_initials),
    status: row.status as HygieneHistoryItem["status"],
    validatedAt: row.validated_at ? String(row.validated_at) : null,
    validatedByName: row.validated_by_name
      ? String(row.validated_by_name)
      : null,
    revision: Number(row.revision),
    doneCount: Number(row.done_count),
    issueCount: Number(row.issue_count),
    totalCount: Number(row.total_count),
  };
}

export async function GET(request: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const url = new URL(request.url),
    recordType = url.searchParams.get("type"),
    date = url.searchParams.get("date") ?? "",
    month = url.searchParams.get("month") ?? date.slice(0, 7);
  if (!validType(recordType))
    return json({ error: "Type de contrôle invalide." }, 400);
  if (!isValidDate(date)) return json({ error: "Date invalide." }, 400);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    return json({ error: "Mois invalide." }, 400);
  try {
    const database = db();
    const [row, history] = await Promise.all([
      database
        .prepare(
          "SELECT * FROM hygiene_records WHERE owner_id=? AND record_type=? AND date=?",
        )
        .bind(auth.access.ownerId, recordType, date)
        .first<Record<string, unknown>>(),
      database
        .prepare(
          `SELECT r.*,
          (SELECT count(*) FROM hygiene_checks c WHERE c.owner_id=r.owner_id AND c.record_id=r.id) AS total_count,
          (SELECT count(*) FROM hygiene_checks c WHERE c.owner_id=r.owner_id AND c.record_id=r.id AND c.state='done') AS done_count,
          (SELECT count(*) FROM hygiene_checks c WHERE c.owner_id=r.owner_id AND c.record_id=r.id AND c.state='issue') AS issue_count
          FROM hygiene_records r
          WHERE r.owner_id=? AND r.record_type=? AND r.date>=? AND r.date<=?
          ORDER BY r.date DESC, r.time DESC`,
        )
        .bind(
          auth.access.ownerId,
          recordType,
          `${month}-01`,
          `${month}-31`,
        )
        .all<Record<string, unknown>>(),
    ]);
    const checks = row
      ? await database
          .prepare(
            "SELECT * FROM hygiene_checks WHERE owner_id=? AND record_id=? ORDER BY sort_order",
          )
          .bind(auth.access.ownerId, String(row.id))
          .all<Record<string, unknown>>()
      : { results: [] as Record<string, unknown>[] };
    return json({
      record: row ? hygieneRecordFromRow(row) : null,
      checks: checks.results.map(hygieneCheckFromRow),
      history: history.results.map(historyFromRow),
    });
  } catch (error) {
    console.error("hygiene records load failed", error);
    return json(
      { error: "Les contrôles d’hygiène ne peuvent pas être chargés." },
      503,
    );
  }
}

type SubmittedCheck = {
  code?: unknown;
  state?: unknown;
  observation?: unknown;
};

type SubmittedRecord = {
  recordType?: unknown;
  date?: unknown;
  time?: unknown;
  operatorInitials?: unknown;
  generalNotes?: unknown;
  signature?: unknown;
  validate?: unknown;
  revision?: unknown;
  checks?: unknown;
};

function validatePayload(payload: SubmittedRecord) {
  if (
    typeof payload.recordType !== "string" ||
    !validType(payload.recordType)
  )
    return "Type de contrôle invalide.";
  if (
    typeof payload.date !== "string" ||
    !isValidDate(payload.date) ||
    payload.date > todayParis()
  )
    return "Choisissez une date valide, aujourd’hui ou avant.";
  if (
    typeof payload.time !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(payload.time)
  )
    return "Renseignez l’heure du contrôle.";
  if (
    typeof payload.operatorInitials !== "string" ||
    !payload.operatorInitials.trim() ||
    payload.operatorInitials.trim().length > 12
  )
    return "Renseignez les initiales du responsable (12 caractères maximum).";
  if (
    typeof payload.generalNotes !== "string" ||
    payload.generalNotes.length > 2000
  )
    return "Les observations générales sont limitées à 2 000 caractères.";
  if (typeof payload.validate !== "boolean")
    return "Mode de validation invalide.";
  if (
    !Number.isInteger(payload.revision) ||
    Number(payload.revision) < 0
  )
    return "Version du contrôle invalide.";
  if (!Array.isArray(payload.checks)) return "Liste de contrôles invalide.";
  const expected = HYGIENE_TASKS[payload.recordType];
  if (payload.checks.length !== expected.length)
    return "La liste de contrôles est incomplète.";
  const submitted = payload.checks as SubmittedCheck[];
  const codes = new Set<string>();
  for (const item of submitted) {
    if (
      typeof item.code !== "string" ||
      !expected.some((task) => task.code === item.code) ||
      codes.has(item.code)
    )
      return "Une ligne de contrôle est invalide.";
    codes.add(item.code);
    if (
      typeof item.state !== "string" ||
      !checkStates.includes(item.state as HygieneCheckState)
    )
      return "Choisissez un état pour chaque contrôle.";
    if (
      typeof item.observation !== "string" ||
      item.observation.length > 600
    )
      return "Chaque observation est limitée à 600 caractères.";
    if (item.state === "issue" && !item.observation.trim())
      return "Décrivez l’anomalie et l’action menée avant de valider.";
    if (payload.validate && item.state === "pending")
      return "Traitez toutes les lignes avant de signer la validation.";
  }
  if (
    payload.signature !== null &&
    (typeof payload.signature !== "string" ||
      !/^data:image\/(png|webp);base64,[A-Za-z0-9+/=]+$/.test(
        payload.signature,
      ) ||
      payload.signature.length > 260_000)
  )
    return "Signature invalide ou trop volumineuse.";
  if (payload.validate && !payload.signature)
    return "Signez le contrôle avant de le valider.";
  return null;
}

export async function POST(request: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request))
    return json({ error: "Origine de la demande invalide." }, 403);
  if (Number(request.headers.get("content-length")) > 350_000)
    return json({ error: "Contrôle trop volumineux." }, 413);
  let payload: SubmittedRecord;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Données invalides." }, 400);
  }
  const validationError = validatePayload(payload);
  if (validationError) return json({ error: validationError }, 400);

  const recordType = payload.recordType as HygieneRecordType,
    date = String(payload.date),
    time = String(payload.time),
    operatorInitials = String(payload.operatorInitials).trim(),
    generalNotes = String(payload.generalNotes).trim(),
    signature = payload.signature ? String(payload.signature) : null,
    shouldValidate = Boolean(payload.validate),
    revision = Number(payload.revision),
    submitted = payload.checks as Required<SubmittedCheck>[],
    { ownerId, userId, displayName, memberRevision } = auth.access,
    now = new Date().toISOString(),
    recordId = crypto.randomUUID(),
    updateMarker = `${now}:${crypto.randomUUID()}`,
    database = db();

  try {
    const existing = await database
      .prepare(
        "SELECT id,status,revision FROM hygiene_records WHERE owner_id=? AND record_type=? AND date=?",
      )
      .bind(ownerId, recordType, date)
      .first<{ id: string; status: string; revision: number }>();
    if (existing?.status === "validated")
      return json(
        {
          error:
            "Ce contrôle est déjà signé et validé. Il reste conservé dans l’historique.",
        },
        409,
      );
    if ((existing?.revision ?? 0) !== revision)
      return json(
        {
          error:
            "Ce contrôle a été modifié sur un autre appareil. Rechargez la date.",
        },
        409,
      );
    const id = existing?.id ?? recordId,
      status = shouldValidate ? "validated" : "draft",
      tasks = HYGIENE_TASKS[recordType],
      byCode = new Map(submitted.map((item) => [String(item.code), item]));

    const recordStatement = existing
      ? database
          .prepare(
            `UPDATE hygiene_records SET time=?,operator_initials=?,general_notes=?,status=?,signature=?,validated_at=?,validated_by_id=?,validated_by_name=?,revision=revision+1,updated_at=?,updated_by_id=?,updated_by_name=?
            WHERE owner_id=? AND id=? AND status='draft' AND revision=? AND (?=? OR EXISTS(SELECT 1 FROM register_members WHERE owner_id=? AND user_id=? AND status='active' AND revision=?))`,
          )
          .bind(
            time,
            operatorInitials,
            generalNotes,
            status,
            signature,
            shouldValidate ? now : null,
            shouldValidate ? userId : null,
            shouldValidate ? displayName : null,
            updateMarker,
            userId,
            displayName,
            ownerId,
            id,
            revision,
            userId,
            ownerId,
            ownerId,
            userId,
            memberRevision,
          )
      : database
          .prepare(
            `INSERT INTO hygiene_records(id,owner_id,record_type,date,time,operator_initials,general_notes,status,signature,validated_at,validated_by_id,validated_by_name,revision,created_at,created_by_id,created_by_name,updated_at,updated_by_id,updated_by_name)
            SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ?=? OR EXISTS(SELECT 1 FROM register_members WHERE owner_id=? AND user_id=? AND status='active' AND revision=?)
            ON CONFLICT(owner_id,record_type,date) DO NOTHING`,
          )
          .bind(
            id,
            ownerId,
            recordType,
            date,
            time,
            operatorInitials,
            generalNotes,
            status,
            signature,
            shouldValidate ? now : null,
            shouldValidate ? userId : null,
            shouldValidate ? displayName : null,
            1,
            now,
            userId,
            displayName,
            updateMarker,
            userId,
            displayName,
            userId,
            ownerId,
            ownerId,
            userId,
            memberRevision,
          );
    const statements = [recordStatement];
    if (existing)
      statements.push(
        database
          .prepare(
            "DELETE FROM hygiene_checks WHERE owner_id=? AND record_id=? AND EXISTS(SELECT 1 FROM hygiene_records WHERE owner_id=? AND id=? AND updated_at=?)",
          )
          .bind(ownerId, id, ownerId, id, updateMarker),
      );
    tasks.forEach((task, index) => {
      const check = byCode.get(task.code)!;
      statements.push(
        database
          .prepare(
            `INSERT INTO hygiene_checks(id,owner_id,record_id,check_code,label,frequency,protocol,optional,state,observation,sort_order,created_at,updated_at)
            SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM hygiene_records WHERE owner_id=? AND id=? AND updated_at=?)`,
          )
          .bind(
            crypto.randomUUID(),
            ownerId,
            id,
            task.code,
            task.label,
            task.frequency,
            task.protocol,
            task.optional ? 1 : 0,
            String(check.state),
            String(check.observation).trim(),
            index,
            now,
            now,
            ownerId,
            id,
            updateMarker,
          ),
      );
    });
    statements.push(
      database
        .prepare(
          `INSERT INTO traceability_audit_events(id,owner_id,entity_type,entity_id,action,field_name,old_value,new_value,reason,changed_at,changed_by_id,changed_by_name)
          SELECT ?,?,'hygiene_record',?,?, 'record',NULL,?,?, ?,?,? WHERE EXISTS(SELECT 1 FROM hygiene_records WHERE owner_id=? AND id=? AND updated_at=?)`,
        )
        .bind(
          crypto.randomUUID(),
          ownerId,
          id,
          shouldValidate ? "validated" : existing ? "updated" : "created",
          JSON.stringify({
            recordType,
            date,
            time,
            operatorInitials,
            status,
            checks: submitted.map((item) => ({
              code: item.code,
              state: item.state,
              observation: String(item.observation).trim(),
            })),
          }),
          shouldValidate ? "Validation quotidienne signée" : "Brouillon enregistré",
          now,
          userId,
          displayName,
          ownerId,
          id,
          updateMarker,
        ),
    );
    const [result] = await database.batch(statements);
    if (!result.meta.changes) {
      const current = await authorize();
      if ("response" in current) return current.response;
      return json(
        {
          error:
            "Le contrôle n’a pas été enregistré. Rechargez la date et réessayez.",
        },
        409,
      );
    }
    const [row, checks] = await Promise.all([
      database
        .prepare("SELECT * FROM hygiene_records WHERE owner_id=? AND id=?")
        .bind(ownerId, id)
        .first<Record<string, unknown>>(),
      database
        .prepare(
          "SELECT * FROM hygiene_checks WHERE owner_id=? AND record_id=? ORDER BY sort_order",
        )
        .bind(ownerId, id)
        .all<Record<string, unknown>>(),
    ]);
    return json(
      {
        record: hygieneRecordFromRow(row!),
        checks: checks.results.map(hygieneCheckFromRow),
      },
      existing ? 200 : 201,
    );
  } catch (error) {
    console.error("hygiene record save failed", error);
    return json(
      {
        error:
          "L’enregistrement a échoué. Vos informations restent affichées : réessayez.",
      },
      503,
    );
  }
}

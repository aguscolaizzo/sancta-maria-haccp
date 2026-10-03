import { authorize } from "@/lib/access";
import { db, json, sameOrigin } from "@/lib/server";

export const dynamic = "force-dynamic";

const LEVELS = new Set(["info", "success", "warning", "error"]);

function clean(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanEvents(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(-600).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const source = entry as Record<string, unknown>;
    const at = clean(source.at, 40);
    const level = clean(source.level, 12);
    const event = clean(source.event, 160);
    if (!at || !event || !LEVELS.has(level)) return [];
    return [
      {
        at,
        level,
        event,
        detail: source.detail === null ? null : clean(source.detail, 500) || null,
      },
    ];
  });
}

function cleanTransportInfo(value: unknown) {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  return {
    kind: clean(source.kind, 60),
    connected: Boolean(source.connected),
    usbVendorId:
      typeof source.usbVendorId === "number" ? source.usbVendorId : null,
    usbProductId:
      typeof source.usbProductId === "number" ? source.usbProductId : null,
    note: clean(source.note, 300),
    clientVersion: clean(source.clientVersion, 80),
    phase: clean(source.phase, 120),
    lastStatus: clean(source.lastStatus, 300),
    copies:
      typeof source.copies === "number" &&
      Number.isInteger(source.copies) &&
      source.copies >= 1
        ? Math.min(50, source.copies)
        : null,
  };
}

export async function POST(request: Request) {
  const auth = await authorize("admin");
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request)) return json({ error: "Origine invalide." }, 403);
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Diagnostic invalide." }, 400);
  }
  const context = clean(payload.context, 120);
  if (!context) return json({ error: "Contexte du diagnostic manquant." }, 400);
  const events = cleanEvents(payload.events);
  if (!events.length)
    return json({ error: "Aucun événement Bluetooth à enregistrer." }, 400);
  const id = crypto.randomUUID();
  try {
    await db()
      .prepare(
        `INSERT INTO printer_diagnostic_reports(
          id,owner_id,context,message,connected,transport_info,user_agent,
          events_json,created_at,created_by_id,created_by_name
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        id,
        auth.access.ownerId,
        context,
        clean(payload.message, 500),
        payload.connected === null || payload.connected === undefined
          ? null
          : payload.connected
            ? 1
            : 0,
        JSON.stringify(cleanTransportInfo(payload.transportInfo)),
        clean(payload.userAgent, 500),
        JSON.stringify(events),
        new Date().toISOString(),
        auth.access.userId,
        auth.access.displayName,
      )
      .run();
    return json({ id }, 201);
  } catch (error) {
    console.error("printer diagnostic save failed", error);
    return json({ error: "Le diagnostic n’a pas pu être enregistré." }, 503);
  }
}

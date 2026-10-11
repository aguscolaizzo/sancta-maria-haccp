import { authorize } from "@/lib/access";
import { db, json, sameOrigin } from "@/lib/server";
import { interpretAssistantCommand } from "@/lib/assistant-commands";
import { addCalendarDays, classifyExpiry } from "@/lib/weekly-report";

export const dynamic = "force-dynamic";

function parisNow() {
  const parts = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const v = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${v.year}-${v.month}-${v.day}T${v.hour}:${v.minute}`;
}

export async function POST(request: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  if (!sameOrigin(request)) return json({ error: "Origine invalide." }, 403);
  if (Number(request.headers.get("content-length") || 0) > 5000)
    return json({ error: "Message trop long." }, 413);
  let payload: unknown;
  try { payload = await request.json(); } catch { return json({ error: "Message invalide." }, 400); }
  if (!payload || typeof payload !== "object" || !("message" in payload) ||
      typeof payload.message !== "string" || !payload.message.trim() || payload.message.length > 1500)
    return json({ error: "Écrivez un message (1500 caractères maximum)." }, 400);
  const intent = interpretAssistantCommand(payload.message);
  if (intent.kind !== "expiry") return json({ ...intent, action: auth.access.role === "contributor" && intent.action?.type === "prepare_labels" ? undefined : intent.action, confirmationRequired: true });
  try {
    const at = parisNow(), lower = `${addCalendarDays(at.slice(0,10), -7)}T00:00`,
      upper = `${addCalendarDays(at.slice(0,10), 2)}T00:00`;
    const database = db();
    const [quick, classic] = await Promise.all([
      database.prepare("SELECT ingredient_name AS name,expires_at FROM internal_preparations WHERE owner_id=? AND deleted_at IS NULL AND status='prepared' AND expires_at>=? AND expires_at<? LIMIT 500").bind(auth.access.ownerId,lower,upper).all<{name:string;expires_at:string}>(),
      database.prepare("SELECT product_name AS name,expires_at FROM preparation_labels WHERE owner_id=? AND deleted_at IS NULL AND lifecycle_status='active' AND expires_at>=? AND expires_at<? LIMIT 500").bind(auth.access.ownerId,lower,upper).all<{name:string;expires_at:string}>(),
    ]);
    const counts = { expired: 0, today: 0, tomorrow: 0 };
    const rows = [...quick.results,...classic.results];
    for (const item of rows) {
      const bucket = classifyExpiry(item.expires_at,at);
      if (bucket in counts) counts[bucket as keyof typeof counts]++;
    }
    const limited = rows.length >= 1000;
    return json({ kind: "expiry", reply: `${limited ? "Resultado parcial (hay más de 1000 registros). " : ""}Vencimientos registrados: ${counts.expired} vencidos recientemente, ${counts.today} hoy y ${counts.tomorrow} mañana. Consultá la lista completa en Étiquettes; no se modificó ningún registro.`, action: {type:"navigate",href:"/?tab=labels"}, counts, confirmationRequired:true });
  } catch {
    return json({ error: "Impossible de consulter les échéances." }, 503);
  }
}

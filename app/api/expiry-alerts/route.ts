import { authorize } from "@/lib/access";
import {recordLifecycle} from '@/lib/lifecycle-server';
import { isLocalDateTime } from "@/lib/labels";
import { db, json, sameOrigin } from "@/lib/server";
import { validUuid } from "@/lib/supply";
import { addCalendarDays, classifyExpiry } from "@/lib/weekly-report";

export const dynamic = "force-dynamic";

type AlertRow = {
  id: string;
  name: string;
  reference: string;
  expires_at: string;
  href: string;
  kind: "quick" | "classic";
  bucket?: ReturnType<typeof classifyExpiry>;
};

const lifecycleActions = ["consumed", "discarded", "transformed_frozen"] as const;
type LifecycleAction = (typeof lifecycleActions)[number];

function nowParisLocal() {
  const parts = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}`;
}

export async function GET(request: Request) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const localNow = new URL(request.url).searchParams.get("at") ?? "";
  if (!isLocalDateTime(localNow))
    return json({ error: "Date locale invalide." }, 400);
  const today = localNow.slice(0, 10),
    lower = `${addCalendarDays(today, -7)}T00:00`,
    upper = `${addCalendarDays(today, 2)}T00:00`;
  try {
    const [quickRows, classicRows] = await Promise.all([
      db()
        .prepare(
          `SELECT p.id,p.ingredient_name AS name,p.preparation_code AS reference,p.expires_at,
                  '/t/'||MIN(l.short_token) AS href
           FROM internal_preparations p
           LEFT JOIN physical_labels l ON l.owner_id=p.owner_id AND l.preparation_id=p.id
           WHERE p.owner_id=? AND p.deleted_at IS NULL AND p.status='prepared' AND p.expires_at>=? AND p.expires_at<?
           GROUP BY p.id ORDER BY p.expires_at LIMIT 100`,
        )
        .bind(auth.access.ownerId, lower, upper)
        .all<Record<string, unknown>>(),
      db()
        .prepare(
          `SELECT id,product_name AS name,lot_code AS reference,expires_at,'/preparations/'||id AS href
           FROM preparation_labels
           WHERE owner_id=? AND deleted_at IS NULL AND lifecycle_status='active' AND expires_at>=? AND expires_at<?
           ORDER BY expires_at LIMIT 100`,
        )
        .bind(auth.access.ownerId, lower, upper)
        .all<Record<string, unknown>>(),
    ]);
    const map = (row: Record<string, unknown>, kind: AlertRow["kind"]): AlertRow => ({
      id: String(row.id),
      name: String(row.name),
      reference: String(row.reference ?? ""),
      expires_at: String(row.expires_at),
      href: String(row.href),
      kind,
      bucket: classifyExpiry(String(row.expires_at), localNow),
    });
    const alerts = [
      ...quickRows.results.map((row) => map(row, "quick")),
      ...classicRows.results.map((row) => map(row, "classic")),
    ]
      .filter((row) => row.bucket !== "later")
      .sort((a, b) => a.expires_at.localeCompare(b.expires_at));
    return json({ alerts, localNow });
  } catch (error) {
    console.error("expiry alerts failed", error);
    return json({ error: "Les échéances ne peuvent pas être chargées." }, 503);
  }
}

export async function PATCH(request:Request){const auth=await authorize();if('response'in auth)return auth.response;if(!sameOrigin(request))return json({error:'Origine invalide.'},403);let payload:Record<string,unknown>;try{payload=await request.json();}catch{return json({error:'Données invalides.'},400);}try{return await recordLifecycle(auth.access,payload);}catch(e){console.error('lifecycle failed',e);return json({error:'L’action n’a pas pu être enregistrée.'},503);}}

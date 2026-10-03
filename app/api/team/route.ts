import { authorize, memberFromRow } from "@/lib/access";
import { db, json, sameOrigin } from "@/lib/server";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorize(true); if ("response" in auth) return auth.response;
  const rawOffset = new URL(request.url).searchParams.get("offset") ?? "0";
  if (!/^\d{1,7}$/.test(rawOffset)) return json({ error: "Page invalide." }, 400);
  const offset = Number(rawOffset);
  try {
    const result = await db().prepare("SELECT * FROM register_members WHERE owner_id=? ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END, requested_at DESC, id LIMIT 51 OFFSET ?")
      .bind(auth.access.ownerId, offset).all();
    return json({ members: result.results.slice(0, 50).map(row => memberFromRow(row as Record<string, unknown>)), nextOffset: result.results.length > 50 ? offset + 50 : null });
  } catch { return json({ error: "L’équipe ne peut pas être chargée. Réessayez." }, 503); }
}

export async function PUT(request: Request) {
  const auth = await authorize(true); if ("response" in auth) return auth.response;
  if (!sameOrigin(request)) return json({ error: "Origine invalide." }, 403);
  if (Number(request.headers.get("content-length")) > 2048) return json({ error: "Demande trop volumineuse." }, 413);
  let body: unknown; try { body = await request.json(); } catch { return json({ error: "Demande invalide." }, 400); }
  if (!body || typeof body !== "object") return json({ error: "Demande invalide." }, 400);
  const { id, revision, status, role } = body as Record<string, unknown>;
  if (typeof id !== "string" || !id || id.length > 128 || !Number.isSafeInteger(revision) || Number(revision) < 1 ||
    (status !== undefined && status !== "active" && status !== "revoked") ||
    (role !== undefined && role !== "admin" && role !== "contributor") ||
    (status === undefined && role === undefined)) return json({ error: "Demande invalide." }, 400);
  try {
    const current = await db().prepare("SELECT * FROM register_members WHERE id=? AND owner_id=? AND user_id<>?")
      .bind(id, auth.access.ownerId, auth.access.userId).first<Record<string, unknown>>();
    if (!current || Number(current.revision) !== Number(revision))
      return json({ error: "Cette demande a changé. Actualisez la liste avant de réessayer." }, 409);
    const nextStatus = status === "active" || status === "revoked" ? status : String(current.status);
    if (role === "admin" && nextStatus !== "active")
      return json({ error: "Activez d’abord l’accès avant de nommer cet utilisateur administrateur." }, 400);
    const nextRole = nextStatus === "revoked" ? "contributor" : role === "admin" || role === "contributor" ? role : current.role === "admin" ? "admin" : "contributor";
    const result = await db().prepare("UPDATE register_members SET status=?, role=?, revision=revision+1, updated_at=? WHERE id=? AND owner_id=? AND user_id<>? AND revision=?")
      .bind(nextStatus, nextRole, new Date().toISOString(), id, auth.access.ownerId, auth.access.userId, revision).run();
    if (!result.meta.changes) return json({ error: "Cette demande a changé. Actualisez la liste avant de réessayer." }, 409);
    const row = await db().prepare("SELECT * FROM register_members WHERE id=? AND owner_id=?").bind(id, auth.access.ownerId).first<Record<string, unknown>>();
    return json({ member: memberFromRow(row!) });
  } catch { return json({ error: "L’accès n’a pas pu être modifié. Réessayez." }, 503); }
}

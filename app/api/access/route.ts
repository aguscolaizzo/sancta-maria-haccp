import { getAccessContext, publicAccess } from "@/lib/access";
import { db, json, sameOrigin } from "@/lib/server";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const context = await getAccessContext();
    return json(publicAccess(context), context.status === "unavailable" ? 503 : 200);
  } catch { return json({ error: "Impossible de vérifier votre accès. Réessayez." }, 503); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Origine invalide." }, 403);
  if (Number(request.headers.get("content-length")) > 1024) return json({ error: "Demande trop volumineuse." }, 413);
  try {
    const context = await getAccessContext();
    if (!context.identity) return json({ error: "Connectez-vous avant de demander l’accès." }, 401);
    if (!context.ownerId) return json({ error: "L’accès au registre est indisponible." }, 503);
    if (context.status === "active" || context.status === "pending")
      return json(publicAccess(context));
    const now = new Date().toISOString();
    // Identity comes only from Sites, never from the request body or an email typed by a visitor.
    await db().prepare(`INSERT INTO register_members (id,owner_id,user_id,email,display_name,status,revision,requested_at,updated_at)
      VALUES (?,?,?,?,?,'pending',1,?,?)
      ON CONFLICT(owner_id,user_id) DO UPDATE SET
        email=excluded.email,
        display_name=excluded.display_name,
        status='pending',
        role='contributor',
        revision=register_members.revision+1,
        requested_at=excluded.requested_at,
        updated_at=excluded.updated_at
      WHERE register_members.status='revoked'`)
      .bind(crypto.randomUUID(), context.ownerId, context.identity.id, context.identity.email, context.identity.displayName, now, now).run();
    return json(publicAccess(await getAccessContext()), 201);
  } catch { return json({ error: "Votre demande n’a pas pu être enregistrée. Réessayez." }, 503); }
}

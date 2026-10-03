import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { db, json } from "./server";
import { canAdministerRegister, type AccessStatus, type PublicAccess, type RegisterRole, type TeamMember } from "./access-types";

type Identity = { id: string; email: string; displayName: string };
export type AccessContext = {
  status: AccessStatus; identity: Identity | null; ownerId: string | null;
  role: RegisterRole | null; memberRevision: number | null;
};
export type AuthorizedAccess = {
  ownerId: string; userId: string; role: RegisterRole;
  email: string; displayName: string; memberRevision: number | null;
};

export async function getAccessContext(): Promise<AccessContext> {
  const user = await getChatGPTUser();
  const id = (await headers()).get("oai-authenticated-user-id");
  const empty = { identity: null, ownerId: null, role: null, memberRevision: null };
  if (!user || !id) return { ...empty, status: "anonymous" };
  const identity = { id, email: user.email.slice(0, 320), displayName: user.displayName.slice(0, 200) };
  const ownerId = typeof env.REGISTER_OWNER_ID === "string" ? env.REGISTER_OWNER_ID.trim() : "";
  // No legacy/per-user fallback: missing configuration must never authorize a visitor.
  if (!ownerId) return { ...empty, identity, status: "unavailable" };
  if (id === ownerId) return { status: "active", identity, ownerId, role: "owner", memberRevision: null };
  const member = await db().prepare("SELECT status, role, revision FROM register_members WHERE owner_id=? AND user_id=?")
    .bind(ownerId, id).first<{ status: string; role: string; revision: number }>();
  const status = member?.status === "active" || member?.status === "pending" || member?.status === "revoked" ? member.status : "none";
  const memberRole: RegisterRole = member?.role === "admin" ? "admin" : "contributor";
  return { status, identity, ownerId, role: status === "active" ? memberRole : null, memberRevision: member?.revision ?? null };
}

export function publicAccess(context: AccessContext): PublicAccess {
  return { status: context.status, email: context.identity?.email ?? null, displayName: context.identity?.displayName ?? null };
}

export async function authorize(required: boolean | "admin" = false): Promise<{ access: AuthorizedAccess } | { response: Response }> {
  try {
    const context = await getAccessContext();
    if (context.status === "anonymous") return { response: json({ error: "Connectez-vous avec votre compte ChatGPT." }, 401) };
    if (context.status === "unavailable") return { response: json({ error: "L’accès au registre est indisponible. Réessayez plus tard." }, 503) };
    if (!context.role || !context.identity || !context.ownerId) return { response: json({ error: "Votre compte n’est pas autorisé à accéder au registre. Rouvrez l’application pour vérifier votre accès." }, 403) };
    if (required === true && context.role !== "owner") return { response: json({ error: "Cette action est réservée au propriétaire du registre." }, 403) };
    if (required === "admin" && !canAdministerRegister(context.role)) return { response: json({ error: "Cette action est réservée à un administrateur." }, 403) };
    return { access: { ownerId: context.ownerId, userId: context.identity.id, role: context.role,
      email: context.identity.email, displayName: context.identity.displayName, memberRevision: context.memberRevision } };
  } catch {
    return { response: json({ error: "Impossible de vérifier votre accès. Aucune donnée n’a été modifiée." }, 503) };
  }
}

export function memberFromRow(row: Record<string, unknown>): TeamMember {
  return { id: String(row.id), email: String(row.email), displayName: String(row.display_name),
    status: row.status as TeamMember["status"], revision: Number(row.revision),
    role: row.role === "admin" ? "admin" : "contributor",
    requestedAt: String(row.requested_at), updatedAt: String(row.updated_at) };
}

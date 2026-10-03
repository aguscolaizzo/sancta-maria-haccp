export type AccessStatus = "anonymous" | "unavailable" | "none" | "pending" | "active" | "revoked";
export type RegisterRole = "owner" | "admin" | "contributor";
export type RegisterSession = { role: RegisterRole; email: string; displayName: string };
export type PublicAccess = { status: AccessStatus; email: string | null; displayName: string | null };
export type TeamMember = {
  id: string; email: string; displayName: string;
  status: "pending" | "active" | "revoked";
  role: Exclude<RegisterRole, "owner">;
  revision: number; requestedAt: string; updatedAt: string;
};

export function canAdministerRegister(role: RegisterRole | null | undefined) {
  return role === "owner" || role === "admin";
}

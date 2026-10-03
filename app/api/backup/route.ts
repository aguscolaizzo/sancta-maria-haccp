import { env } from "cloudflare:workers";
import { authorize } from "@/lib/access";
import { createCompleteBackup } from "@/lib/complete-backup";
import { db, json, media } from "@/lib/server";

export const dynamic = "force-dynamic";
let exporting = false;

export async function GET(request: Request) {
  const auth = await authorize(true);
  if ("response" in auth) return auth.response;
  if (request.headers.get("sec-fetch-site") === "cross-site") return json({ error: "Ouvrez la page Sauvegarde dans l’application." }, 403);
  if (exporting) return json({ error: "Une sauvegarde est en cours. Réessayez dans un instant." }, 429);
  exporting = true;
  try {
    const configuration = {
      projectId: "appgprj_6a988b25a3908191bce47dcc8ad65c97",
      bindings: { d1: "DB", r2: "MEDIA" },
      environment: {
        REGISTER_OWNER_ID: env.REGISTER_OWNER_ID ?? null,
        IGNORED_READING_IDS: env.IGNORED_READING_IDS ?? null,
        WORKBOOK_URL: env.WORKBOOK_URL ?? null,
        WORKBOOK_SYNC_ACTIVE: env.WORKBOOK_SYNC_ACTIVE ?? null,
        READING_IMPORT_JSON: env.READING_IMPORT_JSON ?? null,
      },
      protectedEnvironmentKeys: ["READING_IMPORT_JSON"],
      note: "Les identifiants de plateforme et sessions ne sont pas exportés. Conserver ce fichier en privé.",
    };
    const result = await createCompleteBackup(db(), media(), configuration);
    const stamp = result.manifest.databaseCapturedAt.replaceAll(":", "-").replace(/\.\d+Z$/, "Z");
    return new Response(result.bytes as unknown as BodyInit, { headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="Sancta_Maria_HACCP_Backup_Complet_${stamp}.zip"`,
      "Content-Length": String(result.bytes.byteLength),
      "Cache-Control": "private, no-store, max-age=0",
      "Vary": "Cookie", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    console.error("complete backup failed", error instanceof Error ? error.message : "unknown error");
    return json({ error: error instanceof Error ? error.message : "Sauvegarde impossible. Aucune donnée n’a été modifiée." }, 503);
  } finally {
    exporting = false;
  }
}

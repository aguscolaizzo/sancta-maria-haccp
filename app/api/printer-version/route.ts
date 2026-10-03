import { authorize } from "@/lib/access";
import { PRINTER_CLIENT_VERSION } from "@/lib/printer-version";
import { json } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await authorize("admin");
  if ("response" in auth) return auth.response;
  return json({ version: PRINTER_CLIENT_VERSION });
}

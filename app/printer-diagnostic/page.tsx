import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import AccessGate from "@/app/access-gate";
import { chatGPTSignInPath, chatGPTSignOutPath } from "@/app/chatgpt-auth";
import { getAccessContext, publicAccess } from "@/lib/access";
import { canAdministerRegister } from "@/lib/access-types";
import PrinterDiagnosticClient from "./printer-diagnostic-client";

export const dynamic = "force-dynamic";

export default async function PrinterDiagnosticPage() {
  const context = await getAccessContext();
  if (
    context.status !== "active" ||
    !context.identity ||
    !context.ownerId ||
    !canAdministerRegister(context.role)
  )
    return (
      <AccessGate
        access={publicAccess(context)}
        signInPath={chatGPTSignInPath("/printer-diagnostic")}
        signOutPath={chatGPTSignOutPath("/printer-diagnostic")}
      />
    );
  return (
    <div className="detail-shell diagnostic-shell">
      <main className="detail-card diagnostic-card">
        <div className="diagnostic-heading">
          <Link href="/" className="button"><ArrowLeft size={16} /> Retour HACCP</Link>
          <span><LockKeyhole size={15} /> Administrateur uniquement</span>
        </div>
        <PrinterDiagnosticClient />
      </main>
    </div>
  );
}

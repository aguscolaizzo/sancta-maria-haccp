"use client";

import { FileDown } from "lucide-react";

export default function HaccpReportPrintButton() {
  return (
    <button type="button" className="button primary" onClick={() => window.print()}>
      <FileDown size={17} />
      Imprimer / enregistrer le PDF A4
    </button>
  );
}

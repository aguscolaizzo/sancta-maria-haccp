"use client";

import { Printer } from "lucide-react";

export default function ReceptionPrintButton() {
  return (
    <button className="button primary" onClick={() => window.print()}>
      <Printer size={17} />
      Imprimer / enregistrer en PDF
    </button>
  );
}

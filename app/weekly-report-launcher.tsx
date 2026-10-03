"use client";

import { ShieldCheck } from "lucide-react";
import ReportRangeForm from "./report-range-form";

function parisToday() {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function WeeklyReportLauncher() {
  const today = parisToday();
  return (
    <div className="weekly-launcher panel panel-pad">
      <div className="weekly-launcher-heading">
        <span><ShieldCheck size={29} /></span>
        <div>
          <p className="eyebrow">Synthèse HACCP</p>
          <h2>Rapport d’activité HACCP A4</h2>
          <p>Températures, réceptions, préparations, refroidissements, étiquettes et impressions réunis dans un seul rapport.</p>
        </div>
      </div>
      <ReportRangeForm
        initialPeriod="week"
        initialStart={today}
        initialEnd={today}
      />
    </div>
  );
}

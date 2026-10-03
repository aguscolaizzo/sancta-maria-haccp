/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileDown, ShieldCheck } from "lucide-react";
import AccessGate from "@/app/access-gate";
import { chatGPTSignInPath, chatGPTSignOutPath } from "@/app/chatgpt-auth";
import HaccpReportPrintButton from "@/app/haccp-report-print-button";
import ReportRangeForm from "@/app/report-range-form";
import { getAccessContext, publicAccess } from "@/lib/access";
import { PROCESS_LABELS, type ProcessType } from "@/lib/labels";
import { OPERATION_LABELS, type OperationType } from "@/lib/quick-labels";
import { db } from "@/lib/server";
import {
  parisLocalToUtc,
  reportRangeQuery,
  resolveReportRange,
  type ReportPeriod,
} from "@/lib/weekly-report";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

const number = (value: unknown) => Number(value ?? 0);
const text = (value: unknown) => String(value ?? "");
const shortDate = (value: string) => value.split("-").reverse().join("/");
const shortDateTime = (value: unknown) => {
  const raw = text(value);
  if (/^20\d\d-\d\d-\d\dT\d\d:\d\d$/.test(raw))
    return `${shortDate(raw.slice(0, 10))} ${raw.slice(11, 16)}`;
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(raw));
  } catch {
    return raw || "—";
  }
};

function todayParis() {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function readingDeviations(row: Row) {
  try {
    const temperatures = JSON.parse(text(row.temperatures)) as Record<string, number>;
    const thresholds = JSON.parse(text(row.thresholds)) as Record<string, number>;
    return Object.keys(thresholds).filter(
      (key) => Number.isFinite(Number(temperatures[key])) && Number(temperatures[key]) > Number(thresholds[key]),
    );
  } catch {
    return ["données illisibles"];
  }
}

const receptionStatus: Record<string, string> = {
  in_progress: "En cours",
  compliant: "Conforme",
  compliant_after_probe: "Conforme après sonde",
  non_compliant: "Non conforme",
  refused: "Refusée",
};

const finalStatus: Record<string, string> = {
  active: "Active",
  prepared: "Active",
  expired: "Expirée",
  consumed: "Utilisée",
  discarded: "Jetée",
  transformed_frozen: "Transformée · congelée",
};

function Header({ subtitle }: { subtitle: string }) {
  return (
    <header className="weekly-report-header">
      <div className="weekly-report-brand">
        <img src="/sancta-maria-1187-logo.jpg" alt="Sancta Maria 1187" width={58} height={58} />
        <div><strong>SANCTA MARIA <span>1187</span></strong><small>TRAÇABILITÉ HACCP</small></div>
      </div>
      <span>{subtitle}</span>
    </header>
  );
}

function Footer({ range, page }: { range: { start: string; end: string }; page: number }) {
  const dates = range.start === range.end
    ? shortDate(range.start)
    : `${shortDate(range.start)}–${shortDate(range.end)}`;
  return <footer>Sancta Maria 1187 · Rapport HACCP · {dates} <span>Page {page}</span></footer>;
}

const periodTitles: Record<
  ReportPeriod,
  { header: string; title: string; controls: string }
> = {
  day: {
    header: "RAPPORT JOURNALIER",
    title: "Rapport journalier de l’activité HACCP",
    controls: "Contrôles de la journée",
  },
  week: {
    header: "RAPPORT HEBDOMADAIRE",
    title: "Rapport hebdomadaire de l’activité HACCP",
    controls: "Contrôles de la semaine",
  },
  month: {
    header: "RAPPORT MENSUEL",
    title: "Rapport mensuel de l’activité HACCP",
    controls: "Contrôles du mois",
  },
  custom: {
    header: "RAPPORT PERSONNALISÉ",
    title: "Rapport de l’activité HACCP",
    controls: "Contrôles de la période",
  },
};

export default async function WeeklyReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams,
    range = resolveReportRange(params, todayParis()),
    wording = periodTitles[range.period],
    context = await getAccessContext(),
    returnTo = `/reports/weekly?${reportRangeQuery(range)}`;
  if (context.status !== "active" || !context.identity || !context.role || !context.ownerId)
    return <AccessGate access={publicAccess(context)} signInPath={chatGPTSignInPath(returnTo)} signOutPath={chatGPTSignOutPath(returnTo)} />;

  const localStart = `${range.start}T00:00`,
    localNext = `${range.next}T00:00`,
    utcStart = parisLocalToUtc(localStart),
    utcNext = parisLocalToUtc(localNext),
    ownerId = context.ownerId;
  const [readingsResult, classicResult, quickResult, receptionsResult, printResult, auditResult] = await Promise.all([
    db().prepare("SELECT * FROM readings WHERE owner_id=? AND date>=? AND date<=? ORDER BY date,time").bind(ownerId, range.start, range.end).all<Row>(),
    db().prepare(
      `SELECT id,product_name,lot_code,process_type,prepared_at,expires_at,operator_initials,storage_temperature,control_status,lifecycle_status,lifecycle_updated_at,lifecycle_updated_by_name,
              cooling_started_at,cooling_start_temperature,cooling_ended_at,cooling_end_temperature,cooling_duration_minutes,cooling_compliant,
              frozen_at,freeze_method,freezer_temperature,supplier_name
       FROM preparation_labels WHERE owner_id=? AND deleted_at IS NULL AND prepared_at>=? AND prepared_at<? ORDER BY prepared_at`,
    ).bind(ownerId, localStart, localNext).all<Row>(),
    db().prepare(
      `SELECT p.id,p.preparation_code,p.ingredient_name,p.operation_type,p.prepared_at,p.expires_at,p.operator_initials,p.storage_temperature,p.status,p.updated_at,p.updated_by_name,
              COUNT(DISTINCT b.id) AS bac_count,COUNT(DISTINCT l.id) AS label_count,
              GROUP_CONCAT(DISTINCT l.label_code) AS label_references
       FROM internal_preparations p
       LEFT JOIN preparation_bacs b ON b.owner_id=p.owner_id AND b.preparation_id=p.id
       LEFT JOIN physical_labels l ON l.owner_id=p.owner_id AND l.preparation_id=p.id
       WHERE p.owner_id=? AND p.deleted_at IS NULL AND p.prepared_at>=? AND p.prepared_at<?
       GROUP BY p.id ORDER BY p.prepared_at`,
    ).bind(ownerId, localStart, localNext).all<Row>(),
    db().prepare(
      `SELECT r.id,r.reception_code,r.created_at,r.supplier_name,r.delivery_note,r.status,r.validated_by_name,
              COUNT(rp.id) AS product_count,
              SUM(CASE WHEN rp.decision_type IS NOT NULL OR rp.product_compliant=0 OR rp.packaging_compliant=0 OR rp.visual_compliant=0 THEN 1 ELSE 0 END) AS issue_count
       FROM receptions r LEFT JOIN reception_products rp ON rp.owner_id=r.owner_id AND rp.reception_id=r.id AND rp.deleted_at IS NULL
       WHERE r.owner_id=? AND r.created_at>=? AND r.created_at<? GROUP BY r.id ORDER BY r.created_at`,
    ).bind(ownerId, utcStart, utcNext).all<Row>(),
    db().prepare(
      `SELECT
        (SELECT COALESCE(SUM(copies),0) FROM label_print_events WHERE owner_id=? AND printed_at>=? AND printed_at<?) AS classic_prints,
        (SELECT COUNT(*) FROM label_print_attempts WHERE owner_id=? AND outcome='printed' AND completed_at>=? AND completed_at<?) AS quick_prints`,
    ).bind(ownerId, utcStart, utcNext, ownerId, utcStart, utcNext).first<Row>(),
    db().prepare(
      `SELECT
        (SELECT COUNT(*) FROM traceability_audit_events WHERE owner_id=? AND changed_at>=? AND changed_at<?) +
        (SELECT COUNT(*) FROM reception_audit_events WHERE owner_id=? AND changed_at>=? AND changed_at<?) AS total`,
    ).bind(ownerId, utcStart, utcNext, ownerId, utcStart, utcNext).first<Row>(),
  ]);

  const readings = readingsResult.results,
    classic = classicResult.results,
    quick = quickResult.results,
    receptions = receptionsResult.results,
    cooling = classic.filter((row) => text(row.process_type) === "cooked_cooled"),
    freezing = classic.filter((row) => text(row.process_type) === "frozen_in_house"),
    readingIssues = readings.reduce((sum, row) => sum + readingDeviations(row).length, 0),
    receptionIssues = receptions.reduce((sum, row) => sum + number(row.issue_count), 0),
    labelIssues = classic.filter((row) => text(row.control_status) === "non_compliant").length,
    totalLabels = classic.length + quick.reduce((sum, row) => sum + number(row.label_count), 0),
    totalPreparations = classic.length + quick.length,
    printed = number(printResult?.classic_prints) + number(printResult?.quick_prints),
    suppliers = new Set([
      ...receptions.map((row) => text(row.supplier_name)).filter(Boolean),
      ...classic.map((row) => text(row.supplier_name)).filter(Boolean),
    ]),
    issueTotal = readingIssues + receptionIssues + labelIssues;

  const operationCounts = new Map<string, number>();
  for (const row of classic) {
    const key = PROCESS_LABELS[text(row.process_type) as ProcessType] ?? text(row.process_type);
    operationCounts.set(key, (operationCounts.get(key) ?? 0) + 1);
  }
  for (const row of quick) {
    const key = OPERATION_LABELS[text(row.operation_type) as OperationType] ?? text(row.operation_type);
    operationCounts.set(key, (operationCounts.get(key) ?? 0) + 1);
  }
  const operations = [...operationCounts.entries()].sort((a, b) => b[1] - a[1]);
  const preparationCounts = new Map<string, number>();
  for (const row of classic) preparationCounts.set(text(row.product_name), (preparationCounts.get(text(row.product_name)) ?? 0) + 1);
  for (const row of quick) preparationCounts.set(text(row.ingredient_name), (preparationCounts.get(text(row.ingredient_name)) ?? 0) + number(row.label_count));
  const top = [...preparationCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
    topMaximum = Math.max(1, ...top.map((entry) => entry[1]));
  const journal = [
    ...classic.map((row) => ({
      date: text(row.prepared_at), name: text(row.product_name), operation: PROCESS_LABELS[text(row.process_type) as ProcessType] ?? text(row.process_type),
      operator: text(row.operator_initials), temperature: row.storage_temperature, quantity: 1, state: text(row.lifecycle_status) !== "active" ? (finalStatus[text(row.lifecycle_status)] ?? text(row.lifecycle_status)) : text(row.control_status) === "non_compliant" ? "Écart documenté" : "Active",
      stateAt: text(row.lifecycle_status) !== "active" ? text(row.lifecycle_updated_at) : "", stateBy: text(row.lifecycle_status) !== "active" ? text(row.lifecycle_updated_by_name) : "",
      reference: `Lot ${text(row.lot_code) || "—"} · ID ${text(row.id).slice(0, 8).toUpperCase()}`,
    })),
    ...quick.map((row) => ({
      date: text(row.prepared_at), name: text(row.ingredient_name), operation: OPERATION_LABELS[text(row.operation_type) as OperationType] ?? text(row.operation_type),
      operator: text(row.operator_initials), temperature: row.storage_temperature, quantity: number(row.label_count), state: finalStatus[text(row.status)] ?? text(row.status),
      stateAt: text(row.status) !== "prepared" ? text(row.updated_at) : "", stateBy: text(row.status) !== "prepared" ? text(row.updated_by_name) : "",
      reference: `${text(row.preparation_code)}${text(row.label_references) ? ` · ${text(row.label_references).split(",").join(" · ")}` : ""}`,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="weekly-report-shell">
      <style>{`@media print{
        @page{size:A4 portrait;margin:0}
        html,body{background:#fff!important}
        .weekly-report-shell{padding:0!important;background:#fff!important}
        .weekly-report-actions{display:none!important}
        .weekly-report-document{width:210mm!important;max-width:none!important;margin:0!important;box-shadow:none!important}
        .weekly-report-page{width:210mm!important;min-height:297mm!important;padding:12mm 13mm 11mm!important;break-after:page!important;page-break-after:always!important}
        .weekly-report-page:last-child{break-after:auto!important;page-break-after:auto!important}
        .weekly-report-section,.weekly-kpi,.weekly-note,.weekly-report-header{break-inside:avoid-page!important;page-break-inside:avoid!important}
        .weekly-table thead{display:table-header-group}
        .weekly-table tr{break-inside:avoid-page!important;page-break-inside:avoid!important}
        .weekly-report-page *{print-color-adjust:exact!important;-webkit-print-color-adjust:exact!important}
        p,td,small{orphans:3;widows:3}
      }`}</style>
      <div className="weekly-report-actions no-print">
        <Link className="button" href="/?tab=reports"><ArrowLeft size={16} /> Retour à l’application</Link>
        <ReportRangeForm
          variant="toolbar"
          initialPeriod={range.period}
          initialStart={range.start}
          initialEnd={range.end}
        />
        <HaccpReportPrintButton />
      </div>
      <main className="weekly-report-document">
        <section className="weekly-report-page">
          <Header subtitle={wording.header} />
          <div className="weekly-report-title"><p>{wording.title}</p><h1>{range.start === range.end ? shortDate(range.start) : <>Du {shortDate(range.start)} au {shortDate(range.end)}</>}</h1><span>Généré le {shortDateTime(new Date().toISOString())} · {context.identity.displayName}</span></div>
          <div className="weekly-kpis">
            <div className="weekly-kpi"><strong>{totalLabels}</strong><span>étiquettes créées</span><small>{printed} transmissions imprimées enregistrées</small></div>
            <div className="weekly-kpi"><strong>{totalPreparations}</strong><span>préparations distinctes</span><small>classiques et mise en place rapide</small></div>
            <div className="weekly-kpi"><strong>{readings.length}</strong><span>relevés du froid</span><small>{readingIssues ? `${readingIssues} dépassement(s)` : "aucun dépassement détecté"}</small></div>
            <div className="weekly-kpi"><strong>{receptions.length}</strong><span>réceptions contrôlées</span><small>{suppliers.size} fournisseur(s) référencé(s)</small></div>
          </div>
          <section className="weekly-report-section">
            <h2>Répartition des opérations</h2>
            <table className="weekly-table"><thead><tr><th>Opération tracée</th><th>Nombre</th><th>Part</th></tr></thead><tbody>{operations.map(([name, count]) => <tr key={name}><td>{name}</td><td>{count}</td><td>{totalPreparations ? Math.round(count / totalPreparations * 100) : 0} %</td></tr>)}{!operations.length && <tr><td colSpan={3}>Aucune préparation enregistrée sur cette période.</td></tr>}</tbody></table>
          </section>
          <section className="weekly-report-section">
            <h2>Préparations les plus enregistrées</h2>
            <div className="weekly-bars">{top.map(([name, count]) => <div key={name}><span>{name}</span><i><b style={{ width: `${Math.max(8, count / topMaximum * 100)}%` }} /></i><strong>{count}</strong></div>)}{!top.length && <p>Aucune préparation enregistrée.</p>}</div>
          </section>
          <div className={`weekly-note ${issueTotal ? "warning" : "success"}`}>
            {issueTotal ? <ShieldCheck size={21} /> : <CheckCircle2 size={21} />}
            <div><strong>{issueTotal ? `${issueTotal} écart(s) ou non-conformité(s) à revoir` : "Aucun écart détecté sur la période sélectionnée"}</strong><p>Le rapport synthétise uniquement les informations effectivement saisies dans Sancta Maria HACCP.</p></div>
          </div>
          <Footer range={range} page={1} />
        </section>

        <section className="weekly-report-page">
          <Header subtitle="MAÎTRISE DU FROID" />
          <div className="weekly-report-title compact"><p>Températures et refroidissements</p><h1>{wording.controls}</h1></div>
          <section className="weekly-report-section">
            <h2>Relevés quotidiens des équipements</h2>
            <table className="weekly-table"><thead><tr><th>Date / heure</th><th>Op.</th><th>Contrôle</th><th>Écart / action</th></tr></thead><tbody>{readings.map((row) => { const deviations = readingDeviations(row); return <tr key={text(row.id)}><td>{shortDate(text(row.date))} · {text(row.time)}</td><td>{text(row.initials)}</td><td className={deviations.length ? "bad" : "good"}>{deviations.length ? `${deviations.length} seuil(s) dépassé(s)` : "Conforme"}</td><td>{text(row.note) || "—"}</td></tr>; })}{!readings.length && <tr><td colSpan={4}>Aucun relevé de température enregistré.</td></tr>}</tbody></table>
          </section>
          <section className="weekly-report-section">
            <h2>Maîtrise du refroidissement</h2>
            <div className="weekly-inline-kpis"><span><strong>{cooling.length}</strong> refroidissement(s)</span><span><strong>{cooling.filter((row) => Boolean(row.cooling_compliant)).length}</strong> conforme(s)</span><span><strong>{cooling.length ? Math.round(cooling.reduce((sum, row) => sum + number(row.cooling_duration_minutes), 0) / cooling.length) : 0} min</strong> durée moyenne</span></div>
            <table className="weekly-table"><thead><tr><th>Préparation / référence</th><th>Op.</th><th>Début · date / heure</th><th>Fin · date / heure</th><th>Durée</th><th>Contrôle</th></tr></thead><tbody>{cooling.map((row) => <tr key={text(row.id)}><td>{text(row.product_name)}<small>Lot {text(row.lot_code) || "—"} · ID {text(row.id).slice(0, 8).toUpperCase()}</small></td><td>{text(row.operator_initials)}</td><td>{shortDateTime(row.cooling_started_at)}<small>T° {text(row.cooling_start_temperature) || "—"} °C</small></td><td>{shortDateTime(row.cooling_ended_at)}<small>T° {text(row.cooling_end_temperature) || "—"} °C</small></td><td>{text(row.cooling_duration_minutes) || "—"} min</td><td className={Boolean(row.cooling_compliant) ? "good" : "bad"}>{Boolean(row.cooling_compliant) ? "Conforme" : "À vérifier"}</td></tr>)}{!cooling.length && <tr><td colSpan={6}>Aucun refroidissement enregistré sur cette période.</td></tr>}</tbody></table>
          </section>
          <section className="weekly-report-section">
            <h2>Maîtrise de la congélation</h2>
            <table className="weekly-table"><thead><tr><th>Préparation / référence</th><th>Op.</th><th>Congélation · date / heure</th><th>Méthode</th><th>T° congélateur</th><th>Contrôle</th></tr></thead><tbody>{freezing.map((row) => <tr key={text(row.id)}><td>{text(row.product_name)}<small>Lot {text(row.lot_code) || "—"} · ID {text(row.id).slice(0, 8).toUpperCase()}</small></td><td>{text(row.operator_initials)}</td><td>{shortDateTime(row.frozen_at)}</td><td>{text(row.freeze_method) || "—"}</td><td>{row.freezer_temperature === null || row.freezer_temperature === undefined ? "—" : `${row.freezer_temperature} °C`}</td><td className={text(row.control_status) === "compliant" ? "good" : "bad"}>{text(row.control_status) === "compliant" ? "Conforme" : "À vérifier"}</td></tr>)}{!freezing.length && <tr><td colSpan={6}>Aucune congélation maison enregistrée sur cette période.</td></tr>}</tbody></table>
          </section>
          <div className="weekly-note"><FileDown size={21} /><div><strong>Règle de présentation</strong><p>Les titres et lignes de tableau ne sont jamais coupés entre deux pages lors de l’impression A4.</p></div></div>
          <Footer range={range} page={2} />
        </section>

        <section className="weekly-report-page">
          <Header subtitle="RÉCEPTIONS & TRAÇABILITÉ" />
          <div className="weekly-report-title compact"><p>Journal consolidé</p><h1>Réceptions, lots et étiquettes</h1></div>
          <section className="weekly-report-section">
            <h2>Réceptions marchandises</h2>
            <table className="weekly-table"><thead><tr><th>Date</th><th>Réception / BL</th><th>Fournisseur</th><th>Produits</th><th>Résultat</th></tr></thead><tbody>{receptions.map((row) => <tr key={text(row.id)}><td>{shortDateTime(row.created_at)}</td><td>{text(row.reception_code)}<small>{text(row.delivery_note) ? `BL ${text(row.delivery_note)}` : ""}</small></td><td>{text(row.supplier_name) || "—"}</td><td>{number(row.product_count)}</td><td className={text(row.status).includes("non_") || text(row.status) === "refused" ? "bad" : "good"}>{receptionStatus[text(row.status)] ?? text(row.status)}{number(row.issue_count) ? ` · ${number(row.issue_count)} anomalie(s)` : ""}</td></tr>)}{!receptions.length && <tr><td colSpan={5}>Aucune réception enregistrée sur cette période.</td></tr>}</tbody></table>
          </section>
          <section className="weekly-report-section weekly-journal-section">
            <h2>Journal des préparations et étiquettes</h2>
            <table className="weekly-table"><thead><tr><th>Date / heure</th><th>Préparation / référence étiquette</th><th>Opération</th><th>Op.</th><th>Conservation</th><th>Qté étiq.</th></tr></thead><tbody>{journal.map((row, index) => <tr key={`${row.date}-${row.name}-${index}`}><td>{shortDateTime(row.date)}</td><td>{row.name}<small>Réf. {row.reference}</small><small>{row.state}{row.stateAt ? ` · ${shortDateTime(row.stateAt)}${row.stateBy ? ` · ${row.stateBy}` : ""}` : ""}</small></td><td>{row.operation}</td><td>{row.operator}</td><td>{row.temperature === null || row.temperature === undefined ? "—" : `${number(row.temperature) > 0 ? "+" : ""}${row.temperature} °C`}</td><td>{row.quantity}</td></tr>)}{!journal.length && <tr><td colSpan={6}>Aucune étiquette enregistrée sur cette période.</td></tr>}</tbody></table>
          </section>
          <div className="weekly-note"><ShieldCheck size={21} /><div><strong>Intégrité et méthode</strong><p>{number(auditResult?.total)} événement(s) d’audit enregistré(s) sur cette période. Les quantités d’impression correspondent aux transmissions marquées réussies par l’application et ne remplacent pas un contrôle visuel de l’étiquette physique.</p></div></div>
          <Footer range={range} page={3} />
        </section>
      </main>
    </div>
  );
}

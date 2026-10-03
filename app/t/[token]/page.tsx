import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChefHat,
  CircleAlert,
  History,
  Package,
  Printer,
  QrCode,
  Snowflake,
  Tag,
  Thermometer,
  Truck,
  UserRound,
} from "lucide-react";
import AccessGate from "@/app/access-gate";
import { chatGPTSignInPath, chatGPTSignOutPath } from "@/app/chatgpt-auth";
import HaccpReportPrintButton from "@/app/haccp-report-print-button";
import PreparationLineage from "@/app/preparation-lineage";
import { getAccessContext, publicAccess } from "@/lib/access";
import { OPERATION_LABELS, type OperationType } from "@/lib/quick-labels";
import { TraceabilityService } from "@/lib/traceability-service";

export const dynamic = "force-dynamic";

const show = (value: unknown) =>
  value === null || value === undefined || value === "" ? "Non renseigné" : String(value);
const STATUS_LABELS: Record<string, string> = {
  prepared: "Préparation active",
  to_print: "À imprimer",
  printing: "Impression en cours",
  printed: "Étiquette imprimée",
  print_error: "Erreur d’impression",
  expired: "Expirée",
  discarded: "Produit déclaré jeté",
  consumed: "Étiquette déclarée utilisée",
  transformed_frozen: "Produit transformé · congelé",
};
const dateTime = (value: unknown) => {
  if (!value) return "Non renseigné";
  const raw = String(value);
  if (/^20\d\d-\d\d-\d\dT\d\d:\d\d$/.test(raw)) return raw.replace("T", " · ");
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(raw));
  } catch {
    return raw;
  }
};

export default async function ShortTracePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params,
    context = await getAccessContext(),
    returnTo = `/t/${token}`;
  if (
    context.status !== "active" ||
    !context.identity ||
    !context.ownerId ||
    !context.role
  )
    return (
      <AccessGate
        access={publicAccess(context)}
        signInPath={chatGPTSignInPath(returnTo)}
        signOutPath={chatGPTSignOutPath(returnTo)}
      />
    );
  const trace = await new TraceabilityService(context.ownerId).byShortToken(token);
  if (!trace)
    return (
      <div className="detail-shell"><main className="detail-card"><QrCode size={38} /><h1>Étiquette introuvable</h1><p>Ce QR n’existe pas dans ce registre.</p><Link className="button primary" href="/"><ArrowLeft size={16} /> Retour</Link></main></div>
    );
  const label = trace.label,
    snapshot = (() => {
      try {
        return JSON.parse(String(label.technical_snapshot ?? "{}"));
      } catch {
        return {};
      }
    })() as Record<string, unknown>;
  const temperature = label.storage_temperature === null
    ? "Non renseignée"
    : `${Number(label.storage_temperature) > 0 ? "+" : ""}${label.storage_temperature} °C`,
    preparationStatus = String(label.status ?? "prepared"),
    displayedStatus = preparationStatus === "prepared"
      ? String(label.label_status ?? "to_print")
      : preparationStatus,
    finalStatus = ["discarded", "consumed", "transformed_frozen"].includes(
      preparationStatus,
    );
  return (
    <div className="detail-shell">
      <div className="detail-report-wrap">
        <style>{`@media print{
          @page{size:A4 portrait;margin:10mm}
          .detail-shell{display:block!important;min-height:0!important;padding:0!important;background:#fff!important}
          .detail-report-wrap{width:100%!important;max-width:none!important}
          .detail-card{width:100%!important;max-width:none!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important}
          .detail-section>h2{break-after:avoid-page!important;page-break-after:avoid!important}
          .detail-grid>div,.detail-note,.privacy-note,.detail-brand{break-inside:avoid-page!important;page-break-inside:avoid!important}
          .detail-brand-logo{print-color-adjust:exact!important;-webkit-print-color-adjust:exact!important}
          p,dd,small{orphans:3;widows:3}
        }`}</style>
        <div className="detail-report-actions no-print">
          <Link className="button" href="/">
            <ArrowLeft size={16} /> Retour au registre HACCP
          </Link>
          <HaccpReportPrintButton />
        </div>
        <main className="detail-card preparation-detail trace-detail">
        <div className="detail-brand"><span className="detail-brand-logo brand-logo" aria-hidden="true" /><div>SANCTA MARIA <span>1187</span><small>FICHE DE TRAÇABILITÉ HACCP</small></div></div>
        <div className={`detail-status ${displayedStatus === "discarded" ? "detail-status-alert" : ""}`}>
          {displayedStatus === "discarded" ? <CircleAlert size={18} /> : displayedStatus === "transformed_frozen" ? <Snowflake size={18} /> : <CheckCircle2 size={18} />} {STATUS_LABELS[displayedStatus] ?? show(displayedStatus).replaceAll("_", " ")}
          {finalStatus && label.updated_at ? ` · ${dateTime(label.updated_at)}` : ""}
          {finalStatus && label.updated_by_name ? ` · ${show(label.updated_by_name)}` : ""}
        </div>
        <h1>{show(label.ingredient_name)}</h1>
        <p className="detail-id">{show(label.label_code)} · {show(label.bac_code)}</p>
        <PreparationLineage ownerId={context.ownerId} kind="quick" id={String(label.preparation_id)}/>
        <section className="detail-section">
          <h2><Tag size={18} /> Fiche technique de l’ingrédient</h2>
          <dl className="detail-grid">
            <div><dt>Nom court</dt><dd>{show(label.short_name)}</dd></div>
            <div><dt>Famille / type</dt><dd>{show(label.category)} · {show(label.product_type)}</dd></div>
            <div><dt>Allergènes</dt><dd>{show(snapshot.allergens)}</dd></div>
            <div><dt><Thermometer size={17} /> Conservation</dt><dd>{temperature} · {show(snapshot.conservation)}</dd></div>
            <div className="wide"><dt>Description</dt><dd>{show(snapshot.description)}</dd></div>
            <div className="wide"><dt>Procédure de préparation</dt><dd>{show(snapshot.preparationProcedure)}</dd></div>
          </dl>
        </section>
        <section className="detail-section">
          <h2><ChefHat size={18} /> Préparation interne et bac</h2>
          <dl className="detail-grid">
            <div><dt>ID préparation</dt><dd>{show(label.preparation_code)}</dd></div>
            <div><dt><Package size={17} /> Bac</dt><dd>{show(label.bac_code)} · n° {show(label.bac_index)}</dd></div>
            <div><dt>Opération</dt><dd>{OPERATION_LABELS[String(label.operation_type) as OperationType] ?? show(label.operation_type)}</dd></div>
            <div><dt><CalendarClock size={17} /> Préparé</dt><dd>{dateTime(label.prepared_at)}</dd></div>
            <div className="deadline"><dt>DLC appliquée</dt><dd>{dateTime(label.expires_at)}</dd></div>
            <div><dt><UserRound size={17} /> Responsable</dt><dd>{show(label.created_by_name)} · {show(label.operator_initials)}</dd></div>
            <div><dt>Nombre de bacs</dt><dd>{show(label.bac_count)}</dd></div>
            <div><dt>État préparation / bac</dt><dd>{show(label.status)} · {show(label.bac_status)}</dd></div>
          </dl>
          {label.manual_source_lot ? <p className="detail-note"><strong>Lot d’origine saisi manuellement :</strong> {show(label.manual_source_lot)} · {show(label.manual_source_reason)}</p> : null}
        </section>
        <section className="detail-section">
          <h2><Truck size={18} /> Origine et réception marchandises</h2>
          {trace.sources.length ? (
            <dl className="detail-grid">
              {trace.sources.map((source) => (
                <div className="wide" key={String(source.id)}>
                  <dt>{show(source.supplier_name)} · lot {show(source.supplier_lot)}</dt>
                  <dd>{show(source.ingredient_name)} · reçu {dateTime(source.received_at)} · DLC/DDM {show(source.supplier_deadline)}</dd>
                  <small>{source.reception_code ? <Link href={`/receptions/${source.reception_id}`}>{show(source.reception_code)} · BL {show(source.delivery_note)}</Link> : "Réception numérique non liée"}</small>
                </div>
              ))}
            </dl>
          ) : <p>Aucun lot numérique lié. Vérifiez la saisie manuelle ci-dessus.</p>}
          <p className="privacy-note">Les photos, factures et documents de livraison restent réservés aux utilisateurs autorisés du registre.</p>
        </section>
        <section className="detail-section">
          <h2><Printer size={18} /> Impressions et réimpressions</h2>
          {trace.impressions.length ? <dl className="detail-grid">{trace.impressions.map((attempt) => <div key={String(attempt.id)}><dt>{dateTime(attempt.started_at)}</dt><dd>{show(attempt.outcome)} · essai {show(attempt.attempt_number)}</dd><small>{show(attempt.created_by_name)}{attempt.error_message ? ` · ${attempt.error_message}` : ""}</small></div>)}</dl> : <p>Aucune transmission réussie enregistrée.</p>}
        </section>
        {!!trace.audits.length && <section className="detail-section"><h2><History size={18} /> Journal de modifications</h2><dl className="detail-grid">{trace.audits.map((audit) => <div className="wide" key={String(audit.id)}><dt>{dateTime(audit.changed_at)} · {show(audit.changed_by_name)}</dt><dd>{show(audit.field_name)} : {show(audit.old_value)} → {show(audit.new_value)}</dd><small>{show(audit.reason)}</small></div>)}</dl></section>}
        <Link className="button no-print" href="/"><ArrowLeft size={16} /> Retour au registre HACCP</Link>
        </main>
      </div>
    </div>
  );
}

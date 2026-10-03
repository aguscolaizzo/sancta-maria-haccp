import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  Camera,
  CheckCircle2,
  ChefHat,
  CircleAlert,
  Link2,
  PackageOpen,
  Printer,
  QrCode,
  Snowflake,
  Tag,
  Thermometer,
  Timer,
  Truck,
  UserRound,
} from "lucide-react";
import AccessGate from "@/app/access-gate";
import { chatGPTSignInPath, chatGPTSignOutPath } from "@/app/chatgpt-auth";
import HaccpReportPrintButton from "@/app/haccp-report-print-button";
import PreparationLineage from "@/app/preparation-lineage";
import { getAccessContext, publicAccess } from "@/lib/access";
import { labelEvidencePhotoFromRow } from "@/lib/label-photos";
import {
  durationText,
  labelFromRow,
  labelStartAt,
  longDateTime,
  PROCESS_LABELS,
  SOURCE_STATE_LABELS,
  presetFromLabel,
  temperatureText,
} from "@/lib/labels";
import { db } from "@/lib/server";
import { printEventFromRow, supplierLotFromRow } from "@/lib/supply";
export const dynamic = "force-dynamic";
const value = (v: string | null | undefined) => v || "Non renseigné",
  methodLabel = (v: string) =>
    ({
      chambre_froide: "Chambre froide 0/+4 °C",
      micro_ondes_immediat: "Micro-ondes · usage immédiat",
      autre_controlee: "Autre méthode contrôlée",
      bain_glace: "Bain d’eau glacée",
      petits_volumes: "Petits volumes / bacs peu profonds",
      autre: "Autre méthode maîtrisée",
    })[v] ?? v.replaceAll("_", " "),
  auditDateTime = (v: string) =>
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(v));
export default async function PreparationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    context = await getAccessContext(),
    returnTo = "/preparations/" + id;
  if (
    context.status !== "active" ||
    !context.identity ||
    !context.role ||
    !context.ownerId
  )
    return (
      <AccessGate
        access={publicAccess(context)}
        signInPath={chatGPTSignInPath(returnTo)}
        signOutPath={chatGPTSignOutPath(returnTo)}
      />
    );
  const row = /^[0-9a-f-]{36}$/i.test(id)
    ? await db()
        .prepare(
          `SELECT p.*,COALESCE((SELECT group_concat(x.supplier_lot_id) FROM preparation_source_lots x WHERE x.owner_id=p.owner_id AND x.preparation_label_id=p.id),'') AS source_lot_ids
           FROM preparation_labels p WHERE p.owner_id=? AND p.id=? AND p.deleted_at IS NULL`,
        )
        .bind(context.ownerId, id)
        .first<Record<string, unknown>>()
    : null;
  if (!row)
    return (
      <div className="detail-shell">
        <div className="detail-card">
          <QrCode size={38} />
          <h1>Fiche introuvable</h1>
          <p>Cette étiquette n’existe pas ou n’appartient pas à ce registre.</p>
          <Link className="button primary" href="/">
            <ArrowLeft size={16} />
            Retour au registre
          </Link>
        </div>
      </div>
    );
  const l = labelFromRow(row),
    p = presetFromLabel(l),
    marks = l.sourceLotIds.map(() => "?").join(",");
  const sourceRows = l.sourceLotIds.length
    ? await db()
        .prepare(
          `SELECT sl.*,s.name AS supplier_name FROM supplier_lots sl JOIN suppliers s ON s.owner_id=sl.owner_id AND s.id=sl.supplier_id WHERE sl.owner_id=? AND sl.id IN (${marks})`,
        )
        .bind(context.ownerId, ...l.sourceLotIds)
        .all()
    : { results: [] };
  const sourceLots = sourceRows.results.map((source) =>
    supplierLotFromRow(source as Record<string, unknown>),
  );
  const printRows = await db()
    .prepare(
      "SELECT * FROM label_print_events WHERE owner_id=? AND preparation_label_id=? ORDER BY printed_at DESC LIMIT 100",
    )
    .bind(context.ownerId, l.id)
    .all();
  const printEvents = printRows.results.map((event) =>
    printEventFromRow(event as Record<string, unknown>),
  );
  const photoRows = await db()
    .prepare(
      "SELECT * FROM preparation_label_photos WHERE owner_id=? AND preparation_label_id=? AND deleted_at IS NULL ORDER BY created_at ASC",
    )
    .bind(context.ownerId, l.id)
    .all<Record<string, unknown>>();
  const evidencePhotos = photoRows.results.map(labelEvidencePhotoFromRow);
  return (
    <div className="detail-shell">
      <div className="detail-report-wrap">
        <style>{`@media print{
          @page{size:A4 portrait;margin:10mm}
          .detail-shell{display:block!important;min-height:0!important;padding:0!important;background:#fff!important}
          .detail-report-wrap{width:100%!important;max-width:none!important}
          .detail-card{width:100%!important;max-width:none!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important}
          .detail-section>h2{break-after:avoid-page!important;page-break-after:avoid!important}
          .detail-grid>div,.detail-note,.detail-source,.detail-rule,.detail-brand,.evidence-photo-card{break-inside:avoid-page!important;page-break-inside:avoid!important}
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
        <div className="detail-brand">
          <span className="detail-brand-logo" aria-hidden="true" />
          <div>
            SANCTA MARIA <span>1187</span>
            <small>FICHE DE TRAÇABILITÉ HACCP</small>
          </div>
        </div>
        <div
          className={
            "detail-status " +
            (l.lifecycleStatus === "discarded" ||
            (l.lifecycleStatus === "active" && l.controlStatus === "non_compliant")
              ? "detail-status-alert"
              : "")
          }
        >
          {l.lifecycleStatus === "discarded" ? (
            <CircleAlert size={18} />
          ) : l.lifecycleStatus === "transformed_frozen" ? (
            <Snowflake size={18} />
          ) : (
            <CheckCircle2 size={18} />
          )}{" "}
          {l.lifecycleStatus === "discarded"
            ? "Produit déclaré jeté"
            : l.lifecycleStatus === "transformed_frozen"
              ? "Produit transformé · congelé"
              : l.lifecycleStatus === "consumed"
                ? "Étiquette déclarée utilisée"
                : l.controlStatus === "non_compliant"
                  ? "Action enregistrée"
                  : "Fiche enregistrée"}
          {l.lifecycleStatus !== "active" && l.lifecycleUpdatedAt ? ` · ${auditDateTime(l.lifecycleUpdatedAt)}` : ""}
          {l.lifecycleStatus !== "active" && l.lifecycleUpdatedByName ? ` · ${l.lifecycleUpdatedByName}` : ""}
        </div>
        <h1>{l.productName}</h1>
        <p className="detail-id">
          Lot {l.lotCode} · Référence {l.id.slice(0, 8).toUpperCase()}
        </p>
        <section className="detail-section">
          <h2>
            <ChefHat size={18} />
            Produit et opération
          </h2>
          <dl className="detail-grid">
            <div>
              <dt>
                <Tag size={17} />
                Étape tracée
              </dt>
              <dd>{PROCESS_LABELS[l.processType]}</dd>
            </div>
            <div>
              <dt>
                <PackageOpen size={17} />
                État de départ
              </dt>
              <dd>{SOURCE_STATE_LABELS[l.sourceState]}</dd>
            </div>
            <div>
              <dt>
                <CalendarClock size={17} />
                {p?.startLabel ?? "Départ"}
              </dt>
              <dd>{longDateTime(labelStartAt(l, p))}</dd>
            </div>
            <div className="deadline">
              <dt>
                <CalendarClock size={17} />
                {l.storageMode === "frozen" ? "DDM / limite" : "DLC interne"}
              </dt>
              <dd>{longDateTime(l.expiresAt)}</dd>
            </div>
            <div>
              <dt>
                {l.storageMode === "frozen" ? (
                  <Snowflake size={17} />
                ) : (
                  <Thermometer size={17} />
                )}
                Conservation
              </dt>
              <dd>
                {l.storageMode === "frozen" ? "Congelé" : "Réfrigéré"} ·{" "}
                {temperatureText(l.storageTemperature)}
              </dd>
            </div>
            <div>
              <dt>
                <UserRound size={17} />
                Opérateur
              </dt>
              <dd>
                {l.operatorInitials} · {l.createdByName}
              </dd>
            </div>
            <div>
              <dt>Quantité</dt>
              <dd>{value(l.quantity)}</dd>
            </div>
            <div>
              <dt>Conditionnement</dt>
              <dd>{value(l.packaging)}</dd>
            </div>
          </dl>
        </section>
        {!!sourceLots.length && (
          <section className="detail-section">
            <h2>
              <Truck size={18} />
              Lots de matières premières liés
            </h2>
            <dl className="detail-grid">
              {sourceLots.map((lot) => (
                <div key={lot.id}>
                  <dt>{lot.supplierName}</dt>
                  <dd>
                    {lot.ingredientName} · lot {lot.supplierLot}
                  </dd>
                  <small>
                    Reçu le {longDateTime(lot.receivedAt)}
                    {lot.supplierDeadline
                      ? ` · limite ${lot.supplierDeadline.split("-").reverse().join("/")}`
                      : ""}
                  </small>
                </div>
              ))}
            </dl>
          </section>
        )}
        {(l.supplierName ||
          l.supplierLot ||
          l.supplierDeadline ||
          l.receivedAt) && (
          <section className="detail-section">
            <h2>
              <Truck size={18} />
              Origine fournisseur
            </h2>
            <dl className="detail-grid">
              <div>
                <dt>Fournisseur</dt>
                <dd>{value(l.supplierName)}</dd>
              </div>
              <div>
                <dt>Lot fournisseur</dt>
                <dd>{value(l.supplierLot)}</dd>
              </div>
              <div>
                <dt>DLC / DDM fournisseur</dt>
                <dd>
                  {l.supplierDeadline
                    ? l.supplierDeadline.split("-").reverse().join("/")
                    : "Non renseignée"}
                </dd>
              </div>
              <div>
                <dt>Réception</dt>
                <dd>{longDateTime(l.receivedAt)}</dd>
              </div>
            </dl>
          </section>
        )}
        {!!evidencePhotos.length && (
          <section className="detail-section">
            <h2>
              <Camera size={18} />
              Preuve du produit d’origine
            </h2>
            <p className="detail-section-help">
              Photo conservée avec la fiche HACCP. Accès réservé aux utilisateurs
              autorisés du registre.
            </p>
            <div className="evidence-photo-grid">
              {evidencePhotos.map((photo) => (
                <a
                  className="evidence-photo-card"
                  href={photo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  key={photo.id}
                >
                  <img
                    src={photo.url}
                    alt={photo.caption || "Étiquette du produit d’origine"}
                    loading="lazy"
                  />
                  <span>
                    <strong>{photo.caption || "Produit d’origine"}</strong>
                    <small>
                      Ajoutée le {auditDateTime(photo.createdAt)} · {photo.createdByName}
                    </small>
                    <small>Empreinte {photo.contentSha256.slice(0, 12)}…</small>
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}
        {(l.processType === "opened" || l.processType === "supplier_frozen") &&
          l.openedAt && (
            <section className="detail-section">
              <h2>
                <PackageOpen size={18} />
                Ouverture / découpe / transvasement
              </h2>
              <dl className="detail-grid">
                <div>
                  <dt>Ouvert, découpé ou transvasé</dt>
                  <dd>{longDateTime(l.openedAt)}</dd>
                </div>
              </dl>
            </section>
          )}
        {l.processType === "thawed" && (
          <section className="detail-section">
            <h2>
              <Snowflake size={18} />
              Décongélation
            </h2>
            <dl className="detail-grid">
              <div>
                <dt>Décongélation commencée</dt>
                <dd>{longDateTime(l.thawingStartedAt)}</dd>
              </div>
              <div>
                <dt>Méthode</dt>
                <dd>{methodLabel(l.thawingMethod)}</dd>
              </div>
            </dl>
            <div className="notice warning">
              <Snowflake size={18} />
              <span>
                Ne pas recongeler le produit en l’état après décongélation.
              </span>
            </div>
          </section>
        )}
        {l.processType === "frozen_in_house" && (
          <section className="detail-section">
            <h2>
              <Snowflake size={18} />
              Congélation maison
            </h2>
            <dl className="detail-grid">
              <div>
                <dt>Congelé sur place</dt>
                <dd>{longDateTime(l.frozenAt)}</dd>
              </div>
              <div>
                <dt>Équipement / méthode</dt>
                <dd>{value(l.freezeMethod)}</dd>
              </div>
              <div>
                <dt>T° congélateur</dt>
                <dd>{temperatureText(l.freezerTemperature)}</dd>
              </div>
            </dl>
          </section>
        )}
        {l.processType === "cooked_cooled" && (
          <section className="detail-section">
            <h2>
              <Timer size={18} />
              Cuisson et refroidissement
            </h2>
            <dl className="detail-grid">
              <div>
                <dt>Fin de cuisson</dt>
                <dd>
                  {longDateTime(l.cookingEndedAt)} ·{" "}
                  {temperatureText(l.cookingTemperature)}
                </dd>
              </div>
              <div>
                <dt>Début refroidissement</dt>
                <dd>
                  {longDateTime(l.coolingStartedAt)} ·{" "}
                  {temperatureText(l.coolingStartTemperature)}
                </dd>
              </div>
              <div>
                <dt>Fin refroidissement</dt>
                <dd>
                  {longDateTime(l.coolingEndedAt)} ·{" "}
                  {temperatureText(l.coolingEndTemperature)}
                </dd>
              </div>
              <div
                className={
                  l.coolingCompliant
                    ? "control-detail-ok"
                    : "control-detail-alert"
                }
              >
                <dt>Contrôle</dt>
                <dd>
                  {l.coolingCompliant
                    ? "Objectif PMS atteint"
                    : "Hors objectif / action requise"}{" "}
                  · {l.coolingDurationMinutes ?? "—"} min
                </dd>
              </div>
              <div>
                <dt>Méthode</dt>
                <dd>
                  {l.coolingMethod
                    ? methodLabel(l.coolingMethod)
                    : "Non renseignée"}
                </dd>
              </div>
            </dl>
          </section>
        )}
        <PreparationLineage ownerId={context.ownerId} kind="classic" id={l.id}/>
        {l.sourceLabelId && (
          <div className="detail-source">
            <Link2 size={17} />
            <span>Fiche source liée</span>
            <Link href={"/preparations/" + l.sourceLabelId}>
              Ouvrir la fiche
            </Link>
          </div>
        )}
        {l.correctiveAction && (
          <div className="detail-note corrective">
            <strong>Action corrective</strong>
            <p>{l.correctiveAction}</p>
          </div>
        )}
        {l.note && (
          <div className="detail-note">
            <strong>Observation</strong>
            <p>{l.note}</p>
          </div>
        )}
        {!!printEvents.length && (
          <section className="detail-section">
            <h2>
              <Printer size={18} />
              Historique d’impression
            </h2>
            <dl className="detail-grid">
              {printEvents.map((event) => (
                <div key={event.id}>
                  <dt>{event.printerModel}</dt>
                  <dd>
                    {auditDateTime(event.printedAt)} · {event.copies} exemplaire
                    {event.copies > 1 ? "s" : ""}
                  </dd>
                  <small>Imprimé par {event.createdByName}</small>
                </div>
              ))}
            </dl>
          </section>
        )}
        <p className="detail-rule">
          {p.rule} · Durée appliquée : {durationText(l.durationHours)}. Ces
          réglages internes doivent rester cohérents avec le PMS et les
          instructions fournisseur.
        </p>
        <Link className="button wide no-print" href="/">
          <ArrowLeft size={16} />
          Retour au registre HACCP
        </Link>
        </main>
      </div>
    </div>
  );
}

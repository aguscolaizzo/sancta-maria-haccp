/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  FileCheck2,
  ShieldCheck,
  Tags,
  XCircle,
} from "lucide-react";
import AccessGate from "@/app/access-gate";
import { chatGPTSignInPath, chatGPTSignOutPath } from "@/app/chatgpt-auth";
import { getAccessContext, publicAccess } from "@/lib/access";
import {
  auditFromRow,
  DECISION_LABELS,
  METHOD_LABELS,
  photoFromRow,
  productFromRow,
  receptionFromRow,
  RECEPTION_STATUS_LABELS,
} from "@/lib/receptions";
import { db } from "@/lib/server";
import { validUuid } from "@/lib/supply";
import ReceptionPrintButton from "./print-button";

export const dynamic = "force-dynamic";
const dateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("fr-FR", {
        timeZone: "Europe/Paris",
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "Non renseigné";
const temperature = (value: number | null) =>
  value === null
    ? "Non mesurée"
    : `${value > 0 ? "+" : ""}${String(value).replace(".", ",")} °C`;
const yesNo = (value: boolean | null) =>
  value === null ? "Non renseigné" : value ? "Oui" : "Non";

export default async function ReceptionReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    context = await getAccessContext(),
    returnTo = `/receptions/${id}`;
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
  const row = validUuid(id)
    ? await db()
        .prepare("SELECT * FROM receptions WHERE owner_id=? AND id=?")
        .bind(context.ownerId, id)
        .first<Record<string, unknown>>()
    : null;
  if (!row)
    return (
      <div className="detail-shell">
        <div className="detail-card">
          <FileCheck2 size={38} />
          <h1>Rapport introuvable</h1>
          <p>Cette réception n’existe pas ou n’appartient pas à ce registre.</p>
          <Link className="button primary" href="/">
            <ArrowLeft size={16} />
            Retour au registre
          </Link>
        </div>
      </div>
    );
  const reception = receptionFromRow(row),
    [productRows, photoRows, auditRows, preparationRows] = await Promise.all([
      db()
        .prepare(
          "SELECT * FROM reception_products WHERE owner_id=? AND reception_id=? AND deleted_at IS NULL ORDER BY created_at",
        )
        .bind(context.ownerId, id)
        .all(),
      db()
        .prepare(
          "SELECT * FROM reception_photos WHERE owner_id=? AND reception_id=? AND deleted_at IS NULL ORDER BY created_at",
        )
        .bind(context.ownerId, id)
        .all(),
      db()
        .prepare(
          "SELECT * FROM reception_audit_events WHERE owner_id=? AND reception_id=? ORDER BY changed_at",
        )
        .bind(context.ownerId, id)
        .all(),
      db()
        .prepare(
          `SELECT DISTINCT p.preparation_code,p.ingredient_name,p.prepared_at,p.expires_at,l.short_token,l.label_code
           FROM reception_products rp
           JOIN internal_preparation_source_lots x ON x.owner_id=rp.owner_id AND x.supplier_lot_id=rp.supplier_lot_id
           JOIN internal_preparations p ON p.owner_id=x.owner_id AND p.id=x.preparation_id
           JOIN physical_labels l ON l.owner_id=p.owner_id AND l.preparation_id=p.id
           WHERE rp.owner_id=? AND rp.reception_id=? AND rp.deleted_at IS NULL AND p.deleted_at IS NULL
           ORDER BY p.prepared_at,l.label_code`,
        )
        .bind(context.ownerId, id)
        .all(),
    ]),
    products = productRows.results.map((item) =>
      productFromRow(item as Record<string, unknown>),
    ),
    photos = photoRows.results.map((item) =>
      photoFromRow(item as Record<string, unknown>),
    ),
    audits = auditRows.results.map((item) =>
      auditFromRow(item as Record<string, unknown>),
    ),
    linkedPreparations = preparationRows.results as Array<Record<string, unknown>>;
  return (
    <div className="reception-report-shell">
      <style>{`@media print{
        @page{size:A4 portrait;margin:10mm}
        .reception-report-shell{padding:0!important;background:#fff!important}
        .reception-report{box-shadow:none!important;border:0!important;max-width:none!important}
        .report-actions{display:none!important}
        .report-keep-together{display:table!important;width:100%!important}
        .report-keep-together,.report-validation,.report-signature,.report-refusal,.report-product,.report-photos figure{break-inside:avoid-page!important;page-break-inside:avoid!important}
        .report-section>h2{break-after:avoid-page!important;page-break-after:avoid!important}
        .report-audit thead{display:table-header-group}
        .report-audit tr{break-inside:avoid-page!important;page-break-inside:avoid!important}
        .report-brand img{print-color-adjust:exact!important;-webkit-print-color-adjust:exact!important}
        p,dd,small{orphans:3;widows:3}
      }`}</style>
      <div className="report-actions no-print">
        <Link className="button" href="/">
          <ArrowLeft size={16} />
          Retour à l’application
        </Link>
        <ReceptionPrintButton />
      </div>
      <main className="reception-report">
        <header className="report-header">
          <div className="report-brand">
            <img
              src="/sancta-maria-1187-logo.jpg"
              alt="Sancta Maria 1187"
              width={76}
              height={76}
            />
            <div>
              <strong>
                SANCTA MARIA <span>1187</span>
              </strong>
              <small>RAPPORT HACCP DE RÉCEPTION</small>
            </div>
          </div>
          <div className={`report-status ${reception.status}`}>
            {reception.status === "non_compliant" ||
            reception.status === "refused" ? (
              <XCircle size={18} />
            ) : (
              <CheckCircle2 size={18} />
            )}{" "}
            {RECEPTION_STATUS_LABELS[reception.status]}
          </div>
        </header>
        <section className="report-identity">
          <div>
            <span>ID de réception</span>
            <strong>{reception.receptionCode}</strong>
          </div>
          <div>
            <span>Date / heure de création</span>
            <strong>{dateTime(reception.createdAt)}</strong>
          </div>
          <div>
            <span>Fournisseur</span>
            <strong>{reception.supplierName || "Non renseigné"}</strong>
          </div>
          <div>
            <span>Bon de livraison</span>
            <strong>{reception.deliveryNote || "Non renseigné"}</strong>
          </div>
          <div>
            <span>Commande</span>
            <strong>{reception.orderNumber || "Non renseignée"}</strong>
          </div>
          <div>
            <span>Livreur</span>
            <strong>{reception.driverName || "Non renseigné"}</strong>
          </div>
        </section>
        {reception.generalNotes && (
          <section className="report-note">
            <strong>Observations générales</strong>
            <p>{reception.generalNotes}</p>
          </section>
        )}
        <section className="report-section">
          <h2>Produits reçus et contrôles</h2>
          {products.map((product, index) => (
            <article className="report-product" key={product.id}>
              <div className="report-product-title">
                <span>{index + 1}</span>
                <div>
                  <h3>{product.productName}</h3>
                  <p>
                    {product.category} · {product.quantity} {product.unit} ·{" "}
                    {product.temperatureRegime === "ambient"
                      ? "Température ambiante"
                      : product.temperatureRegime === "frozen"
                        ? "Surgelé / congelé"
                        : "Réfrigéré"}
                  </p>
                </div>
              </div>
              <dl className="report-grid">
                <div>
                  <dt>Lot fournisseur</dt>
                  <dd>{product.supplierLot || "Non renseigné"}</dd>
                </div>
                <div>
                  <dt>
                    {product.deadlineType === "none"
                      ? "DLC / DDM"
                      : product.deadlineType.toUpperCase()}
                  </dt>
                  <dd>
                    {product.deadlineDate
                      ? product.deadlineDate.split("-").reverse().join("/")
                      : "Sans date"}
                  </dd>
                </div>
                <div>
                  <dt>Conservation / maximum</dt>
                  <dd>
                    {temperature(product.storageTemperature)} /{" "}
                    {temperature(product.maxTemperature)}
                  </dd>
                </div>
                <div>
                  <dt>Échantillonnage</dt>
                  <dd>
                    {product.selectedForMeasurement
                      ? "Produit réellement mesuré"
                      : "Non mesuré"}
                  </dd>
                </div>
                <div>
                  <dt>Température IR</dt>
                  <dd>{temperature(product.irTemperature)}</dd>
                </div>
                <div>
                  <dt>Température sonde</dt>
                  <dd>{temperature(product.probeTemperature)}</dd>
                </div>
                <div>
                  <dt>Méthode</dt>
                  <dd>
                    {METHOD_LABELS[product.measurementMethod] ??
                      "Non applicable"}
                  </dd>
                </div>
                <div>
                  <dt>Emballage / état visuel</dt>
                  <dd>
                    {yesNo(product.packagingCompliant)} /{" "}
                    {yesNo(product.visualCompliant)}
                  </dd>
                </div>
              </dl>
              {product.temperatureRegime === "ambient" && (
                <dl className="report-grid compact">
                  <div>
                    <dt>Propreté</dt>
                    <dd>{yesNo(product.cleanlinessCompliant)}</dd>
                  </div>
                  <div>
                    <dt>Absence d’humidité</dt>
                    <dd>{yesNo(product.humidityAbsent)}</dd>
                  </div>
                  <div>
                    <dt>Absence de nuisibles</dt>
                    <dd>{yesNo(product.pestsAbsent)}</dd>
                  </div>
                  <div>
                    <dt>Produit conforme</dt>
                    <dd>{yesNo(product.productCompliant)}</dd>
                  </div>
                </dl>
              )}
              {(product.decisionType || product.correctiveAction) && (
                <div className="report-nonconformity">
                  <strong>Non-conformité / décision</strong>
                  <p>
                    {DECISION_LABELS[product.decisionType ?? ""] ??
                      product.decisionType}{" "}
                    {product.concernedQuantity
                      ? `· Quantité : ${product.concernedQuantity}`
                      : ""}
                  </p>
                  <p>
                    <b>Motif :</b>{" "}
                    {product.nonConformityReason || "Non renseigné"}
                  </p>
                  <p>
                    <b>Action corrective :</b>{" "}
                    {product.correctiveAction || "Non renseignée"}
                  </p>
                  <p>
                    <b>Décision finale :</b>{" "}
                    {product.finalDecision || "Non renseignée"}
                  </p>
                  {product.remeasureTemperature !== null && (
                    <p>
                      <b>Nouvelle mesure :</b>{" "}
                      {temperature(product.remeasureTemperature)}
                    </p>
                  )}
                </div>
              )}
              {product.observations && (
                <div className="report-note">
                  <strong>Observation produit</strong>
                  <p>{product.observations}</p>
                </div>
              )}
            </article>
          ))}
        </section>
        {!!linkedPreparations.length && (
          <section className="report-section report-keep-together">
            <h2>Préparations et étiquettes issues de cette réception</h2>
            <div className="report-trace-links">
              {linkedPreparations.map((preparation) => (
                <Link
                  key={String(preparation.label_code)}
                  href={`/t/${preparation.short_token}`}
                >
                  <Tags size={15} />
                  <span>
                    <strong>{String(preparation.ingredient_name)}</strong>
                    <small>
                      {String(preparation.preparation_code)} · {String(preparation.label_code)}
                    </small>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
        {!!photos.length && (
          <section className="report-section report-photos">
            <h2>Éléments photographiques</h2>
            <div>
              {photos.map((photo) => (
                <figure key={photo.id}>
                  <img src={photo.dataUrl} alt={photo.kind} />
                  <figcaption>
                    {photo.kind.replaceAll("_", " ")} ·{" "}
                    {dateTime(photo.createdAt)}
                  </figcaption>
                </figure>
              ))}
            </div>
            <p>
              Les photos renforcent les éléments de preuve. L’autocontrôle est
              le relevé réalisé et validé par l’utilisateur.
            </p>
          </section>
        )}
        <section className="report-section report-keep-together">
          <h2>Validation numérique du responsable</h2>
          <div className="report-validation">
            <ShieldCheck size={28} />
            <div>
              <strong>
                {reception.validatedByName || "Réception non encore validée"}
              </strong>
              <p>
                {reception.validatedAt
                  ? `Validée le ${dateTime(reception.validatedAt)}${reception.pinUsed ? " · PIN utilisé" : ""}`
                  : "État : en cours"}
              </p>
              <small>
                Appareil : {reception.validationDevice || "Non disponible"}
              </small>
            </div>
          </div>
        </section>
        <section className="report-section report-keep-together">
          <h2>Validation du livreur</h2>
          {reception.driverRefusedSign ? (
            <div className="report-refusal">
              <strong>Le livreur refuse de signer</strong>
              <p>{reception.driverRefusalComment || "Sans commentaire"}</p>
              <small>
                Enregistré par {reception.driverRecordedByName} le{" "}
                {dateTime(reception.driverSignedAt)}
              </small>
            </div>
          ) : reception.driverSignature ? (
            <div className="report-signature">
              <div>
                <span>Nom / société / initiales</span>
                <strong>
                  {reception.driverName || "—"} ·{" "}
                  {reception.driverCompany || "—"} ·{" "}
                  {reception.driverInitials || "—"}
                </strong>
                <small>{dateTime(reception.driverSignedAt)}</small>
              </div>
              <img src={reception.driverSignature} alt="Signature du livreur" />
            </div>
          ) : (
            <p className="report-empty">
              Signature facultative non recueillie.
            </p>
          )}
          <p className="report-disclaimer">
            Cette signature confirme la présence ou la prise de connaissance.
            Elle ne certifie pas l’exactitude technique de la température.
          </p>
        </section>
        {!!audits.length && (
          <section className="report-section report-audit">
            <h2>Journal d’intégrité des données</h2>
            <table>
              <thead>
                <tr>
                  <th>Date / heure</th>
                  <th>Utilisateur</th>
                  <th>Événement</th>
                  <th>Ancienne valeur</th>
                  <th>Nouvelle valeur</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((event) => (
                  <tr key={event.id}>
                    <td>{dateTime(event.changedAt)}</td>
                    <td>{event.changedByName}</td>
                    <td>
                      {event.action} · {event.fieldName || event.entityType}
                    </td>
                    <td>{event.oldValue ?? "—"}</td>
                    <td>{event.newValue ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        <footer>
          Sancta Maria 1187 · Rapport généré depuis le registre HACCP ·{" "}
          {reception.receptionCode}
        </footer>
      </main>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, ExternalLink, LoaderCircle, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { shortDateTime } from "@/lib/labels";

type WasteItem = {
  id: string;
  kind: "classic" | "quick";
  name: string;
  reference: string;
  expiresAt: string;
  discardedAt: string;
  discardedBy: string;
  quantity: string;
  reason: string;
  comment: string;
  expiredAtDiscard: boolean | null;
  href: string | null;
};

const captions: Record<string, string> = {
  dlc_expired: "DLC dépassée",
  quality: "Qualité / anomalie",
  surplus: "Surplus non utilisé",
  other: "Autre",
  unspecified: "Non précisé",
};

function localDate(date = new Date()) {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function csvValue(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export default function WastePanel({ onBack }: { onBack: () => void }) {
  const today = localDate();
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const [search, setSearch] = useState("");
  const [onlyExpired, setOnlyExpired] = useState(false);
  const [items, setItems] = useState<WasteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/waste?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error ?? "Registre indisponible.");
        setItems(data.items);
        setTruncated(Boolean(data.truncated));
        setError("");
      })
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setItems([]);
          setError(
            caught instanceof Error ? caught.message : "Registre indisponible.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [from, to]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter(
      (item) =>
        (!onlyExpired || item.expiredAtDiscard === true) &&
        (!needle ||
          `${item.name} ${item.reference} ${item.discardedBy}`
            .toLowerCase()
            .includes(needle)),
    );
  }, [items, onlyExpired, search]);

  function exportCsv() {
    const rows = [
      ["Produit", "Référence", "Type", "DLC", "Jeté le", "Enregistré par", "Quantité", "Motif", "DLC dépassée lors du rejet", "Commentaire"],
      ...visible.map((item) => [
        item.name,
        item.reference,
        item.kind === "quick" ? "Impression rapide" : "Préparation",
        item.expiresAt,
        item.discardedAt,
        item.discardedBy,
        item.quantity,
        captions[item.reason] ?? item.reason,
        item.expiredAtDiscard === null ? "Inconnu" : item.expiredAtDiscard ? "Oui" : "Non",
        item.comment,
      ]),
    ];
    const blob = new Blob(
      ["\ufeff" + rows.map((row) => row.map(csvValue).join(";")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Sancta_Maria_Produits_jetes_${from}_${to}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  return (
    <div className="waste-panel">
      <div className="label-row-actions">
        <Button type="button" variant="outline" className="button" onClick={onBack}>
          <ArrowLeft size={16} /> Préparations & étiquettes
        </Button>
      </div>
      <div className="labels-heading">
        <div>
          <p className="eyebrow">Suivi des pertes</p>
          <h2>Registre des produits jetés</h2>
          <p>
            Une DLC dépassée n’est pas automatiquement enregistrée comme perte :
            ce registre contient uniquement les rejets réellement confirmés.
          </p>
        </div>
        <span className="label-format"><Trash2 size={16} /> {visible.length} rejet(s)</span>
      </div>
      <section className="panel panel-pad">
        <div className="label-form-grid">
          <label className="field">Du<Input className="input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label className="field">Au<Input className="input" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <label className="field">Rechercher<span className="previous-search"><Search size={16} /><Input className="input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Produit, référence, opérateur…" /></span></label>
          <label className="ocr-confirm"><input type="checkbox" checked={onlyExpired} onChange={(event) => setOnlyExpired(event.target.checked)} /> Uniquement les produits jetés après dépassement de la DLC</label>
        </div>
        <Button type="button" variant="outline" className="button" disabled={!visible.length || Boolean(error)} onClick={exportCsv}>
          <Download size={16} /> Exporter la sélection CSV
        </Button>
      </section>
      {loading && <p className="notice"><LoaderCircle className="spinner" size={17} /> Chargement du registre…</p>}
      {error && <p className="notice error">{error}</p>}
      {truncated && <p className="notice warning">Le registre dépasse 2 000 lignes. Réduisez la période pour obtenir l’ensemble des résultats.</p>}
      {!loading && !error && !visible.length && <p className="notice">Aucun produit jeté sur cette période avec ces filtres.</p>}
      <div className="waste-list">
        {visible.map((item) => (
          <article className="panel panel-pad" key={`${item.kind}-${item.id}`}>
            <header><div><strong>{item.name}</strong><p>{item.reference} · {item.kind === "quick" ? "Impression rapide" : "Préparation"}</p></div><span className="history-status discarded">Jetée</span></header>
            <dl>
              <div><dt>Quantité réellement jetée</dt><dd>{item.quantity}</dd></div>
              <div><dt>Motif</dt><dd>{captions[item.reason] ?? item.reason}</dd></div>
              <div><dt>Date / responsable</dt><dd>{shortDateTime(item.discardedAt)} · {item.discardedBy}</dd></div>
              <div><dt>DLC d’origine</dt><dd>{shortDateTime(item.expiresAt)}{item.expiredAtDiscard === true ? " · dépassée" : item.expiredAtDiscard === false ? " · non dépassée" : ""}</dd></div>
            </dl>
            {item.comment && <p><strong>Commentaire :</strong> {item.comment}</p>}
            {item.href && <a className="button" href={item.href} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Ouvrir la fiche conservée</a>}
          </article>
        ))}
      </div>
    </div>
  );
}

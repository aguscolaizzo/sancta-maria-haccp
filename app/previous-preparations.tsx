"use client";

import { useEffect, useState } from "react";
import { Link2, LoaderCircle, Search, Snowflake, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  freezeSourceProblem,
  HISTORY_STATUS,
  parisNow,
  type PreviousPreparation,
} from "@/lib/preparation-history";
import { shortDateTime } from "@/lib/labels";

type Props = {
  selected: PreviousPreparation | null;
  onSelect: (value: PreviousPreparation | null) => void;
  onFreeze: (value: PreviousPreparation) => void;
  excludeId?: string;
  disabled?: boolean;
};

export default function PreviousPreparations({
  selected,
  onSelect,
  onFreeze,
  excludeId,
  disabled = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<PreviousPreparation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/preparation-history?q=${encodeURIComponent(query.trim())}`,
          { cache: "no-store", signal: controller.signal },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error ?? "Historique indisponible.");
        setItems(
          (data.items as PreviousPreparation[]).filter(
            (item) => item.id !== excludeId,
          ),
        );
        setError("");
      } catch (caught) {
        if (!controller.signal.aborted)
          setError(
            caught instanceof Error
              ? caught.message
              : "Historique indisponible.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [excludeId, query]);

  const problem = selected
    ? freezeSourceProblem(selected, parisNow())
    : null;

  return (
    <details className="previous-preparations" open={Boolean(selected)}>
      <summary>
        <Link2 size={17} /> Relier une préparation ou une étiquette précédente
      </summary>
      <div className="previous-search">
        <Search size={17} />
        <Input
          className="input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Produit, lot, référence, fournisseur…"
          disabled={disabled}
        />
        {loading && <LoaderCircle className="spinner" size={17} />}
      </div>
      {error && <p className="notice error">{error}</p>}
      <div className="previous-results">
        {items.map((item) => (
          <Button
            type="button"
            variant="outline"
            className={`previous-result ${selected?.kind === item.kind && selected.id === item.id ? "selected" : ""}`}
            key={`${item.kind}-${item.id}`}
            disabled={disabled}
            onClick={() => onSelect(item)}
          >
            <span>
              <strong>{item.name}</strong>
              <small>
                {item.kind === "quick" ? "Impression rapide" : "Préparation"}
                {" · "}
                {item.reference} · DLC {shortDateTime(item.expiresAt)} ·{" "}
                {HISTORY_STATUS[item.status] ?? item.status}
              </small>
            </span>
          </Button>
        ))}
        {!loading && !items.length && (
          <p className="muted-note">Aucune préparation correspondante.</p>
        )}
      </div>
      {selected && (
        <div className="previous-selected">
          <div>
            <strong>{selected.name}</strong>
            <p>
              {selected.reference} · préparée {shortDateTime(selected.preparedAt)} ·
              DLC {shortDateTime(selected.expiresAt)}
            </p>
            <p>
              Quantité : {selected.quantity || "non renseignée"}
              {selected.supplierName
                ? ` · ${selected.supplierName}${selected.supplierLot ? ` · lot ${selected.supplierLot}` : ""}`
                : ""}
              {selected.sourceLotIds.length
                ? ` · ${selected.sourceLotIds.length} lot(s) d’origine`
                : ""}
            </p>
          </div>
          <div className="label-row-actions">
            <a className="button" href={selected.href} target="_blank" rel="noreferrer">
              <Link2 size={15} /> Ouvrir la fiche
            </a>
            <Button
              type="button"
              variant="outline"
              className="button"
              disabled={disabled}
              onClick={() => onSelect(null)}
            >
              <X size={15} /> Retirer le lien
            </Button>
            <Button
              type="button"
              className="button primary"
              disabled={disabled || Boolean(problem)}
              onClick={() => onFreeze(selected)}
            >
              <Snowflake size={15} /> Créer une congélation liée
            </Button>
          </div>
          {problem && <p className="notice warning">{problem}</p>}
        </div>
      )}
    </details>
  );
}

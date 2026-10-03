"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Check,
  FileDown,
  FileSpreadsheet,
  LoaderCircle,
  PackageCheck,
  Pencil,
  QrCode,
  Search,
  Snowflake,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { canAdministerRegister, type RegisterSession } from "@/lib/access-types";
import {
  PROCESS_LABELS,
  shortDateTime,
  temperatureText,
  type ProcessType,
} from "@/lib/labels";
import {
  HISTORY_STATUS,
  type PreparationKind,
  type PreviousPreparation,
} from "@/lib/preparation-history";
import {
  OPERATION_LABELS,
  type OperationType,
  type SourceLotTrace,
} from "@/lib/quick-labels";
import DiscardDialog, { type DiscardDetails } from "./discard-dialog";

type QuickEditor = {
  id: string;
  preparationCode: string;
  ingredientName: string;
  shortName: string;
  operationType: OperationType;
  preparedAt: string;
  expiresAt: string;
  durationHours: number;
  storageMode: string;
  storageTemperature: number | null;
  operatorInitials: string;
  notes: string;
  manualSourceLot: string;
  manualSourceReason: string;
  sourceLotIds: string[];
  status: string;
  revision: number;
};

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: "no-store" });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json"))
    throw new Error("Votre session a expiré. Rouvrez l’application.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "La demande a échoué.");
  return data;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr");
}

function operationLabel(item: PreviousPreparation) {
  if (item.kind === "quick")
    return (
      OPERATION_LABELS[item.operation as OperationType] ??
      item.operation.replaceAll("_", " ")
    );
  return (
    PROCESS_LABELS[item.operation as ProcessType] ??
    item.operation.replaceAll("_", " ")
  );
}

function effectiveStatus(item: PreviousPreparation) {
  if (
    ["active", "prepared"].includes(item.status) &&
    item.expiresAt &&
    item.expiresAt <= nowParis()
  )
    return "expired";
  return item.status;
}

function nowParis() {
  const parts = new Intl.DateTimeFormat("fr-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date()),
    values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function csv(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export default function UnifiedLabelRegister({
  session,
  onEditClassic,
  onPreviewClassic,
  onDeleteClassic,
  onFreeze,
  compact = false,
}: {
  session: RegisterSession;
  onEditClassic: (id: string) => void;
  onPreviewClassic: (id: string) => void;
  onDeleteClassic: (id: string) => void;
  onFreeze: (kind: PreparationKind, id: string) => void;
  compact?: boolean;
}) {
  const [items, setItems] = useState<PreviousPreparation[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<QuickEditor | null>(null);
  const [saving, setSaving] = useState(false);
  const [sourceLots, setSourceLots] = useState<SourceLotTrace[]>([]);
  const [sourceLotsLoading, setSourceLotsLoading] = useState(false);
  const [sourceLotsError, setSourceLotsError] = useState("");
  const [lotSearch, setLotSearch] = useState("");
  const [pendingDelete, setPendingDelete] =
    useState<PreviousPreparation | null>(null);
  const [discarding, setDiscarding] =
    useState<PreviousPreparation | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await api<{ items: PreviousPreparation[] }>(
        "/api/preparation-history?q=",
      );
      setItems(result.items);
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Le registre ne peut pas être chargé.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
    const refresh = () => void load();
    window.addEventListener("haccp-labels-changed", refresh);
    return () => window.removeEventListener("haccp-labels-changed", refresh);
  }, [load]);

  const visible = useMemo(() => {
    const query = normalize(search.trim());
    if (!query) return items;
    return items.filter((item) =>
      normalize(
        [
          item.name,
          item.reference,
          item.operatorInitials,
          item.supplierName,
          item.supplierLot,
          HISTORY_STATUS[effectiveStatus(item)] ?? effectiveStatus(item),
          item.kind === "quick" ? "impression rapide" : "classique",
        ].join(" "),
      ).includes(query),
    );
  }, [items, search]);

  const visibleSourceLots = useMemo(() => {
    if (!editing) return [];
    const query = normalize(lotSearch.trim()),
      ingredient = normalize(editing.ingredientName);
    return [...sourceLots]
      .filter((lot) =>
        !query
          ? true
          : normalize(
              [
                lot.ingredientName,
                lot.supplierName,
                lot.supplierLot,
                lot.receptionCode,
                lot.deliveryNote,
              ].join(" "),
            ).includes(query),
      )
      .sort((a, b) => {
        const selected = Number(editing.sourceLotIds.includes(b.id)) -
          Number(editing.sourceLotIds.includes(a.id));
        if (selected) return selected;
        const relevant = Number(normalize(b.ingredientName).includes(ingredient)) -
          Number(normalize(a.ingredientName).includes(ingredient));
        if (relevant) return relevant;
        return b.receivedAt.localeCompare(a.receivedAt);
      })
      .slice(0, 120);
  }, [editing, lotSearch, sourceLots]);

  async function lifecycle(
    item: PreviousPreparation,
    action: "consumed" | "discarded" | "transformed_frozen",
    discard?: DiscardDetails,
  ) {
    if (action === "transformed_frozen") {
      onFreeze(item.kind, item.id);
      return;
    }
    if (action === "discarded" && !discard) {
      setDiscarding(item);
      return;
    }
    setBusyId(item.id);
    try {
      await api("/api/expiry-alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          kind: item.kind,
          action,
          discard,
        }),
      });
      await load();
      window.dispatchEvent(new Event("haccp-labels-changed"));
      toast.success(
        action === "consumed"
          ? "Étiquette marquée comme utilisée."
          : "Étiquette marquée comme jetée.",
      );
    } catch (caught) {
      const failure =
        caught instanceof Error
          ? caught
          : new Error("Le statut n’a pas pu être enregistré.");
      toast.error(failure.message);
      if (discard) throw failure;
    } finally {
      setBusyId(null);
    }
  }

  async function edit(item: PreviousPreparation) {
    if (item.kind === "classic") {
      onEditClassic(item.id);
      return;
    }
    setBusyId(item.id);
    setSourceLotsLoading(true);
    setSourceLotsError("");
    setLotSearch("");
    try {
      const lotsRequest = api<{ lots: SourceLotTrace[] }>("/api/source-lots")
          .then((result) => result.lots)
          .catch(() => null),
        detailResult = await api<{ preparation: QuickEditor }>(
          `/api/quick-labels/${item.id}`,
        );
      setEditing(detailResult.preparation);
      const loadedLots = await lotsRequest;
      if (loadedLots) setSourceLots(loadedLots);
      else {
        setSourceLots([]);
        setSourceLotsError(
          "Les lots reçus ne peuvent pas être chargés. Vous pouvez saisir le lot manuellement.",
        );
      }
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Fiche indisponible.",
      );
    } finally {
      setBusyId(null);
      setSourceLotsLoading(false);
    }
  }

  function toggleSourceLot(id: string) {
    if (!editing) return;
    setEditing({
      ...editing,
      sourceLotIds: editing.sourceLotIds.includes(id)
        ? editing.sourceLotIds.filter((sourceId) => sourceId !== id)
        : [...editing.sourceLotIds, id],
    });
  }

  async function saveQuick() {
    if (!editing) return;
    setSaving(true);
    try {
      await api(`/api/quick-labels/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      setEditing(null);
      await load();
      window.dispatchEvent(new Event("haccp-labels-changed"));
      toast.success("Fiche rapide modifiée et auditée.");
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "La modification a échoué.",
      );
    } finally {
      setSaving(false);
    }
  }

  function requestDelete(item: PreviousPreparation) {
    if (item.kind === "classic") {
      onDeleteClassic(item.id);
      return;
    }
    setPendingDelete(item);
  }

  async function deleteQuick() {
    if (!pendingDelete || pendingDelete.kind !== "quick") return;
    setBusyId(pendingDelete.id);
    try {
      await api(`/api/quick-labels/${pendingDelete.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: pendingDelete.revision }),
      });
      setPendingDelete(null);
      await load();
      window.dispatchEvent(new Event("haccp-labels-changed"));
      toast.success("Fiche supprimée du registre. La trace d’audit est conservée.");
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "La suppression a échoué.",
      );
    } finally {
      setBusyId(null);
    }
  }

  function exportCsv() {
    const head = [
        "ORIGINE",
        "PRODUIT",
        "REFERENCE",
        "OPERATION",
        "PREPARATION",
        "DLC",
        "STATUT",
        "OPERATEUR",
        "FOURNISSEUR",
        "LOT_FOURNISSEUR",
        "ETIQUETTES",
        "IMPRIMEES",
      ],
      rows = visible.map((item) => [
        item.kind === "quick" ? "Impression rapide" : "Fiche classique",
        item.name,
        item.reference,
        operationLabel(item),
        item.preparedAt,
        item.expiresAt,
        HISTORY_STATUS[effectiveStatus(item)] ?? effectiveStatus(item),
        item.operatorInitials,
        item.supplierName,
        item.supplierLot,
        item.labelCount,
        item.printedCount,
      ]),
      content = [head, ...rows].map((row) => row.map(csv).join(";")).join("\r\n"),
      url = URL.createObjectURL(
        new Blob(["\ufeff" + content], { type: "text/csv;charset=utf-8" }),
      ),
      link = document.createElement("a");
    link.href = url;
    link.download = "Sancta_Maria_Registre_Etiquettes_Unifie.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  return (
    <section className={compact ? "unified-register compact" : "label-register unified-register"}>
      {discarding && (
        <DiscardDialog
          name={discarding.name}
          expired={discarding.expiresAt <= nowParis()}
          onClose={() => setDiscarding(null)}
          onConfirm={(details) =>
            lifecycle(discarding, "discarded", details)
          }
        />
      )}
      <div className="month-heading unified-register-heading">
        <div>
          <p className="eyebrow">Base de données commune</p>
          <h2>Registre unifié des étiquettes</h2>
          <p>
            Fiches classiques et impressions rapides, avec les mêmes actions et
            la même traçabilité.
          </p>
        </div>
        <Button
          variant="outline"
          className="button"
          onClick={exportCsv}
          disabled={!visible.length}
        >
          <FileSpreadsheet size={16} /> Exporter le registre
        </Button>
      </div>
      <div className="register-filter">
        <Search size={17} />
        <Input
          className="input"
          type="search"
          placeholder="Rechercher produit, lot, opérateur, statut…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <span>
          {visible.length} fiche{visible.length > 1 ? "s" : ""}
        </span>
      </div>
      {error && <div className="notice error">{error}</div>}
      {loading ? (
        <div className="panel loading">
          <LoaderCircle className="spinner" size={22} /> Chargement…
        </div>
      ) : !visible.length ? (
        <div className="panel label-empty-register">
          <Archive size={28} />
          <strong>Aucune fiche trouvée</strong>
          <span>
            {items.length
              ? "Modifiez votre recherche."
              : "La première fiche, classique ou rapide, apparaîtra ici."}
          </span>
        </div>
      ) : (
        <div className="unified-register-list">
          {visible.map((item) => {
            const status = effectiveStatus(item),
              active = ["active", "prepared"].includes(item.status),
              frozen = item.status === "transformed_frozen",
              canClose = active || frozen;
            return (
              <article className="unified-register-card" key={`${item.kind}-${item.id}`}>
                <div className="unified-register-card-head">
                  <div>
                    <span className={`record-origin ${item.kind}`}>
                      {item.kind === "quick"
                        ? "Impression rapide"
                        : "Fiche classique"}
                    </span>
                    <h3>{item.name}</h3>
                    <p>{item.reference}</p>
                  </div>
                  <span className={`status-pill register-status ${status}`}>
                    {status === "transformed_frozen" ? (
                      <Snowflake size={13} />
                    ) : status === "discarded" ? (
                      <Trash2 size={13} />
                    ) : (
                      <Check size={13} />
                    )}
                    {HISTORY_STATUS[status] ?? status.replaceAll("_", " ")}
                  </span>
                </div>
                <dl className="unified-register-meta">
                  <div>
                    <dt>Opération</dt>
                    <dd>{operationLabel(item)}</dd>
                  </div>
                  <div>
                    <dt>Préparation</dt>
                    <dd>{shortDateTime(item.preparedAt)}</dd>
                  </div>
                  <div>
                    <dt>DLC / limite</dt>
                    <dd>{shortDateTime(item.expiresAt)}</dd>
                  </div>
                  <div>
                    <dt>Conservation</dt>
                    <dd>{temperatureText(item.storageTemperature)}</dd>
                  </div>
                  <div>
                    <dt>Opérateur</dt>
                    <dd>{item.operatorInitials || "—"}</dd>
                  </div>
                  <div>
                    <dt>Lot d’origine</dt>
                    <dd>
                      {item.supplierLot ||
                        (item.sourceLotIds.length
                          ? `${item.sourceLotIds.length} lot(s) reçu(s) lié(s)`
                          : "À compléter")}
                    </dd>
                  </div>
                  <div>
                    <dt>Étiquettes</dt>
                    <dd>
                      {item.labelCount} créée{item.labelCount > 1 ? "s" : ""} ·{" "}
                      {item.printedCount} imprimée{item.printedCount > 1 ? "s" : ""}
                      {item.errorCount ? ` · ${item.errorCount} erreur(s)` : ""}
                    </dd>
                  </div>
                </dl>
                <div className="label-row-actions unified-register-actions">
                  {item.kind === "classic" ? (
                    <Button
                      variant="outline"
                      className="button table-action"
                      onClick={() => onPreviewClassic(item.id)}
                    >
                      <QrCode size={15} /> Étiquette
                    </Button>
                  ) : (
                    <a
                      className="button table-action"
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <QrCode size={15} /> Fiche / QR
                    </a>
                  )}
                  <a
                    className="button table-action"
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FileDown size={15} /> Rapport A4
                  </a>
                  {canAdministerRegister(session.role) && (
                    <>
                      <Button
                        variant="outline"
                        className="button table-action"
                        disabled={busyId === item.id}
                        onClick={() => void edit(item)}
                      >
                        <Pencil size={15} /> Modifier
                      </Button>
                      <Button
                        variant="outline"
                        className="button table-action table-action-danger"
                        disabled={busyId === item.id}
                        onClick={() => requestDelete(item)}
                      >
                        <Trash2 size={15} /> Supprimer
                      </Button>
                    </>
                  )}
                  {canClose && (
                    <>
                      <Button
                        variant="outline"
                        className="button table-action table-action-status"
                        disabled={busyId === item.id}
                        onClick={() => void lifecycle(item, "consumed")}
                      >
                        <Check size={15} /> Utilisée
                      </Button>
                      {active && (
                        <Button
                          variant="outline"
                          className="button table-action table-action-status"
                          disabled={busyId === item.id || status === "expired"}
                          onClick={() =>
                            void lifecycle(item, "transformed_frozen")
                          }
                        >
                          <Snowflake size={15} /> Transformer / congeler
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        className="button table-action table-action-danger"
                        disabled={busyId === item.id}
                        onClick={() => void lifecycle(item, "discarded")}
                      >
                        <Trash2 size={15} /> Jetée
                      </Button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && !saving && setEditing(null)}>
        <DialogContent className="unified-edit-dialog">
          <DialogHeader>
            <DialogTitle>Modifier la fiche rapide</DialogTitle>
            <DialogDescription>
              Les changements seront inscrits dans le journal d’intégrité.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="unified-edit-scroll">
              <label className="field">
                Produit / préparation
                <Input
                  className="input"
                  value={editing.ingredientName}
                  onChange={(event) =>
                    setEditing({ ...editing, ingredientName: event.target.value })
                  }
                />
              </label>
              <label className="field">
                Nom court sur l’étiquette
                <Input
                  className="input"
                  value={editing.shortName}
                  onChange={(event) =>
                    setEditing({ ...editing, shortName: event.target.value })
                  }
                />
              </label>
              <label className="field">
                Opération
                <Select
                  value={editing.operationType}
                  onValueChange={(value) =>
                    setEditing({
                      ...editing,
                      operationType: value as OperationType,
                    })
                  }
                >
                  <SelectTrigger className="input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(OPERATION_LABELS).map(([value, label]) => (
                      <SelectItem value={value} key={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <div className="unified-edit-grid">
                <label className="field">
                  Préparé le
                  <Input
                    className="input"
                    type="datetime-local"
                    value={editing.preparedAt}
                    onChange={(event) =>
                      setEditing({ ...editing, preparedAt: event.target.value })
                    }
                  />
                </label>
                <label className="field">
                  DLC / limite
                  <Input
                    className="input"
                    type="datetime-local"
                    value={editing.expiresAt}
                    onChange={(event) =>
                      setEditing({ ...editing, expiresAt: event.target.value })
                    }
                  />
                </label>
              </div>
              <div className="unified-edit-grid">
                <label className="field">
                  Conservation
                  <Select
                    value={editing.storageMode}
                    onValueChange={(value) =>
                      setEditing({ ...editing, storageMode: value })
                    }
                  >
                    <SelectTrigger className="input">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="refrigerated">Réfrigéré</SelectItem>
                      <SelectItem value="frozen">Congelé</SelectItem>
                      <SelectItem value="ambient">Ambiant</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="field">
                  Température °C
                  <Input
                    className="input"
                    type="number"
                    step="0.1"
                    value={editing.storageTemperature ?? ""}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        storageTemperature:
                          event.target.value === ""
                            ? null
                            : Number(event.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <label className="field">
                Initiales opérateur
                <Input
                  className="input"
                  value={editing.operatorInitials}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      operatorInitials: event.target.value.toUpperCase(),
                    })
                  }
                />
              </label>
              <div className="field unified-source-lots">
                <div className="unified-source-lots-heading">
                  <span>
                    <PackageCheck size={17} /> Lots reçus liés
                  </span>
                  <small>
                    {editing.sourceLotIds.length
                      ? `${editing.sourceLotIds.length} sélectionné(s)`
                      : "à compléter si disponible"}
                  </small>
                </div>
                <Input
                  className="input"
                  type="search"
                  value={lotSearch}
                  onChange={(event) => setLotSearch(event.target.value)}
                  placeholder="Rechercher produit, fournisseur ou lot…"
                />
                {sourceLotsLoading ? (
                  <div className="unified-source-lots-state">
                    <LoaderCircle className="spinner" size={17} /> Chargement des lots…
                  </div>
                ) : sourceLotsError ? (
                  <div className="notice warning">{sourceLotsError}</div>
                ) : visibleSourceLots.length ? (
                  <div className="source-lot-picker">
                    {visibleSourceLots.map((lot) => (
                      <label className="source-lot-option" key={lot.id}>
                        <input
                          type="checkbox"
                          checked={editing.sourceLotIds.includes(lot.id)}
                          onChange={() => toggleSourceLot(lot.id)}
                        />
                        <span>
                          <strong>
                            {lot.ingredientName} · lot {lot.supplierLot}
                          </strong>
                          <small>
                            {lot.supplierName} · reçu {shortDateTime(lot.receivedAt)}
                            {lot.supplierDeadline
                              ? ` · DLC/DDM ${lot.supplierDeadline}`
                              : ""}
                            {lot.receptionCode ? ` · ${lot.receptionCode}` : ""}
                          </small>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="unified-source-lots-state">
                    Aucun lot reçu ne correspond à cette recherche.
                  </div>
                )}
                <small className="unified-source-lots-help">
                  Vous pouvez créer rapidement la fiche sans lot puis revenir ici
                  pour relier la réception réelle. Une DLC fournisseur plus courte
                  réduira automatiquement la DLC interne.
                </small>
              </div>
              <label className="field">
                Lot d’origine saisi manuellement
                <Input
                  className="input"
                  value={editing.manualSourceLot}
                  onChange={(event) =>
                    setEditing({ ...editing, manualSourceLot: event.target.value })
                  }
                />
              </label>
              <label className="field">
                Justification / origine
                <Input
                  className="input"
                  value={editing.manualSourceReason}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      manualSourceReason: event.target.value,
                    })
                  }
                />
              </label>
              <label className="field">
                Observation
                <Textarea
                  className="textarea"
                  value={editing.notes}
                  onChange={(event) =>
                    setEditing({ ...editing, notes: event.target.value })
                  }
                />
              </label>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              className="button"
              disabled={saving}
              onClick={() => setEditing(null)}
            >
              Annuler
            </Button>
            <Button
              className="button primary"
              disabled={saving}
              onClick={() => void saveQuick()}
            >
              {saving && <LoaderCircle className="spinner" size={16} />}
              Enregistrer les modifications
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && !busyId && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette fiche rapide ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {pendingDelete?.name} » disparaîtra du registre et son QR ne
              sera plus consultable. La suppression restera inscrite dans
              l’audit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busyId}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!!busyId}
              onClick={() => void deleteQuick()}
            >
              {busyId ? (
                <LoaderCircle className="spinner" size={16} />
              ) : (
                <Trash2 size={16} />
              )}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

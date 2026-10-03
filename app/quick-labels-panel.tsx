"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bluetooth,
  Check,
  CheckSquare,
  ChevronDown,
  Clock3,
  Download,
  FileSpreadsheet,
  History,
  LoaderCircle,
  Minus,
  PackageCheck,
  PenLine,
  Plus,
  Printer,
  RefreshCcw,
  Search,
  Settings2,
  Snowflake,
  Star,
  Tags,
  Trash2,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { canAdministerRegister, type RegisterSession } from "@/lib/access-types";
import { PrintQueueRunner } from "@/lib/client-print-queue";
import {
  DEFAULT_PRINTER_SETTINGS,
  PRINTER_SETTINGS_STORAGE_KEY,
  type PrinterSettings,
  type PrintQueue,
} from "@/lib/print-jobs";
import {
  calculateInternalExpiry,
  OPERATION_LABELS,
  type IngredientConfig,
  type OperationType,
  type QuickLabelRecord,
  type SourceLotTrace,
} from "@/lib/quick-labels";
import {
  buildSuprintCsv,
  buildSuprintRows,
  buildSuprintXlsx,
  suprintFilename,
} from "@/lib/suprint-export";
import DiscardDialog, { type DiscardDetails } from "./discard-dialog";
import BarcodeScanner from "./barcode-scanner";
import UnifiedLabelRegister from "./unified-label-register";
import type { PreparationKind } from "@/lib/preparation-history";

type Selection = {
  selected: boolean;
  operationType: OperationType;
  bacCount: number;
  labelCount: number;
  preparedAt: string;
  sourceLotIds: string[];
  manualSourceLot: string;
  manualSourceReason: string;
  notes: string;
  durationOverride: number | null;
  overrideReason: string;
};

type HistoryEntry = {
  id: string;
  preparation_code: string;
  ingredient_id: string;
  ingredient_name: string;
  prepared_at: string;
  expires_at: string;
  status: string;
  printed_count: number;
  error_count: number;
};

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: "no-store" });
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("application/json"))
    throw new Error("Votre session a expiré. Rouvrez l’application.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "La demande a échoué.");
  return data;
}

function nowParis(date = new Date()) {
  const parts = new Intl.DateTimeFormat("fr-CA", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date),
    values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function dayParis(date = new Date()) {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Paris",
      weekday: "short",
    })
      .format(date)
      .replace(/Sun|Mon|Tue|Wed|Thu|Fri|Sat/, (value) =>
        String(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(value)),
      ),
  );
}

function initialSelection(item: IngredientConfig): Selection {
  return {
    selected: false,
    operationType: item.defaultOperation,
    bacCount: item.defaultBacs,
    labelCount: item.defaultLabels,
    preparedAt: nowParis(),
    sourceLotIds: [],
    manualSourceLot: "",
    manualSourceReason: "",
    notes: "",
    durationOverride: null,
    overrideReason: "",
  };
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function compatibleLots(item: IngredientConfig, lots: SourceLotTrace[]) {
  const name = normalize(item.displayName),
    words = name.split(/\s+/).filter((word) => word.length > 3);
  return [...lots].sort((a, b) => {
    const score = (lot: SourceLotTrace) => {
      const lotName = normalize(lot.ingredientName);
      if (lotName === name) return 0;
      if (words.some((word) => lotName.includes(word))) return 1;
      return 2;
    };
    return score(a) - score(b) || b.receivedAt.localeCompare(a.receivedAt);
  });
}

function dateTime(value: string) {
  return value ? value.replace("T", " · ") : "—";
}

function downloadFile(data: BlobPart, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([data], { type })),
    link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      {label}
      {children}
    </label>
  );
}

function CountControl({
  value,
  min = 1,
  max = 50,
  label,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  label: string;
  onChange: (value: number) => void;
}) {
  const normalized = Math.max(min, Math.min(max, Number(value) || min));
  return (
    <div className="quick-count-control">
      <Button
        type="button"
        variant="outline"
        className="button"
        aria-label={`Diminuer ${label}`}
        disabled={normalized <= min}
        onClick={() => onChange(normalized - 1)}
      >
        <Minus size={18} />
      </Button>
      <Input
        className="input"
        type="number"
        min={min}
        max={max}
        inputMode="numeric"
        value={normalized}
        aria-label={label}
        onFocus={(event) => event.currentTarget.select()}
        onClick={(event) => event.currentTarget.select()}
        onChange={(event) => {
          const next = Number.parseInt(event.target.value, 10);
          if (Number.isInteger(next)) onChange(Math.max(min, Math.min(max, next)));
        }}
        onBlur={(event) => {
          const next = Number.parseInt(event.currentTarget.value, 10);
          onChange(Number.isInteger(next) ? Math.max(min, Math.min(max, next)) : min);
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="button"
        aria-label={`Augmenter ${label}`}
        disabled={normalized >= max}
        onClick={() => onChange(normalized + 1)}
      >
        <Plus size={18} />
      </Button>
    </div>
  );
}

export default function QuickLabelsPanel({
  session,
  onBack,
  onFreeze,
  onWaste,
  onEditClassic,
  onPreviewClassic,
  onDeleteClassic,
}: {
  session: RegisterSession;
  onBack: () => void;
  onFreeze: (kind: PreparationKind, id: string) => void;
  onWaste: () => void;
  onEditClassic: (id: string) => void;
  onPreviewClassic: (id: string) => void;
  onDeleteClassic: (id: string) => void;
}) {
  const [view, setView] = useState<"daily" | "history" | "config">("daily");
  const [configurationIngredientId, setConfigurationIngredientId] = useState<
    string | null
  >(null);
  const [ingredients, setIngredients] = useState<IngredientConfig[]>([]);
  const [lots, setLots] = useState<SourceLotTrace[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [search, setSearch] = useState("");
  const [showOccasional, setShowOccasional] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState<{
    id: string;
    name: string;
    expiresAt: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [traceabilityWarnings, setTraceabilityWarnings] = useState<string[]>([]);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [progress, setProgress] = useState("");
  const [queue, setQueue] = useState<PrintQueue | null>(null);
  const [generated, setGenerated] = useState<QuickLabelRecord[]>([]);
  const [settings, setSettings] = useState<PrinterSettings>(DEFAULT_PRINTER_SETTINGS);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runnerRef = useRef<PrintQueueRunner | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = localStorage.getItem(PRINTER_SETTINGS_STORAGE_KEY);
        if (saved)
          setSettings({ ...DEFAULT_PRINTER_SETTINGS, ...JSON.parse(saved) });
      } catch {}
    });
    Promise.all([
      api<{ ingredients: IngredientConfig[] }>("/api/ingredients"),
      api<{ lots: SourceLotTrace[] }>("/api/source-lots"),
      api<{ preparations: HistoryEntry[] }>("/api/quick-labels"),
    ])
      .then(([catalog, sources, register]) => {
        setIngredients(catalog.ingredients);
        setLots(sources.lots);
        setHistory(register.preparations);
        setSelections(
          Object.fromEntries(
            catalog.ingredients.map((item) => [item.id, initialSelection(item)]),
          ),
        );
      })
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Chargement impossible."),
      )
      .finally(() => setLoading(false));
    return () => {
      void runnerRef.current?.printer.disconnect();
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PRINTER_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  const frequent = useMemo(
    () =>
      ingredients
        .filter((item) => item.quickEnabled)
        .filter((item) => !search || normalize(item.displayName).includes(normalize(search))),
    [ingredients, search],
  );
  const occasional = useMemo(
    () =>
      ingredients
        .filter((item) => !item.quickEnabled)
        .filter((item) => search && normalize(item.displayName).includes(normalize(search)))
        .slice(0, 20),
    [ingredients, search],
  );
  const selected = ingredients.filter((item) => selections[item.id]?.selected);
  const generatedPreparations = [
    ...new Map(
      generated.map((label) => [label.preparationId, label] as const),
    ).values(),
  ];
  const activeIds = new Set(
    history
      .filter((entry) => entry.status === "prepared" && entry.expires_at > nowParis())
      .map((entry) => entry.ingredient_id),
  );

  function update(id: string, patch: Partial<Selection>) {
    setSelections((current) => ({
      ...current,
      [id]: { ...(current[id] ?? initialSelection(ingredients.find((item) => item.id === id)!)), ...patch },
    }));
    setError("");
  }

  function selectIds(ids: string[]) {
    const wanted = new Set(ids);
    setSelections((current) =>
      Object.fromEntries(
        ingredients.map((item) => [
          item.id,
          { ...(current[item.id] ?? initialSelection(item)), selected: wanted.has(item.id) },
        ]),
      ),
    );
  }

  function repeatDate(targetDate: string | null) {
    if (!targetDate) return;
    const ids = history
      .filter((entry) => entry.prepared_at.slice(0, 10) === targetDate)
      .map((entry) => entry.ingredient_id);
    selectIds(ids);
    if (!ids.length) toast.info("Aucune sélection trouvée pour cette date.");
  }

  async function connect() {
    setBusy(true);
    setProgress("Connexion à la T50M Pro…");
    try {
      const runner = runnerRef.current ?? new PrintQueueRunner();
      runnerRef.current = runner;
      await runner.printer.connect();
      setPrinterConnected(true);
      setProgress("T50M Pro connectée");
      toast.success("T50M Pro connectée.");
    } catch (caught) {
      setPrinterConnected(false);
      setProgress(caught instanceof Error ? caught.message : "Connexion impossible.");
      toast.error(caught instanceof Error ? caught.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function generate(print: boolean) {
    if (!selected.length) {
      setError("Sélectionnez au moins un ingrédient réellement préparé.");
      return;
    }
    setBusy(true);
    setError("");
    setTraceabilityWarnings([]);
    setProgress("Enregistrement des préparations et des bacs…");
    try {
      const result = await api<{
        labels: QuickLabelRecord[];
        printJobId: string | null;
        warnings?: string[];
      }>("/api/quick-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          createPrintJob: print,
          selections: selected.map((item) => ({
            ingredientId: item.id,
            ...selections[item.id],
          })),
        }),
      });
      setGenerated(result.labels);
      setTraceabilityWarnings(result.warnings ?? []);
      toast.success(
        `${result.labels.length} étiquette${result.labels.length > 1 ? "s" : ""} enregistrée${result.labels.length > 1 ? "s" : ""}.`,
      );
      if (result.warnings?.length)
        toast.warning("Certaines préparations ont un lot d’origine à compléter.");
      if (print && result.printJobId) {
        const runner = runnerRef.current ?? new PrintQueueRunner();
        runnerRef.current = runner;
        setProgress(`0/${result.labels.length} · Connexion…`);
        const nextQueue = await runner.run(
          result.printJobId,
          canvasRef.current!,
          settings,
          {
            onProgress: (done, total) => setProgress(`${done}/${total} · Transmission terminée`),
            onQueue: setQueue,
          },
        );
        setQueue(nextQueue);
        setPrinterConnected(runner.printer.connected);
        if (nextQueue.status === "completed") toast.success("Toutes les étiquettes sont imprimées.");
        else toast.warning("Certaines étiquettes restent à réimprimer.");
      } else setProgress("Étiquettes créées · à imprimer");
      const refreshed = await api<{ preparations: HistoryEntry[] }>("/api/quick-labels");
      setHistory(refreshed.preparations);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Création impossible.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function retryErrors() {
    if (!canvasRef.current) return;
    setBusy(true);
    try {
      const runner = runnerRef.current ?? new PrintQueueRunner();
      runnerRef.current = runner;
      let jobId = queue?.items.some((item) => item.status === "failed")
        ? queue.id
        : "";
      if (!jobId) {
        const created = await api<{ printJobId: string }>("/api/print-jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ failedOnly: true, settings }),
        });
        jobId = created.printJobId;
      }
      const next = await runner.run(jobId, canvasRef.current, settings, {
        onProgress: (done, total) => setProgress(`${done}/${total} · Nouvel essai`),
        onQueue: setQueue,
      }, true);
      setQueue(next);
      toast.success(next.status === "completed" ? "Réimpression terminée." : "Nouvel essai enregistré.");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Réimpression impossible.");
    } finally {
      setBusy(false);
    }
  }

  function exportSuprint(format: "xlsx" | "csv") {
    if (!generated.length) return;
    try {
      const rows = buildSuprintRows(generated, window.location.origin);
      if (format === "xlsx")
        downloadFile(
          new Uint8Array(buildSuprintXlsx(rows)),
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          suprintFilename("xlsx"),
        );
      else
        downloadFile(
          buildSuprintCsv(rows),
          "text/csv;charset=utf-8",
          suprintFilename("csv"),
        );
      toast.success(
        `${generated.length} étiquette${generated.length > 1 ? "s" : ""} exportée${generated.length > 1 ? "s" : ""} pour SUPRINT.`,
      );
    } catch {
      toast.error("Le fichier SUPRINT n’a pas pu être généré.");
    }
  }

  async function setPreparationStatus(
    preparationId: string,
    status: "discarded" | "consumed" | "transformed_frozen",
    discard?: DiscardDetails,
  ) {
    if (status === "transformed_frozen") {
      onFreeze("quick", preparationId);
      return;
    }
    if (status === "discarded" && !discard) {
      const source = history.find((entry) => entry.id === preparationId),
        generatedSource = generated.find(
          (entry) => entry.preparationId === preparationId,
        );
      setDiscarding({
        id: preparationId,
        name:
          source?.ingredient_name ??
          generatedSource?.ingredientName ??
          "Préparation",
        expiresAt: source?.expires_at ?? generatedSource?.expiresAt ?? "",
      });
      return;
    }
    setStatusBusyId(preparationId);
    try {
      await api(`/api/quick-labels/${preparationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, discard }),
      });
      setHistory((entries) =>
        entries.map((entry) =>
          entry.id === preparationId ? { ...entry, status } : entry,
        ),
      );
      setGenerated((labels) =>
        labels.map((label) =>
          label.preparationId === preparationId
            ? { ...label, status }
            : label,
        ),
      );
      window.dispatchEvent(new Event("haccp-labels-changed"));
      toast.success(
        status === "consumed"
          ? "Préparation marquée comme utilisée."
          : status === "discarded"
            ? "Préparation marquée comme jetée."
            : "Transformation par congélation enregistrée.",
      );
    } catch (caught) {
      const failure =
        caught instanceof Error
          ? caught
          : new Error("Modification impossible.");
      toast.error(failure.message);
      if (discard) throw failure;
    } finally {
      setStatusBusyId(null);
    }
  }

  const yesterday = (() => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 1);
    return nowParis(date).slice(0, 10);
  })();
  const lastDate = history[0]?.prepared_at.slice(0, 10) ?? null;

  if (loading)
    return (
      <div className="panel panel-pad quick-loading">
        <LoaderCircle className="spin" /> Chargement de la mise en place…
      </div>
    );

  return (
    <div className="quick-labels">
      {discarding && (
        <DiscardDialog
          name={discarding.name}
          expired={Boolean(discarding.expiresAt) && discarding.expiresAt <= nowParis()}
          onClose={() => setDiscarding(null)}
          onConfirm={(details) =>
            setPreparationStatus(discarding.id, "discarded", details)
          }
        />
      )}
      <div className="quick-topline">
        <Button variant="outline" className="button" onClick={onBack}>
          <ArrowLeft size={16} /> Étiquettes classiques
        </Button>
        <Button variant="outline" className="button" onClick={onWaste}>
          <Trash2 size={16} /> Registre des produits jetés
        </Button>
        <span className="beta-pill">MODE TEST · T50M PRO</span>
      </div>
      <div className="labels-heading quick-heading">
        <div>
          <p className="eyebrow">HACCP · Étiquettes</p>
          <h2>Mise en place du jour</h2>
          <p>Marquez uniquement ce qui a réellement été préparé, confirmez le lot d’origine, puis imprimez toute la sélection.</p>
        </div>
        <div className="printer-state">
          <span className={printerConnected ? "connected" : ""} />
          {printerConnected ? "T50M Pro connectée" : "Imprimante non connectée"}
        </div>
      </div>
      <div className="quick-tabs">
        <button className={view === "daily" ? "active" : ""} onClick={() => setView("daily")}>
          <CheckSquare size={17} /> Aujourd’hui
        </button>
        <button className={view === "history" ? "active" : ""} onClick={() => setView("history")}>
          <History size={17} /> Historique
        </button>
        {canAdministerRegister(session.role) && (
          <button className={view === "config" ? "active" : ""} onClick={() => { setConfigurationIngredientId(null); setView("config"); }}>
            <Settings2 size={17} /> Configuration
          </button>
        )}
      </div>
      {view === "config" ? (
        <IngredientConfiguration
          ingredients={ingredients}
          initialId={configurationIngredientId}
          onSaved={(saved) => {
            setIngredients((items) =>
              items.some((item) => item.id === saved.id)
                ? items.map((item) => (item.id === saved.id ? saved : item))
                : [...items, saved],
            );
            setSelections((current) => ({ ...current, [saved.id]: { ...(current[saved.id] ?? initialSelection(saved)), operationType: saved.defaultOperation } }));
          }}
        />
      ) : view === "history" ? (
        <UnifiedLabelRegister
          compact
          session={session}
          onEditClassic={onEditClassic}
          onPreviewClassic={onPreviewClassic}
          onDeleteClassic={onDeleteClassic}
          onFreeze={onFreeze}
        />
      ) : (
        <>
          <section className="panel panel-pad quick-actions-panel">
            <div className="quick-actions">
              <Button type="button" variant="outline" className="button" onClick={() => selectIds(frequent.map((item) => item.id))}>
                <Check size={15} /> Sélectionner tout
              </Button>
              <Button type="button" variant="outline" className="button" onClick={() => selectIds([])}>
                Désélectionner tout
              </Button>
              <Button type="button" variant="outline" className="button" onClick={() => selectIds(ingredients.filter((item) => item.favorite).map((item) => item.id))}>
                <Star size={15} /> Favoris
              </Button>
              <Button type="button" variant="outline" className="button" onClick={() => repeatDate(yesterday)}>
                Reprendre hier
              </Button>
              <Button type="button" variant="outline" className="button" onClick={() => repeatDate(lastDate)}>
                Dernière sélection
              </Button>
            </div>
            <div className="quick-search">
              <Search size={17} />
              <Input
                className="input"
                type="search"
                placeholder="Ajouter un ingrédient occasionnel…"
                value={search}
                onFocus={() => setShowOccasional(true)}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setShowOccasional(true);
                }}
              />
            </div>
            <BarcodeScanner
              role={session.role}
              label="Scanner un ingrédient"
              onCreatedIngredient={(item) => {
                setIngredients((current) => current.some((saved) => saved.id === item.id) ? current : [...current, item]);
                setSelections((current) => ({ ...current, [item.id]: current[item.id] ?? initialSelection(item) }));
              }}
              onApply={(values) => {
                const item =
                  values.ingredient ??
                  ingredients.find(
                    (ingredient) =>
                      ingredient.displayName.trim().toLocaleLowerCase("fr") ===
                      values.product?.productName.trim().toLocaleLowerCase("fr"),
                  );
                if (!item) {
                  toast.info(
                    "Produit mémorisé. Configurez-le dans le catalogue des ingrédients avant l’impression rapide.",
                  );
                  return;
                }
                const matchingLot = values.lot
                  ? lots.find(
                      (lot) =>
                        lot.supplierLot.trim().toLowerCase() ===
                        values.lot.trim().toLowerCase(),
                    )
                  : null;
                setShowOccasional(true);
                setSearch(item.displayName);
                update(item.id, {
                  selected: true,
                  sourceLotIds: matchingLot ? [matchingLot.id] : [],
                  manualSourceLot: matchingLot ? "" : values.lot,
                  manualSourceReason:
                    !matchingLot && values.lot
                      ? "Code-barres vérifié sur l’emballage"
                      : "",
                });
                requestAnimationFrame(() =>
                  document
                    .querySelector(`[aria-label="Sélectionner ${CSS.escape(item.displayName)}"]`)
                    ?.closest("article")
                    ?.scrollIntoView({ behavior: "smooth", block: "center" }),
                );
              }}
            />
          </section>
          {error && <div className="notice error" role="alert"><AlertTriangle size={18} /> {error}</div>}
          <div className="quick-checklist">
            {[...frequent, ...(showOccasional ? occasional : [])].map((item) => {
              const state = selections[item.id] ?? initialSelection(item),
                origins = compatibleLots(item, lots),
                selectedOrigins = origins.filter((lot) => state.sourceLotIds.includes(lot.id)),
                expiry = calculateInternalExpiry(
                  state.preparedAt,
                  state.durationOverride ?? item.durationHours,
                  selectedOrigins.map((lot) => lot.supplierDeadline),
                ),
                suggestedToday = item.preparationDays.includes(dayParis());
              return (
                <article className={`quick-item ${state.selected ? "selected" : ""}`} key={item.id}>
                  <div className="quick-item-main">
                    <input
                      type="checkbox"
                      className="quick-checkbox"
                      checked={state.selected}
                      onChange={(event) => update(item.id, { selected: event.target.checked })}
                      aria-label={`Sélectionner ${item.displayName}`}
                    />
                    <button type="button" className="quick-item-title" onClick={() => update(item.id, { selected: !state.selected })}>
                      <strong>{item.displayName}</strong>
                      <span>{OPERATION_LABELS[state.operationType]} · {state.bacCount} bac{state.bacCount > 1 ? "s" : ""}</span>
                    </button>
                    <div className="quick-item-status">
                      {suggestedToday && <span>À préparer</span>}
                      {activeIds.has(item.id) && <span className="warning">Lot actif</span>}
                      {canAdministerRegister(session.role) && (
                        <button
                          type="button"
                          className="quick-config-button"
                          aria-label={`Modifier ${item.displayName}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setConfigurationIngredientId(item.id);
                            setView("config");
                          }}
                        >
                          <PenLine size={14} /> Modifier
                        </button>
                      )}
                    </div>
                  </div>
                  {state.selected && (
                    <div className="quick-item-details">
                      <div className="quick-grid">
                        <Field label="Opération">
                          <select className="input" value={state.operationType} onChange={(event) => update(item.id, { operationType: event.target.value as OperationType })}>
                            {Object.entries(OPERATION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </Field>
                        <Field label="Date / heure">
                          <Input className="input" type="datetime-local" value={state.preparedAt} onChange={(event) => update(item.id, { preparedAt: event.target.value })} />
                        </Field>
                        <Field label="Nombre de bacs">
                          <CountControl value={state.bacCount} label="Nombre de bacs" onChange={(count) => {
                            update(item.id, { bacCount: count, labelCount: Math.max(count, state.labelCount) });
                          }} />
                        </Field>
                        <Field label="Nombre d’étiquettes">
                          <CountControl value={state.labelCount} min={state.bacCount} label="Nombre d’étiquettes" onChange={(labelCount) => update(item.id, { labelCount })} />
                        </Field>
                      </div>
                      <div className="quick-dlc">
                        <Clock3 size={17} />
                        <span><strong>DLC proposée : {dateTime(expiry.expiresAt)}</strong><small>{expiry.cappedBySupplier ? "Limitée par la DLC fournisseur" : `${state.durationOverride ?? item.durationHours} h selon la règle interne`}</small></span>
                      </div>
                      <details className="lot-picker">
                        <summary><PackageCheck size={17} /> Lot(s) d’origine · {state.sourceLotIds.length ? `${state.sourceLotIds.length} confirmé(s)` : "à confirmer"}<ChevronDown size={16} /></summary>
                        <div>
                          {origins.slice(0, 10).map((lot) => (
                            <label key={lot.id} className="source-lot-option">
                              <input type="checkbox" checked={state.sourceLotIds.includes(lot.id)} onChange={() => update(item.id, { sourceLotIds: state.sourceLotIds.includes(lot.id) ? state.sourceLotIds.filter((id) => id !== lot.id) : [...state.sourceLotIds, lot.id] })} />
                              <span><strong>{lot.supplierName} · lot {lot.supplierLot}</strong><small>{lot.ingredientName} · {lot.storageMode === "frozen" ? "surgelé" : lot.storageMode === "ambient" ? "ambiant" : "réfrigéré"} · reçu {dateTime(lot.receivedAt)}{lot.supplierDeadline ? ` · limite ${lot.supplierDeadline.split("-").reverse().join("/")}` : " · DLC/DDM manquante"}{lot.receptionCode ? ` · ${lot.receptionCode}` : ""}{lot.deliveryNote ? ` · BL ${lot.deliveryNote}` : ""}</small></span>
                            </label>
                          ))}
                          {!origins.length && <p>Aucun lot fournisseur enregistré.</p>}
                          <div className="manual-lot">
                            <Field label="Lot manuel si la réception n’existe pas encore">
                              <Input className="input" value={state.manualSourceLot} onChange={(event) => update(item.id, { manualSourceLot: event.target.value })} />
                            </Field>
                            {state.manualSourceLot && (
                              <Field label="Motif obligatoire">
                                <Input className="input" value={state.manualSourceReason} onChange={(event) => update(item.id, { manualSourceReason: event.target.value })} />
                              </Field>
                            )}
                          </div>
                          {item.requiresSourceLot &&
                            !state.sourceLotIds.length &&
                            !state.manualSourceLot.trim() && (
                              <div className="notice warning" role="status">
                                <AlertTriangle size={16} />
                                <span>
                                  L’étiquette peut être créée sans lot. Elle
                                  sera signalée « lot à compléter » dans
                                  l’audit HACCP.
                                </span>
                              </div>
                            )}
                        </div>
                      </details>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          <section className="panel panel-pad quick-printer-panel">
            <div className="printer-controls">
              <Button type="button" variant="outline" className="button" disabled={busy} onClick={connect}>
                {busy ? <LoaderCircle className="spin" size={17} /> : <Bluetooth size={17} />} Connecter l’imprimante
              </Button>
              {printerConnected && (
                <Button type="button" variant="ghost" className="button" onClick={async () => {
                  await runnerRef.current?.printer.disconnect();
                  setPrinterConnected(false);
                  setProgress("Imprimante déconnectée");
                }}><Unplug size={16} /> Déconnecter</Button>
              )}
              <a className="button" href="/printer-diagnostic"><Settings2 size={16} /> Diagnostic & orientation</a>
            </div>
            <PrinterSettingsForm settings={settings} onChange={setSettings} />
            <canvas ref={canvasRef} className="quick-print-canvas" aria-label="Aperçu de la dernière étiquette" />
            {progress && <div className="print-progress"><Printer size={17} /> {progress}</div>}
            <div className="quick-primary-actions">
              <Button className="button primary" disabled={busy || !selected.length} onClick={() => generate(true)}>
                {busy ? <LoaderCircle className="spin" size={18} /> : <Printer size={18} />} Générer et imprimer les étiquettes
              </Button>
              <Button variant="outline" className="button" disabled={busy || !selected.length} onClick={() => generate(false)}>
                <Tags size={17} /> Générer sans imprimer
              </Button>
              <Button variant="outline" className="button danger" disabled={busy} onClick={retryErrors}>
                <RefreshCcw size={17} /> Réimprimer les étiquettes en erreur
              </Button>
            </div>
            {!!traceabilityWarnings.length && (
              <div className="notice warning" role="status">
                <AlertTriangle size={18} />
                <span>
                  <strong>Traçabilité à compléter</strong>
                  {traceabilityWarnings.map((warning) => (
                    <small key={warning}>{warning}</small>
                  ))}
                </span>
              </div>
            )}
            {!!generated.length && (
              <>
                <p className="quick-created"><Check size={16} /> {generated.length} étiquette(s) sauvegardée(s) avant transmission Bluetooth.</p>
                <section className="suprint-export" aria-labelledby="suprint-export-title">
                  <div className="suprint-export-heading">
                    <FileSpreadsheet size={22} />
                    <span>
                      <strong id="suprint-export-title">Exporter le lot pour SUPRINT</strong>
                      <small>{generated.length} ligne{generated.length > 1 ? "s" : ""} · une ligne par étiquette physique</small>
                    </span>
                  </div>
                  <div className="suprint-export-actions">
                    <Button type="button" className="button primary" onClick={() => exportSuprint("xlsx")}>
                      <Download size={17} /> Télécharger Excel
                    </Button>
                    <Button type="button" variant="outline" className="button" onClick={() => exportSuprint("csv")}>
                      <Download size={17} /> Télécharger CSV
                    </Button>
                  </div>
                  <p>
                    Le fichier contient seulement <code>TEXTE_ETIQUETTE</code> et <code>QR_URL</code> pour réutiliser votre modèle 50 × 30 mm. L’export ne marque pas automatiquement les étiquettes comme imprimées.
                  </p>
                </section>
                <div className="quick-generated-lifecycle">
                  {generatedPreparations.map((label) => {
                    const count = generated.filter(
                        (candidate) =>
                          candidate.preparationId === label.preparationId,
                      ).length,
                      closed = ["consumed", "discarded"].includes(label.status),
                      frozen = label.status === "transformed_frozen";
                    return (
                      <div key={label.preparationId}>
                        <span>
                          <strong>{label.ingredientName}</strong>
                          <small>{label.preparationCode} · {count} étiquette{count > 1 ? "s" : ""}</small>
                        </span>
                        {closed ? (
                          <span className={`history-status ${label.status}`}>
                            {label.status === "consumed"
                              ? "Utilisée"
                              : label.status === "discarded"
                                ? "Jetée"
                                : "Transformée / congelée"}
                          </span>
                        ) : (
                          <div className="history-actions">
                            {frozen && <span className="history-status transformed_frozen">Transformée / congelée</span>}
                            <Button variant="outline" className="button" disabled={statusBusyId === label.preparationId} onClick={() => setPreparationStatus(label.preparationId, "consumed")}><CheckSquare size={15} /> Utilisée</Button>
                            {!frozen && <Button variant="outline" className="button" disabled={statusBusyId === label.preparationId} onClick={() => setPreparationStatus(label.preparationId, "transformed_frozen")}><Snowflake size={15} /> Transformer / congeler</Button>}
                            <Button variant="outline" className="button danger" disabled={statusBusyId === label.preparationId} onClick={() => setPreparationStatus(label.preparationId, "discarded")}><Trash2 size={15} /> Jetée</Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function PrinterSettingsForm({
  settings,
  onChange,
}: {
  settings: PrinterSettings;
  onChange: (settings: PrinterSettings) => void;
}) {
  return (
    <details className="printer-settings">
      <summary><Settings2 size={16} /> Réglages mémorisés sur ce téléphone <ChevronDown size={15} /></summary>
      <div className="quick-grid">
        <Field label="Format">
          <select className="input" value={settings.format} onChange={(event) => onChange({ ...settings, format: event.target.value as PrinterSettings["format"] })}>
            <option value="50x30">50 × 30 mm</option>
            <option value="30x20">30 × 20 mm · futur</option>
            <option value="50x80">50 × 80 mm · futur</option>
          </select>
        </Field>
        <Field label="Rotation">
          <select className="input" value={settings.rotation} onChange={(event) => onChange({ ...settings, rotation: Number(event.target.value) as PrinterSettings["rotation"] })}>
            {[0, 90, 180, 270].map((value) => <option key={value} value={value}>{value}°</option>)}
          </select>
        </Field>
        <Field label="Marge horizontale">
          <Input className="input" type="number" min="-80" max="80" value={settings.marginX} onChange={(event) => onChange({ ...settings, marginX: Number(event.target.value) })} />
        </Field>
        <Field label="Marge verticale">
          <Input className="input" type="number" min="-80" max="80" value={settings.marginY} onChange={(event) => onChange({ ...settings, marginY: Number(event.target.value) })} />
        </Field>
        <Field label="Densité (1–15)">
          <Input className="input" type="number" min="1" max="15" value={settings.density} onChange={(event) => onChange({ ...settings, density: Number(event.target.value) })} />
        </Field>
        <label className="source-lot-option compact"><input type="checkbox" checked={settings.mirrorHorizontal} onChange={(event) => onChange({ ...settings, mirrorHorizontal: event.target.checked })} /> Miroir horizontal</label>
        <label className="source-lot-option compact"><input type="checkbox" checked={settings.mirrorVertical} onChange={(event) => onChange({ ...settings, mirrorVertical: event.target.checked })} /> Miroir vertical</label>
      </div>
    </details>
  );
}

function IngredientConfiguration({
  ingredients,
  initialId,
  onSaved,
}: {
  ingredients: IngredientConfig[];
  initialId: string | null;
  onSaved: (item: IngredientConfig) => void;
}) {
  const first = ingredients.find((item) => item.id === initialId) ?? ingredients[0];
  const [selectedId, setSelectedId] = useState(first?.id ?? "");
  const selected = ingredients.find((item) => item.id === selectedId) ?? ingredients[0];
  const [draft, setDraft] = useState<IngredientConfig | null>(first ?? selected ?? null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const blank = (): IngredientConfig => ({
    id: "",
    legacyCode: "",
    displayName: "",
    shortName: "",
    category: "Mise en place pizza & burgers",
    productType: "frais",
    active: true,
    quickEnabled: true,
    favorite: true,
    displayOrder: 1000,
    preparationDays: [1, 2, 3, 4, 5, 6],
    defaultOperation: "internal_preparation",
    storageMode: "refrigerated",
    storageTemperature: 4,
    defaultBacs: 1,
    defaultLabels: 1,
    labelFormat: "50x30",
    technicalDescription: "",
    allergens: "À confirmer sur l’étiquette fournisseur",
    preparationProcedure: "",
    handlingRules: "",
    usageCount: 0,
    revision: 1,
    durationHours: 48,
    requiresSourceLot: true,
  });
  if (!draft) return <div className="panel panel-pad">Catalogue vide.</div>;
  const change = <K extends keyof IngredientConfig>(key: K, value: IngredientConfig[K]) => setDraft((current) => current ? { ...current, [key]: value } : current);
  async function save() {
    setSaving(true);
    setError("");
    try {
      const result = await api<{ ingredient: IngredientConfig }>("/api/ingredients", {
        method: creating ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, reason }),
      });
      setDraft(result.ingredient);
      setSelectedId(result.ingredient.id);
      setCreating(false);
      setReason("");
      onSaved(result.ingredient);
      toast.success(creating ? "Nouvel ingrédient ajouté à la checklist." : "Configuration de l’ingrédient enregistrée.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="panel panel-pad ingredient-config">
      <p className="eyebrow">Administration</p>
      <h3>Ingrédients fréquents et règles de DLC</h3>
      <p className="muted-note">Modifiez les libellés imprimés, les quantités habituelles et les règles de chaque fiche, ou ajoutez un ingrédient qui n’existe pas encore. La DLC est une règle PMS interne modifiable ; la limite fournisseur la plus courte reste toujours prioritaire.</p>
      <div className="ingredient-config-toolbar">
        <div className="quick-search">
          <Search size={17} />
          <Input className="input" type="search" placeholder="Rechercher tomate, jambon, cheddar…" value={search} onChange={(event) => setSearch(event.target.value)} disabled={creating} />
        </div>
        <Button type="button" variant="outline" className="button" onClick={() => { setCreating(true); setSelectedId(""); setDraft(blank()); setReason(""); setError(""); }}>
          <Plus size={17} /> Nouvel ingrédient
        </Button>
      </div>
      {creating && <div className="notice"><Plus size={17} /> Nouvelle fiche : elle sera enregistrée dans le catalogue réel et pourra être utilisée immédiatement.</div>}
      <Field label="Ingrédient du catalogue réel">
        <select className="input" value={creating ? "" : draft.id} disabled={creating} onChange={(event) => {
          const next = ingredients.find((item) => item.id === event.target.value) ?? null;
          setSelectedId(event.target.value);
          setDraft(next);
          setCreating(false);
          setReason("");
          setError("");
        }}>
          {creating && <option value="">Nouvel ingrédient</option>}
          {ingredients
            .filter((item) => !search || normalize(`${item.displayName} ${item.shortName} ${item.category}`).includes(normalize(search)))
            .map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
        </select>
      </Field>
      <div className="quick-grid">
        <Field label="Nom affiché"><Input className="input" value={draft.displayName} onChange={(event) => change("displayName", event.target.value)} /></Field>
        <Field label="Nom court étiquette"><Input className="input" maxLength={32} value={draft.shortName} onChange={(event) => change("shortName", event.target.value)} /></Field>
        <Field label="Famille"><Input className="input" value={draft.category} onChange={(event) => change("category", event.target.value)} /></Field>
        <Field label="Type de produit"><Input className="input" value={draft.productType} onChange={(event) => change("productType", event.target.value)} /></Field>
        <Field label="Opération par défaut">
          <select className="input" value={draft.defaultOperation} onChange={(event) => change("defaultOperation", event.target.value as OperationType)}>
            {Object.entries(OPERATION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <Field label="DLC interne (heures)"><Input className="input" type="number" min="1" max="8760" value={draft.durationHours} onChange={(event) => change("durationHours", Number(event.target.value))} /></Field>
        <Field label="Ordre d’affichage"><Input className="input" type="number" min="1" max="9999" value={draft.displayOrder} onChange={(event) => change("displayOrder", Number(event.target.value))} /></Field>
        <Field label="Mode de conservation"><select className="input" value={draft.storageMode} onChange={(event) => change("storageMode", event.target.value as IngredientConfig["storageMode"])}><option value="refrigerated">Réfrigéré</option><option value="frozen">Surgelé / congelé</option><option value="ambient">Température ambiante</option></select></Field>
        <Field label="Température °C"><Input className="input" type="number" step="0.1" value={draft.storageTemperature ?? ""} onChange={(event) => change("storageTemperature", event.target.value === "" ? null : Number(event.target.value))} /></Field>
        <Field label="Bacs habituels"><Input className="input" type="number" min="1" max="50" value={draft.defaultBacs} onChange={(event) => change("defaultBacs", Number(event.target.value))} /></Field>
        <Field label="Étiquettes habituelles"><Input className="input" type="number" min={draft.defaultBacs} max="50" value={draft.defaultLabels} onChange={(event) => change("defaultLabels", Number(event.target.value))} /></Field>
        <Field label="Format">
          <select className="input" value={draft.labelFormat} onChange={(event) => change("labelFormat", event.target.value as IngredientConfig["labelFormat"])}><option value="50x30">50 × 30</option><option value="30x20">30 × 20</option><option value="50x80">50 × 80</option></select>
        </Field>
      </div>
      <div className="config-checks">
        <label><input type="checkbox" checked={draft.quickEnabled} onChange={(event) => change("quickEnabled", event.target.checked)} /> Afficher dans la checklist</label>
        <label><input type="checkbox" checked={draft.favorite} onChange={(event) => change("favorite", event.target.checked)} /> Favori</label>
        <label><input type="checkbox" checked={draft.requiresSourceLot} onChange={(event) => change("requiresSourceLot", event.target.checked)} /> Alerter si le lot d’origine manque</label>
      </div>
      <Field label="Jours habituels (0 dimanche → 6 samedi)">
        <div className="day-checks">{[0, 1, 2, 3, 4, 5, 6].map((day) => <label key={day}><input type="checkbox" checked={draft.preparationDays.includes(day)} onChange={() => change("preparationDays", draft.preparationDays.includes(day) ? draft.preparationDays.filter((value) => value !== day) : [...draft.preparationDays, day])} /> {['D','L','M','M','J','V','S'][day]}</label>)}</div>
      </Field>
      <Field label="Fiche technique"><Textarea className="input textarea" value={draft.technicalDescription} onChange={(event) => change("technicalDescription", event.target.value)} /></Field>
      <Field label="Allergènes"><Textarea className="input textarea" value={draft.allergens} onChange={(event) => change("allergens", event.target.value)} /></Field>
      <Field label="Procédure de préparation"><Textarea className="input textarea" value={draft.preparationProcedure} onChange={(event) => change("preparationProcedure", event.target.value)} /></Field>
      <Field label="Règles frais / ouvert / congelé / décongelé"><Textarea className="input textarea" value={draft.handlingRules} onChange={(event) => change("handlingRules", event.target.value)} /></Field>
      {!creating && <Field label="Motif si la DLC change"><Input className="input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Obligatoire uniquement si la durée est modifiée" /></Field>}
      {error && <div className="notice error">{error}</div>}
      <div className="button-row">
        <Button className="button primary" disabled={saving} onClick={save}>{saving ? <LoaderCircle className="spin" size={17} /> : creating ? <Plus size={17} /> : <Settings2 size={17} />} {creating ? "Créer et ajouter" : "Enregistrer la configuration"}</Button>
        {creating && <Button type="button" variant="outline" className="button" onClick={() => { const next = ingredients[0] ?? null; setCreating(false); setSelectedId(next?.id ?? ""); setDraft(next); setError(""); }}>Annuler</Button>}
      </div>
    </div>
  );
}

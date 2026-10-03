"use client";

import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Cloud,
  CookingPot,
  Download,
  ExternalLink,
  FileText,
  FileSpreadsheet,
  Info,
  LoaderCircle,
  LockKeyhole,
  Printer,
  QrCode,
  Save,
  Settings2,
  Sparkles,
  Snowflake,
  Thermometer,
  Truck,
  Users,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  alarms,
  csvForMonth,
  DEFAULT_SETTINGS,
  displayTemp,
  daysOfMonth,
  EQUIPMENT,
  isClosed,
  isValidDate,
  parseTemperature,
  timeParis,
  todayParis,
  validWorkbookUrl,
  type Reading,
  type Settings,
} from "@/lib/frigo";
import type { EquipmentId } from "@/lib/temperature-history";
import { canAdministerRegister, type RegisterSession } from "@/lib/access-types";
import TeamPanel from "./team-panel";
import LabelsPanel from "./labels-panel";
import ExpiryAlerts from "./expiry-alerts";
import WeeklyReportLauncher from "./weekly-report-launcher";

const TemperatureCharts = lazy(() => import("./temperature-charts"));
const ReceptionPanel = lazy(() => import("./reception-panel"));
const HygienePanel = lazy(() => import("./hygiene-panel"));

class ChartLoadBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div className="notice error" role="alert">
          Impossible de charger les graphiques. Vos relevés restent accessibles
          dans les autres onglets. Enregistrez les éventuelles modifications,
          puis rouvrez l’application lorsque la connexion est rétablie.
        </div>
      );
    return this.props.children;
  }
}

const emptyValues = () => Object.fromEntries(EQUIPMENT.map((e) => [e.id, ""]));
function monthName(month: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(month + "-01T12:00:00Z"));
}
function signed(n: number) {
  return `${n > 0 ? "+" : ""}${String(n).replace(".", ",")}`;
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, cache: "no-store" });
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("application/json"))
    throw new Error(
      "Votre session a expiré. Rouvrez l’application pour vous reconnecter.",
    );
  const result = await res.json();
  if (!res.ok)
    throw new Error(result.error ?? "La demande a échoué. Réessayez.");
  return result;
}

export default function FrigoApp({ session }: { session: RegisterSession }) {
  const isOwner = session.role === "owner";
  const canAdminister = canAdministerRegister(session.role);
  const [today, setToday] = useState(todayParis);
  const [date, setDate] = useState(todayParis);
  const month = date.slice(0, 7);
  const [tab, setTab] = useState(() => {
    if (typeof window === "undefined") return "entry";
    const requested = new URLSearchParams(window.location.search).get("tab");
    return ["entry", "registry", "charts", "labels", "receptions", "fryer", "cleaning", "reports", "excel", "team"].includes(requested ?? "") ? requested! : "entry";
  });
  const [chartEquipment, setChartEquipment] =
    useState<EquipmentId>("cong_ch_1");
  const [records, setRecords] = useState<Reading[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [values, setValues] = useState<Record<string, string>>(emptyValues);
  const [time, setTime] = useState(timeParis);
  const [initials, setInitials] = useState("");
  const [note, setNote] = useState("");
  const [exception, setException] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [reload, setReload] = useState(0);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [thresholdDraft, setThresholdDraft] = useState<Record<string, string>>(
    {},
  );
  const [settingsError, setSettingsError] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [linkError, setLinkError] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [importNotice, setImportNotice] = useState("");
  const [pendingTeamCount, setPendingTeamCount] = useState(0);

  useEffect(() => {
    const status = () => {
      setOffline(!navigator.onLine);
      setToday(todayParis());
    };
    status();
    window.addEventListener("online", status);
    window.addEventListener("offline", status);
    window.addEventListener("focus", status);
    return () => {
      window.removeEventListener("online", status);
      window.removeEventListener("offline", status);
      window.removeEventListener("focus", status);
    };
  }, []);

  useEffect(() => {
    if (!isOwner) return;
    let active = true;
    const refresh = () =>
      api<{ members: Array<{ status: string }> }>("/api/team?offset=0")
        .then((result) => {
          if (active)
            setPendingTeamCount(
              result.members.filter((member) => member.status === "pending").length,
            );
        })
        .catch(() => {});
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [isOwner]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setLoading(true);
        setLoadError("");
      }
    });
    (isOwner
      ? api<{ status: string; date?: string }>("/api/readings/import", {
          method: "POST",
          signal: controller.signal,
        })
      : Promise.resolve<{ status: string; date?: string }>({ status: "none" })
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        setImportNotice(
          result.status === "conflict"
            ? "Le relevé à importer depuis Excel a déjà été modifié dans l’application. Aucune valeur n’a été remplacée."
            : "",
        );
        if (result.status === "imported" && result.date)
          toast.success(
            `Relevé du ${result.date.split("-").reverse().join("/")} importé depuis Excel.`,
          );
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setImportNotice(
            error instanceof Error
              ? error.message
              : "L’import Excel n’a pas pu être effectué.",
          );
      })
      .then(() =>
        Promise.all([
          api<{ readings: Reading[] }>(`/api/readings?month=${month}`, {
            signal: controller.signal,
          }),
          api<{ settings: Settings; sync: { enabled: boolean } }>(
            "/api/settings",
            { signal: controller.signal },
          ),
        ]),
      )
      .then(([data, config]) => {
        if (controller.signal.aborted) return;
        const record = data.readings.find((r) => r.date === date);
        setRecords(data.readings);
        setSettings(config.settings);
        setLinkDraft(config.settings.workbookUrl);
        setSyncEnabled(config.sync.enabled);
        setValues(
          record
            ? Object.fromEntries(
                EQUIPMENT.map((e) => [
                  e.id,
                  displayTemp(record.temperatures[e.id]),
                ]),
              )
            : emptyValues(),
        );
        setTime(record?.time ?? timeParis());
        let preferred = "";
        try {
          preferred = localStorage.getItem("sancta-initials") ?? "";
        } catch {}
        setInitials(record?.initials ?? preferred);
        setNote(record?.note ?? "");
        setException(record?.exception ?? false);
        setRevision(record?.revision ?? 0);
        setDirty(false);
        setFormError("");
        setLoading(false);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Impossible de charger vos relevés.",
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [date, month, reload, isOwner]);

  useEffect(() => {
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);

  const parsed = useMemo(
    () =>
      Object.fromEntries(
        EQUIPMENT.map((e) => [e.id, parseTemperature(values[e.id] ?? "")]),
      ),
    [values],
  );
  const filled = EQUIPMENT.filter((e) => parsed[e.id] !== null).length;
  const selectedRecord = records.find((r) => r.date === date);
  const activeThresholds =
    !dirty && selectedRecord ? selectedRecord.thresholds : settings.thresholds;
  const over = EQUIPMENT.filter(
    (e) => parsed[e.id] !== null && parsed[e.id]! > activeThresholds[e.id],
  );
  const closed = isClosed(date);
  const contributorReadOnly = !canAdminister && revision > 0;
  const locked =
    loading ||
    !!loadError ||
    saving ||
    contributorReadOnly ||
    (closed && !exception);
  const savedRecord = records.find((r) => r.date === date);
  const byDate = new Map(records.map((r) => [r.date, r]));
  const days = daysOfMonth(month);
  const dueDays = days.filter((d) => d <= today && !isClosed(d));
  const missed = dueDays.filter((d) => d < today && !byDate.has(d)).length;

  function changeDate(next: string) {
    if (!isValidDate(next) || next > today || next === date) return;
    if (dirty) {
      setPendingDate(next);
      return;
    }
    setLoading(true);
    setDate(next);
  }
  function stepMonth(step: number) {
    const current = new Date(month + "-01T12:00:00Z");
    current.setUTCMonth(current.getUTCMonth() + step);
    const next = current.toISOString().slice(0, 7);
    if (next > today.slice(0, 7)) return;
    changeDate(next === today.slice(0, 7) ? today : next + "-01");
  }
  function editValue(id: string, value: string) {
    setValues((prev) => ({ ...prev, [id]: value }));
    setDirty(true);
    setFormError("");
  }
  async function saveRecord(event?: FormEvent) {
    event?.preventDefault();
    if (locked) return;
    const missing = EQUIPMENT.find((e) => parsed[e.id] === null);
    if (missing) {
      setFormError("Complétez les 13 températures avant d’enregistrer.");
      document.getElementById(missing.id)?.focus();
      return;
    }
    if (!initials.trim()) {
      setFormError(
        "Ajoutez les initiales de la personne qui a fait le relevé.",
      );
      document.getElementById("initials")?.focus();
      return;
    }
    if (over.length && !note.trim()) {
      setFormError(
        "Décrivez l’écart et l’action menée pour les températures signalées.",
      );
      document.getElementById("note")?.focus();
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const result = await api<{ reading: Reading }>("/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          time,
          initials,
          note,
          exception,
          revision,
          temperatures: parsed,
        }),
      });
      setRecords((prev) =>
        [...prev.filter((r) => r.date !== date), result.reading].sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
      );
      setRevision(result.reading.revision);
      setDirty(false);
      try {
        localStorage.setItem("sancta-initials", initials.trim());
      } catch {}
      toast.success("Relevé enregistré dans l’application.");
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "L’enregistrement a échoué. Réessayez.",
      );
    } finally {
      setSaving(false);
    }
  }
  function exportMonth() {
    const blob = new Blob([csvForMonth(month, records)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Sancta_Maria_Temperatures_${month}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function openSettings() {
    setThresholdDraft(
      Object.fromEntries(
        EQUIPMENT.map((e) => [e.id, String(settings.thresholds[e.id])]),
      ),
    );
    setSettingsError("");
    setSettingsOpen(true);
  }
  async function saveSettings() {
    const thresholds = Object.fromEntries(
      EQUIPMENT.map((e) => [
        e.id,
        parseTemperature(thresholdDraft[e.id] ?? ""),
      ]),
    );
    if (Object.values(thresholds).some((v) => v === null)) {
      setSettingsError("Vérifiez chaque seuil, en degrés Celsius.");
      return;
    }
    setSettingsSaving(true);
    setSettingsError("");
    try {
      const result = await api<{ settings: Settings }>("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thresholds, workbookUrl: settings.workbookUrl }),
      });
      setSettings(result.settings);
      setSettingsOpen(false);
      toast.success("Seuils mis à jour pour les prochains enregistrements.");
    } catch (error) {
      setSettingsError(
        error instanceof Error ? error.message : "Impossible d’enregistrer.",
      );
    } finally {
      setSettingsSaving(false);
    }
  }
  async function saveLink(event: FormEvent) {
    event.preventDefault();
    const url = linkDraft.trim();
    if (!url || !validWorkbookUrl(url)) {
      setLinkError(
        "Collez le lien de partage HTTPS de votre fichier OneDrive.",
      );
      return;
    }
    setLinkSaving(true);
    setLinkError("");
    try {
      const result = await api<{ settings: Settings }>("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, workbookUrl: url }),
      });
      setSettings(result.settings);
      toast.success("Lien du classeur enregistré.");
    } catch (error) {
      setLinkError(
        error instanceof Error
          ? error.message
          : "Impossible d’enregistrer le lien.",
      );
    } finally {
      setLinkSaving(false);
    }
  }
  const monthControls = (id: string) => (
    <div className="date-toolbar">
      <Button
        variant="outline"
        className="icon-button"
        aria-label="Mois précédent"
        onClick={() => stepMonth(-1)}
        disabled={loading || saving}
      >
        <ChevronLeft size={18} />
      </Button>
      <label className="sr-only" htmlFor={id}>
        Mois du registre
      </label>
      <Input
        id={id}
        type="month"
        className="input"
        value={month}
        max={today.slice(0, 7)}
        disabled={loading || saving}
        onChange={(e) => {
          if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value))
            changeDate(
              e.target.value === today.slice(0, 7)
                ? today
                : e.target.value + "-01",
            );
        }}
      />
      <Button
        variant="outline"
        className="icon-button"
        aria-label="Mois suivant"
        onClick={() => stepMonth(1)}
        disabled={month >= today.slice(0, 7) || loading || saving}
      >
        <ChevronRight size={18} />
      </Button>
    </div>
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark brand-logo" aria-hidden="true" />
            <div>
              <div className="brand-name">
                Sancta Maria <span style={{ color: "#d8ba78" }}>1187</span>
              </div>
              <div className="brand-sub">SUIVI HACCP</div>
            </div>
          </div>
          <div className="private-label">
            <LockKeyhole size={16} />
            <span>{isOwner ? "Propriétaire" : session.role === "admin" ? "Administrateur" : "Membre autorisé"}</span>
          </div>
        </div>
      </header>
      <main className="main">
        <div className="page-heading">
          <div>
            <p className="eyebrow">
              {tab === "receptions"
                ? "Contrôle des livraisons"
                : tab === "labels"
                  ? "Préparations et traçabilité"
                  : tab === "fryer"
                    ? "Entretien de l’huile"
                    : tab === "cleaning"
                      ? "Plan de nettoyage"
                  : tab === "reports"
                    ? "Synthèse hebdomadaire"
                    : tab === "team"
                      ? "Utilisateurs et permissions"
                      : "Suivi du froid"}
            </p>
            <h1>
              {tab === "receptions"
                ? "Réception marchandises"
                : tab === "labels"
                  ? "Étiquettes HACCP"
                  : tab === "fryer"
                    ? "Filtrage de la friteuse"
                    : tab === "cleaning"
                      ? "Nettoyage de la cuisine"
                  : tab === "reports"
                    ? "Rapports HACCP"
                    : tab === "team"
                      ? "Équipe HACCP"
                      : "Relevé des températures"}
            </h1>
            <p className="subline">
              {tab === "receptions"
                ? `Contrôle, lots et traçabilité · ${session.displayName}`
                : tab === "labels"
                  ? `Création, impression et échéances · ${session.displayName}`
                  : tab === "fryer"
                    ? `Filtrage, état de l’huile et validation · ${session.displayName}`
                    : tab === "cleaning"
                      ? `Zones, anomalies et signature quotidienne · ${session.displayName}`
                  : tab === "reports"
                    ? `Toute l’activité HACCP de la semaine · ${session.displayName}`
                    : tab === "team"
                      ? `Demandes d’accès et membres autorisés · ${session.displayName}`
                      : `13 équipements · Une mesure quotidienne · ${session.displayName}`}
            </p>
          </div>
          {isOwner && ["entry", "registry", "charts"].includes(tab) && (
            <Button
              variant="outline"
              className="icon-button"
              aria-label="Régler les seuils des équipements"
              onClick={openSettings}
              disabled={loading || !!loadError}
            >
              <Settings2 size={20} />
            </Button>
          )}
        </div>
        {offline && (
          <div className="notice warning no-print">
            <WifiOff size={18} />
            <span>
              Vous êtes hors connexion. Gardez cette page ouverte et
              reconnectez-vous avant d’enregistrer.
            </span>
          </div>
        )}
        {importNotice && (
          <div className="notice warning no-print" role="alert">
            <Info size={18} />
            <span>{importNotice}</span>
          </div>
        )}
        <ExpiryAlerts />
        {loadError && (
          <div className="notice error no-print" role="alert">
            <AlertTriangle size={18} />
            <div>
              {loadError}
              <div className="button-row" style={{ marginTop: 10 }}>
                <Button
                  variant="outline"
                  className="button"
                  onClick={() => setReload((n) => n + 1)}
                >
                  Réessayer
                </Button>
                <Button
                  variant="outline"
                  className="button"
                  onClick={() => location.assign("/")}
                >
                  Rouvrir l’application
                </Button>
              </div>
            </div>
          </div>
        )}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList
            className={`nav-tabs nav-tabs-${session.role}`}
            aria-label="Navigation du registre"
          >
            <TabsTrigger value="entry">
              <Thermometer size={17} />
              Relevé
            </TabsTrigger>
            <TabsTrigger value="registry">
              <CalendarDays size={17} />
              Registre
            </TabsTrigger>
            <TabsTrigger value="charts">
              <ChartNoAxesCombined size={17} aria-hidden="true" />
              Graphiques
            </TabsTrigger>
            <TabsTrigger value="labels">
              <QrCode size={17} />
              Étiquettes
            </TabsTrigger>
            <TabsTrigger value="receptions">
              <Truck size={17} />
              Réceptions
            </TabsTrigger>
            <TabsTrigger value="fryer">
              <CookingPot size={17} />
              Friteuse
            </TabsTrigger>
            <TabsTrigger value="cleaning">
              <Sparkles size={17} />
              Nettoyage
            </TabsTrigger>
            {canAdminister && (
              <TabsTrigger value="reports">
                <FileText size={17} />
                Rapports
              </TabsTrigger>
            )}
            {isOwner && (
              <TabsTrigger value="excel">
                <FileSpreadsheet size={17} />
                Excel
              </TabsTrigger>
            )}
            {isOwner && (
              <TabsTrigger value="team">
                <Users size={17} />
                Équipe
                {pendingTeamCount > 0 && <span className="nav-count" aria-label={`${pendingTeamCount} demande(s) en attente`}>{pendingTeamCount}</span>}
              </TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="entry" className="entry-view">
            {contributorReadOnly && (
              <div className="notice">
                <LockKeyhole size={18} />
                <span>
                  Ce relevé existe déjà. En tant que membre, vous pouvez le
                  consulter mais seul le responsable peut le corriger.
                </span>
              </div>
            )}
            {closed && (
              <div className="notice closed-notice">
                <div>
                  <strong>Jour de fermeture</strong>
                  <div>Lundi et mardi sont grisés dans le registre.</div>
                </div>
                <label className="switch-line">
                  <Switch
                    checked={exception}
                    disabled={loading || saving || !!loadError}
                    onCheckedChange={(value) => {
                      setException(value);
                      setDirty(true);
                    }}
                    aria-label="Autoriser un relevé exceptionnel"
                  />
                  <span>
                    Relevé
                    <br />
                    exceptionnel
                  </span>
                </label>
              </div>
            )}
            <div className="entry-layout">
              <form
                id="reading-form"
                className="panel"
                onSubmit={saveRecord}
                aria-busy={loading || saving}
              >
                <div className="metadata">
                  <label className="field" htmlFor="record-date">
                    Date
                    <Input
                      className="input"
                      id="record-date"
                      type="date"
                      value={date}
                      max={today}
                      disabled={saving}
                      onChange={(e) => changeDate(e.target.value)}
                    />
                  </label>
                  <label className="field" htmlFor="record-time">
                    Heure
                    <Input
                      className="input"
                      id="record-time"
                      type="time"
                      required
                      value={time}
                      disabled={locked}
                      onChange={(e) => {
                        setTime(e.target.value);
                        setDirty(true);
                      }}
                    />
                  </label>
                  <label className="field" htmlFor="initials">
                    Initiales
                    <Input
                      className="input"
                      id="initials"
                      placeholder="AG"
                      autoComplete="off"
                      maxLength={12}
                      value={initials}
                      disabled={locked}
                      onChange={(e) => {
                        setInitials(e.target.value);
                        setDirty(true);
                      }}
                    />
                  </label>
                </div>
                <div className="mobile-progress">
                  <span>
                    {loading ? (
                      "Chargement…"
                    ) : (
                      <>
                        <strong>{filled} / 13</strong> températures
                      </>
                    )}
                  </span>
                  {over.length > 0 ? (
                    <span className="status-pill danger">
                      <AlertTriangle size={13} />
                      {over.length} écart{over.length > 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="muted-note">°C</span>
                  )}
                </div>
                {(["freezer", "fridge"] as const).map((group) => (
                  <section key={group} aria-labelledby={group + "-title"}>
                    <div className="section-heading">
                      <h2 id={group + "-title"}>
                        {group === "freezer" ? (
                          <Snowflake size={17} />
                        ) : (
                          <Thermometer size={17} />
                        )}{" "}
                        {group === "freezer" ? "Congélateurs" : "Froid positif"}
                      </h2>
                      <small>
                        {group === "freezer"
                          ? "4 équipements"
                          : "9 équipements"}
                      </small>
                    </div>
                    <div className="equipment-list">
                      {EQUIPMENT.filter((e) => e.group === group).map((e) => {
                        const value = parsed[e.id];
                        const hasValue = value !== null;
                        const alert =
                          hasValue && value > activeThresholds[e.id];
                        const invalid = Boolean(
                          values[e.id] && values[e.id] !== "-" && !hasValue,
                        );
                        return (
                          <div className="equipment-row" key={e.id}>
                            <div className="equip-info">
                              <label className="equip-name" htmlFor={e.id}>
                                {e.name}
                              </label>
                              <div
                                className={
                                  "equip-caption" + (alert ? " alarm" : "")
                                }
                                id={e.id + "-help"}
                              >
                                {alert ? (
                                  <>
                                    <AlertTriangle size={12} />
                                    Seuil dépassé
                                  </>
                                ) : invalid ? (
                                  "Valeur à corriger"
                                ) : (
                                  <>
                                    Seuil ≤ {signed(activeThresholds[e.id])} °C
                                  </>
                                )}
                              </div>
                            </div>
                            <div
                              className={
                                "temperature-box " +
                                (alert
                                  ? "alarm"
                                  : invalid
                                    ? "invalid"
                                    : hasValue
                                      ? "filled"
                                      : "")
                              }
                            >
                              <button
                                type="button"
                                className="sign-button"
                                disabled={locked}
                                onClick={() =>
                                  editValue(
                                    e.id,
                                    values[e.id].startsWith("-")
                                      ? values[e.id].slice(1)
                                      : "-" + values[e.id],
                                  )
                                }
                                aria-label={`Changer le signe : ${e.name}`}
                                title="Changer le signe"
                              >
                                ±
                              </button>
                              <Input
                                id={e.id}
                                type="text"
                                inputMode="decimal"
                                autoComplete="off"
                                maxLength={7}
                                placeholder="—"
                                value={values[e.id] ?? ""}
                                disabled={locked}
                                aria-describedby={e.id + "-help"}
                                aria-invalid={invalid}
                                onChange={(ev) =>
                                  editValue(e.id, ev.target.value)
                                }
                                onKeyDown={(ev) => {
                                  if (ev.key === "Enter") {
                                    ev.preventDefault();
                                    const index = EQUIPMENT.findIndex(
                                      (item) => item.id === e.id,
                                    );
                                    document
                                      .getElementById(
                                        EQUIPMENT[index + 1]?.id ?? "note",
                                      )
                                      ?.focus();
                                  }
                                }}
                              />
                              <span>°C</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
                <div className="note-section">
                  <label className="field" htmlFor="note">
                    Écart / action{" "}
                    {over.length > 0 ? "· obligatoire" : "· facultatif"}
                    <Textarea
                      className="input"
                      id="note"
                      value={note}
                      disabled={locked}
                      maxLength={2000}
                      placeholder="Ex. : porte refermée, contrôle effectué…"
                      onChange={(e) => {
                        setNote(e.target.value);
                        setDirty(true);
                      }}
                    />
                  </label>
                  <p className="muted-note" style={{ marginBottom: 0 }}>
                    Notez les actions réellement réalisées. Les écarts restent
                    visibles dans le registre.
                  </p>
                </div>
              </form>
              <aside className="side-summary">
                <div className="aside-card">
                  <h2 className="aside-title">
                    <ClipboardList size={17} />
                    Votre relevé
                  </h2>
                  <div className="counter">
                    {filled}
                    <span> / 13</span>
                  </div>
                  <Progress
                    className="progress-bar"
                    value={(filled / 13) * 100}
                    aria-label={`${filled} températures renseignées sur 13`}
                  />
                  <p className="aside-note">
                    {filled === 13
                      ? "Toutes les températures sont renseignées."
                      : `${13 - filled} température${13 - filled > 1 ? "s" : ""} à renseigner.`}
                  </p>
                  {over.length > 0 && (
                    <p className="stat-line" style={{ color: "#a53029" }}>
                      <AlertTriangle size={15} />
                      {over.length} écart{over.length > 1 ? "s" : ""} à
                      documenter
                    </p>
                  )}
                </div>
                <div className="aside-card">
                  <h2 className="aside-title">
                    <Cloud size={17} />
                    Sauvegarde
                  </h2>
                  <p className="aside-note">
                    Les relevés enregistrés restent disponibles sur vos
                    appareils.
                  </p>
                  {isOwner && <a className="button wide" href="/backup" style={{ marginTop: 12 }}>Sauvegarde complète</a>}
                  <hr className="divider" style={{ margin: "16px 0" }} />
                  <span
                    className={"status-pill " + (syncEnabled ? "ok" : "warn")}
                  >
                    {syncEnabled ? "Excel : relié" : "Excel : à relier"}
                  </span>
                  <p className="aside-note" style={{ marginTop: 10 }}>
                    {syncEnabled
                      ? "La copie de l’application vers OneDrive est planifiée chaque heure."
                      : "L’envoi automatique vers OneDrive reste à configurer."}
                  </p>
                  <Button
                    variant="outline"
                    className="button wide"
                    style={{ marginTop: 14 }}
                    onClick={() => setTab("excel")}
                  >
                    Voir le classeur
                    <ChevronRight size={15} />
                  </Button>
                </div>
                <p className="muted-note" style={{ padding: "0 6px" }}>
                  Les seuils reprennent votre feuille : −18 °C et +4 °C par
                  défaut. Adaptez-les à votre plan HACCP et aux produits
                  stockés.
                </p>
              </aside>
            </div>
            {formError && (
              <div
                className="notice error"
                role="alert"
                style={{ marginTop: 16 }}
              >
                <AlertTriangle size={18} />
                <div>
                  {formError}
                  {formError.includes("autre appareil") && (
                    <Button
                      className="button"
                      variant="outline"
                      style={{ marginTop: 8 }}
                      onClick={() => setPendingDate(date)}
                    >
                      Recharger la date
                    </Button>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="registry" className="registry-view" forceMount>
            <div className="print-only print-title">
              <div>
                <h2>SANCTA MARIA 1187</h2>
                <div>
                  Relevé quotidien des températures · {monthName(month)}
                </div>
              </div>
              <div>1 mesure par jour · °C</div>
            </div>
            <div className="month-heading no-print">
              {monthControls("registry-month")}
              <div className="button-row">
                <Button
                  variant="outline"
                  className="button"
                  onClick={exportMonth}
                  disabled={loading || !!loadError || !records.length}
                >
                  <Download size={16} />
                  Exporter CSV
                </Button>
                <Button
                  variant="outline"
                  className="button"
                  onClick={() => window.print()}
                  disabled={loading || !!loadError}
                >
                  <Printer size={16} />
                  Imprimer A4
                </Button>
              </div>
            </div>
            <div className="month-heading no-print">
              <div className="month-summary">
                <strong>{records.length}</strong> jour
                {records.length > 1 ? "s" : ""} enregistré
                {records.length > 1 ? "s" : ""}
              </div>
              {missed > 0 && (
                <span className="status-pill warn">
                  {missed} jour{missed > 1 ? "s" : ""} manquant
                  {missed > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="panel">
              {loading ? (
                <div className="loading">
                  <LoaderCircle
                    className="spinner"
                    style={{ margin: "0 auto 12px" }}
                    size={23}
                  />
                  Chargement du registre…
                </div>
              ) : loadError ? (
                <div className="loading">
                  Le registre est indisponible. Utilisez « Réessayer ».
                </div>
              ) : (
                <Table className="registry-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Heure</TableHead>
                      {EQUIPMENT.map((e) => (
                        <TableHead key={e.id} title={e.name}>
                          {e.short}
                        </TableHead>
                      ))}
                      <TableHead>Init.</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {days.map((d) => {
                      const r = byDate.get(d);
                      const shut = isClosed(d) && !r;
                      const alert = r ? alarms(r).length : 0;
                      return (
                        <TableRow
                          key={d}
                          className={
                            (shut ? "closed " : "") +
                            (d === today ? "today-row" : "")
                          }
                        >
                          <TableCell>
                            {d <= today ? (
                              <button
                                className="day-button"
                                onClick={() => {
                                  changeDate(d);
                                  setTab("entry");
                                }}
                                aria-label={`Ouvrir le relevé du ${d}`}
                              >
                                {d.slice(8)}{" "}
                                {new Intl.DateTimeFormat("fr-FR", {
                                  weekday: "short",
                                  timeZone: "Europe/Paris",
                                })
                                  .format(new Date(d + "T12:00:00Z"))
                                  .replace(".", "")}
                              </button>
                            ) : (
                              <>
                                {d.slice(8)}{" "}
                                {new Intl.DateTimeFormat("fr-FR", {
                                  weekday: "short",
                                  timeZone: "Europe/Paris",
                                })
                                  .format(new Date(d + "T12:00:00Z"))
                                  .replace(".", "")}
                              </>
                            )}
                          </TableCell>
                          <TableCell>{r?.time ?? "—"}</TableCell>
                          {EQUIPMENT.map((e) => (
                            <TableCell
                              key={e.id}
                              className={
                                r && r.temperatures[e.id] > r.thresholds[e.id]
                                  ? "alert-cell"
                                  : ""
                              }
                            >
                              {r ? displayTemp(r.temperatures[e.id]) : "—"}
                            </TableCell>
                          ))}
                          <TableCell>{r?.initials ?? "—"}</TableCell>
                          <TableCell>
                            {r ? (
                              <span
                                className={
                                  "status-pill " + (alert ? "danger" : "ok")
                                }
                                title={r.note || "Aucun dépassement de seuil"}
                              >
                                {alert ? (
                                  <>
                                    <AlertTriangle size={12} />
                                    Écart
                                  </>
                                ) : (
                                  <>
                                    <Check size={12} />
                                    Relevé
                                  </>
                                )}
                              </span>
                            ) : (
                              <span style={{ fontSize: 12 }}>
                                {shut
                                  ? "Fermé"
                                  : d < today
                                    ? "Manquant"
                                    : d === today
                                      ? "À relever"
                                      : "—"}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
            <div className="legend no-print">
              <span>
                <i
                  style={{ background: "#f0eceb", border: "1px solid #d4c8ca" }}
                />
                Fermé : lundi et mardi
              </span>
              <span>
                <i style={{ background: "#ffdfd9" }} />
                Dépassement du seuil
              </span>
              <span>Cliquez sur une date pour consulter ou compléter.</span>
            </div>
            {records.some((r) => r.note) && (
              <div className="panel panel-pad" style={{ marginTop: 18 }}>
                <h2 className="aside-title">Écarts et actions</h2>
                {records
                  .filter((r) => r.note)
                  .map((r) => (
                    <p
                      key={r.id}
                      className="print-actions"
                      style={{
                        fontSize: 14,
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                      }}
                    >
                      <strong>
                        {r.date.split("-").reverse().join("/")} · {r.initials}
                      </strong>{" "}
                      — {r.note}
                    </p>
                  ))}
              </div>
            )}
            <div className="print-only print-signature">
              <span>Responsable de cuisine : ____________________________</span>
              <span>Date : ________________</span>
              <span>Signature : ____________________________</span>
            </div>
            <p className="muted-note no-print">
              Les couleurs se basent sur les seuils enregistrés le jour du
              relevé. La signature du responsable figure sur la version
              imprimée.
            </p>
          </TabsContent>

          <TabsContent value="charts" className="charts-view">
            <div className="month-heading">
              <h2 className="chart-section-title">
                Évolution des températures
              </h2>
              {monthControls("charts-month")}
            </div>
            {dirty && (
              <div className="notice warning">
                <Info size={18} />
                <span>
                  Les modifications non enregistrées n’apparaissent pas dans les
                  graphiques.
                </span>
              </div>
            )}
            <ChartLoadBoundary>
              <Suspense
                fallback={
                  <div className="panel loading" role="status">
                    Chargement des graphiques…
                  </div>
                }
              >
                <TemperatureCharts
                  records={records}
                  month={month}
                  today={today}
                  equipmentId={chartEquipment}
                  onEquipmentChange={setChartEquipment}
                  loading={loading}
                  loadError={loadError}
                />
              </Suspense>
            </ChartLoadBoundary>
          </TabsContent>

          <TabsContent value="labels">
            <LabelsPanel session={session} />
          </TabsContent>

          <TabsContent value="receptions" className="receptions-view">
            <Suspense
              fallback={
                <div className="panel loading">
                  <LoaderCircle className="spinner" size={23} /> Chargement des
                  réceptions…
                </div>
              }
            >
              <ReceptionPanel session={session} />
            </Suspense>
          </TabsContent>

          <TabsContent value="fryer" className="hygiene-view">
            <Suspense
              fallback={
                <div className="panel loading">
                  <LoaderCircle className="spinner" size={23} /> Chargement du
                  contrôle de la friteuse…
                </div>
              }
            >
              <HygienePanel type="fryer" session={session} />
            </Suspense>
          </TabsContent>

          <TabsContent value="cleaning" className="hygiene-view">
            <Suspense
              fallback={
                <div className="panel loading">
                  <LoaderCircle className="spinner" size={23} /> Chargement du
                  plan de nettoyage…
                </div>
              }
            >
              <HygienePanel type="cleaning" session={session} />
            </Suspense>
          </TabsContent>

          {canAdminister && (
            <TabsContent value="reports" className="reports-view">
              <WeeklyReportLauncher />
            </TabsContent>
          )}

          <TabsContent value="excel" className="excel-view">
            <div className="excel-layout panel panel-pad">
              <div className="excel-top">
                <div className="excel-symbol">
                  <FileSpreadsheet size={29} strokeWidth={1.6} />
                </div>
                <div>
                  <h2>Votre classeur OneDrive</h2>
                  <span
                    className={"status-pill " + (syncEnabled ? "ok" : "warn")}
                  >
                    {syncEnabled
                      ? "Copie vers Excel : chaque heure"
                      : "Synchronisation non activée"}
                  </span>
                </div>
              </div>
              <div className="notice">
                <Info size={18} />
                <span>
                  {syncEnabled
                    ? "Les nouveaux relevés de l’application sont vérifiés chaque heure puis recopiés vers ce classeur. Les saisies faites directement dans Excel ne sont pas importées automatiquement."
                    : "Vos relevés sont enregistrés dans l’application. La copie automatique vers votre Excel reste à configurer."}
                </span>
              </div>
              {!syncEnabled && (
                <form onSubmit={saveLink}>
                  <label className="field" htmlFor="workbook-link">
                    Lien du fichier Excel
                    <Input
                      id="workbook-link"
                      type="url"
                      className="input"
                      value={linkDraft}
                      placeholder="https://1drv.ms/…"
                      onChange={(e) => setLinkDraft(e.target.value)}
                      disabled={loading || !!loadError || linkSaving}
                    />
                  </label>
                  <p className="muted-note">
                    Dans OneDrive : ouvrez votre fichier de températures, puis «
                    Partager » → « Copier le lien ». Il n’est pas nécessaire de
                    le rendre public.
                  </p>
                  {linkError && (
                    <p role="alert" className="notice error">
                      {linkError}
                    </p>
                  )}
                  <div className="button-row">
                    <Button
                      type="submit"
                      className="button primary"
                      disabled={
                        loading ||
                        !!loadError ||
                        linkSaving ||
                        !linkDraft.trim()
                      }
                    >
                      {linkSaving ? (
                        <LoaderCircle size={16} className="spinner" />
                      ) : (
                        <Save size={16} />
                      )}
                      Enregistrer le lien
                    </Button>
                    {settings.workbookUrl && (
                      <a
                        className="button"
                        href={settings.workbookUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Ouvrir le classeur
                        <ExternalLink size={15} />
                      </a>
                    )}
                  </div>
                </form>
              )}
              {syncEnabled && settings.workbookUrl && (
                <div className="button-row" style={{ marginTop: 12 }}>
                  <a
                    className="button"
                    href={settings.workbookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ouvrir le classeur
                    <ExternalLink size={15} />
                  </a>
                </div>
              )}
              <hr className="divider" />
              <h2 className="aside-title">
                <Download size={17} />
                Exporter les relevés du mois
              </h2>
              <p className="aside-note" style={{ marginBottom: 18 }}>
                Téléchargez les valeurs enregistrées dans un CSV compatible avec
                Excel. Les 13 équipements sont dans le même ordre que votre
                feuille.
              </p>
              <div className="button-row">
                {monthControls("export-month")}
                <Button
                  variant="outline"
                  className="button"
                  onClick={exportMonth}
                  disabled={loading || !!loadError || !records.length}
                >
                  <Download size={16} />
                  Télécharger le CSV
                </Button>
              </div>
              <p className="muted-note">
                L’export contient uniquement les relevés enregistrés. Les
                cellules des jours sans mesure restent vides. Il ne modifie pas
                votre fichier OneDrive.
              </p>
              <hr className="divider" />
              <h2 className="aside-title">Structure de votre feuille</h2>
              <p className="workbook-name">
                Date · Heure · 4 congélateurs · 9 équipements réfrigérés ·
                Initiales · Écart / action · Statut
              </p>
              <p className="muted-note">
                Votre compte OneDrive personnel nécessite une méthode de liaison
                adaptée.{" "}
                <a
                  href="https://learn.microsoft.com/en-us/graph/api/resources/excel?view=graph-rest-1.0"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: "underline" }}
                >
                  Informations Microsoft
                </a>
                .
              </p>
            </div>
          </TabsContent>
          {isOwner && (
            <TabsContent value="team" className="team-view">
              <TeamPanel />
            </TabsContent>
          )}
        </Tabs>
      </main>
      {tab === "entry" && (
        <footer className="sticky-save">
          <div className="save-status" aria-live="polite">
            {loading ? (
              <>
                <LoaderCircle size={18} className="spinner" />
                Chargement…
              </>
            ) : dirty ? (
              <>
                <Cloud size={18} />
                <span>
                  Modifications
                  <br />
                  <strong>à enregistrer</strong>
                </span>
              </>
            ) : savedRecord ? (
              <>
                <CheckCheck size={19} />
                <span>
                  {contributorReadOnly
                    ? "Consultation uniquement"
                    : "Enregistré dans l’app"}
                  <br />
                  <strong>
                    {new Intl.DateTimeFormat("fr-FR", {
                      timeZone: "Europe/Paris",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(savedRecord.updatedAt))}
                  </strong>
                </span>
              </>
            ) : (
              <>
                <ClipboardList size={18} />
                <span>
                  <strong>{filled} / 13</strong> températures
                </span>
              </>
            )}
          </div>
          <Button
            form="reading-form"
            type="submit"
            className="button primary"
            disabled={locked || offline || (!dirty && revision > 0)}
          >
            {saving ? (
              <LoaderCircle className="spinner" size={18} />
            ) : (
              <Check size={18} />
            )}{" "}
            {saving
              ? "Enregistrement…"
              : revision > 0
                ? canAdminister
                  ? "Enregistrer les modifications"
                  : "Relevé déjà enregistré"
                : "Enregistrer le relevé"}
          </Button>
        </footer>
      )}

      {isOwner && (
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Seuils de température</DialogTitle>
              <DialogDescription>
                Température maximale par équipement, selon votre plan HACCP et
                les produits stockés. Les anciens relevés conservent leurs
                seuils.
              </DialogDescription>
            </DialogHeader>
            <div className="settings-scroll">
              {EQUIPMENT.map((e) => (
                <label
                  className="setting-row"
                  key={e.id}
                  htmlFor={e.id + "-threshold"}
                >
                  <span>{e.name}</span>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Input
                      type="text"
                      inputMode="text"
                      id={e.id + "-threshold"}
                      className="input"
                      value={thresholdDraft[e.id] ?? ""}
                      disabled={settingsSaving}
                      onChange={(event) =>
                        setThresholdDraft((prev) => ({
                          ...prev,
                          [e.id]: event.target.value,
                        }))
                      }
                    />
                    <span>°C</span>
                  </div>
                </label>
              ))}
            </div>
            {settingsError && (
              <p role="alert" className="notice error">
                {settingsError}
              </p>
            )}
            <Button
              className="button primary wide"
              onClick={saveSettings}
              disabled={settingsSaving}
            >
              {settingsSaving ? (
                <LoaderCircle className="spinner" size={16} />
              ) : (
                <Save size={16} />
              )}
              Enregistrer les seuils
            </Button>
          </DialogContent>
        </Dialog>
      )}
      <AlertDialog
        open={pendingDate !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Des valeurs ne sont pas enregistrées
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDate === date
                ? "Recharger remplacera les valeurs affichées par la dernière version enregistrée."
                : "Changer de date abandonnera les modifications affichées. Vous pouvez rester ici pour les enregistrer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Rester sur le relevé</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDate) {
                  setDirty(false);
                  if (pendingDate === date) setReload((n) => n + 1);
                  else setDate(pendingDate);
                  setPendingDate(null);
                }
              }}
            >
              {pendingDate === date ? "Recharger le relevé" : "Changer de date"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Toaster richColors position="top-center" />
    </div>
  );
}

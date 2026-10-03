"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  FileSignature,
  History,
  Info,
  LoaderCircle,
  Save,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { RegisterSession } from "@/lib/access-types";
import { timeParis, todayParis } from "@/lib/frigo";
import {
  blankHygieneChecks,
  HYGIENE_STATE_LABELS,
  HYGIENE_TYPE_LABELS,
  type HygieneCheck,
  type HygieneCheckState,
  type HygieneHistoryItem,
  type HygieneRecord,
  type HygieneRecordType,
} from "@/lib/hygiene";
import SignaturePad from "./signature-pad";

type HygieneResponse = {
  record: HygieneRecord | null;
  checks: HygieneCheck[];
  history: HygieneHistoryItem[];
};

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: "no-store" });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json"))
    throw new Error(
      "Votre session a expiré. Rouvrez l’application pour vous reconnecter.",
    );
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "La demande a échoué. Réessayez.");
  return result;
}

function suggestedInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0] ?? "")
      .join("")
      .slice(0, 4)
      .toUpperCase() || "AG"
  );
}

function frenchDate(date: string) {
  return date.split("-").reverse().join("/");
}

const stateIcons: Record<HygieneCheckState, typeof Check> = {
  pending: Circle,
  done: Check,
  not_applicable: Info,
  issue: AlertTriangle,
};

export default function HygienePanel({
  type,
  session,
}: {
  type: HygieneRecordType;
  session: RegisterSession;
}) {
  const today = todayParis();
  const [date, setDate] = useState(today);
  const [time, setTime] = useState(timeParis());
  const [initials, setInitials] = useState(
    suggestedInitials(session.displayName),
  );
  const [notes, setNotes] = useState("");
  const [checks, setChecks] = useState(() => blankHygieneChecks(type));
  const [signature, setSignature] = useState<string | null>(null);
  const [record, setRecord] = useState<HygieneRecord | null>(null);
  const [history, setHistory] = useState<HygieneHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const month = date.slice(0, 7);
  const locked = record?.status === "validated";
  const completed = checks.filter((check) => check.state !== "pending").length;
  const issues = checks.filter((check) => check.state === "issue").length;
  const completion = checks.length
    ? Math.round((completed / checks.length) * 100)
    : 0;

  useEffect(() => {
    const controller = new AbortController();
    request<HygieneResponse>(
      `/api/hygiene-records?type=${type}&date=${date}&month=${month}`,
      { signal: controller.signal },
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        setRecord(result.record);
        setHistory(result.history);
        if (result.record) {
          setTime(result.record.time);
          setInitials(result.record.operatorInitials);
          setNotes(result.record.generalNotes);
          setSignature(result.record.signature);
          setChecks(
            result.checks.length ? result.checks : blankHygieneChecks(type),
          );
        } else {
          setTime(date === todayParis() ? timeParis() : "12:00");
          setInitials(suggestedInitials(session.displayName));
          setNotes("");
          setSignature(null);
          setChecks(blankHygieneChecks(type));
        }
      })
      .catch((loadError) => {
        if (!controller.signal.aborted)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Chargement impossible.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [date, month, session.displayName, type]);

  const intro = useMemo(
    () =>
      type === "cleaning"
        ? "Contrôlez les zones prévues, signalez les anomalies et signez la validation de fin de journée."
        : "Enregistrez le filtrage quotidien sans le confondre avec le changement complet de l’huile.",
    [type],
  );

  const changeState = (code: string, state: HygieneCheckState) => {
    setChecks((current) =>
      current.map((check) =>
        check.code === code ? { ...check, state } : check,
      ),
    );
    setError("");
  };

  const selectDate = (nextDate: string) => {
    if (!nextDate) return;
    setLoading(true);
    setError("");
    setDate(nextDate);
  };

  const changeObservation = (code: string, observation: string) => {
    setChecks((current) =>
      current.map((check) =>
        check.code === code ? { ...check, observation } : check,
      ),
    );
  };

  const save = async (validate: boolean) => {
    if (validate && checks.some((check) => check.state === "pending")) {
      setError("Traitez toutes les lignes avant de signer la validation.");
      return;
    }
    if (
      checks.some(
        (check) => check.state === "issue" && !check.observation.trim(),
      )
    ) {
      setError("Décrivez chaque anomalie et l’action menée.");
      return;
    }
    if (validate && !signature) {
      setError("Signez le contrôle avant de le valider.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await request<{
        record: HygieneRecord;
        checks: HygieneCheck[];
      }>("/api/hygiene-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordType: type,
          date,
          time,
          operatorInitials: initials,
          generalNotes: notes,
          signature,
          validate,
          revision: record?.revision ?? 0,
          checks: checks.map(({ code, state, observation }) => ({
            code,
            state,
            observation,
          })),
        }),
      });
      setRecord(result.record);
      setChecks(result.checks);
      toast.success(
        validate
          ? "Contrôle signé et validé."
          : "Brouillon enregistré.",
      );
      const refreshed = await request<HygieneResponse>(
        `/api/hygiene-records?type=${type}&date=${date}&month=${month}`,
      );
      setHistory(refreshed.history);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "L’enregistrement a échoué.",
      );
    } finally {
      setSaving(false);
    }
  };

  const submitDraft = (event: FormEvent) => {
    event.preventDefault();
    void save(false);
  };

  return (
    <div className="hygiene-layout">
      <form className="panel hygiene-form" onSubmit={submitDraft}>
        <div className="hygiene-hero">
          <div>
            <span className="eyebrow">AUTOCONTRÔLE HACCP</span>
            <h2>{HYGIENE_TYPE_LABELS[type]}</h2>
            <p>{intro}</p>
          </div>
          <div
            className={`hygiene-status ${locked ? "validated" : "draft"}`}
          >
            {locked ? <ShieldCheck size={20} /> : <Clock3 size={20} />}
            {locked ? "Validé" : record ? "Brouillon" : "À renseigner"}
          </div>
        </div>

        {error && (
          <div className="notice error hygiene-error" role="alert">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}
        {loading ? (
          <div className="hygiene-loading" role="status">
            <LoaderCircle className="spinner" size={24} /> Chargement du
            contrôle…
          </div>
        ) : (
          <>
            <div className="hygiene-metadata">
              <label className="field">
                Date
                <Input
                  className="input"
                  type="date"
                  value={date}
                  max={today}
                  disabled={saving}
                  onChange={(event) => selectDate(event.target.value)}
                />
              </label>
              <label className="field">
                Heure
                <Input
                  className="input"
                  type="time"
                  value={time}
                  required
                  disabled={saving || locked}
                  onChange={(event) => setTime(event.target.value)}
                />
              </label>
              <label className="field">
                Initiales
                <Input
                  className="input"
                  value={initials}
                  required
                  maxLength={12}
                  disabled={saving || locked}
                  onChange={(event) =>
                    setInitials(event.target.value.toUpperCase())
                  }
                />
              </label>
            </div>

            <div className="hygiene-progress" aria-live="polite">
              <div>
                <strong>
                  {completed}/{checks.length} contrôles traités
                </strong>
                <span>
                  {issues
                    ? `${issues} anomalie${issues > 1 ? "s" : ""}`
                    : "Aucune anomalie signalée"}
                </span>
              </div>
              <div
                className="hygiene-progress-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={completion}
              >
                <span style={{ width: `${completion}%` }} />
              </div>
            </div>

            <div className="hygiene-checks">
              {checks.map((check, index) => (
                <article
                  className={`hygiene-check state-${check.state}`}
                  key={check.code}
                >
                  <div className="hygiene-check-head">
                    <span className="hygiene-check-number">{index + 1}</span>
                    <div>
                      <h3>{check.label}</h3>
                      <p>{check.frequency}</p>
                    </div>
                  </div>
                  <div
                    className="hygiene-state-buttons"
                    role="group"
                    aria-label={`État : ${check.label}`}
                  >
                    {checkStatesForUi.map((state) => {
                      const Icon = stateIcons[state];
                      return (
                        <button
                          key={state}
                          type="button"
                          className={check.state === state ? "active" : ""}
                          data-state-name={state}
                          aria-pressed={check.state === state}
                          disabled={saving || locked}
                          onClick={() => changeState(check.code, state)}
                        >
                          <Icon size={16} />
                          {HYGIENE_STATE_LABELS[state]}
                        </button>
                      );
                    })}
                  </div>
                  <details className="hygiene-protocol">
                    <summary>Voir le protocole</summary>
                    <p>{check.protocol}</p>
                  </details>
                  {(check.state === "issue" || check.observation) && (
                    <label className="field hygiene-observation">
                      Observation / action menée
                      <Textarea
                        value={check.observation}
                        maxLength={600}
                        required={check.state === "issue"}
                        disabled={saving || locked}
                        placeholder="Décrivez l’écart et ce qui a été fait…"
                        onChange={(event) =>
                          changeObservation(check.code, event.target.value)
                        }
                      />
                    </label>
                  )}
                </article>
              ))}
            </div>

            <div className="hygiene-final">
              <label className="field">
                Observations générales
                <Textarea
                  value={notes}
                  maxLength={2000}
                  disabled={saving || locked}
                  placeholder="Facultatif"
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>
              <div className="hygiene-signature-head">
                <FileSignature size={21} />
                <div>
                  <h3>Validation quotidienne</h3>
                  <p>
                    La signature confirme le contrôle réalisé par l’utilisateur
                    connecté.
                  </p>
                </div>
              </div>
              <SignaturePad
                value={signature}
                onChange={setSignature}
                disabled={saving || locked}
                ariaLabel={`Signature tactile du contrôle ${HYGIENE_TYPE_LABELS[type]}`}
                clearLabel="Effacer ma signature"
              />
              {locked && (
                <div className="notice success hygiene-validation-proof">
                  <CheckCircle2 size={18} />
                  <span>
                    Validé par <strong>{record.validatedByName}</strong> le{" "}
                    {record.validatedAt
                      ? new Intl.DateTimeFormat("fr-FR", {
                          dateStyle: "short",
                          timeStyle: "short",
                          timeZone: "Europe/Paris",
                        }).format(new Date(record.validatedAt))
                      : frenchDate(record.date)}
                    .
                  </span>
                </div>
              )}
              {!locked && (
                <div className="hygiene-actions">
                  <Button
                    type="submit"
                    variant="outline"
                    className="button"
                    disabled={saving}
                  >
                    {saving ? (
                      <LoaderCircle className="spinner" size={18} />
                    ) : (
                      <Save size={18} />
                    )}
                    Enregistrer le brouillon
                  </Button>
                  <Button
                    type="button"
                    className="button hygiene-validate"
                    disabled={saving}
                    onClick={() => void save(true)}
                  >
                    {saving ? (
                      <LoaderCircle className="spinner" size={18} />
                    ) : (
                      <ShieldCheck size={18} />
                    )}
                    Signer et valider la journée
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </form>

      <aside className="panel hygiene-history">
        <div className="hygiene-history-title">
          <History size={20} />
          <div>
            <h2>Historique du mois</h2>
            <p>
              {new Intl.DateTimeFormat("fr-FR", {
                month: "long",
                year: "numeric",
                timeZone: "Europe/Paris",
              }).format(new Date(`${month}-01T12:00:00Z`))}
            </p>
          </div>
        </div>
        {history.length ? (
          <div className="hygiene-history-list">
            {history.map((item) => (
              <button
                type="button"
                key={item.id}
                className={item.date === date ? "active" : ""}
                onClick={() => selectDate(item.date)}
              >
                <span>
                  <strong>{frenchDate(item.date)}</strong>
                  <small>
                    {item.time} · {item.operatorInitials}
                  </small>
                </span>
                <span
                  className={`history-state ${item.status} ${item.issueCount ? "issues" : ""}`}
                >
                  {item.status === "validated"
                    ? item.issueCount
                      ? `${item.issueCount} anomalie${item.issueCount > 1 ? "s" : ""}`
                      : "Validé"
                    : "Brouillon"}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="hygiene-empty">
            Aucun contrôle enregistré pour ce mois.
          </p>
        )}
        <div className="hygiene-history-note">
          <ShieldCheck size={18} />
          <p>
            Un contrôle signé est conservé avec sa date, son heure, son
            utilisateur et le détail de chaque ligne.
          </p>
        </div>
      </aside>
    </div>
  );
}

const checkStatesForUi: HygieneCheckState[] = [
  "pending",
  "done",
  "not_applicable",
  "issue",
];

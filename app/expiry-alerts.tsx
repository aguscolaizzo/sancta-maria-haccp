"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, BellRing, CalendarClock, Check, CheckCircle2, ChevronDown, LoaderCircle, Snowflake, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ExpiryBucket } from "@/lib/weekly-report";
import DiscardDialog, { type DiscardDetails } from "./discard-dialog";

type Alert = {
  id: string;
  name: string;
  reference: string;
  expires_at: string;
  href: string;
  kind: "quick" | "classic";
  bucket: ExpiryBucket;
};

function localNow() {
  const parts = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}`;
}

const label = (bucket: ExpiryBucket) =>
  bucket === "expired" ? "Déjà expirée" : bucket === "today" ? "Expire aujourd’hui" : "Expire demain";

async function showAndroidNotification(alerts: Alert[], day: string) {
  if (!("Notification" in window) || Notification.permission !== "granted" || !alerts.length) return;
  const storageKey = `sancta-expiry-notification-${day}`;
  try {
    if (localStorage.getItem(storageKey)) return;
    const registration = await navigator.serviceWorker.register("/sw.js");
    const expired = alerts.filter((item) => item.bucket === "expired").length;
    const today = alerts.filter((item) => item.bucket === "today").length;
    const tomorrow = alerts.filter((item) => item.bucket === "tomorrow").length;
    const parts = [
      expired ? `${expired} expirée${expired > 1 ? "s" : ""}` : "",
      today ? `${today} aujourd’hui` : "",
      tomorrow ? `${tomorrow} demain` : "",
    ].filter(Boolean);
    await registration.showNotification("Sancta Maria · Échéances HACCP", {
      body: parts.join(" · "),
      icon: "/favicon.svg",
      tag: `sancta-expiry-${day}`,
      data: { url: "/?tab=labels" },
    });
    localStorage.setItem(storageKey, new Date().toISOString());
  } catch {
    // The in-app alert remains the reliable fallback when Android blocks a system notification.
  }
}

export default function ExpiryAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acting, setActing] = useState("");
  const [discarding, setDiscarding] = useState<Alert | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported",
  );

  const load = useCallback(async () => {
    const at = localNow();
    try {
      const response = await fetch(`/api/expiry-alerts?at=${encodeURIComponent(at)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Échéances indisponibles.");
      setAlerts(data.alerts);
      setError("");
      await showAndroidNotification(data.alerts, at.slice(0, 10));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Échéances indisponibles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
    const timer = window.setInterval(load, 15 * 60 * 1000);
    const visible = () => document.visibilityState === "visible" && void load();
    window.addEventListener("focus", load);
    window.addEventListener("haccp-labels-changed", load);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
      window.removeEventListener("haccp-labels-changed", load);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load]);

  const counts = useMemo(
    () => ({
      expired: alerts.filter((item) => item.bucket === "expired").length,
      today: alerts.filter((item) => item.bucket === "today").length,
      tomorrow: alerts.filter((item) => item.bucket === "tomorrow").length,
    }),
    [alerts],
  );

  async function enableNotifications() {
    if (!("Notification" in window)) return;
    const next = await Notification.requestPermission();
    setPermission(next);
    if (next === "granted") {
      try {
        localStorage.removeItem(`sancta-expiry-notification-${localNow().slice(0, 10)}`);
      } catch {}
      await showAndroidNotification(alerts, localNow().slice(0, 10));
    }
  }

  async function closeAlert(
    item: Alert,
    action: "consumed" | "discarded" | "transformed_frozen",
    discard?: DiscardDetails,
  ) {
    if (action === "transformed_frozen") {
      window.location.href = `/?tab=labels&freezeKind=${item.kind}&freezeId=${item.id}`;
      return;
    }
    if (action === "discarded" && !discard) {
      setDiscarding(item);
      return;
    }
    const key = `${item.kind}-${item.id}`;
    setActing(`${key}:${action}`);
    setError("");
    try {
      const response = await fetch("/api/expiry-alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, kind: item.kind, action, discard }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Action impossible.");
      setAlerts((current) => current.filter((candidate) => candidate.id !== item.id || candidate.kind !== item.kind));
      toast.success(
        action === "discarded"
            ? "Produit déclaré jeté et fiche conservée."
            : "Étiquette déclarée utilisée et fiche conservée.",
      );
    } catch (caught) {
      const failure =
        caught instanceof Error ? caught : new Error("Action impossible.");
      setError(failure.message);
      if (discard) throw failure;
    } finally {
      setActing("");
    }
  }

  if (loading) return <div className="expiry-alert-bar muted"><LoaderCircle className="spinner" size={17} /> Vérification des échéances…</div>;
  if (!alerts.length && !error) {
    if (permission === "granted") return null;
    return (
      <div className="expiry-alert-bar no-alerts">
        <div><Check size={18} /><span><strong>Aucune échéance aujourd’hui ou demain</strong><small>Vous pouvez activer l’avis Android pour les prochains jours.</small></span></div>
        {permission === "default" && <Button type="button" variant="outline" className="button" onClick={enableNotifications}><Bell size={16} /> Activer les notifications</Button>}
      </div>
    );
  }
  return (
    <details className={`expiry-alert-bar ${counts.expired ? "danger" : ""}`} open={counts.expired > 0}>
      {discarding && (
        <DiscardDialog
          name={discarding.name}
          expired={discarding.bucket === "expired"}
          onClose={() => setDiscarding(null)}
          onConfirm={(details) => closeAlert(discarding, "discarded", details)}
        />
      )}
      <summary>
        {counts.expired ? <BellRing size={19} /> : <CalendarClock size={19} />}
        <span>
          <strong>Échéances HACCP</strong>
          <small>{counts.expired} expirée{counts.expired !== 1 ? "s" : ""} · {counts.today} aujourd’hui · {counts.tomorrow} demain</small>
        </span>
        <ChevronDown size={17} />
      </summary>
      <div className="expiry-alert-content">
        {error && <p className="notice error">{error}</p>}
        <div className="expiry-alert-list">
          {alerts.map((item) => (
            <div className="expiry-alert-item" key={`${item.kind}-${item.id}`}>
              <Link className="expiry-alert-main" href={item.href}>
                <span><strong>{item.name}</strong><small>{item.reference} · {item.expires_at.replace("T", " à ")}</small></span>
                <em className={item.bucket}>{label(item.bucket)}</em>
              </Link>
              <div className="expiry-alert-actions">
                <Button type="button" variant="outline" className="button" disabled={Boolean(acting)} onClick={() => closeAlert(item, "consumed")}>
                  {acting === `${item.kind}-${item.id}:consumed` ? <LoaderCircle className="spinner" size={15} /> : <CheckCircle2 size={15} />} Utilisée
                </Button>
                {item.bucket !== "expired" && (
                  <Button type="button" variant="outline" className="button transform" disabled={Boolean(acting)} onClick={() => closeAlert(item, "transformed_frozen")}>
                    {acting === `${item.kind}-${item.id}:transformed_frozen` ? <LoaderCircle className="spinner" size={15} /> : <Snowflake size={15} />} Transformée / congelée
                  </Button>
                )}
                <Button type="button" variant="outline" className="button danger" disabled={Boolean(acting)} onClick={() => closeAlert(item, "discarded")}>
                  {acting === `${item.kind}-${item.id}:discarded` ? <LoaderCircle className="spinner" size={15} /> : <Trash2 size={15} />} Jetée
                </Button>
              </div>
            </div>
          ))}
        </div>
        <p className="expiry-action-note">Chaque action marque la fiche avec sa date, son heure et son auteur. « Transformée / congelée » ouvre une nouvelle fiche liée et ne clôture la source qu’après validation de la nouvelle congélation.</p>
        {permission === "default" && (
          <Button type="button" variant="outline" className="button" onClick={enableNotifications}>
            <Bell size={16} /> Activer les notifications Android
          </Button>
        )}
        {permission === "granted" && <p className="notification-enabled"><Check size={15} /> Notification quotidienne activée sur ce téléphone lorsque le site est ouvert.</p>}
        {permission === "denied" && <p className="muted-note">Les notifications Android sont bloquées dans Chrome. L’alerte reste visible dans le site.</p>}
      </div>
    </details>
  );
}

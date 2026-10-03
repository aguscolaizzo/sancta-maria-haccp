"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bluetooth,
  CheckCircle2,
  CircleAlert,
  Clipboard,
  LoaderCircle,
  Printer,
  RefreshCcw,
  Send,
  Trash2,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { renderDiagnosticPattern, renderLabel } from "@/lib/label-renderer";
import {
  DEFAULT_PRINTER_SETTINGS,
  PRINTER_SETTINGS_STORAGE_KEY,
  type PrinterSettings,
} from "@/lib/print-jobs";
import { supportsWebSerialPrinter } from "@/lib/printer-transport";
import { SupvanT50MProAdapter } from "@/lib/supvan-t50m-pro-adapter";
import {
  clearPrinterEvents,
  printerEventsAsText,
  readPrinterEvents,
  recordPrinterEvent,
  sendPrinterDiagnosticReport,
  type PrinterEvent,
} from "@/lib/printer-event-log";
import { PRINTER_CLIENT_VERSION } from "@/lib/printer-version";

export default function PrinterDiagnosticClient() {
  const [settings, setSettings] = useState<PrinterSettings>(DEFAULT_PRINTER_SETTINGS);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [rawStatus, setRawStatus] = useState<number[]>([]);
  const [pattern, setPattern] = useState<"orientation" | "label">("orientation");
  const [testProgress, setTestProgress] = useState(0);
  const [testCopies, setTestCopies] = useState(5);
  const [sendingLog, setSendingLog] = useState(false);
  const [events, setEvents] = useState<PrinterEvent[]>([]);
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const printer = useRef(new SupvanT50MProAdapter());
  const canvas = useRef<HTMLCanvasElement>(null);
  const [info] = useState(() => new SupvanT50MProAdapter().info());

  useEffect(() => {
    const adapter = printer.current;
    queueMicrotask(() => {
      try {
        const saved = localStorage.getItem(PRINTER_SETTINGS_STORAGE_KEY);
        if (saved)
          setSettings({ ...DEFAULT_PRINTER_SETTINGS, ...JSON.parse(saved) });
      } catch {}
      setEvents(readPrinterEvents());
    });
    return () => void adapter.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    async function verifyVersion() {
      try {
        const response = await fetch(`/api/printer-version?t=${Date.now()}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as { version?: string };
        if (active && response.ok) setServerVersion(data.version ?? "inconnue");
      } catch {
        if (active) setServerVersion("indisponible");
      }
    }
    void verifyVersion();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void verifyVersion();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const staleClient =
    serverVersion !== null &&
    serverVersion !== "indisponible" &&
    serverVersion !== PRINTER_CLIENT_VERSION;

  useEffect(() => {
    try {
      localStorage.setItem(PRINTER_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {}
    if (!canvas.current) return;
    if (pattern === "orientation") renderDiagnosticPattern(canvas.current, settings);
    else
      void renderLabel(
        canvas.current,
        {
          labelCode: "ETQ-TEST-ORIENTATION-01",
          shortToken: "test",
          shortName: "TEST TOMATES",
          preparationCode: "PREP-TEST-001",
          preparedAt: "2026-09-10T08:30",
          expiresAt: "2026-09-12T08:30",
          storageMode: "refrigerated",
          storageTemperature: 4,
          operatorInitials: "AG",
          bacIndex: 1,
        },
        `${location.origin}/printer-diagnostic`,
        settings,
      );
  }, [settings, pattern]);

  async function connect() {
    setBusy(true);
    setMessage("Recherche du canal série Bluetooth…");
    try {
      await printer.current.connect();
      setConnected(true);
      const status = await printer.current.status();
      setRawStatus(status.raw);
      setMessage(status.error ?? "T50M Pro connectée et disponible.");
      toast.success("Connexion confirmée par l’imprimante.");
    } catch (error) {
      setConnected(false);
      setMessage(error instanceof Error ? error.message : "Connexion impossible.");
    } finally {
      setEvents(readPrinterEvents());
      setBusy(false);
    }
  }

  async function readStatus() {
    setBusy(true);
    try {
      const status = await printer.current.status();
      setRawStatus(status.raw);
      setMessage(
        status.error ??
          `État reçu · occupée ${status.busy ? "oui" : "non"} · impression ${status.printing ? "oui" : "non"}`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Lecture impossible.");
    } finally {
      setEvents(readPrinterEvents());
      setBusy(false);
    }
  }

  async function printTest(copies = 1) {
    if (!canvas.current) return;
    if (staleClient) {
      setMessage("Une nouvelle version est disponible. Rechargez avant le test.");
      return;
    }
    clearPrinterEvents();
    recordPrinterEvent(
      "Version diagnostic active",
      "info",
      PRINTER_CLIENT_VERSION,
    );
    setEvents(readPrinterEvents());
    setBusy(true);
    setTestProgress(0);
    setMessage(`Test d’impression 0/${copies}…`);
    try {
      await printer.current.print(
        canvas.current,
        copies,
        settings.density,
        (completed, total) => {
          setTestProgress(completed);
          setMessage(`Test d’impression ${completed}/${total}…`);
        },
      );
      setMessage(`${copies}/${copies} exemplaires confirmés sans nouvelle sélection Bluetooth.`);
      toast.success(copies === 1 ? "Étiquette de diagnostic imprimée." : `${copies} étiquettes de diagnostic imprimées.`);
    } catch (error) {
      const cause =
        error instanceof Error ? error.message : "Impression impossible.";
      let recovered = false;
      try {
        await printer.current.recoverConnection("après le test d’impression");
        recovered = true;
      } catch {}
      setConnected(recovered);
      setMessage(
        `${cause}${
          recovered
            ? " Connexion rétablie automatiquement; vérifiez la sortie avant de relancer."
            : " Reconnexion manuelle nécessaire."
        }`,
      );
    } finally {
      setEvents(readPrinterEvents());
      setBusy(false);
    }
  }

  return (
    <>
      <p className="eyebrow">Diagnostic administrateur</p>
      <h1>SUPVAN T50M Pro</h1>
      <p className="subline">Validez le transport, le protocole et l’orientation avec une étiquette sans valeur HACCP.</p>
      <section className="diagnostic-facts">
        <div><span>Version active</span><strong>{PRINTER_CLIENT_VERSION}</strong></div>
        <div><span>Transport</span><strong>Web Serial · Bluetooth série</strong></div>
        <div><span>GATT BLE</span><strong>Non utilisé · aucun UUID requis</strong></div>
        <div><span>Protocole</span><strong>Propriétaire · trames 0x7E 0x5A</strong></div>
        <div><span>Bitmap</span><strong>{info.raster} · monochrome · miroir matériel compensé</strong></div>
        <div><span>Compression</span><strong>LZMA · paquets 512 octets</strong></div>
        <div><span>Navigateur</span><strong>{supportsWebSerialPrinter() ? "API série détectée" : "API série absente"}</strong></div>
      </section>
      {staleClient && (
        <div className="notice warning">
          <CircleAlert size={18} />
          <span>Cette page est ancienne ({PRINTER_CLIENT_VERSION}). La version serveur est {serverVersion}.</span>
          <Button
            className="button"
            variant="outline"
            onClick={() => location.replace(`/printer-diagnostic?v=${encodeURIComponent(serverVersion ?? "latest")}&t=${Date.now()}`)}
          >
            <RefreshCcw size={16} /> Recharger maintenant
          </Button>
        </div>
      )}
      <div className="diagnostic-actions">
        <Button className="button primary" onClick={connect} disabled={busy || connected}>
          {busy ? <LoaderCircle className="spin" size={17} /> : <Bluetooth size={17} />} Chercher et connecter
        </Button>
        <Button className="button" variant="outline" onClick={readStatus} disabled={busy || !connected}><RefreshCcw size={16} /> Lire l’état</Button>
        <Button className="button" variant="outline" onClick={async () => { await printer.current.disconnect(); setConnected(false); setMessage("Imprimante déconnectée."); setEvents(readPrinterEvents()); }} disabled={!connected}><Unplug size={16} /> Déconnecter</Button>
      </div>
      {message && <div className={`notice ${connected ? "success" : "warning"}`}>{connected ? <CheckCircle2 size={18} /> : <CircleAlert size={18} />}{message}</div>}
      <section className="diagnostic-settings">
        <h2>Orientation et rendu</h2>
        <div className="quick-grid">
          <label className="field">Motif<select className="input" value={pattern} onChange={(event) => setPattern(event.target.value as "orientation" | "label")}><option value="orientation">Cadre, lignes et repères</option><option value="label">Texte et QR de test</option></select></label>
          <label className="field">Rotation<select className="input" value={settings.rotation} onChange={(event) => setSettings({ ...settings, rotation: Number(event.target.value) as PrinterSettings["rotation"] })}>{[0,90,180,270].map((value) => <option key={value} value={value}>{value}°</option>)}</select></label>
          <label className="field">Densité<Input className="input" type="number" min="1" max="15" value={settings.density} onChange={(event) => setSettings({ ...settings, density: Number(event.target.value) })} /></label>
          <label className="field">Marge X<Input className="input" type="number" min="-80" max="80" value={settings.marginX} onChange={(event) => setSettings({ ...settings, marginX: Number(event.target.value) })} /></label>
          <label className="field">Marge Y<Input className="input" type="number" min="-80" max="80" value={settings.marginY} onChange={(event) => setSettings({ ...settings, marginY: Number(event.target.value) })} /></label>
          <label className="source-lot-option compact"><input type="checkbox" checked={settings.mirrorHorizontal} onChange={(event) => setSettings({ ...settings, mirrorHorizontal: event.target.checked })} /> Miroir horizontal</label>
          <label className="source-lot-option compact"><input type="checkbox" checked={settings.mirrorVertical} onChange={(event) => setSettings({ ...settings, mirrorVertical: event.target.checked })} /> Miroir vertical</label>
        </div>
        <canvas ref={canvas} className="diagnostic-canvas" />
        <Button className="button primary" onClick={() => void printTest(1)} disabled={busy || !connected || staleClient}><Printer size={17} /> Imprimer 1 motif</Button>
        <label className="field diagnostic-series-count">Nombre pour le test en série<Input className="input" type="number" inputMode="numeric" min="2" max="20" value={testCopies} onChange={(event) => setTestCopies(Math.max(2, Math.min(20, Number(event.target.value) || 2)))} /></label>
        <Button className="button" variant="outline" onClick={() => void printTest(testCopies)} disabled={busy || !connected || staleClient}><Printer size={17} /> Tester une série de {testCopies} {busy && testProgress > 0 ? `(${testProgress}/${testCopies})` : ""}</Button>
      </section>
      <details className="diagnostic-raw"><summary>Informations techniques</summary><p>{info.protocol}</p><p>{info.transport.note}</p><code>{rawStatus.length ? rawStatus.map((value) => value.toString(16).padStart(2, "0")).join(" ") : "Aucune réponse brute reçue."}</code></details>
      <section className="diagnostic-log">
        <div className="diagnostic-log-heading">
          <div><h2>Journal Bluetooth de ce téléphone</h2><p>Les 600 derniers événements sont conservés sur cet appareil. En cas d’échec, ils sont envoyés automatiquement au diagnostic technique.</p></div>
          <div className="diagnostic-log-actions">
            <Button className="button" variant="outline" onClick={() => { setEvents(readPrinterEvents()); }}><RefreshCcw size={16} /> Actualiser</Button>
            <Button className="button" variant="outline" disabled={!events.length} onClick={async () => {
              try {
                await navigator.clipboard.writeText(printerEventsAsText(events));
                toast.success("Journal copié.");
              } catch {
                toast.error("Le journal n’a pas pu être copié.");
              }
            }}><Clipboard size={16} /> Copier</Button>
            <Button className="button" variant="outline" disabled={!events.length || sendingLog} onClick={async () => {
              setSendingLog(true);
              try {
                await sendPrinterDiagnosticReport("envoi manuel depuis le diagnostic", message, {
                  ...printer.current.info().transport,
                  clientVersion: PRINTER_CLIENT_VERSION,
                  connected: printer.current.connected,
                  phase: "diagnostic manuel",
                  copies: testCopies,
                });
                toast.success("Journal envoyé au diagnostic technique.");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Envoi impossible.");
              } finally {
                setSendingLog(false);
              }
            }}>{sendingLog ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />} Envoyer</Button>
            <Button className="button danger" variant="outline" disabled={!events.length} onClick={() => { clearPrinterEvents(); setEvents([]); }}><Trash2 size={16} /> Effacer</Button>
          </div>
        </div>
        {events.length ? (
          <ol className="diagnostic-log-list">
            {[...events].reverse().map((entry, index) => (
              <li key={`${entry.at}-${index}`} data-level={entry.level}>
                <time>{new Date(entry.at).toLocaleString("fr-FR")}</time>
                <strong>{entry.event}</strong>
                {entry.detail && <span>{entry.detail}</span>}
              </li>
            ))}
          </ol>
        ) : <p className="diagnostic-log-empty">Aucun événement enregistré sur ce téléphone.</p>}
      </section>
    </>
  );
}

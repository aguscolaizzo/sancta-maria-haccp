export type PrinterEventLevel = "info" | "success" | "warning" | "error";

export type PrinterEvent = {
  at: string;
  level: PrinterEventLevel;
  event: string;
  detail: string | null;
};

const STORAGE_KEY = "sancta-maria-printer-events-v1";
const MAX_EVENTS = 600;

function storageAvailable() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function printerErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function readPrinterEvents(): PrinterEvent[] {
  if (!storageAvailable()) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is PrinterEvent =>
        Boolean(
          entry &&
            typeof entry.at === "string" &&
            typeof entry.event === "string" &&
            ["info", "success", "warning", "error"].includes(entry.level),
        ),
    );
  } catch {
    return [];
  }
}

export function recordPrinterEvent(
  event: string,
  level: PrinterEventLevel = "info",
  detail?: string | null,
) {
  if (!storageAvailable()) return;
  try {
    const events = readPrinterEvents();
    events.push({
      at: new Date().toISOString(),
      level,
      event,
      detail: detail?.trim() || null,
    });
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(events.slice(-MAX_EVENTS)),
    );
  } catch {}
}

export function clearPrinterEvents() {
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function printerEventsAsText(events = readPrinterEvents()) {
  return events
    .map(
      (entry) =>
        `${entry.at} · ${entry.level.toUpperCase()} · ${entry.event}${
          entry.detail ? ` · ${entry.detail}` : ""
        }`,
    )
    .join("\n");
}

export async function sendPrinterDiagnosticReport(
  context: string,
  error?: unknown,
  transportInfo?: unknown,
) {
  if (typeof window === "undefined") return null;
  const response = await fetch("/api/printer-diagnostics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      context: context.trim().slice(0, 120),
      message: error === undefined ? "" : printerErrorMessage(error).slice(0, 500),
      connected:
        transportInfo &&
        typeof transportInfo === "object" &&
        "connected" in transportInfo
          ? Boolean((transportInfo as { connected?: unknown }).connected)
          : null,
      transportInfo,
      userAgent: navigator.userAgent.slice(0, 500),
      events: readPrinterEvents().slice(-MAX_EVENTS),
    }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    id?: string;
    error?: string;
  };
  if (!response.ok)
    throw new Error(data.error ?? "Le diagnostic n’a pas pu être envoyé.");
  return data.id ?? null;
}

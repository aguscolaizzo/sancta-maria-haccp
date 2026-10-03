import { renderLabel } from "./label-renderer";
import type { PrintQueue, PrintQueueItem, PrinterSettings } from "./print-jobs";
import { SupvanT50MProAdapter } from "./supvan-t50m-pro-adapter";

type QueueCallbacks = {
  onProgress?: (completed: number, total: number, item: PrintQueueItem) => void;
  onQueue?: (queue: PrintQueue) => void;
};

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "La demande a échoué.");
  return data;
}

export class PrintQueueRunner {
  readonly printer: SupvanT50MProAdapter;

  constructor(printer = new SupvanT50MProAdapter()) {
    this.printer = printer;
  }

  async load(jobId: string) {
    return (await api<{ queue: PrintQueue }>(`/api/print-jobs/${jobId}`)).queue;
  }

  async run(
    jobId: string,
    canvas: HTMLCanvasElement,
    settings: PrinterSettings,
    callbacks: QueueCallbacks = {},
    failedOnly = false,
  ) {
    if (!this.printer.connected) await this.printer.connect();
    let queue = await this.load(jobId);
    const selected = queue.items.filter((item) =>
      failedOnly ? item.status === "failed" : ["pending", "failed"].includes(item.status),
    );
    let completed = 0;
    for (const item of selected) {
      const transmissionId = crypto.randomUUID();
      await api(
        `/api/print-jobs/${jobId}/items/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "transmitting",
            transmissionId,
            settings,
          }),
        },
      );
      let physicallyPrinted = false;
      let continueQueue = true;
      try {
        const traceUrl = `${window.location.origin}/t/${item.shortToken}`;
        await renderLabel(canvas, item, traceUrl, settings);
        await this.printer.print(canvas, 1, settings.density);
        physicallyPrinted = true;
        await api(`/api/print-jobs/${jobId}/items/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "printed", transmissionId }),
        });
      } catch (error) {
        if (physicallyPrinted)
          throw new Error(
            "L’étiquette est sortie de l’imprimante, mais sa confirmation n’a pas pu être enregistrée. Ne la réimprimez pas avant d’avoir vérifié le registre.",
          );
        const cause =
          error instanceof Error ? error.message : "Impression impossible.";
        let recovered = false;
        try {
          await this.printer.recoverConnection(
            `après l’étiquette ${item.labelCode}`,
          );
          recovered = true;
        } catch {}
        continueQueue = recovered;
        await api(`/api/print-jobs/${jobId}/items/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "failed",
              transmissionId,
              errorCode: "TRANSPORT_OR_PRINTER",
              errorMessage: `${cause} Vérifiez si l’étiquette est sortie.${
                recovered
                  ? " Connexion rétablie automatiquement."
                  : " Reconnexion manuelle nécessaire."
              }`,
            }),
          }).catch(() => undefined);
      }
      completed++;
      callbacks.onProgress?.(completed, selected.length, item);
      if (!continueQueue) break;
    }
    queue = await this.load(jobId);
    callbacks.onQueue?.(queue);
    return queue;
  }
}

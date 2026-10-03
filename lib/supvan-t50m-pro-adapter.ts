import type { PrinterTransport } from "./printer-transport";
import { WebSerialBluetoothTransport } from "./printer-transport";
import { command, prepareT50Job, T50_HEIGHT, T50_WIDTH } from "./t50m-protocol";
import {
  printerErrorMessage,
  recordPrinterEvent,
  sendPrinterDiagnosticReport,
} from "./printer-event-log";
import { PRINTER_CLIENT_VERSION } from "./printer-version";

const CHECK_DEVICE = 0x12,
  STATUS = 0x11,
  START_PRINT = 0x13,
  STOP_PRINT = 0x14,
  BUFFER_FULL = 0x10,
  NEXT_BULK = 0x5c;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type SupvanStatus = {
  bufferFull: boolean;
  busy: boolean;
  printing: boolean;
  error: string | null;
  raw: number[];
};

export class SupvanT50MProAdapter {
  private printSessionStarted = false;
  private phase = "inactive";
  private lastStatusRaw: number[] = [];

  constructor(
    private readonly transport: PrinterTransport = new WebSerialBluetoothTransport(),
  ) {}

  get connected() {
    return this.transport.connected;
  }

  info() {
    return {
      model: "SUPVAN T50M Pro",
      resolution: "203 dpi",
      raster: `${T50_WIDTH} × ${T50_HEIGHT} points pour 50 × 30 mm`,
      protocol:
        "Trames propriétaires 0x7E 0x5A, bitmap monochrome LSB, blocs 4096 octets compressés LZMA, paquets 512 octets.",
      transport: this.transport.info(),
    };
  }

  private async exchange(data: Uint8Array, timeout = 6000) {
    await this.transport.write(data);
    return this.transport.readFrame(timeout);
  }

  private commandName(commandId: number) {
    return (
      {
        [CHECK_DEVICE]: "CHECK_DEVICE",
        [STATUS]: "INQUIRY_STA",
        [START_PRINT]: "START_PRINT",
        [STOP_PRINT]: "STOP_PRINT",
        [BUFFER_FULL]: "BUF_FULL",
        [NEXT_BULK]: "NEXT_ZIPPEDBULK",
      } as Record<number, string>
    )[commandId] ?? `0x${commandId.toString(16).padStart(2, "0")}`;
  }

  private async exchangeCommand(
    commandId: number,
    param1 = 0,
    param2 = 0,
    timeout = 6000,
  ) {
    const name = this.commandName(commandId);
    const started = Date.now();
    try {
      const frame = await this.exchange(
        command(commandId, param1, param2),
        timeout,
      );
      if (frame[7] !== commandId)
        throw new Error(
          `Réponse inattendue 0x${(frame[7] ?? 0)
            .toString(16)
            .padStart(2, "0")} pendant ${name}.`,
        );
      if (commandId !== STATUS)
        recordPrinterEvent(
          `${name} confirmé`,
          "success",
          `${Date.now() - started} ms`,
        );
      return frame;
    } catch (error) {
      recordPrinterEvent(
        `${name} sans confirmation`,
        "error",
        `${Date.now() - started} ms · ${printerErrorMessage(error)}`,
      );
      throw error;
    }
  }

  private async ensureResponsive() {
    if (!this.connected) {
      this.printSessionStarted = false;
      await this.connect();
      return;
    }
    try {
      await this.exchangeCommand(CHECK_DEVICE, 0, 0, 6500);
    } catch (error) {
      recordPrinterEvent(
        "Contrôle de connexion sans réponse",
        "warning",
        printerErrorMessage(error),
      );
      await this.recoverConnection("contrôle avant impression");
    }
  }

  async connect() {
    if (this.connected) return;
    this.printSessionStarted = false;
    let channelOpened = false;
    try {
      await this.transport.connect();
      channelOpened = true;
      await this.exchangeCommand(CHECK_DEVICE, 0, 0, 10000);
      recordPrinterEvent("T50M Pro disponible", "success");
    } catch (error) {
      recordPrinterEvent(
        "Connexion T50M Pro non confirmée",
        "error",
        printerErrorMessage(error),
      );
      if (!channelOpened) throw error;
      await this.recoverConnection("connexion initiale");
    }
  }

  async recoverConnection(context = "après une erreur de communication") {
    if (this.printSessionStarted && this.connected) {
      try {
        await this.exchangeCommand(STOP_PRINT, 0, 0, 3500);
        await delay(250);
      } catch {}
    }
    this.printSessionStarted = false;
    let lastError: unknown = new Error("Reconnexion impossible.");
    const waits = [450, 900, 1500];
    for (let attempt = 0; attempt < waits.length; attempt++) {
      try {
        recordPrinterEvent(
          `Reconnexion automatique ${attempt + 1}/${waits.length}`,
          "warning",
          context,
        );
        await delay(waits[attempt]);
        await this.transport.reopen();
        await delay(700 + attempt * 300);
        await this.exchangeCommand(CHECK_DEVICE, 0, 0, 10000);
        recordPrinterEvent(
          "Connexion Bluetooth rétablie automatiquement",
          "success",
          context,
        );
        return;
      } catch (error) {
        lastError = error;
        recordPrinterEvent(
          `Échec de reconnexion ${attempt + 1}/${waits.length}`,
          "error",
          printerErrorMessage(error),
        );
      }
    }
    throw new Error(
      `La connexion Bluetooth reste instable. ${printerErrorMessage(lastError)}`,
    );
  }

  async disconnect() {
    const shouldStop = this.printSessionStarted && this.connected;
    this.printSessionStarted = false;
    if (shouldStop)
      try {
        await this.exchangeCommand(STOP_PRINT, 0, 0, 3500);
        await delay(150);
      } catch {}
    await this.transport.disconnect();
  }

  private async preparePrintChannel() {
    await this.ensureResponsive();
    if (this.printSessionStarted) {
      try {
        await this.finishPrintCycle();
      } catch {
        await this.recoverConnection("fermeture de la session précédente");
      }
    }
    await this.waitUntil(
      (status) => !status.busy && !status.printing && !status.bufferFull,
      15000,
      "L’imprimante est occupée.",
    );
  }

  private async finishPrintCycle() {
    if (!this.printSessionStarted) return;
    try {
      await this.exchangeCommand(STOP_PRINT, 0, 0, 6000);
      recordPrinterEvent("Cycle d’impression fermé", "success");
    } finally {
      this.printSessionStarted = false;
    }
    await delay(300);
  }

  async status(): Promise<SupvanStatus> {
    const frame = await this.exchangeCommand(STATUS);
    this.lastStatusRaw = Array.from(frame);
    const mstaLow = frame[14] ?? 0,
      mstaHigh = frame[15] ?? 0,
      fstaLow = frame[16] ?? 0,
      fstaHigh = frame[17] ?? 0;
    const errors = [
      [mstaLow & 0x02, "Erreur de lecture de l’étiquette"],
      [mstaLow & 0x04, "Fin du rouleau d’étiquettes"],
      [mstaLow & 0x08, "Format d’étiquette incompatible"],
      [mstaLow & 0x10, "Erreur de ruban"],
      [mstaLow & 0x20, "Ruban épuisé"],
      [mstaLow & 0x40, "Batterie faible"],
      [mstaHigh & 0x08, "Tête d’impression trop chaude"],
      [fstaLow & 0x08, "Capot de l’imprimante ouvert"],
      [fstaHigh & 0x01, "Rouleau d’étiquettes non installé"],
    ] as const;
    return {
      bufferFull: Boolean(mstaLow & 0x01),
      busy: Boolean(mstaHigh & 0x04),
      printing: Boolean(fstaLow & 0x40),
      error: errors.find(([active]) => Boolean(active))?.[1] ?? null,
      raw: Array.from(frame),
    };
  }

  private async waitUntil(
    check: (status: SupvanStatus) => boolean,
    timeout: number,
    message: string,
  ) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const current = await this.status();
      if (current.error) {
        recordPrinterEvent(
          "État imprimante en erreur",
          "error",
          `${current.error} · ${current.raw
            .map((value) => value.toString(16).padStart(2, "0"))
            .join(" ")}`,
        );
        throw new Error(current.error + ".");
      }
      if (check(current)) return current;
      await delay(300);
    }
    throw new Error(message);
  }

  async print(
    canvas: HTMLCanvasElement,
    copies = 1,
    density = 4,
    onProgress?: (completed: number, total: number) => void,
  ) {
    if (canvas.width !== T50_WIDTH || canvas.height !== T50_HEIGHT)
      throw new Error("Le protocole 50 × 30 mm attend un bitmap de 384 × 240 points.");
    if (!Number.isInteger(copies) || copies < 1 || copies > 50)
      throw new Error("Le nombre d’exemplaires doit être compris entre 1 et 50.");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("L’image de l’étiquette est indisponible.");
    const job = prepareT50Job(
      context.getImageData(0, 0, T50_WIDTH, T50_HEIGHT),
      density,
    );
    recordPrinterEvent(
      "Début d’impression",
      "info",
      `${copies} exemplaire(s) · ${job.frames.length} paquet(s)`,
    );
    await this.preparePrintChannel();
    try {
      for (let copy = 0; copy < copies; copy++) {
        this.phase = `préparation ${copy + 1}/${copies}`;
        await this.waitUntil(
          (status) => !status.busy && !status.printing && !status.bufferFull,
          15000,
          `La copie ${copy + 1}/${copies} attend que l’imprimante soit libre.`,
        );

        recordPrinterEvent(
          `Cycle ${copy + 1}/${copies}`,
          "info",
          "connexion Bluetooth conservée",
        );
        this.phase = `START_PRINT ${copy + 1}/${copies}`;
        await this.exchangeCommand(START_PRINT);
        this.printSessionStarted = true;
        await this.waitUntil(
          (status) => status.printing,
          10000,
          `La copie ${copy + 1}/${copies} n’a pas démarré.`,
        );
        await this.waitUntil(
          (status) => !status.bufferFull,
          15000,
          "La mémoire de l’imprimante est occupée.",
        );
        this.phase = `annonce bitmap ${copy + 1}/${copies}`;
        await this.exchangeCommand(NEXT_BULK, 512, job.frames.length);
        this.phase = `transfert bitmap ${copy + 1}/${copies}`;
        recordPrinterEvent(
          `Transfert bitmap ${copy + 1}/${copies}`,
          "info",
          `${job.frames.length} paquet(s) · ${job.compressed.length} octets`,
        );
        for (let index = 0; index < job.frames.length; index++) {
          try {
            await this.exchange(job.frames[index], 8000);
          } catch (error) {
            recordPrinterEvent(
              `Paquet bitmap ${index + 1}/${job.frames.length} sans confirmation`,
              "error",
              printerErrorMessage(error),
            );
            throw error;
          }
          await delay(10);
        }
        recordPrinterEvent(
          `Bitmap ${copy + 1}/${copies} reçu`,
          "success",
          `${job.frames.length}/${job.frames.length} paquet(s) confirmés`,
        );
        // This T50M Pro firmware accepts the compressed block first and uses
        // BUF_FULL as the commit that starts the mechanical print. Sending the
        // commit before the bytes is acknowledged by Bluetooth but sets the
        // printer's ribbon-error status and no label is fed.
        this.phase = `validation bitmap ${copy + 1}/${copies}`;
        await this.exchangeCommand(
          BUFFER_FULL,
          job.compressed.length,
          job.speed,
        );
        this.phase = `fin mécanique ${copy + 1}/${copies}`;
        await this.waitUntil(
          (status) => !status.printing && !status.busy,
          45000,
          `La copie ${copy + 1}/${copies} n’a pas confirmé sa fin.`,
        );
        recordPrinterEvent(
          `Exemplaire ${copy + 1}/${copies} confirmé`,
          "success",
        );
        onProgress?.(copy + 1, copies);
        this.phase = `STOP_PRINT ${copy + 1}/${copies}`;
        try {
          await this.finishPrintCycle();
        } catch (error) {
          recordPrinterEvent(
            "Étiquette sortie, fermeture du cycle non confirmée",
            "warning",
            printerErrorMessage(error),
          );
          if (copy + 1 < copies)
            await this.recoverConnection(
              `après ${copy + 1}/${copies} exemplaire(s) déjà imprimé(s)`,
            );
        }
      }
      this.phase = "prêt";
    } catch (error) {
      if (!this.connected) this.printSessionStarted = false;
      recordPrinterEvent(
        "Impression interrompue",
        "error",
        printerErrorMessage(error),
      );
      await sendPrinterDiagnosticReport("échec d’impression", error, {
        ...this.transport.info(),
        clientVersion: PRINTER_CLIENT_VERSION,
        phase: this.phase,
        copies,
        lastStatus: this.lastStatusRaw
          .map((value) => value.toString(16).padStart(2, "0"))
          .join(" "),
      }).catch(() => undefined);
      throw error;
    }
  }
}

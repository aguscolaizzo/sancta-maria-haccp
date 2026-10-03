import {
  printerErrorMessage,
  recordPrinterEvent,
} from "./printer-event-log";

export type PrinterTransportInfo = {
  kind: "web_serial_bluetooth";
  connected: boolean;
  usbVendorId: number | null;
  usbProductId: number | null;
  note: string;
};

export interface PrinterTransport {
  readonly connected: boolean;
  connect(): Promise<void>;
  reopen(): Promise<void>;
  disconnect(): Promise<void>;
  write(data: Uint8Array): Promise<void>;
  readFrame(timeout?: number): Promise<Uint8Array>;
  info(): PrinterTransportInfo;
}

type SerialPortLike = {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number; bufferSize?: number }): Promise<void>;
  close(): Promise<void>;
  getInfo?(): { usbVendorId?: number; usbProductId?: number };
};

type SerialNavigator = Navigator & {
  serial?: {
    requestPort(options?: unknown): Promise<SerialPortLike>;
    getPorts?(): Promise<SerialPortLike[]>;
  };
};

export function supportsWebSerialPrinter() {
  return (
    typeof navigator !== "undefined" &&
    "serial" in navigator &&
    Boolean((navigator as SerialNavigator).serial)
  );
}

export class WebSerialBluetoothTransport implements PrinterTransport {
  private port: SerialPortLike | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private received = new Uint8Array();

  get connected() {
    return Boolean(this.port && this.reader && this.writer);
  }

  private async openPort(port: SerialPortLike) {
    recordPrinterEvent("Ouverture du canal Bluetooth série");
    try {
      await port.open({ baudRate: 115200, bufferSize: 8192 });
      if (!port.readable || !port.writable)
        throw new Error("Le canal série Bluetooth ne fournit pas de lecture/écriture.");
      this.reader = port.readable.getReader();
      this.writer = port.writable.getWriter();
      this.received = new Uint8Array();
      recordPrinterEvent("Canal Bluetooth série ouvert", "success");
    } catch (error) {
      recordPrinterEvent(
        "Échec d’ouverture du canal Bluetooth",
        "error",
        printerErrorMessage(error),
      );
      throw error;
    }
  }

  private async closePort(forgetSelection: boolean) {
    const selectedPort = this.port;
    try {
      await this.reader?.cancel();
    } catch {}
    try {
      this.reader?.releaseLock();
    } catch {}
    try {
      this.writer?.releaseLock();
    } catch {}
    this.reader = null;
    this.writer = null;
    try {
      await selectedPort?.close();
    } catch {}
    if (forgetSelection) this.port = null;
    this.received = new Uint8Array();
    recordPrinterEvent(
      forgetSelection
        ? "Déconnexion demandée par l’utilisateur"
        : "Canal fermé; imprimante conservée pour reconnexion automatique",
      forgetSelection ? "info" : "warning",
    );
  }

  async connect() {
    if (this.connected) return;
    const serial = (navigator as SerialNavigator).serial;
    if (!serial)
      throw new Error(
        "Web Serial n’est pas disponible dans ce navigateur. Ouvrez le site dans le même Chrome Android utilisé lors du premier essai.",
      );
    if (!this.port) {
      const granted = (await serial.getPorts?.()) ?? [];
      recordPrinterEvent(
        granted.length === 1
          ? "Imprimante déjà autorisée retrouvée"
          : "Sélection de l’imprimante demandée",
      );
      this.port = granted.length === 1 ? granted[0] : await serial.requestPort();
    }
    await this.openPort(this.port);
  }

  async reopen() {
    const selectedPort = this.port;
    if (!selectedPort)
      throw new Error("Le port de la T50M Pro n’est plus sélectionné.");
    await this.closePort(false);
    await this.openPort(selectedPort);
  }

  async disconnect() {
    await this.closePort(true);
  }

  private popFrame() {
    let start = -1;
    for (let index = 0; index < this.received.length - 1; index++)
      if (this.received[index] === 0x7e && this.received[index + 1] === 0x5a) {
        start = index;
        break;
      }
    if (start < 0) {
      this.received = this.received.slice(-1);
      return null;
    }
    if (start) this.received = this.received.slice(start);
    if (this.received.length < 4) return null;
    const total = 4 + this.received[2] + (this.received[3] << 8);
    if (total < 8 || total > 4096) {
      this.received = this.received.slice(2);
      return null;
    }
    if (this.received.length < total) return null;
    const frame = this.received.slice(0, total);
    this.received = this.received.slice(total);
    return frame;
  }

  private async readChunk(timeout: number) {
    const reader = this.reader;
    if (!reader) throw new Error("L’imprimante n’est pas connectée.");
    const timeoutError = new Error("L’imprimante ne répond pas.");
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(timeoutError), timeout);
        }),
      ]);
    } catch (error) {
      // Cancel the pending read so it cannot consume the following command's
      // response, but retain the exact port selected by the user. The adapter
      // can reopen it without showing Chrome's chooser again.
      if (error === timeoutError) {
        recordPrinterEvent(
          "Délai de réponse Bluetooth dépassé",
          "error",
          `${timeout} ms`,
        );
        await this.closePort(false);
      }
      throw error;
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }
  }

  async readFrame(timeout = 6000): Promise<Uint8Array> {
    const waiting = this.popFrame();
    if (waiting) return waiting;
    if (!this.reader) throw new Error("L’imprimante n’est pas connectée.");
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const remaining = Math.max(1, deadline - Date.now());
      const result = await this.readChunk(remaining);
      if (result.done) {
        const error = new Error("La connexion à l’imprimante a été fermée.");
        recordPrinterEvent("Connexion fermée par l’imprimante", "error");
        await this.closePort(false);
        throw error;
      }
      if (result.value?.length) {
        const joined = new Uint8Array(this.received.length + result.value.length);
        joined.set(this.received);
        joined.set(result.value, this.received.length);
        this.received = joined;
        const frame = this.popFrame();
        if (frame) return frame;
      }
    }
    throw new Error("L’imprimante ne répond pas.");
  }

  async write(data: Uint8Array) {
    if (!this.writer) throw new Error("L’imprimante n’est pas connectée.");
    try {
      await this.writer.write(data);
    } catch (error) {
      recordPrinterEvent(
        "Échec d’envoi Bluetooth",
        "error",
        `${data.length} octets · ${printerErrorMessage(error)}`,
      );
      await this.closePort(false);
      throw error;
    }
  }

  info(): PrinterTransportInfo {
    const port = this.port?.getInfo?.() ?? {};
    return {
      kind: "web_serial_bluetooth",
      connected: this.connected,
      usbVendorId: port.usbVendorId ?? null,
      usbProductId: port.usbProductId ?? null,
      note:
        "Canal série Bluetooth à 115200 bauds. Aucun service ni caractéristique GATT n’est exposé à l’application.",
    };
  }
}

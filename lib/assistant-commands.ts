// Interprétation prudente des commandes HACCP. Aucun changement n'est exécuté ici.
// Une demande n'est jamais une preuve qu'un travail HACCP a été effectué.
export type AssistantAction =
  | { type: "prepare_labels"; quantity: number; product: string }
  | { type: "navigate"; href: string };

export type AssistantIntent = {
  kind: "expiry" | "labels" | "cleaning" | "stock" | "temperatures" | "navigation" | "help";
  reply: string;
  action?: AssistantAction;
};

export function normalizeAssistantText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

const NUMBER_WORDS: Record<string, number> = {
  un: 1, una: 1, uno: 1, une: 1, deux: 2, dos: 2, trois: 3, tres: 3,
  cuatro: 4, quatre: 4, cinco: 5, cinq: 5, seis: 6, six: 6, siete: 7,
  sept: 7, ocho: 8, huit: 8, nueve: 9, neuf: 9, diez: 10, dix: 10,
  veinte: 20, vingt: 20, cincuenta: 50, cinquante: 50,
};
const LABEL = "(?:etiquetas?|etiquettes?|labels?)";
const NUMBER = "(?:\\d{1,4}|" + Object.keys(NUMBER_WORDS).join("|") + ")";

export function labelQuantity(text: string): number | null {
  const normalized = normalizeAssistantText(text);
  // Only use a quantity adjacent to "étiquettes". A lot/DLC number elsewhere
  // must never become the requested count.
  const before = normalized.match(new RegExp("\\b(" + NUMBER + ")\\s+" + LABEL + "\\b"));
  const after = normalized.match(new RegExp("\\b" + LABEL + "\\s+(" + NUMBER + ")\\b"));
  const token = before?.[1] ?? after?.[1];
  if (!token) return null;
  return /^\\d+$/.test(token) ? Number(token) : NUMBER_WORDS[token] ?? null;
}

export function labelProduct(message: string): string {
  const normalized = normalizeAssistantText(message);
  const labels = normalized.match(new RegExp("\\b" + LABEL + "\\b"));
  if (!labels || labels.index === undefined) return "";
  return normalized.slice(labels.index + labels[0].length)
    .replace(/^(?:\s+(?:de|del|des|du|d|para|pour|las|los|les))+/g, " ")
    .replace(/\b(?:con|avec|lote|lot|dlc|vence|expiration|caducidad|de\s+\d+\s+horas)\b.*$/g, "")
    .replace(/[.,;:!?]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

export function interpretAssistantCommand(message: string): AssistantIntent {
  const raw = message.trim().slice(0, 1500);
  const text = normalizeAssistantText(raw);
  if (/venc|caduc|expir|echeanc|dlc|perim/.test(text) && !/(?:etiquet|label)/.test(text)) {
    return { kind: "expiry", reply: "Consulto las fechas de vencimiento registradas en Sancta Maria." };
  }
  if (/etiquet|label/.test(text) && /imprim|prepar|gener|crea|cree|quiero|hacer|fai|necesit/.test(text)) {
    const count = labelQuantity(raw);
    const product = labelProduct(raw);
    if (count === null || count < 1 || count > 100) {
      return { kind: "labels", reply: "Indicame cuántas etiquetas necesitás (de 1 a 100) y de qué producto. No se creará nada sin tu confirmación." };
    }
    if (!product) {
      return { kind: "labels", reply: "¿De qué producto querés las etiquetas? No se creará nada sin tu confirmación." };
    }
    return {
      kind: "labels",
      reply: "Solicitud de " + count + " etiqueta(s) de «" + product + "». Revisá el ingrediente, lote de origen y DLC en Étiquettes. La creación exige tu validación y la impresión Bluetooth sigue requiriendo tu teléfono.",
      action: { type: "prepare_labels", quantity: count, product },
    };
  }
  if (/venc|caduc|expir|echeanc|dlc|perim/.test(text)) {
    return { kind: "expiry", reply: "Consulto las fechas de vencimiento registradas en Sancta Maria." };
  }
  if (/limpi|nettoy|freidor|fritos|friteus|suelo|sol\b|higien|hygien/.test(text)) {
    return { kind: "cleaning", reply: "Puedo abrir los controles de limpieza o freidora. No se registrará la tarea sin tu validación.", action: { type: "navigate", href: /freidor|friteus|fritos/.test(text) ? "/?tab=fryer" : "/?tab=cleaning" } };
  }
  if (/stock|inventar|cuant|combien|queda|rest[e ]|existencias/.test(text)) {
    return { kind: "stock", reply: "El stock exacto requiere consumos, mermas y movimientos registrados. Puedo abrir los lotes recibidos; no voy a inventar cantidades.", action: { type: "navigate", href: "/?tab=receptions" } };
  }
  if (/temperatur|frigor|frigo|congelad|chambre froid/.test(text)) {
    return { kind: "temperatures", reply: "Abramos el control de temperaturas. Nunca se registra una medida que no hayas realizado.", action: { type: "navigate", href: "/?tab=entry" } };
  }
  if (/recep|livrai|proveedor|fournisseur|factur/.test(text)) {
    return { kind: "navigation", reply: "Podés abrir las recepciones para consultar proveedores y lotes.", action: { type: "navigate", href: "/?tab=receptions" } };
  }
  return {
    kind: "help",
    reply: "Puedo consultar vencimientos y preparar solicitudes de etiquetas para confirmar, además de abrir limpieza, freidora, temperaturas y recepciones. Probá: «Prepará seis etiquetas de tomates cortados» o «¿Qué vence hoy?».",
  };
}

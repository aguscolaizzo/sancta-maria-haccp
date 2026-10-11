// Interprétation prudente des commandes usuelles HACCP.
// Cette couche ne modifie JAMAIS les données. Les écritures nécessitent confirmation explicite.
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

function quantityIn(text: string): number | null {
  const match = text.match(/\b(\d{1,4})\b/);
  if (match) return Number(match[1]);
  for (const [word, number] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp("\\b" + word + "\\b").test(text)) return number;
  }
  return null;
}

function productIn(original: string): string {
  return original
    .replace(/\b\d{1,4}\b/g, " ")
    .replace(/\b(una?|uno|une?|dos|deux|tres|trois|cuatro|quatre|cinco|cinq|seis|six|siete|sept|ocho|huit|nueve|neuf|diez|dix|veinte|vingt|cincuenta|cinquante)\b/gi, " ")
    .replace(/\b(imprim[a-zà-ÿ]*|prepar[a-zà-ÿ]*|gener[a-zà-ÿ]*|crear?|creer?|hacer|necesito|quiero|me|por|favor|las?|los?|des?|d[e']?|etiquet[a-zà-ÿ]*|étiquet[a-zà-ÿ]*|labels?|pour|para|del?|de|du|des)\b/gi, " ")
    .replace(/[.,;:!?]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

export function interpretAssistantCommand(message: string): AssistantIntent {
  const raw = message.trim().slice(0, 1500);
  const text = normalizeAssistantText(raw);
  if (/venc|caduc|expir|echeanc|dlc|perim/.test(text)) {
    return { kind: "expiry", reply: "Consulto las fechas de vencimiento registradas en Sancta Maria." };
  }
  if (/(?:etiquet|label)/.test(text) && /imprim|prepar|gener|crea|cree|quiero|hacer|fai|necesit/.test(text)) {
    const count = quantityIn(text);
    const product = productIn(raw);
    if (count === null || count < 1 || count > 100) {
      return { kind: "labels", reply: "Indicame cuántas etiquetas necesitás (de 1 a 100) y de qué producto. No se creará nada sin tu confirmación." };
    }
    if (!product) {
      return { kind: "labels", reply: "¿De qué producto querés las etiquetas? No se creará nada sin tu confirmación." };
    }
    return {
      kind: "labels",
      reply: "Prepararé " + count + " etiqueta(s) de «" + product + "». Primero revisarás el ingrediente, lote de origen y la DLC. Solo al confirmar se crearán en la aplicación; la impresión Bluetooth seguirá requiriendo tu teléfono.",
      action: { type: "prepare_labels", quantity: count, product },
    };
  }
  if (/limpi|nettoy|freidor|fritos|friteus|suelo|sol\b|higien|hygien|friteuse/.test(text)) {
    return { kind: "cleaning", reply: "Podemos abrir los controles de limpieza o de la freidora. El registro no se dará por realizado hasta que lo valides.", action: { type: "navigate", href: /freidor|friteus|fritos/.test(text) ? "/?tab=fryer" : "/?tab=cleaning" } };
  }
  if (/stock|inventar|cuant|combien|queda|rest[e ]|existencias/.test(text)) {
    return { kind: "stock", reply: "El stock exacto requiere registrar consumos, mermas y movimientos. Puedo ayudarte a consultar los lotes recibidos, pero no voy a inventar cantidades disponibles.", action: { type: "navigate", href: "/?tab=receptions" } };
  }
  if (/temperatur|frigor|frigo|congelad|chambre froid/.test(text)) {
    return { kind: "temperatures", reply: "Te llevo al control de temperaturas. Los controles pendientes nunca se marcan como realizados automáticamente.", action: { type: "navigate", href: "/?tab=entry" } };
  }
  if (/recep|livrai|proveedor|fournisseur|factur/.test(text)) {
    return { kind: "navigation", reply: "Podés abrir las recepciones para consultar proveedores y lotes.", action: { type: "navigate", href: "/?tab=receptions" } };
  }
  return {
    kind: "help",
    reply: "Puedo consultar vencimientos y preparar solicitudes de etiquetas para confirmar, además de abrir limpieza, freidora, temperaturas y recepciones. Probá: «Prepará seis etiquetas de tomates cortados» o «¿Qué vence hoy?».",
  };
}

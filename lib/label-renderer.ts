import type { PrintQueueItem, PrinterSettings } from "./print-jobs";
import { drawCrispQr } from "./qr-renderer";
import { T50_HEIGHT, T50_WIDTH } from "./t50m-protocol";

export type LabelRenderData = Pick<
  PrintQueueItem,
  | "labelCode"
  | "shortToken"
  | "shortName"
  | "preparationCode"
  | "preparedAt"
  | "expiresAt"
  | "storageMode"
  | "storageTemperature"
  | "operatorInitials"
  | "bacIndex"
>;

function shortDateTime(value: string) {
  const [date, time] = value.split("T");
  const [, month, day] = date.split("-");
  return `${day}/${month} ${time}`;
}

function temperature(value: number | null, storageMode: string) {
  if (value === null) return storageMode === "frozen" ? "−18 °C" : "≤ +4 °C";
  return `${value > 0 ? "+" : ""}${String(value).replace("-", "−")} °C`;
}

function fitText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  let size = 29;
  while (size > 16) {
    context.font = `700 ${size}px Arial`;
    if (context.measureText(text).width <= maxWidth) return size;
    size--;
  }
  return size;
}

async function drawContent(
  canvas: HTMLCanvasElement,
  data: LabelRenderData,
  traceUrl: string,
) {
  canvas.width = T50_WIDTH;
  canvas.height = T50_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Aperçu indisponible.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, T50_WIDTH, T50_HEIGHT);
  context.fillStyle = "#000";
  context.textAlign = "left";
  context.font = "700 13px Arial";
  context.fillText("SANCTA MARIA 1187", 13, 18);
  context.textAlign = "right";
  context.font = "11px Arial";
  context.fillText(`BAC ${data.bacIndex}`, 370, 18);
  context.fillRect(12, 25, 360, 2);
  context.textAlign = "left";
  const name = data.shortName.slice(0, 30).toUpperCase();
  context.font = `700 ${fitText(context, name, 222)}px Arial`;
  context.fillText(name, 13, 57);
  context.font = "700 17px Arial";
  context.fillText(`PRÉP. ${shortDateTime(data.preparedAt)}`, 13, 91);
  context.fillText(`DLC   ${shortDateTime(data.expiresAt)}`, 13, 118);
  context.font = "700 15px Arial";
  context.fillText(
    `${temperature(data.storageTemperature, data.storageMode)} · OP. ${data.operatorInitials}`,
    13,
    145,
  );
  context.font = "11px Arial";
  context.fillText(data.preparationCode.slice(0, 27), 13, 172);
  context.font = "700 12px Arial";
  context.fillText(data.labelCode.slice(0, 27), 13, 193);
  context.font = "10px Arial";
  context.fillText("QR : fiche et traçabilité", 13, 216);
  drawCrispQr(context, traceUrl, 236, 34, 144);
  context.textAlign = "center";
  context.font = "700 10px Arial";
  context.fillText(data.labelCode.slice(-9), 313, 175);
  context.textAlign = "left";
}

function transform(
  target: HTMLCanvasElement,
  source: HTMLCanvasElement,
  settings: PrinterSettings,
) {
  target.width = T50_WIDTH;
  target.height = T50_HEIGHT;
  const context = target.getContext("2d");
  if (!context) throw new Error("Aperçu indisponible.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, T50_WIDTH, T50_HEIGHT);
  context.imageSmoothingEnabled = false;
  context.save();
  context.translate(
    T50_WIDTH / 2 + settings.marginX,
    T50_HEIGHT / 2 + settings.marginY,
  );
  context.scale(
    settings.mirrorHorizontal ? -1 : 1,
    settings.mirrorVertical ? -1 : 1,
  );
  context.rotate((settings.rotation * Math.PI) / 180);
  const quarterTurn = settings.rotation === 90 || settings.rotation === 270;
  const scale = quarterTurn ? T50_HEIGHT / T50_WIDTH : 1;
  context.scale(scale, scale);
  context.drawImage(source, -T50_WIDTH / 2, -T50_HEIGHT / 2);
  context.restore();
}

export async function renderLabel(
  target: HTMLCanvasElement,
  data: LabelRenderData,
  traceUrl: string,
  settings: PrinterSettings,
) {
  if (settings.format !== "50x30")
    throw new Error(
      "Le protocole physique des formats 30 × 20 et 50 × 80 mm doit encore être validé. Utilisez 50 × 30 mm.",
    );
  const source = document.createElement("canvas");
  await drawContent(source, data, traceUrl);
  transform(target, source, settings);
}

export function renderDiagnosticPattern(
  target: HTMLCanvasElement,
  settings: PrinterSettings,
) {
  const source = document.createElement("canvas");
  source.width = T50_WIDTH;
  source.height = T50_HEIGHT;
  const context = source.getContext("2d");
  if (!context) throw new Error("Aperçu indisponible.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, T50_WIDTH, T50_HEIGHT);
  context.strokeStyle = "#000";
  context.lineWidth = 3;
  context.strokeRect(4, 4, 376, 232);
  context.fillStyle = "#000";
  context.font = "700 25px Arial";
  context.fillText("HAUT ↑", 18, 38);
  context.font = "700 18px Arial";
  context.fillText("GAUCHE", 18, 118);
  context.textAlign = "right";
  context.fillText("DROITE", 366, 118);
  context.textAlign = "center";
  context.font = "700 34px Arial";
  context.fillText("T50M PRO", 192, 88);
  context.font = "16px Arial";
  context.fillText(
    `${settings.rotation}° · X${settings.mirrorHorizontal ? " miroir" : " normal"} · Y${settings.mirrorVertical ? " miroir" : " normal"}`,
    192,
    157,
  );
  context.fillText(`Densité ${settings.density}`, 192, 184);
  context.font = "700 22px Arial";
  context.fillText("BAS ↓", 192, 222);
  context.textAlign = "left";
  transform(target, source, settings);
}

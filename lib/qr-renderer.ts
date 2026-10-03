import * as QRCode from "qrcode";

const MIN_QUIET_MODULES = 2;

export function crispQrLayout(value: string, maxSize: number) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" }),
    moduleCount = qr.modules.size,
    scale = Math.floor(maxSize / (moduleCount + MIN_QUIET_MODULES * 2));
  if (scale < 2)
    throw new Error("Le QR est trop dense pour être imprimé lisiblement.");
  const symbolSize = moduleCount * scale,
    offset = Math.floor((maxSize - symbolSize) / 2);
  return { qr, moduleCount, scale, symbolSize, offset };
}

/** Paints every QR module on whole device pixels, without canvas resampling. */
export function drawCrispQr(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  maxSize: number,
) {
  const layout = crispQrLayout(value, maxSize);
  context.save();
  context.imageSmoothingEnabled = false;
  context.fillStyle = "#fff";
  context.fillRect(x, y, maxSize, maxSize);
  context.fillStyle = "#000";
  for (let row = 0; row < layout.moduleCount; row++)
    for (let column = 0; column < layout.moduleCount; column++)
      if (layout.qr.modules.get(row, column))
        context.fillRect(
          x + layout.offset + column * layout.scale,
          y + layout.offset + row * layout.scale,
          layout.scale,
          layout.scale,
        );
  context.restore();
  return layout;
}

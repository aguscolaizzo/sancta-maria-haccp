import { compressFile } from "./vendor/lzma-browser";

export const T50_WIDTH = 384;
export const T50_HEIGHT = 240;
const BYTES_PER_ROW = T50_WIDTH / 8;
const PRINT_BUFFER_SIZE = 4096;
const PRINT_HEADER_SIZE = 14;

export function imageDataToRaster(
  data: Uint8ClampedArray,
  width = T50_WIDTH,
  height = T50_HEIGHT,
  threshold = 174,
) {
  if (width !== T50_WIDTH || height !== T50_HEIGHT)
    throw new Error("L’image doit mesurer 384 × 240 points.");
  const raster = new Uint8Array(height * BYTES_PER_ROW);
  for (let y = 0; y < height; y++) {
    for (let sourceX = 0; sourceX < width; sourceX++) {
      const i = (y * width + sourceX) * 4;
      const alpha = data[i + 3] / 255;
      const luminance =
        (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) *
          alpha +
        255 * (1 - alpha);
      if (luminance < threshold) {
        // The T50M consumes each raster line right-to-left. Compensate here
        // so the physical label matches the canvas preview.
        const deviceX = width - 1 - sourceX;
        raster[y * BYTES_PER_ROW + (deviceX >> 3)] |= 1 << (deviceX & 7);
      }
    }
  }
  return raster;
}

function makePrintBuffer(
  raster: Uint8Array,
  startRow: number,
  rows: number,
  flags: number,
  density: number,
) {
  const out = new Uint8Array(PRINT_BUFFER_SIZE);
  out[2] = flags;
  out[3] = ((density & 0x0f) << 2) | (1 << 6);
  out[4] = rows & 0xff;
  out[5] = (rows >> 8) & 0xff;
  out[6] = BYTES_PER_ROW;
  out[8] = 8;
  out[10] = 8;
  out[12] = density;
  out.set(
    raster.subarray(
      startRow * BYTES_PER_ROW,
      (startRow + rows) * BYTES_PER_ROW,
    ),
    PRINT_HEADER_SIZE,
  );
  const dataEnd = PRINT_HEADER_SIZE + rows * BYTES_PER_ROW;
  let checksum = 0;
  for (let i = 2; i < PRINT_HEADER_SIZE; i++) checksum += out[i];
  for (let i = 1; i <= Math.floor(dataEnd / 256); i++)
    checksum += out[i * 256 - 1];
  out[0] = checksum & 0xff;
  out[1] = (checksum >> 8) & 0xff;
  return out;
}

export function buildUncompressedPrintData(raster: Uint8Array, density = 4) {
  if (raster.length !== T50_HEIGHT * BYTES_PER_ROW)
    throw new Error("Données d’étiquette invalides.");
  const parts = [
    makePrintBuffer(raster, 0, 84, 0x02, density),
    makePrintBuffer(raster, 84, 84, 0x00, density),
    makePrintBuffer(raster, 168, 56, 0x0c, density),
  ];
  const out = new Uint8Array(PRINT_BUFFER_SIZE * parts.length);
  parts.forEach((part, i) => out.set(part, i * PRINT_BUFFER_SIZE));
  return out;
}

export function compressPrintData(data: Uint8Array) {
  return new Uint8Array(
    compressFile(data, {
      a: 2,
      d: 13,
      fb: 128,
      mf: "bt4",
      lc: 3,
      lp: 0,
      pb: 2,
      eos: false,
    }),
  );
}

export function command(commandId: number, param1 = 0, param2 = 0) {
  const out = new Uint8Array(16);
  out.set([0x7e, 0x5a, 0x0c, 0x00, 0x10, 0x01, 0xaa, commandId]);
  out[11] = 1;
  out[12] = param1 & 0xff;
  out[13] = (param1 >> 8) & 0xff;
  out[14] = param2 & 0xff;
  out[15] = (param2 >> 8) & 0xff;
  let checksum = 0;
  for (let i = 10; i < 16; i++) checksum += out[i];
  out[8] = checksum & 0xff;
  out[9] = (checksum >> 8) & 0xff;
  return out;
}

export function buildDataFrames(compressed: Uint8Array) {
  const count = Math.ceil(compressed.length / 500);
  if (!count || count > 255)
    throw new Error("Étiquette compressée trop volumineuse.");
  const frames: Uint8Array[] = [];
  for (let packetIndex = 0; packetIndex < count; packetIndex++) {
    const packet = new Uint8Array(506);
    packet[0] = 0xaa;
    packet[1] = 0xbb;
    packet[4] = packetIndex;
    packet[5] = count;
    packet.set(
      compressed.subarray(packetIndex * 500, (packetIndex + 1) * 500),
      6,
    );
    let checksum = 0;
    for (let i = 4; i < packet.length; i++) checksum += packet[i];
    packet[2] = checksum & 0xff;
    packet[3] = (checksum >> 8) & 0xff;
    const frame = new Uint8Array(512);
    frame.set([0x7e, 0x5a, 0xfc, 0x01, 0x10, 0x02]);
    frame.set(packet, 6);
    frames.push(frame);
  }
  return frames;
}

export function transferSpeed(compressedLength: number) {
  const average = compressedLength / 3;
  if (average > 3000) return 10;
  if (average > 2800) return 15;
  if (average > 2500) return 20;
  if (average > 2000) return 25;
  if (average > 1500) return 40;
  if (average > 1000) return 45;
  if (average > 500) return 55;
  return 60;
}

export function prepareT50Job(imageData: ImageData, density = 4) {
  const raster = imageDataToRaster(
    imageData.data,
    imageData.width,
    imageData.height,
  );
  const compressed = compressPrintData(
    buildUncompressedPrintData(raster, density),
  );
  return {
    compressed,
    frames: buildDataFrames(compressed),
    speed: transferSpeed(compressed.length),
  };
}

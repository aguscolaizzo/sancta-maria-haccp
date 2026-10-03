import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir } from "node:fs/promises";
import { build } from "esbuild";

await mkdir(new URL("../.sites-runtime/tests/", import.meta.url), { recursive: true });
const bundle = new URL("../.sites-runtime/tests/t50m-protocol.mjs", import.meta.url);
await build({ entryPoints: [new URL("../lib/t50m-protocol.ts", import.meta.url).pathname], bundle: true, platform: "node", format: "esm", outfile: bundle.pathname, logLevel: "silent" });
const protocol = await import(bundle.href);

test("the T50 raster uses LSB packing with native mirror compensation", () => {
  const pixels = new Uint8ClampedArray(384 * 240 * 4).fill(255);
  pixels[3] = 255;
  pixels[0] = pixels[1] = pixels[2] = 0;
  const second = 8 * 4;
  pixels[second] = pixels[second + 1] = pixels[second + 2] = 0;
  const raster = protocol.imageDataToRaster(pixels);
  assert.equal(raster.length, 11520);
  assert.equal(raster[47], 128);
  assert.equal(raster[46], 128);
  assert.equal(raster[0], 0);
});

test("a print job has the SUPVAN buffers, LZMA header and packet framing", () => {
  const raster = new Uint8Array(11520);
  const raw = protocol.buildUncompressedPrintData(raster, 4);
  assert.equal(raw.length, 12288);
  assert.equal(raw[2], 0x02);
  assert.equal(raw[4], 84);
  assert.equal(raw[4096 * 2 + 2], 0x0c);
  assert.equal(raw[4096 * 2 + 4], 56);
  const compressed = protocol.compressPrintData(raw);
  assert.deepEqual(Array.from(compressed.slice(0, 7)), [0x5d, 0x00, 0x20, 0x00, 0x00, 0x00, 0x30]);
  const frames = protocol.buildDataFrames(compressed);
  assert.ok(frames.length >= 1);
  assert.equal(frames[0].length, 512);
  assert.deepEqual(Array.from(frames[0].slice(0, 6)), [0x7e, 0x5a, 0xfc, 0x01, 0x10, 0x02]);
  const start = protocol.command(0x13);
  assert.deepEqual(Array.from(start.slice(0, 8)), [0x7e, 0x5a, 0x0c, 0x00, 0x10, 0x01, 0xaa, 0x13]);
});

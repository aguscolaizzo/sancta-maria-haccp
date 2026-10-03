import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir } from "node:fs/promises";
import { build } from "esbuild";

await mkdir(new URL("../.sites-runtime/tests/", import.meta.url), { recursive: true });
const bundle = new URL("../.sites-runtime/tests/t50m-adapter.mjs", import.meta.url);
await build({
  entryPoints: [new URL("../lib/supvan-t50m-pro-adapter.ts", import.meta.url).pathname],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: bundle.pathname,
  logLevel: "silent",
});
const { SupvanT50MProAdapter } = await import(bundle.href);

function commandId(data) {
  return data[0] === 0x7e && data[1] === 0x5a && data[5] === 0x01
    ? data[7]
    : null;
}

class FakeTransport {
  connected = true;
  printing = false;
  writes = [];
  connects = 0;
  disconnects = 0;
  reopens = 0;
  statusReadsUntilDone = 0;

  async connect() {
    this.connected = true;
    this.connects++;
  }

  async disconnect() {
    this.connected = false;
    this.disconnects++;
  }

  async reopen() {
    this.connected = true;
    this.reopens++;
  }

  async write(data) {
    this.writes.push(data);
    const id = commandId(data);
    if (id === 0x13) this.printing = true;
    if (id === 0x10) {
      this.printing = true;
      this.statusReadsUntilDone = 1;
    }
    if (id === 0x14) this.printing = false;
  }

  async readFrame() {
    const lastCommand = commandId(this.writes.at(-1));
    const frame = new Uint8Array(18);
    frame[7] = lastCommand ?? 0;
    if (this.printing) frame[16] = 0x40;
    if (
      lastCommand === 0x11 &&
      this.statusReadsUntilDone > 0
    ) {
      this.statusReadsUntilDone--;
      if (!this.statusReadsUntilDone) this.printing = false;
    }
    return frame;
  }

  info() {
    return {
      kind: "web_serial_bluetooth",
      connected: this.connected,
      usbVendorId: null,
      usbProductId: null,
      note: "fake transport",
    };
  }
}

function testCanvas() {
  const pixels = new Uint8ClampedArray(384 * 240 * 4).fill(255);
  return {
    width: 384,
    height: 240,
    getContext: () => ({
      getImageData: () => ({ data: pixels, width: 384, height: 240 }),
    }),
  };
}

test("two labels keep one serial connection and close each print cycle", async () => {
  const transport = new FakeTransport();
  const printer = new SupvanT50MProAdapter(transport);
  const canvas = testCanvas();

  await printer.print(canvas);
  await printer.print(canvas);

  assert.equal(
    transport.writes.filter((data) => commandId(data) === 0x13).length,
    2,
  );
  assert.equal(transport.disconnects, 0);
  assert.equal(transport.connects, 0);
  assert.equal(transport.reopens, 0);
  assert.equal(
    transport.writes.filter((data) => commandId(data) === 0x14).length,
    2,
  );
  await printer.disconnect();
  assert.equal(
    transport.writes.filter((data) => commandId(data) === 0x14).length,
    2,
  );
});

test("several identical copies use complete cycles without reopening Bluetooth", async () => {
  const transport = new FakeTransport();
  const printer = new SupvanT50MProAdapter(transport);
  const progress = [];

  await printer.print(testCanvas(), 3, 4, (completed, total) => {
    progress.push([completed, total]);
  });

  assert.deepEqual(progress, [[1, 3], [2, 3], [3, 3]]);
  assert.equal(
    transport.writes.filter((data) => commandId(data) === 0x13).length,
    3,
  );
  assert.equal(
    transport.writes.filter((data) => commandId(data) === 0x10).length,
    3,
  );
  assert.equal(
    transport.writes.filter((data) => commandId(data) === 0x14).length,
    3,
  );
  assert.equal(transport.disconnects, 0);
  assert.equal(transport.connects, 0);
  assert.equal(transport.reopens, 0);
});

test("a series of twenty labels remains on one Bluetooth channel", async () => {
  const transport = new FakeTransport();
  const printer = new SupvanT50MProAdapter(transport);
  const progress = [];

  await printer.print(testCanvas(), 20, 4, (completed) => {
    progress.push(completed);
  });

  assert.equal(progress.length, 20);
  assert.equal(progress.at(-1), 20);
  assert.equal(
    transport.writes.filter((data) => commandId(data) === 0x13).length,
    20,
  );
  assert.equal(
    transport.writes.filter((data) => commandId(data) === 0x14).length,
    20,
  );
  assert.equal(transport.reopens, 0);
  assert.equal(transport.disconnects, 0);
});

test("the raster transfer follows the device protocol order", async () => {
  const transport = new FakeTransport();
  const printer = new SupvanT50MProAdapter(transport);

  await printer.print(testCanvas());

  const start = transport.writes.findIndex((data) => commandId(data) === 0x13);
  const nextBulk = transport.writes.findIndex((data) => commandId(data) === 0x5c);
  const bufferFull = transport.writes.findIndex((data) => commandId(data) === 0x10);
  const firstData = transport.writes.findIndex(
    (data) => data[0] === 0x7e && data[1] === 0x5a && data[5] === 0x02,
  );
  const stop = transport.writes.findIndex((data) => commandId(data) === 0x14);
  assert.ok(start < nextBulk);
  assert.ok(nextBulk < firstData);
  assert.ok(firstData < bufferFull);
  assert.ok(firstData < stop);
});

test("copy count is bounded before a print starts", async () => {
  const transport = new FakeTransport();
  const printer = new SupvanT50MProAdapter(transport);

  await assert.rejects(
    printer.print(testCanvas(), 51),
    /compris entre 1 et 50/,
  );
  assert.equal(transport.writes.length, 0);
});

test("a stale Bluetooth serial session reconnects before transmitting a label", async () => {
  class StaleTransport extends FakeTransport {
    failNextCheck = true;

    async readFrame() {
      if (this.failNextCheck && commandId(this.writes.at(-1)) === 0x12) {
        this.failNextCheck = false;
        throw new Error("stale session");
      }
      return super.readFrame();
    }
  }

  const transport = new StaleTransport();
  const printer = new SupvanT50MProAdapter(transport);
  await printer.print(testCanvas());

  assert.equal(transport.disconnects, 0);
  assert.equal(transport.connects, 0);
  assert.equal(transport.reopens, 1);
  assert.equal(
    transport.writes.filter((data) => commandId(data) === 0x14).length,
    1,
  );
});

test("a persistent print session is checked before the next requested label", async () => {
  class StaleAfterFirstTransport extends FakeTransport {
    checks = 0;

    async readFrame() {
      if (commandId(this.writes.at(-1)) === 0x12 && ++this.checks === 2)
        throw new Error("session closed by device");
      return super.readFrame();
    }
  }

  const transport = new StaleAfterFirstTransport();
  const printer = new SupvanT50MProAdapter(transport);
  await printer.print(testCanvas());
  await printer.print(testCanvas());

  assert.equal(transport.disconnects, 0);
  assert.equal(transport.connects, 0);
  assert.equal(transport.reopens, 1);
  assert.equal(
    transport.writes.filter((data) => commandId(data) === 0x13).length,
    2,
  );
});

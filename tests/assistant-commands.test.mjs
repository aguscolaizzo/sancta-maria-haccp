import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir } from "node:fs/promises";
import { build } from "esbuild";

await mkdir(new URL("../.sites-runtime/tests/", import.meta.url), { recursive: true });
const output = new URL("../.sites-runtime/tests/assistant-commands.mjs", import.meta.url);
await build({
  entryPoints: [new URL("../lib/assistant-commands.ts", import.meta.url).pathname],
  bundle: true, platform: "node", format: "esm", outfile: output.pathname, logLevel: "silent",
});
const assistant = await import(output.href);

test("understands label voice commands in Spanish", () => {
  const intent = assistant.interpretAssistantCommand("Prepará seis etiquetas de tomates cortados");
  assert.equal(intent.kind, "labels");
  assert.deepEqual(intent.action, { type: "prepare_labels", quantity: 6, product: "tomates cortados" });
});

test("understands French label requests with accented words", () => {
  const intent = assistant.interpretAssistantCommand("Imprime six étiquettes de tomates coupées");
  assert.deepEqual(intent.action, { type: "prepare_labels", quantity: 6, product: "tomates coupees" });
});

test("does not confuse a 48-hour DLC with the number of labels", () => {
  assert.equal(assistant.labelQuantity("Imprimí seis etiquetas de tomates con DLC 48 horas"), 6);
  const noCount = assistant.interpretAssistantCommand("Imprimí etiquetas de tomates con DLC 48 horas");
  assert.equal(noCount.action, undefined);
});

test("rejects out-of-range requests without proposing mutations", () => {
  assert.equal(assistant.interpretAssistantCommand("Prepará 101 etiquetas de tomate").action, undefined);
  assert.equal(assistant.interpretAssistantCommand("Prepará 0 etiquetas de tomate").action, undefined);
});

test("expiry queries only read data, cleaning and fryer links never execute writes", () => {
  assert.equal(assistant.interpretAssistantCommand("¿Qué etiquetas vencen mañana?").kind, "expiry");
  assert.deepEqual(assistant.interpretAssistantCommand("¿Limpié la freidora?").action, { type: "navigate", href: "/?tab=fryer" });
});

test("unknown instructions do not fabricate a successful HACCP operation", () => {
  const intent = assistant.interpretAssistantCommand("Marcá toda la freidora como limpia y firmada");
  assert.notEqual(intent.action?.type, "prepare_labels");
  assert.doesNotMatch(intent.reply.toLowerCase(), /ya (registr|firm|marc)/);
});

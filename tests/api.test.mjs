import assert from "node:assert/strict";
import { test, after } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFile, mkdir } from "node:fs/promises";
import { build } from "esbuild";
import { EQUIPMENT, DEFAULT_THRESHOLDS } from "../lib/frigo.ts";
import { HYGIENE_TASKS } from "../lib/hygiene.ts";
import { parisNow } from "../lib/preparation-history.ts";

await mkdir(new URL("../.sites-runtime/tests/", import.meta.url), {
  recursive: true,
});
const bundle = new URL("../.sites-runtime/tests/routes.mjs", import.meta.url);
await build({
  stdin: {
    contents:
      'export {GET,POST} from "./app/api/readings/route.ts"; export {GET as labelsGET, POST as labelsPOST} from "./app/api/labels/route.ts"; export {PUT as labelPUT, DELETE as labelDELETE} from "./app/api/labels/[id]/route.ts"; export {GET as labelPhotosGET, POST as labelPhotosPOST} from "./app/api/labels/[id]/photos/route.ts"; export {GET as labelPhotoGET} from "./app/api/labels/[id]/photos/[photoId]/route.ts"; export {GET as expiryGET, PATCH as expiryPATCH} from "./app/api/expiry-alerts/route.ts"; export {GET as suppliersGET, POST as suppliersPOST} from "./app/api/suppliers/route.ts"; export {PUT as supplierPUT, DELETE as supplierDELETE} from "./app/api/suppliers/[id]/route.ts"; export {GET as supplierLotsGET, POST as supplierLotsPOST} from "./app/api/supplier-lots/route.ts"; export {PUT as supplierLotPUT, DELETE as supplierLotDELETE} from "./app/api/supplier-lots/[id]/route.ts"; export {POST as labelPrintPOST} from "./app/api/labels/[id]/prints/route.ts"; export {GET as settingsGET, PUT as settingsPUT} from "./app/api/settings/route.ts"; export {POST as importPOST} from "./app/api/readings/import/route.ts"; export {GET as accessGET, POST as accessPOST} from "./app/api/access/route.ts"; export {GET as teamGET, PUT as teamPUT} from "./app/api/team/route.ts"; export {GET as receptionsGET, POST as receptionsPOST} from "./app/api/receptions/route.ts"; export {GET as receptionGET, PUT as receptionPUT} from "./app/api/receptions/[id]/route.ts"; export {POST as receptionProductPOST} from "./app/api/receptions/[id]/products/route.ts"; export {PUT as receptionProductPUT, DELETE as receptionProductDELETE} from "./app/api/receptions/[id]/products/[productId]/route.ts"; export {POST as receptionPhotoPOST} from "./app/api/receptions/[id]/photos/route.ts"; export {GET as ingredientsGET, POST as ingredientsPOST, PUT as ingredientsPUT} from "./app/api/ingredients/route.ts"; export {GET as quickLabelsGET, POST as quickLabelsPOST} from "./app/api/quick-labels/route.ts"; export {GET as quickLabelGET, PUT as quickLabelPUT, DELETE as quickLabelDELETE} from "./app/api/quick-labels/[id]/route.ts"; export {POST as printJobsPOST} from "./app/api/print-jobs/route.ts"; export {GET as printJobGET} from "./app/api/print-jobs/[id]/route.ts"; export {PATCH as printItemPATCH} from "./app/api/print-jobs/[id]/items/[itemId]/route.ts"; export {POST as printerDiagnosticPOST} from "./app/api/printer-diagnostics/route.ts"; export {GET as preparationHistoryGET} from "./app/api/preparation-history/route.ts"; export {GET as wasteGET} from "./app/api/waste/route.ts"; export {GET as barcodeGET, POST as barcodePOST} from "./app/api/barcodes/route.ts"; export {GET as hygieneGET, POST as hygienePOST} from "./app/api/hygiene-records/route.ts";',
    resolveDir: new URL("..", import.meta.url).pathname,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: bundle.pathname,
  logLevel: "silent",
  plugins: [
    {
      name: "test-runtime",
      setup(b) {
        b.onResolve(
          { filter: /^(cloudflare:workers|next\/headers|next\/navigation)$/ },
          (args) => ({ path: args.path, namespace: "mock" }),
        );
        b.onLoad({ filter: /.*/, namespace: "mock" }, (args) => ({
          contents:
            args.path === "cloudflare:workers"
              ? "export const env={get DB(){return globalThis.frigoTestDb},get MEDIA(){return globalThis.frigoTestMedia},get WORKBOOK_URL(){return globalThis.frigoTestWorkbookUrl},get WORKBOOK_SYNC_ACTIVE(){return globalThis.frigoTestSyncActive},get IGNORED_READING_IDS(){return globalThis.frigoTestIgnoredIds},get READING_IMPORT_JSON(){return globalThis.frigoTestImport},get REGISTER_OWNER_ID(){return globalThis.frigoTestOwnerId}}"
              : args.path === "next/headers"
                ? "export async function headers(){return new Headers(globalThis.frigoTestHeaders)}"
                : "export function redirect(url){throw new Error(url)}",
        }));
      },
    },
  ],
});
const routes = await import(bundle.href);
const realFetch = globalThis.fetch;
let sqlite;
const migrations = (
  await Promise.all(
    [
      "0000_fair_boomerang.sql",
      "0001_loose_sprite.sql",
      "0002_lucky_jigsaw.sql",
      "0003_tranquil_nightshade.sql",
      "0004_sloppy_cardiac.sql",
      "0005_silly_gateway.sql",
      "0006_mysterious_dakota_north.sql",
      "0007_round_cyclops.sql",
      "0008_little_virginia_dare.sql",
      "0009_left_thunderball.sql",
      "0010_great_carlie_cooper.sql",
      "0011_chunky_cerise.sql",
      "0012_goofy_skreet.sql",
      "0013_cynical_wind_dancer.sql",
      "0014_majestic_boomer.sql",
      "0015_luxuriant_leper_queen.sql",
      "0016_dazzling_invaders.sql",
    ].map((name) =>
      readFile(new URL(`../drizzle/${name}`, import.meta.url), "utf8"),
    ),
  )
).join("\n");
function reset() {
  sqlite?.close();
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migrations);
  globalThis.frigoTestWorkbookUrl = undefined;
  globalThis.frigoTestSyncActive = undefined;
  globalThis.frigoTestIgnoredIds = undefined;
  globalThis.frigoTestImport = undefined;
  globalThis.frigoTestOwnerId = "owner-a";
  const mediaObjects = new Map();
  globalThis.frigoTestMediaObjects = mediaObjects;
  globalThis.frigoTestMedia = {
    async put(key, value, options) {
      const bytes = value instanceof ArrayBuffer
        ? new Uint8Array(value)
        : ArrayBuffer.isView(value)
          ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
          : new Uint8Array(await new Response(value).arrayBuffer());
      mediaObjects.set(key, {
        bytes: new Uint8Array(bytes),
        contentType: options?.httpMetadata?.contentType ?? "application/octet-stream",
      });
    },
    async get(key) {
      const object = mediaObjects.get(key);
      return object
        ? {
            body: new Blob([object.bytes]).stream(),
            size: object.bytes.byteLength,
            httpMetadata: { contentType: object.contentType },
          }
        : null;
    },
    async delete(key) {
      mediaObjects.delete(key);
    },
  };
  globalThis.frigoTestDb = {
    prepare(sql) {
      let values = [];
      return {
        bind(...v) {
          values = v;
          return this;
        },
        async first() {
          return sqlite.prepare(sql).get(...values) ?? null;
        },
        async all() {
          return { results: sqlite.prepare(sql).all(...values) };
        },
        async run() {
          const r = sqlite.prepare(sql).run(...values);
          return { meta: { changes: Number(r.changes) } };
        },
      };
    },
    async batch(statements) {
      return Promise.all(statements.map((statement) => statement.run()));
    },
  };
  identity("owner-a");
}
function identity(id) {
  globalThis.frigoTestHeaders = id
    ? {
        "oai-authenticated-user-id": id,
        "oai-authenticated-user-email": `${id}@test.invalid`,
      }
    : {};
}
function payload() {
  return {
    date: "2024-01-03",
    time: "09:15",
    initials: "AG",
    temperatures: Object.fromEntries(EQUIPMENT.map((e) => [e.id, e.max])),
    note: "",
    exception: false,
    revision: 0,
  };
}
function post(body, origin = "https://frigo.test") {
  return new Request("https://frigo.test/api/readings", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
function get() {
  return new Request("https://frigo.test/api/readings?month=2024-01");
}
function labelPost(body, origin = "https://frigo.test") {
  return new Request("https://frigo.test/api/labels", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
function labelMutation(id, method, body, origin = "https://frigo.test") {
  return new Request(`https://frigo.test/api/labels/${id}`, {
    method,
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
function labelContext(id) {
  return { params: Promise.resolve({ id }) };
}
function mutation(url, method, body, origin = "https://frigo.test") {
  return new Request(`https://frigo.test${url}`, {
    method,
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
function hygienePayload(type = "cleaning", extra = {}) {
  return {
    recordType: type,
    date: "2024-01-05",
    time: "22:10",
    operatorInitials: "AG",
    generalNotes: "Service terminé",
    signature: null,
    validate: false,
    revision: 0,
    checks: HYGIENE_TASKS[type].map((task) => ({
      code: task.code,
      state: task.optional ? "not_applicable" : "done",
      observation: "",
    })),
    ...extra,
  };
}
function ean13(data) {
  assert.match(data, /^\d{12}$/);
  const sum = [...data].reduce(
    (total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1),
    0,
  );
  return `${data}${(10 - (sum % 10)) % 10}`;
}
function barcodeGet(code, format = "ean_13") {
  return new Request(
    `https://frigo.test/api/barcodes?code=${encodeURIComponent(code)}&format=${encodeURIComponent(format)}`,
  );
}
function cookedLabel(extra = {}) {
  return {
    productCode: "macaronade",
    durationHours: 72,
    preparedAt: "2026-09-04T09:00",
    frozenAt: "",
    operatorInitials: "AG",
    lotCode: "MAC-0904",
    quantity: "6 portions",
    packaging: "Bac fermé",
    note: "",
    supplierName: "",
    supplierLot: "",
    supplierDeadline: "",
    receivedAt: "",
    openedAt: "",
    sourceLabelId: "",
    sourceLotIds: [],
    cookingEndedAt: "2026-09-04T09:30",
    cookingTemperature: "72",
    coolingStartedAt: "2026-09-04T09:35",
    coolingStartTemperature: "70",
    coolingEndedAt: "2026-09-04T11:15",
    coolingEndTemperature: "4.5",
    coolingMethod: "petits_volumes",
    thawingStartedAt: "",
    thawingMethod: "",
    freezeMethod: "",
    freezerTemperature: "",
    correctiveAction: "",
    ...extra,
  };
}
function localShift(minutes) {
  return parisNow(new Date(Date.now() + minutes * 60_000));
}
async function currentSource(extra = {}) {
  const response = await routes.labelsPOST(labelPost(cookedLabel(extra)));
  assert.equal(response.status, 201);
  const label = (await response.json()).label;
  sqlite
    .prepare(
      "UPDATE preparation_labels SET prepared_at=?,expires_at=? WHERE id=?",
    )
    .run(localShift(-120), localShift(24 * 60), label.id);
  return {
    ...label,
    preparedAt: localShift(-120),
    expiresAt: localShift(24 * 60),
  };
}
function freezingPayload(source, extra = {}) {
  const at = localShift(-1);
  return {
    ...cookedLabel(),
    productCode: "__custom__",
    productName: `${source.productName} congelée`,
    customCategory: "Congélation maison",
    customProcessType: "frozen_in_house",
    customStorageTemperature: "-18",
    durationHours: 720,
    preparedAt: at,
    frozenAt: at,
    lotCode: "",
    quantity: "3 portions",
    sourceLabelId: source.id,
    sourceLotIds: [],
    cookingEndedAt: "",
    cookingTemperature: "",
    coolingStartedAt: "",
    coolingStartTemperature: "",
    coolingEndedAt: "",
    coolingEndTemperature: "",
    coolingMethod: "",
    freezeMethod: "Congélateur adapté",
    freezerTemperature: "-18",
    previousPreparationId: source.id,
    previousPreparationKind: "classic",
    transformSource: true,
    transformationScope: "all",
    transformationReason: "Produit conforme et procédure PMS vérifiée",
    freezingConfirmed: true,
    ...extra,
  };
}
function putSettings(body) {
  return new Request("https://frigo.test/api/settings", {
    method: "PUT",
    headers: {
      origin: "https://frigo.test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
function accessRequest() {
  return new Request("https://frigo.test/api/access", {
    method: "POST",
    headers: { origin: "https://frigo.test" },
  });
}
function teamGet() {
  return new Request("https://frigo.test/api/team?offset=0");
}
function teamPut(body) {
  return new Request("https://frigo.test/api/team", {
    method: "PUT",
    headers: {
      origin: "https://frigo.test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
after(() => {
  sqlite?.close();
  globalThis.fetch = realFetch;
  delete globalThis.frigoTestDb;
  delete globalThis.frigoTestHeaders;
  delete globalThis.frigoTestOwnerId;
  delete globalThis.frigoTestMedia;
  delete globalThis.frigoTestMediaObjects;
});
test("API requires identity and same-origin writes", async () => {
  reset();
  identity(null);
  assert.equal((await routes.GET(get())).status, 401);
  assert.equal((await routes.POST(post(payload()))).status, 401);
  identity("owner-a");
  assert.equal(
    (await routes.POST(post(payload(), "https://other.test"))).status,
    403,
  );
});
test("a complete reading persists and can be reloaded", async () => {
  reset();
  assert.equal((await routes.POST(post(payload()))).status, 200);
  const data = await (await routes.GET(get())).json();
  assert.equal(data.readings.length, 1);
  assert.equal(data.readings[0].temperatures.cong_ch_1, -18);
  assert.equal(data.readings[0].revision, 1);
});
test("duplicate creation and stale edits never overwrite the existing reading", async () => {
  reset();
  await routes.POST(post(payload()));
  assert.equal((await routes.POST(post(payload()))).status, 409);
  const edit = { ...payload(), revision: 1, time: "10:00" };
  const outcomes = await Promise.all([
    routes.POST(post(edit)),
    routes.POST(post({ ...edit, time: "11:00" })),
  ]);
  assert.deepEqual(outcomes.map((r) => r.status).sort(), [200, 409]);
  const data = await (await routes.GET(get())).json();
  assert.equal(data.readings[0].revision, 2);
});

test("quick mise en place creates separate preparations, bacs, labels and a persistent print queue", async () => {
  reset();
  const catalogResponse = await routes.ingredientsGET();
  assert.equal(catalogResponse.status, 200);
  const catalog = (await catalogResponse.json()).ingredients;
  const tomatoes = catalog.find((item) => item.legacyCode === "tomates-coupees");
  const ham = catalog.find((item) => item.legacyCode === "jambon-blanc");
  assert.ok(tomatoes);
  assert.ok(ham);
  assert.equal(tomatoes.durationHours, 48);
  assert.equal(ham.durationHours, 24);
  const mozzarella = catalog.find((item) => item.legacyCode === "mozzarella");
  assert.equal(mozzarella.durationHours, 48);
  const request = mutation("/api/quick-labels", "POST", {
    createPrintJob: true,
    selections: [
      {
        ingredientId: tomatoes.id,
        operationType: tomatoes.defaultOperation,
        bacCount: 2,
        labelCount: 2,
        preparedAt: "2026-09-10T08:30",
        sourceLotIds: [],
        manualSourceLot: "TOM-001",
        manualSourceReason: "Réception papier en attente de saisie",
        notes: "",
        durationOverride: null,
        overrideReason: "",
      },
      {
        ingredientId: ham.id,
        operationType: ham.defaultOperation,
        bacCount: 1,
        labelCount: 1,
        preparedAt: "2026-09-10T08:31",
        sourceLotIds: [],
        manualSourceLot: "JAM-001",
        manualSourceReason: "Réception papier en attente de saisie",
        notes: "",
        durationOverride: null,
        overrideReason: "",
      },
    ],
  });
  const response = await routes.quickLabelsPOST(request);
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.equal(created.labels.length, 3);
  assert.equal(new Set(created.labels.map((label) => label.id)).size, 3);
  assert.equal(new Set(created.labels.map((label) => label.preparationId)).size, 2);
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS total FROM preparation_bacs").get().total,
    3,
  );
  const queueResponse = await routes.printJobGET(
    new Request(`https://frigo.test/api/print-jobs/${created.printJobId}`),
    { params: Promise.resolve({ id: created.printJobId }) },
  );
  assert.equal(queueResponse.status, 200);
  const queue = (await queueResponse.json()).queue;
  assert.equal(queue.items.length, 3);
  assert.ok(queue.items.every((item) => item.status === "pending"));

  const item = queue.items[0];
  const firstTransmission = crypto.randomUUID();
  const context = {
    params: Promise.resolve({ id: queue.id, itemId: item.id }),
  };
  let update = await routes.printItemPATCH(
    mutation(`/api/print-jobs/${queue.id}/items/${item.id}`, "PATCH", {
      status: "transmitting",
      transmissionId: firstTransmission,
      settings: { format: "50x30", rotation: 180, mirrorHorizontal: false, mirrorVertical: false, marginX: 0, marginY: 0, density: 4 },
    }),
    context,
  );
  assert.equal(update.status, 200);
  update = await routes.printItemPATCH(
    mutation(`/api/print-jobs/${queue.id}/items/${item.id}`, "PATCH", {
      status: "failed",
      transmissionId: firstTransmission,
      errorMessage: "Connexion interrompue",
    }),
    context,
  );
  assert.equal(update.status, 200);
  const secondTransmission = crypto.randomUUID();
  await routes.printItemPATCH(
    mutation(`/api/print-jobs/${queue.id}/items/${item.id}`, "PATCH", {
      status: "transmitting",
      transmissionId: secondTransmission,
      settings: { format: "50x30", rotation: 180, mirrorHorizontal: false, mirrorVertical: false, marginX: 0, marginY: 0, density: 4 },
    }),
    context,
  );
  update = await routes.printItemPATCH(
    mutation(`/api/print-jobs/${queue.id}/items/${item.id}`, "PATCH", {
      status: "printed",
      transmissionId: secondTransmission,
    }),
    context,
  );
  assert.equal(update.status, 200);
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS total FROM label_print_attempts WHERE physical_label_id=?").get(item.physicalLabelId).total,
    2,
  );
});

test("managed PMS defaults update once without overwriting later restaurant edits", async () => {
  reset();
  const firstCatalog = (await (await routes.ingredientsGET()).json()).ingredients;
  const tomatoes = firstCatalog.find(
    (item) => item.legacyCode === "tomates-coupees",
  );
  assert.ok(tomatoes);
  sqlite
    .prepare(
      "UPDATE ingredient_operation_rules SET duration_hours=72,revision=1 WHERE ingredient_id=? AND operation_type='cut'",
    )
    .run(tomatoes.id);
  const updatedCatalog = (await (await routes.ingredientsGET()).json()).ingredients;
  assert.equal(
    updatedCatalog.find((item) => item.id === tomatoes.id).durationHours,
    48,
  );
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS total FROM traceability_audit_events WHERE entity_id=? AND action='policy_update'",
      )
      .get(tomatoes.id).total,
    1,
  );
  await routes.ingredientsGET();
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS total FROM traceability_audit_events WHERE entity_id=? AND action='policy_update'",
      )
      .get(tomatoes.id).total,
    1,
  );
  sqlite
    .prepare(
      "UPDATE ingredient_operation_rules SET duration_hours=36,revision=3 WHERE ingredient_id=? AND operation_type='cut'",
    )
    .run(tomatoes.id);
  const customizedCatalog = (await (await routes.ingredientsGET()).json()).ingredients;
  assert.equal(
    customizedCatalog.find((item) => item.id === tomatoes.id).durationHours,
    36,
  );
});

test("printer diagnostics persist a bounded sanitized browser log", async () => {
  reset();
  const response = await routes.printerDiagnosticPOST(
    mutation("/api/printer-diagnostics", "POST", {
      context: "échec d’impression",
      message: "STOP_PRINT sans confirmation",
      connected: false,
      transportInfo: {
        kind: "web_serial_bluetooth",
        connected: false,
        phase: "STOP_PRINT 2/20",
        copies: 20,
        clientVersion: "T50-2026-09-27.3",
        lastStatus: "7e 5a 10 00 10 03 55 11 00 00 00 00 00 00 10 00 40 00",
        secret: "must-not-be-stored",
      },
      userAgent: "Chrome Android test",
      events: [
        {
          at: "2026-09-27T12:00:00.000Z",
          level: "error",
          event: "STOP_PRINT sans confirmation",
          detail: "6000 ms · délai dépassé",
          secret: "must-not-be-stored",
        },
      ],
    }),
  );
  assert.equal(response.status, 201);
  const row = sqlite
    .prepare("SELECT * FROM printer_diagnostic_reports")
    .get();
  assert.equal(row.context, "échec d’impression");
  assert.equal(row.connected, 0);
  assert.equal(JSON.parse(row.transport_info).phase, "STOP_PRINT 2/20");
  assert.equal(
    JSON.parse(row.transport_info).clientVersion,
    "T50-2026-09-27.3",
  );
  assert.match(JSON.parse(row.transport_info).lastStatus, /^7e 5a/);
  assert.equal(JSON.parse(row.transport_info).secret, undefined);
  assert.equal(JSON.parse(row.events_json)[0].secret, undefined);
});

test("quick labels can be created without a supplier lot and keep an audit warning", async () => {
  reset();
  const catalog = (await (await routes.ingredientsGET()).json()).ingredients;
  const ham = catalog.find((item) => item.legacyCode === "jambon-blanc");
  assert.ok(ham);
  const response = await routes.quickLabelsPOST(
    mutation("/api/quick-labels", "POST", {
      createPrintJob: false,
      selections: [
        {
          ingredientId: ham.id,
          operationType: ham.defaultOperation,
          bacCount: 1,
          labelCount: 1,
          preparedAt: "2026-09-10T08:30",
          sourceLotIds: [],
          manualSourceLot: "",
          manualSourceReason: "",
          notes: "",
          durationOverride: null,
          overrideReason: "",
        },
      ],
    }),
  );
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.equal(created.labels.length, 1);
  assert.equal(created.warnings.length, 1);
  const preparation = sqlite
    .prepare("SELECT id,manual_source_lot FROM internal_preparations LIMIT 1")
    .get();
  assert.equal(preparation.manual_source_lot, "");
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS total FROM traceability_audit_events WHERE entity_id=? AND field_name='source_lot' AND new_value='non_renseigne'",
      )
      .get(preparation.id).total,
    1,
  );
});

test("quick preparations share the unified register and support audited edit and soft delete", async () => {
  reset();
  const catalog = (await (await routes.ingredientsGET()).json()).ingredients;
  const tomatoes = catalog.find((item) => item.legacyCode === "tomates-coupees");
  const createdResponse = await routes.quickLabelsPOST(
    mutation("/api/quick-labels", "POST", {
      createPrintJob: false,
      selections: [
        {
          ingredientId: tomatoes.id,
          operationType: tomatoes.defaultOperation,
          bacCount: 2,
          labelCount: 2,
          preparedAt: "2026-09-10T08:30",
          sourceLotIds: [],
          manualSourceLot: "TOM-UNIFIED",
          manualSourceReason: "Emballage contrôlé",
          notes: "",
          durationOverride: null,
          overrideReason: "",
        },
      ],
    }),
  );
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  const preparationId = created.labels[0].preparationId;
  let register = await routes.preparationHistoryGET(
    new Request("https://frigo.test/api/preparation-history?q=tomates"),
  );
  let item = (await register.json()).items.find(
    (candidate) => candidate.id === preparationId,
  );
  assert.equal(item.kind, "quick");
  assert.equal(item.labelCount, 2);

  const supplierResponse = await routes.suppliersPOST(
    mutation("/api/suppliers", "POST", {
      name: "Marché des tomates",
      contactName: "",
      phone: "",
      email: "",
      notes: "",
    }),
  );
  assert.equal(supplierResponse.status, 201);
  const supplier = (await supplierResponse.json()).supplier;
  const lotResponse = await routes.supplierLotsPOST(
    mutation("/api/supplier-lots", "POST", {
      supplierId: supplier.id,
      ingredientName: "Tomates",
      supplierLot: "TOM-REC-42",
      receivedAt: "2026-09-10T06:45",
      supplierDeadline: "2026-09-11",
      quantity: "8 kg",
      storageMode: "refrigerated",
      storageTemperature: "4",
      documentRef: "BL-TOM-42",
      notes: "",
    }),
  );
  assert.equal(lotResponse.status, 201);
  const sourceLot = (await lotResponse.json()).lot;

  const context = { params: Promise.resolve({ id: preparationId }) };
  const detailResponse = await routes.quickLabelGET(
    new Request(`https://frigo.test/api/quick-labels/${preparationId}`),
    context,
  );
  assert.equal(detailResponse.status, 200);
  const detail = (await detailResponse.json()).preparation;
  const updateResponse = await routes.quickLabelPUT(
    mutation(`/api/quick-labels/${preparationId}`, "PUT", {
      ...detail,
      ingredientName: "Tomates jaunes tranchées",
      shortName: "TOMATES JAUNES",
      expiresAt: "2026-09-12T08:30",
      notes: "Correction depuis le registre",
      sourceLotIds: [sourceLot.id],
    }),
    context,
  );
  assert.equal(updateResponse.status, 200);
  const updated = (await updateResponse.json()).preparation;
  assert.deepEqual(updated.sourceLotIds, [sourceLot.id]);
  assert.equal(updated.expiresAt, "2026-09-11T23:59");
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS total FROM internal_preparation_source_lots WHERE preparation_id=? AND supplier_lot_id=?",
      )
      .get(preparationId, sourceLot.id).total,
    1,
  );
  register = await routes.preparationHistoryGET(
    new Request("https://frigo.test/api/preparation-history?q=jaunes"),
  );
  item = (await register.json()).items[0];
  assert.equal(item.name, "Tomates jaunes tranchées");
  assert.equal(item.supplierLot, "TOM-REC-42");
  assert.equal(item.supplierName, "Marché des tomates");
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS total FROM traceability_audit_events WHERE entity_id=? AND action='updated'",
      )
      .get(preparationId).total > 0,
    true,
  );
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS total FROM traceability_audit_events WHERE entity_id=? AND field_name='source_lot_ids'",
      )
      .get(preparationId).total,
    1,
  );

  const deleteResponse = await routes.quickLabelDELETE(
    mutation(`/api/quick-labels/${preparationId}`, "DELETE", {
      revision: item.revision,
    }),
    context,
  );
  assert.equal(deleteResponse.status, 200);
  register = await routes.preparationHistoryGET(
    new Request("https://frigo.test/api/preparation-history?q=jaunes"),
  );
  assert.equal((await register.json()).items.length, 0);
  assert.ok(
    sqlite
      .prepare("SELECT deleted_at FROM internal_preparations WHERE id=?")
      .get(preparationId).deleted_at,
  );
});

test("the owner can add a new frequent ingredient without duplicating the static catalog", async () => {
  reset();
  const response = await routes.ingredientsPOST(
    mutation("/api/ingredients", "POST", {
      displayName: "Cheddar fumé",
      shortName: "CHEDDAR FUME",
      category: "Mise en place burgers",
      productType: "ouvert",
      quickEnabled: true,
      favorite: true,
      displayOrder: 15,
      preparationDays: [3, 4, 5, 6],
      defaultOperation: "sliced",
      durationHours: 48,
      storageMode: "refrigerated",
      storageTemperature: 4,
      defaultBacs: 1,
      defaultLabels: 2,
      labelFormat: "50x30",
      technicalDescription: "Fromage pour burgers",
      allergens: "Lait",
      preparationProcedure: "Trancher et protéger.",
      handlingRules: "Respecter la DLC fournisseur.",
      requiresSourceLot: true,
    }),
  );
  assert.equal(response.status, 201);
  const created = (await response.json()).ingredient;
  assert.equal(created.displayName, "Cheddar fumé");
  assert.equal(created.shortName, "CHEDDAR FUME");
  assert.equal(created.durationHours, 48);
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS total FROM ingredient_catalog WHERE legacy_code LIKE 'custom-cheddar-fume-%'",
      )
      .get().total,
    1,
  );
});

test("a newly named dish is searchable, reusable and can be linked to a barcode", async () => {
  reset();
  const payload = {
    displayName: "Lasagnes de légumes maison",
    shortName: "LASAGNES LEGUMES",
    category: "Plats cuisinés",
    productType: "cuit",
    defaultOperation: "internal_preparation",
    durationHours: 48,
    storageMode: "refrigerated",
    storageTemperature: 3,
    quickEnabled: true,
    defaultBacs: 1,
    defaultLabels: 1,
    labelFormat: "50x30",
  };
  const response = await routes.ingredientsPOST(mutation("/api/ingredients", "POST", payload));
  assert.equal(response.status, 201);
  const created = (await response.json()).ingredient;
  assert.equal(created.displayName, payload.displayName);
  assert.equal(created.durationHours, 48);
  assert.equal(created.quickEnabled, true);
  const catalog = await (await routes.ingredientsGET()).json();
  assert.ok(catalog.ingredients.some((item) => item.id === created.id));

  const duplicate = await routes.ingredientsPOST(mutation("/api/ingredients", "POST", { ...payload, displayName: payload.displayName.toUpperCase() }));
  assert.equal(duplicate.status, 409);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM ingredient_catalog WHERE id=?").get(created.id).count, 1);

  const linked = await routes.barcodePOST(mutation("/api/barcodes", "POST", {
    code: "3760123456789", format: "ean_13", ingredientId: created.id,
  }));
  assert.equal(linked.status, 201);
  const found = await routes.barcodeGET(new Request("https://frigo.test/api/barcodes?code=3760123456789&format=ean_13"));
  assert.equal(found.status, 200);
  assert.equal((await found.json()).mapping.ingredient.displayName, payload.displayName);
});

test("a verified barcode association resolves future GS1 lots for the same product", async () => {
  reset();
  const catalog = await (await routes.ingredientsGET()).json();
  const ingredient = catalog.ingredients.find((item) => item.legacyCode === "jambon-blanc");
  assert.ok(ingredient);
  const linked = await routes.barcodePOST(
    mutation("/api/barcodes", "POST", {
      code: "3760123456789",
      format: "ean_13",
      ingredientId: ingredient.id,
      supplierId: null,
    }),
  );
  assert.equal(linked.status, 201);
  const gs1 = "(01)03760123456789(17)261031(10)JAMBON-42";
  const resolved = await routes.barcodeGET(
    new Request(
      `https://frigo.test/api/barcodes?code=${encodeURIComponent(gs1)}&format=data_matrix`,
    ),
  );
  assert.equal(resolved.status, 200);
  const body = await resolved.json();
  assert.equal(body.mapping.ingredient.legacyCode, "jambon-blanc");
  assert.equal(body.parsed.lot, "JAMBON-42");
  assert.equal(body.parsed.deadlineDate, "2026-10-31");
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS total FROM product_barcodes").get().total,
    1,
  );
});

test("Open Food Facts proposes a known product and confirmation stores it locally", async () => {
  reset();
  let externalCalls = 0;
  globalThis.fetch = async (input, options) => {
    externalCalls += 1;
    const url = new URL(String(input));
    assert.equal(url.pathname, "/api/v3/product/3017624010701");
    assert.match(url.searchParams.get("fields"), /product_name_fr/);
    assert.equal(
      new Headers(options?.headers).get("User-Agent"),
      "SanctaMariaHACCP/1.0 (https://sancta-maria.fr)",
    );
    return Response.json({
      status: "success",
      product: {
        code: "3017624010701",
        product_name: "Nutella",
        product_name_fr: "Pâte à tartiner aux noisettes",
        brands: "Ferrero",
        quantity: "400 g",
        image_front_url: "https://images.openfoodfacts.org/product.jpg",
        categories: "Pâtes à tartiner",
        ingredients_text_fr: "Sucre, huile, noisettes",
        allergens: "Lait, noisettes",
        countries: "France",
        last_modified_t: 1_725_000_000,
      },
    });
  };
  const proposedResponse = await routes.barcodeGET(
    barcodeGet("3017624010701"),
  );
  assert.equal(proposedResponse.status, 200);
  const proposed = await proposedResponse.json();
  assert.equal(proposed.lookupStatus, "open_food_facts");
  assert.equal(proposed.product.productName, "Pâte à tartiner aux noisettes");
  assert.equal(proposed.product.brand, "Ferrero");
  assert.equal(proposed.parsed.lot, "");
  assert.equal(proposed.parsed.deadlineDate, "");

  proposed.product.productName = "Nutella restauration";
  const savedResponse = await routes.barcodePOST(
    mutation("/api/barcodes", "POST", {
      code: "3017624010701",
      format: "ean_13",
      product: proposed.product,
    }),
  );
  assert.equal(savedResponse.status, 201);
  assert.equal(
    sqlite
      .prepare(
        "SELECT product_name FROM barcode_products WHERE barcode_normalized='03017624010701'",
      )
      .get().product_name,
    "Nutella restauration",
  );

  globalThis.fetch = async () => {
    throw new Error("the external service must not be called");
  };
  const localResponse = await routes.barcodeGET(
    barcodeGet("3017624010701"),
  );
  const local = await localResponse.json();
  assert.equal(local.lookupStatus, "internal");
  assert.equal(local.product.productName, "Nutella restauration");
  assert.equal(externalCalls, 1);
  globalThis.fetch = realFetch;
});

test("valid unknown products open manual entry without blocking reception", async () => {
  reset();
  const code = ean13("991234567890");
  globalThis.fetch = async () => new Response("", { status: 404 });
  const response = await routes.barcodeGET(barcodeGet(code));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.lookupStatus, "not_found");
  assert.equal(
    body.message,
    "Produit introuvable. Vous pouvez le créer manuellement.",
  );
  assert.equal(body.product, null);
  globalThis.fetch = realFetch;
});

test("invalid and non-GS1 matrix payloads never reach Open Food Facts", async () => {
  reset();
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("unexpected external request");
  };
  const invalid = await (
    await routes.barcodeGET(barcodeGet("3017624010702"))
  ).json();
  assert.equal(invalid.lookupStatus, "invalid");
  assert.equal(invalid.message, "Code-barres non valide.");
  const matrix = await (
    await routes.barcodeGET(barcodeGet("SUPPLIER-LOT-42", "data_matrix"))
  ).json();
  assert.equal(matrix.lookupStatus, "invalid");
  assert.equal(calls, 0);
  globalThis.fetch = realFetch;
});

test("Open Food Facts products may omit image and ingredients", async () => {
  reset();
  const code = ean13("991234567891");
  globalThis.fetch = async () =>
    Response.json({
      status: "success",
      product: { product_name_fr: "Produit simple", brands: "Test" },
    });
  const body = await (await routes.barcodeGET(barcodeGet(code))).json();
  assert.equal(body.lookupStatus, "open_food_facts");
  assert.equal(body.product.imageUrl, "");
  assert.equal(body.product.ingredients, "");
  globalThis.fetch = realFetch;
});

test("network loss produces a local-only message and leaves the form usable", async () => {
  reset();
  const code = ean13("991234567892");
  globalThis.fetch = async () => {
    throw new TypeError("network unavailable");
  };
  const response = await routes.barcodeGET(barcodeGet(code));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.lookupStatus, "offline");
  assert.equal(
    body.message,
    "Connexion indisponible. Recherche effectuée uniquement dans le catalogue local.",
  );
  globalThis.fetch = realFetch;
});

test("two consecutive scans reuse the short local lookup cache", async () => {
  reset();
  const code = ean13("991234567893");
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({
      status: "success",
      product: { product_name_fr: "Produit mis en cache" },
    });
  };
  const first = await (await routes.barcodeGET(barcodeGet(code))).json();
  const second = await (await routes.barcodeGET(barcodeGet(code))).json();
  assert.equal(first.product.productName, "Produit mis en cache");
  assert.equal(second.product.productName, "Produit mis en cache");
  assert.equal(calls, 1);
  globalThis.fetch = realFetch;
});

test("internal HACCP QR links keep their dedicated flow", async () => {
  reset();
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("unexpected external request");
  };
  const url = "https://sancta-frigo.test/t/ETQ-20260920-001";
  const body = await (
    await routes.barcodeGET(barcodeGet(url, "qr_code"))
  ).json();
  assert.equal(body.lookupStatus, "internal_link");
  assert.equal(body.parsed.internalUrl, url);
  assert.equal(calls, 0);
  globalThis.fetch = realFetch;
});

test("unapproved users cannot read or write the shared register", async () => {
  reset();
  await routes.POST(post(payload()));
  identity("owner-b");
  assert.equal((await routes.GET(get())).status, 403);
  assert.equal(
    (await routes.POST(post({ ...payload(), date: "2024-01-04" }))).status,
    403,
  );
  identity("owner-a");
  assert.equal(
    (await (await routes.GET(get())).json()).readings[0].time,
    "09:15",
  );
});
test("out-of-range readings require an action and historical limits are preserved", async () => {
  reset();
  const body = payload();
  body.temperatures.arm_bar = 4.1;
  assert.equal((await routes.POST(post(body))).status, 400);
  body.note = "Porte refermée, contrôle prévu.";
  assert.equal((await routes.POST(post(body))).status, 200);
  const config = {
    thresholds: { ...DEFAULT_THRESHOLDS, arm_bar: 2 },
    workbookUrl: "https://1drv.ms/x/test",
  };
  assert.equal((await routes.settingsPUT(putSettings(config))).status, 200);
  const data = await (await routes.GET(get())).json();
  assert.equal(data.readings[0].thresholds.arm_bar, 4);
  const current = await (await routes.settingsGET()).json();
  assert.equal(current.settings.thresholds.arm_bar, 2);
  assert.equal(current.sync.enabled, false);
});
test("configured workbook and ignored test readings are reflected in the app", async () => {
  reset();
  await routes.POST(post(payload()));
  const stored = sqlite.prepare("SELECT id FROM readings").get();
  globalThis.frigoTestWorkbookUrl = "https://1drv.ms/x/configured";
  globalThis.frigoTestSyncActive = "true";
  globalThis.frigoTestIgnoredIds = stored.id;
  const data = await (await routes.GET(get())).json();
  assert.equal(data.readings.length, 0);
  const current = await (await routes.settingsGET()).json();
  assert.equal(current.settings.workbookUrl, "https://1drv.ms/x/configured");
  assert.equal(current.sync.enabled, true);
});
test("a complete cooling record is stored with its calculated limit", async () => {
  reset();
  const response = await routes.labelsPOST(labelPost(cookedLabel()));
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.equal(created.label.expiresAt, "2026-09-07T11:15");
  assert.equal(created.label.storageTemperature, 3);
  assert.equal(created.label.coolingDurationMinutes, 100);
  assert.equal(created.label.controlStatus, "compliant");
  const list = await (await routes.labelsGET()).json();
  assert.equal(list.labels.length, 1);
  assert.equal(list.labels[0].productName, "Macaronade");
  assert.equal(list.labels[0].lotCode, "MAC-0904");
});
test("cooling to exactly 10 C within two hours is compliant", async () => {
  reset();
  const response = await routes.labelsPOST(
    labelPost(cookedLabel({ coolingEndTemperature: "10" })),
  );
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.equal(created.label.coolingEndTemperature, 10);
  assert.equal(created.label.coolingDurationMinutes, 100);
  assert.equal(created.label.controlStatus, "compliant");
});
test("a freely named preparation is validated, stored and reusable", async () => {
  reset();
  const body = {
    ...cookedLabel(),
    productCode: "__custom__",
    productName: "Aubergines grillées",
    customCategory: "Nouveaux plats",
    customProcessType: "cold_preparation",
    customStorageTemperature: "3",
    durationHours: 48,
    preparedAt: "2026-09-04T10:00",
    lotCode: "",
  };
  const response = await routes.labelsPOST(labelPost(body));
  assert.equal(response.status, 201);
  const created = (await response.json()).label;
  assert.equal(created.productName, "Aubergines grillées");
  assert.equal(created.category, "Nouveaux plats");
  assert.equal(created.processType, "cold_preparation");
  assert.equal(created.storageTemperature, 3);
  assert.equal(created.expiresAt, "2026-09-06T10:00");
  assert.match(created.productCode, /^libre-aubergines-grillees-/);
  assert.match(created.lotCode, /^LIBRE-AUBERG-/);

  const synchronizedCatalog = await (await routes.ingredientsGET()).json();
  const quickIngredient = synchronizedCatalog.ingredients.find(
    (item) => item.legacyCode === created.productCode,
  );
  assert.ok(quickIngredient);
  assert.equal(quickIngredient.displayName, "Aubergines grillées");
  assert.equal(quickIngredient.quickEnabled, true);
  assert.equal(quickIngredient.durationHours, 48);
  assert.equal(quickIngredient.defaultOperation, "internal_preparation");

  const reused = await routes.labelsPOST(
    labelPost({
      ...body,
      productCode: created.productCode,
      preparedAt: "2026-09-05T09:00",
    }),
  );
  assert.equal(reused.status, 201);
  assert.equal((await reused.json()).label.productCode, created.productCode);
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS total FROM ingredient_catalog WHERE legacy_code=?",
      )
      .get(created.productCode).total,
    1,
  );
});
test("an unknown preparation cannot bypass the custom preparation contract", async () => {
  reset();
  const response = await routes.labelsPOST(
    labelPost({
      ...cookedLabel(),
      productCode: "unknown-external-code",
      productName: "Produit injecté",
      customCategory: "Test",
      customProcessType: "cold_preparation",
      customStorageTemperature: "3",
    }),
  );
  assert.equal(response.status, 400);
});
test("the printed name can differ from the selected preparation preset", async () => {
  reset();
  const response = await routes.labelsPOST(
    labelPost(
      cookedLabel({
        productName: "Saucisse Macaronade",
      }),
    ),
  );
  assert.equal(response.status, 201);
  const created = (await response.json()).label;
  assert.equal(created.productCode, "macaronade");
  assert.equal(created.productName, "Saucisse Macaronade");
  assert.equal(created.processType, "cooked_cooled");
});
test("supplier lots remain linked to preparations and direct prints are timestamped", async () => {
  reset();
  const supplierResponse = await routes.suppliersPOST(
    mutation("/api/suppliers", "POST", {
      name: "Fournisseur du Midi",
      contactName: "Marie",
      phone: "0400000000",
      email: "lots@example.test",
      notes: "",
    }),
  );
  assert.equal(supplierResponse.status, 201);
  const supplier = (await supplierResponse.json()).supplier;
  const lotResponse = await routes.supplierLotsPOST(
    mutation("/api/supplier-lots", "POST", {
      supplierId: supplier.id,
      ingredientName: "Jambon blanc",
      supplierLot: "JB-2026-42",
      receivedAt: "2026-09-04T07:45",
      supplierDeadline: "2026-09-20",
      quantity: "2 × 5 kg",
      storageMode: "refrigerated",
      storageTemperature: "3.2",
      documentRef: "BL-774",
      notes: "",
    }),
  );
  assert.equal(lotResponse.status, 201);
  const lot = (await lotResponse.json()).lot;
  const labelResponse = await routes.labelsPOST(
    labelPost(cookedLabel({ sourceLotIds: [lot.id] })),
  );
  assert.equal(labelResponse.status, 201);
  const label = (await labelResponse.json()).label;
  assert.deepEqual(label.sourceLotIds, [lot.id]);
  assert.equal(
    sqlite
      .prepare(
        "SELECT count(*) AS count FROM preparation_source_lots WHERE preparation_label_id=?",
      )
      .get(label.id).count,
    1,
  );
  const printResponse = await routes.labelPrintPOST(
    mutation(`/api/labels/${label.id}/prints`, "POST", { copies: 20 }),
    labelContext(label.id),
  );
  assert.equal(printResponse.status, 201);
  const print = (await printResponse.json()).print;
  assert.equal(print.printerModel, "SUPVAN T50M Pro");
  assert.equal(print.copies, 20);
  assert.match(print.printedAt, /^20\d\d-/);
  assert.equal(
    sqlite
      .prepare(
        "SELECT count(*) AS count FROM label_print_events WHERE preparation_label_id=?",
      )
      .get(label.id).count,
    1,
  );
  assert.equal(
    (
      await routes.supplierLotDELETE(
        mutation(`/api/supplier-lots/${lot.id}`, "DELETE", {
          revision: lot.revision,
        }),
        labelContext(lot.id),
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await routes.supplierDELETE(
        mutation(`/api/suppliers/${supplier.id}`, "DELETE", {
          revision: supplier.revision,
        }),
        labelContext(supplier.id),
      )
    ).status,
    409,
  );
});
test("frozen-label chronology and same-origin writes are enforced", async () => {
  reset();
  const body = {
    ...cookedLabel(),
    productCode: "escalope-veau-congelee",
    durationHours: 2160,
    preparedAt: "2026-09-04T10:00",
    frozenAt: "2026-09-04T09:00",
    freezeMethod: "Congélateur à −18 °C",
    freezerTemperature: "-18",
  };
  assert.equal((await routes.labelsPOST(labelPost(body))).status, 400);
  assert.equal(
    (
      await routes.labelsPOST(
        labelPost(
          { ...body, frozenAt: "2026-09-04T10:30" },
          "https://other.test",
        ),
      )
    ).status,
    403,
  );
  const valid = await routes.labelsPOST(
    labelPost({ ...body, frozenAt: "2026-09-04T10:30" }),
  );
  assert.equal(valid.status, 201);
  assert.equal((await valid.json()).label.expiresAt, "2026-12-03T10:30");
});
test("opened ham never inherits thawing, freezing or cooling fields", async () => {
  reset();
  const body = {
    ...cookedLabel(),
    productCode: "jambon-blanc",
    durationHours: 24,
    preparedAt: "2026-09-04T08:00",
    openedAt: "2026-09-04T08:10",
    supplierLot: "JAMBON-42",
    thawingStartedAt: "2026-09-04T08:10",
    thawingMethod: "chambre_froide",
    frozenAt: "2026-09-04T08:10",
    freezeMethod: "Congélateur à −18 °C",
    freezerTemperature: "-18",
  };
  const response = await routes.labelsPOST(labelPost(body));
  assert.equal(response.status, 201);
  const created = (await response.json()).label;
  assert.equal(created.openedAt, "2026-09-04T08:10");
  assert.equal(created.thawingStartedAt, null);
  assert.equal(created.thawingMethod, "");
  assert.equal(created.frozenAt, null);
  assert.equal(created.freezeMethod, "");
  assert.equal(created.freezerTemperature, null);
  assert.equal(created.cookingEndedAt, null);
  assert.equal(created.coolingMethod, "");
  sqlite
    .prepare(
      "UPDATE preparation_labels SET thawing_started_at=?, thawing_method=?, frozen_at=?, freeze_method=?, freezer_temperature=? WHERE id=?",
    )
    .run(
      "2026-09-04T08:10",
      "chambre_froide",
      "2026-09-04T08:10",
      "Congélateur à −18 °C",
      -18,
      created.id,
    );
  const legacy = (await (await routes.labelsGET()).json()).labels[0];
  assert.equal(legacy.thawingStartedAt, null);
  assert.equal(legacy.frozenAt, null);
  assert.equal(legacy.freezeMethod, "");
  assert.equal(legacy.freezerTemperature, null);
});
test("an opened product without a supplier lot remains creatable and is flagged", async () => {
  reset();
  const response = await routes.labelsPOST(
    labelPost({
      ...cookedLabel(),
      productCode: "jambon-blanc",
      durationHours: 24,
      preparedAt: "2026-09-04T08:00",
      openedAt: "2026-09-04T08:10",
      supplierLot: "",
      sourceLotIds: [],
    }),
  );
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.equal(created.label.supplierLot, "");
  assert.equal(created.warnings.length, 1);
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS total FROM traceability_audit_events WHERE entity_id=? AND field_name='source_lot' AND new_value='non_renseigne'",
      )
      .get(created.label.id).total,
    1,
  );
});
test("a compressed supplier photo is stored outside D1 and remains access-controlled", async () => {
  reset();
  const createdResponse = await routes.labelsPOST(labelPost(cookedLabel()));
  assert.equal(createdResponse.status, 201);
  const label = (await createdResponse.json()).label;
  const form = new FormData();
  form.append(
    "photo",
    new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], {
      type: "image/jpeg",
    }),
    "lot-fournisseur.jpg",
  );
  form.append("caption", "Produit d’origine · lot FOUR-42 · DLC 30/09/2026");
  const uploaded = await routes.labelPhotosPOST(
    new Request(`https://frigo.test/api/labels/${label.id}/photos`, {
      method: "POST",
      headers: { origin: "https://frigo.test" },
      body: form,
    }),
    labelContext(label.id),
  );
  assert.equal(uploaded.status, 201);
  const photo = (await uploaded.json()).photo;
  assert.equal(photo.preparationLabelId, label.id);
  assert.equal(photo.byteSize, 4);
  assert.equal(photo.mimeType, "image/jpeg");
  assert.equal(globalThis.frigoTestMediaObjects.size, 1);
  const stored = sqlite
    .prepare(
      "SELECT object_key,content_sha256 FROM preparation_label_photos WHERE id=?",
    )
    .get(photo.id);
  assert.ok(stored.object_key.startsWith("preparation-evidence/"));
  assert.equal(stored.content_sha256.length, 64);
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS count FROM traceability_audit_events WHERE entity_id=? AND action='photo_attached'",
      )
      .get(label.id).count,
    1,
  );
  const list = await routes.labelPhotosGET(
    new Request(`https://frigo.test/api/labels/${label.id}/photos`),
    labelContext(label.id),
  );
  assert.equal(list.status, 200);
  assert.equal((await list.json()).photos.length, 1);
  const photoContext = {
    params: Promise.resolve({ id: label.id, photoId: photo.id }),
  };
  const binary = await routes.labelPhotoGET(
    new Request(`https://frigo.test${photo.url}`),
    photoContext,
  );
  assert.equal(binary.status, 200);
  assert.equal(binary.headers.get("content-type"), "image/jpeg");
  assert.deepEqual(
    [...new Uint8Array(await binary.arrayBuffer())],
    [0xff, 0xd8, 0xff, 0xd9],
  );
  identity("not-authorized");
  const forbidden = await routes.labelPhotoGET(
    new Request(`https://frigo.test${photo.url}`),
    photoContext,
  );
  assert.equal(forbidden.status, 403);
});
test("non-compliant cooling requires a corrective action", async () => {
  reset();
  assert.equal(
    (
      await routes.labelsPOST(
        labelPost(
          cookedLabel({
            coolingEndedAt: "2026-09-04T12:00",
            coolingEndTemperature: "11",
          }),
        ),
      )
    ).status,
    400,
  );
  const saved = await routes.labelsPOST(
    labelPost(
      cookedLabel({
        coolingEndedAt: "2026-09-04T12:00",
        coolingEndTemperature: "11",
        correctiveAction: "Produit écarté",
      }),
    ),
  );
  assert.equal(saved.status, 201);
  assert.equal((await saved.json()).label.controlStatus, "non_compliant");
});
test("the owner can edit and soft-delete a traceability record", async () => {
  reset();
  const created = (
    await (await routes.labelsPOST(labelPost(cookedLabel()))).json()
  ).label;
  const updated = await routes.labelPUT(
    labelMutation(
      created.id,
      "PUT",
      cookedLabel({ durationHours: 48, revision: created.revision }),
    ),
    labelContext(created.id),
  );
  assert.equal(updated.status, 200);
  const label = (await updated.json()).label;
  assert.equal(label.revision, 2);
  assert.equal(label.expiresAt, "2026-09-06T11:15");
  assert.equal(
    (
      await routes.labelDELETE(
        labelMutation(label.id, "DELETE", { revision: label.revision }),
        labelContext(label.id),
      )
    ).status,
    200,
  );
  assert.equal((await (await routes.labelsGET()).json()).labels.length, 0);
  assert.ok(
    sqlite
      .prepare("SELECT deleted_at FROM preparation_labels WHERE id=?")
      .get(label.id).deleted_at,
  );
});
test("contributors and cross-origin requests cannot edit or delete traceability records", async () => {
  reset();
  const created = (
    await (await routes.labelsPOST(labelPost(cookedLabel()))).json()
  ).label;
  const update = cookedLabel({ durationHours: 48, revision: created.revision });
  assert.equal(
    (
      await routes.labelPUT(
        labelMutation(created.id, "PUT", update, "https://other.test"),
        labelContext(created.id),
      )
    ).status,
    403,
  );
  sqlite
    .prepare(
      "INSERT INTO register_members (id,owner_id,user_id,email,display_name,status,revision,requested_at,updated_at) VALUES (?,?,?,?,?,'active',1,?,?)",
    )
    .run(
      "member-label",
      "owner-a",
      "member-b",
      "member-b@test.invalid",
      "Member B",
      new Date().toISOString(),
      new Date().toISOString(),
    );
  identity("member-b");
  assert.equal(
    (
      await routes.labelPUT(
        labelMutation(created.id, "PUT", update),
        labelContext(created.id),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await routes.labelDELETE(
        labelMutation(created.id, "DELETE", { revision: created.revision }),
        labelContext(created.id),
      )
    ).status,
    403,
  );
  assert.equal(
    sqlite
      .prepare("SELECT deleted_at FROM preparation_labels WHERE id=?")
      .get(created.id).deleted_at,
    null,
  );
});

test("the owner approves members, who can add but not alter readings or settings", async () => {
  reset();
  assert.equal((await routes.POST(post(payload()))).status, 200);
  identity("member-b");
  assert.equal((await (await routes.accessGET()).json()).status, "none");
  const requested = await routes.accessPOST(accessRequest());
  assert.equal(requested.status, 201);
  assert.equal((await requested.json()).status, "pending");
  identity("owner-a");
  const list = await (await routes.teamGET(teamGet())).json();
  assert.equal(list.members.length, 1);
  assert.equal(list.members[0].status, "pending");
  assert.equal(list.members[0].role, "contributor");
  const accepted = await (
    await routes.teamPUT(
      teamPut({
        id: list.members[0].id,
        revision: list.members[0].revision,
        status: "active",
      }),
    )
  ).json();
  assert.equal(accepted.member.status, "active");
  assert.equal(accepted.member.role, "contributor");
  identity("member-b");
  assert.equal((await (await routes.GET(get())).json()).readings.length, 1);
  assert.equal(
    (await routes.POST(post({ ...payload(), date: "2024-01-04" }))).status,
    200,
  );
  assert.equal(
    (await routes.POST(post({ ...payload(), revision: 1, time: "10:00" })))
      .status,
    403,
  );
  globalThis.frigoTestWorkbookUrl = "https://1drv.ms/x/configured";
  assert.equal(
    (await (await routes.settingsGET()).json()).settings.workbookUrl,
    "",
  );
  assert.equal(
    (
      await routes.settingsPUT(
        putSettings({
          thresholds: DEFAULT_THRESHOLDS,
          workbookUrl: "https://1drv.ms/x/test",
        }),
      )
    ).status,
    403,
  );
  identity("owner-a");
  const revoked = await routes.teamPUT(
    teamPut({
      id: accepted.member.id,
      revision: accepted.member.revision,
      status: "revoked",
    }),
  );
  assert.equal(revoked.status, 200);
  identity("member-b");
  assert.equal((await routes.GET(get())).status, 403);
  assert.equal((await (await routes.accessGET()).json()).status, "revoked");
  const requestedAgain = await routes.accessPOST(accessRequest());
  assert.equal(requestedAgain.status, 201);
  assert.equal((await requestedAgain.json()).status, "pending");
  assert.equal(
    sqlite
      .prepare("SELECT role FROM register_members WHERE user_id=?")
      .get("member-b").role,
    "contributor",
  );
});

test("the owner can appoint and demote administrators without delegating user management", async () => {
  reset();
  identity("admin-candidate");
  assert.equal((await routes.accessPOST(accessRequest())).status, 201);
  identity("owner-a");
  const pending = (await (await routes.teamGET(teamGet())).json()).members[0];
  const accepted = (
    await (
      await routes.teamPUT(
        teamPut({ id: pending.id, revision: pending.revision, status: "active" }),
      )
    ).json()
  ).member;
  identity("admin-candidate");
  assert.equal((await routes.quickLabelsGET()).status, 403);
  identity("owner-a");
  const promotedResponse = await routes.teamPUT(
    teamPut({ id: accepted.id, revision: accepted.revision, role: "admin" }),
  );
  assert.equal(promotedResponse.status, 200);
  const promoted = (await promotedResponse.json()).member;
  assert.equal(promoted.role, "admin");
  identity("admin-candidate");
  assert.equal((await routes.quickLabelsGET()).status, 200);
  assert.equal((await routes.teamGET(teamGet())).status, 403);
  assert.equal(
    (
      await routes.settingsPUT(
        putSettings({ thresholds: DEFAULT_THRESHOLDS, workbookUrl: "" }),
      )
    ).status,
    403,
  );
  identity("owner-a");
  const demotedResponse = await routes.teamPUT(
    teamPut({ id: promoted.id, revision: promoted.revision, role: "contributor" }),
  );
  assert.equal(demotedResponse.status, 200);
  assert.equal((await demotedResponse.json()).member.role, "contributor");
  identity("admin-candidate");
  assert.equal((await routes.quickLabelsGET()).status, 403);
});

function importRequest(origin = "https://frigo.test") {
  return new Request("https://frigo.test/api/readings/import", {
    method: "POST",
    headers: { origin },
  });
}
async function trialImport() {
  const trial = {
    ...payload(),
    time: "23:47",
    temperatures: Object.fromEntries(EQUIPMENT.map((e) => [e.id, 18])),
    note: "Essai à remplacer",
  };
  assert.equal((await routes.POST(post(trial))).status, 200);
  const stored = sqlite
    .prepare("SELECT * FROM readings WHERE owner_id=? AND date=?")
    .get("owner-a", trial.date);
  const { revision, ...reading } = payload();
  const config = {
    id: "import-owner-a",
    ownerId: "owner-a",
    reading: {
      ...reading,
      time: "09:52",
      temperatures: { ...reading.temperatures, arm_bar: 3.4 },
      thresholds: { ...DEFAULT_THRESHOLDS },
    },
    replace: {
      id: stored.id,
      revision: stored.revision,
      time: stored.time,
      initials: stored.initials,
      temperaturesJson: stored.temperatures,
      note: stored.note,
    },
  };
  globalThis.frigoTestImport = JSON.stringify(config);
  return { config, trial, stored };
}
test("configured imports require identity and a same-origin request", async () => {
  reset();
  await trialImport();
  const before = sqlite.prepare("SELECT * FROM readings").all();
  identity(null);
  assert.equal((await routes.importPOST(importRequest())).status, 401);
  identity("owner-a");
  assert.equal(
    (await routes.importPOST(importRequest("https://other.test"))).status,
    403,
  );
  assert.deepEqual(sqlite.prepare("SELECT * FROM readings").all(), before);
});
test("an unconfigured import is harmless and the cadence is hourly", async () => {
  reset();
  assert.deepEqual(await (await routes.importPOST(importRequest())).json(), {
    status: "none",
  });
  assert.equal(
    sqlite.prepare("SELECT count(*) AS count FROM readings").get().count,
    0,
  );
  globalThis.frigoTestWorkbookUrl = "https://1drv.ms/x/configured";
  globalThis.frigoTestSyncActive = "true";
  assert.equal(
    (await (await routes.settingsGET()).json()).sync.mode,
    "hourly_chatgpt",
  );
});
test("Excel import replaces only the confirmed trial and exposes the real reading", async () => {
  reset();
  const { config, stored } = await trialImport();
  assert.equal(
    (
      await routes.POST(
        post({ ...payload(), date: "2024-01-04", time: "07:41" }),
      )
    ).status,
    200,
  );
  const unrelated = sqlite
    .prepare("SELECT * FROM readings WHERE date=?")
    .get("2024-01-04");
  globalThis.frigoTestIgnoredIds = stored.id;
  const response = await routes.importPOST(importRequest());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "imported");
  const imported = sqlite
    .prepare("SELECT * FROM readings WHERE date=?")
    .get(config.reading.date);
  assert.equal(imported.id, config.id);
  assert.equal(imported.time, "09:52");
  assert.equal(imported.note, "");
  assert.equal(imported.revision, 2);
  assert.deepEqual(
    JSON.parse(imported.temperatures),
    config.reading.temperatures,
  );
  assert.deepEqual(JSON.parse(imported.thresholds), config.reading.thresholds);
  assert.deepEqual(
    sqlite.prepare("SELECT * FROM readings WHERE date=?").get("2024-01-04"),
    unrelated,
  );
  assert.equal((await (await routes.GET(get())).json()).readings.length, 2);
});
test("concurrent imports are idempotent and never overwrite later edits", async () => {
  reset();
  const { config } = await trialImport();
  const responses = await Promise.all([
    routes.importPOST(importRequest()),
    routes.importPOST(importRequest()),
  ]);
  const statuses = await Promise.all(
    responses.map(async (r) => (await r.json()).status),
  );
  assert.deepEqual(statuses.sort(), ["already_imported", "imported"]);
  assert.equal(
    sqlite.prepare("SELECT count(*) AS count FROM readings").get().count,
    1,
  );
  assert.equal(
    (await routes.POST(post({ ...payload(), revision: 1, time: "10:15" })))
      .status,
    409,
  );
  assert.equal(
    (await routes.POST(post({ ...payload(), revision: 2, time: "10:15" })))
      .status,
    200,
  );
  assert.equal(
    (await (await routes.importPOST(importRequest())).json()).status,
    "already_imported",
  );
  const current = sqlite
    .prepare("SELECT * FROM readings WHERE id=?")
    .get(config.id);
  assert.equal(current.time, "10:15");
  assert.equal(current.revision, 3);
});
test("a changed trial is never replaced without a matching snapshot", async () => {
  reset();
  const { trial } = await trialImport();
  assert.equal(
    (await routes.POST(post({ ...trial, revision: 1, time: "12:00" }))).status,
    200,
  );
  const before = sqlite.prepare("SELECT * FROM readings").all();
  assert.equal(
    (await (await routes.importPOST(importRequest())).json()).status,
    "conflict",
  );
  assert.deepEqual(sqlite.prepare("SELECT * FROM readings").all(), before);
});
test("imports cannot be redirected to another owner or populated by the browser", async () => {
  reset();
  const { config } = await trialImport();
  const before = sqlite.prepare("SELECT * FROM readings").all();
  identity("owner-b");
  assert.equal((await routes.importPOST(importRequest())).status, 403);
  assert.deepEqual(sqlite.prepare("SELECT * FROM readings").all(), before);
  identity("owner-a");
  const request = new Request("https://frigo.test/api/readings/import", {
    method: "POST",
    headers: {
      origin: "https://frigo.test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...config,
      ownerId: "owner-b",
      reading: { ...config.reading, time: "00:00" },
    }),
  });
  assert.equal(
    (await (await routes.importPOST(request)).json()).status,
    "imported",
  );
  assert.equal(
    sqlite.prepare("SELECT time FROM readings WHERE id=?").get(config.id).time,
    "09:52",
  );
});
test("missing target dates can be imported and invalid configuration fails safely", async () => {
  reset();
  const { config } = await trialImport();
  sqlite.prepare("DELETE FROM readings").run();
  assert.equal(
    (await (await routes.importPOST(importRequest())).json()).status,
    "imported",
  );
  assert.equal(
    sqlite.prepare("SELECT revision FROM readings WHERE id=?").get(config.id)
      .revision,
    1,
  );
  const before = sqlite.prepare("SELECT * FROM readings").all();
  for (const invalid of [
    "{",
    "null",
    JSON.stringify({
      ...config,
      reading: { ...config.reading, thresholds: {} },
    }),
  ]) {
    globalThis.frigoTestImport = invalid;
    assert.equal((await routes.importPOST(importRequest())).status, 503);
    assert.deepEqual(sqlite.prepare("SELECT * FROM readings").all(), before);
  }
});

function receptionContext(id, productId) {
  return { params: Promise.resolve(productId ? { id, productId } : { id }) };
}
function receptionProduct(extra = {}) {
  return {
    productName: "Jambon blanc",
    category: "Charcuterie",
    temperatureRegime: "refrigerated",
    quantity: "5",
    unit: "kg",
    supplierLot: "JB-2026-99",
    deadlineType: "dlc",
    deadlineDate: "2026-09-30",
    storageTemperature: 4,
    maxTemperature: 4,
    packagingCompliant: true,
    visualCompliant: true,
    cleanlinessCompliant: null,
    humidityAbsent: null,
    pestsAbsent: null,
    productCompliant: true,
    selectedForMeasurement: true,
    suggestedForMeasurement: true,
    riskLevel: "high",
    irTemperature: 7.8,
    probeTemperature: 3.9,
    measurementMethod: "between_packages",
    remeasureTemperature: null,
    observations: "Contrôle représentatif entre deux emballages.",
    decisionType: null,
    concernedQuantity: "",
    nonConformityReason: "",
    nonConformityComment: "",
    correctiveAction: "",
    finalDecision: "",
    revision: 0,
    ...extra,
  };
}
async function createReceptionFixture({
  supplierId = null,
  supplierName = "Fournisseur test",
  product = receptionProduct(),
} = {}) {
  const createdResponse = await routes.receptionsPOST(
    mutation("/api/receptions", "POST", {}),
  );
  assert.equal(createdResponse.status, 201);
  let reception = (await createdResponse.json()).reception;
  const headerResponse = await routes.receptionPUT(
    mutation(`/api/receptions/${reception.id}`, "PUT", {
      action: "update_header",
      revision: reception.revision,
      supplierId,
      supplierName,
      deliveryNote: "BL-REC-99",
      orderNumber: "CMD-99",
      driverName: "Jean Livreur",
      generalNotes: "Livraison du matin",
    }),
    receptionContext(reception.id),
  );
  assert.equal(headerResponse.status, 200);
  reception = (await headerResponse.json()).reception;
  const productResponse = await routes.receptionProductPOST(
    mutation(`/api/receptions/${reception.id}/products`, "POST", product),
    receptionContext(reception.id),
  );
  assert.equal(productResponse.status, 201);
  return { reception, product: (await productResponse.json()).product };
}

test("a reception preserves IR and probe readings, creates the supplier lot and keeps an audit trail", async () => {
  reset();
  const supplierResponse = await routes.suppliersPOST(
    mutation("/api/suppliers", "POST", {
      name: "Maison Test",
      contactName: "",
      phone: "",
      email: "",
      notes: "",
    }),
  );
  const supplier = (await supplierResponse.json()).supplier;
  const fixture = await createReceptionFixture({
    supplierId: supplier.id,
    supplierName: supplier.name,
  });
  const validateResponse = await routes.receptionPUT(
    mutation(`/api/receptions/${fixture.reception.id}`, "PUT", {
      action: "validate",
      pin: "1187",
      device: "Android test",
    }),
    receptionContext(fixture.reception.id),
  );
  assert.equal(validateResponse.status, 200);
  const validated = (await validateResponse.json()).reception;
  assert.equal(validated.status, "compliant_after_probe");
  assert.equal(validated.pinUsed, true);
  const stored = sqlite
    .prepare(
      "SELECT ir_temperature,probe_temperature,measurement_method,supplier_lot_id FROM reception_products WHERE id=?",
    )
    .get(fixture.product.id);
  assert.equal(stored.ir_temperature, 7.8);
  assert.equal(stored.probe_temperature, 3.9);
  assert.equal(stored.measurement_method, "between_packages");
  assert.ok(stored.supplier_lot_id);
  assert.equal(
    sqlite
      .prepare("SELECT count(*) AS count FROM supplier_lots WHERE id=?")
      .get(stored.supplier_lot_id).count,
    1,
  );
  assert.ok(
    sqlite
      .prepare(
        "SELECT count(*) AS count FROM reception_audit_events WHERE reception_id=?",
      )
      .get(validated.id).count >= 4,
  );
  assert.equal(
    (
      await routes.receptionProductDELETE(
        mutation(
          `/api/receptions/${validated.id}/products/${fixture.product.id}`,
          "DELETE",
          {},
        ),
        receptionContext(validated.id, fixture.product.id),
      )
    ).status,
    409,
  );
  const history = await routes.receptionsGET(
    new Request(
      "https://frigo.test/api/receptions?product=Jambon&lot=JB-2026-99",
    ),
  );
  const listed = await history.json();
  assert.equal(listed.receptions.length, 1);
  assert.equal(listed.receptions[0].measuredCount, 1);
});

test("a confirmed temperature non-conformity cannot close without an action and final decision", async () => {
  reset();
  const fixture = await createReceptionFixture({
    product: receptionProduct({
      probeTemperature: 7.1,
      measurementMethod: "contact",
    }),
  });
  const firstValidation = await routes.receptionPUT(
    mutation(`/api/receptions/${fixture.reception.id}`, "PUT", {
      action: "validate",
      device: "Android test",
    }),
    receptionContext(fixture.reception.id),
  );
  assert.equal(firstValidation.status, 400);
  const corrected = receptionProduct({
    probeTemperature: 7.1,
    measurementMethod: "contact",
    revision: fixture.product.revision,
    decisionType: "partial_refusal",
    concernedQuantity: "2 kg",
    nonConformityReason:
      "Température à la sonde supérieure à la tolérance fabricant.",
    correctiveAction: "2 kg isolés et refusés au livreur.",
    finalDecision: "Refus partiel, reste accepté après contrôle.",
  });
  const update = await routes.receptionProductPUT(
    mutation(
      `/api/receptions/${fixture.reception.id}/products/${fixture.product.id}`,
      "PUT",
      corrected,
    ),
    receptionContext(fixture.reception.id, fixture.product.id),
  );
  assert.equal(update.status, 200);
  const validateResponse = await routes.receptionPUT(
    mutation(`/api/receptions/${fixture.reception.id}`, "PUT", {
      action: "validate",
      device: "Android test",
    }),
    receptionContext(fixture.reception.id),
  );
  assert.equal(validateResponse.status, 200);
  assert.equal(
    (await validateResponse.json()).reception.status,
    "non_compliant",
  );
  const events = sqlite
    .prepare(
      "SELECT field_name,old_value,new_value FROM reception_audit_events WHERE reception_id=? AND entity_type='product'",
    )
    .all(fixture.reception.id);
  assert.ok(
    events.some(
      (event) =>
        event.field_name === "probe_temperature" ||
        event.field_name === "decision_type",
    ),
  );
});

test("expiry alerts can be closed as used without deleting the classic HACCP record", async () => {
  reset();
  const createdResponse = await routes.labelsPOST(
    labelPost(cookedLabel({ durationHours: 24 })),
  );
  assert.equal(createdResponse.status, 201);
  const label = (await createdResponse.json()).label;
  const alertTime = `${label.expiresAt.slice(0, 10)}T00:00`;
  let response = await routes.expiryGET(
    new Request(
      `https://frigo.test/api/expiry-alerts?at=${encodeURIComponent(alertTime)}`,
    ),
  );
  assert.equal(response.status, 200);
  assert.ok((await response.json()).alerts.some((item) => item.id === label.id));

  response = await routes.expiryPATCH(
    mutation("/api/expiry-alerts", "PATCH", {
      id: label.id,
      kind: "classic",
      action: "consumed",
    }),
  );
  assert.equal(response.status, 200);
  const stored = sqlite
    .prepare(
      "SELECT lifecycle_status,deleted_at,lifecycle_updated_by_name FROM preparation_labels WHERE id=?",
    )
    .get(label.id);
  assert.equal(stored.lifecycle_status, "consumed");
  assert.equal(stored.deleted_at, null);
  assert.equal(stored.lifecycle_updated_by_name, "owner-a@test.invalid");
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS total FROM traceability_audit_events WHERE entity_id=? AND field_name='lifecycle_status'",
      )
      .get(label.id).total,
    1,
  );

  response = await routes.expiryGET(
    new Request(
      `https://frigo.test/api/expiry-alerts?at=${encodeURIComponent(alertTime)}`,
    ),
  );
  assert.ok(!(await response.json()).alerts.some((item) => item.id === label.id));
});

test("freezing transformation marks the original HACCP sheet and refuses an expired product", async () => {
  reset();
  const createdResponse = await routes.labelsPOST(
    labelPost(cookedLabel({ durationHours: 24 })),
  );
  assert.equal(createdResponse.status, 201);
  const label = (await createdResponse.json()).label;

  let response = await routes.expiryPATCH(
    mutation("/api/expiry-alerts", "PATCH", {
      id: label.id,
      kind: "classic",
      action: "transformed_frozen",
    }),
  );
  assert.equal(response.status, 409);
  assert.equal(
    sqlite
      .prepare("SELECT lifecycle_status FROM preparation_labels WHERE id=?")
      .get(label.id).lifecycle_status,
    "active",
  );

  sqlite
    .prepare("UPDATE preparation_labels SET expires_at='2099-01-02T12:00' WHERE id=?")
    .run(label.id);
  response = await routes.expiryPATCH(
    mutation("/api/expiry-alerts", "PATCH", {
      id: label.id,
      kind: "classic",
      action: "transformed_frozen",
    }),
  );
  assert.equal(response.status, 200);
  const stored = sqlite
    .prepare(
      "SELECT lifecycle_status,deleted_at,lifecycle_updated_at,lifecycle_updated_by_name FROM preparation_labels WHERE id=?",
    )
    .get(label.id);
  assert.equal(stored.lifecycle_status, "transformed_frozen");
  assert.equal(stored.deleted_at, null);
  assert.ok(stored.lifecycle_updated_at);
  assert.equal(stored.lifecycle_updated_by_name, "owner-a@test.invalid");
  assert.equal(
    sqlite
      .prepare(
        "SELECT new_value FROM traceability_audit_events WHERE entity_id=? AND field_name='lifecycle_status' ORDER BY changed_at DESC LIMIT 1",
      )
      .get(label.id).new_value,
    "transformed_frozen",
  );

  response = await routes.expiryPATCH(
    mutation("/api/expiry-alerts", "PATCH", {
      id: label.id,
      kind: "classic",
      action: "consumed",
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(
    sqlite
      .prepare("SELECT lifecycle_status FROM preparation_labels WHERE id=?")
      .get(label.id).lifecycle_status,
    "consumed",
  );
  assert.deepEqual(
    sqlite
      .prepare(
        "SELECT new_value FROM traceability_audit_events WHERE entity_id=? AND field_name='lifecycle_status' ORDER BY changed_at",
      )
      .all(label.id)
      .map((entry) => entry.new_value),
    ["transformed_frozen", "consumed"],
  );
});

test("discarding a quick expiry alert closes its preparation, bacs and physical labels", async () => {
  reset();
  const catalog = await (await routes.ingredientsGET()).json();
  const tomatoes = catalog.ingredients.find(
    (item) => item.legacyCode === "tomates-coupees",
  );
  const createdResponse = await routes.quickLabelsPOST(
    mutation("/api/quick-labels", "POST", {
      createPrintJob: false,
      selections: [
        {
          ingredientId: tomatoes.id,
          operationType: tomatoes.defaultOperation,
          bacCount: 2,
          labelCount: 2,
          preparedAt: "2026-09-10T08:30",
          sourceLotIds: [],
          manualSourceLot: "TOM-EXP-01",
          manualSourceReason: "Réception papier en attente de saisie",
          notes: "",
          durationOverride: null,
          overrideReason: "",
        },
      ],
    }),
  );
  assert.equal(createdResponse.status, 201);
  const preparation = sqlite
    .prepare(
      "SELECT id,expires_at FROM internal_preparations ORDER BY created_at DESC LIMIT 1",
    )
    .get();
  const alertTime = `${preparation.expires_at.slice(0, 10)}T00:00`;
  const before = await routes.expiryGET(
    new Request(
      `https://frigo.test/api/expiry-alerts?at=${encodeURIComponent(alertTime)}`,
    ),
  );
  assert.ok(
    (await before.json()).alerts.some(
      (item) => item.kind === "quick" && item.id === preparation.id,
    ),
  );

  const response = await routes.expiryPATCH(
    mutation("/api/expiry-alerts", "PATCH", {
      id: preparation.id,
      kind: "quick",
      action: "discarded",
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(
    sqlite
      .prepare("SELECT status FROM internal_preparations WHERE id=?")
      .get(preparation.id).status,
    "discarded",
  );
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS total FROM preparation_bacs WHERE preparation_id=? AND status='discarded'",
      )
      .get(preparation.id).total,
    2,
  );
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS total FROM physical_labels WHERE preparation_id=? AND status='discarded'",
      )
      .get(preparation.id).total,
    2,
  );
});

test("freezing transformation closes a quick preparation and every related bac and label", async () => {
  reset();
  const catalog = await (await routes.ingredientsGET()).json();
  const tomatoes = catalog.ingredients.find(
    (item) => item.legacyCode === "tomates-coupees",
  );
  const createdResponse = await routes.quickLabelsPOST(
    mutation("/api/quick-labels", "POST", {
      createPrintJob: false,
      selections: [
        {
          ingredientId: tomatoes.id,
          operationType: tomatoes.defaultOperation,
          bacCount: 2,
          labelCount: 2,
          preparedAt: "2026-09-10T08:30",
          sourceLotIds: [],
          manualSourceLot: "TOM-FRZ-01",
          manualSourceReason: "Réception papier en attente de saisie",
          notes: "",
          durationOverride: null,
          overrideReason: "",
        },
      ],
    }),
  );
  assert.equal(createdResponse.status, 201);
  const preparation = sqlite
    .prepare(
      "SELECT id FROM internal_preparations ORDER BY created_at DESC LIMIT 1",
    )
    .get();
  sqlite
    .prepare("UPDATE internal_preparations SET expires_at='2099-01-02T12:00' WHERE id=?")
    .run(preparation.id);

  let response = await routes.expiryPATCH(
    mutation("/api/expiry-alerts", "PATCH", {
      id: preparation.id,
      kind: "quick",
      action: "transformed_frozen",
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(
    sqlite
      .prepare("SELECT status FROM internal_preparations WHERE id=?")
      .get(preparation.id).status,
    "transformed_frozen",
  );
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS total FROM preparation_bacs WHERE preparation_id=? AND status='transformed_frozen'",
      )
      .get(preparation.id).total,
    2,
  );
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS total FROM physical_labels WHERE preparation_id=? AND status='transformed_frozen'",
      )
      .get(preparation.id).total,
    2,
  );

  response = await routes.expiryPATCH(
    mutation("/api/expiry-alerts", "PATCH", {
      id: preparation.id,
      kind: "quick",
      action: "consumed",
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(
    sqlite
      .prepare("SELECT status FROM internal_preparations WHERE id=?")
      .get(preparation.id).status,
    "consumed",
  );
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS total FROM preparation_bacs WHERE preparation_id=? AND status='consumed'",
      )
      .get(preparation.id).total,
    2,
  );
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS total FROM physical_labels WHERE preparation_id=? AND status='consumed'",
      )
      .get(preparation.id).total,
    2,
  );
});

test("a linked freezing label preserves the source, lineage and original dates", async () => {
  reset();
  const source = await currentSource();
  const response = await routes.labelsPOST(
    labelPost(freezingPayload(source)),
  );
  assert.equal(response.status, 201);
  const target = (await response.json()).label;
  assert.notEqual(target.id, source.id);
  const original = sqlite
    .prepare(
      "SELECT prepared_at,expires_at,lifecycle_status FROM preparation_labels WHERE id=?",
    )
    .get(source.id);
  assert.equal(original.prepared_at, source.preparedAt);
  assert.equal(original.expires_at, source.expiresAt);
  assert.equal(original.lifecycle_status, "transformed_frozen");
  const lineage = sqlite
    .prepare(
      "SELECT source_kind,source_id,target_label_id,relation,scope FROM preparation_lineage WHERE target_label_id=?",
    )
    .get(target.id);
  assert.equal(lineage.source_kind, "classic");
  assert.equal(lineage.source_id, source.id);
  assert.equal(lineage.target_label_id, target.id);
  assert.equal(lineage.relation, "frozen");
  assert.equal(lineage.scope, "all");
  const repeated = await routes.labelsPOST(
    labelPost(freezingPayload(source)),
  );
  assert.equal(repeated.status, 409);
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS total FROM preparation_lineage").get()
      .total,
    1,
  );
});

test("a partial freezing keeps the source active and unsafe freezing is rejected", async () => {
  reset();
  const source = await currentSource();
  let response = await routes.labelsPOST(
    labelPost(
      freezingPayload(source, {
        transformationScope: "partial",
        quantity: "1 portion",
      }),
    ),
  );
  assert.equal(response.status, 201);
  assert.equal(
    sqlite
      .prepare("SELECT lifecycle_status FROM preparation_labels WHERE id=?")
      .get(source.id).lifecycle_status,
    "active",
  );

  const expired = await currentSource({ lotCode: "OLD-01" });
  sqlite
    .prepare("UPDATE preparation_labels SET expires_at=? WHERE id=?")
    .run(localShift(-2), expired.id);
  const before = sqlite
    .prepare("SELECT COUNT(*) AS total FROM preparation_labels")
    .get().total;
  response = await routes.labelsPOST(
    labelPost(freezingPayload({ ...expired, expiresAt: localShift(-2) })),
  );
  assert.equal(response.status, 409);
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS total FROM preparation_labels").get()
      .total,
    before,
  );
});

test("preparation search remains owner-scoped and requires authentication", async () => {
  reset();
  const source = await currentSource();
  let response = await routes.preparationHistoryGET(
    new Request("https://frigo.test/api/preparation-history?q=macaronade"),
  );
  assert.equal(response.status, 200);
  assert.ok((await response.json()).items.some((item) => item.id === source.id));
  identity("owner-b");
  response = await routes.preparationHistoryGET(
    new Request("https://frigo.test/api/preparation-history?q=macaronade"),
  );
  assert.equal(response.status, 403);
  identity(null);
  assert.equal(
    (
      await routes.preparationHistoryGET(
        new Request("https://frigo.test/api/preparation-history?q="),
      )
    ).status,
    401,
  );
  assert.equal(
    (await routes.wasteGET(new Request("https://frigo.test/api/waste"))).status,
    401,
  );
});

test("a confirmed discard records its evidence in the waste register", async () => {
  reset();
  const source = await currentSource({ lotCode: "WASTE-01" });
  sqlite
    .prepare("UPDATE preparation_labels SET expires_at=? WHERE id=?")
    .run(localShift(-2), source.id);
  const request = {
    id: source.id,
    kind: "classic",
    action: "discarded",
    discard: {
      reason: "dlc_expired",
      quantity: "1,2 kg",
      comment: "DLC dépassée, produit non utilisé",
    },
  };
  let response = await routes.expiryPATCH(
    mutation("/api/expiry-alerts", "PATCH", request),
  );
  assert.equal(response.status, 200);
  response = await routes.expiryPATCH(
    mutation("/api/expiry-alerts", "PATCH", request),
  );
  assert.equal(response.status, 200);
  const register = await (
    await routes.wasteGET(new Request("https://frigo.test/api/waste"))
  ).json();
  const item = register.items.find((entry) => entry.id === source.id);
  assert.equal(item.reason, "dlc_expired");
  assert.equal(item.quantity, "1,2 kg");
  assert.equal(item.expiredAtDiscard, true);
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS total FROM traceability_audit_events WHERE entity_id=? AND field_name='discard_details'",
      )
      .get(source.id).total,
    1,
  );
});

test("daily cleaning controls are stored with every configured task", async () => {
  reset();
  let response = await routes.hygienePOST(
    mutation("/api/hygiene-records", "POST", hygienePayload()),
  );
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.equal(created.record.status, "draft");
  assert.equal(created.checks.length, HYGIENE_TASKS.cleaning.length);
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS total FROM hygiene_checks").get().total,
    HYGIENE_TASKS.cleaning.length,
  );

  response = await routes.hygieneGET(
    new Request(
      "https://frigo.test/api/hygiene-records?type=cleaning&date=2024-01-05&month=2024-01",
    ),
  );
  assert.equal(response.status, 200);
  const loaded = await response.json();
  assert.equal(loaded.record.id, created.record.id);
  assert.equal(loaded.history.length, 1);
  assert.equal(loaded.history[0].doneCount, 7);
});

test("a signed hygiene record requires completed checks and becomes immutable", async () => {
  reset();
  const pending = hygienePayload("fryer", {
    validate: true,
    signature: "data:image/png;base64,AA==",
  });
  pending.checks[0].state = "pending";
  let response = await routes.hygienePOST(
    mutation("/api/hygiene-records", "POST", pending),
  );
  assert.equal(response.status, 400);

  const signed = hygienePayload("fryer", {
    validate: true,
    signature: "data:image/png;base64,AA==",
  });
  response = await routes.hygienePOST(
    mutation("/api/hygiene-records", "POST", signed),
  );
  assert.equal(response.status, 201);
  const validated = await response.json();
  assert.equal(validated.record.status, "validated");
  assert.equal(validated.record.validatedByName, "owner-a@test.invalid");
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS total FROM traceability_audit_events WHERE entity_type='hygiene_record' AND action='validated'",
      )
      .get().total,
    1,
  );

  response = await routes.hygienePOST(
    mutation(
      "/api/hygiene-records",
      "POST",
      hygienePayload("fryer", { revision: validated.record.revision }),
    ),
  );
  assert.equal(response.status, 409);
});

test("a hygiene anomaly cannot be validated without its corrective note", async () => {
  reset();
  const payload = hygienePayload("cleaning", {
    validate: true,
    signature: "data:image/png;base64,AA==",
  });
  payload.checks[1].state = "issue";
  let response = await routes.hygienePOST(
    mutation("/api/hygiene-records", "POST", payload),
  );
  assert.equal(response.status, 400);
  payload.checks[1].observation = "Four relavé après second passage.";
  response = await routes.hygienePOST(
    mutation("/api/hygiene-records", "POST", payload),
  );
  assert.equal(response.status, 201);
  const saved = await response.json();
  assert.equal(saved.checks[1].state, "issue");
  assert.match(saved.checks[1].observation, /second passage/);
});

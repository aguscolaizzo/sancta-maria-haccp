import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { DEFAULT_THRESHOLDS, EQUIPMENT } from "../lib/frigo.ts";

const bundle = await build({ entryPoints: [new URL("../lib/temperature-history.ts", import.meta.url).pathname], bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent" });
const { temperatureDomain, temperatureHistory, temperatureSummary } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);

function reading(date, values = {}, extra = {}) {
  return {
    id: date, date, time: "09:52", initials: "AC", note: "", exception: false,
    temperatures: { ...Object.fromEntries(EQUIPMENT.map(item => [item.id, item.max])), ...values },
    thresholds: { ...DEFAULT_THRESHOLDS }, revision: 1, createdAt: `${date}T07:52:00Z`, updatedAt: `${date}T07:52:00Z`, ...extra,
  };
}

test("history sorts real readings, preserves negatives, and keeps missing days null", () => {
  const records = [reading("2026-09-03", { cong_ch_1: -19 }), reading("2026-09-02", { cong_ch_1: -18 })];
  const points = temperatureHistory(records, "2026-09", "cong_ch_1", "2026-09-03");
  assert.deepEqual(points.map(point => point.date), ["2026-09-01", "2026-09-02", "2026-09-03"]);
  assert.deepEqual(points.map(point => point.temperature), [null, -18, -19]);
  assert.equal(points[0].threshold, null);
  assert.equal(points[1].time, "09:52");
  assert.equal(records[0].date, "2026-09-03", "input order is not mutated");
  assert.deepEqual(temperatureSummary(points), { count: 2, minimum: -19, maximum: -18, latest: points[2], overCount: 0 });
});

test("all 13 equipment histories use only their own saved values and limits", () => {
  const record = reading("2026-09-02", Object.fromEntries(EQUIPMENT.map((item, index) => [item.id, index - 20])));
  EQUIPMENT.forEach((item, index) => {
    const point = temperatureHistory([record], "2026-09", item.id, "2026-09-02")[1];
    assert.equal(point.temperature, index - 20);
    assert.equal(point.threshold, record.thresholds[item.id]);
  });
});

test("historical thresholds are not replaced by current settings; equality is not an exceedance", () => {
  const points = temperatureHistory([
    reading("2026-09-02", { arm_bar: 4.04 }),
    reading("2026-09-03", { arm_bar: 4.04 }, { thresholds: { ...DEFAULT_THRESHOLDS, arm_bar: 5 } }),
    reading("2026-09-04", { arm_bar: 4 }),
  ], "2026-09", "arm_bar", "2026-09-04");
  assert.deepEqual(points.slice(1).map(point => point.threshold), [4, 5, 4]);
  assert.deepEqual(points.slice(1).map(point => point.over), [true, false, false]);
  assert.equal(temperatureSummary(points).overCount, 1);
  assert.equal(temperatureSummary(points).maximum, 4.04);
});

test("missing or invalid values are never converted into 0 or a fabricated threshold", () => {
  const missing = reading("2026-09-02");
  delete missing.temperatures.arm_bar;
  const noLimit = reading("2026-09-05", { arm_bar: 0 });
  delete noLimit.thresholds.arm_bar;
  const points = temperatureHistory([
    missing, reading("2026-09-03", { arm_bar: NaN }), reading("2026-09-04", { arm_bar: Infinity }), noLimit,
  ], "2026-09", "arm_bar", "2026-09-05");
  assert.deepEqual(points.map(point => point.temperature), [null, null, null, null, 0]);
  assert.equal(points[4].threshold, null);
  assert.equal(points[4].over, false);
  assert.equal(temperatureSummary(points).count, 1);
  assert.equal(temperatureSummary(points).minimum, 0);
});

test("months are bounded, leap days are retained, future records and other months are excluded", () => {
  const points = temperatureHistory([
    reading("2024-01-31"), reading("2024-02-29"), reading("2024-03-01"), reading("2024-02-30"),
  ], "2024-02", "arm_bar", "2024-03-15");
  assert.equal(points.length, 29);
  assert.equal(points.at(-1).date, "2024-02-29");
  assert.equal(temperatureSummary(points).count, 1);
  assert.equal(temperatureHistory([], "2100-02", "arm_bar", "2100-03-01").length, 28);
  assert.equal(temperatureHistory([reading("2026-09-03")], "2026-09", "arm_bar", "2026-09-02").length, 2);
  assert.deepEqual(temperatureHistory([], "2026-10", "arm_bar", "2026-09-03"), []);
  for (const month of ["", "2026-13", "2026-9", "not-a-date"]) assert.deepEqual(temperatureHistory([], month, "arm_bar", "2026-09-03"), []);
});

test("empty and single-point histories have honest summaries and usable chart domains", () => {
  assert.equal(temperatureSummary([]), null);
  assert.equal(temperatureSummary(temperatureHistory([], "2026-09", "arm_bar", "2026-09-03")), null);
  const points = temperatureHistory([reading("2026-09-02")], "2026-09", "cong_ch_1", "2026-09-03");
  assert.equal(temperatureSummary(points).count, 1);
  assert.equal(temperatureSummary(points).minimum, -18);
  assert.equal(temperatureSummary(points).maximum, -18);
  assert.deepEqual(temperatureDomain(points), [-19, -17]);
  assert.deepEqual(temperatureDomain([]), [-1, 1]);
  const wide = temperatureHistory([reading("2026-09-02", { cong_ch_1: -40 }), reading("2026-09-03", { cong_ch_1: -5 })], "2026-09", "cong_ch_1", "2026-09-03");
  const [minimum, maximum] = temperatureDomain(wide);
  assert.ok(minimum < -40 && maximum > -5);
});

test("corrected readings replace older revisions without duplicate plotted measurements", () => {
  const corrected = reading("2026-09-02", { arm_bar: 3.4 }, { revision: 3 });
  const old = reading("2026-09-02", { arm_bar: 18 });
  const points = temperatureHistory([corrected, old], "2026-09", "arm_bar", "2026-09-03");
  assert.equal(temperatureSummary(points).count, 1);
  assert.equal(points[1].temperature, 3.4);
  assert.equal(points[1].over, false);
});

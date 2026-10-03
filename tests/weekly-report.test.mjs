import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir } from "node:fs/promises";
import { build } from "esbuild";

await mkdir(new URL("../.sites-runtime/tests/", import.meta.url), {
  recursive: true,
});
const bundle = new URL(
  "../.sites-runtime/tests/weekly-report.mjs",
  import.meta.url,
);
await build({
  entryPoints: [new URL("../lib/weekly-report.ts", import.meta.url).pathname],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: bundle.pathname,
  logLevel: "silent",
});
const weekly = await import(bundle.href);

test("a weekly report always runs from Monday through Sunday", () => {
  assert.deepEqual(weekly.weekRange("2026-09-13"), {
    start: "2026-09-07",
    end: "2026-09-13",
    next: "2026-09-14",
  });
  assert.deepEqual(weekly.weekRange("2026-09-09"), {
    start: "2026-09-07",
    end: "2026-09-13",
    next: "2026-09-14",
  });
});

test("daily, monthly and custom reports use inclusive calendar boundaries", () => {
  assert.deepEqual(weekly.dayRange("2026-09-14"), {
    start: "2026-09-14",
    end: "2026-09-14",
    next: "2026-09-15",
  });
  assert.deepEqual(weekly.monthRange("2028-02"), {
    start: "2028-02-01",
    end: "2028-02-29",
    next: "2028-03-01",
  });
  assert.deepEqual(weekly.customRange("2026-09-03", "2026-09-17"), {
    start: "2026-09-03",
    end: "2026-09-17",
    next: "2026-09-18",
  });
  assert.throws(
    () => weekly.customRange("2026-09-17", "2026-09-03"),
    /date de fin/i,
  );
});

test("report filters support new periods and legacy weekly links", () => {
  assert.deepEqual(
    weekly.resolveReportRange(
      { period: "month", month: "2026-09" },
      "2026-09-14",
    ),
    {
      period: "month",
      start: "2026-09-01",
      end: "2026-09-30",
      next: "2026-10-01",
    },
  );
  assert.deepEqual(
    weekly.resolveReportRange({ week: "2026-09-13" }, "2026-09-14"),
    {
      period: "week",
      start: "2026-09-07",
      end: "2026-09-13",
      next: "2026-09-14",
    },
  );
  assert.equal(
    weekly.reportRangeQuery({
      period: "custom",
      start: "2026-09-03",
      end: "2026-09-17",
      next: "2026-09-18",
    }),
    "period=custom&from=2026-09-03&to=2026-09-17",
  );
});

test("expiry alerts distinguish overdue, today and tomorrow", () => {
  const now = "2026-09-13T12:00";
  assert.equal(weekly.classifyExpiry("2026-09-13T11:59", now), "expired");
  assert.equal(weekly.classifyExpiry("2026-09-13T18:00", now), "today");
  assert.equal(weekly.classifyExpiry("2026-09-14T08:00", now), "tomorrow");
  assert.equal(weekly.classifyExpiry("2026-09-15T08:00", now), "later");
});

test("Paris report boundaries are converted to exact UTC instants", () => {
  assert.equal(
    weekly.parisLocalToUtc("2026-09-07T00:00"),
    "2026-09-06T22:00:00.000Z",
  );
  assert.equal(
    weekly.parisLocalToUtc("2026-12-07T00:00"),
    "2026-12-06T23:00:00.000Z",
  );
});

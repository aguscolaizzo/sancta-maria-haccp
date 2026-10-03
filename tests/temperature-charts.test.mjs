import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir } from "node:fs/promises";
import { build } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_THRESHOLDS } from "../lib/frigo.ts";

await mkdir(new URL("../.sites-runtime/tests/", import.meta.url), { recursive: true });
const bundle = new URL("../.sites-runtime/tests/charts.mjs", import.meta.url);
await build({ entryPoints: [new URL("../app/temperature-charts.tsx", import.meta.url).pathname], bundle: true, packages: "external", platform: "node", format: "esm", outfile: bundle.pathname, logLevel: "silent" });
const { default: TemperatureCharts } = await import(bundle.href);

const sample = { id: "reading", date: "2026-09-02", time: "09:52", initials: "AC", note: "", exception: false, revision: 1, createdAt: "2026-09-02T07:52:00Z", updatedAt: "2026-09-02T07:52:00Z", temperatures: { ...DEFAULT_THRESHOLDS, arm_bar: 3.4 }, thresholds: { ...DEFAULT_THRESHOLDS } };
const render = extra => renderToStaticMarkup(createElement(TemperatureCharts, {
  records: [sample], month: "2026-09", today: "2026-09-03", equipmentId: "cong_ch_1", onEquipmentChange() {}, loading: false, loadError: "", ...extra,
}));

test("charts expose equipment selection, exact values, historical limits, and an accessible table", () => {
  const html = render({});
  assert.match(html, /id="chart-equipment"/);
  assert.match(html, /role="combobox"/);
  assert.match(html, /Congélateur chambre 1/);
  assert.match(html, /Minimum du mois/);
  assert.match(html, /-18,0/);
  assert.match(html, /09:52/);
  assert.match(html, /<details/);
  assert.match(html, /Valeurs exactes/);
  assert.match(html, /Une seule mesure/);
  assert.match(html, /Les jours sans mesure interrompent la courbe/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test("switching equipment changes the measurement and an exceedance has a text label", () => {
  const html = render({ equipmentId: "arm_bar", records: [{ ...sample, temperatures: { ...sample.temperatures, arm_bar: 4.04 } }] });
  assert.match(html, /Armoire réfrigérée bar/);
  assert.match(html, /4,04/);
  assert.match(html, /1 dépassement/);
  assert.match(html, />Oui<\/td>/);
  assert.doesNotMatch(html, /-18,0/);
});

test("loading, failure, and empty states never show stale temperature statistics", () => {
  for (const [props, message] of [
    [{ loading: true }, /Chargement des graphiques/],
    [{ loadError: "Unavailable" }, /graphiques sont indisponibles/],
    [{ records: [] }, /Aucune mesure ce mois-ci/],
  ]) {
    const html = render(props);
    assert.match(html, message);
    assert.doesNotMatch(html, /Minimum du mois|-18,0|<details/);
  }
});

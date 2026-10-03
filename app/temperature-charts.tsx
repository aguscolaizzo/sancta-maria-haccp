"use client";

import { useMemo } from "react";
import { AlertTriangle, ChartNoAxesCombined, LoaderCircle } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { displayTemp, EQUIPMENT, type Reading } from "@/lib/frigo";
import { isMeasuredPoint, temperatureDomain, temperatureHistory, temperatureSummary, type EquipmentId, type TemperaturePoint } from "@/lib/temperature-history";

const chartConfig = {
  temperature: { label: "Température mesurée", color: "#6f2333" },
  threshold: { label: "Seuil du relevé", color: "#a67d38" },
} satisfies ChartConfig;

const dateLabel = (date: string) => new Intl.DateTimeFormat("fr-FR", {
  day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris",
}).format(new Date(`${date}T12:00:00Z`));

function ReadingDot({ cx, cy, payload, active = false }: {
  cx?: number; cy?: number; payload?: TemperaturePoint; active?: boolean;
}) {
  if (cx === undefined || cy === undefined || payload?.temperature == null) return null;
  return <circle cx={cx} cy={cy} r={active ? 6 : 4} fill={payload.over ? "#b93832" : "white"}
    stroke={payload.over ? "#b93832" : "#6f2333"} strokeWidth={2} aria-hidden="true" />;
}

function ReadingTooltip({ active, payload }: {
  active?: boolean;
  payload?: readonly { dataKey?: unknown; payload?: TemperaturePoint }[];
}) {
  const point = payload?.find(item => item.dataKey === "temperature")?.payload;
  if (!active || !point || point.temperature === null) return null;
  return <div className="temperature-tooltip">
    <p><strong>{dateLabel(point.date)}</strong> · {point.time}</p>
    <dl>
      <div><dt>Température</dt><dd>{displayTemp(point.temperature)} °C</dd></div>
      <div><dt>Seuil du relevé</dt><dd>{point.threshold === null ? "Non disponible" : `${displayTemp(point.threshold)} °C`}</dd></div>
    </dl>
    {point.over && <p className="chart-exceedance"><AlertTriangle size={14} aria-hidden="true" />Dépassement du seuil</p>}
  </div>;
}

type Props = {
  records: Reading[];
  month: string;
  today: string;
  equipmentId: EquipmentId;
  onEquipmentChange: (equipmentId: EquipmentId) => void;
  loading: boolean;
  loadError: string;
};

export default function TemperatureCharts({ records, month, today, equipmentId, onEquipmentChange, loading, loadError }: Props) {
  const equipment = EQUIPMENT.find(item => item.id === equipmentId)!;
  const points = useMemo(() => temperatureHistory(records, month, equipmentId, today), [records, month, equipmentId, today]);
  const measured = points.filter(isMeasuredPoint);
  const summary = temperatureSummary(points);
  const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "Europe/Paris" })
    .format(new Date(`${month}-01T12:00:00Z`));

  return <div className="panel panel-pad chart-panel" aria-busy={loading}>
    <div className="chart-controls">
      <div className="chart-equipment-field">
        <label htmlFor="chart-equipment">Équipement</label>
        <Select value={equipmentId} onValueChange={value => {
          const next = EQUIPMENT.find(item => item.id === value);
          if (next) onEquipmentChange(next.id);
        }}>
          <SelectTrigger id="chart-equipment" className="chart-equipment-select"><SelectValue /></SelectTrigger>
          <SelectContent position="popper">
            {(["freezer", "fridge"] as const).map(group => <SelectGroup key={group}>
              <SelectLabel>{group === "freezer" ? "Congélateurs" : "Froid positif"}</SelectLabel>
              {EQUIPMENT.filter(item => item.group === group).map(item => <SelectItem value={item.id} key={item.id}>{item.name}</SelectItem>)}
            </SelectGroup>)}
          </SelectContent>
        </Select>
      </div>
      <p className="chart-period">{monthLabel}<span>Une mesure quotidienne · °C</span></p>
    </div>

    {loading ? <div className="loading" role="status"><LoaderCircle className="spinner" style={{ margin: "0 auto 12px" }} size={23} aria-hidden="true" />Chargement des graphiques…</div>
      : loadError ? <div className="loading">Les graphiques sont indisponibles. Utilisez « Réessayer » au-dessus.</div>
      : !summary ? <div className="chart-empty" role="status"><ChartNoAxesCombined size={32} aria-hidden="true" /><h3>Aucune mesure ce mois-ci</h3><p>Les relevés enregistrés pour cet équipement apparaîtront ici.</p></div>
      : <>
        <dl className="chart-stats">
          <div><dt>Dernière mesure</dt><dd>{displayTemp(summary.latest.temperature)} <span>°C</span><p>{summary.latest.date.slice(8)}/{summary.latest.date.slice(5, 7)} à {summary.latest.time}</p></dd></div>
          <div><dt>Minimum du mois</dt><dd>{displayTemp(summary.minimum)} <span>°C</span></dd></div>
          <div><dt>Maximum du mois</dt><dd>{displayTemp(summary.maximum)} <span>°C</span></dd></div>
        </dl>
        <div className="chart-caption-row" aria-live="polite">
          <p>{summary.count} mesure{summary.count > 1 ? "s" : ""} enregistrée{summary.count > 1 ? "s" : ""}</p>
          {summary.overCount > 0 && <span className="status-pill danger"><AlertTriangle size={14} aria-hidden="true" />{summary.overCount} dépassement{summary.overCount > 1 ? "s" : ""}</span>}
        </div>
        <figure aria-label={`${equipment.name} : températures en ${monthLabel}`}>
          <p className="chart-axis-label">Température (°C)</p>
          <ChartContainer config={chartConfig} className="temperature-chart">
            <LineChart data={points} accessibilityLayer margin={{ top: 14, right: 16, bottom: 8, left: 0 }}
              aria-label={`Évolution de la température de ${equipment.name}`} aria-describedby="chart-description">
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={value => String(value).slice(8)} tickLine={false} axisLine={false}
                tickMargin={10} minTickGap={22} interval="preserveStartEnd" padding={{ left: 10, right: 10 }} />
              <YAxis domain={temperatureDomain(points)} width={48} tickLine={false} axisLine={false} tickMargin={8}
                tickFormatter={value => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)} />
              <ChartTooltip content={<ReadingTooltip />} isAnimationActive={false} cursor={{ stroke: "#c7b7ba", strokeDasharray: "3 3" }} />
              <Line dataKey="threshold" name="Seuil du relevé" type="stepAfter" stroke="var(--color-threshold)"
                strokeWidth={1.8} strokeDasharray="5 5" dot={{ r: 2 }} activeDot={false} connectNulls={false} isAnimationActive={false} />
              <Line dataKey="temperature" name="Température mesurée" type="linear" stroke="var(--color-temperature)"
                strokeWidth={2.5} dot={<ReadingDot />} activeDot={<ReadingDot active />} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ChartContainer>
          <figcaption>
            <p className="chart-axis-label chart-x-label">Jour du mois</p>
            <ul className="chart-legend" aria-label="Légende du graphique">
              <li><span className="chart-line-key" aria-hidden="true" />Température mesurée</li>
              <li><span className="chart-line-key threshold-key" aria-hidden="true" />Seuil du relevé</li>
              {summary.overCount > 0 && <li><span className="chart-dot-key" aria-hidden="true" />Dépassement du seuil</li>}
            </ul>
            <p id="chart-description" className="muted-note">{summary.count === 1 ? "Une seule mesure : un point est affiché. " : ""}Les jours sans mesure interrompent la courbe. Le seuil est celui enregistré avec chaque relevé. Touchez la courbe ou utilisez les flèches du clavier pour consulter les valeurs.</p>
          </figcaption>
        </figure>
        <details className="chart-data">
          <summary>Voir les {summary.count} mesure{summary.count > 1 ? "s" : ""} de cet équipement</summary>
          <Table className="chart-data-table">
            <TableCaption className="sr-only">Valeurs exactes : {equipment.name}, {monthLabel}.</TableCaption>
            <TableHeader><TableRow><TableHead scope="col">Date / heure</TableHead><TableHead scope="col">Température</TableHead><TableHead scope="col">Seuil du relevé</TableHead><TableHead scope="col">Dépassement</TableHead></TableRow></TableHeader>
            <TableBody>{measured.map(point => <TableRow key={point.date}>
              <TableCell>{dateLabel(point.date)}<span className="chart-table-time">{point.time}</span></TableCell>
              <TableCell className={point.over ? "chart-exceedance" : undefined}>{displayTemp(point.temperature)} °C</TableCell>
              <TableCell>{point.threshold === null ? "Non disponible" : `${displayTemp(point.threshold)} °C`}</TableCell>
              <TableCell>{point.threshold === null ? "Non vérifiable" : point.over ? "Oui" : "Non"}</TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </details>
      </>}
    <p className="muted-note chart-source-note">Source : relevés enregistrés dans l’application. Les saisies faites uniquement dans Excel ne sont pas ajoutées automatiquement.</p>
  </div>;
}

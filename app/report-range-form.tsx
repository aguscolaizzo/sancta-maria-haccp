"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CalendarDays, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  customRange,
  dayRange,
  monthRange,
  reportRangeQuery,
  weekRange,
  type ReportPeriod,
  type ReportRange,
} from "@/lib/weekly-report";

const PERIOD_LABELS: Record<ReportPeriod, string> = {
  day: "Jour",
  week: "Semaine",
  month: "Mois",
  custom: "Dates personnalisées",
};

function shortDate(value: string) {
  return value.split("-").reverse().join("/");
}

function selectedRange(
  period: ReportPeriod,
  date: string,
  month: string,
  from: string,
  to: string,
): ReportRange | null {
  try {
    const range =
      period === "day"
        ? dayRange(date)
        : period === "week"
          ? weekRange(date)
          : period === "month"
            ? monthRange(month)
            : customRange(from, to);
    return { period, ...range };
  } catch {
    return null;
  }
}

export default function ReportRangeForm({
  initialPeriod,
  initialStart,
  initialEnd,
  variant = "launcher",
}: {
  initialPeriod: ReportPeriod;
  initialStart: string;
  initialEnd: string;
  variant?: "launcher" | "toolbar";
}) {
  const [period, setPeriod] = useState<ReportPeriod>(initialPeriod),
    [date, setDate] = useState(initialStart),
    [month, setMonth] = useState(initialStart.slice(0, 7)),
    [from, setFrom] = useState(initialStart),
    [to, setTo] = useState(initialEnd),
    range = useMemo(
      () => selectedRange(period, date, month, from, to),
      [period, date, month, from, to],
    );

  function submit(event: FormEvent) {
    event.preventDefault();
    if (range)
      location.assign(`/reports/weekly?${reportRangeQuery(range)}`);
  }

  return (
    <form className={`report-range-form ${variant}`} onSubmit={submit}>
      <div className="report-range-controls">
        <label className="field">
          Période
          <select
            className="input"
            value={period}
            onChange={(event) =>
              setPeriod(event.target.value as ReportPeriod)
            }
          >
            {Object.entries(PERIOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {(period === "day" || period === "week") && (
          <label className="field">
            {period === "day" ? "Date du rapport" : "Semaine contenant le"}
            <Input
              className="input"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>
        )}
        {period === "month" && (
          <label className="field">
            Mois du rapport
            <Input
              className="input"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              required
            />
          </label>
        )}
        {period === "custom" && (
          <>
            <label className="field">
              Date de début
              <Input
                className="input"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(event) => setFrom(event.target.value)}
                required
              />
            </label>
            <label className="field">
              Date de fin
              <Input
                className="input"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => setTo(event.target.value)}
                required
              />
            </label>
          </>
        )}
      </div>
      {variant === "launcher" && (
        <div className={`weekly-range ${range ? "" : "invalid"}`} aria-live="polite">
          <CalendarDays size={18} />
          <span>
            <strong>
              {range
                ? range.start === range.end
                  ? shortDate(range.start)
                  : `Du ${shortDate(range.start)} au ${shortDate(range.end)}`
                : "Vérifiez les dates sélectionnées"}
            </strong>
            <small>
              Le document est préparé pour une impression A4 ou un
              enregistrement en PDF.
            </small>
          </span>
        </div>
      )}
      <Button className="button primary" type="submit" disabled={!range}>
        <FileDown size={18} />
        {variant === "toolbar" ? "Afficher" : "Créer le rapport HACCP"}
      </Button>
    </form>
  );
}

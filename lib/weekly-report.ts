const DATE = /^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const MONTH = /^20\d{2}-(0[1-9]|1[0-2])$/;
const LOCAL_DATE_TIME = /^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])T([01]\d|2[0-3]):[0-5]\d$/;

export type ReportPeriod = "day" | "week" | "month" | "custom";
export type ReportRange = {
  period: ReportPeriod;
  start: string;
  end: string;
  next: string;
};

export function validReportDate(value: string) {
  if (!DATE.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function addCalendarDays(value: string, amount: number) {
  if (!validReportDate(value)) throw new Error("Date invalide.");
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function weekRange(value: string) {
  if (!validReportDate(value)) throw new Error("Date invalide.");
  const date = new Date(`${value}T12:00:00Z`);
  const weekday = date.getUTCDay();
  const start = addCalendarDays(value, -(weekday === 0 ? 6 : weekday - 1));
  return {
    start,
    end: addCalendarDays(start, 6),
    next: addCalendarDays(start, 7),
  };
}

export function dayRange(value: string) {
  if (!validReportDate(value)) throw new Error("Date invalide.");
  return {
    start: value,
    end: value,
    next: addCalendarDays(value, 1),
  };
}

export function monthRange(value: string) {
  if (!MONTH.test(value)) throw new Error("Mois invalide.");
  const start = `${value}-01`,
    date = new Date(`${start}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  const next = date.toISOString().slice(0, 10);
  return {
    start,
    end: addCalendarDays(next, -1),
    next,
  };
}

export function customRange(start: string, end: string) {
  if (!validReportDate(start) || !validReportDate(end))
    throw new Error("Dates invalides.");
  if (end < start)
    throw new Error("La date de fin doit suivre la date de début.");
  return {
    start,
    end,
    next: addCalendarDays(end, 1),
  };
}

const stringParam = (value: unknown) =>
  typeof value === "string" ? value : undefined;

export function resolveReportRange(
  params: Record<string, unknown>,
  fallbackDate: string,
): ReportRange {
  const requestedPeriod = stringParam(params.period),
    period: ReportPeriod = ["day", "week", "month", "custom"].includes(
      requestedPeriod ?? "",
    )
      ? (requestedPeriod as ReportPeriod)
      : "week";
  try {
    if (period === "day") {
      const range = dayRange(stringParam(params.date) ?? fallbackDate);
      return { period, ...range };
    }
    if (period === "month") {
      const range = monthRange(
        stringParam(params.month) ?? fallbackDate.slice(0, 7),
      );
      return { period, ...range };
    }
    if (period === "custom") {
      const range = customRange(
        stringParam(params.from) ?? fallbackDate,
        stringParam(params.to) ?? fallbackDate,
      );
      return { period, ...range };
    }
    const legacyWeek = stringParam(params.week),
      range = weekRange(stringParam(params.date) ?? legacyWeek ?? fallbackDate);
    return { period: "week", ...range };
  } catch {
    return { period: "week", ...weekRange(fallbackDate) };
  }
}

export function reportRangeQuery(range: ReportRange) {
  const query = new URLSearchParams({ period: range.period });
  if (range.period === "month") query.set("month", range.start.slice(0, 7));
  else if (range.period === "custom") {
    query.set("from", range.start);
    query.set("to", range.end);
  } else query.set("date", range.start);
  return query.toString();
}

export function parisLocalToUtc(value: string) {
  if (!LOCAL_DATE_TIME.test(value)) throw new Error("Date et heure invalides.");
  const guess = new Date(`${value}:00Z`);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(guess);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const displayedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  const offset = displayedAsUtc - guess.valueOf();
  return new Date(guess.valueOf() - offset).toISOString();
}

export type ExpiryBucket = "expired" | "today" | "tomorrow" | "later";

export function classifyExpiry(expiresAt: string, localNow: string): ExpiryBucket {
  if (!LOCAL_DATE_TIME.test(expiresAt) || !LOCAL_DATE_TIME.test(localNow))
    throw new Error("Date d’échéance invalide.");
  if (expiresAt < localNow) return "expired";
  const today = localNow.slice(0, 10);
  if (expiresAt.slice(0, 10) === today) return "today";
  if (expiresAt.slice(0, 10) === addCalendarDays(today, 1)) return "tomorrow";
  return "later";
}

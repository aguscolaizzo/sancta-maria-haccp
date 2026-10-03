import { daysOfMonth, isValidDate, type EQUIPMENT, type Reading } from "./frigo";

export type EquipmentId = (typeof EQUIPMENT)[number]["id"];

export type TemperaturePoint = {
  date: string;
  time: string | null;
  temperature: number | null;
  threshold: number | null;
  over: boolean;
};

export type MeasuredTemperaturePoint = TemperaturePoint & {
  time: string;
  temperature: number;
};

export function isMeasuredPoint(point: TemperaturePoint): point is MeasuredTemperaturePoint {
  return point.temperature !== null && point.time !== null;
}

/** Calendar gaps stay null: neither zeroes nor interpolated measurements. */
export function temperatureHistory(
  records: readonly Reading[],
  month: string,
  equipmentId: EquipmentId,
  today: string,
): TemperaturePoint[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !isValidDate(`${month}-01`) || !isValidDate(today)) return [];
  const byDate = new Map<string, Reading>();
  for (const record of records) {
    if (!record.date.startsWith(`${month}-`) || record.date > today || !isValidDate(record.date)) continue;
    const previous = byDate.get(record.date);
    if (!previous || record.revision > previous.revision ||
      (record.revision === previous.revision && record.updatedAt > previous.updatedAt)) {
      byDate.set(record.date, record);
    }
  }
  return daysOfMonth(month).filter(date => date <= today).map(date => {
    const record = byDate.get(date);
    const value = record?.temperatures[equipmentId];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return { date, time: null, temperature: null, threshold: null, over: false };
    }
    const savedThreshold = record?.thresholds[equipmentId];
    const threshold = typeof savedThreshold === "number" && Number.isFinite(savedThreshold) ? savedThreshold : null;
    return { date, time: record!.time, temperature: value, threshold, over: threshold !== null && value > threshold };
  });
}

export function temperatureSummary(points: readonly TemperaturePoint[]) {
  const measured = points.filter(isMeasuredPoint).sort((a, b) => a.date.localeCompare(b.date));
  if (!measured.length) return null;
  const temperatures = measured.map(point => point.temperature);
  return {
    count: measured.length,
    minimum: Math.min(...temperatures),
    maximum: Math.max(...temperatures),
    latest: measured[measured.length - 1],
    overCount: measured.filter(point => point.over).length,
  };
}

/** Keep every observed temperature and historical limit visible, including negatives. */
export function temperatureDomain(points: readonly TemperaturePoint[]): [number, number] {
  const values = points.flatMap(point => [point.temperature, point.threshold])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!values.length) return [-1, 1];
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const padding = Math.max(1, (maximum - minimum) * 0.15);
  return [Math.floor((minimum - padding) * 10) / 10, Math.ceil((maximum + padding) * 10) / 10];
}

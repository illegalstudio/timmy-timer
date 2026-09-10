import { entryAmount, entryMinutes, toLocalInput } from "./time";
import type { Entry } from "./types";

export type Forecast = {
  /** Average tracked minutes on an elapsed weekday, and on an elapsed weekend day. */
  weekdayMinutes: number;
  weekendMinutes: number;
  /** Totals expected once the period is over. */
  minutes: number;
  billableCents: number;
  toInvoiceCents: number;
};

/**
 * Projects a period that is still running, at the pace set by the days that
 * have already gone by. Weekdays and weekend days are averaged apart, so a
 * week of untracked Saturdays is not read as a drop in pace.
 *
 * Returns null whenever a projection would be guesswork rather than an
 * extrapolation: a period that is over, one that has not started, or one with
 * no completed day to learn from.
 */
export function getForecast(
  entries: Entry[],
  from: string,
  to: string,
  today: string,
): Forecast | null {
  if (today < from || today > to) return null;

  const days = eachDay(from, to);
  const completed = days.filter((day) => day < today);
  if (!completed.length) return null;

  const minutesByDay = new Map<string, number>();
  for (const entry of entries) {
    const day = toLocalInput(entry.started_at).slice(0, 10);
    minutesByDay.set(day, (minutesByDay.get(day) ?? 0) + entryMinutes(entry));
  }

  const average = (list: string[]) =>
    list.length
      ? list.reduce((total, day) => total + (minutesByDay.get(day) ?? 0), 0) /
        list.length
      : 0;

  const weekdayMinutes = average(completed.filter((day) => !isWeekend(day)));
  const weekendMinutes = average(completed.filter((day) => isWeekend(day)));
  const expected = (day: string) =>
    isWeekend(day) ? weekendMinutes : weekdayMinutes;

  const tracked = entries.reduce(
    (total, entry) => total + entryMinutes(entry),
    0,
  );
  // Today is only part-way through: top it up to the usual pace, never down.
  const todayLeft = Math.max(
    0,
    expected(today) - (minutesByDay.get(today) ?? 0),
  );
  const remaining = days
    .filter((day) => day > today)
    .reduce((total, day) => total + expected(day), 0);
  const extra = todayLeft + remaining;
  if (!tracked || !extra) return null;

  // Value follows the mix of billable work and the rates seen so far.
  const billable = entries.filter((entry) => entry.billable);
  const billableMinutes = billable.reduce(
    (total, entry) => total + entryMinutes(entry),
    0,
  );
  const billableCents = billable.reduce(
    (total, entry) => total + entryAmount(entry),
    0,
  );
  const billableShare = billableMinutes / tracked;
  const centsPerMinute = billableMinutes ? billableCents / billableMinutes : 0;
  const extraCents = Math.round(extra * billableShare * centsPerMinute);
  const toInvoiceCents = billable
    .filter((entry) => !entry.invoiced)
    .reduce((total, entry) => total + entryAmount(entry), 0);

  return {
    weekdayMinutes,
    weekendMinutes,
    minutes: tracked + extra,
    billableCents: billableCents + extraCents,
    // Work still to come has not been invoiced yet, so it all lands here.
    toInvoiceCents: toInvoiceCents + extraCents,
  };
}

/** Minutes the pace implies for a stretch of days. */
export function expectedMinutes(forecast: Forecast, days: string[]) {
  return days.reduce(
    (total, day) =>
      total +
      (isWeekend(day) ? forecast.weekendMinutes : forecast.weekdayMinutes),
    0,
  );
}

export function eachDay(from: string, to: string) {
  const days: string[] = [];
  const at = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  while (at <= end) {
    days.push(at.toLocaleDateString("sv-SE"));
    at.setDate(at.getDate() + 1);
  }
  return days;
}

function isWeekend(day: string) {
  const weekday = new Date(`${day}T12:00:00`).getDay();
  return weekday === 0 || weekday === 6;
}

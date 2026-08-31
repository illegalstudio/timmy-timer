import type { Entry } from "./types";

export function today(): string {
  return new Date().toLocaleDateString("sv-SE");
}

export function formatMoney(cents: number, locale = "en-GB"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function entryMinutes(entry: Entry): number {
  const start = new Date(entry.started_at).getTime();
  const end = new Date(entry.ended_at).getTime();
  return Math.max(0, (end - start) / 60_000);
}

export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60)
    .toString()
    .padStart(2, "0");
  return `${hours}h ${minutes}m`;
}

export function entryAmount(entry: Entry): number {
  return Math.round((entryMinutes(entry) * entry.hourly_rate_cents) / 60);
}

export function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function changeDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return value.toLocaleDateString("sv-SE");
}

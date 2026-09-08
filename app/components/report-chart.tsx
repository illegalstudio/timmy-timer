"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "../i18n/i18n-provider";
import { entryMinutes, formatDuration } from "../lib/time";
import type { Entry } from "../lib/types";

// Beyond this the legend stops being readable, so the tail folds into "Other"
// rather than inventing more colours.
const MAX_SERIES = 8;
const OTHER_KEY = "other";
const OTHER_COLOR = "#6f6878";
const AXIS_STEPS = [15, 30, 60, 120, 240, 480, 960, 1920, 2880, 5760, 11520];
const SURFACE = "#fffdfa";
const LINE = "#ded5ca";
const LINE_STRONG = "#cabdb2";
const INK_SOFT = "#5f5366";

type Unit = "hour" | "day" | "week" | "month";
type Series = { key: string; name: string; color: string };
type Row = {
  key: string;
  label: string;
  caption: string;
  total: number;
  // One numeric field per series.
  [field: string]: string | number;
};

export function ReportChart({
  entries,
  from,
  to,
}: {
  entries: Entry[];
  from: string;
  to: string;
}) {
  const { localeTag, t } = useI18n();

  const { rows, series } = useMemo(
    () => buildChart(entries, from, to, localeTag, t("reports.chartOther")),
    [entries, from, to, localeTag, t],
  );

  const peak = rows.reduce((best, row) => Math.max(best, row.total), 0);
  if (!peak) return null;

  const step =
    AXIS_STEPS.find((value) => peak / value <= 4) ?? AXIS_STEPS.at(-1)!;
  const axisMax = Math.ceil(peak / step) * step;
  const ticks = Array.from({ length: axisMax / step + 1 }, (_, i) => i * step);
  const labelStep = rows.length <= 16 ? 1 : rows.length <= 32 ? 2 : 5;

  return (
    <figure className="report-chart" aria-label={t("reports.chartAria")}>
      <ResponsiveContainer width="100%" height={190}>
        <BarChart
          accessibilityLayer
          data={rows}
          margin={{ top: 20, right: 6, bottom: 0, left: 0 }}
          barCategoryGap="12%"
        >
          <CartesianGrid vertical={false} stroke={LINE} strokeDasharray="3 4" />
          <XAxis
            dataKey="label"
            interval={labelStep - 1}
            tickLine={false}
            axisLine={{ stroke: LINE_STRONG }}
            tick={{ fill: INK_SOFT, fontSize: 10 }}
          />
          <YAxis
            width={42}
            domain={[0, axisMax]}
            ticks={ticks}
            tickFormatter={formatAxisValue}
            tickLine={false}
            axisLine={false}
            tick={{ fill: INK_SOFT, fontSize: 10 }}
          />
          <Tooltip
            cursor={{ fill: "rgba(244, 201, 93, 0.2)" }}
            content={<ChartTooltip />}
          />
          {series.map((item) => (
            <Bar
              key={item.key}
              dataKey={item.key}
              name={item.name}
              stackId="time"
              fill={item.color}
              stroke={SURFACE}
              strokeWidth={2}
              radius={3}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      {series.length > 1 && (
        <figcaption className="chart-legend">
          {series.map((item) => (
            <span key={item.key}>
              <i style={{ background: item.color }} />
              {item.name}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}

type TooltipEntry = {
  name?: string;
  value?: number;
  color?: string;
  payload?: Row;
};

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const parts = (payload ?? []).filter(
    (item) => typeof item.value === "number" && item.value > 0,
  );
  return (
    <div className="chart-tip">
      <strong>{row.caption}</strong>
      <b>{formatDuration(row.total)}</b>
      {parts.length > 1 &&
        parts.map((item) => (
          <span key={item.name}>
            <i style={{ background: item.color }} />
            {item.name}
            <em>{formatDuration(item.value ?? 0)}</em>
          </span>
        ))}
    </div>
  );
}

function buildChart(
  entries: Entry[],
  from: string,
  to: string,
  locale: string,
  otherLabel: string,
) {
  const unit = getUnit(from, to);
  const minutesByProject = new Map<number, number>();
  for (const entry of entries) {
    minutesByProject.set(
      entry.project_id,
      (minutesByProject.get(entry.project_id) ?? 0) + entryMinutes(entry),
    );
  }
  // Rank by tracked time so the legend keeps the projects that matter.
  const ranked = [...minutesByProject.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
  const kept = new Set(ranked.slice(0, MAX_SERIES));

  const seriesOf = (entry: Entry): Series =>
    kept.has(entry.project_id)
      ? {
          key: String(entry.project_id),
          name: entry.project_name,
          color: entry.project_color,
        }
      : { key: OTHER_KEY, name: otherLabel, color: OTHER_COLOR };

  const totals = new Map<string, Map<string, number>>();
  const seen = new Map<string, Series>();
  for (const entry of entries) {
    const slot = slotKey(new Date(entry.started_at), unit);
    const item = seriesOf(entry);
    if (!seen.has(item.key)) seen.set(item.key, item);
    const bucket = totals.get(slot) ?? new Map<string, number>();
    bucket.set(item.key, (bucket.get(item.key) ?? 0) + entryMinutes(entry));
    totals.set(slot, bucket);
  }

  const order = [...ranked.filter((id) => kept.has(id)).map(String), OTHER_KEY];
  const series = [...seen.values()].sort(
    (a, b) => order.indexOf(a.key) - order.indexOf(b.key),
  );

  const rows: Row[] = generateSlots(unit, from, to, locale).map((slot) => {
    const bucket = totals.get(slot.key);
    const row: Row = { ...slot, total: 0 };
    let total = 0;
    for (const item of series) {
      const minutes = bucket?.get(item.key) ?? 0;
      row[item.key] = minutes;
      total += minutes;
    }
    row.total = total;
    return row;
  });

  return { rows, series };
}

function getUnit(from: string, to: string): Unit {
  const span =
    Math.round(
      (atMidday(to).getTime() - atMidday(from).getTime()) / 86_400_000,
    ) + 1;
  if (span <= 1) return "hour";
  if (span <= 62) return "day";
  if (span <= 180) return "week";
  return "month";
}

function slotKey(date: Date, unit: Unit) {
  if (unit === "hour") return String(date.getHours());
  if (unit === "day") return date.toLocaleDateString("sv-SE");
  if (unit === "week") return startOfWeek(date).toLocaleDateString("sv-SE");
  return date.toLocaleDateString("sv-SE").slice(0, 7);
}

function generateSlots(unit: Unit, from: string, to: string, locale: string) {
  const slots: Array<{ key: string; label: string; caption: string }> = [];
  const start = atMidday(from);
  const end = atMidday(to);

  if (unit === "hour") {
    for (let hour = 0; hour < 24; hour++) {
      const next = String((hour + 1) % 24).padStart(2, "0");
      slots.push({
        key: String(hour),
        label: String(hour).padStart(2, "0"),
        caption: `${String(hour).padStart(2, "0")}:00 – ${next}:00`,
      });
    }
    return slots;
  }

  if (unit === "day") {
    for (const at = new Date(start); at <= end; at.setDate(at.getDate() + 1)) {
      slots.push({
        key: at.toLocaleDateString("sv-SE"),
        label: String(at.getDate()),
        caption: at.toLocaleDateString(locale, {
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
      });
    }
    return slots;
  }

  if (unit === "week") {
    const short = { day: "numeric", month: "short" } as const;
    for (
      const at = startOfWeek(start);
      at <= end;
      at.setDate(at.getDate() + 7)
    ) {
      const last = new Date(at);
      last.setDate(last.getDate() + 6);
      slots.push({
        key: at.toLocaleDateString("sv-SE"),
        label: at.toLocaleDateString(locale, short),
        caption: `${at.toLocaleDateString(locale, short)} – ${last.toLocaleDateString(locale, short)}`,
      });
    }
    return slots;
  }

  for (
    const at = new Date(start.getFullYear(), start.getMonth(), 1, 12);
    at <= end;
    at.setMonth(at.getMonth() + 1)
  ) {
    slots.push({
      key: at.toLocaleDateString("sv-SE").slice(0, 7),
      label: at.toLocaleDateString(locale, { month: "short" }),
      caption: at.toLocaleDateString(locale, {
        month: "long",
        year: "numeric",
      }),
    });
  }
  return slots;
}

function startOfWeek(date: Date) {
  const value = new Date(date);
  value.setHours(12, 0, 0, 0);
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  return value;
}

// Midday, so daylight-saving shifts cannot move a date across a boundary.
function atMidday(value: string) {
  return new Date(`${value}T12:00:00`);
}

function formatAxisValue(minutes: number) {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

"use client";

import {
  useMemo,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "../i18n/i18n-provider";
import {
  eachDay,
  expectedMinutes,
  getForecast,
  spreadMinutes,
  type Simulation,
} from "../lib/forecast";
import { entryMinutes, formatDuration, today as todayValue } from "../lib/time";
import type { Entry } from "../lib/types";

// Beyond this the legend stops being readable, so the tail folds into "Other"
// rather than inventing more colours.
const MAX_SERIES = 8;
const OTHER_KEY = "other";
const OTHER_COLOR = "#6f6878";
const AXIS_STEPS = [15, 30, 60, 120, 240, 480, 960, 1920, 2880, 5760, 11520];
const SURFACE = "#fffdfa";
const PACE = "#2d2038";
const LINE = "#ded5ca";
const LINE_STRONG = "#cabdb2";
const INK_SOFT = "#5f5366";
const GHOST_PATTERN = "report-chart-ghost";
// Dragging snaps to this many minutes, so a bar never lands on 3h 07m.
const SNAP = 15;

type Unit = "hour" | "day" | "week" | "month";
type Series = { key: string; name: string; color: string };
type Row = {
  key: string;
  label: string;
  caption: string;
  total: number;
  /** Days of a bucket that is still to come, hence open to simulation. */
  ghostDays?: string[];
  simulated?: boolean;
  // One numeric field per series.
  [field: string]: string | number | string[] | boolean | undefined;
};

export function ReportChart({
  entries,
  from,
  to,
  projectId,
  onSelectProject,
  simulation,
  onSimulate,
}: {
  entries: Entry[];
  from: string;
  to: string;
  projectId: string;
  onSelectProject: (value: string) => void;
  simulation: Simulation;
  onSimulate: (changes: Array<[string, number]>) => void;
}) {
  const { localeTag, t } = useI18n();
  // The scale is frozen while a bar is being dragged: if it followed the
  // value, the bar would slide away from under the pointer.
  const [frozen, setFrozen] = useState<Axis | null>(null);

  const { rows, series, forecast } = useMemo(
    () =>
      buildChart(
        entries,
        from,
        to,
        localeTag,
        t("reports.chartOther"),
        simulation,
      ),
    [entries, from, to, localeTag, t, simulation],
  );

  const peak = rows.reduce(
    (best, row) =>
      Math.max(
        best,
        row.total,
        Number(row.paceProjected ?? 0),
        Number(row.ghost ?? 0),
      ),
    0,
  );
  if (!peak) return null;

  const axis = frozen ?? getAxis(peak, simulation.size > 0);
  const ticks = Array.from(
    { length: axis.max / axis.step + 1 },
    (_, i) => i * axis.step,
  );
  const labelStep = rows.length <= 16 ? 1 : rows.length <= 32 ? 2 : 5;
  const canSimulate = forecast && rows.some((row) => row.ghostDays);

  const simulate = (days: string[], minutes: number) =>
    forecast && onSimulate(spreadMinutes(forecast, days, minutes));

  return (
    <figure className="report-chart" aria-label={t("reports.chartAria")}>
      <svg width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <pattern
            id={GHOST_PATTERN}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="2" height="6" fill={PACE} opacity="0.28" />
          </pattern>
        </defs>
      </svg>
      <ResponsiveContainer width="100%" height={190}>
        <ComposedChart
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
            domain={[0, axis.max]}
            ticks={ticks}
            tickFormatter={formatAxisValue}
            tickLine={false}
            axisLine={false}
            tick={{ fill: INK_SOFT, fontSize: 10 }}
          />
          <Tooltip
            cursor={{ fill: "rgba(244, 201, 93, 0.2)" }}
            content={<ChartTooltip simulatedLabel={t("reports.simulated")} />}
          />
          {forecast && (
            <>
              <Line
                dataKey="paceActual"
                name={t("reports.chartPace")}
                type="linear"
                stroke={PACE}
                strokeWidth={2}
                dot={false}
                activeDot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                dataKey="paceProjected"
                name={t("reports.chartPace")}
                type="linear"
                stroke={PACE}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                activeDot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            </>
          )}
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
          {canSimulate && (
            <Bar
              dataKey="ghost"
              name={t("reports.chartGhost")}
              stackId="time"
              isAnimationActive={false}
              shape={
                <GhostBar
                  max={axis.max}
                  label={(row, minutes) =>
                    t("reports.chartGhostAria", {
                      period: row.caption,
                      value: formatDuration(minutes),
                    })
                  }
                  onChange={simulate}
                  onDragStart={() => setFrozen(axis)}
                  onDragEnd={() => setFrozen(null)}
                />
              }
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      {(series.length > 1 || projectId !== "all" || forecast) && (
        <figcaption className="chart-legend">
          {series.map((item) =>
            // "Other" stands for several projects, so there is nothing single
            // to filter by: it stays plain text.
            item.key === OTHER_KEY ? (
              <span className="chart-legend-item" key={item.key}>
                <i style={{ background: item.color }} />
                {item.name}
              </span>
            ) : (
              <button
                className="chart-legend-item"
                type="button"
                key={item.key}
                aria-pressed={projectId === item.key}
                onClick={() =>
                  onSelectProject(projectId === item.key ? "all" : item.key)
                }
              >
                <i style={{ background: item.color }} />
                {item.name}
              </button>
            ),
          )}
          {forecast && (
            <span className="chart-legend-item">
              <i className="chart-legend-pace" />
              {t("reports.chartPace")}
            </span>
          )}
          {canSimulate && (
            <span className="chart-legend-item">
              <i className="chart-legend-ghost" />
              {t("reports.chartGhost")}
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
}

type TooltipEntry = {
  name?: string;
  dataKey?: string | number;
  value?: number;
  color?: string;
  payload?: Row;
};

function ChartTooltip({
  active,
  payload,
  simulatedLabel,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  simulatedLabel: string;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const parts = (payload ?? []).filter(
    (item) =>
      typeof item.value === "number" &&
      item.value > 0 &&
      !String(item.dataKey ?? "").startsWith("pace") &&
      item.dataKey !== "ghost",
  );
  const pace = (payload ?? []).find((item) =>
    String(item.dataKey ?? "").startsWith("pace"),
  );
  const paceValue = typeof pace?.value === "number" ? pace.value : null;
  const paceLabel = row.simulated ? simulatedLabel : pace?.name;
  // A bucket still ahead has nothing tracked: its headline is the workload
  // expected (or drawn) for it, not a zero.
  const ahead = Boolean(row.ghostDays) && paceValue !== null;
  return (
    <div className="chart-tip">
      <strong>{row.caption}</strong>
      <b>{formatDuration(ahead ? paceValue! : row.total)}</b>
      {ahead ? (
        <span className="chart-tip-pace">{paceLabel}</span>
      ) : (
        <>
          {parts.length > 1 &&
            parts.map((item) => (
              <span key={item.name}>
                <i style={{ background: item.color }} />
                {item.name}
                <em>{formatDuration(item.value ?? 0)}</em>
              </span>
            ))}
          {paceValue !== null && (
            <span className="chart-tip-pace">
              {paceLabel}
              <em>{formatDuration(paceValue)}</em>
            </span>
          )}
        </>
      )}
    </div>
  );
}

type Axis = { step: number; max: number };

function clamp(minutes: number, max = Infinity) {
  return Math.min(max, Math.max(0, Math.round(minutes / SNAP) * SNAP));
}

function getAxis(peak: number, headroom: boolean): Axis {
  const step =
    AXIS_STEPS.find((value) => peak / value <= 4) ?? AXIS_STEPS.at(-1)!;
  // A simulation keeps a spare step above the tallest bar, so there is always
  // room to drag higher than the current peak.
  const max = headroom
    ? (Math.floor(peak / step) + 1) * step
    : Math.ceil(peak / step) * step;
  return { step, max };
}

// Recharts hands the rectangle of the ghost bar to this shape; the bar itself
// is the drag handle, and doubles as a slider for the keyboard.
function GhostBar({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  payload,
  parentViewBox,
  max,
  label,
  onChange,
  onDragStart,
  onDragEnd,
}: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: Row;
  parentViewBox?: { x: number; y: number; width: number; height: number };
  max: number;
  label: (row: Row, minutes: number) => string;
  onChange: (days: string[], minutes: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const days = payload?.ghostDays;
  if (!payload || !days || !parentViewBox || width <= 0) return null;
  const minutes = Number(payload.ghost ?? 0);

  // The chart rebuilds this node on every value change, so the drag cannot
  // live on the element: it listens on the window until the pointer lifts.
  function start(event: PointerEvent<SVGGElement>) {
    const svg = event.currentTarget.ownerSVGElement;
    const box = parentViewBox;
    if (event.button !== 0 || !svg || !box || !days) return;
    event.preventDefault();
    const bucket = days;
    let last = minutes;

    const move = (moved: globalThis.PointerEvent) => {
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const point = new DOMPoint(moved.clientX, moved.clientY).matrixTransform(
        matrix.inverse(),
      );
      const value = clamp(
        ((box.y + box.height - point.y) / box.height) * max,
        max,
      );
      if (value === last) return;
      last = value;
      onChange(bucket, value);
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      onDragEnd();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    onDragStart();
  }

  function keyed(event: KeyboardEvent<SVGGElement>) {
    if (!days) return;
    const stride = event.shiftKey ? 60 : SNAP;
    const next =
      event.key === "ArrowUp"
        ? minutes + stride
        : event.key === "ArrowDown"
          ? minutes - stride
          : event.key === "Home"
            ? 0
            : null;
    if (next === null) return;
    event.preventDefault();
    onChange(days, clamp(next));
  }

  const grip = Math.min(6, Math.max(3, width / 4));
  return (
    <g
      className="chart-ghost"
      tabIndex={0}
      role="slider"
      aria-label={label(payload, minutes)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={minutes}
      aria-valuetext={formatDuration(minutes)}
      onPointerDown={start}
      onKeyDown={keyed}
    >
      {/* A wider, invisible hit area so a thin bar is still easy to grab. */}
      <rect
        x={x - 4}
        y={Math.min(y, y + height) - 12}
        width={width + 8}
        height={Math.abs(height) + 16}
        fill="transparent"
      />
      <rect
        className="chart-ghost-fill"
        x={x}
        y={y}
        width={width}
        height={Math.abs(height)}
        rx={3}
        fill={`url(#${GHOST_PATTERN})`}
        stroke={PACE}
        strokeOpacity={0.45}
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <rect
        className="chart-ghost-grip"
        x={x}
        y={y - grip / 2}
        width={width}
        height={grip}
        rx={grip / 2}
        fill={PACE}
      />
    </g>
  );
}

function buildChart(
  entries: Entry[],
  from: string,
  to: string,
  locale: string,
  otherLabel: string,
  simulation: Simulation,
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

  const forecast = getForecast(entries, from, to, todayValue());

  const rows: Row[] = generateSlots(unit, from, to, locale).map((slot) => {
    const bucket = totals.get(slot.key);
    const { days, ...rest } = slot;
    const row: Row = { ...rest, total: 0 };
    let total = 0;
    for (const item of series) {
      const minutes = bucket?.get(item.key) ?? 0;
      row[item.key] = minutes;
      total += minutes;
    }
    row.total = total;

    if (forecast && days.length) {
      const pace = expectedMinutes(forecast, days, simulation);
      const now = todayValue();
      // The bucket holding today belongs to both lines, so they join up.
      if (days[0] <= now) row.paceActual = pace;
      if (days[days.length - 1] >= now) row.paceProjected = pace;
      // Only a bucket entirely ahead can be dragged: today is half spent.
      if (days[0] > now) {
        row.ghost = pace;
        row.ghostDays = days;
        row.simulated = days.some((day) => simulation.has(day));
      }
    }
    return row;
  });

  return { rows, series, forecast };
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

type Slot = { key: string; label: string; caption: string; days: string[] };

function generateSlots(unit: Unit, from: string, to: string, locale: string) {
  const slots: Slot[] = [];
  const start = atMidday(from);
  const end = atMidday(to);

  if (unit === "hour") {
    for (let hour = 0; hour < 24; hour++) {
      const next = String((hour + 1) % 24).padStart(2, "0");
      slots.push({
        key: String(hour),
        label: String(hour).padStart(2, "0"),
        caption: `${String(hour).padStart(2, "0")}:00 – ${next}:00`,
        days: [from],
      });
    }
    return slots;
  }

  if (unit === "day") {
    for (const at = new Date(start); at <= end; at.setDate(at.getDate() + 1)) {
      const day = at.toLocaleDateString("sv-SE");
      slots.push({
        key: day,
        label: String(at.getDate()),
        caption: at.toLocaleDateString(locale, {
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
        days: [day],
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
        days: clampDays(at, last, from, to),
      });
    }
    return slots;
  }

  for (
    const at = new Date(start.getFullYear(), start.getMonth(), 1, 12);
    at <= end;
    at.setMonth(at.getMonth() + 1)
  ) {
    const last = new Date(at.getFullYear(), at.getMonth() + 1, 0, 12);
    slots.push({
      key: at.toLocaleDateString("sv-SE").slice(0, 7),
      label: at.toLocaleDateString(locale, { month: "short" }),
      caption: at.toLocaleDateString(locale, {
        month: "long",
        year: "numeric",
      }),
      days: clampDays(at, last, from, to),
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

// A bucket at the edge of the range only covers the days inside it.
function clampDays(start: Date, end: Date, from: string, to: string) {
  const first = start.toLocaleDateString("sv-SE");
  const last = end.toLocaleDateString("sv-SE");
  return eachDay(first < from ? from : first, last > to ? to : last);
}

function formatAxisValue(minutes: number) {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

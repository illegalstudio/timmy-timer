"use client";

import { type PointerEvent as ReactPointerEvent, useState } from "react";
import { formatDuration, formatMoney, today } from "../lib/time";
import type { Entry, Mutate, SlotPreset } from "../lib/types";

const START_HOUR = 6;
const END_HOUR = 22;
const PIXELS_PER_MINUTE = 1.05;
const SNAP_MINUTES = 15;

type Preview = Record<number, SlotPreset>;
type Drag = SlotPreset & {
  id: number;
  mode: "move" | "resize";
  pointerY: number;
};

type WeekCalendarProps = {
  anchor: string;
  entries: Entry[];
  onCreate: (preset: SlotPreset) => void;
  onEdit: (entry: Entry) => void;
  mutate: Mutate;
};

export function CalendarView({
  anchor,
  entries,
  onCreate,
  onEdit,
  mutate,
}: WeekCalendarProps) {
  const start = getWeekStart(anchor);
  const days = getWeekDays(start);
  const [draft, setDraft] = useState<{
    day: number;
    start: number;
    end: number;
  } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [preview, setPreview] = useState<Preview>({});
  const calendarHeight = (END_HOUR - START_HOUR) * 60 * PIXELS_PER_MINUTE;

  const visibleEntries = entries.filter((entry) => {
    const entryStart = preview[entry.id]?.start ?? new Date(entry.started_at);
    return (
      entryStart >= start &&
      entryStart < new Date(start.getTime() + 7 * 86_400_000)
    );
  });
  const layouts = calculateOverlapLayouts(visibleEntries, preview);

  function pointerMinutes(event: ReactPointerEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const minutes = snap((event.clientY - bounds.top) / PIXELS_PER_MINUTE);
    return Math.max(0, Math.min((END_HOUR - START_HOUR) * 60, minutes));
  }

  function beginCreate(day: number, event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const startMinutes = pointerMinutes(event);
    setDraft({ day, start: startMinutes, end: startMinutes + SNAP_MINUTES });
  }

  function moveCreate(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draft) return;
    setDraft({
      ...draft,
      end: Math.max(draft.start + SNAP_MINUTES, pointerMinutes(event)),
    });
  }

  function finishCreate() {
    if (!draft) return;
    const slotStart = dateAtMinutes(
      days[draft.day],
      START_HOUR * 60 + draft.start,
    );
    const slotEnd = dateAtMinutes(days[draft.day], START_HOUR * 60 + draft.end);
    setDraft(null);
    onCreate({ start: slotStart, end: slotEnd });
  }

  function beginDrag(
    entry: Entry,
    mode: Drag["mode"],
    event: ReactPointerEvent,
  ) {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const slot = {
      start: new Date(entry.started_at),
      end: new Date(entry.ended_at),
    };
    setDrag({ id: entry.id, mode, pointerY: event.clientY, ...slot });
    setPreview({ [entry.id]: slot });
  }

  function moveDrag(event: ReactPointerEvent) {
    if (!drag) return;
    const delta = snap((event.clientY - drag.pointerY) / PIXELS_PER_MINUTE);
    let start = new Date(drag.start);
    let end = new Date(drag.end);
    if (drag.mode === "move") {
      start = new Date(start.getTime() + delta * 60_000);
      end = new Date(end.getTime() + delta * 60_000);
    } else {
      end = new Date(
        Math.max(
          start.getTime() + SNAP_MINUTES * 60_000,
          end.getTime() + delta * 60_000,
        ),
      );
    }
    setPreview({ [drag.id]: { start, end } });
  }

  async function finishDrag() {
    if (!drag) return;
    const slot = preview[drag.id];
    setDrag(null);
    setPreview({});
    if (slot) {
      await mutate("PATCH", {
        type: "entry-time",
        id: drag.id,
        startedAt: slot.start.toISOString(),
        endedAt: slot.end.toISOString(),
      });
    }
  }

  return (
    <div className="week-panel">
      <div className="week-scroll">
        <CalendarHeader days={days} />
        <div className="week-body" style={{ height: calendarHeight }}>
          <TimeAxis />
          <div className="day-columns">
            {days.map((day, dayIndex) => {
              const dayKey = day.toLocaleDateString("sv-SE");
              const dayEntries = visibleEntries.filter(
                (entry) =>
                  effectiveStart(entry, preview).toLocaleDateString("sv-SE") ===
                  dayKey,
              );
              return (
                <div
                  className="day-column"
                  key={day.toISOString()}
                  onPointerDown={(event) => beginCreate(dayIndex, event)}
                  onPointerMove={moveCreate}
                  onPointerUp={finishCreate}
                >
                  <GridLines />
                  {draft?.day === dayIndex && <DraftSlot draft={draft} />}
                  {dayEntries.map((entry) => (
                    <CalendarSlot
                      key={entry.id}
                      entry={entry}
                      preview={preview[entry.id]}
                      layout={
                        layouts.get(entry.id) ?? { column: 0, columns: 1 }
                      }
                      onEdit={onEdit}
                      onPointerDown={beginDrag}
                      onPointerMove={moveDrag}
                      onPointerUp={finishDrag}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function CalendarHeader({ days }: { days: Date[] }) {
  return (
    <div className="week-header">
      <div className="time-gutter" />
      {days.map((day) => (
        <div
          className={`day-head ${day.toLocaleDateString("sv-SE") === today() ? "today" : ""}`}
          key={day.toISOString()}
        >
          <span>{day.toLocaleDateString("it-IT", { weekday: "short" })}</span>
          <b>{day.getDate()}</b>
        </div>
      ))}
    </div>
  );
}

function TimeAxis() {
  return (
    <div className="time-axis">
      {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => (
        <span key={index} style={{ top: index * 60 * PIXELS_PER_MINUTE }}>
          {String(START_HOUR + index).padStart(2, "0")}:00
        </span>
      ))}
    </div>
  );
}

function GridLines() {
  return (
    <>
      {Array.from({ length: (END_HOUR - START_HOUR) * 2 }, (_, index) => (
        <i
          className="half-line"
          key={index}
          style={{ top: index * 30 * PIXELS_PER_MINUTE }}
        />
      ))}
    </>
  );
}

function DraftSlot({ draft }: { draft: { start: number; end: number } }) {
  return (
    <div
      className="draft-slot"
      style={{
        top: draft.start * PIXELS_PER_MINUTE,
        height: (draft.end - draft.start) * PIXELS_PER_MINUTE,
      }}
    >
      Nuovo slot
    </div>
  );
}

function CalendarSlot({
  entry,
  preview,
  layout,
  onEdit,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  entry: Entry;
  preview?: SlotPreset;
  layout: SlotLayout;
  onEdit: (entry: Entry) => void;
  onPointerDown: (
    entry: Entry,
    mode: Drag["mode"],
    event: ReactPointerEvent,
  ) => void;
  onPointerMove: (event: ReactPointerEvent) => void;
  onPointerUp: () => void;
}) {
  const slot = preview ?? {
    start: new Date(entry.started_at),
    end: new Date(entry.ended_at),
  };
  const top =
    (slot.start.getHours() * 60 + slot.start.getMinutes() - START_HOUR * 60) *
    PIXELS_PER_MINUTE;
  const height = Math.max(
    24,
    ((slot.end.getTime() - slot.start.getTime()) / 60_000) * PIXELS_PER_MINUTE,
  );
  return (
    <article
      className="calendar-slot"
      style={{
        top,
        height,
        background: entry.project_color,
        left: `calc(${(layout.column * 100) / layout.columns}% + 3px)`,
        width: `calc(${100 / layout.columns}% - 6px)`,
        right: "auto",
      }}
      onPointerDown={(event) => onPointerDown(entry, "move", event)}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onEdit(entry);
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <strong>{entry.project_name}</strong>
      <span>
        {slot.start.toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
        })}
        –
        {slot.end.toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
      <i
        className="resize-handle"
        onPointerDown={(event) => onPointerDown(entry, "resize", event)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
    </article>
  );
}

type SlotLayout = { column: number; columns: number };

function calculateOverlapLayouts(entries: Entry[], preview: Preview) {
  const result = new Map<number, SlotLayout>();
  const entriesByDay = new Map<string, Entry[]>();
  for (const entry of entries) {
    const key = effectiveStart(entry, preview).toLocaleDateString("sv-SE");
    entriesByDay.set(key, [...(entriesByDay.get(key) ?? []), entry]);
  }
  entriesByDay.forEach((dayEntries) => layoutDay(dayEntries, preview, result));
  return result;
}

function layoutDay(
  entries: Entry[],
  preview: Preview,
  result: Map<number, SlotLayout>,
) {
  const sorted = [...entries].sort(
    (a, b) =>
      effectiveStart(a, preview).getTime() -
      effectiveStart(b, preview).getTime(),
  );
  let cursor = 0;
  while (cursor < sorted.length) {
    const cluster = [sorted[cursor++]];
    let clusterEnd = effectiveEnd(cluster[0], preview).getTime();
    while (
      cursor < sorted.length &&
      effectiveStart(sorted[cursor], preview).getTime() < clusterEnd
    ) {
      const entry = sorted[cursor++];
      cluster.push(entry);
      clusterEnd = Math.max(clusterEnd, effectiveEnd(entry, preview).getTime());
    }
    layoutCluster(cluster, preview, result);
  }
}

function layoutCluster(
  cluster: Entry[],
  preview: Preview,
  result: Map<number, SlotLayout>,
) {
  const columnEnds: number[] = [];
  const assignments = new Map<number, number>();
  for (const entry of cluster) {
    const start = effectiveStart(entry, preview).getTime();
    const end = effectiveEnd(entry, preview).getTime();
    let column = columnEnds.findIndex((value) => value <= start);
    if (column < 0) {
      column = columnEnds.length;
      columnEnds.push(end);
    } else {
      columnEnds[column] = end;
    }
    assignments.set(entry.id, column);
  }
  cluster.forEach((entry) =>
    result.set(entry.id, {
      column: assignments.get(entry.id) ?? 0,
      columns: columnEnds.length,
    }),
  );
}

function effectiveStart(entry: Entry, preview: Preview) {
  return preview[entry.id]?.start ?? new Date(entry.started_at);
}
function effectiveEnd(entry: Entry, preview: Preview) {
  return preview[entry.id]?.end ?? new Date(entry.ended_at);
}
function snap(minutes: number) {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}
function getWeekStart(value: string) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  date.setHours(0, 0, 0, 0);
  return date;
}
function getWeekDays(start: Date) {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(day.getDate() + index);
    return day;
  });
}
function dateAtMinutes(day: Date, minutes: number) {
  const value = new Date(day);
  value.setMinutes(minutes);
  return value;
}

export function CalendarPage({
  entries,
  date,
  dayMinutes,
  dayAmount,
  uninvoiced,
  onDateChange,
  onCreate,
  onEdit,
  mutate,
}: {
  entries: Entry[];
  date: string;
  dayMinutes: number;
  dayAmount: number;
  uninvoiced: number;
  onDateChange: (date: string) => void;
  onCreate: (preset?: SlotPreset) => void;
  onEdit: (entry: Entry) => void;
  mutate: Mutate;
}) {
  return (
    <>
      <header className="topbar calendar-top">
        <div>
          <p className="eyebrow">Calendario settimanale</p>
          <h1>Il tuo tempo</h1>
        </div>
        <div className="calendar-actions">
          <div className="date-nav">
            <button onClick={() => onDateChange(changeByDays(date, -7))}>
              ‹
            </button>
            <input
              aria-label="Settimana"
              type="date"
              value={date}
              onChange={(event) => onDateChange(event.target.value)}
            />
            <button onClick={() => onDateChange(today())}>Oggi</button>
            <button onClick={() => onDateChange(changeByDays(date, 7))}>
              ›
            </button>
          </div>
          <button className="primary" onClick={() => onCreate()}>
            ＋ Nuovo slot
          </button>
        </div>
      </header>
      <div className="summary-strip">
        <span>
          <b>{formatDuration(dayMinutes)}</b> oggi
        </span>
        <span>
          <b>{formatMoney(dayAmount)}</b> oggi
        </span>
        <span>
          <b>{formatMoney(uninvoiced)}</b> da fatturare
        </span>
        <small>Trascina per creare · doppio clic per modificare</small>
      </div>
      <CalendarView
        anchor={date}
        entries={entries}
        onCreate={onCreate}
        onEdit={onEdit}
        mutate={mutate}
      />
    </>
  );
}

function changeByDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("sv-SE");
}

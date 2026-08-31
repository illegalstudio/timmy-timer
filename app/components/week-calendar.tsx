"use client";

import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useState,
} from "react";
import { Icon } from "./icon";
import { Timmy } from "./timmy";
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
type ContextMenuState = {
  entry: Entry;
  x: number;
  y: number;
  confirmDelete: boolean;
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
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [deleting, setDeleting] = useState(false);
  const calendarHeight = (END_HOUR - START_HOUR) * 60 * PIXELS_PER_MINUTE;

  useEffect(() => {
    if (!contextMenu) return;

    function handleOutside(event: PointerEvent) {
      if ((event.target as Element).closest(".entry-context-menu")) return;
      setContextMenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setContextMenu(null);
    }

    function closeMenu() {
      setContextMenu(null);
    }

    window.addEventListener("pointerdown", handleOutside);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      window.removeEventListener("pointerdown", handleOutside);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [contextMenu]);

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
    if (event.button !== 0) return;
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
    if (slot) {
      await mutate("PATCH", {
        type: "entry-time",
        id: drag.id,
        startedAt: slot.start.toISOString(),
        endedAt: slot.end.toISOString(),
      });
    }
    setPreview({});
  }

  function openContextMenu(entry: Entry, event: ReactMouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 220;
    const menuHeight = 170;
    setDeleting(false);
    setContextMenu({
      entry,
      x: Math.max(
        8,
        Math.min(event.clientX, window.innerWidth - menuWidth - 8),
      ),
      y: Math.max(
        8,
        Math.min(event.clientY, window.innerHeight - menuHeight - 8),
      ),
      confirmDelete: false,
    });
  }

  async function deleteEntry() {
    if (!contextMenu) return;
    setDeleting(true);
    const deleted = await mutate(
      "DELETE",
      undefined,
      `/api/data?id=${contextMenu.entry.id}`,
    );
    setDeleting(false);
    if (deleted) setContextMenu(null);
  }

  return (
    <>
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
                    effectiveStart(entry, preview).toLocaleDateString(
                      "sv-SE",
                    ) === dayKey,
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
                        onContextMenu={openContextMenu}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {contextMenu && (
        <EntryContextMenu
          menu={contextMenu}
          deleting={deleting}
          onEdit={() => {
            setContextMenu(null);
            onEdit(contextMenu.entry);
          }}
          onRequestDelete={() =>
            setContextMenu({ ...contextMenu, confirmDelete: true })
          }
          onCancelDelete={() =>
            setContextMenu({ ...contextMenu, confirmDelete: false })
          }
          onDelete={deleteEntry}
        />
      )}
    </>
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
  onContextMenu,
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
  onContextMenu: (entry: Entry, event: ReactMouseEvent) => void;
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
        color: readableTextColor(entry.project_color),
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
      onContextMenu={(event) => onContextMenu(entry, event)}
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

function EntryContextMenu({
  menu,
  deleting,
  onEdit,
  onRequestDelete,
  onCancelDelete,
  onDelete,
}: {
  menu: ContextMenuState;
  deleting: boolean;
  onEdit: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="entry-context-menu"
      style={{ left: menu.x, top: menu.y }}
      role="menu"
      aria-label={`Azioni per ${menu.entry.project_name}`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="context-entry-head">
        <span style={{ background: menu.entry.project_color }} />
        <span>
          <strong>{menu.entry.project_name}</strong>
          <small>{menu.entry.client_name}</small>
        </span>
      </div>
      {menu.confirmDelete ? (
        <div className="context-confirm">
          <strong>Eliminare questo slot?</strong>
          <span>L’azione non può essere annullata.</span>
          <div>
            <button type="button" onClick={onCancelDelete} disabled={deleting}>
              Annulla
            </button>
            <button
              className="context-delete-confirm"
              type="button"
              onClick={onDelete}
              disabled={deleting}
            >
              {deleting ? "Elimino…" : "Elimina"}
            </button>
          </div>
        </div>
      ) : (
        <div className="context-actions">
          <button type="button" role="menuitem" onClick={onEdit}>
            <Icon name="pencil" />
            Modifica
          </button>
          <button
            className="danger"
            type="button"
            role="menuitem"
            onClick={onRequestDelete}
          >
            <Icon name="trash" />
            Elimina
          </button>
        </div>
      )}
    </div>
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

function readableTextColor(color: string) {
  const hex = color.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return "#ffffff";
  const [red, green, blue] = [0, 2, 4].map((index) =>
    Number.parseInt(hex.slice(index, index + 2), 16),
  );
  return red * 0.299 + green * 0.587 + blue * 0.114 > 165
    ? "#2d2038"
    : "#ffffff";
}

export function CalendarPage({
  entries,
  date,
  dayMinutes,
  dayAmount,
  uninvoiced,
  setupStage,
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
  setupStage: "client" | "project" | null;
  onDateChange: (date: string) => void;
  onCreate: (preset?: SlotPreset) => void;
  onEdit: (entry: Entry) => void;
  mutate: Mutate;
}) {
  return (
    <>
      <header className="topbar calendar-top">
        <div>
          <p className="eyebrow">Agenda settimanale</p>
          <h1>La tua settimana</h1>
          <p className="page-subtitle">{formatWeekRange(date)}</p>
        </div>
        <div className="calendar-actions">
          <div className="date-nav">
            <button
              onClick={() => onDateChange(changeByDays(date, -7))}
              aria-label="Settimana precedente"
            >
              <Icon name="chevron-left" />
            </button>
            <input
              aria-label="Settimana"
              type="date"
              value={date}
              onChange={(event) => onDateChange(event.target.value)}
            />
            <button onClick={() => onDateChange(today())}>Oggi</button>
            <button
              onClick={() => onDateChange(changeByDays(date, 7))}
              aria-label="Settimana successiva"
            >
              <Icon name="chevron-right" />
            </button>
          </div>
          <button className="primary" onClick={() => onCreate()}>
            <Icon name="plus" />
            Nuovo slot
          </button>
        </div>
      </header>
      {setupStage ? (
        <WelcomePanel setupStage={setupStage} onCreate={onCreate} />
      ) : (
        <>
          <div className="summary-strip">
            <div className="summary-item">
              <span className="summary-icon butter">
                <Icon name="clock" />
              </span>
              <span>
                <small>Tempo oggi</small>
                <b>{formatDuration(dayMinutes)}</b>
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-icon mint">
                <Icon name="coins" />
              </span>
              <span>
                <small>Valore oggi</small>
                <b>{formatMoney(dayAmount)}</b>
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-icon coral">
                <Icon name="receipt" />
              </span>
              <span>
                <small>Da fatturare</small>
                <b>{formatMoney(uninvoiced)}</b>
              </span>
            </div>
            <small className="calendar-hint">
              Trascina per creare · clic destro per le azioni
            </small>
          </div>
          <CalendarView
            anchor={date}
            entries={entries}
            onCreate={onCreate}
            onEdit={onEdit}
            mutate={mutate}
          />
        </>
      )}
    </>
  );
}

function WelcomePanel({
  setupStage,
  onCreate,
}: {
  setupStage: "client" | "project";
  onCreate: () => void;
}) {
  const needsClient = setupStage === "client";
  return (
    <section className="welcome-panel">
      <div className="welcome-copy">
        <span className="welcome-badge">
          <Icon name="sparkles" />
          Piacere, sono Timmy
        </span>
        <h2>Facciamo spazio al tempo che conta.</h2>
        <p>
          {needsClient
            ? "Inizia aggiungendo il tuo primo cliente. Poi creeremo insieme un progetto e il primo slot di lavoro."
            : "Ottimo, il cliente c’è. Ora dagli un progetto: poi la tua agenda sarà pronta per partire."}
        </p>
        <div className="setup-steps" aria-label="Configurazione iniziale">
          <span className={needsClient ? "current" : "done"}>
            <b>{needsClient ? "1" : "✓"}</b> Cliente
          </span>
          <i />
          <span className={!needsClient ? "current" : ""}>
            <b>2</b> Progetto
          </span>
          <i />
          <span>
            <b>3</b> Primo slot
          </span>
        </div>
        <button className="primary welcome-action" onClick={onCreate}>
          <Icon name="plus" />
          {needsClient ? "Aggiungi il primo cliente" : "Crea il primo progetto"}
        </button>
      </div>
      <div className="welcome-art" aria-hidden="true">
        <span className="art-sun" />
        <span className="art-squiggle">∿∿</span>
        <Timmy className="welcome-timmy" priority />
      </div>
    </section>
  );
}

function changeByDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("sv-SE");
}

function formatWeekRange(value: string) {
  const start = getWeekStart(value);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const startLabel = start.toLocaleDateString("it-IT", {
    day: "numeric",
    month: start.getMonth() === end.getMonth() ? undefined : "short",
  });
  const endLabel = end.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

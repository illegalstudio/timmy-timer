"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "./empty-state";
import { Icon, type IconName } from "./icon";
import { SmartSelect } from "./smart-select";
import {
  entryAmount,
  entryMinutes,
  formatDuration,
  formatMoney,
  toLocalInput,
} from "../lib/time";
import type { Entry } from "../lib/types";

type Preset =
  | "today"
  | "yesterday"
  | "this-week"
  | "last-week"
  | "last-7-days"
  | "this-month"
  | "last-month"
  | "last-30-days"
  | "this-quarter"
  | "this-year"
  | "last-year"
  | "custom";

const PRESETS: Array<{ value: Preset; label: string }> = [
  { value: "today", label: "Oggi" },
  { value: "yesterday", label: "Ieri" },
  { value: "this-week", label: "Questa settimana" },
  { value: "last-week", label: "Scorsa settimana" },
  { value: "last-7-days", label: "Ultimi 7 giorni" },
  { value: "this-month", label: "Questo mese" },
  { value: "last-month", label: "Scorso mese" },
  { value: "last-30-days", label: "Ultimi 30 giorni" },
  { value: "this-quarter", label: "Questo trimestre" },
  { value: "this-year", label: "Quest’anno" },
  { value: "last-year", label: "Scorso anno" },
  { value: "custom", label: "Intervallo personalizzato" },
];

export function Reports({ entries }: { entries: Entry[] }) {
  const initialRange = getPresetRange("this-month");
  const [preset, setPreset] = useState<Preset>("this-month");
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [clientId, setClientId] = useState("all");
  const [projectId, setProjectId] = useState("all");

  const clients = useMemo(
    () =>
      Array.from(
        new Map(
          entries.map((entry) => [
            entry.client_id,
            { id: entry.client_id, name: entry.client_name },
          ]),
        ).values(),
      ).sort((a, b) => a.name.localeCompare(b.name, "it")),
    [entries],
  );

  const projects = useMemo(
    () =>
      Array.from(
        new Map(
          entries
            .filter(
              (entry) =>
                clientId === "all" || entry.client_id === Number(clientId),
            )
            .map((entry) => [
              entry.project_id,
              {
                id: entry.project_id,
                name: entry.project_name,
                clientId: entry.client_id,
                color: entry.project_color,
              },
            ]),
        ).values(),
      ).sort((a, b) => a.name.localeCompare(b.name, "it")),
    [entries, clientId],
  );

  const filtered = useMemo(
    () =>
      entries.filter((entry) => {
        const date = toLocalInput(entry.started_at).slice(0, 10);
        const matchesClient =
          clientId === "all" || entry.client_id === Number(clientId);
        const matchesProject =
          projectId === "all" || entry.project_id === Number(projectId);
        return date >= from && date <= to && matchesClient && matchesProject;
      }),
    [entries, from, to, clientId, projectId],
  );

  const totalMinutes = filtered.reduce(
    (total, entry) => total + entryMinutes(entry),
    0,
  );
  const totalCents = filtered.reduce(
    (total, entry) => total + entryAmount(entry),
    0,
  );

  function selectPreset(value: Preset) {
    setPreset(value);
    if (value === "custom") return;
    const range = getPresetRange(value);
    setFrom(range.from);
    setTo(range.to);
  }

  function changeFrom(value: string) {
    setPreset("custom");
    setFrom(value);
  }

  function changeTo(value: string) {
    setPreset("custom");
    setTo(value);
  }

  function changeClient(value: string) {
    setClientId(value);
    if (projectId === "all") return;
    const selectedProject = entries.find(
      (entry) => entry.project_id === Number(projectId),
    );
    if (value !== "all" && selectedProject?.client_id !== Number(value)) {
      setProjectId("all");
    }
  }

  function exportCsv() {
    const header = [
      "Data",
      "Inizio",
      "Fine",
      "Durata",
      "Cliente",
      "Progetto",
      "Descrizione",
      "Fatturabile",
      "Fatturato",
      "Tariffa",
      "Importo",
    ];
    const rows = filtered.map((entry) => [
      toLocalInput(entry.started_at).slice(0, 10),
      toLocalInput(entry.started_at).slice(11),
      toLocalInput(entry.ended_at).slice(11),
      formatDuration(entryMinutes(entry)),
      entry.client_name,
      entry.project_name,
      entry.description || "",
      entry.billable ? "Sì" : "No",
      entry.invoiced ? "Sì" : "No",
      (entry.hourly_rate_cents / 100).toFixed(2),
      (entryAmount(entry) / 100).toFixed(2),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map(escapeCsvCell).join(";"))
      .join("\n");
    download(
      `\ufeff${csv}`,
      `timmy_timer_${from}_${to}.csv`,
      "text/csv;charset=utf-8",
    );
  }

  async function exportPdf() {
    const { jsPDF } = await import("jspdf");
    const document = new jsPDF();
    document.setFontSize(20);
    document.text("Timmy Timer · Report attività", 16, 20);
    document.setFontSize(10);
    document.text(`${formatDate(from)} – ${formatDate(to)}`, 16, 28);

    let y = 40;
    for (const entry of filtered) {
      if (y > 275) {
        document.addPage();
        y = 20;
      }
      document.setFontSize(10);
      document.text(
        `${formatDate(toLocalInput(entry.started_at).slice(0, 10))}  ${entry.client_name} / ${entry.project_name}`,
        16,
        y,
      );
      document.text(formatDuration(entryMinutes(entry)), 150, y);
      document.text(formatMoney(entryAmount(entry)), 177, y, {
        align: "right",
      });
      document.setFontSize(8);
      document.setTextColor(110);
      document.text(entry.description || "—", 16, y + 5);
      document.setTextColor(0);
      y += 13;
    }

    document.line(16, y, 194, y);
    document.setFontSize(12);
    document.text(
      `Totale: ${formatDuration(totalMinutes)} · ${formatMoney(totalCents)}`,
      16,
      y + 9,
    );
    document.save(`timmy_timer_${from}_${to}.pdf`);
  }

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Numeri che parlano</p>
          <h1>Il tuo tempo, in sintesi</h1>
          <p className="page-subtitle">
            Filtra le attività e porta i risultati dove ti servono.
          </p>
        </div>
        <div className="export-actions">
          <button className="button-secondary" onClick={exportCsv}>
            <Icon name="download" />
            CSV
          </button>
          <button className="primary" onClick={exportPdf}>
            <Icon name="download" />
            PDF
          </button>
        </div>
      </header>
      <div className="report-filter-panel">
        <div className="filter-heading">
          <span className="filter-icon">
            <Icon name="reports" />
          </span>
          <div>
            <strong>Costruisci il tuo report</strong>
            <small>Combina periodo, cliente e progetto.</small>
          </div>
        </div>
        <div className="report-filters">
          <SmartSelect
            label="Periodo"
            value={preset}
            onValueChange={(value) => selectPreset(value as Preset)}
            searchPlaceholder="Cerca periodo…"
            options={PRESETS}
          />
          <label>
            Dal
            <input
              type="date"
              value={from}
              onChange={(event) => changeFrom(event.target.value)}
            />
          </label>
          <label>
            Al
            <input
              type="date"
              value={to}
              onChange={(event) => changeTo(event.target.value)}
            />
          </label>
          <SmartSelect
            label="Cliente"
            value={clientId}
            onValueChange={changeClient}
            searchPlaceholder="Cerca cliente…"
            options={[
              { value: "all", label: "Tutti i clienti" },
              ...clients.map((client) => ({
                value: String(client.id),
                label: client.name,
              })),
            ]}
          />
          <SmartSelect
            label="Progetto"
            value={projectId}
            onValueChange={setProjectId}
            searchPlaceholder="Cerca progetto…"
            options={[
              { value: "all", label: "Tutti i progetti" },
              ...projects.map((project) => ({
                value: String(project.id),
                label: project.name,
                hint: clients.find((client) => client.id === project.clientId)
                  ?.name,
                color: project.color,
              })),
            ]}
          />
        </div>
      </div>
      <div className="summary-grid report-summary">
        <Summary
          icon="clock"
          label="Tempo totale"
          value={formatDuration(totalMinutes)}
        />
        <Summary
          icon="coins"
          label="Valore totale"
          value={formatMoney(totalCents)}
        />
        <Summary
          icon="sparkles"
          label="Attività"
          value={String(filtered.length)}
          accent
        />
      </div>
      <div className="panel report-table">
        {!!filtered.length && (
          <div className="report-row report-head" aria-hidden="true">
            <span>Data</span>
            <span>Attività</span>
            <span>Durata</span>
            <span>Importo</span>
          </div>
        )}
        {filtered.map((entry) => (
          <div className="report-row" key={entry.id}>
            <span>
              {formatDate(toLocalInput(entry.started_at).slice(0, 10))}
            </span>
            <div>
              <strong>{entry.project_name}</strong>
              <small>{entry.client_name}</small>
            </div>
            <b>{formatDuration(entryMinutes(entry))}</b>
            <b>{formatMoney(entryAmount(entry))}</b>
          </div>
        ))}
        {!filtered.length && (
          <EmptyState
            title="I numeri arriveranno presto."
            description="Registra il primo slot oppure cambia intervallo: Timmy trasformerà il tempo in un riepilogo chiaro."
          />
        )}
      </div>
    </>
  );
}

function Summary({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  icon: IconName;
  accent?: boolean;
}) {
  return (
    <div className={`summary-card ${accent ? "accent" : ""}`}>
      <span className="summary-card-icon">
        <Icon name={icon} />
      </span>
      <span className="summary-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getPresetRange(preset: Exclude<Preset, "custom">) {
  const now = startOfDay(new Date());
  let from = new Date(now);
  let to = new Date(now);

  if (preset === "yesterday") {
    from.setDate(from.getDate() - 1);
    to = new Date(from);
  } else if (preset === "this-week") {
    from = startOfWeek(now);
    to = endOfWeek(now);
  } else if (preset === "last-week") {
    to = startOfWeek(now);
    to.setDate(to.getDate() - 1);
    from = startOfWeek(to);
  } else if (preset === "last-7-days") {
    from.setDate(from.getDate() - 6);
  } else if (preset === "this-month") {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (preset === "last-month") {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    to = new Date(now.getFullYear(), now.getMonth(), 0);
  } else if (preset === "last-30-days") {
    from.setDate(from.getDate() - 29);
  } else if (preset === "this-quarter") {
    const quarterStart = Math.floor(now.getMonth() / 3) * 3;
    from = new Date(now.getFullYear(), quarterStart, 1);
    to = new Date(now.getFullYear(), quarterStart + 3, 0);
  } else if (preset === "this-year") {
    from = new Date(now.getFullYear(), 0, 1);
    to = new Date(now.getFullYear(), 11, 31);
  } else if (preset === "last-year") {
    from = new Date(now.getFullYear() - 1, 0, 1);
    to = new Date(now.getFullYear() - 1, 11, 31);
  }

  return { from: dateValue(from), to: dateValue(to) };
}

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function startOfWeek(date: Date) {
  const value = startOfDay(date);
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  return value;
}

function endOfWeek(date: Date) {
  const value = startOfWeek(date);
  value.setDate(value.getDate() + 6);
  return value;
}

function dateValue(date: Date) {
  return date.toLocaleDateString("sv-SE");
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("it-IT");
}

function escapeCsvCell(value: unknown) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function download(content: string, name: string, type: string) {
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([content], { type }));
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(anchor.href), 1_000);
}

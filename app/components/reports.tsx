"use client";

import { useMemo, useState } from "react";
import {
  entryAmount,
  entryMinutes,
  formatDuration,
  formatMoney,
  today,
  toLocalInput,
} from "../lib/time";
import type { Entry } from "../lib/types";

export function Reports({ entries }: { entries: Entry[] }) {
  const [from, setFrom] = useState(firstDayOfMonth);
  const [to, setTo] = useState(today());

  const filtered = useMemo(
    () =>
      entries.filter((entry) => {
        const date = toLocalInput(entry.started_at).slice(0, 10);
        return date >= from && date <= to;
      }),
    [entries, from, to],
  );

  const totalMinutes = filtered.reduce(
    (total, entry) => total + entryMinutes(entry),
    0,
  );
  const totalCents = filtered.reduce(
    (total, entry) => total + entryAmount(entry),
    0,
  );

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
      `tempo_${from}_${to}.csv`,
      "text/csv;charset=utf-8",
    );
  }

  async function exportPdf() {
    const { jsPDF } = await import("jspdf");
    const document = new jsPDF();
    document.setFontSize(20);
    document.text("Report attività", 16, 20);
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
    document.save(`tempo_${from}_${to}.pdf`);
  }

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Esportazioni</p>
          <h1>Report</h1>
          <p className="page-subtitle">
            Riepiloga ed esporta le attività registrate.
          </p>
        </div>
        <div className="export-actions">
          <button onClick={exportCsv}>CSV</button>
          <button className="primary" onClick={exportPdf}>
            PDF
          </button>
        </div>
      </header>
      <div className="report-filters">
        <label>
          Dal
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Al
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      <div className="summary-grid report-summary">
        <Summary label="Tempo" value={formatDuration(totalMinutes)} />
        <Summary label="Importo" value={formatMoney(totalCents)} />
        <Summary label="Attività" value={String(filtered.length)} accent />
      </div>
      <div className="panel report-table">
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
          <div className="empty">Nessuna attività nell’intervallo.</div>
        )}
      </div>
    </>
  );
}

function Summary({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`summary-card ${accent ? "accent" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function firstDayOfMonth() {
  const date = new Date();
  date.setDate(1);
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

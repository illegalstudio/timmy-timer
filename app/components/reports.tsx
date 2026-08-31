"use client";

import { useMemo, useState } from "react";
import { useI18n } from "../i18n/i18n-provider";
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
import type { MessageKey } from "../i18n/types";

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

const PRESETS: Array<{ value: Preset; labelKey: MessageKey }> = [
  { value: "today", labelKey: "reports.preset.today" },
  { value: "yesterday", labelKey: "reports.preset.yesterday" },
  { value: "this-week", labelKey: "reports.preset.thisWeek" },
  { value: "last-week", labelKey: "reports.preset.lastWeek" },
  { value: "last-7-days", labelKey: "reports.preset.last7Days" },
  { value: "this-month", labelKey: "reports.preset.thisMonth" },
  { value: "last-month", labelKey: "reports.preset.lastMonth" },
  { value: "last-30-days", labelKey: "reports.preset.last30Days" },
  { value: "this-quarter", labelKey: "reports.preset.thisQuarter" },
  { value: "this-year", labelKey: "reports.preset.thisYear" },
  { value: "last-year", labelKey: "reports.preset.lastYear" },
  { value: "custom", labelKey: "reports.preset.custom" },
];

export function Reports({ entries }: { entries: Entry[] }) {
  const { localeTag, t } = useI18n();
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
      ).sort((a, b) => a.name.localeCompare(b.name, localeTag)),
    [entries, localeTag],
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
      ).sort((a, b) => a.name.localeCompare(b.name, localeTag)),
    [entries, clientId, localeTag],
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
      t("reports.csv.date"),
      t("reports.csv.start"),
      t("reports.csv.end"),
      t("reports.csv.duration"),
      t("reports.csv.client"),
      t("reports.csv.project"),
      t("reports.csv.description"),
      t("reports.csv.billable"),
      t("reports.csv.invoiced"),
      t("reports.csv.rate"),
      t("reports.csv.amount"),
    ];
    const rows = filtered.map((entry) => [
      toLocalInput(entry.started_at).slice(0, 10),
      toLocalInput(entry.started_at).slice(11),
      toLocalInput(entry.ended_at).slice(11),
      formatDuration(entryMinutes(entry)),
      entry.client_name,
      entry.project_name,
      entry.description || "",
      entry.billable ? t("reports.yes") : t("reports.no"),
      entry.invoiced ? t("reports.yes") : t("reports.no"),
      formatCsvNumber(entry.hourly_rate_cents / 100, localeTag),
      formatCsvNumber(entryAmount(entry) / 100, localeTag),
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
    document.text(t("reports.pdf.title"), 16, 20);
    document.setFontSize(10);
    document.text(
      `${formatDate(from, localeTag)} – ${formatDate(to, localeTag)}`,
      16,
      28,
    );

    let y = 40;
    for (const entry of filtered) {
      if (y > 275) {
        document.addPage();
        y = 20;
      }
      document.setFontSize(10);
      document.text(
        `${formatDate(toLocalInput(entry.started_at).slice(0, 10), localeTag)}  ${entry.client_name} / ${entry.project_name}`,
        16,
        y,
      );
      document.text(formatDuration(entryMinutes(entry)), 150, y);
      document.text(formatMoney(entryAmount(entry), localeTag), 177, y, {
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
      t("reports.pdf.total", {
        duration: formatDuration(totalMinutes),
        amount: formatMoney(totalCents, localeTag),
      }),
      16,
      y + 9,
    );
    document.save(`timmy_timer_${from}_${to}.pdf`);
  }

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">{t("reports.eyebrow")}</p>
          <h1>{t("reports.title")}</h1>
          <p className="page-subtitle">{t("reports.subtitle")}</p>
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
            <strong>{t("reports.filterTitle")}</strong>
            <small>{t("reports.filterDescription")}</small>
          </div>
        </div>
        <div className="report-filters">
          <SmartSelect
            label={t("reports.period")}
            value={preset}
            onValueChange={(value) => selectPreset(value as Preset)}
            searchPlaceholder={t("reports.searchPeriod")}
            options={PRESETS.map((item) => ({
              value: item.value,
              label: t(item.labelKey),
            }))}
          />
          <label>
            {t("reports.from")}
            <input
              type="date"
              value={from}
              onChange={(event) => changeFrom(event.target.value)}
            />
          </label>
          <label>
            {t("reports.to")}
            <input
              type="date"
              value={to}
              onChange={(event) => changeTo(event.target.value)}
            />
          </label>
          <SmartSelect
            label={t("reports.client")}
            value={clientId}
            onValueChange={changeClient}
            searchPlaceholder={t("reports.searchClient")}
            options={[
              { value: "all", label: t("reports.allClients") },
              ...clients.map((client) => ({
                value: String(client.id),
                label: client.name,
              })),
            ]}
          />
          <SmartSelect
            label={t("reports.project")}
            value={projectId}
            onValueChange={setProjectId}
            searchPlaceholder={t("reports.searchProject")}
            options={[
              { value: "all", label: t("reports.allProjects") },
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
          label={t("reports.totalTime")}
          value={formatDuration(totalMinutes)}
        />
        <Summary
          icon="coins"
          label={t("reports.totalValue")}
          value={formatMoney(totalCents, localeTag)}
        />
        <Summary
          icon="sparkles"
          label={t("reports.activities")}
          value={String(filtered.length)}
          accent
        />
      </div>
      <div className="panel report-table">
        {!!filtered.length && (
          <div className="report-row report-head" aria-hidden="true">
            <span>{t("reports.table.date")}</span>
            <span>{t("reports.table.activity")}</span>
            <span>{t("reports.table.duration")}</span>
            <span>{t("reports.table.amount")}</span>
          </div>
        )}
        {filtered.map((entry) => (
          <div className="report-row" key={entry.id}>
            <span>
              {formatDate(
                toLocalInput(entry.started_at).slice(0, 10),
                localeTag,
              )}
            </span>
            <div>
              <strong>{entry.project_name}</strong>
              <small>{entry.client_name}</small>
            </div>
            <b>{formatDuration(entryMinutes(entry))}</b>
            <b>{formatMoney(entryAmount(entry), localeTag)}</b>
          </div>
        ))}
        {!filtered.length && (
          <EmptyState
            title={t("reports.emptyTitle")}
            description={t("reports.emptyDescription")}
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

function formatDate(value: string, locale: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(locale);
}

function escapeCsvCell(value: unknown) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function formatCsvNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(value);
}

function download(content: string, name: string, type: string) {
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([content], { type }));
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(anchor.href), 1_000);
}

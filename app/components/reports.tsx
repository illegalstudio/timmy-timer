"use client";

import { useMemo, useState } from "react";
import { useI18n } from "../i18n/i18n-provider";
import type { MessageKey } from "../i18n/types";
import {
  entryAmount,
  entryMinutes,
  formatDuration,
  formatMoney,
  toLocalInput,
} from "../lib/time";
import type { Entry, Mutate } from "../lib/types";
import { EmptyState } from "./empty-state";
import { Icon, type IconName } from "./icon";
import { SmartSelect } from "./smart-select";

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
  | "all-time"
  | "custom";

type BillingStatus = "all" | "to-invoice" | "invoiced" | "non-billable";

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
  { value: "all-time", labelKey: "reports.preset.allTime" },
  { value: "custom", labelKey: "reports.preset.custom" },
];

const BILLING_STATUSES: Array<{
  value: BillingStatus;
  labelKey: MessageKey;
}> = [
  { value: "all", labelKey: "reports.billing.all" },
  { value: "to-invoice", labelKey: "reports.billing.toInvoice" },
  { value: "invoiced", labelKey: "reports.billing.invoiced" },
  { value: "non-billable", labelKey: "reports.billing.nonBillable" },
];

export function Reports({
  entries,
  mutate,
}: {
  entries: Entry[];
  mutate: Mutate;
}) {
  const { localeTag, t } = useI18n();
  const [initialFilters] = useState(() => getInitialFilters(entries));
  const [preset, setPreset] = useState<Preset>(initialFilters.preset);
  const [from, setFrom] = useState(initialFilters.from);
  const [to, setTo] = useState(initialFilters.to);
  const [clientId, setClientId] = useState("all");
  const [projectId, setProjectId] = useState("all");
  const [billingStatus, setBillingStatus] = useState<BillingStatus>(
    initialFilters.billingStatus,
  );
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [updating, setUpdating] = useState(false);
  const [billingNotice, setBillingNotice] = useState<{
    key: MessageKey;
    count: number;
  } | null>(null);

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

  const scopedEntries = useMemo(
    () =>
      entries.filter((entry) => {
        const date = toLocalInput(entry.started_at).slice(0, 10);
        const matchesDate =
          preset === "all-time" || (date >= from && date <= to);
        const matchesClient =
          clientId === "all" || entry.client_id === Number(clientId);
        const matchesProject =
          projectId === "all" || entry.project_id === Number(projectId);
        return matchesDate && matchesClient && matchesProject;
      }),
    [entries, from, to, clientId, projectId, preset],
  );

  const filtered = useMemo(
    () =>
      scopedEntries.filter((entry) =>
        matchesBillingStatus(entry, billingStatus),
      ),
    [scopedEntries, billingStatus],
  );

  const selectableEntries = filtered.filter((entry) => Boolean(entry.billable));
  const selectedEntries = selectableEntries.filter((entry) =>
    selectedIds.has(entry.id),
  );
  const allSelected =
    selectableEntries.length > 0 &&
    selectedEntries.length === selectableEntries.length;
  const canMarkInvoiced = selectedEntries.some((entry) => !entry.invoiced);
  const canMarkNotInvoiced = selectedEntries.some((entry) => entry.invoiced);
  const totalMinutes = filtered.reduce(
    (total, entry) => total + entryMinutes(entry),
    0,
  );
  const totalCents = filtered.reduce(
    (total, entry) => total + billableAmount(entry),
    0,
  );
  const scopedMinutes = scopedEntries.reduce(
    (total, entry) => total + entryMinutes(entry),
    0,
  );
  const billableCents = scopedEntries.reduce(
    (total, entry) => total + billableAmount(entry),
    0,
  );
  const toInvoiceCents = scopedEntries
    .filter((entry) => entry.billable && !entry.invoiced)
    .reduce((total, entry) => total + entryAmount(entry), 0);
  const invoicedCents = scopedEntries
    .filter((entry) => entry.billable && entry.invoiced)
    .reduce((total, entry) => total + entryAmount(entry), 0);

  function clearSelection() {
    setSelectedIds(new Set());
    setBillingNotice(null);
  }

  function selectPreset(value: Preset) {
    clearSelection();
    setPreset(value);
    if (value === "custom") return;
    if (value === "all-time") {
      const range = getAllTimeRange(entries);
      setFrom(range.from);
      setTo(range.to);
      return;
    }
    const range = getPresetRange(value);
    setFrom(range.from);
    setTo(range.to);
  }

  function changeFrom(value: string) {
    clearSelection();
    setPreset("custom");
    setFrom(value);
  }

  function changeTo(value: string) {
    clearSelection();
    setPreset("custom");
    setTo(value);
  }

  function changeClient(value: string) {
    clearSelection();
    setClientId(value);
    if (projectId === "all") return;
    const selectedProject = entries.find(
      (entry) => entry.project_id === Number(projectId),
    );
    if (value !== "all" && selectedProject?.client_id !== Number(value)) {
      setProjectId("all");
    }
  }

  function changeProject(value: string) {
    clearSelection();
    setProjectId(value);
  }

  function changeBillingStatus(value: string) {
    if (!isBillingStatus(value)) return;
    clearSelection();
    setBillingStatus(value);
  }

  function toggleAll(checked: boolean) {
    setBillingNotice(null);
    setSelectedIds(
      checked ? new Set(selectableEntries.map((entry) => entry.id)) : new Set(),
    );
  }

  function toggleEntry(id: number, checked: boolean) {
    setBillingNotice(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function updateBilling(invoiced: boolean) {
    const ids = selectedEntries
      .filter((entry) => Boolean(entry.invoiced) !== invoiced)
      .map((entry) => entry.id);
    if (!ids.length) return;
    setUpdating(true);
    const updated = await mutate("PATCH", {
      type: "entry-invoice",
      ids,
      invoiced,
    });
    setUpdating(false);
    if (!updated) return;
    setSelectedIds(new Set());
    setBillingNotice({
      key: billingNoticeKey(invoiced, ids.length),
      count: ids.length,
    });
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
      t("reports.csv.invoicedAt"),
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
      entry.invoiced_at ? formatDateTime(entry.invoiced_at, localeTag) : "",
      formatCsvNumber(entry.hourly_rate_cents / 100, localeTag),
      entry.billable
        ? formatCsvNumber(entryAmount(entry) / 100, localeTag)
        : "",
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
      preset === "all-time"
        ? t("reports.preset.allTime")
        : `${formatDate(from, localeTag)} – ${formatDate(to, localeTag)}`,
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
      document.text(
        entry.billable ? formatMoney(entryAmount(entry), localeTag) : "—",
        177,
        y,
        { align: "right" },
      );
      document.setFontSize(8);
      document.setTextColor(110);
      document.text(
        `${entry.description || "—"} · ${t(billingStatusKey(entry))}`,
        16,
        y + 5,
      );
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
          <button
            className="button-secondary"
            onClick={exportCsv}
            disabled={!filtered.length}
          >
            <Icon name="download" />
            CSV
          </button>
          <button
            className="primary"
            onClick={exportPdf}
            disabled={!filtered.length}
          >
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
              disabled={preset === "all-time"}
              onChange={(event) => changeFrom(event.target.value)}
            />
          </label>
          <label>
            {t("reports.to")}
            <input
              type="date"
              value={to}
              disabled={preset === "all-time"}
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
            onValueChange={changeProject}
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
          <SmartSelect
            label={t("reports.billingStatus")}
            value={billingStatus}
            onValueChange={changeBillingStatus}
            searchPlaceholder={t("reports.searchBillingStatus")}
            options={BILLING_STATUSES.map((status) => ({
              value: status.value,
              label: t(status.labelKey),
            }))}
          />
        </div>
      </div>
      <div className="summary-grid report-summary billing-summary">
        <Summary
          icon="clock"
          label={t("reports.totalTime")}
          value={formatDuration(scopedMinutes)}
          tone="butter"
        />
        <Summary
          icon="coins"
          label={t("reports.billableValue")}
          value={formatMoney(billableCents, localeTag)}
          tone="mint"
        />
        <Summary
          icon="receipt"
          label={t("reports.toInvoice")}
          value={formatMoney(toInvoiceCents, localeTag)}
          tone="coral"
        />
        <Summary
          icon="check"
          label={t("reports.invoiced")}
          value={formatMoney(invoicedCents, localeTag)}
          tone="lavender"
        />
      </div>
      {selectedEntries.length > 0 && (
        <div
          className="billing-actions"
          role="region"
          aria-label={t("reports.bulkActions")}
        >
          <span>
            <strong>{selectedEntries.length}</strong>
            {t(
              selectedEntries.length === 1
                ? "reports.selected.one"
                : "reports.selected.many",
              { count: selectedEntries.length },
            )}
          </span>
          <div>
            <button
              className="button-secondary"
              onClick={() => void updateBilling(false)}
              disabled={updating || !canMarkNotInvoiced}
            >
              <Icon name="receipt" />
              {t("reports.markNotInvoiced")}
            </button>
            <button
              className="primary"
              onClick={() => void updateBilling(true)}
              disabled={updating || !canMarkInvoiced}
            >
              <Icon name="check" />
              {updating ? t("reports.updating") : t("reports.markInvoiced")}
            </button>
          </div>
        </div>
      )}
      {billingNotice && (
        <p className="billing-notice" role="status" aria-live="polite">
          <Icon name="check" />
          {t(billingNotice.key, { count: billingNotice.count })}
        </p>
      )}
      <div className="panel report-table">
        {!!filtered.length && (
          <div className="report-row report-head">
            <span className="report-select">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) => toggleAll(event.target.checked)}
                disabled={!selectableEntries.length}
                aria-label={t("reports.selectAll")}
              />
            </span>
            <span>{t("reports.table.date")}</span>
            <span>{t("reports.table.activity")}</span>
            <span>{t("reports.table.status")}</span>
            <span>{t("reports.table.duration")}</span>
            <span>{t("reports.table.amount")}</span>
          </div>
        )}
        {filtered.map((entry) => {
          const date = formatDate(
            toLocalInput(entry.started_at).slice(0, 10),
            localeTag,
          );
          return (
            <div className="report-row" key={entry.id}>
              <span className="report-select">
                <input
                  type="checkbox"
                  checked={selectedIds.has(entry.id)}
                  disabled={!entry.billable}
                  onChange={(event) =>
                    toggleEntry(entry.id, event.target.checked)
                  }
                  aria-label={t("reports.selectEntry", {
                    project: entry.project_name,
                    date,
                  })}
                />
              </span>
              <span>{date}</span>
              <div className="report-activity">
                <strong>{entry.project_name}</strong>
                <small>{entry.client_name}</small>
              </div>
              <span className="report-status">
                <span
                  className={`billing-badge ${billingStatusClass(entry)}`}
                  title={billingStatusTitle(entry, localeTag, t)}
                >
                  {t(billingStatusKey(entry))}
                </span>
                {entry.invoiced_at && (
                  <small>{formatDateTime(entry.invoiced_at, localeTag)}</small>
                )}
              </span>
              <b className="report-duration">
                {formatDuration(entryMinutes(entry))}
              </b>
              <b className="report-amount">
                {entry.billable
                  ? formatMoney(entryAmount(entry), localeTag)
                  : "—"}
              </b>
            </div>
          );
        })}
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
  tone,
}: {
  label: string;
  value: string;
  icon: IconName;
  tone: "butter" | "mint" | "coral" | "lavender";
}) {
  return (
    <div className={`summary-card ${tone}`}>
      <span className="summary-card-icon">
        <Icon name={icon} />
      </span>
      <span className="summary-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function matchesBillingStatus(entry: Entry, status: BillingStatus) {
  if (status === "to-invoice")
    return Boolean(entry.billable && !entry.invoiced);
  if (status === "invoiced") return Boolean(entry.billable && entry.invoiced);
  if (status === "non-billable") return !entry.billable;
  return true;
}

function isBillingStatus(value: string | null): value is BillingStatus {
  return BILLING_STATUSES.some((status) => status.value === value);
}

function billableAmount(entry: Entry) {
  return entry.billable ? entryAmount(entry) : 0;
}

function billingStatusKey(entry: Entry): MessageKey {
  if (!entry.billable) return "reports.status.nonBillable";
  return entry.invoiced
    ? "reports.status.invoiced"
    : "reports.status.toInvoice";
}

function billingStatusClass(entry: Entry) {
  if (!entry.billable) return "non-billable";
  return entry.invoiced ? "invoiced" : "to-invoice";
}

function billingStatusTitle(
  entry: Entry,
  locale: string,
  t: (key: MessageKey, values?: Record<string, string | number>) => string,
) {
  if (!entry.invoiced_at) return t(billingStatusKey(entry));
  return t("reports.invoicedOn", {
    date: formatDateTime(entry.invoiced_at, locale),
  });
}

function billingNoticeKey(invoiced: boolean, count: number): MessageKey {
  if (invoiced) {
    return count === 1
      ? "reports.updated.invoiced.one"
      : "reports.updated.invoiced.many";
  }
  return count === 1
    ? "reports.updated.notInvoiced.one"
    : "reports.updated.notInvoiced.many";
}

function getInitialFilters(entries: Entry[]): {
  preset: Preset;
  from: string;
  to: string;
  billingStatus: BillingStatus;
} {
  const defaultRange = getPresetRange("this-month");
  if (typeof window === "undefined") {
    return {
      preset: "this-month",
      ...defaultRange,
      billingStatus: "all",
    };
  }
  const params = new URLSearchParams(window.location.search);
  const requestedBilling = params.get("billing");
  const billingStatus = isBillingStatus(requestedBilling)
    ? requestedBilling
    : "all";
  if (params.get("period") === "all-time") {
    return {
      preset: "all-time",
      ...getAllTimeRange(entries),
      billingStatus,
    };
  }
  return {
    preset: "this-month",
    ...defaultRange,
    billingStatus,
  };
}

function getAllTimeRange(entries: Entry[]) {
  const dates = entries.map((entry) =>
    toLocalInput(entry.started_at).slice(0, 10),
  );
  const today = dateValue(new Date());
  return {
    from: dates.length
      ? dates.reduce((earliest, date) => (date < earliest ? date : earliest))
      : today,
    to: dates.length
      ? dates.reduce((latest, date) => (date > latest ? date : latest), today)
      : today,
  };
}

function getPresetRange(preset: Exclude<Preset, "custom" | "all-time">) {
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

function formatDateTime(value: string, locale: string) {
  return new Date(value).toLocaleDateString(locale);
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

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
import { ReportChart } from "./report-chart";
import { getForecast } from "../lib/forecast";
import { SmartSelect } from "./smart-select";

type Granularity = "day" | "week" | "month" | "year" | "custom";
type Step = Exclude<Granularity, "custom">;
type Range = { from: string; to: string };

type BillingStatus = "all" | "to-invoice" | "invoiced" | "non-billable";

const PAGE_SIZE = 10;

const GRANULARITIES: Array<{ value: Granularity; labelKey: MessageKey }> = [
  { value: "day", labelKey: "reports.period.day" },
  { value: "week", labelKey: "reports.period.week" },
  { value: "month", labelKey: "reports.period.month" },
  { value: "year", labelKey: "reports.period.year" },
  { value: "custom", labelKey: "reports.period.custom" },
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
  const [granularity, setGranularity] = useState<Granularity>(
    initialFilters.granularity,
  );
  const [anchor, setAnchor] = useState(initialFilters.anchor);
  const [custom, setCustom] = useState<Range>(initialFilters.custom);
  const [clientId, setClientId] = useState(initialFilters.clientId);
  const [projectId, setProjectId] = useState(initialFilters.projectId);
  const [billingStatus, setBillingStatus] = useState<BillingStatus>(
    initialFilters.billingStatus,
  );
  const [page, setPage] = useState(1);
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

  // The visible range is derived: a granularity plus the anchor date it is
  // centred on, so the arrows only ever have to move the anchor.
  const { from, to } =
    granularity === "custom" ? custom : getPeriodRange(granularity, anchor);
  const periodLabel = formatPeriodLabel(granularity, anchor, localeTag);
  const isCurrentPeriod =
    granularity !== "custom" && withinRange(dateValue(new Date()), from, to);

  const scopedEntries = useMemo(
    () =>
      entries.filter((entry) => {
        const date = toLocalInput(entry.started_at).slice(0, 10);
        const matchesClient =
          clientId === "all" || entry.client_id === Number(clientId);
        const matchesProject =
          projectId === "all" || entry.project_id === Number(projectId);
        return withinRange(date, from, to) && matchesClient && matchesProject;
      }),
    [entries, from, to, clientId, projectId],
  );

  const filtered = useMemo(
    () =>
      scopedEntries.filter((entry) =>
        matchesBillingStatus(entry, billingStatus),
      ),
    [scopedEntries, billingStatus],
  );

  // Clamped rather than stored, so the view stays valid when the list shrinks
  // under it (a filter change, or entries leaving the current billing status).
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageEntries = filtered.slice(pageStart, pageStart + PAGE_SIZE);

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
  // Same scope as the cards above it, so the two rows compare like for like.
  const forecast = useMemo(
    () => getForecast(scopedEntries, from, to, dateValue(new Date())),
    [scopedEntries, from, to],
  );
  const toInvoiceCents = scopedEntries
    .filter((entry) => entry.billable && !entry.invoiced)
    .reduce((total, entry) => total + entryAmount(entry), 0);
  const invoicedCents = scopedEntries
    .filter((entry) => entry.billable && entry.invoiced)
    .reduce((total, entry) => total + entryAmount(entry), 0);

  function resetFilterView() {
    setSelectedIds(new Set());
    setBillingNotice(null);
    setPage(1);
  }

  function selectGranularity(value: Granularity) {
    resetFilterView();
    // Switching to Custom keeps whatever range was on screen.
    if (value === "custom" && granularity !== "custom") setCustom({ from, to });
    setGranularity(value);
  }

  function movePeriod(direction: number) {
    if (granularity === "custom") return;
    resetFilterView();
    setAnchor(shiftAnchor(granularity, anchor, direction));
  }

  function goToCurrentPeriod() {
    resetFilterView();
    setAnchor(dateValue(new Date()));
  }

  function changeFrom(value: string) {
    resetFilterView();
    setCustom((range) => ({ ...range, from: value }));
  }

  function changeTo(value: string) {
    resetFilterView();
    setCustom((range) => ({ ...range, to: value }));
  }

  function changeClient(value: string) {
    resetFilterView();
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
    resetFilterView();
    setProjectId(value);
  }

  function changeBillingStatus(value: string) {
    if (!isBillingStatus(value)) return;
    resetFilterView();
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
    document.text(periodLabel, 16, 28);

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
          <div className="report-period">
            <div
              className="period-switch"
              role="group"
              aria-label={t("reports.periodAria")}
            >
              {GRANULARITIES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={granularity === item.value}
                  onClick={() => selectGranularity(item.value)}
                >
                  {t(item.labelKey)}
                </button>
              ))}
            </div>
            {granularity !== "custom" && (
              <div className="period-nav">
                <button
                  type="button"
                  onClick={() => movePeriod(-1)}
                  aria-label={t("reports.previousPeriod")}
                >
                  <Icon name="chevron-left" />
                </button>
                <button
                  className="period-now"
                  type="button"
                  onClick={goToCurrentPeriod}
                  disabled={isCurrentPeriod}
                  aria-label={t("reports.currentPeriod")}
                >
                  <span />
                </button>
                <button
                  type="button"
                  onClick={() => movePeriod(1)}
                  aria-label={t("reports.nextPeriod")}
                >
                  <Icon name="chevron-right" />
                </button>
                <strong className="period-label">{periodLabel}</strong>
              </div>
            )}
          </div>
          {granularity === "custom" && (
            <div className="period-custom">
              <label>
                {t("reports.from")}
                <input
                  type="date"
                  value={custom.from}
                  onChange={(event) => changeFrom(event.target.value)}
                />
              </label>
              <label>
                {t("reports.to")}
                <input
                  type="date"
                  value={custom.to}
                  onChange={(event) => changeTo(event.target.value)}
                />
              </label>
            </div>
          )}
          <div className="report-scope">
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
      {forecast && (
        <section
          className="forecast-row"
          aria-label={t("reports.forecastTitle")}
        >
          <p className="forecast-heading">
            <strong>{t("reports.forecastTitle")}</strong>
            <small>{t("reports.forecastNote")}</small>
          </p>
          <div className="summary-grid">
            <Summary
              icon="clock"
              label={t("reports.totalTime")}
              value={formatDuration(forecast.minutes)}
              tone="butter"
              estimate
            />
            <Summary
              icon="coins"
              label={t("reports.billableValue")}
              value={formatMoney(forecast.billableCents, localeTag)}
              tone="mint"
              estimate
            />
            <Summary
              icon="receipt"
              label={t("reports.toInvoice")}
              value={formatMoney(forecast.toInvoiceCents, localeTag)}
              tone="coral"
              estimate
            />
          </div>
        </section>
      )}
      <ReportChart
        entries={filtered}
        from={from}
        to={to}
        projectId={projectId}
        onSelectProject={changeProject}
      />
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
        {pageEntries.map((entry) => {
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
        {filtered.length > PAGE_SIZE && (
          <nav
            className="report-pagination"
            aria-label={t("reports.paginationAria")}
          >
            <span>
              {t("reports.showingRange", {
                from: pageStart + 1,
                to: pageStart + pageEntries.length,
                total: filtered.length,
              })}
            </span>
            <div>
              <button
                type="button"
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage === 1}
                aria-label={t("reports.previousPage")}
              >
                <Icon name="chevron-left" />
              </button>
              <b>
                {t("reports.pageOf", {
                  page: currentPage,
                  pages: pageCount,
                })}
              </b>
              <button
                type="button"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage === pageCount}
                aria-label={t("reports.nextPage")}
              >
                <Icon name="chevron-right" />
              </button>
            </div>
          </nav>
        )}
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
  estimate = false,
}: {
  label: string;
  value: string;
  icon: IconName;
  tone: "butter" | "mint" | "coral" | "lavender";
  estimate?: boolean;
}) {
  return (
    <div className={`summary-card ${tone} ${estimate ? "is-estimate" : ""}`}>
      <span className="summary-card-head">
        <span className="summary-card-icon">
          <Icon name={icon} />
        </span>
        <span className="summary-label">{label}</span>
      </span>
      <strong className="summary-value">{value}</strong>
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
  granularity: Granularity;
  anchor: string;
  custom: Range;
  billingStatus: BillingStatus;
  clientId: string;
  projectId: string;
} {
  const today = dateValue(new Date());
  const base = {
    granularity: "month" as Granularity,
    anchor: today,
    custom: { from: today, to: today },
    billingStatus: "all" as BillingStatus,
    clientId: "all",
    projectId: "all",
  };
  if (typeof window === "undefined") return base;

  const params = new URLSearchParams(window.location.search);
  const requestedBilling = params.get("billing");
  const filters = {
    ...base,
    billingStatus: isBillingStatus(requestedBilling) ? requestedBilling : "all",
    clientId: requestedId(params.get("client"), entries, "client_id"),
    projectId: requestedId(params.get("project"), entries, "project_id"),
  };
  // The calendar links here to show everything still to invoice, which the
  // period model expresses as a custom range covering every entry.
  if (params.get("period") === "all-time") {
    return {
      ...filters,
      granularity: "custom",
      custom: getAllTimeRange(entries),
    };
  }
  return filters;
}

// Only accept an id the report can actually show, so a stale link cannot
// leave the filters pointing at something that is not in the list.
function requestedId(
  value: string | null,
  entries: Entry[],
  field: "client_id" | "project_id",
) {
  return value && entries.some((entry) => String(entry[field]) === value)
    ? value
    : "all";
}

function getAllTimeRange(entries: Entry[]): Range {
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

function getPeriodRange(step: Step, anchor: string): Range {
  const date = anchorDate(anchor);
  if (step === "day") return { from: dateValue(date), to: dateValue(date) };
  if (step === "week") {
    const from = startOfWeek(date);
    const to = new Date(from);
    to.setDate(to.getDate() + 6);
    return { from: dateValue(from), to: dateValue(to) };
  }
  if (step === "month") {
    return {
      from: dateValue(new Date(date.getFullYear(), date.getMonth(), 1)),
      to: dateValue(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
    };
  }
  return {
    from: dateValue(new Date(date.getFullYear(), 0, 1)),
    to: dateValue(new Date(date.getFullYear(), 11, 31)),
  };
}

function shiftAnchor(step: Step, anchor: string, direction: number) {
  const date = anchorDate(anchor);
  if (step === "day") date.setDate(date.getDate() + direction);
  else if (step === "week") date.setDate(date.getDate() + direction * 7);
  // Land on the first day, so stepping out of a long month cannot skip a
  // short one (31 March + 1 month would otherwise reach May).
  else if (step === "month") date.setMonth(date.getMonth() + direction, 1);
  else date.setFullYear(date.getFullYear() + direction, 0, 1);
  return dateValue(date);
}

function formatPeriodLabel(
  granularity: Granularity,
  anchor: string,
  locale: string,
) {
  if (granularity === "custom") {
    const range = getPeriodRange("day", anchor);
    return `${formatDate(range.from, locale)} – ${formatDate(range.to, locale)}`;
  }
  const date = anchorDate(anchor);
  if (granularity === "day") {
    return date.toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  if (granularity === "week") {
    const { from, to } = getPeriodRange("week", anchor);
    return formatWeekLabel(from, to, locale);
  }
  if (granularity === "month") {
    return date.toLocaleDateString(locale, { month: "long", year: "numeric" });
  }
  return String(date.getFullYear());
}

function formatWeekLabel(from: string, to: string, locale: string) {
  const start = anchorDate(from);
  const end = anchorDate(to);
  const sameMonth =
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString(locale, {
    day: "numeric",
    month: sameMonth ? undefined : "short",
  });
  const endLabel = end.toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

function withinRange(date: string, from: string, to: string) {
  return date >= from && date <= to;
}

// Midday, so daylight-saving shifts cannot move the date across a boundary.
function anchorDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function startOfWeek(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
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

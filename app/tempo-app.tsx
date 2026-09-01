"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Collection } from "./components/collection";
import {
  DeleteEntityModal,
  type DeleteTarget,
} from "./components/delete-entity-modal";
import { EntryModal } from "./components/entry-modal";
import { Icon, type IconName } from "./components/icon";
import { Reports } from "./components/reports";
import { Settings } from "./components/settings";
import { Timmy } from "./components/timmy";
import { CalendarPage } from "./components/week-calendar";
import { useI18n } from "./i18n/i18n-provider";
import {
  entryAmount,
  entryMinutes,
  formatDuration,
  formatMoney,
  today,
  toLocalInput,
} from "./lib/time";
import type {
  AppData,
  Client,
  Entry,
  ModalType,
  Mutate,
  Project,
  SlotPreset,
  View,
} from "./lib/types";
import type { MessageKey } from "./i18n/types";

const EMPTY_DATA: AppData = { clients: [], projects: [], entries: [] };
const NAVIGATION: Array<{
  view: View;
  labelKey: MessageKey;
  icon: IconName;
  href: string;
}> = [
  {
    view: "registro",
    labelKey: "nav.calendar",
    icon: "calendar",
    href: "/calendar",
  },
  {
    view: "clienti",
    labelKey: "nav.clients",
    icon: "clients",
    href: "/clients",
  },
  {
    view: "progetti",
    labelKey: "nav.projects",
    icon: "projects",
    href: "/projects",
  },
  {
    view: "report",
    labelKey: "nav.reports",
    icon: "reports",
    href: "/reports",
  },
  {
    view: "settings",
    labelKey: "nav.settings",
    icon: "sparkles",
    href: "/settings",
  },
];

const PAGE_TITLE_KEYS: Record<View, MessageKey> = {
  registro: "pageTitle.calendar",
  clienti: "pageTitle.clients",
  progetti: "pageTitle.projects",
  report: "pageTitle.reports",
  settings: "pageTitle.settings",
};

export default function TimmyTimer({ view }: { view: View }) {
  const { t } = useI18n();
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [date, setDate] = useState(today());
  const [modal, setModal] = useState<ModalType | null>(null);
  const [slotPreset, setSlotPreset] = useState<SlotPreset | null>(null);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<MessageKey | null>(null);
  const [timmyNotice, setTimmyNotice] = useState("");

  useEffect(() => {
    void loadData()
      .then(setData)
      .catch(() => setError("app.loadError"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    document.title = `${t(PAGE_TITLE_KEYS[view])} | Timmy Timer`;
  }, [t, view]);

  useEffect(() => {
    if (!timmyNotice) return;
    const timeout = window.setTimeout(() => setTimmyNotice(""), 4_500);
    return () => window.clearTimeout(timeout);
  }, [timmyNotice]);

  const mutate: Mutate = async (method, body, url = "/api/data") => {
    setError(null);
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      setError("app.actionError");
      return false;
    }
    setData(await response.json());
    return true;
  };

  const totals = useMemo(() => calculateTotals(data, date), [data, date]);

  function openNewEntry(preset?: SlotPreset) {
    setEditingEntry(null);
    setSlotPreset(preset ?? null);
    setModal(
      data.projects.length
        ? "entry"
        : data.clients.length
          ? "project"
          : "client",
    );
  }

  function openEntry(entry: Entry) {
    setEditingEntry(entry);
    setSlotPreset({
      start: new Date(entry.started_at),
      end: new Date(entry.ended_at),
    });
    setModal("entry");
  }

  function openClient(client: Client) {
    setEditingClient(client);
    setModal("client");
  }

  function openProject(project: Project) {
    setEditingProject(project);
    setModal("project");
  }

  function closeModal() {
    setModal(null);
    setSlotPreset(null);
    setEditingEntry(null);
    setEditingClient(null);
    setEditingProject(null);
  }

  async function saveModal(body: object) {
    const savedType = modal;
    const wasEditing = Boolean(editingEntry || editingClient || editingProject);
    let saved: boolean;
    if (editingEntry) {
      saved = await mutate("PATCH", {
        ...body,
        type: "entry-details",
        id: editingEntry.id,
      });
    } else if (editingClient) {
      saved = await mutate("PATCH", {
        ...body,
        type: "client-details",
        id: editingClient.id,
      });
    } else if (editingProject) {
      saved = await mutate("PATCH", {
        ...body,
        type: "project-details",
        id: editingProject.id,
      });
    } else {
      saved = await mutate("POST", body);
    }
    if (saved) {
      closeModal();
      setTimmyNotice(
        wasEditing ? t("toast.saved") : t(creationMessageKey(savedType)),
      );
    }
  }

  async function deleteEntity(
    strategy: "reassign" | "delete",
    targetId?: number,
  ) {
    if (!deleteTarget) return;
    const entity = deleteTarget.type;
    const deletedName = deleteTarget.item.name;
    const deleted = await mutate(
      "DELETE",
      {
        id: deleteTarget.item.id,
        strategy,
        targetId,
      },
      `/api/data?entity=${entity}`,
    );
    if (!deleted) return;
    setDeleteTarget(null);
    setTimmyNotice(
      strategy === "reassign"
        ? t("toast.reassigned", { name: deletedName })
        : t("toast.deletedWithEntries", { name: deletedName }),
    );
  }

  return (
    <main className="app-shell">
      <Sidebar currentView={view} dayMinutes={totals.dayMinutes} />
      <section className="workspace">
        <MobileTimmyStatus dayMinutes={totals.dayMinutes} />
        {error && (
          <div className="error" role="alert">
            <strong>{t("app.errorPrefix")}</strong> {t(error)}
          </div>
        )}
        {loading ? (
          <div className="loading">
            <span className="loading-timer">
              <Icon name="timer" />
            </span>
            <strong>{t("app.loading")}</strong>
          </div>
        ) : (
          <AppView
            view={view}
            data={data}
            date={date}
            totals={totals}
            setDate={setDate}
            openNewEntry={openNewEntry}
            openEntry={openEntry}
            openClient={openClient}
            openProject={openProject}
            onDeleteClient={(client) =>
              setDeleteTarget({ type: "client", item: client })
            }
            onDeleteProject={(project) =>
              setDeleteTarget({ type: "project", item: project })
            }
            setModal={setModal}
            mutate={mutate}
          />
        )}
      </section>
      {modal && (
        <EntryModal
          type={modal}
          data={data}
          preset={slotPreset}
          entry={editingEntry}
          client={editingClient}
          project={editingProject}
          onClose={closeModal}
          onSave={saveModal}
        />
      )}
      {deleteTarget && (
        <DeleteEntityModal
          target={deleteTarget}
          data={data}
          onClose={() => setDeleteTarget(null)}
          onConfirm={deleteEntity}
        />
      )}
      {timmyNotice && (
        <div className="timmy-toast" role="status" aria-live="polite">
          <span className="toast-timmy-wrap">
            <Timmy className="toast-timmy" />
          </span>
          <span className="toast-copy">
            <small>{t("timmy.says")}</small>
            <strong>{timmyNotice}</strong>
          </span>
          <button
            type="button"
            onClick={() => setTimmyNotice("")}
            aria-label={t("app.closeNotice")}
          >
            <Icon name="close" />
          </button>
        </div>
      )}
    </main>
  );
}

type Totals = ReturnType<typeof calculateTotals>;

function AppView({
  view,
  data,
  date,
  totals,
  setDate,
  openNewEntry,
  openEntry,
  openClient,
  openProject,
  onDeleteClient,
  onDeleteProject,
  setModal,
  mutate,
}: {
  view: View;
  data: AppData;
  date: string;
  totals: Totals;
  setDate: (value: string) => void;
  openNewEntry: (preset?: SlotPreset) => void;
  openEntry: (entry: Entry) => void;
  openClient: (client: Client) => void;
  openProject: (project: Project) => void;
  onDeleteClient: (client: Client) => void;
  onDeleteProject: (project: Project) => void;
  setModal: (type: ModalType) => void;
  mutate: Mutate;
}) {
  if (view === "registro") {
    return (
      <CalendarPage
        entries={data.entries}
        date={date}
        dayMinutes={totals.dayMinutes}
        dayAmount={totals.dayAmount}
        uninvoiced={totals.uninvoiced}
        setupStage={
          !data.clients.length
            ? "client"
            : !data.projects.length
              ? "project"
              : null
        }
        onDateChange={setDate}
        onCreate={openNewEntry}
        onEdit={openEntry}
        mutate={mutate}
      />
    );
  }
  if (view === "clienti") {
    return (
      <ClientsView
        data={data}
        onAdd={() => setModal("client")}
        onEdit={openClient}
        onDelete={onDeleteClient}
      />
    );
  }
  if (view === "progetti") {
    return (
      <ProjectsView
        data={data}
        onAdd={() => setModal(data.clients.length ? "project" : "client")}
        onEdit={openProject}
        onDelete={onDeleteProject}
      />
    );
  }
  if (view === "report")
    return <Reports entries={data.entries} mutate={mutate} />;
  return <Settings />;
}

function Sidebar({
  currentView,
  dayMinutes,
}: {
  currentView: View;
  dayMinutes: number;
}) {
  const { localeTag, t } = useI18n();

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <Icon name="timer" />
        </span>
        <span className="brand-copy">
          <strong>Timmy Timer</strong>
          <small>{t("brand.tagline")}</small>
        </span>
      </div>
      <nav aria-label={t("nav.aria")}>
        {NAVIGATION.map((item) => (
          <Link
            className={currentView === item.view ? "active" : ""}
            href={item.href}
            key={item.view}
            aria-current={currentView === item.view ? "page" : undefined}
          >
            <Icon name={item.icon} />
            <span>{t(item.labelKey)}</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-foot">
        <div className="today-card">
          <span className="today-timmy-wrap">
            <Timmy className="today-timmy" />
          </span>
          <span className="today-copy">
            <small>{t("timmy.says")}</small>
            <strong>{t(timmyDailyMessageKey(dayMinutes))}</strong>
            <span>
              {t("timmy.tracked", {
                duration: formatDuration(dayMinutes),
              })}
            </span>
          </span>
        </div>
        <p>
          {new Date().toLocaleDateString(localeTag, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </div>
    </aside>
  );
}

function MobileTimmyStatus({ dayMinutes }: { dayMinutes: number }) {
  const { t } = useI18n();

  return (
    <div className="mobile-timmy-status">
      <span className="mobile-timmy-wrap">
        <Timmy className="mobile-timmy" />
      </span>
      <span>
        <small>{t("timmy.says")}</small>
        <strong>{t(timmyDailyMessageKey(dayMinutes))}</strong>
      </span>
      <b>{formatDuration(dayMinutes)}</b>
    </div>
  );
}

function ClientsView({
  data,
  onAdd,
  onEdit,
  onDelete,
}: {
  data: AppData;
  onAdd: () => void;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
}) {
  const { localeTag, t } = useI18n();

  return (
    <Collection
      eyebrow={t("clients.eyebrow")}
      title={t("clients.title")}
      subtitle={t("clients.subtitle")}
      button={t("clients.new")}
      emptyTitle={t("clients.emptyTitle")}
      emptyDescription={t("clients.emptyDescription")}
      onAdd={onAdd}
    >
      {data.clients.map((client) => (
        <article
          className="collection-row client-row"
          key={client.id}
          onDoubleClick={() => onEdit(client)}
        >
          <span className="collection-avatar" aria-hidden="true">
            {client.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{client.name}</strong>
            <span>
              {t(
                data.projects.filter(
                  (project) => project.client_id === client.id,
                ).length === 1
                  ? "clients.projects.one"
                  : "clients.projects.many",
                {
                  count: data.projects.filter(
                    (project) => project.client_id === client.id,
                  ).length,
                },
              )}
            </span>
          </div>
          <div
            className="collection-actions"
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <b>
              {client.hourly_rate_cents
                ? t("clients.ratePerHour", {
                    rate: formatMoney(client.hourly_rate_cents, localeTag),
                  })
                : t("clients.noRate")}
            </b>
            <button
              className="collection-edit"
              onClick={() => onEdit(client)}
              aria-label={t("clients.editAria", { name: client.name })}
            >
              <Icon name="pencil" />
              <span>{t("clients.edit")}</span>
            </button>
            <button
              className="collection-delete"
              onClick={() => onDelete(client)}
              aria-label={t("clients.deleteAria", { name: client.name })}
            >
              <Icon name="trash" />
              <span>{t("clients.delete")}</span>
            </button>
          </div>
        </article>
      ))}
    </Collection>
  );
}

function ProjectsView({
  data,
  onAdd,
  onEdit,
  onDelete,
}: {
  data: AppData;
  onAdd: () => void;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
}) {
  const { localeTag, t } = useI18n();

  return (
    <Collection
      eyebrow={t("projects.eyebrow")}
      title={t("projects.title")}
      subtitle={t("projects.subtitle")}
      button={t("projects.new")}
      emptyTitle={t("projects.emptyTitle")}
      emptyDescription={t("projects.emptyDescription")}
      onAdd={onAdd}
    >
      {data.projects.map((project) => (
        <article
          className="collection-row"
          key={project.id}
          onDoubleClick={() => onEdit(project)}
        >
          <span
            className="project-chip"
            style={{
              background: project.color,
              color: readableTextColor(project.color),
            }}
            aria-hidden="true"
          >
            {project.name.trim().slice(0, 1).toUpperCase() || "P"}
          </span>
          <div>
            <strong>{project.name}</strong>
            <span>
              {
                data.clients.find((client) => client.id === project.client_id)
                  ?.name
              }
            </span>
          </div>
          <div
            className="collection-actions"
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <b>
              {project.hourly_rate_cents
                ? t("clients.ratePerHour", {
                    rate: formatMoney(project.hourly_rate_cents, localeTag),
                  })
                : t("projects.clientRate")}
            </b>
            <button
              className="collection-edit"
              onClick={() => onEdit(project)}
              aria-label={t("projects.editAria", { name: project.name })}
            >
              <Icon name="pencil" />
              <span>{t("projects.edit")}</span>
            </button>
            <button
              className="collection-delete"
              onClick={() => onDelete(project)}
              aria-label={t("projects.deleteAria", { name: project.name })}
            >
              <Icon name="trash" />
              <span>{t("projects.delete")}</span>
            </button>
          </div>
        </article>
      ))}
    </Collection>
  );
}

function calculateTotals(data: AppData, date: string) {
  const dayEntries = data.entries.filter(
    (entry) => toLocalInput(entry.started_at).slice(0, 10) === date,
  );
  return {
    dayMinutes: dayEntries.reduce(
      (total, entry) => total + entryMinutes(entry),
      0,
    ),
    dayAmount: dayEntries.reduce(
      (total, entry) => total + entryAmount(entry),
      0,
    ),
    uninvoiced: data.entries
      .filter((entry) => entry.billable && !entry.invoiced)
      .reduce((total, entry) => total + entryAmount(entry), 0),
  };
}

async function loadData(): Promise<AppData> {
  const response = await fetch("/api/data");
  if (!response.ok) throw new Error("Unable to load data");
  return response.json();
}

function timmyDailyMessageKey(minutes: number): MessageKey {
  if (minutes === 0) return "timmy.daily.start";
  if (minutes < 240) return "timmy.daily.pace";
  if (minutes < 480) return "timmy.daily.great";
  return "timmy.daily.break";
}

function creationMessageKey(type: ModalType | null): MessageKey {
  if (type === "client") return "toast.clientCreated";
  if (type === "project") return "toast.projectCreated";
  return "toast.entryCreated";
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

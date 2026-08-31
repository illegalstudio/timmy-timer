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
import { Timmy } from "./components/timmy";
import { CalendarPage } from "./components/week-calendar";
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

const EMPTY_DATA: AppData = { clients: [], projects: [], entries: [] };
const NAVIGATION: Array<{
  view: View;
  label: string;
  icon: IconName;
  href: string;
}> = [
  { view: "registro", label: "Agenda", icon: "calendar", href: "/agenda" },
  { view: "clienti", label: "Clienti", icon: "clients", href: "/clienti" },
  {
    view: "progetti",
    label: "Progetti",
    icon: "projects",
    href: "/progetti",
  },
  { view: "report", label: "Report", icon: "reports", href: "/report" },
];

export default function TimmyTimer({ view }: { view: View }) {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [date, setDate] = useState(today());
  const [modal, setModal] = useState<ModalType | null>(null);
  const [slotPreset, setSlotPreset] = useState<SlotPreset | null>(null);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timmyNotice, setTimmyNotice] = useState("");

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
    void loadData()
      .then(setData)
      .catch(() => setError("Impossibile caricare i dati."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!timmyNotice) return;
    const timeout = window.setTimeout(() => setTimmyNotice(""), 4_500);
    return () => window.clearTimeout(timeout);
  }, [timmyNotice]);

  const mutate: Mutate = async (method, body, url = "/api/data") => {
    setError("");
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      setError("Operazione non riuscita.");
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
        wasEditing
          ? "Modifiche salvate. Tutto in ordine!"
          : creationMessage(savedType),
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
        ? `${deletedName} eliminato. Le attività sono al sicuro!`
        : `${deletedName} e le attività collegate sono stati eliminati.`,
    );
  }

  return (
    <main className="app-shell">
      <Sidebar currentView={view} dayMinutes={totals.dayMinutes} />
      <section className="workspace">
        <MobileTimmyStatus dayMinutes={totals.dayMinutes} />
        {error && (
          <div className="error" role="alert">
            <strong>Ops.</strong> {error}
          </div>
        )}
        {loading ? (
          <div className="loading">
            <span className="loading-timer">
              <Icon name="timer" />
            </span>
            <strong>Timmy sta preparando tutto…</strong>
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
            <small>Timmy dice</small>
            <strong>{timmyNotice}</strong>
          </span>
          <button
            type="button"
            onClick={() => setTimmyNotice("")}
            aria-label="Chiudi messaggio di Timmy"
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
  return <Reports entries={data.entries} />;
}

function Sidebar({
  currentView,
  dayMinutes,
}: {
  currentView: View;
  dayMinutes: number;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <Icon name="timer" />
        </span>
        <span className="brand-copy">
          <strong>Timmy Timer</strong>
          <small>Time tracking, felice.</small>
        </span>
      </div>
      <nav aria-label="Navigazione principale">
        {NAVIGATION.map((item) => (
          <Link
            className={currentView === item.view ? "active" : ""}
            href={item.href}
            key={item.view}
            aria-current={currentView === item.view ? "page" : undefined}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-foot">
        <div className="today-card">
          <span className="today-timmy-wrap">
            <Timmy className="today-timmy" />
          </span>
          <span className="today-copy">
            <small>Timmy dice</small>
            <strong>{timmyDailyMessage(dayMinutes)}</strong>
            <span>{formatDuration(dayMinutes)} registrate</span>
          </span>
        </div>
        <p>
          {new Date().toLocaleDateString("it-IT", {
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
  return (
    <div className="mobile-timmy-status">
      <span className="mobile-timmy-wrap">
        <Timmy className="mobile-timmy" />
      </span>
      <span>
        <small>Timmy dice</small>
        <strong>{timmyDailyMessage(dayMinutes)}</strong>
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
  return (
    <Collection
      eyebrow="La tua rubrica"
      title="Clienti"
      subtitle="Persone, aziende e tariffe: tutto in ordine."
      button="Nuovo cliente"
      emptyTitle="Iniziamo dalle persone."
      emptyDescription="Aggiungi il primo cliente: Timmy terrà insieme progetti, tariffe e tempo dedicato."
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
              {
                data.projects.filter(
                  (project) => project.client_id === client.id,
                ).length
              }{" "}
              progetti
            </span>
          </div>
          <div
            className="collection-actions"
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <b>
              {client.hourly_rate_cents
                ? `${formatMoney(client.hourly_rate_cents)}/ora`
                : "Nessuna tariffa"}
            </b>
            <button
              className="collection-edit"
              onClick={() => onEdit(client)}
              aria-label={`Modifica ${client.name}`}
            >
              <Icon name="pencil" />
              <span>Modifica</span>
            </button>
            <button
              className="collection-delete"
              onClick={() => onDelete(client)}
              aria-label={`Elimina ${client.name}`}
            >
              <Icon name="trash" />
              <span>Elimina</span>
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
  return (
    <Collection
      eyebrow="Il tuo lavoro"
      title="Progetti"
      subtitle="Colora, organizza e ritrova ogni incarico."
      button="Nuovo progetto"
      emptyTitle="Diamo un nome al prossimo lavoro."
      emptyDescription="Crea un cliente e poi il suo primo progetto. Da lì, ogni minuto troverà il posto giusto."
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
                ? `${formatMoney(project.hourly_rate_cents)}/ora`
                : "Tariffa cliente"}
            </b>
            <button
              className="collection-edit"
              onClick={() => onEdit(project)}
              aria-label={`Modifica ${project.name}`}
            >
              <Icon name="pencil" />
              <span>Modifica</span>
            </button>
            <button
              className="collection-delete"
              onClick={() => onDelete(project)}
              aria-label={`Elimina ${project.name}`}
            >
              <Icon name="trash" />
              <span>Elimina</span>
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

function timmyDailyMessage(minutes: number) {
  if (minutes === 0) return "Pronti a partire?";
  if (minutes < 240) return "Bel ritmo!";
  if (minutes < 480) return "Ottimo lavoro.";
  return "Tempo di staccare?";
}

function creationMessage(type: ModalType | null) {
  if (type === "client") return "Cliente aggiunto. Primo passo fatto!";
  if (type === "project") return "Progetto pronto. Ora si parte!";
  return "Slot segnato. Bel ritmo!";
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

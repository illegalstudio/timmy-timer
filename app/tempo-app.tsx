"use client";

import { useEffect, useMemo, useState } from "react";
import { Collection } from "./components/collection";
import { EntryModal } from "./components/entry-modal";
import { Reports } from "./components/reports";
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
const NAVIGATION: Array<{ view: View; label: string }> = [
  { view: "registro", label: "Registro" },
  { view: "clienti", label: "Clienti" },
  { view: "progetti", label: "Progetti" },
  { view: "report", label: "Report" },
];

export default function TempoApp() {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [view, setView] = useState<View>("registro");
  const [date, setDate] = useState(today());
  const [modal, setModal] = useState<ModalType | null>(null);
  const [slotPreset, setSlotPreset] = useState<SlotPreset | null>(null);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
    void loadData()
      .then(setData)
      .catch(() => setError("Impossibile caricare i dati."))
      .finally(() => setLoading(false));
  }, []);

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
    setModal(data.projects.length ? "entry" : "project");
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
    if (saved) closeModal();
  }

  return (
    <main className="app-shell">
      <Sidebar
        currentView={view}
        dayMinutes={totals.dayMinutes}
        onNavigate={setView}
      />
      <section className="workspace">
        {error && <div className="error">{error}</div>}
        {loading ? (
          <div className="loading">Caricamento…</div>
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
      />
    );
  }
  if (view === "progetti") {
    return (
      <ProjectsView
        data={data}
        onAdd={() => setModal(data.clients.length ? "project" : "client")}
        onEdit={openProject}
      />
    );
  }
  return <Reports entries={data.entries} />;
}

function Sidebar({
  currentView,
  dayMinutes,
  onNavigate,
}: {
  currentView: View;
  dayMinutes: number;
  onNavigate: (view: View) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">T</span>
        <span>Tempo</span>
      </div>
      <nav>
        {NAVIGATION.map((item) => (
          <button
            className={currentView === item.view ? "active" : ""}
            key={item.view}
            onClick={() => onNavigate(item.view)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">
        {new Date().toLocaleDateString("it-IT", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        <br />
        <strong>{formatDuration(dayMinutes)}</strong> registrate
      </div>
    </aside>
  );
}

function ClientsView({
  data,
  onAdd,
  onEdit,
}: {
  data: AppData;
  onAdd: () => void;
  onEdit: (client: Client) => void;
}) {
  return (
    <Collection
      title="Clienti"
      subtitle="Tariffe predefinite e storico dei clienti."
      button="Nuovo cliente"
      empty="Non hai ancora creato clienti."
      onAdd={onAdd}
    >
      {data.clients.map((client) => (
        <article
          className="collection-row client-row"
          key={client.id}
          onDoubleClick={() => onEdit(client)}
        >
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
          <div className="collection-actions">
            <b>
              {client.hourly_rate_cents
                ? `${formatMoney(client.hourly_rate_cents)}/ora`
                : "Nessuna tariffa"}
            </b>
            <button className="collection-edit" onClick={() => onEdit(client)}>
              Modifica
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
}: {
  data: AppData;
  onAdd: () => void;
  onEdit: (project: Project) => void;
}) {
  return (
    <Collection
      title="Progetti"
      subtitle="Ogni progetto appartiene a un cliente."
      button="Nuovo progetto"
      empty="Crea prima un cliente, poi il suo primo progetto."
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
            style={{ background: project.color }}
          />
          <div>
            <strong>{project.name}</strong>
            <span>
              {
                data.clients.find((client) => client.id === project.client_id)
                  ?.name
              }
            </span>
          </div>
          <div className="collection-actions">
            <b>
              {project.hourly_rate_cents
                ? `${formatMoney(project.hourly_rate_cents)}/ora`
                : "Tariffa cliente"}
            </b>
            <button className="collection-edit" onClick={() => onEdit(project)}>
              Modifica
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

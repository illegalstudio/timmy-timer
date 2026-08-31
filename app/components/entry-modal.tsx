"use client";

import { type FormEvent, useEffect, useState } from "react";
import { toLocalInput } from "../lib/time";
import { Icon } from "./icon";
import { SmartSelect } from "./smart-select";
import type {
  AppData,
  Client,
  Entry,
  ModalType,
  Project,
  SlotPreset,
} from "../lib/types";

type EntryModalProps = {
  type: ModalType;
  data: AppData;
  preset: SlotPreset | null;
  entry: Entry | null;
  client: Client | null;
  project: Project | null;
  onClose: () => void;
  onSave: (body: object) => Promise<void>;
};

export function EntryModal({
  type,
  data,
  preset,
  entry,
  client,
  project,
  onClose,
  onSave,
}: EntryModalProps) {
  const [busy, setBusy] = useState(false);
  const start = preset?.start ?? roundedCurrentHour();
  const end = preset?.end ?? new Date(start.getTime() + 3_600_000);
  const isEditing = Boolean(entry || client || project);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);

    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());

    if (type === "entry") {
      values.startedAt = new Date(String(values.startedAt)).toISOString();
      values.endedAt = new Date(String(values.endedAt)).toISOString();
    }

    await onSave({
      type,
      ...values,
      billable: type === "entry" ? form.has("billable") : undefined,
    });
    setBusy(false);
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="modal"
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-head">
          <div className="modal-title-group">
            <span className="modal-icon">
              <Icon
                name={
                  type === "entry"
                    ? "clock"
                    : type === "client"
                      ? "clients"
                      : "projects"
                }
              />
            </span>
            <div>
              <p className="eyebrow">
                {isEditing ? "Metti a punto" : "Aggiungi alla tua agenda"}
              </p>
              <h2 id="modal-title">{modalTitle(type)}</h2>
              <p>{modalDescription(type)}</p>
            </div>
          </div>
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
          >
            <Icon name="close" />
          </button>
        </div>

        {type === "client" && <ClientFields client={client} />}
        {type === "project" && <ProjectFields data={data} project={project} />}
        {type === "entry" && (
          <TimeEntryFields data={data} entry={entry} start={start} end={end} />
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Annulla
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Salvataggio…" : isEditing ? "Salva modifiche" : "Salva"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ClientFields({ client }: { client: Client | null }) {
  return (
    <>
      <label>
        Nome
        <input
          name="name"
          required
          autoFocus
          defaultValue={client?.name}
          placeholder="es. Acme S.r.l."
        />
      </label>
      <label>
        Tariffa predefinita €/ora
        <input
          name="hourlyRate"
          type="number"
          min="0"
          step="0.01"
          defaultValue={
            client?.hourly_rate_cents
              ? client.hourly_rate_cents / 100
              : undefined
          }
        />
      </label>
    </>
  );
}

function ProjectFields({
  data,
  project,
}: {
  data: AppData;
  project: Project | null;
}) {
  return (
    <>
      <SmartSelect
        label="Cliente"
        name="clientId"
        required
        defaultValue={String(project?.client_id ?? data.clients[0]?.id ?? "")}
        searchPlaceholder="Cerca cliente…"
        options={data.clients.map((client) => ({
          value: String(client.id),
          label: client.name,
          hint: client.hourly_rate_cents
            ? `${(client.hourly_rate_cents / 100).toLocaleString("it-IT", {
                style: "currency",
                currency: "EUR",
              })}/ora`
            : "Nessuna tariffa predefinita",
        }))}
      />
      <label>
        Nome progetto
        <input name="name" required autoFocus defaultValue={project?.name} />
      </label>
      <div className="form-grid">
        <label>
          Colore
          <input
            name="color"
            type="color"
            defaultValue={project?.color ?? "#F06B52"}
          />
        </label>
        <label>
          Tariffa specifica €/ora
          <input
            name="hourlyRate"
            type="number"
            min="0"
            step="0.01"
            defaultValue={
              project?.hourly_rate_cents
                ? project.hourly_rate_cents / 100
                : undefined
            }
          />
        </label>
      </div>
    </>
  );
}

function TimeEntryFields({
  data,
  entry,
  start,
  end,
}: {
  data: AppData;
  entry: Entry | null;
  start: Date;
  end: Date;
}) {
  return (
    <>
      <SmartSelect
        label="Progetto"
        name="projectId"
        required
        defaultValue={String(entry?.project_id ?? data.projects[0]?.id ?? "")}
        searchPlaceholder="Cerca progetto o cliente…"
        options={data.projects.map((project) => {
          const clientName = data.clients.find(
            (client) => client.id === project.client_id,
          )?.name;
          return {
            value: String(project.id),
            label: project.name,
            hint: clientName,
            keywords: clientName,
            color: project.color,
          };
        })}
      />
      <div className="form-grid">
        <label>
          Inizio
          <input
            name="startedAt"
            type="datetime-local"
            required
            defaultValue={toLocalInput(start.toISOString())}
          />
        </label>
        <label>
          Fine
          <input
            name="endedAt"
            type="datetime-local"
            required
            defaultValue={toLocalInput(end.toISOString())}
          />
        </label>
      </div>
      <label>
        Descrizione
        <input name="description" defaultValue={entry?.description ?? ""} />
      </label>
      <label>
        Tariffa €/ora
        <input
          name="hourlyRate"
          type="number"
          min="0"
          step="0.01"
          required={Boolean(entry)}
          defaultValue={entry ? entry.hourly_rate_cents / 100 : undefined}
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          name="billable"
          defaultChecked={entry ? Boolean(entry.billable) : true}
        />
        Attività fatturabile
      </label>
    </>
  );
}

function roundedCurrentHour() {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  return date;
}

function modalTitle(type: ModalType) {
  if (type === "entry") return "Slot di tempo";
  if (type === "client") return "Dettagli cliente";
  return "Dettagli progetto";
}

function modalDescription(type: ModalType) {
  if (type === "entry") return "Cosa hai fatto e quanto tempo ci hai dedicato?";
  if (type === "client") return "Una casa ordinata per progetti e tariffe.";
  return "Dai un nome e un colore al lavoro da tracciare.";
}

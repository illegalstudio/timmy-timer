"use client";

import { type FormEvent, useEffect, useState } from "react";
import { toLocalInput } from "../lib/time";
import type { AppData, Entry, ModalType, SlotPreset } from "../lib/types";

type EntryModalProps = {
  type: ModalType;
  data: AppData;
  preset: SlotPreset | null;
  entry: Entry | null;
  onClose: () => void;
  onSave: (body: object) => Promise<void>;
};

export function EntryModal({
  type,
  data,
  preset,
  entry,
  onClose,
  onSave,
}: EntryModalProps) {
  const [busy, setBusy] = useState(false);
  const start = preset?.start ?? roundedCurrentHour();
  const end = preset?.end ?? new Date(start.getTime() + 3_600_000);

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
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">
              {entry ? "Modifica attività" : "Nuovo elemento"}
            </p>
            <h2>{modalTitle(type)}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Chiudi">
            ×
          </button>
        </div>

        {type === "client" && <ClientFields />}
        {type === "project" && <ProjectFields data={data} />}
        {type === "entry" && (
          <TimeEntryFields data={data} entry={entry} start={start} end={end} />
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Annulla
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Salvataggio…" : entry ? "Salva modifiche" : "Salva"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ClientFields() {
  return (
    <>
      <label>
        Nome
        <input name="name" required autoFocus placeholder="es. Acme S.r.l." />
      </label>
      <label>
        Tariffa predefinita €/ora
        <input name="hourlyRate" type="number" min="0" step="0.01" />
      </label>
    </>
  );
}

function ProjectFields({ data }: { data: AppData }) {
  return (
    <>
      <label>
        Cliente
        <select name="clientId" required>
          {data.clients.map((client) => (
            <option value={client.id} key={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Nome progetto
        <input name="name" required autoFocus />
      </label>
      <div className="form-grid">
        <label>
          Colore
          <input name="color" type="color" defaultValue="#5b5bd6" />
        </label>
        <label>
          Tariffa specifica €/ora
          <input name="hourlyRate" type="number" min="0" step="0.01" />
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
      <label>
        Progetto
        <select name="projectId" required defaultValue={entry?.project_id}>
          {data.projects.map((project) => (
            <option value={project.id} key={project.id}>
              {
                data.clients.find((client) => client.id === project.client_id)
                  ?.name
              }
              {" — "}
              {project.name}
            </option>
          ))}
        </select>
      </label>
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
  if (type === "client") return "Cliente";
  return "Progetto";
}

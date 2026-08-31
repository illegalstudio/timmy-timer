"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useI18n } from "../i18n/i18n-provider";
import { formatMoney, toLocalInput } from "../lib/time";
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
  const { t } = useI18n();
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
                {isEditing ? t("modal.editEyebrow") : t("modal.addEyebrow")}
              </p>
              <h2 id="modal-title">
                {type === "entry"
                  ? t("modal.entry.title")
                  : type === "client"
                    ? t("modal.client.title")
                    : t("modal.project.title")}
              </h2>
              <p>
                {type === "entry"
                  ? t("modal.entry.description")
                  : type === "client"
                    ? t("modal.client.description")
                    : t("modal.project.description")}
              </p>
            </div>
          </div>
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            aria-label={t("modal.close")}
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
            {t("modal.cancel")}
          </button>
          <button className="primary" disabled={busy}>
            {busy
              ? t("modal.saving")
              : isEditing
                ? t("modal.saveChanges")
                : t("modal.save")}
          </button>
        </div>
      </form>
    </div>
  );
}

function ClientFields({ client }: { client: Client | null }) {
  const { t } = useI18n();

  return (
    <>
      <label>
        {t("field.name")}
        <input
          name="name"
          required
          autoFocus
          defaultValue={client?.name}
          placeholder={t("field.clientPlaceholder")}
        />
      </label>
      <label>
        {t("field.defaultRate")}
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
  const { localeTag, t } = useI18n();

  return (
    <>
      <SmartSelect
        label={t("field.client")}
        name="clientId"
        required
        defaultValue={String(project?.client_id ?? data.clients[0]?.id ?? "")}
        searchPlaceholder={t("field.searchClient")}
        options={data.clients.map((client) => ({
          value: String(client.id),
          label: client.name,
          hint: client.hourly_rate_cents
            ? t("clients.ratePerHour", {
                rate: formatMoney(client.hourly_rate_cents, localeTag),
              })
            : t("field.noDefaultRate"),
        }))}
      />
      <label>
        {t("field.projectName")}
        <input name="name" required autoFocus defaultValue={project?.name} />
      </label>
      <div className="form-grid">
        <label>
          {t("field.color")}
          <input
            name="color"
            type="color"
            defaultValue={project?.color ?? "#F06B52"}
          />
        </label>
        <label>
          {t("field.specificRate")}
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
  const { t } = useI18n();

  return (
    <>
      <SmartSelect
        label={t("field.project")}
        name="projectId"
        required
        defaultValue={String(entry?.project_id ?? data.projects[0]?.id ?? "")}
        searchPlaceholder={t("field.searchProjectClient")}
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
          {t("field.start")}
          <input
            name="startedAt"
            type="datetime-local"
            required
            defaultValue={toLocalInput(start.toISOString())}
          />
        </label>
        <label>
          {t("field.end")}
          <input
            name="endedAt"
            type="datetime-local"
            required
            defaultValue={toLocalInput(end.toISOString())}
          />
        </label>
      </div>
      <label>
        {t("field.description")}
        <input name="description" defaultValue={entry?.description ?? ""} />
      </label>
      <label>
        {t("field.rate")}
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
        {t("field.billable")}
      </label>
    </>
  );
}

function roundedCurrentHour() {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  return date;
}

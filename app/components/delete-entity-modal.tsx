"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { AppData, Client, Project } from "../lib/types";
import { Icon } from "./icon";
import { SmartSelect } from "./smart-select";

export type DeleteTarget =
  { type: "client"; item: Client } | { type: "project"; item: Project };

type DeleteEntityModalProps = {
  target: DeleteTarget;
  data: AppData;
  onClose: () => void;
  onConfirm: (
    strategy: "reassign" | "delete",
    targetId?: number,
  ) => Promise<void>;
};

export function DeleteEntityModal({
  target,
  data,
  onClose,
  onConfirm,
}: DeleteEntityModalProps) {
  const alternatives = useMemo(
    () =>
      target.type === "client"
        ? data.clients.filter((client) => client.id !== target.item.id)
        : data.projects.filter((project) => project.id !== target.item.id),
    [data, target],
  );
  const projectIds = useMemo(
    () =>
      target.type === "client"
        ? new Set(
            data.projects
              .filter((project) => project.client_id === target.item.id)
              .map((project) => project.id),
          )
        : new Set([target.item.id]),
    [data.projects, target],
  );
  const projectCount =
    target.type === "client"
      ? data.projects.filter((project) => project.client_id === target.item.id)
          .length
      : 0;
  const entryCount = data.entries.filter((entry) =>
    projectIds.has(entry.project_id),
  ).length;
  const hasDependencies = entryCount > 0 || projectCount > 0;
  const [strategy, setStrategy] = useState<"reassign" | "delete">(
    alternatives.length && hasDependencies ? "reassign" : "delete",
  );
  const [destinationId, setDestinationId] = useState(
    alternatives[0]?.id ? String(alternatives[0].id) : "",
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || busy) return;
      event.preventDefault();
      onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (strategy === "reassign" && !destinationId) return;
    setBusy(true);
    await onConfirm(
      strategy,
      strategy === "reassign" ? Number(destinationId) : undefined,
    );
    setBusy(false);
  }

  const entityLabel = target.type === "client" ? "cliente" : "progetto";
  const destinationLabel = target.type === "client" ? "cliente" : "progetto";

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (!busy && event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="modal delete-entity-modal"
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-entity-title"
      >
        <div className="modal-head">
          <div className="modal-title-group">
            <span className="modal-icon danger-icon">
              <Icon name="trash" />
            </span>
            <div>
              <p className="eyebrow">Facciamo ordine</p>
              <h2 id="delete-entity-title">Elimina {target.item.name}</h2>
              <p>
                Stai eliminando un {entityLabel}. Scegli cosa fare delle
                attività collegate.
              </p>
            </div>
          </div>
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Chiudi"
          >
            <Icon name="close" />
          </button>
        </div>

        <DependencySummary
          type={target.type}
          projectCount={projectCount}
          entryCount={entryCount}
        />

        {hasDependencies ? (
          <fieldset className="delete-options">
            <legend>Cosa vuoi fare?</legend>
            {alternatives.length > 0 && (
              <label className={strategy === "reassign" ? "selected" : ""}>
                <input
                  type="radio"
                  name="deleteStrategy"
                  value="reassign"
                  checked={strategy === "reassign"}
                  onChange={() => setStrategy("reassign")}
                />
                <span className="delete-option-icon safe">
                  <Icon
                    name={target.type === "client" ? "clients" : "projects"}
                  />
                </span>
                <span>
                  <strong>Sposta e conserva</strong>
                  <small>
                    {target.type === "client"
                      ? "I progetti e tutti i loro slot passeranno a un altro cliente."
                      : "Tutti gli slot passeranno a un altro progetto."}
                  </small>
                </span>
              </label>
            )}
            <label
              className={`danger-option ${strategy === "delete" ? "selected" : ""}`}
            >
              <input
                type="radio"
                name="deleteStrategy"
                value="delete"
                checked={strategy === "delete"}
                onChange={() => setStrategy("delete")}
              />
              <span className="delete-option-icon">
                <Icon name="trash" />
              </span>
              <span>
                <strong>Elimina tutto</strong>
                <small>
                  {target.type === "client"
                    ? "Cliente, progetti e slot collegati saranno eliminati definitivamente."
                    : "Progetto e slot collegati saranno eliminati definitivamente."}
                </small>
              </span>
            </label>
          </fieldset>
        ) : (
          <div className="no-dependencies">
            <Icon name="sparkles" />
            <span>
              <strong>Nessuna attività da sistemare.</strong>
              <small>Puoi eliminare questo {entityLabel} in sicurezza.</small>
            </span>
          </div>
        )}

        {strategy === "reassign" && (
          <SmartSelect
            className="delete-destination"
            label={`Sposta nel ${destinationLabel}`}
            value={destinationId}
            onValueChange={setDestinationId}
            required
            searchPlaceholder={`Cerca ${destinationLabel}…`}
            options={alternatives.map((alternative) => {
              const clientName =
                target.type === "project"
                  ? data.clients.find(
                      (client) =>
                        client.id === (alternative as Project).client_id,
                    )?.name
                  : undefined;
              return {
                value: String(alternative.id),
                label: alternative.name,
                hint: clientName,
                keywords: clientName,
                color:
                  target.type === "project"
                    ? (alternative as Project).color
                    : undefined,
              };
            })}
          />
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={busy}>
            Annulla
          </button>
          <button className="delete-confirm-button" disabled={busy}>
            <Icon
              name={
                strategy === "delete"
                  ? "trash"
                  : target.type === "client"
                    ? "clients"
                    : "projects"
              }
            />
            {busy
              ? "Operazione in corso…"
              : strategy === "reassign"
                ? `Sposta ed elimina ${entityLabel}`
                : `Elimina ${entityLabel}`}
          </button>
        </div>
      </form>
    </div>
  );
}

function DependencySummary({
  type,
  projectCount,
  entryCount,
}: {
  type: DeleteTarget["type"];
  projectCount: number;
  entryCount: number;
}) {
  return (
    <div className="dependency-summary">
      {type === "client" && (
        <span>
          <Icon name="projects" />
          <strong>{projectCount}</strong>
          {projectCount === 1 ? "progetto" : "progetti"}
        </span>
      )}
      <span>
        <Icon name="clock" />
        <strong>{entryCount}</strong>
        {entryCount === 1 ? "slot" : "slot"}
      </span>
    </div>
  );
}

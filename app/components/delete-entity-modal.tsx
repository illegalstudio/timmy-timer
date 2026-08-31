"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n/i18n-provider";
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
  const { t } = useI18n();
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
              <p className="eyebrow">{t("delete.eyebrow")}</p>
              <h2 id="delete-entity-title">
                {t("delete.title", { name: target.item.name })}
              </h2>
              <p>
                {target.type === "client"
                  ? t("delete.description.client")
                  : t("delete.description.project")}
              </p>
            </div>
          </div>
          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={t("modal.close")}
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
            <legend>{t("delete.question")}</legend>
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
                  <strong>{t("delete.moveKeep")}</strong>
                  <small>
                    {target.type === "client"
                      ? t("delete.move.clientDescription")
                      : t("delete.move.projectDescription")}
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
                <strong>{t("delete.deleteAll")}</strong>
                <small>
                  {target.type === "client"
                    ? t("delete.all.clientDescription")
                    : t("delete.all.projectDescription")}
                </small>
              </span>
            </label>
          </fieldset>
        ) : (
          <div className="no-dependencies">
            <Icon name="sparkles" />
            <span>
              <strong>{t("delete.noActivities")}</strong>
              <small>
                {target.type === "client"
                  ? t("delete.safe.client")
                  : t("delete.safe.project")}
              </small>
            </span>
          </div>
        )}

        {strategy === "reassign" && (
          <SmartSelect
            className="delete-destination"
            label={
              target.type === "client"
                ? t("delete.moveTo.client")
                : t("delete.moveTo.project")
            }
            value={destinationId}
            onValueChange={setDestinationId}
            required
            searchPlaceholder={
              target.type === "client"
                ? t("delete.search.client")
                : t("delete.search.project")
            }
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
            {t("modal.cancel")}
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
              ? t("delete.inProgress")
              : strategy === "reassign"
                ? target.type === "client"
                  ? t("delete.moveAndDelete.client")
                  : t("delete.moveAndDelete.project")
                : target.type === "client"
                  ? t("delete.confirm.client")
                  : t("delete.confirm.project")}
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
  const { t } = useI18n();

  return (
    <div className="dependency-summary">
      {type === "client" && (
        <span>
          <Icon name="projects" />
          <strong>{projectCount}</strong>
          {projectCount === 1
            ? t("delete.projects.one")
            : t("delete.projects.many")}
        </span>
      )}
      <span>
        <Icon name="clock" />
        <strong>{entryCount}</strong>
        {entryCount === 1 ? t("delete.entries.one") : t("delete.entries.many")}
      </span>
    </div>
  );
}

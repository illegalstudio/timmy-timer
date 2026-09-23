"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/i18n-provider";
import { checkSession, SESSION_URL } from "../lib/api";
import { Icon } from "./icon";

type Status = "idle" | "expired" | "waiting" | "blocked";

// How often the pop-up is checked for a completed sign-in.
const POLL_MS = 1_500;
// Coming back to the tab re-checks the session at most this often.
const RECHECK_MS = 5 * 60_000;

/**
 * Keeps work alive across an expired Cloudflare Access session. A request
 * that meets the expired session calls `renew` and simply waits: the user
 * signs in again in a pop-up, and the promise resolves true so the request
 * can be repeated, or false if they give up.
 */
export function useSessionRenewal() {
  const [status, setStatus] = useState<Status>("idle");
  const [pending, setPending] = useState(false);
  const waiters = useRef<Array<(renewed: boolean) => void>>([]);
  const popup = useRef<Window | null>(null);
  const timer = useRef<number | null>(null);
  const checking = useRef(false);

  const stopPolling = useCallback(() => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
  }, []);

  const settle = useCallback(
    (renewed: boolean) => {
      stopPolling();
      popup.current?.close();
      popup.current = null;
      const list = waiters.current;
      waiters.current = [];
      for (const resolve of list) resolve(renewed);
      setPending(false);
      setStatus("idle");
    },
    [stopPolling],
  );

  const renew = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        waiters.current.push(resolve);
        setPending(true);
        setStatus((current) => (current === "idle" ? "expired" : current));
      }),
    [],
  );

  const signIn = useCallback(() => {
    const opened = window.open(
      SESSION_URL,
      "timmy-timer-sign-in",
      "popup,width=520,height=680",
    );
    if (!opened) {
      setStatus("blocked");
      return;
    }
    popup.current = opened;
    setStatus("waiting");
    stopPolling();
    timer.current = window.setInterval(async () => {
      if (checking.current) return;
      checking.current = true;
      const state = await checkSession();
      checking.current = false;
      if (state === "active") {
        settle(true);
      } else if (popup.current?.closed) {
        // Closed before signing in: offer the button again.
        stopPolling();
        popup.current = null;
        setStatus("expired");
      }
    }, POLL_MS);
  }, [settle, stopPolling]);

  // A tab left open overnight finds out on its return, before the user has
  // typed anything, rather than on the next save.
  useEffect(() => {
    let lastCheck = Date.now();
    async function recheck() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastCheck < RECHECK_MS) return;
      lastCheck = Date.now();
      if ((await checkSession()) === "expired")
        setStatus((current) => (current === "idle" ? "expired" : current));
    }
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheck);
    return () => {
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("focus", recheck);
    };
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  return {
    renew,
    dialog: {
      status,
      pending,
      onSignIn: signIn,
      onDismiss: () => settle(false),
    },
  };
}

export function SessionDialog({
  status,
  pending,
  onSignIn,
  onDismiss,
}: {
  status: Status;
  pending: boolean;
  onSignIn: () => void;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  if (status === "idle") return null;

  return (
    <div className="modal-backdrop session-backdrop" role="presentation">
      <div
        className="modal session-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-dialog-title"
        aria-describedby="session-dialog-description"
      >
        <div className="modal-head">
          <div className="modal-title-group">
            <span className="modal-icon">
              <Icon name="clock" />
            </span>
            <div>
              <p className="eyebrow">{t("session.eyebrow")}</p>
              <h2 id="session-dialog-title">{t("session.title")}</h2>
              <p id="session-dialog-description">
                {t(pending ? "session.pending" : "session.idle")}
              </p>
            </div>
          </div>
        </div>
        {status === "waiting" && (
          <p className="session-note" role="status" aria-live="polite">
            {t("session.waiting")}
          </p>
        )}
        {status === "blocked" && (
          <p className="session-note is-warning" role="alert">
            {t("session.blocked")}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onDismiss}>
            {t("session.dismiss")}
          </button>
          <button
            className="primary"
            type="button"
            onClick={onSignIn}
            autoFocus
          >
            {t("session.signIn")}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useI18n } from "../i18n/i18n-provider";

type InstallOutcome = "accepted" | "dismissed" | "unavailable";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PwaContextValue = {
  canInstall: boolean;
  install: () => Promise<InstallOutcome>;
  isInstalled: boolean;
  isIos: boolean;
  ready: boolean;
};

const PwaContext = createContext<PwaContextValue | null>(null);

export function PwaProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [ready, setReady] = useState(false);
  const [updateRegistration, setUpdateRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const reloading = useRef(false);

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const standaloneNavigator = navigator as Navigator & {
      standalone?: boolean;
    };
    const updateInstalledState = () =>
      setIsInstalled(
        displayMode.matches || standaloneNavigator.standalone === true,
      );
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleControllerChange = () => {
      if (reloading.current) return;
      reloading.current = true;
      window.location.reload();
    };

    const initialStateTimeout = window.setTimeout(() => {
      updateInstalledState();
      setIsIos(
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
      );
      setIsOnline(navigator.onLine);
      setReady(true);
    }, 0);

    displayMode.addEventListener("change", updateInstalledState);
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        handleControllerChange,
      );
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          if (registration.waiting && navigator.serviceWorker.controller) {
            setUpdateRegistration(registration);
          }
          registration.addEventListener("updatefound", () => {
            const worker = registration.installing;
            if (!worker) return;
            worker.addEventListener("statechange", () => {
              if (
                worker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                setUpdateRegistration(registration);
              }
            });
          });
          void registration.update();
        })
        .catch(() => undefined);
    }

    return () => {
      window.clearTimeout(initialStateTimeout);
      displayMode.removeEventListener("change", updateInstalledState);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      navigator.serviceWorker?.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
    };
  }, []);

  const install = useCallback(async (): Promise<InstallOutcome> => {
    if (!installPrompt) return "unavailable";
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    return choice.outcome;
  }, [installPrompt]);

  const applyUpdate = useCallback(() => {
    updateRegistration?.waiting?.postMessage({ type: "SKIP_WAITING" });
  }, [updateRegistration]);

  const value = useMemo(
    () => ({
      canInstall: Boolean(installPrompt) && !isInstalled,
      install,
      isInstalled,
      isIos,
      ready,
    }),
    [install, installPrompt, isInstalled, isIos, ready],
  );

  return (
    <PwaContext.Provider value={value}>
      {children}
      {!isOnline && (
        <div className="pwa-banner offline" role="status">
          <span className="pwa-status-dot" />
          <span>{t("pwa.offline")}</span>
        </div>
      )}
      {isOnline && updateRegistration && (
        <div className="pwa-banner update" role="status">
          <span>{t("pwa.updateAvailable")}</span>
          <button type="button" onClick={applyUpdate}>
            {t("pwa.updateNow")}
          </button>
        </div>
      )}
    </PwaContext.Provider>
  );
}

export function usePwa() {
  const context = useContext(PwaContext);
  if (!context) throw new Error("usePwa must be used inside PwaProvider");
  return context;
}

"use client";

import Image from "next/image";
import { useState } from "react";
import { LANGUAGE_OPTIONS, useI18n } from "../i18n/i18n-provider";
import { Icon } from "./icon";
import { usePwa } from "./pwa-provider";
import { Timmy } from "./timmy";

export function Settings() {
  const { locale, setLocale, t } = useI18n();
  const { canInstall, install, isInstalled, isIos, ready } = usePwa();
  const [installing, setInstalling] = useState(false);

  const pwaStatus = isInstalled
    ? {
        title: t("pwa.installedTitle"),
        description: t("pwa.installedDescription"),
      }
    : canInstall
      ? { title: t("pwa.readyTitle"), description: t("pwa.readyDescription") }
      : isIos
        ? { title: t("pwa.iosTitle"), description: t("pwa.iosDescription") }
        : {
            title: t("pwa.manualTitle"),
            description: t("pwa.manualDescription"),
          };

  async function installApp() {
    setInstalling(true);
    try {
      await install();
    } finally {
      setInstalling(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">{t("settings.eyebrow")}</p>
          <h1>{t("settings.title")}</h1>
          <p className="page-subtitle">{t("settings.subtitle")}</p>
        </div>
      </header>
      <div className="settings-stack">
        <section className="panel settings-panel">
          <div className="settings-copy">
            <span className="settings-icon">
              <Icon name="sparkles" />
            </span>
            <div>
              <h2>{t("settings.languageTitle")}</h2>
              <p>{t("settings.languageDescription")}</p>
            </div>
          </div>
          <div className="language-grid">
            {LANGUAGE_OPTIONS.map((option) => {
              const selected = option.locale === locale;
              return (
                <button
                  className={`language-option ${selected ? "selected" : ""}`}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setLocale(option.locale)}
                  key={option.locale}
                >
                  <span className="language-code">
                    {option.locale.toUpperCase()}
                  </span>
                  <span>
                    <strong>{t(option.labelKey)}</strong>
                    {selected && <small>{t("settings.selected")}</small>}
                  </span>
                  {selected && <Icon name="check" />}
                </button>
              );
            })}
          </div>
          <div className="settings-note">
            <Timmy className="settings-timmy" />
            <p>{t("settings.languageSaved")}</p>
          </div>
        </section>

        <section className="panel settings-panel pwa-settings-panel">
          <div className="settings-copy">
            <span className="settings-icon pwa-settings-icon">
              <Icon name="download" />
            </span>
            <div>
              <h2>{t("pwa.title")}</h2>
              <p>{t("pwa.description")}</p>
            </div>
          </div>
          <div className="pwa-install-card">
            <Image
              className="pwa-app-icon"
              src="/icons/icon-192.png"
              alt=""
              width={92}
              height={92}
            />
            <div className="pwa-install-copy">
              <h3>{ready ? pwaStatus.title : t("pwa.checking")}</h3>
              <p>
                {ready ? pwaStatus.description : t("pwa.checkingDescription")}
              </p>
            </div>
            {ready && canInstall && (
              <button
                className="primary"
                type="button"
                disabled={installing}
                onClick={installApp}
              >
                <Icon name="download" />
                {installing ? t("pwa.installing") : t("pwa.install")}
              </button>
            )}
            {ready && isInstalled && (
              <span className="pwa-installed-badge">
                <Icon name="check" />
                {t("pwa.installedBadge")}
              </span>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

"use client";

import { LANGUAGE_OPTIONS, useI18n } from "../i18n/i18n-provider";
import { Icon } from "./icon";
import { Timmy } from "./timmy";

export function Settings() {
  const { locale, setLocale, t } = useI18n();

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">{t("settings.eyebrow")}</p>
          <h1>{t("settings.title")}</h1>
          <p className="page-subtitle">{t("settings.subtitle")}</p>
        </div>
      </header>
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
    </>
  );
}

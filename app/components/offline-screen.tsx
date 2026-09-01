"use client";

import Image from "next/image";
import { useI18n } from "../i18n/i18n-provider";

export function OfflineScreen() {
  const { t } = useI18n();

  return (
    <main className="offline-page">
      <div className="offline-card">
        <Image
          className="offline-icon"
          src="/icons/icon-192.png"
          alt=""
          width={112}
          height={112}
          priority
        />
        <p className="eyebrow">{t("offline.eyebrow")}</p>
        <h1>{t("offline.title")}</h1>
        <p>{t("offline.description")}</p>
        <button
          className="primary"
          type="button"
          onClick={() => window.location.reload()}
        >
          {t("offline.retry")}
        </button>
      </div>
    </main>
  );
}

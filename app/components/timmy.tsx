"use client";

import Image from "next/image";
import { useI18n } from "../i18n/i18n-provider";

export function Timmy({
  className = "",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  const { t } = useI18n();

  return (
    <Image
      className={className}
      src="/timmy.png"
      alt={t("timmy.alt")}
      width={1236}
      height={1272}
      priority={priority}
    />
  );
}

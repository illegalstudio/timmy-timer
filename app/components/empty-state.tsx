import { Icon } from "./icon";
import { Timmy } from "./timmy";
import { useI18n } from "../i18n/i18n-provider";

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const { t } = useI18n();

  return (
    <section className="empty-state">
      <div className="empty-state-copy">
        <span className="empty-state-kicker">
          <Icon name="sparkles" />
          {t("timmy.here")}
        </span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="empty-state-visual" aria-hidden="true">
        <span className="empty-state-sun" />
        <span className="empty-state-ticks" />
        <Timmy className="empty-state-timmy" />
      </div>
    </section>
  );
}

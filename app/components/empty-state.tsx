import { Icon } from "./icon";
import { Timmy } from "./timmy";

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="empty-state">
      <div className="empty-state-copy">
        <span className="empty-state-kicker">
          <Icon name="sparkles" />
          Timmy è qui
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

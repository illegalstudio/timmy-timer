import { Children, type ReactNode } from "react";
import { EmptyState } from "./empty-state";
import { Icon } from "./icon";

type CollectionProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  button: string;
  emptyTitle: string;
  emptyDescription: string;
  onAdd: () => void;
  children: ReactNode;
};

export function Collection({
  eyebrow,
  title,
  subtitle,
  button,
  emptyTitle,
  emptyDescription,
  onAdd,
  children,
}: CollectionProps) {
  const hasChildren = Children.count(children) > 0;

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <button className="primary" onClick={onAdd}>
          <Icon name="plus" />
          {button}
        </button>
      </header>
      <div className="panel collection">
        {hasChildren ? (
          children
        ) : (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        )}
      </div>
    </>
  );
}

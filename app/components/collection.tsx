import type { ReactNode } from "react";

type CollectionProps = {
  title: string;
  subtitle: string;
  button: string;
  empty: string;
  onAdd: () => void;
  children: ReactNode;
};

export function Collection({
  title,
  subtitle,
  button,
  empty,
  onAdd,
  children,
}: CollectionProps) {
  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Anagrafica</p>
          <h1>{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <button className="primary" onClick={onAdd}>
          ＋ {button}
        </button>
      </header>
      <div className="panel collection">
        {children || (
          <div className="empty">
            <strong>{empty}</strong>
          </div>
        )}
      </div>
    </>
  );
}

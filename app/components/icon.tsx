import type { SVGProps } from "react";

export type IconName =
  | "calendar"
  | "clients"
  | "projects"
  | "reports"
  | "timer"
  | "plus"
  | "chevron-left"
  | "chevron-right"
  | "chevron-down"
  | "download"
  | "pencil"
  | "trash"
  | "clock"
  | "coins"
  | "receipt"
  | "sparkles"
  | "search"
  | "check"
  | "close";

export function Icon({
  name,
  ...props
}: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}

const paths: Record<IconName, React.ReactNode> = {
  calendar: (
    <>
      <path d="M6 3v3M18 3v3M3.5 9.5h17" />
      <rect x="3.5" y="5" width="17" height="16" rx="3" />
      <path d="M8 14h3v3H8z" />
    </>
  ),
  clients: (
    <>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 20c.35-4 2.16-6 5.5-6s5.15 2 5.5 6M15.5 5.5a3.1 3.1 0 0 1 0 5.9M16 14c2.72.3 4.22 2.3 4.5 5" />
    </>
  ),
  projects: (
    <>
      <path d="M3.5 7.5h6l2-2h9v13a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      <path d="M3.5 10h17" />
    </>
  ),
  reports: (
    <>
      <path d="M5 20V10M12 20V4M19 20v-7" />
      <path d="M3 20.5h18" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M9 2.5h6M12 5.5V3M17.6 7.4l1.4-1.4M12 9.5V13l2.5 1.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  download: (
    <>
      <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 20h16" />
    </>
  ),
  pencil: (
    <>
      <path d="m4 20 4.2-1 10.6-10.6a2 2 0 0 0-2.8-2.8L5.4 16.2z" />
      <path d="m14.8 6.8 2.4 2.4" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 7h15M9 3.5h6l1 3.5H8z" />
      <path d="m7 7 .7 13.5h8.6L17 7M10 10.5v6M14 10.5v6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="9" cy="7" rx="5.5" ry="2.5" />
      <path d="M3.5 7v4c0 1.38 2.46 2.5 5.5 2.5M3.5 11v4c0 1.38 2.46 2.5 5.5 2.5" />
      <ellipse cx="15" cy="14" rx="5.5" ry="2.5" />
      <path d="M9.5 14v4c0 1.38 2.46 2.5 5.5 2.5s5.5-1.12 5.5-2.5v-4" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 1.1 3.2L16 8l-2.9 1.8L12 13l-1.1-3.2L8 8l2.9-1.8zM18.5 14l.7 2 1.8 1.1-1.8 1.1-.7 2-.7-2-1.8-1.1 1.8-1.1zM5.5 13l.7 2L8 16.1l-1.8 1.1-.7 2-.7-2L3 16.1 4.8 15z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  check: <path d="m5 12 4.5 4.5L19 7" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
};

export type Client = {
  id: number;
  name: string;
  hourly_rate_cents: number | null;
};

export type Project = {
  id: number;
  client_id: number;
  name: string;
  color: string;
  hourly_rate_cents: number | null;
};

export type Entry = {
  id: number;
  client_id: number;
  project_id: number;
  started_at: string;
  ended_at: string;
  description: string;
  billable: number;
  invoiced: number;
  invoiced_at: string | null;
  hourly_rate_cents: number;
  rate_source: string;
  project_name: string;
  project_color: string;
  client_name: string;
};

export type AppData = {
  clients: Client[];
  projects: Project[];
  entries: Entry[];
};

export type View = "registro" | "clienti" | "progetti" | "report" | "settings";
export type ModalType = "entry" | "client" | "project";
export type SlotPreset = { start: Date; end: Date };
export type Mutate = (
  method: string,
  body?: object,
  url?: string,
) => Promise<boolean>;

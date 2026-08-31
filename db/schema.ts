import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  hourlyRateCents: integer("hourly_rate_cents"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});
export const projects = sqliteTable(
  "projects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id),
    name: text("name").notNull(),
    color: text("color").notNull().default("#F06B52"),
    hourlyRateCents: integer("hourly_rate_cents"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_projects_client_id").on(table.clientId)],
);
export const timeEntries = sqliteTable(
  "time_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id),
    startedAt: text("started_at").notNull(),
    endedAt: text("ended_at").notNull(),
    description: text("description"),
    billable: integer("billable", { mode: "boolean" }).notNull().default(true),
    invoiced: integer("invoiced", { mode: "boolean" }).notNull().default(false),
    invoicedAt: text("invoiced_at"),
    hourlyRateCents: integer("hourly_rate_cents").notNull(),
    rateSource: text("rate_source").notNull(),
    currency: text("currency").notNull().default("EUR"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_time_entries_started_at").on(table.startedAt),
    index("idx_time_entries_project_id").on(table.projectId),
  ],
);

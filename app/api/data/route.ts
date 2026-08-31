import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";
export const runtime = "edge";

async function ensureSchema() {
  const db = env.DB;
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, hourly_rate_cents INTEGER, archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL REFERENCES clients(id), name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#F06B52', hourly_rate_cents INTEGER, archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS time_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL REFERENCES projects(id), started_at TEXT NOT NULL, ended_at TEXT NOT NULL, description TEXT, billable INTEGER NOT NULL DEFAULT 1, invoiced INTEGER NOT NULL DEFAULT 0, invoiced_at TEXT, hourly_rate_cents INTEGER NOT NULL, rate_source TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'EUR', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_time_entries_started_at ON time_entries(started_at)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_time_entries_project_id ON time_entries(project_id)`,
    ),
  ]);
  const columns = await db
    .prepare("PRAGMA table_info(time_entries)")
    .all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "invoiced_at")) {
    await db
      .prepare("ALTER TABLE time_entries ADD COLUMN invoiced_at TEXT")
      .run();
  }
}
export async function GET() {
  await ensureSchema();
  const [clients, projects, entries] = await env.DB.batch([
    env.DB.prepare("SELECT * FROM clients WHERE archived = 0 ORDER BY name"),
    env.DB.prepare("SELECT * FROM projects WHERE archived = 0 ORDER BY name"),
    env.DB.prepare(
      `SELECT e.*, p.name project_name, p.color project_color, c.id client_id, c.name client_name FROM time_entries e JOIN projects p ON p.id=e.project_id JOIN clients c ON c.id=p.client_id ORDER BY e.started_at DESC`,
    ),
  ]);
  return NextResponse.json({
    clients: clients.results,
    projects: projects.results,
    entries: entries.results,
  });
}
export async function POST(request: NextRequest) {
  await ensureSchema();
  const body = (await request.json()) as Record<string, unknown>;
  const now = new Date().toISOString();
  if (body.type === "client") {
    const rate = Math.round(Number(body.hourlyRate || 0) * 100) || null;
    await env.DB.prepare(
      "INSERT INTO clients (name,hourly_rate_cents,created_at) VALUES (?,?,?)",
    )
      .bind(String(body.name).trim(), rate, now)
      .run();
  } else if (body.type === "project") {
    const rate = Number(body.hourlyRate)
      ? Math.round(Number(body.hourlyRate) * 100)
      : null;
    await env.DB.prepare(
      "INSERT INTO projects (client_id,name,color,hourly_rate_cents,created_at) VALUES (?,?,?,?,?)",
    )
      .bind(
        Number(body.clientId),
        String(body.name).trim(),
        String(body.color || "#F06B52"),
        rate,
        now,
      )
      .run();
  } else if (body.type === "entry") {
    const project = await env.DB.prepare(
      `SELECT p.hourly_rate_cents project_rate, c.hourly_rate_cents client_rate FROM projects p JOIN clients c ON c.id=p.client_id WHERE p.id=?`,
    )
      .bind(Number(body.projectId))
      .first<Record<string, number | null>>();
    if (!project)
      return NextResponse.json({ error: "project_not_found" }, { status: 404 });
    const manualRate = Number(body.hourlyRate);
    const cents =
      manualRate > 0
        ? Math.round(manualRate * 100)
        : project.project_rate || project.client_rate || 0;
    const source =
      manualRate > 0
        ? "manual"
        : project.project_rate
          ? "project"
          : project.client_rate
            ? "client"
            : "default";
    await env.DB.prepare(
      `INSERT INTO time_entries (project_id,started_at,ended_at,description,billable,invoiced,hourly_rate_cents,rate_source,currency,created_at,updated_at) VALUES (?,?,?,?,?,0,?,?,?,?,?)`,
    )
      .bind(
        Number(body.projectId),
        String(body.startedAt),
        String(body.endedAt),
        String(body.description || ""),
        body.billable === false ? 0 : 1,
        cents,
        source,
        "EUR",
        now,
        now,
      )
      .run();
  } else return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  return GET();
}
export async function PATCH(request: NextRequest) {
  await ensureSchema();
  const body = (await request.json()) as Record<string, unknown>;
  if (body.type === "entry") {
    const now = new Date().toISOString();
    await env.DB.prepare(
      "UPDATE time_entries SET invoiced=?, invoiced_at=?, updated_at=? WHERE id=? AND billable=1",
    )
      .bind(
        body.invoiced ? 1 : 0,
        body.invoiced ? now : null,
        now,
        Number(body.id),
      )
      .run();
  } else if (body.type === "entry-invoice") {
    const ids = Array.isArray(body.ids)
      ? Array.from(
          new Set(
            body.ids.map(Number).filter((id) => Number.isInteger(id) && id > 0),
          ),
        ).slice(0, 500)
      : [];
    if (!ids.length)
      return NextResponse.json({ error: "invalid_entries" }, { status: 400 });
    const invoiced = body.invoiced === true;
    const now = new Date().toISOString();
    await env.DB.batch(
      ids.map((id) =>
        env.DB.prepare(
          "UPDATE time_entries SET invoiced=?, invoiced_at=?, updated_at=? WHERE id=? AND billable=1",
        ).bind(invoiced ? 1 : 0, invoiced ? now : null, now, id),
      ),
    );
  } else if (body.type === "entry-time") {
    const startedAt = new Date(String(body.startedAt));
    const endedAt = new Date(String(body.endedAt));
    if (
      !Number.isFinite(startedAt.getTime()) ||
      !Number.isFinite(endedAt.getTime()) ||
      endedAt <= startedAt
    )
      return NextResponse.json(
        { error: "invalid_time_range" },
        { status: 400 },
      );
    await env.DB.prepare(
      "UPDATE time_entries SET started_at=?, ended_at=?, updated_at=? WHERE id=?",
    )
      .bind(
        startedAt.toISOString(),
        endedAt.toISOString(),
        new Date().toISOString(),
        Number(body.id),
      )
      .run();
  } else if (body.type === "entry-details") {
    const startedAt = new Date(String(body.startedAt));
    const endedAt = new Date(String(body.endedAt));
    const rate = Math.round(Number(body.hourlyRate) * 100);
    if (
      !Number.isFinite(startedAt.getTime()) ||
      !Number.isFinite(endedAt.getTime()) ||
      endedAt <= startedAt ||
      !Number.isFinite(rate)
    )
      return NextResponse.json({ error: "invalid_data" }, { status: 400 });
    const billable = body.billable ? 1 : 0;
    await env.DB.prepare(
      "UPDATE time_entries SET project_id=?, started_at=?, ended_at=?, description=?, billable=?, invoiced=CASE WHEN ?=1 THEN invoiced ELSE 0 END, invoiced_at=CASE WHEN ?=1 THEN invoiced_at ELSE NULL END, hourly_rate_cents=?, rate_source=?, updated_at=? WHERE id=?",
    )
      .bind(
        Number(body.projectId),
        startedAt.toISOString(),
        endedAt.toISOString(),
        String(body.description || ""),
        billable,
        billable,
        billable,
        rate,
        "manual",
        new Date().toISOString(),
        Number(body.id),
      )
      .run();
  } else if (body.type === "client-details") {
    const rate = Number(body.hourlyRate)
      ? Math.round(Number(body.hourlyRate) * 100)
      : null;
    await env.DB.prepare(
      "UPDATE clients SET name=?, hourly_rate_cents=? WHERE id=?",
    )
      .bind(String(body.name).trim(), rate, Number(body.id))
      .run();
  } else if (body.type === "project-details") {
    const rate = Number(body.hourlyRate)
      ? Math.round(Number(body.hourlyRate) * 100)
      : null;
    await env.DB.prepare(
      "UPDATE projects SET client_id=?, name=?, color=?, hourly_rate_cents=? WHERE id=?",
    )
      .bind(
        Number(body.clientId),
        String(body.name).trim(),
        String(body.color || "#F06B52"),
        rate,
        Number(body.id),
      )
      .run();
  } else if (body.type === "archive") {
    const table = body.entity === "client" ? "clients" : "projects";
    await env.DB.prepare(`UPDATE ${table} SET archived=1 WHERE id=?`)
      .bind(Number(body.id))
      .run();
  }
  return GET();
}
export async function DELETE(request: NextRequest) {
  await ensureSchema();
  const url = new URL(request.url);
  const entity = url.searchParams.get("entity");

  if (!entity) {
    const id = Number(url.searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0)
      return NextResponse.json({ error: "invalid_entry" }, { status: 400 });
    await env.DB.prepare("DELETE FROM time_entries WHERE id=?").bind(id).run();
    return GET();
  }

  if (entity !== "client" && entity !== "project")
    return NextResponse.json({ error: "invalid_entity" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const id = Number(body.id);
  const strategy = body.strategy;
  const targetId = Number(body.targetId);

  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ error: "invalid_item" }, { status: 400 });
  if (strategy !== "reassign" && strategy !== "delete")
    return NextResponse.json({ error: "invalid_strategy" }, { status: 400 });
  if (
    strategy === "reassign" &&
    (!Number.isInteger(targetId) || targetId <= 0 || targetId === id)
  )
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });

  if (entity === "project") {
    const project = await env.DB.prepare(
      "SELECT id FROM projects WHERE id=? AND archived=0",
    )
      .bind(id)
      .first();
    if (!project)
      return NextResponse.json({ error: "project_not_found" }, { status: 404 });

    if (strategy === "reassign") {
      const target = await env.DB.prepare(
        "SELECT id FROM projects WHERE id=? AND id<>? AND archived=0",
      )
        .bind(targetId, id)
        .first();
      if (!target)
        return NextResponse.json(
          { error: "invalid_destination_project" },
          { status: 400 },
        );
      await env.DB.batch([
        env.DB.prepare(
          "UPDATE time_entries SET project_id=?, updated_at=? WHERE project_id=?",
        ).bind(targetId, new Date().toISOString(), id),
        env.DB.prepare("DELETE FROM projects WHERE id=?").bind(id),
      ]);
    } else {
      await env.DB.batch([
        env.DB.prepare("DELETE FROM time_entries WHERE project_id=?").bind(id),
        env.DB.prepare("DELETE FROM projects WHERE id=?").bind(id),
      ]);
    }
    return GET();
  }

  const client = await env.DB.prepare(
    "SELECT id FROM clients WHERE id=? AND archived=0",
  )
    .bind(id)
    .first();
  if (!client)
    return NextResponse.json({ error: "client_not_found" }, { status: 404 });

  if (strategy === "reassign") {
    const target = await env.DB.prepare(
      "SELECT id FROM clients WHERE id=? AND id<>? AND archived=0",
    )
      .bind(targetId, id)
      .first();
    if (!target)
      return NextResponse.json(
        { error: "invalid_destination_client" },
        { status: 400 },
      );
    await env.DB.batch([
      env.DB.prepare("UPDATE projects SET client_id=? WHERE client_id=?").bind(
        targetId,
        id,
      ),
      env.DB.prepare("DELETE FROM clients WHERE id=?").bind(id),
    ]);
  } else {
    await env.DB.batch([
      env.DB.prepare(
        "DELETE FROM time_entries WHERE project_id IN (SELECT id FROM projects WHERE client_id=?)",
      ).bind(id),
      env.DB.prepare("DELETE FROM projects WHERE client_id=?").bind(id),
      env.DB.prepare("DELETE FROM clients WHERE id=?").bind(id),
    ]);
  }
  return GET();
}

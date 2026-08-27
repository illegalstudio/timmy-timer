import { env } from 'cloudflare:workers';
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';

async function ensureSchema() {
  const db = env.DB;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, hourly_rate_cents INTEGER, archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL REFERENCES clients(id), name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#5b5bd6', hourly_rate_cents INTEGER, archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS time_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL REFERENCES projects(id), started_at TEXT NOT NULL, ended_at TEXT NOT NULL, description TEXT, billable INTEGER NOT NULL DEFAULT 1, invoiced INTEGER NOT NULL DEFAULT 0, hourly_rate_cents INTEGER NOT NULL, rate_source TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'EUR', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id)`), db.prepare(`CREATE INDEX IF NOT EXISTS idx_time_entries_started_at ON time_entries(started_at)`), db.prepare(`CREATE INDEX IF NOT EXISTS idx_time_entries_project_id ON time_entries(project_id)`),
  ]);
}
export async function GET() {
  await ensureSchema();
  const [clients, projects, entries] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM clients WHERE archived = 0 ORDER BY name'), env.DB.prepare('SELECT * FROM projects WHERE archived = 0 ORDER BY name'), env.DB.prepare(`SELECT e.*, p.name project_name, p.color project_color, c.name client_name FROM time_entries e JOIN projects p ON p.id=e.project_id JOIN clients c ON c.id=p.client_id ORDER BY e.started_at DESC`),
  ]);
  return NextResponse.json({ clients: clients.results, projects: projects.results, entries: entries.results });
}
export async function POST(request: NextRequest) {
  await ensureSchema(); const body = await request.json() as Record<string, unknown>; const now = new Date().toISOString();
  if (body.type === 'client') { const rate = Math.round(Number(body.hourlyRate || 0) * 100) || null; await env.DB.prepare('INSERT INTO clients (name,hourly_rate_cents,created_at) VALUES (?,?,?)').bind(String(body.name).trim(), rate, now).run(); }
  else if (body.type === 'project') { const rate = Number(body.hourlyRate) ? Math.round(Number(body.hourlyRate) * 100) : null; await env.DB.prepare('INSERT INTO projects (client_id,name,color,hourly_rate_cents,created_at) VALUES (?,?,?,?,?)').bind(Number(body.clientId), String(body.name).trim(), String(body.color || '#5b5bd6'), rate, now).run(); }
  else if (body.type === 'entry') {
    const project = await env.DB.prepare(`SELECT p.hourly_rate_cents project_rate, c.hourly_rate_cents client_rate FROM projects p JOIN clients c ON c.id=p.client_id WHERE p.id=?`).bind(Number(body.projectId)).first<Record<string, number | null>>();
    if (!project) return NextResponse.json({ error: 'Progetto non trovato' }, { status: 404 });
    const manualRate = Number(body.hourlyRate); const cents = manualRate > 0 ? Math.round(manualRate * 100) : (project.project_rate || project.client_rate || 0); const source = manualRate > 0 ? 'manual' : project.project_rate ? 'project' : project.client_rate ? 'client' : 'default';
    await env.DB.prepare(`INSERT INTO time_entries (project_id,started_at,ended_at,description,billable,invoiced,hourly_rate_cents,rate_source,currency,created_at,updated_at) VALUES (?,?,?,?,?,0,?,?,?,?,?)`).bind(Number(body.projectId), String(body.startedAt), String(body.endedAt), String(body.description || ''), body.billable === false ? 0 : 1, cents, source, 'EUR', now, now).run();
  } else return NextResponse.json({ error: 'Tipo non valido' }, { status: 400 });
  return GET();
}
export async function PATCH(request: NextRequest) {
  await ensureSchema(); const body = await request.json() as Record<string, unknown>;
  if (body.type === 'entry') await env.DB.prepare('UPDATE time_entries SET invoiced=?, updated_at=? WHERE id=?').bind(body.invoiced ? 1 : 0, new Date().toISOString(), Number(body.id)).run();
  else if (body.type === 'archive') { const table = body.entity === 'client' ? 'clients' : 'projects'; await env.DB.prepare(`UPDATE ${table} SET archived=1 WHERE id=?`).bind(Number(body.id)).run(); }
  return GET();
}
export async function DELETE(request: NextRequest) { await ensureSchema(); const id = Number(new URL(request.url).searchParams.get('id')); await env.DB.prepare('DELETE FROM time_entries WHERE id=?').bind(id).run(); return GET(); }

import { writeFile } from "node:fs/promises";

const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID?.trim();

if (!databaseId) {
  console.error(
    "CLOUDFLARE_D1_DATABASE_ID is required to create wrangler.jsonc.",
  );
  process.exit(1);
}

const workerName = process.env.CLOUDFLARE_WORKER_NAME?.trim() || "timmy-timer";
const databaseName =
  process.env.CLOUDFLARE_D1_DATABASE_NAME?.trim() || "timmy-timer";

const config = {
  $schema: "./node_modules/wrangler/config-schema.json",
  name: workerName,
  main: "vinext/server/app-router-entry",
  compatibility_date: "2026-09-01",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: [
    {
      binding: "DB",
      database_name: databaseName,
      database_id: databaseId,
      migrations_dir: "drizzle",
    },
  ],
  observability: { enabled: true },
};

const target = new URL("../wrangler.jsonc", import.meta.url);
await writeFile(target, `${JSON.stringify(config, null, 2)}\n`, "utf8");
console.log(`Created wrangler.jsonc for Worker ${workerName}.`);

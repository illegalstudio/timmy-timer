<p align="center">
  <img src="public/og-timmy-timer-en.png" alt="Timmy Timer — The right time, in the right place" width="100%">
</p>

<p align="center">
  <a href="https://github.com/illegalstudio/timmy-timer/stargazers"><img src="https://img.shields.io/github/stars/illegalstudio/timmy-timer?style=flat-square&logo=github&logoColor=white&label=stars&color=F06B52" alt="GitHub stars"></a>
  <a href="https://github.com/illegalstudio/timmy-timer/commits/main"><img src="https://img.shields.io/github/last-commit/illegalstudio/timmy-timer?style=flat-square&logo=git&logoColor=white&label=last%20commit&color=F06B52" alt="Last commit"></a>
  <img src="https://img.shields.io/badge/Node-%E2%89%A522.13-F06B52?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js 22.13 or newer">
  <img src="https://img.shields.io/badge/React-19-F06B52?style=flat-square&logo=react&logoColor=white" alt="React 19">
</p>

<p align="center"><strong>Weekly calendar &middot; Clients and projects &middot; CSV/PDF reports &middot; Four languages &middot; Cloudflare D1</strong></p>

<p align="center">
  A personal time tracker that turns hours, clients, and projects into a calm, readable routine.<br>
  Timmy stays with you from first-time setup to the final report.
</p>

---

## Happy time tracking

Timmy Timer brings everything needed for day-to-day time tracking into one interface: a visual week, recognizable clients and projects, frozen historical rates, and reports ready to export.

The app is designed to keep repetitive workflows fast. Create time entries by dragging on the calendar, move and resize them directly in the week view, and use the context menu to edit or delete them. Timmy provides context, feedback, and a little personality along the way.

## What Timmy can do

| Feature                        | What it means                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| **Visual weekly calendar**     | Create entries by dragging, move them between times, and resize their duration directly in the calendar.                       |
| **Clients and projects**       | Organize work with colors, recognizable avatars, and dedicated hourly rates.                                                   |
| **Fast search**                | Find clients and projects in searchable, keyboard-friendly selects that stay inside the viewport.                              |
| **Safe editing and deletion**  | Edit or delete calendar entries from the context menu, and reassign or remove orphaned work when deleting a client or project. |
| **Reports and billing**        | Filter by period, client, project, or billing status; update activities in bulk; then export to CSV or PDF.                    |
| **Reliable historical rates**  | Every time entry keeps the rate that was applied when it was created, so later rate changes do not rewrite history.            |
| **Multilingual interface**     | Use the complete app in English, Italian, French, or German, with localized dates, amounts, exports, and accessibility text.   |
| **Responsive and installable** | Work comfortably on smaller screens and install Timmy Timer as a PWA through its web app manifest and service worker.          |

## Languages

English is the default. Open **Settings** to switch to:

- English
- Italian
- French
- German

The preference is applied immediately and saved on the current device. Interface copy, dates, currency formatting, CSV headers, PDF content, empty states, dialogs, and accessibility labels all follow the selected language.

Translations are type-safe and live in [`app/i18n/messages`](app/i18n/messages). See [`AGENTS.md`](AGENTS.md) for the required workflow when adding or changing user-facing copy.

## Run locally

You need [Node.js](https://nodejs.org/) **22.13 or newer** and npm.

```bash
git clone git@github.com:illegalstudio/timmy-timer.git
cd timmy-timer
npm install
npm run dev
```

The app is available at [http://localhost:3000](http://localhost:3000). Development uses a local Cloudflare D1 instance. The application initializes its schema automatically, and local data is stored under `.wrangler/`, which is excluded from Git.

## Deploy to Cloudflare Workers

Timmy Timer runs as a Cloudflare Worker with static assets and a D1 database. Deployment is intentionally account-neutral: the repository contains no Cloudflare account ID, D1 database ID, API token, generated production configuration, or deployment URL.

The tracked [`wrangler.example.jsonc`](wrangler.example.jsonc) documents the configuration shape. Before a build, `scripts/create-cloudflare-config.mjs` creates an ignored `wrangler.jsonc` from environment variables. Vinext then writes the deployable Worker configuration to `dist/server/wrangler.json`.

### Deployment variables

| Variable                      | Required                                 | Default       | Purpose                                                   |
| ----------------------------- | ---------------------------------------- | ------------- | --------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID`       | Manual CLI only when selection is needed | —             | Selects the Cloudflare account used by Wrangler           |
| `CLOUDFLARE_D1_DATABASE_ID`   | Yes                                      | —             | Connects the Worker to its production D1 database         |
| `CLOUDFLARE_D1_DATABASE_NAME` | No                                       | `timmy-timer` | Human-readable D1 database name                           |
| `CLOUDFLARE_WORKER_NAME`      | No                                       | `timmy-timer` | Worker name; it must match the Workers Builds application |
| `NEXT_PUBLIC_APP_URL`         | Recommended in production                | Localhost     | Canonical public origin used by metadata and social cards |

Set these values in the current shell for a manual deployment, or in the Cloudflare Workers Builds settings for continuous deployment. Never add them to a tracked `.env` file or replace the placeholders in `wrangler.example.jsonc`.

### First deployment from the CLI

1. Install dependencies and authenticate Wrangler:

   ```bash
   npm ci
   npx wrangler login
   ```

   OAuth credentials are stored by Wrangler outside the repository. For a non-interactive CI system, use a scoped Cloudflare API token supplied by that system instead.

2. Create the production D1 database. Choose the location closest to the expected users, or omit `--location` and let Cloudflare decide:

   ```bash
   npx wrangler d1 create <database-name> --location <location> --binding DB
   ```

   Keep the returned database ID. See the [D1 CLI reference](https://developers.cloudflare.com/d1/wrangler-commands/#d1-create) for supported locations and jurisdiction options.

3. Export the deployment values without writing them to the repository:

   ```bash
   export CLOUDFLARE_ACCOUNT_ID="<account-id>"
   export CLOUDFLARE_D1_DATABASE_ID="<database-id>"
   export CLOUDFLARE_D1_DATABASE_NAME="<database-name>"
   export CLOUDFLARE_WORKER_NAME="<worker-name>"
   export NEXT_PUBLIC_APP_URL="https://<public-app-origin>"
   ```

   `CLOUDFLARE_ACCOUNT_ID` can be omitted when Wrangler has access to only one account. If the final Worker URL is not known yet, perform the first deployment without `NEXT_PUBLIC_APP_URL`, set it to the URL returned by Wrangler, and deploy once more so the generated metadata uses the canonical origin.

4. Build, migrate, and deploy:

   ```bash
   npm run cloudflare:deploy
   ```

   This command performs the complete release flow:

   1. generates the ignored `wrangler.jsonc`;
   2. builds the Vinext application;
   3. applies pending migrations from `drizzle/` to the remote D1 database;
   4. publishes the compiled Worker using `dist/server/wrangler.json`.

   The command is safe to run again. Applied D1 migrations are recorded by Cloudflare and are not repeated.

5. Verify the deployed application:

   ```bash
   curl --fail --silent --show-error --output /dev/null \
     "https://<public-app-origin>/calendar"
   curl --fail --silent --show-error \
     "https://<public-app-origin>/api/data"
   ```

   The calendar request should succeed and the API should return JSON containing `clients`, `projects`, and `entries`.

### Automatic deployment with Workers Builds

The first CLI deployment creates the Worker before continuous deployment is enabled. To deploy every push to the production branch:

1. Open **Workers & Pages**, select the existing Worker, then open **Settings → Builds**.
2. Connect the GitHub or GitLab repository. Grant the Cloudflare integration access only to the repositories it needs.
3. Configure the production build:

   | Setting                      | Value                        |
   | ---------------------------- | ---------------------------- |
   | Production branch            | `main`                       |
   | Build command                | `npm run cloudflare:build`   |
   | Deploy command               | `npm run cloudflare:publish` |
   | Root directory               | `/`                          |
   | Non-production branch builds | Disabled                     |

4. Add the following under **Build variables and secrets**:

   - `CLOUDFLARE_D1_DATABASE_ID` is required.
   - `NEXT_PUBLIC_APP_URL` is recommended so metadata uses the canonical production origin.

   The other deployment variables are optional overrides and are unnecessary when the default Worker and database names are used. Do not add `CLOUDFLARE_ACCOUNT_ID` to native Workers Builds unless troubleshooting shows that the selected build token cannot resolve its account. Use Cloudflare's generated build token or a deliberately scoped token; do not add an API token to the repository.

5. Save the build settings. A new push to `main` will build the app, apply pending D1 migrations, and publish the resulting Worker.

The Worker name configured in Cloudflare must match `CLOUDFLARE_WORKER_NAME`. Cloudflare rejects a connected build when those names differ. See [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) for the current dashboard options.

### Preview branches and database safety

Non-production branch builds are disabled by default because a preview using the production D1 binding could modify production data. Enable previews only after creating a separate preview database and an environment-specific binding strategy.

Database migrations run before every production publish. Schema changes must therefore include the generated SQL migration in `drizzle/`. Rolling back a Worker version does not reverse a D1 migration; write forward-compatible migrations and handle database rollbacks separately.

### Protecting the deployed app

> [!IMPORTANT]
> Timmy Timer currently has a single shared data space. Keep a deployed Worker private or protect it with Cloudflare Access until application-level authentication and per-user data ownership are implemented. Making the GitHub repository public does not require making the deployed app public.

Cloudflare Access can protect the Worker itself across its `workers.dev` URL, custom domains, and preview deployments. Configure an Allow policy before storing real client or time-entry data. See [Cloudflare Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/).

## Application routes

| Route       | Purpose                                       |
| ----------- | --------------------------------------------- |
| `/calendar` | Weekly calendar and time-entry management     |
| `/clients`  | Client details, rates, and deletion workflow  |
| `/projects` | Project details, colors, and rates            |
| `/reports`  | Filters, totals, CSV exports, and PDF exports |
| `/settings` | App language and user preferences             |

The root route redirects to `/calendar`. Each page has its own stable URL and can be opened or refreshed directly.

## Data flow

```text
Client
└── Project
    └── Calendar entry
        ├── duration and description
        ├── applied hourly rate
        ├── billable / invoiced state
        └── invoiced date
```

Clients, projects, and entries are stored in **Cloudflare D1** through **Drizzle ORM**. Deleting connected records is explicit: the interface asks whether orphaned work should be reassigned or deleted together with its parent.

## Stack

| Area              | Technology                                   |
| ----------------- | -------------------------------------------- |
| Interface         | React 19, Next App Router, TypeScript 5.9    |
| Build and runtime | Vinext, Vite 8, Cloudflare Workers           |
| Persistence       | Cloudflare D1 (SQLite), Drizzle ORM          |
| Styling           | CSS custom properties, Tailwind CSS pipeline |
| Report export     | Browser-generated CSV, PDF export with jsPDF |
| Localization      | Type-safe in-app catalogs and the Intl API   |
| Installation      | Web app manifest and service worker          |

## Available commands

| Command                      | Purpose                                     |
| ---------------------------- | ------------------------------------------- |
| `npm run dev`                | Start the development environment           |
| `npm run build`              | Create a production build                   |
| `npm run start`              | Run the production build                    |
| `npm run lint`               | Check the code with ESLint                  |
| `npm run format`             | Format the project with Prettier            |
| `npm run format:check`       | Verify formatting without changing files    |
| `npm run db:generate`        | Generate Drizzle migrations from the schema |
| `npm run cloudflare:config`  | Generate the ignored Wrangler configuration |
| `npm run cloudflare:build`   | Prepare configuration and build for Workers |
| `npm run cloudflare:publish` | Apply D1 migrations and publish a built app |
| `npm run cloudflare:deploy`  | Build, migrate, and deploy through Wrangler |

## Project structure

<details>
<summary>Show the main directories</summary>

```text
timmy-timer/
├── app/
│   ├── api/data/          # API for clients, projects, and entries
│   ├── components/        # Calendar, reports, dialogs, selects, and Timmy
│   ├── i18n/              # Provider, locale configuration, and messages
│   ├── lib/               # Shared types and time utilities
│   ├── globals.css        # Design system and global styles
│   └── page.tsx           # Root redirect
├── db/
│   ├── schema.ts          # Drizzle data model
│   └── index.ts           # Cloudflare D1 connection
├── drizzle/               # SQL migrations
├── public/
│   ├── timmy.png          # Mascot artwork
│   ├── favicon.svg        # Brand mark
│   └── og-timmy-timer-en.png # English social preview
├── scripts/
│   └── create-cloudflare-config.mjs # Generates account-specific config
├── wrangler.example.jsonc # Public, account-neutral Worker template
└── vite.config.ts         # Vinext and Cloudflare Workers runtime
```

</details>

---

<p align="center">
  <img src="public/timmy.png" alt="Timmy, the Timmy Timer mascot" width="170"><br>
  <strong>Make room for what matters. Timmy will take care of the time.</strong>
</p>

<p align="center">
  <img src="public/favicon.svg" alt="Timmy Timer mark" width="112">
</p>

<h1 align="center">Timmy Timer</h1>

<p align="center"><em>The right time, in the right place.</em></p>

<p align="center">
  <a href="https://github.com/nahime0/timmy-timer/stargazers"><img src="https://img.shields.io/github/stars/nahime0/timmy-timer?style=flat-square&logo=github&logoColor=white&label=stars&color=F06B52" alt="GitHub stars"></a>
  <a href="https://github.com/nahime0/timmy-timer/commits/main"><img src="https://img.shields.io/github/last-commit/nahime0/timmy-timer?style=flat-square&logo=git&logoColor=white&label=last%20commit&color=F06B52" alt="Last commit"></a>
  <img src="https://img.shields.io/badge/Node-%E2%89%A522.13-F06B52?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js 22.13 or newer">
  <img src="https://img.shields.io/badge/React-19-F06B52?style=flat-square&logo=react&logoColor=white" alt="React 19">
</p>

<p align="center"><strong>Weekly calendar &middot; Clients and projects &middot; CSV/PDF reports &middot; Four languages &middot; Cloudflare D1</strong></p>

<p align="center">
  A personal time tracker that turns hours, clients, and projects into a calm, readable routine.<br>
  Timmy stays with you from first-time setup to the final report.
</p>

---

<p align="center">
  <img src="public/og-timmy-timer-en.png" alt="Timmy Timer — The right time, in the right place" width="860">
</p>

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
git clone git@github.com:nahime0/timmy-timer.git
cd timmy-timer
npm install
npm run dev
```

The app is available at [http://localhost:3000](http://localhost:3000). Development uses a local Cloudflare D1 instance. The application initializes its schema automatically, and local data is stored under `.wrangler/`, which is excluded from Git.

## Deploy to Cloudflare Workers

Timmy Timer builds as a Cloudflare Worker with static assets and a D1 database. The repository intentionally contains no Cloudflare account ID, database ID, API token, or generated production configuration.

The tracked [`wrangler.example.jsonc`](wrangler.example.jsonc) documents the required Worker configuration. During deployment, `scripts/create-cloudflare-config.mjs` generates the ignored `wrangler.jsonc` from these environment variables:

| Variable                      | Required | Default       | Purpose                                  |
| ----------------------------- | -------- | ------------- | ---------------------------------------- |
| `CLOUDFLARE_D1_DATABASE_ID`   | Yes      | —             | ID of the production D1 database         |
| `CLOUDFLARE_D1_DATABASE_NAME` | No       | `timmy-timer` | Human-readable D1 database name          |
| `CLOUDFLARE_WORKER_NAME`      | No       | `timmy-timer` | Worker name, matching the Cloudflare app |
| `NEXT_PUBLIC_APP_URL`         | No       | Localhost     | Public origin used for social metadata   |

For Cloudflare Workers Builds, store these values in the build settings instead of committing them. Use:

- Production branch: `main`
- Build command: `npm run cloudflare:build`
- Deploy command: `npm run cloudflare:deploy`
- Root directory: `/`
- Non-production branch builds: disabled until a separate preview data strategy is configured

The deploy command applies pending migrations from `drizzle/` before publishing the Worker. See the official [Workers Builds documentation](https://developers.cloudflare.com/workers/ci-cd/builds/) for repository integration.

> [!IMPORTANT]
> Timmy Timer currently has a single shared data space. Keep a deployed Worker private or protect it with Cloudflare Access until application-level authentication and per-user data ownership are implemented. Making the GitHub repository public does not require making the deployed app public.

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

| Command                     | Purpose                                      |
| --------------------------- | -------------------------------------------- |
| `npm run dev`               | Start the development environment            |
| `npm run build`             | Create a production build                    |
| `npm run start`             | Run the production build                     |
| `npm run lint`              | Check the code with ESLint                   |
| `npm run format`            | Format the project with Prettier             |
| `npm run format:check`      | Verify formatting without changing files     |
| `npm run db:generate`       | Generate Drizzle migrations from the schema  |
| `npm run cloudflare:config` | Generate the ignored Wrangler configuration  |
| `npm run cloudflare:build`  | Prepare configuration and build for Workers  |
| `npm run cloudflare:deploy` | Apply D1 migrations and deploy to production |

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

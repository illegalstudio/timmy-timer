# Timmy Timer repository guide

## Project overview

Timmy Timer is a multilingual personal time-tracking application built with React 19, the Next App Router through Vinext, TypeScript, Vite, and Cloudflare Workers. Data is stored in Cloudflare D1 through Drizzle ORM.

The main application routes are:

- `/calendar` for the weekly calendar and time entries;
- `/clients` for client management;
- `/projects` for project management;
- `/reports` for filters and CSV/PDF exports;
- `/settings` for language and future user preferences.

The root route redirects to `/calendar`. Application data is served by `app/api/data/route.ts`. The database schema lives in `db/schema.ts`, and migrations live in `drizzle/`.

## Localization is mandatory

Every user-facing string must be translated. This includes headings, buttons, labels, placeholders, empty states, onboarding copy, toasts, validation messages, confirmation dialogs, accessibility labels, exported CSV headers, PDF copy, dates, currencies, and manifest or metadata copy.

Do not hard-code user-facing text in components. Translation files live in:

```text
app/i18n/messages/en.ts
app/i18n/messages/it.ts
app/i18n/messages/fr.ts
app/i18n/messages/de.ts
```

English is the default language and `en.ts` is the source of truth for translation keys. The other catalogs must implement the same keys through the `Messages` type in `app/i18n/types.ts`; missing or extra keys are errors.

To add or change copy:

1. Add the English key and text to `app/i18n/messages/en.ts`.
2. Add the same key to `it.ts`, `fr.ts`, and `de.ts` with a real translation.
3. Read the string in a client component with `const { t } = useI18n()` from `app/i18n/i18n-provider.tsx`.
4. Render it with `t("group.key")`. Use placeholders such as `{name}` and pass values with `t("group.key", { name })`; do not concatenate translated sentences.
5. For plural copy, use explicit singular and plural keys and select the correct key in the component.

Locale-sensitive output must use the selected `localeTag` from `useI18n()`. Pass it to `Intl`, `toLocaleDateString`, `toLocaleTimeString`, `localeCompare`, and `formatMoney`. Internal machine-readable dates may continue to use the stable `sv-SE` format.

Language configuration, locale tags, persistence, and the list shown in Settings live in `app/i18n/i18n-provider.tsx`. The selected language is stored under `timmy-timer-language` in `localStorage`; English is used when no preference exists. When adding a language, update the `Locale` type, message registry, locale tag map, language options, and every translation catalog.

Page metadata, the web app manifest, and static social assets use English because it is the default language. Text embedded in images must also be English unless localized image variants are deliberately implemented.

Before finishing localization work, search for hard-coded user-facing strings outside `app/i18n/messages/`, then run:

```bash
npm run lint
npm run build
```

## UI and implementation conventions

- Keep route names in English.
- Reuse the existing design system in `app/globals.css` and `app/calendar.css`.
- Reuse `SmartSelect` for searchable selects and the shared modal, collection, empty-state, icon, and Timmy components where appropriate.
- Keep Timmy present as a supporting mascot without allowing the artwork to overlap interactive copy.
- Preserve keyboard navigation, accessible labels, responsive behavior, and viewport-safe popovers.
- Store only device-local preferences in browser storage. Durable application records belong in D1.
- Time entries preserve the hourly rate applied when they were created so historical reports remain stable.

## Git instructions

- Use the Git author and committer identity already configured by the repository owner.
- Never set the author or committer identity to Codex, OpenAI, or an automated assistant.
- Never add Codex/OpenAI attribution, `Co-authored-by`, `Generated-by`, or similar assistant-attribution text to commits, pull requests, or release notes.

## Cloudflare deployment

The repository is public-safe and must remain independent from any individual Cloudflare account.

- Never commit `wrangler.jsonc`, `.dev.vars`, `.env*`, API tokens, account IDs, or real D1 database IDs.
- Keep `wrangler.example.jsonc` account-neutral and use placeholders for values supplied by Cloudflare.
- Generate the ignored production configuration with `npm run cloudflare:config`. The generator reads `CLOUDFLARE_D1_DATABASE_ID`, with optional `CLOUDFLARE_D1_DATABASE_NAME` and `CLOUDFLARE_WORKER_NAME` overrides.
- Use `npm run cloudflare:build` as the Workers Builds build command.
- Use `npm run cloudflare:deploy` as the production deploy command so pending migrations in `drizzle/` are applied before publishing.
- Keep the D1 binding name `DB`; application code relies on `env.DB`.
- Do not make the deployed application public without Cloudflare Access or application-level authentication and per-user data isolation.

# Nexa

One installable app for **Finance & Wealth · Vehicle & Logistics · Projects & Inventory · Nutrition & Hydration · Fitness & Sports**.
Next.js 16 (App Router) + Supabase + TypeScript + Tailwind, shipped as a PWA.

The finance core is ported from `finance-mobile` (cashbooks, liabilities, subscriptions, goals, monthly targets, portfolio), with transactions normalised from a JSONB array into real rows.

## Setup

```bash
npm install
cp .env.example .env.local        # fill in your Supabase URL + publishable key
```

Apply the schema to **a new, dedicated Supabase project** (`supabase/migrations/*.sql`, in order):

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

or paste the files into the SQL editor in order. Then:

```bash
npm run dev          # http://localhost:3000
npm test             # typecheck + schema tests + validator checks + page loaders against the SQL functions
```

## Deploy

Hosted on Vercel: every push to `main` builds and deploys to production.

## Install on your phone (PWA)

A PWA needs **HTTPS** (only `localhost` is exempt, and that's your laptop, not your phone). Deploy it, then:

- **Android / Chrome:** open the site, tap the in-app **Install** banner (or menu → *Install app*).
- **iPhone / Safari:** Share → **Add to Home Screen**. (iOS has no install API; the app shows these steps.)

The service worker only runs in production builds: use `npm run build && npm start` to test it locally.
When a new build is deployed the app shows a **Reload** prompt; bump `VERSION` in `public/sw.js` whenever that file changes.
Set `NEXT_PUBLIC_SITE_URL` to your deployed URL so metadata/OG links are correct.

> The app is **online-only by design**: the service worker caches build assets, icons and an offline page, never pages or API responses, so no financial data is stored in the browser cache. Offline logging would need a write queue (see roadmap).

## Architecture

```
supabase/
  migrations/          16 ordered SQL files (schema, RLS, views, triggers, grants, exercise goals, indexes, page RPCs, daily job, paid marks, odometer list, drink calories and macros)
  tests/schema.test.mjs  in-memory Postgres test: RLS, FKs, views, generated columns
app/
  (app)/               signed-in shell (sidebar + bottom tabs) and one page per module:
                       dashboard, finance, vehicles, projects, nutrition, fitness
  auth/                Supabase auth pages (from the template)
  manifest.ts          PWA manifest
  icon.png, apple-icon.png   browser tab and iOS home-screen icons (cut from logo.png)
  offline/             page the service worker shows with no network
lib/
  supabase/            browser / server / proxy clients (publishable key only)
  validators/          Zod schemas = single source of truth for input + row types
  services/            data access. No Next.js, no UI. Takes a Supabase client.
    crud.ts            generic list/get/create/update/remove (+ selectView)
    errors.ts          ServiceError + Postgres→safe error mapping
    finance/ projects/ vehicles/ nutrition/ fitness/   per-module logic
  actions/             "use server" boundary: auth → validate → service → revalidate
    run.ts             shared wrapper, returns { data } | { error: { code, message } }
components/app/        shell, navigation, page building blocks (ui.tsx), charts, tabs,
                       entry-dialog (add forms) and delete-button
lib/app/forms.ts       field definitions for every add form
components/pwa/        install prompt + service-worker registration
public/sw.js           service worker
public/icons, public/brand   PWA icons and logo images (cut from logo.png)
proxy.ts               session refresh + auth guard (PWA paths exempt)
```

**One round trip per page:** each page reads through one Postgres function (`dashboard_bundle`, `finance_bundle`, `vehicles_bundle`, `projects_bundle`, `nutrition_bundle`, `fitness_bundle`) that returns everything it shows, and the session comes from `app_session`. Ledger filters and search run inside `transactions_page`. All are `security invoker`, so RLS still applies.

**Recurring charges post themselves:** `pg_cron` runs `post_due_recurring()` daily at 00:05 Malaysia time. Subscription charges are recorded on their bill date and debt instalments on their due day (skipped if a payment was already recorded that month). Check runs with `select * from cron.job_run_details order by start_time desc`. A subscription or debt can also be marked as paid by hand (**Mark paid**); the job then leaves that month alone.

**Lists:** every list and table shows ten rows at a time (`components/app/paged.tsx`). On a phone a table row becomes a card and a list row wraps to two lines, so nothing scrolls sideways.

**Request flow:** UI → server action (`lib/actions`) → `run()` verifies the user with `auth.getUser()` and builds a session-bound client → Zod `parse()` → service (`lib/services`) → Supabase. Reads in Server Components call services directly; mutations go through actions.

**Security model**
- RLS on every table (`"Users see own data"`); the service-role key is never used by the app.
- `user_id` defaults to `auth.uid()` and is stripped from all inputs, so it can't be set by a caller.
- Child tables use composite FKs `(user_id, parent_id)`, so a row can't reference another user's parent even if a policy were wrong.
- Views use `security_invoker`, so they obey RLS.
- Errors are mapped to `{ code, message }`; SQL details are logged server-side only.

## Data model highlights

| Area | Tables | Derived (views) |
|---|---|---|
| Finance | `finance_accounts`, `categories`, `books`, `transactions`, `liabilities`, `liability_payments`, `subscriptions`, `assets`, `asset_valuations`, `goals`, `monthly_goals` | `liability_balances`, `net_worth`, `monthly_cashflow`, `asset_latest_values` |
| Projects | `projects` (with `expense_tag`), `inventory_items`, `project_components` (BOM) | `project_cost_summary` |
| Vehicle | `vehicles`, `odometer_logs`, `fuel_logs`, `maintenance_logs`, `parking_logs` | `vehicle_fuel_segments` (km/L, cost/km), `vehicle_running_costs` |
| Nutrition | `foods`, `food_logs`, `nutrition_goals`, `hydration_logs` | `daily_nutrition`, `daily_hydration` (local-day) |
| Fitness | `workouts`, `workout_sets`, `court_bookings`, `racket_matches`, `racket_match_games`, `shooting_sessions`, `shooting_series`, `exercise_goals`, `exercise_logs` | `racket_match_results`, `daily_exercise` |

Defaults assume **MYR** and **Asia/Kuala_Lumpur** (per-user in `profiles`). Money is `numeric(14,2)`; all times are `timestamptz`.

## Roadmap

- Editing workout sets, range series and game scores after a record is created
- Generate DB types (`supabase gen types`) to replace the Zod-derived row types
- Offline write queue (IndexedDB + background sync) if offline logging is needed

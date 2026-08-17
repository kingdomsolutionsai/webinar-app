# Conversion Notes — Manus → Render (what was changed tonight)

Status: backend conversion complete; Postgres schema **verified** (migrations generate valid DDL).
Full end-to-end build is confirmed on the first Render deploy (see RENDER_DEPLOY_RUNBOOK.md).

## Database: MySQL → Postgres
- `drizzle/schema.ts` — `mysqlTable`→`pgTable`, `int autoincrement`→`serial`, `mysqlEnum`→`pgEnum`,
  `onUpdateNow()`→`$onUpdate(() => new Date())`. Column names preserved exactly.
- `server/db.ts` — driver `drizzle-orm/mysql2`→`drizzle-orm/postgres-js` (+`postgres` client, SSL required);
  all three `onDuplicateKeyUpdate`→`onConflictDoUpdate` with correct conflict targets.
- `drizzle.config.ts` — dialect `mysql`→`postgresql`.
- `drizzle/0000_*.sql` — fresh Postgres migration (generated + verified). Old MySQL migrations removed.

## Auth: Manus OAuth → single-admin login
- `server/_core/sdk.ts` — stripped the Manus OAuth HTTP client and cron-JWT path; kept JWT session
  sign/verify (never depended on Manus); `authenticateRequest` now just verifies the cookie + loads the user.
- `server/_core/auth.ts` (new) — `verifyAdminLogin` (bcrypt) + ensures the admin row exists.
- `server/_core/authRoutes.ts` (new) — `GET /login` (branded page), `POST /api/login`, `GET /logout`.
- `client/src/const.ts` — `startLogin()` now redirects to `/login` instead of the Manus OAuth portal.
- Deleted: `server/_core/oauth.ts`.

## Scheduler: Manus heartbeat → Render Cron Job
- `server/routes.ts` — `/api/scheduled/sequence` now authorizes via `x-cron-secret` header (was Manus cron identity).
- `render.yaml` — hourly cron service that curls the endpoint with the shared secret.
- Deleted: `server/_core/heartbeat.ts`.

## Storage: Manus S3 → local static
- `shared/event.ts` — asset URLs `/manus-storage/…`→`/downloads/…`.
- `server/_core/index.ts` — serves `public/downloads/` via `express.static`; removed Manus storage proxy + OAuth wiring.
- `public/downloads/` — real files included: sample chapter, checklist, lion mark, book cover.
- Deleted: `server/_core/storageProxy.ts`, `server/storage.ts`, `server/_core/imageGeneration.ts`, `server/_core/voiceTranscription.ts`.

## Build/config
- `vite.config.ts` — removed the three Manus-only plugins (jsx-loc, manus-runtime, debug collector).
- `package.json` — removed `mysql2` + `@aws-sdk/*`; added `postgres`, `bcryptjs`, `@types/bcryptjs`;
  dropped pnpm `packageManager`/patched-deps (deploy with npm). Removed `pnpm-lock.yaml` + wouter patch.
- `server/_core/env.ts` — new self-contained vars; legacy Manus fields kept as empty defaults so residual
  `_core` utilities still compile (safe to prune later).

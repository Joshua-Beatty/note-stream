# AGENTS.md

Conventions for working in this repo. See README.md for what the app does.

## Layout

npm workspaces monorepo, TypeScript strict mode everywhere (`tsconfig.base.json`):

- `shared/` — types + tag regex used by both sides. Compiled to `dist/`; run
  `npm run build --workspace=shared` after changing it.
- `server/` — Hono + tRPC API. Kysely + better-sqlite3, neverthrow, zod.
- `client/` — Vite + React 19, TanStack Query + tRPC client, Tailwind v4.

## Commands

```bash
npm run dev          # server :3000 + client :5173 (proxied) via concurrently
npm run build        # shared -> server -> client (order matters)
npm test             # server vitest suite
npm run typecheck    # all workspaces
```

## Server conventions

- **neverthrow everywhere.** App code never throws; all fallible operations
  return `Result`/`ResultAsync` with the tagged `AppError` union from
  `server/src/lib/errors.ts`. Results become TRPCErrors in exactly one place:
  `unwrapResult()` in `server/src/trpc/trpc.ts`. HTTP (non-tRPC) handlers map
  errors via `appErrorToHttpStatus()`.
- **One route per file** in `server/src/routes/`, named `domain.action.ts`,
  with a sibling `domain.action.test.ts`. Routes are composed in
  `trpc/router.ts`. Every route validates input with zod.
- **Uploads are not tRPC** — `/api/upload` is a plain Hono multipart route in
  `server/src/upload/`.
- **Live updates**: `/api/events` is a plain Hono SSE route
  (`server/src/events/`). Every successful mutation must call
  `notifyDataChanged()` so connected clients invalidate their queries; the
  client side lives in `client/src/hooks/useLiveUpdates.ts` (SSE + reconnect
  and refetch on visibility/pageshow/online).
- **Migrations** live in `server/src/db/migrations/`, embedded via the record
  in `index.ts` and run on boot. Up-only, append-only: never edit a shipped
  migration — add a new numbered file, and update the hand-written schema
  types in `db/schema.ts` to match.
- **Soft deletes only.** Set `deleted_at`; every query filters
  `deleted_at IS NULL`. Files stay on disk.
- **Timestamps** are server-local ISO 8601 strings with offset via
  `nowLocalIso()` (`lib/time.ts`); the first 10 chars are the calendar day.
  Don't use `new Date().toISOString()` for stored timestamps.
- FTS5 stays in sync through SQLite triggers — never write to `notes_fts`
  directly. User search input must go through `buildFtsQuery()`.

## Testing

- Vitest, no mocks: tests get a real in-memory SQLite DB with actual
  migrations via `createTestDb()`/`createTestCaller()` in
  `server/src/test/helpers.ts`, and call routes through the tRPC caller.
- Any new route, migration, or upload behavior needs tests.

## Client conventions

- Single page, no router. Filter state lives in `src/state/filters.tsx`
  (React context); server state lives in React Query via tRPC hooks —
  invalidate `notes.list`, `tags.list`, and `calendar.days` after mutations.
- UI primitives are hand-written shadcn-style components in
  `src/components/ui/` on Tailwind v4. Theme tokens are CSS variables in
  `src/styles/globals.css` (dark-only, but keep everything themeable —
  no hard-coded colors in components).
- Imports use the `@/` alias for `client/src/`.
- Files are uploaded to `/api/upload` *before* note create/update; the note
  mutation then claims the returned attachment ids.

## Gotchas

- Server dev uses `node --watch --import tsx` — plain `tsx watch` hangs
  without a TTY on Windows (e.g. under concurrently).
- `@note-stream/shared` must stay in the server's `dependencies` (not
  devDependencies) or `npm prune --omit=dev` breaks the Docker runtime image.
- The app has no auth by design; it is deployed behind a reverse proxy.
- Docker persists everything under one `DATA_DIR` (`/config`) bind mount.

# note-stream

A stream-of-consciousness note taking app. Type into a chat-style composer,
hit send, and your note lands at the top of an infinitely scrolling timeline.
Filter the stream with full-text search, a calendar, and `#tags`.

## Features

- **Chat-style composer** — write Markdown, attach files (button, drag-drop,
  or paste), Ctrl+Enter to send
- **Note stream** — newest first, infinite scroll, edit and delete
- **Tags** — any `#alphanumeric` text in a note becomes a tag; the sidebar
  lists all tags with counts
- **Calendar** — days with notes are clickable to filter by date
- **Full-text search** — powered by SQLite FTS5
- All three filters are combinable; if a new filter would produce zero
  results, the others are cleared automatically
- **Attachments** — images preview inline and open in a fullscreen modal;
  text files preview their content; everything else gets a file card with
  details and a download button
- Dark mode by default, themeable via CSS variables

> **Warning — no authentication.** note-stream has no auth of any kind. Run
> it behind a reverse proxy (Authelia, Caddy basic-auth, Tailscale, etc.) and
> never expose it directly to the internet.

## Running with Docker (recommended)

The repository ships a [`docker-compose.yml`](./docker-compose.yml) that
builds straight from this git repo — no clone needed:

```yaml
services:
  note-stream:
    build: https://github.com/Joshua-Beatty/note-stream.git
    ports:
      - "3000:3000"
    volumes:
      - ./config:/config
    environment:
      - TZ=America/Denver
    restart: unless-stopped
```

```bash
docker compose up -d
```

All data (the SQLite database and every uploaded file) lives in the
`./config` bind mount — back up that directory and you've backed up
everything.

Or build and run manually:

```bash
docker build -t note-stream .
docker run -d \
  -p 3000:3000 \
  -v ./config:/config \
  -e TZ=America/Denver \
  note-stream
```

### Timezone and the calendar

Calendar day boundaries use the **server's local time**. Set the `TZ`
environment variable to your timezone so "notes from July 4th" means *your*
July 4th. For Mountain Time use:

```yaml
environment:
  - TZ=America/Denver
```

(`America/Denver` handles Daylight Saving automatically; use `America/Phoenix`
for year-round MST.)

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `DATA_DIR` | `/config` (Docker), `./data` (dev) | Directory containing `notes.db` and `user_content/` |
| `MAX_FILE_SIZE_MB` | `100` | Maximum size per uploaded file |
| `MAX_FILES_PER_NOTE` | `20` | Maximum attachments per note |
| `TZ` | system | Server timezone; controls calendar day boundaries |
| `STATIC_DIR` | `/app/client/dist` (Docker) | Built client directory to serve |

## Development

Requires Node.js 24+.

```bash
npm install
npm run dev
```

This starts both the API server on :3000 and the Vite dev server on :5173
(which proxies `/api` and `/user_content` to the API). Then open
http://localhost:5173.

They can also be run individually with `npm run dev --workspace=server` and
`npm run dev --workspace=client`.

```bash
npm test         # server unit tests (vitest, in-memory SQLite)
npm run build    # build shared, server, and client
```

### Project layout

```
shared/   Types shared between server and client (Note, Attachment, tag regex)
server/   Hono + tRPC API, Kysely + better-sqlite3, neverthrow error handling
client/   Vite + React 19, TanStack Query + tRPC, Tailwind CSS v4
```

The server stores notes in SQLite (WAL mode, FTS5 full-text index maintained
by triggers) and uploaded files under `{DATA_DIR}/user_content/{uuid}/{name}`.
Migrations are embedded in the binary and run automatically on boot. Deletes
are soft — rows are flagged and files kept on disk, so your data is
recoverable from the database directly if needed.

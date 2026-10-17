# Data Management — Export, Backup, Restore

How current data leaves the database, how timestamped backups are taken, and
how a validated backup is restored — plus the honest security and persistence
limitations of this prototype.

## Source of truth

| Layer | Location | Role |
| --- | --- | --- |
| Runtime data | SQLite at `backend/runtime/saathi.db` (configurable via `SAATHI_DATABASE_URL`) | **The** source of truth. Every screen reads and writes it through the API. |
| Initial seed | `datasets/*.json` | Imported once, when the database is empty. Never rewritten by the app. |
| Backups | `backend/backups/<name>/` (configurable via `SAATHI_BACKUP_DIR`) | Timestamped snapshots of the **database**, not of the seed files. Git-ignored. |

Runtime edits (budget limits, mark-paid, contributions, created transactions)
update only the database. Export and backups always read the live database —
never the seed files. Restore never touches `datasets/`.

## JSON export

`GET /api/data/export` downloads the entire current database as one JSON
document with `Content-Disposition: attachment`:

```json
{
  "format": "paytm-saathi-export",
  "schema_version": "1.0",
  "app": "paytm-saathi",
  "app_version": "1.0.0",
  "exported_at": "2026-10-17T16:16:11",
  "source": "database",
  "storage_mode": "sqlite",
  "record_counts": {"users": 2, "accounts": 2, "categories": 6, "transactions": 30, "budgets": 5, "savings_goals": 3, "goal_contributions": 3, "bills": 6, "monthly_history": 4},
  "data": {"users": [...], "accounts": [...], "...": [...]}
}
```

- All nine tables are included, with primary keys and foreign keys preserved,
  so exports can be validated and restored.
- Money stays integer `*_paise`; dates are ISO strings, exactly as stored.
- The schema version (`1.0`) is what restore checks before importing.
- **No sensitive fields exist to leak:** the schema has no passwords, hashes,
  tokens or secrets (users only have a fictional `demo_email`). The test
  suite asserts the export contains none of those words.

## Backups

A backup is a directory named `backup-YYYYMMDD-HHMMSS` under the backup
directory (default `backend/backups/`, **outside** the tracked seed data):

```
backend/backups/backup-20261017-161648/
  manifest.json            format, schema_version, created_at, status:"complete", per-entity counts
  users.json  accounts.json  categories.json  transactions.json
  budgets.json  savings_goals.json  goal_contributions.json
  bills.json  monthly_history.json
```

- All entity files are read in **one database transaction**, so every file
  describes the same snapshot; `manifest.json` is written last and only then
  marked `status: "complete"` — a directory without it is listed as
  `incomplete` and cannot be restored.
- Creating backups requires the server to be started with
  `SAATHI_ALLOW_DATA_ADMIN=1` (same local-dev posture as `SAATHI_ALLOW_RESET`).
- `backend/backups/` is git-ignored; `datasets/*.json` remain tracked.

## Restore

Restore is **never automatic** — not at startup, not on any GET. Two modes:

| Mode | Behaviour |
| --- | --- |
| `snapshot` | Deletes every row, then inserts the backup contents. Full replacement. |
| `merge` | Inserts only records whose primary keys do not already exist (optionally limited with `entities: ["budgets", ...]`). Additive; existing rows are skipped, never overwritten. |

Safety layers, in order:

1. **Access** — 403 unless the server runs with `SAATHI_ALLOW_DATA_ADMIN=1`,
   and 403 for any non-loopback client (`request.client.host` must be
   `127.0.0.1`/`::1`). There is **no authentication** in this prototype: the
   env flag + loopback check is a local/admin workflow, not real security.
   A secret URL alone is explicitly *not* treated as sufficient.
2. **Explicit confirmation** — the body must contain `"confirm": true`.
   Without it the request is rejected with 400 before anything is validated
   or touched.
3. **Validation before mutation** — manifest presence/format, `schema_version`
   equality (`1.0`), `status: "complete"`, all nine files present and valid
   JSON arrays, field types (integers for paise, ISO dates/datetimes),
   duplicate primary keys, unknown fields, and foreign-key integrity
   (`transactions.user_id → users`, `budgets.category_id → categories`,
   `goal_contributions.goal_id → savings_goals`, …). Every error is returned
   together in one 400 response.
4. **Rollback-safe transaction** — the delete+insert runs inside a single
   database transaction; any failure rolls the whole thing back, so a failed
   restore leaves the previous data intact (asserted by a test that injects a
   mid-restore failure).

`POST /api/data/backups/{name}/validate` runs step 3 alone and never touches
the database — use it to vet a backup before restoring.

## Endpoints

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/data/export` | open (read-only) | Download current DB as versioned JSON |
| POST | `/api/data/backups` | `SAATHI_ALLOW_DATA_ADMIN=1` | Create a timestamped backup |
| GET | `/api/data/backups` | open | List backups + metadata (counts, size, status) |
| GET | `/api/data/backups/{name}` | open | One backup's manifest |
| POST | `/api/data/backups/{name}/validate` | open | Validation report; no DB access |
| POST | `/api/data/backups/{name}/restore` | admin flag + loopback + `confirm: true` | Restore (snapshot or merge) |

Backup names are server-generated and strictly validated
(`[A-Za-z0-9][A-Za-z0-9._-]{0,63}`, no `..`); request parameters never carry
filesystem paths.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `SAATHI_BACKUP_DIR` | `<repo>/backend/backups` | Where backups are written |
| `SAATHI_ALLOW_DATA_ADMIN` | `0` | Enables backup creation and restore |

## PowerShell quick reference

```powershell
# backend with backup/restore enabled (local only)
cd backend
$env:SAATHI_ALLOW_DATA_ADMIN = "1"
.\.venv\Scripts\python -m uvicorn app.main:app --port 8000

# export the live database to a file
Invoke-WebRequest -UseBasicParsing "http://localhost:8000/api/data/export" -OutFile export.json

# create a backup, then list and validate it
$backup = (Invoke-WebRequest -UseBasicParsing -Method Post "http://localhost:8000/api/data/backups").Content | ConvertFrom-Json
$name = $backup.backup
Invoke-WebRequest -UseBasicParsing "http://localhost:8000/api/data/backups"
Invoke-WebRequest -UseBasicParsing -Method Post "http://localhost:8000/api/data/backups/$name/validate"

# full snapshot restore (must run on the backend host; confirm is mandatory)
$body = '{"mode": "snapshot", "confirm": true}'
Invoke-WebRequest -UseBasicParsing -Method Post -Body $body -ContentType "application/json" `
  "http://localhost:8000/api/data/backups/$name/restore"

# additive merge of only budgets and bills
$body = '{"mode": "merge", "confirm": true, "entities": ["budgets", "bills"]}'
Invoke-WebRequest -UseBasicParsing -Method Post -Body $body -ContentType "application/json" `
  "http://localhost:8000/api/data/backups/$name/restore"

# tests (never touches your real runtime database — uses a temp DB + temp backup dir)
cd backend
.\.venv\Scripts\python -m pytest -q
```

## Security limitations (read this)

- **No authentication exists.** Export and backup listing/validation are
  unauthenticated reads of fictional demo data. Restore is gated by an env
  flag plus a loopback-only check — appropriate for a laptop demo, **not**
  sufficient for a shared or public deployment.
- Restore does not verify who you are; anyone who can start the server with
  the flag set on the host itself can restore.
- There is no backup encryption, no retention policy, and no audit log.
- The database file and backup directory hold only simulated data; treat them
  as such.

## Cloud persistence

- Backups live on the machine running the backend. On ephemeral hosting
  (serverless functions, fresh containers) both the SQLite file and
  `backend/backups/` disappear on redeploy — download exports regularly or
  mount a persistent volume and point `SAATHI_BACKUP_DIR` at it.
- For a durable deployment: use a real database (`SAATHI_DATABASE_URL` accepts
  any SQLAlchemy URL), a host with a persistent disk, and keep
  `SAATHI_ALLOW_DATA_ADMIN=0` — restore only over SSH on the host.

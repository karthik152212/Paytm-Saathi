# Paytm Saathi — Backend (FastAPI + SQLite)

The API layer that owns every number in the app: balances, transactions,
budgets, savings goals, bills, insights, safety scores and the rule-based
assistant. The React frontend is a client of this service; both speak the
same integer-`*_paise` contract documented in `docs/API_DOCUMENTATION.md`.

## Quick start (PowerShell, Windows)

```powershell
# from the repo root
cd backend
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

If you do not have the venv yet:

```powershell
cd backend
py -3.13 -m venv .venv          # or: python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

The server seeds itself from `../datasets/*.json` the first time it starts
against an empty database. Health check: <http://localhost:8000/api/health>.

## Environment variables

All optional — see the repo-root `.env.example`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `SAATHI_DATABASE_URL` | `sqlite:///./runtime/saathi.db` | SQLAlchemy URL |
| `SAATHI_DATASETS_DIR` | `<repo>/datasets` | JSON seed files |
| `SAATHI_SEED_ON_START` | `1` | Seed when the DB is empty |
| `SAATHI_ALLOW_RESET` | `0` | Enables destructive `POST /api/dev/reseed` |
| `SAATHI_DEFAULT_USER_ID` | `usr_001` | Default user when no `user_id` is passed |

## Tests

```powershell
cd backend
.\.venv\Scripts\python -m pytest -q
```

The suite (56 tests) covers health, dataset seeding and idempotency, the
balance formula, every CRUD route, validation (404/409/422), deterministic
safety scoring, assistant answers, and persistence across a simulated
process restart.

## Layout

```
backend/
  app/
    main.py            FastAPI app + lifespan (init_db + seed-on-empty)
    config.py          env settings
    db.py              engine, session, init_db/dispose
    models.py          SQLAlchemy tables
    data/loader.py     JSON reading + relative date-hint resolution
    seed.py            idempotent import from datasets/*.json
    repositories/      data access per entity
    services/          finance, insights, safety, assistant, format
    schemas/           Pydantic request/response models (paise + rupees)
    api/               routers, all mounted under /api
    tests/             pytest suite
  runtime/             SQLite file lives here (gitignored)
```

## Conventions

- Money is stored and returned as integer `*_paise`; every response also
  carries a derived `*_rupees` float for convenience.
- Dates are naive local datetimes serialised as `YYYY-MM-DDTHH:MM:SS`
  (no `Z`), so `new Date(...)` in the browser reads them as local time.
- Seeding never overwrites data: startup seeds only when `users` is empty,
  and re-importing is only possible via the guarded `/api/dev/reseed`.

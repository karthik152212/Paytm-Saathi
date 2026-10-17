# Professor's Demo Guide

A 7–10 minute walkthrough of Paytm Saathi for a classroom evaluation.
Everything shown is computed from a seeded dataset — there is no bank, no
wallet, no cloud AI and no network dependency beyond localhost.

## Before you present

```powershell
# terminal 1 — backend (seeds itself on first run)
cd backend
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000

# terminal 2 — frontend
cd frontend
npm run dev
```

Open <http://localhost:5173>. Confirm the header chip reads **API live**.
Optional clean slate:

```powershell
$env:SAATHI_ALLOW_RESET="1"   # then restart the backend
Invoke-WebRequest -Method POST http://localhost:8000/api/dev/reseed
```

## The script

**1. Hook (30 s).** "Paytm Saathi is a personal finance companion for people
new to digital payments — students, senior citizens, first-timers. It turns
payments into understanding, plans and scam-safety habits. Everything you
will see is simulated demo data."

**2. Overview (60 s).** Point at the four summary cards and the narrative
insight ("You have spent ₹25,436 this month, and Other is the biggest part
of it at 51%…"). Open the Network tab or `/api/overview` once: one request
hydrated the whole dashboard. Mention the balance formula printed in the
docs: opening + credits − debits − savings contributions.

**3. Transactions (45 s).** Search "zomato", filter *Money out*, expand
**Neo Tech Store ₹8,999** to show the demo flag. "Every screen reads the
same transaction list — there are no hardcoded numbers in the UI."

**4. Budgets (60 s).** Change the Food budget ₹6,000 → ₹7,500. Progress,
remaining, combined utilisation and the Overview numbers all move together.
Then stop the backend (Ctrl+C in terminal 1) and repeat the edit: the app
flips to **Offline · local data**, keeps working, and the chip offers Retry.

**5. Goals (60 s).** Open Emergency Fund, add ₹12,500. Progress, "saved this
month" and the available balance update together — money moved into a goal
is still yours, just earmarked. (Re-enable the backend first if you stopped
it; a retry re-syncs.)

**6. Bills (45 s).** Mark the overdue Gym Membership paid; it leaves the
Overdue column. Mark it unpaid to show reversibility.

**7. Safety Center (90 s).** Open the high-priority demo scenario. "Four
transparent rules, weights 40/25/25/15, no machine learning. This payment
scored 90: flagged in the data + unusually large + three debits within an
hour. Note the wording — it says verify, it never says 'confirmed fraud'."
Show the rules table and the checklist.

**8. Assistant (90 s).** Ask "How can I save ₹5,000 this month?" — the plan
is built from the live remaining budget. Ask "Can I afford ₹1,500 in
shopping?" and "What is an EMI?". Try an off-script question to show the
honest fallback. Mention: rule-based engine, runs in the browser and on the
backend, no API key, no data leaves the machine.

**9. Simple Mode + Settings (45 s).** Toggle Simple Mode (larger text, plain
wording everywhere). Show Reset demo data → confirms → everything returns to
the original scenario (server-side reseed when the backend is running).

## Talking points / likely questions

| Question | Answer |
| --- | --- |
| Where is the data stored? | SQLite (`backend/runtime/saathi.db`), seeded from `datasets/*.json`. The browser keeps a LocalStorage cache so the UI works offline. |
| Is the AI real? | It is a transparent rule engine ("local-rules-v1") — no LLM, no API key. That is a deliberate privacy/teaching choice, and it fails honestly instead of inventing answers. |
| Is this fraud detection? | No. Four weighted rules over demo data produce "worth a second look" alerts, always with a disclaimer. |
| Is it connected to Paytm? | No. Independent demonstration prototype; not affiliated with or endorsed by Paytm. All data simulated. |
| Can it deploy? | The frontend is a static build and deploys anywhere (Vercel config included). The FastAPI + SQLite backend needs a persistent Python host — that is documented honestly in the README rather than faked with a serverless hack. |
| How is money handled? | Integer paise end to end; one conversion point in the frontend mapper; identical balance formulas on both sides, pinned by tests (45 frontend + 56 backend). |
| What would production need? | Auth, a real database, rate limiting, an actual fraud model, accessibility audit, i18n — the README lists these as out-of-scope next steps. |

## Timing fallback

Short on time? Keep 2 (overview), 4 (budget + offline), 7 (safety) and 8
(assistant) — they cover data integrity, full-stack wiring with a real
failure mode, ethical UX and the AI story.

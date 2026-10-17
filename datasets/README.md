# Paytm Saathi — Seed Datasets

Single source of truth for the demo scenario. Only the **backend** reads
these files — at first boot it imports them into SQLite, and the frontend
receives everything through `/api`. Editing a file and calling
`POST /api/dev/reseed` (with `SAATHI_ALLOW_RESET=1`) rebuilds the database.

## Files

| File | Rows | Notes |
| --- | --- | --- |
| `categories.json` | 6 | Food, Transport, Shopping, Bills, Education, Other (ids are lowercase) |
| `users.json` | 2 | `usr_001` Aarav Sharma (demo user), `usr_002` Meera Iyer |
| `accounts.json` | 2 | One wallet per user; `opening_balance_paise` feeds the balance formula |
| `transactions.json` | 30 | 25 debits + 5 credits across the current and previous month |
| `budgets.json` | 5 | One per category except `other` (the unbudgeted bucket for the demo burst) |
| `savings_goals.json` | 3 goals + 3 contributions | Emergency Fund, Laptop, Trip |
| `bills.json` | 6 | One overdue, four upcoming, one already paid |
| `monthly_history.json` | 4 | Extra months used by the spending chart (documented extension of the prototype state) |
| `safety_scenarios.json` | 4 | Teaching data for the Safety Center (`should_raise_alert: false` cases included) |

## Relative dates

Most files accept either absolute ISO dates or **seed hints**, resolved to
the actual calendar at import time so the demo always looks "current":

```json
"seed_due_date": { "kind": "offset_days", "days": -2 }
```

| Kind | Fields | Meaning |
| --- | --- | --- |
| `day` | `day` | This month, on that day |
| `prev_month` | `day` | Previous month, on that day |
| `offset_days` | `days` | Today + N days (negative = past) |
| `month_offset` | `months`, `day` | N months back (used by monthly history) |

Absolute `*_date` fields are used as-is when present.

## The demo scenario (mirrors the original frontend seed)

- Opening balance ₹38,000 → available balance **₹56,036** after all seed rows.
- `txn_010` — Neo Tech Store ₹8,999, flagged, inside the burst cluster
  `txn_010/011/012` (three debits within one hour) → the one **high** safety
  alert shown in the Safety Center demo.
- `txn_001` — Chai Point ₹140, the ordinary payment that must never be flagged.
- Money formula (identical in backend and frontend selectors):

  ```
  available = opening + credits − debits − goal contributions
  ```

## Regenerating

`generate_seed_files.py` is the one-shot script that produced these files
from the original prototype constants. Re-run it only if you change the
scenario:

```powershell
cd datasets
..\backend\.venv\Scripts\python generate_seed_files.py
```

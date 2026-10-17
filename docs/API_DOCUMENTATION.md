# API Documentation

Base URL: `/api` (dev: `http://localhost:8000` via the Vite proxy at
`http://localhost:5173/api`). Interactive docs at `/docs` (Swagger UI) and
`/redoc` when the backend is running.

All responses are JSON. Money fields are integers in **paise**; matching
`*_rupees` floats are included for display. Errors use FastAPI's standard
shape: `{"detail": "…"}` with 404 (not found), 409 (conflict), 422
(validation) and 403 (guarded reset).

`user_id` is optional everywhere — it defaults to `SAATHI_DEFAULT_USER_ID`
(`usr_001`). A bad id is a 404.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness, seed counts, config summary (no secrets) |
| GET | `/api/overview` | One-shot hydration snapshot |
| GET | `/api/users` · `/api/users/{id}` | List / fetch users |
| PATCH | `/api/users/{id}` | Update display name / subtitle |
| GET | `/api/accounts` · `/api/accounts/{id}` | Accounts with computed balance |
| GET | `/api/transactions` | List + filters (`q`, `category_id`, `direction`, `account_id`, `limit`, `offset`) |
| GET | `/api/transactions/{id}` | One transaction |
| GET/POST | `/api/budgets` | List / create |
| PATCH/DELETE | `/api/budgets/{id}` | Change limit / remove |
| GET/POST | `/api/goals` | List (+contributions) / create |
| PATCH/DELETE | `/api/goals/{id}` | Edit / remove (contributions removed with it) |
| POST | `/api/goals/{id}/contributions` | Add money to a goal |
| GET | `/api/goals/{id}/contributions` | Contribution history |
| GET/POST | `/api/bills` | List / create |
| PATCH/DELETE | `/api/bills/{id}` | Edit / remove |
| POST | `/api/bills/{id}/mark-paid` | Demo-only "mark paid" |
| GET | `/api/insights` | Insight feed + narrative text |
| GET | `/api/safety/alerts` | Deterministic safety scores, rules, checklist |
| GET | `/api/assistant/suggested` | Suggested questions |
| POST | `/api/assistant/chat` | Rule-based answer |
| POST | `/api/dev/reseed` | Destructive restore (403 unless `SAATHI_ALLOW_RESET=1`) |

## Selected examples

### GET /api/health

```json
{
  "status": "ok",
  "app": "Paytm Saathi API",
  "version": "1.0.0",
  "storage_mode": "sqlite",
  "seeded": true,
  "default_user_id": "usr_001",
  "allow_reset": false,
  "record_counts": {"users": 2, "transactions": 30, "budgets": 5, "savings_goals": 3, "bills": 6, "categories": 6},
  "server_time": "2026-10-17T10:15:00"
}
```

### GET /api/overview

The frontend hydrates from this single call. Shape (abbreviated):

```json
{
  "user": {"user_id": "usr_001", "display_name": "Aarav Sharma", "demo_email": "aarav.sharma@example.com", "is_demo_user": true},
  "accounts": [{"account_id": "acc_001", "opening_balance_paise": 3800000, "balance_paise": 5603600}],
  "categories": [{"category_id": "food", "display_label": "Food", "color_hex": "#…"}],
  "transactions": [{
    "transaction_id": "txn_010", "merchant": "Neo Tech Store",
    "amount_paise": 899900, "amount_rupees": 8999.0, "direction": "debit",
    "category_id": "other", "category_label": "Other",
    "transaction_date": "2026-10-14T20:41:00", "payment_method_label": "UPI",
    "demo_risk_flag": true, "demo_flag_reason": "Demo scenario: …"
  }],
  "budgets": [{"budget_id": "bud_food_usr_001", "category_id": "food", "monthly_limit_paise": 600000, "spent_paise": 299700, "used_percent": 50, "status": "ok"}],
  "budget_totals": {"limit_paise": 3000000, "spent_paise": 2543600, "used_percent": 85, "status": "warning"},
  "goals": [{"goal_id": "goal_001", "title": "Emergency Fund", "target_amount_paise": 2000000, "saved_amount_paise": 2150000, "progress_percent": 100}],
  "contributions": [{"contribution_id": "con_…", "goal_id": "goal_001", "amount_paise": 50000, "created_at": "2026-10-05T18:00:00"}],
  "bills": [{"bill_id": "bill_001", "title": "Gym Membership", "amount_paise": 150000, "due_date": "2026-10-15T00:00:00", "status": "upcoming", "days_left": -2, "overdue": true}],
  "monthly_history": [{"month": "2026-06", "spending_paise": 2240000}],
  "weekly_series": [{"date": "2026-10-11", "spending_paise": 0}],
  "monthly_series": [{"month": "2026-10", "spending_paise": 2543600}],
  "summary": {"available_balance_paise": 5603600, "spending_this_month_paise": 2543600, "income_this_month_paise": 3890000, "saved_this_month_paise": 850000, "days_left_in_month": 14},
  "insight_text": "You have spent ₹25,436 this month, and Other is the biggest part of it at 51%. …",
  "insights": [{"id": "top-category", "kind": "info", "title": "Other is your largest category", "body": "…"}],
  "disclaimer": "All balances, transactions and calculations are simulated demonstration data. …"
}
```

### Balance formula

`available_balance_paise` (and the frontend selector) both compute:

```
opening + Σ credits − Σ debits − Σ goal contributions
```

### GET /api/transactions?direction=debit&category_id=food&q=zomato

```json
{"items": [...], "total_count": 2, "filters_applied": {"q": "zomato", "category_id": "food", "direction": "debit"}}
```

`direction` must be `debit` or `credit` (422 otherwise).

### PATCH /api/budgets/bud_food_usr_001

Request: `{"monthly_limit_paise": 750000}`
Response: the budget row with recalculated `spent_paise` / `used_percent` /
`status`. Limits must be > 0 (422); a duplicate category on POST is 409;
unknown category on POST is 404.

### POST /api/goals/goal_001/contributions

Request: `{"amount_paise": 250000, "note": "optional"}`
Response `201`:

```json
{"contribution": {"contribution_id": "con_…", "amount_paise": 250000, "amount_rupees": 2500.0},
 "goal": {"goal_id": "goal_001", "saved_amount_paise": 2400000, "progress_percent": 100}}
```

Amounts ≤ 0 → 422 (schema) or 400 (service); unknown goal → 404.

### POST /api/bills/bill_001/mark-paid

Sets `status: "paid"` and `paid_date` — a demonstration state change only; no
payment is processed. Undo with `PATCH {"status": "upcoming"}`.

### GET /api/safety/alerts

```json
{
  "alerts": [{
    "alert_id": "alert-txn_010", "transaction_id": "txn_010", "score": 90,
    "severity": "high", "severity_label": "High — verify before acting",
    "headline": "Payment to an unknown merchant at an unusual hour",
    "recommendation": "Stop before you act. Do not share your OTP or UPI PIN…",
    "simple_description": "This payment looks very different…",
    "triggers": [{"code": "flagged", "weight": 40, "explanation": "…"}, {"code": "large-amount", "weight": 25}, {"code": "burst", "weight": 25}]
  }],
  "summary": {"high": 1, "medium": 1, "low": 3, "total": 5, "disclaimer": "…never a claim that a payment is confirmed fraud."},
  "rules": [{"code": "flagged", "title": "Explicit demo marker", "weight": 40}],
  "checklist": [{"id": "otp", "title": "Never share your OTP or UPI PIN", "body": "…"}]
}
```

Scoring is deterministic (same input → same output, asserted in tests).

### POST /api/assistant/chat

Request: `{"message": "Where did most of my money go?", "user_id": "usr_001"}`
Response:

```json
{
  "reply": "You have spent ₹25,436 this month across 25 payments.\n\n  • Other — ₹12,977 (51%)…",
  "engine": "local-rules-v1",
  "user_id": "usr_001",
  "answered_at": "2026-10-17T10:20:00",
  "note": "Rule-based prototype assistant…"
}
```

Intents: greeting, afford, save, bills, budget, spending, balance, goals,
safety, income, explain (glossary). Unmatched input returns an honest
fallback listing what it understands. Empty message → 422.

### POST /api/dev/reseed

Drops every row and re-imports `datasets/*.json`. Returns
`{"status": "reseeded", "record_counts": {...}}`, or **403** when the server
was started without `SAATHI_ALLOW_RESET=1`.

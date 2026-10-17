# Data Dictionary

Three representations of the same data: **seed JSON** (`datasets/`), **SQLite
tables** (`backend/app/models.py`) and **API DTOs** (Pydantic, rendered into
frontend domain types by `frontend/src/services/mappers.ts`).

## Conventions

- **Money**: stored as integer paise (`amount_paise`). Every API object also
  carries `*_rupees` = paise / 100 for display. The frontend domain uses
  rupees everywhere and converts only in the mapper.
- **Dates**: naive local time. `datetime` values serialise as
  `YYYY-MM-DDTHH:MM:SS`; `date` values as `YYYY-MM-DDT00:00:00` (midnight, so
  JS `new Date()` reads them as local, not UTC).
- **Ids**: stable strings (`usr_001`, `txn_010`, `bud_food_usr_001`,
  `goal_001`, `bill_002`, `con_…`).
- **Categories**: ids are lowercase (`food`, `transport`, `shopping`, `bills`,
  `education`, `other`); labels are `Food`, `Transport`, … The frontend
  `Category` type uses the labels.

## Entity: users

| Field (DB / DTO) | Type | Notes |
| --- | --- | --- |
| `user_id` | str PK | `usr_001` (Aarav Sharma, demo user), `usr_002` (Meera Iyer) |
| `display_name` | str | Shown in the greeting and profile |
| `subtitle` | str? | e.g. "Student" |
| `demo_email` | str | `…@example.com`, simulated only |
| `preferred_language` | str | `en-IN` |
| `accessibility_preferences` | JSON str | Reserved for future a11y flags |
| `is_demo_user` | bool | `usr_001` is the default demo identity |

## Entity: accounts

| Field | Type | Notes |
| --- | --- | --- |
| `account_id` | str PK | `acc_001`, `acc_002` |
| `user_id` | FK → users | |
| `display_label` | str | "Demo Wallet" |
| `currency` | str | `INR` |
| `opening_balance_paise` | int | Seed: 3,800,000 (₹38,000) for `usr_001` |
| `account_status` | str | `active` |
| `is_demo_account` | bool | Always true in this prototype |
| `balance_paise` | int (API only) | Computed: opening + credits − debits − contributions |

## Entity: transactions

| Field | Type | Notes |
| --- | --- | --- |
| `transaction_id` | str PK | `txn_001` … `txn_030` |
| `account_id` / `user_id` | FK | |
| `merchant` | str | "Chai Point", "Neo Tech Store", … |
| `description` | str? | Maps to frontend `note` |
| `amount_paise` | int | Always positive; direction is separate |
| `direction` | `debit` \| `credit` | |
| `category_id` | FK → categories | |
| `transaction_date` | datetime | Current month for `txn_001–024`, previous for `025–030` |
| `payment_method_label` | str | `UPI`, `Wallet`, `Card`, `Net Banking`, `AutoPay` |
| `demo_risk_flag` | bool | Only `txn_010` |
| `demo_flag_reason` | str? | "Demo scenario: …" shown in Safety Center |

## Entity: categories

| Field | Type |
| --- | --- |
| `category_id` | str PK (`food`, `transport`, `shopping`, `bills`, `education`, `other`) |
| `display_label` | str |
| `color_hex` | str |
| `icon` | str |
| `sort_order` | int |

## Entity: budgets

| Field | Type | Notes |
| --- | --- | --- |
| `budget_id` | str PK | `bud_<category>_<user suffix>` |
| `user_id`, `category_id` | FK | Unique pair — one budget per category per user |
| `monthly_limit_paise` | int | Mutable via `PATCH /api/budgets/{id}` |
| `period` | str | `YYYY-MM` of creation; spent is always *this* calendar month |
| `spent_paise`, `used_percent`, `status` | API-only | Derived from current-month debits (`ok` < 75% ≤ `warning` < 100% ≤ `over`) |

## Entity: savings goals + contributions

| Field | Type | Notes |
| --- | --- | --- |
| `goal_id` | str PK | |
| `title`, `note` | str | |
| `target_amount_paise`, `saved_amount_paise` | int | `saved` increases on every contribution |
| `target_date` | date? | |
| contribution `contribution_id` | str PK | Append-only history |
| contribution `amount_paise` | int | > 0 (422 otherwise) |

## Entity: bills

| Field | Type | Notes |
| --- | --- | --- |
| `bill_id` | str PK | |
| `title`, `amount_paise` | | |
| `due_date` | date | `days_left` / `overdue` derived at read time |
| `status` | `upcoming` \| `paid` | `paid_date` set by mark-paid |
| `recurring` | bool | |
| `category_id` | FK? | |

## Entity: monthly history (chart extension)

| Field | Type | Notes |
| --- | --- | --- |
| `month` | str `YYYY-MM` | |
| `spending_paise` | int | Used when the frontend has no live transactions for that month |

## Safety scoring (rules, not a model)

| Rule code | Weight | Fires when |
| --- | --- | --- |
| `flagged` | 40 | `demo_risk_flag` is set in the dataset |
| `large-amount` | 25 | amount ≥ max(₹5,000, 5 × median debit) |
| `burst` | 25 | ≥ 3 debits within a 60-minute window |
| `unusual-hour` | 15 | payment hour < 05:00 |

Severity: **high** ≥ 60, **medium** ≥ 40, else **low**. An alert is emitted
only when at least one rule fires, and every alert ships its triggers,
score, plain-English recommendation and the "not confirmed fraud" disclaimer.

## Frontend domain types

`frontend/src/data/types.ts` — `Transaction`, `Budget {category, limit}`,
`SavingsGoal`, `Contribution`, `Bill`, `Profile`, `Settings`, `ChatMessage`,
`AppState`. All money fields are whole rupees; all dates are ISO strings.
`AppState` adds `history: {month, spending}[]` for the monthly chart and is
persisted to LocalStorage under `paytm-saathi:v1`.

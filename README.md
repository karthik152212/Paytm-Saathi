# Paytm Saathi

**From Payments to Progress.**

An AI-powered personal finance companion prototype for students, senior citizens, first-time digital-payment users and everyday consumers. It helps people **understand money → plan ahead → stay safer → take action**.

> **Independent demonstration prototype.** All data is simulated. Paytm Saathi is not affiliated with, endorsed by or connected to Paytm. It does not connect to any bank or wallet, does not process payments, does not send SMS/email, and its Safety Center uses simple illustrative rules — not a production fraud-detection model. Nothing in this app is financial advice.

---

## Run it

```bash
npm install
npm run dev
```

Open **http://localhost:5173/** — the app opens on the Overview dashboard with seeded demo data. No API key, backend or login is required.

| Command          | What it does                                        |
| ---------------- | --------------------------------------------------- |
| `npm run dev`    | Start the Vite dev server (main demo command)       |
| `npm run build`  | Type-check (`tsc -b`) and produce a production build |
| `npm run lint`   | oxlint over the source                              |
| `npm test`       | 41 logic tests: selectors, reducer, safety, assistant |
| `npm run preview`| Serve the production build                          |

## 2-minute live demo

1. **Overview** — point at the four summary cards, then the spending insight: every figure is computed from the transaction list. Note the notification bell (3 items).
2. **Transactions** — search “zomato”, switch to *Money out*, expand a row. Expand **Neo Tech Store** to see the flagged payment.
3. **Budgets** — edit the **Food** budget (₹6,000 → ₹7,500) and watch the progress bar, remaining amount, combined utilisation and the dashboard change.
4. **Savings Goals** — open **Emergency Fund**, add **₹2,500**. Progress, “Saved this month” and available balance all update together.
5. **Bills & Reminders** — mark the overdue **Gym Membership** as paid; the Overdue section disappears.
6. **Safety Center** — open the high-priority demo scenario: three rules fire on one payment, each with a plain-English explanation and a recommended safe action.
7. **AI Assistant** — ask “How can I save ₹5,000 this month?” — the plan uses your *actual* remaining budget (₹8,441 at reset).
8. **Settings** — toggle **Simple Mode** (larger text, plain wording), then **Reset demo data** to restore the original scenario.

Your edits persist in LocalStorage across refreshes. Reset restores the original seed.

## What is implemented

- **Overview** — greeting/date, 4 computed summary cards, weekly spending chart, category breakdown, monthly trend, natural-language insight, actionable insight cards, recent transactions with search and category filter, next-action strip.
- **Transactions** — 30 seeded Indian demo transactions with search, category and credit/debit filters, expandable detail rows, empty state, risk indicators.
- **Budgets** — category limits with progress, warning (>75%) and over-budget (>100%) states, working edit and add forms, a plain-English calculation explainer. Spent amounts are always derived from transactions.
- **Savings Goals** — add / edit / delete goals, contribute money with validation (non-positive amounts rejected), progress bars, contribution history, “illustrative, not investment advice” notice.
- **Bills & Reminders** — overdue / upcoming / paid sections, days-until labels, mark-as-paid and undo, add / edit / delete, recurring indicator, explicit “no real payment is made” notice.
- **Safety Center** — 4 transparent rules (demo marker, unusual amount, payment burst, unusual hour), weighted scoring, severity labels, per-transaction “why flagged” explanations, recommended safe actions, a guided demo scenario, and a 6-point scam-prevention checklist.
- **AI Assistant** — chat interface over a **local rule engine** (no API key, no network). Handles spending summaries, largest category, affordability, savings plans, bills, budgets in plain words, financial terms, scam safety, balance/goals/income, and an honest fallback.
- **Simple Mode** — persistent toggle that scales type and replaces financial jargon with plain English on every screen.
- **Settings** — profile name, Simple Mode, demo-data stats, storage usage, **Reset demo data** with confirmation, and the prototype disclaimer.

## Architecture

```
src/
  data/types.ts       typed data model (Transaction, Budget, Goal, Bill, ChatMessage…)
  data/seed.ts        deterministic demo dataset (dates derived from today)
  data/store.ts       reducer + LocalStorage load/save + malformed-data guard
  data/selectors.ts   ALL financial math — single source of truth
  state/AppContext.tsx  app-wide state provider, persists every change
  safety/riskScoring.ts deterministic, explainable risk rules
  assistant/engine.ts   local rule-based assistant
  components/ui.tsx     shared primitives (Card, Modal, ProgressBar, Badge…)
  components/layout/Shell.tsx  sidebar, top bar, notifications, mobile nav
  views/               Overview, Transactions, Budgets, Goals, Bills,
                       Safety, Assistant, Settings
  router.ts            tiny hash router (refresh-safe deep links)
```

Every rupee figure on screen comes from `src/data/selectors.ts`, so the dashboard, charts, budgets, assistant and notifications can never disagree. Editing a budget, contributing to a goal or paying a bill updates all of them at once.

## Testing

`npm test` compiles the app’s pure logic and runs 41 assertions with Node’s built-in test runner (`tests/logic.test.ts`): seed consistency, selector maths, reducer behaviour, LocalStorage round-trips and corruption handling, safety-rule determinism, and assistant intent coverage.

The production build was also verified in a real browser at 1440px and 390px widths.

See **PROTOTYPE_READINESS_REPORT.md** for the full test log and known limitations.

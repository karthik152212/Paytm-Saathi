# Paytm Saathi — Prototype Readiness Report

**Date:** 10 October 2026
**Status:** Ready for live demonstration
**Entry point:** `src/main.tsx` → `src/App.tsx`
**Startup command:** `npm install && npm run dev` → http://localhost:5173/

---

## 1. Technology stack actually used

| Layer        | Choice                                                     |
| ------------ | ---------------------------------------------------------- |
| Framework    | React 19.2 + TypeScript ~6.0                               |
| Build        | Vite 8.3                                                   |
| Styling      | Tailwind CSS 3.4 (custom design tokens in `tailwind.config.js`) |
| Charts       | Recharts 3.10                                              |
| Icons        | lucide-react 1.55                                          |
| Utilities    | clsx                                                       |
| State        | React Context + `useReducer` (`src/state/AppContext.tsx`)  |
| Persistence  | Browser LocalStorage (`paytm-saathi:v1`)                   |
| Routing      | 30-line hash router (`src/router.ts`) — refresh-safe        |
| Tests        | Node built-in test runner + `tsc` (`npm test`)             |
| Lint         | oxlint                                                     |

No backend, no database, no authentication, no API key, no external AI service, no paid dependency.

## 2. Implemented features

**P0 — startup and demo flow**
- App starts with `npm run dev` and opens on Overview with realistic seeded data (30 transactions, 5 budgets, 3 goals, 6 bills, 1 conversation).
- All 8 navigation destinations render distinct screens; hash routes survive refresh (`#/budgets`, `#/safety`, …).
- Single typed data model + reducer; every change is persisted.

**P1 — dashboard, analytics, budgets, transactions**
- Overview: greeting/date/demo badge, 4 computed summary cards (balance, spending, saved, remaining budget), weekly bar chart, category donut, 6-month trend, natural-language spending insight, 4 actionable insight cards + next-action strip, recent transactions with search + category filter.
- Transactions: 30 seeded Indian demo payments, search, category filter, credit/debit filter, live totals, expandable detail rows, empty state with “Reset filters”.
- Budgets: derived spent amounts, progress bars, warning (>75%) and over (>100%) states, working edit and add-budget modals with validation, spending-vs-limit chart with limit markers, calculation explainer.

**P2 — goals, bills, safety, assistant**
- Savings Goals: add / edit / delete, contribute with validation, progress bars and percentages, contribution history, disclaimer.
- Bills & Reminders: overdue / upcoming / paid sections, days-until labels, mark-paid and undo, add / edit / delete, recurring flag, “no real payment is made” notice.
- Safety Center: 4 transparent weighted rules (demo marker 40, unusual amount 25, burst 25, unusual hour 15), severity buckets, per-transaction “why flagged” explanations, recommended safe actions, a guided high-priority demo scenario, 6-point scam-prevention checklist, prominent “illustrative only” disclaimer.
- AI Assistant: chat UI with 5 suggested questions, computed instant answers, and a persistent conversation. Intents: spending summary, largest category, affordability, savings plan, upcoming/overdue bills, budget in plain words, financial-term glossary, scam/OTP safety, balance, goals, income, honest fallback.

**P3 — accessibility, polish, resilience**
- Simple Mode: persistent toggle, `html[data-simple]`, larger base type and plain-English copy on Overview, Budgets, Bills, Safety and Settings.
- Responsive: sidebar + top bar on desktop; hamburger drawer and scrollable 8-item bottom nav on mobile; verified at 390×844 with no horizontal overflow.
- Loading/empty/error states, modal Escape + focus handling, focus-visible rings, `prefers-reduced-motion` support, notification panel generated from live state.
- Data layer isolated from presentation; malformed or partial LocalStorage never crashes the app.

## 3. Tests actually executed

### 3.1 `npm test` — 41 logic tests, **41 passed / 0 failed**

Compiles `src` pure logic with `tsc -p tsconfig.test.json` and runs `tests/logic.test.ts` on Node’s built-in runner.

| Area | Tests | Result |
| --- | --- | --- |
| Seed integrity (count, categories, dates, balance identity) | 3 | pass |
| Selectors (category sums, budget derivation, totals agreement, dashboard consistency, weekly/monthly series, top category, search + filters, ordering, goals, bills split) | 12 | pass |
| Reducer (budget edit propagates, invalid limits rejected, contribution updates goal + saved + balance, negative contributions rejected, bill pay/undo, goal add/remove, reset restores seed) | 7 | pass |
| Persistence (malformed data → safe fallback, round-trip keeps edits, partial damage repaired, Simple Mode persists) | 4 | pass |
| Safety (rules documented, high-priority demo alert with all 4 triggers, ordinary payments never flagged, deterministic scoring, no “confirmed fraud” language) | 5 | pass |
| Assistant (all 5 suggested questions, spending/affordability/savings/bills/budget intents with real numbers, glossary, safety, balance/goals/income, honest fallback, empty input) | 10 | pass |

Bugs found and fixed during the test run:
1. `budget/set` accepted negative limits → now validated in the reducer.
2. Glossary matching returned “interest” for “compound interest” → longest-match-first.
3. “What is the weather…?” matched the glossary intent and never reached the honest fallback → intent now requires a glossary hit.

### 3.2 `npm run build` — **passed** (exit 0)

`tsc -b && vite build` → `dist/assets/index-*.js` 742 kB (216 kB gzip), `index-*.css` 33 kB (6.4 kB gzip). Only a chunk-size warning (Recharts), no errors.

### 3.3 `npm run lint` — **passed** (exit 0)

oxlint reports 0 errors and 7 warnings (React purity hints about `new Date()` during render, plus 2 fast-refresh export hints). None affect behaviour.

### 3.4 Browser smoke test (Playwright, real Chromium)

| Check | Result |
| --- | --- |
| Load Overview, no console errors | pass (only the React DevTools info message) |
| Navigate all 8 routes | pass |
| Edit Food budget ₹6,000 → ₹7,500 | pass — row, combined utilisation and remaining total all recalculated (60% → new value) |
| Contribute ₹2,500 to Emergency Fund | pass — 43% → 48%, “Saved this month” ₹8,500 → ₹11,000, balance ₹56,036 → ₹53,536 |
| Refresh page | pass — budget edit, goal amount and Simple Mode all persisted |
| Mark overdue Gym Membership paid | pass — Overdue section removed, badge → “Nothing overdue” |
| Transaction search “zomato” | pass — 2 results; nonsense query shows empty state + Reset filters |
| Expand flagged transaction | pass — illustrative risk note shown |
| Assistant “How can I save ₹5,000 this month?” | pass — plan uses live ₹8,441 budget headroom |
| Simple Mode toggle | pass — `data-simple=true`, 18px base, plain-English copy |
| Safety Center scenario | pass — Neo Tech Store ₹8,999, 1:12 am, 4 triggers, disclaimer present |
| Notification panel | pass — safety, overdue bill and budget warnings |
| Reset demo data | pass — Food back to ₹6,000, Emergency Fund back to ₹21,500, Simple Mode off |
| Mobile 390×844 | pass — bottom nav, hamburger, no horizontal overflow |

### 3.5 Cross-surface consistency verified

After the budget edit and goal contribution, the dashboard, assistant and notification panel all reported the *same* ₹8,441 remaining budget and ₹53,536 balance — confirming that every screen reads from `selectors.ts`.

## 4. Known limitations

- **Assistant is rule-based, not an LLM.** It answers ~12 intents precisely and says so honestly otherwise. No API key is needed, so the demo never fails offline.
- **Fraud rules are intentionally simple.** They are a teaching device: deterministic, explainable, and explicitly labelled illustrative. They are not accurate or safe enough to be used for real fraud decisions.
- **Seed dates are relative to first launch.** The dataset is generated from “today”, so it always looks current; it does not shift day by day while the app is stored.
- **No real payment, notification, SMS or email.** Marking a bill paid only changes local state.
- **Bundle is ~216 kB gzipped** (Recharts). Fine for a prototype; code-splitting the chart views would be the next optimisation.
- **Not tested on real touch devices** — verified via Chromium emulation at 390×844 only.
- **Accessibility is practical, not audited:** focus rings, labels, `role="dialog"`, `aria-current`, progressbar semantics and reduced-motion support are present, but no formal WCAG audit or screen-reader pass was run.

## 5. Live demo sequence (≈3 minutes)

1. `npm install && npm run dev` → http://localhost:5173/
2. **Overview** — “Your money, made easier to understand.” Four cards, insight text, charts. Open the notification bell.
3. **Transactions** — search “zomato”; expand **Neo Tech Store** (₹8,999, 1:12 am) to show the flag.
4. **Budgets** — change **Food** from ₹6,000 to ₹7,500; utilisation and remaining totals update live.
5. **Savings Goals** — add ₹2,500 to **Emergency Fund**; progress, saved-this-month and balance all move.
6. **Bills & Reminders** — mark the overdue **Gym Membership** paid; Overdue section disappears.
7. **Safety Center** — the guided high-priority scenario, three rules, recommended safe action, checklist.
8. **AI Assistant** — “How can I save ₹5,000 this month?” → a plan built from the numbers just changed.
9. **Settings** — toggle **Simple Mode**, then **Reset demo data** to restore the original story.

## 6. Features that remain incomplete / out of scope

- No real account linking, payments, UPI, bank APIs or Paytm integration (by design).
- No cloud AI, voice input, or multi-language UI (Hindi copy is not wired up).
- No multi-user accounts or server sync — LocalStorage only.
- Transactions are seeded, not user-editable (there is no “add transaction” form; budgets, goals and bills are fully editable).
- No push/SMS/email reminders — the in-app notification panel is the only alerting.
- No formal accessibility audit or automated end-to-end suite (Playwright CLI was used for manual scripted smoke checks rather than a committed test suite).

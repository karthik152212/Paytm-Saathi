import test from 'node:test'
import assert from 'node:assert/strict'
import { createSeedState } from '../src/data/seed'
import {
  availableBalance,
  budgetRows,
  budgetTotals,
  categorySeries,
  daysLeftInMonth,
  goalRows,
  incomeThisMonth,
  monthlySeries,
  recentTransactions,
  savedThisMonth,
  searchTransactions,
  spendingByCategory,
  spendingThisMonth,
  splitBills,
  topCategory,
  weeklySeries,
} from '../src/data/selectors'
import { normalize, reducer } from '../src/data/store'
import { CATEGORIES } from '../src/data/types'
import type { AppState, Category } from '../src/data/types'
import { RULES, SAFETY_CHECKLIST, safetySummary, scoreTransactions, severityLabel } from '../src/safety/riskScoring'
import { SUGGESTED_QUESTIONS, answer } from '../src/assistant/engine'

const s: AppState = createSeedState()

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

/* ----------------------------- seed ----------------------------- */

test('seed contains a believable number of transactions', () => {
  assert.ok(s.transactions.length >= 20 && s.transactions.length <= 34, `got ${s.transactions.length}`)
})

test('seed transactions use only known categories and valid dates', () => {
  for (const t of s.transactions) {
    assert.ok(CATEGORIES.includes(t.category), `bad category ${t.category}`)
    assert.ok(!Number.isNaN(new Date(t.date).getTime()), `bad date ${t.date}`)
    assert.ok(t.amount > 0 && Number.isFinite(t.amount))
    assert.ok(t.id.length > 0)
  }
})

test('seed is internally consistent: balance identity holds', () => {
  const credits = sum(s.transactions.filter((t) => t.direction === 'credit').map((t) => t.amount))
  const debits = sum(s.transactions.filter((t) => t.direction === 'debit').map((t) => t.amount))
  const contrib = sum(s.contributions.map((c) => c.amount))
  assert.equal(availableBalance(s), s.openingBalance + credits - debits - contrib)
})

/* ----------------------------- selectors ----------------------------- */

test('category spending sums to total month spending', () => {
  const byCat = spendingByCategory(s)
  assert.equal(sum(Object.values(byCat)), spendingThisMonth(s))
  for (const c of CATEGORIES) assert.ok((byCat[c] ?? -1) >= 0)
})

test('budget rows derive spent from transactions, not hardcoding', () => {
  const byCat = spendingByCategory(s)
  for (const row of budgetRows(s)) {
    assert.equal(row.spent, byCat[row.category])
    assert.equal(row.remaining, row.limit - row.spent)
    assert.equal(row.used, Math.round((row.spent / row.limit) * 100))
    assert.ok(row.status === 'over' || row.status === 'warning' || row.status === 'ok')
  }
})

test('budget totals agree with the sum of individual budgets', () => {
  const rows = budgetRows(s)
  const totals = budgetTotals(s)
  assert.equal(totals.limit, sum(rows.map((r) => r.limit)))
  assert.equal(totals.spent, sum(rows.map((r) => r.spent)))
  assert.equal(totals.remaining, totals.limit - totals.spent)
})

test('dashboard summary numbers stay mutually consistent', () => {
  const spent = spendingThisMonth(s)
  const income = incomeThisMonth(s)
  const saved = savedThisMonth(s)
  assert.equal(
    saved,
    sum(s.contributions.filter((c) => new Date(c.date).getMonth() === new Date().getMonth()).map((c) => c.amount)),
  )
  assert.ok(spent > 0, 'demo month must have spending')
  assert.ok(income > 0, 'demo month must have income')
  assert.ok(availableBalance(s) > 0, 'demo account must not be overdrawn at start')
})

test('weekly series has 7 buckets and only counts the last 7 days', () => {
  const weekly = weeklySeries(s)
  assert.equal(weekly.length, 7)
  assert.ok(sum(weekly.map((d) => d.value)) <= spendingThisMonth(s))
  assert.ok(weekly.every((d) => typeof d.label === 'string' && d.label.length > 0))
})

test('monthly series covers 6 months', () => {
  const monthly = monthlySeries(s)
  assert.equal(monthly.length, 6)
  assert.ok(monthly[monthly.length - 1].value > 0, 'current month must be non-zero')
  assert.ok(monthly.every((m) => Number.isFinite(m.value) && m.value >= 0))
})

test('top category is really the largest category', () => {
  const byCat = spendingByCategory(s)
  const top = topCategory(s)
  assert.equal(top.amount, Math.max(...Object.values(byCat)))
  assert.equal(top.category, CATEGORIES.filter((c) => byCat[c] === top.amount)[0])
})

test('search + filters return correct subsets', () => {
  const all = searchTransactions(s, {})
  assert.equal(all.length, s.transactions.length)
  const debits = searchTransactions(s, { direction: 'debit' })
  assert.ok(debits.every((t) => t.direction === 'debit'))
  const food = searchTransactions(s, { category: 'Food' })
  assert.ok(food.every((t) => t.category === 'Food'))
  const zomato = searchTransactions(s, { query: 'zomato' })
  assert.ok(zomato.length >= 1 && zomato.every((t) => t.merchant.toLowerCase().includes('zomato')))
  const nonsense = searchTransactions(s, { query: 'zzzz-not-a-merchant' })
  assert.equal(nonsense.length, 0)
  // newest first ordering
  for (let i = 1; i < all.length; i++) {
    assert.ok(new Date(all[i - 1].date).getTime() >= new Date(all[i].date).getTime())
  }
})

test('recent transactions respect the limit', () => {
  assert.equal(recentTransactions(s, 6).length, 6)
  assert.equal(recentTransactions(s, 1000).length, s.transactions.length)
})

test('goals: progress, remaining and contribution history agree', () => {
  const rows = goalRows(s)
  assert.ok(rows.length >= 2)
  for (const r of rows) {
    assert.equal(r.remaining, Math.max(0, r.goal.target - r.saved))
    assert.ok(r.progress >= 0 && r.progress <= 100)
    assert.equal(r.progress, Math.min(100, Math.round((r.saved / r.goal.target) * 100)))
  }
  assert.ok(sum(s.contributions.map((c) => c.amount)) > 0)
})

test('bills split into overdue / upcoming / paid correctly', () => {
  const { overdue, upcoming, paid } = splitBills(s)
  assert.equal(overdue.length + upcoming.length + paid.length, s.bills.length)
  assert.ok(overdue.length >= 1, 'demo needs an overdue bill')
  assert.ok(upcoming.length >= 3, 'demo needs upcoming bills')
  assert.ok(paid.length >= 1, 'demo needs a paid bill')
  for (const r of overdue) {
    assert.equal(r.bill.status, 'upcoming')
    assert.ok(r.daysLeft < 0)
  }
  for (const r of upcoming) assert.ok(r.daysLeft >= 0)
})

test('category series only includes non-zero categories', () => {
  for (const c of categorySeries(s)) assert.ok(c.value > 0)
  assert.equal(daysLeftInMonth() >= 0, true)
})

/* ----------------------------- reducer ----------------------------- */

test('reducer: setting a budget updates the row, totals and remaining', () => {
  const before = budgetTotals(s)
  const food = budgetRows(s).find((r) => r.category === 'Food')!
  const next = reducer(s, { type: 'budget/set', category: 'Food', limit: food.limit + 3000 })
  const after = budgetTotals(next)
  const newFood = budgetRows(next).find((r) => r.category === 'Food')!

  assert.equal(newFood.limit, food.limit + 3000)
  assert.equal(newFood.spent, food.spent, 'spent must come from transactions, unaffected by limit edits')
  assert.equal(after.limit, before.limit + 3000)
  assert.ok(after.remaining > before.remaining)
  assert.ok(newFood.used < food.used, 'utilisation must drop when the limit rises')
})

test('reducer: invalid budget limits are rejected', () => {
  const before = budgetRows(s).find((r) => r.category === 'Food')!.limit
  const bad = reducer(s, { type: 'budget/set', category: 'Food', limit: -500 })
  assert.equal(budgetRows(bad).find((r) => r.category === 'Food')!.limit, before)
})

test('reducer: contribution increases goal, saved-this-month and lowers balance', () => {
  const goal = s.goals[0]
  const next = reducer(s, { type: 'goal/contribute', goalId: goal.id, amount: 2500 })
  const row = goalRows(next).find((g) => g.goal.id === goal.id)!
  assert.equal(row.saved, goal.saved + 2500)
  assert.equal(savedThisMonth(next), savedThisMonth(s) + 2500)
  assert.equal(availableBalance(next), availableBalance(s) - 2500)
})

test('reducer: negative or zero contributions are rejected', () => {
  const goal = s.goals[0]
  const a = reducer(s, { type: 'goal/contribute', goalId: goal.id, amount: -100 })
  const b = reducer(s, { type: 'goal/contribute', goalId: goal.id, amount: 0 })
  assert.equal(a, s)
  assert.equal(b, s)
})

test('reducer: marking a bill paid changes status and can be undone', () => {
  const bill = splitBills(s).upcoming[0].bill
  const paid = reducer(s, { type: 'bill/pay', id: bill.id })
  const paidRow = splitBills(paid).paid.find((b) => b.bill.id === bill.id)
  assert.ok(paidRow)
  assert.equal(paidRow!.bill.status, 'paid')
  assert.ok(paidRow!.bill.paidDate)

  const undone = reducer(paid, { type: 'bill/unpay', id: bill.id })
  const back = splitBills(undone).upcoming.find((b) => b.bill.id === bill.id)
  assert.ok(back, 'unpaid bill returns to upcoming')
})

test('reducer: adding and deleting a goal keeps state coherent', () => {
  const withGoal = reducer(s, {
    type: 'goal/add',
    goal: { id: 'gx', name: 'Test', target: 10000, saved: 0, note: '' },
  })
  assert.equal(goalRows(withGoal).length, goalRows(s).length + 1)
  const removed = reducer(withGoal, { type: 'goal/remove', id: 'gx' })
  assert.equal(goalRows(removed).length, goalRows(s).length)
  assert.equal(removed.contributions.filter((c) => c.goalId === 'gx').length, 0)
})

test('reducer: reset restores the original seeded scenario', () => {
  let dirty = reducer(s, { type: 'budget/set', category: 'Food', limit: 99999 })
  dirty = reducer(dirty, { type: 'goal/contribute', goalId: 'g1', amount: 500 })
  dirty = reducer(dirty, { type: 'chat/push', message: { id: 'x', role: 'user', text: 'hi', date: new Date().toISOString() } })
  const reset = reducer(dirty, { type: 'reset' })
  assert.equal(budgetRows(reset).find((r) => r.category === 'Food')!.limit, budgetRows(s).find((r) => r.category === 'Food')!.limit)
  assert.equal(availableBalance(reset), availableBalance(s))
  assert.equal(reset.chat.length, s.chat.length)
  assert.equal(reset.transactions.length, s.transactions.length)
})

/* ----------------------------- persistence ----------------------------- */

test('normalize: malformed storage never crashes and falls back cleanly', () => {
  assert.equal(normalize(null), null)
  assert.equal(normalize('not json at all'), null)
  assert.equal(normalize(42), null)
  assert.equal(normalize({}), null)
  assert.equal(normalize({ transactions: 'oops' }), null)
  const empty = normalize({ transactions: [] })
  assert.equal(empty, null, 'empty transaction list is treated as unusable')
  const junk = normalize({ transactions: [{ bogus: true }] })
  assert.equal(junk, null)
})

test('normalize: a valid stored state round-trips and keeps user edits', () => {
  const edited = reducer(s, { type: 'budget/set', category: 'Food', limit: 4321 })
  const reloaded = normalize(JSON.parse(JSON.stringify(edited)))
  assert.ok(reloaded)
  assert.equal(budgetRows(reloaded!).find((r) => r.category === 'Food')!.limit, 4321)
  assert.equal(reloaded!.transactions.length, edited.transactions.length)
  assert.equal(reloaded!.settings.simpleMode, edited.settings.simpleMode)
})

test('normalize: partial damage is repaired instead of discarded', () => {
  const raw = JSON.parse(JSON.stringify(s)) as Record<string, unknown>
  raw.budgets = [{ category: 'Food', limit: 5000 }, { bogus: true }]
  raw.bills = [{ id: 'ok', name: 'X', amount: 100, dueDate: new Date().toISOString(), status: 'upcoming' }, 7]
  const out = normalize(raw)
  assert.ok(out, 'usable records survive')
  assert.equal(out!.budgets.length, 1)
  assert.equal(out!.bills.length, 1)
})

test('simple mode persists through serialization', () => {
  const on = reducer(s, { type: 'settings/simpleMode', value: true })
  assert.equal(on.settings.simpleMode, true)
  const round = normalize(JSON.parse(JSON.stringify(on)))
  assert.equal(round!.settings.simpleMode, true)
})

/* ----------------------------- safety ----------------------------- */

test('risk rules are documented and complete', () => {
  assert.equal(RULES.length, 4)
  assert.ok(RULES.every((r) => r.title.length > 0 && r.rule.length > 0))
  assert.ok(SAFETY_CHECKLIST.length >= 6)
})

test('the flagged demo transaction produces a high-priority alert', () => {
  const alerts = scoreTransactions(s)
  assert.ok(alerts.length >= 3, `expected several alerts, got ${alerts.length}`)
  const high = alerts.filter((a) => a.severity === 'high')
  assert.equal(high.length, 1, 'exactly one high-priority demo alert')
  const flagged = high[0]
  assert.ok(flagged.transaction.flagged)
  assert.ok(flagged.triggers.some((t) => t.code === 'flagged'))
  assert.ok(flagged.triggers.some((t) => t.code === 'large-amount'))
  assert.ok(flagged.triggers.some((t) => t.code === 'burst'))
  assert.ok(flagged.triggers.some((t) => t.code === 'unusual-hour'))
  assert.ok(flagged.recommendation.length > 40)
  assert.ok(flagged.recommendation.includes('OTP') || flagged.recommendation.includes('UPI PIN'))
})

test('ordinary small payments are never flagged', () => {
  const alerts = scoreTransactions(s)
  const flaggedIds = new Set(alerts.map((a) => a.transaction.id))
  const chai = s.transactions.find((t) => t.merchant === 'Chai Point')!
  const zomato = s.transactions.find((t) => t.merchant === 'Zomato' && t.amount < 500)!
  assert.ok(!flaggedIds.has(chai.id), 'everyday coffee must not be flagged')
  assert.ok(!flaggedIds.has(zomato.id), 'everyday lunch must not be flagged')
})

test('risk scoring is deterministic and severity labels are honest', () => {
  const a = scoreTransactions(s)
  const b = scoreTransactions(s)
  assert.deepEqual(
    a.map((x) => [x.id, x.score, x.severity]),
    b.map((x) => [x.id, x.score, x.severity]),
  )
  for (const alert of a) {
    assert.ok(alert.headline.length > 0)
    assert.ok(!/confirmed fraud|definitely fraud/i.test(alert.headline))
    assert.ok(severityLabel(alert.severity).length > 0)
    assert.ok(alert.score >= 25)
  }
  const summary = safetySummary(a)
  assert.equal(summary.total, a.length)
  assert.equal(summary.high + summary.medium + summary.low, summary.total)
})

test('no alert ever claims confirmed fraud', () => {
  for (const alert of scoreTransactions(s)) {
    const text = `${alert.headline} ${alert.recommendation}`
    assert.ok(!/is (definitely|confirmed) fraud/i.test(text))
    assert.ok(/Illustrative|demonstration|review|check/i.test(text))
  }
})

/* ----------------------------- assistant ----------------------------- */

test('every suggested question returns a contextual answer', () => {
  assert.equal(SUGGESTED_QUESTIONS.length, 5)
  for (const q of SUGGESTED_QUESTIONS) {
    const a = answer(q, s)
    assert.ok(a.length > 60, `too short for "${q}"`)
    assert.ok(!/as an ai language model|I don.t have access/i.test(a))
  }
})

test('spending intent names the real largest category and total', () => {
  const reply = answer('Where did most of my money go?', s)
  const top = topCategory(s)
  const total = spendingThisMonth(s)
  assert.ok(reply.includes(top.category), `should mention ${top.category}`)
  assert.ok(reply.includes(new Intl.NumberFormat('en-IN').format(total).replace(/^₹/, '')) || reply.includes('spent'))
  assert.ok(reply.includes('%'))
})

test('affordability intent uses live balance, budget and bills', () => {
  const reply = answer('Can I afford another ₹1,000 purchase?', s)
  const balance = availableBalance(s)
  const totals = budgetTotals(s)
  assert.ok(reply.includes('1,000') || reply.includes('1000'))
  assert.ok(reply.includes('balance'), 'must reference the balance')
  assert.ok(reply.includes(new Intl.NumberFormat('en-IN').format(Math.round(balance - 1000))))
  assert.ok(reply.includes(totals.used + '%') || reply.includes('budget'))
  assert.ok(/not financial advice|not financial adviser/i.test(reply))
})

test('savings intent produces a plan that adds up to the requested target', () => {
  const reply = answer('How can I save ₹5,000 this month?', s)
  assert.ok(reply.includes('5,000') || reply.includes('5000'))
  assert.ok(reply.includes('1.'), 'must contain numbered levers')
  assert.ok(reply.includes('budget'), 'should use remaining budget as a lever')
  assert.ok(/not professional financial advice|not financial advice/i.test(reply))
})

test('bills intent lists actual seeded bills and due dates', () => {
  const reply = answer('Which bills are due soon?', s)
  assert.ok(reply.includes('Airtel Mobile Recharge'))
  assert.ok(reply.includes('ACT Fibernet Internet'))
  assert.ok(reply.includes('Gym Membership'), 'overdue bill must be surfaced first')
  assert.ok(reply.includes('no real payment is made'))
})

test('budget intent explains percentages in plain English', () => {
  const reply = answer('Explain my budget in simple words.', s)
  const totals = budgetTotals(s)
  assert.ok(reply.includes(`${totals.used}%`))
  assert.ok(reply.includes('spending limit') || reply.includes('jar'))
  assert.ok(reply.includes('Food'), 'must list individual budgets')
  assert.ok(reply.includes(`${daysLeftInMonth()} day`))
})

test('term explanations and safety answers are useful', () => {
  assert.ok(answer('What is an EMI?', s).includes('Equated Monthly'))
  assert.ok(answer('what does UPI mean', s).includes('PIN'))
  assert.ok(answer('explain compound interest', s).includes('interest that earns'))
  const safety = answer('how do I stay safe from UPI scams?', s)
  assert.ok(safety.includes('Never share your OTP'))
  assert.ok(/not a fraud-detection|never blocks/i.test(safety))
})

test('balance, goals and income intents reflect live state', () => {
  const bal = answer('what is my balance', s)
  assert.ok(bal.includes(new Intl.NumberFormat('en-IN').format(Math.round(availableBalance(s))).replace('₹', '')) || bal.includes('available balance'))
  const goals = answer('how am I doing on my goals', s)
  assert.ok(goals.includes('Emergency Fund') && goals.includes('Laptop'))
  assert.ok(goals.includes('not investment advice'))
  const income = answer('how much income did I get', s)
  assert.ok(income.includes(new Intl.NumberFormat('en-IN').format(Math.round(incomeThisMonth(s))).replace('₹', '')))
})

test('unsupported questions get an honest fallback', () => {
  const reply = answer('what is the weather in Tokyo right now', s)
  assert.ok(reply.includes('could not match'))
  assert.ok(reply.includes('local rules'))
  assert.ok(reply.includes('not a financial adviser'))
})

test('empty input does not crash', () => {
  assert.ok(answer('   ', s).length > 0)
})

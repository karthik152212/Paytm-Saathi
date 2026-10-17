import type { AppState, Bill, Budget, Category, SavingsGoal, Transaction } from '../data/types'
import { CATEGORIES } from '../data/types'
import { daysUntil, monthKey, pct } from '../lib/format'

/* ==================================================================
 * selectors.ts — the single source of truth for every financial
 * number shown anywhere in Paytm Saathi.
 *
 * Rule: views never do arithmetic on money. They call these
 * functions so totals, charts, budgets and insights always agree.
 * ================================================================== */

export type BudgetStatus = 'ok' | 'warning' | 'over'

export interface BudgetRow extends Budget {
  spent: number
  remaining: number
  used: number
  status: BudgetStatus
  hasTransactions: boolean
}

export interface GoalRow {
  goal: SavingsGoal
  saved: number
  remaining: number
  progress: number
}

export interface BillRow {
  bill: Bill
  daysLeft: number
  overdue: boolean
}

export interface Insight {
  id: string
  kind: 'info' | 'warn' | 'good' | 'action'
  title: string
  body: string
  action?: string
}

const byDateDesc = (a: Transaction, b: Transaction) =>
  new Date(b.date).getTime() - new Date(a.date).getTime()

const inMonth = (iso: string, ref: Date) => {
  const d = new Date(iso)
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
}

/* ----------------------------- transactions ----------------------------- */

export function allTransactions(s: AppState): Transaction[] {
  return [...s.transactions].sort(byDateDesc)
}

export function searchTransactions(
  s: AppState,
  opts: { query?: string; category?: Category | 'All'; direction?: 'All' | 'debit' | 'credit' } = {},
): Transaction[] {
  const q = (opts.query ?? '').trim().toLowerCase()
  return allTransactions(s).filter((t) => {
    if (opts.category && opts.category !== 'All' && t.category !== opts.category) return false
    if (opts.direction && opts.direction !== 'All' && t.direction !== opts.direction) return false
    if (!q) return true
    return (
      t.merchant.toLowerCase().includes(q) ||
      t.note.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      String(t.amount).includes(q)
    )
  })
}

export function recentTransactions(s: AppState, limit = 6): Transaction[] {
  return allTransactions(s).slice(0, limit)
}

/* ----------------------------- balances ----------------------------- */

export function availableBalance(s: AppState): number {
  let balance = s.openingBalance
  for (const t of s.transactions) {
    balance += t.direction === 'credit' ? t.amount : -t.amount
  }
  for (const c of s.contributions) balance -= c.amount
  return balance
}

export function totalCredits(s: AppState): number {
  return s.transactions.reduce((sum, t) => (t.direction === 'credit' ? sum + t.amount : sum), 0)
}

export function totalDebits(s: AppState): number {
  return s.transactions.reduce((sum, t) => (t.direction === 'debit' ? sum + t.amount : sum), 0)
}

export function spendingThisMonth(s: AppState, ref = new Date()): number {
  return s.transactions.reduce(
    (sum, t) => (t.direction === 'debit' && inMonth(t.date, ref) ? sum + t.amount : sum),
    0,
  )
}

export function incomeThisMonth(s: AppState, ref = new Date()): number {
  return s.transactions.reduce(
    (sum, t) => (t.direction === 'credit' && inMonth(t.date, ref) ? sum + t.amount : sum),
    0,
  )
}

export function savedThisMonth(s: AppState, ref = new Date()): number {
  return s.contributions.reduce((sum, c) => (inMonth(c.date, ref) ? sum + c.amount : sum), 0)
}

export function spendingByCategory(s: AppState, ref = new Date()): Record<Category, number> {
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>
  for (const t of s.transactions) {
    if (t.direction === 'debit' && inMonth(t.date, ref)) out[t.category] += t.amount
  }
  return out
}

export function topCategory(s: AppState, ref = new Date()): { category: Category; amount: number } {
  const byCat = spendingByCategory(s, ref)
  let category: Category = 'Other'
  let amount = 0
  for (const c of CATEGORIES) {
    if (byCat[c] > amount) {
      amount = byCat[c]
      category = c
    }
  }
  return { category, amount }
}

/* ----------------------------- budgets ----------------------------- */

function statusFor(used: number): BudgetStatus {
  if (used > 100) return 'over'
  if (used >= 75) return 'warning'
  return 'ok'
}

export function budgetRows(s: AppState, ref = new Date()): BudgetRow[] {
  const byCat = spendingByCategory(s, ref)
  return s.budgets.map((b) => {
    const spent = byCat[b.category] ?? 0
    const used = pct(spent, b.limit)
    return {
      ...b,
      spent,
      remaining: b.limit - spent,
      used,
      status: statusFor(used),
      hasTransactions: spent > 0,
    }
  })
}

export function budgetTotals(s: AppState, ref = new Date()): {
  limit: number
  spent: number
  remaining: number
  used: number
  status: BudgetStatus
} {
  const rows = budgetRows(s, ref)
  const limit = rows.reduce((sum, r) => sum + r.limit, 0)
  const spent = rows.reduce((sum, r) => sum + r.spent, 0)
  const used = pct(spent, limit)
  return { limit, spent, remaining: limit - spent, used, status: statusFor(used) }
}

export function unbudgetedSpending(s: AppState, ref = new Date()): { amount: number; categories: Category[] } {
  const budgeted = new Set(s.budgets.map((b) => b.category))
  const byCat = spendingByCategory(s, ref)
  const categories = CATEGORIES.filter((c) => !budgeted.has(c) && byCat[c] > 0)
  return {
    amount: categories.reduce((sum, c) => sum + byCat[c], 0),
    categories,
  }
}

/* ----------------------------- savings goals ----------------------------- */

export function goalRows(s: AppState): GoalRow[] {
  return s.goals.map((goal) => {
    const saved = goal.saved
    return {
      goal,
      saved,
      remaining: Math.max(0, goal.target - saved),
      progress: goal.target > 0 ? Math.min(100, Math.round((saved / goal.target) * 100)) : 0,
    }
  })
}

export function contributionsFor(s: AppState, goalId: string) {
  return s.contributions
    .filter((c) => c.goalId === goalId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

/* ----------------------------- bills ----------------------------- */

export function billRows(s: AppState, ref = new Date()): BillRow[] {
  return s.bills
    .map((bill) => {
      const daysLeft = daysUntil(bill.dueDate, ref)
      return { bill, daysLeft, overdue: bill.status === 'upcoming' && daysLeft < 0 }
    })
    .sort((a, b) => {
      if (a.bill.status !== b.bill.status) return a.bill.status === 'upcoming' ? -1 : 1
      return a.daysLeft - b.daysLeft
    })
}

export function splitBills(s: AppState, ref = new Date()) {
  const rows = billRows(s, ref)
  return {
    overdue: rows.filter((r) => r.overdue),
    upcoming: rows.filter((r) => r.bill.status === 'upcoming' && !r.overdue),
    paid: rows.filter((r) => r.bill.status === 'paid'),
  }
}

export function nextBill(s: AppState, ref = new Date()): BillRow | undefined {
  const { overdue, upcoming } = splitBills(s, ref)
  return overdue[0] ?? upcoming[0]
}

export function recurringMonthlyTotal(s: AppState): number {
  return s.bills
    .filter((b) => b.recurring && b.status === 'upcoming')
    .reduce((sum, b) => sum + b.amount, 0)
}

/* ----------------------------- charts ----------------------------- */

export interface DayBar {
  label: string
  full: string
  value: number
}

export function weeklySeries(s: AppState, ref = new Date()): DayBar[] {
  const out: DayBar[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - i)
    const value = s.transactions
      .filter((t) => t.direction === 'debit' && startOf(d) === startOf(new Date(t.date)))
      .reduce((sum, t) => sum + t.amount, 0)
    out.push({
      label: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      full: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      value,
    })
  }
  return out
}

function startOf(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export interface MonthBar {
  key: string
  label: string
  value: number
}

export function monthlySeries(s: AppState, ref = new Date()): MonthBar[] {
  const out: MonthBar[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1)
    const key = monthKey(d)
    const computed = s.transactions
      .filter((t) => t.direction === 'debit' && monthKey(new Date(t.date)) === key)
      .reduce((sum, t) => sum + t.amount, 0)
    const fromHistory = s.history.find((h) => h.month === key)?.spending ?? 0
    out.push({
      key,
      label: d.toLocaleDateString('en-IN', { month: 'short' }),
      value: computed > 0 ? computed : fromHistory,
    })
  }
  return out
}

export function categorySeries(s: AppState, ref = new Date()): { name: Category; value: number }[] {
  const byCat = spendingByCategory(s, ref)
  return CATEGORIES.map((c) => ({ name: c, value: byCat[c] })).filter((d) => d.value > 0)
}

/** Typical (median) debit amount — used by the safety rules. */
export function medianDebitAmount(s: AppState): number {
  const amounts = s.transactions
    .filter((t) => t.direction === 'debit')
    .map((t) => t.amount)
    .sort((a, b) => a - b)
  if (amounts.length === 0) return 0
  const mid = Math.floor(amounts.length / 2)
  return amounts.length % 2 ? amounts[mid] : Math.round((amounts[mid - 1] + amounts[mid]) / 2)
}

/* ----------------------------- narrative helpers ----------------------------- */

export function daysLeftInMonth(ref = new Date()): number {
  const last = new Date(ref.getFullYear(), ref.getMonth() + 1, 0)
  return Math.max(0, last.getDate() - ref.getDate())
}

export function spendingInsight(s: AppState, ref = new Date()): string {
  const spend = spendingThisMonth(s, ref)
  const income = incomeThisMonth(s, ref)
  const { category, amount } = topCategory(s, ref)
  const share = pct(amount, spend)
  const totals = budgetTotals(s, ref)
  const parts: string[] = []

  if (spend === 0) return 'No spending recorded this month yet — your dashboard will fill in as transactions arrive.'

  parts.push(
    `You have spent ${formatAmount(spend)} this month, and ${category} is the biggest part of it at ${share}%.`,
  )
  const flaggedInTop = s.transactions.filter(
    (t) => t.direction === 'debit' && inMonth(t.date, ref) && t.category === category && t.flagged,
  )
  const flaggedTotal = flaggedInTop.reduce((sum, t) => sum + t.amount, 0)
  if (category === 'Other' && flaggedTotal > 0) {
    parts.push(
      `That category includes ${formatAmount(
        flaggedTotal,
      )} of payments flagged in your Safety Center — review them there before you discount the rest.`,
    )
  }
  if (income > 0 && spend < income) {
    parts.push(`You earned ${formatAmount(income)} and kept ${formatAmount(income - spend)} after spending.`)
  }
  if (totals.limit > 0) {
    if (totals.status === 'over') {
      parts.push(`You have passed your combined budget by ${formatAmount(Math.abs(totals.remaining))}.`)
    } else if (totals.status === 'warning') {
      parts.push(
        `You have used ${totals.used}% of your combined budget with ${daysLeftInMonth(ref)} days left in the month.`,
      )
    } else {
      parts.push(
        `${formatAmount(totals.remaining)} of your combined budget is still unspent, with ${daysLeftInMonth(ref)} days to go.`,
      )
    }
  }
  return parts.join(' ')
}

function formatAmount(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
}

export function insights(s: AppState, ref = new Date()): Insight[] {
  const out: Insight[] = []
  const spend = spendingThisMonth(s, ref)
  const totals = budgetTotals(s, ref)
  const { category, amount } = topCategory(s, ref)

  if (spend > 0) {
    out.push({
      id: 'top-category',
      kind: 'info',
      title: `${category} is your largest category`,
      body: `${formatAmount(amount)} — ${pct(amount, spend)}% of everything you spent this month.`,
      action: `Review ${category} transactions`,
    })
  }

  if (totals.limit > 0) {
    out.push(
      totals.status === 'over'
        ? {
            id: 'budget-over',
            kind: 'warn',
            title: 'Budget crossed',
            body: `You have spent ${formatAmount(totals.spent)} against a ${formatAmount(totals.limit)} combined limit. Cut back on non-essentials for the rest of the month.`,
            action: 'Adjust a budget',
          }
        : {
            id: 'budget-usage',
            kind: totals.status === 'warning' ? 'warn' : 'info',
            title: `Budget ${totals.used}% used`,
            body: `${formatAmount(totals.remaining)} left across ${s.budgets.length} budgets, with ${daysLeftInMonth(ref)} days remaining. ${
              totals.status === 'warning'
                ? 'You are spending faster than the month is passing.'
                : 'You are on pace so far.'
            }`,
            action: 'Open budgets',
          },
    )
  }

  const bill = nextBill(s, ref)
  if (bill) {
    out.push({
      id: 'next-bill',
      kind: bill.overdue ? 'warn' : 'info',
      title: bill.overdue ? `${bill.bill.name} is overdue` : `${bill.bill.name} due soon`,
      body: `${formatAmount(bill.bill.amount)} — ${
        bill.overdue
          ? `${Math.abs(bill.daysLeft)} day${Math.abs(bill.daysLeft) === 1 ? '' : 's'} past its due date.`
          : bill.daysLeft === 0
            ? 'due today.'
            : `due in ${bill.daysLeft} day${bill.daysLeft === 1 ? '' : 's'}.`
      }`,
      action: 'Open bills',
    })
  }

  const row = budgetRows(s, ref).find((r) => r.status === 'ok' && r.remaining > 500)
  const saved = savedThisMonth(s, ref)
  if (row && row.remaining > 0) {
    out.push({
      id: 'saving-opportunity',
      kind: 'good',
      title: 'A saving opportunity',
      body: `Your ${row.category} budget still has ${formatAmount(
        row.remaining,
      )} unspent. Moving even half of it into a goal would speed up your ${nearestGoalName(s)}. You have set aside ${formatAmount(
        saved,
      )} this month so far.`,
      action: 'Add to a goal',
    })
  }

  out.push({
    id: 'next-action',
    kind: 'action',
    title: 'Your next action',
    body: nextActionText(s, ref),
  })

  return out
}

function nearestGoalName(s: AppState): string {
  const rows = goalRows(s).filter((r) => r.remaining > 0)
  if (rows.length === 0) return 'savings goals'
  const closest = rows.reduce((a, b) => (a.progress >= b.progress ? a : b))
  return closest.goal.name
}

function nextActionText(s: AppState, ref: Date): string {
  const over = budgetRows(s, ref).filter((r) => r.status === 'over')
  const { overdue, upcoming } = splitBills(s, ref)
  const dueSoon = upcoming.filter((r) => r.daysLeft <= 3)

  if (overdue.length > 0) {
    const b = overdue[0].bill
    return `Clear the overdue ${b.name} of ${formatAmount(b.amount)} first, then review your budgets.`
  }
  if (over.length > 0) {
    return `Your ${over[0].category} budget is over by ${formatAmount(
      Math.abs(over[0].remaining),
    )}. Move that amount out of discretionary spending for the rest of the month.`
  }
  if (dueSoon.length > 0) {
    return `Set aside ${formatAmount(
      dueSoon.reduce((sum, r) => sum + r.bill.amount, 0),
    )} for the ${dueSoon.length} bill${dueSoon.length === 1 ? '' : 's'} due in the next three days.`
  }
  const totals = budgetTotals(s, ref)
  if (totals.remaining > 0) {
    return `You still have ${formatAmount(
      totals.remaining,
    )} of budget left — move a part of it into your Emergency Fund before the month ends.`
  }
  return 'Review this month’s spending and set next month’s budgets while the numbers are fresh.'
}

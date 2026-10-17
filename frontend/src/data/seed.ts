import type { AppState, Bill, Budget, ChatMessage, Contribution, SavingsGoal, Transaction } from './types'
import { STATE_VERSION } from './types'

/* ------------------------------------------------------------------ *
 * Deterministic demo seed.
 * Dates are derived from "today" so the prototype always opens on a
 * lively, current-looking state. The seed itself never uses randomness.
 * ------------------------------------------------------------------ */

const now = new Date()
const Y = now.getFullYear()
const M = now.getMonth()
const TODAY = now.getDate()

/** Clamp a future timestamp back into the past so seeded data is never "ahead of now". */
function clamp(iso: string): string {
  const d = new Date(iso)
  if (d.getTime() > now.getTime()) {
    return new Date(now.getTime() - 11 * 60000).toISOString()
  }
  return d.toISOString()
}

/** Date N days ago (within the current month, never before day 1). */
function day(daysAgo: number, h: number, min: number): string {
  const d = Math.max(1, TODAY - daysAgo)
  return clamp(new Date(Y, M, d, h, min, 0, 0).toISOString())
}

/** A fixed day of the previous month. */
function prevMonth(dayOfMonth: number, h: number, min: number): string {
  return new Date(Y, M - 1, dayOfMonth, h, min, 0, 0).toISOString()
}

function monthKey(offset: number): string {
  const d = new Date(Y, M - offset, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

let seq = 0

function txn(t: Omit<Transaction, 'id'>): Transaction {
  seq++
  return { ...t, id: `t${seq}` }
}

const currentMonthTransactions: Transaction[] = [
  txn({ merchant: 'Chai Point', note: 'Morning coffee', amount: 140, direction: 'debit', category: 'Food', date: day(0, 9, 12), method: 'UPI' }),
  txn({ merchant: 'Zomato', note: 'Lunch order', amount: 386, direction: 'debit', category: 'Food', date: day(0, 13, 40), method: 'UPI' }),
  txn({ merchant: 'Saravana Bhavan', note: 'South Indian thali', amount: 320, direction: 'debit', category: 'Food', date: day(1, 11, 5), method: 'UPI' }),
  txn({ merchant: 'Uber', note: 'Ride home', amount: 214, direction: 'debit', category: 'Transport', date: day(1, 20, 15), method: 'UPI' }),
  txn({ merchant: 'Metro Card', note: 'Transit top-up', amount: 500, direction: 'debit', category: 'Transport', date: day(2, 8, 45), method: 'Wallet' }),
  txn({ merchant: 'Blinkit', note: 'Groceries for the week', amount: 659, direction: 'debit', category: 'Food', date: day(2, 19, 10), method: 'UPI' }),
  txn({ merchant: 'Coursera', note: 'Data Structures specialisation', amount: 1499, direction: 'debit', category: 'Education', date: day(3, 10, 30), method: 'Card' }),
  txn({ merchant: 'BookMyShow', note: 'Movie tickets', amount: 480, direction: 'debit', category: 'Other', date: day(3, 14, 0), method: 'UPI' }),
  txn({ merchant: 'Amazon', note: 'Type-C hub and mouse pad', amount: 1749, direction: 'debit', category: 'Shopping', date: day(3, 16, 10), method: 'Card' }),
  // ---- illustrative suspicious cluster (demo scenario) ----
  txn({
    merchant: 'Neo Tech Store',
    note: 'Order #NX-88213',
    amount: 8999,
    direction: 'debit',
    category: 'Other',
    date: day(3, 1, 12),
    method: 'UPI',
    flagged: true,
    flagReason:
      'Demo scenario: the merchant had never appeared before, the payment was unusually large for this account, and it was made at an unusual hour.',
  }),
  txn({ merchant: 'QuickCart Online', note: 'Order #QC-4471', amount: 2499, direction: 'debit', category: 'Other', date: day(3, 1, 19), method: 'UPI' }),
  txn({ merchant: 'SpinWin Rewards', note: 'Prize claim fee', amount: 999, direction: 'debit', category: 'Other', date: day(3, 1, 26), method: 'UPI' }),
  // -----------------------------------------------
  txn({ merchant: 'Rapido', note: 'Bike taxi to campus', amount: 98, direction: 'debit', category: 'Transport', date: day(4, 12, 15), method: 'UPI' }),
  txn({ merchant: 'DMart', note: 'Monthly groceries', amount: 1150, direction: 'debit', category: 'Food', date: day(4, 18, 30), method: 'Card' }),
  txn({ merchant: 'Udemy', note: 'React course', amount: 749, direction: 'debit', category: 'Education', date: day(5, 9, 50), method: 'UPI' }),
  txn({ merchant: 'StreamFlix Premium', note: 'Monthly subscription', amount: 649, direction: 'debit', category: 'Bills', date: day(5, 21, 10), method: 'AutoPay' }),
  txn({ merchant: 'IRCTC', note: 'Train ticket home', amount: 845, direction: 'debit', category: 'Transport', date: day(6, 7, 30), method: 'Net Banking' }),
  txn({ merchant: 'Myntra', note: 'Running shoes', amount: 1299, direction: 'debit', category: 'Shopping', date: day(7, 17, 45), method: 'Card' }),
  txn({ merchant: 'BSES Electricity', note: 'Monthly electricity bill', amount: 1860, direction: 'debit', category: 'Bills', date: day(8, 10, 5), method: 'UPI' }),
  txn({ merchant: 'Zomato', note: 'Late night order', amount: 342, direction: 'debit', category: 'Food', date: day(8, 22, 20), method: 'UPI' }),

  // credits
  txn({ merchant: 'NexCorp Stipend', note: 'Monthly stipend', amount: 36500, direction: 'credit', category: 'Other', date: day(1, 9, 0), method: 'Net Banking' }),
  txn({ merchant: 'Cashback Rewards', note: 'Recharge cashback', amount: 350, direction: 'credit', category: 'Other', date: day(5, 10, 0), method: 'Wallet' }),
  txn({ merchant: 'Rahul Repaid', note: 'Shared dinner split', amount: 850, direction: 'credit', category: 'Other', date: day(6, 15, 10), method: 'UPI' }),
  txn({ merchant: 'Myntra Refund', note: 'Returned jacket', amount: 1200, direction: 'credit', category: 'Shopping', date: day(9, 17, 20), method: 'UPI' }),
]

const previousMonthTransactions: Transaction[] = [
  txn({ merchant: 'College Fee', note: 'Semester fee instalment', amount: 6500, direction: 'debit', category: 'Education', date: prevMonth(5, 11, 0), method: 'Net Banking' }),
  txn({ merchant: 'AirFly Tickets', note: 'Flight home for Diwali', amount: 12400, direction: 'debit', category: 'Transport', date: prevMonth(12, 8, 30), method: 'Card' }),
  txn({ merchant: 'Dominos Pizza', note: 'Family dinner', amount: 549, direction: 'debit', category: 'Food', date: prevMonth(18, 21, 0), method: 'UPI' }),
  txn({ merchant: 'Decathlon', note: 'Badminton racket', amount: 2199, direction: 'debit', category: 'Shopping', date: prevMonth(22, 19, 0), method: 'Card' }),
  txn({ merchant: 'BSES Electricity', note: 'Previous month bill', amount: 1780, direction: 'debit', category: 'Bills', date: prevMonth(25, 10, 15), method: 'UPI' }),
  txn({ merchant: 'NexCorp Stipend', note: 'Monthly stipend', amount: 36500, direction: 'credit', category: 'Other', date: prevMonth(1, 9, 0), method: 'Net Banking' }),
]

const budgets: Budget[] = [
  { category: 'Food', limit: 6000 },
  { category: 'Transport', limit: 3000 },
  { category: 'Shopping', limit: 3400 },
  { category: 'Bills', limit: 4000 },
  { category: 'Education', limit: 3000 },
]

function future(days: number): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days)
  return d.toISOString()
}

function past(days: number): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days)
  return d.toISOString()
}

const goals: SavingsGoal[] = [
  {
    id: 'g1',
    name: 'Emergency Fund',
    target: 50000,
    saved: 21500,
    targetDate: future(120),
    note: 'Three months of basic expenses, kept aside for surprises.',
  },
  {
    id: 'g2',
    name: 'New Laptop',
    target: 75000,
    saved: 32000,
    targetDate: future(150),
    note: 'For final-year projects and placements.',
  },
  {
    id: 'g3',
    name: 'Goa Trip',
    target: 30000,
    saved: 6500,
    targetDate: future(90),
    note: 'December trip with friends.',
  },
]

const contributions: Contribution[] = [
  { id: 'c1', goalId: 'g1', amount: 3000, date: day(4, 19, 30) },
  { id: 'c2', goalId: 'g2', amount: 4000, date: day(6, 20, 15) },
  { id: 'c3', goalId: 'g3', amount: 1500, date: day(2, 18, 0) },
]

const bills: Bill[] = [
  { id: 'b1', name: 'Gym Membership', amount: 1500, dueDate: past(2), status: 'upcoming', recurring: true, category: 'Other' },
  { id: 'b2', name: 'Airtel Mobile Recharge', amount: 299, dueDate: future(2), status: 'upcoming', recurring: true, category: 'Bills' },
  { id: 'b3', name: 'Electricity Bill (BSES)', amount: 1420, dueDate: future(5), status: 'upcoming', recurring: true, category: 'Bills' },
  { id: 'b4', name: 'ACT Fibernet Internet', amount: 1199, dueDate: future(7), status: 'upcoming', recurring: true, category: 'Bills' },
  { id: 'b5', name: 'Semester Exam Form Fee', amount: 1200, dueDate: future(13), status: 'upcoming', recurring: false, category: 'Education' },
  { id: 'b6', name: 'StreamFlix Premium', amount: 649, dueDate: past(3), status: 'paid', recurring: true, category: 'Bills', paidDate: past(3) },
]

const chat: ChatMessage[] = [
  {
    id: 'm1',
    role: 'assistant',
    date: now.toISOString(),
    text:
      "Hi Aarav — I'm your Saathi assistant. I read your demo transactions, budgets, goals and bills, so my answers use your actual numbers.\n\nTry one of the suggested questions below, or ask me in your own words.",
  },
]

export function createSeedState(): AppState {
  seq = 0
  const transactions = [...previousMonthTransactions, ...currentMonthTransactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )

  return {
    version: STATE_VERSION,
    profile: {
      name: 'Aarav Sharma',
      subtitle: 'Student · Demo account',
    },
    openingBalance: 38000,
    transactions,
    budgets,
    goals,
    contributions,
    bills,
    chat,
    settings: { simpleMode: false },
    // Aggregates for months older than the seeded transaction window.
    history: [
      { month: monthKey(5), spending: 22400 },
      { month: monthKey(4), spending: 24800 },
      { month: monthKey(3), spending: 27300 },
      { month: monthKey(2), spending: 25100 },
    ],
  }
}

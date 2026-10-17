/**
 * Paytm Saathi — shared data model.
 * All money values are whole Indian Rupees (number).
 * All dates are ISO strings (local time, serialized).
 */

export type Category = 'Food' | 'Transport' | 'Shopping' | 'Bills' | 'Education' | 'Other'

export const CATEGORIES: Category[] = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Education',
  'Other',
]

export type Direction = 'debit' | 'credit'

export type PaymentMethod = 'UPI' | 'Wallet' | 'Card' | 'Net Banking' | 'AutoPay'

export interface Transaction {
  id: string
  merchant: string
  note: string
  amount: number
  direction: Direction
  category: Category
  date: string
  method: PaymentMethod
  /** Demo-only marker written by the seed data / safety rules. */
  flagged?: boolean
  flagReason?: string
}

export interface Budget {
  category: Category
  limit: number
}

export interface SavingsGoal {
  id: string
  name: string
  target: number
  saved: number
  targetDate?: string
  note: string
}

export interface Contribution {
  id: string
  goalId: string
  amount: number
  date: string
}

export type BillStatus = 'upcoming' | 'paid'

export interface Bill {
  id: string
  name: string
  amount: number
  dueDate: string
  status: BillStatus
  recurring: boolean
  category: Category
  paidDate?: string
}

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: ChatRole
  text: string
  date: string
}

export interface Profile {
  name: string
  subtitle: string
}

export interface Settings {
  simpleMode: boolean
}

export interface AppState {
  version: number
  profile: Profile
  openingBalance: number
  transactions: Transaction[]
  budgets: Budget[]
  goals: SavingsGoal[]
  contributions: Contribution[]
  bills: Bill[]
  chat: ChatMessage[]
  settings: Settings
  /** Historical monthly spending aggregates for months before the seeded window. */
  history: { month: string; spending: number }[]
}

export const STORAGE_KEY = 'paytm-saathi:v1'
export const STATE_VERSION = 1

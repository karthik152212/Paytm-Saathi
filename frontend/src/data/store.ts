import type { AppState, Bill, Budget, Category, ChatMessage, Contribution, SavingsGoal } from './types'
import { CATEGORIES, STATE_VERSION, STORAGE_KEY } from './types'
import { createSeedState } from './seed'

/* ==================================================================
 * store.ts — persistence + reducer.
 * All state changes flow through `reducer`. Every change is written
 * to LocalStorage so a refresh keeps the user's edits.
 * ================================================================== */

export type Action =
  | { type: 'settings/simpleMode'; value: boolean }
  | { type: 'profile/update'; name: string; subtitle?: string }
  | {
      /** Replace server-owned slices with the latest /api/overview payload. */
      type: 'hydrate'
      patch: Pick<
        AppState,
        'profile' | 'openingBalance' | 'transactions' | 'budgets' | 'goals' | 'contributions' | 'bills' | 'history'
      >
    }
  | { type: 'budget/set'; category: Category; limit: number }
  | { type: 'budget/add'; category: Category; limit: number }
  | { type: 'budget/remove'; category: Category }
  | { type: 'goal/add'; goal: SavingsGoal }
  | { type: 'goal/update'; id: string; patch: Partial<SavingsGoal> }
  | { type: 'goal/remove'; id: string }
  | { type: 'goal/contribute'; goalId: string; amount: number }
  | { type: 'bill/add'; bill: Bill }
  | { type: 'bill/update'; id: string; patch: Partial<Bill> }
  | { type: 'bill/remove'; id: string }
  | { type: 'bill/pay'; id: string }
  | { type: 'bill/unpay'; id: string }
  | { type: 'chat/push'; message: ChatMessage }
  | { type: 'chat/clear' }
  | { type: 'reset' }

export function reducer(state: AppState, action: Action): AppState {
  const validLimit = (n: unknown): n is number =>
    typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 10000000

  switch (action.type) {
    case 'hydrate':
      // Server-owned slices are replaced wholesale. Chat and settings stay
      // exactly as they are: they live only in this browser by design.
      return { ...state, ...action.patch }

    case 'settings/simpleMode':
      return { ...state, settings: { ...state.settings, simpleMode: action.value } }

    case 'profile/update':
      return {
        ...state,
        profile: {
          name: action.name.trim() || state.profile.name,
          subtitle: action.subtitle ?? state.profile.subtitle,
        },
      }

    case 'budget/set':
      if (!validLimit(action.limit)) return state
      return {
        ...state,
        budgets: state.budgets.map((b) => (b.category === action.category ? { ...b, limit: action.limit } : b)),
      }

    case 'budget/add':
      if (!validLimit(action.limit)) return state
      if (state.budgets.some((b) => b.category === action.category)) return state
      return { ...state, budgets: [...state.budgets, { category: action.category, limit: action.limit }] }

    case 'budget/remove':
      return { ...state, budgets: state.budgets.filter((b) => b.category !== action.category) }

    case 'goal/add':
      return { ...state, goals: [...state.goals, action.goal] }

    case 'goal/update':
      return {
        ...state,
        goals: state.goals.map((g) => (g.id === action.id ? { ...g, ...action.patch } : g)),
      }

    case 'goal/remove':
      return {
        ...state,
        goals: state.goals.filter((g) => g.id !== action.id),
        contributions: state.contributions.filter((c) => c.goalId !== action.id),
      }

    case 'goal/contribute': {
      if (!Number.isFinite(action.amount) || action.amount <= 0) return state
      const contribution: Contribution = {
        id: `c${Date.now().toString(36)}`,
        goalId: action.goalId,
        amount: action.amount,
        date: new Date().toISOString(),
      }
      return {
        ...state,
        goals: state.goals.map((g) => (g.id === action.goalId ? { ...g, saved: g.saved + action.amount } : g)),
        contributions: [...state.contributions, contribution],
      }
    }

    case 'bill/add':
      return { ...state, bills: [...state.bills, action.bill] }

    case 'bill/update':
      return { ...state, bills: state.bills.map((b) => (b.id === action.id ? { ...b, ...action.patch } : b)) }

    case 'bill/remove':
      return { ...state, bills: state.bills.filter((b) => b.id !== action.id) }

    case 'bill/pay':
      return {
        ...state,
        bills: state.bills.map((b) =>
          b.id === action.id ? { ...b, status: 'paid', paidDate: new Date().toISOString() } : b,
        ),
      }

    case 'bill/unpay':
      return {
        ...state,
        bills: state.bills.map((b) =>
          b.id === action.id ? { ...b, status: 'upcoming', paidDate: undefined } : b,
        ),
      }

    case 'chat/push':
      return { ...state, chat: [...state.chat, action.message] }

    case 'chat/clear':
      return { ...state, chat: createSeedState().chat }

    case 'reset':
      return createSeedState()

    default:
      return state
  }
}

/* ----------------------------- persistence ----------------------------- */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function asTransactions(raw: unknown): AppState['transactions'] {
  if (!Array.isArray(raw)) return []
  return raw.filter((t): t is AppState['transactions'][number] => {
    if (!isRecord(t)) return false
    return (
      typeof t.id === 'string' &&
      typeof t.merchant === 'string' &&
      typeof t.amount === 'number' &&
      Number.isFinite(t.amount) &&
      typeof t.date === 'string' &&
      !Number.isNaN(new Date(t.date).getTime()) &&
      (t.direction === 'debit' || t.direction === 'credit') &&
      CATEGORIES.includes(t.category as Category)
    )
  })
}

function asBudgets(raw: unknown): AppState['budgets'] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((b): b is Budget => {
      if (!isRecord(b)) return false
      return (
        CATEGORIES.includes(b.category as Category) &&
        typeof b.limit === 'number' &&
        Number.isFinite(b.limit) &&
        b.limit >= 0
      )
    })
    .map((b) => ({ category: b.category, limit: b.limit }))
}

function asGoals(raw: unknown): SavingsGoal[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((g): g is SavingsGoal => {
    if (!isRecord(g)) return false
    return (
      typeof g.id === 'string' &&
      typeof g.name === 'string' &&
      typeof g.target === 'number' &&
      Number.isFinite(g.target) &&
      g.target > 0 &&
      typeof g.saved === 'number' &&
      Number.isFinite(g.saved)
    )
  })
}

function asBills(raw: unknown): Bill[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((b): b is Bill => {
    if (!isRecord(b)) return false
    return (
      typeof b.id === 'string' &&
      typeof b.name === 'string' &&
      typeof b.amount === 'number' &&
      Number.isFinite(b.amount) &&
      typeof b.dueDate === 'string' &&
      !Number.isNaN(new Date(b.dueDate).getTime()) &&
      (b.status === 'upcoming' || b.status === 'paid')
    )
  })
}

/** Rebuild a usable state from arbitrary LocalStorage JSON. Never throws. */
export function normalize(raw: unknown): AppState | null {
  if (!isRecord(raw)) return null
  try {
    const seed = createSeedState()
    const transactions = asTransactions(raw.transactions)
    if (transactions.length === 0) return null

    const settings = isRecord(raw.settings) ? raw.settings : {}

    return {
      version: STATE_VERSION,
      profile: isRecord(raw.profile)
        ? {
            name: typeof raw.profile.name === 'string' ? raw.profile.name : seed.profile.name,
            subtitle: typeof raw.profile.subtitle === 'string' ? raw.profile.subtitle : seed.profile.subtitle,
          }
        : seed.profile,
      openingBalance:
        typeof raw.openingBalance === 'number' && Number.isFinite(raw.openingBalance)
          ? raw.openingBalance
          : seed.openingBalance,
      transactions,
      budgets: asBudgets(raw.budgets),
      goals: asGoals(raw.goals),
      contributions: Array.isArray(raw.contributions)
        ? raw.contributions.filter(
            (c): c is Contribution =>
              isRecord(c) &&
              typeof c.id === 'string' &&
              typeof c.goalId === 'string' &&
              typeof c.amount === 'number' &&
              Number.isFinite(c.amount) &&
              c.amount > 0 &&
              typeof c.date === 'string',
          )
        : [],
      bills: asBills(raw.bills),
      chat: Array.isArray(raw.chat)
        ? raw.chat.filter(
            (m): m is ChatMessage =>
              isRecord(m) &&
              typeof m.id === 'string' &&
              (m.role === 'user' || m.role === 'assistant') &&
              typeof m.text === 'string',
          )
        : seed.chat,
      settings: {
        simpleMode: settings.simpleMode === true,
      },
      history: Array.isArray(raw.history)
        ? raw.history.filter(
            (h): h is { month: string; spending: number } =>
              isRecord(h) && typeof h.month === 'string' && typeof h.spending === 'number',
          )
        : seed.history,
    }
  } catch {
    return null
  }
}

export function loadState(): AppState {
  if (typeof window === 'undefined') return createSeedState()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return createSeedState()
    const parsed: unknown = JSON.parse(raw)
    const normalized = normalize(parsed)
    return normalized ?? createSeedState()
  } catch {
    return createSeedState()
  }
}

export function saveState(state: AppState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* storage full or unavailable — the app keeps working in memory */
  }
}

export function clearState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

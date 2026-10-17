/**
 * Maps every state-changing frontend Action to its backend call.
 *
 * Contract: the local reducer runs first (optimistic, keeps the UI instant
 * and keeps working offline); this layer then mirrors the change to FastAPI.
 * On success the context re-hydrates so server-computed values win; on an
 * HTTP error nothing happens (the local state stays); on a network error the
 * context flips to `offline` mode.
 *
 * Actions with no entry here (chat, simple mode) are local-only by design.
 */

import type { Action } from '../data/store'
import type { Bill, SavingsGoal } from '../data/types'
import { DEFAULT_USER_ID, apiDelete, apiGet, apiPatch, apiPost } from './apiClient'
import { budgetIdFor, categoryId, paise, rememberBudgetId } from './mappers'
import type { BudgetDto } from './types'

const USER = () => `user_id=${encodeURIComponent(DEFAULT_USER_ID)}`

async function resolveBudgetId(category: Parameters<typeof categoryId>[0]): Promise<string | null> {
  const cached = budgetIdFor(category)
  if (cached) return cached
  const listing = await apiGet<{ items: BudgetDto[] }>(`/budgets?${USER()}`)
  const found = listing.items.find((b) => b.category_id === categoryId(category))
  if (found) {
    rememberBudgetId(category, found.budget_id)
    return found.budget_id
  }
  return null
}

function budgetCreateBody(category: Parameters<typeof categoryId>[0], limit: number): Record<string, unknown> {
  return { category_id: categoryId(category), monthly_limit_paise: paise(limit) }
}

function goalPatchBody(patch: Partial<SavingsGoal>): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  if (patch.name !== undefined) body.title = patch.name
  if (patch.target !== undefined) body.target_amount_paise = paise(patch.target)
  if (patch.targetDate !== undefined) body.target_date = patch.targetDate ? patch.targetDate.slice(0, 10) : null
  if (patch.note !== undefined) body.note = patch.note
  return body
}

function billPatchBody(patch: Partial<Bill>): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  if (patch.name !== undefined) body.title = patch.name
  if (patch.amount !== undefined) body.amount_paise = paise(patch.amount)
  if (patch.dueDate !== undefined) body.due_date = patch.dueDate.slice(0, 10)
  if (patch.status !== undefined) body.status = patch.status
  if (patch.recurring !== undefined) body.recurring = patch.recurring
  if (patch.category !== undefined) body.category_id = categoryId(patch.category)
  return body
}

function billCreateBody(bill: Bill): Record<string, unknown> {
  return {
    title: bill.name,
    amount_paise: paise(bill.amount),
    due_date: bill.dueDate.slice(0, 10),
    recurring: bill.recurring,
    category_id: categoryId(bill.category),
    status: bill.status,
  }
}

/**
 * Returns an async mutator for actions the backend owns, or `null` when the
 * action is local-only. Mutators are self-contained: they read whatever they
 * need from the API (ids are resolved through the mapper's id cache).
 */
export function mutationFor(action: Action): (() => Promise<void>) | null {
  switch (action.type) {
    case 'profile/update': {
      const body: Record<string, unknown> = { display_name: action.name }
      if (action.subtitle !== undefined) body.subtitle = action.subtitle
      return () => apiPatch(`/users/${DEFAULT_USER_ID}`, body).then(() => undefined)
    }

    case 'budget/set':
      return async () => {
        const id = await resolveBudgetId(action.category)
        if (id) await apiPatch(`/budgets/${id}`, budgetCreateBody(action.category, action.limit))
        else await apiPost('/budgets', budgetCreateBody(action.category, action.limit))
      }

    case 'budget/add':
      return async () => {
        const id = await resolveBudgetId(action.category)
        if (id) await apiPatch(`/budgets/${id}`, budgetCreateBody(action.category, action.limit))
        else await apiPost('/budgets', budgetCreateBody(action.category, action.limit))
      }

    case 'budget/remove':
      return async () => {
        const id = await resolveBudgetId(action.category)
        if (id) await apiDelete(`/budgets/${id}`)
      }

    case 'goal/add':
      return () =>
        apiPost('/goals', {
          title: action.goal.name,
          target_amount_paise: paise(action.goal.target),
          saved_amount_paise: paise(action.goal.saved),
          target_date: action.goal.targetDate ? action.goal.targetDate.slice(0, 10) : null,
          note: action.goal.note || null,
        }).then(() => undefined)

    case 'goal/update':
      return () => apiPatch(`/goals/${action.id}`, goalPatchBody(action.patch)).then(() => undefined)

    case 'goal/remove':
      return () => apiDelete(`/goals/${action.id}`)

    case 'goal/contribute':
      return () =>
        apiPost(`/goals/${action.goalId}/contributions`, { amount_paise: paise(action.amount) }).then(
          () => undefined,
        )

    case 'bill/add':
      return () => apiPost('/bills', billCreateBody(action.bill)).then(() => undefined)

    case 'bill/update':
      return () => apiPatch(`/bills/${action.id}`, billPatchBody(action.patch)).then(() => undefined)

    case 'bill/remove':
      return () => apiDelete(`/bills/${action.id}`)

    case 'bill/pay':
      return () => apiPost(`/bills/${action.id}/mark-paid`).then(() => undefined)

    case 'bill/unpay':
      return () => apiPatch(`/bills/${action.id}`, { status: 'upcoming' }).then(() => undefined)

    case 'reset':
      // Destructive server-side restore; 403 when SAATHI_ALLOW_RESET is off
      // is an HTTP response (backend reachable), so it never flips us offline.
      return () => apiPost('/dev/reseed').then(() => undefined)

    default:
      return null
  }
}

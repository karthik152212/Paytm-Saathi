/**
 * DTO → domain mappers. Pure functions: no fetch, no React.
 *
 * The backend speaks integer paise and snake_case; the frontend domain
 * speaks whole rupees and camelCase. All paise→rupee conversion happens
 * here, in exactly one place, and nowhere else.
 */

import type { AppState, Bill, Budget, Category, Contribution, PaymentMethod, SavingsGoal, Transaction } from '../data/types'
import { CATEGORIES } from '../data/types'
import type { RiskAlert } from '../safety/riskScoring'
import type {
  BillDto,
  BudgetDto,
  ContributionDto,
  GoalDto,
  OverviewDto,
  SafetyAlertDto,
  TransactionDto,
} from './types'

export type HydrationPatch = Pick<
  AppState,
  'profile' | 'openingBalance' | 'transactions' | 'budgets' | 'goals' | 'contributions' | 'bills' | 'history'
>

const METHODS: PaymentMethod[] = ['UPI', 'Wallet', 'Card', 'Net Banking', 'AutoPay']

/** Integer paise → whole/derived rupees (matches the frontend's rupee domain). */
export function rupees(paise: number): number {
  return Math.round(paise) / 100
}

/** Whole rupees → integer paise, the only direction used by mutations. */
export function paise(rupeez: number): number {
  return Math.round(rupeez * 100)
}

/** Frontend category label ('Food') → backend category_id ('food'). */
export function categoryId(label: Category): string {
  return label.toLowerCase()
}

/** Backend category_id → frontend label, validated against CATEGORIES. */
export function categoryLabel(id: string | null | undefined, fallback: string | null = null): Category {
  const raw = fallback ?? id ?? ''
  const match = CATEGORIES.find((c) => c.toLowerCase() === raw.toLowerCase())
  return match ?? 'Other'
}

function method(label: string): PaymentMethod {
  return METHODS.find((m) => m.toLowerCase() === label.toLowerCase()) ?? 'UPI'
}

export function mapTransaction(dto: TransactionDto): Transaction {
  return {
    id: dto.transaction_id,
    merchant: dto.merchant,
    note: dto.description ?? '',
    amount: rupees(dto.amount_paise),
    direction: dto.direction,
    category: categoryLabel(dto.category_id, dto.category_label),
    date: dto.transaction_date,
    method: method(dto.payment_method_label),
    flagged: dto.demo_risk_flag,
    flagReason: dto.demo_flag_reason ?? undefined,
  }
}

export function mapBudget(dto: BudgetDto): Budget {
  return {
    category: categoryLabel(dto.category_id, dto.category_label),
    limit: rupees(dto.monthly_limit_paise),
  }
}

export function mapGoal(dto: GoalDto): SavingsGoal {
  return {
    id: dto.goal_id,
    name: dto.title,
    target: rupees(dto.target_amount_paise),
    saved: rupees(dto.saved_amount_paise),
    targetDate: dto.target_date ?? undefined,
    note: dto.note ?? '',
  }
}

export function mapContribution(dto: ContributionDto): Contribution {
  return {
    id: dto.contribution_id,
    goalId: dto.goal_id,
    amount: rupees(dto.amount_paise),
    date: dto.created_at,
  }
}

export function mapBill(dto: BillDto): Bill {
  return {
    id: dto.bill_id,
    name: dto.title,
    amount: rupees(dto.amount_paise),
    dueDate: dto.due_date,
    status: dto.status,
    recurring: dto.recurring,
    category: categoryLabel(dto.category_id, dto.category_label),
    paidDate: dto.paid_date ?? undefined,
  }
}

/**
 * Convert a full /api/overview payload into the patch the reducer hydrates
 * from. Chat and settings are deliberately NOT included — those stay local.
 */
export function mapOverview(dto: OverviewDto): HydrationPatch {
  rememberBudgetIds(dto.budgets.map((b) => ({ category: categoryLabel(b.category_id, b.category_label), id: b.budget_id })))
  return {
    profile: {
      name: dto.user.display_name,
      subtitle: dto.user.subtitle ?? '',
    },
    openingBalance: rupees(dto.accounts[0]?.opening_balance_paise ?? 0),
    transactions: dto.transactions.map(mapTransaction),
    budgets: dto.budgets.map(mapBudget),
    goals: dto.goals.map(mapGoal),
    contributions: dto.contributions.map(mapContribution),
    bills: dto.bills.map(mapBill),
    history: dto.monthly_history.map((m) => ({ month: m.month, spending: rupees(m.spending_paise) })),
  }
}

/** Join a backend safety alert with the matching frontend transaction. */
export function mapSafetyAlert(dto: SafetyAlertDto, transactions: Transaction[]): RiskAlert | null {
  const transaction = transactions.find((t) => t.id === dto.transaction_id)
  if (!transaction) return null
  return {
    id: dto.alert_id,
    transaction,
    score: dto.score,
    severity: dto.severity,
    triggers: dto.triggers.map((t) => ({ code: t.code, label: t.label, weight: t.weight, explanation: t.explanation })),
    headline: dto.headline,
    recommendation: dto.recommendation,
  }
}

/* ------------------------- id cache for mutations ------------------------- */

const budgetIds = new Map<Category, string>()

function rememberBudgetIds(entries: { category: Category; id: string }[]): void {
  budgetIds.clear()
  for (const entry of entries) budgetIds.set(entry.category, entry.id)
}

export function budgetIdFor(category: Category): string | undefined {
  return budgetIds.get(category)
}

export function rememberBudgetId(category: Category, id: string): void {
  budgetIds.set(category, id)
}

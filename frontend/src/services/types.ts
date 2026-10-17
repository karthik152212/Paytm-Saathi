/**
 * Raw DTOs mirroring the FastAPI backend responses (snake_case).
 * Mappers in `mappers.ts` convert these into the frontend domain types.
 * Money arrives as integer paise plus a derived rupee value.
 */

export interface UserDto {
  user_id: string
  display_name: string
  subtitle: string | null
  demo_email: string
  preferred_language?: string
  accessibility_preferences?: Record<string, unknown>
  is_demo_user: boolean
  created_at?: string | null
}

export interface AccountDto {
  account_id: string
  user_id: string
  account_type?: string
  display_label: string
  opening_balance_paise: number
  balance_paise: number
  account_status?: string
  is_simulated?: boolean
}

export interface CategoryDto {
  category_id: string
  display_label: string
  color_hex: string
  icon?: string
  sort_order?: number
}

export interface TransactionDto {
  transaction_id: string
  account_id: string
  user_id: string
  merchant: string
  amount_paise: number
  amount_rupees: number
  direction: 'debit' | 'credit'
  category_id: string
  category_label: string | null
  transaction_date: string
  payment_method_label: string
  description: string | null
  demo_risk_flag: boolean
  demo_flag_reason: string | null
}

export interface BudgetDto {
  budget_id: string
  user_id: string
  category_id: string
  category_label: string | null
  monthly_limit_paise: number
  monthly_limit_rupees: number
  spent_paise: number
  remaining_paise: number
  used_percent: number
  status: 'ok' | 'warning' | 'over'
  period?: string
}

export interface GoalDto {
  goal_id: string
  user_id: string
  title: string
  target_amount_paise: number
  target_amount_rupees: number
  saved_amount_paise: number
  saved_amount_rupees: number
  remaining_paise: number
  progress_percent: number
  target_date: string | null
  note: string | null
}

export interface ContributionDto {
  contribution_id: string
  goal_id: string
  user_id: string
  amount_paise: number
  amount_rupees: number
  note: string | null
  created_at: string
}

export interface BillDto {
  bill_id: string
  user_id: string
  title: string
  amount_paise: number
  amount_rupees: number
  due_date: string
  status: 'upcoming' | 'paid'
  recurring: boolean
  category_id: string | null
  category_label?: string | null
  paid_date: string | null
  days_left: number
  overdue?: boolean
}

export interface SummaryDto {
  available_balance_paise: number
  opening_balance_paise: number
  spending_this_month_paise: number
  income_this_month_paise: number
  saved_this_month_paise: number
  top_category_id: string | null
  top_category_paise: number
  days_left_in_month: number
}

export interface InsightDto {
  id: string
  kind: 'info' | 'warn' | 'good' | 'action'
  title: string
  body: string
  action: string | null
}

export interface MonthPointDto {
  month: string
  spending_paise: number
}

export interface OverviewDto {
  user: UserDto
  accounts: AccountDto[]
  categories: CategoryDto[]
  transactions: TransactionDto[]
  budgets: BudgetDto[]
  goals: GoalDto[]
  contributions: ContributionDto[]
  bills: BillDto[]
  monthly_history: MonthPointDto[]
  monthly_series: MonthPointDto[]
  summary: SummaryDto
  insight_text: string
  insights: InsightDto[]
  generated_at: string
  disclaimer: string
}

export interface RiskTriggerDto {
  code: 'flagged' | 'large-amount' | 'burst' | 'unusual-hour'
  label: string
  weight: number
  explanation: string
}

export interface SafetyAlertDto {
  alert_id: string
  transaction_id: string
  score: number
  severity: 'high' | 'medium' | 'low'
  severity_label: string
  headline: string
  recommendation: string
  simple_description: string
  triggers: RiskTriggerDto[]
}

export interface SafetyDto {
  user_id: string
  alerts: SafetyAlertDto[]
  summary: {
    high: number
    medium: number
    low: number
    total: number
    last_checked: string
    disclaimer: string
  }
  rules: { code: string; title: string; rule: string; weight: number }[]
  checklist: { id: string; title: string; body: string }[]
}

export interface ChatRequestDto {
  message: string
  user_id: string
}

export interface ChatResponseDto {
  reply: string
  engine: string
  user_id: string
  answered_at: string
}

export interface HealthDto {
  status: string
  seeded: boolean
  default_user_id: string
  record_counts: Record<string, number>
  server_time: string
}

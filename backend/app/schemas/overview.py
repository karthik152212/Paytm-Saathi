from __future__ import annotations

from pydantic import BaseModel

from .accounts import AccountOut
from .bills import BillOut
from .budgets import BudgetOut, BudgetTotalsOut
from .common import rupees  # noqa: F401  (re-exported for API modules)
from .goals import ContributionOut, GoalOut
from .insights import InsightItem
from .transactions import TransactionOut
from .users import UserOut


class CategoryOut(BaseModel):
    category_id: str
    display_label: str
    color_hex: str
    icon: str
    sort_order: int


class SummaryOut(BaseModel):
    available_balance_paise: int
    available_balance_rupees: float
    opening_balance_paise: int
    opening_balance_rupees: float
    total_credits_paise: int
    total_credits_rupees: float
    total_debits_paise: int
    total_debits_rupees: float
    spending_this_month_paise: int
    spending_this_month_rupees: float
    income_this_month_paise: int
    income_this_month_rupees: float
    saved_this_month_paise: int
    saved_this_month_rupees: float
    top_category_id: str | None = None
    top_category_paise: int = 0
    days_left_in_month: int


class MonthPoint(BaseModel):
    month: str
    spending_paise: int
    spending_rupees: float


class DayPoint(BaseModel):
    date: str
    spending_paise: int
    spending_rupees: float


class OverviewResponse(BaseModel):
    """One-shot snapshot the frontend hydrates from."""

    user: UserOut
    accounts: list[AccountOut]
    categories: list[CategoryOut]
    transactions: list[TransactionOut]
    budgets: list[BudgetOut]
    budget_totals: BudgetTotalsOut
    goals: list[GoalOut]
    contributions: list[ContributionOut]
    bills: list[BillOut]
    monthly_history: list[MonthPoint]
    weekly_series: list[DayPoint]
    monthly_series: list[MonthPoint]
    summary: SummaryOut
    insight_text: str
    insights: list[InsightItem]
    generated_at: str
    disclaimer: str = (
        "All balances, transactions and calculations are simulated demonstration data. No bank, wallet or "
        "payment network is connected."
    )

from __future__ import annotations

from pydantic import BaseModel, Field

from .common import iso_datetime, rupees

MAX_LIMIT_PAISE = 1_000_000_000  # ₹1,00,00,000


class BudgetCreate(BaseModel):
    category_id: str = Field(min_length=1, max_length=32)
    monthly_limit_paise: int = Field(gt=0, le=MAX_LIMIT_PAISE)


class BudgetUpdate(BaseModel):
    monthly_limit_paise: int = Field(gt=0, le=MAX_LIMIT_PAISE)


class BudgetOut(BaseModel):
    budget_id: str
    user_id: str
    category_id: str
    category_label: str | None = None
    monthly_limit_paise: int
    monthly_limit_rupees: float
    spent_paise: int
    spent_rupees: float
    remaining_paise: int
    remaining_rupees: float
    used_percent: int
    status: str
    has_transactions: bool
    period: str
    created_at: str | None = None
    updated_at: str | None = None

    @classmethod
    def from_row(cls, row, category_label: str | None = None) -> "BudgetOut":
        budget = row["budget"]
        return cls(
            budget_id=budget.budget_id,
            user_id=budget.user_id,
            category_id=budget.category_id,
            category_label=category_label,
            monthly_limit_paise=budget.monthly_limit_paise,
            monthly_limit_rupees=rupees(budget.monthly_limit_paise),
            spent_paise=row["spent_paise"],
            spent_rupees=rupees(row["spent_paise"]),
            remaining_paise=row["remaining_paise"],
            remaining_rupees=rupees(row["remaining_paise"]),
            used_percent=row["used_percent"],
            status=row["status"],
            has_transactions=row["has_transactions"],
            period=budget.period,
            created_at=iso_datetime(budget.created_at),
            updated_at=iso_datetime(budget.updated_at),
        )


class BudgetTotalsOut(BaseModel):
    limit_paise: int
    limit_rupees: float
    spent_paise: int
    spent_rupees: float
    remaining_paise: int
    remaining_rupees: float
    used_percent: int
    status: str

    @classmethod
    def from_totals(cls, totals: dict) -> "BudgetTotalsOut":
        return cls(
            limit_paise=totals["limit_paise"],
            limit_rupees=rupees(totals["limit_paise"]),
            spent_paise=totals["spent_paise"],
            spent_rupees=rupees(totals["spent_paise"]),
            remaining_paise=totals["remaining_paise"],
            remaining_rupees=rupees(totals["remaining_paise"]),
            used_percent=totals["used_percent"],
            status=totals["status"],
        )


class BudgetListResponse(BaseModel):
    items: list[BudgetOut]
    totals: BudgetTotalsOut
    total_count: int

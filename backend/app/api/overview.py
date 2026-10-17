from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db
from ..repositories import transactions as transactions_repo
from ..schemas.accounts import AccountOut
from ..schemas.bills import BillOut
from ..schemas.budgets import BudgetOut, BudgetTotalsOut
from ..schemas.common import rupees
from ..schemas.goals import ContributionOut, GoalOut
from ..schemas.insights import InsightItem
from ..schemas.overview import CategoryOut, DayPoint, MonthPoint, OverviewResponse, SummaryOut
from ..schemas.transactions import TransactionOut
from ..schemas.users import UserOut
from ..services import finance, insights as insights_service
from .helpers import category_labels, get_user_or_404

router = APIRouter(tags=["general"])


@router.get("/api/overview", response_model=OverviewResponse)
def overview(user_id: str | None = None, db: Session = Depends(get_db)) -> OverviewResponse:
    """One-shot snapshot: everything the frontend needs to hydrate the UI."""
    user = get_user_or_404(db, user_id)
    uid = user.user_id
    now = datetime.now().replace(microsecond=0)
    labels = category_labels(db)

    accounts = db.scalars(select(models.Account).where(models.Account.user_id == uid)).all()
    categories = db.scalars(select(models.Category).order_by(models.Category.sort_order)).all()
    txns = transactions_repo.list_transactions(db, user_id=uid)
    budget_rows = finance.budget_rows(db, uid)
    totals = finance.budget_totals(budget_rows)
    goal_rows = finance.goal_rows(db, uid)
    contributions = db.scalars(
        select(models.GoalContribution).where(models.GoalContribution.user_id == uid).order_by(models.GoalContribution.created_at)
    ).all()
    bill_rows = finance.bill_rows(db, uid)
    history = db.scalars(select(models.MonthlyHistory).order_by(models.MonthlyHistory.month))

    opening = finance.opening_balance_paise(db, uid)
    balance = finance.available_balance_paise(db, uid)
    top_id, top_paise = finance.top_category(db, uid)

    summary = {
        "available_balance_paise": balance,
        "opening_balance_paise": opening,
        "total_credits_paise": finance.total_credits_paise(db, uid),
        "total_debits_paise": finance.total_debits_paise(db, uid),
        "spending_this_month_paise": finance.spending_this_month_paise(db, uid),
        "income_this_month_paise": finance.income_this_month_paise(db, uid),
        "saved_this_month_paise": finance.saved_this_month_paise(db, uid),
        "top_category_id": top_id if top_paise > 0 else None,
        "top_category_paise": top_paise,
        "days_left_in_month": finance.days_left_in_month(),
    }

    return OverviewResponse(
        user=UserOut.from_model(user),
        accounts=[AccountOut.from_model(a, balance) for a in accounts],
        categories=[CategoryOut(**{k: getattr(c, k) for k in ("category_id", "display_label", "color_hex", "icon", "sort_order")}) for c in categories],
        transactions=[TransactionOut.from_model(t, labels.get(t.category_id)) for t in txns],
        budgets=[BudgetOut.from_row(r, labels.get(r["budget"].category_id)) for r in budget_rows],
        budget_totals=BudgetTotalsOut.from_totals(totals),
        goals=[GoalOut.from_row(r) for r in goal_rows],
        contributions=[ContributionOut.from_model(c) for c in contributions],
        bills=[BillOut.from_row(r) for r in bill_rows],
        monthly_history=[
            MonthPoint(month=h.month, spending_paise=h.spending_paise, spending_rupees=rupees(h.spending_paise))
            for h in history
        ],
        weekly_series=[
            DayPoint(date=p["date"], spending_paise=p["spending_paise"], spending_rupees=rupees(p["spending_paise"]))
            for p in finance.weekly_series(db, uid)
        ],
        monthly_series=[
            MonthPoint(month=p["month"], spending_paise=p["spending_paise"], spending_rupees=rupees(p["spending_paise"]))
            for p in finance.monthly_series(db, uid)
        ],
        summary=SummaryOut(
            available_balance_paise=balance,
            available_balance_rupees=rupees(balance),
            opening_balance_paise=opening,
            opening_balance_rupees=rupees(opening),
            total_credits_paise=summary["total_credits_paise"],
            total_credits_rupees=rupees(summary["total_credits_paise"]),
            total_debits_paise=summary["total_debits_paise"],
            total_debits_rupees=rupees(summary["total_debits_paise"]),
            spending_this_month_paise=summary["spending_this_month_paise"],
            spending_this_month_rupees=rupees(summary["spending_this_month_paise"]),
            income_this_month_paise=summary["income_this_month_paise"],
            income_this_month_rupees=rupees(summary["income_this_month_paise"]),
            saved_this_month_paise=summary["saved_this_month_paise"],
            saved_this_month_rupees=rupees(summary["saved_this_month_paise"]),
            top_category_id=summary["top_category_id"],
            top_category_paise=summary["top_category_paise"],
            days_left_in_month=summary["days_left_in_month"],
        ),
        insight_text=insights_service.spending_insight_text(db, uid),
        insights=[InsightItem(**item) for item in insights_service.build_insights(db, uid)],
        generated_at=now.isoformat(),
    )

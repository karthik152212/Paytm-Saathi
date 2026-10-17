"""Every authoritative financial calculation lives here.

The dashboard, insights, safety scoring and the assistant all call these
functions, so two screens can never disagree about a rupee figure.

Money unit: integer paise. `*_rupees` conversions happen only at the API edge
(in the pydantic schemas) — never inside the maths.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models

# ----------------------------- small helpers -----------------------------


def pct(part: int, whole: int) -> int:
    if whole <= 0:
        return 0
    return round((part / whole) * 100)


def month_key(value: datetime | date) -> str:
    return f"{value.year:04d}-{value.month:02d}"


def in_month(value: datetime, ref: datetime) -> bool:
    return value.year == ref.year and value.month == ref.month


def days_until(due: date, ref: date | None = None) -> int:
    return (due - (ref or date.today())).days


def days_left_in_month(ref: datetime | None = None) -> int:
    ref = ref or datetime.now()
    last = (ref.replace(day=1) + timedelta(days=32)).replace(day=1) - timedelta(days=1)
    return max(0, last.day - ref.day)


def status_for(used: int) -> str:
    if used > 100:
        return "over"
    if used >= 75:
        return "warning"
    return "ok"


# ----------------------------- balance -----------------------------------


def opening_balance_paise(db: Session, user_id: str) -> int:
    accounts = db.scalars(select(models.Account).where(models.Account.user_id == user_id)).all()
    return sum(a.opening_balance_paise for a in accounts)


def total_credits_paise(db: Session, user_id: str) -> int:
    txns = db.scalars(select(models.Transaction).where(models.Transaction.user_id == user_id)).all()
    return sum(t.amount_paise for t in txns if t.direction == "credit")


def total_debits_paise(db: Session, user_id: str) -> int:
    txns = db.scalars(select(models.Transaction).where(models.Transaction.user_id == user_id)).all()
    return sum(t.amount_paise for t in txns if t.direction == "debit")


def total_contributions_paise(db: Session, user_id: str) -> int:
    rows = db.scalars(select(models.GoalContribution).where(models.GoalContribution.user_id == user_id)).all()
    return sum(c.amount_paise for c in rows)


def available_balance_paise(db: Session, user_id: str) -> int:
    """Balance formula (documented in docs/ARCHITECTURE.md):

    balance = Σ opening balances
            + Σ credits
            − Σ debits
            − Σ savings-goal contributions
    """
    return (
        opening_balance_paise(db, user_id)
        + total_credits_paise(db, user_id)
        - total_debits_paise(db, user_id)
        - total_contributions_paise(db, user_id)
    )


# ----------------------------- monthly aggregates ------------------------


def spending_this_month_paise(db: Session, user_id: str, ref: datetime | None = None) -> int:
    ref = ref or datetime.now()
    txns = db.scalars(select(models.Transaction).where(models.Transaction.user_id == user_id)).all()
    return sum(t.amount_paise for t in txns if t.direction == "debit" and in_month(t.transaction_date, ref))


def income_this_month_paise(db: Session, user_id: str, ref: datetime | None = None) -> int:
    ref = ref or datetime.now()
    txns = db.scalars(select(models.Transaction).where(models.Transaction.user_id == user_id)).all()
    return sum(t.amount_paise for t in txns if t.direction == "credit" and in_month(t.transaction_date, ref))


def saved_this_month_paise(db: Session, user_id: str, ref: datetime | None = None) -> int:
    ref = ref or datetime.now()
    rows = db.scalars(select(models.GoalContribution).where(models.GoalContribution.user_id == user_id)).all()
    return sum(c.amount_paise for c in rows if in_month(c.created_at, ref))


def spending_by_category_paise(db: Session, user_id: str, ref: datetime | None = None) -> dict[str, int]:
    ref = ref or datetime.now()
    out: dict[str, int] = {}
    txns = db.scalars(select(models.Transaction).where(models.Transaction.user_id == user_id)).all()
    for t in txns:
        if t.direction == "debit" and in_month(t.transaction_date, ref):
            out[t.category_id] = out.get(t.category_id, 0) + t.amount_paise
    return out


def top_category(db: Session, user_id: str, ref: datetime | None = None) -> tuple[str, int]:
    by_cat = spending_by_category_paise(db, user_id, ref)
    if not by_cat:
        return ("other", 0)
    category = max(by_cat.items(), key=lambda item: item[1])
    return (category[0], category[1])


def median_debit_paise(db: Session, user_id: str) -> int:
    amounts = sorted(
        t.amount_paise
        for t in db.scalars(select(models.Transaction).where(models.Transaction.user_id == user_id))
        if t.direction == "debit"
    )
    if not amounts:
        return 0
    mid = len(amounts) // 2
    if len(amounts) % 2:
        return amounts[mid]
    return round((amounts[mid - 1] + amounts[mid]) / 2)


# ----------------------------- budgets -----------------------------------


def budget_rows(db: Session, user_id: str, ref: datetime | None = None) -> list[dict]:
    ref = ref or datetime.now()
    by_cat = spending_by_category_paise(db, user_id, ref)
    rows = []
    for budget in db.scalars(
        select(models.Budget).where(models.Budget.user_id == user_id).order_by(models.Budget.budget_id)
    ):
        spent = by_cat.get(budget.category_id, 0)
        used = pct(spent, budget.monthly_limit_paise)
        rows.append(
            {
                "budget": budget,
                "spent_paise": spent,
                "remaining_paise": budget.monthly_limit_paise - spent,
                "used_percent": used,
                "status": status_for(used),
                "has_transactions": spent > 0,
            }
        )
    return rows


def budget_totals(rows: list[dict]) -> dict:
    limit = sum(r["budget"].monthly_limit_paise for r in rows)
    spent = sum(r["spent_paise"] for r in rows)
    used = pct(spent, limit)
    return {
        "limit_paise": limit,
        "spent_paise": spent,
        "remaining_paise": limit - spent,
        "used_percent": used,
        "status": status_for(used),
    }


# ----------------------------- goals -------------------------------------


def goal_rows(db: Session, user_id: str) -> list[dict]:
    rows = []
    for goal in db.scalars(
        select(models.SavingsGoal).where(models.SavingsGoal.user_id == user_id).order_by(models.SavingsGoal.goal_id)
    ):
        saved = goal.saved_amount_paise
        remaining = max(0, goal.target_amount_paise - saved)
        progress = pct(saved, goal.target_amount_paise) if goal.target_amount_paise > 0 else 0
        rows.append(
            {
                "goal": goal,
                "saved_paise": saved,
                "remaining_paise": remaining,
                "progress_percent": min(100, progress),
            }
        )
    return rows


# ----------------------------- bills -------------------------------------


def bill_rows(db: Session, user_id: str, ref: date | None = None) -> list[dict]:
    ref = ref or date.today()
    rows = []
    for bill in db.scalars(
        select(models.Bill).where(models.Bill.user_id == user_id).order_by(models.Bill.due_date, models.Bill.bill_id)
    ):
        days_left = days_until(bill.due_date, ref)
        rows.append(
            {
                "bill": bill,
                "days_left": days_left,
                "overdue": bill.status == "upcoming" and days_left < 0,
            }
        )
    rows.sort(key=lambda r: (0 if r["bill"].status == "upcoming" else 1, r["days_left"]))
    return rows


def split_bills(rows: list[dict]) -> dict[str, list[dict]]:
    return {
        "overdue": [r for r in rows if r["overdue"]],
        "upcoming": [r for r in rows if r["bill"].status == "upcoming" and not r["overdue"]],
        "paid": [r for r in rows if r["bill"].status == "paid"],
    }


# ----------------------------- chart series ------------------------------


def weekly_series(db: Session, user_id: str, ref: datetime | None = None) -> list[dict]:
    ref = ref or datetime.now()
    txns = db.scalars(select(models.Transaction).where(models.Transaction.user_id == user_id)).all()
    out = []
    for i in range(6, -1, -1):
        day = (ref - timedelta(days=i)).date()
        value = sum(
            t.amount_paise
            for t in txns
            if t.direction == "debit" and t.transaction_date.date() == day
        )
        out.append({"date": day.isoformat(), "spending_paise": value})
    return out


def monthly_series(db: Session, user_id: str, ref: datetime | None = None) -> list[dict]:
    ref = ref or datetime.now()
    txns = db.scalars(select(models.Transaction).where(models.Transaction.user_id == user_id)).all()
    history = {h.month: h.spending_paise for h in db.scalars(select(models.MonthlyHistory))}
    out = []
    for i in range(5, -1, -1):
        year, month = ref.year, ref.month
        for _ in range(i):
            month -= 1
            if month == 0:
                month, year = 12, year - 1
        key = f"{year:04d}-{month:02d}"
        computed = sum(t.amount_paise for t in txns if t.direction == "debit" and month_key(t.transaction_date) == key)
        value = computed if computed > 0 else history.get(key, 0)
        out.append({"month": key, "spending_paise": value})
    return out

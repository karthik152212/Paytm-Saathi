"""Narrative financial insights, computed from the live database.

Ported from frontend/src/data/selectors.ts (insights / spendingInsight) so the
API and the UI always produce the same story from the same numbers.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from . import finance
from .format import inr


def spending_insight_text(db: Session, user_id: str, ref: datetime | None = None) -> str:
    ref = ref or datetime.now()
    spend = finance.spending_this_month_paise(db, user_id, ref)
    income = finance.income_this_month_paise(db, user_id, ref)
    category, amount = finance.top_category(db, user_id, ref)
    share = finance.pct(amount, spend)
    totals = finance.budget_totals(finance.budget_rows(db, user_id, ref))
    parts: list[str] = []

    if spend == 0:
        return "No spending recorded this month yet — your dashboard will fill in as transactions arrive."

    parts.append(f"You have spent {inr(spend)} this month, and {category} is the biggest part of it at {share}%.")
    if income > 0 and spend < income:
        parts.append(f"You earned {inr(income)} and kept {inr(income - spend)} after spending.")
    if totals["limit_paise"] > 0:
        if totals["status"] == "over":
            parts.append(f"You have passed your combined budget by {inr(abs(totals['remaining_paise']))}.")
        elif totals["status"] == "warning":
            parts.append(
                f"You have used {totals['used_percent']}% of your combined budget with "
                f"{finance.days_left_in_month(ref)} days left in the month."
            )
        else:
            parts.append(
                f"{inr(totals['remaining_paise'])} of your combined budget is still unspent, with "
                f"{finance.days_left_in_month(ref)} days to go."
            )
    return " ".join(parts)


def build_insights(db: Session, user_id: str, ref: datetime | None = None) -> list[dict]:
    ref = ref or datetime.now()
    out: list[dict] = []
    spend = finance.spending_this_month_paise(db, user_id, ref)
    rows = finance.budget_rows(db, user_id, ref)
    totals = finance.budget_totals(rows)
    category, amount = finance.top_category(db, user_id, ref)

    if spend > 0:
        out.append(
            {
                "id": "top-category",
                "kind": "info",
                "title": f"{category} is your largest category",
                "body": f"{inr(amount)} — {finance.pct(amount, spend)}% of everything you spent this month.",
                "action": f"Review {category} transactions",
            }
        )

    if totals["limit_paise"] > 0:
        if totals["status"] == "over":
            out.append(
                {
                    "id": "budget-over",
                    "kind": "warn",
                    "title": "Budget crossed",
                    "body": (
                        f"You have spent {inr(totals['spent_paise'])} against a {inr(totals['limit_paise'])} "
                        "combined limit. Cut back on non-essentials for the rest of the month."
                    ),
                    "action": "Adjust a budget",
                }
            )
        else:
            out.append(
                {
                    "id": "budget-usage",
                    "kind": "warn" if totals["status"] == "warning" else "info",
                    "title": f"Budget {totals['used_percent']}% used",
                    "body": (
                        f"{inr(totals['remaining_paise'])} left across {len(rows)} budgets, with "
                        f"{finance.days_left_in_month(ref)} days remaining. "
                        + (
                            "You are spending faster than the month is passing."
                            if totals["status"] == "warning"
                            else "You are on pace so far."
                        )
                    ),
                    "action": "Open budgets",
                }
            )

    bill_rows = finance.bill_rows(db, user_id, ref.date())
    split = finance.split_bills(bill_rows)
    next_bill = (split["overdue"] or split["upcoming"] or [None])[0]
    if next_bill:
        bill = next_bill["bill"]
        days_left = next_bill["days_left"]
        out.append(
            {
                "id": "next-bill",
                "kind": "warn" if next_bill["overdue"] else "info",
                "title": f"{bill.title} is overdue" if next_bill["overdue"] else f"{bill.title} due soon",
                "body": (
                    f"{inr(bill.amount_paise)} — "
                    + (
                        f"{abs(days_left)} day(s) past its due date."
                        if next_bill["overdue"]
                        else ("due today." if days_left == 0 else f"due in {days_left} day(s).")
                    )
                ),
                "action": "Open bills",
            }
        )

    candidate = next((r for r in rows if r["status"] == "ok" and r["remaining_paise"] > 50_000), None)
    saved = finance.saved_this_month_paise(db, user_id, ref)
    if candidate:
        out.append(
            {
                "id": "saving-opportunity",
                "kind": "good",
                "title": "A saving opportunity",
                "body": (
                    f"Your {candidate['budget'].category_id} budget still has "
                    f"{inr(candidate['remaining_paise'])} unspent. Moving even half of it into a goal would speed "
                    f"up your savings goals. You have set aside {inr(saved)} this month so far."
                ),
                "action": "Add to a goal",
            }
        )

    out.append({"id": "next-action", "kind": "action", "title": "Your next action", "body": _next_action(db, user_id, ref)})
    return out


def _next_action(db: Session, user_id: str, ref: datetime) -> str:
    rows = finance.budget_rows(db, user_id, ref)
    split = finance.split_bills(finance.bill_rows(db, user_id, ref.date()))
    over = [r for r in rows if r["status"] == "over"]
    due_soon = [r for r in split["upcoming"] if r["days_left"] <= 3]

    if split["overdue"]:
        bill = split["overdue"][0]["bill"]
        return f"Clear the overdue {bill.title} of {inr(bill.amount_paise)} first, then review your budgets."
    if over:
        row = over[0]
        return (
            f"Your {row['budget'].category_id} budget is over by {inr(abs(row['remaining_paise']))}. "
            "Move that amount out of discretionary spending for the rest of the month."
        )
    if due_soon:
        total = sum(r["bill"].amount_paise for r in due_soon)
        return f"Set aside {inr(total)} for the {len(due_soon)} bill(s) due in the next three days."
    totals = finance.budget_totals(rows)
    if totals["remaining_paise"] > 0:
        return (
            f"You still have {inr(totals['remaining_paise'])} of budget left — move a part of it into your "
            "Emergency Fund before the month ends."
        )
    return "Review this month's spending and set next month's budgets while the numbers are fresh."

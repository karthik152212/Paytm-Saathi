"""Seed / reseed orchestration.

Guarantees:
* `seed_if_empty` runs at startup and is a no-op when data already exists, so
  user edits survive backend restarts and records are never duplicated.
* `reseed_database` is destructive and only reachable through the
  development-only POST /api/dev/reseed endpoint (403 unless SAATHI_ALLOW_RESET=1).
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import models
from .config import get_settings
from .data import loader


def _now() -> datetime:
    return datetime.now().replace(microsecond=0)


def seeded_counts(db: Session) -> dict[str, int]:
    def count(model) -> int:
        return db.scalar(select(func.count()).select_from(model)) or 0

    return {
        "users": count(models.User),
        "accounts": count(models.Account),
        "categories": count(models.Category),
        "transactions": count(models.Transaction),
        "budgets": count(models.Budget),
        "savings_goals": count(models.SavingsGoal),
        "goal_contributions": count(models.GoalContribution),
        "bills": count(models.Bill),
        "monthly_history": count(models.MonthlyHistory),
    }


def is_seeded(db: Session) -> bool:
    return (db.scalar(select(func.count()).select_from(models.User)) or 0) > 0


def seed_if_empty(db: Session) -> bool:
    """Import the datasets when the database has no users yet."""
    if is_seeded(db):
        return False
    seed_database(db)
    return True


def seed_database(db: Session) -> dict[str, int]:
    if not loader.datasets_available():
        raise FileNotFoundError(
            f"Seed datasets missing from {get_settings().datasets_dir}. "
            "Expected users.json, accounts.json, transactions.json, ... "
            "Run: python datasets/generate_seed_files.py"
        )

    now = _now()

    for row in loader.load_records("categories.json"):
        db.merge(
            models.Category(
                category_id=row["category_id"],
                display_label=row["display_label"],
                color_hex=row["color_hex"],
                icon=row["icon"],
                sort_order=int(row.get("sort_order", 0)),
            )
        )
    db.flush()

    for row in loader.load_records("users.json"):
        db.merge(
            models.User(
                user_id=row["user_id"],
                display_name=row["display_name"],
                subtitle=row.get("subtitle"),
                demo_email=row["demo_email"],
                preferred_language=row.get("preferred_language", "en-IN"),
                accessibility_preferences=json.dumps(row.get("accessibility_preferences") or {}),
                created_at=loader.parse_datetime(row.get("created_at")) or now,
                is_demo_user=bool(row.get("is_demo_user", True)),
            )
        )
    db.flush()

    for row in loader.load_records("accounts.json"):
        db.merge(
            models.Account(
                account_id=row["account_id"],
                user_id=row["user_id"],
                account_type=row["account_type"],
                display_label=row["display_label"],
                currency=row.get("currency", "INR"),
                opening_balance_paise=int(row["opening_balance_paise"]),
                account_status=row.get("account_status", "active"),
                is_demo_account=bool(row.get("is_demo_account", True)),
                is_simulated=bool(row.get("is_simulated", True)),
            )
        )

    for row in loader.load_records("transactions.json"):
        db.merge(
            models.Transaction(
                transaction_id=row["transaction_id"],
                account_id=row["account_id"],
                user_id=row["user_id"],
                merchant=row["merchant"],
                amount_paise=int(row["amount_paise"]),
                direction=row["direction"],
                category_id=row["category_id"],
                transaction_date=loader.resolve_datetime(row.get("seed_date"), row["transaction_date"], now),
                payment_method_label=row["payment_method_label"],
                description=row.get("description"),
                demo_risk_flag=bool(row.get("demo_risk_flag", False)),
                demo_flag_reason=row.get("demo_flag_reason"),
            )
        )

    for row in loader.load_records("budgets.json"):
        created = loader.parse_datetime(row.get("created_at")) or now
        db.merge(
            models.Budget(
                budget_id=row["budget_id"],
                user_id=row["user_id"],
                category_id=row["category_id"],
                monthly_limit_paise=int(row["monthly_limit_paise"]),
                period=row.get("period", "monthly"),
                created_at=created,
                updated_at=loader.parse_datetime(row.get("updated_at")) or created,
            )
        )

    goals_doc = loader.load_raw("savings_goals.json")
    goal_rows = goals_doc["records"]["goals"] if isinstance(goals_doc, dict) else goals_doc
    contribution_rows = goals_doc["records"]["contributions"] if isinstance(goals_doc, dict) else []
    for row in goal_rows:
        created = loader.parse_datetime(row.get("created_at")) or now
        db.merge(
            models.SavingsGoal(
                goal_id=row["goal_id"],
                user_id=row["user_id"],
                title=row["title"],
                target_amount_paise=int(row["target_amount_paise"]),
                saved_amount_paise=int(row.get("saved_amount_paise", 0)),
                target_date=loader.resolve_date(row.get("seed_target_date"), row.get("target_date") or "", now)
                if row.get("target_date") or row.get("seed_target_date")
                else None,
                note=row.get("note"),
                created_at=created,
                updated_at=loader.parse_datetime(row.get("updated_at")) or created,
            )
        )
    for row in contribution_rows:
        db.merge(
            models.GoalContribution(
                contribution_id=row["contribution_id"],
                goal_id=row["goal_id"],
                user_id=row["user_id"],
                amount_paise=int(row["amount_paise"]),
                note=row.get("note"),
                created_at=loader.resolve_datetime(row.get("seed_date"), row["created_at"], now),
            )
        )

    for row in loader.load_records("bills.json"):
        due = loader.resolve_date(row.get("seed_due_date"), row["due_date"], now)
        paid = None
        if row.get("paid_date") or row.get("seed_paid_date"):
            paid = loader.resolve_date(row.get("seed_paid_date"), row.get("paid_date") or row["due_date"], now)
        db.merge(
            models.Bill(
                bill_id=row["bill_id"],
                user_id=row["user_id"],
                title=row["title"],
                amount_paise=int(row["amount_paise"]),
                due_date=due,
                status=row.get("status", "upcoming"),
                recurring=bool(row.get("recurring", False)),
                category_id=row.get("category_id"),
                paid_date=paid,
                created_at=loader.parse_datetime(row.get("created_at")) or now,
            )
        )

    for row in loader.load_records("monthly_history.json"):
        month = row.get("month") or ""
        hint = row.get("seed_month")
        if isinstance(hint, dict) and hint.get("kind") == "month_offset":
            ref = now.replace(day=1)
            for _ in range(int(hint.get("offset", 0))):
                ref = (ref - timedelta(days=1)).replace(day=1)
            month = ref.strftime("%Y-%m")
        db.merge(
            models.MonthlyHistory(
                month=month,
                spending_paise=int(row["spending_paise"]),
                note=row.get("note"),
            )
        )

    db.commit()
    return seeded_counts(db)


def reseed_database(db: Session) -> dict[str, int]:
    """Destroy every row and import the datasets again (development only)."""
    for model in (
        models.GoalContribution,
        models.SavingsGoal,
        models.Bill,
        models.Budget,
        models.Transaction,
        models.Account,
        models.User,
        models.MonthlyHistory,
        models.Category,
    ):
        db.query(model).delete()
    db.commit()
    return seed_database(db)

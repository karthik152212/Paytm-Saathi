from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models


def list_budgets(db: Session, user_id: str | None = None) -> list[models.Budget]:
    stmt = select(models.Budget)
    if user_id:
        stmt = stmt.where(models.Budget.user_id == user_id)
    return list(db.scalars(stmt.order_by(models.Budget.budget_id)))


def get_budget(db: Session, budget_id: str) -> models.Budget | None:
    return db.get(models.Budget, budget_id)


def find_by_category(db: Session, user_id: str, category_id: str) -> models.Budget | None:
    return db.scalars(
        select(models.Budget).where(models.Budget.user_id == user_id, models.Budget.category_id == category_id)
    ).first()


def create_budget(
    db: Session, *, budget_id: str, user_id: str, category_id: str, monthly_limit_paise: int, period: str = "monthly"
) -> models.Budget:
    now = datetime.now().replace(microsecond=0)
    budget = models.Budget(
        budget_id=budget_id,
        user_id=user_id,
        category_id=category_id,
        monthly_limit_paise=monthly_limit_paise,
        period=period,
        created_at=now,
        updated_at=now,
    )
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget


def update_budget(db: Session, budget: models.Budget, *, monthly_limit_paise: int | None) -> models.Budget:
    if monthly_limit_paise is not None:
        budget.monthly_limit_paise = monthly_limit_paise
    budget.updated_at = datetime.now().replace(microsecond=0)
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget


def delete_budget(db: Session, budget: models.Budget) -> None:
    db.delete(budget)
    db.commit()

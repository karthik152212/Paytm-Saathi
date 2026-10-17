from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models


def list_goals(db: Session, user_id: str | None = None) -> list[models.SavingsGoal]:
    stmt = select(models.SavingsGoal)
    if user_id:
        stmt = stmt.where(models.SavingsGoal.user_id == user_id)
    return list(db.scalars(stmt.order_by(models.SavingsGoal.goal_id)))


def get_goal(db: Session, goal_id: str) -> models.SavingsGoal | None:
    return db.get(models.SavingsGoal, goal_id)


def create_goal(
    db: Session,
    *,
    goal_id: str,
    user_id: str,
    title: str,
    target_amount_paise: int,
    saved_amount_paise: int = 0,
    target_date: date | None = None,
    note: str | None = None,
) -> models.SavingsGoal:
    now = datetime.now().replace(microsecond=0)
    goal = models.SavingsGoal(
        goal_id=goal_id,
        user_id=user_id,
        title=title,
        target_amount_paise=target_amount_paise,
        saved_amount_paise=saved_amount_paise,
        target_date=target_date,
        note=note,
        created_at=now,
        updated_at=now,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


def update_goal(
    db: Session,
    goal: models.SavingsGoal,
    *,
    title: str | None = None,
    target_amount_paise: int | None = None,
    target_date: date | None = None,
    note: str | None = None,
) -> models.SavingsGoal:
    if title is not None:
        goal.title = title
    if target_amount_paise is not None:
        goal.target_amount_paise = target_amount_paise
    if target_date is not None:
        goal.target_date = target_date
    if note is not None:
        goal.note = note
    goal.updated_at = datetime.now().replace(microsecond=0)
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


def delete_goal(db: Session, goal: models.SavingsGoal) -> None:
    db.delete(goal)
    db.commit()


def add_contribution(
    db: Session, *, goal: models.SavingsGoal, amount_paise: int, note: str | None = None
) -> models.GoalContribution:
    now = datetime.now().replace(microsecond=0)
    contribution = models.GoalContribution(
        contribution_id=f"con_{int(now.timestamp() * 1000)}",
        goal_id=goal.goal_id,
        user_id=goal.user_id,
        amount_paise=amount_paise,
        note=note,
        created_at=now,
    )
    goal.saved_amount_paise += amount_paise
    goal.updated_at = now
    db.add(contribution)
    db.add(goal)
    db.commit()
    db.refresh(contribution)
    return contribution


def list_contributions(db: Session, *, goal_id: str | None = None, user_id: str | None = None) -> list[models.GoalContribution]:
    stmt = select(models.GoalContribution)
    if goal_id:
        stmt = stmt.where(models.GoalContribution.goal_id == goal_id)
    if user_id:
        stmt = stmt.where(models.GoalContribution.user_id == user_id)
    return list(db.scalars(stmt.order_by(models.GoalContribution.created_at.desc())))

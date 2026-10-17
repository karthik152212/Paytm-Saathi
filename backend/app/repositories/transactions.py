from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from .. import models


def list_transactions(
    db: Session,
    *,
    user_id: str | None = None,
    account_id: str | None = None,
    query: str | None = None,
    category_id: str | None = None,
    direction: str | None = None,
) -> list[models.Transaction]:
    stmt = select(models.Transaction)
    if user_id:
        stmt = stmt.where(models.Transaction.user_id == user_id)
    if account_id:
        stmt = stmt.where(models.Transaction.account_id == account_id)
    if category_id:
        stmt = stmt.where(models.Transaction.category_id == category_id)
    if direction in ("debit", "credit"):
        stmt = stmt.where(models.Transaction.direction == direction)
    if query:
        like = f"%{query.strip()}%"
        stmt = stmt.where(
            or_(
                models.Transaction.merchant.ilike(like),
                models.Transaction.description.ilike(like),
                models.Transaction.category_id.ilike(like),
            )
        )
    stmt = stmt.order_by(models.Transaction.transaction_date.desc(), models.Transaction.transaction_id.desc())
    return list(db.scalars(stmt))


def get_transaction(db: Session, transaction_id: str) -> models.Transaction | None:
    return db.get(models.Transaction, transaction_id)


def count_transactions(db: Session, user_id: str | None = None) -> int:
    stmt = select(func.count()).select_from(models.Transaction)
    if user_id:
        stmt = stmt.where(models.Transaction.user_id == user_id)
    return db.scalar(stmt) or 0

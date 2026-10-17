from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models


def list_accounts(db: Session, user_id: str | None = None) -> list[models.Account]:
    stmt = select(models.Account).order_by(models.Account.account_id)
    if user_id:
        stmt = stmt.where(models.Account.user_id == user_id)
    return list(db.scalars(stmt))


def get_account(db: Session, account_id: str) -> models.Account | None:
    return db.get(models.Account, account_id)


def primary_account(db: Session, user_id: str) -> models.Account | None:
    return db.scalars(
        select(models.Account).where(models.Account.user_id == user_id).order_by(models.Account.account_id)
    ).first()

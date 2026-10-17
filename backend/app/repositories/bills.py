from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models


def list_bills(db: Session, user_id: str | None = None, status: str | None = None) -> list[models.Bill]:
    stmt = select(models.Bill)
    if user_id:
        stmt = stmt.where(models.Bill.user_id == user_id)
    if status in ("upcoming", "paid"):
        stmt = stmt.where(models.Bill.status == status)
    return list(db.scalars(stmt.order_by(models.Bill.due_date, models.Bill.bill_id)))


def get_bill(db: Session, bill_id: str) -> models.Bill | None:
    return db.get(models.Bill, bill_id)


def create_bill(
    db: Session,
    *,
    bill_id: str,
    user_id: str,
    title: str,
    amount_paise: int,
    due_date: date,
    status: str = "upcoming",
    recurring: bool = False,
    category_id: str | None = None,
    paid_date: date | None = None,
) -> models.Bill:
    bill = models.Bill(
        bill_id=bill_id,
        user_id=user_id,
        title=title,
        amount_paise=amount_paise,
        due_date=due_date,
        status=status,
        recurring=recurring,
        category_id=category_id,
        paid_date=paid_date,
        created_at=datetime.now().replace(microsecond=0),
    )
    db.add(bill)
    db.commit()
    db.refresh(bill)
    return bill


def update_bill(
    db: Session,
    bill: models.Bill,
    *,
    title: str | None = None,
    amount_paise: int | None = None,
    due_date: date | None = None,
    status: str | None = None,
    recurring: bool | None = None,
    category_id: str | None = None,
) -> models.Bill:
    if title is not None:
        bill.title = title
    if amount_paise is not None:
        bill.amount_paise = amount_paise
    if due_date is not None:
        bill.due_date = due_date
    if status is not None:
        bill.status = status
    if recurring is not None:
        bill.recurring = recurring
    if category_id is not None:
        bill.category_id = category_id
    db.add(bill)
    db.commit()
    db.refresh(bill)
    return bill


def delete_bill(db: Session, bill: models.Bill) -> None:
    db.delete(bill)
    db.commit()


def mark_paid(db: Session, bill: models.Bill, paid_date: date | None = None) -> models.Bill:
    bill.status = "paid"
    bill.paid_date = paid_date or date.today()
    db.add(bill)
    db.commit()
    db.refresh(bill)
    return bill

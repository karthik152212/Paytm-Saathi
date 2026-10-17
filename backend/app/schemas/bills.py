from __future__ import annotations

from pydantic import BaseModel, Field

from .common import iso_date, iso_datetime, rupees

MAX_AMOUNT_PAISE = 1_000_000_000


class BillCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    amount_paise: int = Field(gt=0, le=MAX_AMOUNT_PAISE)
    due_date: str = Field(min_length=8)
    recurring: bool = False
    category_id: str | None = None
    status: str = Field(default="upcoming", pattern="^(upcoming|paid)$")


class BillUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    amount_paise: int | None = Field(default=None, gt=0, le=MAX_AMOUNT_PAISE)
    due_date: str | None = None
    recurring: bool | None = None
    category_id: str | None = None
    status: str | None = Field(default=None, pattern="^(upcoming|paid)$")


class BillOut(BaseModel):
    bill_id: str
    user_id: str
    title: str
    amount_paise: int
    amount_rupees: float
    due_date: str
    status: str
    recurring: bool
    category_id: str | None = None
    paid_date: str | None = None
    days_left: int
    overdue: bool
    created_at: str | None = None

    @classmethod
    def from_row(cls, row) -> "BillOut":
        bill = row["bill"]
        return cls(
            bill_id=bill.bill_id,
            user_id=bill.user_id,
            title=bill.title,
            amount_paise=bill.amount_paise,
            amount_rupees=rupees(bill.amount_paise),
            due_date=iso_date(bill.due_date) or "",
            status=bill.status,
            recurring=bill.recurring,
            category_id=bill.category_id,
            paid_date=iso_date(bill.paid_date),
            days_left=row["days_left"],
            overdue=row["overdue"],
            created_at=iso_datetime(bill.created_at),
        )


class BillListResponse(BaseModel):
    items: list[BillOut]
    total_count: int
    overdue_count: int
    upcoming_count: int
    paid_count: int

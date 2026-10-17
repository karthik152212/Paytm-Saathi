from __future__ import annotations

import time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..data import loader
from ..db import get_db
from ..repositories import bills as bills_repo
from ..schemas.bills import BillCreate, BillListResponse, BillOut, BillUpdate
from ..services import finance
from .helpers import get_user_or_404

router = APIRouter(tags=["bills"])


def _rows(db: Session, user_id: str) -> list[dict]:
    return finance.bill_rows(db, user_id)


def _row_for(db: Session, user_id: str, bill_id: str) -> dict | None:
    return next((r for r in _rows(db, user_id) if r["bill"].bill_id == bill_id), None)


@router.get("/api/bills", response_model=BillListResponse)
def list_bills(user_id: str | None = None, db: Session = Depends(get_db)) -> BillListResponse:
    user = get_user_or_404(db, user_id)
    rows = _rows(db, user.user_id)
    split = finance.split_bills(rows)
    return BillListResponse(
        items=[BillOut.from_row(r) for r in rows],
        total_count=len(rows),
        overdue_count=len(split["overdue"]),
        upcoming_count=len(split["upcoming"]),
        paid_count=len(split["paid"]),
    )


@router.post("/api/bills", response_model=BillOut, status_code=201)
def create_bill(payload: BillCreate, user_id: str | None = None, db: Session = Depends(get_db)) -> BillOut:
    user = get_user_or_404(db, user_id)
    due = loader.parse_date(payload.due_date)
    if due is None:
        raise HTTPException(status_code=422, detail="due_date must be an ISO date (YYYY-MM-DD)")
    bill = bills_repo.create_bill(
        db,
        bill_id=f"bill_{int(time.time() * 1000)}",
        user_id=user.user_id,
        title=payload.title,
        amount_paise=payload.amount_paise,
        due_date=due,
        status=payload.status,
        recurring=payload.recurring,
        category_id=payload.category_id,
    )
    return BillOut.from_row(_row_for(db, user.user_id, bill.bill_id))


@router.patch("/api/bills/{bill_id}", response_model=BillOut)
def update_bill(bill_id: str, payload: BillUpdate, db: Session = Depends(get_db)) -> BillOut:
    bill = bills_repo.get_bill(db, bill_id)
    if bill is None:
        raise HTTPException(status_code=404, detail=f"Unknown bill_id '{bill_id}'")
    due = loader.parse_date(payload.due_date) if payload.due_date else None
    if payload.due_date and due is None:
        raise HTTPException(status_code=422, detail="due_date must be an ISO date (YYYY-MM-DD)")
    bill = bills_repo.update_bill(
        db,
        bill,
        title=payload.title,
        amount_paise=payload.amount_paise,
        due_date=due,
        status=payload.status,
        recurring=payload.recurring,
        category_id=payload.category_id,
    )
    if payload.status == "paid" and bill.paid_date is None:
        bill = bills_repo.mark_paid(db, bill)
    elif payload.status == "upcoming" and bill.paid_date is not None:
        bill.paid_date = None
        db.add(bill)
        db.commit()
        db.refresh(bill)
    return BillOut.from_row(_row_for(db, bill.user_id, bill.bill_id))


@router.post("/api/bills/{bill_id}/mark-paid", response_model=BillOut)
def mark_paid(bill_id: str, db: Session = Depends(get_db)) -> BillOut:
    """Demonstration-only state change. No real payment is processed."""
    bill = bills_repo.get_bill(db, bill_id)
    if bill is None:
        raise HTTPException(status_code=404, detail=f"Unknown bill_id '{bill_id}'")
    bill = bills_repo.mark_paid(db, bill)
    return BillOut.from_row(_row_for(db, bill.user_id, bill.bill_id))


@router.delete("/api/bills/{bill_id}", status_code=204)
def delete_bill(bill_id: str, db: Session = Depends(get_db)) -> None:
    bill = bills_repo.get_bill(db, bill_id)
    if bill is None:
        raise HTTPException(status_code=404, detail=f"Unknown bill_id '{bill_id}'")
    bills_repo.delete_bill(db, bill)

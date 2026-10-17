from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models
from ..data import loader
from ..db import get_db
from ..repositories import transactions as transactions_repo
from ..schemas.transactions import TransactionCreate, TransactionListResponse, TransactionOut
from .helpers import category_labels, get_user_or_404

router = APIRouter(tags=["transactions"])


@router.get("/api/transactions", response_model=TransactionListResponse)
def list_transactions(
    user_id: str | None = Query(default=None),
    account_id: str | None = Query(default=None),
    q: str | None = Query(default=None, max_length=120),
    category_id: str | None = Query(default=None),
    direction: str | None = Query(default=None, pattern="^(debit|credit)$"),
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> TransactionListResponse:
    if user_id:
        get_user_or_404(db, user_id)
    labels = category_labels(db)
    rows = transactions_repo.list_transactions(
        db, user_id=user_id, account_id=account_id, query=q, category_id=category_id, direction=direction
    )
    total = len(rows)
    page = rows[offset : offset + limit]
    return TransactionListResponse(
        items=[TransactionOut.from_model(t, labels.get(t.category_id)) for t in page],
        total_count=total,
        filters_applied={"q": q, "category_id": category_id, "direction": direction, "account_id": account_id},
    )


@router.get("/api/transactions/{transaction_id}", response_model=TransactionOut)
def get_transaction(transaction_id: str, db: Session = Depends(get_db)) -> TransactionOut:
    txn = transactions_repo.get_transaction(db, transaction_id)
    if txn is None:
        raise HTTPException(status_code=404, detail=f"Unknown transaction_id '{transaction_id}'")
    labels = category_labels(db)
    return TransactionOut.from_model(txn, labels.get(txn.category_id))


@router.post("/api/transactions", response_model=TransactionOut, status_code=201)
def create_transaction(payload: TransactionCreate, db: Session = Depends(get_db)) -> TransactionOut:
    account = db.get(models.Account, payload.account_id)
    if account is None:
        raise HTTPException(status_code=404, detail=f"Unknown account_id '{payload.account_id}'")
    if payload.user_id and payload.user_id != account.user_id:
        raise HTTPException(status_code=422, detail="user_id does not match the account owner")
    if db.get(models.Category, payload.category_id) is None:
        raise HTTPException(status_code=404, detail=f"Unknown category_id '{payload.category_id}'")
    if payload.transaction_date is not None:
        transaction_date = loader.parse_datetime(payload.transaction_date)
        if transaction_date is None:
            raise HTTPException(status_code=422, detail="transaction_date must be an ISO datetime string")
    else:
        transaction_date = datetime.now().replace(microsecond=0)
    txn = transactions_repo.create_transaction(
        db,
        transaction_id=transactions_repo.next_transaction_id(db),
        account_id=account.account_id,
        user_id=account.user_id,
        merchant=payload.merchant.strip(),
        amount_paise=payload.amount_paise,
        direction=payload.direction,
        category_id=payload.category_id,
        transaction_date=transaction_date,
        payment_method_label=payload.payment_method_label,
        description=payload.description,
    )
    labels = category_labels(db)
    return TransactionOut.from_model(txn, labels.get(txn.category_id))

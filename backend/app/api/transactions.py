from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..repositories import transactions as transactions_repo
from ..schemas.transactions import TransactionListResponse, TransactionOut
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

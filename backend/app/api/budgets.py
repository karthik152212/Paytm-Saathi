from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..repositories import budgets as budgets_repo
from ..schemas.budgets import BudgetCreate, BudgetListResponse, BudgetOut, BudgetTotalsOut, BudgetUpdate
from ..services import finance
from .helpers import category_labels, get_user_or_404

router = APIRouter(tags=["budgets"])


@router.get("/api/budgets", response_model=BudgetListResponse)
def list_budgets(user_id: str | None = None, db: Session = Depends(get_db)) -> BudgetListResponse:
    user = get_user_or_404(db, user_id)
    labels = category_labels(db)
    rows = finance.budget_rows(db, user.user_id)
    totals = finance.budget_totals(rows)
    return BudgetListResponse(
        items=[BudgetOut.from_row(r, labels.get(r["budget"].category_id)) for r in rows],
        totals=BudgetTotalsOut.from_totals(totals),
        total_count=len(rows),
    )


@router.post("/api/budgets", response_model=BudgetOut, status_code=201)
def create_budget(payload: BudgetCreate, user_id: str | None = None, db: Session = Depends(get_db)) -> BudgetOut:
    user = get_user_or_404(db, user_id)
    if budgets_repo.find_by_category(db, user.user_id, payload.category_id):
        raise HTTPException(status_code=409, detail=f"A budget for '{payload.category_id}' already exists")
    labels = category_labels(db)
    if payload.category_id not in labels:
        raise HTTPException(status_code=404, detail=f"Unknown category_id '{payload.category_id}'")
    budget = budgets_repo.create_budget(
        db,
        budget_id=f"bud_{payload.category_id}_{user.user_id[-3:]}",
        user_id=user.user_id,
        category_id=payload.category_id,
        monthly_limit_paise=payload.monthly_limit_paise,
    )
    row = next(r for r in finance.budget_rows(db, user.user_id) if r["budget"].budget_id == budget.budget_id)
    return BudgetOut.from_row(row, labels.get(budget.category_id))


@router.patch("/api/budgets/{budget_id}", response_model=BudgetOut)
def update_budget(budget_id: str, payload: BudgetUpdate, db: Session = Depends(get_db)) -> BudgetOut:
    budget = budgets_repo.get_budget(db, budget_id)
    if budget is None:
        raise HTTPException(status_code=404, detail=f"Unknown budget_id '{budget_id}'")
    budget = budgets_repo.update_budget(db, budget, monthly_limit_paise=payload.monthly_limit_paise)
    labels = category_labels(db)
    row = next(r for r in finance.budget_rows(db, budget.user_id) if r["budget"].budget_id == budget_id)
    return BudgetOut.from_row(row, labels.get(budget.category_id))


@router.delete("/api/budgets/{budget_id}", status_code=204)
def delete_budget(budget_id: str, db: Session = Depends(get_db)) -> None:
    budget = budgets_repo.get_budget(db, budget_id)
    if budget is None:
        raise HTTPException(status_code=404, detail=f"Unknown budget_id '{budget_id}'")
    budgets_repo.delete_budget(db, budget)

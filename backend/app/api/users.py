from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..repositories import accounts as accounts_repo
from ..repositories import users as users_repo
from ..schemas.users import UserListResponse, UserOut, UserUpdate
from ..schemas.accounts import AccountListResponse, AccountOut
from ..services import finance
from .helpers import get_user_or_404

router = APIRouter(tags=["users and accounts"])


@router.get("/api/users", response_model=UserListResponse)
def list_users(db: Session = Depends(get_db)) -> UserListResponse:
    users = users_repo.list_users(db)
    return UserListResponse(items=[UserOut.from_model(u) for u in users], total_count=len(users))


@router.get("/api/users/{user_id}", response_model=UserOut)
def get_user(user_id: str, db: Session = Depends(get_db)) -> UserOut:
    user = users_repo.get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail=f"Unknown user_id '{user_id}'")
    return UserOut.from_model(user)


@router.patch("/api/users/{user_id}", response_model=UserOut)
def update_user(user_id: str, payload: UserUpdate, db: Session = Depends(get_db)) -> UserOut:
    user = users_repo.get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail=f"Unknown user_id '{user_id}'")
    user = users_repo.update_user(
        db,
        user,
        display_name=payload.display_name,
        subtitle=payload.subtitle,
        accessibility_preferences=payload.accessibility_preferences,
    )
    return UserOut.from_model(user)


@router.get("/api/accounts", response_model=AccountListResponse)
def list_accounts(user_id: str | None = Query(default=None), db: Session = Depends(get_db)) -> AccountListResponse:
    if user_id:
        get_user_or_404(db, user_id)
    rows = accounts_repo.list_accounts(db, user_id=user_id)
    items = [AccountOut.from_model(a, finance.available_balance_paise(db, a.user_id)) for a in rows]
    return AccountListResponse(items=items, total_count=len(items))


@router.get("/api/accounts/{account_id}", response_model=AccountOut)
def get_account(account_id: str, db: Session = Depends(get_db)) -> AccountOut:
    account = accounts_repo.get_account(db, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail=f"Unknown account_id '{account_id}'")
    return AccountOut.from_model(account, finance.available_balance_paise(db, account.user_id))

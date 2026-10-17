from __future__ import annotations

from pydantic import BaseModel

from .common import rupees


class AccountOut(BaseModel):
    account_id: str
    user_id: str
    account_type: str
    display_label: str
    currency: str
    opening_balance_paise: int
    opening_balance_rupees: float
    balance_paise: int
    balance_rupees: float
    account_status: str
    is_demo_account: bool
    is_simulated: bool

    @classmethod
    def from_model(cls, account, balance_paise: int) -> "AccountOut":
        return cls(
            account_id=account.account_id,
            user_id=account.user_id,
            account_type=account.account_type,
            display_label=account.display_label,
            currency=account.currency,
            opening_balance_paise=account.opening_balance_paise,
            opening_balance_rupees=rupees(account.opening_balance_paise),
            balance_paise=balance_paise,
            balance_rupees=rupees(balance_paise),
            account_status=account.account_status,
            is_demo_account=account.is_demo_account,
            is_simulated=account.is_simulated,
        )


class AccountListResponse(BaseModel):
    items: list[AccountOut]
    total_count: int

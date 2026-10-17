from __future__ import annotations

from pydantic import BaseModel

from .common import iso_datetime, rupees


class TransactionOut(BaseModel):
    transaction_id: str
    account_id: str
    user_id: str
    merchant: str
    amount_paise: int
    amount_rupees: float
    direction: str
    category_id: str
    category_label: str | None = None
    transaction_date: str
    payment_method_label: str
    description: str | None = None
    demo_risk_flag: bool
    demo_flag_reason: str | None = None

    @classmethod
    def from_model(cls, txn, category_label: str | None = None) -> "TransactionOut":
        return cls(
            transaction_id=txn.transaction_id,
            account_id=txn.account_id,
            user_id=txn.user_id,
            merchant=txn.merchant,
            amount_paise=txn.amount_paise,
            amount_rupees=rupees(txn.amount_paise),
            direction=txn.direction,
            category_id=txn.category_id,
            category_label=category_label,
            transaction_date=iso_datetime(txn.transaction_date) or "",
            payment_method_label=txn.payment_method_label,
            description=txn.description,
            demo_risk_flag=txn.demo_risk_flag,
            demo_flag_reason=txn.demo_flag_reason,
        )


class TransactionListResponse(BaseModel):
    items: list[TransactionOut]
    total_count: int
    filters_applied: dict[str, str | None]

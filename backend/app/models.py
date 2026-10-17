"""SQLAlchemy models — the runtime (SQLite) schema.

Money is always stored as INTEGER paise (₹1 = 100 paise). Floating point is
never used for authoritative currency values anywhere in this backend.

Dates are stored naive (no timezone) and always mean *local server time*,
which matches the ISO strings the frontend renders.
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    subtitle: Mapped[str | None] = mapped_column(String(160))
    demo_email: Mapped[str] = mapped_column(String(160), nullable=False, unique=True)
    preferred_language: Mapped[str] = mapped_column(String(16), default="en-IN", nullable=False)
    accessibility_preferences: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    is_demo_user: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    accounts: Mapped[list["Account"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Account(Base):
    __tablename__ = "accounts"

    account_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    account_type: Mapped[str] = mapped_column(String(32), nullable=False)
    display_label: Mapped[str] = mapped_column(String(120), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="INR", nullable=False)
    opening_balance_paise: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    account_status: Mapped[str] = mapped_column(String(24), default="active", nullable=False)
    is_demo_account: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user: Mapped[User] = relationship(back_populates="accounts")


class Category(Base):
    __tablename__ = "categories"

    category_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    display_label: Mapped[str] = mapped_column(String(48), nullable=False)
    color_hex: Mapped[str] = mapped_column(String(16), nullable=False)
    icon: Mapped[str] = mapped_column(String(32), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        Index("ix_transactions_user_date", "user_id", "transaction_date"),
        Index("ix_transactions_account_date", "account_id", "transaction_date"),
    )

    transaction_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.account_id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    merchant: Mapped[str] = mapped_column(String(120), nullable=False)
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    direction: Mapped[str] = mapped_column(String(8), nullable=False)  # debit | credit
    category_id: Mapped[str] = mapped_column(ForeignKey("categories.category_id"), nullable=False)
    transaction_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    payment_method_label: Mapped[str] = mapped_column(String(32), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    demo_risk_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    demo_flag_reason: Mapped[str | None] = mapped_column(Text)


class Budget(Base):
    __tablename__ = "budgets"
    __table_args__ = (Index("ix_budgets_user_category", "user_id", "category_id", unique=True),)

    budget_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    category_id: Mapped[str] = mapped_column(ForeignKey("categories.category_id"), nullable=False)
    monthly_limit_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    period: Mapped[str] = mapped_column(String(16), default="monthly", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class SavingsGoal(Base):
    __tablename__ = "savings_goals"

    goal_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    target_amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    saved_amount_paise: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    target_date: Mapped[date | None] = mapped_column(Date)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    contributions: Mapped[list["GoalContribution"]] = relationship(
        back_populates="goal", cascade="all, delete-orphan"
    )


class GoalContribution(Base):
    __tablename__ = "goal_contributions"
    __table_args__ = (Index("ix_goal_contributions_goal", "goal_id", "created_at"),)

    contribution_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    goal_id: Mapped[str] = mapped_column(ForeignKey("savings_goals.goal_id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    goal: Mapped[SavingsGoal] = relationship(back_populates="contributions")


class Bill(Base):
    __tablename__ = "bills"
    __table_args__ = (Index("ix_bills_user_due", "user_id", "due_date"),)

    bill_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="upcoming", nullable=False)  # upcoming | paid
    recurring: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    category_id: Mapped[str | None] = mapped_column(ForeignKey("categories.category_id"))
    paid_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class MonthlyHistory(Base):
    __tablename__ = "monthly_history"

    month: Mapped[str] = mapped_column(String(7), primary_key=True)  # YYYY-MM
    spending_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[str | None] = mapped_column(Text)

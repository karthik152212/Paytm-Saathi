from __future__ import annotations

from pydantic import BaseModel, Field

from .common import iso_date, iso_datetime, rupees

MAX_AMOUNT_PAISE = 1_000_000_000


class GoalCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    target_amount_paise: int = Field(gt=0, le=MAX_AMOUNT_PAISE)
    saved_amount_paise: int = Field(default=0, ge=0, le=MAX_AMOUNT_PAISE)
    target_date: str | None = None
    note: str | None = Field(default=None, max_length=500)


class GoalUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    target_amount_paise: int | None = Field(default=None, gt=0, le=MAX_AMOUNT_PAISE)
    target_date: str | None = None
    note: str | None = Field(default=None, max_length=500)


class ContributionCreate(BaseModel):
    amount_paise: int = Field(gt=0, le=MAX_AMOUNT_PAISE)
    note: str | None = Field(default=None, max_length=200)


class ContributionOut(BaseModel):
    contribution_id: str
    goal_id: str
    user_id: str
    amount_paise: int
    amount_rupees: float
    note: str | None = None
    created_at: str

    @classmethod
    def from_model(cls, contribution) -> "ContributionOut":
        return cls(
            contribution_id=contribution.contribution_id,
            goal_id=contribution.goal_id,
            user_id=contribution.user_id,
            amount_paise=contribution.amount_paise,
            amount_rupees=rupees(contribution.amount_paise),
            note=contribution.note,
            created_at=iso_datetime(contribution.created_at) or "",
        )


class GoalOut(BaseModel):
    goal_id: str
    user_id: str
    title: str
    target_amount_paise: int
    target_amount_rupees: float
    saved_amount_paise: int
    saved_amount_rupees: float
    remaining_paise: int
    remaining_rupees: float
    progress_percent: int
    target_date: str | None = None
    note: str | None = None
    created_at: str | None = None
    updated_at: str | None = None

    @classmethod
    def from_row(cls, row) -> "GoalOut":
        goal = row["goal"]
        return cls(
            goal_id=goal.goal_id,
            user_id=goal.user_id,
            title=goal.title,
            target_amount_paise=goal.target_amount_paise,
            target_amount_rupees=rupees(goal.target_amount_paise),
            saved_amount_paise=goal.saved_amount_paise,
            saved_amount_rupees=rupees(goal.saved_amount_paise),
            remaining_paise=row["remaining_paise"],
            remaining_rupees=rupees(row["remaining_paise"]),
            progress_percent=row["progress_percent"],
            target_date=iso_date(goal.target_date),
            note=goal.note,
            created_at=iso_datetime(goal.created_at),
            updated_at=iso_datetime(goal.updated_at),
        )


class GoalListResponse(BaseModel):
    items: list[GoalOut]
    contributions: list[ContributionOut]
    total_count: int


class ContributionResponse(BaseModel):
    contribution: ContributionOut
    goal: GoalOut

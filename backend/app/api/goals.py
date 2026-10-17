from __future__ import annotations

import time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..data import loader
from ..db import get_db
from ..repositories import goals as goals_repo
from ..schemas.goals import (
    ContributionCreate,
    ContributionOut,
    ContributionResponse,
    GoalCreate,
    GoalListResponse,
    GoalOut,
    GoalUpdate,
)
from ..services import finance

router = APIRouter(tags=["savings goals"])


def _goal_row(db: Session, user_id: str, goal_id: str):
    row = next((r for r in finance.goal_rows(db, user_id) if r["goal"].goal_id == goal_id), None)
    return row


@router.get("/api/goals", response_model=GoalListResponse)
def list_goals(user_id: str | None = None, db: Session = Depends(get_db)) -> GoalListResponse:
    from .helpers import get_user_or_404

    user = get_user_or_404(db, user_id)
    rows = finance.goal_rows(db, user.user_id)
    contributions = goals_repo.list_contributions(db, user_id=user.user_id)
    return GoalListResponse(
        items=[GoalOut.from_row(r) for r in rows],
        contributions=[ContributionOut.from_model(c) for c in contributions],
        total_count=len(rows),
    )


@router.post("/api/goals", response_model=GoalOut, status_code=201)
def create_goal(payload: GoalCreate, user_id: str | None = None, db: Session = Depends(get_db)) -> GoalOut:
    from .helpers import get_user_or_404

    user = get_user_or_404(db, user_id)
    goal = goals_repo.create_goal(
        db,
        goal_id=f"goal_{int(time.time() * 1000)}",
        user_id=user.user_id,
        title=payload.title,
        target_amount_paise=payload.target_amount_paise,
        saved_amount_paise=payload.saved_amount_paise,
        target_date=loader.parse_date(payload.target_date),
        note=payload.note,
    )
    row = _goal_row(db, user.user_id, goal.goal_id)
    return GoalOut.from_row(row)


@router.patch("/api/goals/{goal_id}", response_model=GoalOut)
def update_goal(goal_id: str, payload: GoalUpdate, db: Session = Depends(get_db)) -> GoalOut:
    goal = goals_repo.get_goal(db, goal_id)
    if goal is None:
        raise HTTPException(status_code=404, detail=f"Unknown goal_id '{goal_id}'")
    goal = goals_repo.update_goal(
        db,
        goal,
        title=payload.title,
        target_amount_paise=payload.target_amount_paise,
        target_date=loader.parse_date(payload.target_date) if payload.target_date else None,
        note=payload.note,
    )
    row = _goal_row(db, goal.user_id, goal.goal_id)
    return GoalOut.from_row(row)


@router.post("/api/goals/{goal_id}/contributions", response_model=ContributionResponse, status_code=201)
def add_contribution(goal_id: str, payload: ContributionCreate, db: Session = Depends(get_db)) -> ContributionResponse:
    goal = goals_repo.get_goal(db, goal_id)
    if goal is None:
        raise HTTPException(status_code=404, detail=f"Unknown goal_id '{goal_id}'")
    if payload.amount_paise <= 0:
        raise HTTPException(status_code=400, detail="Contribution amount must be greater than zero")
    contribution = goals_repo.add_contribution(db, goal=goal, amount_paise=payload.amount_paise, note=payload.note)
    row = _goal_row(db, goal.user_id, goal.goal_id)
    return ContributionResponse(contribution=ContributionOut.from_model(contribution), goal=GoalOut.from_row(row))


@router.get("/api/goals/{goal_id}/contributions", response_model=list[ContributionOut])
def list_goal_contributions(goal_id: str, db: Session = Depends(get_db)) -> list[ContributionOut]:
    goal = goals_repo.get_goal(db, goal_id)
    if goal is None:
        raise HTTPException(status_code=404, detail=f"Unknown goal_id '{goal_id}'")
    rows = goals_repo.list_contributions(db, goal_id=goal_id)
    return [ContributionOut.from_model(c) for c in rows]


@router.delete("/api/goals/{goal_id}", status_code=204)
def delete_goal(goal_id: str, db: Session = Depends(get_db)) -> None:
    goal = goals_repo.get_goal(db, goal_id)
    if goal is None:
        raise HTTPException(status_code=404, detail=f"Unknown goal_id '{goal_id}'")
    goals_repo.delete_goal(db, goal)

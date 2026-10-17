from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..schemas.insights import InsightItem, InsightsResponse
from ..services import insights as insights_service
from .helpers import get_user_or_404

router = APIRouter(tags=["insights"])


@router.get("/api/insights", response_model=InsightsResponse)
def get_insights(user_id: str | None = None, db: Session = Depends(get_db)) -> InsightsResponse:
    user = get_user_or_404(db, user_id)
    items = insights_service.build_insights(db, user.user_id)
    return InsightsResponse(
        user_id=user.user_id,
        insight_text=insights_service.spending_insight_text(db, user.user_id),
        insights=[InsightItem(**item) for item in items],
        generated_at=datetime.now().replace(microsecond=0).isoformat(),
    )

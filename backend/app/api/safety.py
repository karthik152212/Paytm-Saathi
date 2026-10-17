from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..schemas.safety import ChecklistItemOut, SafetyAlertOut, SafetyResponse, SafetyRuleOut, SafetySummaryOut
from ..services import safety as safety_service
from .helpers import get_user_or_404

router = APIRouter(tags=["safety"])


@router.get("/api/safety/alerts", response_model=SafetyResponse)
def safety_alerts(user_id: str | None = None, db: Session = Depends(get_db)) -> SafetyResponse:
    user = get_user_or_404(db, user_id)
    alerts = safety_service.score_transactions(db, user.user_id)
    summary = safety_service.safety_summary(alerts)
    return SafetyResponse(
        user_id=user.user_id,
        alerts=[SafetyAlertOut(**alert) for alert in alerts],
        summary=SafetySummaryOut(**summary),
        rules=[SafetyRuleOut(**rule) for rule in safety_service.RULES],
        checklist=[ChecklistItemOut(**item) for item in safety_service.SAFETY_CHECKLIST],
    )

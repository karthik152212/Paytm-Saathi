from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..schemas.assistant import ChatRequest, ChatResponse, SuggestedQuestionsResponse
from ..services import assistant as assistant_service
from .helpers import get_user_or_404

router = APIRouter(tags=["assistant"])


@router.get("/api/assistant/suggested", response_model=SuggestedQuestionsResponse)
def suggested_questions() -> SuggestedQuestionsResponse:
    return SuggestedQuestionsResponse(
        questions=list(assistant_service.SUGGESTED_QUESTIONS), engine=assistant_service.ENGINE_NAME
    )


@router.post("/api/assistant/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, db: Session = Depends(get_db)) -> ChatResponse:
    user = get_user_or_404(db, payload.user_id)
    reply = assistant_service.answer(payload.message, db, user.user_id)
    return ChatResponse(
        reply=reply,
        engine=assistant_service.ENGINE_NAME,
        user_id=user.user_id,
        answered_at=datetime.now().replace(microsecond=0).isoformat(),
    )

from __future__ import annotations

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    user_id: str | None = None


class ChatResponse(BaseModel):
    reply: str
    engine: str
    user_id: str
    answered_at: str
    note: str = (
        "Rule-based prototype assistant. Answers are computed from your simulated demo data and are not "
        "financial advice."
    )


class SuggestedQuestionsResponse(BaseModel):
    questions: list[str]
    engine: str

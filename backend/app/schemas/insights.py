from __future__ import annotations

from pydantic import BaseModel


class InsightItem(BaseModel):
    id: str
    kind: str
    title: str
    body: str
    action: str | None = None


class InsightsResponse(BaseModel):
    user_id: str
    insight_text: str
    insights: list[InsightItem]
    generated_at: str

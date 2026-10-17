from __future__ import annotations

from pydantic import BaseModel


class RiskTriggerOut(BaseModel):
    code: str
    label: str
    weight: int
    explanation: str


class SafetyAlertOut(BaseModel):
    alert_id: str
    transaction_id: str
    score: int
    severity: str
    severity_label: str
    headline: str
    recommendation: str
    simple_description: str
    triggers: list[RiskTriggerOut]


class SafetyRuleOut(BaseModel):
    code: str
    title: str
    rule: str
    weight: int


class ChecklistItemOut(BaseModel):
    id: str
    title: str
    body: str


class SafetySummaryOut(BaseModel):
    high: int
    medium: int
    low: int
    total: int
    last_checked: str
    disclaimer: str


class SafetyResponse(BaseModel):
    user_id: str
    alerts: list[SafetyAlertOut]
    summary: SafetySummaryOut
    rules: list[SafetyRuleOut]
    checklist: list[ChecklistItemOut]

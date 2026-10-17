"""Deterministic, explainable safety scoring.

Ported from frontend/src/safety/riskScoring.ts. Four transparent rules, no
machine learning, and the word "fraud" is never used as a conclusion — an
alert only means "worth a second look".
"""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models
from . import finance
from .format import inr

RULES = [
    {
        "code": "flagged",
        "title": "Explicit demo marker",
        "rule": "The transaction is marked as suspicious inside the sample dataset.",
        "weight": 40,
    },
    {
        "code": "large-amount",
        "title": "Unusually large amount",
        "rule": "Amount is at least 5× your typical payment, and at least ₹5,000.",
        "weight": 25,
    },
    {
        "code": "burst",
        "title": "Burst of payments",
        "rule": "Three or more debits happen within a 60-minute window.",
        "weight": 25,
    },
    {
        "code": "unusual-hour",
        "title": "Unusual hour",
        "rule": "The payment happened between 12:00 AM and 5:00 AM.",
        "weight": 15,
    },
]

WEIGHTS = {rule["code"]: rule["weight"] for rule in RULES}

SAFETY_CHECKLIST = [
    {
        "id": "otp",
        "title": "Never share your OTP or UPI PIN",
        "body": 'No bank, wallet, police officer or "support agent" will ever ask for them. Anyone who does is not who they claim to be.',
    },
    {
        "id": "verify",
        "title": "Verify money requests independently",
        "body": 'If someone asks you to pay or "unlock" money, hang up and call the person or company on a number you already trust.',
    },
    {
        "id": "links",
        "title": "Do not open payment links from messages",
        "body": "Type the website or open the app yourself. Prize and refund links are the most common trap.",
    },
    {
        "id": "screenshare",
        "title": 'Never install an app to "confirm a refund"',
        "body": "Screen-sharing and remote-access apps give a stranger full control of your phone and your money.",
    },
    {
        "id": "limits",
        "title": "Keep your UPI limit low",
        "body": "Set a daily transfer limit you would not mind losing. It is the cheapest insurance you can buy.",
    },
    {
        "id": "review",
        "title": "Review your transactions weekly",
        "body": "Small unrecognised amounts are how testing starts. Catching ₹5 early is how you prevent losing ₹50,000 later.",
    },
]


def severity_for(score: int) -> str:
    if score >= 60:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


def severity_label(severity: str) -> str:
    if severity == "high":
        return "High — verify before acting"
    if severity == "medium":
        return "Needs review"
    return "Worth a quick check"


def simple_mode_description(severity: str) -> str:
    if severity == "high":
        return "This payment looks very different from your usual activity. Check it before you do anything else."
    if severity == "medium":
        return "This payment looks different from your usual activity. Check it before taking action."
    return "This payment is larger than usual. It may be perfectly fine — just confirm it."


def _burst_ids(transactions: list[models.Transaction]) -> set[str]:
    debits = sorted(
        ((t.transaction_id, t.transaction_date) for t in transactions if t.direction == "debit"),
        key=lambda item: item[1],
    )
    marked: set[str] = set()
    hour = timedelta(minutes=60)
    for i, (tid, stamp) in enumerate(debits):
        count = 1
        j = i + 1
        while j < len(debits) and debits[j][1] - stamp <= hour:
            count += 1
            j += 1
        if count >= 3:
            j = i
            while j < len(debits) and debits[j][1] - stamp <= hour:
                marked.add(debits[j][0])
                j += 1
    return marked


def _headline(triggers: list[dict]) -> str:
    codes = [t["code"] for t in triggers]
    if "flagged" in codes:
        return "Payment to an unknown merchant at an unusual hour"
    if "burst" in codes and len(triggers) > 1:
        return "Several payments in a short window"
    if "burst" in codes:
        return "Multiple payments within one hour"
    if "large-amount" in codes:
        return "Amount much larger than usual"
    return "Payment outside your usual pattern"


def _recommendation(severity: str, txn: models.Transaction) -> str:
    if severity == "high":
        return (
            f"Stop before you act. Do not share your OTP or UPI PIN with anyone. Independently verify this "
            f"{inr(txn.amount_paise)} payment — open your payment app directly (not through any link or call) "
            "and check whether you initiated it. If you did not, contact your bank using the number on the back "
            "of your card."
        )
    if severity == "medium":
        return (
            f"Review this {inr(txn.amount_paise)} payment to {txn.merchant}. If you recognise it, mark it as "
            "reviewed and continue. If you do not, verify it inside your payment app before making any further "
            "payment."
        )
    return (
        f"Check whether you made this {inr(txn.amount_paise)} payment to {txn.merchant}. Large but planned "
        "purchases are common — this is a gentle prompt, not an accusation."
    )


def score_transactions(db: Session, user_id: str) -> list[dict]:
    transactions = list(db.scalars(select(models.Transaction).where(models.Transaction.user_id == user_id)))
    median = finance.median_debit_paise(db, user_id)
    large_threshold = max(500_000, median * 5)
    bursts = _burst_ids(transactions)
    alerts: list[dict] = []

    for txn in transactions:
        if txn.direction != "debit":
            continue
        triggers: list[dict] = []
        if txn.demo_risk_flag:
            triggers.append(
                {
                    "code": "flagged",
                    "label": "Marked in demo data",
                    "weight": WEIGHTS["flagged"],
                    "explanation": txn.demo_flag_reason
                    or "This transaction is marked as suspicious in the sample data.",
                }
            )
        if txn.amount_paise >= large_threshold:
            triggers.append(
                {
                    "code": "large-amount",
                    "label": "Unusually large amount",
                    "weight": WEIGHTS["large-amount"],
                    "explanation": (
                        f"{inr(txn.amount_paise)} is well above your typical payment of about {inr(median)}. "
                        f"The rule triggers at {inr(large_threshold)} (5× your typical amount, minimum ₹5,000)."
                    ),
                }
            )
        if txn.transaction_id in bursts:
            triggers.append(
                {
                    "code": "burst",
                    "label": "Burst of payments",
                    "weight": WEIGHTS["burst"],
                    "explanation": (
                        "Three or more debits were recorded within the same 60-minute window — a pattern often "
                        "seen when an account is being drained."
                    ),
                }
            )
        if txn.transaction_date.hour < 5:
            triggers.append(
                {
                    "code": "unusual-hour",
                    "label": "Unusual hour",
                    "weight": WEIGHTS["unusual-hour"],
                    "explanation": (
                        f"This payment was made at {txn.transaction_date.strftime('%I:%M %p').lstrip('0')}, "
                        "between 12:00 AM and 5:00 AM — outside your usual activity window."
                    ),
                }
            )
        if not triggers:
            continue
        score = sum(t["weight"] for t in triggers)
        severity = severity_for(score)
        alerts.append(
            {
                "alert_id": f"alert-{txn.transaction_id}",
                "transaction_id": txn.transaction_id,
                "score": score,
                "severity": severity,
                "severity_label": severity_label(severity),
                "triggers": triggers,
                "headline": _headline(triggers),
                "recommendation": _recommendation(severity, txn),
                "simple_description": simple_mode_description(severity),
            }
        )

    alerts.sort(key=lambda a: (-a["score"], a["transaction_id"]))
    return alerts


def safety_summary(alerts: list[dict]) -> dict:
    return {
        "high": sum(1 for a in alerts if a["severity"] == "high"),
        "medium": sum(1 for a in alerts if a["severity"] == "medium"),
        "low": sum(1 for a in alerts if a["severity"] == "low"),
        "total": len(alerts),
        "last_checked": datetime.now().strftime("%d %b"),
        "disclaimer": (
            "Illustrative alerts computed from simulated data with four simple rules — not a production "
            "fraud-detection model, and never a claim that a payment is confirmed fraud."
        ),
    }

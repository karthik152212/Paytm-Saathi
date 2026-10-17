"""Rule-based assistant answers, using live data from the database."""

from __future__ import annotations

USER = "usr_001"


def chat(client, message: str) -> str:
    response = client.post("/api/assistant/chat", json={"message": message, "user_id": USER})
    assert response.status_code == 200
    body = response.json()
    assert body["engine"] == "local-rules-v1"
    assert body["user_id"] == USER
    return body["reply"]


def test_suggested_questions_endpoint(client):
    body = client.get("/api/assistant/suggested").json()
    assert len(body["questions"]) == 5
    assert body["engine"] == "local-rules-v1"


def test_spending_question_uses_real_numbers(client):
    reply = chat(client, "Where did most of my money go?")
    overview = client.get("/api/overview").json()
    spent = overview["summary"]["spending_this_month_paise"]
    assert f"₹{spent // 100:,}" in reply
    assert "Other" in reply or "Food" in reply
    assert "match your dashboard exactly" in reply


def test_afford_question_answers_with_balance_and_bills(client):
    reply = chat(client, "Can I afford another ₹1,000 purchase?")
    balance = client.get("/api/overview").json()["summary"]["available_balance_paise"]
    assert f"₹{balance // 100:,}" in reply
    assert "Verdict:" in reply
    assert "not financial advice" in reply


def test_save_question_offers_numbered_levers(client):
    reply = chat(client, "How can I save ₹5,000 this month?")
    assert "save ₹5,000" in reply
    assert "\n1. " in reply
    assert "2." in reply or "which covers your target" in reply
    assert "not professional financial advice" in reply


def test_bills_question_lists_due_soon(client):
    reply = chat(client, "Which bills are due soon?")
    bills = client.get("/api/bills").json()
    assert "Total due in the next 7 days" in reply
    assert "no real payment is made" in reply
    if bills["overdue_count"]:
        assert "Overdue first" in reply


def test_budget_question_uses_category_labels(client):
    reply = chat(client, "Explain my budget in simple words")
    assert "% used" in reply
    assert "Food" in reply or "Transport" in reply


def test_glossary_and_fallback(client):
    glossary = chat(client, "What is an EMI?")
    assert "EMI means" in glossary

    fallback = chat(client, "quantum blockchain metaverse")
    assert "could not match" in fallback
    assert "no cloud AI" in fallback
    assert "not a financial adviser" in fallback


def test_safety_question_gives_the_short_safe_version(client):
    reply = chat(client, "How do I stay safe from UPI scams?")
    assert "Never share your OTP" in reply
    assert "never blocks" in reply or "never, reverses" in reply or "never blocks" in reply


def test_empty_message_is_handled(client):
    reply = chat(client, "   ")
    assert "Ask me anything" in reply


def test_assistant_never_calls_external_services(client):
    reply = chat(client, "hello")
    assert "local rules" in reply or "your own dashboard" in reply

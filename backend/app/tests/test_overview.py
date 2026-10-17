"""Insights feed + overview hydration contract."""

from __future__ import annotations

from datetime import date

USER = "usr_001"


def test_insights_are_machine_readable_and_consistent(client):
    body = client.get("/api/insights", params={"user_id": USER}).json()
    assert body["user_id"] == USER
    assert body["insight_text"].strip()
    assert len(body["insights"]) >= 3
    for item in body["insights"]:
        assert item["id"] and item["title"] and item["body"]
        assert item["kind"] in ("info", "warn", "good", "action")

    overview = client.get("/api/overview", params={"user_id": USER}).json()
    assert overview["insight_text"] == body["insight_text"]
    assert len(overview["insights"]) == len(body["insights"])


def test_overview_contains_everything_the_frontend_needs(client):
    body = client.get("/api/overview", params={"user_id": USER}).json()
    assert body["user"]["user_id"] == USER
    assert len(body["accounts"]) == 1
    assert len(body["categories"]) == 6
    assert len(body["transactions"]) >= 20
    assert len(body["budgets"]) == 5
    assert len(body["goals"]) >= 3
    assert len(body["contributions"]) >= 3
    assert len(body["bills"]) >= 6
    assert len(body["weekly_series"]) == 7
    assert len(body["monthly_series"]) >= 4
    assert body["disclaimer"].startswith("All balances")
    summary = body["summary"]
    assert summary["available_balance_paise"] == body["accounts"][0]["balance_paise"]
    assert summary["days_left_in_month"] >= 0


def test_every_paise_field_has_a_matching_rupee_field(client):
    body = client.get("/api/overview", params={"user_id": USER}).json()
    checked = 0
    for collection in ("transactions", "budgets", "goals", "contributions", "bills"):
        for item in body[collection]:
            for key, value in item.items():
                if key.endswith("_paise") and isinstance(value, int):
                    rupees_key = key.replace("_paise", "_rupees")
                    if rupees_key in item:
                        assert abs(item[rupees_key] - value / 100) < 1e-6, f"{collection}.{rupees_key}"
                        checked += 1
    assert checked > 50


def test_summary_math_matches_the_documented_formula(client):
    summary = client.get("/api/overview", params={"user_id": USER}).json()["summary"]
    txns = client.get("/api/transactions", params={"user_id": USER}).json()["items"]
    month = date.today().strftime("%Y-%m")
    month_debits = sum(t["amount_paise"] for t in txns if t["direction"] == "debit" and t["transaction_date"][:7] == month)
    month_credits = sum(t["amount_paise"] for t in txns if t["direction"] == "credit" and t["transaction_date"][:7] == month)
    assert summary["spending_this_month_paise"] == month_debits
    assert summary["income_this_month_paise"] == month_credits
    assert summary["total_credits_paise"] == sum(t["amount_paise"] for t in txns if t["direction"] == "credit")
    assert summary["total_debits_paise"] == sum(t["amount_paise"] for t in txns if t["direction"] == "debit")


def test_demo_scenario_numbers_match_the_frontend_seed(client):
    """The professor demo depends on these exact figures."""
    body = client.get("/api/overview", params={"user_id": USER}).json()
    by_id = {t["transaction_id"]: t for t in body["transactions"]}

    chai = by_id["txn_001"]
    assert chai["merchant"] == "Chai Point"
    assert chai["amount_paise"] == 14_000

    neo = by_id["txn_010"]
    assert neo["merchant"] == "Neo Tech Store"
    assert neo["amount_paise"] == 899_900
    assert neo["demo_risk_flag"] is True
    assert neo["demo_flag_reason"]

    assert neo["transaction_date"][:7] == date.today().strftime("%Y-%m")
    assert body["summary"]["opening_balance_paise"] == 3_800_000

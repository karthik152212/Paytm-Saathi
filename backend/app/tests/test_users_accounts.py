"""Users, accounts and the documented balance formula."""

from __future__ import annotations

from sqlalchemy import select

from app import models
from app.services import finance

USER = "usr_001"


def test_list_users_and_get_user(client):
    listing = client.get("/api/users").json()
    assert listing["total_count"] >= 2
    ids = {u["user_id"] for u in listing["items"]}
    assert "usr_001" in ids and "usr_002" in ids

    user = client.get("/api/users/usr_001").json()
    assert user["display_name"] == "Aarav Sharma"
    assert user["demo_email"] == "aarav.sharma@example.com"
    assert user["is_demo_user"] is True


def test_unknown_user_is_404(client):
    assert client.get("/api/users/usr_999").status_code == 404
    assert client.get("/api/overview", params={"user_id": "usr_999"}).status_code == 404


def test_profile_update_persists(client):
    response = client.patch("/api/users/usr_002", json={"display_name": "Meera I."})
    assert response.status_code == 200
    assert response.json()["display_name"] == "Meera I."
    assert client.get("/api/users/usr_002").json()["display_name"] == "Meera I."


def test_accounts_include_computed_balance(client):
    listing = client.get("/api/accounts", params={"user_id": USER}).json()
    assert listing["total_count"] == 1
    account = listing["items"][0]
    assert account["opening_balance_paise"] == 3_800_000
    assert account["is_simulated"] is True
    assert account["balance_paise"] > 0


def test_balance_formula_matches_opening_plus_credits_minus_debits_and_contributions(client, seeded):
    txns = client.get("/api/transactions", params={"user_id": USER}).json()["items"]
    credits = sum(t["amount_paise"] for t in txns if t["direction"] == "credit")
    debits = sum(t["amount_paise"] for t in txns if t["direction"] == "debit")
    contributions = client.get("/api/goals", params={"user_id": USER}).json()["contributions"]
    total_contrib = sum(c["amount_paise"] for c in contributions)
    opening = client.get("/api/accounts", params={"user_id": USER}).json()["items"][0]["opening_balance_paise"]

    expected = opening + credits - debits - total_contrib
    actual = finance.available_balance_paise(seeded, USER)
    assert actual == expected
    assert client.get("/api/overview").json()["summary"]["available_balance_paise"] == expected


def test_secondary_user_has_no_transactions(client):
    listing = client.get("/api/transactions", params={"user_id": "usr_002"}).json()
    assert listing["total_count"] == 0
    assert client.get("/api/overview", params={"user_id": "usr_002"}).json()["summary"]["available_balance_paise"] == 500_000

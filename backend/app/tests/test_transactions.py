"""Transaction queries, filtering and detail retrieval."""

from __future__ import annotations

USER = "usr_001"


def test_list_transactions_sorted_newest_first(client):
    items = client.get("/api/transactions", params={"user_id": USER}).json()["items"]
    assert len(items) >= 20
    dates = [t["transaction_date"] for t in items]
    assert dates == sorted(dates, reverse=True)


def test_filter_by_direction_and_category(client):
    debits = client.get("/api/transactions", params={"user_id": USER, "direction": "debit"}).json()
    assert debits["total_count"] >= 20
    assert all(t["direction"] == "debit" for t in debits["items"])

    food = client.get("/api/transactions", params={"user_id": USER, "category_id": "food"}).json()
    assert food["total_count"] >= 4
    assert all(t["category_id"] == "food" for t in food["items"])
    assert all(t["category_label"] == "Food" for t in food["items"])


def test_search_query_matches_merchant(client):
    result = client.get("/api/transactions", params={"user_id": USER, "q": "zomato"}).json()
    assert result["total_count"] >= 1
    assert all("zomato" in t["merchant"].lower() for t in result["items"])

    empty = client.get("/api/transactions", params={"user_id": USER, "q": "zzz-not-a-merchant"}).json()
    assert empty["total_count"] == 0


def test_transaction_detail_and_404(client):
    txn = client.get("/api/transactions/txn_001").json()
    assert txn["merchant"] == "Chai Point"
    assert txn["amount_paise"] == 14_000
    assert txn["amount_rupees"] == 140.0
    assert client.get("/api/transactions/txn_999").status_code == 404


def test_invalid_direction_is_rejected(client):
    assert client.get("/api/transactions", params={"direction": "sideways"}).status_code == 422


def test_flagged_transaction_carries_demo_reason(client):
    flagged = [t for t in client.get("/api/transactions").json()["items"] if t["demo_risk_flag"]]
    assert len(flagged) == 1
    assert "Demo scenario" in flagged[0]["demo_flag_reason"]


def test_create_transaction_persists_and_appears_in_list(client, db):
    from app import models

    response = client.post(
        "/api/transactions",
        json={
            "account_id": "acc_001",
            "merchant": "Test Cafe",
            "amount_paise": 9_900,
            "direction": "debit",
            "category_id": "food",
            "description": "created by test, removed afterwards",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["transaction_id"].startswith("txn_")
    assert body["user_id"] == USER
    assert body["amount_rupees"] == 99.0

    detail = client.get(f"/api/transactions/{body['transaction_id']}").json()
    assert detail["merchant"] == "Test Cafe"

    listing = client.get("/api/transactions", params={"q": "Test Cafe"}).json()
    assert listing["total_count"] == 1

    db.query(models.Transaction).filter_by(transaction_id=body["transaction_id"]).delete()
    db.commit()
    assert client.get("/api/transactions", params={"q": "Test Cafe"}).json()["total_count"] == 0


def test_create_transaction_validation(client):
    base = {
        "account_id": "acc_001",
        "merchant": "Validation Cafe",
        "amount_paise": 1_000,
        "direction": "debit",
        "category_id": "food",
    }

    assert client.post("/api/transactions", json={**base, "account_id": "acc_missing"}).status_code == 404
    assert client.post("/api/transactions", json={**base, "user_id": "usr_999"}).status_code == 422
    assert client.post("/api/transactions", json={**base, "category_id": "cat_missing"}).status_code == 404
    assert client.post("/api/transactions", json={**base, "amount_paise": 0}).status_code == 422
    assert client.post("/api/transactions", json={**base, "amount_paise": -5}).status_code == 422
    assert client.post("/api/transactions", json={**base, "direction": "sideways"}).status_code == 422
    assert client.post("/api/transactions", json={**base, "merchant": ""}).status_code == 422

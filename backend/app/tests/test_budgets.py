"""Budget creation, updates and recalculation from transactions."""

from __future__ import annotations

from datetime import date

USER = "usr_001"


def test_budget_rows_derive_spent_from_transactions(client):
    body = client.get("/api/budgets", params={"user_id": USER}).json()
    current_month = date.today().strftime("%Y-%m")
    spending = {}
    for txn in client.get("/api/transactions", params={"user_id": USER, "direction": "debit"}).json()["items"]:
        if txn["transaction_date"][:7] == current_month:
            spending[txn["category_id"]] = spending.get(txn["category_id"], 0) + txn["amount_paise"]

    for item in body["items"]:
        assert item["spent_paise"] == spending.get(item["category_id"], 0)
        assert item["remaining_paise"] == item["monthly_limit_paise"] - item["spent_paise"]
        assert item["status"] in ("ok", "warning", "over")

    totals = body["totals"]
    assert totals["limit_paise"] == sum(i["monthly_limit_paise"] for i in body["items"])
    assert totals["spent_paise"] == sum(i["spent_paise"] for i in body["items"])


def test_update_budget_changes_limit_and_recalculates(client):
    before = next(b for b in client.get("/api/budgets").json()["items"] if b["category_id"] == "food")
    response = client.patch(f"/api/budgets/{before['budget_id']}", json={"monthly_limit_paise": 750_000})
    assert response.status_code == 200
    after = response.json()
    assert after["monthly_limit_paise"] == 750_000
    assert after["spent_paise"] == before["spent_paise"], "spent must not change when the limit changes"
    assert after["used_percent"] < before["used_percent"]


def test_create_budget_and_duplicate_conflict(client):
    created = client.post("/api/budgets", json={"category_id": "other", "monthly_limit_paise": 200_000})
    assert created.status_code == 201
    assert created.json()["category_id"] == "other"

    duplicate = client.post("/api/budgets", json={"category_id": "other", "monthly_limit_paise": 100_000})
    assert duplicate.status_code == 409

    client.delete(f"/api/budgets/{created.json()['budget_id']}")


def test_invalid_budget_limits_rejected(client):
    assert client.post("/api/budgets", json={"category_id": "food", "monthly_limit_paise": 0}).status_code == 422
    assert client.patch("/api/budgets/bud_food", json={"monthly_limit_paise": -5}).status_code == 422
    assert client.post("/api/budgets", json={"category_id": "nope", "monthly_limit_paise": 10_000}).status_code == 404


def test_delete_budget(client):
    created = client.post("/api/budgets", json={"category_id": "other", "monthly_limit_paise": 150_000}).json()
    assert client.delete(f"/api/budgets/{created['budget_id']}").status_code == 204
    assert client.delete(f"/api/budgets/{created['budget_id']}").status_code == 404

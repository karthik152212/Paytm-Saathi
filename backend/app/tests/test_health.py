"""Health endpoint and dataset availability."""

from __future__ import annotations


def test_health_reports_ok_and_storage_mode(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["storage_mode"] == "sqlite"
    assert body["seeded"] is True
    assert body["version"]
    assert "password" not in response.text.lower()
    assert "secret" not in response.text.lower()


def test_health_exposes_expected_record_counts(client):
    counts = client.get("/api/health").json()["record_counts"]
    assert counts["users"] >= 1
    assert counts["transactions"] >= 20
    assert counts["budgets"] >= 5
    assert counts["savings_goals"] >= 3
    assert counts["bills"] >= 6
    assert counts["categories"] == 6


def test_openapi_schema_lists_all_endpoints(client):
    paths = client.get("/openapi.json").json()["paths"]
    for path in (
        "/api/health",
        "/api/overview",
        "/api/users",
        "/api/users/{user_id}",
        "/api/accounts",
        "/api/accounts/{account_id}",
        "/api/transactions",
        "/api/transactions/{transaction_id}",
        "/api/budgets",
        "/api/budgets/{budget_id}",
        "/api/goals",
        "/api/goals/{goal_id}",
        "/api/goals/{goal_id}/contributions",
        "/api/bills",
        "/api/bills/{bill_id}",
        "/api/bills/{bill_id}/mark-paid",
        "/api/insights",
        "/api/safety/alerts",
        "/api/assistant/chat",
    ):
        assert path in paths, f"missing endpoint {path}"

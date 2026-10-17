"""Data survives a simulated backend restart (same file, new engine)."""

from __future__ import annotations

USER = "usr_001"


def test_edits_survive_a_restart(client, restart_engine):
    created = client.post(
        "/api/budgets", json={"category_id": "other", "monthly_limit_paise": 321_000}
    )
    assert created.status_code == 201
    client.patch("/api/users/usr_002", json={"display_name": "Meera Restart"})

    # the fixture disposed the cached engine; the next request rebuilds it
    budgets = client.get("/api/budgets").json()["items"]
    assert any(b["category_id"] == "other" and b["monthly_limit_paise"] == 321_000 for b in budgets)
    assert client.get("/api/users/usr_002").json()["display_name"] == "Meera Restart"
    assert client.get("/api/health").json()["record_counts"]["budgets"] == 6


def test_restarts_do_not_duplicate_seed_data(client, restart_engine):
    before = client.get("/api/health").json()["record_counts"]
    client.get("/api/health")
    after = client.get("/api/health").json()["record_counts"]
    assert before == after
    assert after["transactions"] == 30
    assert after["users"] == 2

"""Savings goals, contributions and validation."""

from __future__ import annotations

USER = "usr_001"


def test_goal_rows_include_progress(client):
    body = client.get("/api/goals", params={"user_id": USER}).json()
    assert body["total_count"] >= 3
    for goal in body["items"]:
        assert goal["remaining_paise"] == max(0, goal["target_amount_paise"] - goal["saved_amount_paise"])
        assert 0 <= goal["progress_percent"] <= 100
    assert len(body["contributions"]) >= 3


def test_contribution_updates_goal_and_creates_history(client):
    goal = client.get("/api/goals").json()["items"][0]
    response = client.post(f"/api/goals/{goal['goal_id']}/contributions", json={"amount_paise": 250_000})
    assert response.status_code == 201
    body = response.json()
    assert body["goal"]["saved_amount_paise"] == goal["saved_amount_paise"] + 250_000
    assert body["contribution"]["amount_paise"] == 250_000

    history = client.get(f"/api/goals/{goal['goal_id']}/contributions").json()
    assert any(c["amount_paise"] == 250_000 for c in history)


def test_invalid_contributions_rejected(client):
    goal_id = client.get("/api/goals").json()["items"][0]["goal_id"]
    assert client.post(f"/api/goals/{goal_id}/contributions", json={"amount_paise": 0}).status_code == 422
    assert client.post(f"/api/goals/{goal_id}/contributions", json={"amount_paise": -100}).status_code == 422
    assert client.post("/api/goals/goal_999/contributions", json={"amount_paise": 100}).status_code == 404


def test_create_update_and_delete_goal(client):
    created = client.post(
        "/api/goals",
        json={"title": "Test Goal", "target_amount_paise": 1_000_000, "saved_amount_paise": 0},
    )
    assert created.status_code == 201
    goal_id = created.json()["goal_id"]

    updated = client.patch(f"/api/goals/{goal_id}", json={"target_amount_paise": 2_000_000})
    assert updated.status_code == 200
    assert updated.json()["target_amount_paise"] == 2_000_000

    assert client.delete(f"/api/goals/{goal_id}").status_code == 204
    assert client.delete(f"/api/goals/{goal_id}").status_code == 404


def test_goal_validation(client):
    assert client.post("/api/goals", json={"title": "", "target_amount_paise": 100}).status_code == 422
    assert client.post("/api/goals", json={"title": "X", "target_amount_paise": -1}).status_code == 422

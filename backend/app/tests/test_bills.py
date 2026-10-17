"""Bills: listing, status changes, mark-paid (demo only) and deletion."""

from __future__ import annotations

from datetime import date

USER = "usr_001"


def test_bills_split_into_overdue_upcoming_paid(client):
    body = client.get("/api/bills", params={"user_id": USER}).json()
    assert body["overdue_count"] >= 1
    assert body["upcoming_count"] >= 3
    assert body["paid_count"] >= 1
    assert body["total_count"] == body["overdue_count"] + body["upcoming_count"] + body["paid_count"]
    overdue = [b for b in body["items"] if b["overdue"]]
    assert all(b["days_left"] < 0 for b in overdue)


def test_mark_paid_is_a_demo_state_change(client):
    bill = next(b for b in client.get("/api/bills").json()["items"] if b["status"] == "upcoming")
    response = client.post(f"/api/bills/{bill['bill_id']}/mark-paid")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "paid"
    assert body["paid_date"] is not None

    # undo via PATCH — no separate endpoint needed
    undone = client.patch(f"/api/bills/{bill['bill_id']}", json={"status": "upcoming"})
    assert undone.json()["status"] == "upcoming"
    assert undone.json()["paid_date"] is None


def test_create_update_delete_bill(client):
    created = client.post(
        "/api/bills",
        json={
            "title": "Library Fine",
            "amount_paise": 50_000,
            "due_date": date.today().isoformat(),
            "recurring": False,
            "category_id": "education",
        },
    )
    assert created.status_code == 201
    bill_id = created.json()["bill_id"]
    assert created.json()["days_left"] == 0

    updated = client.patch(f"/api/bills/{bill_id}", json={"amount_paise": 75_000})
    assert updated.json()["amount_paise"] == 75_000

    assert client.delete(f"/api/bills/{bill_id}").status_code == 204
    assert client.delete(f"/api/bills/{bill_id}").status_code == 404


def test_invalid_bill_payloads(client):
    assert client.post("/api/bills", json={"title": "", "amount_paise": 100, "due_date": "2026-01-01"}).status_code == 422
    assert (
        client.post("/api/bills", json={"title": "X", "amount_paise": 0, "due_date": "2026-01-01"}).status_code == 422
    )
    assert client.post("/api/bills/bill_999/mark-paid").status_code == 404

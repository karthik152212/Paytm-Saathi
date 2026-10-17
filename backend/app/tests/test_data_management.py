"""Data management: JSON export, timestamped backups, validated restore.

Every mutating test either restores a snapshot or deletes its own rows so the
exact-count assertions in later test modules (test_seed, test_persistence,
test_users_accounts) keep passing.
"""

from __future__ import annotations

import json
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from app import models
from app.config import get_settings
from app.main import app
from app.services import data_manager

USER = "usr_001"

ALL_ENTITIES = {
    "users",
    "accounts",
    "categories",
    "transactions",
    "budgets",
    "savings_goals",
    "goal_contributions",
    "bills",
    "monthly_history",
}


@pytest.fixture()
def local_client():
    """Client whose ASGI scope reports a loopback address (restore allows only
    loopback clients because the prototype has no authentication)."""
    with TestClient(app, client=("127.0.0.1", 50000)) as test_client:
        yield test_client


def _baseline_counts(client) -> dict:
    return client.get("/api/health").json()["record_counts"]


def _create_backup(client) -> str:
    response = client.post("/api/data/backups")
    assert response.status_code == 201, response.text
    return response.json()["backup"]


def _restore_snapshot(local_client, name) -> dict:
    response = local_client.post(
        f"/api/data/backups/{name}/restore",
        json={"mode": "snapshot", "confirm": True},
    )
    assert response.status_code == 200, response.text
    return response.json()


# ---------------------------------------------------------------- export


def test_export_downloads_versioned_json(client):
    response = client.get("/api/data/export")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert "attachment" in response.headers["content-disposition"]
    assert "saathi-export-" in response.headers["content-disposition"]

    payload = json.loads(response.text)
    assert payload["format"] == "paytm-saathi-export"
    assert payload["schema_version"] == "1.0"
    assert payload["source"] == "database"
    assert payload["exported_at"]
    assert set(payload["data"]) == ALL_ENTITIES
    for entity, records in payload["data"].items():
        assert payload["record_counts"][entity] == len(records)


def test_export_excludes_sensitive_fields(client):
    text = client.get("/api/data/export").text.lower()
    for banned in ("password", "secret", "token", "api_key", "hash"):
        assert banned not in text


def test_export_reflects_new_transaction(client, local_client):
    backup = _create_backup(client)
    before = _baseline_counts(client)
    try:
        created = client.post(
            "/api/transactions",
            json={
                "account_id": "acc_001",
                "merchant": "Data Management Cafe",
                "amount_paise": 12_300,
                "direction": "debit",
                "category_id": "food",
            },
        )
        assert created.status_code == 201, created.text
        txn_id = created.json()["transaction_id"]

        payload = client.get("/api/data/export").json()
        assert payload["record_counts"]["transactions"] == before["transactions"] + 1
        stored = next(t for t in payload["data"]["transactions"] if t["transaction_id"] == txn_id)
        assert stored["merchant"] == "Data Management Cafe"
        assert stored["amount_paise"] == 12_300
        assert stored["user_id"] == USER
    finally:
        _restore_snapshot(local_client, backup)
    assert _baseline_counts(client) == before


def test_export_reflects_budget_bill_and_goal_updates(client, local_client):
    backup = _create_backup(client)
    try:
        budgets = client.get("/api/budgets", params={"user_id": USER}).json()["items"]
        target_budget = budgets[0]
        patched = client.patch(
            f"/api/budgets/{target_budget['budget_id']}",
            json={"monthly_limit_paise": 777_700},
        )
        assert patched.status_code == 200, patched.text

        bills = client.get("/api/bills", params={"user_id": USER}).json()["items"]
        target_bill = next(b for b in bills if b["status"] != "paid")
        marked = client.post(f"/api/bills/{target_bill['bill_id']}/mark-paid")
        assert marked.status_code == 200, marked.text

        goals = client.get("/api/goals", params={"user_id": USER}).json()
        target_goal = goals["items"][0]
        contribution = client.post(
            f"/api/goals/{target_goal['goal_id']}/contributions",
            json={"amount_paise": 10_000},
        )
        assert contribution.status_code in (200, 201), contribution.text

        payload = client.get("/api/data/export").json()
        budget_row = next(b for b in payload["data"]["budgets"] if b["budget_id"] == target_budget["budget_id"])
        assert budget_row["monthly_limit_paise"] == 777_700

        bill_row = next(b for b in payload["data"]["bills"] if b["bill_id"] == target_bill["bill_id"])
        assert bill_row["status"] == "paid"
        assert bill_row["paid_date"] is not None

        goal_row = next(g for g in payload["data"]["savings_goals"] if g["goal_id"] == target_goal["goal_id"])
        assert goal_row["saved_amount_paise"] == target_goal["saved_amount_paise"] + 10_000
        contribution_id = contribution.json()["contribution"]["contribution_id"]
        assert any(c["contribution_id"] == contribution_id for c in payload["data"]["goal_contributions"])
    finally:
        _restore_snapshot(local_client, backup)


# ---------------------------------------------------------------- backups


def test_backup_create_lists_and_validates(client):
    before = _baseline_counts(client)
    created = client.post("/api/data/backups")
    assert created.status_code == 201, created.text
    body = created.json()
    name = body["backup"]

    assert name.startswith("backup-")
    assert body["status"] == "created"
    manifest = body["manifest"]
    assert manifest["format"] == "paytm-saathi-backup"
    assert manifest["schema_version"] == "1.0"
    assert manifest["status"] == "complete"
    assert manifest["entities"]["transactions"] == before["transactions"]
    assert manifest["entities"]["users"] == before["users"]

    target = get_settings().backup_dir / name
    assert target.is_dir()
    for filename in (
        "manifest.json",
        "users.json",
        "accounts.json",
        "categories.json",
        "transactions.json",
        "budgets.json",
        "savings_goals.json",
        "goal_contributions.json",
        "bills.json",
        "monthly_history.json",
    ):
        assert (target / filename).is_file()

    listing = client.get("/api/data/backups").json()
    entry = next(i for i in listing["items"] if i["name"] == name)
    assert entry["status"] == "complete"
    assert entry["schema_version"] == "1.0"
    assert entry["total_records"] == sum(before.values())
    assert listing["total_count"] >= 1

    detail = client.get(f"/api/data/backups/{name}").json()
    assert detail["schema_version"] == "1.0"

    report = client.post(f"/api/data/backups/{name}/validate").json()
    assert report["valid"] is True
    assert report["errors"] == []


def test_backup_creation_requires_admin_flag(client, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr("app.api.data.get_settings", lambda: replace(settings, allow_data_admin=False))
    assert client.post("/api/data/backups").status_code == 403


def test_incomplete_backup_is_listed_but_not_restorable(client, local_client):
    name = _create_backup(client)
    (get_settings().backup_dir / name / "manifest.json").unlink()

    listing = client.get("/api/data/backups").json()
    entry = next(i for i in listing["items"] if i["name"] == name)
    assert entry["status"] == "incomplete"

    report = client.post(f"/api/data/backups/{name}/validate").json()
    assert report["valid"] is False
    assert any("manifest" in error for error in report["errors"])

    response = local_client.post(
        f"/api/data/backups/{name}/restore",
        json={"mode": "snapshot", "confirm": True},
    )
    assert response.status_code == 400


# ---------------------------------------------------------------- restore


def test_restore_snapshot_round_trip(client, local_client):
    backup = _create_backup(client)
    before = _baseline_counts(client)

    budgets = client.get("/api/budgets", params={"user_id": USER}).json()["items"]
    victim_budget = budgets[0]["budget_id"]
    assert client.delete(f"/api/budgets/{victim_budget}").status_code == 204
    junk = client.post(
        "/api/transactions",
        json={
            "account_id": "acc_001",
            "merchant": "Junk Row",
            "amount_paise": 500,
            "direction": "debit",
            "category_id": "food",
        },
    )
    assert junk.status_code == 201

    during = _baseline_counts(client)
    assert during["transactions"] == before["transactions"] + 1
    assert during["budgets"] == before["budgets"] - 1

    result = _restore_snapshot(local_client, backup)
    assert result["status"] == "restored"
    assert result["mode"] == "snapshot"
    assert result["schema_version"] == "1.0"
    assert result["deleted"]["transactions"] == during["transactions"]
    assert result["inserted"]["transactions"] == before["transactions"]
    assert result["record_counts"] == before

    assert _baseline_counts(client) == before
    ids = {b["budget_id"] for b in client.get("/api/budgets", params={"user_id": USER}).json()["items"]}
    assert victim_budget in ids


def test_restore_merge_imports_only_missing_records(client, local_client):
    backup = _create_backup(client)
    before = _baseline_counts(client)

    budgets = client.get("/api/budgets", params={"user_id": USER}).json()["items"]
    victim = budgets[-1]["budget_id"]
    assert client.delete(f"/api/budgets/{victim}").status_code == 204

    response = local_client.post(
        f"/api/data/backups/{backup}/restore",
        json={"mode": "merge", "confirm": True, "entities": ["budgets"]},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "merged"
    assert body["inserted"]["budgets"] == 1
    assert body["skipped"]["budgets"] == before["budgets"] - 1
    assert body["record_counts"]["budgets"] == before["budgets"]
    assert body["record_counts"]["transactions"] == before["transactions"]

    ids = {b["budget_id"] for b in client.get("/api/budgets", params={"user_id": USER}).json()["items"]}
    assert victim in ids


def test_restore_requires_explicit_confirmation(local_client):
    response = local_client.post(
        "/api/data/backups/backup-anything/restore",
        json={"mode": "snapshot", "confirm": False},
    )
    assert response.status_code == 400
    assert "confirm" in response.json()["detail"]


def test_restore_restricted_to_loopback_clients(client):
    response = client.post(
        "/api/data/backups/backup-anything/restore",
        json={"mode": "snapshot", "confirm": True},
    )
    assert response.status_code == 403
    assert "loopback" in response.json()["detail"]


def test_restore_requires_admin_flag(local_client, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr("app.api.data.get_settings", lambda: replace(settings, allow_data_admin=False))
    response = local_client.post(
        "/api/data/backups/backup-anything/restore",
        json={"mode": "snapshot", "confirm": True},
    )
    assert response.status_code == 403
    assert "SAATHI_ALLOW_DATA_ADMIN" in response.json()["detail"]


def test_snapshot_restore_rejects_entities_filter(client, local_client):
    backup = _create_backup(client)
    response = local_client.post(
        f"/api/data/backups/{backup}/restore",
        json={"mode": "snapshot", "confirm": True, "entities": ["budgets"]},
    )
    assert response.status_code == 400


def test_failed_restore_rolls_back(client, local_client, monkeypatch):
    backup = _create_backup(client)
    before = _baseline_counts(client)

    real_insert = data_manager._insert_records

    def exploding_insert(db, payload, entities):
        real_insert(db, payload, entities)
        raise RuntimeError("simulated failure during restore")

    monkeypatch.setattr(data_manager, "_insert_records", exploding_insert)
    with pytest.raises(RuntimeError, match="simulated failure"):
        local_client.post(
            f"/api/data/backups/{backup}/restore",
            json={"mode": "snapshot", "confirm": True},
        )

    assert _baseline_counts(client) == before


def test_unknown_backup_returns_404(client, local_client):
    assert client.get("/api/data/backups/backup-does-not-exist").status_code == 404
    assert client.post("/api/data/backups/backup-does-not-exist/validate").status_code == 404
    assert local_client.post(
        "/api/data/backups/backup-does-not-exist/restore",
        json={"mode": "snapshot", "confirm": True},
    ).status_code == 404


def test_invalid_backup_name_rejected(client):
    assert client.post("/api/data/backups/bad..name/validate").status_code == 400
    assert client.post("/api/data/backups/%2e%2e/validate").status_code in (400, 404)


# ------------------------------------------------- malformed backup payloads


def _backup_with(client, mutate) -> str:
    name = _create_backup(client)
    mutate(get_settings().backup_dir / name)
    return name


def test_validate_rejects_malformed_json(client, local_client):
    def corrupt(target):
        (target / "transactions.json").write_text("{not json", encoding="utf-8")

    name = _backup_with(client, corrupt)
    report = client.post(f"/api/data/backups/{name}/validate").json()
    assert report["valid"] is False
    assert any("transactions.json" in error and "valid JSON" in error for error in report["errors"])

    response = local_client.post(
        f"/api/data/backups/{name}/restore",
        json={"mode": "snapshot", "confirm": True},
    )
    assert response.status_code == 400


def test_validate_rejects_unsupported_schema_version(client, local_client):
    def bump_version(target):
        manifest_path = target / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["schema_version"] = "99.0"
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    name = _backup_with(client, bump_version)
    report = client.post(f"/api/data/backups/{name}/validate").json()
    assert report["valid"] is False
    assert any("schema_version" in error for error in report["errors"])
    assert report["schema_version"] == "99.0"

    response = local_client.post(
        f"/api/data/backups/{name}/restore",
        json={"mode": "snapshot", "confirm": True},
    )
    assert response.status_code == 400


def test_validate_rejects_missing_file(client):
    def remove_file(target):
        (target / "bills.json").unlink()

    name = _backup_with(client, remove_file)
    report = client.post(f"/api/data/backups/{name}/validate").json()
    assert report["valid"] is False
    assert any("bills.json" in error and "Missing" in error for error in report["errors"])


def test_validate_rejects_duplicate_ids(client):
    def duplicate_row(target):
        path = target / "transactions.json"
        records = json.loads(path.read_text(encoding="utf-8"))
        records.append(dict(records[0]))
        path.write_text(json.dumps(records), encoding="utf-8")

    name = _backup_with(client, duplicate_row)
    report = client.post(f"/api/data/backups/{name}/validate").json()
    assert report["valid"] is False
    assert any("duplicate id" in error for error in report["errors"])


def test_validate_rejects_invalid_relationships(client):
    def ghost_user(target):
        path = target / "transactions.json"
        records = json.loads(path.read_text(encoding="utf-8"))
        records[0]["user_id"] = "usr_ghost"
        path.write_text(json.dumps(records), encoding="utf-8")

    name = _backup_with(client, ghost_user)
    report = client.post(f"/api/data/backups/{name}/validate").json()
    assert report["valid"] is False
    assert any("usr_ghost" in error and "users.user_id" in error for error in report["errors"])


def test_validate_rejects_manifest_count_mismatch(client):
    def skew_counts(target):
        manifest_path = target / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["entities"]["transactions"] += 1
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    name = _backup_with(client, skew_counts)
    report = client.post(f"/api/data/backups/{name}/validate").json()
    assert report["valid"] is False
    assert any("manifest declares" in error for error in report["errors"])

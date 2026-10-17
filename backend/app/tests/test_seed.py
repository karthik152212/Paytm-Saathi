"""Dataset loading, seeding idempotency and the guarded reseed endpoint."""

from __future__ import annotations

from app.data import loader
from app.seed import is_seeded, reseed_database, seed_if_empty, seeded_counts


def test_dataset_files_are_present_and_well_formed():
    assert loader.datasets_available()
    users = loader.load_records("users.json")
    assert len(users) >= 1
    assert users[0]["user_id"] == "usr_001"
    assert users[0]["demo_email"].endswith("@example.com")
    transactions = loader.load_records("transactions.json")
    assert len(transactions) == 30
    assert all(t["amount_paise"] > 0 for t in transactions)
    assert any(t["demo_risk_flag"] for t in transactions)
    scenarios = loader.load_records("safety_scenarios.json")
    assert len(scenarios) == 4
    assert any(s["should_raise_alert"] is False for s in scenarios)


def test_seed_is_idempotent(client, db):
    before = seeded_counts(db)
    again = seed_if_empty(db)
    assert again is False, "second startup must not re-import"
    assert seeded_counts(db) == before


def test_reseed_restores_original_state(client, db):
    client.patch("/api/budgets/bud_food", json={"monthly_limit_paise": 999_999_00})
    response = client.post("/api/dev/reseed")
    assert response.status_code == 200
    budgets = client.get("/api/budgets").json()["items"]
    food = next(b for b in budgets if b["category_id"] == "food")
    assert food["monthly_limit_paise"] == 600_000
    assert is_seeded(db)


def test_reseed_is_disabled_without_flag(monkeypatch):
    from app.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("SAATHI_ALLOW_RESET", "0")
    get_settings.cache_clear()
    try:
        response = client_post_reseed_without_flag()
        assert response == 403
    finally:
        monkeypatch.setenv("SAATHI_ALLOW_RESET", "1")
        get_settings.cache_clear()


def client_post_reseed_without_flag() -> int:
    """Call the reseed route directly with reset disabled via the settings check."""
    from fastapi import HTTPException

    from app.api import dev
    from app.db import get_session_factory

    session = get_session_factory()()
    try:
        dev.reseed(db=session)
    except HTTPException as exc:
        return exc.status_code
    finally:
        session.close()
    return 200


def test_reseed_database_function_rebuilds_counts(db):
    counts = reseed_database(db)
    assert counts["transactions"] == 30
    assert counts["users"] >= 1

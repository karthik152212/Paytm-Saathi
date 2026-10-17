"""Shared pytest fixtures.

The environment variables MUST be set before any app import, which is why
they live at module scope in this file (pytest imports conftest first).
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="saathi-tests-"))
os.environ["SAATHI_DATABASE_URL"] = f"sqlite:///{(_TMP / 'test.db').as_posix()}"
os.environ["SAATHI_SEED_ON_START"] = "1"
os.environ["SAATHI_ALLOW_RESET"] = "1"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import dispose_engine, get_session_factory, init_db  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import is_seeded, seed_if_empty  # noqa: E402

USER = "usr_001"


@pytest.fixture(scope="session")
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def db():
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def seeded(db):
    """Make sure each test starts from the imported dataset state."""
    init_db()
    if not is_seeded(db):
        seed_if_empty(db)
    return db


@pytest.fixture()
def restart_engine():
    """Simulate a backend process restart (dispose the cached engine)."""
    dispose_engine()
    init_db()
    yield
    dispose_engine()
    init_db()

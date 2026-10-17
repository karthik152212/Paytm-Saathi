"""Paytm Saathi backend — runtime configuration.

Every value is read from environment variables with safe local defaults, so
the backend runs out of the box on a laptop with no configuration at all.
Nothing here is a secret; see .env.example at the repository root.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

APP_NAME = "Paytm Saathi API"
APP_VERSION = "1.0.0"

BACKEND_DIR = Path(__file__).resolve().parents[1]  # .../backend
REPO_ROOT = BACKEND_DIR.parent
DEFAULT_DATASETS_DIR = REPO_ROOT / "datasets"
DEFAULT_DB_PATH = BACKEND_DIR / "runtime" / "saathi.db"


def _env(name: str, default: str) -> str:
    value = os.environ.get(name, "").strip()
    return value or default


@dataclass(frozen=True)
class Settings:
    app_name: str
    version: str
    database_url: str
    datasets_dir: Path
    default_user_id: str
    seed_on_start: bool
    allow_reset: bool
    storage_mode: str

    @property
    def database_file(self) -> Path | None:
        if not self.database_url.startswith("sqlite///") and not self.database_url.startswith("sqlite:///"):
            return None
        raw = self.database_url.replace("sqlite:///", "", 1)
        if raw in ("", ":memory:"):
            return None
        return Path(raw).resolve()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    database_url = _env("SAATHI_DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH.as_posix()}")
    datasets_dir = Path(_env("SAATHI_DATASETS_DIR", str(DEFAULT_DATASETS_DIR))).resolve()
    seed_on_start = _env("SAATHI_SEED_ON_START", "1") != "0"
    allow_reset = _env("SAATHI_ALLOW_RESET", "0") == "1"
    storage_mode = "sqlite" if database_url.startswith("sqlite") else "external-database"
    return Settings(
        app_name=APP_NAME,
        version=APP_VERSION,
        database_url=database_url,
        datasets_dir=datasets_dir,
        default_user_id=_env("SAATHI_DEFAULT_USER_ID", "usr_001"),
        seed_on_start=seed_on_start,
        allow_reset=allow_reset,
        storage_mode=storage_mode,
    )

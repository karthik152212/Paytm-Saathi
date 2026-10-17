"""Reads the fictional JSON datasets from datasets/ and turns them into rows.

The JSON files are the *seed source*. SQLite is the *runtime store*. This
module is the only place that touches the JSON files.
"""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

from ..config import get_settings

REQUIRED_FILES = (
    "users.json",
    "accounts.json",
    "categories.json",
    "transactions.json",
    "budgets.json",
    "savings_goals.json",
    "bills.json",
    "monthly_history.json",
    "safety_scenarios.json",
)


def dataset_path(name: str) -> Path:
    return get_settings().datasets_dir / name


def load_records(name: str) -> list[dict[str, Any]]:
    """Load one dataset file. Supports either {"records": [...]} or a bare list."""
    path = dataset_path(name)
    if not path.exists():
        raise FileNotFoundError(f"Dataset file not found: {path}")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and isinstance(payload.get("records"), (list, dict)):
        records = payload["records"]
        if isinstance(records, dict):
            # savings_goals.json stores {"goals": [...], "contributions": [...]}
            return [records]
        return records
    raise ValueError(f"Dataset file {name} has an unexpected shape")


def load_raw(name: str) -> Any:
    """Load a dataset file without the records-list assumption."""
    path = dataset_path(name)
    if not path.exists():
        raise FileNotFoundError(f"Dataset file not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def datasets_available() -> bool:
    return all(dataset_path(name).exists() for name in REQUIRED_FILES)


def resolve_datetime(hint: Any, fallback: str, now: datetime) -> datetime:
    """Resolve a seed date hint relative to *now*.

    Hints keep the demo scenario anchored to "today" so the app always looks
    current, no matter when the database is first seeded. Without a hint the
    absolute ISO value stored in the dataset is used.
    """
    if isinstance(hint, dict):
        kind = hint.get("kind")
        if kind == "day":
            day = max(1, now.day - int(hint.get("days_ago", 0)))
            stamp = datetime(now.year, now.month, day, int(hint.get("hour", 12)), int(hint.get("minute", 0)))
            if stamp > now:
                stamp = now - timedelta(minutes=11)
            return stamp
        if kind == "prev_month":
            first_of_this = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            prev_first = first_of_this - timedelta(days=1)
            return prev_first.replace(
                day=int(hint.get("day", 1)),
                hour=int(hint.get("hour", 12)),
                minute=int(hint.get("minute", 0)),
            )
        if kind == "offset_days":
            return datetime.combine(now.date() + timedelta(days=int(hint.get("offset", 0))), datetime.min.time())
    return parse_datetime(fallback)


def resolve_date(hint: Any, fallback: str, now: datetime) -> date:
    return resolve_datetime(hint, fallback, now).date()


def parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1]
    if "T" in text:
        return datetime.fromisoformat(text)
    return datetime.fromisoformat(text + "T00:00:00")


def parse_date(value: str | None) -> date | None:
    stamp = parse_datetime(value)
    return stamp.date() if stamp else None

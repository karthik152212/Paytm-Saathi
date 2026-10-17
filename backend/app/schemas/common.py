"""Shared schema helpers."""

from __future__ import annotations

from datetime import date, datetime


def rupees(paise: int) -> float:
    """Derived convenience value. paise remains the authoritative field."""
    return round(paise / 100, 2)


def iso_date(value: date | None) -> str | None:
    """Serialise a date as a naive-local datetime string the JS Date parses
    as local midnight in every timezone."""
    return f"{value.isoformat()}T00:00:00" if value else None


def iso_datetime(value: datetime | None) -> str | None:
    return value.replace(microsecond=0).isoformat() if value else None

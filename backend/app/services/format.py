"""Display formatting helpers (Indian rupee grouping).

These are used only when generating human-readable text (insights, safety
explanations, assistant answers). Authoritative maths never goes through here.
"""

from __future__ import annotations


def _group_indian(digits: str) -> str:
    if len(digits) <= 3:
        return digits
    last3 = digits[-3:]
    rest = digits[:-3]
    parts: list[str] = []
    while len(rest) > 2:
        parts.insert(0, rest[-2:])
        rest = rest[:-2]
    if rest:
        parts.insert(0, rest)
    return ",".join(parts + [last3])


def rupees(paise: int) -> float:
    return round(paise / 100, 2)


def inr(paise: int) -> str:
    """₹12,345 — Indian digit grouping, rounded to whole rupees."""
    n = int(round(paise / 100))
    sign = "-" if n < 0 else ""
    return f"{sign}₹{_group_indian(str(abs(n)))}"


def inr_plain(paise: int) -> str:
    """12,345 — grouping without the ₹ symbol."""
    n = int(round(paise / 100))
    return _group_indian(str(abs(n)))

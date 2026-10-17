"""Shared helpers for API modules."""

from __future__ import annotations

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models
from ..config import get_settings
from ..db import get_db


def get_user_or_404(db: Session, user_id: str | None) -> models.User:
    settings = get_settings()
    resolved = user_id or settings.default_user_id
    user = db.get(models.User, resolved)
    if user is None:
        raise HTTPException(status_code=404, detail=f"Unknown user_id '{resolved}'")
    return user


def category_labels(db: Session) -> dict[str, str]:
    from sqlalchemy import select

    return {c.category_id: c.display_label for c in db.scalars(select(models.Category))}


DbSession = Depends(get_db)

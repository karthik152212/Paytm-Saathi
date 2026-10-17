from __future__ import annotations

import json
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models


def list_users(db: Session) -> list[models.User]:
    return list(db.scalars(select(models.User).order_by(models.User.user_id)))


def get_user(db: Session, user_id: str) -> models.User | None:
    return db.get(models.User, user_id)


def update_user(
    db: Session,
    user: models.User,
    *,
    display_name: str | None = None,
    subtitle: str | None = None,
    accessibility_preferences: dict | None = None,
) -> models.User:
    if display_name is not None:
        user.display_name = display_name
    if subtitle is not None:
        user.subtitle = subtitle
    if accessibility_preferences is not None:
        user.accessibility_preferences = json.dumps(accessibility_preferences)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def accessibility_dict(user: models.User) -> dict:
    try:
        parsed = json.loads(user.accessibility_preferences or "{}")
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}

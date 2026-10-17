from __future__ import annotations

from pydantic import BaseModel, Field

from .common import iso_datetime


class UserOut(BaseModel):
    user_id: str
    display_name: str
    subtitle: str | None = None
    demo_email: str
    preferred_language: str
    accessibility_preferences: dict
    created_at: str | None = None
    is_demo_user: bool

    @classmethod
    def from_model(cls, user) -> "UserOut":
        import json

        try:
            prefs = json.loads(user.accessibility_preferences or "{}")
        except json.JSONDecodeError:
            prefs = {}
        return cls(
            user_id=user.user_id,
            display_name=user.display_name,
            subtitle=user.subtitle,
            demo_email=user.demo_email,
            preferred_language=user.preferred_language,
            accessibility_preferences=prefs if isinstance(prefs, dict) else {},
            created_at=iso_datetime(user.created_at),
            is_demo_user=user.is_demo_user,
        )


class UserUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    subtitle: str | None = Field(default=None, max_length=160)
    accessibility_preferences: dict | None = None


class UserListResponse(BaseModel):
    items: list[UserOut]
    total_count: int

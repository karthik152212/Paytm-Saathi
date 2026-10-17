from __future__ import annotations

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    app: str
    version: str
    storage_mode: str
    seeded: bool
    dataset_dir: str
    database_file: str | None
    default_user_id: str
    allow_reset: bool
    record_counts: dict[str, int]
    server_time: str

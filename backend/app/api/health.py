from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..seed import is_seeded, seeded_counts

router = APIRouter(tags=["general"])


@router.get("/api/health")
def health(db: Session = Depends(get_db)) -> dict:
    """Liveness + configuration summary. Contains no secrets."""
    settings = get_settings()
    db_file = settings.database_file
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": settings.version,
        "storage_mode": settings.storage_mode,
        "seeded": is_seeded(db),
        "dataset_dir": str(settings.datasets_dir),
        "database_file": str(db_file) if db_file else None,
        "default_user_id": settings.default_user_id,
        "allow_reset": settings.allow_reset,
        "record_counts": seeded_counts(db),
        "server_time": datetime.now().replace(microsecond=0).isoformat(),
    }

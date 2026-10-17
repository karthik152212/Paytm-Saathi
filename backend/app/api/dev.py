from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..seed import reseed_database

router = APIRouter(tags=["development"])


@router.post("/api/dev/reseed")
def reseed(db: Session = Depends(get_db)) -> dict:
    """DESTRUCTIVE. Drops every row and re-imports datasets/*.json.

    Disabled (403) unless the backend is started with SAATHI_ALLOW_RESET=1,
    which is intended for local development and the professor demo only.
    """
    settings = get_settings()
    if not settings.allow_reset:
        raise HTTPException(
            status_code=403,
            detail="Reseeding is disabled. Start the backend with SAATHI_ALLOW_RESET=1 to enable it.",
        )
    counts = reseed_database(db)
    return {"status": "reseeded", "record_counts": counts}

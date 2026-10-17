"""Data management endpoints: JSON export, backups, validated restore.

Access model (documented limitation — this prototype has no authentication):
* GET export / list / validate are read-only and always available.
* POST backups and POST restore require SAATHI_ALLOW_DATA_ADMIN=1.
* Restore additionally requires a loopback client address and an explicit
  confirm:true body. This is a local/admin workflow, not real security.
"""

from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..schemas.data import (
    BackupCreatedResponse,
    BackupListItemOut,
    BackupListResponse,
    BackupManifestOut,
    RestoreRequest,
    RestoreResultOut,
    ValidationReportOut,
)
from ..services import data_manager

router = APIRouter(tags=["data"])

_LOOPBACK_HOSTS = {"127.0.0.1", "::1"}


def _require_data_admin() -> None:
    settings = get_settings()
    if not settings.allow_data_admin:
        raise HTTPException(
            status_code=403,
            detail=(
                "Backup creation and restore are disabled. "
                "Start the backend with SAATHI_ALLOW_DATA_ADMIN=1 to enable them (local development only)."
            ),
        )


def _require_restore_access(request: Request) -> None:
    _require_data_admin()
    host = request.client.host if request.client else ""
    if host not in _LOOPBACK_HOSTS:
        raise HTTPException(
            status_code=403,
            detail=(
                "Restore is restricted to local (loopback) clients. "
                "There is no authentication in this prototype; run restore from the backend host itself."
            ),
        )


def _map_data_error(exc: data_manager.DataError) -> HTTPException:
    if isinstance(exc, data_manager.InvalidBackupNameError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, data_manager.BackupNotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, data_manager.BackupValidationError):
        return HTTPException(status_code=400, detail={"message": "Backup validation failed", "errors": exc.errors})
    return HTTPException(status_code=400, detail=str(exc))


@router.get("/api/data/export")
def export_data(db: Session = Depends(get_db)) -> Response:
    """Download the current database contents as a versioned JSON document.

    Reads live database records (not seed files). Passwords/tokens are not
    part of the schema and therefore never exported.
    """
    payload = data_manager.build_export(db)
    content = json.dumps(payload, ensure_ascii=False, indent=2)
    filename = data_manager.export_filename()
    return Response(
        content=content.encode("utf-8"),
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/api/data/backups", response_model=BackupCreatedResponse, status_code=201)
def create_backup(db: Session = Depends(get_db)) -> BackupCreatedResponse:
    """Create a timestamped backup under the configured backup directory."""
    _require_data_admin()
    result = data_manager.create_backup(db)
    return BackupCreatedResponse(
        status="created",
        backup=result["name"],
        manifest=BackupManifestOut(**result["manifest"]),
    )


@router.get("/api/data/backups", response_model=BackupListResponse)
def list_backups() -> BackupListResponse:
    items = [BackupListItemOut(**item) for item in data_manager.list_backups()]
    return BackupListResponse(items=items, total_count=len(items))


@router.get("/api/data/backups/{name}", response_model=BackupManifestOut)
def get_backup(name: str) -> BackupManifestOut:
    try:
        manifest = data_manager.get_backup_manifest(name)
    except data_manager.DataError as exc:
        raise _map_data_error(exc) from exc
    return BackupManifestOut(**manifest)


@router.post("/api/data/backups/{name}/validate", response_model=ValidationReportOut)
def validate_backup(name: str) -> ValidationReportOut:
    """Validate a backup without touching the database."""
    try:
        report = data_manager.validate_backup(name)
    except data_manager.DataError as exc:
        raise _map_data_error(exc) from exc
    return ValidationReportOut(**report)


@router.post("/api/data/backups/{name}/restore", response_model=RestoreResultOut)
def restore_backup(
    name: str,
    payload: RestoreRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> RestoreResultOut:
    """Restore a validated backup (snapshot replace or merge import).

    Destructive (snapshot) and import (merge) operations are only attempted
    after validation succeeds, inside a single transaction that rolls back on
    any failure. Requires SAATHI_ALLOW_DATA_ADMIN=1, a loopback client, and
    confirm=true in the request body.
    """
    _require_restore_access(request)
    if not payload.confirm:
        raise HTTPException(
            status_code=400,
            detail="Restoring replaces or imports data. Repeat the request with confirm=true to proceed.",
        )
    if payload.entities is not None:
        if payload.mode != "merge":
            raise HTTPException(status_code=400, detail="The 'entities' filter only applies to merge restores")
        if not payload.entities:
            raise HTTPException(status_code=400, detail="'entities' must not be an empty list")
        unknown = [e for e in payload.entities if e not in data_manager.ENTITY_MODELS]
        if unknown:
            raise HTTPException(status_code=400, detail=f"Unknown entities: {', '.join(unknown)}")
    try:
        result = data_manager.restore_backup(
            name, mode=payload.mode, entities=payload.entities, db=db
        )
    except data_manager.DataError as exc:
        raise _map_data_error(exc) from exc
    return RestoreResultOut(**result)

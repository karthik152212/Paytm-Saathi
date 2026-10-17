"""Schemas for data management (export / backup / restore)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class BackupManifestOut(BaseModel):
    format: str
    schema_version: str
    app_version: str
    created_at: str
    status: str
    storage_mode: str | None = None
    entities: dict[str, int]
    files: dict[str, str]


class BackupListItemOut(BaseModel):
    name: str
    status: str
    schema_version: str | None = None
    created_at: str | None = None
    entity_counts: dict[str, int]
    total_records: int
    size_bytes: int


class BackupListResponse(BaseModel):
    items: list[BackupListItemOut]
    total_count: int


class BackupCreatedResponse(BaseModel):
    status: str
    backup: str
    manifest: BackupManifestOut


class ValidationReportOut(BaseModel):
    backup: str
    valid: bool
    schema_version: str | None = None
    status: str | None = None
    entity_counts: dict[str, int]
    errors: list[str]


class RestoreRequest(BaseModel):
    mode: Literal["snapshot", "merge"] = "snapshot"
    confirm: bool = Field(
        default=False,
        description="Must be true. Destructive restores never happen implicitly.",
    )
    entities: list[str] | None = Field(
        default=None,
        description="Merge mode only: restrict the import to these entity types.",
    )


class RestoreResultOut(BaseModel):
    status: str
    backup: str
    mode: str
    schema_version: str | None = None
    deleted: dict[str, int]
    inserted: dict[str, int]
    skipped: dict[str, int]
    record_counts: dict[str, int]

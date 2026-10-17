"""Data management: JSON export, timestamped backups, validated restore.

Source-of-truth rules enforced here:
* SQLite (the configured database) is the runtime source of truth.
* JSON files under datasets/ are only *initial seed data* — they are never
  written by this module.
* Backups are written to a dedicated directory (default backend/backups/),
  outside the tracked seed datasets, and are git-ignored.

Security posture (no authentication exists in this prototype):
* Export and backup listing/validation are read-only and always available.
* Creating backups and restoring are disabled unless SAATHI_ALLOW_DATA_ADMIN=1
  (enforced in the router). Restore additionally requires an explicit
  confirm:true body and a loopback client address. See docs/DATA_MANAGEMENT.md.
"""

from __future__ import annotations

import json
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models
from ..config import get_settings
from ..seed import seeded_counts

SCHEMA_VERSION = "1.0"
EXPORT_FORMAT = "paytm-saathi-export"
BACKUP_FORMAT = "paytm-saathi-backup"

# Parent entities before children on insert; children before parents on delete.
INSERT_ORDER: list[str] = [
    "users",
    "accounts",
    "categories",
    "transactions",
    "budgets",
    "savings_goals",
    "goal_contributions",
    "bills",
    "monthly_history",
]
DELETE_ORDER: list[str] = list(reversed(INSERT_ORDER))

ENTITY_MODELS: dict[str, type] = {
    "users": models.User,
    "accounts": models.Account,
    "categories": models.Category,
    "transactions": models.Transaction,
    "budgets": models.Budget,
    "savings_goals": models.SavingsGoal,
    "goal_contributions": models.GoalContribution,
    "bills": models.Bill,
    "monthly_history": models.MonthlyHistory,
}

ENTITY_FILES: dict[str, str] = {entity: f"{entity}.json" for entity in INSERT_ORDER}

# (field, referenced entity, referenced primary-key field). None-valued FKs are
# allowed only when the column is nullable in the model.
FK_RULES: dict[str, list[tuple[str, str, str]]] = {
    "accounts": [("user_id", "users", "user_id")],
    "transactions": [
        ("user_id", "users", "user_id"),
        ("account_id", "accounts", "account_id"),
        ("category_id", "categories", "category_id"),
    ],
    "budgets": [("user_id", "users", "user_id"), ("category_id", "categories", "category_id")],
    "savings_goals": [("user_id", "users", "user_id")],
    "goal_contributions": [("user_id", "users", "user_id"), ("goal_id", "savings_goals", "goal_id")],
    "bills": [("user_id", "users", "user_id"), ("category_id", "categories", "category_id")],
}

BACKUP_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")


class DataError(Exception):
    """Base class for data-management failures mapped to HTTP errors."""


class InvalidBackupNameError(DataError):
    pass


class BackupNotFoundError(DataError):
    pass


class BackupValidationError(DataError):
    def __init__(self, errors: list[str]):
        super().__init__("; ".join(errors))
        self.errors = errors


def _now() -> datetime:
    return datetime.now().replace(microsecond=0)


def _pk_fields(model: type) -> list[str]:
    return [c.name for c in model.__table__.primary_key.columns]


def _serialize_row(instance: Any) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for col in instance.__table__.columns:
        value = getattr(instance, col.name)
        if isinstance(value, (datetime, date)):
            out[col.name] = value.isoformat()
        else:
            out[col.name] = value
    return out


def collect_snapshot(db: Session) -> dict[str, list[dict[str, Any]]]:
    """Read every supported entity inside a single session transaction so all
    files in a backup describe one consistent database state."""
    snapshot: dict[str, list[dict[str, Any]]] = {}
    with db.begin():
        for entity in INSERT_ORDER:
            model = ENTITY_MODELS[entity]
            pk_cols = list(model.__table__.primary_key.columns)
            rows = db.scalars(select(model).order_by(*pk_cols)).all()
            snapshot[entity] = [_serialize_row(r) for r in rows]
    return snapshot


def build_export(db: Session) -> dict[str, Any]:
    settings = get_settings()
    snapshot = collect_snapshot(db)
    return {
        "format": EXPORT_FORMAT,
        "schema_version": SCHEMA_VERSION,
        "app": "paytm-saathi",
        "app_version": settings.version,
        "exported_at": _now().isoformat(),
        "source": "database",
        "storage_mode": settings.storage_mode,
        "record_counts": {entity: len(snapshot[entity]) for entity in INSERT_ORDER},
        "data": snapshot,
    }


def export_filename() -> str:
    return f"saathi-export-{_now().strftime('%Y%m%d-%H%M%S')}.json"


def _backup_dir(backup_dir: str | Path | None) -> Path:
    return Path(backup_dir) if backup_dir else get_settings().backup_dir


def _validate_backup_name(name: str) -> None:
    if not BACKUP_NAME_RE.match(name) or ".." in name:
        raise InvalidBackupNameError(f"Invalid backup name '{name}'")


def _resolve_backup_path(backup_dir: Path, name: str) -> Path:
    _validate_backup_name(name)
    root = backup_dir.resolve()
    target = (root / name).resolve()
    if target.parent != root or not target.is_dir():
        raise BackupNotFoundError(f"No backup named '{name}' in the configured backup directory")
    return target


def _unique_backup_name(backup_dir: Path) -> str:
    base = f"backup-{_now().strftime('%Y%m%d-%H%M%S')}"
    name = base
    counter = 2
    while (backup_dir / name).exists():
        name = f"{base}-{counter:02d}"
        counter += 1
    return name


def _type_name(col) -> str:
    return type(col.type).__name__


def _check_value_type(entity: str, index: int, field: str, col, value: Any) -> str | None:
    kind = _type_name(col)
    where = f"{entity}[{index}].{field}"
    if kind == "Integer":
        if isinstance(value, bool) or not isinstance(value, int):
            return f"{where}: expected an integer, got {type(value).__name__}"
    elif kind == "String":
        if not isinstance(value, str):
            return f"{where}: expected a string, got {type(value).__name__}"
    elif kind == "Boolean":
        if not isinstance(value, bool) and value not in (0, 1):
            return f"{where}: expected a boolean, got {type(value).__name__}"
    elif kind == "DateTime":
        if not isinstance(value, str):
            return f"{where}: expected an ISO datetime string, got {type(value).__name__}"
        try:
            datetime.fromisoformat(value)
        except ValueError:
            return f"{where}: invalid ISO datetime '{value}'"
    elif kind == "Date":
        if not isinstance(value, str):
            return f"{where}: expected an ISO date string, got {type(value).__name__}"
        try:
            date.fromisoformat(value[:10])
        except ValueError:
            return f"{where}: invalid ISO date '{value}'"
    return None


def _validate_structure(entity: str, records: Any) -> tuple[list[str], set]:
    errors: list[str] = []
    pks: set = set()
    if not isinstance(records, list):
        return [f"{entity}: expected a JSON array of records"], pks
    model = ENTITY_MODELS[entity]
    known = {c.name: c for c in model.__table__.columns}
    pk_fields = _pk_fields(model)
    for index, record in enumerate(records):
        if not isinstance(record, dict):
            errors.append(f"{entity}[{index}]: expected an object")
            continue
        for key in record:
            if key not in known:
                errors.append(f"{entity}[{index}]: unknown field '{key}'")
        for name, col in known.items():
            if name not in record:
                if not col.nullable:
                    errors.append(f"{entity}[{index}]: missing required field '{name}'")
                continue
            value = record[name]
            if value is None:
                if not col.nullable:
                    errors.append(f"{entity}[{index}].{name}: must not be null")
                continue
            err = _check_value_type(entity, index, name, col, value)
            if err:
                errors.append(err)
        key = tuple(record.get(f) for f in pk_fields)
        if any(v is None for v in key):
            continue
        ident = key[0] if len(key) == 1 else key
        if ident in pks:
            errors.append(f"{entity}[{index}]: duplicate id {ident!r}")
        pks.add(ident)
    return errors, pks


def _validate_fk_refs(payload_pks: dict[str, set], payload: dict[str, list], *, extra_pks: dict[str, set] | None = None) -> list[str]:
    errors: list[str] = []
    for entity, rules in FK_RULES.items():
        model = ENTITY_MODELS[entity]
        known = {c.name: c for c in model.__table__.columns}
        for index, record in enumerate(payload[entity]):
            for field, ref_entity, ref_field in rules:
                value = record.get(field)
                if value is None:
                    continue  # nullable handled by structure checks
                valid = payload_pks[ref_entity]
                if extra_pks is not None:
                    valid = valid | extra_pks[ref_entity]
                if value not in valid:
                    errors.append(
                        f"{entity}[{index}].{field}: references missing {ref_entity}.{ref_field} '{value}'"
                    )
            _ = known  # structure validation already covered fields
    return errors


def _validate_payload(payload: dict[str, list]) -> list[str]:
    errors: list[str] = []
    for key in payload:
        if key not in ENTITY_MODELS:
            errors.append(f"Unknown entity '{key}' in backup data")
    payload_pks: dict[str, set] = {e: set() for e in INSERT_ORDER}
    for entity in INSERT_ORDER:
        if entity not in payload:
            errors.append(f"Missing entity '{entity}'")
            continue
        structure_errors, pks = _validate_structure(entity, payload[entity])
        errors.extend(structure_errors)
        payload_pks[entity] = pks
    if not errors:
        errors.extend(_validate_fk_refs(payload_pks, payload))
    return errors


def validate_backup(name: str, backup_dir: str | Path | None = None) -> dict[str, Any]:
    """Validate manifest, schema version, files, JSON structure and FK
    integrity of a stored backup. Never touches the database."""
    root = _backup_dir(backup_dir)
    _validate_backup_name(name)
    target = _resolve_backup_path(root, name)
    report: dict[str, Any] = {
        "backup": name,
        "valid": False,
        "schema_version": None,
        "status": None,
        "entity_counts": {},
        "errors": [],
    }
    errors: list[str] = []

    manifest_path = target / "manifest.json"
    manifest: dict[str, Any] | None = None
    if not manifest_path.is_file():
        errors.append("manifest.json is missing")
    else:
        try:
            loaded = json.loads(manifest_path.read_text(encoding="utf-8"))
            if not isinstance(loaded, dict):
                errors.append("manifest.json must contain a JSON object")
            else:
                manifest = loaded
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"manifest.json is not valid JSON: {exc}")

    if manifest is not None:
        if manifest.get("format") != BACKUP_FORMAT:
            errors.append(f"manifest.format must be '{BACKUP_FORMAT}'")
        schema_version = manifest.get("schema_version")
        report["schema_version"] = schema_version
        if schema_version != SCHEMA_VERSION:
            errors.append(
                f"Unsupported schema_version {schema_version!r} (this build supports {SCHEMA_VERSION!r})"
            )
        report["status"] = manifest.get("status")
        if manifest.get("status") != "complete":
            errors.append("Backup is not marked complete (manifest.status must be 'complete')")
        counts = manifest.get("entities")
        if not isinstance(counts, dict):
            errors.append("manifest.entities must be an object of entity counts")

    payload: dict[str, list] = {}
    for entity, filename in ENTITY_FILES.items():
        path = target / filename
        if not path.is_file():
            errors.append(f"Missing required file '{filename}'")
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"{filename} is not valid JSON: {exc}")
            continue
        if not isinstance(data, list):
            errors.append(f"{filename} must contain a JSON array")
            continue
        payload[entity] = data

    if len(payload) == len(ENTITY_FILES):
        report["entity_counts"] = {entity: len(payload[entity]) for entity in INSERT_ORDER}
        errors.extend(_validate_payload(payload))
        if manifest is not None and isinstance(manifest.get("entities"), dict):
            for entity, expected in manifest["entities"].items():
                actual = report["entity_counts"].get(entity)
                if actual is not None and actual != expected:
                    errors.append(
                        f"{ENTITY_FILES[entity]}: contains {actual} records but the manifest declares {expected}"
                    )

    report["errors"] = errors
    report["valid"] = not errors
    return report


def _load_payload(target: Path) -> dict[str, list]:
    payload: dict[str, list] = {}
    for entity, filename in ENTITY_FILES.items():
        payload[entity] = json.loads((target / filename).read_text(encoding="utf-8"))
    return payload


def _build_instance(model: type, record: dict[str, Any]) -> Any:
    kwargs: dict[str, Any] = {}
    for col in model.__table__.columns:
        value = record.get(col.name)
        if value is None:
            kwargs[col.name] = None
            continue
        kind = _type_name(col)
        if kind == "DateTime":
            kwargs[col.name] = datetime.fromisoformat(value)
        elif kind == "Date":
            kwargs[col.name] = date.fromisoformat(str(value)[:10])
        elif kind == "Boolean":
            kwargs[col.name] = bool(value)
        else:
            kwargs[col.name] = value
    return model(**kwargs)


def _insert_records(db: Session, payload: dict[str, list], entities: list[str]) -> dict[str, int]:
    inserted: dict[str, int] = {}
    for entity in entities:
        model = ENTITY_MODELS[entity]
        for record in payload[entity]:
            db.add(_build_instance(model, record))
        db.flush()
        inserted[entity] = len(payload[entity])
    return inserted


def _apply_snapshot(db: Session, payload: dict[str, list]) -> dict[str, Any]:
    deleted: dict[str, int] = {}
    for entity in DELETE_ORDER:
        deleted[entity] = db.query(ENTITY_MODELS[entity]).delete()
        db.flush()
    inserted = _insert_records(db, payload, INSERT_ORDER)
    return {"deleted": deleted, "inserted": inserted, "skipped": {e: 0 for e in INSERT_ORDER}}


def _db_pks(db: Session, entity: str) -> set:
    model = ENTITY_MODELS[entity]
    pk_fields = _pk_fields(model)
    rows = db.execute(select(*[getattr(model, f) for f in pk_fields])).all()
    if len(pk_fields) == 1:
        return {row[0] for row in rows}
    return {tuple(row) for row in rows}


def _apply_merge(db: Session, payload: dict[str, list], entities: list[str]) -> dict[str, Any]:
    import_set = set(entities)
    existing = {entity: _db_pks(db, entity) for entity in import_set}
    inserted: dict[str, int] = {}
    skipped: dict[str, int] = {}
    for entity in INSERT_ORDER:
        if entity not in import_set:
            continue
        model = ENTITY_MODELS[entity]
        pk = _pk_fields(model)[0]
        ins = skip = 0
        for record in payload[entity]:
            ident = record[pk]
            if ident in existing[entity]:
                skip += 1
                continue
            db.add(_build_instance(model, record))
            existing[entity].add(ident)
            ins += 1
        db.flush()
        inserted[entity] = ins
        skipped[entity] = skip
    for entity in INSERT_ORDER:
        inserted.setdefault(entity, 0)
        skipped.setdefault(entity, 0)
    return {"deleted": {}, "inserted": inserted, "skipped": skipped}


def restore_backup(
    name: str,
    *,
    mode: str = "snapshot",
    entities: list[str] | None = None,
    backup_dir: str | Path | None = None,
    db: Session,
) -> dict[str, Any]:
    """Validate then restore a backup inside one rollback-safe transaction.

    mode="snapshot" replaces every supported table with the backup contents.
    mode="merge" inserts only records whose primary keys do not already exist,
    optionally limited to `entities`. Callers must enforce access control
    (see api/data.py): this function itself performs no authentication.
    """
    if mode not in ("snapshot", "merge"):
        raise DataError(f"Unknown restore mode '{mode}' (expected 'snapshot' or 'merge')")
    if mode == "snapshot" and entities:
        raise DataError("The 'entities' filter only applies to merge restores")
    if entities:
        unknown = [e for e in entities if e not in ENTITY_MODELS]
        if unknown:
            raise DataError(f"Unknown entities: {', '.join(unknown)}")
        entities = [e for e in INSERT_ORDER if e in set(entities)]

    report = validate_backup(name, backup_dir=backup_dir)
    if not report["valid"]:
        raise BackupValidationError(report["errors"])

    target = _resolve_backup_path(_backup_dir(backup_dir), name)
    payload = _load_payload(target)

    if mode == "merge":
        import_set = set(entities) if entities else set(ENTITY_MODELS)
        payload_pks: dict[str, set] = {}
        for entity in INSERT_ORDER:
            pk = _pk_fields(ENTITY_MODELS[entity])[0]
            payload_pks[entity] = {r[pk] for r in payload[entity] if isinstance(r, dict) and r.get(pk) is not None}
        extra_pks = {entity: _db_pks(db, entity) for entity in INSERT_ORDER}
        merge_errors = _validate_fk_refs(payload_pks, payload, extra_pks=extra_pks)
        # Only refs from entities we are actually inserting can fail.
        merge_errors = [e for e in merge_errors if e.split(".", 1)[0].split("[", 1)[0] in import_set]
        if merge_errors:
            raise BackupValidationError(merge_errors)

    try:
        if mode == "snapshot":
            outcome = _apply_snapshot(db, payload)
        else:
            outcome = _apply_merge(db, payload, entities or list(INSERT_ORDER))
        db.commit()
    except BackupValidationError:
        raise
    except Exception:
        db.rollback()
        raise

    return {
        "status": "restored" if mode == "snapshot" else "merged",
        "backup": name,
        "mode": mode,
        "schema_version": report["schema_version"],
        "deleted": outcome["deleted"],
        "inserted": outcome["inserted"],
        "skipped": outcome["skipped"],
        "record_counts": seeded_counts(db),
    }


def create_backup(db: Session, backup_dir: str | Path | None = None) -> dict[str, Any]:
    settings = get_settings()
    root = _backup_dir(backup_dir)
    root.mkdir(parents=True, exist_ok=True)
    snapshot = collect_snapshot(db)
    name = _unique_backup_name(root)
    target = root / name
    target.mkdir()

    files: dict[str, str] = {}
    for entity in INSERT_ORDER:
        filename = ENTITY_FILES[entity]
        (target / filename).write_text(
            json.dumps(snapshot[entity], ensure_ascii=False, indent=2), encoding="utf-8"
        )
        files[entity] = filename

    manifest = {
        "format": BACKUP_FORMAT,
        "schema_version": SCHEMA_VERSION,
        "app_version": settings.version,
        "created_at": _now().isoformat(),
        "status": "complete",
        "storage_mode": settings.storage_mode,
        "entities": {entity: len(snapshot[entity]) for entity in INSERT_ORDER},
        "files": files,
    }
    # Written last: a directory without a complete manifest is an incomplete backup.
    (target / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"name": name, "manifest": manifest}


def list_backups(backup_dir: str | Path | None = None) -> list[dict[str, Any]]:
    root = _backup_dir(backup_dir)
    if not root.is_dir():
        return []
    items: list[dict[str, Any]] = []
    for entry in sorted(root.iterdir(), reverse=True):
        if not entry.is_dir() or not BACKUP_NAME_RE.match(entry.name) or ".." in entry.name:
            continue
        manifest_path = entry / "manifest.json"
        manifest: dict[str, Any] | None = None
        if manifest_path.is_file():
            try:
                loaded = json.loads(manifest_path.read_text(encoding="utf-8"))
                if isinstance(loaded, dict):
                    manifest = loaded
            except (OSError, json.JSONDecodeError):
                manifest = None
        size_bytes = 0
        for file in entry.iterdir():
            if file.is_file():
                size_bytes += file.stat().st_size
        counts = manifest.get("entities") if manifest and isinstance(manifest.get("entities"), dict) else {}
        items.append(
            {
                "name": entry.name,
                "status": manifest.get("status") if manifest else "incomplete",
                "schema_version": manifest.get("schema_version") if manifest else None,
                "created_at": manifest.get("created_at") if manifest else None,
                "entity_counts": counts,
                "total_records": sum(counts.values()) if counts else 0,
                "size_bytes": size_bytes,
            }
        )
    return items


def get_backup_manifest(name: str, backup_dir: str | Path | None = None) -> dict[str, Any]:
    target = _resolve_backup_path(_backup_dir(backup_dir), name)
    manifest_path = target / "manifest.json"
    if not manifest_path.is_file():
        raise BackupNotFoundError(f"Backup '{name}' has no manifest.json")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise DataError(f"Backup '{name}' has an unreadable manifest: {exc}") from exc
    if not isinstance(manifest, dict):
        raise DataError(f"Backup '{name}' manifest must be a JSON object")
    return manifest

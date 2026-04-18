"""
TrialBridge field catalog loader.

Reads quality/catalog.yaml and exposes:
  - CATALOG: list[FieldSpec]
  - catalog_by_id: dict[field_id, FieldSpec]
  - critical_field_ids: list[str]
  - required_field_ids: list[str]
"""
from __future__ import annotations

import functools
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

_CATALOG_PATH = Path(__file__).parent / "catalog.yaml"


@dataclass(frozen=True)
class FieldSpec:
    field_id: str
    label: str
    type: str
    critical: bool
    imputable: bool
    required: bool
    source: str
    cdash: str | None = None
    sdtm: str | None = None
    note: str | None = None
    aliases: tuple[str, ...] = field(default_factory=tuple)


@functools.lru_cache(maxsize=1)
def load_catalog() -> list[FieldSpec]:
    with open(_CATALOG_PATH, encoding="utf-8") as fh:
        raw = yaml.safe_load(fh)
    out: list[FieldSpec] = []
    for entry in raw.get("fields", []):
        out.append(
            FieldSpec(
                field_id=entry["field_id"],
                label=entry.get("label", entry["field_id"]),
                type=entry.get("type", "string"),
                critical=entry.get("critical", False),
                imputable=entry.get("imputable", False),
                required=entry.get("required", False),
                source=entry.get("source", ""),
                cdash=entry.get("cdash"),
                sdtm=entry.get("sdtm"),
                note=entry.get("note"),
                aliases=tuple(entry.get("aliases", [])),
            )
        )
    return out


def catalog_by_id() -> dict[str, FieldSpec]:
    return {f.field_id: f for f in load_catalog()}


def critical_field_ids() -> list[str]:
    return [f.field_id for f in load_catalog() if f.critical]


def required_field_ids() -> list[str]:
    return [f.field_id for f in load_catalog() if f.required]


def get_missing_field_ids(patient: dict[str, Any]) -> list[str]:
    """
    Return catalog field_ids that are missing / empty in the given patient dict.
    Checks primary source key; falls back to aliases.
    """
    missing: list[str] = []
    labs: dict[str, Any] = patient.get("lab_values") or {}

    for spec in load_catalog():
        src = spec.source
        if src.startswith("lab_values."):
            key = src[len("lab_values."):]
            present = labs.get(key) is not None
            if not present:
                for alias in spec.aliases:
                    if alias.startswith("lab_values."):
                        ak = alias[len("lab_values."):]
                        if labs.get(ak) is not None:
                            present = True
                            break
        else:
            val = patient.get(src)
            if isinstance(val, list):
                present = len(val) > 0
            elif isinstance(val, str):
                present = val.strip() not in ("", "Unknown")
            else:
                present = val is not None

        if not present:
            missing.append(spec.field_id)

    return missing

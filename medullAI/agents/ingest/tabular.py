"""
Read CSV / XLSX files into a list of row dicts ready for downstream mapping.
"""
from __future__ import annotations

import io
from typing import Any

import pandas as pd

MAX_FILE_BYTES = 2 * 1024 * 1024  # 2 MB hard cap
MAX_ROWS = 500


def load_tabular(data: bytes, filename: str) -> list[dict[str, Any]]:
    """Parse CSV or XLSX bytes into a list of normalised row dicts.

    - All NaN/NaT values become None.
    - Column names are stripped of whitespace.
    - Raises ValueError on oversized files or row count exceeding MAX_ROWS.
    """
    if len(data) > MAX_FILE_BYTES:
        raise ValueError(
            f"File too large: {len(data) // 1024} KB > {MAX_FILE_BYTES // 1024} KB limit."
        )

    fn = filename.lower()
    if fn.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(data), dtype=str, keep_default_na=False)
    elif fn.endswith((".xlsx", ".xls")):
        df = pd.read_excel(io.BytesIO(data), dtype=str, keep_default_na=False)
    else:
        raise ValueError(f"Unsupported file type: {filename}. Use .csv or .xlsx.")

    df.columns = [c.strip() for c in df.columns]
    # Replace empty strings produced by dtype=str with None
    df = df.replace({"": None, "nan": None, "NaN": None, "NA": None})

    if len(df) > MAX_ROWS:
        raise ValueError(
            f"Too many rows: {len(df)} > {MAX_ROWS} limit. Split the file and re-upload."
        )

    return df.to_dict(orient="records")

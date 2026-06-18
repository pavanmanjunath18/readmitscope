"""
fetch_data.py — Acquire the live CMS datasets used by ReadmitScope.

Source: CMS Provider Data Catalog (https://data.cms.gov/provider-data)
Datasets:
  - "Hospital Readmissions Reduction Program" (id: 9n3s-kdb3) -> hrrp_raw.csv
  - "Hospital General Information"             (id: xubh-q36u) -> hospital_info_raw.csv
    (Phase 2 enrichment: ownership, hospital type, overall star rating)

For each dataset this resolves the *current* distribution URL from the CMS metastore
API (so it always grabs the latest release), downloads the CSV to data/raw/, and
records provenance. Re-run this script to refresh from the live API.

Usage:
    python src/fetch_data.py
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
TIMEOUT = 60

# dataset_id -> output filename (in data/raw/)
DATASETS = {
    "9n3s-kdb3": "hrrp_raw.csv",            # Hospital Readmissions Reduction Program
    "xubh-q36u": "hospital_info_raw.csv",   # Hospital General Information
}

METASTORE = (
    "https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items/"
    "{ds}?show-reference-ids=true"
)


def resolve_distribution(dataset_id: str) -> dict:
    """Query the CMS metastore for a dataset's current download URL + metadata."""
    print(f"→ Resolving dataset {dataset_id} …")
    resp = requests.get(METASTORE.format(ds=dataset_id), timeout=TIMEOUT)
    resp.raise_for_status()
    meta = resp.json()

    distributions = meta.get("distribution", [])
    if not distributions:
        sys.exit(f"✗ No distribution found for {dataset_id}.")
    download_url = distributions[0].get("data", {}).get("downloadURL")
    if not download_url:
        sys.exit(f"✗ No downloadURL for {dataset_id}.")

    return {
        "title": meta.get("title"),
        "dataset_id": dataset_id,
        "modified": meta.get("modified"),
        "released": meta.get("released"),
        "next_update": meta.get("nextUpdateDate"),
        "download_url": download_url,
    }


def download_csv(url: str, dest: Path) -> int:
    print(f"→ Downloading → {dest.name} …")
    resp = requests.get(url, timeout=TIMEOUT)
    resp.raise_for_status()
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(resp.content)
    return len(resp.content)


def fetch_one(dataset_id: str, filename: str) -> dict:
    info = resolve_distribution(dataset_id)
    dest = RAW_DIR / filename
    n_bytes = download_csv(info["download_url"], dest)

    with dest.open("r", encoding="utf-8", errors="replace") as fh:
        n_rows = sum(1 for _ in fh) - 1  # minus header

    record = {
        **info,
        "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
        "bytes": n_bytes,
        "rows": n_rows,
        "local_path": str(dest.relative_to(ROOT)),
    }
    print(f"✓ {info['title']}: {n_rows:,} rows → {dest.relative_to(ROOT)} "
          f"(modified {info['modified']})")
    return record


def main() -> None:
    provenance = {ds: fetch_one(ds, fn) for ds, fn in DATASETS.items()}
    (RAW_DIR / "provenance.json").write_text(json.dumps(provenance, indent=2))
    print(f"✓ Provenance → {(RAW_DIR / 'provenance.json').relative_to(ROOT)}")


if __name__ == "__main__":
    main()

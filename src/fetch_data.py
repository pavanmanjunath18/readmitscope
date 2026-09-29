"""
fetch_data.py — Acquire the CMS datasets used by ReadmitScope.

Source: CMS Provider Data Catalog (https://data.cms.gov/provider-data)
Datasets:
  - "Hospital Readmissions Reduction Program" (id: 9n3s-kdb3) -> hrrp_raw.csv
  - "Hospital General Information"             (id: xubh-q36u) -> hospital_info_raw.csv
    (Phase 2 enrichment: ownership, hospital type, overall star rating)

For each dataset this resolves the *current* distribution URL from the CMS metastore
API (so it always grabs the latest release), downloads the CSV to data/raw/, checks
that the expected columns are present, and records provenance. Re-run this script
to refresh from the API.

Usage:
    python src/fetch_data.py
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
TIMEOUT = 60

# dataset_id -> (output filename in data/raw/, columns that must be present)
DATASETS = {
    "9n3s-kdb3": (
        "hrrp_raw.csv",
        {"Facility ID", "Measure Name", "Excess Readmission Ratio", "Number of Discharges"},
    ),
    "xubh-q36u": (
        "hospital_info_raw.csv",
        {"Facility ID", "Hospital Ownership", "Hospital overall rating", "Hospital Type"},
    ),
}

METASTORE = (
    "https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items/"
    "{ds}?show-reference-ids=true"
)


def session() -> requests.Session:
    """HTTP session that retries transient failures (timeouts, 429, 5xx) with backoff."""
    s = requests.Session()
    retry = Retry(
        total=4,
        backoff_factor=1.5,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("GET",),
    )
    s.mount("https://", HTTPAdapter(max_retries=retry))
    return s


def pick_csv_distribution(distributions: list[dict]) -> str | None:
    """Return the downloadURL of the CSV distribution (not blindly the first one)."""
    for d in distributions:
        data = d.get("data", {})
        url = data.get("downloadURL") or ""
        media = (data.get("mediaType") or "").lower()
        fmt = (data.get("format") or "").lower()
        if url.lower().endswith(".csv") or "csv" in media or fmt == "csv":
            return url
    return None


def resolve_distribution(http: requests.Session, dataset_id: str) -> dict:
    """Query the CMS metastore for a dataset's current download URL + metadata."""
    print(f"→ Resolving dataset {dataset_id} …")
    resp = http.get(METASTORE.format(ds=dataset_id), timeout=TIMEOUT)
    resp.raise_for_status()
    meta = resp.json()

    download_url = pick_csv_distribution(meta.get("distribution", []))
    if not download_url:
        sys.exit(f"✗ No CSV distribution found for {dataset_id}.")

    return {
        "title": meta.get("title"),
        "dataset_id": dataset_id,
        "modified": meta.get("modified"),
        "released": meta.get("released"),
        "next_update": meta.get("nextUpdateDate"),
        "download_url": download_url,
    }


def check_header(content: bytes, required: set[str], dataset_id: str) -> None:
    header = next(csv.reader(io.StringIO(content[:20_000].decode("utf-8-sig", errors="replace"))))
    missing = required - {h.strip() for h in header}
    if missing:
        sys.exit(f"✗ {dataset_id}: CMS schema changed — missing columns {sorted(missing)}.")


def fetch_one(http: requests.Session, dataset_id: str, filename: str, required: set[str]) -> dict:
    info = resolve_distribution(http, dataset_id)
    print(f"→ Downloading → {filename} …")
    resp = http.get(info["download_url"], timeout=TIMEOUT)
    resp.raise_for_status()
    content = resp.content
    check_header(content, required, dataset_id)

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    dest = RAW_DIR / filename
    tmp = dest.with_suffix(".csv.part")
    tmp.write_bytes(content)
    tmp.replace(dest)  # atomic: never leave a half-written CSV behind

    n_rows = sum(1 for _ in csv.reader(io.StringIO(content.decode("utf-8-sig", errors="replace")))) - 1
    record = {
        **info,
        "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
        "bytes": len(content),
        "sha256": hashlib.sha256(content).hexdigest(),
        "rows": n_rows,
        "local_path": str(dest.relative_to(ROOT)),
    }
    print(f"✓ {info['title']}: {n_rows:,} rows → {dest.relative_to(ROOT)} "
          f"(modified {info['modified']})")
    return record


def main() -> None:
    http = session()
    provenance = {ds: fetch_one(http, ds, fn, req) for ds, (fn, req) in DATASETS.items()}
    (RAW_DIR / "provenance.json").write_text(json.dumps(provenance, indent=2))
    print(f"✓ Provenance → {(RAW_DIR / 'provenance.json').relative_to(ROOT)}")


if __name__ == "__main__":
    main()

# 01 — Data Sources

## Primary source

| Field | Value |
|---|---|
| **Publisher** | U.S. Centers for Medicare & Medicaid Services (CMS) |
| **Catalog** | Provider Data Catalog — https://data.cms.gov/provider-data |
| **Dataset** | Hospital Readmissions Reduction Program |
| **Dataset landing page** | https://data.cms.gov/provider-data/dataset/9n3s-kdb3 |
| **Dataset ID** | `9n3s-kdb3` |
| **Release** | FY 2026 Hospital file |
| **Reporting period** | 01 Jul 2021 – 30 Jun 2024 (3-year rolling) |
| **Granularity** | One row per hospital × condition measure |
| **License** | Public domain (U.S. Government work). Free to use with attribution. |

## Enrichment source (Phase 2)

| Field | Value |
|---|---|
| **Dataset** | Hospital General Information |
| **Dataset ID** | `xubh-q36u` |
| **Landing page** | https://data.cms.gov/provider-data/dataset/xubh-q36u |
| **Rows** | 5,432 hospitals |
| **Used for** | Ownership, hospital type, emergency services, overall star rating |
| **Join key** | `Facility ID` (CCN) — matches **99.7%** of reported HRRP hospitals |
| **Modified** | 2026-04-28 |

## How the data is retrieved

The pipeline does **not** hard-code a file URL. It queries the CMS **metastore API**
for the dataset, reads the *current* distribution's `downloadURL`, and downloads
that CSV. This means re-running the fetch always pulls the latest CMS release.

```
Metastore endpoint:
  https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items/9n3s-kdb3

Resolved distribution (at time of retrieval):
  .../FY_2026_Hospital_Readmissions_Reduction_Program_Hospital.csv
```

Script: [`src/fetch_data.py`](../src/fetch_data.py)
Run with: `python src/fetch_data.py`

## Snapshot retrieved for this analysis

(Recorded automatically in `data/raw/provenance.json`)

| Field | Value |
|---|---|
| Rows | 18,330 |
| Hospitals | 3,055 |
| Conditions | 6 |
| Size | ~2.07 MB |
| Dataset `modified` | 2026-01-26 |
| Dataset `released` | 2026-05-13 |
| Retrieved (UTC) | 2026-06-18 |

## Reproducibility

```bash
python -m venv .venv && source .venv/bin/activate
pip install pandas numpy requests scipy scikit-learn matplotlib seaborn jupyter
python src/fetch_data.py          # → data/raw/hrrp_raw.csv + provenance.json
python src/build_aggregates.py    # → data/processed/*.csv + dashboard JSON
```

## Attribution

Data courtesy of the Centers for Medicare & Medicaid Services, Hospital Readmissions
Reduction Program. The analysis and any interpretations are the author's own and do
not represent CMS.

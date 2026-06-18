# 02 — Data Dictionary

Raw file: `data/raw/hrrp_raw.csv` — 18,330 rows × 12 columns. One row = one hospital
evaluated on one condition measure.

| # | Column | Type | Description | Notes / valid values |
|---|---|---|---|---|
| 1 | `Facility Name` | string | Hospital name | e.g. "SOUTHEAST HEALTH MEDICAL CENTER" |
| 2 | `Facility ID` | string | CMS Certification Number (CCN) — unique hospital ID | 6-char, zero-padded (e.g. `010001`). **Keep as string** to preserve leading zeros. |
| 3 | `State` | string | 2-letter U.S. state/territory code | 51 distinct (50 states + DC) |
| 4 | `Measure Name` | category | Which condition was measured | One of the 6 `READM-30-*-HRRP` codes |
| 5 | `Number of Discharges` | numeric* | Eligible discharges for that condition in the period | May be `"N/A"` / blank / `"Too Few to Report"` when suppressed |
| 6 | `Footnote` | category | Code explaining a suppressed/qualified value | See footnote table below; blank when data is present |
| 7 | `Excess Readmission Ratio` | numeric* | **ERR = Predicted ÷ Expected.** Core metric. | `> 1` worse than expected, `< 1` better. `"Not Available"` when suppressed |
| 8 | `Predicted Readmission Rate` | numeric* | Risk-adjusted rate the hospital actually achieved (%) | `"Not Available"` when suppressed |
| 9 | `Expected Readmission Rate` | numeric* | Rate an average hospital would achieve with same patients (%) | `"Not Available"` when suppressed |
| 10 | `Number of Readmissions` | numeric* | Count of 30-day readmissions | May be `"Too Few to Report"` |
| 11 | `Start Date` | date | Start of reporting period | `07/01/2021` (MM/DD/YYYY) |
| 12 | `End Date` | date | End of reporting period | `06/30/2024` |

`*` Numeric columns arrive as **strings** because CMS uses sentinel text values
(`"Not Available"`, `"Too Few to Report"`, `"N/A"`) for suppressed cells. These must
be coerced to numbers with the sentinels mapped to null during cleaning.

## Footnote codes (CMS standard)

| Code | Meaning | Cleaning implication |
|---|---|---|
| 1 | The number of cases/patients is too few to report. | Metric values suppressed → null |
| 3 | Results are based on a shorter time period than required. | Keep, flag |
| 5 | Results are not available for this reporting period. | Metric values suppressed → null |
| 7 | No cases met the criteria during the reporting period. | Metric values suppressed → null |

(Only footnotes actually present in the file are acted on; see the data-quality log.)

## Derived fields (added during processing)

| Field | Definition |
|---|---|
| `condition` | Human-readable label mapped from `Measure Name` (e.g. `HF` → "Heart Failure") |
| `worse_than_expected` | Boolean: `Excess Readmission Ratio > 1.0` |
| `err_deviation_pct` | `(ERR − 1) × 100` — % above/below the expected benchmark |
| `is_reported` | Boolean: row has a usable (non-null) ERR after cleaning |

## Phase 2 enrichment fields (from Hospital General Information, joined on `facility_id`)

| Field | Type | Description | Notes |
|---|---|---|---|
| `hospital_type` | category | e.g. Acute Care, Critical Access, Psychiatric | HRRP reported rows are ~all Acute Care |
| `ownership_raw` | category | CMS's 12 raw ownership values | — |
| `ownership` | category | Grouped: Non-profit / For-profit / Government / Federal-Military | Mapping in `OWNERSHIP_GROUPS` (see decisions) |
| `emergency_services` | bool-ish | Yes / No | — |
| `star_rating` | numeric | CMS Hospital overall rating, 1–5 | `"Not Available"` → null (~40% of hospitals unrated) |

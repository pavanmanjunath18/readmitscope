# 03 — Data Quality Log

A running record of every quality issue found during profiling and the decision made
for each. Profiling code lives in [`notebooks/01_cleaning.ipynb`](../notebooks/01_cleaning.ipynb);
the decisions are implemented in [`src/build_aggregates.py`](../src/build_aggregates.py).

## Structural checks (passed)

| Check | Result | Verdict |
|---|---|---|
| Row count | 18,330 | ✓ |
| Grain | Exactly 6 rows per `Facility ID` (3,055 × 6) | ✓ Clean grain |
| Primary key | `Facility ID` + `Measure Name` is unique | ✓ |
| Reporting period | Single window: 07/01/2021 – 06/30/2024 for all rows | ✓ |
| States | 51 (50 states + DC) | ✓ |
| Facility names | 2,995 distinct names vs 3,055 IDs | ⚠ Some hospitals share a name → **use `Facility ID` as the key, never name** |

## Issue log

| # | Issue | Evidence | Decision | Rationale |
|---|---|---|---|---|
| Q1 | Numeric columns stored as **strings** | ERR, rates, counts read as text | Coerce with `to_numeric`, sentinels → null | CMS embeds text suppression markers in numeric fields |
| Q2 | Suppressed metric values | 6,610 rows have null ERR/rates | Treat as **not reported**; exclude from rate stats | Cells suppressed for patient privacy / reliability |
| Q3 | Footnotes explain suppression | Footnotes **1, 5, 7** total exactly **6,610** = every null-ERR row | Confirms Q2 is fully explained, not random missingness | 1 = too few cases, 5 = not available this period, 7 = no cases |
| Q4 | Footnote **29** (377 rows) | All 377 footnote-29 rows **still have a valid ERR** | **Keep** these rows; flag with `has_advisory = True` | Footnote 29 is an advisory note, not a suppression |
| Q5 | `Number of Discharges` missing more often than ERR | 10,088 null discharges vs 6,610 null ERR | Volume analysis restricted to the **8,037** rows with both ERR and discharges | Discharge counts suppressed below a reporting floor even when ERR is published |
| Q6 | `Number of Readmissions` sentinel `"Too Few to Report"` | 3,683 such cells | Mapped to null via sentinel list | Same suppression mechanism as Q2 |
| Q7 | Leading zeros on `Facility ID` | e.g. `010001` | Loaded as **string** end-to-end | Preserving the CCN format; numeric cast would corrupt IDs |

## Resulting analysis population

| Population | Rows | Use |
|---|---|---|
| All measures (long) | 18,330 | `data/processed/hrrp_clean.csv` |
| **Reported** (usable ERR) | **11,720** | All rate/ERR statistics — `hrrp_reported.csv` |
| Reported **with discharge volume** | 8,037 | Volume-vs-performance analysis only |

## Notes / caveats carried into the analysis

- ERR is **risk-adjusted** by CMS, so cross-hospital comparison is valid, but suppressed
  rows skew toward **small hospitals** — national rates describe reporting hospitals,
  not literally every hospital.
- Suppression is **non-random** (it correlates with low volume), so any volume-based
  finding must be read with that selection effect in mind (documented in findings).

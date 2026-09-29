# 04 — Decisions & Assumptions Log

A running log of the analytical judgment calls made in this project, so the reasoning
is auditable.

| # | Decision | Alternatives considered | Why |
|---|---|---|---|
| D1 | Use **Excess Readmission Ratio (ERR)** as the primary metric | Raw predicted rate; raw readmission count | ERR is risk-adjusted → the only *fair* cross-hospital comparison; it is also the metric CMS uses for penalties |
| D2 | Define "worse than expected" as **ERR > 1.0**, and always compare shares above 1.0 with what chance would give | ERR ≥ some penalty threshold | 1.0 is the national-average benchmark. Because ~half of measures exceed it *by construction*, raw "share above 1.0" is not evidence of a problem; we compare observed patterns with a chance baseline. Note: since FY 2019 HRRP penalties compare ERR with the *peer-group median*, not 1.0 |
| D3 | Exclude **suppressed** rows from all rate statistics | Impute the missing ERR | Suppressed values are unknown, not zero; imputing would fabricate signal. Documented as a selection effect instead |
| D4 | **Keep** footnote-29 rows (they carry a valid ERR) | Drop all footnoted rows | Verified these 377 rows have real ERR values; dropping them would discard usable data |
| D5 | Require **≥3 reported conditions** for best/worst hospital rankings | Rank on a single condition | A hospital with one lucky measure shouldn't top the leaderboard; ≥3 gives a stable average |
| D6 | Restrict the **volume analysis** to *suppression-safe* rows: discharges ≥ 2 × 11 ÷ expected rate (5,391 rows) | (a) all rows with a published count (8,037); (b) treat missing volume as 0 | CMS publishes counts only when readmissions ≥ 11, so (a) keeps small hospitals only when their rate is high and fakes a volume effect (the <50 bin showed 99% above 1.0). At twice the floor, suppression would require readmitting at half the expected rate, so it rarely binds. (b) is simply wrong |
| D7 | Report **Spearman** (not Pearson) for volume vs ERR | Pearson correlation | Volume is highly right-skewed and the relationship need not be linear; Spearman is rank-based and robust |
| D8 | Compare surgical vs medical **within hospital** (Wilcoxon signed-rank on each hospital's surgical − medical mean ERR) | Unpaired Mann–Whitney on all measures | The unpaired test mixes hospital differences with condition differences and treats correlated measures as independent |
| D9 | Treat `Facility ID` (not name) as the entity key | Group by facility name | 2,995 names vs 3,055 IDs — names are not unique |
| D10 | Join enrichment with `how='left'` keeping all HRRP rows | Inner join | Don't silently drop the 0.3% unmatched HRRP hospitals; they stay with null attributes |
| D11 | Collapse 12 ownership values into 4 groups | Analyze all 12 | Several raw categories have tiny n; 4 groups (Non-profit/For-profit/Government/Federal) give interpretable, well-powered comparisons |
| D12 | Treat for-profit = Proprietary + Physician-owned | Proprietary only | Physician-owned hospitals are investor/for-profit in nature; grouping matches the economic distinction being tested |
| D13 | Exclude unrated hospitals from star-rating analysis | Impute a rating | ~40% are "Not Available"; rating is missing-not-at-random, so we report on rated hospitals and say so |
| D14 | Kruskal–Wallis (ownership) + Spearman (rating), run on **one mean ERR per hospital** | Tests on all 11k measures | ERR is non-normal and rating is ordinal; hospital-level data avoids counting up to six correlated measures per hospital as independent evidence (which inflated earlier p-values to ~10⁻¹⁹⁵) |
| D15 | Adjusted model: OLS of ERR×100 on ownership + star rating + condition + state, **standard errors clustered by hospital**; volume added as log2(discharges) on suppression-safe rows | Separate bivariate tests only | Ownership, rating, geography and volume are entangled; a single adjusted model separates them. Implemented in numpy (`src/stats_utils.py`) to avoid a statsmodels dependency |
| D16 | Rank states only if they have **≥ 10 reporting hospitals**; report 95% CIs on the state mean of hospital ERRs | Rank all 51 states on raw mean | Small states (e.g. ND, 7 hospitals) produce noisy extremes |
| D17 | Flag the **star-rating circularity** | Present the rating association as causal | The CMS overall rating includes a Readmission measure group built from these measures |

## Assumptions

- The FY 2026 file is the current, authoritative CMS release at retrieval time.
- ERR's CMS risk-adjustment is accepted as valid (we do not re-model it).
- National statistics describe **reporting** hospitals; the 6,610 measures with suppressed
  ERRs (mostly small hospitals) are, by construction, under-represented.
- CMS risk adjustment covers clinical case mix but not social risk; no finding is causal.

# 04 — Decisions & Assumptions Log

A running log of the analytical judgment calls made in this project, so the reasoning
is auditable.

| # | Decision | Alternatives considered | Why |
|---|---|---|---|
| D1 | Use **Excess Readmission Ratio (ERR)** as the primary metric | Raw predicted rate; raw readmission count | ERR is risk-adjusted → the only *fair* cross-hospital comparison; it is also the metric CMS uses for penalties |
| D2 | Define "worse than expected" as **ERR > 1.0** | ERR ≥ some penalty threshold | 1.0 is the natural benchmark (predicted = expected); avoids inventing an arbitrary cutoff |
| D3 | Exclude **suppressed** rows from all rate statistics | Impute the missing ERR | Suppressed values are unknown, not zero; imputing would fabricate signal. Documented as a selection effect instead |
| D4 | **Keep** footnote-29 rows (they carry a valid ERR) | Drop all footnoted rows | Verified these 377 rows have real ERR values; dropping them would discard usable data |
| D5 | Require **≥3 reported conditions** for best/worst hospital rankings | Rank on a single condition | A hospital with one lucky measure shouldn't top the leaderboard; ≥3 gives a stable average |
| D6 | Restrict the **volume analysis** to rows with both ERR and discharge count (8,037) | Use ERR rows only and treat missing volume as 0 | Missing volume ≠ zero volume; mixing them would bias the gradient |
| D7 | Report **Spearman** (not Pearson) for volume vs ERR | Pearson correlation | Volume is highly right-skewed and the relationship need not be linear; Spearman is rank-based and robust |
| D8 | Use **Mann–Whitney U** for surgical vs medical ERR | t-test | ERR is not normally distributed; a non-parametric test is safer |
| D9 | Treat `Facility ID` (not name) as the entity key | Group by facility name | 2,995 names vs 3,055 IDs — names are not unique |
| D10 | Join enrichment with `how='left'` keeping all HRRP rows | Inner join | Don't silently drop the 0.3% unmatched HRRP hospitals; they stay with null attributes |
| D11 | Collapse 12 ownership values into 4 groups | Analyze all 12 | Several raw categories have tiny n; 4 groups (Non-profit/For-profit/Government/Federal) give interpretable, well-powered comparisons |
| D12 | Treat for-profit = Proprietary + Physician-owned | Proprietary only | Physician-owned hospitals are investor/for-profit in nature; grouping matches the economic distinction being tested |
| D13 | Exclude unrated hospitals from star-rating analysis | Impute a rating | ~40% are "Not Available"; rating is missing-not-at-random, so we report on rated hospitals and say so |
| D14 | Kruskal–Wallis (ownership) + Spearman (rating) | One-way ANOVA / Pearson | ERR is non-normal and rating is ordinal; non-parametric tests are appropriate |

## Assumptions

- The FY 2026 file is the current, authoritative CMS release at retrieval time.
- ERR's CMS risk-adjustment is accepted as valid (we do not re-model it).
- National statistics describe **reporting** hospitals; the ~3,000 measures suppressed
  for low volume are, by construction, under-represented.

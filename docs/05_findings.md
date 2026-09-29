# 05 — Executive Findings

**ReadmitScope US** · analysis of **2,833 U.S. hospitals with at least one reported
measure** (of 3,055 in the CMS file) and **11,720 reported condition-measures**, CMS
Hospital Readmissions Reduction Program, FY 2026 (reporting period Jul 2021 – Jun 2024).

> The Excess Readmission Ratio (ERR) compares a hospital's *risk-adjusted* 30-day
> readmission rate to what the *national-average hospital* would achieve with the same
> patients. **ERR > 1.0 = readmits more than expected.**
>
> Because the benchmark is the national average, **about half of all measures sit above
> 1.0 by construction.** Every finding below is therefore framed against what chance
> would produce, and every test either uses one value per hospital or standard errors
> clustered by hospital (measures from the same hospital are correlated).

All figures are produced by `src/build_aggregates.py` and reproduced in
`notebooks/03_analysis.ipynb` and `notebooks/04_enrichment.ipynb`.

---

## 1. Readmission performance is a hospital-level trait
- **9.2%** of hospitals with ≥3 reported conditions are worse than expected on **every**
  one — about **twice** the 4.7% chance would produce. Likewise, **11.8%** are better on
  every condition (chance: 6.2%).
- ERR is positively correlated across conditions within a hospital
  (Spearman ρ 0.10–0.33, median 0.19).
- By contrast, "83% of hospitals are worse on at least one condition" is **not** a
  signal — it is *below* the ~89% that independent coin flips would give.

**So what:** there is a distinct group of consistently high-readmission hospitals.
Hospital-wide interventions (discharge planning, care transitions) are a better fit
than condition-specific programmes.

## 2. The "small hospitals do worst" pattern is a reporting artifact
- CMS only publishes discharge and readmission counts when readmissions are **≥ 11**.
  A small hospital's counts are visible only when its readmission *rate* is high, so a
  naïve analysis shows the <50-discharge group above 1.0 **99%** of the time.
- The 3,683 measures with hidden counts — mostly small hospitals — are *better* than
  average (mean ERR 0.986, 36% above 1.0).
- On suppression-safe rows (discharges ≥ 2 × 11 ÷ expected rate), Spearman ρ shrinks from
  −0.16 to **−0.05**. In the adjusted model the volume effect is
  **−0.05 ERR points per doubling (95% CI −0.34 to +0.25, p = 0.76)** — no detectable effect.

**So what:** volume should not be used to target interventions on this evidence. A size
measure not tied to the suppression rule (e.g. bed count) would be needed to revisit it.

## 3. No condition stands out
- The share of hospitals above 1.0 ranges only from **46.8% (Pneumonia)** to
  **49.9% (Bypass surgery)**, with overlapping 95% confidence intervals.
- Within-hospital comparison of surgical vs medical ERR: median difference −0.004,
  Wilcoxon **p = 0.58**.

## 4. A handful of states differ from 1.0 beyond noise
- Ranking only states with ≥10 reporting hospitals (state mean of hospital-level ERR, 95% CI):
  **New Jersey (1.029)**, Massachusetts (1.028), Florida, Illinois, Mississippi, Georgia and
  California are significantly **above** 1.0; 12 states, mostly in the West and Upper
  Midwest, are significantly **below**.
- Maryland hospitals are exempt from HRRP payment reductions (all-payer model) even
  though CMS publishes their ERRs.
- CMS risk adjustment covers clinical case mix but **not** social risk, so state gaps can
  partly reflect population differences as well as care delivery.

---

## Phase 2 — which *kinds* of hospitals readmit more?

Enriched with **CMS Hospital General Information** (ownership, type, overall star rating),
joined on Facility ID (99.5% match; July 2026 release).

### 5. Star rating tracks readmissions strongly — partly by construction
- Share of measures above 1.0: **★1 = 73%** → **★5 = 31%**; hospital-level Spearman
  **ρ = −0.44** (n = 2,621 hospitals).
- Adjusted for ownership, condition and state: ★1 hospitals sit **+4.0 ERR points** above
  ★3 hospitals, and ★5 hospitals **−4.0 points** below (both p < 0.001).
- ⚠ The CMS overall star rating includes a Readmission measure group containing these
  same measures, so part of this association is mechanical. The rating is a useful public
  signal, not independent evidence that "quality causes fewer readmissions".

### 6. The for-profit gap is small once rating and geography are considered
- Unadjusted, for-profit hospitals have a higher median ERR than non-profit ones
  (1.009 vs 0.996; hospital-level Mann–Whitney p < 0.001; above 1.0 on 54% vs 46% of measures).
- After adjusting for star rating, condition and state, the gap is **+0.40 ERR points
  (95% CI −0.05 to +0.85, p = 0.08)** — not statistically significant.
- Federal / Military has only 18 hospitals and cannot be interpreted.

### 7. Hospital type is uninformative here (by design)
- Reported HRRP measures are almost entirely from Acute Care Hospitals; Critical Access
  and specialty hospitals are largely **exempt** from HRRP.

## Recommendations / next steps
1. **Focus on consistently high-ERR hospitals** — those above 1.0 on every reported
   condition — rather than on hospital size or single service lines.
2. **Investigate the significantly-high states** (NJ, MA, FL, IL, MS, GA, CA): referral
   patterns, post-acute capacity, and social-risk differences the CMS model does not capture.
3. **Revisit volume with an unbiased size measure** (bed count from HCRIS) before drawing
   any volume conclusion.
4. **Monitor** — re-run the pipeline on each CMS refresh.
5. *(Future)* Add patient-experience (HCAHPS), staffing and social-risk measures
   (e.g. dual-eligible share) as potential explanatory factors.

## Limitations
- ERR is estimated by CMS with hierarchical models that pull small hospitals' estimates
  toward 1.0, so small-hospital ERRs understate true variation.
- Since FY 2019, HRRP penalties compare each hospital's ERR with the **median ERR of its
  peer group** (stratified by dual-eligible share), not with 1.0; "ERR > 1" here means
  "above the national average", not "penalised".
- All associations are observational.

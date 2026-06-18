# 05 — Executive Findings

**ReadmitScope US** · analysis of **3,055 U.S. hospitals**, **11,720 reported
condition-measures**, CMS Hospital Readmissions Reduction Program, FY 2026
(reporting period Jul 2021 – Jun 2024).

> The Excess Readmission Ratio (ERR) compares a hospital's *actual, risk-adjusted*
> 30-day readmission rate to what's *expected* for its patient mix.
> **ERR > 1.0 = readmits more than expected.**

---

## 1. Excess readmissions are a systemic problem, not a few bad actors
- **48.1%** of all reported measures are worse than expected (ERR > 1).
- **77.2%** of hospitals (2,358 of 3,055) exceed expectations on **at least one** of
  the six conditions.
- National mean ERR **1.002**, median **0.997** — the "average" hospital sits right at
  the benchmark, but the right tail is heavy (worst hospitals reach ERR ≈ 1.6).

**So what:** readmission reduction can't be solved by targeting a handful of outliers;
it's broad-based across the hospital system.

## 2. Hospital volume is significantly associated with better performance
- Mean ERR falls monotonically with discharge volume:
  **<50 discharges → 1.058 (99% worse than expected)** down to
  **800+ discharges → 0.991 (45% worse).**
- Spearman **ρ = −0.161, p = 1.5 × 10⁻⁴⁷** (n = 8,037) — a small but *highly
  significant* negative association: more volume, lower readmission ratio.

**So what:** consistent with a volume–outcome relationship (experience, staffing,
care-coordination resources). Low-volume hospitals are the highest-risk segment for
intervention. *Caveat:* small hospitals are over-suppressed in the data, so the
lowest-volume bin is a selected sample.

## 3. The problem spans service lines, with surgery/cardiac slightly worse
- Share of hospitals worse than expected by condition:
  **Bypass surgery 49.9%**, Heart attack 49.7%, Heart failure 48.9%,
  Hip/Knee 47.9%, COPD 47.2%, **Pneumonia 46.8%**.
- Surgical vs medical median ERR differ only marginally (Mann–Whitney **p = 0.048**),
  surgical median 0.996 vs medical 0.998.

**So what:** no single condition dominates — readmission is a cross-cutting quality
issue rather than one department's failure.

## 4. Geography matters
- Mean ERR varies by state; **Massachusetts** has the highest mean ERR (**1.034**,
  62.5% of measures worse than expected) among states with meaningful sample size.
- Because ERR is already risk-adjusted, these gaps are not simply explained by sicker
  populations — they point to regional differences in care delivery worth deeper study.

---

## Phase 2 — what *kind* of hospital readmits more?

Enriched with **CMS Hospital General Information** (ownership, type, overall star rating),
joined on Facility ID (99.7% match).

### 5. For-profit hospitals readmit more than non-profit
- Mean ERR by ownership: **For-profit 1.014 (54% worse)**, Federal/Military 1.012,
  Government 1.001, **Non-profit 0.998 (46% worse)**.
- Ownership groups differ significantly (Kruskal–Wallis **p ≈ 1×10⁻¹⁶**); for-profit >
  non-profit one-sided **Mann–Whitney p ≈ 5×10⁻¹⁸** (medians 1.007 vs 0.994).
- **So what:** the gap persists *after* risk adjustment, so it's not explained by sicker
  patients — it points to differences in care model / discharge practices.

### 6. CMS star rating is a strong dose–response signal for readmissions
- Mean ERR falls cleanly with rating: **★1 = 1.048 (73% worse)** → **★5 = 0.966 (31% worse)**.
- Spearman **ρ = −0.27, p ≈ 2×10⁻¹⁹⁵** (n = 11,458).
- **So what:** the overall quality star is a meaningful, publicly visible proxy for
  readmission risk — useful for both patients and targeting.

### 7. Hospital type is uninformative here (by design)
- Reported HRRP measures are ~entirely Acute Care Hospitals; Critical-Access and
  specialty hospitals are largely **exempt** from HRRP, so type doesn't vary.

## Recommendations / next steps
1. **Prioritise the highest-risk segment** — low-volume, lower-rated (★1–★2), for-profit
   acute-care hospitals concentrate the excess readmissions; focus support there.
2. **Investigate high-ERR states** (e.g. MA) qualitatively — referral patterns, post-acute capacity.
3. **Monitor** — re-run the pipeline each CMS refresh to track whether the system is improving.
4. *(Future)* Add patient-experience (HCAHPS) and staffing measures to test mediators of
   the ownership and star-rating effects found in Phase 2.

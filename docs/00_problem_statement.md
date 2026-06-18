# 00 — Problem Statement

**Project:** ReadmitScope US — Analysis of Medicare Hospital 30-Day Readmissions
**Analyst:** Pavan Venkata Manjunath Mallipudi
**Domain:** Healthcare / hospital quality analytics

## Background

When a patient is discharged from a hospital and then has to be admitted again
within 30 days, it is called a **30-day readmission**. High readmission rates are
a signal of poor care coordination, premature discharge, or inadequate follow-up —
and they are expensive.

In response, the U.S. Centers for Medicare & Medicaid Services (CMS) runs the
**Hospital Readmissions Reduction Program (HRRP)**. Under HRRP, CMS **financially
penalizes hospitals** (a reduction of up to **3% of all Medicare payments**) when
their readmissions for specific conditions are higher than expected given the
hospital's case mix.

CMS evaluates six conditions/procedures:

| Code | Condition |
|---|---|
| READM-30-HF-HRRP | Heart Failure |
| READM-30-PN-HRRP | Pneumonia |
| READM-30-COPD-HRRP | Chronic Obstructive Pulmonary Disease |
| READM-30-AMI-HRRP | Acute Myocardial Infarction (heart attack) |
| READM-30-CABG-HRRP | Coronary Artery Bypass Graft surgery |
| READM-30-HIP-KNEE-HRRP | Elective Hip / Knee Replacement |

## The key metric — Excess Readmission Ratio (ERR)

For each hospital × condition, CMS publishes:

- **Predicted Readmission Rate** — what the hospital *actually* achieved (risk-adjusted).
- **Expected Readmission Rate** — what an *average* hospital would achieve with the
  same patients.
- **Excess Readmission Ratio (ERR)** = Predicted ÷ Expected.

Interpretation:
- **ERR > 1.0** → the hospital readmits **more** than expected → contributes to a penalty.
- **ERR = 1.0** → exactly as expected.
- **ERR < 1.0** → the hospital readmits **fewer** than expected → better than its peers.

ERR is risk-adjusted, so it is a *fair* cross-hospital comparison — it already
accounts for how sick each hospital's patients are.

## Analytical questions

1. **National picture** — Across all reported hospitals, what share readmit *more*
   than expected (ERR > 1) for each condition? Which condition is the biggest problem?
2. **Distribution** — How far do hospitals deviate from the ERR = 1.0 benchmark?
   Is the problem concentrated in a few bad performers, or systemic?
3. **Geography** — Which states have the highest share of worse-than-expected
   hospitals and the highest average ERR?
4. **Volume vs. performance** — Do higher-volume hospitals (more discharges) post
   better or worse readmission ratios?
5. **Outliers** — Which specific hospitals are the best and worst performers, and by
   how much?

## Why this matters (the "so what")

- For **CMS / policymakers**: identifies where readmission reduction efforts (and
  penalties) should focus.
- For **hospital administrators**: a benchmark to see where a facility stands versus
  its peers and the national norm.
- For **patients**: transparency into hospital quality before an elective procedure.

## Success criteria for this analysis

- A reproducible pipeline that pulls the **live CMS data** and rebuilds every output.
- A fully documented cleaning + EDA + analysis trail (this `docs/` folder + notebooks).
- A clear set of evidence-backed findings answering the questions above.
- An interactive dashboard that lets a non-technical user explore the results.

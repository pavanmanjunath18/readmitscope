"""
build_aggregates.py — Clean the raw HRRP data and build analysis outputs.

Pipeline:
  1. Load data/raw/hrrp_raw.csv (+ hospital_info_raw.csv for enrichment)
  2. Validate the schema, then clean: coerce numerics, map suppression sentinels
     -> null, map measure codes to human labels, derive analytic flags.
  3. Save processed long tables -> data/processed/*.csv
  4. Compute aggregates + statistical tests and write
     dashboard/public/readmit_data.json (consumed by the app).

Every number the dashboard shows — including test statistics and p-values — is
computed here, so a CMS refresh never leaves stale figures hard-coded in the UI.

All cleaning decisions are documented in docs/03_data_quality_log.md and the
analytical choices in docs/04_decisions.md.

Usage:
    python src/build_aggregates.py
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

sys.path.insert(0, str(Path(__file__).resolve().parent))
from stats_utils import mean_ci, ols_cluster, wilson_ci  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW_CSV = ROOT / "data" / "raw" / "hrrp_raw.csv"
INFO_CSV = ROOT / "data" / "raw" / "hospital_info_raw.csv"
PROVENANCE = ROOT / "data" / "raw" / "provenance.json"
PROC_DIR = ROOT / "data" / "processed"
OUT_JSON = ROOT / "dashboard" / "public" / "readmit_data.json"

HRRP_ID = "9n3s-kdb3"
INFO_ID = "xubh-q36u"

# Suppression sentinels CMS uses in numeric columns.
SENTINELS = ["Not Available", "Too Few to Report", "N/A", ""]

# CMS publishes discharge/readmission counts only when readmissions >= 11.
SUPPRESSION_FLOOR = 11

# Minimum sample sizes for "fair" rankings.
MIN_CONDITIONS_FOR_RANKING = 3
MIN_HOSPITALS_FOR_STATE_RANK = 10
MIN_BIN_N = 30

# Maryland hospitals are exempt from HRRP payment reductions (all-payer model),
# although CMS still publishes their ERRs.
HRRP_EXEMPT_STATES = {"MD"}

REQUIRED_HRRP_COLUMNS = {
    "Facility Name", "Facility ID", "State", "Measure Name", "Number of Discharges",
    "Footnote", "Excess Readmission Ratio", "Predicted Readmission Rate",
    "Expected Readmission Rate", "Number of Readmissions", "Start Date", "End Date",
}
REQUIRED_INFO_COLUMNS = {
    "Facility ID", "Hospital Type", "Hospital Ownership", "Emergency Services",
    "Hospital overall rating",
}

# CMS lists 12 raw ownership values; group them into 4 analysis buckets.
OWNERSHIP_GROUPS = {
    "Voluntary non-profit - Private": "Non-profit",
    "Voluntary non-profit - Other": "Non-profit",
    "Voluntary non-profit - Church": "Non-profit",
    "Proprietary": "For-profit",
    "Physician": "For-profit",
    "Government - Hospital District or Authority": "Government",
    "Government - Local": "Government",
    "Government - State": "Government",
    "Government - Federal": "Federal / Military",
    "Veterans Health Administration": "Federal / Military",
    "Department of Defense": "Federal / Military",
    "Tribal": "Federal / Military",
}

# Measure code -> (short label, full label, clinical group)
CONDITIONS = {
    "READM-30-HF-HRRP":       ("Heart Failure",        "Heart Failure",                        "Medical"),
    "READM-30-PN-HRRP":       ("Pneumonia",            "Pneumonia",                            "Medical"),
    "READM-30-COPD-HRRP":     ("COPD",                 "Chronic Obstructive Pulmonary Disease","Medical"),
    "READM-30-AMI-HRRP":      ("Heart Attack",         "Acute Myocardial Infarction",          "Medical"),
    "READM-30-CABG-HRRP":     ("Bypass Surgery",       "Coronary Artery Bypass Graft",         "Surgical"),
    "READM-30-HIP-KNEE-HRRP": ("Hip/Knee Replacement", "Elective Hip / Knee Replacement",      "Surgical"),
}


# --------------------------------------------------------------------------- #
# Cleaning
# --------------------------------------------------------------------------- #
def validate_columns(df: pd.DataFrame, required: set[str], name: str) -> None:
    missing = required - {c.strip() for c in df.columns}
    if missing:
        raise ValueError(
            f"{name}: CMS schema changed — missing columns {sorted(missing)}. "
            "Update the cleaning step before rebuilding."
        )


def clean(df: pd.DataFrame) -> pd.DataFrame:
    """Apply documented cleaning steps; return a tidy long table."""
    df = df.copy()
    df.columns = [c.strip() for c in df.columns]
    validate_columns(df, REQUIRED_HRRP_COLUMNS, "HRRP")

    unknown = sorted(set(df["Measure Name"].dropna()) - set(CONDITIONS))
    if unknown:
        raise ValueError(
            f"HRRP: unrecognised measure codes {unknown}. Add them to CONDITIONS "
            "in src/build_aggregates.py."
        )

    # 1. Coerce numeric columns, treating sentinels as null.
    num_cols = {
        "Number of Discharges": "discharges",
        "Excess Readmission Ratio": "err",
        "Predicted Readmission Rate": "predicted_rate",
        "Expected Readmission Rate": "expected_rate",
        "Number of Readmissions": "readmissions",
    }
    for raw_col, new_col in num_cols.items():
        cleaned = df[raw_col].replace(SENTINELS, np.nan)
        df[new_col] = pd.to_numeric(cleaned, errors="coerce")

    # 2. Map condition labels.
    df["condition"] = df["Measure Name"].map(lambda m: CONDITIONS[m][0])
    df["condition_full"] = df["Measure Name"].map(lambda m: CONDITIONS[m][1])
    df["clinical_group"] = df["Measure Name"].map(lambda m: CONDITIONS[m][2])

    # 3. Rename identity columns.
    df = df.rename(columns={
        "Facility Name": "facility_name",
        "Facility ID": "facility_id",
        "State": "state",
        "Footnote": "footnote",
        "Start Date": "start_date",
        "End Date": "end_date",
    })

    # 4. Derived analytic fields.
    df["is_reported"] = df["err"].notna()                  # row has a usable ERR
    df["worse_than_expected"] = df["err"] > 1.0            # above the national-average benchmark
    df["err_deviation_pct"] = (df["err"] - 1.0) * 100      # % above/below benchmark
    df["has_advisory"] = df["footnote"] == "29"            # footnote 29 = advisory, ERR kept

    keep = [
        "facility_id", "facility_name", "state",
        "Measure Name", "condition", "condition_full", "clinical_group",
        "discharges", "readmissions", "err", "predicted_rate", "expected_rate",
        "is_reported", "worse_than_expected", "err_deviation_pct",
        "footnote", "has_advisory", "start_date", "end_date",
    ]
    return df[keep].rename(columns={"Measure Name": "measure_code"})


def clean_info(info: pd.DataFrame) -> pd.DataFrame:
    """Clean Hospital General Information -> one row per facility with enrichment fields."""
    info = info.copy()
    info.columns = [c.strip() for c in info.columns]
    validate_columns(info, REQUIRED_INFO_COLUMNS, "Hospital General Information")
    out = pd.DataFrame({
        "facility_id": info["Facility ID"].astype(str),
        "hospital_type": info["Hospital Type"],
        "ownership_raw": info["Hospital Ownership"],
        "emergency_services": info["Emergency Services"],
    })
    out["ownership"] = out["ownership_raw"].map(OWNERSHIP_GROUPS).fillna("Other")
    rating = pd.to_numeric(info["Hospital overall rating"].replace(SENTINELS, np.nan), errors="coerce")
    out["star_rating"] = rating
    return out.drop_duplicates("facility_id")


def suppression_safe(df: pd.DataFrame) -> pd.Series:
    """
    Rows whose published discharge count is NOT distorted by CMS's reporting floor.

    Counts are published only when readmissions >= 11. For a small hospital that
    floor means only its *worst* results are visible, which fakes a volume effect.
    We keep a row only if, at its expected rate, it would record at least twice the
    floor (discharges >= 2 * 11 / expected_rate) — then falling under the floor
    would require readmitting at half the expected rate, so suppression rarely binds.
    """
    need = 2 * SUPPRESSION_FLOOR / (df["expected_rate"] / 100)
    return df["discharges"].notna() & (df["discharges"] >= need)


# --------------------------------------------------------------------------- #
# Aggregates
# --------------------------------------------------------------------------- #
def hist(series: pd.Series, lo: float, hi: float, step: float) -> list[dict]:
    edges = np.round(np.arange(lo, hi + step, step), 4)
    clipped = series.dropna().clip(lo, hi - 1e-9)   # fold extreme tails into end bins
    counts, _ = np.histogram(clipped, bins=edges)
    return [
        {"bin_start": float(edges[i]), "bin_end": float(edges[i + 1]), "count": int(counts[i])}
        for i in range(len(counts))
    ]


def _err_stats(sub: pd.DataFrame) -> dict:
    k = int((sub["err"] > 1).sum())
    lo, hi = wilson_ci(k, len(sub))
    return {
        "n_hospitals": int(sub["facility_id"].nunique()),
        "n_measures": int(len(sub)),
        "mean_err": round(float(sub["err"].mean()), 4),
        "median_err": round(float(sub["err"].median()), 4),
        "pct_worse": round(float(k / len(sub) * 100), 1),
        "pct_worse_ci": [lo, hi],
    }


def _test(stat: float, p: float, n: int, **extra) -> dict:
    return {"stat": round(float(stat), 4), "p": float(p), "n": int(n), **extra}


def hospital_means(rep: pd.DataFrame) -> pd.DataFrame:
    return (
        rep.groupby("facility_id")
        .agg(state=("state", "first"), mean_err=("err", "mean"),
             n=("err", "size"), n_worse=("worse_than_expected", "sum"))
        .reset_index()
    )


def consistency_block(rep: pd.DataFrame, hosp: pd.DataFrame) -> dict:
    """
    ERR benchmarks each hospital against the national average, so ~half of all
    measures land above 1.0 *by construction*. The meaningful question is whether
    the same hospitals are worse across conditions more often than chance predicts.
    """
    p = float(rep["worse_than_expected"].mean())
    elig = hosp[hosp["n"] >= MIN_CONDITIONS_FOR_RANKING]
    wide = rep.pivot_table(index="facility_id", columns="condition", values="err")
    corr = wide.corr(method="spearman").to_numpy()
    off = corr[~np.eye(len(corr), dtype=bool)]
    return {
        "p_measure_worse": round(p * 100, 1),
        "min_conditions": MIN_CONDITIONS_FOR_RANKING,
        "n_eligible": int(len(elig)),
        "n_all_worse": int((elig["n_worse"] == elig["n"]).sum()),
        "pct_all_worse": round(float((elig["n_worse"] == elig["n"]).mean() * 100), 1),
        "pct_all_worse_expected": round(float((p ** elig["n"]).mean() * 100), 1),
        "pct_all_better": round(float((elig["n_worse"] == 0).mean() * 100), 1),
        "pct_all_better_expected": round(float(((1 - p) ** elig["n"]).mean() * 100), 1),
        "pct_any_worse": round(float((hosp["n_worse"] > 0).mean() * 100), 1),
        "pct_any_worse_expected": round(float((1 - (1 - p) ** hosp["n"]).mean() * 100), 1),
        "cross_condition_rho_median": round(float(np.nanmedian(off)), 2),
        "cross_condition_rho_min": round(float(np.nanmin(off)), 2),
        "cross_condition_rho_max": round(float(np.nanmax(off)), 2),
    }


def volume_block(rep: pd.DataFrame, model_volume: dict) -> tuple[list[dict], dict]:
    bins = [0, 50, 100, 200, 400, 800, np.inf]
    labels = ["<50", "50-100", "100-200", "200-400", "400-800", "800+"]

    def binned(sub: pd.DataFrame) -> list[dict]:
        sub = sub.copy()
        sub["vol_bin"] = pd.cut(sub["discharges"], bins=bins, labels=labels, right=False)
        out = []
        for lab, s in sub.groupby("vol_bin", observed=True):
            k = int((s["err"] > 1).sum())
            out.append({
                "bin": str(lab),
                "n": int(len(s)),
                "mean_err": round(float(s["err"].mean()), 4),
                "pct_worse": round(float(k / len(s) * 100), 1),
                "pct_worse_ci": list(wilson_ci(k, len(s))),
            })
        return out

    published = rep.dropna(subset=["discharges"])
    safe = rep[suppression_safe(rep)]
    hidden = rep[rep["discharges"].isna()]

    rho_n, p_n = stats.spearmanr(published["discharges"], published["err"])
    rho_s, p_s = stats.spearmanr(safe["discharges"], safe["err"])

    safe_bins = [b for b in binned(safe) if b["n"] >= MIN_BIN_N]
    artifact = {
        "suppression_floor": SUPPRESSION_FLOOR,
        "naive_bins": binned(published),
        "naive_spearman": _test(rho_n, p_n, len(published)),
        "safe_spearman": _test(rho_s, p_s, len(safe)),
        "n_published": int(len(published)),
        "n_safe": int(len(safe)),
        "hidden": {
            "n": int(len(hidden)),
            "mean_err": round(float(hidden["err"].mean()), 4),
            "pct_worse": round(float(hidden["worse_than_expected"].mean() * 100), 1),
        },
        "per_doubling": model_volume,
    }
    return safe_bins, artifact


def state_block(rep: pd.DataFrame, hosp: pd.DataFrame) -> list[dict]:
    by_state = []
    for st, h in hosp.groupby("state"):
        sub = rep[rep["state"] == st]
        lo, hi = mean_ci(h["mean_err"])
        n_h = int(len(h))
        eligible = n_h >= MIN_HOSPITALS_FOR_STATE_RANK
        signif = None
        if eligible and np.isfinite(lo):
            signif = "above" if lo > 1 else "below" if hi < 1 else None
        by_state.append({
            "state": st,
            "n_hospitals": n_h,
            "n_reported": int(len(sub)),
            "mean_err": round(float(h["mean_err"].mean()), 4),
            "ci_low": round(lo, 4) if np.isfinite(lo) else None,
            "ci_high": round(hi, 4) if np.isfinite(hi) else None,
            "pct_worse": round(float(sub["worse_than_expected"].mean() * 100), 1),
            "eligible": eligible,
            "significant": signif,
            "hrrp_exempt": st in HRRP_EXEMPT_STATES,
        })
    by_state.sort(key=lambda d: d["mean_err"], reverse=True)
    return by_state


def _design(j: pd.DataFrame, extra: list[str] | None = None) -> pd.DataFrame:
    """Dummy-coded design matrix: ownership, star rating, condition and state fixed effects."""
    j = j.copy()
    j["rating_cat"] = j["star_rating"].map(lambda r: f"{int(r)}" if pd.notna(r) else "Unrated")
    parts = [pd.Series(1.0, index=j.index, name="const")]
    refs = {"ownership": "Non-profit", "rating_cat": "3", "condition": "Heart Failure"}
    for col, ref in [*refs.items(), ("state", sorted(j["state"].unique())[0])]:
        d = pd.get_dummies(j[col], prefix=col, dtype=float)
        d = d.drop(columns=f"{col}_{ref}")
        parts.append(d)
    for e in extra or []:
        parts.append(j[e].astype(float))
    return pd.concat(parts, axis=1)


def model_block(rep: pd.DataFrame, info: pd.DataFrame) -> tuple[dict, dict]:
    """
    Adjusted model: ERR (x100) ~ ownership + star rating + condition + state FE,
    with standard errors clustered by hospital. Coefficients read as
    "percentage points of ERR vs the reference group, holding the rest fixed".
    A second fit on the suppression-safe rows adds log2(discharges) to estimate
    the volume effect per doubling.
    """
    j = rep.merge(info, on="facility_id", how="inner")
    j = j[j["ownership"].isin(["Non-profit", "For-profit", "Government", "Federal / Military"])]
    y = j["err"] * 100
    X = _design(j)
    res = ols_cluster(X, y, j["facility_id"])

    terms = []
    for grp in ["For-profit", "Government", "Federal / Military"]:
        r = res.loc[f"ownership_{grp}"]
        terms.append({"group": "Ownership", "label": grp, **_coef(r)})
    for s in ["1", "2", "4", "5", "Unrated"]:
        key = f"rating_cat_{s}"
        if key in res.index:
            r = res.loc[key]
            terms.append({"group": "Star rating", "label": f"★{s}" if s != "Unrated" else "Unrated", **_coef(r)})
    model = {
        "outcome": "ERR x 100 (percentage points)",
        "references": {"ownership": "Non-profit", "rating": "★3"},
        "controls": ["condition", "state"],
        "n_obs": res.attrs["n_obs"],
        "n_clusters": res.attrs["n_clusters"],
        "terms": terms,
    }

    safe = j[suppression_safe(j)].copy()
    safe["log2_discharges"] = np.log2(safe["discharges"]) - np.log2(safe["discharges"]).mean()
    res_v = ols_cluster(_design(safe, ["log2_discharges"]), safe["err"] * 100, safe["facility_id"])
    volume = {**_coef(res_v.loc["log2_discharges"]),
              "n_obs": res_v.attrs["n_obs"], "n_clusters": res_v.attrs["n_clusters"]}
    return model, volume


def _coef(r: pd.Series) -> dict:
    return {
        "estimate": round(float(r["estimate"]), 2),
        "ci_low": round(float(r["ci_low"]), 2),
        "ci_high": round(float(r["ci_high"]), 2),
        "p": float(r["p"]),
    }


def enrichment_aggregates(rep: pd.DataFrame, info: pd.DataFrame, hosp: pd.DataFrame) -> dict:
    """Join reported HRRP measures with hospital attributes and aggregate by each."""
    j = rep.merge(info, on="facility_id", how="left")
    matched = j["ownership"].notna().sum()

    by_ownership = []
    for grp, sub in j.dropna(subset=["ownership"]).groupby("ownership"):
        by_ownership.append({"group": grp, **_err_stats(sub)})
    by_ownership.sort(key=lambda d: d["mean_err"], reverse=True)

    by_rating = []
    for r, sub in j.dropna(subset=["star_rating"]).groupby("star_rating"):
        by_rating.append({"rating": int(r), **_err_stats(sub)})
    by_rating.sort(key=lambda d: d["rating"])

    # Hospital type: keep types with enough volume.
    by_type = []
    for t, sub in j.dropna(subset=["hospital_type"]).groupby("hospital_type"):
        if sub["facility_id"].nunique() >= 25:
            by_type.append({"type": t, **_err_stats(sub)})
    by_type.sort(key=lambda d: d["mean_err"], reverse=True)

    # Tests run at the HOSPITAL level (one value per hospital) so correlated
    # measures from the same facility are not counted as independent evidence.
    hj = hosp.merge(info, on="facility_id", how="left")
    groups = [g["mean_err"].to_numpy() for _, g in hj.dropna(subset=["ownership"]).groupby("ownership")]
    kw = stats.kruskal(*groups)
    fp = hj.loc[hj["ownership"] == "For-profit", "mean_err"]
    np_ = hj.loc[hj["ownership"] == "Non-profit", "mean_err"]
    mw = stats.mannwhitneyu(fp, np_, alternative="two-sided")
    rated = hj.dropna(subset=["star_rating"])
    sp = stats.spearmanr(rated["star_rating"], rated["mean_err"])

    return {
        "matched_measures": int(matched),
        "match_rate_pct": round(float(hj["ownership"].notna().mean() * 100), 1),
        "by_ownership": by_ownership,
        "by_rating": by_rating,
        "by_hospital_type": by_type,
        "tests": {
            "ownership_kruskal": _test(kw.statistic, kw.pvalue, len(hj.dropna(subset=["ownership"]))),
            "forprofit_vs_nonprofit": _test(
                mw.statistic, mw.pvalue, len(fp) + len(np_),
                median_forprofit=round(float(fp.median()), 4),
                median_nonprofit=round(float(np_.median()), 4),
            ),
            "rating_spearman": _test(sp.statistic, sp.pvalue, len(rated)),
        },
    }


def surgical_vs_medical(rep: pd.DataFrame) -> dict:
    """Paired, within-hospital comparison (hospitals reporting both groups)."""
    w = rep.pivot_table(index="facility_id", columns="clinical_group", values="err", aggfunc="mean").dropna()
    diff = w["Surgical"] - w["Medical"]
    wt = stats.wilcoxon(diff)
    return _test(wt.statistic, wt.pvalue, len(diff), median_diff=round(float(diff.median()), 4))


def release_label(prov: dict) -> str | None:
    m = re.search(r"FY_?(\d{4})", prov.get("download_url") or "")
    return f"FY {m.group(1)}" if m else None


def reporting_period(df: pd.DataFrame) -> str:
    starts = pd.to_datetime(df["start_date"], errors="coerce")
    ends = pd.to_datetime(df["end_date"], errors="coerce")
    if starts.nunique() > 1 or ends.nunique() > 1:
        print("! Multiple reporting windows found — reporting the overall span.")
    return f"{starts.min():%m/%d/%Y} – {ends.max():%m/%d/%Y}"


def build_aggregates(df: pd.DataFrame, info: pd.DataFrame, prov: dict) -> dict:
    rep = df[df["is_reported"]].copy()  # only rows with usable ERR
    hosp = hospital_means(rep)

    # --- KPIs ---
    n_reporting = int(rep["facility_id"].nunique())
    any_worse = int((hosp["n_worse"] > 0).sum())
    counts = rep.dropna(subset=["discharges"])
    kpis = {
        "n_hospitals_in_file": int(df["facility_id"].nunique()),
        "n_hospitals": n_reporting,                   # hospitals with >= 1 reported ERR
        "n_states": int(rep["state"].nunique()),
        "n_measures_reported": int(len(rep)),
        "n_measures_total": int(len(df)),
        "n_measures_with_counts": int(len(counts)),
        "national_mean_err": round(float(rep["err"].mean()), 4),
        "national_median_err": round(float(rep["err"].median()), 4),
        "pct_worse_than_expected": round(float(rep["worse_than_expected"].mean() * 100), 1),
        "pct_err_above_110": round(float((rep["err"] > 1.10).mean() * 100), 1),
        "pct_err_below_090": round(float((rep["err"] < 0.90).mean() * 100), 1),
        "n_hospitals_any_worse": any_worse,
        "pct_hospitals_any_worse": round(any_worse / n_reporting * 100, 1),
        "total_discharges": int(counts["discharges"].sum()),
        "total_readmissions": int(counts["readmissions"].sum()),
    }

    # --- By condition ---
    by_condition = []
    for code, (label, full, group) in CONDITIONS.items():
        sub = rep[rep["measure_code"] == code]
        s = _err_stats(sub)
        by_condition.append({
            "code": code, "label": label, "full": full, "group": group,
            "n": s["n_measures"], "mean_err": s["mean_err"], "median_err": s["median_err"],
            "pct_worse": s["pct_worse"], "pct_worse_ci": s["pct_worse_ci"],
        })
    by_condition.sort(key=lambda d: d["pct_worse"], reverse=True)

    # --- Adjusted model + volume ---
    model, model_volume = model_block(rep, info)
    volume_vs_err, volume_artifact = volume_block(rep, model_volume)

    # --- Per-hospital summary (mean ERR across reported conditions) ---
    info_lookup = info.set_index("facility_id")
    hosp_rows = []
    for fid, sub in rep.groupby("facility_id"):
        measures = {r["condition"]: round(float(r["err"]), 4) for _, r in sub.iterrows()}
        worst = sub.loc[sub["err"].idxmax()]
        attrs = info_lookup.loc[fid] if fid in info_lookup.index else None
        rating = None
        if attrs is not None and pd.notna(attrs["star_rating"]):
            rating = int(attrs["star_rating"])
        disch = sub["discharges"]
        hosp_rows.append({
            "id": fid,
            "name": sub["facility_name"].iloc[0],
            "state": sub["state"].iloc[0],
            "mean_err": round(float(sub["err"].mean()), 4),
            "n_reported": int(len(sub)),
            "n_worse": int((sub["err"] > 1).sum()),
            # Null when CMS suppressed every discharge count for this hospital.
            "total_discharges": int(disch.sum()) if disch.notna().any() else None,
            "worst_condition": worst["condition"],
            "worst_err": round(float(worst["err"]), 4),
            "ownership": (attrs["ownership"] if attrs is not None else None),
            "star_rating": rating,
            "measures": measures,
        })
    hosp_rows.sort(key=lambda h: h["mean_err"])

    hrrp_prov = prov.get(HRRP_ID, {})
    info_prov = prov.get(INFO_ID, {})
    return {
        "meta": {
            "title": hrrp_prov.get("title"),
            "dataset_id": hrrp_prov.get("dataset_id"),
            "release": release_label(hrrp_prov),
            "reporting_period": reporting_period(df),
            "modified": hrrp_prov.get("modified"),
            "released": hrrp_prov.get("released"),
            "retrieved_at_utc": hrrp_prov.get("retrieved_at_utc"),
            "generated_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "source": "CMS Provider Data Catalog — Hospital Readmissions Reduction Program",
            "enrichment_source": "CMS Hospital General Information",
            "enrichment_modified": info_prov.get("modified"),
            "min_conditions_for_ranking": MIN_CONDITIONS_FOR_RANKING,
            "min_hospitals_for_state_rank": MIN_HOSPITALS_FOR_STATE_RANK,
        },
        "kpis": kpis,
        "consistency": consistency_block(rep, hosp),
        "by_condition": by_condition,
        "err_histogram": hist(rep["err"], 0.60, 1.40, 0.05),
        "by_state": state_block(rep, hosp),
        "volume_vs_err": volume_vs_err,
        "volume_artifact": volume_artifact,
        "enrichment": enrichment_aggregates(rep, info, hosp),
        "model": model,
        "tests": {"surgical_vs_medical": surgical_vs_medical(rep)},
        "hospitals": hosp_rows,
    }


def main() -> None:
    if not RAW_CSV.exists() or not INFO_CSV.exists():
        sys.exit("✗ Raw data missing — run `python src/fetch_data.py` first.")
    prov = json.loads(PROVENANCE.read_text()) if PROVENANCE.exists() else {}
    raw = pd.read_csv(RAW_CSV, dtype=str)
    clean_df = clean(raw)
    info = clean_info(pd.read_csv(INFO_CSV, dtype=str))

    PROC_DIR.mkdir(parents=True, exist_ok=True)
    clean_df.to_csv(PROC_DIR / "hrrp_clean.csv", index=False)
    rep_df = clean_df[clean_df["is_reported"]]
    rep_df.to_csv(PROC_DIR / "hrrp_reported.csv", index=False)
    # Enriched reported table (HRRP measures + hospital attributes) for the notebook.
    rep_df.merge(info, on="facility_id", how="left").to_csv(
        PROC_DIR / "hrrp_enriched.csv", index=False)

    agg = build_aggregates(clean_df, info, prov)
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    # Compact JSON: this file is shipped to every dashboard visitor.
    OUT_JSON.write_text(json.dumps(agg, separators=(",", ":"), allow_nan=False))

    print(f"✓ Clean long table  → data/processed/hrrp_clean.csv ({len(clean_df):,} rows)")
    print(f"✓ Reported-only     → data/processed/hrrp_reported.csv ({clean_df['is_reported'].sum():,} rows)")
    print("✓ Enriched table    → data/processed/hrrp_enriched.csv")
    print(f"✓ Dashboard JSON    → {OUT_JSON.relative_to(ROOT)} ({OUT_JSON.stat().st_size / 1024:,.0f} KB)")
    k, c = agg["kpis"], agg["consistency"]
    print(f"  KPIs: {k['n_hospitals']:,} reporting hospitals | mean ERR {k['national_mean_err']} | "
          f"{k['pct_worse_than_expected']}% of measures above 1.0")
    print(f"  Consistency: {c['pct_all_worse']}% of hospitals worse on every condition "
          f"(chance ≈ {c['pct_all_worse_expected']}%)")
    va = agg["volume_artifact"]
    print(f"  Volume ρ: naive {va['naive_spearman']['stat']} → suppression-safe {va['safe_spearman']['stat']}")


if __name__ == "__main__":
    main()

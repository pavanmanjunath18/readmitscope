"""
build_aggregates.py — Clean the raw HRRP data and build analysis outputs.

Pipeline:
  1. Load data/raw/hrrp_raw.csv
  2. Clean: coerce numerics, map suppression sentinels -> null, map measure codes
     to human labels, derive analytic flags.
  3. Save processed long table -> data/processed/hrrp_clean.csv
  4. Compute aggregates and write dashboard/readmit_data.json (consumed by the app).

All cleaning decisions are documented in docs/03_data_quality_log.md and were
derived from the profiling in notebooks/01_cleaning.ipynb.

Usage:
    python src/build_aggregates.py
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

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


def clean(df: pd.DataFrame) -> pd.DataFrame:
    """Apply documented cleaning steps; return a tidy long table."""
    df = df.copy()
    df.columns = [c.strip() for c in df.columns]

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
    df["worse_than_expected"] = df["err"] > 1.0            # contributes to penalty
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


def hist(series: pd.Series, lo: float, hi: float, step: float) -> list[dict]:
    edges = np.round(np.arange(lo, hi + step, step), 4)
    counts, _ = np.histogram(series.dropna(), bins=edges)
    return [
        {"bin_start": float(edges[i]), "bin_end": float(edges[i + 1]), "count": int(counts[i])}
        for i in range(len(counts))
    ]


def clean_info(info: pd.DataFrame) -> pd.DataFrame:
    """Clean Hospital General Information -> one row per facility with enrichment fields."""
    info = info.copy()
    info.columns = [c.strip() for c in info.columns]
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


def _err_stats(sub: pd.DataFrame) -> dict:
    return {
        "n_hospitals": int(sub["facility_id"].nunique()),
        "n_measures": int(len(sub)),
        "mean_err": round(float(sub["err"].mean()), 4),
        "median_err": round(float(sub["err"].median()), 4),
        "pct_worse": round(float((sub["err"] > 1).mean() * 100), 1),
    }


def enrichment_aggregates(rep: pd.DataFrame, info: pd.DataFrame) -> dict:
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

    # Hospital type: keep the two HRRP-relevant types with enough volume.
    by_type = []
    for t, sub in j.dropna(subset=["hospital_type"]).groupby("hospital_type"):
        if sub["facility_id"].nunique() >= 25:
            by_type.append({"type": t, **_err_stats(sub)})
    by_type.sort(key=lambda d: d["mean_err"], reverse=True)

    return {
        "matched_measures": int(matched),
        "by_ownership": by_ownership,
        "by_rating": by_rating,
        "by_hospital_type": by_type,
    }


def build_aggregates(df: pd.DataFrame, info: pd.DataFrame, prov: dict) -> dict:
    rep = df[df["is_reported"]].copy()  # only rows with usable ERR

    # --- KPIs ---
    penalized = (
        rep[rep["worse_than_expected"]]
        .groupby("facility_id").size().index
    )
    kpis = {
        "n_hospitals": int(df["facility_id"].nunique()),
        "n_states": int(df["state"].nunique()),
        "n_measures_reported": int(len(rep)),
        "n_measures_total": int(len(df)),
        "national_mean_err": round(float(rep["err"].mean()), 4),
        "national_median_err": round(float(rep["err"].median()), 4),
        "pct_worse_than_expected": round(float(rep["worse_than_expected"].mean() * 100), 1),
        "n_hospitals_any_worse": int(len(penalized)),
        "pct_hospitals_any_worse": round(len(penalized) / df["facility_id"].nunique() * 100, 1),
        "total_discharges": int(rep["discharges"].sum()),
        "total_readmissions": int(rep["readmissions"].sum()),
    }

    # --- By condition ---
    by_condition = []
    for code, (label, full, group) in CONDITIONS.items():
        sub = rep[rep["measure_code"] == code]
        by_condition.append({
            "code": code,
            "label": label,
            "full": full,
            "group": group,
            "n": int(len(sub)),
            "mean_err": round(float(sub["err"].mean()), 4),
            "median_err": round(float(sub["err"].median()), 4),
            "pct_worse": round(float((sub["err"] > 1).mean() * 100), 1),
            "total_discharges": int(sub["discharges"].sum()),
            "total_readmissions": int(sub["readmissions"].sum()),
        })
    by_condition.sort(key=lambda d: d["pct_worse"], reverse=True)

    # --- ERR distribution (overall) ---
    err_histogram = hist(rep["err"], 0.45, 1.65, 0.05)

    # --- By state ---
    by_state = []
    for st, sub in rep.groupby("state"):
        by_state.append({
            "state": st,
            "n_hospitals": int(sub["facility_id"].nunique()),
            "n_reported": int(len(sub)),
            "mean_err": round(float(sub["err"].mean()), 4),
            "pct_worse": round(float((sub["err"] > 1).mean() * 100), 1),
            "total_discharges": int(sub["discharges"].sum()),
            "total_readmissions": int(sub["readmissions"].sum()),
        })
    by_state.sort(key=lambda d: d["mean_err"], reverse=True)

    # --- Volume vs ERR (rows with both discharges and ERR) ---
    vol = rep.dropna(subset=["discharges"]).copy()
    bins = [0, 50, 100, 200, 400, 800, np.inf]
    labels = ["<50", "50-100", "100-200", "200-400", "400-800", "800+"]
    vol["vol_bin"] = pd.cut(vol["discharges"], bins=bins, labels=labels, right=False)
    volume_vs_err = []
    for lab, sub in vol.groupby("vol_bin", observed=True):
        volume_vs_err.append({
            "bin": str(lab),
            "n": int(len(sub)),
            "mean_err": round(float(sub["err"].mean()), 4),
            "pct_worse": round(float((sub["err"] > 1).mean() * 100), 1),
        })

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
        hosp_rows.append({
            "id": fid,
            "name": sub["facility_name"].iloc[0],
            "state": sub["state"].iloc[0],
            "mean_err": round(float(sub["err"].mean()), 4),
            "n_reported": int(len(sub)),
            "n_worse": int((sub["err"] > 1).sum()),
            "total_discharges": int(sub["discharges"].sum()),
            "worst_condition": worst["condition"],
            "worst_err": round(float(worst["err"]), 4),
            "ownership": (attrs["ownership"] if attrs is not None else None),
            "star_rating": rating,
            "measures": measures,
        })
    hosp_rows.sort(key=lambda h: h["mean_err"])

    # Best / worst with a minimum reporting bar (>=3 conditions) for fairness.
    eligible = [h for h in hosp_rows if h["n_reported"] >= 3]
    top_best = eligible[:20]
    top_worst = sorted(eligible, key=lambda h: h["mean_err"], reverse=True)[:20]

    hrrp_prov = prov.get(HRRP_ID, {})
    info_prov = prov.get(INFO_ID, {})
    return {
        "meta": {
            "title": hrrp_prov.get("title"),
            "dataset_id": hrrp_prov.get("dataset_id"),
            "reporting_period": f"{df['start_date'].iloc[0]} – {df['end_date'].iloc[0]}",
            "modified": hrrp_prov.get("modified"),
            "released": hrrp_prov.get("released"),
            "retrieved_at_utc": hrrp_prov.get("retrieved_at_utc"),
            "source": "CMS Provider Data Catalog — Hospital Readmissions Reduction Program",
            "enrichment_source": "CMS Hospital General Information",
            "enrichment_modified": info_prov.get("modified"),
        },
        "kpis": kpis,
        "by_condition": by_condition,
        "err_histogram": err_histogram,
        "by_state": by_state,
        "volume_vs_err": volume_vs_err,
        "enrichment": enrichment_aggregates(rep, info),
        "top_best": top_best,
        "top_worst": top_worst,
        "hospitals": hosp_rows,
    }


def main() -> None:
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
    OUT_JSON.write_text(json.dumps(agg, indent=2))

    print(f"✓ Clean long table  → data/processed/hrrp_clean.csv ({len(clean_df):,} rows)")
    print(f"✓ Reported-only     → data/processed/hrrp_reported.csv ({clean_df['is_reported'].sum():,} rows)")
    print(f"✓ Enriched table    → data/processed/hrrp_enriched.csv")
    print(f"✓ Dashboard JSON    → {OUT_JSON.relative_to(ROOT)}")
    k = agg["kpis"]
    print(f"  KPIs: {k['n_hospitals']:,} hospitals | national mean ERR {k['national_mean_err']} | "
          f"{k['pct_worse_than_expected']}% measures worse than expected")
    print(f"  Enrichment matched {agg['enrichment']['matched_measures']:,} measures to hospital attributes")


if __name__ == "__main__":
    main()

"""Tests for the ReadmitScope cleaning + statistics pipeline (no network, no raw data needed)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

import build_aggregates as ba  # noqa: E402
import fetch_data as fd  # noqa: E402
from stats_utils import fmt_p, mean_ci, ols_cluster, wilson_ci  # noqa: E402


def raw_rows(rows: list[dict]) -> pd.DataFrame:
    base = {
        "Facility Name": "TEST HOSPITAL", "Facility ID": "010001", "State": "AL",
        "Measure Name": "READM-30-HF-HRRP", "Number of Discharges": "200", "Footnote": "",
        "Excess Readmission Ratio": "1.0500", "Predicted Readmission Rate": "21.0",
        "Expected Readmission Rate": "20.0", "Number of Readmissions": "42",
        "Start Date": "07/01/2021", "End Date": "06/30/2024",
    }
    return pd.DataFrame([{**base, **r} for r in rows], dtype=str)


# --------------------------------------------------------------------------- cleaning
def test_clean_maps_sentinels_and_flags():
    df = ba.clean(raw_rows([
        {},
        {"Measure Name": "READM-30-PN-HRRP", "Excess Readmission Ratio": "Not Available",
         "Number of Discharges": "N/A", "Number of Readmissions": "Too Few to Report", "Footnote": "1"},
        {"Measure Name": "READM-30-AMI-HRRP", "Excess Readmission Ratio": "0.9500", "Footnote": "29"},
    ]))
    assert df["facility_id"].iloc[0] == "010001"          # leading zero preserved
    assert df["err"].isna().tolist() == [False, True, False]
    assert df["discharges"].isna().tolist() == [False, True, False]
    assert df["is_reported"].tolist() == [True, False, True]
    assert df["worse_than_expected"].tolist() == [True, False, False]
    assert df["has_advisory"].tolist() == [False, False, True]
    assert df["condition"].tolist() == ["Heart Failure", "Pneumonia", "Heart Attack"]


def test_clean_rejects_unknown_measure():
    with pytest.raises(ValueError, match="unrecognised measure"):
        ba.clean(raw_rows([{"Measure Name": "READM-30-NEW-HRRP"}]))


def test_clean_rejects_missing_column():
    with pytest.raises(ValueError, match="schema changed"):
        ba.clean(raw_rows([{}]).drop(columns=["Excess Readmission Ratio"]))


def test_clean_info_groups_ownership_and_rating():
    info = pd.DataFrame({
        "Facility ID": ["010001", "010002", "010003"],
        "Hospital Type": ["Acute Care Hospitals"] * 3,
        "Hospital Ownership": ["Proprietary", "Voluntary non-profit - Church", "Something New"],
        "Emergency Services": ["Yes"] * 3,
        "Hospital overall rating": ["4", "Not Available", "1"],
    })
    out = ba.clean_info(info)
    assert out["ownership"].tolist() == ["For-profit", "Non-profit", "Other"]
    assert out["star_rating"].isna().tolist() == [False, True, False]


def test_suppression_safe_rule():
    df = pd.DataFrame({
        "discharges": [100.0, 120.0, np.nan, 500.0],
        "expected_rate": [20.0, 20.0, 20.0, 5.0],
    })
    # need = 2 * 11 / rate  -> 110 at 20%, 440 at 5%
    assert ba.suppression_safe(df).tolist() == [False, True, False, True]


def test_reporting_period_single_window():
    df = pd.DataFrame({"start_date": ["07/01/2021"] * 2, "end_date": ["06/30/2024"] * 2})
    assert ba.reporting_period(df) == "07/01/2021 – 06/30/2024"


def test_release_label():
    assert ba.release_label({"download_url": ".../FY_2026_Hospital_Readmissions.csv"}) == "FY 2026"
    assert ba.release_label({}) is None


# --------------------------------------------------------------------------- consistency
def test_consistency_expected_rates_match_closed_form():
    # 4 hospitals x 3 conditions, exactly half the measures above 1.0.
    rep = pd.DataFrame({
        "facility_id": np.repeat(["a", "b", "c", "d"], 3),
        "condition": ["HF", "PN", "AMI"] * 4,
        "err": [1.1, 1.1, 1.1, 0.9, 0.9, 0.9, 1.1, 0.9, 1.1, 0.9, 1.1, 0.9],
        "state": "AL",
    })
    rep["worse_than_expected"] = rep["err"] > 1
    hosp = ba.hospital_means(rep)
    c = ba.consistency_block(rep, hosp)
    assert c["p_measure_worse"] == 50.0
    assert c["pct_all_worse"] == 25.0 and c["pct_all_better"] == 25.0
    assert c["pct_all_worse_expected"] == 12.5          # 0.5 ** 3
    assert c["pct_any_worse_expected"] == 87.5          # 1 - 0.5 ** 3


# --------------------------------------------------------------------------- stats utils
def test_wilson_ci_brackets_proportion():
    lo, hi = wilson_ci(50, 100)
    assert lo < 50 < hi and round(lo, 1) == 40.4 and round(hi, 1) == 59.6
    assert wilson_ci(0, 0) != wilson_ci(0, 0)  # NaNs


def test_mean_ci():
    lo, hi = mean_ci(pd.Series([1.0, 2.0, 3.0]))
    assert lo < 2 < hi
    assert np.isnan(mean_ci(pd.Series([1.0]))[0])


def test_ols_cluster_recovers_coefficients_and_widens_se():
    rng = np.random.default_rng(0)
    n_clusters, per = 200, 5
    g = np.repeat(np.arange(n_clusters), per)
    x = rng.normal(size=n_clusters * per)
    shared = rng.normal(size=n_clusters)[g]            # within-cluster correlation
    y = 2.0 + 0.5 * x + shared + rng.normal(scale=0.5, size=len(x))
    X = pd.DataFrame({"const": 1.0, "x": x})
    res = ols_cluster(X, pd.Series(y), pd.Series(g))
    assert abs(res.loc["x", "estimate"] - 0.5) < 0.05
    assert abs(res.loc["const", "estimate"] - 2.0) < 0.2
    assert res.attrs == {"n_obs": 1000, "n_clusters": 200}
    # With each observation its own cluster, the intercept SE should be much smaller
    # than with the true clustering (which accounts for the shared component).
    naive = ols_cluster(X, pd.Series(y), pd.Series(np.arange(len(y))))
    assert res.loc["const", "se"] > 1.5 * naive.loc["const", "se"]


def test_fmt_p():
    assert fmt_p(1e-9) == "< 0.001"
    assert fmt_p(0.0678) == "0.068"
    assert fmt_p(float("nan")) == "n/a"


# --------------------------------------------------------------------------- fetch
def test_pick_csv_distribution_prefers_csv():
    dists = [
        {"data": {"downloadURL": "https://x/data.json", "mediaType": "application/json"}},
        {"data": {"downloadURL": "https://x/data.csv", "mediaType": "text/csv"}},
    ]
    assert fd.pick_csv_distribution(dists) == "https://x/data.csv"
    assert fd.pick_csv_distribution([]) is None


def test_check_header_detects_schema_change():
    fd.check_header(b"Facility ID,Measure Name\n1,2\n", {"Facility ID"}, "x")
    with pytest.raises(SystemExit):
        fd.check_header(b"Facility ID\n1\n", {"Facility ID", "Measure Name"}, "x")


# --------------------------------------------------------------------------- dashboard contract
DASHBOARD_JSON = ROOT / "dashboard" / "public" / "readmit_data.json"


@pytest.mark.skipif(not DASHBOARD_JSON.exists(), reason="dashboard JSON not built")
def test_dashboard_json_contract():
    d = json.loads(DASHBOARD_JSON.read_text())
    for key in ["meta", "kpis", "consistency", "by_condition", "err_histogram", "by_state",
                "volume_vs_err", "volume_artifact", "enrichment", "model", "tests", "hospitals"]:
        assert key in d, key
    k = d["kpis"]
    # Hospital-level percentages use hospitals that actually report a measure.
    assert k["n_hospitals"] <= k["n_hospitals_in_file"]
    assert k["pct_hospitals_any_worse"] == round(k["n_hospitals_any_worse"] / k["n_hospitals"] * 100, 1)
    assert sum(b["count"] for b in d["err_histogram"]) == k["n_measures_reported"]
    assert len(d["hospitals"]) == k["n_hospitals"]
    assert all(s["n_hospitals"] >= d["meta"]["min_hospitals_for_state_rank"] for s in d["by_state"] if s["eligible"])
    for h in d["hospitals"]:
        assert h["total_discharges"] is None or h["total_discharges"] > 0

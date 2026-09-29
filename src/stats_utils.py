"""
stats_utils.py — Small, dependency-light statistical helpers for ReadmitScope.

Kept separate from build_aggregates.py so they can be unit-tested in isolation.
Everything here uses only numpy / pandas / scipy (no statsmodels dependency).
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats


def wilson_ci(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """95% Wilson score interval for a proportion k/n, returned in percent."""
    if n == 0:
        return (float("nan"), float("nan"))
    p = k / n
    denom = 1 + z**2 / n
    centre = (p + z**2 / (2 * n)) / denom
    half = z * np.sqrt(p * (1 - p) / n + z**2 / (4 * n**2)) / denom
    return (round(float((centre - half) * 100), 1), round(float((centre + half) * 100), 1))


def mean_ci(x: pd.Series, conf: float = 0.95) -> tuple[float, float]:
    """t-based confidence interval for the mean of x."""
    x = pd.Series(x).dropna()
    n = len(x)
    if n < 2:
        return (float("nan"), float("nan"))
    se = x.std(ddof=1) / np.sqrt(n)
    t = stats.t.ppf(0.5 + conf / 2, df=n - 1)
    m = x.mean()
    return (float(m - t * se), float(m + t * se))


def ols_cluster(
    X: pd.DataFrame, y: pd.Series, groups: pd.Series
) -> pd.DataFrame:
    """
    OLS with cluster-robust (CR1) standard errors.

    Measures from the same hospital are correlated, so treating them as
    independent overstates precision; clustering by hospital fixes that.
    Returns a frame indexed by term with estimate, se, ci_low, ci_high, p.
    """
    Xv = X.to_numpy(dtype=float)
    yv = y.to_numpy(dtype=float)
    n, k = Xv.shape
    beta, *_ = np.linalg.lstsq(Xv, yv, rcond=None)
    resid = yv - Xv @ beta
    bread = np.linalg.pinv(Xv.T @ Xv)

    scores = pd.DataFrame(Xv * resid[:, None]).groupby(groups.to_numpy()).sum().to_numpy()
    meat = scores.T @ scores
    g = scores.shape[0]
    adj = (g / (g - 1)) * ((n - 1) / (n - k))
    vcov = adj * bread @ meat @ bread
    se = np.sqrt(np.clip(np.diag(vcov), 0, None))

    tcrit = stats.t.ppf(0.975, df=g - 1)
    with np.errstate(divide="ignore", invalid="ignore"):
        tstat = beta / se
    p = 2 * stats.t.sf(np.abs(tstat), df=g - 1)
    out = pd.DataFrame(
        {
            "estimate": beta,
            "se": se,
            "ci_low": beta - tcrit * se,
            "ci_high": beta + tcrit * se,
            "p": p,
        },
        index=X.columns,
    )
    out.attrs.update({"n_obs": int(n), "n_clusters": int(g)})
    return out


def fmt_p(p: float) -> str:
    """Human-friendly p-value string (e.g. '< 0.001', '0.034')."""
    if p is None or not np.isfinite(p):
        return "n/a"
    if p < 0.001:
        return "< 0.001"
    return f"{p:.3f}"

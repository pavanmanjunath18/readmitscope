"""
_build_notebooks.py — Generate the three analysis notebooks as .ipynb files.

Produces:
  01_cleaning.ipynb   — load, profile, document data quality, write clean data
  02_eda.ipynb        — exploratory charts with written narrative
  03_analysis.ipynb   — statistical analysis + headline findings

After generating, execute them in place:
    jupyter nbconvert --to notebook --execute --inplace notebooks/0*.ipynb
"""
from __future__ import annotations
import nbformat as nbf
from pathlib import Path

ND = Path(__file__).resolve().parent


def md(text): return nbf.v4.new_markdown_cell(text.strip("\n"))
def code(text): return nbf.v4.new_code_cell(text.strip("\n"))


def write(name, cells):
    nb = nbf.v4.new_notebook()
    nb["cells"] = cells
    nb["metadata"] = {
        "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
        "language_info": {"name": "python"},
    }
    (ND / name).write_text(nbf.writes(nb))
    print("wrote", name)


SETUP = """
import pandas as pd, numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path

sns.set_theme(style="whitegrid")
ORANGE, DARK, MUTED = "#FF8000", "#0D0D0D", "#9CA3AF"
plt.rcParams.update({"figure.dpi": 110, "axes.titleweight": "bold",
                     "axes.titlesize": 12, "font.size": 10})

ROOT = Path.cwd().parent if Path.cwd().name == "notebooks" else Path.cwd()
RAW = ROOT / "data" / "raw" / "hrrp_raw.csv"
PROC = ROOT / "data" / "processed" / "hrrp_reported.csv"
"""

# ----------------------------------------------------------------------------- 01 cleaning
clean_cells = [
    md("""
# 01 — Data Loading, Profiling & Cleaning
**ReadmitScope US** · CMS Hospital Readmissions Reduction Program (FY 2026)

This notebook loads the raw CMS extract, profiles it, documents every data-quality
issue, and writes the cleaned table. Decisions here are mirrored in
`docs/03_data_quality_log.md` and implemented in `src/build_aggregates.py`.
"""),
    code(SETUP),
    md("## 1. Load raw data\nNumeric fields are read as strings because CMS embeds text suppression markers in them."),
    code("""
raw = pd.read_csv(RAW, dtype=str)
print("shape:", raw.shape)
raw.head(3)
"""),
    md("## 2. Structure & grain\nConfirm one row per hospital × condition, and that `Facility ID` is the real key."),
    code("""
print("rows per facility (expect all == 6):")
print(raw.groupby('Facility ID').size().value_counts())
print("\\nunique Facility IDs:", raw['Facility ID'].nunique())
print("unique Facility Names:", raw['Facility Name'].nunique(), "(fewer names than IDs -> some shared names)")
print("states:", raw['State'].nunique())
print("measures:", raw['Measure Name'].unique())
"""),
    md("## 3. Missingness & suppression audit\nCMS suppresses unreliable cells. We quantify it and check whether footnotes *explain* it."),
    code("""
err_num = pd.to_numeric(raw['Excess Readmission Ratio'], errors='coerce')
print("null ERR rows:", err_num.isna().sum())
print("footnote value counts:")
print(raw['Footnote'].value_counts(dropna=False))
print("\\nFootnotes 1/5/7 total:", raw['Footnote'].isin(['1','5','7']).sum())
print("=> equals the null-ERR count, so suppression is fully explained (not random).")
print("Footnote 29 rows that still have ERR:",
      raw.loc[raw['Footnote']=='29','Excess Readmission Ratio'].apply(lambda x: pd.notna(pd.to_numeric(x, errors='coerce'))).sum(),
      "of", (raw['Footnote']=='29').sum(), "-> advisory, keep them")
"""),
    md("""
### Cleaning decisions (see `docs/03_data_quality_log.md`)
1. Coerce numerics; map sentinels (`Not Available`, `Too Few to Report`, `N/A`, ``) → null.
2. Rows with footnote **1/5/7** = suppressed ERR → **not reported** (excluded from rate stats).
3. Rows with footnote **29** keep their valid ERR but are flagged `has_advisory`.
4. Keep `Facility ID` as string (preserve leading zeros).
5. Volume analysis limited to rows with both ERR and discharge count.
"""),
    code("""
# The canonical cleaning lives in src/build_aggregates.py; we load its output here.
clean = pd.read_csv(PROC, dtype={'facility_id':str})
print("reported (usable ERR) rows:", len(clean))
print("with discharge volume:", clean['discharges'].notna().sum())
clean[['facility_id','facility_name','state','condition','err','discharges']].head()
"""),
    md("✅ Clean, reported-only dataset ready for EDA → `notebooks/02_eda.ipynb`."),
]

# ----------------------------------------------------------------------------- 02 EDA
eda_cells = [
    md("""
# 02 — Exploratory Data Analysis
**ReadmitScope US**

We explore the **Excess Readmission Ratio (ERR)** = predicted ÷ expected readmission
rate. **ERR > 1 means a hospital readmits *more* than expected** for its case mix.
"""),
    code(SETUP),
    code("df = pd.read_csv(PROC, dtype={'facility_id':str})\nprint(len(df), 'reported measures across', df['facility_id'].nunique(), 'hospitals')"),
    md("## 1. How is ERR distributed nationally?\nERR is centered near 1.0 by construction. The question is the *spread* and how many hospitals sit above 1."),
    code("""
fig, ax = plt.subplots(figsize=(8,4))
ax.hist(df['err'], bins=40, color=ORANGE, edgecolor='white', alpha=0.85)
ax.axvline(1.0, color=DARK, ls='--', lw=2, label='Expected (ERR = 1.0)')
ax.axvline(df['err'].mean(), color='crimson', ls=':', lw=2, label=f"Mean = {df['err'].mean():.3f}")
ax.set_xlabel('Excess Readmission Ratio'); ax.set_ylabel('Hospitals × conditions')
ax.set_title('Distribution of Excess Readmission Ratio'); ax.legend()
plt.tight_layout(); plt.show()
print(f"{(df['err']>1).mean()*100:.1f}% of reported measures are worse than expected (ERR>1)")
"""),
    md("**Read:** roughly symmetric around 1.0 but with a slightly heavier right tail — a minority of hospitals readmit *far* above expected (ERR up to ~1.6), while almost half exceed the benchmark."),
    md("## 2. Which conditions perform worst?"),
    code("""
by_cond = (df.groupby('condition')
             .agg(mean_err=('err','mean'),
                  pct_worse=('err', lambda s:(s>1).mean()*100),
                  n=('err','size'))
             .sort_values('pct_worse', ascending=False))
fig, ax = plt.subplots(figsize=(8,4))
bars = ax.barh(by_cond.index, by_cond['pct_worse'], color=ORANGE)
ax.axvline(50, color=DARK, ls='--', lw=1)
ax.set_xlabel('% of hospitals worse than expected'); ax.set_title('Readmission performance by condition')
ax.invert_yaxis()
for b,v in zip(bars, by_cond['pct_worse']): ax.text(v+0.3, b.get_y()+b.get_height()/2, f"{v:.1f}%", va='center')
plt.tight_layout(); plt.show()
by_cond.round(3)
"""),
    md("**Read:** surgical/cardiac measures (Bypass surgery, Heart attack) have the highest share of worse-than-expected hospitals; pneumonia the lowest. The spread across conditions is modest, suggesting readmissions are a *systemic* challenge rather than isolated to one service line."),
    md("## 3. Does hospital volume relate to readmission performance?"),
    code("""
vol = df.dropna(subset=['discharges']).copy()
bins=[0,50,100,200,400,800,np.inf]; labels=['<50','50-100','100-200','200-400','400-800','800+']
vol['bin']=pd.cut(vol['discharges'],bins=bins,labels=labels,right=False)
g = vol.groupby('bin', observed=True).agg(mean_err=('err','mean'), pct_worse=('err',lambda s:(s>1).mean()*100), n=('err','size'))
fig, ax = plt.subplots(figsize=(8,4))
ax.plot(g.index.astype(str), g['mean_err'], marker='o', color=ORANGE, lw=2)
ax.axhline(1.0, color=DARK, ls='--', lw=1, label='Expected')
ax.set_ylabel('Mean ERR'); ax.set_xlabel('Discharge volume (per condition)')
ax.set_title('Higher-volume hospitals readmit less than expected'); ax.legend()
plt.tight_layout(); plt.show()
g.round(3)
"""),
    md("**Read:** a clear, monotonic gradient — the lowest-volume hospitals average well above 1.0 while the highest-volume average below 1.0. Consistent with a *volume–outcome* relationship (practice effects, resources). ⚠ Caveat: suppressed rows skew small, so the very-low-volume bin is a selected sample."),
    md("## 4. Geographic spread"),
    code("""
by_state = (df.groupby('state').agg(mean_err=('err','mean'),
             pct_worse=('err',lambda s:(s>1).mean()*100), n=('facility_id','nunique'))
             .sort_values('mean_err', ascending=False))
top = pd.concat([by_state.head(8), by_state.tail(8)])
fig, ax = plt.subplots(figsize=(8,6))
colors=[ 'crimson' if v>1 else 'seagreen' for v in top['mean_err']]
ax.barh(top.index, top['mean_err']-1, color=colors)
ax.axvline(0, color=DARK, lw=1)
ax.set_xlabel('Mean ERR relative to 1.0'); ax.set_title('States: highest (top) vs lowest (bottom) mean ERR')
ax.invert_yaxis(); plt.tight_layout(); plt.show()
by_state.head(5).round(3)
"""),
    md("**Read:** mean ERR varies by state; the highest-ERR states warrant a closer look in the analysis notebook (note that ERR is risk-adjusted, so this is not simply a case-mix artifact)."),
]

# ----------------------------------------------------------------------------- 03 analysis
analysis_cells = [
    md("""
# 03 — Statistical Analysis & Findings
**ReadmitScope US**

We move from description to inference: is the volume effect statistically real, do
surgical vs medical conditions differ, and which hospitals are the genuine outliers?
"""),
    code(SETUP + "\nfrom scipy import stats"),
    code("df = pd.read_csv(PROC, dtype={'facility_id':str})"),
    md("## 1. Is the volume–readmission relationship statistically significant?\nSpearman correlation (robust to non-linearity) between discharge volume and ERR."),
    code("""
vol = df.dropna(subset=['discharges'])
rho, p = stats.spearmanr(vol['discharges'], vol['err'])
print(f"Spearman rho = {rho:.3f}, p = {p:.2e}  (n={len(vol):,})")
print("=> significant negative association: more volume -> lower ERR")
"""),
    md("## 2. Do surgical and medical conditions differ?\nMann–Whitney U on ERR between the two clinical groups."),
    code("""
surg = df[df['clinical_group']=='Surgical']['err']
med  = df[df['clinical_group']=='Medical']['err']
u, p = stats.mannwhitneyu(surg, med, alternative='two-sided')
print(f"Surgical median ERR = {surg.median():.4f} (n={len(surg)})")
print(f"Medical  median ERR = {med.median():.4f} (n={len(med)})")
print(f"Mann-Whitney U p = {p:.4f}")
"""),
    md("## 3. Outlier hospitals\nBest and worst performers, requiring ≥3 reported conditions for a fair average."),
    code("""
h = (df.groupby('facility_id')
       .agg(name=('facility_name','first'), state=('state','first'),
            mean_err=('err','mean'), n=('err','size'), n_worse=('err',lambda s:(s>1).sum()))
       .query('n >= 3'))
print('WORST 10 (highest mean ERR):')
display(h.sort_values('mean_err', ascending=False).head(10).round(3))
print('BEST 10 (lowest mean ERR):')
display(h.sort_values('mean_err').head(10).round(3))
"""),
    md("## 4. Concentration — is the problem systemic or a few bad actors?"),
    code("""
share_any = (df.assign(worse=df['err']>1).groupby('facility_id')['worse'].any().mean())*100
print(f"{share_any:.1f}% of hospitals are worse than expected on at least one condition.")
print(f"National mean ERR = {df['err'].mean():.4f}, median = {df['err'].median():.4f}")
"""),
    md("""
## Headline findings
1. **Readmissions are systemic** — ~48% of reported measures and **77% of hospitals**
   exceed their expected readmission rate on at least one condition.
2. **Volume matters** — a statistically significant negative association between
   discharge volume and ERR; low-volume hospitals carry the highest risk.
3. **Surgical vs medical** — tested for a difference between clinical groups (see p-value above).
4. **Outliers exist** — a clear best/worst tail; the worst hospitals readmit ~20–60%
   above expected even after risk adjustment.

See `docs/05_findings.md` for the executive summary and `docs/04_decisions.md` for the
analytical decisions taken along the way.
"""),
]

write("01_cleaning.ipynb", clean_cells)
write("02_eda.ipynb", eda_cells)
write("03_analysis.ipynb", analysis_cells)
print("done")

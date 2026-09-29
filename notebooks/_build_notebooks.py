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
### 3b. When are discharge counts suppressed?
`Number of Discharges` is missing more often than ERR. We check *why* — this matters
for any volume analysis.
"""),
    code("""
disch = pd.to_numeric(raw['Number of Discharges'], errors='coerce')
readm = pd.to_numeric(raw['Number of Readmissions'], errors='coerce')
has_err = err_num.notna()
print(pd.crosstab(disch[has_err].isna(), readm[has_err].isna(),
                  rownames=['discharges missing'], colnames=['readmissions missing']))
print("\\nsmallest published readmission count:", readm.min())
"""),
    md("""
**Read:** discharges and readmissions are suppressed *together*, and the smallest
published readmission count is **11**. CMS only shows counts when readmissions ≥ 11.
For a small hospital, that means we only see its counts when its readmission rate is
high — so a naïve volume analysis on published counts is **biased toward finding that
small hospitals do badly**. The volume analysis therefore uses a *suppression-safe*
subset (see `docs/04_decisions.md`, D6).
"""),
    md("""
### Cleaning decisions (see `docs/03_data_quality_log.md`)
1. Coerce numerics; map sentinels (`Not Available`, `Too Few to Report`, `N/A`, ``) → null.
2. Rows with footnote **1/5/7** = suppressed ERR → **not reported** (excluded from rate stats).
3. Rows with footnote **29** keep their valid ERR but are flagged `has_advisory`.
4. Keep `Facility ID` as string (preserve leading zeros).
5. Volume analysis limited to *suppression-safe* rows: discharges ≥ 2 × 11 ÷ expected rate.
"""),
    code("""
# The canonical cleaning lives in src/build_aggregates.py; we load its output here.
clean = pd.read_csv(PROC, dtype={'facility_id':str})
print("reported (usable ERR) rows:", len(clean))
print("with discharge volume:", clean['discharges'].notna().sum())
clean[['facility_id','facility_name','state','condition','err','discharges']].head()
"""),
    md(" Clean, reported-only dataset ready for EDA : `notebooks/02_eda.ipynb`."),
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
    md("""**Read:** roughly symmetric around 1.0. Because the *expected* rate is what the
national-average hospital would achieve with the same patients, **about half of all
measures sit above 1.0 by construction** — "48% worse than expected" is not by itself
evidence of a problem. The informative parts are the tails and whether the *same*
hospitals keep landing above 1.0 (tested in notebook 03)."""),
    code("""
print(f"ERR > 1.10 (≥10% excess): {(df['err']>1.10).mean()*100:.1f}% of measures")
print(f"ERR < 0.90 (≥10% better): {(df['err']<0.90).mean()*100:.1f}% of measures")
"""),
    md("## 2. Which conditions perform worst?"),
    code("""
by_cond = (df.groupby('condition')
             .agg(mean_err=('err','mean'),
                  pct_worse=('err', lambda s:(s>1).mean()*100),
                  n=('err','size'))
             .sort_values('pct_worse', ascending=False))
fig, ax = plt.subplots(figsize=(8,4))
bars = ax.barh(by_cond.index, by_cond['pct_worse'], color=ORANGE)
ax.axvline(50, color=DARK, ls='--', lw=1); ax.set_xlim(0, 100)
ax.set_xlabel('% of hospitals with ERR > 1'); ax.set_title('Readmission performance by condition')
ax.invert_yaxis()
for b,v in zip(bars, by_cond['pct_worse']): ax.text(v+0.3, b.get_y()+b.get_height()/2, f"{v:.1f}%", va='center')
plt.tight_layout(); plt.show()
by_cond.round(3)
"""),
    md("**Read:** all six conditions sit within ~3 points of each other (≈47–50%), and with ~900–2,700 hospitals per condition those gaps are within sampling noise. **No single condition stands out** — the x-axis starts at 0 on purpose so small differences are not exaggerated."),
    md("## 3. Does hospital volume relate to readmission performance?\nWe compare the naïve view (all published counts) with the *suppression-safe* subset (see notebook 01, §3b)."),
    code("""
import sys; sys.path.insert(0, str(ROOT / 'src'))
from build_aggregates import suppression_safe
bins=[0,50,100,200,400,800,np.inf]; labels=['<50','50-100','100-200','200-400','400-800','800+']
def by_bin(sub):
    sub = sub.assign(bin=pd.cut(sub['discharges'],bins=bins,labels=labels,right=False))
    return sub.groupby('bin', observed=True).agg(pct_worse=('err',lambda s:(s>1).mean()*100), n=('err','size'))
naive = by_bin(df.dropna(subset=['discharges']))
safe  = by_bin(df[suppression_safe(df)]).query('n >= 30')
fig, ax = plt.subplots(figsize=(8,4))
ax.plot(naive.index.astype(str), naive['pct_worse'], marker='o', color=MUTED, lw=2, ls='--', label='All published counts (biased)')
ax.plot(safe.index.astype(str), safe['pct_worse'], marker='o', color=ORANGE, lw=2, label='Suppression-safe rows')
ax.axhline(50, color=DARK, ls=':', lw=1)
ax.set_ylim(0, 100); ax.set_ylabel('% of measures with ERR > 1'); ax.set_xlabel('Discharges (per condition)')
ax.set_title('The steep small-hospital effect comes from suppression'); ax.legend()
plt.tight_layout(); plt.show()
naive.join(safe, rsuffix='_safe').round(1)
"""),
    md("**Read:** the naïve curve shows small hospitals missing the benchmark ~99% of the time — but those are exactly the small hospitals whose readmissions were high enough (≥ 11) to be published. On suppression-safe rows the gradient is shallow (≈52% → 45%), and notebook 03 shows it vanishes once star rating, ownership, condition and state are controlled."),
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
    md("**Read:** mean ERR varies by state, but small states (a handful of hospitals) produce noisy averages. Notebook 03 ranks only states with ≥ 10 reporting hospitals and attaches 95% confidence intervals. CMS risk adjustment covers clinical case mix but not social risk, so state gaps can still partly reflect population differences."),
]

# ----------------------------------------------------------------------------- 03 analysis
analysis_cells = [
    md("""
# 03 — Statistical Analysis & Findings
**ReadmitScope US**

We move from description to inference. Two principles guide every test here:

1. **ERR is centred on 1.0 by construction**, so "share above 1.0" is only meaningful
   relative to what chance would produce.
2. **Measures from the same hospital are correlated**, so tests run at the *hospital*
   level (one value per hospital) or use standard errors *clustered by hospital*.
"""),
    code(SETUP + "\nfrom scipy import stats\nimport sys; sys.path.insert(0, str(ROOT / 'src'))\n"
         "from build_aggregates import suppression_safe, clean_info, model_block\n"
         "from stats_utils import mean_ci, fmt_p"),
    code("df = pd.read_csv(PROC, dtype={'facility_id':str})\n"
         "hosp = df.groupby('facility_id').agg(state=('state','first'), mean_err=('err','mean'),\n"
         "                                     n=('err','size'), n_worse=('err', lambda s:(s>1).sum()))"),
    md("## 1. Is poor performance concentrated in particular hospitals?\n"
       "If ERR > 1 were a coin flip (p ≈ 0.48) independently per condition, how often would a hospital be worse on *at least one* / *every* condition?"),
    code("""
p = (df['err'] > 1).mean()
elig = hosp[hosp['n'] >= 3]
rows = {
    'worse on ≥1 condition':   ((hosp['n_worse']>0).mean(), (1-(1-p)**hosp['n']).mean()),
    'worse on every condition (≥3 reported)': ((elig['n_worse']==elig['n']).mean(), (p**elig['n']).mean()),
    'better on every condition (≥3 reported)': ((elig['n_worse']==0).mean(), ((1-p)**elig['n']).mean()),
}
pd.DataFrame(rows, index=['observed','expected by chance']).T.mul(100).round(1)
"""),
    code("""
wide = df.pivot_table(index='facility_id', columns='condition', values='err')
wide.corr(method='spearman').round(2)
"""),
    md("""**Read:** "83% of hospitals are worse on at least one condition" is actually *below*
the ~89% that coin flips would give, so it is **not** evidence of a systemic problem.
The real signal is **consistency**: about twice as many hospitals as chance predicts
are worse on *every* condition (and likewise better on every condition), and ERR is
positively correlated across conditions within a hospital. Readmission performance
behaves like a hospital-level trait."""),
    md("## 2. Volume — real effect or suppression artifact?"),
    code("""
pub  = df.dropna(subset=['discharges'])
safe = df[suppression_safe(df)]
hidden = df[df['discharges'].isna()]
for name, sub in [('all published counts', pub), ('suppression-safe', safe)]:
    rho, pv = stats.spearmanr(sub['discharges'], sub['err'])
    print(f"{name:22s} rho = {rho:+.3f}  p = {fmt_p(pv)}  n = {len(sub):,}")
print(f"\\nrows with hidden counts (<11 readmissions): n = {len(hidden):,}, "
      f"mean ERR = {hidden['err'].mean():.3f}, {(hidden['err']>1).mean()*100:.1f}% above 1.0")
"""),
    md("""**Read:** the headline ρ ≈ −0.16 shrinks to ≈ −0.05 once the suppression floor is
respected — and the measures CMS hides (mostly small hospitals with few readmissions)
are *better* than average. The adjusted model in §5 finds no volume effect."""),
    md("## 3. Do surgical and medical conditions differ?\nPaired, within-hospital comparison: for hospitals reporting both groups, surgical mean ERR − medical mean ERR (Wilcoxon signed-rank)."),
    code("""
w = df.pivot_table(index='facility_id', columns='clinical_group', values='err', aggfunc='mean').dropna()
diff = w['Surgical'] - w['Medical']
res = stats.wilcoxon(diff)
print(f"hospitals: {len(diff):,}   median difference: {diff.median():+.4f}   p = {fmt_p(res.pvalue)}")
"""),
    md("**Read:** no meaningful difference between surgical and medical readmission performance."),
    md("## 4. States — which differ from 1.0 beyond noise?\nState mean of hospital-level ERR, 95% t-interval; only states with ≥ 10 reporting hospitals are ranked."),
    code("""
st = []
for s, h in hosp.groupby('state'):
    lo, hi = mean_ci(h['mean_err'])
    st.append({'state': s, 'n_hospitals': len(h), 'mean_err': h['mean_err'].mean(), 'ci_low': lo, 'ci_high': hi})
st = pd.DataFrame(st).query('n_hospitals >= 10').sort_values('mean_err', ascending=False)
st['significant'] = np.where(st['ci_low']>1, 'above', np.where(st['ci_high']<1, 'below', ''))
pd.concat([st.head(8), st.tail(8)]).round(4)
"""),
    md("## 5. Adjusted model\nERR × 100 ~ ownership + star rating + condition + state, OLS with hospital-clustered standard errors. A second fit on suppression-safe rows adds log2(discharges)."),
    code("""
info = clean_info(pd.read_csv(ROOT / 'data' / 'raw' / 'hospital_info_raw.csv', dtype=str))
model, volume = model_block(df, info)
print(f"n = {model['n_obs']:,} measures in {model['n_clusters']:,} hospitals\\n")
display(pd.DataFrame(model['terms']).assign(p=lambda d: d['p'].map(fmt_p)))
print(f"\\nVolume (per doubling of discharges): {volume['estimate']:+.2f} pts "
      f"[{volume['ci_low']:+.2f}, {volume['ci_high']:+.2f}], p = {fmt_p(volume['p'])}")
"""),
    md("""**Read:** star rating remains strongly associated with ERR after adjustment (but see the
circularity caveat in notebook 04). The for-profit gap shrinks to well under one ERR point
and is not statistically significant; volume has no detectable effect."""),
    md("## 6. Outlier hospitals\nBest and worst performers, requiring ≥3 reported conditions for a fair average. These are point estimates — single hospitals carry wide uncertainty, so treat them as leads for review, not verdicts."),
    code("""
h = (df.groupby('facility_id')
       .agg(name=('facility_name','first'), state=('state','first'),
            mean_err=('err','mean'), n=('err','size'), n_worse=('err',lambda s:(s>1).sum()))
       .query('n >= 3'))
print('HIGHEST 10 mean ERR:')
display(h.sort_values('mean_err', ascending=False).head(10).round(3))
print('LOWEST 10 mean ERR:')
display(h.sort_values('mean_err').head(10).round(3))
"""),
    md("""
## Headline findings
1. **Performance is a hospital-level trait** — hospitals worse on *every* condition occur at
   about twice the chance rate. ("Most hospitals are worse on ≥1 condition" is expected by construction.)
2. **The small-hospital effect was a reporting artifact** — driven by CMS's ≥11-readmission publication floor.
3. **Star rating tracks ERR strongly**, even after adjustment (partly circular — see notebook 04).
4. **Ownership and surgical/medical gaps are small** once rating and state are accounted for.
5. **A handful of states** sit significantly above or below 1.0.

See `docs/05_findings.md` for the executive summary and `docs/04_decisions.md` for the
analytical decisions taken along the way.
"""),
]

write("01_cleaning.ipynb", clean_cells)
write("02_eda.ipynb", eda_cells)
write("03_analysis.ipynb", analysis_cells)
print("done")

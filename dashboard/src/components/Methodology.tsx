import { Database, Filter, BarChart3, FlaskConical } from 'lucide-react'
import Section from './Section'
import type { Meta, Kpis, VolumeArtifact } from '../types'

export default function Methodology({ meta, kpis, volume }: { meta: Meta; kpis: Kpis; volume: VolumeArtifact }) {
  const steps = [
    {
      icon: <Database size={18} />,
      title: '1 · Acquire',
      body: `Pulled from the CMS Provider Data Catalog API (dataset ${meta.dataset_id}), resolving the current${meta.release ? ` ${meta.release}` : ''} distribution. ${kpis.n_measures_total.toLocaleString()} raw rows, provenance logged.`,
    },
    {
      icon: <Filter size={18} />,
      title: '2 · Clean',
      body: `Numerics coerced from text; CMS suppression markers (footnotes 1/5/7) mapped to null and excluded, leaving ${kpis.n_measures_reported.toLocaleString()} reported measures from ${kpis.n_hospitals.toLocaleString()} hospitals. Counts are published only at ${volume.suppression_floor}+ readmissions, so volume analysis uses ${volume.n_safe.toLocaleString()} suppression-safe rows.`,
    },
    {
      icon: <BarChart3 size={18} />,
      title: '3 · Explore',
      body: 'Profiled distributions, conditions, geography and volume. Because ERR is benchmarked to the national average, every "share above 1.0" is compared with what chance would produce.',
    },
    {
      icon: <FlaskConical size={18} />,
      title: '4 · Test',
      body: `Tests use one value per hospital (Spearman, Kruskal–Wallis, Mann–Whitney, paired Wilcoxon) or OLS with hospital-clustered errors, since measures from the same hospital are correlated. States need ${meta.min_hospitals_for_state_rank}+ hospitals to be ranked; hospital rankings need ${meta.min_conditions_for_ranking}+ conditions.`,
    },
  ]
  return (
    <Section
      label="Methodology"
      title="How this was built"
      blurb="A reproducible analyst pipeline: every step is documented in the project's notebooks and docs, and every number on this page is recomputed from the CMS API by two scripts."
    >
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((s) => (
          <div key={s.title} className="glass rounded-2xl border border-white/10 p-5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-vital/15 text-vital" aria-hidden>{s.icon}</span>
            <h3 className="mt-3 font-display font-semibold text-white">{s.title}</h3>
            <p className="mt-2 text-sm text-gray-400 leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 glass rounded-2xl border border-white/10 p-5">
        <p className="text-sm text-gray-300 font-medium mb-2">Reproduce</p>
        <pre className="text-xs text-gray-400 overflow-x-auto"><code>{`python src/fetch_data.py        # pull CMS data + provenance
python src/build_aggregates.py  # clean → processed CSVs, statistics + dashboard JSON
pytest                          # pipeline + statistics tests
jupyter nbconvert --to notebook --execute --inplace notebooks/0*.ipynb`}</code></pre>
        <p className="mt-3 text-xs text-gray-400">
          Key metric: <strong className="text-gray-300">Excess Readmission Ratio (ERR)</strong> = predicted ÷ expected
          risk-adjusted 30-day readmission rate, where “expected” is what the national-average hospital would achieve
          with the same patients. ERR &gt; 1.0 = above that benchmark. Since FY 2019, HRRP penalties compare each
          hospital with the median ERR of its peer group, not with 1.0. Risk adjustment covers clinical case mix, not
          social risk. Data generated {new Date(meta.generated_at_utc).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}.
        </p>
      </div>
    </Section>
  )
}

import { Database, Filter, BarChart3, FlaskConical } from 'lucide-react'
import Section from './Section'
import type { Meta, Kpis } from '../types'

export default function Methodology({ meta, kpis }: { meta: Meta; kpis: Kpis }) {
  const steps = [
    {
      icon: <Database size={18} />,
      title: '1 · Acquire',
      body: `Pulled live from the CMS Provider Data Catalog API (dataset ${meta.dataset_id}), resolving the current FY 2026 distribution. ${kpis.n_measures_total.toLocaleString()} raw rows, provenance logged.`,
    },
    {
      icon: <Filter size={18} />,
      title: '2 · Clean',
      body: `Numerics coerced from text; CMS suppression markers (footnotes 1/5/7) mapped to null and excluded — leaving ${kpis.n_measures_reported.toLocaleString()} reported measures. Footnote-29 advisories retained. Facility ID kept as the key.`,
    },
    {
      icon: <BarChart3 size={18} />,
      title: '3 · Explore',
      body: 'Profiled distributions, conditions, geography and the volume–outcome relationship across notebooks with documented narrative for every chart.',
    },
    {
      icon: <FlaskConical size={18} />,
      title: '4 · Test',
      body: 'Spearman correlation (volume↔ERR), Mann–Whitney U (surgical vs medical), and a ≥3-condition bar for fair hospital rankings. Decisions logged for auditability.',
    },
  ]
  return (
    <Section
      label="Methodology"
      title="How this was built"
      blurb="A reproducible analyst pipeline — every step is documented in the project's notebooks and docs, and the whole thing rebuilds from the live CMS API with two commands."
    >
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((s) => (
          <div key={s.title} className="glass rounded-2xl border border-white/10 p-5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-vital/15 text-vital">{s.icon}</span>
            <h3 className="mt-3 font-display font-semibold text-white">{s.title}</h3>
            <p className="mt-2 text-sm text-gray-400 leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 glass rounded-2xl border border-white/10 p-5">
        <p className="text-sm text-gray-300 font-medium mb-2">Reproduce</p>
        <pre className="text-xs text-gray-400 overflow-x-auto"><code>{`python src/fetch_data.py        # pull live CMS data + provenance
python src/build_aggregates.py  # clean → processed CSVs + dashboard JSON
jupyter nbconvert --execute notebooks/0*.ipynb   # rerun the analysis`}</code></pre>
        <p className="mt-3 text-xs text-gray-500">
          Key metric — <strong className="text-gray-300">Excess Readmission Ratio (ERR)</strong> = predicted ÷ expected
          risk-adjusted 30-day readmission rate. ERR &gt; 1.0 = worse than expected.
        </p>
      </div>
    </Section>
  )
}

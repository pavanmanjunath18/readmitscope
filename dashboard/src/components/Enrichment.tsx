import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
  ComposedChart, Line, Legend,
} from 'recharts'
import Section from './Section'
import Insight from './Insight'
import { C, tooltipStyle } from '../theme'
import type { Enrichment as EnrichmentData } from '../types'

const AXIS = C.axis

export default function Enrichment({ data }: { data: EnrichmentData }) {
  const ownership = data.by_ownership.map((o) => ({ ...o, dev: +((o.mean_err - 1) * 100).toFixed(2) }))
  const rating = data.by_rating.map((r) => ({ ...r, label: `★${r.rating}` }))
  const forProfit = data.by_ownership.find((o) => o.group === 'For-profit')
  const nonProfit = data.by_ownership.find((o) => o.group === 'Non-profit')
  const star1 = data.by_rating.find((r) => r.rating === 1)
  const star5 = data.by_rating.find((r) => r.rating === 5)

  return (
    <Section
      label="Who readmits more?"
      title="Hospital ownership & quality rating"
      blurb="Enriched with CMS Hospital General Information (joined on Facility ID, 99.7% match). After CMS risk adjustment, for-profit and lower-rated hospitals still readmit more — these gaps reflect care model, not patient mix."
    >
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Ownership */}
        <div className="glass rounded-2xl border border-white/10 p-5">
          <h3 className="font-display font-semibold text-white mb-1">By ownership</h3>
          <p className="text-xs text-gray-500 mb-4">Mean ERR vs the 1.0 benchmark · Kruskal–Wallis p ≈ 10⁻¹⁶</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={ownership} layout="vertical" margin={{ left: 20, right: 40 }}>
              <XAxis type="number" tick={{ fill: AXIS, fontSize: 11 }} unit="%" />
              <YAxis type="category" dataKey="group" tick={{ fill: '#E5E7EB', fontSize: 12 }} width={120} />
              <Tooltip
                cursor={{ fill: 'rgba(45,212,191,0.08)' }}
                contentStyle={tooltipStyle}
                formatter={(_v: number, _n, p) => {
                  const o = p.payload as typeof ownership[0]
                  return [`Mean ERR ${o.mean_err.toFixed(3)} · ${o.pct_worse}% worse · ${o.n_hospitals} hospitals`, o.group]
                }}
              />
              <ReferenceLine x={0} stroke="#fff" />
              <Bar dataKey="dev" radius={[0, 5, 5, 0]} barSize={22}>
                {ownership.map((o) => (
                  <Cell key={o.group} fill={o.dev > 0 ? C.worse : C.emerald} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-2 text-xs text-gray-500">Positive = worse than expected · Negative = better</p>
        </div>

        {/* Star rating */}
        <div className="glass rounded-2xl border border-white/10 p-5">
          <h3 className="font-display font-semibold text-white mb-1">By CMS overall star rating</h3>
          <p className="text-xs text-gray-500 mb-4">Dose–response · Spearman ρ = −0.27, p ≈ 10⁻¹⁹⁵</p>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={rating} margin={{ left: 0, right: 10 }}>
              <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 12 }} />
              <YAxis yAxisId="l" domain={[0.95, 1.06]} tick={{ fill: AXIS, fontSize: 11 }} />
              <YAxis yAxisId="r" orientation="right" domain={[0, 100]} unit="%" tick={{ fill: AXIS, fontSize: 11 }} />
              <Tooltip
                cursor={{ fill: 'rgba(45,212,191,0.08)' }}
                contentStyle={tooltipStyle}
                formatter={(v: number, n: string) => n === 'Mean ERR' ? [v.toFixed(3), n] : [`${v}%`, n]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: AXIS }}>{v}</span>} />
              <ReferenceLine yAxisId="l" y={1.0} stroke="#fff" strokeDasharray="4 4" />
              <Bar yAxisId="r" dataKey="pct_worse" name="% worse than expected" fill={C.neutral} radius={[4, 4, 0, 0]} barSize={34} />
              <Line yAxisId="l" type="monotone" dataKey="mean_err" name="Mean ERR" stroke={C.accent} strokeWidth={3} dot={{ r: 5, fill: C.accent }} />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="mt-2 text-xs text-gray-500">★1 hospitals: 73% worse than expected · ★5: 31%</p>
        </div>
      </div>
      {forProfit && nonProfit && star1 && star5 && (
        <Insight>
          <strong className="text-white">Who runs a hospital, and how well, shows up in readmissions.</strong> For-profit
          hospitals miss the benchmark {forProfit.pct_worse}% of the time vs {nonProfit.pct_worse}% for non-profit. And the
          gap by quality is stark: a ★1 hospital over-readmits {star1.pct_worse}% of the time —
          {' '}{(star1.pct_worse / star5.pct_worse).toFixed(1)}× the ★5 rate of {star5.pct_worse}%. Both gaps hold up
          <em> after</em> risk adjustment, so they reflect care model, not patient mix.
        </Insight>
      )}
    </Section>
  )
}

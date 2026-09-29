import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import Section from './Section'
import Insight from './Insight'
import { C, tooltipStyle } from '../theme'
import { useMinWidth } from '../format'
import type { HistBin, Kpis } from '../types'

const AXIS = C.axis

export default function ErrDistribution({ data, kpis }: { data: HistBin[]; kpis: Kpis }) {
  const wide = useMinWidth(640)
  const last = data.length - 1
  // The pipeline folds extreme values into the first/last bins, so label those as open-ended.
  const chart = data.map((b, i) => ({
    label: b.bin_start.toFixed(2),
    range:
      i === 0 ? `ERR < ${b.bin_end.toFixed(2)}`
      : i === last ? `ERR ≥ ${b.bin_start.toFixed(2)}`
      : `ERR ${b.bin_start.toFixed(2)}–${b.bin_end.toFixed(2)}`,
    count: b.count,
    above: b.bin_start >= 1.0,
  }))

  return (
    <Section
      label="Distribution"
      title="How far from expected?"
      blurb={`Excess Readmission Ratio across ${kpis.n_measures_reported.toLocaleString()} reported measures. The benchmark is the national-average hospital, so the distribution centres on 1.0 by design — the tails are what matter.`}
    >
      <div className="glass rounded-2xl border border-white/10 p-5 h-full">
        <div
          role="img"
          aria-label={`Histogram of ERR, centred near 1.0. ${kpis.pct_err_above_110}% of measures are more than 10% above expected and ${kpis.pct_err_below_090}% more than 10% below.`}
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chart} margin={{ left: 0, right: 10, top: 18 }}>
              <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} interval={wide ? 1 : 3} />
              <YAxis tick={{ fill: AXIS, fontSize: 11 }} width={44} />
              <Tooltip
                cursor={{ fill: 'rgba(45,212,191,0.08)' }}
                contentStyle={tooltipStyle}
                labelFormatter={(_l, p) => (p?.[0]?.payload as { range?: string })?.range ?? ''}
                formatter={(v: number) => [`${v.toLocaleString()} measures`, 'Count']}
              />
              <ReferenceLine x="1.00" stroke="#fff" strokeDasharray="4 4" label={{ value: 'Expected (1.0)', fill: '#fff', fontSize: 11, position: 'top' }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {chart.map((d, i) => (
                  <Cell key={i} fill={d.above ? C.worse : C.cyan} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap gap-5 text-xs text-gray-400">
          <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm" style={{ background: C.cyan }} /> Below 1.0 (better than expected)</span>
          <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm" style={{ background: C.worse }} /> 1.0 and above</span>
        </div>
        <Insight>
          The distribution is close to symmetric: <strong className="text-white">{kpis.pct_err_above_110}% of measures
          are more than 10% above expected</strong>, and {kpis.pct_err_below_090}% are more than 10% below. The fact
          that {kpis.pct_worse_than_expected}% sit above 1.0 is expected by construction — the question is
          whether the <em>same</em> hospitals keep landing in the right tail (they do; see Finding 01).
        </Insight>
      </div>
    </Section>
  )
}

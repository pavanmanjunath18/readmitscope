import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import Section from './Section'
import Insight from './Insight'
import { C, tooltipStyle } from '../theme'
import type { HistBin, Kpis } from '../types'

const AXIS = C.axis

export default function ErrDistribution({ data, kpis }: { data: HistBin[]; kpis: Kpis }) {
  const chart = data.map((b) => ({
    mid: (b.bin_start + b.bin_end) / 2,
    label: b.bin_start.toFixed(2),
    count: b.count,
    worse: b.bin_start >= 1.0,
  }))
  // Highest bin with any hospitals = the worst-performer tail.
  const topBin = [...data].reverse().find((b) => b.count > 0)
  const worstPct = topBin ? Math.round((topBin.bin_start - 1) * 100) : 0
  return (
    <Section
      label="Distribution"
      title="How far from expected?"
      blurb={`Distribution of the Excess Readmission Ratio across ${kpis.n_measures_reported.toLocaleString()} reported measures. Bars to the right of 1.0 are hospitals readmitting more than expected.`}
    >
      <div className="glass rounded-2xl border border-white/10 p-5 h-full">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chart} margin={{ left: 0, right: 10 }}>
            <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} interval={1} />
            <YAxis tick={{ fill: AXIS, fontSize: 11 }} />
            <Tooltip
              cursor={{ fill: 'rgba(45,212,191,0.08)' }}
              contentStyle={tooltipStyle}
              labelFormatter={(l) => `ERR ≈ ${l}`}
              formatter={(v: number) => [`${v.toLocaleString()} measures`, 'Count']}
            />
            <ReferenceLine x="1.00" stroke="#fff" strokeDasharray="4 4" label={{ value: 'Expected', fill: '#fff', fontSize: 11, position: 'top' }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {chart.map((d, i) => (
                <Cell key={i} fill={d.worse ? C.worse : C.cyan} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 flex gap-5 text-xs text-gray-400">
          <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm" style={{ background: C.cyan }} /> Better than expected</span>
          <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm" style={{ background: C.worse }} /> Worse than expected</span>
        </div>
        <Insight>
          The pack clusters just below 1.0, but <strong className="text-white">{kpis.pct_worse_than_expected}% of measures
          still land above the line</strong> — and a long right tail runs out to roughly {worstPct}% worse than expected.
          A few hospitals are dramatic underperformers, not just marginally off.
        </Insight>
      </div>
    </Section>
  )
}

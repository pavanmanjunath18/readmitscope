import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList,
} from 'recharts'
import Section from './Section'
import Insight from './Insight'
import { C, tooltipStyle } from '../theme'
import type { ConditionStat } from '../types'

const AXIS = C.axis

export default function ConditionChart({ data }: { data: ConditionStat[] }) {
  const chart = [...data].sort((a, b) => b.pct_worse - a.pct_worse)
  const worst = chart[0]
  const best = chart[chart.length - 1]
  return (
    <Section
      label="Condition breakdown"
      title="Which conditions readmit worst?"
      blurb="Share of hospitals with an Excess Readmission Ratio above 1.0 (worse than expected) for each of the six CMS-tracked conditions. The dashed line marks the 50% midpoint."
    >
      <div className="glass rounded-2xl border border-white/10 p-5">
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={chart} layout="vertical" margin={{ left: 30, right: 40 }}>
            <XAxis type="number" domain={[40, 55]} tick={{ fill: AXIS, fontSize: 12 }} unit="%" />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fill: '#E5E7EB', fontSize: 13 }}
              width={140}
            />
            <Tooltip
              cursor={{ fill: 'rgba(45,212,191,0.08)' }}
              contentStyle={tooltipStyle}
              labelStyle={{ color: '#fff' }}
              formatter={(v: number, _n, p) => [
                `${v}% worse than expected`,
                (p.payload as ConditionStat).full,
              ]}
            />
            <ReferenceLine x={50} stroke="#666" strokeDasharray="4 4" />
            <Bar dataKey="pct_worse" radius={[0, 6, 6, 0]} barSize={26}>
              {chart.map((d) => (
                <Cell key={d.code} fill={d.group === 'Surgical' ? C.cyan : C.accent} />
              ))}
              <LabelList dataKey="pct_worse" position="right" formatter={(v: number) => `${v}%`} fill="#E5E7EB" fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-3 flex gap-5 text-xs text-gray-400 pl-4">
          <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm" style={{ background: C.accent }} /> Medical condition</span>
          <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm" style={{ background: C.cyan }} /> Surgical procedure</span>
        </div>
        <Insight>
          <strong className="text-white">{worst.full} is the toughest condition</strong> — {worst.pct_worse}% of
          hospitals readmit more than expected, the highest of the six measures and {(worst.pct_worse - best.pct_worse).toFixed(1)} points
          above {best.label} ({best.pct_worse}%). The narrow spread tells the real story: excess readmissions are a
          system-wide problem, not one service line's failure.
        </Insight>
      </div>
    </Section>
  )
}

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList, ErrorBar,
} from 'recharts'
import Section from './Section'
import Insight from './Insight'
import { C, tooltipProps } from '../theme'
import { fmtP, useMinWidth } from '../format'
import type { ConditionStat, TestResult } from '../types'

const AXIS = C.axis

export default function ConditionChart({
  data,
  surgicalVsMedical,
}: {
  data: ConditionStat[]
  surgicalVsMedical: TestResult & { median_diff: number }
}) {
  const wide = useMinWidth(640)
  const chart = [...data]
    .sort((a, b) => b.pct_worse - a.pct_worse)
    .map((d) => ({ ...d, ci: [d.pct_worse - d.pct_worse_ci[0], d.pct_worse_ci[1] - d.pct_worse] }))
  const hi = chart[0]
  const lo = chart[chart.length - 1]
  const overlap = hi.pct_worse_ci[0] <= lo.pct_worse_ci[1]
  const summary = chart.map((d) => `${d.label} ${d.pct_worse}%`).join(', ')

  return (
    <Section
      label="Condition breakdown"
      title="Does any condition stand out?"
      blurb="Share of hospitals with an Excess Readmission Ratio above 1.0 for each of the six CMS-tracked conditions, with 95% confidence intervals. The axis starts at zero so small differences aren't exaggerated; the dashed line marks 50%, roughly where the national-average benchmark puts things by design."
    >
      <div className="glass rounded-2xl border border-white/10 p-5">
        <div role="img" aria-label={`Bar chart, share of hospitals above 1.0 by condition: ${summary}.`}>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={chart} layout="vertical" margin={{ left: 0, right: 48 }}>
              <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: AXIS, fontSize: 12 }} unit="%" />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fill: '#E5E7EB', fontSize: wide ? 13 : 11 }}
                width={wide ? 150 : 96}
              />
              <Tooltip
                cursor={{ fill: 'rgba(45,212,191,0.08)' }}
                {...tooltipProps}
                formatter={(v: number, _n, p) => {
                  const d = p.payload as ConditionStat
                  return [`${v}% above 1.0 (95% CI ${d.pct_worse_ci[0]}–${d.pct_worse_ci[1]}%) · ${d.n.toLocaleString()} hospitals`, d.full]
                }}
              />
              <ReferenceLine x={50} stroke="#8B8FB0" strokeDasharray="4 4" />
              <Bar dataKey="pct_worse" radius={[0, 6, 6, 0]} barSize={26} isAnimationActive={false}>
                {chart.map((d) => (
                  <Cell key={d.code} fill={d.group === 'Surgical' ? C.cyan : C.accent} />
                ))}
                <ErrorBar dataKey="ci" direction="x" width={6} stroke="#E5E7EB" strokeWidth={1.5} />
                <LabelList dataKey="pct_worse" position="insideLeft" offset={10} formatter={(v: number) => `${v}%`} fill="#0B0C17" fontSize={12} fontWeight={600} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap gap-5 text-xs text-gray-400 pl-4">
          <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm" style={{ background: C.accent }} /> Medical condition</span>
          <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm" style={{ background: C.cyan }} /> Surgical procedure</span>
          <span className="flex items-center gap-2"><i className="h-px w-4 bg-gray-200" /> 95% confidence interval</span>
        </div>
        <Insight>
          <strong className="text-white">No condition stands out.</strong> All six sit between {lo.pct_worse}% ({lo.label})
          and {hi.pct_worse}% ({hi.label}){overlap ? ', and their confidence intervals overlap' : ''}. Comparing
          surgical with medical measures <em>within the same hospital</em> finds no difference either (median
          gap {surgicalVsMedical.median_diff.toFixed(3)} ERR, {fmtP(surgicalVsMedical.p)}). Excess readmissions
          track the hospital more than the service line.
        </Insight>
      </div>
    </Section>
  )
}

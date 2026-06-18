import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import Section from './Section'
import Insight from './Insight'
import { C, tooltipStyle } from '../theme'
import type { VolumeBin } from '../types'

const AXIS = C.axis

export default function VolumeChart({ data }: { data: VolumeBin[] }) {
  const low = data[0]
  const high = data[data.length - 1]
  return (
    <Section
      label="Volume vs outcome"
      title="Do busier hospitals do better?"
      blurb="Mean Excess Readmission Ratio and share worse-than-expected, by per-condition discharge volume. A clear gradient: higher-volume hospitals readmit less than expected (Spearman ρ = −0.16, p < 0.001)."
    >
      <div className="glass rounded-2xl border border-white/10 p-5 h-full">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={data} margin={{ left: 0, right: 10 }}>
            <XAxis dataKey="bin" tick={{ fill: AXIS, fontSize: 11 }} label={{ value: 'Discharges per condition', fill: AXIS, fontSize: 11, dy: 14 }} />
            <YAxis yAxisId="left" domain={[0.95, 1.07]} tick={{ fill: AXIS, fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" tick={{ fill: AXIS, fontSize: 11 }} />
            <Tooltip
              cursor={{ fill: 'rgba(45,212,191,0.08)' }}
              contentStyle={tooltipStyle}
              formatter={(v: number, n: string) => n === 'Mean ERR' ? [v.toFixed(3), n] : [`${v}%`, n]}
            />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value) => <span style={{ color: AXIS }}>{value}</span>}
            />
            <ReferenceLine yAxisId="left" y={1.0} stroke="#fff" strokeDasharray="4 4" />
            <Bar yAxisId="right" dataKey="pct_worse" name="% worse than expected" fill={C.neutral} radius={[4, 4, 0, 0]} barSize={34} />
            <Line yAxisId="left" type="monotone" dataKey="mean_err" name="Mean ERR" stroke={C.accent} strokeWidth={3} dot={{ r: 5, fill: C.accent }} />
          </ComposedChart>
        </ResponsiveContainer>
        <Insight>
          <strong className="text-white">Scale is protective.</strong> The smallest hospitals ({low.bin} discharges) miss
          the benchmark {low.pct_worse}% of the time, versus just {high.pct_worse}% for the busiest ({high.bin}) — and mean
          ERR flips from {low.mean_err.toFixed(3)} (worse) to {high.mean_err.toFixed(3)} (better). Low-volume hospitals are
          the clearest target for intervention.
        </Insight>
      </div>
    </Section>
  )
}

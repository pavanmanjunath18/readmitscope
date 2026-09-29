import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import Section from './Section'
import Insight from './Insight'
import { C, tooltipProps } from '../theme'
import { fmtP, signed, useMinWidth } from '../format'
import type { VolumeArtifact, VolumeBin } from '../types'

const AXIS = C.axis

export default function VolumeChart({ data, artifact: a }: { data: VolumeBin[]; artifact: VolumeArtifact }) {
  const wide = useMinWidth(640)
  const safe = new Map(data.map((b) => [b.bin, b]))
  const chart = a.naive_bins.map((b) => ({
    bin: b.bin,
    naive: b.pct_worse,
    safe: safe.get(b.bin)?.pct_worse ?? null,
    n_naive: b.n,
    n_safe: safe.get(b.bin)?.n ?? 0,
  }))
  const smallest = a.naive_bins[0]
  const noEffect = a.per_doubling.p >= 0.05

  return (
    <Section
      label="Volume vs outcome"
      title="Do busier hospitals do better?"
      blurb={`CMS publishes discharge counts only when a hospital has ${a.suppression_floor}+ readmissions, so small hospitals appear in the data mostly when their rates are high. The dashed line uses every published count; the solid line keeps only rows large enough that the reporting floor rarely matters.`}
    >
      <div className="glass rounded-2xl border border-white/10 p-5 h-full">
        <div
          role="img"
          aria-label={`Line chart. Using all published counts, the smallest hospitals look worse ${smallest?.pct_worse}% of the time. On suppression-safe rows the share ranges from ${data[0]?.pct_worse}% to ${data[data.length - 1]?.pct_worse}%.`}
        >
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chart} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
              <XAxis
                dataKey="bin"
                interval={0}
                tick={{ fill: AXIS, fontSize: wide ? 11 : 10 }}
                angle={wide ? 0 : -35}
                textAnchor={wide ? 'middle' : 'end'}
                height={wide ? 30 : 48}
              />
              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" tick={{ fill: AXIS, fontSize: 11 }} width={44} />
              <Tooltip
                {...tooltipProps}
                labelFormatter={(l) => `${l} discharges per condition`}
                formatter={(v, n: string, p) => {
                  const row = p.payload as (typeof chart)[number]
                  const count = n.startsWith('All') ? row.n_naive : row.n_safe
                  return v == null ? ['not enough rows', n] : [`${v}% above 1.0 · n = ${count.toLocaleString()}`, n]
                }}
              />
              <Legend
                verticalAlign="top"
                height={32}
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value) => <span style={{ color: AXIS }}>{value}</span>}
              />
              <ReferenceLine y={50} stroke="#8B8FB0" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="naive" name="All published counts (biased)" stroke="#8B8FB0" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 4, fill: '#8B8FB0' }} isAnimationActive={false} />
              <Line type="monotone" dataKey="safe" name="Suppression-safe rows" stroke={C.accent} strokeWidth={3} dot={{ r: 5, fill: C.accent }} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-center text-xs text-gray-400">Discharges per condition · y-axis: % of measures with ERR above 1.0</p>
        <Insight>
          <strong className="text-white">The small-hospital effect is mostly an artifact.</strong> Using every published
          count, the smallest hospitals ({smallest?.bin}) look worse {smallest?.pct_worse}% of the time — but the{' '}
          {a.hidden.n.toLocaleString()} measures CMS hides are better than average ({a.hidden.pct_worse}% above 1.0).
          On suppression-safe rows the correlation drops from ρ = {a.naive_spearman.stat.toFixed(2)} to{' '}
          {a.safe_spearman.stat.toFixed(2)}, and after adjusting for rating, ownership, condition and state the effect
          is {signed(a.per_doubling.estimate)} ERR points per doubling of volume (95% CI {signed(a.per_doubling.ci_low)} to{' '}
          {signed(a.per_doubling.ci_high)}, {fmtP(a.per_doubling.p)}){noEffect ? ' — no detectable volume effect' : ''}.
        </Insight>
      </div>
    </Section>
  )
}

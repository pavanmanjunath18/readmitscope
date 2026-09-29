import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, ErrorBar,
} from 'recharts'
import Section from './Section'
import Insight from './Insight'
import { C, tooltipStyle } from '../theme'
import { errPct, stateName } from '../format'
import type { StateStat } from '../types'

const AXIS = C.axis
const SHOW = 12

type Mode = 'worst' | 'best'

export default function StateRanking({ data, minHospitals }: { data: StateStat[]; minHospitals: number }) {
  const [mode, setMode] = useState<Mode>('worst')
  const eligible = data.filter((s) => s.eligible)
  const excluded = data.filter((s) => !s.eligible).map((s) => s.state).sort()
  const sorted = [...eligible].sort((a, b) =>
    mode === 'worst' ? b.mean_err - a.mean_err : a.mean_err - b.mean_err,
  )
  const top = sorted.slice(0, SHOW).map((s) => {
    const dev = (s.mean_err - 1) * 100
    const lo = ((s.ci_low ?? s.mean_err) - 1) * 100
    const hi = ((s.ci_high ?? s.mean_err) - 1) * 100
    return { ...s, dev: +dev.toFixed(2), ci: [dev - lo, hi - dev], label: `${s.state}${s.hrrp_exempt ? '†' : ''} ${errPct(s.mean_err)}` }
  })
  // Whole-number axis that always contains zero and every confidence interval.
  const lowest = Math.min(0, ...top.map((d) => d.dev - d.ci[0]))
  const highest = Math.max(0, ...top.map((d) => d.dev + d.ci[1]))
  const lo = Math.floor(lowest)
  const hi = Math.ceil(highest)
  const step = hi - lo > 6 ? 2 : 1
  const ticks: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v)

  const nAbove = eligible.filter((s) => s.significant === 'above').length
  const nBelow = eligible.filter((s) => s.significant === 'below').length
  const lead = sorted[0]
  const exempt = data.find((s) => s.hrrp_exempt)

  return (
    <Section
      label="Geography"
      title="Readmission performance by state"
      blurb={`Average hospital ERR by state, as % above or below the benchmark, with 95% confidence intervals. Only states with ${minHospitals}+ reporting hospitals are ranked — smaller states give noisy averages. CMS adjusts for clinical case mix but not social risk, so gaps can reflect population differences as well as care delivery.`}
    >
      <div className="glass rounded-2xl border border-white/10 p-5">
        <div className="mb-4 inline-flex rounded-lg border border-white/10 p-1 text-sm" role="group" aria-label="Ranking order">
          {(['worst', 'best'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`px-4 py-1.5 rounded-md font-medium transition ${
                mode === m ? 'bg-vital text-clinical-950' : 'text-gray-400 hover:text-white'
              }`}
            >
              {m === 'worst' ? 'Highest ERR' : 'Lowest ERR'}
            </button>
          ))}
        </div>
        <div
          role="img"
          aria-label={`${mode === 'worst' ? 'Highest' : 'Lowest'} ${SHOW} states by mean ERR: ${top.map((d) => `${stateName(d.state)} ${errPct(d.mean_err)}`).join(', ')}.`}
        >
          <ResponsiveContainer width="100%" height={440}>
            <BarChart key={mode} data={top} layout="vertical" margin={{ left: 4, right: 12, top: 4 }}>
              <XAxis
                type="number"
                domain={[lo, hi]}
                ticks={ticks}
                tick={{ fill: AXIS, fontSize: 11 }}
                tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}%`}
              />
              <YAxis
                type="category"
                dataKey="label"
                orientation={mode === 'worst' ? 'left' : 'right'}
                tick={{ fill: '#E5E7EB', fontSize: 12 }}
                width={84}
              />
              <Tooltip
                cursor={{ fill: 'rgba(45,212,191,0.08)' }}
                contentStyle={tooltipStyle}
                formatter={(_v: number, _n, p) => {
                  const s = p.payload as StateStat
                  const sig = s.significant ? ` · significantly ${s.significant} 1.0` : ' · not significantly different from 1.0'
                  return [
                    `Mean ERR ${s.mean_err.toFixed(3)} (95% CI ${s.ci_low?.toFixed(3)}–${s.ci_high?.toFixed(3)}) · ${s.n_hospitals} hospitals${sig}`,
                    stateName(s.state),
                  ]
                }}
              />
              <ReferenceLine x={0} stroke="#fff" />
              <Bar dataKey="dev" radius={mode === 'worst' ? [0, 5, 5, 0] : [5, 0, 0, 5]} barSize={20} isAnimationActive={false}>
                {top.map((d) => (
                  <Cell
                    key={d.state}
                    fill={d.dev > 0 ? C.worse : C.emerald}
                    fillOpacity={d.significant ? 1 : 0.45}
                  />
                ))}
                <ErrorBar dataKey="ci" direction="x" width={5} stroke="#E5E7EB" strokeWidth={1.2} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Solid bars: significantly different from 1.0 · faded: within noise · whiskers: 95% CI
          {exempt && <> · † {stateName(exempt.state)} is exempt from HRRP payment penalties</>}
        </p>
        {excluded.length > 0 && (
          <p className="mt-1 text-xs text-gray-400">
            Not ranked (fewer than {minHospitals} reporting hospitals): {excluded.join(', ')}
          </p>
        )}
        {lead && (
          <Insight>
            {mode === 'worst' ? (
              <>
                <strong className="text-white">{stateName(lead.state)} has the highest average ERR</strong> —
                {' '}{errPct(lead.mean_err)} vs expected across {lead.n_hospitals} hospitals
                {lead.significant === 'above' ? ', clearly above the benchmark' : ', though within noise of 1.0'}.
                In total {nAbove} of {eligible.length} ranked states sit significantly above 1.0.
              </>
            ) : (
              <>
                <strong className="text-white">{stateName(lead.state)} has the lowest average ERR</strong> —
                {' '}{errPct(lead.mean_err)} vs expected across {lead.n_hospitals} hospitals. {nBelow} of{' '}
                {eligible.length} ranked states sit significantly below 1.0.
              </>
            )}
          </Insight>
        )}
      </div>
    </Section>
  )
}

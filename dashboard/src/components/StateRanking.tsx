import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import Section from './Section'
import Insight from './Insight'
import { C, tooltipStyle } from '../theme'
import type { StateStat } from '../types'

const AXIS = C.axis

const NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'D.C.', FL: 'Florida',
  GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana',
  IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine',
  MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
}

export default function StateRanking({ data }: { data: StateStat[] }) {
  const [mode, setMode] = useState<'worst' | 'best'>('worst')
  const ranked = [...data].sort((a, b) => b.mean_err - a.mean_err)
  const worstState = ranked[0]
  const bestState = ranked[ranked.length - 1]
  const stateName = (s: string) => NAMES[s] ?? s
  const sorted = [...data].sort((a, b) =>
    mode === 'worst' ? b.mean_err - a.mean_err : a.mean_err - b.mean_err,
  )
  const top = sorted.slice(0, 12).map((s) => ({ ...s, dev: +((s.mean_err - 1) * 100).toFixed(2) }))

  return (
    <Section
      label="Geography"
      title="Readmission performance by state"
      blurb="Average Excess Readmission Ratio by state, shown as % above or below the expected benchmark. Because ERR is risk-adjusted, these gaps reflect care delivery, not just how sick a state's patients are."
    >
      <div className="glass rounded-2xl border border-white/10 p-5">
        <div className="mb-4 inline-flex rounded-lg border border-white/10 p-1 text-sm">
          {(['worst', 'best'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-md font-medium transition ${
                mode === m ? 'bg-vital text-clinical-950' : 'text-gray-400 hover:text-white'
              }`}
            >
              {m === 'worst' ? 'Highest ERR' : 'Lowest ERR'}
            </button>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={420}>
          <BarChart data={top} layout="vertical" margin={{ left: 10, right: 50 }}>
            <XAxis type="number" tick={{ fill: AXIS, fontSize: 11 }} unit="%" />
            <YAxis type="category" dataKey="state" tick={{ fill: '#E5E7EB', fontSize: 12 }} width={40} />
            <Tooltip
              cursor={{ fill: 'rgba(45,212,191,0.08)' }}
              contentStyle={tooltipStyle}
              formatter={(_v: number, _n, p) => {
                const s = p.payload as StateStat
                return [`Mean ERR ${s.mean_err.toFixed(3)} · ${s.pct_worse}% worse · ${s.n_hospitals} hospitals`, s.state]
              }}
            />
            <ReferenceLine x={0} stroke="#fff" />
            <Bar dataKey="dev" radius={[0, 5, 5, 0]} barSize={20}>
              {top.map((d) => (
                <Cell key={d.state} fill={d.dev > 0 ? C.worse : C.emerald} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-2 text-xs text-gray-500">Positive = readmits more than expected · Negative = better than expected</p>
        <Insight>
          <strong className="text-white">{stateName(worstState.state)} leads the nation in excess readmissions</strong> —
          mean ERR {worstState.mean_err.toFixed(3)}, about {((worstState.mean_err - 1) * 100).toFixed(1)}% above expected,
          with {worstState.pct_worse}% of its measures worse than expected across {worstState.n_hospitals} hospitals.
          {' '}{stateName(bestState.state)} sits at the other end ({bestState.mean_err.toFixed(3)}). Since ERR is risk-adjusted,
          this is about care delivery — not how sick each state's patients are.
        </Insight>
      </div>
    </Section>
  )
}

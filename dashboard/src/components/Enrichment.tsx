import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, ErrorBar,
} from 'recharts'
import Section from './Section'
import Insight from './Insight'
import { C, tooltipProps } from '../theme'
import { fmtP, signed } from '../format'
import type { Enrichment as EnrichmentData, Model, ModelTerm } from '../types'

const AXIS = C.axis
const SMALL_GROUP = 30

export default function Enrichment({ data, model }: { data: EnrichmentData; model: Model }) {
  const t = data.tests
  const ownership = data.by_ownership.map((o) => ({
    ...o,
    ci: [o.pct_worse - o.pct_worse_ci[0], o.pct_worse_ci[1] - o.pct_worse],
    label: o.n_hospitals < SMALL_GROUP ? `${o.group}*` : o.group,
  }))
  const rating = data.by_rating.map((r) => ({
    ...r,
    ci: [r.pct_worse - r.pct_worse_ci[0], r.pct_worse_ci[1] - r.pct_worse],
    label: `★${r.rating}`,
  }))
  const small = data.by_ownership.filter((o) => o.n_hospitals < SMALL_GROUP)
  const fp = model.terms.find((m) => m.label === 'For-profit')
  const s1 = model.terms.find((m) => m.label === '★1')
  const s5 = model.terms.find((m) => m.label === '★5')

  return (
    <Section
      label="Who readmits more?"
      title="Hospital ownership & quality rating"
      blurb={`Enriched with CMS Hospital General Information (joined on Facility ID, ${data.match_rate_pct}% of hospitals matched). The top charts are unadjusted; the model below separates ownership from star rating while holding condition and state fixed.`}
    >
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Ownership */}
        <div className="glass rounded-2xl border border-white/10 p-5">
          <h3 className="font-display font-semibold text-white mb-1">By ownership (unadjusted)</h3>
          <p className="text-xs text-gray-400 mb-4">
            % of measures above 1.0 · hospital-level Kruskal–Wallis {fmtP(t.ownership_kruskal.p)}
          </p>
          <div role="img" aria-label={`Share of measures above 1.0 by ownership: ${ownership.map((o) => `${o.group} ${o.pct_worse}%`).join(', ')}.`}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={ownership} layout="vertical" margin={{ left: 0, right: 24 }}>
                <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: AXIS, fontSize: 11 }} unit="%" />
                <YAxis type="category" dataKey="label" tick={{ fill: '#E5E7EB', fontSize: 12 }} width={130} />
                <Tooltip
                  cursor={{ fill: 'rgba(45,212,191,0.08)' }}
                  {...tooltipProps}
                  formatter={(_v: number, _n, p) => {
                    const o = p.payload as (typeof ownership)[number]
                    return [`${o.pct_worse}% above 1.0 (95% CI ${o.pct_worse_ci[0]}–${o.pct_worse_ci[1]}%) · mean ERR ${o.mean_err.toFixed(3)} · ${o.n_hospitals} hospitals`, o.group]
                  }}
                />
                <ReferenceLine x={50} stroke="#8B8FB0" strokeDasharray="4 4" />
                <Bar dataKey="pct_worse" radius={[0, 5, 5, 0]} barSize={22} isAnimationActive={false}>
                  {ownership.map((o) => (
                    <Cell key={o.group} fill={o.pct_worse > 50 ? C.worse : C.emerald} />
                  ))}
                  <ErrorBar dataKey="ci" direction="x" width={5} stroke="#E5E7EB" strokeWidth={1.2} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {small.length > 0 && (
            <p className="mt-2 text-xs text-gray-400">
              * {small.map((o) => `${o.group}: only ${o.n_hospitals} hospitals`).join('; ')} — too few to interpret.
            </p>
          )}
        </div>

        {/* Star rating */}
        <div className="glass rounded-2xl border border-white/10 p-5">
          <h3 className="font-display font-semibold text-white mb-1">By CMS overall star rating (unadjusted)</h3>
          <p className="text-xs text-gray-400 mb-4">
            % of measures above 1.0 · hospital-level Spearman ρ = {t.rating_spearman.stat.toFixed(2)}, {fmtP(t.rating_spearman.p)}
          </p>
          <div role="img" aria-label={`Share of measures above 1.0 by star rating: ${rating.map((r) => `${r.label} ${r.pct_worse}%`).join(', ')}.`}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={rating} margin={{ left: 0, right: 10 }}>
                <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 12 }} />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" tick={{ fill: AXIS, fontSize: 11 }} width={44} />
                <Tooltip
                  cursor={{ fill: 'rgba(45,212,191,0.08)' }}
                  {...tooltipProps}
                  formatter={(_v: number, _n, p) => {
                    const r = p.payload as (typeof rating)[number]
                    return [`${r.pct_worse}% above 1.0 (95% CI ${r.pct_worse_ci[0]}–${r.pct_worse_ci[1]}%) · mean ERR ${r.mean_err.toFixed(3)} · ${r.n_hospitals} hospitals`, r.label]
                  }}
                />
                <ReferenceLine y={50} stroke="#8B8FB0" strokeDasharray="4 4" />
                <Bar dataKey="pct_worse" radius={[4, 4, 0, 0]} barSize={34} isAnimationActive={false}>
                  {rating.map((r) => (
                    <Cell key={r.rating} fill={r.pct_worse > 50 ? C.worse : C.emerald} />
                  ))}
                  <ErrorBar dataKey="ci" direction="y" width={6} stroke="#E5E7EB" strokeWidth={1.2} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            ⚠ The star rating is partly built from readmission measures, so part of this gradient is mechanical.
          </p>
        </div>
      </div>

      <ForestPlot model={model} />

      {fp && s1 && s5 && (
        <Insight>
          <strong className="text-white">Rating matters far more than ownership.</strong> Unadjusted, for-profit hospitals
          have a higher median ERR ({t.forprofit_vs_nonprofit.median_forprofit.toFixed(3)} vs{' '}
          {t.forprofit_vs_nonprofit.median_nonprofit.toFixed(3)}, {fmtP(t.forprofit_vs_nonprofit.p)}). But once star
          rating, condition and state are held fixed, the for-profit gap is {signed(fp.estimate)} ERR points (
          {fmtP(fp.p)}){fp.p >= 0.05 ? ' — not statistically significant' : ''}, while ★1 vs ★5 hospitals differ by{' '}
          {(s1.estimate - s5.estimate).toFixed(1)} points. Because the rating includes readmissions, treat it as a useful
          public warning sign rather than a cause.
        </Insight>
      )}
    </Section>
  )
}

/** Coefficient plot: estimate ± 95% CI in ERR percentage points vs the reference group. */
function ForestPlot({ model }: { model: Model }) {
  const lo = Math.floor(Math.min(...model.terms.map((t) => t.ci_low)))
  const hi = Math.ceil(Math.max(...model.terms.map((t) => t.ci_high)))
  const x = (v: number) => ((v - lo) / (hi - lo)) * 100
  const ticks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter((v) => (hi - lo > 8 ? v % 2 === 0 : true))
  const groups: ModelTerm['group'][] = ['Ownership', 'Star rating']

  return (
    <div className="mt-6 glass rounded-2xl border border-white/10 p-5">
      <h3 className="font-display font-semibold text-white mb-1">After adjustment</h3>
      <p className="text-xs text-gray-400 mb-5">
        Difference in ERR (percentage points, 95% CI) vs {model.references.ownership} and {model.references.rating} hospitals,
        holding {model.controls.join(' and ')} fixed · {model.n_obs.toLocaleString()} measures in{' '}
        {model.n_clusters.toLocaleString()} hospitals · standard errors clustered by hospital
      </p>
      <div className="space-y-5">
        {groups.map((g) => (
          <div key={g}>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{g}</p>
            <ul className="space-y-1.5">
              {model.terms.filter((t) => t.group === g).map((t) => {
                const sig = t.p < 0.05
                const color = !sig ? '#8B8FB0' : t.estimate > 0 ? C.worse : C.emerald
                return (
                  <li key={t.label} className="grid grid-cols-[88px_1fr_120px] sm:grid-cols-[140px_1fr_170px] items-center gap-3 text-xs">
                    <span className="text-gray-200 truncate">{t.label}</span>
                    <span className="relative h-5" aria-hidden>
                      <span className="absolute top-1/2 h-px w-full bg-white/10" />
                      <span className="absolute top-0 h-full w-px bg-white/50" style={{ left: `${x(0)}%` }} />
                      <span
                        className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded"
                        style={{ left: `${x(t.ci_low)}%`, width: `${x(t.ci_high) - x(t.ci_low)}%`, background: color }}
                      />
                      <span
                        className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                        style={{ left: `${x(t.estimate)}%`, background: color }}
                      />
                    </span>
                    <span className={`num text-right ${sig ? 'text-gray-200' : 'text-gray-400'}`}>
                      {signed(t.estimate)} [{signed(t.ci_low)}, {signed(t.ci_high)}]
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        <div className="grid grid-cols-[88px_1fr_120px] sm:grid-cols-[140px_1fr_170px] gap-3 text-[11px] text-gray-400" aria-hidden>
          <span />
          <span className="relative h-4">
            {ticks.map((v) => (
              <span key={v} className="absolute -translate-x-1/2" style={{ left: `${x(v)}%` }}>{v > 0 ? `+${v}` : v}</span>
            ))}
          </span>
          <span className="text-right">estimate [95% CI]</span>
        </div>
      </div>
      <p className="mt-4 text-xs text-gray-400">
        Grey = not statistically significant (p ≥ 0.05). Rose = higher ERR than the reference, teal = lower.
      </p>
    </div>
  )
}

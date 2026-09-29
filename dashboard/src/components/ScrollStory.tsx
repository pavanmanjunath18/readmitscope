import { useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { fmtP, prefersReducedMotion, signed, stateName } from '../format'
import type { ReadmitData } from '../types'

gsap.registerPlugin(useGSAP, ScrollTrigger)

type Tone = 'good' | 'bad' | 'neutral'
interface MeterRow { label: string; value: number; display: string; tone: Tone }
interface Finding {
  kicker: string
  stat: number
  decimals: number
  prefix?: string
  suffix: string
  statLabel: string
  headline: string
  detail: string
  /** Value that fills a meter to 100%. */
  scale: number
  meters: MeterRow[]
}

/** For "% of measures above 1.0" metrics, ~50% is the neutral midpoint. */
const toneVsHalf = (v: number): Tone => (v > 50 ? 'bad' : 'good')
const pct = (v: number) => `${v}%`

function buildFindings(data: ReadmitData): Finding[] {
  const c = data.consistency
  const va = data.volume_artifact
  const smallest = va.naive_bins[0]
  const safe = data.volume_vs_err
  const r1 = data.enrichment.by_rating.find((r) => r.rating === 1)
  const r5 = data.enrichment.by_rating.find((r) => r.rating === 5)
  const fpRaw = data.enrichment.by_ownership.find((o) => o.group === 'For-profit')
  const npRaw = data.enrichment.by_ownership.find((o) => o.group === 'Non-profit')
  const fp = data.model.terms.find((t) => t.label === 'For-profit')
  const s1 = data.model.terms.find((t) => t.label === '★1')
  const s5 = data.model.terms.find((t) => t.label === '★5')
  const states = data.by_state.filter((s) => s.eligible).sort((a, b) => b.mean_err - a.mean_err)
  const top = states[0]
  const nAbove = states.filter((s) => s.significant === 'above').length
  const nBelow = states.filter((s) => s.significant === 'below').length
  const fpSig = fp ? fp.p < 0.05 : false

  const findings: Finding[] = [
    {
      kicker: 'Finding 01 — Consistency',
      stat: c.pct_all_worse,
      decimals: 1,
      suffix: '%',
      statLabel: `of hospitals are worse than expected on every condition they report`,
      headline: 'A distinct group of hospitals is worse across the board.',
      detail: `About half of all measures sit above 1.0 by design, so "${c.pct_any_worse}% of hospitals are worse on at least one condition" is expected (chance alone gives ${c.pct_any_worse_expected}%). What chance doesn't explain: ${c.pct_all_worse}% of hospitals are worse on every condition vs ${c.pct_all_worse_expected}% expected, and ${c.pct_all_better}% are better on every one vs ${c.pct_all_better_expected}%. Performance behaves like a hospital-level trait.`,
      scale: 20,
      meters: [
        { label: 'Worse on every condition — observed', value: c.pct_all_worse, display: pct(c.pct_all_worse), tone: 'bad' },
        { label: 'Worse on every condition — chance', value: c.pct_all_worse_expected, display: pct(c.pct_all_worse_expected), tone: 'neutral' },
        { label: 'Better on every condition — observed', value: c.pct_all_better, display: pct(c.pct_all_better), tone: 'good' },
        { label: 'Better on every condition — chance', value: c.pct_all_better_expected, display: pct(c.pct_all_better_expected), tone: 'neutral' },
      ],
    },
    {
      kicker: 'Finding 02 — Volume',
      stat: va.hidden.pct_worse,
      decimals: 0,
      suffix: '%',
      statLabel: `of the measures CMS hides (<${va.suppression_floor} readmissions) are above 1.0`,
      headline: '“Small hospitals do worst” was a reporting artifact.',
      detail: `CMS only publishes counts when a hospital has ${va.suppression_floor}+ readmissions, so we only see small hospitals' volumes when their rates are high — making them look worse ${smallest?.pct_worse}% of the time. The hidden measures are actually better than average. Corrected and adjusted, volume has ${va.per_doubling.p >= 0.05 ? 'no detectable effect' : 'a small effect'} (${signed(va.per_doubling.estimate)} ERR points per doubling, ${fmtP(va.per_doubling.p)}).`,
      scale: 100,
      meters: [
        ...(smallest ? [{ label: `Published counts, ${smallest.bin} discharges (biased)`, value: smallest.pct_worse, display: pct(smallest.pct_worse), tone: 'neutral' as Tone }] : []),
        { label: `Hidden counts (<${va.suppression_floor} readmissions)`, value: va.hidden.pct_worse, display: pct(va.hidden.pct_worse), tone: toneVsHalf(va.hidden.pct_worse) },
        ...[safe[0], safe[safe.length - 1]].filter(Boolean).map((b) => ({
          label: `Suppression-safe, ${b.bin} discharges`, value: b.pct_worse, display: pct(b.pct_worse), tone: toneVsHalf(b.pct_worse),
        })),
      ],
    },
  ]

  if (r1 && r5) {
    findings.push({
      kicker: 'Finding 03 — Star rating',
      stat: r1.pct_worse,
      decimals: 0,
      suffix: '%',
      statLabel: `of ★1 hospitals' measures are above 1.0 — vs ${r5.pct_worse}% for ★5`,
      headline: 'Lower-rated hospitals readmit more — partly by construction.',
      detail: `After adjusting for ownership, condition and state, ★1 hospitals sit ${s1 ? signed(s1.estimate, 1) : '—'} ERR points above ★3 and ★5 hospitals ${s5 ? signed(s5.estimate, 1) : '—'}. Caveat: CMS's star rating includes readmission measures, so part of this link is mechanical — the rating is a useful public signal, not proof of cause.`,
      scale: 100,
      meters: data.enrichment.by_rating.map((r) => ({
        label: `★${r.rating} hospitals`, value: r.pct_worse, display: pct(r.pct_worse), tone: toneVsHalf(r.pct_worse),
      })),
    })
  }

  if (fp && fpRaw && npRaw) {
    findings.push({
      kicker: 'Finding 04 — Ownership',
      stat: fp.estimate,
      decimals: 1,
      prefix: fp.estimate > 0 ? '+' : '',
      suffix: ' pts',
      statLabel: `adjusted for-profit gap in ERR points (${fmtP(fp.p)})`,
      headline: fpSig
        ? 'For-profit hospitals still readmit more after adjustment.'
        : 'The for-profit gap mostly disappears after adjustment.',
      detail: `Unadjusted, for-profit hospitals are above 1.0 on ${fpRaw.pct_worse}% of measures vs ${npRaw.pct_worse}% for non-profits. But for-profit hospitals are also more often low-rated and concentrated in high-ERR states. Holding star rating, condition and state fixed, the gap is ${signed(fp.estimate)} points (95% CI ${signed(fp.ci_low)} to ${signed(fp.ci_high)}).`,
      scale: 100,
      meters: [
        { label: 'For-profit (unadjusted)', value: fpRaw.pct_worse, display: pct(fpRaw.pct_worse), tone: toneVsHalf(fpRaw.pct_worse) },
        { label: 'Non-profit (unadjusted)', value: npRaw.pct_worse, display: pct(npRaw.pct_worse), tone: toneVsHalf(npRaw.pct_worse) },
      ],
    })
  }

  if (top) {
    findings.push({
      kicker: 'Finding 05 — Geography',
      stat: (top.mean_err - 1) * 100,
      decimals: 1,
      prefix: top.mean_err > 1 ? '+' : '',
      suffix: '%',
      statLabel: `${stateName(top.state)}'s average ERR vs the benchmark`,
      headline: `${stateName(top.state)} has the highest excess readmissions.`,
      detail: `Ranking only states with ${data.meta.min_hospitals_for_state_rank}+ reporting hospitals, ${nAbove} states sit significantly above 1.0 and ${nBelow} significantly below (95% CIs; * marks a significant gap). CMS adjusts for clinical case mix but not social risk, so these gaps may reflect population differences as well as care delivery.`,
      scale: 4,
      meters: states.slice(0, 4).map((s) => {
        const dev = (s.mean_err - 1) * 100
        return {
          label: `${stateName(s.state)}${s.significant === 'above' ? ' *' : ''}`,
          value: Math.abs(dev),
          display: `${signed(dev, 1)}%`,
          tone: dev > 0 ? 'bad' : 'good',
        }
      }),
    })
  }
  return findings
}

const METER_BG: Record<Tone, string> = {
  bad: 'linear-gradient(90deg,#F43F5E,#FB7185)',
  good: 'linear-gradient(90deg,#38BDF8,#5EEAD4)',
  neutral: 'linear-gradient(90deg,#4B4E72,#6B6F96)',
}
const METER_TEXT: Record<Tone, string> = { bad: 'text-alert', good: 'text-vital', neutral: 'text-gray-300' }

function Meter({ row, scale }: { row: MeterRow; scale: number }) {
  const width = Math.min(row.value / scale, 1) * 100
  return (
    <div>
      <div className="flex justify-between gap-3 text-xs mb-1">
        <span className="text-gray-300">{row.label}</span>
        <span className={`num ${METER_TEXT[row.tone]}`}>{row.display}</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden" aria-hidden>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: METER_BG[row.tone] }}
        />
      </div>
    </div>
  )
}

const fmt = (n: number, f: Finding) =>
  (f.prefix ?? '') +
  n.toLocaleString('en-US', { minimumFractionDigits: f.decimals, maximumFractionDigits: f.decimals }) +
  f.suffix

export default function ScrollStory({ data }: { data: ReadmitData }) {
  const findings = useMemo(() => buildFindings(data), [data])
  const root = useRef<HTMLDivElement>(null)
  const numRef = useRef<HTMLSpanElement>(null)
  const [active, setActive] = useState(0)

  // One ScrollTrigger over the whole section: progress → active step + fill the rail.
  useGSAP(
    () => {
      const rail = root.current?.querySelector('.story-progress') as HTMLElement | null
      if (rail) gsap.set(rail, { transformOrigin: 'top', scaleY: 0 })
      const n = findings.length
      const update = (progress: number) => {
        if (rail) gsap.set(rail, { scaleY: progress })
        setActive(Math.min(n - 1, Math.floor(progress * n)))
      }
      ScrollTrigger.create({
        trigger: root.current,
        start: 'top top',
        end: 'bottom bottom',
        invalidateOnRefresh: true,
        onUpdate: (self) => update(self.progress),
        onRefresh: (self) => update(self.progress),
      })
      // Async assets (3D canvas, web fonts) shift layout after the trigger is built —
      // recompute positions once they settle so start/end stay accurate.
      requestAnimationFrame(() => ScrollTrigger.refresh())
      if (document.fonts?.ready) document.fonts.ready.then(() => ScrollTrigger.refresh())
    },
    { scope: root },
  )

  // Count the big number up each time the active finding changes. The span is owned
  // entirely by GSAP (React renders no children into it), and the exact final value is
  // written on completion and on cleanup, so an interrupted tween can't leave a wrong number.
  useGSAP(
    () => {
      const el = numRef.current
      if (!el) return
      const f = findings[active]
      const final = fmt(f.stat, f)
      if (prefersReducedMotion()) {
        el.textContent = final
        return
      }
      const obj = { v: 0 }
      const DURATION = 0.9
      const tween = gsap.to(obj, {
        v: f.stat,
        duration: DURATION,
        ease: 'power2.out',
        onUpdate: () => { el.textContent = fmt(obj.v, f) },
        onComplete: () => { el.textContent = final },
      })
      // GSAP's lag smoothing slows tween time when frames are throttled (background tabs,
      // battery saver, jank). Guarantee the exact value lands on schedule regardless.
      const settle = window.setTimeout(() => { tween.kill(); el.textContent = final }, DURATION * 1000 + 200)
      return () => { window.clearTimeout(settle); el.textContent = final }
    },
    { dependencies: [active, findings], scope: root },
  )

  const current = findings[active]

  return (
    <section ref={root} className="relative py-16 md:py-24" aria-labelledby="story-title">
      <div className="mb-10">
        <p className="section-label">Key findings</p>
        <h2 id="story-title" className="mt-2 font-display text-2xl md:text-3xl font-bold text-white">Scroll the story</h2>
        <div className="mt-3 h-1 w-16 rounded-full bg-gradient-to-r from-[#A78BFA] via-[#38BDF8] to-[#5EEAD4]" />
      </div>

      <div className="relative grid lg:grid-cols-[1.05fr_1fr] gap-8">
        {/* progress rail */}
        <div className="absolute left-0 top-0 h-full w-px bg-white/5 hidden lg:block" aria-hidden>
          <div className="story-progress absolute inset-0 w-px bg-gradient-to-b from-[#A78BFA] via-[#38BDF8] to-[#5EEAD4]" />
        </div>

        {/* Sticky visual (desktop) — decorative duplicate of the step text, hidden from screen readers */}
        <div className="hidden lg:flex lg:sticky lg:top-0 lg:h-screen items-center pl-8" aria-hidden>
          <div className="glass glow rounded-3xl border border-vital/15 p-8 w-full">
            <p className="section-label">{current.kicker}</p>
            <div className="mt-4 num text-7xl font-bold text-gradient leading-none">
              <span ref={numRef} />
            </div>
            <p className="mt-2 text-sm text-gray-400">{current.statLabel}</p>
            <AnimatePresence mode="wait">
              <motion.p
                key={active}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35 }}
                className="mt-4 font-display text-xl font-semibold text-white"
              >
                {current.headline}
              </motion.p>
            </AnimatePresence>
            <div className="mt-6 space-y-4">
              {current.meters.map((m) => <Meter key={`${active}-${m.label}`} row={m} scale={current.scale} />)}
            </div>
          </div>
        </div>

        {/* Scrolling steps */}
        <div className="lg:pr-4">
          {findings.map((f, i) => (
            <div key={f.kicker} className="story-step flex min-h-[80vh] lg:min-h-screen items-center">
              <div className={`transition-opacity duration-500 ${active === i ? 'opacity-100' : 'lg:opacity-40'}`}>
                <p className="section-label">{f.kicker}</p>
                <h3 className="mt-3 font-display text-2xl md:text-3xl font-bold text-white leading-snug">
                  {f.headline}
                </h3>
                <p className="mt-4 text-gray-400 leading-relaxed">{f.detail}</p>

                {/* Inline visual for mobile (no sticky pane there) */}
                <div className="mt-6 space-y-4 lg:hidden glass rounded-2xl border border-white/10 p-5">
                  <div>
                    <div className="num text-5xl font-bold text-gradient leading-none">{fmt(f.stat, f)}</div>
                    <p className="mt-2 text-sm text-gray-400">{f.statLabel}</p>
                  </div>
                  {f.meters.map((m) => <Meter key={m.label} row={m} scale={f.scale} />)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

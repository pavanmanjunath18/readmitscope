import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { ReadmitData } from '../types'

gsap.registerPlugin(useGSAP, ScrollTrigger)

interface MeterRow { label: string; value: number; tone: 'good' | 'bad' }
interface Finding {
  kicker: string
  stat: number
  decimals: number
  suffix: string
  headline: string
  detail: string
  meters: MeterRow[]
}

function buildFindings(data: ReadmitData): Finding[] {
  const k = data.kpis
  const vLow = data.volume_vs_err[0]
  const vHigh = data.volume_vs_err[data.volume_vs_err.length - 1]
  const r1 = data.enrichment.by_rating.find((r) => r.rating === 1)
  const r5 = data.enrichment.by_rating.find((r) => r.rating === 5)
  const fp = data.enrichment.by_ownership.find((o) => o.group === 'For-profit')
  const np = data.enrichment.by_ownership.find((o) => o.group === 'Non-profit')
  const states = [...data.by_state].sort((a, b) => b.mean_err - a.mean_err)
  const worst = states[0]

  return [
    {
      kicker: 'Finding 01 — Scale of the problem',
      stat: k.pct_hospitals_any_worse,
      decimals: 1,
      suffix: '%',
      headline: 'Excess readmissions are systemic, not a few bad actors.',
      detail: `${k.pct_hospitals_any_worse}% of hospitals exceed expectations on at least one condition, and ${k.pct_worse_than_expected}% of all measures land above the benchmark. This is a system-wide pattern.`,
      meters: [
        { label: 'Hospitals worse on ≥1 condition', value: k.pct_hospitals_any_worse, tone: 'bad' },
        { label: 'All measures worse than expected', value: k.pct_worse_than_expected, tone: 'bad' },
      ],
    },
    {
      kicker: 'Finding 02 — Volume effect',
      stat: vLow?.pct_worse ?? 0,
      decimals: 0,
      suffix: '%',
      headline: 'The smallest hospitals almost always miss the benchmark.',
      detail: `Hospitals with ${vLow?.bin} discharges are worse than expected ${vLow?.pct_worse}% of the time — versus ${vHigh?.pct_worse}% for the busiest (${vHigh?.bin}). Scale is protective (Spearman ρ = −0.16, p < 0.001).`,
      meters: [
        { label: `${vLow?.bin} discharges`, value: vLow?.pct_worse ?? 0, tone: 'bad' },
        { label: `${vHigh?.bin} discharges`, value: vHigh?.pct_worse ?? 0, tone: 'good' },
      ],
    },
    {
      kicker: 'Finding 03 — Quality & ownership',
      stat: r1?.pct_worse ?? 0,
      decimals: 0,
      suffix: '%',
      headline: 'Star rating and ownership show up in readmissions.',
      detail: `A ★1 hospital is worse than expected ${r1?.pct_worse}% of the time vs ${r5?.pct_worse}% for a ★5. For-profit hospitals (${fp?.pct_worse}%) trail non-profit (${np?.pct_worse}%). Both gaps survive risk adjustment.`,
      meters: [
        { label: '★1 hospitals', value: r1?.pct_worse ?? 0, tone: 'bad' },
        { label: '★5 hospitals', value: r5?.pct_worse ?? 0, tone: 'good' },
        { label: 'For-profit', value: fp?.pct_worse ?? 0, tone: 'bad' },
        { label: 'Non-profit', value: np?.pct_worse ?? 0, tone: 'good' },
      ],
    },
    {
      kicker: 'Finding 04 — Geography',
      stat: (worst.mean_err - 1) * 100,
      decimals: 1,
      suffix: '%',
      headline: `${worst.state} leads the nation in excess readmissions.`,
      detail: `${worst.state} averages ${((worst.mean_err - 1) * 100).toFixed(1)}% above expected — the highest of any state, with ${worst.pct_worse}% of measures worse than expected. Because ERR is risk-adjusted, this reflects care delivery, not patient mix.`,
      meters: states.slice(0, 4).map((s, i) => ({
        label: s.state,
        value: s.pct_worse,
        tone: i === 0 ? 'bad' : 'good',
      })),
    },
  ]
}

function Meter({ row }: { row: MeterRow }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-300">{row.label}</span>
        <span className={`num ${row.tone === 'bad' ? 'text-alert' : 'text-vital'}`}>{row.value}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(row.value, 100)}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: row.tone === 'bad' ? 'linear-gradient(90deg,#F43F5E,#FB7185)' : 'linear-gradient(90deg,#38BDF8,#5EEAD4)' }}
        />
      </div>
    </div>
  )
}

export default function ScrollStory({ data }: { data: ReadmitData }) {
  const findings = buildFindings(data)
  const root = useRef<HTMLDivElement>(null)
  const numRef = useRef<HTMLSpanElement>(null)
  const [active, setActive] = useState(0)

  const fmt = (n: number, f: Finding) =>
    n.toLocaleString('en-US', { minimumFractionDigits: f.decimals, maximumFractionDigits: f.decimals }) + f.suffix

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

  // Count the big number up each time the active finding changes.
  useGSAP(
    () => {
      const el = numRef.current
      if (!el) return
      const f = findings[active]
      const obj = { v: 0 }
      gsap.to(obj, {
        v: f.stat,
        duration: 0.9,
        ease: 'power2.out',
        onUpdate: () => { el.textContent = fmt(obj.v, f) },
      })
    },
    { dependencies: [active], scope: root },
  )

  const current = findings[active]

  return (
    <section ref={root} className="relative py-16 md:py-24">
      <div className="mb-10">
        <p className="section-label">Key findings</p>
        <h2 className="mt-2 font-display text-2xl md:text-3xl font-bold text-white">Scroll the story</h2>
        <div className="mt-3 h-1 w-16 rounded-full bg-gradient-to-r from-[#A78BFA] via-[#38BDF8] to-[#5EEAD4]" />
      </div>

      <div className="relative grid lg:grid-cols-[1.05fr_1fr] gap-8">
        {/* progress rail */}
        <div className="absolute left-0 top-0 h-full w-px bg-white/5 hidden lg:block">
          <div className="story-progress absolute inset-0 w-px bg-gradient-to-b from-[#A78BFA] via-[#38BDF8] to-[#5EEAD4]" />
        </div>

        {/* Sticky aurora visual (desktop) */}
        <div className="hidden lg:flex lg:sticky lg:top-0 lg:h-screen items-center pl-8">
          <div className="glass glow rounded-3xl border border-vital/15 p-8 w-full">
            <p className="section-label">{current.kicker}</p>
            <div className="mt-4 num text-7xl font-bold text-gradient leading-none">
              <span ref={numRef}>{fmt(current.stat, current)}</span>
            </div>
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
              {current.meters.map((m) => <Meter key={m.label} row={m} />)}
            </div>
          </div>
        </div>

        {/* Scrolling steps */}
        <div className="lg:pr-4">
          {findings.map((f, i) => (
            <div key={i} className="story-step flex min-h-[80vh] lg:min-h-screen items-center">
              <div className={`transition-opacity duration-500 ${active === i ? 'opacity-100' : 'lg:opacity-40'}`}>
                <p className="section-label">{f.kicker}</p>
                <h3 className="mt-3 font-display text-2xl md:text-3xl font-bold text-white leading-snug">
                  {f.headline}
                </h3>
                <p className="mt-4 text-gray-400 leading-relaxed">{f.detail}</p>

                {/* Inline visual for mobile (no sticky pane there) */}
                <div className="mt-6 space-y-4 lg:hidden glass rounded-2xl border border-white/10 p-5">
                  <div className="num text-5xl font-bold text-gradient leading-none">{fmt(f.stat, f)}</div>
                  {f.meters.map((m) => <Meter key={m.label} row={m} />)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

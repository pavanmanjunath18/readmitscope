import { motion } from 'framer-motion'
import { Stethoscope } from 'lucide-react'
import { signed } from '../format'
import type { ReadmitData } from '../types'

export default function StorySummary({ data }: { data: ReadmitData }) {
  const { kpis, consistency: c, model, volume_artifact: v } = data
  const star1 = model.terms.find((t) => t.label === '★1')
  const star5 = model.terms.find((t) => t.label === '★5')
  const nAbove = data.by_state.filter((s) => s.significant === 'above').length
  const forProfit = model.terms.find((t) => t.label === 'For-profit')
  const volumeNull = v.per_doubling.p >= 0.05
  const forProfitNull = forProfit ? forProfit.p >= 0.05 : false

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="relative mt-6 mb-2"
    >
      <div className="glass glow rounded-2xl border border-vital/20 p-6 md:p-8">
        <div className="flex items-center gap-2 mb-3">
          <Stethoscope size={16} className="text-vital" aria-hidden />
          <h2 className="section-label">The story in 30 seconds</h2>
        </div>
        <p className="text-base md:text-lg leading-relaxed text-slate-200">
          ERR compares each hospital with the national average, so about half of all measures
          ({kpis.pct_worse_than_expected}%) land above 1.0 <em>by design</em>. The real signal is
          {' '}<strong className="text-vital-mint">consistency</strong>: {c.pct_all_worse}% of
          hospitals are worse than expected on <strong className="text-white">every</strong> condition
          they report, about {(c.pct_all_worse / c.pct_all_worse_expected).toFixed(1)}× what chance
          would produce. Lower-rated hospitals readmit more
          {star1 && star5 && <> (★1 {signed(star1.estimate, 1)} vs ★5 {signed(star5.estimate, 1)} ERR points, relative to ★3)</>},
          partly because the rating itself includes readmissions, and {nAbove} states sit
          significantly above the benchmark. The “small hospitals do worst” pattern comes from how
          CMS suppresses small counts
          {volumeNull
            ? <> — corrected, volume has no detectable effect ({signed(v.per_doubling.estimate)} points per doubling)</>
            : <> — corrected, the volume effect is {signed(v.per_doubling.estimate)} points per doubling</>}.
          {forProfit && (forProfitNull
            ? <> The for-profit gap shrinks to a non-significant {signed(forProfit.estimate, 1)} points once rating and state are considered.</>
            : <> For-profit hospitals remain {signed(forProfit.estimate, 1)} points higher after adjusting for rating and state.</>)}
          {' '}<strong className="text-vital-mint">Target the hospitals that are consistently
          worse, not size or service line.</strong>
        </p>
      </div>
    </motion.section>
  )
}

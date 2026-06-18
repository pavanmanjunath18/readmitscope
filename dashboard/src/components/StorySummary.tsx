import { motion } from 'framer-motion'
import { Stethoscope } from 'lucide-react'
import type { Kpis, Enrichment } from '../types'

export default function StorySummary({ kpis, enrichment }: { kpis: Kpis; enrichment: Enrichment }) {
  const star1 = enrichment.by_rating.find((r) => r.rating === 1)
  const star5 = enrichment.by_rating.find((r) => r.rating === 5)

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="relative -mt-6 mb-2"
    >
      <div className="glass glow rounded-2xl border border-vital/20 p-6 md:p-8">
        <div className="flex items-center gap-2 mb-3">
          <Stethoscope size={16} className="text-vital" />
          <span className="section-label">The story in 30 seconds</span>
        </div>
        <p className="text-base md:text-lg leading-relaxed text-slate-200">
          Across <strong className="text-white">{kpis.n_hospitals.toLocaleString()}</strong> U.S. hospitals,
          excess readmissions are <strong className="text-vital-mint">not a few bad actors but a system-wide
          problem</strong> — {kpis.pct_worse_than_expected}% of measures, and {kpis.pct_hospitals_any_worse}% of
          hospitals, exceed what CMS expects for their patients.
          The risk isn't random: it concentrates in <strong className="text-white">smaller, lower-rated, and
          for-profit hospitals</strong>. The smallest facilities miss the benchmark almost every time, and a
          <strong className="text-white"> ★1 hospital readmits excessively {star1 && star5
            ? `${(star1.pct_worse / star5.pct_worse).toFixed(1)}×`
            : 'far'} as often as a ★5</strong> — gaps that survive CMS's risk adjustment, so they reflect how care
          is delivered, not how sick the patients are.
          The takeaway for policymakers: <strong className="text-vital-mint">target the low-volume,
          low-rated tail</strong> — that's where the readmissions, and the Medicare penalties, pile up.
        </p>
      </div>
    </motion.section>
  )
}

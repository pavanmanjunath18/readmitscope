import { motion } from 'framer-motion'
import { Building2, AlertTriangle, TrendingUp, RotateCcw } from 'lucide-react'
import Tilt from './Tilt'
import CountUp from './CountUp'
import type { Kpis, Consistency } from '../types'

export default function KpiGrid({ kpis, consistency: c }: { kpis: Kpis; consistency: Consistency }) {
  const ratio = c.pct_all_worse / c.pct_all_worse_expected
  const cards = [
    {
      icon: <Building2 size={20} />,
      value: kpis.n_hospitals,
      label: 'Hospitals with reported measures',
      sub: `of ${kpis.n_hospitals_in_file.toLocaleString()} in the CMS file · ${kpis.n_measures_reported.toLocaleString()} condition-measures`,
    },
    {
      icon: <TrendingUp size={20} />,
      value: kpis.national_median_err,
      decimals: 3,
      label: 'National median ERR',
      sub: '1.000 = the national-average hospital with the same patients',
    },
    {
      icon: <AlertTriangle size={20} />,
      value: c.pct_all_worse,
      decimals: 1,
      suffix: '%',
      label: 'Worse on every condition',
      sub: `${ratio.toFixed(1)}× the ${c.pct_all_worse_expected}% chance rate (hospitals with ≥${c.min_conditions} conditions)`,
    },
    {
      icon: <RotateCcw size={20} />,
      value: kpis.total_readmissions,
      label: '30-day readmissions',
      sub: `of ${kpis.total_discharges.toLocaleString()} discharges, in the ${kpis.n_measures_with_counts.toLocaleString()} measures where CMS publishes counts`,
    },
  ]
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 -mt-8 relative z-10">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          className="h-full"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: i * 0.08 }}
        >
          <Tilt className="h-full">
            <div className="glass glass-hover rounded-2xl border border-white/10 p-5 overflow-hidden relative h-full">
              <div className="h-1 -mx-5 -mt-5 mb-4 bg-gradient-to-r from-[#22D3EE] via-[#2DD4BF] to-[#34D399]" />
              <div className="flex items-center justify-between">
                <span className="text-vital" aria-hidden>{c.icon}</span>
              </div>
              <div className="mt-3 num text-3xl font-bold text-white">
                <CountUp value={c.value} decimals={c.decimals ?? 0} suffix={c.suffix ?? ''} />
              </div>
              <div className="mt-1 text-sm font-medium text-gray-200">{c.label}</div>
              <div className="mt-1 text-xs text-gray-400">{c.sub}</div>
            </div>
          </Tilt>
        </motion.div>
      ))}
    </div>
  )
}

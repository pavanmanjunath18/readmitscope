import { motion } from 'framer-motion'
import { Building2, AlertTriangle, TrendingUp, RotateCcw } from 'lucide-react'
import Tilt from './Tilt'
import CountUp from './CountUp'
import type { Kpis } from '../types'

export default function KpiGrid({ kpis }: { kpis: Kpis }) {
  const cards = [
    {
      icon: <Building2 size={20} />,
      value: kpis.n_hospitals,
      label: 'Hospitals analyzed',
      sub: `${kpis.n_measures_reported.toLocaleString()} reported condition-measures`,
    },
    {
      icon: <TrendingUp size={20} />,
      value: kpis.national_mean_err,
      decimals: 3,
      label: 'National mean ERR',
      sub: 'Excess Readmission Ratio (1.0 = expected)',
    },
    {
      icon: <AlertTriangle size={20} />,
      value: kpis.pct_worse_than_expected,
      decimals: 1,
      suffix: '%',
      label: 'Measures worse than expected',
      sub: `${kpis.pct_hospitals_any_worse}% of hospitals on ≥1 condition`,
    },
    {
      icon: <RotateCcw size={20} />,
      value: kpis.total_readmissions,
      label: '30-day readmissions',
      sub: `of ${kpis.total_discharges.toLocaleString()} eligible discharges`,
    },
  ]
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 -mt-8 relative z-10">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: i * 0.08 }}
        >
          <Tilt>
            <div className="glass glass-hover rounded-2xl border border-white/10 p-5 overflow-hidden relative h-full">
              <div className="h-1 -mx-5 -mt-5 mb-4 bg-gradient-to-r from-[#22D3EE] via-[#2DD4BF] to-[#34D399]" />
              <div className="flex items-center justify-between">
                <span className="text-vital">{c.icon}</span>
              </div>
              <div className="mt-3 num text-3xl font-bold text-white">
                <CountUp value={c.value} decimals={c.decimals ?? 0} suffix={c.suffix ?? ''} />
              </div>
              <div className="mt-1 text-sm font-medium text-gray-200">{c.label}</div>
              <div className="mt-1 text-xs text-gray-500">{c.sub}</div>
            </div>
          </Tilt>
        </motion.div>
      ))}
    </div>
  )
}

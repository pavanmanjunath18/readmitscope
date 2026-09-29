import { lazy, Suspense } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Activity, Database, Calendar, Github, ArrowUpRight } from 'lucide-react'
import { REPO_URL, useReducedMotion } from '../format'
import type { Meta, Kpis } from '../types'

// three.js + react-three-fiber are the heaviest part of the bundle and purely decorative,
// so they load in a separate chunk after the page is interactive.
const HeroScene = lazy(() => import('./HeroScene'))

export default function Hero({ meta, kpis }: { meta: Meta; kpis: Kpis }) {
  const retrieved = new Date(meta.retrieved_at_utc).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
  const reduced = useReducedMotion()
  // Subtle parallax: hero content drifts up + fades as you scroll past it.
  const { scrollY } = useScroll()
  const y = useTransform(scrollY, [0, 500], [0, 80])
  const opacity = useTransform(scrollY, [0, 420], [1, 0])

  return (
    <header className="relative overflow-hidden border-b border-white/5 min-h-[560px]">
      {!reduced && (
        <Suspense fallback={null}>
          <HeroScene />
        </Suspense>
      )}
      <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-vital/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-vital-cyan/10 blur-3xl" />
      <motion.div style={reduced ? undefined : { y, opacity }} className="relative mx-auto max-w-7xl px-5 sm:px-8 py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-vital/30 bg-vital/10 px-3 py-1 text-xs font-semibold text-vital">
            <Activity size={14} /> Healthcare Data Analytics
          </div>
          <h1 className="mt-5 font-display text-4xl md:text-6xl font-bold leading-tight">
            <span className="text-gradient">ReadmitScope</span> <span className="text-white">US</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base md:text-lg text-gray-300 leading-relaxed">
            Which U.S. hospitals readmit Medicare patients more than expected — and what
            explains it. An analysis of <strong className="text-white">{kpis.n_hospitals.toLocaleString()}</strong> hospitals
            with reported measures across <strong className="text-white">{kpis.n_states}</strong> states (incl. D.C.),
            using public CMS Hospital Readmissions Reduction Program data.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 rounded-lg border border-vital/40 bg-vital/10 px-4 py-2 text-sm font-semibold text-vital transition hover:border-vital hover:bg-vital/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-vital"
            >
              <Github size={16} aria-hidden />
              View source on GitHub
              <ArrowUpRight size={14} aria-hidden className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            <a
              href="#methodology"
              className="inline-flex items-center rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-gray-300 transition hover:border-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-vital"
            >
              How it was built
            </a>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 text-xs text-gray-400">
            <Badge icon={<Database size={13} />} text={meta.source} />
            <Badge icon={<Calendar size={13} />} text={`${meta.release ? `${meta.release} · ` : ''}Reporting period ${meta.reporting_period}`} />
            <Badge icon={<span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />} text={`Data retrieved ${retrieved}`} />
          </div>
          <p className="mt-3 max-w-2xl text-xs text-gray-400 leading-relaxed">
            CMS computes readmission measures over a rolling 3-year window and publishes
            with a lag (claims must fully mature). Re-running the pipeline picks up each
            CMS refresh.
          </p>
        </motion.div>
      </motion.div>
    </header>
  )
}

function Badge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
      {icon} {text}
    </span>
  )
}

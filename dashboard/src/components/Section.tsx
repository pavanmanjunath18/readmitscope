import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface Props {
  label: string
  title: string
  blurb?: string
  children: ReactNode
  id?: string
}

export default function Section({ label, title, blurb, children, id }: Props) {
  return (
    <section id={id} className="py-12 md:py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.5 }}
      >
        <p className="section-label">{label}</p>
        <h2 className="mt-2 font-display text-2xl md:text-3xl font-bold text-white">{title}</h2>
        <div className="mt-3 h-1 w-16 rounded-full bg-gradient-to-r from-[#22D3EE] via-[#2DD4BF] to-[#34D399]" />
        {blurb && <p className="mt-4 max-w-3xl text-gray-400 text-sm md:text-base leading-relaxed">{blurb}</p>}
        <div className="mt-8">{children}</div>
      </motion.div>
    </section>
  )
}

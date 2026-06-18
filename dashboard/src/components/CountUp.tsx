import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(useGSAP, ScrollTrigger)

interface Props {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
}

/** Animated number that counts up from 0 when it scrolls into view (GSAP + ScrollTrigger). */
export default function CountUp({ value, decimals = 0, prefix = '', suffix = '', className = '' }: Props) {
  const ref = useRef<HTMLSpanElement>(null)

  const fmt = (n: number) =>
    prefix +
    n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) +
    suffix

  useGSAP(
    () => {
      const el = ref.current
      if (!el) return
      const obj = { v: 0 }
      el.textContent = fmt(0)
      gsap.to(obj, {
        v: value,
        duration: 1.6,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true },
        onUpdate: () => { el.textContent = fmt(obj.v) },
      })
    },
    { dependencies: [value] },
  )

  return <span ref={ref} className={className}>{fmt(value)}</span>
}

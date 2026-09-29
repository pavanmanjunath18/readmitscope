import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { prefersReducedMotion } from '../format'

gsap.registerPlugin(useGSAP, ScrollTrigger)

interface Props {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
}

export function formatNumber(n: number, decimals: number, prefix = '', suffix = '') {
  return (
    prefix +
    n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) +
    suffix
  )
}

/**
 * Animated number that counts up from 0 when it scrolls into view.
 * The final value is always written on completion (and on cleanup), so an
 * interrupted tween can never leave a wrong number on screen.
 */
export default function CountUp({ value, decimals = 0, prefix = '', suffix = '', className = '' }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const final = formatNumber(value, decimals, prefix, suffix)

  useGSAP(
    () => {
      const el = ref.current
      if (!el) return
      if (prefersReducedMotion()) {
        el.textContent = final
        return
      }
      const obj = { v: 0 }
      const DURATION = 1.6
      let settle = 0
      el.textContent = formatNumber(0, decimals, prefix, suffix)
      const tween = gsap.to(obj, {
        v: value,
        duration: DURATION,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true },
        // GSAP's lag smoothing slows tween time when frames are throttled; make sure the
        // exact value lands on schedule once the count has started.
        onStart: () => {
          settle = window.setTimeout(() => { tween.kill(); el.textContent = final }, DURATION * 1000 + 200)
        },
        onUpdate: () => { el.textContent = formatNumber(obj.v, decimals, prefix, suffix) },
        onComplete: () => { el.textContent = final },
      })
      return () => { window.clearTimeout(settle); el.textContent = final }
    },
    { dependencies: [value, final] },
  )

  // The screen-reader label always carries the true value, independent of the animation.
  return (
    <span className={className}>
      <span ref={ref} aria-hidden>{final}</span>
      <span className="sr-only">{final}</span>
    </span>
  )
}

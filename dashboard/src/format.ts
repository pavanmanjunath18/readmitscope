import { useEffect, useState } from 'react'

/** p-value as readable text: "p < 0.001", "p = 0.068". */
export function fmtP(p: number): string {
  if (!Number.isFinite(p)) return 'p n/a'
  if (p < 0.001) return 'p < 0.001'
  return `p = ${p.toFixed(3)}`
}

/** Signed number with fixed decimals: +0.42, −1.97 (true minus sign). */
export function signed(n: number, decimals = 2): string {
  const s = Math.abs(n).toFixed(decimals)
  return n > 0 ? `+${s}` : n < 0 ? `−${s}` : s
}

/** ERR → percent above/below the benchmark, e.g. 1.029 → "+2.9%". */
export function errPct(err: number, decimals = 1): string {
  return `${signed((err - 1) * 100, decimals)}%`
}

export const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

export const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'D.C.', FL: 'Florida',
  GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana',
  IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine',
  MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
}
export const stateName = (s: string) => STATE_NAMES[s] ?? s

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.(REDUCED_QUERY).matches
}

/** Tracks the user's reduced-motion preference. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion)
  useEffect(() => {
    const mq = window.matchMedia?.(REDUCED_QUERY)
    if (!mq) return
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

/** Tracks a min-width media query (Tailwind-style breakpoints). */
export function useMinWidth(px: number): boolean {
  const q = `(min-width: ${px}px)`
  const [ok, setOk] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setOk(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [q])
  return ok
}

/**
 * "Aurora Clinical" palette — single source of truth for chart colors.
 * Deep midnight-indigo base with a bioluminescent violet → cyan → mint aurora.
 * Worse-than-expected = coral-rose (clinical alert). Premium, immersive, health-calm.
 */
export const C = {
  accent: '#5EEAD4',      // mint-aqua — primary accent / glow
  accentDeep: '#2DD4BF',  // teal
  cyan: '#38BDF8',        // sky-cyan — gradient mid
  violet: '#A78BFA',      // aurora violet — gradient start
  emerald: '#34D399',     // "better than expected"
  mint: '#5EEAD4',        // light accent

  worse: '#FB7185',       // coral-rose — "worse than expected" (alert)
  worseDeep: '#F43F5E',
  neutral: '#3B3D5C',     // indigo-slate bars (on-theme, not generic grey)

  axis: '#8B8FB0',        // lavender-grey axis text
  grid: '#20223C',        // indigo gridlines
  text: '#ECECF5',
  card: '#121327',        // tooltip background
  border: '#2A2C4A',      // tooltip border
}

/** Shared Recharts tooltip style. */
export const tooltipStyle = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  boxShadow: '0 8px 40px rgba(94,234,212,0.10)',
}

/** Aurora gradient used across section accents (violet → sky → mint). */
export const GRADIENT = 'from-[#A78BFA] via-[#38BDF8] to-[#5EEAD4]'

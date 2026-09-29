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

/** Shared Recharts tooltip box style. */
export const tooltipStyle = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  boxShadow: '0 8px 40px rgba(94,234,212,0.10)',
  padding: '10px 14px',
  maxWidth: 340,
  whiteSpace: 'normal' as const,
}

/**
 * Spread onto every <Tooltip>. Recharts colours each tooltip line with its series
 * colour by default, which falls back to a dark blue that is unreadable on this dark
 * background — so title and value text are set explicitly.
 */
export const tooltipProps = {
  contentStyle: tooltipStyle,
  labelStyle: { color: '#FFFFFF', fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: C.text, fontSize: 13, lineHeight: 1.45 },
  wrapperStyle: { outline: 'none', zIndex: 20 },
}

/** Aurora gradient used across section accents (violet → sky → mint). */
export const GRADIENT = 'from-[#A78BFA] via-[#38BDF8] to-[#5EEAD4]'

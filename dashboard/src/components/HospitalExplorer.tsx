import { Fragment, useId, useMemo, useState } from 'react'
import { Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronRight } from 'lucide-react'
import Section from './Section'
import Insight from './Insight'
import { stateName, titleCase } from '../format'
import type { Hospital, ConditionStat } from '../types'

type SortKey = 'name' | 'mean_err' | 'worst_err' | 'n_worse' | 'total_discharges'

const PAGE = 25

function errColor(err: number) {
  if (err > 1.05) return 'text-rose-400'
  if (err > 1.0) return 'text-rose-300'
  return 'text-emerald-400'
}

function compare(a: Hospital, b: Hospital, key: SortKey): number {
  if (key === 'name') return a.name.localeCompare(b.name)
  const av = a[key]
  const bv = b[key]
  if (av == null && bv == null) return 0
  if (av == null) return 1 // suppressed values always sort last
  if (bv == null) return -1
  return av - bv
}

export default function HospitalExplorer({
  hospitals,
  byCondition,
  minConditions,
}: {
  hospitals: Hospital[]
  byCondition: ConditionStat[]
  minConditions: number
}) {
  const ids = useId()
  const [q, setQ] = useState('')
  const [state, setState] = useState('All')
  const [ownership, setOwnership] = useState('All')
  const [rating, setRating] = useState('All')
  const [minOnly, setMinOnly] = useState(true)
  const [consistentOnly, setConsistentOnly] = useState(false)
  const [sort, setSort] = useState<SortKey>('mean_err')
  const [desc, setDesc] = useState(true)
  const [limit, setLimit] = useState(PAGE)
  const [open, setOpen] = useState<string | null>(null)

  const conditions = byCondition.map((c) => c.label)
  const states = useMemo(() => Array.from(new Set(hospitals.map((h) => h.state))).sort(), [hospitals])
  const ownerships = useMemo(
    () => Array.from(new Set(hospitals.map((h) => h.ownership).filter(Boolean) as string[])).sort(),
    [hospitals],
  )

  // Highest / lowest mean ERR among hospitals meeting the fair-ranking bar.
  const eligible = useMemo(() => hospitals.filter((h) => h.n_reported >= minConditions), [hospitals, minConditions])
  const highest = eligible.reduce<Hospital | undefined>((a, b) => (!a || b.mean_err > a.mean_err ? b : a), undefined)
  const lowest = eligible.reduce<Hospital | undefined>((a, b) => (!a || b.mean_err < a.mean_err ? b : a), undefined)

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    const r = hospitals.filter((h) =>
      (!t || h.name.toLowerCase().includes(t) || h.id.toLowerCase().includes(t)) &&
      (state === 'All' || h.state === state) &&
      (ownership === 'All' || h.ownership === ownership) &&
      (rating === 'All' || (rating === 'Unrated' ? h.star_rating == null : h.star_rating === Number(rating))) &&
      (!minOnly || h.n_reported >= minConditions) &&
      (!consistentOnly || (h.n_reported >= minConditions && h.n_worse === h.n_reported)),
    )
    return r.sort((a, b) => {
      const c = compare(a, b, sort)
      // Keep nulls last regardless of direction.
      if (sort !== 'name' && (a[sort] == null || b[sort] == null)) return c
      return desc ? -c : c
    })
  }, [hospitals, q, state, ownership, rating, minOnly, consistentOnly, minConditions, sort, desc])

  const resetPage = () => { setLimit(PAGE); setOpen(null) }
  const toggleSort = (k: SortKey) => {
    if (k === sort) setDesc(!desc)
    else { setSort(k); setDesc(k !== 'name') }
    resetPage()
  }
  const thProps = { sort, desc, onSort: toggleSort }

  const selectCls = 'rounded-lg border border-white/10 bg-clinical-800 px-3 py-2 text-sm text-white focus:border-vital focus:outline-none'

  return (
    <Section
      label="Explore"
      title="Hospital explorer"
      blurb={`Search, filter and sort all ${hospitals.length.toLocaleString()} hospitals with reported measures. Mean ERR averages a hospital's reported conditions; select a hospital to see each condition. A single hospital's ERR carries real uncertainty, so treat rankings as leads for review, not verdicts.`}
    >
      <div className="glass rounded-2xl border border-white/10 p-5">
        {highest && lowest && (
          <Insight>
            Among hospitals reporting at least {minConditions} conditions,{' '}
            <strong className="text-white">{titleCase(highest.name)} ({highest.state})</strong> has the highest mean
            ERR, {highest.mean_err.toFixed(2)} (about {Math.round((highest.mean_err - 1) * 100)}% above expected;
            highest on {highest.worst_condition}). {titleCase(lowest.name)} ({lowest.state}) has the lowest, about{' '}
            {Math.round((1 - lowest.mean_err) * 100)}% below expected.
          </Insight>
        )}

        {/* controls */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="relative">
            <label htmlFor={`${ids}-q`} className="sr-only">Search by hospital name or CCN</label>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
            <input
              id={`${ids}-q`}
              type="search"
              value={q}
              onChange={(e) => { setQ(e.target.value); resetPage() }}
              placeholder="Search hospital name or CCN…"
              className="w-full rounded-lg border border-white/10 bg-clinical-800 pl-9 pr-3 py-2 text-sm text-white placeholder-gray-400 focus:border-vital focus:outline-none"
            />
          </div>
          <Select id={`${ids}-state`} label="State" value={state} className={selectCls}
            onChange={(v) => { setState(v); resetPage() }}
            options={[['All', 'All states'], ...states.map((s) => [s, `${s} — ${stateName(s)}`] as [string, string])]} />
          <Select id={`${ids}-own`} label="Ownership" value={ownership} className={selectCls}
            onChange={(v) => { setOwnership(v); resetPage() }}
            options={[['All', 'All ownership'], ...ownerships.map((o) => [o, o] as [string, string])]} />
          <Select id={`${ids}-rating`} label="Star rating" value={rating} className={selectCls}
            onChange={(v) => { setRating(v); resetPage() }}
            options={[['All', 'All ratings'], ...[5, 4, 3, 2, 1].map((r) => [String(r), `${'★'.repeat(r)} (${r})`] as [string, string]), ['Unrated', 'Unrated']]} />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-300">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={minOnly} onChange={(e) => { setMinOnly(e.target.checked); resetPage() }} className="accent-[#5EEAD4]" />
            Only hospitals with ≥{minConditions} reported conditions
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={consistentOnly} onChange={(e) => { setConsistentOnly(e.target.checked); resetPage() }} className="accent-[#5EEAD4]" />
            Only hospitals worse on every condition
          </label>
        </div>

        <p className="mt-4 mb-2 text-xs text-gray-400" aria-live="polite">{rows.length.toLocaleString()} hospitals match</p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-white/10">
                <Th label="Hospital" k="name" {...thProps} className="pr-3 pl-0" />
                <th scope="col" className="py-2 px-3 font-medium">State</th>
                <th scope="col" className="py-2 px-3 font-medium hidden lg:table-cell">Rating</th>
                <th scope="col" className="py-2 px-3 font-medium hidden xl:table-cell">Ownership</th>
                <Th label="Mean ERR" k="mean_err" {...thProps} />
                <Th label="Worst ERR" k="worst_err" {...thProps} className="hidden md:table-cell" />
                <th scope="col" className="py-2 px-3 font-medium hidden xl:table-cell">Worst condition</th>
                <Th label="# worse" k="n_worse" {...thProps} />
                <Th label="Discharges" k="total_discharges" {...thProps} className="hidden sm:table-cell" />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((h) => {
                const isOpen = open === h.id
                return (
                  <Fragment key={h.id}>
                    <tr className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="py-2.5 pr-3 max-w-[280px]">
                        <button
                          onClick={() => setOpen(isOpen ? null : h.id)}
                          aria-expanded={isOpen}
                          aria-controls={`${ids}-d-${h.id}`}
                          className="flex w-full items-center gap-1.5 text-left text-gray-200 hover:text-white"
                          title={h.name}
                        >
                          <ChevronRight size={14} className={`shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} aria-hidden />
                          <span className="truncate">{h.name}</span>
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-gray-400">{h.state}</td>
                      <td className="py-2.5 px-3 hidden lg:table-cell whitespace-nowrap">
                        {h.star_rating != null
                          ? <span className="text-vital-mint" aria-label={`${h.star_rating} of 5 stars`}>{'★'.repeat(h.star_rating)}<span className="text-gray-700">{'★'.repeat(5 - h.star_rating)}</span></span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-gray-400 hidden xl:table-cell whitespace-nowrap">{h.ownership ?? '—'}</td>
                      <td className={`py-2.5 px-3 font-semibold tabular-nums ${errColor(h.mean_err)}`}>{h.mean_err.toFixed(3)}</td>
                      <td className={`py-2.5 px-3 tabular-nums hidden md:table-cell ${errColor(h.worst_err)}`}>{h.worst_err.toFixed(3)}</td>
                      <td className="py-2.5 px-3 text-gray-400 hidden xl:table-cell">{h.worst_condition}</td>
                      <td className="py-2.5 px-3 text-gray-300 tabular-nums">{h.n_worse}/{h.n_reported}</td>
                      <td className="py-2.5 px-3 text-gray-300 tabular-nums hidden sm:table-cell">
                        {h.total_discharges != null
                          ? h.total_discharges.toLocaleString()
                          : <span className="text-gray-400" title="Suppressed by CMS (fewer than 11 readmissions)">—</span>}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr id={`${ids}-d-${h.id}`} className="border-b border-white/5 bg-white/[0.02]">
                        <td colSpan={9} className="px-3 py-4">
                          <HospitalDetail h={h} conditions={conditions} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        {limit < rows.length && (
          <button
            onClick={() => setLimit((l) => l + PAGE)}
            className="mt-4 w-full rounded-lg border border-white/10 py-2 text-sm text-gray-300 hover:border-vital hover:text-vital transition"
          >
            Show more ({(rows.length - limit).toLocaleString()} remaining)
          </button>
        )}
        <p className="mt-3 text-xs text-gray-400">
          Conditions tracked: {conditions.join(' · ')}. Discharges sum only the conditions where CMS publishes counts;
          “—” means every count was suppressed.
        </p>
      </div>
    </Section>
  )
}

function HospitalDetail({ h, conditions }: { h: Hospital; conditions: string[] }) {
  // Scale: ERR 0.7 … 1.3 mapped to 0–100%, 1.0 in the middle.
  const x = (err: number) => Math.min(Math.max((err - 0.7) / 0.6, 0), 1) * 100
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_220px]">
      <ul className="space-y-1.5" aria-label={`ERR by condition for ${h.name}`}>
        {conditions.map((c) => {
          const v = h.measures[c]
          return (
            <li key={c} className="grid grid-cols-[130px_1fr_56px] items-center gap-3 text-xs">
              <span className="text-gray-300 truncate">{c}</span>
              <span className="relative h-3" aria-hidden>
                <span className="absolute inset-y-0 w-px bg-white/40" style={{ left: '50%' }} />
                {v != null && (
                  <span
                    className="absolute top-0 h-full rounded-sm"
                    style={{
                      left: `${Math.min(x(v), 50)}%`,
                      width: `${Math.abs(x(v) - 50)}%`,
                      background: v > 1 ? '#FB7185' : '#34D399',
                    }}
                  />
                )}
              </span>
              <span className={`num text-right ${v == null ? 'text-gray-400' : errColor(v)}`}>
                {v == null ? 'n/r' : v.toFixed(3)}
              </span>
            </li>
          )
        })}
      </ul>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-400 content-start">
        <dt>CCN</dt><dd className="num text-gray-200">{h.id}</dd>
        <dt>State</dt><dd className="text-gray-200">{stateName(h.state)}</dd>
        <dt>Ownership</dt><dd className="text-gray-200">{h.ownership ?? '—'}</dd>
        <dt>Star rating</dt><dd className="text-gray-200">{h.star_rating ?? 'Unrated'}</dd>
        <dt>Worse on</dt><dd className="text-gray-200">{h.n_worse} of {h.n_reported}</dd>
      </dl>
      <p className="md:col-span-2 text-[11px] text-gray-400">
        Bars show distance from the 1.0 benchmark (centre line), from 0.70 to 1.30. “n/r” = not reported (suppressed by CMS).
      </p>
    </div>
  )
}

function Select({
  id, label, value, onChange, options, className,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  options: [string, string][]
  className: string
}) {
  return (
    <div>
      <label htmlFor={id} className="sr-only">{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`w-full ${className}`}>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </div>
  )
}

function Th({
  label, k, sort, desc, onSort, className = '',
}: {
  label: string
  k: SortKey
  sort: SortKey
  desc: boolean
  onSort: (k: SortKey) => void
  className?: string
}) {
  const active = sort === k
  const Icon = !active ? ArrowUpDown : desc ? ArrowDown : ArrowUp
  return (
    <th
      scope="col"
      aria-sort={active ? (desc ? 'descending' : 'ascending') : 'none'}
      className={`py-2 px-3 font-medium ${className}`}
    >
      <button onClick={() => onSort(k)} className={`inline-flex items-center gap-1 hover:text-white ${active ? 'text-vital' : ''}`}>
        {label} <Icon size={12} aria-hidden />
      </button>
    </th>
  )
}

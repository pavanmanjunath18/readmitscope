import { useMemo, useState } from 'react'
import { Search, ArrowUpDown } from 'lucide-react'
import Section from './Section'
import Insight from './Insight'
import type { Hospital, ConditionStat } from '../types'

type SortKey = 'mean_err' | 'worst_err' | 'total_discharges' | 'n_worse'

const STATES = (h: Hospital[]) => Array.from(new Set(h.map((x) => x.state))).sort()

function errColor(err: number) {
  if (err > 1.05) return 'text-rose-400'
  if (err > 1.0) return 'text-rose-300'
  return 'text-emerald-400'
}

export default function HospitalExplorer({
  hospitals,
  byCondition,
}: {
  hospitals: Hospital[]
  byCondition: ConditionStat[]
}) {
  const [q, setQ] = useState('')
  const [state, setState] = useState('All')
  const [sort, setSort] = useState<SortKey>('mean_err')
  const [desc, setDesc] = useState(true)
  const [limit, setLimit] = useState(25)

  const conditions = byCondition.map((c) => c.label)

  // Worst / best single performers (>=3 reported conditions, matching the fair-ranking bar).
  const eligible = hospitals.filter((h) => h.n_reported >= 3)
  const worst = eligible.reduce((a, b) => (b.mean_err > a.mean_err ? b : a), eligible[0])
  const best = eligible.reduce((a, b) => (b.mean_err < a.mean_err ? b : a), eligible[0])
  const titleCase = (s: string) =>
    s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

  const rows = useMemo(() => {
    let r = hospitals
    if (q.trim()) {
      const t = q.toLowerCase()
      r = r.filter((h) => h.name.toLowerCase().includes(t) || h.state.toLowerCase().includes(t))
    }
    if (state !== 'All') r = r.filter((h) => h.state === state)
    r = [...r].sort((a, b) => (desc ? b[sort] - a[sort] : a[sort] - b[sort]))
    return r
  }, [hospitals, q, state, sort, desc])

  const toggleSort = (k: SortKey) => {
    if (k === sort) setDesc(!desc)
    else { setSort(k); setDesc(true) }
  }

  return (
    <Section
      label="Explore"
      title="Hospital explorer"
      blurb={`Search, filter and sort all ${hospitals.length.toLocaleString()} hospitals. Mean ERR averages a hospital's reported conditions; color flags whether it readmits more (rose) or fewer (teal) patients than expected.`}
    >
      <div className="glass rounded-2xl border border-white/10 p-5">
        {worst && best && (
          <Insight>
            <strong className="text-white">{titleCase(worst.name)} ({worst.state})</strong> is the nation's worst
            performer with a mean ERR of {worst.mean_err.toFixed(2)} — readmitting about {Math.round((worst.mean_err - 1) * 100)}%
            more than expected, worst on {worst.worst_condition}. At the other extreme, {titleCase(best.name)} ({best.state})
            runs ~{Math.round((1 - best.mean_err) * 100)}% below expected. Search any hospital below to see where it lands.
          </Insight>
        )}
        {/* controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setLimit(25) }}
              placeholder="Search hospital or state…"
              className="w-full rounded-lg border border-white/10 bg-clinical-800 pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:border-vital focus:outline-none"
            />
          </div>
          <select
            value={state}
            onChange={(e) => { setState(e.target.value); setLimit(25) }}
            className="rounded-lg border border-white/10 bg-clinical-800 px-3 py-2 text-sm text-white focus:border-vital focus:outline-none"
          >
            <option>All</option>
            {STATES(hospitals).map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        <p className="text-xs text-gray-500 mb-2">{rows.length.toLocaleString()} hospitals match</p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-white/10">
                <th className="py-2 pr-3 font-medium">Hospital</th>
                <th className="py-2 px-3 font-medium">State</th>
                <th className="py-2 px-3 font-medium hidden lg:table-cell">Rating</th>
                <th className="py-2 px-3 font-medium hidden lg:table-cell">Ownership</th>
                <Th label="Mean ERR" onClick={() => toggleSort('mean_err')} active={sort === 'mean_err'} />
                <Th label="Worst ERR" onClick={() => toggleSort('worst_err')} active={sort === 'worst_err'} />
                <th className="py-2 px-3 font-medium hidden md:table-cell">Worst condition</th>
                <Th label="# worse" onClick={() => toggleSort('n_worse')} active={sort === 'n_worse'} />
                <Th label="Discharges" onClick={() => toggleSort('total_discharges')} active={sort === 'total_discharges'} />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((h) => (
                <tr key={h.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="py-2.5 pr-3 text-gray-200 max-w-[260px] truncate" title={h.name}>{h.name}</td>
                  <td className="py-2.5 px-3 text-gray-400">{h.state}</td>
                  <td className="py-2.5 px-3 hidden lg:table-cell whitespace-nowrap">
                    {h.star_rating != null
                      ? <span className="text-vital-mint">{'★'.repeat(h.star_rating)}<span className="text-gray-700">{'★'.repeat(5 - h.star_rating)}</span></span>
                      : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-gray-400 hidden lg:table-cell whitespace-nowrap">{h.ownership ?? '—'}</td>
                  <td className={`py-2.5 px-3 font-semibold tabular-nums ${errColor(h.mean_err)}`}>{h.mean_err.toFixed(3)}</td>
                  <td className={`py-2.5 px-3 tabular-nums ${errColor(h.worst_err)}`}>{h.worst_err.toFixed(3)}</td>
                  <td className="py-2.5 px-3 text-gray-400 hidden md:table-cell">{h.worst_condition}</td>
                  <td className="py-2.5 px-3 text-gray-300 tabular-nums">{h.n_worse}/{h.n_reported}</td>
                  <td className="py-2.5 px-3 text-gray-300 tabular-nums">{h.total_discharges.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {limit < rows.length && (
          <button
            onClick={() => setLimit((l) => l + 25)}
            className="mt-4 w-full rounded-lg border border-white/10 py-2 text-sm text-gray-300 hover:border-vital hover:text-vital transition"
          >
            Show more ({(rows.length - limit).toLocaleString()} remaining)
          </button>
        )}
        <p className="mt-3 text-xs text-gray-600">Conditions tracked: {conditions.join(' · ')}</p>
      </div>
    </Section>
  )
}

function Th({ label, onClick, active }: { label: string; onClick: () => void; active: boolean }) {
  return (
    <th className="py-2 px-3 font-medium">
      <button onClick={onClick} className={`inline-flex items-center gap-1 hover:text-white ${active ? 'text-vital' : ''}`}>
        {label} <ArrowUpDown size={12} />
      </button>
    </th>
  )
}

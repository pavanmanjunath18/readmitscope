import { useEffect, useState } from 'react'
import type { ReadmitData } from './types'
import Hero from './components/Hero'
import StorySummary from './components/StorySummary'
import ScrollStory from './components/ScrollStory'
import KpiGrid from './components/KpiGrid'
import ConditionChart from './components/ConditionChart'
import ErrDistribution from './components/ErrDistribution'
import VolumeChart from './components/VolumeChart'
import StateRanking from './components/StateRanking'
import Enrichment from './components/Enrichment'
import HospitalExplorer from './components/HospitalExplorer'
import Methodology from './components/Methodology'
import Footer from './components/Footer'

export default function App() {
  const [data, setData] = useState<ReadmitData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}readmit_data.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(String(e)))
  }, [])

  if (error) {
    return (
      <div className="min-h-screen grid place-items-center text-center px-6">
        <div>
          <p className="text-vital font-semibold mb-2">Could not load data</p>
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-2 border-vital/30 border-t-vital animate-spin" />
          <p className="text-gray-400 text-sm">Loading CMS readmission data…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Hero meta={data.meta} kpis={data.kpis} />
      <main className="mx-auto max-w-7xl px-5 sm:px-8">
        <KpiGrid kpis={data.kpis} />
        <StorySummary kpis={data.kpis} enrichment={data.enrichment} />
        <div id="story">
          <ScrollStory data={data} />
        </div>
        <div id="conditions">
          <ConditionChart data={data.by_condition} />
        </div>
        <div id="distribution" className="grid lg:grid-cols-2 gap-6">
          <ErrDistribution data={data.err_histogram} kpis={data.kpis} />
          <VolumeChart data={data.volume_vs_err} />
        </div>
        <div id="states">
          <StateRanking data={data.by_state} />
        </div>
        <div id="enrichment">
          <Enrichment data={data.enrichment} />
        </div>
        <div id="explorer">
          <HospitalExplorer hospitals={data.hospitals} byCondition={data.by_condition} />
        </div>
        <div id="methodology">
          <Methodology meta={data.meta} kpis={data.kpis} />
        </div>
      </main>
      <Footer meta={data.meta} />
    </div>
  )
}

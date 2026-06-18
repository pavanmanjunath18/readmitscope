export interface Meta {
  title: string
  dataset_id: string
  reporting_period: string
  modified: string
  released: string
  retrieved_at_utc: string
  source: string
  enrichment_source: string
  enrichment_modified: string
}

export interface Kpis {
  n_hospitals: number
  n_states: number
  n_measures_reported: number
  n_measures_total: number
  national_mean_err: number
  national_median_err: number
  pct_worse_than_expected: number
  n_hospitals_any_worse: number
  pct_hospitals_any_worse: number
  total_discharges: number
  total_readmissions: number
}

export interface ConditionStat {
  code: string
  label: string
  full: string
  group: 'Medical' | 'Surgical'
  n: number
  mean_err: number
  median_err: number
  pct_worse: number
  total_discharges: number
  total_readmissions: number
}

export interface HistBin {
  bin_start: number
  bin_end: number
  count: number
}

export interface StateStat {
  state: string
  n_hospitals: number
  n_reported: number
  mean_err: number
  pct_worse: number
  total_discharges: number
  total_readmissions: number
}

export interface VolumeBin {
  bin: string
  n: number
  mean_err: number
  pct_worse: number
}

export interface Hospital {
  id: string
  name: string
  state: string
  mean_err: number
  n_reported: number
  n_worse: number
  total_discharges: number
  worst_condition: string
  worst_err: number
  ownership: string | null
  star_rating: number | null
  measures: Record<string, number>
}

export interface OwnershipStat {
  group: string
  n_hospitals: number
  n_measures: number
  mean_err: number
  median_err: number
  pct_worse: number
}

export interface RatingStat {
  rating: number
  n_hospitals: number
  n_measures: number
  mean_err: number
  median_err: number
  pct_worse: number
}

export interface Enrichment {
  matched_measures: number
  by_ownership: OwnershipStat[]
  by_rating: RatingStat[]
  by_hospital_type: { type: string; mean_err: number; pct_worse: number; n_hospitals: number }[]
}

export interface ReadmitData {
  meta: Meta
  kpis: Kpis
  by_condition: ConditionStat[]
  err_histogram: HistBin[]
  by_state: StateStat[]
  volume_vs_err: VolumeBin[]
  enrichment: Enrichment
  top_best: Hospital[]
  top_worst: Hospital[]
  hospitals: Hospital[]
}

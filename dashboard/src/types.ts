export interface Meta {
  title: string
  dataset_id: string
  release: string | null
  reporting_period: string
  modified: string
  released: string
  retrieved_at_utc: string
  generated_at_utc: string
  source: string
  enrichment_source: string
  enrichment_modified: string
  min_conditions_for_ranking: number
  min_hospitals_for_state_rank: number
}

export interface Kpis {
  n_hospitals_in_file: number
  /** Hospitals with at least one reported ERR. */
  n_hospitals: number
  n_states: number
  n_measures_reported: number
  n_measures_total: number
  n_measures_with_counts: number
  national_mean_err: number
  national_median_err: number
  pct_worse_than_expected: number
  pct_err_above_110: number
  pct_err_below_090: number
  n_hospitals_any_worse: number
  pct_hospitals_any_worse: number
  total_discharges: number
  total_readmissions: number
}

export interface Consistency {
  p_measure_worse: number
  min_conditions: number
  n_eligible: number
  n_all_worse: number
  pct_all_worse: number
  pct_all_worse_expected: number
  pct_all_better: number
  pct_all_better_expected: number
  pct_any_worse: number
  pct_any_worse_expected: number
  cross_condition_rho_median: number
  cross_condition_rho_min: number
  cross_condition_rho_max: number
}

export type Ci = [number, number]

export interface ConditionStat {
  code: string
  label: string
  full: string
  group: 'Medical' | 'Surgical'
  n: number
  mean_err: number
  median_err: number
  pct_worse: number
  pct_worse_ci: Ci
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
  /** Mean of hospital-level mean ERRs. */
  mean_err: number
  ci_low: number | null
  ci_high: number | null
  pct_worse: number
  eligible: boolean
  significant: 'above' | 'below' | null
  hrrp_exempt: boolean
}

export interface VolumeBin {
  bin: string
  n: number
  mean_err: number
  pct_worse: number
  pct_worse_ci: Ci
}

export interface TestResult {
  stat: number
  p: number
  n: number
}

export interface Coef {
  estimate: number
  ci_low: number
  ci_high: number
  p: number
}

export interface VolumeArtifact {
  suppression_floor: number
  naive_bins: VolumeBin[]
  naive_spearman: TestResult
  safe_spearman: TestResult
  n_published: number
  n_safe: number
  hidden: { n: number; mean_err: number; pct_worse: number }
  per_doubling: Coef & { n_obs: number; n_clusters: number }
}

export interface Hospital {
  id: string
  name: string
  state: string
  mean_err: number
  n_reported: number
  n_worse: number
  /** Null when CMS suppressed every discharge count for this hospital. */
  total_discharges: number | null
  worst_condition: string
  worst_err: number
  ownership: string | null
  star_rating: number | null
  measures: Record<string, number>
}

export interface GroupStat {
  n_hospitals: number
  n_measures: number
  mean_err: number
  median_err: number
  pct_worse: number
  pct_worse_ci: Ci
}

export interface OwnershipStat extends GroupStat {
  group: string
}

export interface RatingStat extends GroupStat {
  rating: number
}

export interface Enrichment {
  matched_measures: number
  match_rate_pct: number
  by_ownership: OwnershipStat[]
  by_rating: RatingStat[]
  by_hospital_type: (GroupStat & { type: string })[]
  tests: {
    ownership_kruskal: TestResult
    forprofit_vs_nonprofit: TestResult & { median_forprofit: number; median_nonprofit: number }
    rating_spearman: TestResult
  }
}

export interface ModelTerm extends Coef {
  group: 'Ownership' | 'Star rating'
  label: string
}

export interface Model {
  outcome: string
  references: { ownership: string; rating: string }
  controls: string[]
  n_obs: number
  n_clusters: number
  terms: ModelTerm[]
}

export interface ReadmitData {
  meta: Meta
  kpis: Kpis
  consistency: Consistency
  by_condition: ConditionStat[]
  err_histogram: HistBin[]
  by_state: StateStat[]
  volume_vs_err: VolumeBin[]
  volume_artifact: VolumeArtifact
  enrichment: Enrichment
  model: Model
  tests: { surgical_vs_medical: TestResult & { median_diff: number } }
  hospitals: Hospital[]
}

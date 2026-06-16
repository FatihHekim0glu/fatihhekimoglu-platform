import { z } from "zod"

import type { PlotlyFigure } from "@/components/PlotlyChart"

// ---------------------------------------------------------------------------
// Catalogues — must match the backend Literal types
// (api/routers/stock_clusters.StockClustersRequest).
// ---------------------------------------------------------------------------

export const CLUSTER_METHODS = ["hierarchical", "kmeans", "both"] as const
export type ClusterMethod = (typeof CLUSTER_METHODS)[number]

export const LINKAGE_METHODS = ["average", "ward", "single"] as const
export type Linkage = (typeof LINKAGE_METHODS)[number]

export const UNIVERSES = ["sp500_pit", "custom"] as const
export type Universe = (typeof UNIVERSES)[number]

export const DISTANCE_METHODS = ["mantegna"] as const
export type Distance = (typeof DISTANCE_METHODS)[number]

export const DEFAULT_TICKERS =
  "AAPL,MSFT,GOOG,AMZN,JPM,XOM,JNJ,PG,KO,WMT,V,UNH"

export const TICKER_LIST_RE = /^[A-Za-z0-9.\-,\s]+$/

// Sync-path caps mirrored from the backend cold-start budget.
export const K_SPAN_CAP = 12
export const GAP_B_CAP = 20

// ---------------------------------------------------------------------------
// Request schema — mirrors api/routers/stock_clusters.StockClustersRequest.
// `n_clusters` null ⇒ gap-statistic selection. `tickers` optional; only used
// when `universe === 'custom'`.
// ---------------------------------------------------------------------------

export const RunRequestSchema = z.object({
  tickers: z.string().min(1).optional(),
  universe: z.enum(UNIVERSES),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  method: z.enum(CLUSTER_METHODS),
  linkage: z.enum(LINKAGE_METHODS),
  n_clusters: z.number().int().min(2).nullable(),
  k_min: z.number().int().min(2),
  k_max: z.number().int().min(2).max(20),
  denoise: z.boolean(),
  distance: z.enum(DISTANCE_METHODS),
  run_diversification: z.boolean(),
  cost_bps: z.number().min(0),
  embargo_days: z.number().int().min(0),
  train_window: z.number().int().min(2),
  gap_B: z.number().int().min(1).max(GAP_B_CAP),
  seed: z.number().int().min(0).max(999_999),
})
export type RunRequest = z.infer<typeof RunRequestSchema>

// ---------------------------------------------------------------------------
// Response — mirrors StockClustersResponse.
// ---------------------------------------------------------------------------

/** Stable verdict identifiers emitted by stockclusters.evaluation.verdict. */
export type HeadlineVerdict =
  | "clusters_beat_1n"
  | "clusters_lose_to_1n"
  | "no_significant_difference"

export type Summary = {
  n_assets: number
  n_clusters_selected: number
  selection_method: string
  silhouette: number | null
  gap_k: number | null
  modularity: number | null
  ari_vs_gics: number | null
  stability_ari_mean: number | null
  survivorship_warning: boolean
  survivorship_caveat?: string | null
  data_source: string
}

export type ClusterEntry = {
  cluster_id: number
  tickers: string[]
  representative_ticker: string
  gics_dominant: string | null
}

export type Diversification = {
  one_over_n_sharpe: number | null
  cluster_ew_sharpe: number | null
  stripped_hrp_sharpe: number | null
  sharpe_diff_vs_1overN: number | null
  memmel_jk_pvalue: number | null
  deflated_sharpe: number | null
  n_trials: number
  cost_bps: number
  headline_verdict?: HeadlineVerdict | string
}

/** Diversification can be a full result, the literal "deferred", or null. */
export type DiversificationField = Diversification | "deferred" | null

export type RunResponse = {
  summary: Summary
  clusters: ClusterEntry[]
  diversification: DiversificationField
  heatmap_figure: PlotlyFigure
  dendrogram_figure: PlotlyFigure
  mst_figure: PlotlyFigure
  embedding_figure: PlotlyFigure
  equity_curve_figure: PlotlyFigure | null
  stability_figure: PlotlyFigure | null
  data_source: "polygon" | "yfinance" | "synthetic"
}

// ---------------------------------------------------------------------------
// Form state — string-typed numerics so the user can type freely.
// `auto_k` toggles between gap-statistic selection (n_clusters = null) and a
// fixed k pulled from `n_clusters`.
// ---------------------------------------------------------------------------

export type FormState = {
  tickers: string
  universe: Universe
  start: string
  end: string
  method: ClusterMethod
  linkage: Linkage
  auto_k: boolean
  n_clusters: string
  k_min: string
  k_max: string
  denoise: boolean
  run_diversification: boolean
  cost_bps: string
  embargo_days: string
  train_window: string
  gap_B: string
  seed: string
}

export type FieldErrors = Partial<
  Record<
    | "tickers"
    | "start"
    | "end"
    | "n_clusters"
    | "k_min"
    | "k_max"
    | "cost_bps"
    | "embargo_days"
    | "train_window"
    | "gap_B"
    | "seed",
    string
  >
>

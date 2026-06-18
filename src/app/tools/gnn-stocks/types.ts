import { z } from "zod"

import type { PlotlyFigure } from "@/components/PlotlyChart"

// ---------------------------------------------------------------------------
// Catalogues — must match the backend Literal types
// (api/routers/gnn_stocks.GnnStocksRequest).
//
// gnn-stocks builds a point-in-time stock-relationship graph from rolling
// return correlations and runs a dense-adjacency GCN / GraphSAGE against
// per-node ridge and cross-sectional-momentum baselines for next-period
// return RANKING. The deep GNNs are trained OFFLINE on a synthetic
// block-factor panel and served via ONNX; the naive + ridge baselines run
// live (torch-free).
// ---------------------------------------------------------------------------

export const GRAPH_TYPES = ["corr_knn", "sector", "none"] as const
export type GraphType = (typeof GRAPH_TYPES)[number]

export const GRAPH_TYPE_LABELS: Record<GraphType, string> = {
  corr_knn: "Correlation k-NN (per-fold)",
  sector: "Sector membership",
  none: "No edges (ablation)",
}

export const MODELS = ["naive", "ridge", "gcn", "graphsage"] as const
export type Model = (typeof MODELS)[number]

export const MODEL_LABELS: Record<Model, string> = {
  naive: "Cross-sectional momentum",
  ridge: "Cross-sectional ridge",
  gcn: "GCN (dense adjacency)",
  graphsage: "GraphSAGE (mean aggregator)",
}

// The GNNs (GCN / GraphSAGE) are the ONNX-served candidates; naive + ridge
// are the torch-free live baselines.
export const BASELINE_MODELS: Model[] = ["naive", "ridge"]
export const GNN_MODELS: Model[] = ["gcn", "graphsage"]

export const HORIZONS = [1, 5] as const
export type Horizon = (typeof HORIZONS)[number]

// No paid Polygon key wired into the deployed default, so 'synthetic' is the
// only data source that actually produces a run. 'auto' is offered for parity
// with the other tools but resolves to synthetic on the backend.
export const DATA_SOURCE_PREFS = ["synthetic", "auto"] as const
export type DataSourcePref = (typeof DATA_SOURCE_PREFS)[number]

export const N_ASSETS_MIN = 5
export const N_ASSETS_MAX = 120

// ---------------------------------------------------------------------------
// Request schema — mirrors api/routers/gnn_stocks.GnnStocksRequest.
// ---------------------------------------------------------------------------

export const RunRequestSchema = z.object({
  n_assets: z.number().int().min(N_ASSETS_MIN).max(N_ASSETS_MAX),
  graph_type: z.enum(GRAPH_TYPES),
  models: z.array(z.enum(MODELS)).min(1),
  lookback: z.number().int().min(5).max(252),
  horizon: z.union([z.literal(1), z.literal(5)]),
  data_source_pref: z.enum(DATA_SOURCE_PREFS),
  seed: z.number().int().min(0).max(999_999),
})
export type RunRequest = z.infer<typeof RunRequestSchema>

// ---------------------------------------------------------------------------
// Response — mirrors GnnStocksResponse.
//
// The honest-NULL discipline lives in `gnn_beats_baseline`: it is a PURE
// function of the inference on the backend (FALSE unless a GNN beats the best
// baseline with a Diebold-Mariano-significant margin on the rank-IC / return
// differential AND a Deflated Sharpe > 0 net of costs). The frontend only
// renders it — it never derives the verdict itself. No baseline-free R².
// ---------------------------------------------------------------------------

export type DataSource = "synthetic" | "polygon"

export type Summary = {
  ic_by_model: Record<string, number | null>
  ls_sharpe_by_model: Record<string, number | null>
  best_model: string
  dm_pvalue_vs_baseline: Record<string, number | null>
  deflated_sharpe: Record<string, number | null>
  gnn_beats_baseline: boolean
  n_effective_trials: number
  data_source: DataSource
}

export type RunResponse = {
  summary: Summary
  graph_figure: PlotlyFigure
  ic_figure: PlotlyFigure
  data_source: DataSource
}

// ---------------------------------------------------------------------------
// Form state — string-typed numerics so the user can type freely.
// ---------------------------------------------------------------------------

export type FormState = {
  n_assets: string
  graph_type: GraphType
  models: Model[]
  lookback: string
  horizon: Horizon
  data_source_pref: DataSourcePref
  seed: string
}

export type FieldErrors = Partial<
  Record<"n_assets" | "models" | "lookback" | "seed", string>
>

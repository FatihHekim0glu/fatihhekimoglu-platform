import { z } from "zod"

import type { PlotlyFigure } from "@/components/PlotlyChart"

// ---------------------------------------------------------------------------
// Catalogues — must match the backend Literal types
// (api/routers/volforecast.VolForecastRequest).
// ---------------------------------------------------------------------------

/** Forecast horizon in trading days (h-day-ahead realized volatility). */
export const HORIZONS = [1, 5, 22] as const
export type Horizon = (typeof HORIZONS)[number]

/** Model set the user can race against GARCH/HAR-RV out-of-sample. */
export const MODELS = [
  "garch",
  "egarch",
  "har_rv",
  "ewma",
  "xgboost",
  "rw",
] as const
export type Model = (typeof MODELS)[number]

/** Human-readable labels for each model identifier. */
export const MODEL_LABELS: Record<Model, string> = {
  garch: "GARCH(1,1)",
  egarch: "EGARCH",
  har_rv: "HAR-RV",
  ewma: "EWMA (λ=0.94)",
  xgboost: "XGBoost",
  rw: "Random walk",
}

export const DEFAULT_MODELS: Model[] = [
  "garch",
  "har_rv",
  "ewma",
  "xgboost",
  "rw",
]

export const DATA_SOURCE_PREFS = ["auto", "polygon", "synthetic"] as const
export type DataSourcePref = (typeof DATA_SOURCE_PREFS)[number]

export const DEFAULT_TICKER = "SPY"

export const TICKER_RE = /^[A-Za-z][A-Za-z0-9.\-]*$/

// ---------------------------------------------------------------------------
// Request schema — mirrors api/routers/volforecast.VolForecastRequest.
// ---------------------------------------------------------------------------

export const RunRequestSchema = z.object({
  ticker: z.string().min(1),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  horizon: z.union([z.literal(1), z.literal(5), z.literal(22)]),
  models: z.array(z.enum(MODELS)).min(1),
  cost_bps: z.number().min(0),
  data_source_pref: z.enum(DATA_SOURCE_PREFS),
  seed: z.number().int().min(0).max(999_999),
})
export type RunRequest = z.infer<typeof RunRequestSchema>

// ---------------------------------------------------------------------------
// Response — mirrors VolForecastResponse.
// ---------------------------------------------------------------------------

export type Summary = {
  /** Out-of-sample QLIKE per model (lower is better). */
  qlike_by_model: Record<string, number | null>
  /** Out-of-sample MSE on RV per model. */
  mse_by_model: Record<string, number | null>
  /** Model with the lowest OOS QLIKE. */
  best_model: string
  /** Diebold-Mariano p-values of each model vs the best model. */
  dm_pvalues: Record<string, number | null>
  /** Hansen-SPA p-value across the whole model set (snooping control). */
  spa_pvalue: number | null
  /**
   * Pure function of OOS QLIKE + SPA/DM significance: true only if ML beats
   * GARCH/HAR-RV with a significant margin. The honest null says this is false.
   */
  ml_beats_garch: boolean
  /** Effective number of model configurations evaluated (snooping breadth). */
  n_effective_trials: number
  /** Whether OHLC came from Polygon or the synthetic GARCH generator. */
  data_source: "polygon" | "synthetic"
}

export type RunResponse = {
  summary: Summary
  /** Realized volatility actual vs each model's forecast. */
  forecast_figure: PlotlyFigure
  /** QLIKE-by-model bar chart. */
  error_figure: PlotlyFigure
}

// ---------------------------------------------------------------------------
// Form state — string-typed numerics so the user can type freely.
// ---------------------------------------------------------------------------

export type FormState = {
  ticker: string
  start: string
  end: string
  horizon: Horizon
  models: Model[]
  cost_bps: string
  data_source_pref: DataSourcePref
  seed: string
}

export type FieldErrors = Partial<
  Record<"ticker" | "start" | "end" | "models" | "cost_bps" | "seed", string>
>

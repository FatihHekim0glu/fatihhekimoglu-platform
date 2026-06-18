import { z } from "zod"

import type { PlotlyFigure } from "@/components/PlotlyChart"

// ---------------------------------------------------------------------------
// Catalogues — must match the backend Literal types
// (api/routers/mvts_forecast.MvtsForecastRequest).
// ---------------------------------------------------------------------------

// The shipped default basket. The deep models are trained OFFLINE on a
// synthetic correlated-returns panel and served via ONNX; the naive + ARIMA
// baselines run live (torch-free). The basket below mirrors the backend
// default ["SPY","TLT","GLD"].
export const BASKET_UNIVERSE = [
  "SPY",
  "TLT",
  "GLD",
  "QQQ",
  "IWM",
  "EEM",
  "HYG",
  "LQD",
] as const
export type BasketSymbol = (typeof BASKET_UNIVERSE)[number]

export const DEFAULT_BASKET: BasketSymbol[] = ["SPY", "TLT", "GLD"]

export const MODELS = [
  "naive",
  "arima",
  "lstm",
  "patchtst",
  "transformer",
] as const
export type Model = (typeof MODELS)[number]

export const MODEL_LABELS: Record<Model, string> = {
  naive: "Naive (random walk)",
  arima: "ARIMA",
  lstm: "LSTM",
  patchtst: "PatchTST",
  transformer: "Interpretable transformer",
}

// The deep models (LSTM / PatchTST / interpretable transformer) are the ONNX
// served candidates; naive + ARIMA are the torch-free live baselines.
export const DEEP_MODELS: Model[] = ["lstm", "patchtst", "transformer"]

export const HORIZONS = [1, 5] as const
export type Horizon = (typeof HORIZONS)[number]

// No real market / FRED data and no API keys here, so 'synthetic' is the only
// data source that actually produces a run. 'auto' is offered for parity with
// the other tools but resolves to synthetic on the backend.
export const DATA_SOURCE_PREFS = ["synthetic", "auto"] as const
export type DataSourcePref = (typeof DATA_SOURCE_PREFS)[number]

export const DEFAULT_TARGET: BasketSymbol = "SPY"

export const TICKER_RE = /^[A-Za-z0-9.\-]+$/

// ---------------------------------------------------------------------------
// Request schema — mirrors api/routers/mvts_forecast.MvtsForecastRequest.
// ---------------------------------------------------------------------------

export const RunRequestSchema = z.object({
  basket: z.array(z.string().regex(TICKER_RE)).min(2),
  target: z.string().regex(TICKER_RE),
  horizon: z.union([z.literal(1), z.literal(5)]),
  models: z.array(z.enum(MODELS)).min(1),
  lookback: z.number().int().min(2).max(512),
  data_source_pref: z.enum(DATA_SOURCE_PREFS),
  seed: z.number().int().min(0).max(999_999),
})
export type RunRequest = z.infer<typeof RunRequestSchema>

// ---------------------------------------------------------------------------
// Response — mirrors MvtsForecastResponse.
//
// The honest-NULL discipline lives in `deep_beats_naive`: it is a PURE function
// of the inference on the backend (FALSE unless a deep model beats naive with a
// Diebold-Mariano-significant margin AND a Deflated Sharpe > 0). The frontend
// only renders it — it never derives the verdict itself. No price-level R².
// ---------------------------------------------------------------------------

export type DataSource = "synthetic" | "yfinance"

export type Summary = {
  rmse_by_model: Record<string, number | null>
  directional_acc_by_model: Record<string, number | null>
  best_model: string
  dm_pvalue_vs_naive: Record<string, number | null>
  deflated_sharpe: Record<string, number | null>
  deep_beats_naive: boolean
  n_effective_trials: number
  data_source: DataSource
}

export type RunResponse = {
  summary: Summary
  forecast_figure: PlotlyFigure
  error_figure: PlotlyFigure
  data_source: DataSource
}

// ---------------------------------------------------------------------------
// Form state — string-typed numerics so the user can type freely.
// ---------------------------------------------------------------------------

export type FormState = {
  basket: BasketSymbol[]
  target: BasketSymbol
  horizon: Horizon
  models: Model[]
  lookback: string
  data_source_pref: DataSourcePref
  seed: string
}

export type FieldErrors = Partial<
  Record<"basket" | "target" | "models" | "lookback" | "seed", string>
>

import { z } from "zod"

import type { PlotlyFigure } from "@/components/PlotlyChart"

// ---------------------------------------------------------------------------
// Catalogues — must match the backend Literal types
// (api/routers/lstm_forecast.LstmForecastRequest).
// ---------------------------------------------------------------------------

// No real market data / no API keys here, so 'synthetic' is the only data
// source that actually produces a model run. 'auto' is offered for parity with
// the other tools but resolves to synthetic on the backend.
export const DATA_SOURCE_PREFS = ["synthetic", "auto"] as const
export type DataSourcePref = (typeof DATA_SOURCE_PREFS)[number]

export const DEFAULT_TICKER = "SPY"

export const TICKER_RE = /^[A-Za-z0-9.\-]+$/

// ---------------------------------------------------------------------------
// Request schema — mirrors api/routers/lstm_forecast.LstmForecastRequest.
// ---------------------------------------------------------------------------

export const RunRequestSchema = z.object({
  ticker: z.string().min(1).regex(TICKER_RE),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lookback: z.number().int().min(2).max(512),
  horizon: z.number().int().min(1).max(30),
  data_source_pref: z.enum(DATA_SOURCE_PREFS),
  seed: z.number().int().min(0).max(999_999),
})
export type RunRequest = z.infer<typeof RunRequestSchema>

// ---------------------------------------------------------------------------
// Response — mirrors LstmForecastResponse.
//
// The honest-NULL discipline lives in `beats_naive`: it is a PURE function of
// the inference on the backend (FALSE unless MASE < 1 AND Diebold-Mariano is
// significant AND directional accuracy is robustly > 0.5). The frontend only
// renders it — it never derives the verdict itself.
// ---------------------------------------------------------------------------

export type Summary = {
  rmse_return: number | null
  mae_return: number | null
  mase_vs_persistence: number | null
  directional_accuracy: number | null
  dm_pvalue: number | null
  beats_naive: boolean
  n_effective_trials: number
  data_source: "synthetic" | "polygon" | "yfinance"
}

export type RunResponse = {
  summary: Summary
  forecast_figure: PlotlyFigure
  error_vs_baseline_figure: PlotlyFigure
  data_source: "synthetic" | "polygon" | "yfinance"
}

// ---------------------------------------------------------------------------
// Form state — string-typed numerics so the user can type freely.
// ---------------------------------------------------------------------------

export type FormState = {
  ticker: string
  start: string
  end: string
  lookback: string
  horizon: string
  data_source_pref: DataSourcePref
  seed: string
}

export type FieldErrors = Partial<
  Record<"ticker" | "start" | "end" | "lookback" | "horizon" | "seed", string>
>

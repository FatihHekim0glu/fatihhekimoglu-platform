import { z } from "zod"

import type { PlotlyFigure } from "@/components/PlotlyChart"

// ---------------------------------------------------------------------------
// Catalogues — must match the backend Literal types.
// ---------------------------------------------------------------------------

export const COV_METHODS = ["Sample", "LedoitWolf"] as const
export type CovMethod = (typeof COV_METHODS)[number]

export const MEAN_METHODS = ["Sample", "JorionBayesStein", "CAPM"] as const
export type MeanMethod = (typeof MEAN_METHODS)[number]

export const DEFAULT_TICKERS =
  "AAPL,MSFT,GOOG,AMZN,JPM,XOM,JNJ,PG,KO,WMT"

export const TICKER_LIST_RE = /^[A-Za-z0-9.\-,\s]+$/

// ---------------------------------------------------------------------------
// Request schema — mirrors api/routers/markowitz_optimizer.MarkowitzRequest.
// ---------------------------------------------------------------------------

export const RunRequestSchema = z.object({
  tickers: z.string().min(1),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cov_method: z.enum(COV_METHODS),
  mean_method: z.enum(MEAN_METHODS),
  long_only: z.boolean(),
  max_weight: z.number().min(0.05).max(1),
  risk_free_rate: z.number().min(-0.05).max(0.25),
  use_real_data: z.boolean(),
  seed: z.number().int().min(0).max(999_999),
})
export type RunRequest = z.infer<typeof RunRequestSchema>

// ---------------------------------------------------------------------------
// Response — mirrors MarkowitzResponse.
// ---------------------------------------------------------------------------

export type FrontierPoint = {
  volatility: number
  expected_return: number
  label: string | null
}

export type Summary = {
  expected_return: number
  volatility: number
  sharpe: number | null
  n_assets: number
}

export type RunResponse = {
  frontier: FrontierPoint[]
  weights: Record<string, number>
  summary: Summary
  frontier_figure: PlotlyFigure
  weights_figure: PlotlyFigure
  data_source: "polygon" | "yfinance" | "cache" | "synthetic"
}

// ---------------------------------------------------------------------------
// Form state — string-typed numerics so the user can type freely.
// ---------------------------------------------------------------------------

export type FormState = {
  tickers: string
  start: string
  end: string
  cov_method: CovMethod
  mean_method: MeanMethod
  long_only: boolean
  max_weight: number
  risk_free_rate: string
  use_real_data: boolean
  seed: string
}

export type FieldErrors = Partial<
  Record<
    | "tickers"
    | "start"
    | "end"
    | "max_weight"
    | "risk_free_rate"
    | "seed",
    string
  >
>

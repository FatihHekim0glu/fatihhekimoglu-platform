import { z } from "zod"

import type { PlotlyFigure } from "@/components/PlotlyChart"

// ---------------------------------------------------------------------------
// Catalogues — must match the backend Literal types
// (api/routers/wsb_sentiment.WsbSentimentRequest).
// ---------------------------------------------------------------------------

export const DATA_SOURCE_PREFS = ["auto", "synthetic"] as const
export type DataSourcePref = (typeof DATA_SOURCE_PREFS)[number]

export const DEFAULT_TICKERS = "GME,AMC,TSLA,AAPL,NVDA"

export const TICKER_LIST_RE = /^[A-Za-z0-9.\-,\s]+$/

// ---------------------------------------------------------------------------
// Request schema — mirrors api/routers/wsb_sentiment.WsbSentimentRequest.
// ---------------------------------------------------------------------------

export const RunRequestSchema = z.object({
  tickers: z.string().min(1),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  window: z.number().int().min(1).max(60),
  lag: z.number().int().min(1).max(10),
  threshold: z.number().min(-1).max(1),
  cost_bps: z.number().min(0).max(500),
  data_source_pref: z.enum(DATA_SOURCE_PREFS),
  seed: z.number().int().min(0).max(999_999),
})
export type RunRequest = z.infer<typeof RunRequestSchema>

// ---------------------------------------------------------------------------
// Response — mirrors WsbSentimentResponse.
//
// The honest verdict `signal_has_edge` is a PURE function of the inference
// (OOS net Sharpe + DSR + PBO + HAC significance net of costs) computed on the
// backend. The frontend only renders it.
// ---------------------------------------------------------------------------

export type Summary = {
  net_sharpe: number | null
  buyhold_sharpe: number | null
  deflated_sharpe: number | null
  psr: number | null
  pbo: number | null
  hac_tstat: number | null
  hac_pvalue: number | null
  turnover: number | null
  n_effective_trials: number
  signal_has_edge: boolean
  data_source: "cache" | "synthetic" | "polygon"
}

export type RunResponse = {
  summary: Summary
  equity_figure: PlotlyFigure
  sentiment_figure: PlotlyFigure
  data_source: "cache" | "synthetic" | "polygon"
}

// ---------------------------------------------------------------------------
// Form state — string-typed numerics so the user can type freely.
// ---------------------------------------------------------------------------

export type FormState = {
  tickers: string
  start: string
  end: string
  window: string
  lag: string
  threshold: string
  cost_bps: string
  data_source_pref: DataSourcePref
  seed: string
}

export type FieldErrors = Partial<
  Record<
    | "tickers"
    | "start"
    | "end"
    | "window"
    | "lag"
    | "threshold"
    | "cost_bps"
    | "seed",
    string
  >
>

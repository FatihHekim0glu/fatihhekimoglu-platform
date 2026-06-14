import { z } from "zod"

import type { PlotlyFigure } from "@/components/PlotlyChart"

// ---------------------------------------------------------------------------
// Catalogues — must match the backend Literal types
// (api/routers/hrp_portfolio.HRPRequest).
// ---------------------------------------------------------------------------

export const LINKAGE_METHODS = [
  "single",
  "ward",
  "complete",
  "average",
] as const
export type Linkage = (typeof LINKAGE_METHODS)[number]

export const COVARIANCE_METHODS = ["sample", "ledoit_wolf", "oas"] as const
export type Covariance = (typeof COVARIANCE_METHODS)[number]

export const REBALANCE_FREQUENCIES = ["monthly", "quarterly"] as const
export type Rebalance = (typeof REBALANCE_FREQUENCIES)[number]

export const DATA_SOURCE_PREFS = [
  "polygon",
  "yfinance",
  "synthetic",
  "auto",
] as const
export type DataSourcePref = (typeof DATA_SOURCE_PREFS)[number]

export const DEFAULT_TICKERS =
  "AAPL,MSFT,GOOG,AMZN,JPM,XOM,JNJ,PG,KO,WMT,V,UNH"

export const TICKER_LIST_RE = /^[A-Za-z0-9.\-,\s]+$/

// ---------------------------------------------------------------------------
// Request schema — mirrors api/routers/hrp_portfolio.HRPRequest.
// ---------------------------------------------------------------------------

export const RunRequestSchema = z.object({
  tickers: z.string().min(1),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  linkage: z.enum(LINKAGE_METHODS),
  covariance: z.enum(COVARIANCE_METHODS),
  rmt_denoise: z.boolean(),
  rebalance: z.enum(REBALANCE_FREQUENCIES),
  cost_bps: z.number().min(0),
  lookback_window: z.number().int().min(2),
  n_bootstrap: z.number().int().min(1).max(5_000),
  data_source_pref: z.enum(DATA_SOURCE_PREFS),
  seed: z.number().int().min(0).max(999_999),
})
export type RunRequest = z.infer<typeof RunRequestSchema>

// ---------------------------------------------------------------------------
// Response — mirrors HRPResponse.
// ---------------------------------------------------------------------------

/** Stable verdict identifiers emitted by hrp.evaluation.verdict.Verdict. */
export type HeadlineVerdict =
  | "hrp_beats_1n"
  | "hrp_loses_to_1n"
  | "no_significant_difference"

export type Summary = {
  hrp_oos_sharpe: number | null
  naive_1n_oos_sharpe: number | null
  ivp_oos_sharpe: number | null
  hrp_oos_vol: number | null
  naive_1n_oos_vol: number | null
  sharpe_gap_hrp_vs_1n: number | null
  jkm_pvalue: number | null
  deflated_sharpe: number | null
  ci_low: number | null
  ci_high: number | null
  n_effective_trials: number
  hrp_turnover: number | null
  naive_1n_turnover: number | null
  n_assets: number
  n_rebalances: number
  headline_verdict: HeadlineVerdict | string
}

export type RunResponse = {
  summary: Summary
  dendrogram_figure: PlotlyFigure
  quasidiag_heatmap_figure: PlotlyFigure
  weights_figure: PlotlyFigure
  oos_equity_figure: PlotlyFigure
  sharpe_gap_bootstrap_figure: PlotlyFigure
  data_source: "polygon" | "yfinance" | "synthetic"
}

// ---------------------------------------------------------------------------
// Form state — string-typed numerics so the user can type freely.
// ---------------------------------------------------------------------------

export type FormState = {
  tickers: string
  start: string
  end: string
  linkage: Linkage
  covariance: Covariance
  rmt_denoise: boolean
  rebalance: Rebalance
  cost_bps: string
  lookback_window: string
  n_bootstrap: string
  data_source_pref: DataSourcePref
  seed: string
}

export type FieldErrors = Partial<
  Record<
    | "tickers"
    | "start"
    | "end"
    | "cost_bps"
    | "lookback_window"
    | "n_bootstrap"
    | "seed",
    string
  >
>

import { z } from "zod"

import type { PlotlyFigure } from "@/components/PlotlyChart"

// ---------------------------------------------------------------------------
// Ticker shape mirrors the backend regex (data.py / router validator).
// ---------------------------------------------------------------------------

export const TICKER_RE = /^[A-Z0-9.\-^]{1,15}$/

// ---------------------------------------------------------------------------
// Input schema (zod) mirrors the recon and backend Pydantic model.
// ---------------------------------------------------------------------------

export const INPUT_SCHEMA = z.object({
  ticker: z.string().regex(TICKER_RE),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fast_window: z.number().int().min(5).max(100),
  slow_window: z.number().int().min(20).max(300),
  cost_bps: z.number().min(0).max(50),
})
export type RunRequest = z.infer<typeof INPUT_SCHEMA>

// ---------------------------------------------------------------------------
// Response types match the FastAPI Pydantic models.
// ---------------------------------------------------------------------------

export type MetricsRow = {
  name: string
  strategy: number | null
  buy_and_hold: number | null
  delta: number | null
}

export type BenchmarkStats = {
  alpha_annual: number | null
  alpha_t_stat: number | null
  alpha_p_value: number | null
  beta: number | null
  beta_se: number | null
  information_ratio: number | null
  tracking_error_annual: number | null
  active_return_annual: number | null
  sharpe_diff: number | null
  sharpe_diff_p_value: number | null
  n_observations: number
  hac_lags: number
}

export type Summary = {
  ticker: string
  start: string
  end: string
  trading_days: number
  fast_window: number
  slow_window: number
  cost_bps: number
  n_trades: number
}

export type DataSource = "polygon" | "yfinance" | "cache"

export type RunResponse = {
  summary: Summary
  metrics: MetricsRow[]
  benchmark: BenchmarkStats
  equity_curve: PlotlyFigure
  underwater_drawdown: PlotlyFigure
  data_source: DataSource
}

// ---------------------------------------------------------------------------
// Client-side form state (strings for inputs, coerced on submit).
// ---------------------------------------------------------------------------

export type FormState = {
  ticker: string
  start_date: string
  end_date: string
  fast_window: string
  slow_window: string
  cost_bps: string
}

export type FieldErrors = Partial<
  Record<
    | "ticker"
    | "start_date"
    | "end_date"
    | "fast_window"
    | "slow_window"
    | "cost_bps",
    string
  >
>

export const DEFAULT_FORM: FormState = {
  ticker: "SPY",
  start_date: "2010-01-01",
  end_date: "2024-12-31",
  fast_window: "50",
  slow_window: "200",
  cost_bps: "5",
}

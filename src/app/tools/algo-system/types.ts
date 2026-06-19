import { z } from "zod"

import type { PlotlyFigure } from "@/components/PlotlyChart"

// ---------------------------------------------------------------------------
// Catalogues — must match the backend Literal types
// (api/routers/algo_system.AlgoSystemRequest).
//
// algo-system is a TORCH-FREE integration capstone: a complete, leakage-free
// single-asset trading pipeline — a strictly-causal signal (MA-crossover /
// momentum) → a purged walk-forward, no-lookahead vectorized backtest → a
// SIMULATED bar-by-bar paper-broker execution engine (next-bar-open fills +
// costs + slippage) → the LOAD-BEARING backtest↔live PARITY ORACLE (the
// vectorized backtest equity curve must equal the paper-broker equity curve to
// 1e-10) and a bar-finality guard (a forming bar can never trigger an order) →
// an HONEST out-of-sample verdict net of costs (Diebold-Mariano vs buy-and-hold,
// a Deflated-Sharpe correction with the honest #signals × #param-config
// multiplicity, and a Probability-of-Backtest-Overfitting / CSCV check).
//
// The honest deliverable is the rigorous, leakage-free integration and the
// backtest↔live parity — NOT a profit claim. The strategy itself shows NO robust
// out-of-sample edge after costs (system_has_edge=False by construction on the
// synthetic honest-null bars).
// ---------------------------------------------------------------------------

export const SIGNALS = ["ma_crossover", "momentum"] as const
export type SignalName = (typeof SIGNALS)[number]

// 'synthetic' is the request default (the seeded honest-null bars). 'auto'
// routes to the offline PIT loader, which fetches Polygon bars lazily and
// degrades to synthetic when a key / network is absent — so the endpoint is
// always offline-safe.
export const DATA_SOURCE_PREFS = ["synthetic", "auto"] as const
export type DataSourcePref = (typeof DATA_SOURCE_PREFS)[number]

// Window + friction caps mirror the backend wire bounds
// (_MAX_WINDOW / _MAX_COST_BPS / _MAX_SLIPPAGE_BPS).
export const WINDOW_MIN = 1
export const WINDOW_MAX = 500

export const SLOW_MIN = 2

export const COST_BPS_MIN = 0
export const COST_BPS_MAX = 1_000

export const SLIPPAGE_BPS_MIN = 0
export const SLIPPAGE_BPS_MAX = 1_000

export const SEED_MIN = 0
export const SEED_MAX = 999_999

// ---------------------------------------------------------------------------
// Request schema — mirrors api/routers/algo_system.AlgoSystemRequest.
// `fast` must be strictly less than `slow` for the MA-crossover signal.
// ---------------------------------------------------------------------------

export const RunRequestSchema = z
  .object({
    signal: z.enum(SIGNALS),
    fast: z.number().int().min(WINDOW_MIN).max(WINDOW_MAX),
    slow: z.number().int().min(SLOW_MIN).max(WINDOW_MAX),
    lookback: z.number().int().min(WINDOW_MIN).max(WINDOW_MAX),
    cost_bps: z.number().min(COST_BPS_MIN).max(COST_BPS_MAX),
    slippage_bps: z.number().min(SLIPPAGE_BPS_MIN).max(SLIPPAGE_BPS_MAX),
    data_source_pref: z.enum(DATA_SOURCE_PREFS),
    seed: z.number().int().min(SEED_MIN).max(SEED_MAX),
  })
  .refine((v) => v.slow > v.fast, {
    message: "slow must be strictly greater than fast",
    path: ["slow"],
  })
export type RunRequest = z.infer<typeof RunRequestSchema>

// ---------------------------------------------------------------------------
// Response — mirrors AlgoSystemResponse.
//
// The honest-NULL discipline lives in `system_has_edge`: it is a PURE function
// of the backend evaluation (FALSE unless the OOS Sharpe beats buy-hold with a
// Diebold-Mariano-significant margin AND the Deflated Sharpe clears the 1-alpha
// CONFIDENCE level — it is a probability, NOT merely > 0 — AND PBO < 0.5, all
// net of costs). The frontend ONLY renders it — it NEVER derives the verdict or
// the parity itself. Both the verdict and the parity indicator are read purely
// from the backend response.
// ---------------------------------------------------------------------------

export type DataSource = "synthetic" | "polygon"

export type Summary = {
  oos_sharpe: number | null
  buyhold_sharpe: number | null
  dm_pvalue_vs_buyhold: number | null
  deflated_sharpe: number | null
  pbo: number | null
  backtest_live_parity_max_diff: number | null
  bar_finality_ok: boolean
  turnover: number | null
  max_drawdown: number | null
  system_has_edge: boolean
  n_effective_trials: number
  data_source: DataSource
}

export type RunResponse = {
  summary: Summary
  equity_figure: PlotlyFigure
  drawdown_figure: PlotlyFigure
  data_source: DataSource
}

// ---------------------------------------------------------------------------
// Form state — string-typed numerics so the user can type freely.
// ---------------------------------------------------------------------------

export type FormState = {
  signal: SignalName
  fast: string
  slow: string
  lookback: string
  cost_bps: string
  slippage_bps: string
  data_source_pref: DataSourcePref
  seed: string
}

export type FieldErrors = Partial<
  Record<
    "fast" | "slow" | "lookback" | "cost_bps" | "slippage_bps" | "seed",
    string
  >
>

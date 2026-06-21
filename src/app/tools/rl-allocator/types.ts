import { z } from "zod"

import type { PlotlyFigure } from "@/components/PlotlyChart"

// ---------------------------------------------------------------------------
// Catalogues — must match the backend Literal types
// (api/routers/rl_allocator.RlAllocatorRequest).
//
// rl-allocator trains a PPO agent to allocate across a MULTI-ASSET basket — a
// simplex of portfolio weights — in a cost-aware portfolio environment
// (turnover costs, strictly causal: weights set at bar t earn the t→t+1
// portfolio return, obs at t uses only data ≤ t), evaluated OUT-OF-SAMPLE
// inside a purged walk-forward against equal-weight 1/N, Markowitz mean-variance
// and risk-parity baselines. The PPO policy is trained OFFLINE across N seeds and
// served as an ONNX policy (obs → weight logits → softmax simplex); the baselines
// run live (pure numpy, train-only covariance, torch-free). The honest deliverable
// is the seed-lottery + DSR + PBO stack: across training seeds the agent does NOT
// reliably beat the best of {1/N, Markowitz, risk-parity} net of costs.
// ---------------------------------------------------------------------------

// No paid EODHD key wired into the deployed default, so 'synthetic' is the only
// data source that actually produces a run. 'auto' is offered for parity with
// the other tools but resolves to synthetic on the backend.
export const DATA_SOURCE_PREFS = ["synthetic", "auto"] as const
export type DataSourcePref = (typeof DATA_SOURCE_PREFS)[number]

export const REBALANCE_FREQS = ["daily", "weekly", "monthly"] as const
export type RebalanceFreq = (typeof REBALANCE_FREQS)[number]

export const N_ASSETS_MIN = 2
export const N_ASSETS_MAX = 20

export const N_SEEDS_MIN = 1
export const N_SEEDS_MAX = 16

export const COST_BPS_MIN = 0
export const COST_BPS_MAX = 100

export const LOOKBACK_MIN = 4
export const LOOKBACK_MAX = 128

export const SEED_MIN = 0
export const SEED_MAX = 999_999

// ---------------------------------------------------------------------------
// Request schema — mirrors api/routers/rl_allocator.RlAllocatorRequest.
// ---------------------------------------------------------------------------

export const RunRequestSchema = z.object({
  n_assets: z.number().int().min(N_ASSETS_MIN).max(N_ASSETS_MAX),
  n_seeds: z.number().int().min(N_SEEDS_MIN).max(N_SEEDS_MAX),
  cost_bps: z.number().min(COST_BPS_MIN).max(COST_BPS_MAX),
  lookback: z.number().int().min(LOOKBACK_MIN).max(LOOKBACK_MAX),
  rebalance: z.enum(REBALANCE_FREQS),
  data_source_pref: z.enum(DATA_SOURCE_PREFS),
  seed: z.number().int().min(SEED_MIN).max(SEED_MAX),
})
export type RunRequest = z.infer<typeof RunRequestSchema>

// ---------------------------------------------------------------------------
// Response — mirrors RlAllocatorResponse.
//
// The honest-NULL discipline lives in `rl_beats_baselines`: it is a PURE
// function of the backend evaluation (FALSE unless the MEDIAN-seed OOS Sharpe
// beats the BEST of {1/N, Markowitz, risk-parity} with a Diebold-Mariano-
// significant margin AND the Deflated Sharpe exceeds the 1-alpha CONFIDENCE
// level AND the across-seed Sharpe lower bound is > 0 AND PBO < 0.5, all net of
// costs). The frontend only renders it — it NEVER derives the verdict itself.
// No single-seed equity curve is shown as if it were "the result".
// ---------------------------------------------------------------------------

export type DataSource = "synthetic" | "eodhd" | "polygon"

export type Summary = {
  oos_sharpe_rl_median: number | null
  oos_sharpe_1n: number | null
  oos_sharpe_markowitz: number | null
  oos_sharpe_riskparity: number | null
  best_baseline: string
  seed_sharpe_lo: number | null
  seed_sharpe_hi: number | null
  dm_pvalue_vs_best: number | null
  deflated_sharpe: number | null
  pbo: number | null
  turnover: number | null
  max_drawdown: number | null
  rl_beats_baselines: boolean
  n_effective_trials: number
  data_source: DataSource
}

export type RunResponse = {
  summary: Summary
  equity_figure: PlotlyFigure
  weights_figure: PlotlyFigure
  data_source: DataSource
}

// ---------------------------------------------------------------------------
// Form state — string-typed numerics so the user can type freely.
// ---------------------------------------------------------------------------

export type FormState = {
  n_assets: string
  n_seeds: string
  cost_bps: string
  lookback: string
  rebalance: RebalanceFreq
  data_source_pref: DataSourcePref
  seed: string
}

export type FieldErrors = Partial<
  Record<"n_assets" | "n_seeds" | "cost_bps" | "lookback" | "seed", string>
>

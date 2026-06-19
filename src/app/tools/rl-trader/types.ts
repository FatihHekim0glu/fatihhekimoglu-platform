import { z } from "zod"

import type { PlotlyFigure } from "@/components/PlotlyChart"

// ---------------------------------------------------------------------------
// Catalogues — must match the backend Literal types
// (api/routers/rl_trader.RlTraderRequest).
//
// rl-trader trains a PPO agent in a realistic single-asset trading environment
// (transaction costs + slippage + position limits, strictly causal next-bar
// reward) and evaluates it OUT-OF-SAMPLE inside a purged walk-forward, against
// buy-and-hold / flat-cash / random baselines. The PPO policy is trained
// OFFLINE across N seeds and served as an ONNX MLP; the baselines run live
// (pure numpy, torch-free). The honest deliverable is the seed-lottery + the
// Deflated-Sharpe correction: across training seeds the agent does NOT reliably
// beat buy-and-hold net of costs.
// ---------------------------------------------------------------------------

// No paid Polygon key wired into the deployed default, so 'synthetic' is the
// only data source that actually produces a run. 'auto' is offered for parity
// with the other tools but resolves to synthetic on the backend.
export const DATA_SOURCE_PREFS = ["synthetic", "auto"] as const
export type DataSourcePref = (typeof DATA_SOURCE_PREFS)[number]

export const N_SEEDS_MIN = 1
export const N_SEEDS_MAX = 16

export const COST_BPS_MIN = 0
export const COST_BPS_MAX = 100

export const LOOKBACK_MIN = 4
export const LOOKBACK_MAX = 128

export const EPISODE_LEN_MIN = 32
export const EPISODE_LEN_MAX = 1024

export const SEED_MIN = 0
export const SEED_MAX = 999_999

// ---------------------------------------------------------------------------
// Request schema — mirrors api/routers/rl_trader.RlTraderRequest.
// ---------------------------------------------------------------------------

export const RunRequestSchema = z.object({
  n_seeds: z.number().int().min(N_SEEDS_MIN).max(N_SEEDS_MAX),
  cost_bps: z.number().min(COST_BPS_MIN).max(COST_BPS_MAX),
  lookback: z.number().int().min(LOOKBACK_MIN).max(LOOKBACK_MAX),
  episode_len: z.number().int().min(EPISODE_LEN_MIN).max(EPISODE_LEN_MAX),
  data_source_pref: z.enum(DATA_SOURCE_PREFS),
  seed: z.number().int().min(SEED_MIN).max(SEED_MAX),
})
export type RunRequest = z.infer<typeof RunRequestSchema>

// ---------------------------------------------------------------------------
// Response — mirrors RlTraderResponse.
//
// The honest-NULL discipline lives in `rl_beats_baseline`: it is a PURE
// function of the backend evaluation (FALSE unless the MEDIAN-seed OOS Sharpe
// beats buy-hold with a Diebold-Mariano-significant margin AND the Deflated
// Sharpe is > 0 AND the across-seed Sharpe lower bound is > 0, all net of
// costs). The frontend only renders it — it NEVER derives the verdict itself.
// No single-seed equity curve is shown as if it were "the result".
// ---------------------------------------------------------------------------

export type DataSource = "synthetic" | "polygon"

export type Summary = {
  oos_sharpe_rl_median: number | null
  oos_sharpe_buyhold: number | null
  oos_sharpe_flat: number | null
  seed_sharpe_lo: number | null
  seed_sharpe_hi: number | null
  dm_pvalue_vs_buyhold: number | null
  deflated_sharpe: number | null
  turnover: number | null
  max_drawdown: number | null
  rl_beats_baseline: boolean
  n_effective_trials: number
  data_source: DataSource
}

export type RunResponse = {
  summary: Summary
  equity_figure: PlotlyFigure
  seed_lottery_figure: PlotlyFigure
  data_source: DataSource
}

// ---------------------------------------------------------------------------
// Form state — string-typed numerics so the user can type freely.
// ---------------------------------------------------------------------------

export type FormState = {
  n_seeds: string
  cost_bps: string
  lookback: string
  episode_len: string
  data_source_pref: DataSourcePref
  seed: string
}

export type FieldErrors = Partial<
  Record<"n_seeds" | "cost_bps" | "lookback" | "episode_len" | "seed", string>
>

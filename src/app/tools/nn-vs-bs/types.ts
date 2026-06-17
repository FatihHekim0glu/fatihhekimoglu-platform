import { z } from "zod"

import type { PlotlyFigure } from "@/components/PlotlyChart"

// ---------------------------------------------------------------------------
// Catalogues — must match the backend Literal types
// (api/routers/nn_vs_bs.NnVsBsRequest).
// ---------------------------------------------------------------------------

export const MODES = ["synthetic", "real"] as const
export type Mode = (typeof MODES)[number]

export const DATA_SOURCE_PREFS = ["auto", "synthetic"] as const
export type DataSourcePref = (typeof DATA_SOURCE_PREFS)[number]

export const DEFAULT_TICKER = "SPY"

export const TICKER_RE = /^[A-Za-z0-9.\-]+$/

// ---------------------------------------------------------------------------
// Request schema — mirrors api/routers/nn_vs_bs.NnVsBsRequest.
//
// The single-contract overrides {S, K, T, r, q} are optional: when omitted the
// backend evaluates over the synthetic grid (mode=synthetic) or the live chain
// (mode=real). All five must be supplied together to price one explicit
// contract.
// ---------------------------------------------------------------------------

export const RunRequestSchema = z.object({
  mode: z.enum(MODES),
  ticker: z.string().min(1),
  S: z.number().positive().nullable(),
  K: z.number().positive().nullable(),
  T: z.number().positive().nullable(),
  r: z.number().nullable(),
  q: z.number().nullable(),
  n_quotes: z.number().int().min(8).max(5_000),
  data_source_pref: z.enum(DATA_SOURCE_PREFS),
  seed: z.number().int().min(0).max(999_999),
})
export type RunRequest = z.infer<typeof RunRequestSchema>

// ---------------------------------------------------------------------------
// Response — mirrors NnVsBsResponse.
// ---------------------------------------------------------------------------

export type Summary = {
  /** Black-Scholes reprice RMSE against the labelled price. */
  bs_rmse: number | null
  /** Neural-net reprice RMSE against the labelled price. */
  nn_rmse: number | null
  /** Black-Scholes reprice MAE. */
  mae_bs: number | null
  /** Neural-net reprice MAE. */
  mae_nn: number | null
  /** Diebold-Mariano statistic on the paired (BS - NN) loss-differential series. */
  dm_stat: number | null
  /** Two-sided p-value for the Diebold-Mariano test. */
  dm_pvalue: number | null
  /**
   * True when the NN reprice RMSE on synthetic BS data falls inside the sanity
   * band — i.e. the net RECOVERS the Black-Scholes surface. This is a
   * convergence check, NOT a claim that the NN beats Black-Scholes.
   */
  nn_recovers_bs: boolean
  n_quotes: number
  data_source: "synthetic" | "yfinance"
}

export type RunResponse = {
  summary: Summary
  smile_figure: PlotlyFigure
  error_by_moneyness_figure: PlotlyFigure
  data_source: "synthetic" | "yfinance"
}

// ---------------------------------------------------------------------------
// Form state — string-typed numerics so the user can type freely.
// ---------------------------------------------------------------------------

export type FormState = {
  mode: Mode
  ticker: string
  S: string
  K: string
  T: string
  r: string
  q: string
  n_quotes: string
  data_source_pref: DataSourcePref
  seed: string
}

export type FieldErrors = Partial<
  Record<
    "ticker" | "contract" | "n_quotes" | "seed",
    string
  >
>

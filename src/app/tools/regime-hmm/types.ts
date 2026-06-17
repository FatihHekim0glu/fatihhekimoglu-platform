import { z } from "zod"

import type { PlotlyFigure } from "@/components/PlotlyChart"

// ---------------------------------------------------------------------------
// Catalogues — must match the backend Literal types
// (api/routers/regime_hmm.RegimeHmmRequest).
// ---------------------------------------------------------------------------

export const N_STATES_OPTIONS = [2, 3, 4] as const
export type NStates = (typeof N_STATES_OPTIONS)[number]

export const FEATURE_SETS = [
  "returns",
  "returns_vol",
  "returns_vol_macro",
] as const
export type FeatureSet = (typeof FEATURE_SETS)[number]

export const DATA_SOURCE_PREFS = ["auto", "polygon", "synthetic"] as const
export type DataSourcePref = (typeof DATA_SOURCE_PREFS)[number]

export const DEFAULT_TICKER = "SPY"

export const TICKER_RE = /^[A-Za-z0-9.\-]+$/

// ---------------------------------------------------------------------------
// Request schema — mirrors api/routers/regime_hmm.RegimeHmmRequest.
// ---------------------------------------------------------------------------

export const RunRequestSchema = z.object({
  ticker: z.string().min(1),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  n_states: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  feature_set: z.enum(FEATURE_SETS),
  cost_bps: z.number().min(0),
  data_source_pref: z.enum(DATA_SOURCE_PREFS),
  seed: z.number().int().min(0).max(999_999),
})
export type RunRequest = z.infer<typeof RunRequestSchema>

// ---------------------------------------------------------------------------
// Response — mirrors RegimeHmmResponse.
// ---------------------------------------------------------------------------

/**
 * Stable verdict identifiers emitted by regimehmm.evaluation.verdict.Verdict.
 * The verdict is a PURE function of the OOS inference — it is structurally
 * unable to claim the overlay beats buy-and-hold when Memmel-JK is
 * insignificant or the deflated Sharpe is non-positive.
 */
export type HeadlineVerdict = "no_timing_edge" | "marginal" | "timing_edge"

/** One canonicalised regime (states sorted by ascending mean return). */
export type RegimeStat = {
  state: number
  label?: string | null
  mean_return: number | null
  volatility: number | null
  persistence: number | null
  duration?: number | null
  frequency?: number | null
}

export type Summary = {
  n_states: number
  regime_stats: RegimeStat[]
  overlay_oos_sharpe: number | null
  buyhold_oos_sharpe: number | null
  sharpe_diff: number | null
  jk_pvalue: number | null
  deflated_sharpe: number | null
  n_effective_trials: number
  verdict: HeadlineVerdict | string
  data_source: "polygon" | "synthetic"
}

export type RunResponse = {
  summary: Summary
  regime_figure: PlotlyFigure
  equity_figure: PlotlyFigure
  data_source: "polygon" | "synthetic"
}

// ---------------------------------------------------------------------------
// Form state — string-typed numerics so the user can type freely.
// ---------------------------------------------------------------------------

export type FormState = {
  ticker: string
  start: string
  end: string
  n_states: NStates
  feature_set: FeatureSet
  cost_bps: string
  data_source_pref: DataSourcePref
  seed: string
}

export type FieldErrors = Partial<
  Record<"ticker" | "start" | "end" | "cost_bps" | "seed", string>
>

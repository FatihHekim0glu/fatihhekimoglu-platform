import { z } from "zod"

import type { PlotlyFigure } from "@/components/PlotlyChart"

// ---------------------------------------------------------------------------
// Catalogues — must match the backend Literal types
// (api/routers/fed_causal.FedCausalRequest).
//
// This is a TORCH-FREE econometrics tool: an event study of cumulative abnormal
// returns (CAR) around FOMC announcements, an estimation-window-only market
// model, then placebo-date randomization (the PRIMARY significance source),
// HAC/clustered SEs, a multiple-testing correction and a rate-sensitivity
// difference-in-differences. The verdict (`fed_effect_is_tradable`) is a PURE
// function of the backend inference — the frontend only RENDERS it.
// ---------------------------------------------------------------------------

// Hard caps mirrored from fedcausal._constants (MAX_EVENT_HALF_WIDTH,
// MAX_PLACEBO_DRAWS) so the form rejects out-of-range requests before they hit
// the wire and the backend 422.
export const MAX_EVENT_WINDOW = 10
export const MIN_EVENT_WINDOW = 1
export const MAX_PLACEBO = 2000
export const MIN_PLACEBO = 1
export const MIN_ESTIMATION_WINDOW = 2
export const MAX_ESTIMATION_WINDOW = 252
export const MAX_SEED = 999_999

// Expected-return model. The backend treats 'mean_adjusted' as a distinct
// expected-return model from the market model.
export const MODELS = ["market", "mean_adjusted"] as const
export type Model = (typeof MODELS)[number]

export const MODEL_LABELS: Record<Model, string> = {
  market: "Market model (α + β·market)",
  mean_adjusted: "Mean-adjusted",
}

// Surprise subset for the CAR / placebo battery. The DiD always contrasts
// hawkish vs. dovish on the full event set regardless of this choice.
export const SURPRISES = ["all", "hawkish", "dovish"] as const
export type Surprise = (typeof SURPRISES)[number]

export const SURPRISE_LABELS: Record<Surprise, string> = {
  all: "All announcements",
  hawkish: "Hawkish surprises",
  dovish: "Dovish surprises",
}

// The deployed default scores a seeded synthetic event panel. 'auto' and
// 'fred+polygon' are offered for parity; real data is fetched lazily on the
// backend and degrades to the synthetic/committed panel on any provider
// failure, so the endpoint never hard-fails.
export const DATA_SOURCE_PREFS = ["synthetic", "auto", "fred+polygon"] as const
export type DataSourcePref = (typeof DATA_SOURCE_PREFS)[number]

export const DATA_SOURCE_PREF_LABELS: Record<DataSourcePref, string> = {
  synthetic: "synthetic",
  auto: "auto",
  "fred+polygon": "fred+polygon",
}

// ---------------------------------------------------------------------------
// Request schema — mirrors api/routers/fed_causal.FedCausalRequest.
// ---------------------------------------------------------------------------

export const RunRequestSchema = z.object({
  event_window: z.number().int().min(MIN_EVENT_WINDOW).max(MAX_EVENT_WINDOW),
  estimation_window: z
    .number()
    .int()
    .min(MIN_ESTIMATION_WINDOW)
    .max(MAX_ESTIMATION_WINDOW),
  model: z.enum(MODELS),
  surprise: z.enum(SURPRISES),
  n_placebo: z.number().int().min(MIN_PLACEBO).max(MAX_PLACEBO),
  data_source_pref: z.enum(DATA_SOURCE_PREFS),
  seed: z.number().int().min(0).max(MAX_SEED),
})
export type RunRequest = z.infer<typeof RunRequestSchema>

// ---------------------------------------------------------------------------
// Response — mirrors FedCausalResponse.
//
// `fed_effect_is_tradable` is a PURE function of the backend inference: it reads
// FALSE unless the effect is placebo-significant AND HAC-robust AND survives the
// multiple-testing correction AND yields a net-of-cost tradable DiD spread. The
// frontend NEVER derives this verdict client-side; it only renders the boolean.
// ---------------------------------------------------------------------------

export type DataSource = "synthetic" | "fred+polygon"

export type Summary = {
  car_mean: number | null
  car_tstat: number | null
  car_hac_pvalue: number | null
  bmp_stat: number | null
  placebo_pctile: number | null
  placebo_pvalue: number | null
  n_events: number
  did_coef: number | null
  did_pvalue: number | null
  did_net_spread: number | null
  n_tests: number
  fed_effect_is_tradable: boolean
  verdict_rationale: string
  data_source: DataSource
}

export type RunResponse = {
  summary: Summary
  car_figure: PlotlyFigure
  placebo_figure: PlotlyFigure
  data_source: DataSource
}

// ---------------------------------------------------------------------------
// Form state — string-typed numerics so the user can type freely.
// ---------------------------------------------------------------------------

export type FormState = {
  event_window: string
  estimation_window: string
  model: Model
  surprise: Surprise
  n_placebo: string
  data_source_pref: DataSourcePref
  seed: string
}

export type FieldErrors = Partial<
  Record<
    "event_window" | "estimation_window" | "n_placebo" | "seed",
    string
  >
>

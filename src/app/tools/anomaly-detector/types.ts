import { z } from "zod"

import type { PlotlyFigure } from "@/components/PlotlyChart"

// ---------------------------------------------------------------------------
// Catalogues — must match the backend Literal types
// (api/routers/anomaly_detector.AnomalyRequest).
// ---------------------------------------------------------------------------

export const DETECTORS = ["iforest", "autoencoder", "both"] as const
export type Detector = (typeof DETECTORS)[number]

export const DATA_SOURCE_PREFS = ["auto", "polygon", "synthetic"] as const
export type DataSourcePref = (typeof DATA_SOURCE_PREFS)[number]

export const DEFAULT_TICKER = "SPY"

export const TICKER_RE = /^[A-Za-z0-9.\-]+$/

// ---------------------------------------------------------------------------
// Request schema — mirrors api/routers/anomaly_detector.AnomalyRequest.
// ---------------------------------------------------------------------------

export const RunRequestSchema = z.object({
  ticker: z.string().min(1).regex(TICKER_RE),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  detector: z.enum(DETECTORS),
  contamination: z.number().gt(0).lt(0.5),
  window: z.number().int().min(2),
  data_source_pref: z.enum(DATA_SOURCE_PREFS),
  seed: z.number().int().min(0).max(999_999),
})
export type RunRequest = z.infer<typeof RunRequestSchema>

// ---------------------------------------------------------------------------
// Response — mirrors AnomalyResponse.
// ---------------------------------------------------------------------------

export type Summary = {
  n_flags: number
  jaccard: number | null
  proxy_precision: number | null
  proxy_recall: number | null
  top_anomaly_dates: string[]
  detector: Detector | string
  data_source: "polygon" | "synthetic"
}

export type RunResponse = {
  summary: Summary
  price_figure: PlotlyFigure
  score_figure: PlotlyFigure
  data_source: "polygon" | "synthetic"
}

// ---------------------------------------------------------------------------
// Form state — string-typed numerics so the user can type freely.
// (contamination is kept numeric because it is driven by a slider.)
// ---------------------------------------------------------------------------

export type FormState = {
  ticker: string
  start: string
  end: string
  detector: Detector
  contamination: number
  window: string
  data_source_pref: DataSourcePref
  seed: string
}

export type FieldErrors = Partial<
  Record<"ticker" | "start" | "end" | "window" | "seed", string>
>

import { z } from "zod"

import type { PlotlyFigure } from "@/components/PlotlyChart"

// ---------------------------------------------------------------------------
// Catalogs — must match the backend literals.
// ---------------------------------------------------------------------------

export const MODEL_OPTIONS = ["CAPM", "FF3", "FF4", "FF5", "FF6"] as const
export type ModelName = (typeof MODEL_OPTIONS)[number]

export const FREQUENCY_OPTIONS = ["M", "D"] as const
export type Frequency = (typeof FREQUENCY_OPTIONS)[number]

export const TICKER_RE = /^[A-Z0-9.\-]{1,15}$/

// ---------------------------------------------------------------------------
// Request schema mirrors the backend Pydantic model.
// ---------------------------------------------------------------------------

export const RunRequestSchema = z.object({
  ticker: z.string().regex(TICKER_RE),
  model: z.enum(MODEL_OPTIONS),
  frequency: z.enum(FREQUENCY_OPTIONS),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hac: z.boolean(),
})
export type RunRequest = z.infer<typeof RunRequestSchema>

export type CoefficientRow = {
  factor: string
  beta: number | null
  se: number | null
  t: number | null
  p: number | null
  stars: string
}

export type Summary = {
  model: ModelName
  frequency: Frequency
  ticker: string
  start: string
  end: string
  nobs: number
  alpha: number | null
  alpha_annualized: number | null
  alpha_t: number | null
  alpha_p: number | null
  r_squared: number | null
  r_squared_adj: number | null
  hac: boolean
  hac_lags: number | null
}

export type RollingBetaFigure = {
  factor: string
  figure: PlotlyFigure
}

export type RunResponse = {
  summary: Summary
  coefficients: CoefficientRow[]
  rolling_beta_charts: RollingBetaFigure[]
  interpretation_markdown: string
}

export type FormState = {
  ticker: string
  model: ModelName
  frequency: Frequency
  start: string
  end: string
  hac: boolean
}

export type FieldErrors = Partial<
  Record<"ticker" | "start" | "end", string>
>

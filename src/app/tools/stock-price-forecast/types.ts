import { z } from "zod"

import type { PlotlyFigure } from "@/components/PlotlyChart"

// ---------------------------------------------------------------------------
// Inputs — mirrors the backend Pydantic model exactly.
// ---------------------------------------------------------------------------

export const TICKER_RE = /^[A-Z0-9.\-]{1,15}$/

export const FORECAST_DAYS_MIN = 1
export const FORECAST_DAYS_MAX = 30
export const FORECAST_DAYS_DEFAULT = 7
export const DEFAULT_TICKER = "AAPL"

export const INPUT_SCHEMA = z.object({
  ticker: z
    .string()
    .min(1, "Ticker is required.")
    .max(15)
    .regex(TICKER_RE, "Letters, digits, '.', '-' only (1-15 chars)."),
  forecast_days: z
    .number()
    .int()
    .min(FORECAST_DAYS_MIN)
    .max(FORECAST_DAYS_MAX),
})

export type RunRequest = z.infer<typeof INPUT_SCHEMA>

// ---------------------------------------------------------------------------
// Response — mirrors api/routers/stock_price_forecast.py.
// ---------------------------------------------------------------------------

export type ForecastRow = {
  date: string
  predicted_close: number
}

export type Summary = {
  ticker: string
  last_close: number
  last_close_date: string
  forecast_days: number
  first_forecast_close: number | null
  final_forecast_close: number | null
  forecast_change_pct: number | null
}

export type RunResponse = {
  price_history_chart: PlotlyFigure
  forecast_chart: PlotlyFigure
  forecast_table: ForecastRow[]
  summary: Summary
}

// ---------------------------------------------------------------------------
// UI-only types
// ---------------------------------------------------------------------------

export type FormState = {
  ticker: string
  forecast_days: number
}

export type FieldErrors = Partial<Record<"ticker" | "forecast_days", string>>

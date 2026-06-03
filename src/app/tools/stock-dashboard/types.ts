import { z } from "zod"

import type { PlotlyFigure } from "@/components/PlotlyChart"

// ---------------------------------------------------------------------------
// Indicator catalog — must match the backend literal.
// ---------------------------------------------------------------------------

export const INDICATOR_OPTIONS = [
  "SMA 20",
  "SMA 50",
  "EMA 12",
  "EMA 26",
  "Bollinger Bands",
  "RSI",
  "MACD",
] as const

export type IndicatorLabel = (typeof INDICATOR_OPTIONS)[number]

export const TICKER_RE = /^[A-Z0-9.\-]{1,15}$/

// ---------------------------------------------------------------------------
// Request schema mirrors the backend Pydantic model.
// ---------------------------------------------------------------------------

export const RunRequestSchema = z.object({
  ticker: z.string().regex(TICKER_RE),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  indicators: z.array(z.enum(INDICATOR_OPTIONS)),
  candlestick: z.boolean(),
  rf_annual: z.number().finite(),
})
export type RunRequest = z.infer<typeof RunRequestSchema>

export type AnchorResponse = {
  today_nyse: string
  min_date: string
  default_start: string
  market_is_open: boolean
  trading_day_stamp: string
}

export type Summary = {
  start: string
  end: string
  trading_days: number
  cumulative_return: number | null
  annualized_return: number | null
  annualized_volatility: number | null
  sharpe: number | null
  max_drawdown: number | null
  best_day: number | null
  worst_day: number | null
}

export type RunResponse = {
  figure: PlotlyFigure
  summary: Summary
  ohlcv_count: number
  data_source: string
  trading_day_stamp: string
}

export type FormState = {
  ticker: string
  start_date: string
  end_date: string
  indicators: Set<IndicatorLabel>
  candlestick: boolean
  rf_annual: string
}

export type FieldErrors = Partial<
  Record<"ticker" | "start_date" | "end_date" | "rf_annual", string>
>

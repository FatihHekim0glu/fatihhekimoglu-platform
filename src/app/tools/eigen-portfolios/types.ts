import { z } from "zod"

import type { PlotlyFigure } from "@/components/PlotlyChart"

// ---------------------------------------------------------------------------
// Catalogs — must match the backend Literal types.
// ---------------------------------------------------------------------------

export const UNIVERSE_OPTIONS = [
  { value: "sp500-pit", label: "S&P 500 (point-in-time)" },
  { value: "custom", label: "Custom tickers" },
] as const

export type Universe = (typeof UNIVERSE_OPTIONS)[number]["value"]

// ---------------------------------------------------------------------------
// Request schema mirrors the backend Pydantic model.
// ---------------------------------------------------------------------------

export const INPUT_SCHEMA = z
  .object({
    universe: z.enum(["sp500-pit", "custom"]),
    tickers: z.array(z.string()).optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    n_components_to_show: z.number().int().min(2).max(10),
    rebalance: z.literal("none"),
  })
  .refine((v) => v.end_date > v.start_date, {
    message: "end_date must be after start_date",
    path: ["end_date"],
  })
  .refine(
    (v) => v.universe !== "custom" || (v.tickers && v.tickers.length >= 2),
    {
      message: "Custom universe requires at least 2 tickers.",
      path: ["tickers"],
    },
  )

export type RunRequest = z.infer<typeof INPUT_SCHEMA>

// ---------------------------------------------------------------------------
// Response types.
// ---------------------------------------------------------------------------

export type TopWeight = {
  ticker: string
  weight: number
}

export type TopPortfolio = {
  rank: number
  eigenvalue: number
  explained_variance: number
  top_weights: TopWeight[]
  interpretation: string
}

export type RmtBulk = {
  lambda_min: number
  lambda_max: number
  sigma_sq: number
}

export type RunResponse = {
  data_source: "polygon" | "yfinance"
  universe_size: number
  obs: number
  eigenvalue_spectrum: number[]
  rmt_bulk: RmtBulk
  significant_count: number
  top_portfolios: TopPortfolio[]
  spectrum_figure: PlotlyFigure
  factor_returns_figure: PlotlyFigure
  weights_heatmap_figure: PlotlyFigure
}

// ---------------------------------------------------------------------------
// Form state (string-typed so empty inputs are representable).
// ---------------------------------------------------------------------------

export type FormState = {
  universe: Universe
  tickers_text: string
  start_date: string
  end_date: string
  n_components_to_show: number
}

export type FieldErrors = Partial<
  Record<"tickers" | "start_date" | "end_date", string>
>

import { z } from "zod"

import type { PlotlyFigure } from "@/components/PlotlyChart"

// ---------------------------------------------------------------------------
// Catalogs - must match the backend Literal types.
// ---------------------------------------------------------------------------

export const UNIVERSE_OPTIONS = [
  { value: "curated_25_v1", label: "Curated 25 (v1)" },
  { value: "xlk_v1", label: "XLK constituents (v1)" },
  { value: "sp500-pit", label: "S&P 500 (point-in-time)" },
] as const

export type Universe = (typeof UNIVERSE_OPTIONS)[number]["value"]

export type DataSource = "polygon" | "yfinance" | "cache"

export const FDR_METHOD_OPTIONS = [
  { value: "benjamini_hochberg", label: "Benjamini-Hochberg (FDR)" },
  { value: "bonferroni", label: "Bonferroni (FWER)" },
  { value: "none", label: "None" },
] as const

export type FdrMethod = (typeof FDR_METHOD_OPTIONS)[number]["value"]

// ---------------------------------------------------------------------------
// Request schema mirrors the backend Pydantic model.
// ---------------------------------------------------------------------------

export const INPUT_SCHEMA = z
  .object({
    universe: z.enum(["curated_25_v1", "xlk_v1", "sp500-pit"]),
    train_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    train_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    hl_min: z.number().min(1).max(120),
    hl_max: z.number().min(1).max(120),
    p_threshold: z.number().min(0.001).max(0.5),
    fdr_method: z.enum(["benjamini_hochberg", "bonferroni", "none"]),
  })
  .refine((v) => v.train_end > v.train_start, {
    message: "train_end must be after train_start",
    path: ["train_end"],
  })
  .refine((v) => v.hl_max >= v.hl_min, {
    message: "hl_max must be >= hl_min",
    path: ["hl_max"],
  })

export type RunRequest = z.infer<typeof INPUT_SCHEMA>

export type DiagnosticRow = {
  pair_id: string
  ticker_a: string
  ticker_b: string
  p_raw: number | null
  hedge_ratio: number | null
  half_life: number | null
  q_value: number | null
  survives_mtc: boolean
  in_hl_band: boolean
}

export type Summary = {
  pairs_tested: number
  survivors: number
  median_half_life: number | null
  median_q_value: number | null
}

export type RunResponse = {
  summary: Summary
  diagnostics: DiagnosticRow[]
  figure: PlotlyFigure
  universe: Universe
  train_start: string
  train_end: string
  mtc_method: FdrMethod
  data_source: DataSource
}

export type FormState = {
  universe: Universe
  train_start: string
  train_end: string
  hl_min: string
  hl_max: string
  p_threshold: string
  fdr_method: FdrMethod
}

export type FieldErrors = Partial<
  Record<
    "train_start" | "train_end" | "hl_min" | "hl_max" | "p_threshold",
    string
  >
>

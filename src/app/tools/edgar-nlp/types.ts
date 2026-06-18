import { z } from "zod"

import type { PlotlyFigure } from "@/components/PlotlyChart"

// ---------------------------------------------------------------------------
// Catalogues — must match the backend Literal types
// (api/routers/edgar_nlp.EdgarNlpRequest).
// ---------------------------------------------------------------------------

export const SECTIONS = ["risk_factors", "mda"] as const
export type Section = (typeof SECTIONS)[number]

export const SECTION_LABELS: Record<Section, string> = {
  risk_factors: "Item 1A — Risk Factors",
  mda: "Item 7 — MD&A",
}

export const DATA_SOURCE_PREFS = ["auto", "edgar", "synthetic"] as const
export type DataSourcePref = (typeof DATA_SOURCE_PREFS)[number]

export const DEFAULT_TICKER = "AAPL"

// Single ticker OR a numeric CIK. EDGAR tickers are alphanumeric; a CIK is
// purely numeric (≤10 digits). The frontend validates one identifier at a time.
export const TICKER_RE = /^[A-Za-z][A-Za-z0-9.\-]*$/
export const CIK_RE = /^\d{1,10}$/

// ---------------------------------------------------------------------------
// Request schema — mirrors api/routers/edgar_nlp.EdgarNlpRequest.
//
// `ticker` defaults to AAPL; `cik` is an optional override. `year` is optional
// (the backend falls back to the latest available / cached filing). `sections`
// is a non-empty subset of SECTIONS.
// ---------------------------------------------------------------------------

export const RunRequestSchema = z.object({
  ticker: z.string().min(1).regex(TICKER_RE).optional(),
  cik: z.string().regex(CIK_RE).optional(),
  year: z.number().int().min(1994).max(2100).nullable().optional(),
  sections: z.array(z.enum(SECTIONS)).min(1),
  data_source_pref: z.enum(DATA_SOURCE_PREFS),
})
export type RunRequest = z.infer<typeof RunRequestSchema>

// ---------------------------------------------------------------------------
// Response — mirrors EdgarNlpResponse.
//
// The honest verdict `tone_spread_has_edge` is a PURE function of the panel
// inference (OOS tone-spread Sharpe + Deflated Sharpe + HAC significance net of
// costs) precomputed on the backend. The frontend only renders it.
// ---------------------------------------------------------------------------

export type Summary = {
  tone: number | null
  neg_pct: number | null
  pos_pct: number | null
  uncertainty_pct: number | null
  litigious_pct: number | null
  fog: number | null
  flesch_kincaid: number | null
  smog: number | null
  word_count: number | null
  n_sentences: number | null
  panel_tone_spread_sharpe: number | null
  panel_deflated_sharpe: number | null
  panel_hac_pvalue: number | null
  tone_spread_has_edge: boolean
  data_source: "edgar" | "cache" | "synthetic"
}

export type RunResponse = {
  summary: Summary
  tone_by_section_figure: PlotlyFigure
  readability_figure: PlotlyFigure
  data_source: "edgar" | "cache" | "synthetic"
}

// ---------------------------------------------------------------------------
// Form state — string-typed identifier/year so the user can type freely.
// ---------------------------------------------------------------------------

export type FormState = {
  ticker: string
  cik: string
  year: string
  sections: Record<Section, boolean>
  data_source_pref: DataSourcePref
}

export type FieldErrors = Partial<
  Record<"ticker" | "cik" | "year" | "sections", string>
>

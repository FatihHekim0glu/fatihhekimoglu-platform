import { z } from "zod"

import type { PlotlyFigure } from "@/components/PlotlyChart"

// ---------------------------------------------------------------------------
// Catalogues — must match the backend Literal types
// (api/routers/rag_10k.Rag10kRequest).
// ---------------------------------------------------------------------------

/** Answer path. 'auto' = generative iff an LLM key is present else extractive;
 *  'extractive' = always the key-free cited answer; 'generative' = LLM when a
 *  key is set, else degrades to extractive (never a hard failure). The backend
 *  decides which path actually ran and reports it as `summary.mode_used`. */
export const MODES = ["auto", "extractive", "generative"] as const
export type Mode = (typeof MODES)[number]

export const MODE_LABELS: Record<Mode, string> = {
  auto: "auto (generative if key set)",
  extractive: "extractive (key-free)",
  generative: "generative (needs LLM key)",
}

/** Filing source. 'cache' answers over the committed offline corpus (default);
 *  'edgar' attempts a lazy live fetch and falls back to the cache on any
 *  failure. The served `data_source` reports which path produced the filing. */
export const DATA_SOURCE_PREFS = ["cache", "edgar"] as const
export type DataSourcePref = (typeof DATA_SOURCE_PREFS)[number]

export const DEFAULT_TICKER = "AAPL"

/** Hard backend bounds (keep in step with the field validators). */
export const TOP_K_MIN = 1
export const TOP_K_MAX = 20
export const DEFAULT_TOP_K = 5
export const MAX_QUESTION_LEN = 2000

// EDGAR tickers are alphanumeric, starting with a letter.
export const TICKER_RE = /^[A-Za-z][A-Za-z0-9.\-]*$/

// ---------------------------------------------------------------------------
// Request schema — mirrors api/routers/rag_10k.Rag10kRequest.
// ---------------------------------------------------------------------------

export const RunRequestSchema = z.object({
  question: z.string().min(1).max(MAX_QUESTION_LEN),
  ticker: z.string().min(1).regex(TICKER_RE),
  top_k: z.number().int().min(TOP_K_MIN).max(TOP_K_MAX),
  mode: z.enum(MODES),
  data_source_pref: z.enum(DATA_SOURCE_PREFS),
})
export type RunRequest = z.infer<typeof RunRequestSchema>

// ---------------------------------------------------------------------------
// Response — mirrors Rag10kResponse.
//
// The honest verdict `answer_is_grounded` is a PURE backend function: TRUE only
// when every emitted claim maps to a retrieved supporting chunk above the
// similarity threshold; otherwise the system ABSTAINS. The frontend only
// renders the grounded/abstained verdict and citations from the response.
// ---------------------------------------------------------------------------

export type ModeUsed = "extractive" | "generative"
export type DataSource = "cache" | "edgar"

export type Summary = {
  answer: string
  abstained: boolean
  answer_is_grounded: boolean
  n_citations: number
  retrieval_top_score: number | null
  mode_used: ModeUsed
  llm_key_present: boolean
  data_source: DataSource
}

/** One validated citation — every cited chunk EXISTS and is retrievable
 *  (no hallucinated citations are emitted by the backend). */
export type Citation = {
  chunk_id: string
  item: string
  char_span: [number, number] | number[] | null
  score: number | null
  text_snippet: string
}

export type EvalSummary = {
  recall_at_k: number | null
  citation_soundness: number | null
  abstention_rate: number | null
  n_questions: number
}

export type RunResponse = {
  summary: Summary
  citations: Citation[]
  eval_summary: EvalSummary
  retrieval_figure: PlotlyFigure
  data_source: DataSource
}

// ---------------------------------------------------------------------------
// Form state — string-typed top_k so the user can type freely; the question is
// a free-text textarea.
// ---------------------------------------------------------------------------

export type FormState = {
  question: string
  ticker: string
  top_k: string
  mode: Mode
  data_source_pref: DataSourcePref
}

export type FieldErrors = Partial<
  Record<"question" | "ticker" | "top_k", string>
>

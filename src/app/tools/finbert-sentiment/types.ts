import { z } from "zod"

import type { PlotlyFigure } from "@/components/PlotlyChart"

// ---------------------------------------------------------------------------
// Catalogues — must match the backend Literal types
// (api/routers/finbert_sentiment.SentimentRequest).
// ---------------------------------------------------------------------------

/** Served-model selector. `distilbert` falls back to the lexicon when no ONNX
 *  artifact is present in the container — the backend decides which actually
 *  ran and reports it as `summary.served_model`. */
export const MODEL_CHOICES = ["distilbert", "lexicon"] as const
export type ModelChoice = (typeof MODEL_CHOICES)[number]

/** 3-way sentiment labels emitted per sentence. */
export const SENTIMENT_LABELS = ["negative", "neutral", "positive"] as const
export type SentimentLabel = (typeof SENTIMENT_LABELS)[number]

/** Hard backend limits: 1..64 sentences, each non-empty. */
export const MIN_TEXTS = 1
export const MAX_TEXTS = 64
/** Per-text length cap — keep in step with the backend field_validator. */
export const MAX_TEXT_LEN = 512

/** Illustrative, as-published headlines — no look-ahead guarantee. Sentiment is
 *  a text label, not a tradable signal. */
export const EXAMPLE_HEADLINES = [
  "The company reported record quarterly revenue, beating analyst estimates.",
  "Shares plunged after the firm slashed its full-year profit guidance.",
  "The board approved a routine update to the corporate governance policy.",
  "Operating margins expanded as cost-cutting measures took hold.",
  "The regulator launched an investigation into the bank's lending practices.",
  "Management reiterated its previously announced dividend schedule.",
  "The retailer warned of weaker demand heading into the holiday season.",
  "Net income rose sharply on strong international sales growth.",
].join("\n")

// ---------------------------------------------------------------------------
// Request schema — mirrors api/routers/finbert_sentiment.SentimentRequest.
// ---------------------------------------------------------------------------

export const RunRequestSchema = z.object({
  texts: z
    .array(z.string().min(1).max(MAX_TEXT_LEN))
    .min(MIN_TEXTS)
    .max(MAX_TEXTS),
  model: z.enum(MODEL_CHOICES),
})
export type RunRequest = z.infer<typeof RunRequestSchema>

// ---------------------------------------------------------------------------
// Response — mirrors SentimentResponse.
// ---------------------------------------------------------------------------

/** Which model the backend actually served for this request. */
export type ServedModel = "distilbert-onnx" | "lexicon"

export type ScoreTriple = {
  neg: number
  neu: number
  pos: number
}

export type Prediction = {
  text: string
  label: SentimentLabel | string
  scores: ScoreTriple
}

export type Summary = {
  /** Which model actually ran ('distilbert-onnx' when an ONNX artifact exists,
   *  else 'lexicon'). */
  served_model: ServedModel | string
  /** OFFLINE-measured macro-F1 of the served model on the locked test set, or
   *  null when the transformer figure is published-not-measured in this build. */
  eval_macro_f1: number | null
  /** Real macro-F1 of the Loughran-McDonald-style lexicon baseline. */
  lexicon_macro_f1: number | null
  /** Macro-F1 of the class-prior (majority) baseline — the honest floor. */
  class_prior_macro_f1: number | null
  /** Whether the served model significantly beats the lexicon (McNemar). Null
   *  when not applicable (e.g. lexicon is itself the served model). */
  beats_lexicon: boolean | null
  n_texts: number
  data_source: string
}

export type RunResponse = {
  summary: Summary
  predictions: Prediction[]
  confusion_figure: PlotlyFigure
  per_class_f1_figure: PlotlyFigure
}

// ---------------------------------------------------------------------------
// Form state — raw textarea text so the user can type freely (one per line).
// ---------------------------------------------------------------------------

export type FormState = {
  text: string
  model: ModelChoice
}

export type FieldErrors = Partial<Record<"text", string>>

// ---------------------------------------------------------------------------
// Parsing helpers — one sentence per line, blank lines dropped.
// ---------------------------------------------------------------------------

/** Split the textarea into trimmed, non-empty sentences (one per line). */
export function parseSentences(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

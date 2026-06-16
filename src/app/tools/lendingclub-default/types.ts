import { z } from "zod"

import type { PlotlyFigure } from "@/components/PlotlyChart"

// ---------------------------------------------------------------------------
// Catalogues — must match the backend Literal types
// (api/routers/lendingclub_default.LendingClubRequest). These are
// application-time fields only — every post-funding column is dropped by the
// leakage allowlist before the model ever sees a row.
// ---------------------------------------------------------------------------

export const TERMS = ["36 months", "60 months"] as const
export type Term = (typeof TERMS)[number]

export const GRADES = ["A", "B", "C", "D", "E", "F", "G"] as const
export type Grade = (typeof GRADES)[number]

/** Full LC sub-grade ladder A1..G5 (35 levels). */
export const SUB_GRADES = GRADES.flatMap((g) =>
  [1, 2, 3, 4, 5].map((n) => `${g}${n}`),
) as readonly string[]
export type SubGrade = string

export const HOME_OWNERSHIPS = [
  "RENT",
  "MORTGAGE",
  "OWN",
  "OTHER",
  "NONE",
  "ANY",
] as const
export type HomeOwnership = (typeof HOME_OWNERSHIPS)[number]

export const VERIFICATION_STATUSES = [
  "Verified",
  "Source Verified",
  "Not Verified",
] as const
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number]

export const PURPOSES = [
  "debt_consolidation",
  "credit_card",
  "home_improvement",
  "major_purchase",
  "medical",
  "small_business",
  "car",
  "moving",
  "vacation",
  "house",
  "wedding",
  "renewable_energy",
  "educational",
  "other",
] as const
export type Purpose = (typeof PURPOSES)[number]

/** LC employment-length ladder, as the raw strings the schema carries. */
export const EMP_LENGTHS = [
  "< 1 year",
  "1 year",
  "2 years",
  "3 years",
  "4 years",
  "5 years",
  "6 years",
  "7 years",
  "8 years",
  "9 years",
  "10+ years",
] as const
export type EmpLength = (typeof EMP_LENGTHS)[number]

export const ADDR_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
] as const
export type AddrState = (typeof ADDR_STATES)[number]

// ---------------------------------------------------------------------------
// Request schema — mirrors api/routers/lendingclub_default.LendingClubRequest.
// All fields are observable at origination; the model never sees outcome data.
// ---------------------------------------------------------------------------

export const RunRequestSchema = z.object({
  loan_amnt: z.number().min(500).max(40_000),
  term: z.enum(TERMS),
  int_rate: z.number().min(0).max(40),
  grade: z.enum(GRADES),
  sub_grade: z.enum(SUB_GRADES as [string, ...string[]]),
  emp_length: z.enum(EMP_LENGTHS),
  home_ownership: z.enum(HOME_OWNERSHIPS),
  annual_inc: z.number().min(0).max(10_000_000),
  dti: z.number().min(0).max(999),
  fico_range_low: z.number().int().min(300).max(850),
  fico_range_high: z.number().int().min(300).max(850),
  revol_util: z.number().min(0).max(200),
  open_acc: z.number().int().min(0).max(120),
  pub_rec: z.number().int().min(0).max(80),
  purpose: z.enum(PURPOSES),
  installment: z.number().min(0).max(2_000),
  verification_status: z.enum(VERIFICATION_STATUSES),
  addr_state: z.enum(ADDR_STATES as unknown as [string, ...string[]]),
})
export type RunRequest = z.infer<typeof RunRequestSchema>

// ---------------------------------------------------------------------------
// Response — mirrors LendingClubResponse.
// Headline metrics are AUC / PR-AUC / Brier — never accuracy, never profit.
// ---------------------------------------------------------------------------

export type PredictedLabel = "likely_default" | "likely_repaid"

export type Summary = {
  /** Isotonic/Platt-calibrated probability of default in [0, 1]. */
  calibrated_pd: number | null
  /** 1 (safest) .. 10 (riskiest) decile of the application within the model's score distribution. */
  risk_decile: number | null
  /** Held-out ROC-AUC of the shipped (synthetic-trained) booster. */
  model_auc: number | null
  /** Empirical default base rate of the training panel (~0.15). */
  base_rate: number | null
  /** Thresholded label — for triage only, NOT an individual prediction. */
  predicted_label: PredictedLabel | string
  /** Decision threshold applied to calibrated_pd (reported, never baked into a profit claim). */
  threshold: number | null
}

export type ReasonCode = {
  /** Application-time feature driving the score. */
  feature: string
  /** Whether the feature pushes risk up or down for this application. */
  direction: "increases_risk" | "decreases_risk" | string
  /** Signed contribution (weight-of-evidence / logistic coefficient). */
  contribution: number | null
}

export type RunResponse = {
  summary: Summary
  reason_codes: ReasonCode[]
  score_distribution_figure: PlotlyFigure
  calibration_figure: PlotlyFigure
  data_source: "synthetic" | "cache"
}

// ---------------------------------------------------------------------------
// Form state — string-typed numerics so the user can type freely.
// ---------------------------------------------------------------------------

export type FormState = {
  loan_amnt: string
  term: Term
  int_rate: string
  grade: Grade
  sub_grade: SubGrade
  emp_length: EmpLength
  home_ownership: HomeOwnership
  annual_inc: string
  dti: string
  fico_range_low: string
  fico_range_high: string
  revol_util: string
  open_acc: string
  pub_rec: string
  purpose: Purpose
  installment: string
  verification_status: VerificationStatus
  addr_state: AddrState
}

export type NumericField =
  | "loan_amnt"
  | "int_rate"
  | "annual_inc"
  | "dti"
  | "fico_range_low"
  | "fico_range_high"
  | "revol_util"
  | "open_acc"
  | "pub_rec"
  | "installment"

export type FieldErrors = Partial<Record<NumericField, string>>

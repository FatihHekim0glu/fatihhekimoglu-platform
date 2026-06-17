import { z } from "zod"

import type { PlotlyFigure } from "@/components/PlotlyChart"

// ---------------------------------------------------------------------------
// Catalogues — must match the backend Literal types
// (api/routers/crypto_arb_scanner.CryptoArbRequest).
// ---------------------------------------------------------------------------

/** Venues the scanner can sample L2 books from. */
export const VENUES = ["binance", "coinbase", "kraken"] as const
export type Venue = (typeof VENUES)[number]

/** Per-venue maker/taker fee schedules bundled in profiles/*.yaml. */
export const FEE_PROFILES = ["default", "low", "high"] as const
export type FeeProfile = (typeof FEE_PROFILES)[number]

/** Live | synthetic preference; backend may still degrade to synthetic. */
export const DATA_SOURCE_PREFS = ["auto", "live", "synthetic"] as const
export type DataSourcePref = (typeof DATA_SOURCE_PREFS)[number]

/** Resolved provenance returned by the backend after fallback. */
export const DATA_SOURCES = ["live", "cache", "synthetic"] as const
export type DataSource = (typeof DATA_SOURCES)[number]

export const DEFAULT_SYMBOL = "BTC/USDT"

/** BASE/QUOTE, letters/digits only, single slash. */
export const SYMBOL_RE = /^[A-Za-z0-9]{2,15}\/[A-Za-z0-9]{2,15}$/

export const MIN_NOTIONAL = 100
export const MAX_NOTIONAL = 5_000_000

// ---------------------------------------------------------------------------
// Request schema — mirrors api/routers/crypto_arb_scanner.CryptoArbRequest.
// ---------------------------------------------------------------------------

export const RunRequestSchema = z.object({
  symbol: z.string().regex(SYMBOL_RE),
  venues: z.array(z.enum(VENUES)).min(1),
  notional_usd: z.number().min(MIN_NOTIONAL).max(MAX_NOTIONAL),
  fee_profile: z.enum(FEE_PROFILES),
  include_transfer_cost: z.boolean(),
  data_source_pref: z.enum(DATA_SOURCE_PREFS),
  seed: z.number().int().min(0).max(999_999),
})
export type RunRequest = z.infer<typeof RunRequestSchema>

// ---------------------------------------------------------------------------
// Response — mirrors CryptoArbResponse.
// ---------------------------------------------------------------------------

/**
 * Stable verdict identifiers emitted by cryptoarb.evaluation.verdict.Verdict.
 * The verdict is a PURE function of the net-edge inference — it cannot claim a
 * feasible edge while net bps are at or below zero (or within noise).
 */
export type HeadlineVerdict =
  | "no_feasible_edge"
  | "marginal"
  | "feasible_edge"

export type Summary = {
  gross_bps: number | null
  net_bps: number | null
  fillable_notional: number | null
  dominant_cost_leg: string | null
  n_feasible: number
  verdict: HeadlineVerdict | string
  data_source: DataSource | string
}

export type RunResponse = {
  summary: Summary
  waterfall_figure: PlotlyFigure
  spread_figure: PlotlyFigure
  data_source: DataSource
}

// ---------------------------------------------------------------------------
// Form state — string-typed numerics so the user can type freely.
// ---------------------------------------------------------------------------

export type FormState = {
  symbol: string
  venues: Venue[]
  notional_usd: number
  fee_profile: FeeProfile
  include_transfer_cost: boolean
  data_source_pref: DataSourcePref
  seed: string
}

export type FieldErrors = Partial<
  Record<"symbol" | "venues" | "notional_usd" | "seed", string>
>

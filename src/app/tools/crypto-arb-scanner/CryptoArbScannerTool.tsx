"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Toaster } from "@/components/ui/sonner"
import MetricCard from "@/components/MetricCard"
import PlotlyChart from "@/components/PlotlyChart"
import { ApiError, apiPost } from "@/lib/api"
import { fmtCompact, fmtNum } from "@/lib/format"

import {
  type DataSource,
  DATA_SOURCE_PREFS,
  DEFAULT_SYMBOL,
  FEE_PROFILES,
  type FieldErrors,
  type FormState,
  type HeadlineVerdict,
  MAX_NOTIONAL,
  MIN_NOTIONAL,
  type RunRequest,
  RunRequestSchema,
  type RunResponse,
  SYMBOL_RE,
  type Venue,
  VENUES,
} from "./types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detailMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (typeof err.detail === "string") return err.detail
    if (err.detail && typeof err.detail === "object" && "msg" in err.detail) {
      const msg = (err.detail as { msg?: unknown }).msg
      if (typeof msg === "string") return msg
    }
    return err.message || fallback
  }
  if (err instanceof Error) return err.message || fallback
  return fallback
}

function buildRequest(
  form: FormState,
): { ok: true; value: RunRequest } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {}

  const symbolTrimmed = form.symbol.trim().toUpperCase()
  if (!symbolTrimmed) {
    errors.symbol = "Symbol is required."
  } else if (!SYMBOL_RE.test(symbolTrimmed)) {
    errors.symbol = "Use BASE/QUOTE, e.g. BTC/USDT."
  }

  if (form.venues.length < 1) {
    errors.venues = "Select at least one venue."
  }

  if (
    !Number.isFinite(form.notional_usd) ||
    form.notional_usd < MIN_NOTIONAL ||
    form.notional_usd > MAX_NOTIONAL
  ) {
    errors.notional_usd = `$${MIN_NOTIONAL} - $${MAX_NOTIONAL}.`
  }

  const seed = Number.parseInt(form.seed, 10)
  if (!Number.isFinite(seed) || seed < 0 || seed > 999_999) {
    errors.seed = "0 - 999999."
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  const value: RunRequest = {
    symbol: symbolTrimmed,
    venues: form.venues,
    notional_usd: form.notional_usd,
    fee_profile: form.fee_profile,
    include_transfer_cost: form.include_transfer_cost,
    data_source_pref: form.data_source_pref,
    seed,
  }
  RunRequestSchema.parse(value)
  return { ok: true, value }
}

// ---------------------------------------------------------------------------
// Verdict presentation — the honest headline. The backend's verdict is a pure
// function of the net-edge inference; it is structurally unable to claim a
// feasible edge while net bps are at or below zero (or within noise). We render.
// ---------------------------------------------------------------------------

type VerdictView = {
  badge: string
  headline: string
  body: string
  tone: "neutral" | "positive" | "negative"
}

const VERDICT_VIEWS: Record<HeadlineVerdict, VerdictView> = {
  no_feasible_edge: {
    badge: "No feasible edge",
    headline: "No executable edge after costs",
    body: "Net edge is at or below zero once taker fees (both legs), order-book-depth slippage for the requested notional, and withdrawal/network transfer cost are subtracted. This is the literature-consistent outcome on liquid pairs — the raw spread is a stale-quote / latency-arb artifact a retail REST client cannot win.",
    tone: "negative",
  },
  marginal: {
    badge: "Marginal",
    headline: "Net edge is within noise of zero",
    body: "After fees + depth + transfer the residual edge is too small to distinguish from zero given quote staleness and the cost-sensitivity grid. Not a tradable signal over REST — treat as break-even.",
    tone: "neutral",
  },
  feasible_edge: {
    badge: "Feasible edge",
    headline: "Net edge survives the full cost stack",
    body: "The net executable edge stays positive after fees, depth slippage, and transfer cost across the cost-sensitivity grid. Treat with heavy scepticism: REST staleness and latency competition mean this is rarely capturable in practice.",
    tone: "positive",
  },
}

function verdictView(verdict: string): VerdictView {
  if (verdict in VERDICT_VIEWS) {
    return VERDICT_VIEWS[verdict as HeadlineVerdict]
  }
  return {
    badge: verdict,
    headline: "Verdict",
    body: "Unrecognised verdict identifier returned by the backend.",
    tone: "neutral",
  }
}

const VERDICT_TONE_CLASS: Record<VerdictView["tone"], string> = {
  neutral:
    "border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30",
  positive:
    "border-teal-300 bg-teal-50 dark:border-teal-900/60 dark:bg-teal-950/30",
  negative:
    "border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30",
}

const VERDICT_BADGE_VARIANT: Record<
  VerdictView["tone"],
  "secondary" | "default" | "destructive"
> = {
  neutral: "secondary",
  positive: "default",
  negative: "destructive",
}

// ---------------------------------------------------------------------------
// Data-source badge — provenance after the live → cache → synthetic fallback.
// ---------------------------------------------------------------------------

const DATA_SOURCE_LABEL: Record<DataSource, string> = {
  live: "live books",
  cache: "cached books",
  synthetic: "synthetic books",
}

const DATA_SOURCE_BADGE_CLASS: Record<DataSource, string> = {
  live: "border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-900/60 dark:bg-teal-950/30 dark:text-teal-300",
  cache:
    "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300",
  synthetic:
    "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-300",
}

function DataSourceBadge({ source }: { source: DataSource }) {
  return (
    <Badge
      variant="outline"
      className={`font-mono text-[11px] ${DATA_SOURCE_BADGE_CLASS[source]}`}
    >
      data: {DATA_SOURCE_LABEL[source]}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const INITIAL_FORM: FormState = {
  symbol: DEFAULT_SYMBOL,
  venues: [...VENUES],
  notional_usd: 10_000,
  fee_profile: "default",
  include_transfer_cost: true,
  data_source_pref: "auto",
  seed: "0",
}

export default function CryptoArbScannerTool() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunResponse | null>(null)

  const onRun = useCallback(async () => {
    const built = buildRequest(form)
    if (!built.ok) {
      setFieldErrors(built.errors)
      return
    }
    setFieldErrors({})
    setRunning(true)
    try {
      const data = await apiPost<RunResponse>(
        "/tools/crypto-arb-scanner/run",
        built.value,
      )
      setResult(data)
    } catch (err: unknown) {
      toast.error(detailMessage(err, "Spread decomposition failed."))
    } finally {
      setRunning(false)
    }
  }, [form])

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <Toaster position="top-right" />
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Crypto Arbitrage Scanner
          </h1>
          <p className="text-sm text-muted-foreground">
            Decompose cross-exchange and triangular crypto spreads into a fee-,
            depth-, and transfer-cost-aware gross→net waterfall. The raw spread
            looks profitable; the net executable edge on liquid pairs collapses
            to ~0 after costs.
          </p>
        </div>
        {result ? <DataSourceBadge source={result.data_source} /> : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <SidebarForm
            form={form}
            setForm={setForm}
            fieldErrors={fieldErrors}
            onRun={onRun}
            running={running}
          />
        </aside>

        <section className="space-y-4">
          {running ? (
            <Skeleton className="h-[148px] w-full rounded-xl" />
          ) : result ? (
            <VerdictCard summary={result.summary} />
          ) : (
            <EmptyState message="Configure the pair, venues, and notional, then press Scan." />
          )}

          {running ? (
            <MetricsSkeleton />
          ) : result ? (
            <MetricsGrid summary={result.summary} />
          ) : null}

          {!running && result ? (
            <HonestCaption source={result.data_source} />
          ) : null}

          {running ? (
            <Skeleton className="h-[640px] w-full" />
          ) : result ? (
            <PlotlyChart figure={result.waterfall_figure} />
          ) : null}

          {result ? <PlotlyChart figure={result.spread_figure} /> : null}
        </section>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

type SidebarFormProps = {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  fieldErrors: FieldErrors
  onRun: () => void
  running: boolean
}

function SidebarForm({
  form,
  setForm,
  fieldErrors,
  onRun,
  running,
}: SidebarFormProps) {
  const toggleVenue = (venue: Venue) => {
    setForm((p) => {
      const has = p.venues.includes(venue)
      const venues = has
        ? p.venues.filter((v) => v !== venue)
        : [...p.venues, venue]
      return { ...p, venues }
    })
  }

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Inputs
      </h2>

      <div className="space-y-4">
        <Field
          id="symbol"
          label="Symbol"
          error={fieldErrors.symbol}
          hint="BASE/QUOTE, e.g. BTC/USDT."
        >
          <Input
            id="symbol"
            value={form.symbol}
            onChange={(e) => setForm((p) => ({ ...p, symbol: e.target.value }))}
            onBlur={(e) =>
              setForm((p) => ({ ...p, symbol: e.target.value.toUpperCase() }))
            }
            spellCheck={false}
            className="font-mono uppercase"
            aria-invalid={Boolean(fieldErrors.symbol)}
          />
        </Field>

        <Field id="venues" label="Venues" error={fieldErrors.venues}>
          <div className="grid grid-cols-1 gap-1.5">
            {VENUES.map((venue) => {
              const checked = form.venues.includes(venue)
              return (
                <button
                  key={venue}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggleVenue(venue)}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm capitalize transition-colors ${
                    checked
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-input bg-transparent text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <span>{venue}</span>
                  <span
                    className={`size-3.5 rounded-sm border ${
                      checked
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/40"
                    }`}
                    aria-hidden
                  />
                </button>
              )
            })}
          </div>
        </Field>

        <Field
          id="notional_usd"
          label={`Notional (USD): ${fmtCompact(form.notional_usd)}`}
          error={fieldErrors.notional_usd}
          hint="Order-book depth is walked for this executable size."
        >
          <Slider
            id="notional_usd"
            min={MIN_NOTIONAL}
            max={MAX_NOTIONAL}
            step={100}
            value={[form.notional_usd]}
            onValueChange={(v) =>
              setForm((p) => ({ ...p, notional_usd: v[0] ?? p.notional_usd }))
            }
            aria-label="Notional in US dollars"
            className="py-2"
          />
        </Field>

        <Field id="fee_profile" label="Fee profile">
          <Select
            value={form.fee_profile}
            onValueChange={(v) =>
              setForm((p) => ({
                ...p,
                fee_profile: v as FormState["fee_profile"],
              }))
            }
          >
            <SelectTrigger id="fee_profile" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FEE_PROFILES.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="include_transfer_cost" className="text-sm font-medium">
            Include transfer cost
          </Label>
          <Switch
            id="include_transfer_cost"
            checked={form.include_transfer_cost}
            onCheckedChange={(v) =>
              setForm((p) => ({ ...p, include_transfer_cost: v }))
            }
          />
        </div>

        <Field id="data_source_pref" label="Data source">
          <Select
            value={form.data_source_pref}
            onValueChange={(v) =>
              setForm((p) => ({
                ...p,
                data_source_pref: v as FormState["data_source_pref"],
              }))
            }
          >
            <SelectTrigger id="data_source_pref" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATA_SOURCE_PREFS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field id="seed" label="RNG seed" error={fieldErrors.seed}>
          <Input
            id="seed"
            type="number"
            step="1"
            min={0}
            max={999_999}
            value={form.seed}
            onChange={(e) => setForm((p) => ({ ...p, seed: e.target.value }))}
            aria-invalid={Boolean(fieldErrors.seed)}
          />
        </Field>

        <Button
          type="button"
          onClick={onRun}
          disabled={running}
          className="w-full"
          aria-live="polite"
        >
          {running ? "Scanning..." : "Scan"}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Verdict card — the FIRST thing surfaced.
// ---------------------------------------------------------------------------

function VerdictCard({ summary }: { summary: RunResponse["summary"] }) {
  const view = verdictView(summary.verdict)
  return (
    <Card
      className={`gap-2 border-2 p-5 shadow-none ${VERDICT_TONE_CLASS[view.tone]}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={VERDICT_BADGE_VARIANT[view.tone]}>{view.badge}</Badge>
        <span className="font-mono text-[11px] text-muted-foreground">
          gross {fmtNum(summary.gross_bps, 2)} bps → net{" "}
          {fmtNum(summary.net_bps, 2)} bps - {summary.n_feasible} feasible
          {summary.dominant_cost_leg
            ? ` - top cost: ${summary.dominant_cost_leg}`
            : ""}
        </span>
      </div>
      <h2 className="text-lg font-semibold tracking-tight">{view.headline}</h2>
      <p className="text-sm text-muted-foreground">{view.body}</p>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Honest caption — the prominent, non-negotiable disclaimer.
// ---------------------------------------------------------------------------

function HonestCaption({ source }: { source: DataSource }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-sm">
      <span className="font-medium">
        Net edge collapses after fees + depth + transfer — not executable via
        REST.
      </span>
      <DataSourceBadge source={source} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Presentational helpers
// ---------------------------------------------------------------------------

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[148px] w-full items-center justify-center rounded-xl border border-dashed bg-card text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-[78px] w-full rounded-xl" />
      ))}
    </div>
  )
}

function MetricsGrid({ summary }: { summary: RunResponse["summary"] }) {
  const net = summary.net_bps
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <MetricCard
        label="Gross Spread (bps)"
        value={fmtNum(summary.gross_bps, 2)}
        hint="Sell-VWAP rich − buy-VWAP cheap"
      />
      <MetricCard
        label="Net Edge (bps)"
        value={fmtNum(net, 2)}
        trend={net === null ? "neutral" : net > 0 ? "up" : "down"}
        hint="After fees + depth + transfer"
      />
      <MetricCard
        label="Fillable Notional"
        value={fmtCompact(summary.fillable_notional)}
        hint="Walked from L2 book depth"
      />
      <MetricCard
        label="Dominant Cost Leg"
        value={summary.dominant_cost_leg ?? "—"}
        hint="Largest bps drag"
      />
      <MetricCard
        label="Feasible Routes"
        value={String(summary.n_feasible)}
        trend={summary.n_feasible > 0 ? "up" : "neutral"}
        hint="Net-positive after costs"
      />
    </div>
  )
}

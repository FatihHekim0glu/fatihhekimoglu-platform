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
import { Toaster } from "@/components/ui/sonner"
import MetricCard from "@/components/MetricCard"
import PlotlyChart from "@/components/PlotlyChart"
import { ApiError, apiPost } from "@/lib/api"
import { fmtNum, fmtPct } from "@/lib/format"

import {
  DATA_SOURCE_PREFS,
  DEFAULT_TICKER,
  FEATURE_SETS,
  type FeatureSet,
  type FieldErrors,
  type FormState,
  type HeadlineVerdict,
  N_STATES_OPTIONS,
  type RegimeStat,
  type RunRequest,
  RunRequestSchema,
  type RunResponse,
  TICKER_RE,
} from "./types"

// ---------------------------------------------------------------------------
// Date helpers — default to "today" and "today - 10y" without pulling in dayjs.
// A decade gives the HMM enough regime transitions to characterise.
// ---------------------------------------------------------------------------

function isoDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function defaultEnd(): string {
  return isoDate(new Date())
}

function defaultStart(): string {
  const d = new Date()
  d.setUTCFullYear(d.getUTCFullYear() - 10)
  return isoDate(d)
}

// ---------------------------------------------------------------------------
// Display labels for the feature-set catalogue.
// ---------------------------------------------------------------------------

const FEATURE_SET_LABELS: Record<FeatureSet, string> = {
  returns: "Returns only",
  returns_vol: "Returns + realised vol",
  returns_vol_macro: "Returns + vol + macro",
}

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

  const tickerTrimmed = form.ticker.trim()
  if (!tickerTrimmed) {
    errors.ticker = "Ticker is required."
  } else if (!TICKER_RE.test(tickerTrimmed)) {
    errors.ticker = "Letters, digits, '.', and '-' only."
  }

  if (!form.start) errors.start = "Start date is required."
  if (!form.end) errors.end = "End date is required."
  if (form.start && form.end && form.end <= form.start) {
    errors.end = "End must be after start."
  }

  const costBps = Number.parseFloat(form.cost_bps)
  if (!Number.isFinite(costBps) || costBps < 0 || costBps > 500) {
    errors.cost_bps = "0 - 500 bps."
  }

  const seed = Number.parseInt(form.seed, 10)
  if (!Number.isFinite(seed) || seed < 0 || seed > 999_999) {
    errors.seed = "0 - 999999."
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  const value: RunRequest = {
    ticker: tickerTrimmed.toUpperCase(),
    start: form.start,
    end: form.end,
    n_states: form.n_states,
    feature_set: form.feature_set,
    cost_bps: costBps,
    data_source_pref: form.data_source_pref,
    seed,
  }
  RunRequestSchema.parse(value)
  return { ok: true, value }
}

// ---------------------------------------------------------------------------
// Verdict presentation — the honest headline. The backend's verdict is a PURE
// function of (jk_pvalue, deflated_sharpe): it is structurally unable to claim
// the overlay beats buy-and-hold when Memmel-JK is insignificant or DSR<=0.
// We only render it.
// ---------------------------------------------------------------------------

type VerdictView = {
  badge: string
  headline: string
  body: string
  tone: "neutral" | "positive" | "negative"
}

const VERDICT_VIEWS: Record<HeadlineVerdict, VerdictView> = {
  no_timing_edge: {
    badge: "No timing edge",
    headline: "The regime-timing overlay does NOT beat buy-and-hold",
    body: "Memmel-JK is insignificant (or the deflated Sharpe is non-positive once the correct effective trial count is applied). This is the honest, expected outcome — the HMM cleanly characterises persistent high/low-vol regimes, but timing them is not free money after costs.",
    tone: "neutral",
  },
  marginal: {
    badge: "Marginal",
    headline: "The overlay's edge over buy-and-hold is marginal",
    body: "The Sharpe difference leans positive but the evidence is weak: it sits near the significance threshold and the deflated Sharpe barely survives the effective trial count. In-sample edges like this routinely decay out-of-sample — treat with scepticism.",
    tone: "neutral",
  },
  timing_edge: {
    badge: "Timing edge",
    headline: "The overlay beats buy-and-hold out-of-sample",
    body: "Both Memmel-JK and the deflated Sharpe (with the correct effective trial count) clear their thresholds on the online-filtered signal. Treat with appropriate scepticism given the explored n_states × feature-set × cost grid.",
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
// Component
// ---------------------------------------------------------------------------

const INITIAL_FORM: FormState = {
  ticker: DEFAULT_TICKER,
  start: defaultStart(),
  end: defaultEnd(),
  n_states: 3,
  feature_set: "returns_vol",
  cost_bps: "10",
  data_source_pref: "auto",
  seed: "7",
}

export default function RegimeHmmTool() {
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
        "/tools/regime-hmm/run",
        built.value,
      )
      setResult(data)
    } catch (err: unknown) {
      toast.error(detailMessage(err, "Regime HMM fit failed."))
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
            Market Regime HMM
          </h1>
          <p className="text-sm text-muted-foreground">
            Fit a Gaussian Hidden Markov Model to index returns to label market
            regimes (low-vol bull / high-vol bear / crisis), then honestly test
            whether a regime-timing overlay beats buy-and-hold out-of-sample
            after costs. OOS regime labels come from the online forward filter
            only — smoothed/Viterbi posteriors peek ahead and are EDA-only.
          </p>
        </div>
        {result ? (
          <Badge variant="outline" className="font-mono text-[11px]">
            data: {result.data_source} - {result.summary.n_states} states
          </Badge>
        ) : null}
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
            <EmptyState message="Configure the index and press Run." />
          )}

          {running ? (
            <MetricsSkeleton />
          ) : result ? (
            <MetricsGrid summary={result.summary} />
          ) : null}

          {running ? null : result ? (
            <RegimeStatsTable summary={result.summary} />
          ) : null}

          {running ? (
            <Skeleton className="h-[640px] w-full" />
          ) : result ? (
            <PlotlyChart figure={result.regime_figure} />
          ) : null}

          {running ? (
            <Skeleton className="h-[640px] w-full" />
          ) : result ? (
            <PlotlyChart figure={result.equity_figure} />
          ) : null}
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
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Inputs
      </h2>

      <div className="space-y-4">
        <Field id="ticker" label="Ticker" error={fieldErrors.ticker}>
          <Input
            id="ticker"
            value={form.ticker}
            onChange={(e) => setForm((p) => ({ ...p, ticker: e.target.value }))}
            onBlur={(e) =>
              setForm((p) => ({ ...p, ticker: e.target.value.toUpperCase() }))
            }
            spellCheck={false}
            className="font-mono uppercase"
            aria-invalid={Boolean(fieldErrors.ticker)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field id="start" label="Start" error={fieldErrors.start}>
            <Input
              id="start"
              type="date"
              value={form.start}
              onChange={(e) => setForm((p) => ({ ...p, start: e.target.value }))}
              aria-invalid={Boolean(fieldErrors.start)}
            />
          </Field>
          <Field id="end" label="End" error={fieldErrors.end}>
            <Input
              id="end"
              type="date"
              value={form.end}
              onChange={(e) => setForm((p) => ({ ...p, end: e.target.value }))}
              aria-invalid={Boolean(fieldErrors.end)}
            />
          </Field>
        </div>

        <Field
          id="n_states"
          label="Number of states"
          hint="Hidden regimes the HMM fits (e.g. bull / bear / crisis)."
        >
          <Select
            value={String(form.n_states)}
            onValueChange={(v) =>
              setForm((p) => ({
                ...p,
                n_states: Number.parseInt(v, 10) as FormState["n_states"],
              }))
            }
          >
            <SelectTrigger id="n_states" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {N_STATES_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          id="feature_set"
          label="Feature set"
          hint="Emission features the HMM conditions on."
        >
          <Select
            value={form.feature_set}
            onValueChange={(v) =>
              setForm((p) => ({
                ...p,
                feature_set: v as FormState["feature_set"],
              }))
            }
          >
            <SelectTrigger id="feature_set" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FEATURE_SETS.map((m) => (
                <SelectItem key={m} value={m}>
                  {FEATURE_SET_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          id="cost_bps"
          label="Transaction cost (bps)"
          error={fieldErrors.cost_bps}
          hint="Per-side cost charged when the overlay changes exposure."
        >
          <Input
            id="cost_bps"
            type="number"
            step="1"
            min={0}
            value={form.cost_bps}
            onChange={(e) =>
              setForm((p) => ({ ...p, cost_bps: e.target.value }))
            }
            aria-invalid={Boolean(fieldErrors.cost_bps)}
          />
        </Field>

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
          {running ? "Running..." : "Run"}
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
          diff {fmtNum(summary.sharpe_diff)} - JK p=
          {fmtNum(summary.jk_pvalue, 3)} - DSR{" "}
          {fmtNum(summary.deflated_sharpe, 3)} - {summary.n_effective_trials}{" "}
          trials
        </span>
      </div>
      <h2 className="text-lg font-semibold tracking-tight">{view.headline}</h2>
      <p className="text-sm text-muted-foreground">{view.body}</p>
      <p className="mt-1 text-xs font-medium text-muted-foreground">
        Regimes are real; timing them isn&apos;t free money — the overlay does
        not reliably beat buy-and-hold after costs.
      </p>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Per-regime stats table — the real deliverable: regime characterisation.
// ---------------------------------------------------------------------------

function RegimeStatsTable({ summary }: { summary: RunResponse["summary"] }) {
  const rows = summary.regime_stats ?? []
  if (rows.length === 0) return null
  return (
    <Card className="gap-0 overflow-hidden p-0 shadow-none">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">
          Per-regime characterisation
        </h3>
        <p className="text-xs text-muted-foreground">
          States canonicalised by ascending mean return — stable across folds.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 font-medium">Regime</th>
              <th className="px-4 py-2 text-right font-medium">Mean return</th>
              <th className="px-4 py-2 text-right font-medium">Volatility</th>
              <th className="px-4 py-2 text-right font-medium">Persistence</th>
              <th className="px-4 py-2 text-right font-medium">Avg duration</th>
              <th className="px-4 py-2 text-right font-medium">Frequency</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: RegimeStat) => (
              <tr key={r.state} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">
                  {r.label ?? `State ${r.state}`}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">
                  {fmtPct(r.mean_return)}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">
                  {fmtPct(r.volatility)}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">
                  {fmtNum(r.persistence, 3)}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">
                  {r.duration == null ? "—" : `${fmtNum(r.duration, 1)}d`}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">
                  {fmtPct(r.frequency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
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
  const overlay = summary.overlay_oos_sharpe
  const buyhold = summary.buyhold_oos_sharpe
  const beats =
    overlay !== null && buyhold !== null
      ? overlay > buyhold
        ? "up"
        : "down"
      : "neutral"
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <MetricCard
        label="States"
        value={fmtNum(summary.n_states, 0)}
        hint="Hidden regimes fitted"
      />
      <MetricCard
        label="Overlay OOS Sharpe"
        value={fmtNum(overlay)}
        trend={beats}
        hint="Regime-timing, net of costs"
      />
      <MetricCard
        label="Buy-Hold OOS Sharpe"
        value={fmtNum(buyhold)}
        hint="Passive benchmark"
      />
      <MetricCard
        label="JK p-value"
        value={fmtNum(summary.jk_pvalue, 3)}
        hint="Memmel-corrected Sharpe diff"
      />
      <MetricCard
        label="Deflated Sharpe"
        value={fmtNum(summary.deflated_sharpe, 3)}
        hint={`${summary.n_effective_trials} effective trials`}
      />
    </div>
  )
}

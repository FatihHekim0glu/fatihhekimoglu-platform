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
  DEFAULT_TICKERS,
  type FieldErrors,
  type FormState,
  type RunRequest,
  RunRequestSchema,
  type RunResponse,
  TICKER_LIST_RE,
} from "./types"

// ---------------------------------------------------------------------------
// Date helpers — default to "today" and "today - 5y" without pulling in dayjs.
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
  d.setUTCFullYear(d.getUTCFullYear() - 5)
  return isoDate(d)
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

function parseTickerCount(text: string): number {
  return text
    .replace(/\n/g, ",")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean).length
}

function buildRequest(
  form: FormState,
): { ok: true; value: RunRequest } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {}

  const tickersTrimmed = form.tickers.trim()
  if (!tickersTrimmed) {
    errors.tickers = "Tickers are required."
  } else if (!TICKER_LIST_RE.test(tickersTrimmed)) {
    errors.tickers = "Letters, digits, '.', '-', and commas only."
  } else if (parseTickerCount(tickersTrimmed) < 1) {
    errors.tickers = "Need at least 1 symbol."
  }

  if (!form.start) errors.start = "Start date is required."
  if (!form.end) errors.end = "End date is required."
  if (form.start && form.end && form.end <= form.start) {
    errors.end = "End must be after start."
  }

  const window = Number.parseInt(form.window, 10)
  if (!Number.isInteger(window) || window < 1 || window > 60) {
    errors.window = "1 - 60 days."
  }

  const lag = Number.parseInt(form.lag, 10)
  if (!Number.isInteger(lag) || lag < 1 || lag > 10) {
    errors.lag = "1 - 10 days (signal.shift)."
  }

  const threshold = Number.parseFloat(form.threshold)
  if (!Number.isFinite(threshold) || threshold < -1 || threshold > 1) {
    errors.threshold = "-1 - 1 (z-score cutoff)."
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
    tickers: tickersTrimmed,
    start: form.start,
    end: form.end,
    window,
    lag,
    threshold,
    cost_bps: costBps,
    data_source_pref: form.data_source_pref,
    seed,
  }
  RunRequestSchema.parse(value)
  return { ok: true, value }
}

// ---------------------------------------------------------------------------
// Verdict presentation — the honest headline. The backend's `signal_has_edge`
// is a PURE function of (OOS net Sharpe, deflated Sharpe, PBO, HAC t-stat net
// of costs); we only render it. The credible-null default is NO edge.
// ---------------------------------------------------------------------------

type VerdictView = {
  badge: string
  badgeVariant: "default" | "destructive"
  headline: string
  body: string
  toneClass: string
}

function verdictView(hasEdge: boolean): VerdictView {
  if (hasEdge) {
    return {
      badge: "Signal has edge: YES",
      badgeVariant: "default",
      headline: "The WSB sentiment signal beats buy-and-hold out-of-sample",
      body: "All gates agree: the deflated Sharpe clears zero, PBO is low, and the HAC t-stat is significant net of per-side costs. Treat with appropriate scepticism given the swept lexicon x window x lag x threshold x cost grid — and the Pushshift coverage / deletion bias and PIT-survivorship caveats.",
      toneClass:
        "border-teal-300 bg-teal-50 dark:border-teal-900/60 dark:bg-teal-950/30",
    }
  }
  return {
    badge: "Signal has edge: NO",
    badgeVariant: "destructive",
    headline: "The WSB sentiment signal does NOT beat buy-and-hold after costs",
    body: "This is the credible weak/negative outcome. A naive VADER WSB daily-sentiment signal shows mild IN-SAMPLE correlation with next-day returns that is dominated by contemporaneous attention/return feedback and LARGELY DECAYS out-of-sample — failing the Deflated Sharpe and per-side cost hurdles. Attention feedback, not alpha.",
    toneClass:
      "border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30",
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const INITIAL_FORM: FormState = {
  tickers: DEFAULT_TICKERS,
  start: defaultStart(),
  end: defaultEnd(),
  window: "1",
  lag: "1",
  threshold: "0.0",
  cost_bps: "10",
  data_source_pref: "synthetic",
  seed: "7",
}

export default function WsbSentimentSignalTool() {
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
        "/tools/wsb-sentiment-signal/run",
        built.value,
      )
      setResult(data)
    } catch (err: unknown) {
      toast.error(detailMessage(err, "WSB sentiment backtest failed."))
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
            WSB Sentiment Signal
          </h1>
          <p className="text-sm text-muted-foreground">
            Turn r/wallstreetbets chatter into a daily per-ticker sentiment
            signal and honestly test whether it predicts next-day returns on a
            point-in-time S&amp;P 500 universe — with a Deflated Sharpe,
            PBO/CSCV, and Newey-West HAC inference, net of per-side costs.
          </p>
        </div>
        {result ? (
          <Badge variant="outline" className="font-mono text-[11px]">
            data: {result.data_source} - {result.summary.n_effective_trials}{" "}
            eff. trials
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
            <EmptyState message="Configure the universe and press Run." />
          )}

          {running ? (
            <MetricsSkeleton />
          ) : result ? (
            <MetricsGrid summary={result.summary} />
          ) : null}

          {running ? (
            <Skeleton className="h-[640px] w-full" />
          ) : result ? (
            <PlotlyChart figure={result.equity_figure} />
          ) : null}

          {result ? <PlotlyChart figure={result.sentiment_figure} /> : null}
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
        <Field id="tickers" label="Tickers" error={fieldErrors.tickers}>
          <textarea
            id="tickers"
            value={form.tickers}
            onChange={(e) => setForm((p) => ({ ...p, tickers: e.target.value }))}
            onBlur={(e) =>
              setForm((p) => ({ ...p, tickers: e.target.value.toUpperCase() }))
            }
            rows={3}
            spellCheck={false}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs uppercase shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            aria-invalid={Boolean(fieldErrors.tickers)}
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
          id="window"
          label="Aggregation window (days)"
          error={fieldErrors.window}
          hint="Trailing window for the daily sentiment rollup."
        >
          <Input
            id="window"
            type="number"
            step="1"
            min={1}
            max={60}
            value={form.window}
            onChange={(e) => setForm((p) => ({ ...p, window: e.target.value }))}
            aria-invalid={Boolean(fieldErrors.window)}
          />
        </Field>

        <Field
          id="lag"
          label="Signal lag (days)"
          error={fieldErrors.lag}
          hint="signal.shift(lag) — as-of cutoff is the prior session close."
        >
          <Input
            id="lag"
            type="number"
            step="1"
            min={1}
            max={10}
            value={form.lag}
            onChange={(e) => setForm((p) => ({ ...p, lag: e.target.value }))}
            aria-invalid={Boolean(fieldErrors.lag)}
          />
        </Field>

        <Field
          id="threshold"
          label="Entry threshold (z)"
          error={fieldErrors.threshold}
          hint="Standardised-sentiment cutoff for taking a position."
        >
          <Input
            id="threshold"
            type="number"
            step="0.1"
            min={-1}
            max={1}
            value={form.threshold}
            onChange={(e) =>
              setForm((p) => ({ ...p, threshold: e.target.value }))
            }
            aria-invalid={Boolean(fieldErrors.threshold)}
          />
        </Field>

        <Field
          id="cost_bps"
          label="Transaction cost (bps)"
          error={fieldErrors.cost_bps}
          hint="Per-side turnover cost in basis points."
        >
          <Input
            id="cost_bps"
            type="number"
            step="1"
            min={0}
            max={500}
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
// Verdict card — the FIRST thing surfaced. Destructive when no edge.
// ---------------------------------------------------------------------------

function VerdictCard({ summary }: { summary: RunResponse["summary"] }) {
  const view = verdictView(summary.signal_has_edge)
  return (
    <Card className={`gap-2 border-2 p-5 shadow-none ${view.toneClass}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={view.badgeVariant}>{view.badge}</Badge>
        <span className="font-mono text-[11px] text-muted-foreground">
          net Sharpe {fmtNum(summary.net_sharpe)} - DSR{" "}
          {fmtNum(summary.deflated_sharpe, 3)} - PBO {fmtNum(summary.pbo, 3)} -
          HAC t={fmtNum(summary.hac_tstat)} (p={fmtNum(summary.hac_pvalue, 3)})
        </span>
      </div>
      <h2 className="text-lg font-semibold tracking-tight">{view.headline}</h2>
      <p className="text-sm text-muted-foreground">{view.body}</p>
      <p className="text-xs font-medium text-muted-foreground">
        Mild in-sample correlation that decays out-of-sample after costs —
        attention feedback, not alpha.
      </p>
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-[78px] w-full rounded-xl" />
      ))}
    </div>
  )
}

function MetricsGrid({ summary }: { summary: RunResponse["summary"] }) {
  const net = summary.net_sharpe
  const buyhold = summary.buyhold_sharpe
  const beatsBuyhold =
    net !== null && buyhold !== null ? net > buyhold : null
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <MetricCard
        label="Net Sharpe (Signal)"
        value={fmtNum(net)}
        trend={
          beatsBuyhold === null ? "neutral" : beatsBuyhold ? "up" : "down"
        }
        hint="Out-of-sample, net of costs"
      />
      <MetricCard
        label="Buy-Hold Sharpe"
        value={fmtNum(buyhold)}
        hint="Benchmark"
      />
      <MetricCard
        label="Deflated Sharpe"
        value={fmtNum(summary.deflated_sharpe, 3)}
        trend={
          summary.deflated_sharpe === null
            ? "neutral"
            : summary.deflated_sharpe > 0
              ? "up"
              : "down"
        }
        hint={`${summary.n_effective_trials} effective trials`}
      />
      <MetricCard
        label="PBO"
        value={fmtNum(summary.pbo, 3)}
        trend={
          summary.pbo === null ? "neutral" : summary.pbo < 0.5 ? "up" : "down"
        }
        hint="Prob. of backtest overfitting"
      />
      <MetricCard
        label="HAC t-stat"
        value={fmtNum(summary.hac_tstat)}
        hint={`Newey-West, p=${fmtNum(summary.hac_pvalue, 3)}`}
      />
      <MetricCard
        label="Turnover"
        value={fmtPct(summary.turnover)}
        hint="Drives the per-side cost drag"
      />
    </div>
  )
}

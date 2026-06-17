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
  type FieldErrors,
  type FormState,
  type RunRequest,
  RunRequestSchema,
  type RunResponse,
  TICKER_RE,
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

  const lookback = Number.parseInt(form.lookback, 10)
  if (!Number.isInteger(lookback) || lookback < 2 || lookback > 512) {
    errors.lookback = "2 - 512 days."
  }

  const horizon = Number.parseInt(form.horizon, 10)
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 30) {
    errors.horizon = "1 - 30 days."
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
    lookback,
    horizon,
    data_source_pref: form.data_source_pref,
    seed,
  }
  RunRequestSchema.parse(value)
  return { ok: true, value }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const INITIAL_FORM: FormState = {
  ticker: DEFAULT_TICKER,
  start: defaultStart(),
  end: defaultEnd(),
  lookback: "60",
  horizon: "1",
  data_source_pref: "synthetic",
  seed: "7",
}

export default function LstmForecastTool() {
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
        "/tools/lstm-forecast/run",
        built.value,
      )
      setResult(data)
    } catch (err: unknown) {
      toast.error(detailMessage(err, "LSTM forecast run failed."))
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
            LSTM Stock Forecast (Done Properly)
          </h1>
          <p className="text-sm text-muted-foreground">
            A leakage-free rebuild of the classic LSTM stock-price-prediction
            project — predict next-day RETURNS (not price levels), validate with
            a purged + embargoed walk-forward, fit the scaler on the train fold
            only, and honestly benchmark against a random-walk / persistence
            baseline.
          </p>
        </div>
        {result ? (
          <Badge variant="outline" className="font-mono text-[11px]">
            data: {result.data_source} - lookback {form.lookback} - horizon{" "}
            {form.horizon}
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
            <Skeleton className="h-[164px] w-full rounded-xl" />
          ) : result ? (
            <VerdictCard summary={result.summary} />
          ) : (
            <EmptyState message="Configure the forecast and press Run." />
          )}

          {running ? (
            <MetricsSkeleton />
          ) : result ? (
            <MetricsGrid summary={result.summary} />
          ) : null}

          {running ? (
            <Skeleton className="h-[640px] w-full" />
          ) : result ? (
            <PlotlyChart figure={result.forecast_figure} />
          ) : null}

          {result ? (
            <PlotlyChart figure={result.error_vs_baseline_figure} />
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
        <Field
          id="ticker"
          label="Ticker"
          error={fieldErrors.ticker}
          hint="Label only — the shipped model trains on synthetic random-walk data."
        >
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
          id="lookback"
          label="Lookback window (days)"
          error={fieldErrors.lookback}
          hint="Sequence length fed to the LSTM; also the purge gap so no window straddles a split."
        >
          <Input
            id="lookback"
            type="number"
            step="1"
            min={2}
            max={512}
            value={form.lookback}
            onChange={(e) =>
              setForm((p) => ({ ...p, lookback: e.target.value }))
            }
            aria-invalid={Boolean(fieldErrors.lookback)}
          />
        </Field>

        <Field
          id="horizon"
          label="Forecast horizon (days)"
          error={fieldErrors.horizon}
          hint="Next-day log-return is the target; horizon > 1 chains one-step forecasts."
        >
          <Input
            id="horizon"
            type="number"
            step="1"
            min={1}
            max={30}
            value={form.horizon}
            onChange={(e) => setForm((p) => ({ ...p, horizon: e.target.value }))}
            aria-invalid={Boolean(fieldErrors.horizon)}
          />
        </Field>

        <Field
          id="data_source_pref"
          label="Data source"
          hint="No API keys here — both options resolve to a seeded synthetic random walk."
        >
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
// Verdict card — the FIRST thing surfaced. The honest NULL headline.
//
// `beats_naive` is a pure function of the inference on the backend; we only
// render it. On a synthetic random walk it is FALSE by construction, which is
// exactly the documented deliverable.
// ---------------------------------------------------------------------------

function VerdictCard({ summary }: { summary: RunResponse["summary"] }) {
  const beats = summary.beats_naive
  const toneClass = beats
    ? "border-teal-300 bg-teal-50 dark:border-teal-900/60 dark:bg-teal-950/30"
    : "border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30"

  return (
    <Card className={`gap-2 border-2 p-5 shadow-none ${toneClass}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={beats ? "default" : "destructive"}
          className="text-sm"
        >
          Beats naive baseline: {beats ? "YES" : "NO"}
        </Badge>
        <Badge variant="outline" className="font-mono text-[11px]">
          data: {summary.data_source}
        </Badge>
        <span className="font-mono text-[11px] text-muted-foreground">
          MASE {fmtNum(summary.mase_vs_persistence, 3)} - DM p=
          {fmtNum(summary.dm_pvalue, 3)} - dir acc{" "}
          {fmtPct(summary.directional_accuracy)} - {summary.n_effective_trials}{" "}
          effective trials
        </span>
      </div>
      <h2 className="text-lg font-semibold tracking-tight">
        {beats
          ? "The LSTM significantly beats persistence out-of-sample"
          : "The LSTM does NOT beat naive persistence"}
      </h2>
      <p className="text-sm text-muted-foreground">
        {beats
          ? "MASE < 1, the Diebold-Mariano test is significant, and directional accuracy is robustly above 0.5. Treat with appropriate scepticism given the explored configuration grid."
          : "Out-of-sample, the return-space error does not beat a random walk (MASE >= 1) and the Diebold-Mariano test is insignificant. This is the correct, literature-backed null — predicting next-day returns, a leakage-free LSTM cannot beat persistence on a random walk."}
      </p>
      <p className="text-xs font-medium text-muted-foreground">
        Predicts returns, not prices; no price-level R²; does not beat a random
        walk.
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
    <div className="flex h-[164px] w-full items-center justify-center rounded-xl border border-dashed bg-card text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[78px] w-full rounded-xl" />
      ))}
    </div>
  )
}

function MetricsGrid({ summary }: { summary: RunResponse["summary"] }) {
  const mase = summary.mase_vs_persistence
  const dir = summary.directional_accuracy
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricCard
        label="Return RMSE"
        value={fmtNum(summary.rmse_return, 5)}
        hint="Out-of-sample, return space"
      />
      <MetricCard
        label="MASE vs Persistence"
        value={fmtNum(mase, 3)}
        trend={mase === null ? "neutral" : mase < 1 ? "up" : "down"}
        hint=">= 1 means it does not beat the naive floor"
      />
      <MetricCard
        label="Directional Accuracy"
        value={fmtPct(dir)}
        trend={dir === null ? "neutral" : dir > 0.5 ? "up" : "down"}
        hint="Sign hit-rate vs 50% coin flip"
      />
      <MetricCard
        label="DM p-value"
        value={fmtNum(summary.dm_pvalue, 3)}
        hint="Diebold-Mariano vs random walk"
      />
    </div>
  )
}

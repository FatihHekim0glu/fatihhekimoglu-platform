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
import { Toaster } from "@/components/ui/sonner"
import MetricCard from "@/components/MetricCard"
import PlotlyChart from "@/components/PlotlyChart"
import { ApiError, apiPost } from "@/lib/api"
import { fmtDate, fmtNum } from "@/lib/format"

import {
  DATA_SOURCE_PREFS,
  DEFAULT_TICKER,
  DETECTORS,
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
    errors.ticker = "A ticker is required."
  } else if (!TICKER_RE.test(tickerTrimmed)) {
    errors.ticker = "Letters, digits, '.', and '-' only."
  }

  if (!form.start) errors.start = "Start date is required."
  if (!form.end) errors.end = "End date is required."
  if (form.start && form.end && form.end <= form.start) {
    errors.end = "End must be after start."
  }

  const window = Number.parseInt(form.window, 10)
  if (!Number.isInteger(window) || window < 2 || window > 252) {
    errors.window = "2 - 252 days."
  }

  const seed = Number.parseInt(form.seed, 10)
  if (!Number.isFinite(seed) || seed < 0 || seed > 999_999) {
    errors.seed = "0 - 999999."
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  const value: RunRequest = {
    ticker: tickerTrimmed,
    start: form.start,
    end: form.end,
    detector: form.detector,
    contamination: form.contamination,
    window,
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
  detector: "both",
  contamination: 0.02,
  window: "21",
  data_source_pref: "auto",
  seed: "7",
}

export default function AnomalyDetectorTool() {
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
        "/tools/anomaly-detector/run",
        built.value,
      )
      setResult(data)
    } catch (err: unknown) {
      toast.error(detailMessage(err, "Anomaly scan failed."))
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
            Market Anomaly Detector
          </h1>
          <p className="text-sm text-muted-foreground">
            Two independent unsupervised detectors — an Isolation Forest and a
            PCA reconstruction-error autoencoder — flag anomalous trading days
            under a strictly causal walk-forward refit. They agree on a core of
            known stress dates, but the flags are diagnostic, not tradable.
          </p>
        </div>
        {result ? (
          <Badge variant="outline" className="font-mono text-[11px]">
            data: {result.data_source} - {result.summary.n_flags} flags -{" "}
            {result.summary.detector}
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
            <MetricsSkeleton />
          ) : result ? (
            <MetricsGrid summary={result.summary} />
          ) : (
            <EmptyState message="Configure the scan and press Run." />
          )}

          {running ? (
            <Skeleton className="h-[148px] w-full rounded-xl" />
          ) : result ? (
            <HonestCaption dataSource={result.data_source} />
          ) : null}

          {running ? (
            <Skeleton className="h-[220px] w-full rounded-xl" />
          ) : result ? (
            <TopAnomalyDates dates={result.summary.top_anomaly_dates} />
          ) : null}

          {running ? (
            <Skeleton className="h-[640px] w-full" />
          ) : result ? (
            <PlotlyChart figure={result.price_figure} />
          ) : null}

          {running ? (
            <Skeleton className="h-[640px] w-full" />
          ) : result ? (
            <PlotlyChart figure={result.score_figure} />
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
          id="detector"
          label="Detector"
          hint="Run one detector or both; agreement metrics need both."
        >
          <Select
            value={form.detector}
            onValueChange={(v) =>
              setForm((p) => ({ ...p, detector: v as FormState["detector"] }))
            }
          >
            <SelectTrigger id="detector" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DETECTORS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          id="contamination"
          label={`Contamination (${(form.contamination * 100).toFixed(1)}%)`}
          hint="Expected fraction of anomalous days; sets the flag threshold."
        >
          <Slider
            id="contamination"
            value={[form.contamination]}
            min={0.005}
            max={0.2}
            step={0.005}
            onValueChange={(v) =>
              setForm((p) => ({ ...p, contamination: v[0] ?? p.contamination }))
            }
            className="py-2"
          />
        </Field>

        <Field
          id="window"
          label="Rolling window (days)"
          error={fieldErrors.window}
          hint="Causal window for the realized-vol and z-score features."
        >
          <Input
            id="window"
            type="number"
            step="1"
            min={2}
            max={252}
            value={form.window}
            onChange={(e) => setForm((p) => ({ ...p, window: e.target.value }))}
            aria-invalid={Boolean(fieldErrors.window)}
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
// Honest caption — the descriptive verdict. Flags are NOT a tradable signal.
// ---------------------------------------------------------------------------

function HonestCaption({
  dataSource,
}: {
  dataSource: RunResponse["data_source"]
}) {
  return (
    <Card className="gap-2 border-2 border-amber-300 bg-amber-50 p-5 shadow-none dark:border-amber-900/60 dark:bg-amber-950/30">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">Diagnostic, not tradable</Badge>
        <Badge variant="outline" className="font-mono text-[11px]">
          data: {dataSource}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Flags are diagnostic, not tradable — there is no ground-truth anomaly
        label. The two detectors agree on a core of known macro-stress dates,
        but day-level agreement is modest and precision against a naive
        |z-return| &gt; 3 proxy label is low. No alpha is claimed.
      </p>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Top anomaly dates — the flagged days, most anomalous first.
// ---------------------------------------------------------------------------

function TopAnomalyDates({ dates }: { dates: string[] }) {
  return (
    <Card className="gap-3 p-5 shadow-none">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Top anomaly dates
        </h2>
        <Badge variant="outline" className="font-mono text-[11px]">
          {dates.length} shown
        </Badge>
      </div>
      {dates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No anomalous days flagged under this configuration.
        </p>
      ) : (
        <ol className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
          {dates.map((d, i) => (
            <li
              key={d}
              className="flex items-baseline gap-2 font-mono text-sm tabular-nums"
            >
              <span className="w-5 text-right text-[11px] text-muted-foreground">
                {i + 1}
              </span>
              <span>{fmtDate(d)}</span>
            </li>
          ))}
        </ol>
      )}
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[78px] w-full rounded-xl" />
      ))}
    </div>
  )
}

function MetricsGrid({ summary }: { summary: RunResponse["summary"] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricCard
        label="Flags"
        value={String(summary.n_flags)}
        hint="Anomalous trading days"
      />
      <MetricCard
        label="Jaccard Agreement"
        value={fmtNum(summary.jaccard, 3)}
        hint="Overlap of the two detectors' flags"
      />
      <MetricCard
        label="Proxy Precision"
        value={fmtNum(summary.proxy_precision, 3)}
        hint="vs |z-return| > 3 proxy label"
      />
      <MetricCard
        label="Proxy Recall"
        value={fmtNum(summary.proxy_recall, 3)}
        hint="vs |z-return| > 3 proxy label"
      />
    </div>
  )
}

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
import { fmtNum } from "@/lib/format"

import {
  DATA_SOURCE_PREFS,
  DEFAULT_MODELS,
  DEFAULT_TICKER,
  type FieldErrors,
  type FormState,
  type Horizon,
  HORIZONS,
  type Model,
  MODEL_LABELS,
  MODELS,
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

function modelLabel(key: string): string {
  return key in MODEL_LABELS ? MODEL_LABELS[key as Model] : key
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

  if (form.models.length === 0) {
    errors.models = "Select at least one model."
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
    horizon: form.horizon,
    models: form.models,
    cost_bps: costBps,
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
  horizon: 5,
  models: DEFAULT_MODELS,
  cost_bps: "10",
  data_source_pref: "auto",
  seed: "7",
}

export default function VolforecastTool() {
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
        "/tools/volforecast/run",
        built.value,
      )
      setResult(data)
    } catch (err: unknown) {
      toast.error(detailMessage(err, "Volatility forecast run failed."))
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
            GARCH vs ML Volatility Forecast
          </h1>
          <p className="text-sm text-muted-foreground">
            Forecast h-day-ahead realized volatility and honestly test whether
            XGBoost beats a well-specified GARCH(1,1)/HAR-RV out-of-sample —
            QLIKE loss, Diebold-Mariano pairwise tests, and a Hansen SPA test
            across the whole model set to control snooping.
          </p>
        </div>
        {result ? (
          <Badge variant="outline" className="font-mono text-[11px]">
            data: {result.summary.data_source} -{" "}
            {result.summary.n_effective_trials} trials
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
            <Skeleton className="h-[172px] w-full rounded-xl" />
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

          {running ? (
            <Skeleton className="h-[280px] w-full rounded-xl" />
          ) : result ? (
            <QlikeTable summary={result.summary} />
          ) : null}

          {running ? (
            <Skeleton className="h-[640px] w-full" />
          ) : result ? (
            <PlotlyChart figure={result.forecast_figure} />
          ) : null}

          {result ? <PlotlyChart figure={result.error_figure} /> : null}
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
  const toggleModel = (model: Model) => {
    setForm((p) => {
      const has = p.models.includes(model)
      const models = has
        ? p.models.filter((m) => m !== model)
        : [...p.models, model]
      return { ...p, models }
    })
  }

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
          hint="A single index/ETF, e.g. SPY."
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
          id="horizon"
          label="Horizon (trading days)"
          hint="h-day-ahead realized volatility target."
        >
          <Select
            value={String(form.horizon)}
            onValueChange={(v) =>
              setForm((p) => ({
                ...p,
                horizon: Number.parseInt(v, 10) as Horizon,
              }))
            }
          >
            <SelectTrigger id="horizon" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HORIZONS.map((h) => (
                <SelectItem key={h} value={String(h)}>
                  {h === 1 ? "1 day" : h === 5 ? "5 days (weekly)" : "22 days (monthly)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field id="models" label="Models" error={fieldErrors.models}>
          <div className="grid grid-cols-1 gap-1.5">
            {MODELS.map((model) => {
              const checked = form.models.includes(model)
              return (
                <button
                  key={model}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggleModel(model)}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors ${
                    checked
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-input bg-transparent text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <span>{MODEL_LABELS[model]}</span>
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
          id="cost_bps"
          label="Transaction cost (bps)"
          error={fieldErrors.cost_bps}
          hint="Cost for the optional vol-targeting overlay."
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
// Verdict card — the FIRST thing surfaced. The "ML beats GARCH" verdict is a
// pure function of OOS QLIKE + SPA/DM significance, computed by the backend; we
// only render it. The honest null says ml_beats_garch is false.
// ---------------------------------------------------------------------------

function VerdictCard({ summary }: { summary: RunResponse["summary"] }) {
  const beats = summary.ml_beats_garch
  const toneClass = beats
    ? "border-teal-300 bg-teal-50 dark:border-teal-900/60 dark:bg-teal-950/30"
    : "border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30"

  return (
    <Card className={`gap-2 border-2 p-5 shadow-none ${toneClass}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={beats ? "default" : "destructive"}>
          ML beats GARCH: {beats ? "YES" : "NO"}
        </Badge>
        <span className="font-mono text-[11px] text-muted-foreground">
          best {modelLabel(summary.best_model)} - SPA p=
          {fmtNum(summary.spa_pvalue, 3)} - {summary.n_effective_trials} trials
        </span>
      </div>
      <h2 className="text-lg font-semibold tracking-tight">
        {beats
          ? "ML beats GARCH/HAR-RV out-of-sample (SPA-significant)"
          : "GARCH/HAR-RV is NOT significantly beaten by ML"}
      </h2>
      <p className="text-sm text-muted-foreground">
        {beats
          ? "Across the model set, the lowest-QLIKE model is ML and it clears the Hansen-SPA / Diebold-Mariano significance bar against GARCH/HAR-RV. Treat with appropriate scepticism given the configuration grid (n_effective_trials)."
          : "The lowest-QLIKE model does not clear the Hansen-SPA / Diebold-Mariano significance bar against GARCH/HAR-RV. This is the literature-consistent outcome (Hansen & Lunde 2005)."}
      </p>
      <p className="text-xs font-medium text-muted-foreground">
        GARCH(1,1) is hard to beat — ML wins only marginally if at all.
      </p>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// QLIKE table — per-model OOS QLIKE / MSE / DM p-value vs the best model.
// ---------------------------------------------------------------------------

function QlikeTable({ summary }: { summary: RunResponse["summary"] }) {
  const rows = Object.keys(summary.qlike_by_model)
    .map((key) => ({
      key,
      qlike: summary.qlike_by_model[key] ?? null,
      mse: summary.mse_by_model[key] ?? null,
      dm: summary.dm_pvalues[key] ?? null,
      isBest: key === summary.best_model,
    }))
    .sort((a, b) => {
      const av = a.qlike ?? Number.POSITIVE_INFINITY
      const bv = b.qlike ?? Number.POSITIVE_INFINITY
      return av - bv
    })

  return (
    <Card className="gap-3 p-4 shadow-none">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">
          Out-of-sample loss by model
        </h2>
        <span className="text-[11px] text-muted-foreground">
          Lower QLIKE is better - DM p-value is vs the best model
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Model</th>
              <th className="py-2 pr-3 text-right font-medium">QLIKE</th>
              <th className="py-2 pr-3 text-right font-medium">MSE</th>
              <th className="py-2 text-right font-medium">DM p (vs best)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b last:border-0">
                <td className="py-2 pr-3">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{modelLabel(r.key)}</span>
                    {r.isBest ? (
                      <Badge variant="secondary" className="text-[10px]">
                        best
                      </Badge>
                    ) : null}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums">
                  {fmtNum(r.qlike, 4)}
                </td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums">
                  {fmtNum(r.mse, 6)}
                </td>
                <td className="py-2 text-right font-mono tabular-nums">
                  {r.isBest ? "—" : fmtNum(r.dm, 3)}
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
    <div className="flex h-[172px] w-full items-center justify-center rounded-xl border border-dashed bg-card text-sm text-muted-foreground">
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
  const garchQlike = summary.qlike_by_model.garch ?? null
  const xgbQlike = summary.qlike_by_model.xgboost ?? null
  const mlEdge =
    garchQlike !== null && xgbQlike !== null ? garchQlike - xgbQlike : null

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricCard
        label="Best Model"
        value={modelLabel(summary.best_model)}
        hint="Lowest OOS QLIKE"
      />
      <MetricCard
        label="GARCH QLIKE"
        value={fmtNum(garchQlike, 4)}
        hint="The hard-to-beat baseline"
      />
      <MetricCard
        label="XGBoost QLIKE"
        value={fmtNum(xgbQlike, 4)}
        trend={mlEdge === null ? "neutral" : mlEdge > 0 ? "up" : "down"}
        hint={
          mlEdge === null
            ? "OOS QLIKE"
            : mlEdge > 0
              ? "lower than GARCH"
              : "no better than GARCH"
        }
      />
      <MetricCard
        label="SPA p-value"
        value={fmtNum(summary.spa_pvalue, 3)}
        hint="Hansen SPA over model set"
      />
    </div>
  )
}

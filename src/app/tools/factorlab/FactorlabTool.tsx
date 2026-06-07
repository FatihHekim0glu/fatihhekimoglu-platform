"use client"

import { useCallback, useMemo, useState } from "react"
import type { Dispatch, ReactNode, SetStateAction } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Switch } from "@/components/ui/switch"
import { Toaster } from "@/components/ui/sonner"
import MetricCard, { type MetricTrend } from "@/components/MetricCard"
import PlotlyChart from "@/components/PlotlyChart"
import { ApiError, apiPost } from "@/lib/api"
import { fmtNum, fmtPct } from "@/lib/format"
import { cn } from "@/lib/utils"

import {
  type CoefficientRow,
  type FieldErrors,
  type FormState,
  FREQUENCY_OPTIONS,
  type Frequency,
  MODEL_OPTIONS,
  type ModelName,
  type RollingBetaFigure,
  type RunRequest,
  RunRequestSchema,
  type RunResponse,
  type Summary,
  TICKER_RE,
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

function trendOf(value: number | null | undefined): MetricTrend {
  if (value === null || value === undefined || !Number.isFinite(value)) return "neutral"
  if (value > 0) return "up"
  if (value < 0) return "down"
  return "neutral"
}

function buildRequest(
  form: FormState,
): { ok: true; value: RunRequest } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {}
  const ticker = form.ticker.trim().toUpperCase()
  if (!ticker) {
    errors.ticker = "Ticker is required."
  } else if (!TICKER_RE.test(ticker)) {
    errors.ticker = "Letters, digits, '.', '-' only (1-15 chars)."
  }
  if (!form.start) errors.start = "Start date is required."
  if (!form.end) errors.end = "End date is required."
  if (form.start && form.end && form.end <= form.start) {
    errors.end = "End date must be after start date."
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  const value: RunRequest = {
    ticker,
    model: form.model,
    frequency: form.frequency,
    start: form.start,
    end: form.end,
    hac: form.hac,
  }
  RunRequestSchema.parse(value)
  return { ok: true, value }
}

// ---------------------------------------------------------------------------
// Defaults — mirror the source streamlit defaults from the recon.
// ---------------------------------------------------------------------------

const DEFAULT_FORM: FormState = {
  ticker: "BRK-B",
  model: "FF3",
  frequency: "M",
  start: "2014-01-01",
  end: "2024-12-31",
  hac: true,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FactorlabTool() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
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
      const data = await apiPost<RunResponse>("/tools/factorlab/run", built.value)
      setResult(data)
    } catch (err: unknown) {
      toast.error(detailMessage(err, "Request failed."))
    } finally {
      setRunning(false)
    }
  }, [form])

  const headerBadge = useMemo(() => {
    if (!result) return null
    return `${result.summary.ticker} · ${result.summary.model} · ${result.summary.nobs} obs`
  }, [result])

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <Toaster position="top-right" />
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Factorlab</h1>
          <p className="text-sm text-muted-foreground">
            Fama-French factor regressions with HAC standard errors, rolling
            betas, and a plain-English interpretation.
          </p>
        </div>
        {headerBadge ? (
          <Badge variant="outline" className="font-mono text-[11px]">
            {headerBadge}
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
            <>
              <MetricsSkeleton />
              <Skeleton className="h-[200px] w-full" />
              <Skeleton className="h-[420px] w-full" />
            </>
          ) : result ? (
            <Results result={result} />
          ) : (
            <EmptyState message="Configure inputs and press Run." />
          )}
        </section>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Sidebar form
// ---------------------------------------------------------------------------

type SidebarFormProps = {
  form: FormState
  setForm: Dispatch<SetStateAction<FormState>>
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
              setForm((p) => ({ ...p, ticker: e.target.value.trim().toUpperCase() }))
            }
            autoComplete="off"
            spellCheck={false}
            className="font-mono uppercase"
            aria-invalid={Boolean(fieldErrors.ticker)}
          />
        </Field>

        <Field id="model" label="Model">
          <Select
            value={form.model}
            onValueChange={(v) =>
              setForm((p) => ({ ...p, model: v as ModelName }))
            }
          >
            <SelectTrigger id="model" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODEL_OPTIONS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field id="frequency" label="Frequency" hint="Monthly is the safe default.">
          <Select
            value={form.frequency}
            onValueChange={(v) =>
              setForm((p) => ({ ...p, frequency: v as Frequency }))
            }
          >
            <SelectTrigger id="frequency" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCY_OPTIONS.map((f) => (
                <SelectItem key={f} value={f}>
                  {f === "M" ? "Monthly" : "Daily"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field id="start" label="Start date" error={fieldErrors.start}>
          <Input
            id="start"
            type="date"
            value={form.start}
            onChange={(e) => setForm((p) => ({ ...p, start: e.target.value }))}
            aria-invalid={Boolean(fieldErrors.start)}
          />
        </Field>

        <Field id="end" label="End date" error={fieldErrors.end}>
          <Input
            id="end"
            type="date"
            value={form.end}
            onChange={(e) => setForm((p) => ({ ...p, end: e.target.value }))}
            aria-invalid={Boolean(fieldErrors.end)}
          />
        </Field>

        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="hac" className="text-sm font-medium">
            HAC (Newey-West) SE
          </Label>
          <Switch
            id="hac"
            checked={form.hac}
            onCheckedChange={(v) => setForm((p) => ({ ...p, hac: v }))}
          />
        </div>

        <Button
          type="button"
          onClick={onRun}
          disabled={running}
          className="w-full"
          aria-live="polite"
        >
          {running ? "Running..." : "Run"}
        </Button>

        <p className="text-[11px] text-muted-foreground">
          First run fetches Ken French factor data (~25-day on-disk cache).
        </p>
      </div>
    </div>
  )
}

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
  children: ReactNode
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

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[640px] w-full items-center justify-center rounded-xl border border-dashed bg-card text-sm text-muted-foreground">
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

function Results({ result }: { result: RunResponse }) {
  return (
    <>
      <MetricsGrid summary={result.summary} />
      {result.coefficients.length > 0 ? (
        <CoefficientsTable rows={result.coefficients} />
      ) : null}
      {result.rolling_beta_charts.length > 0 ? (
        <RollingBetaCharts charts={result.rolling_beta_charts} />
      ) : null}
      {result.interpretation_markdown ? (
        <Interpretation text={result.interpretation_markdown} />
      ) : null}
    </>
  )
}

function MetricsGrid({ summary }: { summary: Summary }) {
  const hacLabel = summary.hac
    ? `HAC${summary.hac_lags ? ` · ${summary.hac_lags} lag${summary.hac_lags === 1 ? "" : "s"}` : ""}`
    : "OLS"
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <MetricCard
        label="Alpha (ann.)"
        value={fmtPct(summary.alpha_annualized)}
        trend={trendOf(summary.alpha_annualized)}
        hint={`per-period ${fmtPct(summary.alpha, 3)}`}
      />
      <MetricCard
        label="Alpha t-stat"
        value={fmtNum(summary.alpha_t)}
        trend={trendOf(summary.alpha_t)}
        hint={hacLabel}
      />
      <MetricCard
        label="Alpha p-value"
        value={fmtNum(summary.alpha_p, 4)}
      />
      <MetricCard label="R-squared" value={fmtNum(summary.r_squared, 4)} />
      <MetricCard label="Adj R-squared" value={fmtNum(summary.r_squared_adj, 4)} />
      <MetricCard label="Observations" value={`${summary.nobs}`} />
    </div>
  )
}

function CoefficientsTable({ rows }: { rows: CoefficientRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b px-4 py-2.5">
        <h3 className="text-sm font-semibold">Coefficients</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Factor</th>
              <th className="px-4 py-2 text-right font-medium">Beta</th>
              <th className="px-4 py-2 text-right font-medium">Std Err</th>
              <th className="px-4 py-2 text-right font-medium">t</th>
              <th className="px-4 py-2 text-right font-medium">p</th>
              <th className="px-4 py-2 text-left font-medium">Sig</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.factor}
                className={cn(
                  "border-t",
                  idx % 2 === 1 && "bg-muted/20",
                )}
              >
                <td className="px-4 py-2 font-mono text-xs">{row.factor}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">
                  {fmtNum(row.beta, 4)}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">
                  {fmtNum(row.se, 4)}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">
                  {fmtNum(row.t, 2)}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">
                  {fmtNum(row.p, 4)}
                </td>
                <td className="px-4 py-2 font-mono text-xs">{row.stars}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RollingBetaCharts({ charts }: { charts: RollingBetaFigure[] }) {
  return (
    <div className="space-y-3">
      {charts.map((chart) => (
        <div
          key={chart.factor}
          className="overflow-hidden rounded-xl border bg-card shadow-sm"
        >
          <PlotlyChart figure={chart.figure} />
        </div>
      ))}
    </div>
  )
}

function Interpretation({ text }: { text: string }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b px-4 py-2.5">
        <h3 className="text-sm font-semibold">Interpretation</h3>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-3 text-xs leading-relaxed text-foreground">
        {text}
      </pre>
    </div>
  )
}

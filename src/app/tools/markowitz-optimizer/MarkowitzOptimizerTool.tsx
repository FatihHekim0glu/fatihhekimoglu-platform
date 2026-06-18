"use client"

import { useCallback, useMemo, useState } from "react"
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
import { fmtNum, fmtPct } from "@/lib/format"

import {
  COV_METHODS,
  DEFAULT_TICKERS,
  type FieldErrors,
  type FormState,
  MEAN_METHODS,
  type RunRequest,
  RunRequestSchema,
  type RunResponse,
  TICKER_LIST_RE,
} from "./types"

// ---------------------------------------------------------------------------
// Date helpers - default to "today" and "today - 5y" without pulling in dayjs.
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
  } else if (parseTickerCount(tickersTrimmed) < 2) {
    errors.tickers = "Need at least 2 symbols."
  }

  if (!form.start) errors.start = "Start date is required."
  if (!form.end) errors.end = "End date is required."
  if (form.start && form.end && form.end <= form.start) {
    errors.end = "End must be after start."
  }

  const rf = Number.parseFloat(form.risk_free_rate)
  if (!Number.isFinite(rf)) {
    errors.risk_free_rate = "Must be a number."
  } else if (rf < -0.05 || rf > 0.25) {
    errors.risk_free_rate = "Out of range (-0.05 to 0.25)."
  }

  const seed = Number.parseInt(form.seed, 10)
  if (!Number.isFinite(seed) || seed < 0 || seed > 999_999) {
    errors.seed = "0 - 999999."
  }

  if (form.max_weight < 0.05 || form.max_weight > 1) {
    errors.max_weight = "0.05 - 1.0."
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  const value: RunRequest = {
    tickers: tickersTrimmed,
    start: form.start,
    end: form.end,
    cov_method: form.cov_method,
    mean_method: form.mean_method,
    long_only: form.long_only,
    max_weight: form.max_weight,
    risk_free_rate: rf,
    use_real_data: form.use_real_data,
    seed,
  }
  RunRequestSchema.parse(value)
  return { ok: true, value }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const INITIAL_FORM: FormState = {
  tickers: DEFAULT_TICKERS,
  start: defaultStart(),
  end: defaultEnd(),
  cov_method: "LedoitWolf",
  mean_method: "JorionBayesStein",
  long_only: true,
  max_weight: 0.4,
  risk_free_rate: "0.040",
  use_real_data: true,
  seed: "7",
}

export default function MarkowitzOptimizerTool() {
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
        "/tools/markowitz-optimizer/run",
        built.value,
      )
      setResult(data)
    } catch (err: unknown) {
      toast.error(detailMessage(err, "Optimisation failed."))
    } finally {
      setRunning(false)
    }
  }, [form])

  const weightRows = useMemo(() => {
    if (!result) return []
    return Object.entries(result.weights)
      .map(([ticker, weight]) => ({ ticker, weight }))
      .sort((a, b) => b.weight - a.weight)
  }, [result])

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <Toaster position="top-right" />
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Markowitz Optimizer
          </h1>
          <p className="text-sm text-muted-foreground">
            Mean-variance efficient frontier plus tangency portfolio under
            long-only / max-weight box constraints.
          </p>
        </div>
        {result ? (
          <Badge variant="outline" className="font-mono text-[11px]">
            data: {result.data_source} - {result.frontier.length} points
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
            <Skeleton className="h-[640px] w-full" />
          ) : result ? (
            <PlotlyChart figure={result.frontier_figure} />
          ) : (
            <EmptyState message="Configure the universe and press Run." />
          )}

          {running ? (
            <MetricsSkeleton />
          ) : result ? (
            <MetricsGrid summary={result.summary} />
          ) : null}

          {result ? (
            <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
              <PlotlyChart figure={result.weights_figure} />
              <WeightsTable rows={weightRows} />
            </div>
          ) : null}

          {result ? <FrontierTable frontier={result.frontier} /> : null}
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

        <Field id="cov_method" label="Covariance estimator">
          <Select
            value={form.cov_method}
            onValueChange={(v) =>
              setForm((p) => ({ ...p, cov_method: v as FormState["cov_method"] }))
            }
          >
            <SelectTrigger id="cov_method" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COV_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field id="mean_method" label="Mean estimator">
          <Select
            value={form.mean_method}
            onValueChange={(v) =>
              setForm((p) => ({
                ...p,
                mean_method: v as FormState["mean_method"],
              }))
            }
          >
            <SelectTrigger id="mean_method" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEAN_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="long_only" className="text-sm font-medium">
            Long-only
          </Label>
          <Switch
            id="long_only"
            checked={form.long_only}
            onCheckedChange={(v) => setForm((p) => ({ ...p, long_only: v }))}
          />
        </div>

        <Field
          id="max_weight"
          label={`Max single weight (${(form.max_weight * 100).toFixed(0)}%)`}
          error={fieldErrors.max_weight}
        >
          <Slider
            id="max_weight"
            min={0.05}
            max={1}
            step={0.05}
            value={[form.max_weight]}
            onValueChange={(vs) =>
              setForm((p) => ({ ...p, max_weight: vs[0] ?? p.max_weight }))
            }
          />
        </Field>

        <Field
          id="risk_free_rate"
          label="Risk-free rate (annual)"
          error={fieldErrors.risk_free_rate}
          hint="Annualised; used for the tangency Sharpe."
        >
          <Input
            id="risk_free_rate"
            type="number"
            step="0.005"
            value={form.risk_free_rate}
            onChange={(e) =>
              setForm((p) => ({ ...p, risk_free_rate: e.target.value }))
            }
            aria-invalid={Boolean(fieldErrors.risk_free_rate)}
          />
        </Field>

        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="use_real_data" className="text-sm font-medium">
            Real data (yfinance)
          </Label>
          <Switch
            id="use_real_data"
            checked={form.use_real_data}
            onCheckedChange={(v) =>
              setForm((p) => ({ ...p, use_real_data: v }))
            }
          />
        </div>

        {!form.use_real_data ? (
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
        ) : null}

        <Button
          type="button"
          onClick={onRun}
          disabled={running}
          className="w-full"
          aria-live="polite"
        >
          {running ? "Optimising..." : "Run"}
        </Button>
      </div>
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
    <div className="flex h-[640px] w-full items-center justify-center rounded-xl border border-dashed bg-card text-sm text-muted-foreground">
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

function MetricsGrid({
  summary,
}: {
  summary: RunResponse["summary"]
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricCard
        label="Expected Return"
        value={fmtPct(summary.expected_return)}
        trend={summary.expected_return > 0 ? "up" : "down"}
      />
      <MetricCard label="Volatility" value={fmtPct(summary.volatility)} />
      <MetricCard
        label="Sharpe"
        value={fmtNum(summary.sharpe)}
        trend={
          summary.sharpe === null
            ? "neutral"
            : summary.sharpe > 0
              ? "up"
              : "down"
        }
      />
      <MetricCard label="Active Assets" value={`${summary.n_assets}`} />
    </div>
  )
}

function WeightsTable({
  rows,
}: {
  rows: { ticker: string; weight: number }[]
}) {
  return (
    <Card className="overflow-hidden p-0 shadow-none">
      <div className="border-b px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Tangency weights
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Ticker</th>
              <th className="px-4 py-2 text-right">Weight</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ ticker, weight }) => (
              <tr key={ticker} className="border-b last:border-b-0">
                <td className="px-4 py-2 font-mono">{ticker}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">
                  {fmtPct(weight)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function FrontierTable({
  frontier,
}: {
  frontier: RunResponse["frontier"]
}) {
  return (
    <details className="rounded-xl border bg-card">
      <summary className="cursor-pointer px-4 py-2 text-sm font-medium">
        Frontier data ({frontier.length} points)
      </summary>
      <div className="max-h-[320px] overflow-y-auto border-t">
        <table className="w-full text-xs">
          <thead className="border-b bg-muted/30 uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">#</th>
              <th className="px-4 py-2 text-right">Volatility</th>
              <th className="px-4 py-2 text-right">Expected return</th>
              <th className="px-4 py-2 text-left">Label</th>
            </tr>
          </thead>
          <tbody>
            {frontier.map((p, i) => (
              <tr key={i} className="border-b last:border-b-0">
                <td className="px-4 py-1.5 font-mono">{i}</td>
                <td className="px-4 py-1.5 text-right font-mono tabular-nums">
                  {fmtPct(p.volatility, 3)}
                </td>
                <td className="px-4 py-1.5 text-right font-mono tabular-nums">
                  {fmtPct(p.expected_return, 3)}
                </td>
                <td className="px-4 py-1.5 font-mono text-muted-foreground">
                  {p.label ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

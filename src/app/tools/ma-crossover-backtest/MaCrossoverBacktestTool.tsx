"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"

import MetricCard, { type MetricTrend } from "@/components/MetricCard"
import PlotlyChart from "@/components/PlotlyChart"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Toaster } from "@/components/ui/sonner"
import { ApiError, apiPost } from "@/lib/api"
import { fmtNum, fmtPct } from "@/lib/format"
import { cn } from "@/lib/utils"

import {
  DEFAULT_FORM,
  type FieldErrors,
  type FormState,
  INPUT_SCHEMA,
  type MetricsRow,
  type RunRequest,
  type RunResponse,
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

function buildRequest(
  form: FormState,
): { ok: true; value: RunRequest } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {}

  const ticker = form.ticker.trim().toUpperCase()
  if (!ticker) {
    errors.ticker = "Ticker is required."
  } else if (!TICKER_RE.test(ticker)) {
    errors.ticker = "Letters, digits, '.', '-', '^' only (1-15 chars)."
  }
  if (!form.start_date) errors.start_date = "Start date is required."
  if (!form.end_date) errors.end_date = "End date is required."
  if (form.start_date && form.end_date && form.end_date <= form.start_date) {
    errors.end_date = "End date must be after start date."
  }

  const fast = Number.parseInt(form.fast_window, 10)
  if (!Number.isInteger(fast) || fast < 5 || fast > 100) {
    errors.fast_window = "Integer in [5, 100]."
  }
  const slow = Number.parseInt(form.slow_window, 10)
  if (!Number.isInteger(slow) || slow < 20 || slow > 300) {
    errors.slow_window = "Integer in [20, 300]."
  }
  if (
    !errors.fast_window &&
    !errors.slow_window &&
    Number.isInteger(fast) &&
    Number.isInteger(slow) &&
    fast >= slow
  ) {
    errors.slow_window = "Slow window must be strictly greater than fast."
  }
  const cost = Number.parseFloat(form.cost_bps)
  if (!Number.isFinite(cost) || cost < 0 || cost > 50) {
    errors.cost_bps = "Number in [0, 50] bps."
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  const value: RunRequest = {
    ticker,
    start_date: form.start_date,
    end_date: form.end_date,
    fast_window: fast,
    slow_window: slow,
    cost_bps: cost,
  }
  INPUT_SCHEMA.parse(value)
  return { ok: true, value }
}

function trendOf(value: number | null | undefined): MetricTrend {
  if (value === null || value === undefined || !Number.isFinite(value)) return "neutral"
  if (value > 0) return "up"
  if (value < 0) return "down"
  return "neutral"
}

function pctOrNum(name: string, value: number | null): string {
  if (value === null) return "—"
  // CAGR / Annual vol / Max drawdown are ratios; Sharpe / Sortino are plain numbers.
  const isPct = name === "CAGR" || name === "Annual vol" || name === "Max drawdown"
  return isPct ? fmtPct(value) : fmtNum(value)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MaCrossoverBacktestTool() {
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
      const data = await apiPost<RunResponse>(
        "/tools/ma-crossover-backtest/run",
        built.value,
      )
      setResult(data)
    } catch (err: unknown) {
      toast.error(detailMessage(err, "Request failed."))
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
            MA Crossover Backtest
          </h1>
          <p className="text-sm text-muted-foreground">
            Long/flat SMA crossover, evaluated against buy-and-hold with HAC
            alpha and a Memmel-corrected Sharpe difference test.
          </p>
        </div>
        {result ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-[11px]">
              {result.summary.ticker} · {result.summary.trading_days} bars ·{" "}
              {result.summary.n_trades} trades
            </Badge>
            <Badge variant="outline" className="font-mono text-[11px]">
              data: {result.data_source}
            </Badge>
          </div>
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
            <PlotlyChart figure={result.equity_curve} />
          ) : (
            <EmptyState message="Configure inputs and press Run." />
          )}

          {running ? (
            <Skeleton className="h-[640px] w-full" />
          ) : result ? (
            <PlotlyChart figure={result.underwater_drawdown} />
          ) : null}

          {result ? (
            <>
              <MetricsTable rows={result.metrics} />
              <StatsGrid stats={result.benchmark} />
            </>
          ) : null}
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
              setForm((p) => ({ ...p, ticker: e.target.value.trim().toUpperCase() }))
            }
            autoComplete="off"
            spellCheck={false}
            className="font-mono uppercase"
            aria-invalid={Boolean(fieldErrors.ticker)}
          />
        </Field>

        <Field id="start_date" label="Start date" error={fieldErrors.start_date}>
          <Input
            id="start_date"
            type="date"
            value={form.start_date}
            onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
            aria-invalid={Boolean(fieldErrors.start_date)}
          />
        </Field>

        <Field id="end_date" label="End date" error={fieldErrors.end_date}>
          <Input
            id="end_date"
            type="date"
            value={form.end_date}
            onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
            aria-invalid={Boolean(fieldErrors.end_date)}
          />
        </Field>

        <Field
          id="fast_window"
          label="Fast SMA window"
          error={fieldErrors.fast_window}
          hint="Bars; must be < slow."
        >
          <Input
            id="fast_window"
            type="number"
            min={5}
            max={100}
            step={5}
            value={form.fast_window}
            onChange={(e) =>
              setForm((p) => ({ ...p, fast_window: e.target.value }))
            }
            aria-invalid={Boolean(fieldErrors.fast_window)}
          />
        </Field>

        <Field
          id="slow_window"
          label="Slow SMA window"
          error={fieldErrors.slow_window}
          hint="Bars."
        >
          <Input
            id="slow_window"
            type="number"
            min={20}
            max={300}
            step={10}
            value={form.slow_window}
            onChange={(e) =>
              setForm((p) => ({ ...p, slow_window: e.target.value }))
            }
            aria-invalid={Boolean(fieldErrors.slow_window)}
          />
        </Field>

        <Field
          id="cost_bps"
          label="Cost per side (bps)"
          error={fieldErrors.cost_bps}
          hint="5 bps/side ~ 10 bps round-trip."
        >
          <Input
            id="cost_bps"
            type="number"
            min={0}
            max={50}
            step={0.5}
            value={form.cost_bps}
            onChange={(e) =>
              setForm((p) => ({ ...p, cost_bps: e.target.value }))
            }
            aria-invalid={Boolean(fieldErrors.cost_bps)}
          />
        </Field>

        <Button
          type="button"
          onClick={onRun}
          disabled={running}
          className="w-full"
          aria-live="polite"
        >
          {running ? "Running..." : "Run backtest"}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small presentational helpers
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

// ---------------------------------------------------------------------------
// Metrics table - strategy vs buy & hold vs delta
// ---------------------------------------------------------------------------

function MetricsTable({ rows }: { rows: MetricsRow[] }) {
  return (
    <Card className="overflow-hidden p-0 shadow-none">
      <div className="border-b px-4 py-2.5">
        <h3 className="text-sm font-semibold">Headline metrics</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Metric</th>
              <th className="px-4 py-2 text-right font-medium">Strategy</th>
              <th className="px-4 py-2 text-right font-medium">Buy &amp; Hold</th>
              <th className="px-4 py-2 text-right font-medium">Delta</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-t">
                <td className="px-4 py-2 font-medium">{row.name}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">
                  {pctOrNum(row.name, row.strategy)}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums">
                  {pctOrNum(row.name, row.buy_and_hold)}
                </td>
                <td
                  className={cn(
                    "px-4 py-2 text-right font-mono tabular-nums",
                    row.delta !== null && row.delta > 0
                      ? "text-teal-600 dark:text-teal-400"
                      : row.delta !== null && row.delta < 0
                        ? "text-red-600 dark:text-red-400"
                        : "",
                  )}
                >
                  {pctOrNum(row.name, row.delta)}
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
// Benchmark stats grid - HAC alpha, IR, Memmel sharpe diff
// ---------------------------------------------------------------------------

function StatsGrid({
  stats,
}: {
  stats: RunResponse["benchmark"]
}) {
  const alphaHint =
    stats.alpha_t_stat !== null && stats.alpha_p_value !== null
      ? `t=${fmtNum(stats.alpha_t_stat)} · p=${fmtNum(stats.alpha_p_value, 3)}`
      : undefined
  const sharpeDiffHint =
    stats.sharpe_diff_p_value !== null
      ? `p=${fmtNum(stats.sharpe_diff_p_value, 3)} (Memmel)`
      : undefined
  const betaHint =
    stats.beta_se !== null ? `SE=${fmtNum(stats.beta_se)}` : undefined
  const irHint =
    stats.tracking_error_annual !== null
      ? `TE=${fmtPct(stats.tracking_error_annual)}`
      : undefined

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <MetricCard
        label="Alpha (annual)"
        value={fmtPct(stats.alpha_annual)}
        hint={alphaHint ?? `HAC lags=${stats.hac_lags}`}
        trend={trendOf(stats.alpha_annual)}
      />
      <MetricCard
        label="Beta"
        value={fmtNum(stats.beta)}
        hint={betaHint}
        trend="neutral"
      />
      <MetricCard
        label="Info Ratio"
        value={fmtNum(stats.information_ratio)}
        hint={irHint}
        trend={trendOf(stats.information_ratio)}
      />
      <MetricCard
        label="Sharpe Δ"
        value={fmtNum(stats.sharpe_diff)}
        hint={sharpeDiffHint}
        trend={trendOf(stats.sharpe_diff)}
      />
    </div>
  )
}

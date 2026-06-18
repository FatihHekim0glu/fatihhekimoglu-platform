"use client"

import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

import MetricCard, { type MetricTrend } from "@/components/MetricCard"
import PlotlyChart from "@/components/PlotlyChart"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Toaster } from "@/components/ui/sonner"
import { ApiError, apiPost } from "@/lib/api"
import { fmtDate, fmtNum, fmtPct } from "@/lib/format"

import {
  DEFAULT_TICKER,
  FORECAST_DAYS_DEFAULT,
  FORECAST_DAYS_MAX,
  FORECAST_DAYS_MIN,
  type FieldErrors,
  type FormState,
  INPUT_SCHEMA,
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
  if (!ticker) errors.ticker = "Ticker is required."
  else if (!TICKER_RE.test(ticker))
    errors.ticker = "Letters, digits, '.', '-' only (1-15 chars)."

  if (
    !Number.isFinite(form.forecast_days) ||
    form.forecast_days < FORECAST_DAYS_MIN ||
    form.forecast_days > FORECAST_DAYS_MAX
  ) {
    errors.forecast_days = `Pick ${FORECAST_DAYS_MIN}-${FORECAST_DAYS_MAX} days.`
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  const value: RunRequest = {
    ticker,
    forecast_days: Math.round(form.forecast_days),
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StockPriceForecastTool() {
  const [form, setForm] = useState<FormState>({
    ticker: DEFAULT_TICKER,
    forecast_days: FORECAST_DAYS_DEFAULT,
  })
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
        "/tools/stock-price-forecast/run",
        built.value,
      )
      setResult(data)
    } catch (err: unknown) {
      toast.error(detailMessage(err, "Request failed."))
    } finally {
      setRunning(false)
    }
  }, [form])

  const lastCloseLabel = useMemo(() => {
    if (!result) return "-"
    return `$${fmtNum(result.summary.last_close)}`
  }, [result])

  const changePctValue = result?.summary.forecast_change_pct ?? null

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <Toaster position="top-right" />
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Stock Price Forecast
          </h1>
          <p className="text-sm text-muted-foreground">
            Next-N-day closing price forecast for a single ticker, from a
            pretrained LSTM+Attention model on 14 technical features.
          </p>
        </div>
        {result ? (
          <Badge variant="outline" className="font-mono text-[11px]">
            {result.summary.ticker} · {result.summary.forecast_days}d horizon
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

        <section className="space-y-6">
          {running ? (
            <Skeleton className="h-[640px] w-full" />
          ) : result ? (
            <PlotlyChart figure={result.forecast_chart} />
          ) : (
            <EmptyState message="Enter a ticker and press Run. First call warms up the model (a few seconds)." />
          )}

          {running ? (
            <MetricsSkeleton />
          ) : result ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard
                label="Last Close"
                value={lastCloseLabel}
                hint={fmtDate(result.summary.last_close_date)}
              />
              <MetricCard
                label="Forecast Change"
                value={fmtPct(changePctValue)}
                trend={trendOf(changePctValue)}
                hint={`over ${result.summary.forecast_days} days`}
              />
              <MetricCard
                label="First Forecast"
                value={
                  result.summary.first_forecast_close === null
                    ? "-"
                    : `$${fmtNum(result.summary.first_forecast_close)}`
                }
              />
              <MetricCard
                label="Final Forecast"
                value={
                  result.summary.final_forecast_close === null
                    ? "-"
                    : `$${fmtNum(result.summary.final_forecast_close)}`
                }
              />
            </div>
          ) : null}

          {running ? null : result ? (
            <ForecastTable
              rows={result.forecast_table}
              baseline={result.summary.last_close}
            />
          ) : null}

          {running ? null : result ? (
            <details className="rounded-xl border bg-card p-4 shadow-sm">
              <summary className="cursor-pointer text-sm font-medium">
                Historical price (since 2010)
              </summary>
              <div className="mt-4">
                <PlotlyChart figure={result.price_history_chart} />
              </div>
            </details>
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

      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="ticker" className="text-sm font-medium">
            Ticker
          </Label>
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
          {fieldErrors.ticker ? (
            <p role="alert" className="text-xs text-destructive">
              {fieldErrors.ticker}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              e.g. AAPL, MSFT, BRK-B, BP.L
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="forecast_days" className="text-sm font-medium">
              Forecast horizon
            </Label>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {form.forecast_days} day{form.forecast_days === 1 ? "" : "s"}
            </span>
          </div>
          <Slider
            id="forecast_days"
            min={FORECAST_DAYS_MIN}
            max={FORECAST_DAYS_MAX}
            step={1}
            value={[form.forecast_days]}
            onValueChange={(v) =>
              setForm((p) => ({ ...p, forecast_days: v[0] ?? FORECAST_DAYS_DEFAULT }))
            }
          />
          {fieldErrors.forecast_days ? (
            <p role="alert" className="text-xs text-destructive">
              {fieldErrors.forecast_days}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Autoregressive roll · longer horizons compound model error.
            </p>
          )}
        </div>

        <Button
          type="button"
          onClick={onRun}
          disabled={running}
          className="w-full"
          aria-live="polite"
        >
          {running ? "Forecasting..." : "Run forecast"}
        </Button>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Heads up: a 30-day forecast can take 10-30 seconds on a cold start
          while the model warms up.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[640px] w-full items-center justify-center rounded-xl border border-dashed bg-card px-6 text-center text-sm text-muted-foreground">
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

function ForecastTable({
  rows,
  baseline,
}: {
  rows: { date: string; predicted_close: number }[]
  baseline: number
}) {
  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">Forecast table</h3>
        <p className="text-xs text-muted-foreground">
          Per-day predicted close and change vs last actual close.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Date</th>
              <th className="px-4 py-2 text-right font-medium">Predicted Close</th>
              <th className="px-4 py-2 text-right font-medium">Δ vs last</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {rows.map((r) => {
              const delta = baseline !== 0 ? (r.predicted_close - baseline) / baseline : null
              const trend = trendOf(delta)
              const deltaClass =
                trend === "up"
                  ? "text-teal-600 dark:text-teal-400"
                  : trend === "down"
                  ? "text-red-600 dark:text-red-400"
                  : "text-muted-foreground"
              return (
                <tr key={r.date} className="border-t">
                  <td className="px-4 py-2">{r.date}</td>
                  <td className="px-4 py-2 text-right">
                    ${fmtNum(r.predicted_close)}
                  </td>
                  <td className={`px-4 py-2 text-right ${deltaClass}`}>
                    {fmtPct(delta)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

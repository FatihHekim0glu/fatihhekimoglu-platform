"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Toaster } from "@/components/ui/sonner"
import PlotlyChart from "@/components/PlotlyChart"
import { ApiError, apiGet, apiPost } from "@/lib/api"

import { EmptyState, MetricsGrid, MetricsSkeleton, SidebarForm } from "./_internal"
import {
  type AnchorResponse,
  type FieldErrors,
  type FormState,
  type IndicatorLabel,
  INDICATOR_OPTIONS,
  type RunRequest,
  RunRequestSchema,
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
    errors.ticker = "Letters, digits, '.', '-' only (1-15 chars)."
  }
  if (!form.start_date) errors.start_date = "Start date is required."
  if (!form.end_date) errors.end_date = "End date is required."
  if (form.start_date && form.end_date && form.end_date <= form.start_date) {
    errors.end_date = "End date must be after start date."
  }
  const rf = Number.parseFloat(form.rf_annual)
  if (!Number.isFinite(rf)) errors.rf_annual = "Must be a number."

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  const value: RunRequest = {
    ticker,
    start_date: form.start_date,
    end_date: form.end_date,
    indicators: Array.from(form.indicators),
    candlestick: form.candlestick,
    rf_annual: rf,
  }
  // Belt-and-braces: 422 from the API if the schema drifts client-side.
  RunRequestSchema.parse(value)
  return { ok: true, value }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const DEFAULT_INDICATORS = new Set<IndicatorLabel>(INDICATOR_OPTIONS)

export default function StockDashboardTool() {
  const [anchor, setAnchor] = useState<AnchorResponse | null>(null)
  const [anchorError, setAnchorError] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>({
    ticker: "AAPL",
    start_date: "",
    end_date: "",
    indicators: new Set(DEFAULT_INDICATORS),
    candlestick: true,
    rf_annual: "0.000",
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    apiGet<AnchorResponse>("/tools/stock-dashboard/anchor")
      .then((data) => {
        if (cancelled) return
        setAnchor(data)
        setForm((prev) => ({
          ...prev,
          start_date: prev.start_date || data.default_start,
          end_date: prev.end_date || data.today_nyse,
        }))
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setAnchorError(detailMessage(err, "Could not load market calendar."))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const toggleIndicator = useCallback((label: IndicatorLabel) => {
    setForm((prev) => {
      const next = new Set(prev.indicators)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return { ...prev, indicators: next }
    })
  }, [])

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
        "/tools/stock-dashboard/run",
        built.value,
      )
      setResult(data)
    } catch (err: unknown) {
      toast.error(detailMessage(err, "Request failed."))
    } finally {
      setRunning(false)
    }
  }, [form])

  const rfAnnualNumber = useMemo(() => {
    const n = Number.parseFloat(form.rf_annual)
    return Number.isFinite(n) ? n : 0
  }, [form.rf_annual])

  const sharpeHint = `rf=${(rfAnnualNumber * 100).toFixed(2)}%`

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <Toaster position="top-right" />
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Single-ticker price, indicators, and risk metrics from daily OHLCV.
          </p>
        </div>
        {result ? (
          <Badge variant="outline" className="font-mono text-[11px]">
            data: {result.data_source} · {result.ohlcv_count} bars
          </Badge>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <SidebarForm
            anchor={anchor}
            anchorError={anchorError}
            form={form}
            setForm={setForm}
            fieldErrors={fieldErrors}
            toggleIndicator={toggleIndicator}
            onRun={onRun}
            running={running}
          />
        </aside>

        <section className="space-y-4">
          {running ? (
            <Skeleton className="h-[640px] w-full" />
          ) : result ? (
            <PlotlyChart figure={result.figure} />
          ) : anchorError ? (
            <EmptyState message={anchorError} />
          ) : (
            <EmptyState message="Configure inputs and press Run." />
          )}

          {running ? (
            <MetricsSkeleton />
          ) : result ? (
            <MetricsGrid summary={result.summary} sharpeHint={sharpeHint} />
          ) : null}
        </section>
      </div>
    </main>
  )
}

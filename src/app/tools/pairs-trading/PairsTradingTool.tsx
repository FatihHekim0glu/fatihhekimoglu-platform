"use client"

import { useCallback, useMemo, useState } from "react"
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
import { Toaster } from "@/components/ui/sonner"
import MetricCard, { type MetricTrend } from "@/components/MetricCard"
import PlotlyChart from "@/components/PlotlyChart"
import { ApiError, apiPost } from "@/lib/api"
import { fmtNum } from "@/lib/format"
import { cn } from "@/lib/utils"

import {
  type DiagnosticRow,
  FDR_METHOD_OPTIONS,
  type FdrMethod,
  type FieldErrors,
  type FormState,
  INPUT_SCHEMA,
  type RunRequest,
  type RunResponse,
  UNIVERSE_OPTIONS,
  type Universe,
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

  if (!form.train_start) errors.train_start = "Start date is required."
  if (!form.train_end) errors.train_end = "End date is required."
  if (
    form.train_start &&
    form.train_end &&
    form.train_end <= form.train_start
  ) {
    errors.train_end = "End date must be after start date."
  }

  const hlMin = Number.parseFloat(form.hl_min)
  if (!Number.isFinite(hlMin) || hlMin < 1 || hlMin > 120) {
    errors.hl_min = "Must be a number between 1 and 120."
  }
  const hlMax = Number.parseFloat(form.hl_max)
  if (!Number.isFinite(hlMax) || hlMax < 1 || hlMax > 120) {
    errors.hl_max = "Must be a number between 1 and 120."
  }
  if (
    Number.isFinite(hlMin) &&
    Number.isFinite(hlMax) &&
    hlMax < hlMin
  ) {
    errors.hl_max = "Must be >= hl_min."
  }

  const pThresh = Number.parseFloat(form.p_threshold)
  if (!Number.isFinite(pThresh) || pThresh < 0.001 || pThresh > 0.5) {
    errors.p_threshold = "Must be between 0.001 and 0.5."
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  const value: RunRequest = {
    universe: form.universe,
    train_start: form.train_start,
    train_end: form.train_end,
    hl_min: hlMin,
    hl_max: hlMax,
    p_threshold: pThresh,
    fdr_method: form.fdr_method,
  }
  INPUT_SCHEMA.parse(value)
  return { ok: true, value }
}

function trendOf(value: number | null | undefined): MetricTrend {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "neutral"
  }
  if (value > 0) return "up"
  if (value < 0) return "down"
  return "neutral"
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const INITIAL_FORM: FormState = {
  universe: "curated_25_v1",
  train_start: "2022-01-01",
  train_end: "2023-12-31",
  hl_min: "5",
  hl_max: "60",
  p_threshold: "0.05",
  fdr_method: "benjamini_hochberg",
}

export default function PairsTradingTool() {
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
        "/tools/pairs-trading/run",
        built.value,
      )
      setResult(data)
    } catch (err: unknown) {
      toast.error(detailMessage(err, "Request failed."))
    } finally {
      setRunning(false)
    }
  }, [form])

  const isXlk = form.universe === "xlk_v1"

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <Toaster position="top-right" />
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Pairs Trading
          </h1>
          <p className="text-sm text-muted-foreground">
            Cointegration scan with Engle-Granger p-values, FDR correction, and
            OU half-life diagnostics.
          </p>
        </div>
        {result ? (
          <Badge variant="outline" className="font-mono text-[11px]">
            {result.universe} | {result.mtc_method} |{" "}
            {result.summary.pairs_tested} pairs
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
            isXlk={isXlk}
          />
        </aside>

        <section className="space-y-4">
          {running ? (
            <MetricsSkeleton />
          ) : result ? (
            <SummaryGrid summary={result.summary} />
          ) : null}

          {running ? (
            <Skeleton className="h-[420px] w-full" />
          ) : result ? (
            <PlotlyChart figure={result.figure} className="h-[420px]" />
          ) : (
            <EmptyState message="Configure inputs and press Run." />
          )}

          {running ? (
            <Skeleton className="h-[480px] w-full" />
          ) : result ? (
            <DiagnosticsTable rows={result.diagnostics} />
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
  isXlk: boolean
}

function SidebarForm({
  form,
  setForm,
  fieldErrors,
  onRun,
  running,
  isXlk,
}: SidebarFormProps) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Inputs
      </h2>

      <div className="space-y-4">
        <Field id="universe" label="Universe">
          <Select
            value={form.universe}
            onValueChange={(v: Universe) =>
              setForm((p) => ({ ...p, universe: v }))
            }
          >
            <SelectTrigger id="universe" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIVERSE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isXlk ? (
            <p className="text-[11px] text-muted-foreground">
              ~3000 candidate pairs - first run may exceed 60s.
            </p>
          ) : null}
        </Field>

        <Field
          id="train_start"
          label="Train start"
          error={fieldErrors.train_start}
        >
          <Input
            id="train_start"
            type="date"
            value={form.train_start}
            onChange={(e) =>
              setForm((p) => ({ ...p, train_start: e.target.value }))
            }
            aria-invalid={Boolean(fieldErrors.train_start)}
          />
        </Field>

        <Field id="train_end" label="Train end" error={fieldErrors.train_end}>
          <Input
            id="train_end"
            type="date"
            value={form.train_end}
            onChange={(e) =>
              setForm((p) => ({ ...p, train_end: e.target.value }))
            }
            aria-invalid={Boolean(fieldErrors.train_end)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field
            id="hl_min"
            label="Half-life min (days)"
            error={fieldErrors.hl_min}
          >
            <Input
              id="hl_min"
              type="number"
              min={1}
              max={120}
              step={1}
              value={form.hl_min}
              onChange={(e) =>
                setForm((p) => ({ ...p, hl_min: e.target.value }))
              }
              aria-invalid={Boolean(fieldErrors.hl_min)}
            />
          </Field>

          <Field
            id="hl_max"
            label="Half-life max (days)"
            error={fieldErrors.hl_max}
          >
            <Input
              id="hl_max"
              type="number"
              min={1}
              max={120}
              step={1}
              value={form.hl_max}
              onChange={(e) =>
                setForm((p) => ({ ...p, hl_max: e.target.value }))
              }
              aria-invalid={Boolean(fieldErrors.hl_max)}
            />
          </Field>
        </div>

        <Field
          id="p_threshold"
          label="Raw p-value threshold"
          error={fieldErrors.p_threshold}
          hint="Engle-Granger cut before MTC."
        >
          <Input
            id="p_threshold"
            type="number"
            min={0.001}
            max={0.5}
            step={0.005}
            value={form.p_threshold}
            onChange={(e) =>
              setForm((p) => ({ ...p, p_threshold: e.target.value }))
            }
            aria-invalid={Boolean(fieldErrors.p_threshold)}
          />
        </Field>

        <Field id="fdr_method" label="Multiple-testing correction">
          <Select
            value={form.fdr_method}
            onValueChange={(v: FdrMethod) =>
              setForm((p) => ({ ...p, fdr_method: v }))
            }
          >
            <SelectTrigger id="fdr_method" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FDR_METHOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
// Helpers (presentational)
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
    <div className="flex h-[420px] w-full items-center justify-center rounded-xl border border-dashed bg-card text-sm text-muted-foreground">
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

function SummaryGrid({
  summary,
}: {
  summary: RunResponse["summary"]
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricCard
        label="Pairs Tested"
        value={`${summary.pairs_tested}`}
      />
      <MetricCard
        label="Survivors (q<0.05)"
        value={`${summary.survivors}`}
        trend={summary.survivors > 0 ? "up" : "neutral"}
      />
      <MetricCard
        label="Median Half-Life"
        value={fmtNum(summary.median_half_life, 1)}
        hint="days"
      />
      <MetricCard
        label="Median q-value"
        value={fmtNum(summary.median_q_value, 4)}
        trend={trendOf(
          summary.median_q_value === null
            ? null
            : 0.05 - summary.median_q_value,
        )}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Diagnostics table
// ---------------------------------------------------------------------------

function DiagnosticsTable({ rows }: { rows: DiagnosticRow[] }) {
  const visible = useMemo(() => rows.slice(0, 200), [rows])
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
        No pairs were screened.
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Diagnostics</h3>
        <span className="font-mono text-[11px] text-muted-foreground">
          showing {visible.length} of {rows.length}
        </span>
      </div>
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Pair</th>
              <th className="px-3 py-2 text-right">p_raw</th>
              <th className="px-3 py-2 text-right">q_value</th>
              <th className="px-3 py-2 text-right">Hedge</th>
              <th className="px-3 py-2 text-right">Half-life</th>
              <th className="px-3 py-2 text-center">Survives</th>
              <th className="px-3 py-2 text-center">HL band</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.pair_id}
                className={cn(
                  "border-b font-mono text-xs tabular-nums last:border-b-0",
                  row.survives_mtc && row.in_hl_band
                    ? "bg-teal-50 dark:bg-teal-950/30"
                    : null,
                )}
              >
                <td className="px-3 py-2 text-left">
                  <span className="font-medium">{row.ticker_a}</span>
                  <span className="text-muted-foreground"> / </span>
                  <span className="font-medium">{row.ticker_b}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  {fmtNum(row.p_raw, 4)}
                </td>
                <td className="px-3 py-2 text-right">
                  {fmtNum(row.q_value, 4)}
                </td>
                <td className="px-3 py-2 text-right">
                  {fmtNum(row.hedge_ratio, 3)}
                </td>
                <td className="px-3 py-2 text-right">
                  {fmtNum(row.half_life, 1)}
                </td>
                <td className="px-3 py-2 text-center">
                  {row.survives_mtc ? "yes" : "no"}
                </td>
                <td className="px-3 py-2 text-center">
                  {row.in_hl_band ? "yes" : "no"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

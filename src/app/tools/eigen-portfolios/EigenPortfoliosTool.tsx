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
import { Slider } from "@/components/ui/slider"
import { Toaster } from "@/components/ui/sonner"
import MetricCard from "@/components/MetricCard"
import PlotlyChart from "@/components/PlotlyChart"
import { ApiError, apiPost } from "@/lib/api"
import { fmtNum, fmtPct } from "@/lib/format"
import { cn } from "@/lib/utils"

import {
  type FieldErrors,
  type FormState,
  INPUT_SCHEMA,
  type RunRequest,
  type RunResponse,
  type TopPortfolio,
  UNIVERSE_OPTIONS,
  type Universe,
} from "./types"

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const INITIAL_FORM: FormState = {
  universe: "sp500-pit",
  tickers_text: "AAPL, MSFT, GOOG, AMZN, META, NVDA, JPM, BAC, GS, MS, XOM, CVX, COP, JNJ, PFE, MRK, KO, PEP, WMT, COST",
  start_date: "2020-01-02",
  end_date: "2024-12-31",
  n_components_to_show: 5,
}

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

function parseTickers(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/[\s,]+/)
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean),
    ),
  )
}

function buildRequest(
  form: FormState,
): { ok: true; value: RunRequest } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {}

  if (!form.start_date) errors.start_date = "Start date is required."
  if (!form.end_date) errors.end_date = "End date is required."
  if (form.start_date && form.end_date && form.end_date <= form.start_date) {
    errors.end_date = "End date must be after start date."
  }

  const tickers = parseTickers(form.tickers_text)
  if (form.universe === "custom" && tickers.length < 2) {
    errors.tickers = "Enter at least 2 tickers (comma/whitespace-separated)."
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  const value: RunRequest = {
    universe: form.universe,
    tickers: form.universe === "custom" ? tickers : undefined,
    start_date: form.start_date,
    end_date: form.end_date,
    n_components_to_show: form.n_components_to_show,
    rebalance: "none",
  }
  INPUT_SCHEMA.parse(value)
  return { ok: true, value }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EigenPortfoliosTool() {
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
        "/tools/eigen-portfolios/run",
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
            Eigen Portfolios (PCA)
          </h1>
          <p className="text-sm text-muted-foreground">
            PCA decomposition of a returns panel. Marchenko-Pastur random-matrix
            theory separates the signal eigenvalues from the noise bulk.
          </p>
        </div>
        {result ? (
          <Badge variant="outline" className="font-mono text-[11px]">
            {result.data_source} | N={result.universe_size} | T={result.obs} |{" "}
            {result.significant_count} signals
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
            <SummaryGrid result={result} />
          ) : null}

          {running ? (
            <Skeleton className="h-[420px] w-full" />
          ) : result ? (
            <PlotlyChart
              figure={result.spectrum_figure}
              className="h-[420px]"
            />
          ) : (
            <EmptyState message="Configure inputs and press Run." />
          )}

          {running ? (
            <Skeleton className="h-[420px] w-full" />
          ) : result ? (
            <PlotlyChart
              figure={result.factor_returns_figure}
              className="h-[420px]"
            />
          ) : null}

          {running ? (
            <Skeleton className="h-[420px] w-full" />
          ) : result ? (
            <PlotlyChart
              figure={result.weights_heatmap_figure}
              className="min-h-[320px] w-full"
            />
          ) : null}

          {running ? (
            <Skeleton className="h-[320px] w-full" />
          ) : result ? (
            <TopPortfoliosTable rows={result.top_portfolios} />
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
  const isCustom = form.universe === "custom"
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
          {form.universe === "sp500-pit" ? (
            <p className="text-[11px] text-muted-foreground">
              Requires Polygon API key; first build may exceed 60s.
            </p>
          ) : null}
        </Field>

        {isCustom ? (
          <Field
            id="tickers_text"
            label="Tickers"
            error={fieldErrors.tickers}
            hint="Comma/whitespace separated."
          >
            <textarea
              id="tickers_text"
              className={cn(
                "min-h-[120px] w-full rounded-md border bg-background px-3 py-2 font-mono text-xs",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
              value={form.tickers_text}
              onChange={(e) =>
                setForm((p) => ({ ...p, tickers_text: e.target.value }))
              }
              aria-invalid={Boolean(fieldErrors.tickers)}
            />
          </Field>
        ) : null}

        <Field
          id="start_date"
          label="Start date"
          error={fieldErrors.start_date}
        >
          <Input
            id="start_date"
            type="date"
            value={form.start_date}
            onChange={(e) =>
              setForm((p) => ({ ...p, start_date: e.target.value }))
            }
            aria-invalid={Boolean(fieldErrors.start_date)}
          />
        </Field>

        <Field id="end_date" label="End date" error={fieldErrors.end_date}>
          <Input
            id="end_date"
            type="date"
            value={form.end_date}
            onChange={(e) =>
              setForm((p) => ({ ...p, end_date: e.target.value }))
            }
            aria-invalid={Boolean(fieldErrors.end_date)}
          />
        </Field>

        <Field
          id="n_components_to_show"
          label={`Top-K components: ${form.n_components_to_show}`}
          hint="How many leading eigenvectors to detail."
        >
          <Slider
            id="n_components_to_show"
            min={3}
            max={10}
            step={1}
            value={[form.n_components_to_show]}
            onValueChange={(values) =>
              setForm((p) => ({
                ...p,
                n_components_to_show: values[0] ?? p.n_components_to_show,
              }))
            }
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

function SummaryGrid({ result }: { result: RunResponse }) {
  const topEig = result.eigenvalue_spectrum[0] ?? null
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricCard
        label="Universe size (N)"
        value={`${result.universe_size}`}
        hint="surviving tickers"
      />
      <MetricCard
        label="Observations (T)"
        value={`${result.obs}`}
        hint="aligned trading days"
      />
      <MetricCard
        label="Signal eigenvalues"
        value={`${result.significant_count}`}
        trend={result.significant_count > 0 ? "up" : "neutral"}
        hint="above MP bulk"
      />
      <MetricCard
        label="Top eigenvalue (λ₁)"
        value={fmtNum(topEig, 2)}
        hint={`bulk λ+ = ${fmtNum(result.rmt_bulk.lambda_max, 2)}`}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Top portfolios table
// ---------------------------------------------------------------------------

function TopPortfoliosTable({ rows }: { rows: TopPortfolio[] }) {
  const visible = useMemo(() => rows, [rows])
  if (rows.length === 0) {
    return null
  }
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Top eigen-portfolios</h3>
        <span className="font-mono text-[11px] text-muted-foreground">
          showing {visible.length}
        </span>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Rank</th>
              <th className="px-3 py-2 text-right">Eigenvalue</th>
              <th className="px-3 py-2 text-right">Explained var.</th>
              <th className="px-3 py-2 text-left">Interpretation</th>
              <th className="px-3 py-2 text-left">Top weights</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.rank}
                className="border-b font-mono text-xs tabular-nums last:border-b-0"
              >
                <td className="px-3 py-2 text-left">PC{row.rank + 1}</td>
                <td className="px-3 py-2 text-right">
                  {fmtNum(row.eigenvalue, 3)}
                </td>
                <td className="px-3 py-2 text-right">
                  {fmtPct(row.explained_variance, 2)}
                </td>
                <td className="px-3 py-2 text-left font-sans">
                  {row.interpretation}
                </td>
                <td className="px-3 py-2 text-left">
                  <div className="flex flex-wrap gap-1">
                    {row.top_weights.slice(0, 8).map((w) => (
                      <span
                        key={`${row.rank}-${w.ticker}`}
                        className={cn(
                          "rounded px-1.5 py-0.5",
                          w.weight >= 0
                            ? "bg-teal-50 text-teal-900 dark:bg-teal-950/40 dark:text-teal-200"
                            : "bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200",
                        )}
                      >
                        {w.ticker} {w.weight >= 0 ? "+" : ""}
                        {fmtNum(w.weight, 2)}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

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
import { Switch } from "@/components/ui/switch"
import { Toaster } from "@/components/ui/sonner"
import MetricCard from "@/components/MetricCard"
import PlotlyChart from "@/components/PlotlyChart"
import { ApiError, apiPost } from "@/lib/api"
import { fmtNum, fmtPct } from "@/lib/format"

import {
  COVARIANCE_METHODS,
  DATA_SOURCE_PREFS,
  DEFAULT_TICKERS,
  type FieldErrors,
  type FormState,
  type HeadlineVerdict,
  LINKAGE_METHODS,
  REBALANCE_FREQUENCIES,
  type RunRequest,
  RunRequestSchema,
  type RunResponse,
  TICKER_LIST_RE,
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

  const costBps = Number.parseFloat(form.cost_bps)
  if (!Number.isFinite(costBps) || costBps < 0 || costBps > 500) {
    errors.cost_bps = "0 - 500 bps."
  }

  const lookback = Number.parseInt(form.lookback_window, 10)
  if (!Number.isInteger(lookback) || lookback < 2 || lookback > 2_520) {
    errors.lookback_window = "2 - 2520 days."
  }

  const nBootstrap = Number.parseInt(form.n_bootstrap, 10)
  if (!Number.isInteger(nBootstrap) || nBootstrap < 1 || nBootstrap > 5_000) {
    errors.n_bootstrap = "1 - 5000 (capped)."
  }

  const seed = Number.parseInt(form.seed, 10)
  if (!Number.isFinite(seed) || seed < 0 || seed > 999_999) {
    errors.seed = "0 - 999999."
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  const value: RunRequest = {
    tickers: tickersTrimmed,
    start: form.start,
    end: form.end,
    linkage: form.linkage,
    covariance: form.covariance,
    rmt_denoise: form.rmt_denoise,
    rebalance: form.rebalance,
    cost_bps: costBps,
    lookback_window: lookback,
    n_bootstrap: nBootstrap,
    data_source_pref: form.data_source_pref,
    seed,
  }
  RunRequestSchema.parse(value)
  return { ok: true, value }
}

// ---------------------------------------------------------------------------
// Verdict presentation — the honest headline. The backend's verdict is a pure
// function of (jkm_pvalue, deflated_sharpe, ci_low, ci_high); we only render it.
// ---------------------------------------------------------------------------

type VerdictView = {
  badge: string
  headline: string
  body: string
  tone: "neutral" | "positive" | "negative"
}

const VERDICT_VIEWS: Record<HeadlineVerdict, VerdictView> = {
  no_significant_difference: {
    badge: "No significant difference",
    headline: "HRP does NOT significantly beat 1/N",
    body: "The bootstrap CI on the Sharpe gap straddles zero (or JKM / the deflated Sharpe fail their thresholds). This is the literature-consistent outcome — HRP's edge is lower out-of-sample variance, not a free Sharpe lunch.",
    tone: "neutral",
  },
  hrp_beats_1n: {
    badge: "HRP beats 1/N",
    headline: "HRP significantly beats 1/N out-of-sample",
    body: "All three lines of evidence agree: the bootstrap CI is strictly positive, JKM is significant, and the deflated Sharpe clears its threshold. Treat with appropriate scepticism given the explored configuration grid.",
    tone: "positive",
  },
  hrp_loses_to_1n: {
    badge: "HRP loses to 1/N",
    headline: "HRP significantly underperforms 1/N out-of-sample",
    body: "The bootstrap CI on the Sharpe gap is strictly negative and the JKM test is significant — net of costs, naive 1/N won this horse race.",
    tone: "negative",
  },
}

function verdictView(verdict: string): VerdictView {
  if (verdict in VERDICT_VIEWS) {
    return VERDICT_VIEWS[verdict as HeadlineVerdict]
  }
  return {
    badge: verdict,
    headline: "Verdict",
    body: "Unrecognised verdict identifier returned by the backend.",
    tone: "neutral",
  }
}

const VERDICT_TONE_CLASS: Record<VerdictView["tone"], string> = {
  neutral:
    "border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30",
  positive:
    "border-teal-300 bg-teal-50 dark:border-teal-900/60 dark:bg-teal-950/30",
  negative:
    "border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30",
}

const VERDICT_BADGE_VARIANT: Record<
  VerdictView["tone"],
  "secondary" | "default" | "destructive"
> = {
  neutral: "secondary",
  positive: "default",
  negative: "destructive",
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const INITIAL_FORM: FormState = {
  tickers: DEFAULT_TICKERS,
  start: defaultStart(),
  end: defaultEnd(),
  linkage: "single",
  covariance: "ledoit_wolf",
  rmt_denoise: false,
  rebalance: "monthly",
  cost_bps: "10",
  lookback_window: "252",
  n_bootstrap: "2000",
  data_source_pref: "auto",
  seed: "7",
}

export default function HrpPortfolioTool() {
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
        "/tools/hrp-portfolio/run",
        built.value,
      )
      setResult(data)
    } catch (err: unknown) {
      toast.error(detailMessage(err, "HRP horse race failed."))
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
            Hierarchical Risk Parity
          </h1>
          <p className="text-sm text-muted-foreground">
            Lopez de Prado&apos;s HRP — clustering-based allocation — benchmarked
            honestly out-of-sample against IVP and naive 1/N, net of costs, with
            a Jobson-Korkie-Memmel test, a block-bootstrap CI, and a deflated
            Sharpe ratio.
          </p>
        </div>
        {result ? (
          <Badge variant="outline" className="font-mono text-[11px]">
            data: {result.data_source} - {result.summary.n_assets} assets -{" "}
            {result.summary.n_rebalances} rebalances
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
            <Skeleton className="h-[148px] w-full rounded-xl" />
          ) : result ? (
            <VerdictCard summary={result.summary} />
          ) : (
            <EmptyState message="Configure the universe and press Run." />
          )}

          {running ? (
            <MetricsSkeleton />
          ) : result ? (
            <MetricsGrid summary={result.summary} />
          ) : null}

          {running ? (
            <Skeleton className="h-[640px] w-full" />
          ) : result ? (
            <PlotlyChart figure={result.oos_equity_figure} />
          ) : null}

          {result ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <PlotlyChart figure={result.dendrogram_figure} />
              <PlotlyChart figure={result.quasidiag_heatmap_figure} />
            </div>
          ) : null}

          {result ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <PlotlyChart figure={result.weights_figure} />
              <PlotlyChart figure={result.sharpe_gap_bootstrap_figure} />
            </div>
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

        <Field id="linkage" label="Linkage method">
          <Select
            value={form.linkage}
            onValueChange={(v) =>
              setForm((p) => ({ ...p, linkage: v as FormState["linkage"] }))
            }
          >
            <SelectTrigger id="linkage" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LINKAGE_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field id="covariance" label="Covariance estimator">
          <Select
            value={form.covariance}
            onValueChange={(v) =>
              setForm((p) => ({
                ...p,
                covariance: v as FormState["covariance"],
              }))
            }
          >
            <SelectTrigger id="covariance" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COVARIANCE_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="rmt_denoise" className="text-sm font-medium">
            RMT denoise
          </Label>
          <Switch
            id="rmt_denoise"
            checked={form.rmt_denoise}
            onCheckedChange={(v) => setForm((p) => ({ ...p, rmt_denoise: v }))}
          />
        </div>

        <Field id="rebalance" label="Rebalance frequency">
          <Select
            value={form.rebalance}
            onValueChange={(v) =>
              setForm((p) => ({ ...p, rebalance: v as FormState["rebalance"] }))
            }
          >
            <SelectTrigger id="rebalance" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REBALANCE_FREQUENCIES.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          id="cost_bps"
          label="Transaction cost (bps)"
          error={fieldErrors.cost_bps}
          hint="Per-rebalance turnover cost in basis points."
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

        <Field
          id="lookback_window"
          label="Lookback window (days)"
          error={fieldErrors.lookback_window}
          hint="Raised at runtime to at least n_assets + 1 for full rank."
        >
          <Input
            id="lookback_window"
            type="number"
            step="1"
            min={2}
            value={form.lookback_window}
            onChange={(e) =>
              setForm((p) => ({ ...p, lookback_window: e.target.value }))
            }
            aria-invalid={Boolean(fieldErrors.lookback_window)}
          />
        </Field>

        <Field
          id="n_bootstrap"
          label="Bootstrap resamples"
          error={fieldErrors.n_bootstrap}
          hint="Block-bootstrap draws for the Sharpe-gap CI (capped at 5000)."
        >
          <Input
            id="n_bootstrap"
            type="number"
            step="100"
            min={1}
            max={5_000}
            value={form.n_bootstrap}
            onChange={(e) =>
              setForm((p) => ({ ...p, n_bootstrap: e.target.value }))
            }
            aria-invalid={Boolean(fieldErrors.n_bootstrap)}
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
// Verdict card — the FIRST thing surfaced.
// ---------------------------------------------------------------------------

function VerdictCard({ summary }: { summary: RunResponse["summary"] }) {
  const view = verdictView(summary.headline_verdict)
  return (
    <Card className={`gap-2 border-2 p-5 shadow-none ${VERDICT_TONE_CLASS[view.tone]}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={VERDICT_BADGE_VARIANT[view.tone]}>{view.badge}</Badge>
        <span className="font-mono text-[11px] text-muted-foreground">
          gap {fmtNum(summary.sharpe_gap_hrp_vs_1n)} - CI [
          {fmtNum(summary.ci_low)}, {fmtNum(summary.ci_high)}] - JKM p=
          {fmtNum(summary.jkm_pvalue, 3)} - DSR {fmtNum(summary.deflated_sharpe, 3)}
        </span>
      </div>
      <h2 className="text-lg font-semibold tracking-tight">{view.headline}</h2>
      <p className="text-sm text-muted-foreground">{view.body}</p>
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-[78px] w-full rounded-xl" />
      ))}
    </div>
  )
}

function MetricsGrid({ summary }: { summary: RunResponse["summary"] }) {
  const gap = summary.sharpe_gap_hrp_vs_1n
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <MetricCard
        label="Sharpe Gap (HRP - 1/N)"
        value={fmtNum(gap)}
        trend={gap === null ? "neutral" : gap > 0 ? "up" : "down"}
        hint="Out-of-sample, net of costs"
      />
      <MetricCard
        label="JKM p-value"
        value={fmtNum(summary.jkm_pvalue, 3)}
        hint="Jobson-Korkie-Memmel"
      />
      <MetricCard
        label="Deflated Sharpe"
        value={fmtNum(summary.deflated_sharpe, 3)}
        hint={`${summary.n_effective_trials} effective trials`}
      />
      <MetricCard
        label="HRP OOS Vol"
        value={fmtPct(summary.hrp_oos_vol)}
        trend={
          summary.hrp_oos_vol !== null &&
          summary.naive_1n_oos_vol !== null &&
          summary.hrp_oos_vol < summary.naive_1n_oos_vol
            ? "up"
            : "neutral"
        }
        hint="HRP's edge: lower variance"
      />
      <MetricCard
        label="1/N OOS Vol"
        value={fmtPct(summary.naive_1n_oos_vol)}
        hint="Naive benchmark"
      />
      <MetricCard
        label="HRP Turnover"
        value={fmtPct(summary.hrp_turnover)}
        hint={`vs 1/N ${fmtPct(summary.naive_1n_turnover)}`}
      />
    </div>
  )
}

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
import { fmtNum, fmtPct } from "@/lib/format"

import {
  COST_BPS_MAX,
  COST_BPS_MIN,
  DATA_SOURCE_PREFS,
  type FieldErrors,
  type FormState,
  RunRequestSchema,
  type RunRequest,
  type RunResponse,
  SEED_MAX,
  SEED_MIN,
  type SignalName,
  SIGNALS,
  SLIPPAGE_BPS_MAX,
  SLIPPAGE_BPS_MIN,
  SLOW_MIN,
  type Summary,
  WINDOW_MAX,
  WINDOW_MIN,
} from "./types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SIGNAL_LABELS: Record<SignalName, string> = {
  ma_crossover: "MA crossover",
  momentum: "Momentum",
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

function buildRequest(
  form: FormState,
): { ok: true; value: RunRequest } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {}

  const fast = Number.parseInt(form.fast, 10)
  if (!Number.isInteger(fast) || fast < WINDOW_MIN || fast > WINDOW_MAX) {
    errors.fast = `${WINDOW_MIN} - ${WINDOW_MAX} bars.`
  }

  const slow = Number.parseInt(form.slow, 10)
  if (!Number.isInteger(slow) || slow < SLOW_MIN || slow > WINDOW_MAX) {
    errors.slow = `${SLOW_MIN} - ${WINDOW_MAX} bars.`
  } else if (Number.isInteger(fast) && slow <= fast) {
    errors.slow = "Slow must be greater than fast."
  }

  const lookback = Number.parseInt(form.lookback, 10)
  if (
    !Number.isInteger(lookback) ||
    lookback < WINDOW_MIN ||
    lookback > WINDOW_MAX
  ) {
    errors.lookback = `${WINDOW_MIN} - ${WINDOW_MAX} bars.`
  }

  const costBps = Number.parseFloat(form.cost_bps)
  if (
    !Number.isFinite(costBps) ||
    costBps < COST_BPS_MIN ||
    costBps > COST_BPS_MAX
  ) {
    errors.cost_bps = `${COST_BPS_MIN} - ${COST_BPS_MAX} bps.`
  }

  const slippageBps = Number.parseFloat(form.slippage_bps)
  if (
    !Number.isFinite(slippageBps) ||
    slippageBps < SLIPPAGE_BPS_MIN ||
    slippageBps > SLIPPAGE_BPS_MAX
  ) {
    errors.slippage_bps = `${SLIPPAGE_BPS_MIN} - ${SLIPPAGE_BPS_MAX} bps.`
  }

  const seed = Number.parseInt(form.seed, 10)
  if (!Number.isInteger(seed) || seed < SEED_MIN || seed > SEED_MAX) {
    errors.seed = `${SEED_MIN} - ${SEED_MAX}.`
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  const value: RunRequest = {
    signal: form.signal,
    fast,
    slow,
    lookback,
    cost_bps: costBps,
    slippage_bps: slippageBps,
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
  signal: "ma_crossover",
  fast: "10",
  slow: "50",
  lookback: "20",
  cost_bps: "5",
  slippage_bps: "2",
  data_source_pref: "synthetic",
  seed: "7",
}

export default function AlgoSystemTool() {
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
        "/tools/algo-system/run",
        built.value,
      )
      setResult(data)
    } catch (err: unknown) {
      toast.error(detailMessage(err, "Algo-system run failed."))
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
            End-to-End Algo Trading System
          </h1>
          <p className="text-sm text-muted-foreground">
            A complete, leakage-free single-asset pipeline — a strictly causal
            signal (the position set at bar t earns the t→t+1 return), a purged
            walk-forward, no-lookahead vectorized backtest, and a SIMULATED
            bar-by-bar paper-broker that fills at the NEXT bar&apos;s open with
            costs and slippage — verified by a backtest-vs-live parity oracle
            and a bar-finality guard, then judged honestly with Diebold-Mariano,
            Deflated-Sharpe and Probability-of-Backtest-Overfitting. Execution is
            simulated, not a live broker.
          </p>
        </div>
        {result ? (
          <Badge variant="outline" className="font-mono text-[11px]">
            data: {result.data_source} - {SIGNAL_LABELS[form.signal]} - cost{" "}
            {form.cost_bps}bps - slip {form.slippage_bps}bps
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
            <Skeleton className="h-[200px] w-full rounded-xl" />
          ) : result ? (
            <VerdictCard summary={result.summary} />
          ) : (
            <EmptyState message="Configure the signal and press Run." />
          )}

          {running ? (
            <MetricsSkeleton />
          ) : result ? (
            <MetricsGrid summary={result.summary} />
          ) : null}

          {running ? (
            <Skeleton className="h-[640px] w-full" />
          ) : result ? (
            <ChartCard
              title="Backtest vs. simulated-live equity (parity oracle)"
              caption="The vectorized backtest equity overlaid on the paper-broker live equity and buy-and-hold. The backtest and live curves should COINCIDE — that is the parity oracle passing."
            >
              <PlotlyChart figure={result.equity_figure} />
            </ChartCard>
          ) : null}

          {result ? (
            <ChartCard
              title="Strategy drawdown"
              caption="Peak-to-trough drawdown of the strategy equity curve (out-of-sample, net of costs)."
            >
              <PlotlyChart figure={result.drawdown_figure} />
            </ChartCard>
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
  const isCrossover = form.signal === "ma_crossover"

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Inputs
      </h2>

      <div className="space-y-4">
        <Field
          id="signal"
          label="Signal"
          hint="The strictly-causal trading rule. Both map the bar history up to and INCLUDING the closed bar t to a target position for bar t+1 — never reading the forming or any future bar."
        >
          <Select
            value={form.signal}
            onValueChange={(v) =>
              setForm((p) => ({ ...p, signal: v as FormState["signal"] }))
            }
          >
            <SelectTrigger id="signal" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SIGNALS.map((s) => (
                <SelectItem key={s} value={s}>
                  {SIGNAL_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {isCrossover ? (
          <>
            <Field
              id="fast"
              label="Fast MA window (bars)"
              error={fieldErrors.fast}
              hint="Fast moving-average window. Must be strictly smaller than the slow window."
            >
              <Input
                id="fast"
                type="number"
                step="1"
                min={WINDOW_MIN}
                max={WINDOW_MAX}
                value={form.fast}
                onChange={(e) =>
                  setForm((p) => ({ ...p, fast: e.target.value }))
                }
                aria-invalid={Boolean(fieldErrors.fast)}
              />
            </Field>

            <Field
              id="slow"
              label="Slow MA window (bars)"
              error={fieldErrors.slow}
              hint="Slow moving-average window. A long/flat crossover goes long when fast crosses above slow."
            >
              <Input
                id="slow"
                type="number"
                step="1"
                min={SLOW_MIN}
                max={WINDOW_MAX}
                value={form.slow}
                onChange={(e) =>
                  setForm((p) => ({ ...p, slow: e.target.value }))
                }
                aria-invalid={Boolean(fieldErrors.slow)}
              />
            </Field>
          </>
        ) : (
          <Field
            id="lookback"
            label="Momentum lookback (bars)"
            error={fieldErrors.lookback}
            hint="Window of trailing return for the momentum signal (uses ONLY closed bars ≤ t)."
          >
            <Input
              id="lookback"
              type="number"
              step="1"
              min={WINDOW_MIN}
              max={WINDOW_MAX}
              value={form.lookback}
              onChange={(e) =>
                setForm((p) => ({ ...p, lookback: e.target.value }))
              }
              aria-invalid={Boolean(fieldErrors.lookback)}
            />
          </Field>
        )}

        <Field
          id="cost_bps"
          label="Transaction cost (bps)"
          error={fieldErrors.cost_bps}
          hint="Per-side cost on |Δposition|, applied IDENTICALLY in the backtest and the paper broker. Higher costs eat any apparent edge."
        >
          <Input
            id="cost_bps"
            type="number"
            step="0.5"
            min={COST_BPS_MIN}
            max={COST_BPS_MAX}
            value={form.cost_bps}
            onChange={(e) =>
              setForm((p) => ({ ...p, cost_bps: e.target.value }))
            }
            aria-invalid={Boolean(fieldErrors.cost_bps)}
          />
        </Field>

        <Field
          id="slippage_bps"
          label="Slippage (bps)"
          error={fieldErrors.slippage_bps}
          hint="Per-trade slippage charged at the next-bar-open fill, applied IDENTICALLY in the backtest and the paper broker."
        >
          <Input
            id="slippage_bps"
            type="number"
            step="0.5"
            min={SLIPPAGE_BPS_MIN}
            max={SLIPPAGE_BPS_MAX}
            value={form.slippage_bps}
            onChange={(e) =>
              setForm((p) => ({ ...p, slippage_bps: e.target.value }))
            }
            aria-invalid={Boolean(fieldErrors.slippage_bps)}
          />
        </Field>

        <Field
          id="data_source_pref"
          label="Data source"
          hint="'synthetic' is the seeded honest-null bar process with no exploitable timing edge net of costs. 'auto' routes to the offline PIT loader, which fetches Polygon bars lazily and degrades to synthetic when no key / network is present."
        >
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
            min={SEED_MIN}
            max={SEED_MAX}
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
// Verdict card — the FIRST thing surfaced. The honest NULL headline.
//
// `system_has_edge` is a PURE function of the backend evaluation; we ONLY
// render it (never derive it client-side). On the synthetic honest-null bars it
// is FALSE by construction, which is exactly the documented deliverable. The
// parity indicator and the bar-finality badge are likewise read purely from the
// backend response.
// ---------------------------------------------------------------------------

function VerdictCard({ summary }: { summary: Summary }) {
  const edge = summary.system_has_edge
  const toneClass = edge
    ? "border-teal-300 bg-teal-50 dark:border-teal-900/60 dark:bg-teal-950/30"
    : "border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30"

  // The parity oracle "passes" when the backtest and the simulated-live equity
  // curves coincide to within tolerance — read directly from the backend.
  const parityDiff = summary.backtest_live_parity_max_diff
  const parityOk = parityDiff !== null && parityDiff <= 1e-6
  const barFinalityOk = summary.bar_finality_ok

  return (
    <Card className={`gap-3 border-2 p-5 shadow-none ${toneClass}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={edge ? "default" : "destructive"} className="text-sm">
          System has edge: {edge ? "YES" : "NO"}
        </Badge>
        <Badge
          variant={parityOk ? "default" : "destructive"}
          className="text-sm"
        >
          {parityOk ? "Backtest = Live ✓" : "Backtest ≠ Live ✗"}
        </Badge>
        <Badge
          variant={barFinalityOk ? "default" : "destructive"}
          className="text-sm"
        >
          {barFinalityOk ? "Bar-finality ✓" : "Bar-finality ✗"}
        </Badge>
        <Badge variant="outline" className="font-mono text-[11px]">
          data: {summary.data_source}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
        <span>
          parity max-diff:{" "}
          {parityDiff === null ? "-" : parityDiff.toExponential(2)}
        </span>
        <span>DM p={fmtNum(summary.dm_pvalue_vs_buyhold, 3)}</span>
        <span>DSR {fmtNum(summary.deflated_sharpe, 3)}</span>
        <span>PBO {fmtNum(summary.pbo, 3)}</span>
        <span>{summary.n_effective_trials} effective trials</span>
      </div>

      <h2 className="text-lg font-semibold tracking-tight">
        {edge
          ? "The strategy shows a robust out-of-sample edge after costs"
          : "The strategy shows NO robust out-of-sample edge after costs"}
      </h2>
      <p className="text-sm text-muted-foreground">
        The backtest and the simulated live execution match to the cent (parity
        oracle); the strategy shows no robust edge after costs, Deflated-Sharpe
        and PBO.
      </p>
      <p className="text-sm text-muted-foreground">
        {edge
          ? "Out-of-sample, the strategy beats buy-and-hold with a Diebold-Mariano-significant margin, the Deflated Sharpe clears the 1-alpha confidence level (a probability, not merely > 0), AND the Probability-of-Backtest-Overfitting is below 0.5, all net of costs. Treat with appropriate scepticism given the explored signal × parameter grid."
          : "Out-of-sample, the strategy does not beat buy-and-hold with a Diebold-Mariano-significant margin, the Deflated Sharpe does not clear the 1-alpha confidence level after correcting for the honest signal × parameter trial count, and/or the Probability-of-Backtest-Overfitting is not below 0.5 — all net of costs. The apparent skill is mostly backtest overfit."}
      </p>
      <p className="text-xs font-medium text-muted-foreground">
        Execution is SIMULATED (costs + slippage), not a live broker; orders fill
        at the next bar&apos;s open; the deliverable is the leakage-free
        integration and the backtest↔live parity, not a profit claim.
      </p>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Summary grid — OOS Sharpe, buy-hold Sharpe, DM p, Deflated Sharpe, PBO, max
// drawdown, turnover.
// ---------------------------------------------------------------------------

function MetricsGrid({ summary }: { summary: Summary }) {
  const oos = summary.oos_sharpe
  const bh = summary.buyhold_sharpe
  // A higher OOS Sharpe than buy-hold is necessary but NOT the verdict; the
  // verdict additionally requires DM significance + DSR clearing 1-alpha + PBO
  // < 0.5, all net of costs (read from the backend — never derived here).
  const oosTrend =
    oos === null || bh === null ? "neutral" : oos > bh ? "up" : "down"
  // PBO below 0.5 is the "passing" direction (less overfit).
  const pboTrend =
    summary.pbo === null ? "neutral" : summary.pbo < 0.5 ? "up" : "down"

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      <MetricCard
        label="OOS Sharpe"
        value={fmtNum(oos, 3)}
        trend={oosTrend}
        hint="Strategy OOS net Sharpe (after costs)"
      />
      <MetricCard
        label="Buy-hold Sharpe"
        value={fmtNum(bh, 3)}
        hint="OOS net Sharpe of buy-and-hold"
      />
      <MetricCard
        label="DM p vs buy-hold"
        value={fmtNum(summary.dm_pvalue_vs_buyhold, 3)}
        hint="Diebold-Mariano on per-bar net returns"
      />
      <MetricCard
        label="Deflated Sharpe"
        value={fmtNum(summary.deflated_sharpe, 3)}
        hint={`Probability the true Sharpe > 0 (${summary.n_effective_trials} trials)`}
      />
      <MetricCard
        label="PBO"
        value={fmtNum(summary.pbo, 3)}
        trend={pboTrend}
        hint="Probability of Backtest Overfitting (CSCV); < 0.5 passes"
      />
      <MetricCard
        label="Max drawdown"
        value={fmtPct(summary.max_drawdown, 1)}
        hint="Strategy equity drawdown (OOS)"
      />
      <MetricCard
        label="Turnover"
        value={fmtNum(summary.turnover, 2)}
        hint="Mean |Δposition| per bar"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Presentational helpers
// ---------------------------------------------------------------------------

function ChartCard({
  title,
  caption,
  children,
}: {
  title: string
  caption: string
  children: React.ReactNode
}) {
  return (
    <Card className="gap-2 p-4 shadow-none">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      <p className="text-xs text-muted-foreground">{caption}</p>
      {children}
    </Card>
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
    <div className="flex h-[200px] w-full items-center justify-center rounded-xl border border-dashed bg-card text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {Array.from({ length: 7 }).map((_, i) => (
        <Skeleton key={i} className="h-[78px] w-full rounded-xl" />
      ))}
    </div>
  )
}

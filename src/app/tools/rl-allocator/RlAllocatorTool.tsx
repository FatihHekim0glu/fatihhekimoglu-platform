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
  LOOKBACK_MAX,
  LOOKBACK_MIN,
  N_ASSETS_MAX,
  N_ASSETS_MIN,
  N_SEEDS_MAX,
  N_SEEDS_MIN,
  REBALANCE_FREQS,
  type RunRequest,
  RunRequestSchema,
  type RunResponse,
  SEED_MAX,
  SEED_MIN,
  type Summary,
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

  const nAssets = Number.parseInt(form.n_assets, 10)
  if (
    !Number.isInteger(nAssets) ||
    nAssets < N_ASSETS_MIN ||
    nAssets > N_ASSETS_MAX
  ) {
    errors.n_assets = `${N_ASSETS_MIN} - ${N_ASSETS_MAX} assets.`
  }

  const nSeeds = Number.parseInt(form.n_seeds, 10)
  if (!Number.isInteger(nSeeds) || nSeeds < N_SEEDS_MIN || nSeeds > N_SEEDS_MAX) {
    errors.n_seeds = `${N_SEEDS_MIN} - ${N_SEEDS_MAX} seeds.`
  }

  const costBps = Number.parseFloat(form.cost_bps)
  if (
    !Number.isFinite(costBps) ||
    costBps < COST_BPS_MIN ||
    costBps > COST_BPS_MAX
  ) {
    errors.cost_bps = `${COST_BPS_MIN} - ${COST_BPS_MAX} bps.`
  }

  const lookback = Number.parseInt(form.lookback, 10)
  if (
    !Number.isInteger(lookback) ||
    lookback < LOOKBACK_MIN ||
    lookback > LOOKBACK_MAX
  ) {
    errors.lookback = `${LOOKBACK_MIN} - ${LOOKBACK_MAX} bars.`
  }

  const seed = Number.parseInt(form.seed, 10)
  if (!Number.isFinite(seed) || seed < SEED_MIN || seed > SEED_MAX) {
    errors.seed = `${SEED_MIN} - ${SEED_MAX}.`
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  const value: RunRequest = {
    n_assets: nAssets,
    n_seeds: nSeeds,
    cost_bps: costBps,
    lookback,
    rebalance: form.rebalance,
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
  n_assets: "6",
  n_seeds: "5",
  cost_bps: "10",
  lookback: "64",
  rebalance: "monthly",
  data_source_pref: "synthetic",
  seed: "7",
}

export default function RlAllocatorTool() {
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
        "/tools/rl-allocator/run",
        built.value,
      )
      setResult(data)
    } catch (err: unknown) {
      toast.error(detailMessage(err, "RL allocation backtest failed."))
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
            Multi-Asset RL Portfolio Allocator
          </h1>
          <p className="text-sm text-muted-foreground">
            Train a PPO agent to allocate across a multi-asset basket — a simplex
            of portfolio weights — in a cost-aware portfolio environment
            (strictly causal: the weights set at bar t earn the t→t+1 portfolio
            return, the observation at t uses only data ≤ t), evaluated
            out-of-sample inside a purged walk-forward with a
            vectorized-vs-stepwise parity oracle and a seed-lottery overfit check,
            against equal-weight 1/N, Markowitz and risk-parity baselines. The
            policy is trained offline across seeds and served via ONNX; the
            baselines run live.
          </p>
        </div>
        {result ? (
          <Badge variant="outline" className="font-mono text-[11px]">
            data: {result.data_source} - {form.n_assets} assets - {form.n_seeds}{" "}
            seeds - cost {form.cost_bps}bps - {form.rebalance}
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
            <Skeleton className="h-[176px] w-full rounded-xl" />
          ) : result ? (
            <VerdictCard summary={result.summary} />
          ) : (
            <EmptyState message="Configure the basket and press Run." />
          )}

          {running ? (
            <MetricsSkeleton />
          ) : result ? (
            <MetricsGrid summary={result.summary} />
          ) : null}

          {running ? (
            <Skeleton className="h-[640px] w-full" />
          ) : result ? (
            <PlotlyChart figure={result.equity_figure} />
          ) : null}

          {result ? <PlotlyChart figure={result.weights_figure} /> : null}
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
        <Field
          id="n_assets"
          label="Assets in basket"
          error={fieldErrors.n_assets}
          hint="Number of asset classes in the multi-asset panel. The action is a weight VECTOR over these assets, projected onto the long-only simplex (sums to 1 every bar)."
        >
          <Input
            id="n_assets"
            type="number"
            step="1"
            min={N_ASSETS_MIN}
            max={N_ASSETS_MAX}
            value={form.n_assets}
            onChange={(e) =>
              setForm((p) => ({ ...p, n_assets: e.target.value }))
            }
            aria-invalid={Boolean(fieldErrors.n_assets)}
          />
        </Field>

        <Field
          id="n_seeds"
          label="Training seeds"
          error={fieldErrors.n_seeds}
          hint="Independent PPO training seeds. The verdict reads the dispersion of OOS Sharpe across seeds — the seed lottery — not a single run."
        >
          <Input
            id="n_seeds"
            type="number"
            step="1"
            min={N_SEEDS_MIN}
            max={N_SEEDS_MAX}
            value={form.n_seeds}
            onChange={(e) => setForm((p) => ({ ...p, n_seeds: e.target.value }))}
            aria-invalid={Boolean(fieldErrors.n_seeds)}
          />
        </Field>

        <Field
          id="cost_bps"
          label="Turnover cost (bps)"
          error={fieldErrors.cost_bps}
          hint="Per-unit-turnover cost charged on ‖Δw‖₁ at each rebalance, applied identically in train and OOS eval. Higher costs eat any apparent edge."
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
          id="lookback"
          label="Observation lookback (bars)"
          error={fieldErrors.lookback}
          hint="Window of past per-asset returns/features in the observation at bar t (uses ONLY data ≤ t), plus the current weight vector."
        >
          <Input
            id="lookback"
            type="number"
            step="1"
            min={LOOKBACK_MIN}
            max={LOOKBACK_MAX}
            value={form.lookback}
            onChange={(e) =>
              setForm((p) => ({ ...p, lookback: e.target.value }))
            }
            aria-invalid={Boolean(fieldErrors.lookback)}
          />
        </Field>

        <Field
          id="rebalance"
          label="Rebalance frequency"
          hint="How often the target weights are reset. Less frequent rebalancing lowers turnover (and turnover costs)."
        >
          <Select
            value={form.rebalance}
            onValueChange={(v) =>
              setForm((p) => ({
                ...p,
                rebalance: v as FormState["rebalance"],
              }))
            }
          >
            <SelectTrigger id="rebalance" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REBALANCE_FREQS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          id="data_source_pref"
          label="Data source"
          hint="No paid key here — both options resolve to a seeded synthetic multi-asset panel where, by construction, no allocation beats 1/N net of costs (so the honest null holds). Real cross-asset data is the optional offline EODHD/Polygon CLI path."
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
// `rl_beats_baselines` is a pure function of the backend evaluation; we only
// render it. On the synthetic multi-asset panel it is FALSE by construction,
// which is exactly the documented deliverable — across training seeds the agent
// does not beat the best of {1/N, Markowitz, risk-parity} net of costs and the
// OOS Sharpe is indistinguishable from the baselines after a Deflated-Sharpe
// correction + a Probability-of-Backtest-Overfitting check.
// ---------------------------------------------------------------------------

function VerdictCard({ summary }: { summary: Summary }) {
  const beats = summary.rl_beats_baselines
  const toneClass = beats
    ? "border-teal-300 bg-teal-50 dark:border-teal-900/60 dark:bg-teal-950/30"
    : "border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30"

  return (
    <Card className={`gap-2 border-2 p-5 shadow-none ${toneClass}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={beats ? "default" : "destructive"} className="text-sm">
          RL beats baselines: {beats ? "YES" : "NO"}
        </Badge>
        <Badge variant="outline" className="font-mono text-[11px]">
          data: {summary.data_source}
        </Badge>
        <span className="font-mono text-[11px] text-muted-foreground">
          best: {summary.best_baseline} - DM p=
          {fmtNum(summary.dm_pvalue_vs_best, 3)} - DSR{" "}
          {fmtNum(summary.deflated_sharpe, 3)} - PBO {fmtNum(summary.pbo, 3)} -{" "}
          {summary.n_effective_trials} effective trials
        </span>
      </div>
      <h2 className="text-lg font-semibold tracking-tight">
        {beats
          ? "The RL allocator significantly beats the baselines out-of-sample"
          : "The RL allocator does NOT beat the baselines out-of-sample"}
      </h2>
      <p className="text-sm text-muted-foreground">
        Across training seeds the agent doesn&apos;t beat equal-weight /
        Markowitz / risk-parity net of costs — the OOS Sharpe is
        indistinguishable from the baselines (seed-lottery + Deflated Sharpe +
        PBO).
      </p>
      <p className="text-sm text-muted-foreground">
        {beats
          ? "The median-seed OOS Sharpe clears the best baseline with a Diebold-Mariano-significant margin, the across-seed Sharpe lower bound is above zero, the Probability-of-Backtest-Overfitting is below 0.5, AND the Deflated Sharpe exceeds the 1-alpha confidence level net of costs. Treat with appropriate scepticism given the explored seed × hyperparameter grid."
          : "Out-of-sample, the median-seed RL Sharpe does not beat the best of {1/N, Markowitz, risk-parity} with a Diebold-Mariano-significant margin, the across-seed Sharpe band straddles zero, the Probability-of-Backtest-Overfitting is high, and the Deflated Sharpe falls short of the 1-alpha confidence level after correcting for the honest seed × hyperparameter trial count. The apparent skill is mostly training-path overfit — the seed lottery on the largest search surface."}
      </p>
      <p className="text-xs font-medium text-muted-foreground">
        Execution is simulated (turnover costs), not a live broker; the weights at
        t earn the next bar&apos;s portfolio return; weights are a valid simplex
        every bar; no profit is claimed.
      </p>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Summary grid — RL median OOS Sharpe, 1/N / Markowitz / risk-parity Sharpe,
// seed Sharpe lo–hi band, DM p vs best, deflated Sharpe, PBO, max drawdown,
// turnover.
// ---------------------------------------------------------------------------

function seedBand(summary: Summary): string {
  const lo = summary.seed_sharpe_lo
  const hi = summary.seed_sharpe_hi
  if (lo === null && hi === null) return "-"
  return `${fmtNum(lo, 2)} – ${fmtNum(hi, 2)}`
}

function bestBaselineSharpe(summary: Summary): number | null {
  const candidates = [
    summary.oos_sharpe_1n,
    summary.oos_sharpe_markowitz,
    summary.oos_sharpe_riskparity,
  ].filter((v): v is number => v !== null)
  if (candidates.length === 0) return null
  return Math.max(...candidates)
}

function MetricsGrid({ summary }: { summary: Summary }) {
  const rl = summary.oos_sharpe_rl_median
  const best = bestBaselineSharpe(summary)
  // Higher OOS Sharpe than the best baseline is necessary but NOT the verdict;
  // the verdict additionally requires DM significance + DSR > 1-alpha + a
  // positive across-seed Sharpe lower bound + PBO < 0.5, all net of costs (read
  // from the backend).
  const rlTrend =
    rl === null || best === null ? "neutral" : rl > best ? "up" : "down"
  // The seed-lottery band only "passes" when its lower bound is strictly > 0.
  const bandTrend =
    summary.seed_sharpe_lo === null
      ? "neutral"
      : summary.seed_sharpe_lo > 0
        ? "up"
        : "down"
  // PBO < 0.5 is the "passes" side; the higher PBO, the more overfit.
  const pboTrend =
    summary.pbo === null ? "neutral" : summary.pbo < 0.5 ? "up" : "down"

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      <MetricCard
        label="RL median Sharpe"
        value={fmtNum(rl, 3)}
        trend={rlTrend}
        hint="Median OOS net Sharpe across seeds"
      />
      <MetricCard
        label="1/N Sharpe"
        value={fmtNum(summary.oos_sharpe_1n, 3)}
        hint="OOS net Sharpe of equal-weight 1/N"
      />
      <MetricCard
        label="Markowitz Sharpe"
        value={fmtNum(summary.oos_sharpe_markowitz, 3)}
        hint="OOS net Sharpe of mean-variance (train-only covariance)"
      />
      <MetricCard
        label="Risk-parity Sharpe"
        value={fmtNum(summary.oos_sharpe_riskparity, 3)}
        hint="OOS net Sharpe of risk-parity (train-only covariance)"
      />
      <MetricCard
        label="Seed Sharpe band"
        value={seedBand(summary)}
        trend={bandTrend}
        hint="Across-seed OOS Sharpe lo–hi"
      />
      <MetricCard
        label={`DM p vs ${summary.best_baseline}`}
        value={fmtNum(summary.dm_pvalue_vs_best, 3)}
        hint="Diebold-Mariano vs the best baseline"
      />
      <MetricCard
        label="Deflated Sharpe"
        value={fmtNum(summary.deflated_sharpe, 3)}
        trend={
          summary.deflated_sharpe === null
            ? "neutral"
            : summary.deflated_sharpe > 0.95
              ? "up"
              : "down"
        }
        hint={`Probability vs 1-alpha (${summary.n_effective_trials} trials)`}
      />
      <MetricCard
        label="PBO"
        value={fmtNum(summary.pbo, 3)}
        trend={pboTrend}
        hint="Probability of backtest overfitting (CSCV)"
      />
      <MetricCard
        label="Max drawdown"
        value={fmtPct(summary.max_drawdown, 1)}
        hint="RL median equity drawdown (OOS)"
      />
      <MetricCard
        label="Turnover"
        value={fmtNum(summary.turnover, 2)}
        hint="Mean ‖Δw‖₁ per rebalance"
      />
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
    <div className="flex h-[176px] w-full items-center justify-center rounded-xl border border-dashed bg-card text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <Skeleton key={i} className="h-[78px] w-full rounded-xl" />
      ))}
    </div>
  )
}

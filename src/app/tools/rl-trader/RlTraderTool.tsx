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
  EPISODE_LEN_MAX,
  EPISODE_LEN_MIN,
  type FieldErrors,
  type FormState,
  LOOKBACK_MAX,
  LOOKBACK_MIN,
  N_SEEDS_MAX,
  N_SEEDS_MIN,
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

  const episodeLen = Number.parseInt(form.episode_len, 10)
  if (
    !Number.isInteger(episodeLen) ||
    episodeLen < EPISODE_LEN_MIN ||
    episodeLen > EPISODE_LEN_MAX
  ) {
    errors.episode_len = `${EPISODE_LEN_MIN} - ${EPISODE_LEN_MAX} bars.`
  }

  const seed = Number.parseInt(form.seed, 10)
  if (!Number.isFinite(seed) || seed < SEED_MIN || seed > SEED_MAX) {
    errors.seed = `${SEED_MIN} - ${SEED_MAX}.`
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  const value: RunRequest = {
    n_seeds: nSeeds,
    cost_bps: costBps,
    lookback,
    episode_len: episodeLen,
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
  n_seeds: "5",
  cost_bps: "5",
  lookback: "32",
  episode_len: "252",
  data_source_pref: "synthetic",
  seed: "7",
}

export default function RlTraderTool() {
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
        "/tools/rl-trader/run",
        built.value,
      )
      setResult(data)
    } catch (err: unknown) {
      toast.error(detailMessage(err, "RL backtest failed."))
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
            RL Trading Agent (Realistic Backtest)
          </h1>
          <p className="text-sm text-muted-foreground">
            Train a PPO agent in a single-asset trading environment with
            transaction costs, slippage and position limits (strictly causal —
            the position set at bar t earns the t→t+1 return), evaluated
            out-of-sample inside a purged walk-forward with a vectorized-vs-
            stepwise parity oracle and a seed-lottery overfit check. The policy
            is trained offline across seeds and served via ONNX; the baselines
            run live.
          </p>
        </div>
        {result ? (
          <Badge variant="outline" className="font-mono text-[11px]">
            data: {result.data_source} - {form.n_seeds} seeds - cost{" "}
            {form.cost_bps}bps - lookback {form.lookback}
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
            <EmptyState message="Configure the environment and press Run." />
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

          {result ? (
            <PlotlyChart figure={result.seed_lottery_figure} />
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
          label="Transaction cost (bps)"
          error={fieldErrors.cost_bps}
          hint="Per-unit-turnover cost charged on |Δposition|, applied identically in train and OOS eval. Higher costs eat any apparent edge."
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
          hint="Window of past returns/features in the observation at bar t (uses ONLY data ≤ t), plus the current position."
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
          id="episode_len"
          label="Episode length (bars)"
          error={fieldErrors.episode_len}
          hint="Length of each OOS evaluation episode in bars (≈252 ≈ one trading year)."
        >
          <Input
            id="episode_len"
            type="number"
            step="1"
            min={EPISODE_LEN_MIN}
            max={EPISODE_LEN_MAX}
            value={form.episode_len}
            onChange={(e) =>
              setForm((p) => ({ ...p, episode_len: e.target.value }))
            }
            aria-invalid={Boolean(fieldErrors.episode_len)}
          />
        </Field>

        <Field
          id="data_source_pref"
          label="Data source"
          hint="No paid key here — both options resolve to a seeded synthetic price process with no exploitable timing edge net of costs (so the honest null holds)."
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
// `rl_beats_baseline` is a pure function of the backend evaluation; we only
// render it. On the synthetic price process it is FALSE by construction, which
// is exactly the documented deliverable — across training seeds the agent does
// not beat buy-and-hold net of costs and the OOS Sharpe is indistinguishable
// from zero after a Deflated-Sharpe correction.
// ---------------------------------------------------------------------------

function VerdictCard({ summary }: { summary: Summary }) {
  const beats = summary.rl_beats_baseline
  const toneClass = beats
    ? "border-teal-300 bg-teal-50 dark:border-teal-900/60 dark:bg-teal-950/30"
    : "border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30"

  return (
    <Card className={`gap-2 border-2 p-5 shadow-none ${toneClass}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={beats ? "default" : "destructive"} className="text-sm">
          RL beats buy &amp; hold: {beats ? "YES" : "NO"}
        </Badge>
        <Badge variant="outline" className="font-mono text-[11px]">
          data: {summary.data_source}
        </Badge>
        <span className="font-mono text-[11px] text-muted-foreground">
          DM p={fmtNum(summary.dm_pvalue_vs_buyhold, 3)} - DSR{" "}
          {fmtNum(summary.deflated_sharpe, 3)} - {summary.n_effective_trials}{" "}
          effective trials
        </span>
      </div>
      <h2 className="text-lg font-semibold tracking-tight">
        {beats
          ? "The RL agent significantly beats buy-and-hold out-of-sample"
          : "The RL agent does NOT beat buy-and-hold out-of-sample"}
      </h2>
      <p className="text-sm text-muted-foreground">
        Across training seeds the agent doesn&apos;t beat buy-and-hold net of
        costs — the OOS Sharpe is indistinguishable from zero (seed-lottery +
        Deflated Sharpe).
      </p>
      <p className="text-sm text-muted-foreground">
        {beats
          ? "The median-seed OOS Sharpe clears buy-and-hold with a Diebold-Mariano-significant margin, the across-seed Sharpe lower bound is above zero, AND the Deflated Sharpe is positive net of costs. Treat with appropriate scepticism given the explored seed × hyperparameter grid."
          : "Out-of-sample, the median-seed RL Sharpe does not beat buy-and-hold with a Diebold-Mariano-significant margin, the across-seed Sharpe band straddles zero, and the Deflated Sharpe is ~0 after correcting for the honest seed × hyperparameter trial count. The apparent skill is mostly training-path overfit — the seed lottery."}
      </p>
      <p className="text-xs font-medium text-muted-foreground">
        Execution is simulated (costs + slippage), not a live broker; the
        position at t earns the next bar&apos;s return; no profit is claimed.
      </p>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Summary grid — RL median OOS Sharpe, buy-hold Sharpe, seed Sharpe lo–hi
// band, DM p vs buy-hold, deflated Sharpe, max drawdown, turnover.
// ---------------------------------------------------------------------------

function seedBand(summary: Summary): string {
  const lo = summary.seed_sharpe_lo
  const hi = summary.seed_sharpe_hi
  if (lo === null && hi === null) return "-"
  return `${fmtNum(lo, 2)} – ${fmtNum(hi, 2)}`
}

function MetricsGrid({ summary }: { summary: Summary }) {
  const rl = summary.oos_sharpe_rl_median
  const bh = summary.oos_sharpe_buyhold
  // Higher OOS Sharpe than buy-hold is necessary but NOT the verdict; the
  // verdict additionally requires DM significance + DSR > 0 + a positive
  // across-seed Sharpe lower bound, all net of costs (read from the backend).
  const rlTrend =
    rl === null || bh === null ? "neutral" : rl > bh ? "up" : "down"
  // The seed-lottery band only "passes" when its lower bound is strictly > 0.
  const bandTrend =
    summary.seed_sharpe_lo === null
      ? "neutral"
      : summary.seed_sharpe_lo > 0
        ? "up"
        : "down"

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      <MetricCard
        label="RL median Sharpe"
        value={fmtNum(rl, 3)}
        trend={rlTrend}
        hint="Median OOS net Sharpe across seeds"
      />
      <MetricCard
        label="Buy-hold Sharpe"
        value={fmtNum(bh, 3)}
        hint="OOS net Sharpe of buy-and-hold"
      />
      <MetricCard
        label="Seed Sharpe band"
        value={seedBand(summary)}
        trend={bandTrend}
        hint="Across-seed OOS Sharpe lo–hi"
      />
      <MetricCard
        label="DM p vs buy-hold"
        value={fmtNum(summary.dm_pvalue_vs_buyhold, 3)}
        hint="Diebold-Mariano on per-bar net returns"
      />
      <MetricCard
        label="Deflated Sharpe"
        value={fmtNum(summary.deflated_sharpe, 3)}
        trend={
          summary.deflated_sharpe === null
            ? "neutral"
            : summary.deflated_sharpe > 0
              ? "up"
              : "down"
        }
        hint={`${summary.n_effective_trials} effective trials`}
      />
      <MetricCard
        label="Max drawdown"
        value={fmtPct(summary.max_drawdown, 1)}
        hint="RL median equity drawdown (OOS)"
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {Array.from({ length: 7 }).map((_, i) => (
        <Skeleton key={i} className="h-[78px] w-full rounded-xl" />
      ))}
    </div>
  )
}

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
  BASKET_UNIVERSE,
  type BasketSymbol,
  DATA_SOURCE_PREFS,
  DEEP_MODELS,
  DEFAULT_BASKET,
  DEFAULT_TARGET,
  type FieldErrors,
  type FormState,
  type Horizon,
  HORIZONS,
  type Model,
  MODEL_LABELS,
  MODELS,
  type RunRequest,
  RunRequestSchema,
  type RunResponse,
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

function modelLabel(key: string): string {
  return (MODEL_LABELS as Record<string, string>)[key] ?? key
}

function buildRequest(
  form: FormState,
): { ok: true; value: RunRequest } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {}

  if (form.basket.length < 2) {
    errors.basket = "Pick at least 2 symbols."
  }
  if (!form.basket.includes(form.target)) {
    errors.target = "Target must be one of the basket symbols."
  }
  if (form.models.length < 1) {
    errors.models = "Pick at least one model."
  }

  const lookback = Number.parseInt(form.lookback, 10)
  if (!Number.isInteger(lookback) || lookback < 2 || lookback > 512) {
    errors.lookback = "2 - 512 days."
  }

  const seed = Number.parseInt(form.seed, 10)
  if (!Number.isFinite(seed) || seed < 0 || seed > 999_999) {
    errors.seed = "0 - 999999."
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  const value: RunRequest = {
    basket: form.basket,
    target: form.target,
    horizon: form.horizon,
    models: form.models,
    lookback,
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
  basket: DEFAULT_BASKET,
  target: DEFAULT_TARGET,
  horizon: 1,
  models: [...MODELS],
  lookback: "60",
  data_source_pref: "synthetic",
  seed: "7",
}

export default function MvtsForecastTool() {
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
        "/tools/mvts-forecast/run",
        built.value,
      )
      setResult(data)
    } catch (err: unknown) {
      toast.error(detailMessage(err, "Forecast comparison failed."))
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
            Multivariate Transformer Forecast
          </h1>
          <p className="text-sm text-muted-foreground">
            Benchmark PatchTST and an interpretable transformer against an LSTM,
            ARIMA, and a naive random-walk baseline on a multivariate financial
            panel — with leakage-safe RevIN (input-window-only), a purged +
            embargoed walk-forward, Diebold-Mariano tests, and a Deflated Sharpe
            ratio. The deep models are trained offline and served via ONNX.
          </p>
        </div>
        {result ? (
          <Badge variant="outline" className="font-mono text-[11px]">
            data: {result.data_source} - target {form.target} - horizon{" "}
            {form.horizon} - lookback {form.lookback}
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
            <Skeleton className="h-[280px] w-full rounded-xl" />
          ) : result ? (
            <ModelTable summary={result.summary} />
          ) : null}

          {running ? (
            <Skeleton className="h-[640px] w-full" />
          ) : result ? (
            <PlotlyChart figure={result.forecast_figure} />
          ) : null}

          {result ? <PlotlyChart figure={result.error_figure} /> : null}
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
  const toggleBasket = (sym: BasketSymbol) => {
    setForm((p) => {
      const has = p.basket.includes(sym)
      const basket = has
        ? p.basket.filter((s) => s !== sym)
        : [...p.basket, sym]
      // Keep the target inside the basket; fall back to the first member.
      const target =
        basket.length > 0 && !basket.includes(p.target) ? basket[0] : p.target
      return { ...p, basket, target }
    })
  }

  const toggleModel = (model: Model) => {
    setForm((p) => {
      const has = p.models.includes(model)
      const models = has
        ? p.models.filter((m) => m !== model)
        : [...p.models, model]
      return { ...p, models }
    })
  }

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Inputs
      </h2>

      <div className="space-y-4">
        <Field
          id="basket"
          label="Basket"
          error={fieldErrors.basket}
          hint="Correlated return series. The shipped model trains on a synthetic panel; labels are illustrative."
        >
          <div className="grid grid-cols-2 gap-1.5">
            {BASKET_UNIVERSE.map((sym) => {
              const checked = form.basket.includes(sym)
              return (
                <button
                  key={sym}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggleBasket(sym)}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 font-mono text-xs transition-colors ${
                    checked
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-input bg-transparent text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <span>{sym}</span>
                  <span
                    className={`size-3.5 rounded-sm border ${
                      checked
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/40"
                    }`}
                    aria-hidden
                  />
                </button>
              )
            })}
          </div>
        </Field>

        <Field
          id="target"
          label="Target series"
          error={fieldErrors.target}
          hint="The series whose next-step return is forecast."
        >
          <Select
            value={form.target}
            onValueChange={(v) =>
              setForm((p) => ({ ...p, target: v as BasketSymbol }))
            }
          >
            <SelectTrigger id="target" className="w-full font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {form.basket.map((sym) => (
                <SelectItem key={sym} value={sym} className="font-mono">
                  {sym}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          id="horizon"
          label="Forecast horizon (days)"
          hint="Next-step return target; 5 chains one-step forecasts."
        >
          <Select
            value={String(form.horizon)}
            onValueChange={(v) =>
              setForm((p) => ({
                ...p,
                horizon: Number.parseInt(v, 10) as Horizon,
              }))
            }
          >
            <SelectTrigger id="horizon" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HORIZONS.map((h) => (
                <SelectItem key={h} value={String(h)}>
                  {h === 1 ? "1 day" : "5 days (weekly)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field id="models" label="Models" error={fieldErrors.models}>
          <div className="grid grid-cols-1 gap-1.5">
            {MODELS.map((model) => {
              const checked = form.models.includes(model)
              return (
                <button
                  key={model}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggleModel(model)}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors ${
                    checked
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-input bg-transparent text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <span>{MODEL_LABELS[model]}</span>
                  <span
                    className={`size-3.5 rounded-sm border ${
                      checked
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/40"
                    }`}
                    aria-hidden
                  />
                </button>
              )
            })}
          </div>
        </Field>

        <Field
          id="lookback"
          label="Lookback window (days)"
          error={fieldErrors.lookback}
          hint="RevIN / instance-norm context; also the purge gap so no window straddles a split."
        >
          <Input
            id="lookback"
            type="number"
            step="1"
            min={2}
            max={512}
            value={form.lookback}
            onChange={(e) =>
              setForm((p) => ({ ...p, lookback: e.target.value }))
            }
            aria-invalid={Boolean(fieldErrors.lookback)}
          />
        </Field>

        <Field
          id="data_source_pref"
          label="Data source"
          hint="No API keys here — both options resolve to a seeded synthetic correlated-returns panel."
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
// Verdict card — the FIRST thing surfaced. The honest NULL headline.
//
// `deep_beats_naive` is a pure function of the inference on the backend; we
// only render it. On a synthetic correlated-returns panel it is FALSE by
// construction, which is exactly the documented deliverable. The DM p-value
// shown is the smallest (most favourable) deep-vs-naive p, the deflated Sharpe
// is the best across deep models.
// ---------------------------------------------------------------------------

function bestDeepDmPvalue(summary: Summary): number | null {
  const ps = DEEP_MODELS.map((m) => summary.dm_pvalue_vs_naive[m]).filter(
    (p): p is number => typeof p === "number",
  )
  return ps.length > 0 ? Math.min(...ps) : null
}

function bestDeepDsr(summary: Summary): number | null {
  const ds = DEEP_MODELS.map((m) => summary.deflated_sharpe[m]).filter(
    (d): d is number => typeof d === "number",
  )
  return ds.length > 0 ? Math.max(...ds) : null
}

function bestDeepRmse(summary: Summary): number | null {
  const rs = DEEP_MODELS.map((m) => summary.rmse_by_model[m]).filter(
    (r): r is number => typeof r === "number",
  )
  return rs.length > 0 ? Math.min(...rs) : null
}

function VerdictCard({ summary }: { summary: Summary }) {
  const beats = summary.deep_beats_naive
  const toneClass = beats
    ? "border-teal-300 bg-teal-50 dark:border-teal-900/60 dark:bg-teal-950/30"
    : "border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30"

  return (
    <Card className={`gap-2 border-2 p-5 shadow-none ${toneClass}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={beats ? "default" : "destructive"} className="text-sm">
          Deep beats naive: {beats ? "YES" : "NO"}
        </Badge>
        <Badge variant="outline" className="font-mono text-[11px]">
          data: {summary.data_source}
        </Badge>
        <span className="font-mono text-[11px] text-muted-foreground">
          best DM p={fmtNum(bestDeepDmPvalue(summary), 3)} - best deep DSR{" "}
          {fmtNum(bestDeepDsr(summary), 3)} - {summary.n_effective_trials}{" "}
          effective trials
        </span>
      </div>
      <h2 className="text-lg font-semibold tracking-tight">
        {beats
          ? "A deep model significantly beats naive out-of-sample"
          : "The deep models do NOT beat the naive random walk"}
      </h2>
      <p className="text-sm text-muted-foreground">
        On noisy daily returns, transformers don&apos;t reliably beat a random
        walk after costs — a leakage-free null.
      </p>
      <p className="text-sm text-muted-foreground">
        {beats
          ? "A deep model clears its margin with a Diebold-Mariano-significant edge over naive AND a Deflated Sharpe above zero. Treat with appropriate scepticism given the explored architecture × hyperparameter grid."
          : "Out-of-sample, no deep model beats the naive last-value forecast with a Diebold-Mariano-significant margin, and the Deflated Sharpe is ~0 after correcting for the explored configuration grid. This is the correct, literature-backed null."}
      </p>
      <p className="text-xs font-medium text-muted-foreground">
        Forecasts returns, not prices; no price-level R²; does not beat a random
        walk.
      </p>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Summary grid — best model, naive RMSE, best-deep RMSE, DM p vs naive,
// Deflated Sharpe.
// ---------------------------------------------------------------------------

function MetricsGrid({ summary }: { summary: Summary }) {
  const naiveRmse = summary.rmse_by_model.naive ?? null
  const deepRmse = bestDeepRmse(summary)
  const bestDm = bestDeepDmPvalue(summary)
  const bestDsr = bestDeepDsr(summary)
  // Deep beats naive on raw RMSE only if it is strictly lower — but that is NOT
  // the verdict; the verdict additionally requires DM significance + DSR > 0.
  const deepRmseTrend =
    deepRmse === null || naiveRmse === null
      ? "neutral"
      : deepRmse < naiveRmse
        ? "up"
        : "down"

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <MetricCard
        label="Best Model"
        value={modelLabel(summary.best_model)}
        hint="Lowest out-of-sample return RMSE"
      />
      <MetricCard
        label="Naive RMSE"
        value={fmtNum(naiveRmse, 5)}
        hint="Random-walk floor, return space"
      />
      <MetricCard
        label="Best-Deep RMSE"
        value={fmtNum(deepRmse, 5)}
        trend={deepRmseTrend}
        hint="Lowest RMSE among the deep models"
      />
      <MetricCard
        label="DM p vs Naive"
        value={fmtNum(bestDm, 3)}
        hint="Smallest (most favourable) deep p"
      />
      <MetricCard
        label="Deflated Sharpe"
        value={fmtNum(bestDsr, 3)}
        trend={bestDsr === null ? "neutral" : bestDsr > 0 ? "up" : "down"}
        hint={`${summary.n_effective_trials} effective trials`}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Per-model table — OOS return RMSE, directional accuracy, DM p vs naive,
// Deflated Sharpe.
// ---------------------------------------------------------------------------

function ModelTable({ summary }: { summary: Summary }) {
  const rows = MODELS.filter(
    (m) => m in summary.rmse_by_model || summary.rmse_by_model[m] != null,
  )
    .map((key) => ({
      key,
      rmse: summary.rmse_by_model[key] ?? null,
      dir: summary.directional_acc_by_model[key] ?? null,
      dm: summary.dm_pvalue_vs_naive[key] ?? null,
      dsr: summary.deflated_sharpe[key] ?? null,
      isNaive: key === "naive",
      isBest: key === summary.best_model,
    }))
    .sort((a, b) => {
      const av = a.rmse ?? Number.POSITIVE_INFINITY
      const bv = b.rmse ?? Number.POSITIVE_INFINITY
      return av - bv
    })

  return (
    <Card className="gap-3 p-4 shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">
          Out-of-sample metrics by model
        </h2>
        <span className="text-[11px] text-muted-foreground">
          Lower RMSE is better - DM p-value is vs the naive baseline
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Model</th>
              <th className="py-2 pr-3 text-right font-medium">RMSE</th>
              <th className="py-2 pr-3 text-right font-medium">Dir. acc</th>
              <th className="py-2 pr-3 text-right font-medium">DM p (vs naive)</th>
              <th className="py-2 text-right font-medium">DSR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b last:border-0">
                <td className="py-2 pr-3">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{modelLabel(r.key)}</span>
                    {r.isBest ? (
                      <Badge variant="secondary" className="text-[10px]">
                        best
                      </Badge>
                    ) : null}
                    {r.isNaive ? (
                      <Badge variant="outline" className="text-[10px]">
                        baseline
                      </Badge>
                    ) : null}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums">
                  {fmtNum(r.rmse, 5)}
                </td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums">
                  {fmtPct(r.dir)}
                </td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums">
                  {r.isNaive ? "—" : fmtNum(r.dm, 3)}
                </td>
                <td className="py-2 text-right font-mono tabular-nums">
                  {fmtNum(r.dsr, 3)}
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-[78px] w-full rounded-xl" />
      ))}
    </div>
  )
}

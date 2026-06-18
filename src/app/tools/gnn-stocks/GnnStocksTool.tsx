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
import { fmtNum } from "@/lib/format"

import {
  BASELINE_MODELS,
  DATA_SOURCE_PREFS,
  type FieldErrors,
  type FormState,
  GNN_MODELS,
  GRAPH_TYPE_LABELS,
  GRAPH_TYPES,
  type GraphType,
  type Horizon,
  HORIZONS,
  type Model,
  MODEL_LABELS,
  MODELS,
  N_ASSETS_MAX,
  N_ASSETS_MIN,
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

  const nAssets = Number.parseInt(form.n_assets, 10)
  if (
    !Number.isInteger(nAssets) ||
    nAssets < N_ASSETS_MIN ||
    nAssets > N_ASSETS_MAX
  ) {
    errors.n_assets = `${N_ASSETS_MIN} - ${N_ASSETS_MAX} assets.`
  }

  if (form.models.length < 1) {
    errors.models = "Pick at least one model."
  }

  const lookback = Number.parseInt(form.lookback, 10)
  if (!Number.isInteger(lookback) || lookback < 5 || lookback > 252) {
    errors.lookback = "5 - 252 days."
  }

  const seed = Number.parseInt(form.seed, 10)
  if (!Number.isFinite(seed) || seed < 0 || seed > 999_999) {
    errors.seed = "0 - 999999."
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  const value: RunRequest = {
    n_assets: nAssets,
    graph_type: form.graph_type,
    models: form.models,
    lookback,
    horizon: form.horizon,
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
  n_assets: "40",
  graph_type: "corr_knn",
  models: [...MODELS],
  lookback: "60",
  horizon: 1,
  data_source_pref: "synthetic",
  seed: "7",
}

export default function GnnStocksTool() {
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
        "/tools/gnn-stocks/run",
        built.value,
      )
      setResult(data)
    } catch (err: unknown) {
      toast.error(detailMessage(err, "GNN comparison failed."))
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
            Graph Neural Network on Stocks
          </h1>
          <p className="text-sm text-muted-foreground">
            Build a point-in-time stock-relationship graph from rolling return
            correlations and run a dense-adjacency GCN / GraphSAGE against
            per-node ridge and cross-sectional-momentum baselines for
            next-period return ranking — with leakage-safe per-fold graphs, a
            purged + embargoed walk-forward, Diebold-Mariano tests, and a
            Deflated Sharpe ratio. The GNNs are trained offline and served via
            ONNX.
          </p>
        </div>
        {result ? (
          <Badge variant="outline" className="font-mono text-[11px]">
            data: {result.data_source} - graph {form.graph_type} - horizon{" "}
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
            <EmptyState message="Configure the universe and press Run." />
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
            <PlotlyChart figure={result.graph_figure} />
          ) : null}

          {result ? <PlotlyChart figure={result.ic_figure} /> : null}
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
          id="n_assets"
          label="Universe size (nodes)"
          error={fieldErrors.n_assets}
          hint="Number of stocks (graph nodes). The shipped model trains on a synthetic block-factor panel; the universe size is illustrative."
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
          id="graph_type"
          label="Graph construction"
          hint="Per-fold adjacency built on the TRAIN window only. 'none' is the no-edges ablation."
        >
          <Select
            value={form.graph_type}
            onValueChange={(v) =>
              setForm((p) => ({ ...p, graph_type: v as GraphType }))
            }
          >
            <SelectTrigger id="graph_type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GRAPH_TYPES.map((g) => (
                <SelectItem key={g} value={g}>
                  {GRAPH_TYPE_LABELS[g]}
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
          hint="Feature / correlation window; also the purge gap so no window straddles a split."
        >
          <Input
            id="lookback"
            type="number"
            step="1"
            min={5}
            max={252}
            value={form.lookback}
            onChange={(e) =>
              setForm((p) => ({ ...p, lookback: e.target.value }))
            }
            aria-invalid={Boolean(fieldErrors.lookback)}
          />
        </Field>

        <Field
          id="horizon"
          label="Forecast horizon (days)"
          hint="Next-period cross-sectional return target; 5 ranks over the weekly horizon."
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

        <Field
          id="data_source_pref"
          label="Data source"
          hint="No paid key here — both options resolve to a seeded synthetic block-factor panel."
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
// `gnn_beats_baseline` is a pure function of the inference on the backend; we
// only render it. On a synthetic block-factor panel it is FALSE by
// construction, which is exactly the documented deliverable. The DM p-value
// shown is the smallest (most favourable) GNN-vs-baseline p, the deflated
// Sharpe is the best across GNN models.
// ---------------------------------------------------------------------------

function bestGnnDmPvalue(summary: Summary): number | null {
  const ps = GNN_MODELS.map((m) => summary.dm_pvalue_vs_baseline[m]).filter(
    (p): p is number => typeof p === "number",
  )
  return ps.length > 0 ? Math.min(...ps) : null
}

function bestGnnDsr(summary: Summary): number | null {
  const ds = GNN_MODELS.map((m) => summary.deflated_sharpe[m]).filter(
    (d): d is number => typeof d === "number",
  )
  return ds.length > 0 ? Math.max(...ds) : null
}

function bestGnnIc(summary: Summary): number | null {
  const ics = GNN_MODELS.map((m) => summary.ic_by_model[m]).filter(
    (r): r is number => typeof r === "number",
  )
  return ics.length > 0 ? Math.max(...ics) : null
}

function bestBaselineIc(summary: Summary): number | null {
  const ics = BASELINE_MODELS.map((m) => summary.ic_by_model[m]).filter(
    (r): r is number => typeof r === "number",
  )
  return ics.length > 0 ? Math.max(...ics) : null
}

function VerdictCard({ summary }: { summary: Summary }) {
  const beats = summary.gnn_beats_baseline
  const toneClass = beats
    ? "border-teal-300 bg-teal-50 dark:border-teal-900/60 dark:bg-teal-950/30"
    : "border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30"

  return (
    <Card className={`gap-2 border-2 p-5 shadow-none ${toneClass}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={beats ? "default" : "destructive"} className="text-sm">
          GNN beats baselines: {beats ? "YES" : "NO"}
        </Badge>
        <Badge variant="outline" className="font-mono text-[11px]">
          data: {summary.data_source}
        </Badge>
        <span className="font-mono text-[11px] text-muted-foreground">
          best DM p={fmtNum(bestGnnDmPvalue(summary), 3)} - best GNN DSR{" "}
          {fmtNum(bestGnnDsr(summary), 3)} - {summary.n_effective_trials}{" "}
          effective trials
        </span>
      </div>
      <h2 className="text-lg font-semibold tracking-tight">
        {beats
          ? "A GNN significantly beats the baselines out-of-sample"
          : "The GNNs do NOT beat the ridge / momentum baselines"}
      </h2>
      <p className="text-sm text-muted-foreground">
        Message-passing over the correlation graph recovers sectors but
        doesn&apos;t reliably beat ridge/momentum out-of-sample — a leakage-free
        null.
      </p>
      <p className="text-sm text-muted-foreground">
        {beats
          ? "A GNN clears its margin with a Diebold-Mariano-significant edge on the rank-IC / return differential over the best baseline AND a Deflated Sharpe above zero net of costs. Treat with appropriate scepticism given the explored graph-type × model × hyperparameter grid."
          : "Out-of-sample, no GNN beats the best of the ridge / cross-sectional-momentum baselines on rank-IC or long-short decile spread with a Diebold-Mariano-significant margin, and the Deflated Sharpe is ~0 after correcting for the explored configuration grid. This is the correct, literature-backed null."}
      </p>
      <p className="text-xs font-medium text-muted-foreground">
        Ranks next-period cross-sectional returns, not levels; no baseline-free
        R²; does not beat the baselines after costs.
      </p>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Summary grid — best model, GNN rank-IC, best-baseline rank-IC, DM p vs
// baseline, Deflated Sharpe.
// ---------------------------------------------------------------------------

function MetricsGrid({ summary }: { summary: Summary }) {
  const gnnIc = bestGnnIc(summary)
  const baselineIc = bestBaselineIc(summary)
  const bestDm = bestGnnDmPvalue(summary)
  const bestDsr = bestGnnDsr(summary)
  // The GNN beats the baseline on raw rank-IC only if it is strictly higher —
  // but that is NOT the verdict; the verdict additionally requires DM
  // significance + DSR > 0 net of costs.
  const gnnIcTrend =
    gnnIc === null || baselineIc === null
      ? "neutral"
      : gnnIc > baselineIc
        ? "up"
        : "down"

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <MetricCard
        label="Best Model"
        value={modelLabel(summary.best_model)}
        hint="Highest out-of-sample rank-IC"
      />
      <MetricCard
        label="GNN rank-IC"
        value={fmtNum(gnnIc, 4)}
        trend={gnnIcTrend}
        hint="Best Spearman rank-IC among the GNNs"
      />
      <MetricCard
        label="Baseline rank-IC"
        value={fmtNum(baselineIc, 4)}
        hint="Best ridge / momentum rank-IC"
      />
      <MetricCard
        label="DM p vs Baseline"
        value={fmtNum(bestDm, 3)}
        hint="Smallest (most favourable) GNN p"
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
// Per-model table — OOS rank-IC, long-short Sharpe, DM p vs baseline,
// Deflated Sharpe.
// ---------------------------------------------------------------------------

function ModelTable({ summary }: { summary: Summary }) {
  const rows = MODELS.filter((m) => summary.ic_by_model[m] != null)
    .map((key) => ({
      key,
      ic: summary.ic_by_model[key] ?? null,
      sharpe: summary.ls_sharpe_by_model[key] ?? null,
      dm: summary.dm_pvalue_vs_baseline[key] ?? null,
      dsr: summary.deflated_sharpe[key] ?? null,
      isBaseline: (BASELINE_MODELS as Model[]).includes(key),
      isBest: key === summary.best_model,
    }))
    .sort((a, b) => {
      const av = a.ic ?? Number.NEGATIVE_INFINITY
      const bv = b.ic ?? Number.NEGATIVE_INFINITY
      return bv - av
    })

  return (
    <Card className="gap-3 p-4 shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">
          Out-of-sample metrics by model
        </h2>
        <span className="text-[11px] text-muted-foreground">
          Higher rank-IC is better - DM p-value is vs the best baseline
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Model</th>
              <th className="py-2 pr-3 text-right font-medium">Rank-IC</th>
              <th className="py-2 pr-3 text-right font-medium">LS Sharpe</th>
              <th className="py-2 pr-3 text-right font-medium">
                DM p (vs baseline)
              </th>
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
                    {r.isBaseline ? (
                      <Badge variant="outline" className="text-[10px]">
                        baseline
                      </Badge>
                    ) : null}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums">
                  {fmtNum(r.ic, 4)}
                </td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums">
                  {fmtNum(r.sharpe, 3)}
                </td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums">
                  {r.isBaseline ? "—" : fmtNum(r.dm, 3)}
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

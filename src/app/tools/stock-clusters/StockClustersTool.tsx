"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/sonner"
import MetricCard from "@/components/MetricCard"
import PlotlyChart, { type PlotlyFigure } from "@/components/PlotlyChart"
import { ApiError, apiPost } from "@/lib/api"
import { fmtNum, fmtPct } from "@/lib/format"

import {
  CLUSTER_METHODS,
  DEFAULT_TICKERS,
  type Diversification,
  type FieldErrors,
  type FormState,
  GAP_B_CAP,
  type HeadlineVerdict,
  K_SPAN_CAP,
  LINKAGE_METHODS,
  type RunRequest,
  RunRequestSchema,
  type RunResponse,
  type Summary,
  TICKER_LIST_RE,
  UNIVERSES,
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

/** Diversification is a full object only when it's not "deferred"/null. */
function isDiversificationResult(
  value: RunResponse["diversification"],
): value is Diversification {
  return value !== null && value !== "deferred"
}

function buildRequest(
  form: FormState,
): { ok: true; value: RunRequest } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {}
  const isCustom = form.universe === "custom"

  const tickersTrimmed = form.tickers.trim()
  if (isCustom) {
    if (!tickersTrimmed) {
      errors.tickers = "Tickers are required for a custom universe."
    } else if (!TICKER_LIST_RE.test(tickersTrimmed)) {
      errors.tickers = "Letters, digits, '.', '-', and commas only."
    } else if (parseTickerCount(tickersTrimmed) < 2) {
      errors.tickers = "Need at least 2 symbols."
    }
  }

  if (!form.start) errors.start = "Start date is required."
  if (!form.end) errors.end = "End date is required."
  if (form.start && form.end && form.end <= form.start) {
    errors.end = "End must be after start."
  }

  const kMin = Number.parseInt(form.k_min, 10)
  if (!Number.isInteger(kMin) || kMin < 2 || kMin > 20) {
    errors.k_min = "2 - 20."
  }
  const kMax = Number.parseInt(form.k_max, 10)
  if (!Number.isInteger(kMax) || kMax < 2 || kMax > 20) {
    errors.k_max = "2 - 20."
  }
  if (
    Number.isInteger(kMin) &&
    Number.isInteger(kMax) &&
    !errors.k_min &&
    !errors.k_max
  ) {
    if (kMax < kMin) {
      errors.k_max = "k_max must be ≥ k_min."
    } else if (kMax - kMin > K_SPAN_CAP) {
      errors.k_max = `Span k_max − k_min must be ≤ ${K_SPAN_CAP}.`
    }
  }

  let nClusters: number | null = null
  if (!form.auto_k) {
    const fixed = Number.parseInt(form.n_clusters, 10)
    if (!Number.isInteger(fixed) || fixed < 2 || fixed > 20) {
      errors.n_clusters = "2 - 20."
    } else {
      nClusters = fixed
    }
  }

  const costBps = Number.parseFloat(form.cost_bps)
  if (!Number.isFinite(costBps) || costBps < 0 || costBps > 500) {
    errors.cost_bps = "0 - 500 bps."
  }

  const embargo = Number.parseInt(form.embargo_days, 10)
  if (!Number.isInteger(embargo) || embargo < 0 || embargo > 60) {
    errors.embargo_days = "0 - 60 days."
  }

  const trainWindow = Number.parseInt(form.train_window, 10)
  if (!Number.isInteger(trainWindow) || trainWindow < 2 || trainWindow > 2_520) {
    errors.train_window = "2 - 2520 days."
  }

  const gapB = Number.parseInt(form.gap_B, 10)
  if (!Number.isInteger(gapB) || gapB < 1 || gapB > GAP_B_CAP) {
    errors.gap_B = `1 - ${GAP_B_CAP} (capped).`
  }

  const seed = Number.parseInt(form.seed, 10)
  if (!Number.isFinite(seed) || seed < 0 || seed > 999_999) {
    errors.seed = "0 - 999999."
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  const value: RunRequest = {
    universe: form.universe,
    start: form.start,
    end: form.end,
    method: form.method,
    linkage: form.linkage,
    n_clusters: nClusters,
    k_min: kMin,
    k_max: kMax,
    denoise: form.denoise,
    distance: "mantegna",
    run_diversification: form.run_diversification,
    cost_bps: costBps,
    embargo_days: embargo,
    train_window: trainWindow,
    gap_B: gapB,
    seed,
  }
  if (isCustom) {
    value.tickers = tickersTrimmed
  }
  RunRequestSchema.parse(value)
  return { ok: true, value }
}

// ---------------------------------------------------------------------------
// Verdict presentation — the honest headline. The backend's verdict is a pure
// function of (memmel_jk_pvalue, deflated_sharpe, sharpe_diff_vs_1overN); we
// only render it.
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
    headline: "Cluster-aware allocation does NOT significantly beat 1/N",
    body: "The Memmel-JK test is insignificant or the deflated Sharpe is non-positive after accounting for every swept configuration. This is the literature-consistent outcome — the clusters are a diagnostic map of the correlation skeleton, not a source of free alpha.",
    tone: "neutral",
  },
  clusters_beat_1n: {
    badge: "Clusters beat 1/N",
    headline: "Cluster-aware allocation significantly beats 1/N out-of-sample",
    body: "Both lines of evidence agree: the Memmel-JK p-value is significant and the deflated Sharpe clears its threshold net of costs. Treat with appropriate scepticism given the explored configuration grid.",
    tone: "positive",
  },
  clusters_lose_to_1n: {
    badge: "Clusters lose to 1/N",
    headline: "Cluster-aware allocation significantly underperforms 1/N",
    body: "The Sharpe difference is negative and the Memmel-JK test is significant — net of costs, naive 1/N won this horse race.",
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
  // Default to the visible curated large-cap list: a clicked Run returns a fast,
  // real-data cluster map. The full point-in-time S&P 500 (sp500_pit) is the
  // heavy research path — opt into it for the survivorship-clean diversification
  // backtest, not for the interactive cluster map.
  universe: "custom",
  start: defaultStart(),
  end: defaultEnd(),
  method: "both",
  linkage: "average",
  auto_k: true,
  n_clusters: "8",
  k_min: "2",
  k_max: "20",
  denoise: true,
  run_diversification: false,
  cost_bps: "5",
  embargo_days: "5",
  train_window: "504",
  gap_B: "20",
  seed: "0",
}

export default function StockClustersTool() {
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
        "/tools/stock-clusters/run",
        built.value,
      )
      setResult(data)
    } catch (err: unknown) {
      toast.error(detailMessage(err, "Clustering run failed."))
    } finally {
      setRunning(false)
    }
  }, [form])

  const diversification = result?.diversification ?? null
  const divResult = isDiversificationResult(diversification)
    ? diversification
    : null
  const divDeferred = diversification === "deferred"

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <Toaster position="top-right" />
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Stock Diversification Clusters
          </h1>
          <p className="text-sm text-muted-foreground">
            Cluster the S&amp;P 500 by correlation structure — RMT-denoised,
            Mantegna distance — to map its diversification skeleton, then
            honestly test whether cluster-aware allocation beats naive 1/N after
            costs (it usually doesn&apos;t).
          </p>
        </div>
        {result ? (
          <Badge variant="outline" className="font-mono text-[11px]">
            data: {result.data_source} - {result.summary.n_assets} assets -{" "}
            {result.summary.n_clusters_selected} clusters
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
            <Skeleton className="h-[120px] w-full rounded-xl" />
          ) : result ? (
            result.summary.survivorship_warning ? (
              <SurvivorshipBanner caveat={result.summary.survivorship_caveat} />
            ) : null
          ) : (
            <EmptyState message="Configure the universe and press Run." />
          )}

          {running ? (
            <MetricsSkeleton />
          ) : result ? (
            <SummaryGrid summary={result.summary} />
          ) : null}

          {running ? (
            <Skeleton className="h-[700px] w-full rounded-xl" />
          ) : result ? (
            <FigureTabs result={result} />
          ) : null}

          {result ? <ClusterTable clusters={result.clusters} /> : null}

          {result && divResult ? (
            <>
              <VerdictCard summary={result.summary} div={divResult} />
              <DiversificationGrid div={divResult} />
            </>
          ) : null}

          {divDeferred ? <DeferredNote /> : null}

          {result?.equity_curve_figure ? (
            <PlotlyChart figure={result.equity_curve_figure} />
          ) : null}

          {result?.stability_figure ? (
            <PlotlyChart figure={result.stability_figure} />
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
  const costBps = Number.parseFloat(form.cost_bps)
  const costBpsValue = Number.isFinite(costBps) ? costBps : 5

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Inputs
      </h2>

      <div className="space-y-4">
        <Field id="universe" label="Universe">
          <Select
            value={form.universe}
            onValueChange={(v) =>
              setForm((p) => ({ ...p, universe: v as FormState["universe"] }))
            }
          >
            <SelectTrigger id="universe" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIVERSES.map((m) => (
                <SelectItem key={m} value={m}>
                  {m === "sp500_pit" ? "S&P 500 (point-in-time)" : "Custom"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {form.universe === "custom" ? (
          <Field id="tickers" label="Tickers" error={fieldErrors.tickers}>
            <textarea
              id="tickers"
              value={form.tickers}
              onChange={(e) =>
                setForm((p) => ({ ...p, tickers: e.target.value }))
              }
              onBlur={(e) =>
                setForm((p) => ({ ...p, tickers: e.target.value.toUpperCase() }))
              }
              rows={3}
              spellCheck={false}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs uppercase shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              aria-invalid={Boolean(fieldErrors.tickers)}
            />
          </Field>
        ) : null}

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

        <Field id="method" label="Clustering method">
          <Select
            value={form.method}
            onValueChange={(v) =>
              setForm((p) => ({ ...p, method: v as FormState["method"] }))
            }
          >
            <SelectTrigger id="method" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLUSTER_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

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

        <div className="flex items-center justify-between gap-2">
          <div className="space-y-0.5">
            <Label htmlFor="auto_k" className="text-sm font-medium">
              Auto-select k (gap statistic)
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Tibshirani 1-SE rule vs a phase-randomized null.
            </p>
          </div>
          <Switch
            id="auto_k"
            checked={form.auto_k}
            onCheckedChange={(v) => setForm((p) => ({ ...p, auto_k: v }))}
          />
        </div>

        {form.auto_k ? (
          <div className="grid grid-cols-2 gap-2">
            <Field id="k_min" label="k min" error={fieldErrors.k_min}>
              <Input
                id="k_min"
                type="number"
                step="1"
                min={2}
                max={20}
                value={form.k_min}
                onChange={(e) =>
                  setForm((p) => ({ ...p, k_min: e.target.value }))
                }
                aria-invalid={Boolean(fieldErrors.k_min)}
              />
            </Field>
            <Field id="k_max" label="k max" error={fieldErrors.k_max}>
              <Input
                id="k_max"
                type="number"
                step="1"
                min={2}
                max={20}
                value={form.k_max}
                onChange={(e) =>
                  setForm((p) => ({ ...p, k_max: e.target.value }))
                }
                aria-invalid={Boolean(fieldErrors.k_max)}
              />
            </Field>
          </div>
        ) : (
          <Field
            id="n_clusters"
            label="Number of clusters (k)"
            error={fieldErrors.n_clusters}
            hint="Fixed cut height; overrides gap selection."
          >
            <Input
              id="n_clusters"
              type="number"
              step="1"
              min={2}
              max={20}
              value={form.n_clusters}
              onChange={(e) =>
                setForm((p) => ({ ...p, n_clusters: e.target.value }))
              }
              aria-invalid={Boolean(fieldErrors.n_clusters)}
            />
          </Field>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="space-y-0.5">
            <Label htmlFor="denoise" className="text-sm font-medium">
              RMT denoise
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Marchenko-Pastur eigenvalue clipping before clustering.
            </p>
          </div>
          <Switch
            id="denoise"
            checked={form.denoise}
            onCheckedChange={(v) => setForm((p) => ({ ...p, denoise: v }))}
          />
        </div>

        <Field
          id="gap_B"
          label="Gap null draws (B)"
          error={fieldErrors.gap_B}
          hint={`Phase-randomized surrogates (capped at ${GAP_B_CAP}).`}
        >
          <Input
            id="gap_B"
            type="number"
            step="1"
            min={1}
            max={GAP_B_CAP}
            value={form.gap_B}
            onChange={(e) => setForm((p) => ({ ...p, gap_B: e.target.value }))}
            aria-invalid={Boolean(fieldErrors.gap_B)}
          />
        </Field>

        <div className="flex items-center justify-between gap-2">
          <div className="space-y-0.5">
            <Label
              htmlFor="run_diversification"
              className="text-sm font-medium"
            >
              Run diversification backtest
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Honest 1/N vs cluster-EW vs stripped-HRP horse race.
            </p>
          </div>
          <Switch
            id="run_diversification"
            checked={form.run_diversification}
            onCheckedChange={(v) =>
              setForm((p) => ({ ...p, run_diversification: v }))
            }
          />
        </div>

        {form.run_diversification ? (
          <div className="space-y-4 rounded-md border border-dashed bg-muted/30 p-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="cost_bps" className="text-sm font-medium">
                  Transaction cost
                </Label>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {fmtNum(costBpsValue, 0)} bps
                </span>
              </div>
              <Slider
                id="cost_bps"
                min={0}
                max={50}
                step={1}
                value={[Math.min(50, Math.max(0, costBpsValue))]}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, cost_bps: String(v[0]) }))
                }
                aria-label="Transaction cost in basis points"
              />
              {fieldErrors.cost_bps ? (
                <p role="alert" className="text-xs text-destructive">
                  {fieldErrors.cost_bps}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Per-rebalance turnover cost in basis points.
                </p>
              )}
            </div>

            <Field
              id="train_window"
              label="Train window (days)"
              error={fieldErrors.train_window}
              hint="Walk-forward in-sample length; clusters frozen then applied OOS."
            >
              <Input
                id="train_window"
                type="number"
                step="1"
                min={2}
                value={form.train_window}
                onChange={(e) =>
                  setForm((p) => ({ ...p, train_window: e.target.value }))
                }
                aria-invalid={Boolean(fieldErrors.train_window)}
              />
            </Field>

            <Field
              id="embargo_days"
              label="Purge / embargo (days)"
              error={fieldErrors.embargo_days}
              hint="No-lookahead gap between train and OOS windows."
            >
              <Input
                id="embargo_days"
                type="number"
                step="1"
                min={0}
                value={form.embargo_days}
                onChange={(e) =>
                  setForm((p) => ({ ...p, embargo_days: e.target.value }))
                }
                aria-invalid={Boolean(fieldErrors.embargo_days)}
              />
            </Field>
          </div>
        ) : null}

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
// Survivorship banner — surfaced prominently when the backend flags it.
// ---------------------------------------------------------------------------

function SurvivorshipBanner({ caveat }: { caveat?: string | null }) {
  return (
    <Alert
      variant="destructive"
      className="border-2 border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
    >
      <AlertTitle>Survivorship-biased universe</AlertTitle>
      <AlertDescription className="text-amber-900/90 dark:text-amber-200/90">
        <p>
          {caveat ??
            "This run used a survivor-only ticker list, so delisted names are silently absent. Cluster geometry is still informative, but any backtest will be optimistically biased — diversification claims over a survivor-only universe are rejected by the backend."}
        </p>
      </AlertDescription>
    </Alert>
  )
}

// ---------------------------------------------------------------------------
// Figure tabs — heatmap / dendrogram / MST / embedding.
// ---------------------------------------------------------------------------

function FigureTabs({ result }: { result: RunResponse }) {
  const tabs: { value: string; label: string; figure: PlotlyFigure }[] = [
    { value: "heatmap", label: "Correlation heatmap", figure: result.heatmap_figure },
    { value: "dendrogram", label: "Dendrogram", figure: result.dendrogram_figure },
    { value: "mst", label: "MST network", figure: result.mst_figure },
    { value: "embedding", label: "Embedding", figure: result.embedding_figure },
  ]
  return (
    <Card className="p-4 shadow-none">
      <Tabs defaultValue="heatmap" className="w-full">
        <TabsList className="flex-wrap">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-2">
            <PlotlyChart figure={t.figure} />
          </TabsContent>
        ))}
      </Tabs>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Cluster table — compact list of the frozen cluster map.
// ---------------------------------------------------------------------------

function ClusterTable({ clusters }: { clusters: RunResponse["clusters"] }) {
  if (clusters.length === 0) return null
  return (
    <Card className="gap-0 overflow-hidden p-0 shadow-none">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">
          Cluster map ({clusters.length})
        </h3>
        <p className="text-xs text-muted-foreground">
          Representative ticker is the cluster medoid; dominant GICS sector is
          post-hoc only and never enters the distance or k-selection.
        </p>
      </div>
      <div className="divide-y">
        {clusters.map((c) => (
          <div
            key={c.cluster_id}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 text-sm"
          >
            <Badge variant="secondary" className="font-mono">
              #{c.cluster_id}
            </Badge>
            <span className="font-mono text-xs font-semibold">
              {c.representative_ticker}
            </span>
            {c.gics_dominant ? (
              <span className="text-xs text-muted-foreground">
                {c.gics_dominant}
              </span>
            ) : null}
            <span className="ml-auto font-mono text-xs text-muted-foreground">
              {c.tickers.length} names
            </span>
            <span className="w-full font-mono text-[11px] text-muted-foreground">
              {c.tickers.join(", ")}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Verdict card — the honest 1/N null. Only rendered when diversification ran.
// ---------------------------------------------------------------------------

function VerdictCard({
  summary,
  div,
}: {
  summary: Summary
  div: Diversification
}) {
  const verdict = div.headline_verdict ?? "no_significant_difference"
  const view = verdictView(String(verdict))
  const notSignificant =
    (div.memmel_jk_pvalue !== null && div.memmel_jk_pvalue > 0.05) ||
    (div.deflated_sharpe !== null && div.deflated_sharpe <= 0)
  return (
    <Card
      className={`gap-2 border-2 p-5 shadow-none ${VERDICT_TONE_CLASS[view.tone]}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={VERDICT_BADGE_VARIANT[view.tone]}>{view.badge}</Badge>
        {notSignificant ? (
          <Badge variant="outline">Not statistically significant after costs</Badge>
        ) : null}
        <span className="font-mono text-[11px] text-muted-foreground">
          gap {fmtNum(div.sharpe_diff_vs_1overN)} - Memmel-JK p=
          {fmtNum(div.memmel_jk_pvalue, 3)} - DSR{" "}
          {fmtNum(div.deflated_sharpe, 3)} - {div.n_trials} trials
        </span>
      </div>
      <h2 className="text-lg font-semibold tracking-tight">{view.headline}</h2>
      <p className="text-sm text-muted-foreground">{view.body}</p>
      <p className="font-mono text-[11px] text-muted-foreground">
        ARI vs GICS {fmtNum(summary.ari_vs_gics)} - costs {fmtNum(div.cost_bps, 1)} bps
      </p>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Deferred note — diversification requested but deferred for a large universe.
// ---------------------------------------------------------------------------

function DeferredNote() {
  return (
    <Alert>
      <AlertTitle>Diversification backtest deferred</AlertTitle>
      <AlertDescription>
        <p>
          The cluster map was returned synchronously, but the 1/N vs cluster-EW
          vs stripped-HRP horse race was deferred because the requested universe
          and window exceed the cold-start budget. Re-run on a smaller custom
          universe or a shorter window to get the out-of-sample Sharpe
          comparison, Memmel-JK p-value, and deflated Sharpe inline.
        </p>
      </AlertDescription>
    </Alert>
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
    <div className="flex h-[120px] w-full items-center justify-center rounded-xl border border-dashed bg-card text-sm text-muted-foreground">
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

// ---------------------------------------------------------------------------
// Summary grid — ARI-vs-GICS surfaced prominently with the honest caption.
// ---------------------------------------------------------------------------

function SummaryGrid({ summary }: { summary: Summary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <MetricCard
        label="Clusters selected"
        value={fmtNum(summary.n_clusters_selected, 0)}
        hint={summary.selection_method}
      />
      <MetricCard
        label="Silhouette"
        value={fmtNum(summary.silhouette, 3)}
        hint="Cluster separation"
      />
      <MetricCard
        label="Gap-statistic k"
        value={fmtNum(summary.gap_k, 0)}
        hint="Tibshirani 1-SE vs phase null"
      />
      <MetricCard
        label="Modularity"
        value={fmtNum(summary.modularity, 3)}
        hint="MST network modularity"
      />
      <MetricCard
        label="ARI vs GICS"
        value={fmtNum(summary.ari_vs_gics, 3)}
        trend="neutral"
        hint="clusters largely re-discover sectors"
        className="border-teal-300 ring-1 ring-teal-300/50 dark:border-teal-900/60 dark:ring-teal-900/40"
      />
      <MetricCard
        label="Mean stability ARI"
        value={fmtNum(summary.stability_ari_mean, 3)}
        hint="Adjacent-window agreement"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Diversification grid — 1/N vs cluster-EW vs stripped-HRP Sharpe + inference.
// ---------------------------------------------------------------------------

function DiversificationGrid({ div }: { div: Diversification }) {
  const gap = div.sharpe_diff_vs_1overN
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <MetricCard
        label="1/N OOS Sharpe"
        value={fmtNum(div.one_over_n_sharpe, 3)}
        hint="Naive benchmark"
      />
      <MetricCard
        label="Cluster-EW Sharpe"
        value={fmtNum(div.cluster_ew_sharpe, 3)}
        hint="Equal-weight across clusters"
      />
      <MetricCard
        label="Stripped-HRP Sharpe"
        value={fmtNum(div.stripped_hrp_sharpe, 3)}
        hint="Inverse-var within / equal across"
      />
      <MetricCard
        label="Sharpe gap vs 1/N"
        value={fmtNum(gap, 3)}
        trend={gap === null ? "neutral" : gap > 0 ? "up" : "down"}
        hint="Out-of-sample, net of costs"
      />
      <MetricCard
        label="Memmel-JK p-value"
        value={fmtNum(div.memmel_jk_pvalue, 3)}
        hint="Sharpe-difference test"
      />
      <MetricCard
        label="Deflated Sharpe"
        value={fmtNum(div.deflated_sharpe, 3)}
        hint={`${div.n_trials} effective trials`}
      />
    </div>
  )
}

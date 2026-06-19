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
  DATA_SOURCE_PREF_LABELS,
  DATA_SOURCE_PREFS,
  type FieldErrors,
  type FormState,
  MAX_ESTIMATION_WINDOW,
  MAX_EVENT_WINDOW,
  MAX_PLACEBO,
  MAX_SEED,
  MIN_ESTIMATION_WINDOW,
  MIN_EVENT_WINDOW,
  MIN_PLACEBO,
  type Model,
  MODEL_LABELS,
  MODELS,
  type RunRequest,
  RunRequestSchema,
  type RunResponse,
  type Summary,
  type Surprise,
  SURPRISE_LABELS,
  SURPRISES,
} from "./types"

// ---------------------------------------------------------------------------
// The honest caption rendered alongside the verdict. This is the documented
// deliverable: FOMC moves are cross-sectional heterogeneity, not alpha.
// ---------------------------------------------------------------------------

const HONEST_CAPTION =
  "FOMC moves are cross-sectional heterogeneity (rate-sensitive names move more), not a placebo-robust tradable alpha"

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

  const eventWindow = Number.parseInt(form.event_window, 10)
  if (
    !Number.isInteger(eventWindow) ||
    eventWindow < MIN_EVENT_WINDOW ||
    eventWindow > MAX_EVENT_WINDOW
  ) {
    errors.event_window = `${MIN_EVENT_WINDOW} - ${MAX_EVENT_WINDOW} days.`
  }

  const estimationWindow = Number.parseInt(form.estimation_window, 10)
  if (
    !Number.isInteger(estimationWindow) ||
    estimationWindow < MIN_ESTIMATION_WINDOW ||
    estimationWindow > MAX_ESTIMATION_WINDOW
  ) {
    errors.estimation_window = `${MIN_ESTIMATION_WINDOW} - ${MAX_ESTIMATION_WINDOW} days.`
  }

  const nPlacebo = Number.parseInt(form.n_placebo, 10)
  if (
    !Number.isInteger(nPlacebo) ||
    nPlacebo < MIN_PLACEBO ||
    nPlacebo > MAX_PLACEBO
  ) {
    errors.n_placebo = `${MIN_PLACEBO} - ${MAX_PLACEBO} draws.`
  }

  const seed = Number.parseInt(form.seed, 10)
  if (!Number.isFinite(seed) || seed < 0 || seed > MAX_SEED) {
    errors.seed = `0 - ${MAX_SEED}.`
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  const value: RunRequest = {
    event_window: eventWindow,
    estimation_window: estimationWindow,
    model: form.model,
    surprise: form.surprise,
    n_placebo: nPlacebo,
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
  event_window: "1",
  estimation_window: "120",
  model: "market",
  surprise: "all",
  n_placebo: "500",
  data_source_pref: "synthetic",
  seed: "7",
}

export default function FedCausalTool() {
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
        "/tools/fed-causal/run",
        built.value,
      )
      setResult(data)
    } catch (err: unknown) {
      toast.error(detailMessage(err, "Fed-causal event study failed."))
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
            Causal Inference on Fed Announcements
          </h1>
          <p className="text-sm text-muted-foreground">
            An event study of cumulative abnormal returns around FOMC
            announcements with an estimation-window-only market model, then
            stressed with placebo-date randomization (the primary significance
            source), HAC/clustered standard errors, a multiple-testing
            correction, and a rate-sensitivity difference-in-differences. The
            verdict is computed purely on the backend.
          </p>
        </div>
        {result ? (
          <Badge variant="outline" className="font-mono text-[11px]">
            data: {result.data_source} - k {form.event_window} - est{" "}
            {form.estimation_window} - placebo {form.n_placebo}
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
            <EmptyState message="Configure the event study and press Run." />
          )}

          {running ? (
            <MetricsSkeleton />
          ) : result ? (
            <SummaryGrid summary={result.summary} />
          ) : null}

          {running ? (
            <Skeleton className="h-[640px] w-full" />
          ) : result ? (
            <PlotlyChart figure={result.car_figure} />
          ) : null}

          {result ? <PlotlyChart figure={result.placebo_figure} /> : null}
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
          id="event_window"
          label="Event window half-width k"
          error={fieldErrors.event_window}
          hint="CAR is accumulated over [-k, +k] trading days around the announcement date."
        >
          <Input
            id="event_window"
            type="number"
            step="1"
            min={MIN_EVENT_WINDOW}
            max={MAX_EVENT_WINDOW}
            value={form.event_window}
            onChange={(e) =>
              setForm((p) => ({ ...p, event_window: e.target.value }))
            }
            aria-invalid={Boolean(fieldErrors.event_window)}
          />
        </Field>

        <Field
          id="estimation_window"
          label="Estimation window (days)"
          error={fieldErrors.estimation_window}
          hint="Pre-event window the market model is fit on. Never overlaps the event window — no leakage."
        >
          <Input
            id="estimation_window"
            type="number"
            step="1"
            min={MIN_ESTIMATION_WINDOW}
            max={MAX_ESTIMATION_WINDOW}
            value={form.estimation_window}
            onChange={(e) =>
              setForm((p) => ({ ...p, estimation_window: e.target.value }))
            }
            aria-invalid={Boolean(fieldErrors.estimation_window)}
          />
        </Field>

        <Field
          id="model"
          label="Expected-return model"
          hint="Abnormal return = actual − expected, with the expected return fit on the estimation window only."
        >
          <Select
            value={form.model}
            onValueChange={(v) =>
              setForm((p) => ({ ...p, model: v as Model }))
            }
          >
            <SelectTrigger id="model" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((m) => (
                <SelectItem key={m} value={m}>
                  {MODEL_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          id="surprise"
          label="Surprise subset"
          hint="Narrows the CAR / placebo battery. The DiD always contrasts hawkish vs. dovish."
        >
          <Select
            value={form.surprise}
            onValueChange={(v) =>
              setForm((p) => ({ ...p, surprise: v as Surprise }))
            }
          >
            <SelectTrigger id="surprise" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SURPRISES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SURPRISE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          id="n_placebo"
          label="Placebo draws"
          error={fieldErrors.n_placebo}
          hint="Random non-event dates used to build the null distribution — the primary significance source."
        >
          <Input
            id="n_placebo"
            type="number"
            step="1"
            min={MIN_PLACEBO}
            max={MAX_PLACEBO}
            value={form.n_placebo}
            onChange={(e) =>
              setForm((p) => ({ ...p, n_placebo: e.target.value }))
            }
            aria-invalid={Boolean(fieldErrors.n_placebo)}
          />
        </Field>

        <Field
          id="data_source_pref"
          label="Data source"
          hint="The default scores a seeded synthetic event panel; real data is fetched lazily and degrades to synthetic on failure."
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
                  {DATA_SOURCE_PREF_LABELS[m]}
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
            max={MAX_SEED}
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
// `fed_effect_is_tradable` is a PURE function of the backend inference; we ONLY
// render it. On the seeded synthetic event panel it is FALSE by construction,
// which is exactly the documented deliverable. The badge is destructive when
// the effect is not tradable.
// ---------------------------------------------------------------------------

function VerdictCard({ summary }: { summary: Summary }) {
  const tradable = summary.fed_effect_is_tradable
  const toneClass = tradable
    ? "border-teal-300 bg-teal-50 dark:border-teal-900/60 dark:bg-teal-950/30"
    : "border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30"

  return (
    <Card className={`gap-2 border-2 p-5 shadow-none ${toneClass}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={tradable ? "default" : "destructive"}
          className="text-sm"
        >
          Tradable Fed effect: {tradable ? "YES" : "NO"}
        </Badge>
        <Badge variant="outline" className="font-mono text-[11px]">
          data: {summary.data_source}
        </Badge>
        <span className="font-mono text-[11px] text-muted-foreground">
          placebo pctile {fmtNum(summary.placebo_pctile, 1)} - HAC p=
          {fmtNum(summary.car_hac_pvalue, 3)} - {summary.n_tests} tests -{" "}
          {summary.n_events} events
        </span>
      </div>
      <h2 className="text-lg font-semibold tracking-tight">
        {tradable
          ? "The FOMC effect survives the full robustness battery"
          : "The FOMC effect is NOT a placebo-robust tradable alpha"}
      </h2>
      <p className="text-sm text-muted-foreground">{HONEST_CAPTION}.</p>
      <p className="text-sm text-muted-foreground">
        {summary.verdict_rationale
          ? summary.verdict_rationale
          : tradable
            ? "The cumulative abnormal return clears every gate: it is placebo-significant, HAC-robust, survives the multiple-testing correction, and the rate-sensitivity difference-in-differences yields a net-of-cost tradable spread."
            : "After placebo-date randomization, HAC/clustered standard errors and a multiple-testing correction, the transient average move is statistically fragile. The difference-in-differences is descriptive cross-sectional heterogeneity, not a net-of-cost tradable spread — the correct, literature-backed null."}
      </p>
      <p className="text-xs font-medium text-muted-foreground">
        Descriptive causal-inference stack, not a profit claim. The verdict is
        computed purely on the backend and only rendered here.
      </p>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Summary grid — mean CAR, CAR t-stat, HAC p-value, placebo percentile,
// DiD coefficient.
// ---------------------------------------------------------------------------

function SummaryGrid({ summary }: { summary: Summary }) {
  // The placebo null is the PRIMARY significance source, so an extreme
  // percentile leans "up"; a raw t-stat alone is never sufficient.
  const placeboTrend =
    summary.placebo_pctile === null
      ? "neutral"
      : summary.placebo_pctile >= 95 || summary.placebo_pctile <= 5
        ? "up"
        : "down"

  const hacTrend =
    summary.car_hac_pvalue === null
      ? "neutral"
      : summary.car_hac_pvalue < 0.05
        ? "up"
        : "down"

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <MetricCard
        label="Mean CAR"
        value={fmtNum(summary.car_mean, 5)}
        hint="Average cumulative abnormal return over the event window"
      />
      <MetricCard
        label="CAR t-stat"
        value={fmtNum(summary.car_tstat, 3)}
        hint="Cross-sectional t — not sufficient alone for the verdict"
      />
      <MetricCard
        label="HAC p-value"
        value={fmtNum(summary.car_hac_pvalue, 3)}
        trend={hacTrend}
        hint="Newey-West HAC / clustered standard errors"
      />
      <MetricCard
        label="Placebo pctile"
        value={fmtNum(summary.placebo_pctile, 1)}
        trend={placeboTrend}
        hint={`Observed CAR vs ${summary.n_tests} placebo nulls — primary significance`}
      />
      <MetricCard
        label="DiD coefficient"
        value={fmtNum(summary.did_coef, 5)}
        hint="Rate-sensitive treated vs control — descriptive heterogeneity"
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
    <div className="flex h-[200px] w-full items-center justify-center rounded-xl border border-dashed bg-card text-sm text-muted-foreground">
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

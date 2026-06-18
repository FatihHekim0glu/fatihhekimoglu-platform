"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { cn } from "@/lib/utils"

import {
  EXAMPLE_HEADLINES,
  type FieldErrors,
  type FormState,
  MAX_TEXTS,
  MIN_TEXTS,
  MODEL_CHOICES,
  type Prediction,
  parseSentences,
  type RunRequest,
  RunRequestSchema,
  type RunResponse,
  type SentimentLabel,
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

  const texts = parseSentences(form.text)
  if (texts.length < MIN_TEXTS) {
    errors.text = "Enter at least one sentence (one per line)."
  } else if (texts.length > MAX_TEXTS) {
    errors.text = `Too many sentences — ${MAX_TEXTS} max (you entered ${texts.length}).`
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  const value: RunRequest = { texts, model: form.model }
  RunRequestSchema.parse(value)
  return { ok: true, value }
}

// ---------------------------------------------------------------------------
// Label presentation — color-coded, mirroring the score-cell tone.
// ---------------------------------------------------------------------------

const LABEL_BADGE_CLASS: Record<SentimentLabel, string> = {
  negative:
    "border-red-300 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
  neutral:
    "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
  positive:
    "border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-900/60 dark:bg-teal-950/40 dark:text-teal-300",
}

function labelBadgeClass(label: string): string {
  if (label in LABEL_BADGE_CLASS) {
    return LABEL_BADGE_CLASS[label as SentimentLabel]
  }
  return "border-border bg-muted text-muted-foreground"
}

/** Shade a probability cell from faint to saturated within a hue family. */
function scoreCellClass(value: number, tone: "neg" | "neu" | "pos"): string {
  const base =
    tone === "neg"
      ? "text-red-700 dark:text-red-300"
      : tone === "neu"
        ? "text-amber-700 dark:text-amber-300"
        : "text-teal-700 dark:text-teal-300"
  // Emphasise the dominant class without depending on a Tailwind opacity scale
  // that the JIT compiler might prune.
  return cn(base, value >= 0.5 ? "font-semibold" : "opacity-70")
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const INITIAL_FORM: FormState = {
  text: "",
  model: "distilbert",
}

export default function FinbertSentimentTool() {
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
        "/tools/finbert-sentiment/run",
        built.value,
      )
      setResult(data)
    } catch (err: unknown) {
      toast.error(detailMessage(err, "Sentiment classification failed."))
    } finally {
      setRunning(false)
    }
  }, [form])

  const onLoadExamples = useCallback(() => {
    setForm((p) => ({ ...p, text: EXAMPLE_HEADLINES }))
    setFieldErrors({})
  }, [])

  const sentenceCount = parseSentences(form.text).length

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <Toaster position="top-right" />
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            FinBERT Sentiment Classifier
          </h1>
          <p className="text-sm text-muted-foreground">
            3-way financial-sentence sentiment (negative / neutral / positive) —
            a from-scratch DistilBERT fine-tune (ONNX-served) benchmarked
            honestly against class-prior and lexicon baselines on the Financial
            PhraseBank, with macro-F1 and bootstrap CIs.
          </p>
        </div>
        {result ? (
          <Badge variant="outline" className="font-mono text-[11px]">
            served: {result.summary.served_model} -{" "}
            {result.summary.n_texts} texts - {result.summary.data_source}
          </Badge>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <SidebarForm
            form={form}
            setForm={setForm}
            fieldErrors={fieldErrors}
            sentenceCount={sentenceCount}
            onRun={onRun}
            onLoadExamples={onLoadExamples}
            running={running}
          />
        </aside>

        <section className="space-y-4">
          {running ? (
            <MetricsSkeleton />
          ) : result ? (
            <MetricsGrid summary={result.summary} />
          ) : (
            <EmptyState message="Enter financial sentences (one per line) and press Classify — or load the example headlines." />
          )}

          {running ? (
            <Skeleton className="h-[320px] w-full rounded-xl" />
          ) : result ? (
            <PredictionsTable predictions={result.predictions} />
          ) : null}

          {result ? (
            <p className="rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
              Sentiment is a text label, not a tradable signal — no alpha is
              claimed.
            </p>
          ) : null}

          {result ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <PlotlyChart figure={result.confusion_figure} />
              <PlotlyChart figure={result.per_class_f1_figure} />
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
  sentenceCount: number
  onRun: () => void
  onLoadExamples: () => void
  running: boolean
}

function SidebarForm({
  form,
  setForm,
  fieldErrors,
  sentenceCount,
  onRun,
  onLoadExamples,
  running,
}: SidebarFormProps) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Inputs
      </h2>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="texts" className="text-sm font-medium">
              Sentences
            </Label>
            <span className="font-mono text-[11px] text-muted-foreground">
              {sentenceCount}/{MAX_TEXTS}
            </span>
          </div>
          <textarea
            id="texts"
            value={form.text}
            onChange={(e) => setForm((p) => ({ ...p, text: e.target.value }))}
            rows={10}
            spellCheck={false}
            placeholder={"One financial sentence per line, e.g.\nProfits rose sharply on strong demand.\nThe firm cut its full-year guidance."}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            aria-invalid={Boolean(fieldErrors.text)}
          />
          {fieldErrors.text ? (
            <p role="alert" className="text-xs text-destructive">
              {fieldErrors.text}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {MIN_TEXTS}-{MAX_TEXTS} sentences, one per line.
            </p>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={onLoadExamples}
          disabled={running}
          className="w-full"
        >
          Load example headlines
        </Button>

        <div className="space-y-1.5">
          <Label htmlFor="model" className="text-sm font-medium">
            Model
          </Label>
          <Select
            value={form.model}
            onValueChange={(v) =>
              setForm((p) => ({ ...p, model: v as FormState["model"] }))
            }
          >
            <SelectTrigger id="model" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODEL_CHOICES.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            DistilBERT falls back to the lexicon when no ONNX artifact is served.
          </p>
        </div>

        <Button
          type="button"
          onClick={onRun}
          disabled={running}
          className="w-full"
          aria-live="polite"
        >
          {running ? "Classifying..." : "Classify"}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Predictions table — label + neg/neu/pos scores, color-coded.
// ---------------------------------------------------------------------------

function PredictionsTable({ predictions }: { predictions: Prediction[] }) {
  if (predictions.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
        No predictions were returned.
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Per-sentence predictions</h3>
        <span className="font-mono text-[11px] text-muted-foreground">
          {predictions.length} sentences
        </span>
      </div>
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Sentence</th>
              <th className="px-3 py-2 text-left">Label</th>
              <th className="px-3 py-2 text-right">neg</th>
              <th className="px-3 py-2 text-right">neu</th>
              <th className="px-3 py-2 text-right">pos</th>
            </tr>
          </thead>
          <tbody>
            {predictions.map((row, i) => (
              <tr
                key={i}
                className="border-b align-top text-xs last:border-b-0"
              >
                <td className="max-w-[420px] px-3 py-2 text-left">
                  <span className="line-clamp-3">{row.text}</span>
                </td>
                <td className="px-3 py-2 text-left">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-md border px-2 py-0.5 font-medium capitalize",
                      labelBadgeClass(row.label),
                    )}
                  >
                    {row.label}
                  </span>
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right font-mono tabular-nums",
                    scoreCellClass(row.scores.neg, "neg"),
                  )}
                >
                  {fmtNum(row.scores.neg, 3)}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right font-mono tabular-nums",
                    scoreCellClass(row.scores.neu, "neu"),
                  )}
                >
                  {fmtNum(row.scores.neu, 3)}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right font-mono tabular-nums",
                    scoreCellClass(row.scores.pos, "pos"),
                  )}
                >
                  {fmtNum(row.scores.pos, 3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Summary grid — MetricCards: served model macro-F1, lexicon, class-prior.
// ---------------------------------------------------------------------------

function MetricsGrid({ summary }: { summary: RunResponse["summary"] }) {
  const beats = summary.beats_lexicon
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricCard
        label="Served Model"
        value={summary.served_model}
        hint={
          summary.served_model === "lexicon"
            ? "torch-free fallback"
            : "ONNX (int8)"
        }
      />
      <MetricCard
        label="Macro-F1 (served)"
        value={fmtNum(summary.eval_macro_f1, 3)}
        trend={
          summary.eval_macro_f1 !== null &&
          summary.lexicon_macro_f1 !== null &&
          summary.eval_macro_f1 > summary.lexicon_macro_f1
            ? "up"
            : "neutral"
        }
        hint={
          summary.eval_macro_f1 === null
            ? "published, not measured here"
            : "offline test set"
        }
      />
      <MetricCard
        label="Lexicon Macro-F1"
        value={fmtNum(summary.lexicon_macro_f1, 3)}
        hint="Loughran-McDonald-style floor"
      />
      <MetricCard
        label="Class-Prior Macro-F1"
        value={fmtNum(summary.class_prior_macro_f1, 3)}
        hint={
          beats === null
            ? "majority baseline"
            : beats
              ? "served beats lexicon (McNemar)"
              : "no sig. gain vs lexicon"
        }
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Presentational helpers
// ---------------------------------------------------------------------------

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[88px] w-full items-center justify-center rounded-xl border border-dashed bg-card px-6 py-4 text-center text-sm text-muted-foreground">
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

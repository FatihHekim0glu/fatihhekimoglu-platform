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
  type Citation,
  DATA_SOURCE_PREFS,
  DEFAULT_TICKER,
  DEFAULT_TOP_K,
  type FieldErrors,
  type FormState,
  MAX_QUESTION_LEN,
  type Mode,
  MODE_LABELS,
  MODES,
  type RunRequest,
  RunRequestSchema,
  type RunResponse,
  TICKER_RE,
  TOP_K_MAX,
  TOP_K_MIN,
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

  const question = form.question.trim()
  const ticker = form.ticker.trim().toUpperCase()

  if (!question) {
    errors.question = "Ask a question about the filing."
  } else if (question.length > MAX_QUESTION_LEN) {
    errors.question = `Keep the question under ${MAX_QUESTION_LEN} characters.`
  }

  if (!ticker) {
    errors.ticker = "Provide a ticker."
  } else if (!TICKER_RE.test(ticker)) {
    errors.ticker = "Letters, digits, '.', '-' only (start with a letter)."
  }

  let topK = DEFAULT_TOP_K
  const topKTrimmed = form.top_k.trim()
  if (!topKTrimmed) {
    errors.top_k = `Choose how many chunks to retrieve (${TOP_K_MIN}-${TOP_K_MAX}).`
  } else {
    const parsed = Number.parseInt(topKTrimmed, 10)
    if (
      !Number.isInteger(parsed) ||
      String(parsed) !== topKTrimmed ||
      parsed < TOP_K_MIN ||
      parsed > TOP_K_MAX
    ) {
      errors.top_k = `Retrieve ${TOP_K_MIN}-${TOP_K_MAX} chunks.`
    } else {
      topK = parsed
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  const value: RunRequest = {
    question,
    ticker,
    top_k: topK,
    mode: form.mode,
    data_source_pref: form.data_source_pref,
  }
  RunRequestSchema.parse(value)
  return { ok: true, value }
}

// ---------------------------------------------------------------------------
// Presentation labels
// ---------------------------------------------------------------------------

const DATA_SOURCE_LABEL: Record<RunResponse["data_source"], string> = {
  cache: "cached corpus",
  edgar: "live EDGAR",
}

const MODE_USED_LABEL: Record<RunResponse["summary"]["mode_used"], string> = {
  extractive: "extractive",
  generative: "generative",
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const INITIAL_FORM: FormState = {
  question: "What are the company's primary risk factors?",
  ticker: DEFAULT_TICKER,
  top_k: String(DEFAULT_TOP_K),
  // Default to the key-free extractive answer so casual visitors never spend LLM
  // credits; selecting "generative" is a deliberate opt-in to the LLM path.
  mode: "extractive",
  data_source_pref: "cache",
}

export default function Rag10kTool() {
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
      const data = await apiPost<RunResponse>("/tools/rag-10k/run", built.value)
      setResult(data)
    } catch (err: unknown) {
      toast.error(detailMessage(err, "Grounded-RAG query failed."))
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
            LLM Agent Reading 10-Ks (RAG)
          </h1>
          <p className="text-sm text-muted-foreground">
            Ask a question about a company&apos;s 10-K and get a grounded, cited
            answer — retrieval over an ONNX-embedded index of the filing, an
            answer that must cite its sources and abstains when the document
            doesn&apos;t contain the answer, plus a frozen 150-question eval
            harness measuring retrieval recall, citation-soundness and
            abstention.
          </p>
        </div>
        {result ? (
          <Badge variant="outline" className="font-mono text-[11px]">
            data: {DATA_SOURCE_LABEL[result.data_source]} -{" "}
            {result.summary.n_citations} citations
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
            <Skeleton className="h-[220px] w-full rounded-xl" />
          ) : result ? (
            <AnswerCard summary={result.summary} />
          ) : (
            <EmptyState message="Ask a question and press Ask the filing." />
          )}

          {running ? (
            <MetricsSkeleton />
          ) : result ? (
            <EvalGrid evalSummary={result.eval_summary} />
          ) : null}

          {running ? (
            <Skeleton className="h-[280px] w-full rounded-xl" />
          ) : result ? (
            <CitationsList citations={result.citations} />
          ) : null}

          {running ? (
            <Skeleton className="h-[360px] w-full" />
          ) : result && hasFigure(result) ? (
            <Card className="p-2 shadow-none">
              <PlotlyChart figure={result.retrieval_figure} />
            </Card>
          ) : null}

          {result ? <HonestCaption /> : null}
        </section>
      </div>
    </main>
  )
}

function hasFigure(result: RunResponse): boolean {
  const fig = result.retrieval_figure
  return Boolean(fig && Array.isArray(fig.data) && fig.data.length > 0)
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
        Question
      </h2>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="question" className="text-sm font-medium">
              Question
            </Label>
            <span className="font-mono text-[11px] text-muted-foreground">
              {form.question.trim().length}/{MAX_QUESTION_LEN}
            </span>
          </div>
          <textarea
            id="question"
            value={form.question}
            onChange={(e) =>
              setForm((p) => ({ ...p, question: e.target.value }))
            }
            rows={5}
            spellCheck
            placeholder="e.g. What are the company's primary risk factors?"
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            aria-invalid={Boolean(fieldErrors.question)}
          />
          {fieldErrors.question ? (
            <p role="alert" className="text-xs text-destructive">
              {fieldErrors.question}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              One question about the selected filing.
            </p>
          )}
        </div>

        <Field
          id="ticker"
          label="Ticker"
          error={fieldErrors.ticker}
          hint="Selects which committed filing's index to answer over, e.g. AAPL."
        >
          <Input
            id="ticker"
            value={form.ticker}
            onChange={(e) => setForm((p) => ({ ...p, ticker: e.target.value }))}
            onBlur={(e) =>
              setForm((p) => ({ ...p, ticker: e.target.value.toUpperCase() }))
            }
            spellCheck={false}
            placeholder="AAPL"
            className="font-mono uppercase"
            aria-invalid={Boolean(fieldErrors.ticker)}
          />
        </Field>

        <Field
          id="top_k"
          label="Chunks to retrieve (top-k)"
          error={fieldErrors.top_k}
          hint={`${TOP_K_MIN}-${TOP_K_MAX}; capped server-side.`}
        >
          <Input
            id="top_k"
            inputMode="numeric"
            value={form.top_k}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                top_k: e.target.value.replace(/[^\d]/g, ""),
              }))
            }
            spellCheck={false}
            placeholder={String(DEFAULT_TOP_K)}
            className="font-mono"
            aria-invalid={Boolean(fieldErrors.top_k)}
          />
        </Field>

        <Field
          id="mode"
          label="Answer mode"
          hint="auto = generative if an LLM key is set, else key-free extractive."
        >
          <Select
            value={form.mode}
            onValueChange={(v) =>
              setForm((p) => ({ ...p, mode: v as Mode }))
            }
          >
            <SelectTrigger id="mode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODES.map((m) => (
                <SelectItem key={m} value={m}>
                  {MODE_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          id="data_source_pref"
          label="Data source"
          hint="cache answers the committed corpus; edgar tries a live fetch then falls back."
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

        <Button
          type="button"
          onClick={onRun}
          disabled={running}
          className="w-full"
          aria-live="polite"
        >
          {running ? "Asking..." : "Ask the filing"}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Answer card — the FIRST thing surfaced. The grounded/abstained verdict +
// answer are rendered PURELY from the backend response. When the system
// abstains it shows the explicit "not found in the filing" state.
// ---------------------------------------------------------------------------

function AnswerCard({ summary }: { summary: RunResponse["summary"] }) {
  const abstained = summary.abstained
  const grounded = summary.answer_is_grounded

  const toneClass = abstained
    ? "border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30"
    : grounded
      ? "border-teal-300 bg-teal-50 dark:border-teal-900/60 dark:bg-teal-950/30"
      : "border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30"

  return (
    <Card className={`gap-2 border-2 p-5 shadow-none ${toneClass}`}>
      <div className="flex flex-wrap items-center gap-2">
        {abstained ? (
          <Badge variant="secondary">Abstained</Badge>
        ) : grounded ? (
          <Badge variant="default">Grounded ✓</Badge>
        ) : (
          <Badge variant="secondary">Abstained</Badge>
        )}
        <Badge variant="outline" className="font-mono text-[11px]">
          mode: {MODE_USED_LABEL[summary.mode_used]}
        </Badge>
        <Badge
          variant={summary.llm_key_present ? "outline" : "secondary"}
          className="font-mono text-[11px]"
        >
          {summary.llm_key_present
            ? "LLM key present"
            : "Extractive (set an LLM key to enable generation)"}
        </Badge>
        <Badge variant="outline" className="font-mono text-[11px]">
          source: {DATA_SOURCE_LABEL[summary.data_source]}
        </Badge>
        <span className="font-mono text-[11px] text-muted-foreground">
          top score {fmtNum(summary.retrieval_top_score, 3)} -{" "}
          {summary.n_citations} citations
        </span>
      </div>

      {abstained ? (
        <>
          <h2 className="text-lg font-semibold tracking-tight">
            Abstained — not found in the filing
          </h2>
          <p className="text-sm text-muted-foreground">
            No retrieved chunk cleared the similarity threshold, so the system
            declines to answer rather than fabricate. This is the intended
            behaviour on out-of-document questions.
          </p>
        </>
      ) : (
        <>
          <h2 className="text-lg font-semibold tracking-tight">
            {grounded ? "Grounded, cited answer" : "Answer"}
          </h2>
          <p className="text-sm whitespace-pre-wrap text-foreground">
            {summary.answer}
          </p>
        </>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Citations — every cited chunk EXISTS and is retrievable (no hallucinated
// citations). Each row links its item + char-span + score + snippet.
// ---------------------------------------------------------------------------

function formatSpan(span: Citation["char_span"]): string {
  if (Array.isArray(span) && span.length >= 2) {
    return `${span[0]}–${span[1]}`
  }
  return "—"
}

function CitationsList({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) {
    return (
      <Card className="gap-1 p-4 shadow-none">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Citations
        </h3>
        <p className="text-sm text-muted-foreground">
          No citations — the system abstained or no chunk cleared the threshold.
        </p>
      </Card>
    )
  }

  return (
    <Card className="gap-3 p-4 shadow-none">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Citations
        </h3>
        <span className="font-mono text-[11px] text-muted-foreground">
          {citations.length} chunk{citations.length === 1 ? "" : "s"}
        </span>
      </div>
      <ol className="space-y-3">
        {citations.map((c, i) => (
          <li
            key={c.chunk_id || i}
            className="rounded-lg border bg-background/60 p-3"
          >
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-[11px]">
                {c.chunk_id || `chunk ${i + 1}`}
              </Badge>
              {c.item ? (
                <Badge variant="secondary" className="text-[11px]">
                  {c.item}
                </Badge>
              ) : null}
              <span className="font-mono text-[11px] text-muted-foreground">
                chars {formatSpan(c.char_span)}
              </span>
              <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                score {fmtNum(c.score, 3)}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-foreground">
              {c.text_snippet}
            </p>
          </li>
        ))}
      </ol>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Eval summary — the FROZEN 150-question harness metrics. Information-retrieval
// metrics only: no accuracy or alpha claim.
// ---------------------------------------------------------------------------

function EvalGrid({
  evalSummary,
}: {
  evalSummary: RunResponse["eval_summary"]
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Frozen eval harness
        </h3>
        <span className="font-mono text-[11px] text-muted-foreground">
          {evalSummary.n_questions} questions
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MetricCard
          label="Recall@k"
          value={fmtPct(evalSummary.recall_at_k)}
          hint="gold supporting chunk in top-k"
        />
        <MetricCard
          label="Citation soundness"
          value={fmtPct(evalSummary.citation_soundness)}
          hint="claims entailed by cited chunk"
        />
        <MetricCard
          label="Abstention rate"
          value={fmtPct(evalSummary.abstention_rate)}
          hint="abstains on out-of-document Qs"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Honest caption — the headline honesty contract.
// ---------------------------------------------------------------------------

function HonestCaption() {
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      Answers are grounded in retrieved 10-K chunks with citations; the system
      abstains when the filing doesn&apos;t answer the question — measured
      citation-soundness is reported, not assumed. This is an
      information-retrieval tool: no accuracy or alpha claim is made.
    </p>
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
    <div className="flex h-[220px] w-full items-center justify-center rounded-xl border border-dashed bg-card text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-[78px] w-full rounded-xl" />
      ))}
    </div>
  )
}

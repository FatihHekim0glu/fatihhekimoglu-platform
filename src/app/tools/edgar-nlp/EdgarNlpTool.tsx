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
  CIK_RE,
  DATA_SOURCE_PREFS,
  DEFAULT_TICKER,
  type FieldErrors,
  type FormState,
  type RunRequest,
  RunRequestSchema,
  type RunResponse,
  type Section,
  SECTION_LABELS,
  SECTIONS,
  TICKER_RE,
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

function selectedSections(sections: FormState["sections"]): Section[] {
  return SECTIONS.filter((s) => sections[s])
}

function buildRequest(
  form: FormState,
): { ok: true; value: RunRequest } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {}

  const ticker = form.ticker.trim().toUpperCase()
  const cik = form.cik.trim()

  if (!ticker && !cik) {
    errors.ticker = "Provide a ticker or a CIK."
  } else if (ticker && !TICKER_RE.test(ticker)) {
    errors.ticker = "Letters, digits, '.', '-' only (start with a letter)."
  }

  if (cik && !CIK_RE.test(cik)) {
    errors.cik = "CIK must be 1-10 digits."
  }

  let year: number | null = null
  const yearTrimmed = form.year.trim()
  if (yearTrimmed) {
    const parsed = Number.parseInt(yearTrimmed, 10)
    if (
      !Number.isInteger(parsed) ||
      String(parsed) !== yearTrimmed ||
      parsed < 1994 ||
      parsed > 2100
    ) {
      errors.year = "Fiscal year 1994 - 2100, or leave blank for latest."
    } else {
      year = parsed
    }
  }

  const sections = selectedSections(form.sections)
  if (sections.length === 0) {
    errors.sections = "Select at least one section."
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  const value: RunRequest = {
    sections,
    data_source_pref: form.data_source_pref,
    year,
    // Prefer an explicit CIK; otherwise send the (possibly defaulted) ticker.
    ...(cik ? { cik } : { ticker: ticker || DEFAULT_TICKER }),
  }
  RunRequestSchema.parse(value)
  return { ok: true, value }
}

// ---------------------------------------------------------------------------
// Verdict presentation — the honest headline. The backend's verdict is a pure
// function of (panel_tone_spread_sharpe, panel_deflated_sharpe,
// panel_hac_pvalue); we only render it. The expected outcome is FALSE.
// ---------------------------------------------------------------------------

const DATA_SOURCE_LABEL: Record<RunResponse["data_source"], string> = {
  edgar: "live EDGAR",
  cache: "cached filing",
  synthetic: "synthetic fixture",
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const INITIAL_FORM: FormState = {
  ticker: DEFAULT_TICKER,
  cik: "",
  year: "",
  sections: { risk_factors: true, mda: true },
  data_source_pref: "auto",
}

export default function EdgarNlpTool() {
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
        "/tools/edgar-nlp/run",
        built.value,
      )
      setResult(data)
    } catch (err: unknown) {
      toast.error(detailMessage(err, "Filing scoring failed."))
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
            10-K Filing NLP
          </h1>
          <p className="text-sm text-muted-foreground">
            Pull a company&apos;s 10-K from SEC EDGAR, extract the Risk-Factors
            and MD&amp;A sections, and score Loughran-McDonald tone +
            hand-rolled readability (Fog / Flesch-Kincaid / SMOG) — then honestly
            test whether tone predicts forward returns on a point-in-time
            S&amp;P 500 panel.
          </p>
        </div>
        {result ? (
          <Badge variant="outline" className="font-mono text-[11px]">
            data: {DATA_SOURCE_LABEL[result.data_source]} -{" "}
            {fmtNum(result.summary.word_count, 0)} words -{" "}
            {fmtNum(result.summary.n_sentences, 0)} sentences
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
            <Skeleton className="h-[168px] w-full rounded-xl" />
          ) : result ? (
            <VerdictCard summary={result.summary} />
          ) : (
            <EmptyState message="Pick a filing and press Score." />
          )}

          {running ? (
            <MetricsSkeleton />
          ) : result ? (
            <MetricsGrid summary={result.summary} />
          ) : null}

          {running ? (
            <Skeleton className="h-[640px] w-full" />
          ) : result ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <PlotlyChart figure={result.tone_by_section_figure} />
              <PlotlyChart figure={result.readability_figure} />
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
        Filing
      </h2>

      <div className="space-y-4">
        <Field
          id="ticker"
          label="Ticker"
          error={fieldErrors.ticker}
          hint="A single symbol, e.g. AAPL. Ignored when a CIK is given."
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
          id="cik"
          label="CIK (optional)"
          error={fieldErrors.cik}
          hint="SEC Central Index Key. Overrides the ticker when set."
        >
          <Input
            id="cik"
            inputMode="numeric"
            value={form.cik}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                cik: e.target.value.replace(/[^\d]/g, ""),
              }))
            }
            spellCheck={false}
            placeholder="0000320193"
            className="font-mono"
            aria-invalid={Boolean(fieldErrors.cik)}
          />
        </Field>

        <Field
          id="year"
          label="Fiscal year (optional)"
          error={fieldErrors.year}
          hint="Leave blank for the latest available / cached filing."
        >
          <Input
            id="year"
            inputMode="numeric"
            value={form.year}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                year: e.target.value.replace(/[^\d]/g, ""),
              }))
            }
            spellCheck={false}
            placeholder="latest"
            className="font-mono"
            aria-invalid={Boolean(fieldErrors.year)}
          />
        </Field>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Sections</legend>
          {SECTIONS.map((s) => (
            <div key={s} className="flex items-center justify-between gap-2">
              <Label htmlFor={`section-${s}`} className="text-sm font-normal">
                {SECTION_LABELS[s]}
              </Label>
              <Switch
                id={`section-${s}`}
                checked={form.sections[s]}
                onCheckedChange={(v) =>
                  setForm((p) => ({
                    ...p,
                    sections: { ...p.sections, [s]: v },
                  }))
                }
              />
            </div>
          ))}
          {fieldErrors.sections ? (
            <p role="alert" className="text-xs text-destructive">
              {fieldErrors.sections}
            </p>
          ) : null}
        </fieldset>

        <Field
          id="data_source_pref"
          label="Data source"
          hint="auto fetches EDGAR, then degrades to cache / synthetic."
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
          {running ? "Scoring..." : "Score filing"}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Verdict card — the FIRST thing surfaced. The honest headline: tone is a
// descriptive scorer, NOT alpha. Destructive when tone_spread_has_edge=false.
// ---------------------------------------------------------------------------

function VerdictCard({ summary }: { summary: RunResponse["summary"] }) {
  const hasEdge = summary.tone_spread_has_edge
  const toneClass = hasEdge
    ? "border-teal-300 bg-teal-50 dark:border-teal-900/60 dark:bg-teal-950/30"
    : "border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30"

  return (
    <Card className={`gap-2 border-2 p-5 shadow-none ${toneClass}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={hasEdge ? "default" : "destructive"}>
          Tone predicts returns: {hasEdge ? "YES" : "NO"}
        </Badge>
        <Badge variant="outline" className="font-mono text-[11px]">
          source: {DATA_SOURCE_LABEL[summary.data_source]}
        </Badge>
        <span className="font-mono text-[11px] text-muted-foreground">
          spread Sharpe {fmtNum(summary.panel_tone_spread_sharpe, 3)} - DSR{" "}
          {fmtNum(summary.panel_deflated_sharpe, 3)} - HAC p=
          {fmtNum(summary.panel_hac_pvalue, 3)}
        </span>
      </div>
      <h2 className="text-lg font-semibold tracking-tight">
        {hasEdge
          ? "The tone-spread clears its statistical bar"
          : "Tone does NOT predict forward returns"}
      </h2>
      <p className="text-sm text-muted-foreground">
        Negative tone tilts intuitively but the PIT tone-spread is statistically
        zero after Deflated Sharpe — a descriptive scorer, not alpha.
      </p>
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
    <div className="flex h-[168px] w-full items-center justify-center rounded-xl border border-dashed bg-card text-sm text-muted-foreground">
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
  const tone = summary.tone
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <MetricCard
        label="LM Tone"
        value={fmtNum(tone, 4)}
        trend={tone === null ? "neutral" : tone < 0 ? "down" : "up"}
        hint="(neg - pos) / total words"
      />
      <MetricCard
        label="Negative %"
        value={fmtPct(summary.neg_pct)}
        trend={
          summary.neg_pct === null ? "neutral" : summary.neg_pct > 0 ? "down" : "neutral"
        }
        hint="LM negative word fraction"
      />
      <MetricCard
        label="Uncertainty %"
        value={fmtPct(summary.uncertainty_pct)}
        hint="LM uncertainty fraction"
      />
      <MetricCard
        label="Gunning Fog"
        value={fmtNum(summary.fog, 1)}
        hint="Grade level (higher = harder)"
      />
      <MetricCard
        label="Flesch-Kincaid"
        value={fmtNum(summary.flesch_kincaid, 1)}
        hint="Grade level"
      />
      <MetricCard
        label="SMOG"
        value={fmtNum(summary.smog, 1)}
        hint="Grade level"
      />
    </div>
  )
}

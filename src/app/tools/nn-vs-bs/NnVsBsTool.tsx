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
  DATA_SOURCE_PREFS,
  DEFAULT_TICKER,
  type FieldErrors,
  type FormState,
  MODES,
  type RunRequest,
  RunRequestSchema,
  type RunResponse,
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

/** Parse an optional positive numeric override. Empty string -> null. */
function parseOptional(text: string): {
  value: number | null
  filled: boolean
  valid: boolean
} {
  const trimmed = text.trim()
  if (!trimmed) return { value: null, filled: false, valid: true }
  const n = Number.parseFloat(trimmed)
  return { value: n, filled: true, valid: Number.isFinite(n) }
}

function buildRequest(
  form: FormState,
): { ok: true; value: RunRequest } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {}

  const tickerTrimmed = form.ticker.trim()
  if (form.mode === "real") {
    if (!tickerTrimmed) {
      errors.ticker = "Ticker is required for real chains."
    } else if (!TICKER_RE.test(tickerTrimmed)) {
      errors.ticker = "Letters, digits, '.' and '-' only."
    }
  }

  // Single-contract override: all five of {S, K, T, r, q} must be supplied
  // together, or none of them.
  const sP = parseOptional(form.S)
  const kP = parseOptional(form.K)
  const tP = parseOptional(form.T)
  const rP = parseOptional(form.r)
  const qP = parseOptional(form.q)
  const parts = [sP, kP, tP, rP, qP]
  const filledCount = parts.filter((p) => p.filled).length

  if (filledCount > 0 && filledCount < parts.length) {
    errors.contract = "Supply all of S, K, T, r, q together, or leave all blank."
  } else if (filledCount === parts.length) {
    if (parts.some((p) => !p.valid)) {
      errors.contract = "Contract fields must be valid numbers."
    } else if (
      (sP.value ?? 0) <= 0 ||
      (kP.value ?? 0) <= 0 ||
      (tP.value ?? 0) <= 0
    ) {
      errors.contract = "S, K and T must be positive."
    }
  }

  const nQuotes = Number.parseInt(form.n_quotes, 10)
  if (!Number.isInteger(nQuotes) || nQuotes < 8 || nQuotes > 5_000) {
    errors.n_quotes = "8 - 5000 quotes."
  }

  const seed = Number.parseInt(form.seed, 10)
  if (!Number.isFinite(seed) || seed < 0 || seed > 999_999) {
    errors.seed = "0 - 999999."
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  const contractFilled = filledCount === parts.length
  const value: RunRequest = {
    mode: form.mode,
    ticker: tickerTrimmed || DEFAULT_TICKER,
    S: contractFilled ? sP.value : null,
    K: contractFilled ? kP.value : null,
    T: contractFilled ? tP.value : null,
    r: contractFilled ? rP.value : null,
    q: contractFilled ? qP.value : null,
    n_quotes: nQuotes,
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
  mode: "synthetic",
  ticker: DEFAULT_TICKER,
  S: "",
  K: "",
  T: "",
  r: "",
  q: "",
  n_quotes: "500",
  data_source_pref: "auto",
  seed: "7",
}

export default function NnVsBsTool() {
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
        "/tools/nn-vs-bs/run",
        built.value,
      )
      setResult(data)
    } catch (err: unknown) {
      toast.error(detailMessage(err, "NN-vs-BS comparison failed."))
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
            Options: NN vs Black-Scholes
          </h1>
          <p className="text-sm text-muted-foreground">
            Price European options two ways — a from-scratch Black-Scholes closed
            form vs a small neural net — and compare them honestly with
            out-of-sample reprice error and a Diebold-Mariano test. Reprice error
            only; no tradable P&amp;L is claimed.
          </p>
        </div>
        {result ? (
          <Badge variant="outline" className="font-mono text-[11px]">
            data: {result.data_source} - {result.summary.n_quotes} quotes
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
            <RecoveryCard summary={result.summary} />
          ) : (
            <EmptyState message="Configure the comparison and press Run." />
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
              <PlotlyChart figure={result.smile_figure} />
              <PlotlyChart figure={result.error_by_moneyness_figure} />
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
  const realMode = form.mode === "real"
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Inputs
      </h2>

      <div className="space-y-4">
        <Field id="mode" label="Mode">
          <Select
            value={form.mode}
            onValueChange={(v) =>
              setForm((p) => ({ ...p, mode: v as FormState["mode"] }))
            }
          >
            <SelectTrigger id="mode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODES.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          id="ticker"
          label="Ticker"
          error={fieldErrors.ticker}
          hint={
            realMode
              ? "Underlying for the live option chain."
              : "Used only in real mode; ignored for synthetic data."
          }
        >
          <Input
            id="ticker"
            value={form.ticker}
            onChange={(e) => setForm((p) => ({ ...p, ticker: e.target.value }))}
            onBlur={(e) =>
              setForm((p) => ({ ...p, ticker: e.target.value.toUpperCase() }))
            }
            spellCheck={false}
            className="font-mono uppercase"
            disabled={!realMode}
            aria-invalid={Boolean(fieldErrors.ticker)}
          />
        </Field>

        <fieldset className="space-y-2 rounded-md border border-dashed p-3">
          <legend className="px-1 text-xs font-medium text-muted-foreground">
            Single contract (optional)
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <Field id="S" label="S (spot)">
              <Input
                id="S"
                type="number"
                step="any"
                placeholder="—"
                value={form.S}
                onChange={(e) => setForm((p) => ({ ...p, S: e.target.value }))}
                aria-invalid={Boolean(fieldErrors.contract)}
              />
            </Field>
            <Field id="K" label="K (strike)">
              <Input
                id="K"
                type="number"
                step="any"
                placeholder="—"
                value={form.K}
                onChange={(e) => setForm((p) => ({ ...p, K: e.target.value }))}
                aria-invalid={Boolean(fieldErrors.contract)}
              />
            </Field>
            <Field id="T" label="T (years)">
              <Input
                id="T"
                type="number"
                step="any"
                placeholder="—"
                value={form.T}
                onChange={(e) => setForm((p) => ({ ...p, T: e.target.value }))}
                aria-invalid={Boolean(fieldErrors.contract)}
              />
            </Field>
            <Field id="r" label="r (rate)">
              <Input
                id="r"
                type="number"
                step="any"
                placeholder="—"
                value={form.r}
                onChange={(e) => setForm((p) => ({ ...p, r: e.target.value }))}
                aria-invalid={Boolean(fieldErrors.contract)}
              />
            </Field>
            <Field id="q" label="q (div yield)">
              <Input
                id="q"
                type="number"
                step="any"
                placeholder="—"
                value={form.q}
                onChange={(e) => setForm((p) => ({ ...p, q: e.target.value }))}
                aria-invalid={Boolean(fieldErrors.contract)}
              />
            </Field>
          </div>
          {fieldErrors.contract ? (
            <p role="alert" className="text-xs text-destructive">
              {fieldErrors.contract}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Leave blank to evaluate over the full grid / chain.
            </p>
          )}
        </fieldset>

        <Field
          id="n_quotes"
          label="Synthetic grid size"
          error={fieldErrors.n_quotes}
          hint="Number of (S,K,T,r,q) quotes sampled for synthetic mode."
        >
          <Input
            id="n_quotes"
            type="number"
            step="50"
            min={8}
            max={5_000}
            value={form.n_quotes}
            onChange={(e) =>
              setForm((p) => ({ ...p, n_quotes: e.target.value }))
            }
            aria-invalid={Boolean(fieldErrors.n_quotes)}
          />
        </Field>

        <Field id="data_source_pref" label="Data source">
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
// Recovery card — the FIRST thing surfaced. This is the honest headline: on
// synthetic BS data the NN can at best RECOVER the BS surface (a convergence
// check), never beat it. The badge is neutral/info, NOT a "beats" claim.
// ---------------------------------------------------------------------------

function RecoveryCard({ summary }: { summary: RunResponse["summary"] }) {
  const recovers = summary.nn_recovers_bs
  const synthetic = summary.data_source === "synthetic"

  const badge = synthetic
    ? `NN recovers BS surface: ${recovers ? "YES" : "NO"}`
    : "Real chain: BS vs NN reprice error"

  const headline = synthetic
    ? recovers
      ? "The neural net recovers the Black-Scholes surface"
      : "The neural net has not yet converged to Black-Scholes"
    : "Constant-vol Black-Scholes vs a non-circular neural net"

  const body = synthetic
    ? "On BS-generated data the NN can only match BS — a convergence check, not an improvement. No tradable edge is claimed."
    : "On real chains, Black-Scholes with a single constant volatility systematically misprices the volatility smile (Dumas-Fleming-Whaley 1998). The comparison below reports out-of-sample reprice error across moneyness; no tradable P&L is claimed."

  // Neutral / informational styling throughout — this is never a "beats" claim.
  return (
    <Card className="gap-2 border-2 border-sky-300 bg-sky-50 p-5 shadow-none dark:border-sky-900/60 dark:bg-sky-950/30">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{badge}</Badge>
        <Badge variant="outline" className="font-mono text-[11px]">
          {summary.data_source}
        </Badge>
        <span className="font-mono text-[11px] text-muted-foreground">
          BS RMSE {fmtNum(summary.bs_rmse, 4)} - NN RMSE{" "}
          {fmtNum(summary.nn_rmse, 4)} - DM {fmtNum(summary.dm_stat, 3)} (p=
          {fmtNum(summary.dm_pvalue, 3)})
        </span>
      </div>
      <h2 className="text-lg font-semibold tracking-tight">{headline}</h2>
      <p className="text-sm text-muted-foreground">{body}</p>
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[78px] w-full rounded-xl" />
      ))}
    </div>
  )
}

function MetricsGrid({ summary }: { summary: RunResponse["summary"] }) {
  const bs = summary.bs_rmse
  const nn = summary.nn_rmse
  // Lower reprice error is "better"; we only colour the NN cell relative to BS
  // for orientation — never as a tradable-edge claim.
  const nnTrend =
    bs === null || nn === null ? "neutral" : nn <= bs ? "up" : "down"

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricCard
        label="BS Reprice RMSE"
        value={fmtNum(bs, 4)}
        hint={`MAE ${fmtNum(summary.mae_bs, 4)}`}
      />
      <MetricCard
        label="NN Reprice RMSE"
        value={fmtNum(nn, 4)}
        trend={nnTrend}
        hint={`MAE ${fmtNum(summary.mae_nn, 4)}`}
      />
      <MetricCard
        label="Diebold-Mariano"
        value={fmtNum(summary.dm_stat, 3)}
        hint="Paired BS - NN loss differential"
      />
      <MetricCard
        label="DM p-value"
        value={fmtNum(summary.dm_pvalue, 3)}
        hint="Two-sided"
      />
    </div>
  )
}

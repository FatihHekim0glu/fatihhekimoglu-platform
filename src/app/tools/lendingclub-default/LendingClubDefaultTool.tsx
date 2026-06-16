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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/sonner"
import MetricCard from "@/components/MetricCard"
import PlotlyChart from "@/components/PlotlyChart"
import { ApiError, apiPost } from "@/lib/api"
import { fmtNum, fmtPct } from "@/lib/format"

import {
  ADDR_STATES,
  EMP_LENGTHS,
  type FieldErrors,
  type FormState,
  GRADES,
  HOME_OWNERSHIPS,
  type NumericField,
  PURPOSES,
  type ReasonCode,
  type RunRequest,
  RunRequestSchema,
  type RunResponse,
  SUB_GRADES,
  TERMS,
  VERIFICATION_STATUSES,
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

type Bound = { min: number; max: number; integer?: boolean; label: string }

const NUMERIC_BOUNDS: Record<NumericField, Bound> = {
  loan_amnt: { min: 500, max: 40_000, label: "500 - 40000." },
  int_rate: { min: 0, max: 40, label: "0 - 40%." },
  annual_inc: { min: 0, max: 10_000_000, label: "0 - 10000000." },
  dti: { min: 0, max: 999, label: "0 - 999." },
  fico_range_low: { min: 300, max: 850, integer: true, label: "300 - 850." },
  fico_range_high: { min: 300, max: 850, integer: true, label: "300 - 850." },
  revol_util: { min: 0, max: 200, label: "0 - 200%." },
  open_acc: { min: 0, max: 120, integer: true, label: "0 - 120." },
  pub_rec: { min: 0, max: 80, integer: true, label: "0 - 80." },
  installment: { min: 0, max: 2_000, label: "0 - 2000." },
}

function buildRequest(
  form: FormState,
): { ok: true; value: RunRequest } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {}
  const nums = {} as Record<NumericField, number>

  for (const key of Object.keys(NUMERIC_BOUNDS) as NumericField[]) {
    const bound = NUMERIC_BOUNDS[key]
    const raw = form[key]
    const parsed = bound.integer
      ? Number.parseInt(raw, 10)
      : Number.parseFloat(raw)
    const valid = bound.integer
      ? Number.isInteger(parsed)
      : Number.isFinite(parsed)
    if (!valid || parsed < bound.min || parsed > bound.max) {
      errors[key] = bound.label
    } else {
      nums[key] = parsed
    }
  }

  // FICO low must not exceed FICO high.
  if (
    errors.fico_range_low === undefined &&
    errors.fico_range_high === undefined &&
    nums.fico_range_low > nums.fico_range_high
  ) {
    errors.fico_range_high = "FICO high must be >= FICO low."
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  const value: RunRequest = {
    loan_amnt: nums.loan_amnt,
    term: form.term,
    int_rate: nums.int_rate,
    grade: form.grade,
    sub_grade: form.sub_grade,
    emp_length: form.emp_length,
    home_ownership: form.home_ownership,
    annual_inc: nums.annual_inc,
    dti: nums.dti,
    fico_range_low: nums.fico_range_low,
    fico_range_high: nums.fico_range_high,
    revol_util: nums.revol_util,
    open_acc: nums.open_acc,
    pub_rec: nums.pub_rec,
    purpose: form.purpose,
    installment: nums.installment,
    verification_status: form.verification_status,
    addr_state: form.addr_state,
  }
  RunRequestSchema.parse(value)
  return { ok: true, value }
}

function predictedLabelView(label: string): {
  text: string
  trend: "up" | "down" | "neutral"
} {
  if (label === "likely_default") {
    return { text: "Likely default", trend: "down" }
  }
  if (label === "likely_repaid") {
    return { text: "Likely repaid", trend: "up" }
  }
  return { text: label, trend: "neutral" }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const INITIAL_FORM: FormState = {
  loan_amnt: "12000",
  term: "36 months",
  int_rate: "13.5",
  grade: "C",
  sub_grade: "C2",
  emp_length: "5 years",
  home_ownership: "MORTGAGE",
  annual_inc: "72000",
  dti: "18.4",
  fico_range_low: "690",
  fico_range_high: "694",
  revol_util: "42.5",
  open_acc: "11",
  pub_rec: "0",
  purpose: "debt_consolidation",
  installment: "407",
  verification_status: "Source Verified",
  addr_state: "CA",
}

export default function LendingClubDefaultTool() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunResponse | null>(null)

  const onScore = useCallback(async () => {
    const built = buildRequest(form)
    if (!built.ok) {
      setFieldErrors(built.errors)
      return
    }
    setFieldErrors({})
    setRunning(true)
    try {
      const data = await apiPost<RunResponse>(
        "/tools/lendingclub-default/run",
        built.value,
      )
      setResult(data)
    } catch (err: unknown) {
      toast.error(detailMessage(err, "Scoring the application failed."))
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
            LendingClub Default Classifier
          </h1>
          <p className="text-sm text-muted-foreground">
            Score a loan application&apos;s probability of default at
            origination with a leakage-free, calibrated XGBoost model — honest
            ROC-AUC / PR-AUC / Brier, a calibrated risk decile, and reason
            codes. It ranks risk; it does not predict individuals.
          </p>
        </div>
        {result ? (
          <Badge variant="outline" className="font-mono text-[11px]">
            data: {result.data_source} - AUC{" "}
            {fmtNum(result.summary.model_auc, 3)} - base{" "}
            {fmtPct(result.summary.base_rate)}
          </Badge>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <SidebarForm
            form={form}
            setForm={setForm}
            fieldErrors={fieldErrors}
            onScore={onScore}
            running={running}
          />
        </aside>

        <section className="space-y-4">
          <HonestCaption />

          {running ? (
            <MetricsSkeleton />
          ) : result ? (
            <SummaryGrid summary={result.summary} />
          ) : (
            <EmptyState message="Fill in the application fields and press Score." />
          )}

          {running ? (
            <Skeleton className="h-[220px] w-full rounded-xl" />
          ) : result ? (
            <ReasonCodeTable reasonCodes={result.reason_codes} />
          ) : null}

          {running ? (
            <Skeleton className="h-[640px] w-full" />
          ) : result ? (
            <FigureTabs result={result} />
          ) : null}
        </section>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Honest caption — the discipline lives up front, not buried in a footnote.
// ---------------------------------------------------------------------------

function HonestCaption() {
  return (
    <Card className="gap-1 border-amber-300 bg-amber-50 p-4 shadow-none dark:border-amber-900/60 dark:bg-amber-950/30">
      <p className="text-sm font-medium">
        Ranks risk; does not predict individuals. Demo model trained on
        synthetic LC-schema data.
      </p>
      <p className="text-xs text-muted-foreground">
        Headline is AUC / PR-AUC / Brier — never accuracy or profit. Two limits:
        (1) accepted-loans-only selection bias; (2) <code>int_rate</code> /{" "}
        <code>grade</code> are LendingClub&apos;s own risk model, so their
        importance is partly circular. Real-data numbers (expected ROC-AUC
        ~0.70) require the Kaggle accepted-loans CSV.
      </p>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Sidebar — application-time fields only.
// ---------------------------------------------------------------------------

type SidebarFormProps = {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  fieldErrors: FieldErrors
  onScore: () => void
  running: boolean
}

function SidebarForm({
  form,
  setForm,
  fieldErrors,
  onScore,
  running,
}: SidebarFormProps) {
  const num = (key: NumericField) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }))

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Application
      </h2>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Field id="loan_amnt" label="Loan amount" error={fieldErrors.loan_amnt}>
            <Input
              id="loan_amnt"
              type="number"
              step="100"
              min={500}
              value={form.loan_amnt}
              onChange={num("loan_amnt")}
              aria-invalid={Boolean(fieldErrors.loan_amnt)}
            />
          </Field>
          <Field
            id="installment"
            label="Installment"
            error={fieldErrors.installment}
          >
            <Input
              id="installment"
              type="number"
              step="1"
              min={0}
              value={form.installment}
              onChange={num("installment")}
              aria-invalid={Boolean(fieldErrors.installment)}
            />
          </Field>
        </div>

        <SelectField
          id="term"
          label="Term"
          value={form.term}
          options={TERMS}
          onChange={(v) => setForm((p) => ({ ...p, term: v as FormState["term"] }))}
        />

        <Field id="int_rate" label="Interest rate (%)" error={fieldErrors.int_rate}>
          <Input
            id="int_rate"
            type="number"
            step="0.01"
            min={0}
            value={form.int_rate}
            onChange={num("int_rate")}
            aria-invalid={Boolean(fieldErrors.int_rate)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <SelectField
            id="grade"
            label="Grade"
            value={form.grade}
            options={GRADES}
            onChange={(v) =>
              setForm((p) => ({ ...p, grade: v as FormState["grade"] }))
            }
          />
          <SelectField
            id="sub_grade"
            label="Sub-grade"
            value={form.sub_grade}
            options={SUB_GRADES}
            onChange={(v) => setForm((p) => ({ ...p, sub_grade: v }))}
          />
        </div>

        <SelectField
          id="purpose"
          label="Purpose"
          value={form.purpose}
          options={PURPOSES}
          onChange={(v) =>
            setForm((p) => ({ ...p, purpose: v as FormState["purpose"] }))
          }
        />

        <SelectField
          id="home_ownership"
          label="Home ownership"
          value={form.home_ownership}
          options={HOME_OWNERSHIPS}
          onChange={(v) =>
            setForm((p) => ({
              ...p,
              home_ownership: v as FormState["home_ownership"],
            }))
          }
        />

        <SelectField
          id="emp_length"
          label="Employment length"
          value={form.emp_length}
          options={EMP_LENGTHS}
          onChange={(v) =>
            setForm((p) => ({ ...p, emp_length: v as FormState["emp_length"] }))
          }
        />

        <SelectField
          id="verification_status"
          label="Verification status"
          value={form.verification_status}
          options={VERIFICATION_STATUSES}
          onChange={(v) =>
            setForm((p) => ({
              ...p,
              verification_status: v as FormState["verification_status"],
            }))
          }
        />

        <div className="grid grid-cols-2 gap-2">
          <Field id="annual_inc" label="Annual income" error={fieldErrors.annual_inc}>
            <Input
              id="annual_inc"
              type="number"
              step="1000"
              min={0}
              value={form.annual_inc}
              onChange={num("annual_inc")}
              aria-invalid={Boolean(fieldErrors.annual_inc)}
            />
          </Field>
          <Field id="dti" label="DTI" error={fieldErrors.dti}>
            <Input
              id="dti"
              type="number"
              step="0.1"
              min={0}
              value={form.dti}
              onChange={num("dti")}
              aria-invalid={Boolean(fieldErrors.dti)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field
            id="fico_range_low"
            label="FICO low"
            error={fieldErrors.fico_range_low}
          >
            <Input
              id="fico_range_low"
              type="number"
              step="1"
              min={300}
              max={850}
              value={form.fico_range_low}
              onChange={num("fico_range_low")}
              aria-invalid={Boolean(fieldErrors.fico_range_low)}
            />
          </Field>
          <Field
            id="fico_range_high"
            label="FICO high"
            error={fieldErrors.fico_range_high}
          >
            <Input
              id="fico_range_high"
              type="number"
              step="1"
              min={300}
              max={850}
              value={form.fico_range_high}
              onChange={num("fico_range_high")}
              aria-invalid={Boolean(fieldErrors.fico_range_high)}
            />
          </Field>
        </div>

        <Field id="revol_util" label="Revolving util (%)" error={fieldErrors.revol_util}>
          <Input
            id="revol_util"
            type="number"
            step="0.1"
            min={0}
            value={form.revol_util}
            onChange={num("revol_util")}
            aria-invalid={Boolean(fieldErrors.revol_util)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field id="open_acc" label="Open accounts" error={fieldErrors.open_acc}>
            <Input
              id="open_acc"
              type="number"
              step="1"
              min={0}
              value={form.open_acc}
              onChange={num("open_acc")}
              aria-invalid={Boolean(fieldErrors.open_acc)}
            />
          </Field>
          <Field id="pub_rec" label="Public records" error={fieldErrors.pub_rec}>
            <Input
              id="pub_rec"
              type="number"
              step="1"
              min={0}
              value={form.pub_rec}
              onChange={num("pub_rec")}
              aria-invalid={Boolean(fieldErrors.pub_rec)}
            />
          </Field>
        </div>

        <SelectField
          id="addr_state"
          label="State"
          value={form.addr_state}
          options={ADDR_STATES}
          onChange={(v) =>
            setForm((p) => ({ ...p, addr_state: v as FormState["addr_state"] }))
          }
        />

        <Button
          type="button"
          onClick={onScore}
          disabled={running}
          className="w-full"
          aria-live="polite"
        >
          {running ? "Scoring..." : "Score"}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Summary grid — the headline metrics. AUC / PR-AUC / Brier-flavoured, never
// accuracy or profit.
// ---------------------------------------------------------------------------

function SummaryGrid({ summary }: { summary: RunResponse["summary"] }) {
  const label = predictedLabelView(summary.predicted_label)
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <MetricCard
        label="Calibrated PD"
        value={fmtPct(summary.calibrated_pd)}
        trend={
          summary.calibrated_pd === null
            ? "neutral"
            : summary.base_rate !== null && summary.calibrated_pd > summary.base_rate
              ? "down"
              : "up"
        }
        hint="Isotonic-calibrated P(default)"
      />
      <MetricCard
        label="Risk Decile"
        value={summary.risk_decile === null ? "—" : `${summary.risk_decile} / 10`}
        trend={
          summary.risk_decile === null
            ? "neutral"
            : summary.risk_decile >= 8
              ? "down"
              : summary.risk_decile <= 3
                ? "up"
                : "neutral"
        }
        hint="1 safest .. 10 riskiest"
      />
      <MetricCard
        label="Model AUC"
        value={fmtNum(summary.model_auc, 3)}
        hint="Held-out ROC-AUC (synthetic)"
      />
      <MetricCard
        label="Base Rate"
        value={fmtPct(summary.base_rate)}
        hint="Panel default rate (~15%)"
      />
      <MetricCard
        label="Predicted Label"
        value={label.text}
        trend={label.trend}
        hint={`Threshold ${fmtNum(summary.threshold, 3)} — triage only`}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reason codes — weight-of-evidence / logistic coefficients. No SHAP in the
// container; these are the shipped, explainable drivers.
// ---------------------------------------------------------------------------

function ReasonCodeTable({ reasonCodes }: { reasonCodes: ReasonCode[] }) {
  if (reasonCodes.length === 0) {
    return (
      <Card className="p-4 shadow-none">
        <p className="text-sm text-muted-foreground">
          No reason codes returned for this application.
        </p>
      </Card>
    )
  }
  return (
    <Card className="gap-3 p-4 shadow-none">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">Reason codes</h2>
        <span className="text-[11px] text-muted-foreground">
          Top drivers of this application&apos;s score
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Feature</th>
              <th className="py-2 pr-3 font-medium">Direction</th>
              <th className="py-2 text-right font-medium">Contribution</th>
            </tr>
          </thead>
          <tbody>
            {reasonCodes.map((rc, i) => {
              const up = rc.direction === "increases_risk"
              const down = rc.direction === "decreases_risk"
              return (
                <tr key={`${rc.feature}-${i}`} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-mono text-xs">{rc.feature}</td>
                  <td className="py-2 pr-3">
                    <Badge
                      variant={up ? "destructive" : down ? "default" : "secondary"}
                    >
                      {up
                        ? "increases risk"
                        : down
                          ? "decreases risk"
                          : rc.direction}
                    </Badge>
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums">
                    {fmtNum(rc.contribution, 3)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Tabbed figures — score distribution + calibration curve.
// ---------------------------------------------------------------------------

function FigureTabs({ result }: { result: RunResponse }) {
  return (
    <Card className="gap-3 p-4 shadow-none">
      <Tabs defaultValue="score">
        <TabsList>
          <TabsTrigger value="score">Score distribution</TabsTrigger>
          <TabsTrigger value="calibration">Calibration</TabsTrigger>
        </TabsList>
        <TabsContent value="score">
          <PlotlyChart figure={result.score_distribution_figure} />
        </TabsContent>
        <TabsContent value="calibration">
          <PlotlyChart figure={result.calibration_figure} />
        </TabsContent>
      </Tabs>
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

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: string
  options: readonly string[]
  onChange: (value: string) => void
}) {
  return (
    <Field id={id} label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[148px] w-full items-center justify-center rounded-xl border border-dashed bg-card text-sm text-muted-foreground">
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

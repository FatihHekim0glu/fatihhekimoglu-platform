"use client"

import type { Dispatch, ReactNode, SetStateAction } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import MetricCard, { type MetricTrend } from "@/components/MetricCard"
import { fmtDate, fmtNum, fmtPct } from "@/lib/format"
import { cn } from "@/lib/utils"

import type {
  AnchorResponse,
  FieldErrors,
  FormState,
  IndicatorLabel,
  Summary,
} from "./types"
import { INDICATOR_OPTIONS } from "./types"

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

type SidebarFormProps = {
  anchor: AnchorResponse | null
  anchorError: string | null
  form: FormState
  setForm: Dispatch<SetStateAction<FormState>>
  fieldErrors: FieldErrors
  toggleIndicator: (label: IndicatorLabel) => void
  onRun: () => void
  running: boolean
}

export function SidebarForm({
  anchor,
  anchorError,
  form,
  setForm,
  fieldErrors,
  toggleIndicator,
  onRun,
  running,
}: SidebarFormProps) {
  const loadingAnchor = !anchor && !anchorError

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Inputs
      </h2>

      <div className="space-y-4">
        <Field id="ticker" label="Ticker" error={fieldErrors.ticker}>
          <Input
            id="ticker"
            value={form.ticker}
            onChange={(e) => setForm((p) => ({ ...p, ticker: e.target.value }))}
            onBlur={(e) =>
              setForm((p) => ({ ...p, ticker: e.target.value.trim().toUpperCase() }))
            }
            autoComplete="off"
            spellCheck={false}
            className="font-mono uppercase"
            aria-invalid={Boolean(fieldErrors.ticker)}
          />
        </Field>

        <Field id="start_date" label="Start date" error={fieldErrors.start_date}>
          {loadingAnchor ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <Input
              id="start_date"
              type="date"
              value={form.start_date}
              min={anchor?.min_date}
              max={anchor?.today_nyse}
              onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
              aria-invalid={Boolean(fieldErrors.start_date)}
            />
          )}
        </Field>

        <Field id="end_date" label="End date" error={fieldErrors.end_date}>
          {loadingAnchor ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <Input
              id="end_date"
              type="date"
              value={form.end_date}
              min={anchor?.min_date}
              max={anchor?.today_nyse}
              onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
              aria-invalid={Boolean(fieldErrors.end_date)}
            />
          )}
        </Field>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Indicators</legend>
          <div className="grid grid-cols-1 gap-1.5">
            {INDICATOR_OPTIONS.map((label) => {
              const id = `ind-${label.replace(/\s+/g, "-").toLowerCase()}`
              const checked = form.indicators.has(label)
              return (
                <label
                  key={label}
                  htmlFor={id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm transition-colors",
                    checked
                      ? "border-primary/40 bg-primary/5 text-foreground"
                      : "border-input text-muted-foreground hover:bg-accent/40",
                  )}
                >
                  <input
                    id={id}
                    type="checkbox"
                    className="size-3.5 accent-primary"
                    checked={checked}
                    onChange={() => toggleIndicator(label)}
                  />
                  <span className="font-mono text-xs">{label}</span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="candlestick" className="text-sm font-medium">
            Candlestick view
          </Label>
          <Switch
            id="candlestick"
            checked={form.candlestick}
            onCheckedChange={(v) => setForm((p) => ({ ...p, candlestick: v }))}
          />
        </div>

        <Field
          id="rf_annual"
          label="Risk-free rate (annualized)"
          error={fieldErrors.rf_annual}
          hint="Used only for Sharpe."
        >
          <Input
            id="rf_annual"
            type="number"
            step="0.001"
            value={form.rf_annual}
            onChange={(e) => setForm((p) => ({ ...p, rf_annual: e.target.value }))}
            aria-invalid={Boolean(fieldErrors.rf_annual)}
          />
        </Field>

        <Button
          type="button"
          onClick={onRun}
          disabled={running || loadingAnchor}
          className="w-full"
          aria-live="polite"
        >
          {running ? "Running..." : "Run"}
        </Button>

        {anchorError ? (
          <p role="alert" className="text-xs text-destructive">
            {anchorError}
          </p>
        ) : null}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small presentational helpers
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
  children: ReactNode
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

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[640px] w-full items-center justify-center rounded-xl border border-dashed bg-card text-sm text-muted-foreground">
      {message}
    </div>
  )
}

export function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <Skeleton key={i} className="h-[78px] w-full rounded-xl" />
      ))}
    </div>
  )
}

function trendOf(value: number | null | undefined): MetricTrend {
  if (value === null || value === undefined || !Number.isFinite(value)) return "neutral"
  if (value > 0) return "up"
  if (value < 0) return "down"
  return "neutral"
}

export function MetricsGrid({
  summary,
  sharpeHint,
}: {
  summary: Summary
  sharpeHint: string
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <MetricCard
        label="Cumulative Return"
        value={fmtPct(summary.cumulative_return)}
        trend={trendOf(summary.cumulative_return)}
      />
      <MetricCard
        label="CAGR"
        value={fmtPct(summary.annualized_return)}
        trend={trendOf(summary.annualized_return)}
      />
      <MetricCard
        label="Volatility"
        value={fmtPct(summary.annualized_volatility)}
      />
      <MetricCard
        label="Sharpe"
        value={fmtNum(summary.sharpe)}
        hint={sharpeHint}
        trend={trendOf(summary.sharpe)}
      />
      <MetricCard
        label="Max DD"
        value={fmtPct(summary.max_drawdown)}
        trend={trendOf(summary.max_drawdown)}
      />
      <MetricCard
        label="Best Day"
        value={fmtPct(summary.best_day)}
        trend={trendOf(summary.best_day)}
      />
      <MetricCard
        label="Worst Day"
        value={fmtPct(summary.worst_day)}
        trend={trendOf(summary.worst_day)}
      />
      <MetricCard label="Trading Days" value={`${summary.trading_days}`} />
      <MetricCard label="Start Date" value={fmtDate(summary.start)} />
      <MetricCard label="End Date" value={fmtDate(summary.end)} />
    </div>
  )
}

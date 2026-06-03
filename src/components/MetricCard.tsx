import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type MetricTrend = "up" | "down" | "neutral"

type MetricCardProps = {
  label: string
  value: string
  hint?: string
  trend?: MetricTrend
  className?: string
}

const TREND_COLOR: Record<MetricTrend, string> = {
  up: "text-teal-600 dark:text-teal-400",
  down: "text-red-600 dark:text-red-400",
  neutral: "text-foreground",
}

export default function MetricCard({
  label,
  value,
  hint,
  trend = "neutral",
  className,
}: MetricCardProps) {
  return (
    <Card
      className={cn(
        "gap-1 px-4 py-3 shadow-none",
        className,
      )}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-xl font-semibold tabular-nums leading-tight",
          TREND_COLOR[trend],
        )}
      >
        {value}
      </span>
      {hint ? (
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      ) : null}
    </Card>
  )
}

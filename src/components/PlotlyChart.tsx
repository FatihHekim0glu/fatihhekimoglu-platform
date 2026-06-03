"use client"

import dynamic from "next/dynamic"
import type { Config, Data, Layout } from "plotly.js"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export type PlotlyFigure = {
  data: Data[]
  layout: Partial<Layout>
}

type PlotlyChartProps = {
  figure: PlotlyFigure
  className?: string
}

// react-plotly.js drags plotly.js-dist-min into the bundle and touches
// `window` at import time, so it must never hit the server renderer.
const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => <Skeleton className="h-[640px] w-full" />,
})

const PLOTLY_CONFIG: Partial<Config> = {
  displaylogo: false,
  responsive: true,
  modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"],
}

export default function PlotlyChart({ figure, className }: PlotlyChartProps) {
  return (
    <div className={cn("w-full", className)}>
      <Plot
        data={figure.data}
        layout={{
          ...figure.layout,
          autosize: true,
          margin: { l: 56, r: 32, t: 32, b: 40, ...(figure.layout?.margin ?? {}) },
        }}
        config={PLOTLY_CONFIG}
        style={{ width: "100%", height: "640px" }}
        useResizeHandler
      />
    </div>
  )
}

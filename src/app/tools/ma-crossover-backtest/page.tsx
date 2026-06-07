import type { Metadata } from "next"

import MaCrossoverBacktestTool from "./MaCrossoverBacktestTool"

export const metadata: Metadata = {
  title: "MA Crossover Backtest — fatihhekimoglu.com",
  description:
    "Long/flat SMA crossover backtest with buy-and-hold benchmark, HAC alpha, and Memmel Sharpe difference test.",
}

export default function MaCrossoverBacktestPage() {
  return <MaCrossoverBacktestTool />
}

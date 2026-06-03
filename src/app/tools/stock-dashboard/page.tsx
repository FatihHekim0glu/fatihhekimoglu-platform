import type { Metadata } from "next"

import StockDashboardTool from "./StockDashboardTool"

export const metadata: Metadata = {
  title: "Stock Dashboard — fatihhekimoglu.com",
  description:
    "Single-ticker price, indicators, and risk metrics from daily OHLCV.",
}

export default function StockDashboardPage() {
  return <StockDashboardTool />
}

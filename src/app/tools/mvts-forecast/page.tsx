import type { Metadata } from "next"

import MvtsForecastTool from "./MvtsForecastTool"

export const metadata: Metadata = {
  title: "Multivariate Transformer Forecast — fatihhekimoglu.com",
  description:
    "Benchmark PatchTST and an interpretable transformer against LSTM, ARIMA, and a naive random-walk baseline on a multivariate financial time series — with leakage-safe RevIN, a purged walk-forward, and Deflated-Sharpe / Diebold-Mariano honesty. The documented result is a NULL: on noisy daily returns the deep models do NOT reliably beat naive (DM insignificant, DSR ~0). No price-level R-squared.",
}

export default function MvtsForecastPage() {
  return <MvtsForecastTool />
}

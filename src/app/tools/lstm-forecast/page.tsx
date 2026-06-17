import type { Metadata } from "next"

import LstmForecastTool from "./LstmForecastTool"

export const metadata: Metadata = {
  title: "LSTM Stock Forecast (Done Properly) — fatihhekimoglu.com",
  description:
    "A leakage-free rebuild of the classic LSTM stock-price-prediction project: predict next-day RETURNS (not price levels), validate with purged walk-forward, and honestly test against a random-walk baseline. The documented result is a NULL — the LSTM does not beat naive persistence (MASE >= 1, Diebold-Mariano insignificant). No price-level R-squared.",
}

export default function LstmForecastPage() {
  return <LstmForecastTool />
}

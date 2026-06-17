import type { Metadata } from "next"

import VolforecastTool from "./VolforecastTool"

export const metadata: Metadata = {
  title: "GARCH vs ML Volatility Forecast — fatihhekimoglu.com",
  description:
    "Forecast realized volatility of a stock index and honestly test whether XGBoost or an LSTM beats a well-specified GARCH(1,1)/HAR-RV out-of-sample (QLIKE + Diebold-Mariano + Hansen SPA). The headline is a pure function of OOS QLIKE and SPA/DM significance — so it cannot crown ML the winner unless it beats GARCH with a significant margin. Spoiler from Hansen & Lunde 2005: GARCH is hard to beat.",
}

export default function VolforecastPage() {
  return <VolforecastTool />
}

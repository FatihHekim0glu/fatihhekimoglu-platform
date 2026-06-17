import type { Metadata } from "next"

import RegimeHmmTool from "./RegimeHmmTool"

export const metadata: Metadata = {
  title: "Market Regime HMM — fatihhekimoglu.com",
  description:
    "Fit a Gaussian Hidden Markov Model to index returns to label market regimes (low-vol bull / high-vol bear / crisis), then honestly test whether a regime-timing overlay beats buy-and-hold out-of-sample after costs. Regimes are real; timing them isn't free money. OOS labels come from the online forward filter only — smoothed/Viterbi posteriors peek ahead and are EDA-only.",
}

export default function RegimeHmmPage() {
  return <RegimeHmmTool />
}

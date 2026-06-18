import type { Metadata } from "next"

import GnnStocksTool from "./GnnStocksTool"

export const metadata: Metadata = {
  title: "Graph Neural Network on Stocks — fatihhekimoglu.com",
  description:
    "Build a point-in-time stock-relationship graph from rolling return correlations and run a Graph Convolutional / GraphSAGE network against per-node ridge and cross-sectional-momentum baselines for next-period return ranking — with leakage-safe per-fold graphs, a purged walk-forward, and Deflated-Sharpe / Diebold-Mariano honesty. The documented result is a NULL: message-passing recovers sector structure but does NOT reliably beat the baselines out-of-sample (DM insignificant, DSR ~0). No baseline-free R-squared.",
}

export default function GnnStocksPage() {
  return <GnnStocksTool />
}

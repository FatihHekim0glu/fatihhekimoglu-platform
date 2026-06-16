import type { Metadata } from "next"

import StockClustersTool from "./StockClustersTool"

export const metadata: Metadata = {
  title: "Stock Diversification Clusters — fatihhekimoglu.com",
  description:
    "Cluster the S&P 500 by correlation structure (RMT-denoised, Mantegna distance) to map its diversification skeleton — and honestly test whether cluster-aware allocation beats naive 1/N after costs. The headline is a pure function of the inference, so it cannot claim clusters beat 1/N while the Memmel-JK p-value is insignificant or the deflated Sharpe is non-positive.",
}

export default function StockClustersPage() {
  return <StockClustersTool />
}

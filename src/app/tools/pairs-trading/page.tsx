import type { Metadata } from "next"

import PairsTradingTool from "./PairsTradingTool"

export const metadata: Metadata = {
  title: "Pairs Trading - fatihhekimoglu.com",
  description:
    "Cointegration scan over a curated universe of US equity pairs with FDR-corrected diagnostics.",
}

export default function PairsTradingPage() {
  return <PairsTradingTool />
}

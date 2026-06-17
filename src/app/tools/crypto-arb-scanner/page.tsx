import type { Metadata } from "next"

import CryptoArbScannerTool from "./CryptoArbScannerTool"

export const metadata: Metadata = {
  title: "Crypto Arbitrage Scanner — fatihhekimoglu.com",
  description:
    "Decompose cross-exchange and triangular crypto spreads into a fee-, depth-, and transfer-cost-aware gross→net waterfall. The raw spread looks profitable, but the net executable edge on liquid pairs collapses to ~0 after taker fees, order-book depth slippage, and transfer cost — latency arb is an HFT game, not a REST one. A diagnostic tool, not a money printer.",
}

export default function CryptoArbScannerPage() {
  return <CryptoArbScannerTool />
}

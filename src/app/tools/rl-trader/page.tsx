import type { Metadata } from "next"

import RlTraderTool from "./RlTraderTool"

export const metadata: Metadata = {
  title: "RL Trading Agent (Realistic Backtest) — fatihhekimoglu.com",
  description:
    "Train a PPO agent in a single-asset trading environment with transaction costs, slippage and position limits (strictly causal next-bar reward), evaluated out-of-sample inside a purged walk-forward with a vectorized-vs-stepwise parity oracle and a seed-lottery overfit check. The documented result is a NULL: across training seeds the agent does NOT reliably beat buy-and-hold net of costs — the OOS Sharpe is indistinguishable from zero after a Deflated-Sharpe correction. The policy is trained offline and served via ONNX (no torch at request time); execution is simulated, not a live broker.",
}

export default function RlTraderPage() {
  return <RlTraderTool />
}

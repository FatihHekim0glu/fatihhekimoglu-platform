import type { Metadata } from "next"

import RlAllocatorTool from "./RlAllocatorTool"

export const metadata: Metadata = {
  title: "Multi-Asset RL Portfolio Allocator — fatihhekimoglu.com",
  description:
    "Train a PPO agent to allocate across a multi-asset basket (a simplex of portfolio weights) in a cost-aware portfolio environment (strictly causal next-bar portfolio reward), evaluated out-of-sample inside a purged walk-forward with a vectorized-vs-stepwise parity oracle and a seed-lottery overfit check, against equal-weight 1/N, Markowitz and risk-parity baselines. The documented result is a NULL: across training seeds the agent does NOT reliably beat the best baseline net of costs — the OOS Sharpe is indistinguishable from the baselines after a Deflated-Sharpe correction and a Probability-of-Backtest-Overfitting check. The policy is trained offline and served via ONNX (no torch at request time); execution is simulated, not a live broker.",
}

export default function RlAllocatorPage() {
  return <RlAllocatorTool />
}

import type { Metadata } from "next"

import AlgoSystemTool from "./AlgoSystemTool"

export const metadata: Metadata = {
  title: "End-to-End Algo Trading System — fatihhekimoglu.com",
  description:
    "A complete, leakage-free single-asset algo trading pipeline — a strictly causal signal (MA-crossover / momentum), a purged walk-forward no-lookahead vectorized backtest, and a SIMULATED bar-by-bar paper-broker execution engine (next-bar-open fills + costs + slippage) — verified by a backtest-vs-live parity oracle (the equity curves match to the cent) and a bar-finality guard, then judged honestly with Diebold-Mariano vs buy-and-hold, a Deflated-Sharpe correction and a Probability-of-Backtest-Overfitting check. The documented result is a NULL: the strategy shows no robust out-of-sample edge after costs (system_has_edge=False). The whole stack is torch-free pure numpy/scipy/statsmodels; execution is simulated, not a live broker.",
}

export default function AlgoSystemPage() {
  return <AlgoSystemTool />
}

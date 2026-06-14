import type { Metadata } from "next"

import HrpPortfolioTool from "./HrpPortfolioTool"

export const metadata: Metadata = {
  title: "Hierarchical Risk Parity — fatihhekimoglu.com",
  description:
    "Lopez de Prado's HRP: clustering-based allocation benchmarked out-of-sample against Markowitz, IVP, and naive 1/N. Lower variance, not a free Sharpe lunch — the headline verdict is a pure function of the inference, so it cannot claim HRP beats 1/N while the bootstrap CI straddles zero.",
}

export default function HrpPortfolioPage() {
  return <HrpPortfolioTool />
}

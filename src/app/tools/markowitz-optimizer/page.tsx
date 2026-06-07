import type { Metadata } from "next"

import MarkowitzOptimizerTool from "./MarkowitzOptimizerTool"

export const metadata: Metadata = {
  title: "Markowitz Optimizer — fatihhekimoglu.com",
  description:
    "Mean-variance portfolio optimisation: efficient frontier, tangency weights, and shrinkage estimators.",
}

export default function MarkowitzOptimizerPage() {
  return <MarkowitzOptimizerTool />
}

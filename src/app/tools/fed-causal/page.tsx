import type { Metadata } from "next"

import FedCausalTool from "./FedCausalTool"

export const metadata: Metadata = {
  title: "Causal Inference on Fed Announcements — fatihhekimoglu.com",
  description:
    "Run a leakage-free event study of cumulative abnormal returns around FOMC announcements with an estimation-window-only market model, then stress the effect with placebo-date randomization, HAC/clustered standard errors, a multiple-testing correction and a rate-sensitivity difference-in-differences. The documented result is honest: the move is cross-sectional heterogeneity (rate-sensitive names move more, mechanically), not a placebo-robust tradable causal alpha.",
}

export default function FedCausalPage() {
  return <FedCausalTool />
}

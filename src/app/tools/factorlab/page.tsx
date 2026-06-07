import type { Metadata } from "next"

import FactorlabTool from "./FactorlabTool"

export const metadata: Metadata = {
  title: "Factorlab — fatihhekimoglu.com",
  description:
    "Fama-French factor regressions with HAC standard errors, rolling betas, and a plain-English interpretation.",
}

export default function FactorlabPage() {
  return <FactorlabTool />
}

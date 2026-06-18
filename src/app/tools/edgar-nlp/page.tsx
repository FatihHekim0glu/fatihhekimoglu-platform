import type { Metadata } from "next"

import EdgarNlpTool from "./EdgarNlpTool"

export const metadata: Metadata = {
  title: "10-K Filing NLP — fatihhekimoglu.com",
  description:
    "Pull a company's 10-K from SEC EDGAR, extract the MD&A and Risk-Factors sections, and score Loughran-McDonald tone + readability (Fog/Flesch-Kincaid/SMOG) — then honestly test whether tone predicts forward returns on a point-in-time S&P 500 panel. The purged tone-spread is indistinguishable from zero after a Deflated-Sharpe correction: a descriptive scorer, not alpha.",
}

export default function EdgarNlpPage() {
  return <EdgarNlpTool />
}

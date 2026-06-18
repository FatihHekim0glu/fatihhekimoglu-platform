import type { Metadata } from "next"

import FinbertSentimentTool from "./FinbertSentimentTool"

export const metadata: Metadata = {
  title: "FinBERT Sentiment Classifier — fatihhekimoglu.com",
  description:
    "3-way financial-sentence sentiment (negative/neutral/positive): a from-scratch DistilBERT fine-tune (ONNX-served) benchmarked honestly against class-prior and lexicon baselines on the Financial PhraseBank. Macro-F1 with bootstrap CIs — sentiment is a text label, not a tradable signal; no alpha is claimed.",
}

export default function FinbertSentimentPage() {
  return <FinbertSentimentTool />
}

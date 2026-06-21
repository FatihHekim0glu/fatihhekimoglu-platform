import type { Metadata } from "next"

import Rag10kTool from "./Rag10kTool"

export const metadata: Metadata = {
  title: "LLM Agent Reading 10-Ks (RAG) — fatihhekimoglu.com",
  description:
    "Ask a question about a company's 10-K and get a grounded, cited answer — retrieval over an ONNX-embedded index of the filing, an answer that must cite its sources and abstains when the document doesn't contain the answer, and a frozen 150-question eval harness measuring retrieval recall, citation-soundness and abstention. No hallucinated citations, no alpha claims — a rigorously-grounded IR pipeline.",
}

export default function Rag10kPage() {
  return <Rag10kTool />
}

import type { Metadata } from "next"

import WsbSentimentSignalTool from "./WsbSentimentSignalTool"

export const metadata: Metadata = {
  title: "WSB Sentiment Signal — fatihhekimoglu.com",
  description:
    "Turn r/wallstreetbets chatter into a daily per-ticker sentiment signal and honestly test whether it predicts next-day returns on a point-in-time S&P 500 universe — with Deflated Sharpe, PBO/CSCV and HAC. The in-sample edge largely decays out-of-sample after costs: mild correlation, attention feedback, not alpha.",
}

export default function WsbSentimentSignalPage() {
  return <WsbSentimentSignalTool />
}

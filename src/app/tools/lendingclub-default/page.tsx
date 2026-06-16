import type { Metadata } from "next"

import LendingClubDefaultTool from "./LendingClubDefaultTool"

export const metadata: Metadata = {
  title: "LendingClub Default Classifier — fatihhekimoglu.com",
  description:
    "Score a loan application's probability of default at origination with a leakage-free, calibrated XGBoost model. Honest AUC / PR-AUC / Brier headline, a calibrated risk decile, and reason codes — it ranks risk, it does not predict individuals. The shipped demo model is trained on synthetic LC-schema data.",
}

export default function LendingClubDefaultPage() {
  return <LendingClubDefaultTool />
}

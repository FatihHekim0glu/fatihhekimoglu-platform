import type { Metadata } from "next"

import AnomalyDetectorTool from "./AnomalyDetectorTool"

export const metadata: Metadata = {
  title: "Market Anomaly Detector — fatihhekimoglu.com",
  description:
    "Flag anomalous trading days in liquid ETFs with two independent unsupervised detectors (Isolation Forest + a PCA reconstruction-error autoencoder) under a strictly causal walk-forward refit. They agree on a core of known stress dates, but the flags are diagnostic, not tradable — there is no ground-truth anomaly label.",
}

export default function AnomalyDetectorPage() {
  return <AnomalyDetectorTool />
}

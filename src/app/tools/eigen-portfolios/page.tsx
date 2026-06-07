import type { Metadata } from "next"

import EigenPortfoliosTool from "./EigenPortfoliosTool"

export const metadata: Metadata = {
  title: "Eigen Portfolios (PCA) - fatihhekimoglu.com",
  description:
    "PCA on S&P 500 returns. Marchenko-Pastur random-matrix theory separates the market and sector factors from the noise floor.",
}

export default function EigenPortfoliosPage() {
  return <EigenPortfoliosTool />
}

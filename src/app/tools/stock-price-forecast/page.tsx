import type { Metadata } from "next"

import StockPriceForecastTool from "./StockPriceForecastTool"

export const metadata: Metadata = {
  title: "Stock Price Forecast — fatihhekimoglu.com",
  description:
    "Next-N-day closing price forecast for a single ticker, from a pretrained LSTM+Attention model on 14 technical features.",
}

export default function StockPriceForecastPage() {
  return <StockPriceForecastTool />
}

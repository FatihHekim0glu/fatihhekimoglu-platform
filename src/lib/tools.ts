/** Lifecycle stage of a tool listed on the platform. */
export type ToolStatus = 'live' | 'soon' | 'archived';

/** Public-facing description of one tool surface (one URL slug). */
export type Tool = {
  /** URL slug, lowercase kebab-case. */
  slug: string;
  /** Display title shown on cards and detail pages. */
  title: string;
  /** One-line marketing blurb. */
  blurb: string;
  /** Whether the tool is reachable today. */
  status: ToolStatus;
  /** Optional taxonomy tags for filtering. */
  tags?: string[];
};

/** Canonical registry of every tool surface exposed by the platform. */
export const TOOLS: Tool[] = [
  {
    slug: 'stock-dashboard',
    title: 'Stock Dashboard',
    blurb:
      'Hand-rolled technical indicators, verified against TA-Lib. Single-ticker dashboard with SMA/EMA/Bollinger/RSI/MACD.',
    status: 'live',
    tags: ['technical-analysis', 'pandas'],
  },
  {
    slug: 'ma-crossover-backtest',
    title: 'MA Crossover Backtest',
    blurb:
      'Long/flat SMA crossover backtester with buy-and-hold benchmark, Newey-West HAC alpha, and Memmel-corrected Sharpe difference test.',
    status: 'live',
    tags: ['backtest', 'equities', 'statistics'],
  },
  {
    slug: 'markowitz-optimizer',
    title: 'Markowitz Optimizer',
    blurb:
      'Mean-variance efficient frontier + tangency portfolio with Ledoit-Wolf shrinkage and Jorion-Bayes-Stein mean. Long-only / max-weight box constraints.',
    status: 'live',
    tags: ['portfolio', 'optimization', 'mean-variance'],
  },
  {
    slug: 'pairs-trading',
    title: 'Pairs Trading',
    blurb:
      'Cointegration scan over a curated universe of US equity pairs with Engle-Granger p-values, FDR correction, and OU half-life diagnostics.',
    status: 'live',
    tags: ['quant', 'stat-arb', 'cointegration', 'equities'],
  },
  {
    slug: 'eigen-portfolios',
    title: 'Eigen Portfolios (PCA)',
    blurb:
      'PCA on S&P 500 returns to extract market + sector factors. Marchenko-Pastur RMT separates signal from noise.',
    status: 'live',
    tags: ['pca', 'random-matrix-theory', 'survivorship-bias-free'],
  },
  {
    slug: 'factorlab',
    title: 'Factorlab',
    blurb:
      'Fama-French factor regressions with HAC standard errors, rolling betas, and a plain-English interpretation.',
    status: 'live',
    tags: ['finance', 'factor-models', 'fama-french', 'regression', 'quant'],
  },
  {
    slug: 'stock-price-forecast',
    title: 'Stock Price Forecast',
    blurb:
      'Next-N-day closing price forecast for a single ticker from a pretrained LSTM+Attention model on 14 technical features (RSI, MACD, Bollinger, MAs, lags).',
    status: 'live',
    tags: ['forecasting', 'deep-learning', 'lstm'],
  },
];

/** Look up a tool by its URL slug. Returns undefined when unknown. */
export function getTool(slug: string): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

export type ResearchProject = { slug: string; title: string; blurb: string; repoUrl: string; tags: string[] };
export const RESEARCH: ResearchProject[] = [
  { slug: "hrp-portfolio", title: "Hierarchical Risk Parity", blurb: "A from-scratch implementation of Lopez de Prado's Hierarchical Risk Parity, benchmarked out of sample against Markowitz, inverse-variance and naive 1/N on real data.", repoUrl: "https://github.com/FatihHekim0glu/hrp-portfolio", tags: ["portfolio", "allocation", "clustering"] },
  { slug: "regime-hmm", title: "Market Regime HMM", blurb: "A from-scratch Gaussian hidden Markov model for market regimes, validated against hmmlearn. Regimes describe the data well, but the timing overlay does not beat buy and hold after costs.", repoUrl: "https://github.com/FatihHekim0glu/regime-hmm", tags: ["hmm", "regimes", "time-series"] },
  { slug: "volforecast", title: "Volatility Forecasting", blurb: "GARCH-family models against machine learning for realised-volatility forecasting, scored with QLIKE, Diebold-Mariano and the Hansen SPA test. GARCH is hard to beat.", repoUrl: "https://github.com/FatihHekim0glu/volforecast", tags: ["volatility", "garch", "forecasting"] },
  { slug: "lstm-forecast", title: "LSTM Return Forecast", blurb: "A leakage-free LSTM that predicts next-day returns under a purged walk-forward. A documented null result: it does not beat a random-walk baseline out of sample.", repoUrl: "https://github.com/FatihHekim0glu/lstm-forecast", tags: ["deep-learning", "lstm", "returns"] },
  { slug: "nn-vs-bs", title: "Neural Net vs Black-Scholes", blurb: "A closed-form Black-Scholes price compared with a compact ONNX network. On synthetic Black-Scholes data the network only recovers the known surface, so no tradable edge is claimed.", repoUrl: "https://github.com/FatihHekim0glu/nn-vs-bs", tags: ["options", "onnx", "black-scholes"] },
  { slug: "wsb-sentiment", title: "WSB Sentiment Signal", blurb: "A daily per-ticker sentiment signal from r/wallstreetbets, tested on a point-in-time S&P 500 universe with purged walk-forward. The in-sample edge largely decays out of sample after costs.", repoUrl: "https://github.com/FatihHekim0glu/wsb-sentiment", tags: ["nlp", "sentiment", "equities"] },
  { slug: "crypto-arb-scanner", title: "Crypto Arbitrage Scanner", blurb: "A cross-exchange and triangular crypto arbitrage scanner that accounts for fees, order-book depth and transfer costs. The net executable edge collapses to near zero after costs.", repoUrl: "https://github.com/FatihHekim0glu/crypto-arb-scanner", tags: ["crypto", "arbitrage", "microstructure"] },
  { slug: "anomaly-detector", title: "Market Anomaly Detector", blurb: "Unsupervised anomaly detection on liquid ETFs using an isolation forest and a PCA reconstruction detector under a causal walk-forward. Flags are diagnostic, not tradable.", repoUrl: "https://github.com/FatihHekim0glu/anomaly-detector", tags: ["anomaly-detection", "etf", "unsupervised"] },
  { slug: "stock-clusters", title: "Stock Return Clusters", blurb: "Return-correlation clustering with random-matrix denoising and Mantegna distance. The clusters rediscover sector structure, but cluster-aware allocation does not beat naive 1/N.", repoUrl: "https://github.com/FatihHekim0glu/stock-clusters", tags: ["clustering", "correlation", "rmt"] },
  { slug: "lendingclub-default", title: "Loan Default Model", blurb: "A leakage-free, calibrated gradient-boosted model for loan-default probability at origination. It ranks risk and reports calibration rather than predicting individuals.", repoUrl: "https://github.com/FatihHekim0glu/lendingclub-default", tags: ["credit-risk", "classification", "calibration"] },
  { slug: "risk-metrics", title: "Risk Metrics", blurb: "A small library of risk and performance statistics for return series, parity-tested against reference implementations.", repoUrl: "https://github.com/FatihHekim0glu/risk-metrics", tags: ["risk", "performance", "statistics"] },
];

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
  {
    slug: 'hrp-portfolio',
    title: 'Hierarchical Risk Parity',
    blurb:
      "Lopez de Prado's HRP — clustering-based allocation — benchmarked honestly OOS vs Markowitz, IVP, and naive 1/N. Lower variance, not a free Sharpe lunch.",
    status: 'live',
    tags: ['portfolio', 'risk', 'clustering'],
  },
  {
    slug: 'stock-clusters',
    title: 'Stock Diversification Clusters',
    blurb:
      "Cluster the S&P 500 by correlation structure (RMT-denoised, Mantegna distance) to map its diversification skeleton — and honestly test whether cluster-aware allocation beats naive 1/N after costs (it usually doesn't).",
    status: 'live',
    tags: ['clustering', 'diversification', 'correlation'],
  },
  {
    slug: 'lendingclub-default',
    title: 'LendingClub Default Classifier',
    blurb:
      "Score a loan application's probability of default at origination with a leakage-free, calibrated XGBoost model — honest AUC/PR-AUC, calibrated risk decile, and reason codes (no profit claims, ranks risk rather than predicting individuals).",
    status: 'live',
    tags: ['credit', 'classification', 'calibration'],
  },
  {
    slug: 'crypto-arb-scanner',
    title: 'Crypto Arbitrage Scanner',
    blurb:
      "Decompose cross-exchange and triangular crypto spreads into a fee-, depth-, and transfer-cost-aware gross->net waterfall — the raw spread looks profitable, but the net executable edge on liquid pairs collapses to ~0 after costs (latency arb is an HFT game, not a REST one).",
    status: 'live',
    tags: ['crypto', 'arbitrage', 'market-microstructure'],
  },
  {
    slug: 'regime-hmm',
    title: 'Market Regime HMM',
    blurb:
      "Fit a Gaussian Hidden Markov Model to index returns to label market regimes (low-vol bull / high-vol bear / crisis) — then honestly test whether a regime-timing overlay beats buy-and-hold out-of-sample after costs (spoiler: characterization is the win, timing is not).",
    status: 'live',
    tags: ['regimes', 'macro', 'hmm'],
  },
  {
    slug: 'anomaly-detector',
    title: 'Market Anomaly Detector',
    blurb:
      "Flag anomalous trading days in liquid ETFs with two independent unsupervised detectors (Isolation Forest + a PCA reconstruction-error autoencoder) under a strictly causal walk-forward refit — they agree on a core of known stress dates, but the flags are diagnostic, not tradable.",
    status: 'live',
    tags: ['anomaly-detection', 'unsupervised', 'market-stress'],
  },
  {
    slug: 'lstm-forecast',
    title: 'LSTM Stock Forecast (Done Properly)',
    blurb:
      'A leakage-free rebuild of the classic LSTM stock-price-prediction project: predict next-day RETURNS (not price levels), validate with purged walk-forward, and honestly test against a random-walk baseline — the documented result is that the LSTM does NOT beat naive persistence.',
    status: 'live',
    tags: ['deep-learning', 'time-series', 'honest-null'],
  },
  {
    slug: 'volforecast',
    title: 'GARCH vs ML Volatility Forecast',
    blurb:
      "Forecast realized volatility of a stock index and honestly test whether XGBoost or an LSTM beats a well-specified GARCH(1,1)/HAR-RV out-of-sample (QLIKE + Diebold-Mariano + Hansen SPA) — spoiler from Hansen & Lunde 2005: GARCH is hard to beat.",
    status: 'live',
    tags: ['volatility', 'garch', 'forecasting'],
  },
  {
    slug: 'wsb-sentiment-signal',
    title: 'WSB Sentiment Signal',
    blurb:
      'Turn r/wallstreetbets chatter into a daily per-ticker sentiment signal and honestly test whether it predicts next-day returns on a point-in-time S&P 500 universe — with Deflated Sharpe, PBO/CSCV and HAC. Spoiler: the in-sample edge largely decays out-of-sample after costs.',
    status: 'live',
    tags: ['nlp', 'sentiment', 'alternative-data'],
  },
];

/** Look up a tool by its URL slug. Returns undefined when unknown. */
export function getTool(slug: string): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

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
  {
    slug: 'finbert-sentiment',
    title: 'FinBERT Sentiment Classifier',
    blurb:
      '3-way financial-sentence sentiment (negative/neutral/positive) — a from-scratch DistilBERT fine-tune (ONNX-served) benchmarked honestly against class-prior and lexicon baselines on the Financial PhraseBank. Macro-F1 with bootstrap CIs; sentiment is a text label, not a tradable signal.',
    status: 'live',
    tags: ['nlp', 'transformers', 'sentiment'],
  },
  {
    slug: 'nn-vs-bs',
    title: 'Options: NN vs Black-Scholes',
    blurb:
      "Price European options two ways — a from-scratch Black-Scholes closed form vs a small neural net — and compare them honestly. On synthetic BS data the NN can only RECOVER the BS surface (a sanity check, not an edge); on real chains, constant-vol BS misprices the smile. Reprice error only — no tradable P&L is claimed.",
    status: 'live',
    tags: ['options', 'black-scholes', 'neural-net'],
  },
  {
    slug: 'edgar-nlp',
    title: '10-K Filing NLP',
    blurb:
      "Pull a company's 10-K from SEC EDGAR, extract the MD&A and Risk-Factors sections, and score Loughran-McDonald tone + readability (Fog/Flesch-Kincaid/SMOG) — then honestly test whether tone predicts forward returns on a point-in-time S&P 500 panel. Spoiler: the purged tone-spread is indistinguishable from zero after a Deflated-Sharpe correction.",
    status: 'live',
    tags: ['nlp', 'edgar', 'sentiment', 'readability'],
  },
  {
    slug: 'mvts-forecast',
    title: 'Multivariate Transformer Forecast',
    blurb:
      "Benchmark PatchTST and an interpretable transformer against LSTM, ARIMA and a naive random-walk baseline on a multivariate financial time series, with leakage-safe RevIN + purged walk-forward and Deflated-Sharpe / Diebold-Mariano honesty. Spoiler: on noisy daily returns the deep models don't reliably beat naive.",
    status: 'live',
    tags: ['deep-learning', 'transformers', 'time-series', 'honest-null'],
  },
  {
    slug: 'gnn-stocks',
    title: 'Graph Neural Network on Stocks',
    blurb:
      "Build a point-in-time stock-relationship graph from rolling return correlations and run a Graph Convolutional / GraphSAGE network against per-node ridge and cross-sectional-momentum baselines for next-period return ranking — with leakage-safe per-fold graphs, a purged walk-forward and Deflated-Sharpe / Diebold-Mariano honesty. Spoiler: message-passing recovers sector structure but doesn't reliably beat the baselines out-of-sample.",
    status: 'live',
    tags: ['graph-neural-network', 'deep-learning', 'cross-section', 'honest-null'],
  },
  {
    slug: 'fed-causal',
    title: 'Causal Inference on Fed Announcements',
    blurb:
      "Run an event study of cumulative abnormal returns around FOMC announcements with an estimation-window-only market model, then stress the effect with placebo-date randomization, HAC/clustered standard errors, a multiple-testing correction and a rate-sensitivity difference-in-differences. Spoiler: the move is cross-sectional heterogeneity, not a tradable causal alpha.",
    status: 'live',
    tags: ['causal-inference', 'event-study', 'econometrics', 'honest-null'],
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
  { slug: "mvts-forecast", title: "Multivariate Transformer Forecast", blurb: "PatchTST and an interpretable transformer benchmarked against LSTM, ARIMA and a naive random walk on a multivariate panel, with leakage-safe RevIN, a purged walk-forward and Deflated-Sharpe / Diebold-Mariano honesty. A documented null: on noisy daily returns the deep models do not reliably beat naive.", repoUrl: "https://github.com/FatihHekim0glu/mvts-forecast", tags: ["deep-learning", "transformers", "time-series"] },
  { slug: "gnn-stocks", title: "Graph Neural Network on Stocks", blurb: "A dense-adjacency GCN and GraphSAGE over a point-in-time stock-relationship graph, benchmarked against per-node ridge and cross-sectional-momentum baselines for next-period return ranking, with leakage-safe per-fold graphs, a purged walk-forward and Deflated-Sharpe / Diebold-Mariano honesty. A documented null: message-passing recovers sector structure but does not reliably beat the baselines out of sample.", repoUrl: "https://github.com/FatihHekim0glu/gnn-stocks", tags: ["graph-neural-network", "deep-learning", "cross-section"] },
  { slug: "fed-causal", title: "Causal Inference on Fed Announcements", blurb: "A leakage-free event study of cumulative abnormal returns around FOMC announcements with an estimation-window-only market model, stressed with placebo-date randomization, HAC/clustered standard errors, a multiple-testing correction and a rate-sensitivity difference-in-differences. A documented null: the move is honest cross-sectional heterogeneity (rate-sensitive names move more), not a placebo-robust tradable alpha.", repoUrl: "https://github.com/FatihHekim0glu/fed-causal", tags: ["causal-inference", "event-study", "econometrics"] },
];

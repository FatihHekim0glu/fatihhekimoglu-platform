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
];

/** Look up a tool by its URL slug. Returns undefined when unknown. */
export function getTool(slug: string): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

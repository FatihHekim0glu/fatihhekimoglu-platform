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
      'Walk-forward MA crossover backtester with DSR and HAC-alpha. Coming soon.',
    status: 'soon',
    tags: ['backtest', 'walk-forward'],
  },
  {
    slug: 'markowitz-optimizer',
    title: 'Markowitz Optimizer',
    blurb:
      'Mean-variance + Black-Litterman + Ledoit-Wolf shrinkage. 562 tests, He-Litterman 1999 reproduced.',
    status: 'soon',
    tags: ['portfolio', 'optimization'],
  },
];

/** Look up a tool by its URL slug. Returns undefined when unknown. */
export function getTool(slug: string): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

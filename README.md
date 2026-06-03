# fatihhekimoglu-platform

Personal portfolio + quantitative-tools platform at [fatihhekimoglu.com](https://fatihhekimoglu.com). Next.js 16 + Supabase + Tailwind 4, talking to a separate FastAPI compute backend.

## Stack

- **Next.js 16** (App Router, React 19, Turbopack)
- **Tailwind 4** + **shadcn/ui** (new-york style, slate base color)
- **Supabase** (auth + Postgres) — same project as tayf, separate `platform` schema
- **Plotly** (`react-plotly.js`, lazy-loaded client side)
- **TypeScript strict**, `zod`-validated env

## Architecture

Each tool is a route under `src/app/tools/[slug]/`. The TOOLS registry in `src/lib/tools.ts` drives the homepage grid and dynamic route lookup. Heavy compute (yfinance fetches, indicator math, walk-forward backtests) lives in the FastAPI backend at [`fatihhekimoglu-api`](https://github.com/FatihHekim0glu/fatihhekimoglu-api), called from server components via the typed wrapper in `src/lib/api.ts`. Charts come back as Plotly figure JSON; the React side renders them directly — never images.

## Tools

| Slug | Status | Description |
|---|---|---|
| `stock-dashboard` | **live** | Hand-rolled technical indicators (SMA, EMA, Bollinger, RSI, MACD), verified against TA-Lib |
| `ma-crossover-backtest` | soon | Walk-forward MA crossover backtester (DSR, HAC-alpha) |
| `markowitz-optimizer` | soon | Mean-variance + Black-Litterman + Ledoit-Wolf (562 tests, He-Litterman 1999 reproduced) |

## Local development

```bash
pnpm install
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_ANON_KEY (from Supabase project settings)
# Start the backend separately:
#   cd ../fatihhekimoglu-api && uv run uvicorn api.main:app --port 8080
pnpm dev
```

The dev server listens on port 3000; the backend on port 8080. CORS on the backend is preconfigured for `http://localhost:3000` and `https://fatihhekimoglu.com`.

## Deployment

- **Production**: Vercel, `fatihhekimoglu.com`.
- **Preview branches**: `<branch>-fatihhekimoglu-platform.vercel.app`.

```bash
pnpm build
pnpm start
```

## License

MIT.

# Spec 02 — card.svg / heatmap.svg  →  NOT NEEDED (dropped)

**Status: dropped.** We will build our own card + equity curve + heatmap as
native UI from the structured data (see `data-contracts.md`):

- Stats card ← `fork.json` `backtest{}` (all metrics precomputed).
- Equity curve + drawdown + trade markers ← public R2 blob `equity[]` / `trades[]`.
- Pine code view ← `fork.json` `pineSource`.

This looks nicer (interactive, themed to TradingKit) and removes a trader-dev
build. No action needed from the trader-dev dev for cards/curves.

The only remaining backend ask for richer visuals is **OHLC candles** for a
price-chart canvas — see `01-backtest-result-api.md` part B.

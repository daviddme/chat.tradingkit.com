# Trader.dev backend specs for TradingKit chat

These are requests **for the Trader.dev developer**, to support the TradingKit
AI chat (a TradingView-style interface built on LibreChat at chat.tradingkit.com).
Each file is a self-contained spec. Priority order:

1. [`01-backtest-result-api.md`](01-backtest-result-api.md) — a stable, structured
   backtest result + OHLC candles + trade markers, so the chat can render a
   TradingView-style **canvas** (price chart with entries/exits) and a **bottom
   equity panel**. **Highest priority** — unblocks the core visual.
2. [`02-svg-cards.md`](02-svg-cards.md) — `card.svg` + `heatmap.svg` public image
   endpoints (already in the original LibreChat.md spec, still 404). Lets results
   render inline as images.
3. [`03-market-data-feed.md`](03-market-data-feed.md) — a market snapshot / watchlist
   feed for the right-hand market rail.
4. [`04-user-provisioning.md`](04-user-provisioning.md) — per-user accounts + `pk_`
   key minting (the current `create_api_key` is broken), so each chat user can
   eventually map to their own Trader.dev account + credits instead of the shared
   admin key.
5. [`05-rebacktest.md`](05-rebacktest.md) — the contract behind the "Re-backtest"
   button.

## Current integration (context for the dev)

- The chat talks to the Trader.dev MCP at `https://mcp.trader.dev/sse` over SSE.
- Today it connects **globally with one admin key** (`tdsk_admin_…`), so all
  chat users share the admin Trader.dev account. Per-user accounts come later
  (see spec 04).
- Public result blobs at
  `https://pub-5880a55c41fd4cd1a11146f4fd522fbe.r2.dev/backtests/<id>.json.gz`
  are already consumed client-side.
- Verified working MCP tools: `whoami`, `quick_backtest`, `run_backtest`,
  `get_backtest_result`, `get_trades`, `get_equity_curve`, `get_credits`,
  optimisation tools, etc.

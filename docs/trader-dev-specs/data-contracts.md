# Backtest data contracts (what the custom UI renders from)

We build our **own** equity curve + stats card + trade table + code view. No SVG
image endpoints needed. Two sources per `resultId`:

## 1. fork.json  (auth: `Authorization: Bearer <key>` required, 401 without)

`GET https://mcp-api.trader.dev/backtest/<resultId>/fork.json`

```jsonc
{
  "strategy": { "id", "name", "symbol", "timeframe", "version", "forkedFromStrategyId" },
  "backtest": {
    "resultId", "fromTs", "toTs", "barsEvaluated", "initialCapital",
    "netProfit", "netProfitPct", "profitFactor", "maxDrawdownPct", "winRatePct",
    "totalTrades", "winningTrades", "losingTrades",
    "sharpeRatio", "sortinoRatio", "avgTradePct", "avgWinningTrade", "avgLosingTrade",
    "largestWin", "largestLoss", "commissionPaid", "createdAt", "viewUrl"
  },
  "pineSource": "…full Pine v5 source…"
}
```
Use for: the **stats card** (all metrics precomputed) and the **code view**
(`pineSource`). Because it needs the key, fetch it **server-side** (LibreChat
proxies with the admin key) or via the agent — not from the browser.

## 2. Public R2 blob  (no auth)

`GET https://pub-5880a55c41fd4cd1a11146f4fd522fbe.r2.dev/backtests/<resultId>.json.gz`
(browser auto-gunzips; `fetch().then(r=>r.json())`)

```jsonc
{
  "equity": [ { "barIndex", "barTime", "equity", "drawdown", "netProfit" } ],   // ~2000 pts
  "trades": [ {
     "seq", "direction", "qty",
     "entryBar", "entryTime", "entryPrice",
     "exitBar",  "exitTime",  "exitPrice",
     "barsInTrade", "profit", "grossProfit", "commission", "profitPct",
     "cumProfit", "runup", "drawdown", "isOpen"
  } ],
  "meta": { "resultId", "writtenAt", "equityPointsRaw" }
}
```
Use for: the **equity curve** + drawdown underlay, the **trade markers**
(entry/exit by `*Time` epoch ms + `*Price`), and the **trade table**. Fully
client-side (public).

## Remaining gap (only for a price-candle canvas)

R2 has equity, not OHLC price candles. A TradingView-style *price* chart with
entry/exit markers needs candles. v1 of the canvas can render the **equity
curve** with trade markers (no candles needed). The price-candle layer waits on
trader-dev exposing OHLC (see `01-backtest-result-api.md` part B).

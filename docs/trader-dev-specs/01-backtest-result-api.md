# Spec 01 — Structured backtest result + candles + trade markers

**Why:** the TradingKit chat renders each backtest like TradingView — a price
**canvas** (candles with entry/exit markers) and a **bottom equity-curve panel**.
The public R2 blob already has `equity[]` and `trades[]`, but the UI also needs
(a) summary stats in one place, (b) OHLC candles for the tested window, and
(c) trade markers keyed to candle timestamps. Goal: one stable JSON contract the
front-end can depend on.

## A. Result summary (extend what `quick_backtest` / `get_backtest_result` return)

Confirm these fields are always present on a result object (names as used today
where possible):

```jsonc
{
  "id": "01J...ULID",            // bare resultId
  "strategyId": "…",
  "displaySymbol": "BTCUSDT.P",
  "exchange": "BYBIT",
  "timeframe": "1h",
  "from": "2024-01-01T00:00:00Z", // tested window
  "to":   "2025-01-01T00:00:00Z",
  "netProfitPct": 41.2,
  "winRatePct": 56.0,
  "profitFactor": 1.8,
  "sharpeRatio": 1.3,
  "maxDrawdownPct": 6.4,
  "totalTrades": 84,
  "initialCapital": 10000,
  "warnings": [],
  "r2Url": "https://pub-…r2.dev/backtests/<id>.json.gz" // canonical blob url
}
```

## B. OHLC candles for the tested window  ⟵ NEW (key request)

So the canvas can draw the actual price chart the strategy traded on.

`GET /backtest-results/:id/candles`  → `application/json` (gzip ok)

```jsonc
{
  "symbol": "BTCUSDT.P", "timeframe": "1h",
  "candles": [
    { "t": 1704067200000, "o": 42100.5, "h": 42350.0, "l": 41980.0, "c": 42200.0, "v": 1234.5 }
  ]
}
```

- `t` = bar open time, ms epoch (so it aligns with `equity[].barTime` and trade
  times). Downsample server-side if a window exceeds ~5k candles, or support
  `?maxPoints=`.
- Alternative if cheaper: a generic `GET /candles?symbol=&timeframe=&from=&to=`
  the UI can call directly (also useful for the market rail, spec 03).

## C. Trade markers keyed to candle time

The current `trades[]` has `entryPrice/exitPrice/profit/direction`. Add bar
timestamps so markers land on the candle chart:

```jsonc
{
  "seq": 1, "direction": "long",
  "entryTime": 1704070800000, "entryPrice": 42200.0,
  "exitTime":  1704096000000, "exitPrice":  43010.0,
  "profit": 810.0, "profitPct": 1.9
}
```

If `entryTime/exitTime` already exist under other names, just document them.

## Acceptance

- `GET /backtest-results/:id/candles` returns candles covering the same window as
  `equity[]`, same `t` epoch basis.
- Trades expose `entryTime`/`exitTime` in the same epoch basis.
- Summary stats above are present on the result. No auth beyond the existing
  per-result access (these can mirror the public R2 access model, or require the
  caller's key — please state which).

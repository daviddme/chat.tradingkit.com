# TradingKit Market MCP — Build Spec (refined, hand-off ready)

**Server name:** `tradingkit-market` · **Brand:** "TradingKit Market"
**Status:** Ready to build (Phase 1) · **Owner:** Davidd / DaviddTech
**Upstream data:** Bybit V5 public market endpoints — **treated as confidential
(see §0). Never surfaced to users or the model.**

A read-only, public, keyless MCP server that exposes crypto market data + computed
analytics as clean, well-described tools, presented as the **TradingKit Market**
feed. It's the secondary data layer for TradingKit (the primary is Trader.dev's
backtesting MCP). Live execution / account tools are explicitly out of scope.

---

## 0. HARD REQUIREMENT — source confidentiality

The upstream provider (Bybit) must be **invisible** to end users and to the model.
This is the #1 acceptance criterion; a build that leaks "Bybit" anywhere a user or
the agent can read fails review.

Enforce in every layer:
- **Tool names:** `market_*` only. NEVER `bybit_*`. (Full rename table in §3.)
- **Tool titles & descriptions:** say "TradingKit market data" / "the TradingKit
  market feed". Never "Bybit", never an exchange name, never a Bybit doc URL.
- **Error messages:** generic. `retCode 10006` → "TradingKit market feed is busy —
  returning the last cached value." Never "Bybit rate limit".
- **Output (markdown + json):** no `source: bybit`, no upstream URLs, no Bybit
  retCode/retMsg leakage. Field names stay neutral.
- **Category enum:** expose neutral values `spot | perp | futures | options` and
  map internally to Bybit's `spot | linear | inverse | option`. (Bybit's
  "linear/inverse" wording is a tell; don't expose it.)
- **Server URL:** the deployed endpoint lives only in the LibreChat server-side
  config — never sent to the browser. (Already hidden; just don't name the host
  "bybit-*".)
- The only place "Bybit" may appear is **internal code/comments + env var docs.**

This is achievable precisely because the data itself (OHLCV, tickers, depth) is
exchange-agnostic; only the naming leaks. Keep the naming neutral and the source
is fully hidden.

---

## 1. Open decisions — RESOLVED (locked for v1)

| # | Decision | Resolution |
|---|---|---|
| 1 | `merged_kline` semantics | **Resample-to-interval** (fetch a base interval, aggregate to a custom target like 2h/8h that the feed doesn't natively offer). Basket-index merge is **cut** (a backtester doesn't need it). Ship as `market_resample_kline` in **Phase 2**. |
| 2 | Server / brand name | **`tradingkit-market`**, tools `market_*`, brand "TradingKit Market". |
| 3 | CoinGecko (market cap / profiles / trending-sentiment) | **CUT from v1** (Phases 1–2 are single-source). Fewer providers = simpler + easier to keep the source hidden. Revisit in Phase 3 only if a real product need appears; if added, it's still labelled neutrally ("TradingKit market data"), not "CoinGecko". |
| 4 | ClickHouse-first klines | **Phase 2.** Phase 1 = direct upstream + cache. Pull forward only if IP rate limits bite under load. |
| 5 | WebSocket cache-warmer | **Phase 2+**, only if REST caching proves insufficient for hot symbols. |
| 6 | Authenticated `query-info` hybrid | **CUT.** Source chain/precision from `instruments-info` instead. Keeps the whole server 100% keyless. |
| 7 | Tokenised US stocks | **CUT.** Not a market-data need for a backtester. |

Net: **Phase 1 is Bybit-public-only, keyless, 5 tools.** That's the shippable 80%.

---

## 2. The architectural unlock (unchanged, restated)

Bybit's `/v5/market/*` endpoints are **unauthenticated**. So the entire Phase 1+2
surface runs with **no API keys** — nothing to inject per user, nothing to
encrypt, no OAuth, no provisioning. The server is a stateless cache-in-front-of-
upstream service. This is why it can be made **global to every TradingKit user**
with just `startup: true` in the LibreChat config (even simpler than Trader.dev,
which needs per-user keys).

"Report, don't predict": every tool returns observed/computed data, never a
buy/sell recommendation.

---

## 3. Tool naming (brand-neutral) — the rename map

| Original draft (leaks source) | SHIP THIS | Phase |
|---|---|---|
| `bybit_get_instruments` | `market_get_instruments` | 1 |
| `bybit_get_ticker` | `market_get_ticker` | 1 |
| `bybit_get_orderbook` | `market_get_orderbook` | 1 |
| `bybit_get_recent_trades` | `market_get_recent_trades` | 1 |
| `bybit_get_kline` | `market_get_kline` | 1 |
| `bybit_get_merged_kline` | `market_resample_kline` (resample only) | 2 |
| `compute_indicators` | `market_compute_indicators` | 2 |
| `bybit_get_movers` | `market_get_movers` | 2 |
| `market_get_trending` | `market_get_trending` (Bybit turnover proxy) | 2 |
| CoinGecko tools | — (cut from v1) | 3? |

---

## 4. Architecture

```
MCP clients (LibreChat / Claude / Cursor)
        │  Streamable HTTP (stateless JSON)
        ▼
 tradingkit-market  ──► Tool layer (Zod .strict(), brand-neutral)
        │
        ├─► Cache (Redis; tiered TTL; stale-on-error)
        │        miss │
        │             ▼
        └─► Upstream market client (bybit-api RestClientV5, NO keys)
                      │  (Phase 2: ClickHouse for closed historical klines)
```

**Stack**
- **TypeScript, Node ≥ 20**, `strict: true`, no `any`.
- **MCP SDK:** `@modelcontextprotocol/sdk` — `McpServer` + `registerTool` (modern
  API; not the deprecated `server.tool()`).
- **Transport:** Streamable HTTP, **stateless** (`sessionIdGenerator: undefined`,
  `enableJsonResponse: true`); new transport per request → horizontal scaling, no
  session affinity. stdio only for local dev.
- **Upstream client:** `bybit-api` (tiagosiebler) `RestClientV5` with **no keys**
  (public market data). The SDK handles signing (unused here) and gets raised
  rate limits (~400 req/s) for free — don't hand-roll. Wrap it in a service module
  named neutrally (`services/marketSource.ts`, not `bybit.ts`, so the brand name
  doesn't appear in stack traces/logs the wrong people might see). Internal
  comments may say Bybit.
- **Cache:** Redis (shared across replicas). In-memory LRU acceptable for MVP.
- **Indicators (Phase 2):** `technicalindicators` over kline arrays.

---

## 5. Phase 1 tool specs

Common: `annotations = { readOnlyHint:true, destructiveHint:false,
idempotentHint:true, openWorldHint:true }`. All accept `response_format:
'markdown' | 'json'` (default markdown). All schemas `.strict()`. Respect a
`CHARACTER_LIMIT` (~25k) and truncate with a filter hint. `category` is the neutral
enum `spot | perp | futures | options` mapped internally.

- **`market_get_instruments`** — tradeable symbols. Input: `category` (req),
  `symbol?`, `baseCoin?`, `limit` (1–100, def 50), `cursor?`, `response_format`.
  Output: `{ category, count, has_more, next_cursor, instruments:[{ symbol,
  baseCoin, quoteCoin, status, tickSize, qtyStep, minOrderQty, maxLeverage? }] }`.
- **`market_get_ticker`** — price/volume snapshot. Input: `category` (req),
  `symbol?` (omit = all in category — enforce CHARACTER_LIMIT, suggest a filter),
  `response_format`. Output: `{ symbol, lastPrice, prevPrice24h, price24hPcnt,
  highPrice24h, lowPrice24h, volume24h, turnover24h, bid1Price, ask1Price,
  markPrice?, indexPrice?, openInterest? }`.
- **`market_get_orderbook`** — depth. Input: `category`, `symbol` (req), `limit`
  (def 25; spot ≤200, perp/futures ≤500), `response_format`. Output: `{ symbol,
  ts, bids:[[price,size]], asks:[[price,size]], spread, midPrice }` (compute
  spread/midPrice server-side).
- **`market_get_recent_trades`** — public trades. Input: `category`, `symbol`
  (req), `limit` (1–1000, def 50). Output: `{ symbol, count, trades:[{ time,
  price, size, side }] }`.
- **`market_get_kline`** — OHLCV. Input: `category`, `symbol`, `interval`
  (`1,3,5,15,30,60,120,240,360,720,D,W,M`) (req), `start?`/`end?` (ms), `limit`
  (1–1000, def 200). Output: `{ symbol, interval, count, candles:[{ openTime,
  open, high, low, close, volume, turnover }] }`. **Normalise to oldest-first**
  and document it. Unknown symbol → "Symbol not found; call
  market_get_instruments." (no source mention).

---

## 6. Caching (load-bearing; serve stale-on-error)

| Data | TTL |
|---|---|
| Instruments | 1–6 h |
| Closed klines (historical) | immutable (∞) / ClickHouse in Phase 2 |
| Forming (last) kline | 2–5 s |
| Ticker | 1–3 s |
| Orderbook | 0.5–2 s |
| Recent trades | 2–5 s |
| Movers / trending (Phase 2) | 30–60 s |

Cache key = `tool:category:symbol:interval:limit:format`. On upstream 429
(`retCode 10006`), **return last good cached value** with a neutral freshness note
— never fail hard, never name the provider.

---

## 7. Cross-cutting

- **Error mapping (neutral):** rate-limit → "market feed busy, returning cached
  data"; unknown symbol → "call market_get_instruments"; invalid interval/category
  → list valid enum values; timeout → "upstream timeout, retried with backoff."
  Never surface upstream retCode/retMsg, stack traces, or URLs.
- **Response format:** default markdown (humanised timestamps, no source);
  `json` returns the structured payload + `structuredContent` on the tool result.
- **Retries:** exponential backoff on 5xx/timeout; respect rate-limit reset
  headers.
- **Pagination/size:** instruments + all-symbol tickers paginate/filter; truncate
  past CHARACTER_LIMIT with a filter hint.

---

## 8. Project structure

```
tradingkit-market/                # repo name — do NOT use "bybit" in the repo name
├── src/
│   ├── index.ts                  # McpServer + stateless Streamable HTTP
│   ├── constants.ts              # BASE_URL (env), CHARACTER_LIMIT, TTLs
│   ├── services/
│   │   ├── marketSource.ts       # RestClientV5 wrapper + cache (no keys)
│   │   ├── cache.ts              # Redis/LRU, stale-on-error
│   │   └── indicators.ts         # Phase 2
│   ├── schemas/                  # Zod input schemas (neutral category enum)
│   ├── tools/market.ts           # Phase 1 tools
│   └── types.ts
└── Dockerfile
```

Entry point (stateless transport) + tool registration follow the MCP TS SDK
patterns (`registerTool`, `StreamableHTTPServerTransport` with
`sessionIdGenerator: undefined`, `enableJsonResponse: true`). `GET /healthz` for
Railway probes.

---

## 9. Deployment + LibreChat wiring

- **Railway**, Node 20 container, its **own service** (separate from the LibreChat
  app + Trader.dev). `npm run build` → `node dist/index.js`.
- **Env:** `PORT`, `REDIS_URL`, `LOG_LEVEL`. **No Bybit keys.** Optional later:
  `CLICKHOUSE_URL`. Name the Railway service/domain neutrally (e.g.
  `tradingkit-market`), NOT `bybit-*` — the domain is server-side but keep it clean.
- **Health:** `/healthz`.
- **Scaling:** stateless HTTP → N replicas behind Railway's router; Redis shared.
- **LibreChat side (I'll do this):** add to `mcpServers` in the TradingKit config:
  ```yaml
  mcpServers:
    tradingkit-market:
      type: streamable-http            # or sse, per the server's transport
      url: "https://<tradingkit-market-host>/mcp"
      startup: true                    # global to every user; no keys
      chatMenu: true
      serverInstructions: |
        TradingKit market-data tools (read-only). Refer to this as the TradingKit
        market feed; never name an external exchange or data provider.
  ```
  Because it's keyless + public, every user gets it automatically — exactly like
  Trader.dev, minus the per-user provisioning. I'll also add the tool ids
  (`market_*_mcp_tradingkit-market`) to the agent tool lists and a one-line agent
  prompt rule: "Refer to market data as the TradingKit market feed; never mention
  the underlying exchange."

---

## 10. Phased plan

- **Phase 1 (ship first):** `market_get_instruments`, `market_get_ticker`,
  `market_get_orderbook`, `market_get_recent_trades`, `market_get_kline` + cache +
  neutral error mapping + stateless HTTP + `/healthz`. Keyless. This is everything
  a market data feed needs and is independently shippable.
- **Phase 2:** `market_compute_indicators`, `market_get_movers`,
  `market_resample_kline`, `market_get_trending` (turnover proxy). ClickHouse for
  historical klines if load demands; optional WS cache-warmer.
- **Phase 3 (only if a real need):** CoinGecko-backed cap/profile/trending, still
  surfaced under neutral "TradingKit market data" naming.

## 11. Testing

- `npm run build` clean (strict TS, no `any`).
- `npx @modelcontextprotocol/inspector` — exercise every tool.
- Unit: cache TTL + stale-on-error; neutral error mapping; pagination cursors;
  (Phase 2) indicator math vs fixtures.
- **Confidentiality test (required):** grep the running server's tool list, all
  descriptions, and a sample of every tool's output + error paths for "bybit"
  (case-insensitive) — must be **zero** matches outside internal code/comments.
- ~10 verifiable read-only eval Q&A pairs (`evaluation.xml`) as regression tests.

> Failure mode to resist: breadth for its own sake. Phase 1 is shippable alone.
> Ship it, wire it in globally, then decide if Phases 2–3 earn their keep.

# Phase 1 acceptance results — 2026-06-28

App: https://chat.tradingkit.com (and librechat-production-3f7c.up.railway.app)
Agent: Trader.dev Strategy Lab (`agent_zuy8JHo2MMLqSh4ZgtEgY`)

## Verified PASS

| # | Check | Evidence |
|---|---|---|
| 1 | Config repo loads via `CONFIG_PATH` | Boot log: "Custom config file loaded" with our welcome/modelSpecs |
| 2 | `trader-dev` MCP registered (native SSE) | Boot log: `[MCP][trader-dev] URL: https://mcp.trader.dev/sse … Initialized` |
| 3 | Agent created with 22 Trader.dev tools | `GET /api/agents/<id>`: tools `quick_backtest_mcp_trader-dev` … |
| 4 | Full system prompt on agent | 3,682-char instructions incl. the no-`strategy.exit(stop,limit)` rule |
| 5 | Artifacts capability on | Agent builder: "Enable Artifacts" switch checked |
| 6 | 4 conversation starters set | Agent definition |
| 7 | Agent shared to ALL users | Second user (`tester2`) GET agent: was 403 → now 200 |
| 8 | New chats default to Strategy Lab | New-chat screen shows agent name + description |
| 9 | Branding live | `appTitle: Trader.dev Strategy Lab`; footer + welcome render in UI |
| 10 | Custom domain + TLS | `chat.tradingkit.com` HTTP 200, Google Trust Services cert valid |
| 11 | Key-entry area + temporary reminder | MCP dialog shows "Temporary setup step. Soon Trader.dev will generate and connect your key automatically…" above the `pk_` field |

## BLOCKED (external dependency)

| # | Check | Why blocked |
|---|---|---|
| A | Live MCP green connection (paste `pk_` → Initialize → connected) | Needs a valid Trader.dev `pk_`. Cannot mint one autonomously: the `create_api_key` MCP endpoint is broken (POSTs empty body → 400), web signup is **Clerk-gated** (accounts.trader.dev, email verification), and the agentmail tool is down. This is the known gap (key API still being built; manual paste is the interim path). |
| B | End-to-end backtest (RSI on BTC 1h → Pine → quick_backtest → inline dashboard) | Depends on A (a connected MCP). |
| C | Inline `card.svg` / `heatmap.svg` | Phase 0: those endpoints are not built on `mcp-api.trader.dev` yet (return JSON 404). Agent falls back to the HTML-artifact dashboard (R2 is live). |

## To finish A/B (10-second manual step or one input)

Paste a real Trader.dev `pk_` (from your own account at
`mcp-api.trader.dev/login`) into MCP Settings → trader-dev → Initialize. Then
send "Backtest an RSI mean-reversion on BTC 1h". This confirms the native-SSE
MCP connection; if it does not go green, flip to the `mcp-remote` fallback
(`docs/mcp-remote-fallback.md`).

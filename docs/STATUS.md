# TradingKit chat - current status

_Updated 2026-06-28._

Live: **https://chat.tradingkit.com** (Railway project `LibraChat`, official
LibreChat image + our `librechat.yaml` via `CONFIG_PATH`).

## Working

- **GPT-5.5** is the model (OpenAI key in env, Strategy Lab agent set to
  `openAI/gpt-5.5`, verified responding). Anthropic still available to admin.
- Default **Strategy Lab** agent (`agent_zuy8JHo2MMLqSh4ZgtEgY`), shared to all
  users, pinned as the default + only spec (`modelSpecs.enforce: true`).
- **Trader.dev MCP** connects globally with the admin key; all 38 tools
  enumerate.
- **Admin-controlled lockdown** (USER role): users can USE the agent + chat +
  projects + backtests, but cannot CREATE agents / skills / prompts / MCP
  servers; marketplace off. Re-apply with `scripts/lockdown-user-role.mjs`.
- **Credit metering** on (`balance` block): every message debits a per-user
  token balance; 2M start + 2M weekly refill (generous pre-billing).
- Branding: `APP_TITLE=TradingKit`, footer TradingKit.
- Fixed template showstoppers: `CREDS_KEY/IV` (blocked key saves), ban guard
  (locked out admin) - both resolved.

## Working — backtests end-to-end (2026-06-28)

trader-dev shipped the `?key=` SSE auth, so MCP is clean native SSE
(`url: https://mcp.trader.dev/sse?key=${TRADERDEV_ADMIN_KEY}`). Verified live in
chat: ask for a backtest -> agent writes Pine -> `quick_backtest` runs -> a
TradingKit card renders with the real equity curve + colour-coded stat tiles
(pulled from `result.r2Url`), and the agent headlines `equityReturnPct` (account
growth). trader-dev also added the MCP-UI `ui://` card resource (renders in
Claude/ChatGPT; LibreChat uses the agent's own artifact today), `r2Url`/`jsonUrl`/
`viewUrl`/`equityReturnPct`/`finalEquity` on results, and a public
`GET /backtest-results/<id>/result.json`. Kill-switch: `MCP_UI_CARDS=false`.

## Next (the TradingView-killer build, needs the fork)

Requires forking LibreChat + a custom build (config can't do custom UI):
full visual rebrand (logo, theme, remove remaining "LibreChat"), Re-backtest
button, backtest canvas, bottom equity panel, right-hand market rail, left-nav
exchanges. Tracked in tasks #12/#13.

## Backend asks for trader-dev

See `docs/trader-dev-specs/` (6 specs): MCP auth fix, structured backtest result
+ candles + trade markers, card.svg/heatmap.svg, market feed, per-user
provisioning, re-backtest.

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

## Blocked

- **Backtests in chat.** Root cause: LibreChat's MCP client does not send the
  auth key on the SSE GET (session-open), so the Trader.dev server treats the
  session as anonymous -> "No key found" on tool calls. The key is valid (proven
  via a direct MCP SDK client: `whoami` -> `__admin__`). **Fix chosen:** trader-dev
  adds `?key=` query-param auth (see `docs/trader-dev-specs/06-mcp-auth-for-librechat.md`),
  then our MCP `url` becomes `https://mcp.trader.dev/sse?key=${TRADERDEV_ADMIN_KEY}`.
  Forward that spec to the trader-dev dev.

## Next (the TradingView-killer build, needs the fork)

Requires forking LibreChat + a custom build (config can't do custom UI):
full visual rebrand (logo, theme, remove remaining "LibreChat"), Re-backtest
button, backtest canvas, bottom equity panel, right-hand market rail, left-nav
exchanges. Tracked in tasks #12/#13.

## Backend asks for trader-dev

See `docs/trader-dev-specs/` (6 specs): MCP auth fix, structured backtest result
+ candles + trade markers, card.svg/heatmap.svg, market feed, per-user
provisioning, re-backtest.

# chat.tradingkit.com

Customisation + deploy config for the **Trader.dev Strategy Lab**, a branded
LibreChat instance where users backtest and optimise trading strategies in plain
English via the live Trader.dev MCP.

## How it works

The Railway `LibreChat` service runs the official image
(`ghcr.io/danny-avila/librechat-dev:latest`) and loads this repo's
`librechat.yaml` at boot via the `CONFIG_PATH` env var. We do **not** fork
LibreChat. To change the chat config: edit `librechat.yaml`, push to `main`,
then redeploy the LibreChat service on Railway.

## Layout

- `librechat.yaml` - the only file Railway reads (MCP, agents, branding).
- `agent/strategy-lab.json` - the Strategy Lab agent definition.
- `scripts/seed-agent.mjs` - create/update the agent via the LibreChat API.
- `scripts/set-railway-vars.sh` - idempotent Railway env wiring.
- `docs/` - deploy runbook, env reference, agent system prompt, phase specs/plans.

## Deploy / update

See [`docs/deploy-runbook.md`](docs/deploy-runbook.md).

## Architecture

```
Browser (chat.tradingkit.com)
   -> LibreChat (Railway, official image, loads this librechat.yaml)
        -> Trader.dev MCP (SSE, https://mcp.trader.dev/sse, per-user pk_ key)
             -> Trader.dev API (mcp-api.trader.dev) -> R2 public result blobs
```

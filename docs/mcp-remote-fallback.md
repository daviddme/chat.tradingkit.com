# mcp-remote fallback (exact Claude-config mirror)

Phase 1 connects the Trader.dev MCP using LibreChat's **native SSE** transport.
That makes the same connection the Claude Code `trader-dev` client makes (same
endpoint `https://mcp.trader.dev/sse`, same static `Authorization: Bearer pk_…`,
same SSE transport). Claude Code wraps that in `mcp-remote` only because Claude
needs a stdio↔remote bridge; LibreChat speaks SSE directly, so the wrapper is
not required.

Use this fallback **only if** the native SSE block fails to connect green in the
deployed app.

## How to flip to the mcp-remote bridge

1. In `librechat.yaml`, replace the `mcpServers.trader-dev` block with the stdio
   bridge (this mirrors the Claude config exactly):

   ```yaml
   mcpServers:
     trader-dev:
       type: stdio
       command: npx
       args:
         - "-y"
         - "mcp-remote@0.1.38"
         - "https://mcp.trader.dev/sse"
         - "--header"
         - "Authorization:Bearer {{TRADERDEV_API_KEY}}"
       customUserVars:
         TRADERDEV_API_KEY:
           title: "Trader.dev API Key"
           description: "<b>Temporary setup step.</b> Soon Trader.dev will generate and connect your key automatically. For now, paste it here manually. Get your pk_ key from <a href='https://mcp-api.trader.dev/login' target='_blank'>trader.dev API Keys</a>."
       chatMenu: true
       startup: false
   ```

2. The official image does not guarantee `mcp-remote` is cached, so switch the
   Railway `LibreChat` service to build this repo's `Dockerfile` (which installs
   `mcp-remote` globally):
   - Railway dashboard → LibreChat service → Settings → Source → connect this
     GitHub repo (Root `/`, Dockerfile `./Dockerfile`), OR build + push the image
     to GHCR and point the service image at it.

3. Redeploy and re-test the green connection.

## Why native SSE is preferred

- No per-connection `npx`/subprocess spawn inside the container.
- No dependency on npm registry egress at runtime.
- Keeps us on the official image (simplest, most update-safe path).

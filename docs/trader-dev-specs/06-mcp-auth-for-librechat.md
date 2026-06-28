# Spec 06 — Make MCP auth work with LibreChat's SSE client (query-param key)

**Priority: HIGH (blocks backtests in the chat today).**

## Problem (confirmed)

The Trader.dev MCP at `https://mcp.trader.dev/sse` authenticates the **session at
the SSE GET** (connection open) using the `Authorization: Bearer` header.

LibreChat's MCP SSE client sends the `Authorization` header on the **tool-call
POST** but not on the **SSE GET** that opens the session. Result: the server
treats the session as anonymous, enumerates tools fine (38 returned), but every
tool *call* returns `"No key found. Please provide a key and try again."`.

Proof the key + server are fine: a direct MCP SDK `SSEClientTransport` that puts
the header on BOTH the eventSource GET and the POST authenticates correctly —
`whoami` returns `{"id":"__admin__","isAdmin":true,"unlimited":true,...}`.

## Requested fix (smallest change): accept the key as a URL query param

Allow the API key on the SSE URL, so auth rides on the GET that LibreChat can
control via the configured `url`:

```
GET https://mcp.trader.dev/sse?key=pk_xxx        (or ?apiKey= / ?token=)
```

- The session opened by that GET should be authenticated as that key's user,
  exactly as if `Authorization: Bearer pk_xxx` had been sent on the GET.
- All subsequent tool calls on that session inherit the auth (no per-POST header
  needed).
- Please confirm the exact param name you implement (`key`, `apiKey`, or
  `token`).

With this, LibreChat config becomes simply:
```yaml
mcpServers:
  trader-dev:
    type: sse
    url: "https://mcp.trader.dev/sse?key=${TRADERDEV_KEY}"
```

## Alternative fix (if query param is undesirable)

Re-validate the `Authorization` header on the **POST-back / message endpoint**
(not only on the SSE GET), so a client that authenticates per-POST also works.

## Interim workaround on our side (no trader-dev change needed)

We will ship a tiny stdio↔SSE proxy inside our LibreChat image that sets the
header on both the GET and POST (the proven-working path), and point LibreChat's
MCP at that proxy. The query-param fix above is still preferred long-term because
it removes the proxy.

## Acceptance

- Opening `…/sse?key=<valid pk_>` and calling `whoami` returns that user's
  identity (not "No key found").
- A `quick_backtest` call over that session returns a real result.

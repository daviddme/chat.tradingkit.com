# Spec 07 — Return the backtest card as an MCP-UI widget (render in Claude / ChatGPT / LibreChat)

**Goal:** build the backtest card + equity curve **once, in the Trader.dev MCP
server**, and have it render inline in any MCP client that supports UI resources
(ChatGPT Apps SDK today, Claude's interactive MCP UI as it rolls out, LibreChat
as it adds support) - instead of a client-specific artifact.

## How it works

MCP tool results can carry **resources**, not just text. The **MCP-UI** standard
(https://mcpui.dev) defines an HTML UI resource that supporting hosts render in a
sandboxed iframe:

- The tool returns, in its result `content`, an embedded resource with
  `uri: "ui://traderdev/backtest/<resultId>"` and `mimeType: "text/html"`
  (inline HTML in `text`/`blob`), OR an external `text/uri-list` pointing at a
  hosted page.
- Hosts that understand `ui://` render it inline. (OpenAI's Apps SDK uses the
  same MCP-resource mechanism via `_meta` `openai/outputTemplate`; you can emit
  both for max coverage.)

## What to return from `quick_backtest` / `run_backtest` / `get_backtest_result`

Return BOTH so it degrades gracefully:

1. The **structured JSON** result (as today) - always works, every client.
2. An **MCP-UI resource** rendering the card:

```jsonc
{
  "content": [
    { "type": "text", "text": "<the JSON result, as now>" },
    {
      "type": "resource",
      "resource": {
        "uri": "ui://traderdev/backtest/01KTK...",
        "mimeType": "text/html",
        "text": "<!doctype html>… self-contained card …"
      }
    }
  ]
}
```

The HTML should be **self-contained** (inline CSS/JS) and pull the equity series
from the public R2 blob client-side (no auth), exactly like our reference card:
`https://pub-5880a55c41fd4cd1a11146f4fd522fbe.r2.dev/backtests/<resultId>.json.gz`.
Stats (net %, win rate, PF, Sharpe, Sortino, maxDD, trades) come from the result
you already computed. Theme: bg `#0b0e1a`, accent `#6366f1`, up `#16c784`,
down `#ea3943`. A working reference card (real data) lives in our repo at
`docs/ui/backtest-card-template.html` + the SVG version we render in chat - reuse it.

### Interactivity (optional, powerful)

MCP-UI lets the iframe post actions back to the host (e.g. a **Re-backtest** or
**Optimise** button that calls another MCP tool). If you wire the buttons to MCP
actions, the card becomes interactive in every supporting client.

## Coverage / fallback

- ChatGPT (Apps SDK): renders the widget.
- Claude: renders where interactive MCP UI is supported.
- LibreChat: renders the JSON now (agent draws its own artifact); will render the
  UI resource as LibreChat's MCP-UI support lands.

Returning JSON + UI resource means no client is left with a broken experience.

## Acceptance

- `quick_backtest` returns a `resource` with `uri: ui://…` + self-contained HTML
  that shows the card + equity curve.
- In an MCP-UI-capable client, the card renders inline; in others, the JSON
  result is intact.

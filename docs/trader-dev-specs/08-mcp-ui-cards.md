# Spec 08 — MCP-UI inline cards (interactive) for TradingKit

**Confirmed in production:** LibreChat (v0.8.7, `@mcp-ui/client` v5.7.0) renders
`ui://` resources returned by MCP tools **inline in the chat message**. Your P2
backtest card already shows inline. This spec is how to (a) fix the card sizing,
(b) make the card buttons interactive, and (c) add a few more inline cards — all
server-side, no LibreChat changes, and cross-client (also works in ChatGPT/Claude
MCP-UI hosts).

> Guardrail (same as the main brief): everything here is ADDITIVE. Keep returning
> the structured JSON as `content[0]`. The `ui://` resource is an extra
> `content[]` item. Non-UI clients are unaffected.

---

## A. The LibreChat action contract (how card buttons work)

When a button in the card calls `window.parent.postMessage(...)`, LibreChat's
handler (`handleUIAction`) accepts **three** `type` values and, for all of them,
turns the click into a message to the agent (which then calls the right MCP tool).
So buttons drive the agent. **Use `type: "prompt"` — it is the most
deterministic.**

Exact shapes LibreChat accepts:

```js
// PROMPT (recommended): send a clear instruction; the agent executes it.
parent.postMessage({ type: 'prompt', payload: {
  prompt: 'Re-run the backtest for strategy <STRATEGY_ID> on <SYMBOL> <TF> and show the updated card.'
}}, '*');

// INTENT: agent interprets an intent + params.
parent.postMessage({ type: 'intent', payload: {
  intent: 're-backtest', params: { strategyId: '<ID>', symbol: '<SYM>', timeframe: '<TF>' }
}}, '*');

// TOOL: names a tool for the agent to call (must be the EXACT MCP tool name,
// e.g. "quick_backtest" / "start_optimization" — no prefix).
parent.postMessage({ type: 'tool', payload: {
  toolName: 'start_optimization', params: { strategyId: '<ID>', /* ... */ }
}}, '*');
```

Notes:
- All three are submitted to the LLM as a user message; the agent then calls the
  tool and returns a fresh card. There is one LLM round-trip per click (fine).
- `link` / `notify` are NOT handled by this LibreChat build — don't rely on them
  for navigation; for "View full report" use a normal `<a href target="_blank">`
  to `viewUrl` inside the card (plain links work; the iframe sandbox allows
  `allow-popups`).

## B. Sizing (fix the 150px clip)

The card iframe currently sticks at ~150px and clips. `@mcp-ui/client` v5.7.0
auto-resizes when the embedded page reports its size. In the card, report height
on load + on change (verify the exact message name against `@mcp-ui/client`
v5.7.0 — it is the library's size-change event; `ui-size-change` is the expected
name):

```html
<script>
  function reportSize(){
    const h = document.documentElement.scrollHeight;
    parent.postMessage({ type: 'ui-size-change', payload: { height: h } }, '*');
  }
  addEventListener('load', reportSize);
  new ResizeObserver(reportSize).observe(document.body);
</script>
```
Target ~**380–440px** so header + 6 stat tiles + equity sparkline all show.

---

## C. Card catalogue (return these `ui://` resources)

### C1. Backtest card v2 (upgrade the existing one)
On `quick_backtest` / `get_backtest_result`. Self-contained HTML, pulls equity
from the public R2 blob (`r2Url`). Show:
- Header: `displaySymbol` + timeframe + trade count + date range + "BACKTEST".
- 6 stat tiles, colour-coded: **Net Return = `equityReturnPct`** (green/red),
  Win Rate, Profit Factor, Sharpe, Max DD, Trades.
- **Equity curve** (line + faint fill) from R2 `equity[]`, optional trade-outcome
  markers from R2 `trades[]` (`entryTime`/win-loss).
- Buttons (each a `prompt` postMessage):
  - **↻ Re-backtest** → `"Re-run this exact backtest and show the updated card."`
  - **⚙ Optimise** → `"Propose an optimisation plan for strategy <ID> and start it."`
  - **</> View code** → `"Show me the Pine source for strategy <ID>."`
  - **View full report ↗** → plain `<a href="<viewUrl>" target="_blank">`.
- Theme: bg `#0b0e1a`, panel `#0e1322`, accent `#6366f1`, up `#16c784`,
  down `#ea3943`. Reference: our repo `docs/ui/backtest-card-template.html`.

### C2. Optimisation card
On `start_optimization` (queued state) and `get_optimization` (progress/done).
- Queued: show `queuePosition`, `creditCost`, `creditsRemaining`, and (free tier)
  an upgrade link; a **↻ Check progress** button →
  `prompt: "Check my optimisation <OPT_ID> and show the result."`
- Done: a **heatmap** of the 2-param grid (or per-param sensitivity) rendered in
  HTML/SVG, the **best params**, and an **Apply best params + re-backtest** button
  → `prompt: "Backtest strategy <ID> with <BEST_PARAMS> and show the card."`

### C3. Market watchlist card (powers the "market rail" inline, no fork)
A `ui://` card listing a small watchlist (BTC, ETH, SOL, …) with last price +
24h change, refreshable. Source it from whatever you have (Bybit WS snapshot /
`search_perps` / a new `get_market_snapshot` tool). Returning this as an inline
card means the market rail works in the chat with zero LibreChat changes. A
**Backtest this symbol** button → `prompt: "Backtest an EMA crossover on <SYM> 1h."`

### C4. (optional) Compare card
On `compare_backtests`: two equity curves overlaid + a side-by-side stat table.

---

## D. Acceptance
- Backtest card renders inline at full height (no clip), shows the equity curve.
- Clicking **Re-backtest** / **Optimise** / **View code** drives the agent to run
  the matching tool and return a fresh card.
- Optimisation + watchlist cards render inline the same way.
- All structured JSON results remain unchanged (`content[0]`).

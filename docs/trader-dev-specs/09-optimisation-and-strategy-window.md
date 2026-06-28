# Spec 09 — Optimisation card (progress + heatmap) + Strategy Window

Builds on spec 08 (MCP-UI cards + action contract). All additive. The
interactive buttons already work (verified: a `tool` action fired
`start_optimization` end-to-end). This spec covers what's missing.

---

## A. Public optimisation status endpoint (NEW — needed for the progress bar)

The card must self-poll progress **client-side** (no LLM, no per-check token
cost). Today `/optimizations/<id>` and `/optimizations/<id>/heatmap` return JSON
but require **auth (401 from a browser)** — the card can't send the admin key
safely from client JS. So mirror the **public** R2 model:

`GET https://mcp-api.trader.dev/optimizations/<id>/status.json`
- **No auth**, `Access-Control-Allow-Origin: *`, short `Cache-Control` (~15s).
- Shape:
```jsonc
{
  "id": "01K…",
  "state": "queued" | "running" | "done" | "failed" | "cancelled",
  "completed": 96, "total": 96, "queuePosition": 0,
  "objective": "net_profit",
  "best": { "params": { "fastLen": 1, "slowLen": 96 },
            "score": 12048.0, "bestResultId": "01K…" },
  "heatmap": {
    "xName": "fastLen", "xValues": [1,2,3,…],
    "yName": "slowLen", "yValues": [10,20,…],
    "grid": [[score, …], …]      // grid[y][x] = objective score; null if not run
  },
  "viewUrl": "https://mcp-api.trader.dev/optimize/01K…"
}
```
(Only expose non-sensitive fields. This is the same "public summary of a job"
pattern as the backtest R2 blob.)

## B. Optimisation card (ui:// resource)

Return a `ui://traderdev/optimization/<id>` resource from **`start_optimization`**
(queued state) and **`get_optimization`** (live/done). The card is the
"progress bar with a loop" — it self-polls `status.json`, no agent cron needed
(LibreChat can't wake the agent on a timer; the WIDGET does the polling):

- On load, poll `status.json` every ~20–30s.
- **Queued/running:** a **progress bar** (`completed/total`), queue position,
  `creditCost`/`creditsRemaining`, elapsed. Keep polling until `state==='done'`.
- **Done:** render the **heatmap** as a coloured grid from `heatmap.grid`
  (green=better objective, red=worse), label axes (`xName`/`yName`), highlight
  the best cell. Show best params + score + a **link to `viewUrl`**.
- Buttons (action contract from spec 08):
  - **Apply best & re-backtest** → `prompt: "Backtest <strategyId> with
    fastLen=1, slowLen=96 and show the card."`
  - **Open in Strategy Window** → see §D.
- Stop polling when done/failed; cap at ~30 min.

> Note on "cron like Claude": the loop lives in the WIDGET (client-side polling),
> not in the agent. That gives a live progress bar with zero token cost per tick.

## C. Backtest card height (CONFIRMED too small)

The backtest card still renders at the default ~150px and clips badly. Make it
**much taller** — target **~460–540px** so the header, all 6 stat tiles, AND the
full equity curve are visible without scrolling. Report height so `@mcp-ui/client`
auto-resizes (spec 08 §B): post `{ type:'ui-size-change', payload:{ height:
document.documentElement.scrollHeight } }` on load + on resize. If auto-resize is
flaky, also set an explicit min-height on the card root.

## D. "Open in Strategy Window" — the full report

Add an **Open in Strategy Window** button to the backtest card (and the
optimisation card). This surfaces the full TradingView-style report (key stats,
cumulative PnL, return details, trades analysis, ROI distribution, trades donut,
run-ups/drawdowns, capital efficiency, **list of trades** — the report you
already render at `/optimize/<id>` and `/backtest/<id>`).

Two delivery paths (the backend work is the same data you already have):

1. **Big report card (no client fork needed):** return a large `ui://` resource
   (or `text/uri-list` pointing at the report page) that renders the full report
   inline/expanded. Easiest reuse: the button opens the existing report page.
   - Simplest button now: `<a href="<viewUrl>" target="_blank">` (opens the full
     report you already built). Works today, zero new backend.
   - Richer: a `ui://traderdev/report/<id>` resource that renders the full
     analytics from the public blob (`r2Url` trades/equity) + result stats —
     trades table, win/loss **donut**, **ROI distribution**, drawdowns. Self
     contained, sizes large.

2. **Docked bottom bar (TradingKit fork):** a persistent bottom panel in the chat
   that hosts the report (so the user stays in the chat). This is a TradingKit
   front-end change (the LibreChat fork), NOT a backend change — but it consumes
   exactly the same data/endpoints as the report card. Build the report card (1)
   first; the dock can host it later.

So: backend delivers the data + the report card; the persistent dock is on the
TradingKit side.

### The exact "Open in Strategy Window" button action (TradingKit handles this)

TradingKit's fork adds a docked bottom Strategy Window. The card button must post
this action (a dedicated `intent`, so it opens the dock instead of messaging the
agent):

```js
parent.postMessage({ type: 'intent', payload: {
  intent: 'strategy-window',
  params: {
    url: '<viewUrl>',              // the full report page for this result/opt
    title: '<symbol> <tf> backtest'  // dock tab title
  }
}}, '*');
```
TradingKit intercepts `intent === 'strategy-window'` and opens the bottom dock
iframed to `params.url` (the existing report page). Any other `intent`/`tool`/
`prompt` still goes to the agent as before. So just emit the button with that
action; we handle the docking.

## Acceptance
- `status.json` public + CORS; card shows a live progress bar and stops at done.
- Optimisation card renders the heatmap grid + best params + apply button.
- Backtest card renders ~460–540px tall, equity curve fully visible.
- "Open in Strategy Window" opens the full report (link now; report card next).

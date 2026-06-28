# Trader.dev MCP — developer brief for TradingKit chat

**To:** the Trader.dev MCP / API developer
**From:** TradingKit (the AI chat at chat.tradingkit.com, built on LibreChat,
also usable from Claude / ChatGPT via MCP)
**Date:** 2026-06-28

This is everything needed on the Trader.dev side for the TradingKit chat to fully
work: run backtests from any MCP client, and render a beautiful backtest card
(equity curve + stats) inline. It is ordered by priority. Each item is additive.

---

## ⚠️ GUARDRAIL — DO NOT BREAK ANYTHING THAT ALREADY WORKS

Every change below MUST be **additive and backward-compatible**. The following
all work today and must keep working **exactly** as-is:

- The MCP server at `https://mcp.trader.dev/sse` (SSE transport) and ALL 38 tools
  (`whoami`, `quick_backtest`, `run_backtest`, `get_backtest_result`,
  `get_trades`, `get_equity_curve`, `parse_strategy_inputs`, the optimisation
  tools, `get_credits`, etc.). Do not rename, remove, or change the schema/return
  shape of any existing tool. Only ADD optional fields / new resources.
- Admin-key auth: `Authorization: Bearer tdsk_admin_…` → `whoami` returns
  `{ "id":"__admin__", "isAdmin":true, "unlimited":true }`. Keep working.
- `pk_` user-key auth, the optimisation queue, credits, and Telegram/live signal
  tools. Keep working.
- `GET /backtest/<id>/fork.json` (authed) — returns `strategy`, `backtest`
  (full stats), `pineSource`. Keep working, keep the field names.
- The public R2 result blobs at
  `https://pub-5880a55c41fd4cd1a11146f4fd522fbe.r2.dev/backtests/<id>.json.gz`
  (`equity[]`, `trades[]`, `meta`). Keep working.

If any change risks altering an existing response, gate it behind a new field or
a new endpoint instead. When in doubt, add; never modify.

---

## Priority 1 (BLOCKER) — make MCP tool calls authenticate over SSE

**Symptom:** when a standard MCP client (LibreChat; and the same applies to other
hosts) connects to `mcp.trader.dev/sse` with the Bearer key, it can **list** the
38 tools but every tool **call** returns `"No key found. Please provide a key and
try again."`.

**Root cause (confirmed):** the server authenticates the session on the **SSE GET**
(connection open). The client sends the key header on the tool-call **POST** but
not on the SSE GET, so the session is anonymous. Proof: a direct MCP SDK client
that sets the `Authorization` header on **both** the SSE GET and the POST works —
`whoami` → `__admin__`. So the key is valid; the session just isn't authed.

**Requested fix (smallest, preferred): accept the key as a URL query param** so
auth rides on the GET the client controls:

```
GET https://mcp.trader.dev/sse?key=<pk_ or tdsk_…>
```
- The session opened by that GET must be authenticated as that key's user,
  identical to sending `Authorization: Bearer <key>` on the GET.
- All tool calls on that session then inherit the auth (no per-POST header).
- Please tell us the exact param name (`key`, `apiKey`, or `token`).
- **Keep the existing header auth working too** (additive).

**Alternative** (if you prefer not to add a query param): also re-validate the
`Authorization` header on the POST/message endpoint, not only on the SSE GET.

**Acceptance:** opening `…/sse?key=<valid key>` then calling `whoami` returns the
user (not "No key found"), and `quick_backtest` returns a real result.

---

## Priority 2 — return the backtest card as an MCP-UI resource (renders in Claude / ChatGPT / LibreChat)

Build the card **once, server-side**, so it renders inline in any MCP client that
supports UI resources (ChatGPT Apps SDK today; Claude's interactive MCP UI as it
ships; LibreChat as it adds support). See the MCP-UI standard: https://mcpui.dev .

From `quick_backtest`, `run_backtest`, and `get_backtest_result`, return **BOTH**
(so it degrades gracefully on clients that don't render UI):

1. the **structured JSON** result (exactly as today — unchanged), AND
2. an **MCP-UI resource**:

```jsonc
{
  "content": [
    { "type": "text", "text": "<the existing JSON result>" },
    {
      "type": "resource",
      "resource": {
        "uri": "ui://traderdev/backtest/<resultId>",
        "mimeType": "text/html",
        "text": "<!doctype html> … self-contained card …"
      }
    }
  ]
}
```

The HTML must be **self-contained** (inline CSS/JS) and pull the equity series
client-side from the public R2 blob (no auth):
`https://pub-5880a55c41fd4cd1a11146f4fd522fbe.r2.dev/backtests/<resultId>.json.gz`.
Stats come from the result you already compute. Theme: bg `#0b0e1a`, accent
`#6366f1`, up `#16c784`, down `#ea3943`. A working reference card built from real
data is in our repo: `docs/ui/backtest-card-template.html` (reuse/port it).

**Optional (powerful):** MCP-UI lets the card post actions back to the host — wire
a **Re-backtest** and **Optimise** button to call the matching MCP tools so the
card is interactive everywhere.

**Acceptance:** in an MCP-UI-capable client the card renders inline; in others the
JSON result is intact and unchanged.

### P2 refinement (CONFIRMED in production) — the card must report its height

The `ui://` card already renders **inline** in LibreChat (v0.8.7, `@mcp-ui/client`).
One fix needed: the iframe is stuck at the **default 150px and clips** (stat tiles
cut off, equity sparkline hidden) because the card HTML does not tell the host its
height. MCP-UI auto-resizes the iframe only when the embedded page reports its
size. In the card's HTML, post the content height to the parent so it grows to
fit, e.g.:

```html
<script>
function reportSize(){
  const h = document.documentElement.scrollHeight;
  parent.postMessage({ type: 'ui-size-change', payload: { height: h } }, '*');
}
window.addEventListener('load', reportSize);
new ResizeObserver(reportSize).observe(document.body);
</script>
```
(Match the exact message shape `@mcp-ui/client` expects for size changes — the
`ui-size-change` / size-change event — so the iframe resizes to the full card.)
Target a card around **360–420px tall** so the header, the 6 stat tiles, and the
equity sparkline are all visible without scrolling.

---

## Priority 3 — make results self-describing + fix the `.json` 404

The chat/LLM currently hand-builds the blob URL and sometimes requests
`…/<id>.json` (no `.gz`), which **404s** (only `…/<id>.json.gz` exists). Two small
fixes remove this whole class of bug:

1. **Put the canonical URLs IN the result.** Every backtest result (and
   `fork.json`) should include:
   ```jsonc
   { "resultId": "01K…",
     "r2Url":   "https://pub-…r2.dev/backtests/01K….json.gz",
     "viewUrl": "https://mcp-api.trader.dev/optimize/…"  // already present where relevant
   }
   ```
   so clients use the exact URL instead of guessing the extension.
2. **Serve `…/backtests/<id>.json` as well** (same content, uncompressed or with
   correct headers) so a naive `.json` request also succeeds. Additive — keep
   `.json.gz` working.

---

## Priority 4 — clarify the net-return metric

`fork.json` `backtest.netProfitPct` reads e.g. **3435%**, but the equity curve
goes $10,000 → $39,111 (**+291%**). The 3435% is a **sum of per-trade %**
(`avgTradePct` × `trades`), not compounded account growth. Please either document
this clearly or **add an explicit field** so we headline the right number:

```jsonc
{ "equityReturnPct": 291.11,   // finalEquity/initialCapital - 1  (account growth)
  "sumTradeReturnPct": 3435.45 // = current netProfitPct (kept, unchanged) }
```
Keep `netProfitPct` as-is (don't break it); just add the clearer field.

---

## Priority 5 (later, not blocking) — OHLC candles + per-user provisioning

- **OHLC candles** for the tested window (`GET /backtest-results/:id/candles` or a
  generic `GET /candles?symbol=&timeframe=&from=&to=`), epoch-ms `t`, so we can
  draw a TradingView-style price canvas with entry/exit markers (R2 trades already
  carry `entryTime/exitTime` + `entryPrice/exitPrice`). Not needed for the equity
  card; needed only for the price chart.
- **Per-user provisioning / `pk_` minting.** The current `create_api_key` path
  errors (`POST /api-keys` with empty body → 400). A working admin endpoint to
  mint a `pk_` for an email lets each chat user map to their own Trader.dev
  account + credits later (today we share the admin key). Trader.dev already uses
  Clerk (`accounts.trader.dev`), so this can tie to Clerk identity.

---

## Appendix — data contracts (for reference, already live)

**fork.json** (authed): `{ strategy{ id,name,symbol,timeframe,version,forkedFromStrategyId }, backtest{ resultId,fromTs,toTs,barsEvaluated,initialCapital,netProfit,netProfitPct,profitFactor,maxDrawdownPct,winRatePct,totalTrades,winningTrades,losingTrades,sharpeRatio,sortinoRatio,avgTradePct,avgWinningTrade,avgLosingTrade,largestWin,largestLoss,commissionPaid,createdAt,viewUrl }, pineSource }`

**R2 blob** (public, `.json.gz`): `{ equity:[{barIndex,barTime,equity,drawdown,netProfit}], trades:[{seq,direction,qty,entryBar,entryTime,entryPrice,exitBar,exitTime,exitPrice,barsInTrade,profit,grossProfit,commission,profitPct,cumProfit,runup,drawdown,isOpen}], meta:{resultId,writtenAt,equityPointsRaw} }`

---

### Summary of what unblocks "everything works"

- **P1** (`?key=`) → backtests run from the chat. **This is the one true blocker.**
- **P2** (MCP-UI card) → the result renders as a beautiful card in Claude /
  ChatGPT / LibreChat from one build.
- **P3** (URLs in result + `.json` alias) → no more 404 on the equity data.

All additive. Nothing above should change or remove any existing tool, endpoint,
field, or auth path.

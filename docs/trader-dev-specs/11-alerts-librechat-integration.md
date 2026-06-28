# Alerts ↔ TradingKit (LibreChat) — what we built and what we need confirmed

We've built the TradingKit side of live alerts:
- A **"My Alerts" panel** (left-edge bell icon) that lists the user's alerts and
  can pause / resume / test / delete them and show quota. It talks to a LibreChat
  backend proxy that calls your alerts REST API per-user.
- Backend proxy `/api/tk-alerts/*` → `https://mcp-api.trader.dev/alerts/*`, sending
  the user's own Trader.dev key (their provisioned `pk_`, falling back to the admin
  key until per-user provisioning is unblocked — see spec 10).
- Agent prompt guidance for setting up alerts conversationally (3 channels, asks
  only what each channel needs, then calls `create_alert`).

To finish the conversational setup + the in-chat card, we need a few confirmations.

## 1. (BLOCKER) Are the new alert MCP tools live on the SSE server?

LibreChat connects to `https://mcp.trader.dev/sse`. After reconnecting, the tool
list it sees still only contains the **old** tools:
`list_active_alerts, get_recent_signals, get_signal, get_signal_dispatches,
get_signal_stats, get_live_runtime_status, test_telegram_sink` (plus the
backtest/optimise/strategy tools).

The **new** alert tools from ALERT_SYSTEM.md are NOT present:
`create_alert, list_alerts, update_alert, pause_alert, resume_alert,
delete_alert, test_alert, get_alert_quota`.

**Please confirm these 8 tools are deployed and registered on the MCP SSE server
(`mcp.trader.dev`), not only in the REST API.** Until they're exposed over MCP,
the assistant cannot create/manage alerts conversationally (our panel's
management still works because it proxies REST directly).

## 2. The alert setup CARD (MCP-UI widget)

The simple guide describes a "Connect a live alert" card with **Webhook /
Telegram / Email** buttons, "the same kind used for backtest and optimisation
results." We already render your `ui://` MCP-UI resources and handle their
button actions. We need:

- **Which tool returns the card?** Does `create_alert` (called with no channel)
  return a `ui://` setup card, or is there a dedicated tool (e.g. `alert_setup`)?
  Tell us the tool + when it emits the card.
- **The exact postMessage action each button sends.** Our handler supports
  `intent`, `tool`, and `prompt` (same contract as the backtest/optimisation
  cards you already shipped). For "click Email → the assistant asks for the email
  address," the cleanest is a `prompt` action whose text tells the assistant what
  to ask, OR a `tool` action. Please send the **exact shape** for each of the 3
  buttons so it routes correctly. Example we can consume:
  ```js
  window.parent.postMessage({ type: 'prompt',
    payload: { prompt: 'Set up an EMAIL alert on this strategy — ask me for my email address.' }
  }, '*');
  ```
- Confirm the card reports height via `{ type: 'ui-size-change', payload: { height } }`
  like the other cards.

## 3. REST host + shapes (confirm stable)

We discovered and verified the alerts REST API at **`https://mcp-api.trader.dev`**
(same host as `/provision/user`), Bearer-authed with the user's `pk_` (or admin
`tdsk_`). Verified live:
- `GET /alerts/quota` → `{ used, limit, tier, unlimited, remaining }`
- `GET /alerts/subscriptions` → `[{ id, name, symbol, timeframe, status,
  channels[], messageTemplate, warmupBars, sourceStrategyId, lastFiredAt,
  createdAt, updatedAt }]`
- `POST /alerts/subscriptions/:id/{pause,resume,test}`, `DELETE …/:id`, `PATCH …/:id`

Please confirm `mcp-api.trader.dev` is the intended stable host for this and the
shapes won't change under us.

## 4. Channel display hints in LIST responses (nice-to-have)

The one alert we saw returned `channels: []`. For a populated alert, what does a
LIST `channels[]` element look like? We want a **non-secret display hint** per
channel to show in the panel (e.g. email `to`, telegram `chat_id`, webhook host)
WITHOUT exposing secrets/bot tokens. If list responses redact channels to just
`{ type }`, a redacted target field (e.g. `{ type:'email', to:'a***@x.com' }`)
would let us show "Email → a***@x.com". Optional but improves the UI.

## 5. test_alert response

Does `POST /alerts/subscriptions/:id/test` (and the `test_alert` MCP tool) return
per-channel delivery status (sent/failed + reason)? We'd surface that on the
panel's "Test" button so the user sees whether the sample fired.

## 6. create_alert input schema (confirm)

For the conversational flow, confirm the `channels[]` INPUT shape for create:
```
{ type:'webhook',  url, body_template?, headers?, secret? }
{ type:'email',    to, subject_template? }
{ type:'telegram', bot_token, chat_id }
```
and that `create_alert` accepts either `sourceStrategyId` alone (copying
symbol/timeframe/Pine) or `pineSource + symbol + timeframe`, plus `channels[]`.

## Cross-ref
Per-user keys depend on provisioning, currently blocked by the `display_name is
ambiguous` 500 in `POST /provision/user` (docs/trader-dev-specs/10-provisioning-sql-bug.md).
Once both #1 here and spec 10 land, every user manages their own alerts end to end.

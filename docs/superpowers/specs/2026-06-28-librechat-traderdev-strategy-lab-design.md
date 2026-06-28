# Trader.dev Strategy Lab on LibreChat — Design (Phase 1)

**Date:** 2026-06-28
**Owner:** Davidd (hi@davidd.tech)
**Status:** Approved design, ready for implementation plan
**Source spec:** the `LibreChat.md` build spec (plain-English backtesting front-end)

---

## 1. Goal

Stand up a clean, branded, customer-facing LibreChat instance at
`chat.tradingkit.com` where users backtest and optimise trading strategies in
plain English. LibreChat is the chat front-end; the existing Trader.dev MCP +
API do all the real work (Pine generation runs in the agent, backtests /
optimisations run on `mcp-api.trader.dev`). Results render inline.

This document covers **Phase 1 only** (core chat). Phases 0/2/3 are scoped at
the end as separate efforts.

## 2. Decisions locked

| Decision | Choice |
|---|---|
| Customisation strategy | **Config repo + official image.** No fork of LibreChat. Repoint Railway `CONFIG_PATH` at our repo's raw `librechat.yaml`. |
| Auth (Phase 1) | **Open registration, public launch now.** Clerk (via OIDC) and credits/tiers are Phases 2/3. |
| Domain | `chat.tradingkit.com` |
| Default model | Claude (Anthropic key already set on the Railway service) |
| MCP key model | Per-user `pk_` keys via LibreChat `customUserVars` (not a shared key) |
| Repo visibility | **Public** (yaml holds no secrets). Fallback if private is wanted: bake yaml into a thin image. |
| Visible app name | "Trader.dev Strategy Lab" (confirm vs TradingKit branding) |

## 3. Environment facts (verified 2026-06-28)

- **Railway project** `LibraChat` (`31bc35e7-1c39-4f96-910a-ad8f747146cd`),
  env `production`. Services: `LibreChat`, `MongoDB`, `RAG`, `pg_vector`,
  `Meilisearch`. App live (HTTP 200) at
  `librechat-production-3f7c.up.railway.app`.
- LibreChat service runs image `ghcr.io/danny-avila/librechat-dev:latest`
  (no repo source). Service id `3b62c68e-9941-4a16-b754-40f7c0f21988`,
  env id `63dae6bf-4971-4888-aba5-43b7abbae892`.
- Already set on the service: `ANTHROPIC_API_KEY`, `ENDPOINTS=openAI,agents,
  assistants,azureOpenAI,google,anthropic,custom`, `APP_TITLE`,
  `ALLOW_REGISTRATION=true`, and
  `CONFIG_PATH=https://raw.githubusercontent.com/LibreChat-AI/librechat-config-yaml/main/librechat-up-l.yaml`
  (this is the hook we repoint).
- **Trader.dev MCP SSE:** `https://mcp.trader.dev/sse` (HTTP 200,
  `text/event-stream`). Same endpoint the existing `trader-dev` client bridges
  to.
- **Trader.dev API base:** `https://mcp-api.trader.dev` (live).
- **Public result data (R2):**
  `https://pub-5880a55c41fd4cd1a11146f4fd522fbe.r2.dev/backtests/<id>.json.gz`
  (already live; browser auto-gunzips).
- **Not built yet:** `GET /backtest-results/:id/card.svg` and
  `GET /optimizations/:id/heatmap.svg` both return JSON 404. These are
  Trader.dev-backend work (Phase 0), separate repo, parallel.

## 4. Architecture (Phase 1)

```
 Browser (chat.tradingkit.com)
        │
        ▼
 LibreChat service (Railway, official image)
   • reads librechat.yaml from our repo via CONFIG_PATH
   • Strategy Lab agent (Claude) + Artifacts
        │  MCP over SSE, per-user  Authorization: Bearer pk_…
        ▼
 Trader.dev MCP  (https://mcp.trader.dev/sse)
        │  HTTP (Bearer pk_…)
        ▼
 Trader.dev API (mcp-api.trader.dev)  ──►  R2 public blobs (equity/trades)
```

Inline visuals in Phase 1 come from a **LibreChat HTML Artifact** that fetches
the public R2 blob client-side (Chart.js). When Phase 0 ships, the agent also
embeds the static `card.svg` / `heatmap.svg` images. Both code paths live in the
agent system prompt.

## 5. Repository layout (`chat.tradingkit.com`)

```
librechat.yaml              # the only file Railway reads (CONFIG_PATH target)
agent/strategy-lab.json     # Strategy Lab agent definition, version-controlled
scripts/seed-agent.mjs      # create/update the agent via LibreChat API (idempotent)
scripts/set-railway-vars.sh # idempotent Railway env wiring
README.md                   # what this repo is + deploy/update runbook
docs/
  deploy-runbook.md         # step-by-step deploy + rollback
  agent-system-prompt.md    # the §5 prompt, single source of truth
  env-reference.md          # every env var we set and why
assets/                     # branding assets for the later overlay-image phase
docs/superpowers/specs/     # this design doc + future specs
```

Repo is public so `CONFIG_PATH` can be a plain raw URL with no token. Default
owner `daviddme/chat.tradingkit.com` (can be moved to an org).

## 6. `librechat.yaml` (the heart)

Key blocks (exact field names verified against current LibreChat docs during
implementation; LibreChat config moves fast):

- **`mcpServers.traderdev`**
  - `type: sse`
  - `url: https://mcp.trader.dev/sse`
  - `initTimeout: 60000`, `timeout: 180000`
  - `headers.Authorization: "Bearer {{TRADERDEV_API_KEY}}"`
  - `customUserVars.TRADERDEV_API_KEY` — title/description with the
    `mcp-api.trader.dev/login` link; stays private per user.
  - `startup: false` (don't connect until the user supplies a key)
  - `chatMenu: true`
  - `serverInstructions` — the §5 agent prompt (single source of truth lives in
    `docs/agent-system-prompt.md`; copied here).
- **`endpoints.agents`** — enabled, with the **artifacts** capability included so
  the agent can emit the interactive dashboard. Anthropic allowed.
- **`modelSpecs`** — one spec that pins the Strategy Lab agent
  (`preset.endpoint: agents`, `preset.agent_id: <id>`) as the **default**
  selectable card, so new chats land on it.
- **`interface.customWelcome`** — first-run copy: paste your `pk_` key (link to
  `mcp-api.trader.dev/login`), then describe a strategy in plain English.

The yaml contains **no secrets**: provider keys are Railway env; the Trader.dev
key is per-user `customUserVars`.

## 7. Strategy Lab agent

- Global/shared agent, Claude model, `traderdev` MCP tools attached.
- System prompt = §5 of the source spec verbatim, including CODING RULES (Pine v5
  header, reversal entries, the **no `strategy.exit(stop=,limit=)`** rule), the
  SHOWING RESULTS rules (embed `card.svg` when available + always offer the
  artifact dashboard), the OPTIMISING async-poll pattern, and the CREDITS/limits
  402/429 handling.
- `conversation_starters` = the four §10 suggested prompts.
- Created/updated by `scripts/seed-agent.mjs` from `agent/strategy-lab.json` so
  it is reproducible and in version control (not a hand-made DB row). Marked
  global so all users see it; referenced by `modelSpecs` as default.

## 8. Branding (Phase 1, config-only)

- `APP_TITLE` = "Trader.dev Strategy Lab"
- `interface.customWelcome` = first-run helper copy
- `CUSTOM_FOOTER` = brand footer
- Suggested prompts via the agent `conversation_starters`
- **Deferred to overlay-image fast-follow:** logo swap + `#080a12` / `#6366f1`
  accent (config cannot replace the logo file; that needs a thin
  `FROM ghcr.io/danny-avila/librechat-dev` image copying in assets/CSS).

## 9. Custom domain + cost guardrails

- Attach `chat.tradingkit.com` to the LibreChat Railway service; capture the
  CNAME target and hand it to Davidd for DNS.
- Set `DOMAIN_CLIENT` / `DOMAIN_SERVER` = `https://chat.tradingkit.com`
  (CORS, email links, future OAuth callbacks).
- Keep/verify sane rate limits (`LIMIT_MESSAGE_USER`, `MESSAGE_USER_MAX`,
  ban thresholds) as a cheap cost guard while registration is open and inference
  is on our Anthropic key. Cost is fully metered later in Phase 3.

## 10. Error handling

- **No `pk_` key:** MCP stays disconnected (`startup: false`); the agent + the
  custom welcome walk the user through generating one at
  `mcp-api.trader.dev/login`.
- **Trader.dev 402 (out of credits) / 429 (free daily cap):** the agent relays
  the friendly message + `upgradeUrl` (system prompt enforces this).
- **MCP init/timeout:** generous `initTimeout`/`timeout`; surfaced in service
  logs on boot. yaml is validated by LibreChat on startup (bad yaml = visible
  boot error).
- **card.svg 404 (Phase 0 not shipped):** agent falls back to the artifact
  dashboard; never shows a broken image.

## 11. Verification (run before calling Phase 1 done)

1. yaml loads cleanly (service boots, `traderdev` appears in MCP menu).
2. Mint a test `pk_` via the MCP `create_api_key`; paste it in MCP Settings →
   traderdev connects **green**.
3. "Backtest an RSI mean-reversion on BTC 1h" → agent writes Pine, calls
   `quick_backtest`, returns a real `resultId` + metrics, and renders the
   **artifact dashboard** (equity curve) inline.
4. Follow-up "make it trade less" → agent versions + re-runs + shows a new
   result.
5. `chat.tradingkit.com` resolves over TLS and loads the branded app.
6. (After Phase 0) `card.svg` / `heatmap.svg` render inline and in a plain
   browser.

## 12. Out of scope here (separate efforts)

- **Phase 0 (Trader.dev backend repo, parallel):** `card.svg` + `heatmap.svg`
  endpoints on `mcp-api.trader.dev`, modelled on the existing `/optimize/:id`
  inline SVG.
- **Phase 2:** Clerk as an **OIDC** provider into LibreChat OpenID; gate signup
  through Clerk, disable raw email registration.
- **Phase 3:** credit/tier system. LibreChat's **native balance** debits a
  token-credit balance per request (input+output, per-model rates) — that is the
  Free / Pro / Pro Plus credits. Custom glue = a Clerk/Stripe billing webhook
  that grants/refills balance per tier, plus surfacing balance in the UI.
  **Note:** this chat-credit balance is distinct from the Trader.dev `pk_`
  account's backtest/optimisation credits; the two never merge.

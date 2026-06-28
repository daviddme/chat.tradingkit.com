# Trader.dev Strategy Lab on LibreChat — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public, branded LibreChat at `chat.tradingkit.com` whose default "Strategy Lab" agent backtests trading strategies in plain English via the live Trader.dev MCP.

**Architecture:** Keep the official LibreChat image on the existing Railway project. All customisation lives in a public GitHub repo (`chat.tradingkit.com`) that Railway loads via `CONFIG_PATH`. The repo holds `librechat.yaml` (MCP + agents + branding), a version-controlled agent definition + seed script, and Railway env wiring scripts. No fork of LibreChat.

**Tech Stack:** LibreChat (Docker image `ghcr.io/danny-avila/librechat-dev:latest`), Railway (CLI + GraphQL API), GitHub (`gh`), Node 18+ ESM (seed script), Trader.dev MCP (SSE) + API.

## Global Constraints

- Railway project `LibraChat` id `31bc35e7-1c39-4f96-910a-ad8f747146cd`, env `production` id `63dae6bf-4971-4888-aba5-43b7abbae892`, LibreChat service id `3b62c68e-9941-4a16-b754-40f7c0f21988`.
- LibreChat service public URL today: `librechat-production-3f7c.up.railway.app`.
- MCP SSE URL: `https://mcp.trader.dev/sse`. API base: `https://mcp-api.trader.dev`. R2 base: `https://pub-5880a55c41fd4cd1a11146f4fd522fbe.r2.dev/backtests/<id>.json.gz`.
- `librechat.yaml` MUST contain no secrets. Provider keys stay in Railway env; the Trader.dev key is per-user `customUserVars.TRADERDEV_API_KEY`.
- MCP block: `type: sse`, `startup: false`, `chatMenu: true`, `initTimeout: 60000`, `timeout: 180000`, header `Authorization: "Bearer {{TRADERDEV_API_KEY}}"`.
- Pine CODING RULES in the agent prompt are verbatim from spec §5, including: strategy header with `default_qty_type=strategy.percent_of_equity`, declare inputs with minval/maxval/step, reversal entries, and **never use `strategy.exit(stop=,limit=)`**.
- Visible app name: "Trader.dev Strategy Lab" (pending Davidd confirm vs TradingKit).
- Repo owner default: `daviddme/chat.tradingkit.com`, **public**.
- Restart the LibreChat service after every `librechat.yaml` or env change (MCP + config initialise on boot).
- No em-dashes in any user-facing copy (welcome text, footer, README).
- Verify exact LibreChat env/yaml flag spellings against current docs while implementing; the architecture is stable, the spellings drift. Base our yaml on the upstream file the deployment already loads, then layer our blocks.

---

### Task 1: Publish the config repo so Railway can read it

**Files:**
- Create: `librechat.yaml` (temporary minimal valid config, replaced in Task 2)
- Create: `README.md`
- Modify: (repo already `git init`'d on `main`, spec already committed)

**Interfaces:**
- Produces: a public raw URL `https://raw.githubusercontent.com/daviddme/chat.tradingkit.com/main/librechat.yaml` that Task 3 points `CONFIG_PATH` at.

- [ ] **Step 1: Capture the current upstream config as our base**

Run:
```bash
cd /Users/daviddpro/Documents/GitHub/chat.tradingkit.com
curl -fsSL https://raw.githubusercontent.com/LibreChat-AI/librechat-config-yaml/main/librechat-up-l.yaml -o /tmp/upstream-librechat.yaml
head -5 /tmp/upstream-librechat.yaml
```
Expected: prints the upstream file's first lines including its `version:` value. Keep this file; Task 2 starts from it (known-good for this image).

- [ ] **Step 2: Write a minimal valid `librechat.yaml`**

Use the upstream `version` value captured above (replace `1.2.8` if it differs):

```yaml
version: 1.2.8
cache: true
```

- [ ] **Step 3: Write `README.md`**

```markdown
# chat.tradingkit.com

Customisation + deploy config for the Trader.dev Strategy Lab, a branded
LibreChat instance for plain-English strategy backtesting.

## How it works
The Railway LibreChat service runs the official image and loads this repo's
`librechat.yaml` at boot via the `CONFIG_PATH` env var. To change the chat
config: edit `librechat.yaml`, push to `main`, then redeploy the LibreChat
service on Railway.

## Layout
- `librechat.yaml` - the only file Railway reads (MCP, agents, branding).
- `agent/strategy-lab.json` - the Strategy Lab agent definition.
- `scripts/seed-agent.mjs` - create/update the agent via the LibreChat API.
- `scripts/set-railway-vars.sh` - idempotent Railway env wiring.
- `docs/` - deploy runbook, env reference, agent system prompt.

## Deploy / update
See `docs/deploy-runbook.md`.
```

- [ ] **Step 4: Commit and create the public GitHub repo**

```bash
cd /Users/daviddpro/Documents/GitHub/chat.tradingkit.com
git add librechat.yaml README.md
git commit -m "Add minimal librechat.yaml + README"
gh repo create daviddme/chat.tradingkit.com --public --source=. --remote=origin --push
```
Expected: repo created, `main` pushed.

- [ ] **Step 5: Verify the raw URL resolves (the CONFIG_PATH contract)**

Run:
```bash
curl -fsS -o /dev/null -w "HTTP %{http_code}\n" \
  https://raw.githubusercontent.com/daviddme/chat.tradingkit.com/main/librechat.yaml
```
Expected: `HTTP 200`. (Raw GitHub can lag ~30s after push; retry if 404.)

---

### Task 2: Author the full `librechat.yaml` (MCP + agents + interface)

**Files:**
- Modify: `librechat.yaml`
- Create: `docs/agent-system-prompt.md` (single source of truth for the prompt)

**Interfaces:**
- Consumes: the raw URL contract from Task 1.
- Produces: a `traderdev` MCP server, `endpoints.agents` with the `artifacts` capability, and a `modelSpecs` placeholder (the `agent_id` is filled in Task 5 after seeding). Per-user var name `TRADERDEV_API_KEY`.

- [ ] **Step 1: Write the agent system prompt to `docs/agent-system-prompt.md`**

Paste spec §5 verbatim (the full "You are Trader.dev Strategy Lab ..." block, including TOOLS, SHOWING RESULTS, OPTIMISING, CREDITS & LIMITS, CODING RULES, TONE). This file is the single source of truth; the yaml `serverInstructions` and the agent `instructions` both copy from it.

- [ ] **Step 2: Replace `librechat.yaml` with the full config**

Start from `/tmp/upstream-librechat.yaml` (keep its `version`, `cache`, and any provider/endpoint blocks already there) and add the blocks below. Final file:

```yaml
version: 1.2.8
cache: true

interface:
  customWelcome: "Welcome to Trader.dev Strategy Lab. Describe a trading idea in plain English and I will write the strategy, backtest it, and show you the results. First time here? Open MCP Settings, pick traderdev, and paste your pk_ API key from https://mcp-api.trader.dev/login so I can run backtests on your account."
  mcpServers:
    placeholder: false

mcpServers:
  traderdev:
    type: sse
    url: "https://mcp.trader.dev/sse"
    initTimeout: 60000
    timeout: 180000
    headers:
      Authorization: "Bearer {{TRADERDEV_API_KEY}}"
    customUserVars:
      TRADERDEV_API_KEY:
        title: "Trader.dev API Key"
        description: "Paste your pk_ key from <a href='https://mcp-api.trader.dev/login' target='_blank'>trader.dev API Keys</a>. It stays private to your account."
    serverInstructions: |
      <PASTE the full contents of docs/agent-system-prompt.md here>
    chatMenu: true
    startup: false

endpoints:
  agents:
    recursionLimit: 25
    maxRecursionLimit: 50
    capabilities:
      - "tools"
      - "actions"
      - "artifacts"
      - "chain"
      - "ocr"
      - "file_search"

modelSpecs:
  enforce: false
  prioritize: true
  list:
    - name: "strategy-lab"
      label: "Trader.dev Strategy Lab"
      default: true
      description: "Backtest and optimise trading strategies in plain English."
      preset:
        endpoint: "agents"
        # agent_id filled in Task 5 after the agent is seeded
        agent_id: "REPLACE_IN_TASK_5"
```

Note: if `interface.mcpServers.placeholder` is rejected by this image's schema, drop that sub-block; it is only there to make the MCP settings panel visible. Confirm against the loaded `version`.

- [ ] **Step 3: Validate the YAML parses**

Run:
```bash
cd /Users/daviddpro/Documents/GitHub/chat.tradingkit.com
python3 -c "import yaml,sys; yaml.safe_load(open('librechat.yaml')); print('YAML OK')"
```
Expected: `YAML OK`. (If `python3 -c 'import yaml'` fails, `pip3 install pyyaml` first.)

- [ ] **Step 4: Confirm no secrets leaked into the yaml**

Run:
```bash
grep -nE 'pk_[A-Za-z0-9]|sk-|ANTHROPIC|Bearer [A-Za-z0-9]{8}' librechat.yaml || echo "NO SECRETS - ok"
```
Expected: `NO SECRETS - ok` (the only `Bearer` is the `{{TRADERDEV_API_KEY}}` template, which the grep ignores).

- [ ] **Step 5: Commit and push**

```bash
git add librechat.yaml docs/agent-system-prompt.md
git commit -m "Add traderdev MCP, agents+artifacts, modelSpecs, branded welcome"
git push
```

---

### Task 3: Repoint Railway at our config + wire branding/domain env, redeploy

**Files:**
- Create: `scripts/set-railway-vars.sh`
- Create: `docs/env-reference.md`

**Interfaces:**
- Consumes: the raw URL from Task 1.
- Produces: a running deployment that loads our yaml and exposes the `traderdev` MCP. `DOMAIN_CLIENT`/`DOMAIN_SERVER` set to `https://chat.tradingkit.com` for Task 6.

- [ ] **Step 1: Write `scripts/set-railway-vars.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
SVC="LibreChat"
RAW="https://raw.githubusercontent.com/daviddme/chat.tradingkit.com/main/librechat.yaml"

railway variables --service "$SVC" \
  --set "CONFIG_PATH=$RAW" \
  --set "APP_TITLE=Trader.dev Strategy Lab" \
  --set "CUSTOM_FOOTER=Trader.dev Strategy Lab" \
  --set "DOMAIN_CLIENT=https://chat.tradingkit.com" \
  --set "DOMAIN_SERVER=https://chat.tradingkit.com" \
  --set "ENDPOINTS=agents,anthropic,openAI,google" \
  --skip-deploys
echo "Vars set. Trigger a redeploy separately."
```
Note: `--skip-deploys` batches the change; we redeploy explicitly in Step 4 so the deploy picks up all vars at once. If `railway variables --set` syntax differs in CLI 4.35, fall back to one `railway variables --set K=V --service LibreChat` per var.

- [ ] **Step 2: Record the pre-change CONFIG_PATH for rollback**

Run:
```bash
cd /Users/daviddpro/Documents/GitHub/chat.tradingkit.com
railway service LibreChat >/dev/null 2>&1 || true
railway variables --service LibreChat --kv | grep '^CONFIG_PATH=' | tee docs/.rollback-config-path
```
Expected: prints the current upstream `CONFIG_PATH`; saved for rollback. Write `docs/env-reference.md` documenting each var set in Step 1 and this rollback value.

- [ ] **Step 3: Run the wiring script**

```bash
bash scripts/set-railway-vars.sh
```
Expected: "Vars set." Confirm:
```bash
railway variables --service LibreChat --kv | grep -E '^(CONFIG_PATH|APP_TITLE|DOMAIN_CLIENT)='
```
Expected: `CONFIG_PATH` now points at our repo raw URL; `APP_TITLE=Trader.dev Strategy Lab`.

- [ ] **Step 4: Redeploy and watch boot logs**

```bash
railway redeploy --service LibreChat -y
railway logs --service LibreChat | grep -iE 'mcp|traderdev|config|error|listening' | head -40
```
Expected: logs show the config loading and an `traderdev` / MCP initialisation line, and the server listening, with no fatal YAML/schema error. (MCP shows as available but not connected, since `startup: false`.)

- [ ] **Step 5: Verify the live app serves our branding**

```bash
curl -fsS https://librechat-production-3f7c.up.railway.app/ | grep -o '<title>[^<]*</title>' | head -1
```
Expected: title reflecting "Trader.dev Strategy Lab" (or confirm in a browser: the app loads and MCP Settings lists `traderdev`).

- [ ] **Step 6: Commit**

```bash
git add scripts/set-railway-vars.sh docs/env-reference.md docs/.rollback-config-path
git commit -m "Wire Railway CONFIG_PATH + branding/domain env; add rollback note"
git push
```

---

### Task 4: Seed the Strategy Lab agent (version-controlled)

**Files:**
- Create: `agent/strategy-lab.json`
- Create: `scripts/seed-agent.mjs`

**Interfaces:**
- Consumes: a deployed LibreChat from Task 3 + an owner account.
- Produces: a global agent whose `id` (printed by the script) is consumed by Task 5's `modelSpecs.agent_id`. Agent fields: `name`, `instructions`, `provider: "anthropic"`, `model`, `tools` referencing the `traderdev` MCP, `conversation_starters`, `artifacts: "default"`.

- [ ] **Step 1: Create the owner account (one-time, becomes admin)**

In a browser at `https://librechat-production-3f7c.up.railway.app/register`, register the owner account (Davidd's email). The first registered user is the instance owner. Record `ADMIN_EMAIL` / `ADMIN_PASSWORD` for the seed script (pass via shell env, never commit).

- [ ] **Step 2: Write `agent/strategy-lab.json`**

```json
{
  "name": "Trader.dev Strategy Lab",
  "description": "Backtest and optimise trading strategies in plain English.",
  "provider": "anthropic",
  "model": "claude-sonnet-4-6",
  "artifacts": "default",
  "instructions": "<PASTE docs/agent-system-prompt.md contents>",
  "conversation_starters": [
    "Backtest an RSI mean-reversion on BTC 1h",
    "Build an EMA crossover for ETH and show me the equity curve",
    "Optimise my strategy's RSI length for the best Sharpe",
    "Make this strategy trade less and improve the win rate"
  ],
  "tools": ["traderdev"]
}
```
Note: the exact `tools` shape for MCP tools may be per-tool ids like `mcp_traderdev_quick_backtest` rather than the server name. The seed script (Step 3) lists available tools from the API and attaches all `traderdev` MCP tools; this JSON is the human-readable source.

- [ ] **Step 3: Write `scripts/seed-agent.mjs`**

```javascript
// Usage: BASE=... ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/seed-agent.mjs
import { readFileSync } from "node:fs";

const BASE = process.env.BASE || "https://librechat-production-3f7c.up.railway.app";
const EMAIL = process.env.ADMIN_EMAIL, PASSWORD = process.env.ADMIN_PASSWORD;
if (!EMAIL || !PASSWORD) { console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD"); process.exit(1); }

const def = JSON.parse(readFileSync(new URL("../agent/strategy-lab.json", import.meta.url)));
const prompt = readFileSync(new URL("../docs/agent-system-prompt.md", import.meta.url), "utf8");
def.instructions = prompt;

const login = await fetch(`${BASE}/api/auth/login`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (!login.ok) { console.error("Login failed", login.status, await login.text()); process.exit(1); }
const { token } = await login.json();
const auth = { authorization: `Bearer ${token}`, "content-type": "application/json" };

// Discover existing agents; update if our name already exists, else create.
const listed = await fetch(`${BASE}/api/agents`, { headers: auth }).then(r => r.json()).catch(() => ({}));
const existing = (listed.data || listed.agents || []).find(a => a.name === def.name);

const method = existing ? "PATCH" : "POST";
const url = existing ? `${BASE}/api/agents/${existing.id}` : `${BASE}/api/agents`;
const res = await fetch(url, { method, headers: auth, body: JSON.stringify(def) });
if (!res.ok) { console.error("Agent write failed", res.status, await res.text()); process.exit(1); }
const agent = await res.json();
console.log("AGENT_ID=" + (agent.id || agent._id));

// Best-effort: share globally so all users see it (verify in UI if API shape differs).
try {
  await fetch(`${BASE}/api/agents/${agent.id || agent._id}`, {
    method: "PATCH", headers: auth,
    body: JSON.stringify({ projectIds: ["global"], isCollaborative: true }),
  });
} catch (e) { console.warn("Global-share step skipped; set sharing in the UI.", e.message); }
```

- [ ] **Step 4: Run the seed script and capture the agent id**

```bash
cd /Users/daviddpro/Documents/GitHub/chat.tradingkit.com
BASE=https://librechat-production-3f7c.up.railway.app \
ADMIN_EMAIL='<owner email>' ADMIN_PASSWORD='<owner password>' \
node scripts/seed-agent.mjs
```
Expected: prints `AGENT_ID=agent_xxx`. Save that id for Task 5.

Fallback if the agents API shape differs from this image: open the app → Agents → Create. Name it "Trader.dev Strategy Lab", set provider Anthropic + a Claude model, paste the system prompt from `docs/agent-system-prompt.md`, add all `traderdev` tools, enable Artifacts, add the four conversation starters, set sharing to "global/all users", and copy the agent id from the URL. Either path yields the id Task 5 needs.

- [ ] **Step 5: Verify the agent is selectable**

In the app, start a new chat, open the agent/model picker, confirm "Trader.dev Strategy Lab" is listed and its four starter prompts appear.

- [ ] **Step 6: Commit**

```bash
git add agent/strategy-lab.json scripts/seed-agent.mjs
git commit -m "Add Strategy Lab agent definition + idempotent seed script"
git push
```

---

### Task 5: Pin the agent as default via modelSpecs, redeploy

**Files:**
- Modify: `librechat.yaml` (the `modelSpecs.list[0].preset.agent_id`)

**Interfaces:**
- Consumes: `AGENT_ID` from Task 4.
- Produces: new chats land on the Strategy Lab spec by default.

- [ ] **Step 1: Insert the real agent id**

Replace `REPLACE_IN_TASK_5` in `librechat.yaml` with the `AGENT_ID` from Task 4. Re-validate:
```bash
python3 -c "import yaml; yaml.safe_load(open('librechat.yaml')); print('YAML OK')"
```
Expected: `YAML OK`, and `grep agent_id librechat.yaml` shows the real id.

- [ ] **Step 2: Commit, push, redeploy**

```bash
git add librechat.yaml && git commit -m "Pin Strategy Lab agent as default modelSpec" && git push
railway redeploy --service LibreChat -y
```

- [ ] **Step 3: Verify default landing**

Run:
```bash
sleep 30 && curl -fsS https://raw.githubusercontent.com/daviddme/chat.tradingkit.com/main/librechat.yaml | grep agent_id
```
Expected: raw URL serves the real `agent_id`. Then in a fresh browser session, a new chat opens on "Trader.dev Strategy Lab" by default with the welcome copy.

---

### Task 6: Attach the `chat.tradingkit.com` custom domain

**Files:**
- Create: `docs/dns.md` (the record Davidd must add)

**Interfaces:**
- Consumes: the running LibreChat service.
- Produces: a TLS-served `chat.tradingkit.com` (live once DNS propagates).

- [ ] **Step 1: Create the custom domain on the service**

```bash
TOKEN=$(python3 -c "import json,os;print(json.load(open(os.path.expanduser('~/.railway/config.json')))['user']['accessToken'])")
ENV=63dae6bf-4971-4888-aba5-43b7abbae892
SVC=3b62c68e-9941-4a16-b754-40f7c0f21988
curl -s https://backboard.railway.app/graphql/v2 -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"query\":\"mutation(\$i:CustomDomainCreateInput!){customDomainCreate(input:\$i){id domain status{dnsRecords{hostlabel recordType requiredValue}}}}\",\"variables\":{\"i\":{\"environmentId\":\"$ENV\",\"serviceId\":\"$SVC\",\"domain\":\"chat.tradingkit.com\"}}}" \
  | python3 -m json.tool
```
Expected: returns the custom domain id + the required DNS record (a CNAME `chat` → a `*.up.railway.app` target). If the mutation name/shape differs in the current Railway schema, use the Railway dashboard: LibreChat service → Settings → Networking → Custom Domain → add `chat.tradingkit.com`, and copy the shown CNAME.

- [ ] **Step 2: Write `docs/dns.md` with the exact record**

Record the `hostlabel`, `recordType`, and `requiredValue` from Step 1 so Davidd adds it at the `tradingkit.com` DNS provider, e.g.:
```
Type: CNAME
Name: chat
Value: <target from Step 1>
Proxy/Cloudflare: DNS only (grey cloud) until TLS issues, then optional
```

- [ ] **Step 3: Verify (after Davidd adds the record)**

```bash
dig +short chat.tradingkit.com
curl -fsS -o /dev/null -w "HTTP %{http_code}\n" https://chat.tradingkit.com/
```
Expected: `dig` shows the Railway target; once Railway issues TLS, the curl returns `HTTP 200`. (Propagation + cert can take minutes to an hour.)

- [ ] **Step 4: Commit**

```bash
git add docs/dns.md && git commit -m "Add chat.tradingkit.com custom domain + DNS record" && git push
```

---

### Task 7: End-to-end acceptance verification

**Files:**
- Create: `docs/acceptance-2026-06-28.md` (results log)

**Interfaces:**
- Consumes: everything above + a freshly minted test `pk_` key.

- [ ] **Step 1: Mint a test `pk_` key**

Use the Trader.dev MCP `create_api_key` tool (available in this Claude session) to mint a customer-scoped `pk_` key for testing. Record only that it was minted (never commit the key).

- [ ] **Step 2: Connect the MCP in the deployed app**

In the app: MCP Settings → traderdev → paste the `pk_` key → reinitialise. Expected: `traderdev` shows **connected/green**.

- [ ] **Step 3: Run the headline backtest**

Send: "Backtest an RSI mean-reversion on BTC 1h". Expected: the agent shows a ```pine block, calls `quick_backtest`, reports a real `resultId` plus net %, win rate, profit factor, Sharpe, max DD, and renders the **HTML artifact dashboard** charting the equity curve (the inline `card.svg` will 404 until Phase 0 ships, and the agent must fall back to the artifact, not show a broken image).

- [ ] **Step 4: Iterate**

Send: "Make it trade less". Expected: the agent versions the strategy, re-runs `quick_backtest`, and shows a new result. Confirms the iteration loop.

- [ ] **Step 5: Record results**

Write pass/fail for each acceptance item (spec §11) into `docs/acceptance-2026-06-28.md`, noting `card.svg`/`heatmap.svg` as blocked-on-Phase-0 and the artifact dashboard as the working substitute.

- [ ] **Step 6: Commit**

```bash
git add docs/acceptance-2026-06-28.md && git commit -m "Record Phase 1 acceptance results" && git push
```

---

## Self-Review

**Spec coverage:** Deploy/config-repo (Tasks 1-3) ✓; traderdev MCP + customUserVars (Task 2) ✓; Strategy Lab agent + system prompt + starters (Tasks 2,4) ✓; Artifacts capability + dashboard fallback (Tasks 2,7) ✓; branding name/welcome/footer/prompts (Tasks 2,3,4) ✓; custom domain (Task 6) ✓; acceptance checklist §11 (Task 7) ✓; cost-guardrail limits (Task 3, retained from template) ✓. Deferred and labelled: logo/accent overlay image, Phase 0 SVG endpoints, Phase 2 Clerk/OIDC, Phase 3 credits/tiers.

**Placeholder scan:** The only intentional placeholders are `agent_id: REPLACE_IN_TASK_5` (resolved in Task 5 from Task 4's output) and the `<PASTE ...>` markers for the system prompt (a deliberate copy of `docs/agent-system-prompt.md`, content defined in Task 2 Step 1). No "TBD"/"handle edge cases" hand-waving.

**Type/name consistency:** `TRADERDEV_API_KEY` (env var), `traderdev` (MCP server name + agent tool ref), `AGENT_ID` (Task 4 output → Task 5 input), service name `LibreChat`, raw URL identical across Tasks 1/3/5. Consistent.

**Known drift risks (flagged inline, not blockers):** exact `librechat.yaml` schema for the running image version, the LibreChat agents API shape (UI fallback provided in Task 4), and the Railway `customDomainCreate` mutation shape (dashboard fallback provided in Task 6).

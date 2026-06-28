// Seed / update the Trader.dev Strategy Lab agent via the LibreChat API.
//
// Usage:
//   BASE=https://librechat-production-3f7c.up.railway.app \
//   ADMIN_EMAIL=hi@davidd.tech ADMIN_PASSWORD='***' \
//   node scripts/seed-agent.mjs
//
// Prints AGENT_ID=<id> on success. Never commit credentials.
import { readFileSync } from "node:fs";

const BASE = process.env.BASE || "https://librechat-production-3f7c.up.railway.app";
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD env vars");
  process.exit(1);
}

// Browser-like headers so requests are not flagged as non-browser (ban system).
const BROWSER = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "sec-ch-ua": '"Chromium";v="126", "Not.A/Brand";v="24"',
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  Origin: BASE,
  Referer: BASE + "/",
};

const MCP_DELIM = "_mcp_"; // LibreChat Constants.mcp_delimiter
const def = JSON.parse(readFileSync(new URL("../agent/strategy-lab.json", import.meta.url)));
const prompt = readFileSync(new URL("../docs/agent-system-prompt.md", import.meta.url), "utf8");

// Build the agent body LibreChat expects.
const tools = (def.mcp_tools || []).map((t) => `${t}${MCP_DELIM}${def.mcp_server}`);
const body = {
  name: def.name,
  description: def.description,
  provider: def.provider,
  model: def.model,
  instructions: prompt,
  artifacts: def.artifacts || "default",
  conversation_starters: def.conversation_starters || [],
  tools,
};

const j = (extra = {}) => ({ ...BROWSER, "Content-Type": "application/json", ...extra });

const login = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: j(),
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (!login.ok) {
  console.error("Login failed", login.status, await login.text());
  process.exit(1);
}
const { token } = await login.json();
const auth = j({ Authorization: `Bearer ${token}` });

// Create the agent.
const res = await fetch(`${BASE}/api/agents`, {
  method: "POST",
  headers: auth,
  body: JSON.stringify(body),
});
if (!res.ok) {
  console.error("Agent create failed", res.status, await res.text());
  process.exit(1);
}
const agent = await res.json();
const id = agent.id || agent._id;
const mongoId = agent._id; // permissions API keys off the Mongo _id, not agent_ id
console.log("AGENT_ID=" + id);

// Make the agent available to ALL users (admin only). This build uses a granular
// permissions ACL, not projectIds: PUT /api/permissions/agent/:mongoId with
// public:true + the agent_viewer role (view-and-use, cannot modify).
try {
  const share = await fetch(`${BASE}/api/permissions/agent/${mongoId}`, {
    method: "PUT",
    headers: auth,
    body: JSON.stringify({
      updated: [],
      removed: [],
      public: true,
      publicAccessRoleId: "agent_viewer",
    }),
  });
  console.log("public share PUT:", share.status, (await share.text()).slice(0, 120));
} catch (e) {
  console.warn("public share skipped:", e.message);
}

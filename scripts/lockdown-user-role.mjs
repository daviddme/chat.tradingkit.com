// Lock down the USER role so it is an admin-controlled environment:
// users can USE the shared agent + chat + projects + backtests, but cannot
// CREATE agents, skills, prompts, or MCP servers, and have no marketplace.
// Admins keep full control. Re-run after any LibreChat reset.
//
// Usage:
//   BASE=https://librechat-production-3f7c.up.railway.app \
//   ADMIN_EMAIL=hi@davidd.tech ADMIN_PASSWORD='***' node scripts/lockdown-user-role.mjs
//
// Endpoint shape (this build): PUT /api/roles/:role/:permission  body = flags.
import { } from "node:process";
const BASE = process.env.BASE || "https://librechat-production-3f7c.up.railway.app";
const EMAIL = process.env.ADMIN_EMAIL, PASSWORD = process.env.ADMIN_PASSWORD;
if (!EMAIL || !PASSWORD) { console.error("Set ADMIN_EMAIL/ADMIN_PASSWORD"); process.exit(1); }
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36";
const H = { "User-Agent": UA, "Content-Type": "application/json" };

const lg = await (await fetch(`${BASE}/api/auth/login`, { method:"POST", headers:H,
  body: JSON.stringify({ email:EMAIL, password:PASSWORD }) })).json();
const A = { ...H, Authorization: "Bearer " + lg.token };

const LOCK = {
  AGENTS:      { USE:true, CREATE:false, SHARE:false, SHARE_PUBLIC:false },
  SKILLS:      { USE:true, CREATE:false, SHARE:false, SHARE_PUBLIC:false },
  PROMPTS:     { USE:true, CREATE:false, SHARE:false, SHARE_PUBLIC:false },
  MCP_SERVERS: { USE:true, CREATE:false, SHARE:false, SHARE_PUBLIC:false, CONFIGURE_OBO:false },
  MARKETPLACE: { USE:false },
};
for (const [perm, body] of Object.entries(LOCK)) {
  const r = await fetch(`${BASE}/api/roles/USER/${perm}`, { method:"PUT", headers:A, body: JSON.stringify(body) });
  console.log(perm, r.status);
}
const after = await (await fetch(`${BASE}/api/roles/USER`, { headers:A })).json();
console.log("USER AGENTS:", JSON.stringify(after.permissions.AGENTS));
console.log("USER SKILLS:", JSON.stringify(after.permissions.SKILLS));

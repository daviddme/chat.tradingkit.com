# Bug: `POST /provision/user` 500s — `column reference "display_name" is ambiguous`

**Severity:** blocks per-user provisioning from LibreChat (the whole point of the
provisioning API). **Read path is fine; only the create/POST path is broken.**

## What happens

Every `POST /provision/user` returns HTTP 500:

```json
{"statusCode":500,"code":"42702","error":"Internal Server Error",
 "message":"column reference \"display_name\" is ambiguous"}
```

`42702` is Postgres `ambiguous_column`. It fires **with or without** `displayName`
in the request body, so it's not the input — it's an unqualified `display_name`
column in a query that joins two+ tables which both have a `display_name` column
(e.g. a users/profile JOIN, or an INSERT ... RETURNING / CTE that references
`display_name` without a table alias).

## Reproduce

```bash
ADMIN="tdsk_admin_…"

# with displayName -> 500
curl -s -X POST https://mcp-api.trader.dev/provision/user \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"email":"probe@example.com","displayName":"Probe"}'

# WITHOUT displayName -> still 500
curl -s -X POST https://mcp-api.trader.dev/provision/user \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"email":"probe@example.com"}'
```

The read path is healthy:

```bash
# GET works fine, returns {"exists":false} for a new email
curl -s "https://mcp-api.trader.dev/provision/user?email=probe@example.com" \
  -H "Authorization: Bearer $ADMIN"
```

## Fix

In the provisioning create handler's SQL, **table-qualify every `display_name`
reference** (e.g. `users.display_name` / `u.display_name` vs `profiles.display_name`).
The ambiguity is almost certainly in the INSERT/UPSERT or the SELECT that joins
the user and profile/subscription tables. Once qualified, the 500 goes away.

## Our side (LibreChat) — already done, waiting on this fix

The LibreChat login bridge already calls `POST /provision/user { email, displayName }`
on every Clerk sign-in and stores the returned `apiKey` as the user's per-user MCP
key. It's idempotent + best-effort (a 500 just logs and is skipped, login still
succeeds). The moment this endpoint returns 2xx with an `apiKey`, per-user keys
start flowing with zero further changes on our side — we just flip the MCP server
URL from the shared admin key to `{{TRADERDEV_KEY}}`.

**No response shape change needed** — the documented 201/200 bodies are exactly
what we consume. Just fix the SQL so the insert succeeds.

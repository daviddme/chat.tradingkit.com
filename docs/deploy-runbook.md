# Deploy / update runbook

## Architecture in one line

Railway runs the official LibreChat image; it loads this repo's `librechat.yaml`
via `CONFIG_PATH`. No fork.

- Railway project `LibraChat` (`31bc35e7-1c39-4f96-910a-ad8f747146cd`), env `production`.
- Service `LibreChat` (`3b62c68e-9941-4a16-b754-40f7c0f21988`).
- Public: `https://chat.tradingkit.com` (+ `librechat-production-3f7c.up.railway.app`).

## Change the chat config (the common case)

1. Edit `librechat.yaml`.
2. Validate: `npx --yes js-yaml librechat.yaml >/dev/null && echo OK`.
3. Commit + push to `main`.
4. Redeploy so the boot re-fetches the config:
   `railway redeploy --service LibreChat -y`
5. Confirm load:
   `railway logs --service LibreChat | grep -iE 'Custom config file loaded|MCP\]\[trader-dev'`

> Always redeploy after a yaml change. The config is read once at boot.

## Change env

Use `scripts/set-railway-vars.sh` (idempotent), then redeploy.

## Re-seed / update the agent

`BASE=https://librechat-production-3f7c.up.railway.app ADMIN_EMAIL=… ADMIN_PASSWORD=… node scripts/seed-agent.mjs`
(prints `AGENT_ID`). If the agent_id changes, update `modelSpecs` in
`librechat.yaml` and redeploy.

The script also makes the agent **public to all users** via this build's ACL:
`PUT /api/permissions/agent/<mongo _id>` with
`{"public":true,"publicAccessRoleId":"agent_viewer"}` (view-and-use, no edit).
This is required for a public app: without it, non-owner users get 403 on the
agent. (Equivalent UI action: Agent Builder → select agent → Share → "Share with
everyone".)

## Verify health

```
curl -fsS https://chat.tradingkit.com/api/config | python3 -c "import sys,json;print(json.load(sys.stdin)['appTitle'])"
```

## Rollback

See `docs/env-reference.md` (restore the original `CONFIG_PATH`, redeploy).

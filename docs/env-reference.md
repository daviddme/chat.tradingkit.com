# Railway env reference (LibreChat service)

These are the vars **we** set or rely on. The Railway template set many more
(JWT_SECRET, CREDS_KEY/IV, MONGO_URI, MEILI_*, RAG_API_URL, ANTHROPIC_API_KEY,
rate-limit knobs); leave those as-is.

## Set by `scripts/set-railway-vars.sh`

| Var | Value | Why |
|---|---|---|
| `CONFIG_PATH` | `https://raw.githubusercontent.com/daviddme/chat.tradingkit.com/main/librechat.yaml` | LibreChat loads our config from this repo at boot. **This is the sync-to-GitHub hook.** |
| `APP_TITLE` | `Trader.dev Strategy Lab` | Visible app name. |
| `CUSTOM_FOOTER` | `Trader.dev Strategy Lab` | Footer text. (Newer images prefer `interface.customFooter` in yaml.) |
| `DOMAIN_CLIENT` | `https://chat.tradingkit.com` | Canonical client URL (links, CORS, future OAuth callbacks). |
| `DOMAIN_SERVER` | `https://chat.tradingkit.com` | Canonical server URL. |
| `ENDPOINTS` | `agents,anthropic` | Focus the UI on the Strategy Lab agent + Claude. |

## Relied on (already set by the template)

| Var | Note |
|---|---|
| `ANTHROPIC_API_KEY` | Pays for inference (Phase 1; metered per-user in Phase 3). |
| `ALLOW_REGISTRATION=true` | Open email registration (Phase 1 public). |
| `CHECK_BALANCE` | **Deprecated.** Phase 3 uses the `balance:` block in `librechat.yaml` instead. |
| `BAN_VIOLATIONS=false` | **Deliberately disabled.** The template default (`true` + `NON_BROWSER_VIOLATION_SCORE=20`) instant-bans real users/admin on minor triggers (repeated logins, non-browser API calls) for 2h. Too aggressive for a public app. Keep off, or re-enable only with much gentler thresholds. Rate limits (`LIMIT_MESSAGE_*`, `LOGIN_MAX`) still apply without banning. |
| `NON_BROWSER_VIOLATION_SCORE=0` | Set to 0 so API/script access is not instant-banned. |
| `CREDS_KEY` / `CREDS_IV` | **Regenerated 2026-06-28.** The one-click template shipped 14-char placeholders, which made customUserVar encryption fail (`Invalid key length`) so NO user could save their `pk_` MCP key. Now proper lengths: `CREDS_KEY` = 64 hex (32 bytes), `CREDS_IV` = 32 hex (16 bytes). Generate with `openssl rand -hex 32` / `openssl rand -hex 16`. Rotating them invalidates previously-encrypted user secrets (none existed, since saves were failing). |

## Rollback

Original `CONFIG_PATH` (pre-change) is saved in `docs/.rollback-config-path`:
`https://raw.githubusercontent.com/LibreChat-AI/librechat-config-yaml/main/librechat-up-l.yaml`

To roll back the config entirely:
`railway variables --service LibreChat --set "CONFIG_PATH=<original>"` then
`railway redeploy --service LibreChat -y`.

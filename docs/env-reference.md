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

## Rollback

Original `CONFIG_PATH` (pre-change) is saved in `docs/.rollback-config-path`:
`https://raw.githubusercontent.com/LibreChat-AI/librechat-config-yaml/main/librechat-up-l.yaml`

To roll back the config entirely:
`railway variables --service LibreChat --set "CONFIG_PATH=<original>"` then
`railway redeploy --service LibreChat -y`.

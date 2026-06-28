#!/usr/bin/env bash
# Idempotent Railway env wiring for the LibreChat service.
# Run: bash scripts/set-railway-vars.sh   (then redeploy)
set -euo pipefail

SVC="LibreChat"
RAW="https://raw.githubusercontent.com/daviddme/chat.tradingkit.com/main/librechat.yaml"
DOMAIN="https://chat.tradingkit.com"

railway service "$SVC" >/dev/null 2>&1 || true

railway variables --service "$SVC" --skip-deploys \
  --set "CONFIG_PATH=$RAW" \
  --set "APP_TITLE=Trader.dev Strategy Lab" \
  --set "CUSTOM_FOOTER=Trader.dev Strategy Lab" \
  --set "DOMAIN_CLIENT=$DOMAIN" \
  --set "DOMAIN_SERVER=$DOMAIN" \
  --set "ENDPOINTS=agents,anthropic"

echo "Vars set (deploy skipped). Redeploy with: railway redeploy --service $SVC -y"

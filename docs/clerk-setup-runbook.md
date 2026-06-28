# Clerk setup — what David does, what I need

Clerk app: `app_3FlwW9tqfyzflLICIzk58W5YuD7` (created). Our app is a forked
LibreChat (React+Vite + Express), so I integrate Clerk by hand, not via `clerk init`.

## DONE (keys received + wired)

Clerk test keys (`pk_test_…` / `sk_test_…`, instance `optimal-mosquito-78`) are set
on the **staging** Railway service and the full integration is built + deploying:
- Clerk sign-in gate (runtime-gated on the publishable key; prod stays native until
  we flip it).
- `/api/clerk/session` bridge: verify Clerk token → find-or-create LibreChat user →
  force `hi@davidd.tech` → ADMIN → issue LibreChat session.
- Plan→credits (free 50k / pro 1M / pro_plus 5M), granted at sign-in + on webhook.
- In-app **Upgrade** button → Clerk Billing `<PricingTable/>` + `UserButton`.

Test URL (staging): **https://tradingkit-staging-production.up.railway.app**

## YOUR REMAINING DASHBOARD STEPS

### A. Enable Billing + create the 3 plans
dashboard.clerk.com → TradingKit → **Billing** → enable (connect Stripe; test mode
is fine). Create **3 plans with these exact slugs** so the credit mapping matches:
- `free` — $0
- `pro` — your monthly price
- `pro_plus` — your monthly price

(If you prefer different slugs, tell me and I'll update the mapping. Credit amounts
per plan are in `api/server/services/Clerk/planCredits.js` and easy to tune.)

### B. Add the credit-grant webhook
dashboard.clerk.com → TradingKit → **Webhooks** → add endpoint:
- URL: `https://tradingkit-staging-production.up.railway.app/api/clerk/webhook`
- Subscribe to the **subscription** / **subscriptionItem** events.
- Copy the **Signing Secret** (`whsec_…`) and paste it to me — I'll set
  `CLERK_WEBHOOK_SIGNING_SECRET` on staging. (Sign-in-time credit sync already
  works without this; the webhook just keeps balances fresh on mid-session upgrades.)

## What's already done on my side
- `hi@davidd.tech` forced to ADMIN (User model) + exempt from credit metering.
- Credit metering tested on staging (admin unlimited; non-admins metered).
- Plan→credits mapping unit-tested.

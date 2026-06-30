# Clerk satellite SSO — let Trader.dev members into TradingKit

**Goal:** A Trader.dev member signs in on chat.tradingkit.com with their existing
Trader.dev account (no new signup), and their **Trader.dev plan governs their
TradingKit access + credits**.

**Mechanism:** TradingKit becomes a **satellite domain** of Trader.dev's Clerk
application (one Clerk instance, one user pool, shared session across trader.dev
and chat.tradingkit.com). This replaces TradingKit's standalone Clerk app.

---

## Why "just reuse the keys" isn't enough
The `pk_`/`sk_` identify Trader.dev's Clerk **instance**, but Clerk locks each
instance to its authorized domains. Dropping the keys onto chat.tradingkit.com
without registering it gets rejected (wrong origin). Satellite domains are the
supported way to authorize a second domain on the same instance.

---

## Prerequisites (human-gated — you / the Trader.dev Clerk owner)

1. **Use Trader.dev's PRODUCTION Clerk instance.** Satellite domains don't work on
   Clerk dev instances. So this is configured against chat.tradingkit.com (prod),
   not the Railway staging subdomain (we can't add a satellite on *.up.railway.app
   since we don't control its DNS).

2. **Add the satellite domain** in Trader.dev's Clerk dashboard:
   dashboard.clerk.com → (Trader.dev app) → **Domains** → add satellite
   `chat.tradingkit.com`. Clerk will give you a **CNAME** (e.g.
   `clerk.chat.tradingkit.com` -> Clerk's frontend API). Add it at your DNS host
   and let Clerk verify it.

3. **Send me Trader.dev's production keys:** `pk_live_…` (publishable) and
   `sk_live_…` (secret). I store the secret as a Railway env var only.

4. **Tell me the Trader.dev primary sign-in URL** (e.g. `https://trader.dev/sign-in`
   or `https://accounts.trader.dev/sign-in`) — satellite logins redirect there.

5. **Plan → credits:** list Trader.dev's tiers and the monthly TradingKit credit
   each should grant, e.g.:
   | Trader.dev tier | TradingKit monthly credits |
   |---|---|
   | free | 50,000 |
   | starter | 1,000,000 |
   | pro | 5,000,000 |
   (Your numbers — I'll wire whatever you choose.)

---

## What I do (code side, once I have 1–4)

1. Reconfigure TradingKit's `ClerkProvider` as a satellite:
   `isSatellite: true`, `domain: 'chat.tradingkit.com'`,
   `signInUrl: '<trader.dev sign-in>'`, using Trader.dev's `pk_live_`.
2. Swap the bridge to verify tokens with Trader.dev's `sk_live_`.
3. **Source the plan from Trader.dev, not the Clerk token:** on login the bridge
   already provisions/looks up the member's Trader.dev account
   (`mcp-api.trader.dev/provision/user`) and gets their `tier`. I map that tier ->
   TradingKit monthly credits (your table above) via the existing
   `planCredits.js` + `syncPlanCredits`. So a Trader.dev Pro member automatically
   gets Pro-level TradingKit credits, no separate TradingKit checkout.
4. `hi@davidd.tech` stays force-ADMIN (unlimited) regardless of tier.

---

## Notes / constraints
- This is a **prod-domain** change. We configure + verify on chat.tradingkit.com.
  Staging keeps the standalone TradingKit Clerk app for safe iteration; the
  satellite is prod-only because of the domain/DNS requirement.
- TradingKit's standalone Clerk app (`optimal-mosquito-78`) is retired for prod
  once the satellite is live; its `pk_test_/sk_test_` stay on staging only.
- Existing TradingKit-native (email/password) prod users keep working — native
  login + Clerk satellite can coexist (Clerk gate activates when the publishable
  key is present; native is the fallback). We can hard-require Clerk later.
- Credit metering on prod stays OFF until the tier->credit mapping is verified, so
  nobody is wrongly blocked during rollout.

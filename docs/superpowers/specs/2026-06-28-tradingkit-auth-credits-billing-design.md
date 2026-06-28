# TradingKit auth + credits + billing — design

**Date:** 2026-06-28 · **Status:** approved, implementing on the fork.

## Decisions (locked)
- **TradingKit is its own product** with its own subscriptions (not reusing Trader.dev's billing).
- **Identity:** TradingKit's own **Clerk** app (new). Full Clerk SDK + **Clerk Billing**.
- **Admin:** `hi@davidd.tech` is ALWAYS admin and ALWAYS unlimited (exempt from metering).
- **Backtests run on the admin Trader.dev key (`unlimited`)** behind the scenes, so backtests cost us nothing on Trader.dev; users are gated purely by TradingKit credits.

## Credit model — one ledger
Reuse LibreChat's per-user **balance** (`tokenCredits`) as the single credit pool:
- **AI messages** debit by tokens (native; per-model rates). Backtest-heavy chats already
  cost more (large tool results inflate tokens).
- **Flat per-backtest charge:** deferred refinement (the clean hook needs a DB-bound
  transaction method not available in MCPManager; token metering covers it for v1).
- **Admins / `hi@davidd.tech`:** exempt (always allowed). Implemented in
  `packages/api/src/middleware/checkBalance.ts` (early-return).

## Plans (Clerk Billing → Stripe), starting point — David sets real prices/numbers
| Plan | Price/mo | Monthly credits | Optimisation |
|---|---|---|---|
| Free | $0 | ~50k | off / 1-a-day |
| Pro | $TBD | ~1M | on |
| Pro Plus | $TBD | ~5M | on, priority |

## Components / build phases (each shippable on the fork)
- **3a — Credit metering + admin exemption** (DONE in code, testing on staging): exempt
  admins, re-enable balance, token metering. Staging tested with its own
  `librechat-staging.yaml` (balance ON, 30k start) so prod stays off until validated.
- **2a — Clerk auth** (needs Clerk keys): embed Clerk for sign-up/in; force
  `hi@davidd.tech` → ADMIN on login. Hook: `api/server/socialLogins.js` + a clerk
  strategy (or Clerk React SDK in `client/`).
- **2b — Clerk Billing** (needs Clerk Billing + Stripe): Free/Pro/Pro Plus plans, in-app
  Pricing Table / upgrade, read the user's plan.
- **3b — Credit grants** (needs webhook secret): Clerk subscription webhook → set the
  user's monthly balance; out-of-credits → friendly upgrade prompt.

## Hard dependency
Clerk app + Clerk Billing/Stripe credentials (only David can create these):
`CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and the Clerk webhook signing secret.
Auth + billing cannot be built/tested without them. Everything else (credit metering +
admin exemption) is built and testable now.

## Rollout
Validate on staging (`tradingkit-staging`) → deploy fork code to prod → flip prod
config to metering-ON only after prod runs the admin-exemption build (else the admin
gets blocked).

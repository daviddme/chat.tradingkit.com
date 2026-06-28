# Phase 3 — Credits + tiers (STAGED, not active)

Three tiers, credit-metered by tokens (input + output):

| Tier | Idea |
|---|---|
| **Claude Free** | Small monthly/weekly credit grant, auto-refill. |
| **Pro** | Larger grant. |
| **Pro Plus** | Largest grant / extra top-ups. |

## Two layers

### Layer A — native token metering (LibreChat built-in)

LibreChat already debits a per-user **balance** by token usage, with per-model
rates. The boot logs confirmed the modern hook: **use the `balance:` block in
`librechat.yaml`** (the old `CHECK_BALANCE` env is deprecated).

Add to `librechat.yaml` (verify exact field names against the running image
before enabling):

```yaml
balance:
  enabled: true
  startBalance: 20000        # credits granted to a new (Free) user
  autoRefillEnabled: true
  refillIntervalValue: 7
  refillIntervalUnit: "days" # Free tier weekly top-up
  refillAmount: 20000
```

Credits are token-denominated; LibreChat applies per-model multipliers
(`endpoints` / `transactions`). 1 credit ~= 1 token by default, so size the
grants in tokens. Tune multipliers so Claude Sonnet/Opus usage maps to your
intended dollar cost per tier.

> Enabling `balance` on the LIVE Phase-1 app immediately starts charging every
> user and can lock people out if grants are wrong. Do NOT flip this on until the
> tiers + billing (Layer B) are wired and tested on a staging deploy.

### Layer B — tier → credit grant (custom glue, needs your billing account)

`balance` is global; per-tier grants need an external trigger. Pattern:

1. Subscriptions live in **Clerk Billing** (Trader.dev already uses Clerk, see
   `docs/phase2-clerk-oidc.md`) or **Stripe**.
2. A small **webhook** receives `subscription.created/updated/deleted` and maps
   plan → credit grant:
   - Free → default `startBalance` + weekly refill (Layer A).
   - Pro → set balance / monthly refill amount X.
   - Pro Plus → amount Y (+ optional one-off top-up purchases).
3. The webhook writes the user's balance. Options, cleanest first:
   - LibreChat `Balance` collection in Mongo keyed by the user `_id` (resolve the
     user by Clerk email/sub). LibreChat ships a `set-balance` script as a
     reference for the shape.
   - Or an internal admin endpoint if exposed.

This webhook is the **only** net-new service in Phase 3. It is small but needs
your Clerk/Stripe keys, so it is credential-gated.

## Important: two separate credit systems, never merged

- **Chat credits** (this doc) = LibreChat token balance = the Free/Pro/Pro Plus
  tiers. Pays for Claude inference.
- **Trader.dev credits** = the `pk_` account's backtest/optimisation credits
  (managed by the Trader.dev MCP/API, the `get_credits` tool, weekly free grant).

A customer has both. The chat UI should label them distinctly so users are not
confused. Surfacing Trader.dev credit balance in chat is already handled by the
agent (it can call `get_credits`).

## Rollout order

1. Phase 2 (Clerk identity) first, so each user has a stable Clerk id/email.
2. Stand up the billing webhook on a **staging** LibreChat (separate Railway
   service or env) with `balance` enabled; test all three tier transitions.
3. Only then enable `balance` on production and announce metering.

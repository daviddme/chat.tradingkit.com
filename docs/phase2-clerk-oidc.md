# Phase 2 — Clerk auth via OpenID Connect (STAGED, not active)

Phase 1 ships with open LibreChat email registration. Phase 2 routes sign-in
through **Clerk**, wired as a generic **OpenID Connect** provider (LibreChat has
no native Clerk SDK, but it has first-class OpenID support).

## Key finding (2026-06-28): Trader.dev ALREADY uses Clerk

The Trader.dev key page (`mcp-api.trader.dev/login`) is **"Secured by Clerk"**,
with sign-up/sign-in at **`accounts.trader.dev`** (a Clerk instance), offering
Apple / Google / email. This is a big deal for Phase 2:

- Wire `chat.tradingkit.com` to the **same Clerk instance** (`accounts.trader.dev`)
  so a customer has **one identity** across Trader.dev and the chat (true SSO).
- It also means the Trader.dev `pk_` key and the chat login can eventually be the
  **same account**, which is exactly the "auto-generate the key" endgame: once a
  user signs in via Clerk, Trader.dev can mint/return their `pk_` automatically
  (replacing the temporary manual paste area).

## ⚠️ Credential-gated + one thing to verify first

1. **Needs your Clerk account.** I cannot read the `accounts.trader.dev` Clerk
   app's client secret. You expose an OIDC/OAuth application in that Clerk
   instance for the chat; I wire LibreChat to it.
2. **Verify Clerk can act as an OIDC *provider* (IdP) for a third-party RP.**
   Clerk is normally the RP-facing SDK for your own app. Acting as a standard
   OIDC *identity provider* that an external app (LibreChat) consumes is a
   distinct capability ("Clerk as OAuth/OIDC provider"), available on certain
   Clerk plans. **Confirm this is enabled before relying on this path.** If Clerk
   cannot be a standard OIDC IdP, the fallback options are: (a) use Clerk's
   normal social/OAuth connections and let LibreChat use those providers
   directly, or (b) put Clerk's hosted UI in front and bridge sessions, or
   (c) reconsider whether Clerk is the right tool vs LibreChat's built-in OpenID
   against another IdP. Decide this before building.

## Wiring (once Clerk OIDC is confirmed)

Create a Clerk OAuth/OIDC application and collect:
- Issuer / discovery URL (e.g. `https://<your-clerk-domain>/.well-known/openid-configuration`)
- Client ID
- Client Secret
- Allowed redirect: `https://chat.tradingkit.com/oauth/openid/callback`

Set on the Railway `LibreChat` service (do NOT commit secrets):

```
ALLOW_SOCIAL_LOGIN=true
ALLOW_SOCIAL_REGISTRATION=true

OPENID_ISSUER=https://<your-clerk-domain>            # OIDC discovery base
OPENID_CLIENT_ID=<clerk client id>
OPENID_CLIENT_SECRET=<clerk client secret>
OPENID_SESSION_SECRET=<random 32+ char string>
OPENID_SCOPE=openid profile email
OPENID_CALLBACK_URL=/oauth/openid/callback
OPENID_BUTTON_LABEL=Continue with Trader.dev
OPENID_IMAGE_URL=
# Optional: force everyone through Clerk (hide email login)
# OPENID_AUTO_REDIRECT=true
```

To make Clerk the only path, also disable raw email registration/login once
Clerk works:
```
ALLOW_REGISTRATION=false
ALLOW_EMAIL_LOGIN=false
```

Redeploy. Verify the "Continue with Trader.dev" button appears at
`/login` and a Clerk sign-in completes a round trip back into the app.

## Mapping to Phase 3 credits

Clerk's `sub` (user id) and email become the LibreChat user identity. The Phase 3
billing webhook keys credit grants off that same identity. See
`docs/phase3-credits-tiers.md`.

## Verify flag spellings

LibreChat OpenID env names drift between versions. Confirm the exact
`OPENID_*` variable names against the LibreChat docs for the running image
before flipping this on.

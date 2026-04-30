# Back-Channel Logout — Keycloak vs WorkOS

## How each provider notifies the BFF of a session revocation

| | Keycloak | WorkOS |
|---|---|---|
| Session ID source | `sid` claim in `id_token` JWT | `sid` claim in `accessToken` JWT |
| Logout notification | OIDC back-channel logout spec (RFC) — sends a signed `logout_token` JWT in a URL-encoded POST body | Proprietary webhook — sends a `session.revoked` event in a JSON POST body with a signature header |
| Signature verification | JWKS public key fetched from Keycloak's `/certs` endpoint (RSA-SHA256) | `workos.webhooks.constructEvent` using a webhook secret from the WorkOS dashboard (HMAC) |
| Normalized return | `{ sid }` | `{ sid }` |

## Unified flow

Despite the different mechanisms, both providers go through the same code path in the BFF:

```
Auth provider → POST /auth/backchannel-logout
  → adapter.verifyLogoutToken({ rawBody, headers })
  → returns { sid }
  → look up providerSidToSessionId map
  → destroy BFF session in session store
```

## Configuration

**Keycloak**: register the back-channel logout URL in the client config:
```json
"backchannel.logout.url": "https://your-bff/auth/backchannel-logout"
```

**WorkOS**: register a webhook endpoint in the WorkOS dashboard pointing to
`POST https://your-bff/auth/backchannel-logout`, subscribing to the
`session.revoked` event. Copy the webhook secret into `WORKOS_WEBHOOK_SECRET`.

## Production note

`providerSidToSessionId` is currently an in-memory `Map` in the BFF process.
With multiple BFF instances this must be replaced with a shared Redis store
so all instances see the same mapping and any instance can handle the
back-channel logout request from the provider.

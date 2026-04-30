const crypto = require('crypto')
const express = require('express')
const config = require('../../shared/config')
const WorkOSAdapter = require('../adapters/WorkOSAdapter')
const KeycloakAdapter = require('../adapters/KeycloakAdapter')

const router = express.Router()

const adapters = {
  workos: new WorkOSAdapter({
    apiKey: config.workosApiKey,
    clientId: config.workosClientId,
    webhookSecret: config.workosWebhookSecret,
  }),
  keycloak: new KeycloakAdapter({
    baseUrl: config.keycloakBaseUrl,
    realm: config.keycloakRealm,
    clientId: config.keycloakClientId,
    clientSecret: config.keycloakClientSecret,
    idpHint: config.keycloakIdpHint,
  }),
}

const auth = adapters[config.authProvider] ?? adapters.workos

// Maps provider session ID → BFF session ID.
// Allows the back-channel logout route to find and destroy the correct BFF
// session when the auth provider notifies us that a session has ended.
// In production with multiple BFF instances this must be replaced with a
// shared store (e.g. a Redis hash) so all instances see the same mapping.
const providerSidToSessionId = new Map()

function extractOrigin(url) {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

// Sign a nonce so the callback can verify it wasn't tampered with.
// codeVerifier and returnTo stay server-side in the session, keyed by nonce.
// OAuth 2.0 (RFC 6749) requires the authorization server to echo back the
// 'state' parameter unchanged in the callback. We exploit this to carry a
// signed nonce through the round-trip without storing it server-side.
// PKCE (RFC 7636) adds code_challenge/code_verifier on top for extra protection.
function createState(nonce) {
  const sig = crypto.createHmac('sha256', config.sessionSecret).update(nonce).digest('base64url')
  // nonce: ties the callback back to the correct pkce session entry
  // sig:   proves the nonce was issued by this BFF, preventing attackers from
  //        brute-forcing arbitrary nonces to fish for valid session entries
  return `${nonce}.${sig}`
}

function parseState(state) {
  const [nonce, sig] = state.split('.')
  if (!nonce || !sig) throw new Error('Malformed state')
  const expected = crypto.createHmac('sha256', config.sessionSecret).update(nonce).digest('base64url')
  if (sig !== expected) throw new Error('Invalid state signature')
  return nonce
}

router.get('/session', (req, res) => {
  if (req.session.user) {
    const { firstName, lastName, email } = req.session.user
    return res.json({ authenticated: true, user: { firstName, lastName, email } })
  }
  res.json({ authenticated: false })
})

router.get('/login', async (req, res) => {
  const origin = extractOrigin(req.query.returnTo)
  if (!origin || !config.frontendUrls.includes(origin)) {
    return res.status(400).send('Invalid or missing returnTo parameter')
  }

  const nonce = crypto.randomBytes(16).toString('base64url')
  const codeVerifier = crypto.randomBytes(32).toString('base64url')
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')
  const state = createState(nonce)

  req.session[`pkce_${nonce}`] = { codeVerifier, returnTo: origin }

  const authUrl = auth.getAuthorizationUrl({
    redirectUri: `${config.bffUrl}/auth/callback`,
    codeChallenge,
    codeChallengeMethod: 'S256',
    state,
  })

  res.redirect(authUrl)
})

router.get('/logout', async (req, res) => {
  const origin = extractOrigin(req.query.returnTo)
  const returnTo = (origin && config.frontendUrls.includes(origin))
    ? origin
    : config.frontendUrls[0]

  const { idToken, providerSid } = req.session

  // Each adapter owns its logout strategy: Keycloak returns a redirect URL,
  // WorkOS calls revokeSession and returns null. If the provider is unreachable,
  // logout still proceeds and the user is sent to the frontend.
  const logoutUrl = await auth.handleLogout({
    providerSid,
    idToken,
    returnTo: `${returnTo}/`,
  }).catch(() => null)

  req.session.destroy(() => {
    if (providerSid) providerSidToSessionId.delete(providerSid)
    res.redirect(logoutUrl ?? `${returnTo}/`)
  })
})

router.get('/callback', async (req, res) => {
  const { code, state } = req.query
  if (!code) return res.status(400).send('Missing authorization code')
  if (!state) return res.status(400).send('Missing state')

  let nonce
  try {
    nonce = parseState(state)
  } catch {
    return res.status(400).send('Invalid state parameter')
  }

  const pkce = req.session[`pkce_${nonce}`]
  if (!pkce) return res.status(400).send('Login session expired or not found')
  const { codeVerifier, returnTo } = pkce
  delete req.session[`pkce_${nonce}`]

  try {
    const user = await auth.authenticateWithCode({
      code,
      codeVerifier,
      redirectUri: `${config.bffUrl}/auth/callback`,
    })

    req.session.user = {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    }
    if (user.idToken) req.session.idToken = user.idToken
    if (user.providerSid) {
      req.session.providerSid = user.providerSid
      providerSidToSessionId.set(user.providerSid, req.session.id)
    }

    res.redirect(`${returnTo}/profile.html`)
  } catch (err) {
    res.status(400).send(err.message || 'Authentication failed')
  }
})

// Called server-to-server by the auth provider when a session is revoked,
// propagating logout across all BFF instances automatically.
// Keycloak uses OIDC back-channel logout (RFC spec), WorkOS uses webhooks —
// both are handled by the adapter's verifyLogoutToken implementation.
router.post('/backchannel-logout', express.raw({ type: '*/*' }), async (req, res) => {
  const rawBody = req.body?.toString() ?? ''

  try {
    const { sid } = await auth.verifyLogoutToken({ rawBody, headers: req.headers })
    if (!sid) return res.status(400).end()

    const sessionId = providerSidToSessionId.get(sid)
    if (sessionId) {
      req.sessionStore.destroy(sessionId, () => {
        providerSidToSessionId.delete(sid)
      })
    }

    res.status(200).end()
  } catch {
    res.status(400).end()
  }
})

module.exports = router

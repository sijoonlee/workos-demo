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

function extractOrigin(url) {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
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

  const codeVerifier = crypto.randomBytes(32).toString('base64url')
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')

  req.session.codeVerifier = codeVerifier
  req.session.returnTo = origin

  const authUrl = auth.getAuthorizationUrl({
    redirectUri: `${config.bffUrl}/auth/callback`,
    codeChallenge,
    codeChallengeMethod: 'S256',
  })

  res.redirect(authUrl)
})

router.get('/logout', (req, res) => {
  const origin = extractOrigin(req.query.returnTo)
  const returnTo = (origin && config.frontendUrls.includes(origin))
    ? origin
    : config.frontendUrls[0]

  const idToken = req.session.idToken
  req.session.destroy(() => {
    const logoutUrl = auth.getLogOutUrl({ returnTo: `${returnTo}/`, idToken })
    res.redirect(logoutUrl ?? `${returnTo}/`)
  })
})

router.get('/callback', async (req, res) => {
  const { code } = req.query
  if (!code) return res.status(400).send('Missing authorization code')

  const { codeVerifier, returnTo } = req.session
  if (!codeVerifier) return res.status(400).send('Missing code verifier')
  if (!returnTo) return res.status(400).send('Missing return URL')

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
    delete req.session.codeVerifier
    delete req.session.returnTo

    res.redirect(`${returnTo}/profile.html`)
  } catch (err) {
    res.status(400).send(err.message || 'Authentication failed')
  }
})

module.exports = router

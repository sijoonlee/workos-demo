const crypto = require('crypto')
const express = require('express')
const { WorkOS } = require('@workos-inc/node')
const config = require('../../shared/config')

const router = express.Router()
const workos = new WorkOS(config.workosApiKey)

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

  // The codeVerifier and returnTo are stored in the session so they survive the round-trip
  // to WorkOS and back. The session is the only safe place — it lives server-side and
  // never touches the browser. returnTo tells the callback which site initiated the login.
  req.session.codeVerifier = codeVerifier
  req.session.returnTo = origin

  const authUrl = workos.userManagement.getAuthorizationUrl({
    clientId: config.workosClientId,
    redirectUri: `${config.bffUrl}/auth/callback`,
    provider: 'GoogleOAuth',
    codeChallenge,
    codeChallengeMethod: 'S256',
  })

  res.redirect(authUrl)
})

router.get('/logout', (req, res) => {
  const origin = extractOrigin(req.query.returnTo)
  const target = (origin && config.frontendUrls.includes(origin))
    ? origin
    : config.frontendUrls[0]

  req.session.destroy(() => {
    res.redirect(`${target}/`)
  })
})

router.get('/callback', async (req, res) => {
  const { code } = req.query
  if (!code) return res.status(400).send('Missing authorization code')

  const { codeVerifier, returnTo } = req.session
  if (!codeVerifier) return res.status(400).send('Missing code verifier')
  if (!returnTo) return res.status(400).send('Missing return URL')

  try {
    const { user } = await workos.userManagement.authenticateWithCodeAndVerifier({
      code,
      codeVerifier,
      clientId: config.workosClientId,
    })

    req.session.user = {
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      email: user.email,
    }
    delete req.session.codeVerifier
    delete req.session.returnTo

    res.redirect(`${returnTo}/profile.html`)
  } catch (err) {
    res.status(400).send(err.message || 'Authentication failed')
  }
})

module.exports = router

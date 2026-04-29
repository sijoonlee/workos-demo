const crypto = require('crypto')
const express = require('express')
const { WorkOS } = require('@workos-inc/node')
const config = require('../../shared/config')

const router = express.Router()
const workos = new WorkOS(config.workosApiKey)

router.get('/session', (req, res) => {
  if (req.session.user) {
    const { firstName, lastName, email } = req.session.user
    return res.json({ authenticated: true, user: { firstName, lastName, email } })
  }
  res.json({ authenticated: false })
})

router.get('/login', async (req, res) => {
  const codeVerifier = crypto.randomBytes(32).toString('base64url')
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')

  // The codeVerifier is stored in the session at /auth/login so it can be retrieved at /auth/callback.
  // The PKCE flow spans two separate HTTP requests:
  //   1. /auth/login — generates the codeVerifier/codeChallenge pair,
  //                    sends codeChallenge to WorkOS, and must hold onto codeVerifier somewhere until the callback arrives
  //   2. /auth/callback — receives the authorization code from WorkOS
  //                       and must prove it's the same party that initiated the login by submitting the original codeVerifier
  // The session is the only safe place to keep codeVerifier between those two requests
  // : it lives server-side and never touches the browser.
  // That's exactly what makes this the BFF pattern: the browser only ever sees the redirect, never the verifier itself.
  // Note: The session is identified by a cookie (sid) that the browser stores after the first request
  // and sends back automatically on every subsequent request to the same origin
  req.session.codeVerifier = codeVerifier

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
  req.session.destroy(() => {
    res.redirect(config.frontendUrl)
  })
})

router.get('/callback', async (req, res) => {
  const { code } = req.query
  if (!code) return res.status(400).send('Missing authorization code')

  const { codeVerifier } = req.session
  if (!codeVerifier) return res.status(400).send('Missing code verifier')

  try {
    const {
      user,
      organizationId,
      // this is access token for google.
      // you'll not need this unless you make request to google on behalf of the user from your BFF
      accessToken,
      // this is refresh token for google.
      refreshToken,
      impersonator,
      authenticationMethod,
      sealedSession,
      oauthTokens,
    } = await workos.userManagement.authenticateWithCodeAndVerifier({
      code,
      codeVerifier,
      clientId: config.workosClientId,
    });

    console.log(JSON.stringify({
      user,
      organizationId,
      accessToken,
      refreshToken,
      impersonator,
      authenticationMethod,
      sealedSession,
      oauthTokens,
    }, null, 4));

    req.session.user = {
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      email: user.email,
    }
    delete req.session.codeVerifier

    res.redirect(`${config.frontendUrl}/profile.html`)
  } catch (err) {
    res.status(400).send(err.message || 'Authentication failed')
  }
})

module.exports = router

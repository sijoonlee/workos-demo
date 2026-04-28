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

    res.redirect(`${config.frontendUrl}/profile.html`)
  } catch (err) {
    res.status(400).send(err.message || 'Authentication failed')
  }
})

module.exports = router

const crypto = require('crypto')
const AuthAdapter = require('./AuthAdapter')

class KeycloakAdapter extends AuthAdapter {
  /**
   * @param {{ baseUrl: string, realm: string, clientId: string, clientSecret: string, idpHint?: string }} config
   *   baseUrl      — Keycloak server root, e.g. http://localhost:8080
   *   realm        — realm name configured in Keycloak
   *   clientId     — client ID registered in the realm
   *   clientSecret — client secret (required for confidential clients)
   */
  constructor({ baseUrl, realm, clientId, clientSecret, idpHint }) {
    super()
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.idpHint = idpHint
    this.baseOidcUrl = `${baseUrl}/realms/${realm}/protocol/openid-connect`
    this.jwksUrl = `${baseUrl}/realms/${realm}/protocol/openid-connect/certs`
    this._jwksCache = null
    this._jwksCacheExpiry = 0
  }

  getAuthorizationUrl({ redirectUri, codeChallenge, codeChallengeMethod, state, idpHint }) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      scope: 'openid profile email',
      state,
    })
    const hint = idpHint ?? this.idpHint
    if (hint) params.set('kc_idp_hint', hint)
    return `${this.baseOidcUrl}/auth?${params}`
  }

  async authenticateWithCode({ code, codeVerifier, redirectUri }) {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    })

    const tokenRes = await fetch(`${this.baseOidcUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })

    if (!tokenRes.ok) {
      const text = await tokenRes.text()
      throw new Error(`Keycloak token exchange failed: ${text}`)
    }

    const { access_token, id_token } = await tokenRes.json()

    // Parse the id_token payload (trusted — came directly from token endpoint over TLS)
    // to extract the Keycloak session ID (sid) needed for back-channel logout.
    const providerSid = id_token
      ? JSON.parse(Buffer.from(id_token.split('.')[1], 'base64url').toString()).sid
      : undefined

    const userRes = await fetch(`${this.baseOidcUrl}/userinfo`, {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    if (!userRes.ok) throw new Error('Keycloak userinfo request failed')

    const profile = await userRes.json()
    return {
      firstName: profile.given_name ?? '',
      lastName: profile.family_name ?? '',
      email: profile.email,
      idToken: id_token,
      providerSid,
    }
  }

  // Keycloak logout is browser-driven: redirect the user to Keycloak's logout
  // endpoint, which terminates the Keycloak session and redirects back to the
  // frontend. No server-side API call needed.
  async handleLogout({ idToken, returnTo }) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      post_logout_redirect_uri: returnTo,
    })
    if (idToken) params.set('id_token_hint', idToken)
    return `${this.baseOidcUrl}/logout?${params}`
  }

  // To support multi-site logout propagation
  // Verifies a back-channel logout_token JWT sent by Keycloak.
  // Fetches Keycloak's public keys (JWKS) to verify the signature, caching
  // them for 5 minutes to avoid a round-trip on every logout request.
  async verifyLogoutToken({ rawBody }) {
    const token = new URLSearchParams(rawBody).get('logout_token')
    if (!token) throw new Error('Missing logout_token in request body')

    const [headerB64, payloadB64, sigB64] = token.split('.')
    if (!headerB64 || !payloadB64 || !sigB64) throw new Error('Malformed logout_token')

    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString())
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString())

    const jwk = await this._getJwk(header.kid)
    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' })

    const verify = crypto.createVerify('RSA-SHA256')
    verify.update(`${headerB64}.${payloadB64}`)
    if (!verify.verify(publicKey, Buffer.from(sigB64, 'base64url'))) {
      throw new Error('Invalid logout_token signature')
    }

    if (!payload.events?.['http://schemas.openid.net/event/backchannel-logout']) {
      throw new Error('Not a backchannel-logout token')
    }

    return { sid: payload.sid }
  }

  async _getJwk(kid) {
    if (!this._jwksCache || Date.now() > this._jwksCacheExpiry) {
      const res = await fetch(this.jwksUrl)
      if (!res.ok) throw new Error('Failed to fetch JWKS')
      this._jwksCache = await res.json()
      this._jwksCacheExpiry = Date.now() + 5 * 60 * 1000
    }
    const jwk = this._jwksCache.keys.find(k => k.kid === kid)
    if (!jwk) throw new Error(`No JWKS key found for kid: ${kid}`)
    return jwk
  }
}

module.exports = KeycloakAdapter

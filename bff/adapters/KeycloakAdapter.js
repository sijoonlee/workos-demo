const AuthAdapter = require('./AuthAdapter')

class KeycloakAdapter extends AuthAdapter {
  /**
   * @param {{ baseUrl: string, realm: string, clientId: string, clientSecret: string }} config
   *   baseUrl     — Keycloak server root, e.g. http://localhost:8080
   *   realm       — realm name configured in Keycloak
   *   clientId    — client ID registered in the realm
   *   clientSecret — client secret (required for confidential clients)
   */
  constructor({ baseUrl, realm, clientId, clientSecret, idpHint }) {
    super()
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.idpHint = idpHint
    this.baseOidcUrl = `${baseUrl}/realms/${realm}/protocol/openid-connect`
  }

  getAuthorizationUrl({ redirectUri, codeChallenge, codeChallengeMethod, idpHint }) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      scope: 'openid profile email',
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

    const userRes = await fetch(`${this.baseOidcUrl}/userinfo`, {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    if (!userRes.ok) throw new Error('Keycloak userinfo request failed')

    const profile = await userRes.json()
    return {
      firstName: profile.given_name ?? '',
      lastName: profile.family_name ?? '',
      email: profile.email,
      idToken: id_token, // caller may store this for logout
    }
  }

  getLogOutUrl({ returnTo, idToken }) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      post_logout_redirect_uri: returnTo,
    })
    if (idToken) params.set('id_token_hint', idToken)
    return `${this.baseOidcUrl}/logout?${params}`
  }
}

module.exports = KeycloakAdapter

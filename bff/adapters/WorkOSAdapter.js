const { WorkOS } = require('@workos-inc/node')
const AuthAdapter = require('./AuthAdapter')

class WorkOSAdapter extends AuthAdapter {
  constructor({ apiKey, clientId, webhookSecret }) {
    super()
    this.clientId = clientId
    this.webhookSecret = webhookSecret
    this.workos = new WorkOS(apiKey)
  }

  getAuthorizationUrl({ redirectUri, codeChallenge, codeChallengeMethod, state }) {
    return this.workos.userManagement.getAuthorizationUrl({
      clientId: this.clientId,
      redirectUri,
      provider: 'GoogleOAuth',
      codeChallenge,
      codeChallengeMethod,
      state,
    })
  }

  async authenticateWithCode({ code, codeVerifier }) {
    const { user, accessToken } = await this.workos.userManagement.authenticateWithCodeAndVerifier({
      code,
      codeVerifier,
      clientId: this.clientId,
    })

    // Parse the accessToken JWT payload (trusted — came directly from WorkOS token
    // endpoint) to extract the WorkOS session ID (sid) needed for webhook logout.
    const providerSid = accessToken
      ? JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString()).sid
      : undefined

    return {
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      email: user.email,
      providerSid,
    }
  }

  // WorkOS logout is API-driven: no logout redirect URL exists, so the BFF
  // calls revokeSession directly. WorkOS then emits a session.revoked webhook
  // to notify all other BFF instances to clean up their sessions.
  async handleLogout({ providerSid }) {
    if (providerSid) {
      await this.workos.userManagement.revokeSession({ sessionId: providerSid })
    }
    return null
  }

  // WorkOS pushes a `session.revoked` webhook event (server-to-server) when any
  // session is revoked, rather than using the OIDC back-channel logout spec.
  async verifyLogoutToken({ rawBody, headers }) {
    const sigHeader = headers['workos-signature']
    if (!sigHeader) throw new Error('Missing WorkOS-Signature header')

    const event = await this.workos.webhooks.constructEvent({
      payload: rawBody,
      sigHeader,
      secret: this.webhookSecret,
    })

    if (event.event !== 'session.revoked') {
      throw new Error(`Unexpected webhook event type: ${event.event}`)
    }

    return { sid: event.data.id }
  }
}

module.exports = WorkOSAdapter

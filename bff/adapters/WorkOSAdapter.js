const { WorkOS } = require('@workos-inc/node')
const AuthAdapter = require('./AuthAdapter')

class WorkOSAdapter extends AuthAdapter {
  constructor({ apiKey, clientId }) {
    super()
    this.clientId = clientId
    this.workos = new WorkOS(apiKey)
  }

  getAuthorizationUrl({ redirectUri, codeChallenge, codeChallengeMethod }) {
    return this.workos.userManagement.getAuthorizationUrl({
      clientId: this.clientId,
      redirectUri,
      provider: 'GoogleOAuth',
      codeChallenge,
      codeChallengeMethod,
    })
  }

  async authenticateWithCode({ code, codeVerifier }) {
    const { user } = await this.workos.userManagement.authenticateWithCodeAndVerifier({
      code,
      codeVerifier,
      clientId: this.clientId,
    })
    return {
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      email: user.email,
    }
  }

  // WorkOS has no provider-side logout URL in this PKCE flow — session teardown
  // is handled entirely by the BFF. Return null so the caller falls back to
  // redirecting the user directly to the frontend.
  getLogOutUrl({ returnTo }) {
    return null
  }
}

module.exports = WorkOSAdapter

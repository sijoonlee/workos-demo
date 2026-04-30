/**
 * Abstract base class for auth provider adapters.
 * All adapters must implement the three methods below.
 *
 * Normalized user shape returned by authenticateWithCode:
 *   { firstName: string, lastName: string, email: string }
 */
class AuthAdapter {
  /**
   * Returns the provider's authorization URL to redirect the user to.
   * @param {{ redirectUri: string, codeChallenge: string, codeChallengeMethod: string }} params
   * @returns {string}
   */
  // eslint-disable-next-line no-unused-vars
  getAuthorizationUrl(params) {
    throw new Error(`${this.constructor.name} must implement getAuthorizationUrl`)
  }

  /**
   * Exchanges an authorization code for a normalized user object.
   * @param {{ code: string, codeVerifier: string, redirectUri: string }} params
   * @returns {Promise<{ firstName: string, lastName: string, email: string }>}
   */
  // eslint-disable-next-line no-unused-vars
  async authenticateWithCode(params) {
    throw new Error(`${this.constructor.name} must implement authenticateWithCode`)
  }

  /**
   * Returns the provider's post-logout redirect URL, or null if the provider
   * has no server-side logout endpoint.
   * @param {{ returnTo: string, sessionId?: string, idToken?: string }} params
   * @returns {string|null}
   */
  // eslint-disable-next-line no-unused-vars
  getLogOutUrl(params) {
    throw new Error(`${this.constructor.name} must implement getLogOutUrl`)
  }
}

module.exports = AuthAdapter

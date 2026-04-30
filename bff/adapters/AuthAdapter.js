/**
 * Abstract base class for auth provider adapters.
 * All adapters must implement the methods below.
 *
 * Normalized user shape returned by authenticateWithCode:
 *   { firstName: string, lastName: string, email: string }
 */
class AuthAdapter {
  /**
   * Returns the provider's authorization URL to redirect the user to.
   * @param {{ redirectUri: string, codeChallenge: string, codeChallengeMethod: string, state: string }} params
   * @returns {string}
   */
  // eslint-disable-next-line no-unused-vars
  getAuthorizationUrl(params) {
    throw new Error(`${this.constructor.name} must implement getAuthorizationUrl`)
  }

  /**
   * Exchanges an authorization code for a normalized user object.
   * @param {{ code: string, codeVerifier: string, redirectUri: string }} params
   * @returns {Promise<{ firstName: string, lastName: string, email: string, providerSid?: string, idToken?: string }>}
   */
  // eslint-disable-next-line no-unused-vars
  async authenticateWithCode(params) {
    throw new Error(`${this.constructor.name} must implement authenticateWithCode`)
  }

  /**
   * Handles provider-side logout. Each provider owns its own logout strategy:
   * - Redirect-based providers (e.g. Keycloak): return a URL for the browser to visit
   * - API-based providers (e.g. WorkOS): call the provider's revoke API, return null
   *
   * The BFF redirects to the returned URL, or falls back to the frontend if null.
   * @param {{ providerSid: string, idToken?: string, returnTo: string }} params
   * @returns {Promise<string|null>}
   */
  // eslint-disable-next-line no-unused-vars
  async handleLogout(params) {
    throw new Error(`${this.constructor.name} must implement handleLogout`)
  }

  /**
   * Verifies a back-channel logout request sent by the auth provider.
   * Returns a normalized payload containing the provider session ID.
   * @param {{ rawBody: string, headers: object }} params
   * @returns {Promise<{ sid: string }>}
   */
  // eslint-disable-next-line no-unused-vars
  async verifyLogoutToken({ rawBody, headers }) {
    throw new Error(`${this.constructor.name} must implement verifyLogoutToken`)
  }
}

module.exports = AuthAdapter

const appEnv = process.env.APP_ENV || 'local'
const isProduction = appEnv === 'production'

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

const sessionSecret = required('SESSION_SECRET')

const authProvider = process.env.AUTH_PROVIDER || 'workos' // 'workos' | 'keycloak'

const workosApiKey = authProvider === 'workos' ? required('WORKOS_API_KEY') : ''
const workosClientId = authProvider === 'workos' ? required('WORKOS_CLIENT_ID') : ''

const keycloakBaseUrl = process.env.KEYCLOAK_BASE_URL || ''
const keycloakRealm = process.env.KEYCLOAK_REALM || ''
const keycloakClientId = process.env.KEYCLOAK_CLIENT_ID || ''
const keycloakClientSecret = process.env.KEYCLOAK_CLIENT_SECRET || ''
const keycloakIdpHint = process.env.KEYCLOAK_IDP_HINT || ''

let frontendUrls, bffUrl
if (isProduction) {
  frontendUrls = required('FRONTEND_URLS').split(',').map(u => u.trim())
  bffUrl = required('BFF_URL')
} else {
  const raw = process.env.FRONTEND_URLS || 'http://localhost:3000,http://localhost:3002'
  frontendUrls = raw.split(',').map(u => u.trim())
  bffUrl = process.env.BFF_URL || 'http://localhost:3001'
}

const cookie = isProduction
  ? { secure: true, sameSite: 'none', name: '__Host-sid' }
  : { secure: false, sameSite: 'lax', name: 'sid' }

module.exports = {
  appEnv,
  frontendUrls,
  bffUrl,
  sessionSecret,
  authProvider,
  workosApiKey,
  workosClientId,
  keycloakBaseUrl,
  keycloakRealm,
  keycloakClientId,
  keycloakClientSecret,
  keycloakIdpHint,
  cookie,
}

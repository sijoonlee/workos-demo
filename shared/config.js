const appEnv = process.env.APP_ENV || 'local'
const isProduction = appEnv === 'production'

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

const sessionSecret = required('SESSION_SECRET')
const workosApiKey = required('WORKOS_API_KEY')
const workosClientId = required('WORKOS_CLIENT_ID')

let frontendUrl, bffUrl
if (isProduction) {
  frontendUrl = required('FRONTEND_URL')
  bffUrl = required('BFF_URL')
} else {
  frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
  bffUrl = process.env.BFF_URL || 'http://localhost:3001'
}

const cookie = isProduction
  ? { secure: true, sameSite: 'none', name: '__Host-sid' }
  : { secure: false, sameSite: 'lax', name: 'sid' }

module.exports = {
  appEnv,
  frontendUrl,
  bffUrl,
  sessionSecret,
  workosApiKey,
  workosClientId,
  cookie,
}

const originalEnv = process.env

beforeEach(() => {
  jest.resetModules()
  process.env = {
    ...originalEnv,
    SESSION_SECRET: 'test-secret',
    WORKOS_API_KEY: 'test-api-key',
    WORKOS_CLIENT_ID: 'test-client-id',
  }
})

afterEach(() => {
  process.env = originalEnv
})

test('local mode sets correct cookie flags and default URLs', () => {
  process.env.APP_ENV = 'local'
  const config = require('../shared/config')
  expect(config.frontendUrls).toEqual(['http://localhost:3000', 'http://localhost:3002'])
  expect(config.bffUrl).toBe('http://localhost:3001')
  expect(config.cookie).toEqual({ secure: false, sameSite: 'lax', name: 'sid' })
})

test('local mode parses FRONTEND_URLS into an array', () => {
  process.env.APP_ENV = 'local'
  process.env.FRONTEND_URLS = 'http://localhost:3000, http://localhost:3002'
  const config = require('../shared/config')
  expect(config.frontendUrls).toEqual(['http://localhost:3000', 'http://localhost:3002'])
})

test('production mode throws if FRONTEND_URLS is missing', () => {
  process.env.APP_ENV = 'production'
  process.env.BFF_URL = 'https://api.example.com'
  delete process.env.FRONTEND_URLS
  expect(() => require('../shared/config')).toThrow('Missing required environment variable: FRONTEND_URLS')
})

test('production mode throws if BFF_URL is missing', () => {
  process.env.APP_ENV = 'production'
  process.env.FRONTEND_URLS = 'https://app1.example.com,https://app2.example.com'
  delete process.env.BFF_URL
  expect(() => require('../shared/config')).toThrow('Missing required environment variable: BFF_URL')
})

test('throws if SESSION_SECRET is missing in any mode', () => {
  delete process.env.SESSION_SECRET
  expect(() => require('../shared/config')).toThrow('Missing required environment variable: SESSION_SECRET')
})

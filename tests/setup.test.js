process.env.SESSION_SECRET = 'test-secret'
process.env.WORKOS_API_KEY = 'test-api-key'
process.env.WORKOS_CLIENT_ID = 'test-client-id'

test('bff app initialises without error', () => {
  expect(() => require('../bff/server.js')).not.toThrow()
})

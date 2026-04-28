process.env.SESSION_SECRET = 'test-secret'
process.env.WORKOS_API_KEY = 'test-api-key'
process.env.WORKOS_CLIENT_ID = 'test-client-id'

const request = require('supertest')
const app = require('../bff/server')

test('OPTIONS /auth/session returns correct CORS headers for configured frontend origin', async () => {
  const res = await request(app)
    .options('/auth/session')
    .set('Origin', 'http://localhost:3000')
    .set('Access-Control-Request-Method', 'GET')
  expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000')
  expect(res.headers['access-control-allow-credentials']).toBe('true')
})

test('requests from unknown origin do not receive Access-Control-Allow-Origin', async () => {
  const res = await request(app)
    .options('/auth/session')
    .set('Origin', 'http://evil.example.com')
    .set('Access-Control-Request-Method', 'GET')
  expect(res.headers['access-control-allow-origin']).not.toBe('http://evil.example.com')
})

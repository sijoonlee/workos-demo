process.env.SESSION_SECRET = 'test-secret'
process.env.WORKOS_API_KEY = 'test-api-key'
process.env.WORKOS_CLIENT_ID = 'test-client-id'

const request = require('supertest')

jest.mock('@workos-inc/node', () => ({
  WorkOS: jest.fn().mockImplementation(() => ({
    userManagement: {
      getAuthorizationUrl: jest.fn(),
      authenticateWithCodeAndVerifier: jest.fn(),
    },
  })),
}))

const app = require('../bff/server')

app.get('/__test_set_user', (req, res) => {
  req.session.user = { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' }
  res.sendStatus(200)
})

test('GET /auth/logout destroys session and redirects to the given returnTo', async () => {
  const agent = request.agent(app)
  await agent.get('/__test_set_user')

  const res = await agent.get('/auth/logout?returnTo=http://localhost:3000').redirects(0)
  expect(res.status).toBe(302)
  expect(res.headers.location).toBe('http://localhost:3000/')
})

test('GET /auth/logout falls back to first frontend URL when returnTo is missing', async () => {
  const res = await request(app).get('/auth/logout')
  expect(res.status).toBe(302)
  expect(res.headers.location).toBe('http://localhost:3000/')
})

test('GET /auth/logout falls back to first frontend URL when returnTo is not in allowlist', async () => {
  const res = await request(app).get('/auth/logout?returnTo=http://evil.com')
  expect(res.status).toBe(302)
  expect(res.headers.location).toBe('http://localhost:3000/')
})

test('GET /auth/session returns authenticated:false after logout', async () => {
  const agent = request.agent(app)
  await agent.get('/__test_set_user')
  await agent.get('/auth/logout?returnTo=http://localhost:3000').redirects(0)

  const res = await agent.get('/auth/session')
  expect(res.status).toBe(200)
  expect(res.body).toEqual({ authenticated: false })
})
